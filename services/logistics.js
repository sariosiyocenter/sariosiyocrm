/**
 * Logistika: reyslar va yetkazish yozuvlari.
 *
 * Bitta manba — bu fayl. Admin sahifasi (server.js dagi endpointlar) ham,
 * haydovchining Telegram boti ham shu funksiyalarni chaqiradi. Ilgari ikkalasi
 * o'z hisobini yuritardi va bir kunda ikki xil ro'yxat chiqardi.
 */
import prisma from '../lib/prisma.js';
import { isLessonDay } from '../lib/lessons.js';
import { bekatlarniTartiblash, parseLatLng } from '../lib/tartib.js';
import { yetkazishXabari } from './transportNotify.js';

/**
 * Markaz nuqtasi Sozlamalarda belgilanmagan bo'lsa shu ishlatiladi — bot
 * "Geolokatsiya" tugmasida ota-onalarga aynan shu nuqtani yuboradi.
 */
export const ZAXIRA_MARKAZ = [38.4833, 67.9333];

/** Filialning markaz koordinatasi (Sozlamalardan, bo'lmasa zaxira). */
export async function markazNuqtasi(schoolId) {
  const s = await prisma.setting.findUnique({ where: { schoolId }, select: { centerLocation: true } });
  return parseLatLng(s?.centerLocation) || ZAXIRA_MARKAZ;
}

/**
 * Marshrut bekatlarini masofa bo'yicha qayta tartiblaydi va yozadi.
 *
 * Haydovchi qaysi uydan boshlab qaysi uyga borishini tizim o'zi hal qiladi:
 * ertalab eng chekkadan boshlab markazga yaqinlashib keladi, kechqurun
 * markazdan boshlab tarqatadi. Koordinatasi yo'q o'quvchilar oxirida qoladi.
 * Qaytaradi: yangi tartib (o'quvchi id lari) va yo'l uzunligi.
 */
export async function marshrutniTartiblash(routeId) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: { stops: { include: { student: { select: { id: true, location: true } } } } },
  });
  if (!route) return null;
  const markaz = await markazNuqtasi(route.schoolId);
  const natija = bekatlarniTartiblash(
    route.stops.map(s => ({ id: s.studentId, location: s.student?.location })),
    markaz,
    route.direction,
  );
  await prisma.$transaction(
    natija.tartib.map((studentId, i) =>
      prisma.routeStop.update({ where: { routeId_studentId: { routeId, studentId } }, data: { tartib: i } })
    )
  );
  return natija;
}

/** Ertalabki reysda o'quvchi olinadi yoki chiqmaydi. */
export const KETISH_HOLATLAR = ['Olib ketildi', 'Kelmadi'];
/** Kechqurungi reysda uyiga yetkaziladi yoki chiqmaydi. */
export const QAYTISH_HOLATLAR = ['Uyiga yetkazildi', 'Kelmadi'];

/** Marshrut yo'nalishiga mos holatlar ro'yxati. */
export function holatlar(direction) {
  return direction === 'QAYTISH' ? QAYTISH_HOLATLAR : KETISH_HOLATLAR;
}

/** Marshrutni bekatlari bilan o'qish uchun umumiy shakl. */
export const MARSHRUT_INCLUDE = {
  transport: { select: { id: true, name: true, number: true } },
  driver: { select: { id: true, name: true, phone: true } },
  stops: {
    orderBy: { tartib: 'asc' },
    include: {
      student: {
        select: { id: true, name: true, phone: true, address: true, location: true, studentSchool: true, photo: true },
      },
    },
  },
};

/**
 * Shu marshrutning shu kundagi reysi. Bo'lmasa yaratiladi.
 *
 * Reys birinchi belgilash paytida o'zi paydo bo'ladi — hech kim uni qo'lda
 * ochmaydi. Mashina va haydovchi o'sha ondagi marshrutdan ko'chiriladi: keyin
 * marshrut o'zgarsa ham o'tgan kun kim qatnaganini saqlab qoladi.
 */
