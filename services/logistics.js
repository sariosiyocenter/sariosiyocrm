/**
 * Logistika: reyslar va yetkazish yozuvlari.
 *
 * Bitta manba — bu fayl. Admin sahifasi (server.js dagi endpointlar) ham,
 * haydovchining Telegram boti ham shu funksiyalarni chaqiradi. Ilgari ikkalasi
 * o'z hisobini yuritardi va bir kunda ikki xil ro'yxat chiqardi.
 */
import prisma from '../lib/prisma.js';
import { toTimeStr } from '../lib/lessons.js';
import { bekatlarniTartiblash, parseLatLng } from '../lib/tartib.js';
import { yetkazishXabari } from './transportNotify.js';
import { narxHisobla, uyMasofasi, rejaSummasi } from '../lib/transportNarx.js';

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
 * Yo'l haqi tarifi — butun markazga bitta, hamma haydovchi uchun (egasi,
 * 2026-09-25: "har bir haydovchi uchun emas, hammaga bitta qoida").
 * Organization.transportTarif; tashkilotga bog'lanmagan filialda null.
 */
export async function markazTarifi(schoolId) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { organization: { select: { transportTarif: true } } },
  });
  return school?.organization?.transportTarif ?? null;
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
 * Haydovchining shu kundagi rejalari.
 *
 * Faqat shu kunga tuzilgan rejalar (`Route.date`). Takrorlanuvchi (qo'lda
 * tuzilgan) marshrutlar endi yo'q — egasi 2026-09-19 da "marshrut o'zi
 * kerakmas" dedi: reja har kuni Logistika sahifasida tuziladi. Eski
 * marshrutlar bazada qoladi, lekin haydovchiga ko'rinmaydi.
 */
export async function bugungiReyslar({ schoolId, date, driverId = null }) {
  const where = { schoolId, date };
  if (driverId) {
    where.OR = [{ driverId }, { transport: { driverId } }];
  }
  return prisma.route.findMany({
    where,
    include: MARSHRUT_INCLUDE,
    orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
  });
}

/**
 * Bir nechta o'quvchining holatini birdaniga yozadi va ota-onalarga xabar
 * beradi. "Qabul qildim" / "Yetkazdim" tugmalari uchun: 20 ta bolani bittalab
 * `holatniYozish` bilan yozish Telegram webhook vaqtiga sig'masdi.
 */
async function ommaviyYozish({ route, run, studentIds, status, date, schoolId, markedById }) {
  if (!studentIds.length) return 0;
  const bor = await prisma.deliveryLog.findMany({
    where: { runId: run.id, studentId: { in: studentIds } },
    select: { studentId: true },
  });
  const borSet = new Set(bor.map(x => x.studentId));
  const yozuv = { status, transportId: run.transportId || null, markedById, markedAt: new Date() };
  await prisma.$transaction([
    prisma.deliveryLog.updateMany({ where: { runId: run.id, studentId: { in: [...borSet] } }, data: yozuv }),
    prisma.deliveryLog.createMany({
      data: studentIds.filter(id => !borSet.has(id)).map(studentId => ({ ...yozuv, studentId, date, schoolId, runId: run.id })),
    }),
  ]);

  // Ota-onaga xabar (Sozlamalarda yoqilgan bo'lsa — yetkazishXabari o'zi
  // tekshiradi). Kutiladi: serverless javobdan keyin ishni to'xtatadi.
  const oquvchilar = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true, name: true, phone: true,
      telegramId: true, fatherTelegramId: true, motherTelegramId: true,
      fatherPhone: true, motherPhone: true,
    },
  });
  const vaqt = toTimeStr();
  for (let i = 0; i < oquvchilar.length; i += 5) {
    await Promise.allSettled(oquvchilar.slice(i, i + 5).map(student =>
      yetkazishXabari({ student, status, route, schoolId, vaqt })));
  }
  return studentIds.length;
}

/** Rejaning joriy holati: bekatlar bo'yicha belgilar. */
async function belgilar(runId) {
  const logs = await prisma.deliveryLog.findMany({ where: { runId }, select: { studentId: true, status: true } });
  return new Map(logs.map(l => [l.studentId, l.status]));
}

/**
 * Haydovchi "Qabul qildim" bosdi — bolalarni mashinaga oldi.
 *
 * Reys boshlanadi, belgilanmagan har bir bola "Olib ketildi" bo'ladi.
 * Oldindan "Kelmadi" deb belgilangani tegilmaydi. Qayta bosilsa hech narsa
 * buzilmaydi.
 */
export async function rejaniQabulQilish({ route, date, schoolId, markedById = null }) {
  let run = await reysniOlish({ route, date, schoolId });
  if (!run.startedAt) {
    run = await prisma.routeRun.update({ where: { id: run.id }, data: { startedAt: new Date(), driverId: run.driverId || route.driverId || null } });
  }
  const holat = await belgilar(run.id);
  const olinadi = route.stops.map(s => s.studentId).filter(id => !holat.has(id));
  const soni = await ommaviyYozish({ route, run, studentIds: olinadi, status: 'Olib ketildi', date, schoolId, markedById });
  return { run, soni };
}

/**
 * Haydovchi "Yetkazdim" bosdi — hammasini uyiga yetkazdi.
 *
 * Reys tugaydi; "Kelmadi" dan boshqa hamma bola "Uyiga yetkazildi" bo'ladi.
 * "Qabul qildim" bosilmagan bo'lsa ham ishlaydi (boshlanish vaqti ham yoziladi).
 */
