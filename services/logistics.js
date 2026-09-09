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
import { reyalarniTuzish } from '../lib/rejalash.js';
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
  return marshrutlar.filter(r => isLessonDay(r.days, date));
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

/**
 * Avtomatik rejalashtirish: transportga muhtoj o'quvchilarni tanlangan
 * mashinalarga taqsimlaydi va marshrutlarni tuzadi.
 *
 * Qo'lda tuzilgan marshrutlarga tegilmaydi — ulardagi o'quvchilar rejadan
 * chetda qoladi (ular allaqachon joylashgan). Tizim faqat o'zi yaratgan
 * marshrutlarni (autoPlanned) yangilaydi: eskilari o'chirilmaydi, chunki
 * ularda reys tarixi bor — o'rniga bekatlari qayta yoziladi.
 *
 * `apply: false` bo'lsa hech narsa yozilmaydi — faqat reja qaytadi.
 */
export async function marshrutlarniRejalash({
  schoolId, direction = 'KETISH', transportIds = [], startTime = '07:30',
  days = 'HAR_KUNI', rejim = 'tez', apply = false,
}) {
  const markaz = await markazNuqtasi(schoolId);

  const mashinalar = await prisma.transport.findMany({
    where: { schoolId, status: 'Faol', ...(transportIds.length ? { id: { in: transportIds } } : {}) },
    select: { id: true, name: true, capacity: true, driverId: true },
    orderBy: { capacity: 'desc' },
  });

  // Qo'lda tuzilgan marshrutda turgan o'quvchi rejaga kirmaydi.
  const qoldagilar = await prisma.routeStop.findMany({
    where: { route: { schoolId, direction, autoPlanned: false } },
    select: { studentId: true },
  });
  const qolda = new Set(qoldagilar.map(x => x.studentId));

  const oquvchilar = (await prisma.student.findMany({
    where: { schoolId, needsTransport: true, status: { in: ['Faol', 'Sinov'] } },
    select: { id: true, name: true, location: true, address: true },
    orderBy: { name: 'asc' },
  })).filter(o => !qolda.has(o.id));

  const natija = reyalarniTuzish({ markaz, oquvchilar, mashinalar, direction, startTime, rejim });
  const ism = new Map(oquvchilar.map(o => [o.id, o.name]));
  const yonalishNomi = direction === 'QAYTISH' ? 'kechqurun' : 'ertalab';

  const rejalar = natija.rejalar.map(r => ({
    ...r,
    nomi: `${r.transportName} — ${yonalishNomi}${r.navbat > 1 ? ` (${r.navbat}-reys)` : ''}`,
    oquvchilar: r.studentIds.map(id => ({ id, name: ism.get(id) })),
  }));

  const javob = {
    rejalar,
    sigmaganlar: natija.sigmaganlar.map(id => ({ id, name: ism.get(id) })),
    nuqtasiz: natija.nuqtasiz.map(id => ({ id, name: ism.get(id) })),
    jami: {
      oquvchi: oquvchilar.length,
      qoldaJoylashgan: qolda.size,
      marshrut: rejalar.length,
      km: rejalar.reduce((s, r) => s + r.km, 0),
      engUzunDaqiqa: rejalar.length ? Math.max(...rejalar.map(r => r.daqiqa)) : 0,
    },
    qollandi: false,
  };
  if (!apply) return javob;

  // --- yozamiz ---
  // Faqat shu rejalashtirishda qatnashgan mashinalarning marshrutlari
  // yangilanadi. Boshqa mashinaning marshruti chetda qoladi — admin bitta
  // mashinani rejalashtirganda qolganlarining bekatlari o'chib ketmasin.
  const mavjud = await prisma.route.findMany({
    where: {
      schoolId, direction, autoPlanned: true,
      ...(mashinalar.length ? { transportId: { in: mashinalar.map(m => m.id) } } : {}),
    },
    select: { id: true, transportId: true, navbat: true },
  });
  const ishlatilgan = new Set();

  for (const r of rejalar) {
    const bor = mavjud.find(m => m.transportId === r.transportId && m.navbat === r.navbat);
    const mashina = mashinalar.find(m => m.id === r.transportId);
    const data = {
      name: r.nomi, startTime: r.startTime, days, direction,
      transportId: r.transportId, driverId: mashina?.driverId || null,
      autoPlanned: true, navbat: r.navbat, autoOrder: true, schoolId,
    };
    const route = bor
      ? await prisma.route.update({ where: { id: bor.id }, data })
      : await prisma.route.create({ data });
    ishlatilgan.add(route.id);

    // Bekatlar: rejadagi tartib bilan.
    await prisma.routeStop.deleteMany({ where: { routeId: route.id, studentId: { notIn: r.studentIds } } });
    for (let i = 0; i < r.studentIds.length; i++) {
      await prisma.routeStop.upsert({
        where: { routeId_studentId: { routeId: route.id, studentId: r.studentIds[i] } },
        create: { routeId: route.id, studentId: r.studentIds[i], tartib: i },
        update: { tartib: i },
      });
    }
    r.routeId = route.id;
  }

  // Shu mashinalarning rejadan tushib qolgan marshrutlari bo'shatiladi
  // (masalan avval ikki reys kerak edi, endi bittasi yetadi). O'chirilmaydi:
  // ularda o'tgan kunlarning reys tarixi bor.
  const bosharaydiganlar = mavjud.filter(m => !ishlatilgan.has(m.id));
  for (const m of bosharaydiganlar) {
    await prisma.routeStop.deleteMany({ where: { routeId: m.id } });
  }
  javob.bosharatilgan = bosharaydiganlar.length;
  javob.qollandi = true;
  return javob;
}

/** Reysni boshlash / tugatish vaqtini yozadi. */
export async function reysVaqti({ route, date, schoolId, maydon }) {
  const run = await reysniOlish({ route, date, schoolId });
  return prisma.routeRun.update({
    where: { id: run.id },
    data: { [maydon]: new Date() },
  });
}