export async function reysniOlish({ route, date, schoolId, transportId = null }) {
  const bor = await prisma.routeRun.findUnique({
    where: { routeId_date: { routeId: route.id, date } },
  });
  if (bor) return bor;
  return prisma.routeRun.create({
    data: {
      routeId: route.id,
      date,
      driverId: route.driverId || null,
      transportId: transportId || route.transportId || null,
      schoolId,
    },
  });
}

/**
 * Yetkazish holatini yozadi (bor bo'lsa yangilaydi).
 *
 * Yozuv reysga bog'lanadi, shuning uchun bir o'quvchining ertalabki va
 * kechqurungi holati bir-birini bosib ketmaydi.
 */
export async function holatniYozish({ route, studentId, status, date, schoolId, markedById = null, transportId = null }) {
  const run = await reysniOlish({ route, date, schoolId, transportId });
  const mavjud = await prisma.deliveryLog.findFirst({ where: { runId: run.id, studentId } });

  const yozuv = {
    status,
    transportId: transportId || run.transportId || null,
    markedById,
    markedAt: new Date(),
  };
  const log = mavjud
    ? await prisma.deliveryLog.update({ where: { id: mavjud.id }, data: yozuv })
    : await prisma.deliveryLog.create({ data: { ...yozuv, studentId, date, schoolId, runId: run.id } });

  // Ota-onaga xabar faqat holat haqiqatan o'zgarganda: bir xil tugmani qayta
  // bosish yoki ro'yxatni yangilash ikkinchi xabar yubormasin.
  if (!mavjud || mavjud.status !== status) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true, name: true, phone: true,
        telegramId: true, fatherTelegramId: true, motherTelegramId: true,
        fatherPhone: true, motherPhone: true,
      },
    });
    if (student) {
      // Kutilmaydi: xabar ketmasa ham tugma ishlagani qolsin.
      yetkazishXabari({ student, status, route, schoolId }).catch(() => {});
    }
  }

  return log;
}

/** Yozuvni butunlay o'chirish — haydovchi noto'g'ri bosgan bo'lsa. */
export async function holatniOchirish({ runId, studentId }) {
  if (!runId) return;
  await prisma.deliveryLog.deleteMany({ where: { runId, studentId } });
}

/**
 * Haydovchining shu kundagi reyslari.
 *
 * Marshrut haydovchiga to'g'ridan-to'g'ri (`driverId`) yoki mashinasi orqali
 * biriktirilgan bo'lishi mumkin — ikkalasi ham hisobga olinadi.
 */
export async function bugungiReyslar({ schoolId, date, driverId = null }) {
  const where = { schoolId };
  if (driverId) {
    where.OR = [{ driverId }, { transport: { driverId } }];
  }
  const marshrutlar = await prisma.route.findMany({
    where,
    include: MARSHRUT_INCLUDE,
    orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
  });
  // Kunlik reja marshruti (`date` bor) faqat o'z kunida ko'rinadi. Uning
  // `days` i HAR_KUNI bo'lgani uchun faqat kun turi tekshirilsa, kechagi
  // reja haydovchining botida ertaga ham chiqaverardi.
  return marshrutlar.filter(r => (r.date ? r.date === date : isLessonDay(r.days, date)));
}

/**
 * Bitta marshrutning shu kundagi holati: reys (bo'lsa) va yozuvlar.
 *
 * Reys ataylab yaratilmaydi — ro'yxatni ko'rish bilan bo'sh reys paydo
 * bo'lmasligi kerak.
 */
export async function marshrutHolati({ routeId, date }) {
  const run = await prisma.routeRun.findUnique({ where: { routeId_date: { routeId, date } } });
  const logs = run
    ? await prisma.deliveryLog.findMany({ where: { runId: run.id }, select: { studentId: true, status: true } })
    : [];
  const holatlarMap = {};
  for (const l of logs) holatlarMap[l.studentId] = l.status;
  return { run, holatlar: holatlarMap };
}

/** Reysni boshlash / tugatish vaqtini yozadi. */
export async function reysVaqti({ route, date, schoolId, maydon }) {
  const run = await reysniOlish({ route, date, schoolId });
  return prisma.routeRun.update({
    where: { id: run.id },
    data: { [maydon]: new Date() },
  });
}