export async function rejaniYetkazish({ route, date, schoolId, markedById = null }) {
  let run = await reysniOlish({ route, date, schoolId });
  if (!run.finishedAt) {
    const hozir = new Date();
    run = await prisma.routeRun.update({
      where: { id: run.id },
      data: { startedAt: run.startedAt || hozir, finishedAt: hozir, driverId: run.driverId || route.driverId || null },
    });
  }
  const holat = await belgilar(run.id);
  const yetkaziladi = route.stops.map(s => s.studentId)
    .filter(id => holat.get(id) !== 'Kelmadi' && holat.get(id) !== 'Uyiga yetkazildi');
  const soni = await ommaviyYozish({ route, run, studentIds: yetkaziladi, status: 'Uyiga yetkazildi', date, schoolId, markedById });
  return { run, soni };
}

/** Reja bilan birga o'qiladigan shakl (bot va Logistika sahifasi uchun). */
export const REJA_INCLUDE = {
  ...MARSHRUT_INCLUDE,
  transport: { select: { id: true, name: true, model: true, number: true, capacity: true, tarif: true } },
  driver: { select: { id: true, name: true, phone: true, telegramId: true } },
};

/**
 * Kunlik rejalarni yozadi: har bir haydovchiga bitta reja (marshrut yozuvi
 * `date` bilan). Bir haydovchi kuniga bir necha reja olishi mumkin (ikkinchi
 * to'lqin) — `navbat` shuni sanaydi.
 *
 * @param {{driverId:number, studentIds:number[]}[]} rejalar
 * @returns {Promise<{xato?:string, routeIds?:number[]}>}
 */
export async function rejalarniYozish({ schoolId, date, rejalar }) {
  const driverIds = [...new Set(rejalar.map(r => r.driverId))];
  const haydovchilar = await prisma.user.findMany({
    where: {
      id: { in: driverIds }, role: 'DRIVER', status: { not: 'Arxiv' },
      OR: [{ schoolId }, { branches: { some: { id: schoolId } } }],
    },
    select: { id: true, name: true, driverTransport: { select: { id: true } } },
  });
  const hMap = new Map(haydovchilar.map(h => [h.id, h]));
  const yoq = driverIds.filter(id => !hMap.has(id));
  if (yoq.length) return { xato: 'Haydovchi shu filialda topilmadi' };

  const hammasi = rejalar.flatMap(r => r.studentIds);
  if (new Set(hammasi).size !== hammasi.length) return { xato: "Bir o'quvchi ikki rejaga tushib qolgan" };
  const borOquvchi = await prisma.student.findMany({ where: { id: { in: hammasi }, schoolId }, select: { id: true, location: true } });
  if (borOquvchi.length !== hammasi.length) return { xato: "O'quvchilardan biri shu filialda topilmadi" };
  // Yo'l haqi reja tuzilgan paytda hisoblanib bekatga yoziladi: haydovchi ham,
  // ota-ona ham reys boshlanishidan oldin narxni biladi.
  const [markaz, tarif] = await Promise.all([markazNuqtasi(schoolId), markazTarifi(schoolId)]);
  const joy = new Map(borOquvchi.map(s => [s.id, s.location]));

  const routeIds = [];
  for (const r of rejalar) {
    const h = hMap.get(r.driverId);
    const oldingi = await prisma.route.count({ where: { schoolId, date, driverId: h.id } });
    const navbat = oldingi + 1;
    const route = await prisma.route.create({
      data: {
        name: navbat > 1 ? `${h.name} — ${navbat}-reys` : h.name,
        startTime: toTimeStr(), days: 'HAR_KUNI', direction: 'QAYTISH',
        autoPlanned: true, autoOrder: true, navbat, date,
        driverId: h.id, transportId: h.driverTransport?.id || null, schoolId,
      },
    });
    await prisma.routeStop.createMany({
      data: r.studentIds.map((studentId, tartib) => {
        const masofaKm = uyMasofasi(markaz, joy.get(studentId));
        const { narx } = narxHisobla(tarif, masofaKm);
        return { routeId: route.id, studentId, tartib, masofaKm, narx };
      }),
    });
    // Tartib masofa bo'yicha: haydovchi ro'yxatni yaqinidan boshlab ko'radi.
    await marshrutniTartiblash(route.id);
    routeIds.push(route.id);
  }
  return { routeIds };
}

/**
 * Rejaning puli: hammasi uchun (reja tuzilganda aytilgan) va haqiqatan
 * olib ketilganlar uchun ("Kelmadi" dan boshqasi) — haydovchi shuni oladi.
 */
export function rejaPuli(stops, holatlar = {}) {
  const hammasi = rejaSummasi(stops.map(s => s.narx));
  const olingan = rejaSummasi(stops
    .filter(s => holatlar[s.studentId] && holatlar[s.studentId] !== 'Kelmadi')
    .map(s => s.narx));
  return { jami: hammasi.jami, aniqlanmagan: hammasi.aniqlanmagan, olingan: olingan.jami };
}

/**
 * Haydovchi joylashuvini yozadi (botdan). `livePeriod` — Telegram jonli
 * joylashuvining davomiyligi (soniya); 0x7FFFFFFF — "to'xtatmaguncha".
 */
export async function joylashuvniYozish({ driverId, schoolId, lat, lng, livePeriod = null, sentAt = null }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const live = Number(livePeriod) > 0;
  const cheksiz = Number(livePeriod) >= 0x7FFFFFFF;
  const boshi = sentAt ? new Date(sentAt * 1000) : new Date();
  const liveUntil = live && !cheksiz ? new Date(boshi.getTime() + Number(livePeriod) * 1000) : null;
  const data = { lat, lng, live, liveUntil, schoolId };
  return prisma.driverLocation.upsert({
    where: { driverId },
    create: { driverId, ...data },
    update: data,
  });
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
