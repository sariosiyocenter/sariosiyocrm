// O'quvchining manzili: doimiy va bir kunlik (egasi, 2026-10-08: "o'quvchi telegram
// bot orqali lokatsiyasini kirgizsin, dynamic — har darsda boshqa joyga borishim
// mumkin").
//
// Logistika hamma joyda `Student.location` ni o'qiydi (reja, taqsimot, haydovchi
// boti, xarita). Bir kunlik manzil uchun ularning hech birini o'zgartirmaslik
// maqsadida shu maydonning o'zi almashtiriladi:
//
//   kuni kelganda  — Student.location := bir kunlik nuqta, eskisi `avvalgi` ga;
//   kun o'tgach    — Student.location := avvalgi (agar shu orada xodim CRM dan
//                    boshqa manzil qo'ymagan bo'lsa).
//
// `kunlikJoylarniQolla()` shu ikki ishni bajaradi; idempotent. U botda (manzil
// yuborilganda), kunlik reja tuzilishidan oldin va fon ishlarida chaqiriladi.
import prisma from '../lib/prisma.js';
import { toDateStr } from '../lib/lessons.js';

/** "38.12345,67.54321" — 5 xona (≈1 metr). Noto'g'ri bo'lsa null. */
export function nuqtaMatni(lat, lng) {
  const a = Number(lat), b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return `${a.toFixed(5)},${b.toFixed(5)}`;
}

export const xaritaHavolasi = (nuqta) => `https://www.google.com/maps?q=${encodeURIComponent(nuqta)}`;

export function ertangiKun(sana = toDateStr()) {
  const d = new Date(`${sana}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Muddati o'tgan bir kunlik manzillarni qaytaradi va bugungilarini qo'llaydi.
 * @returns {Promise<{ qaytarildi: number, qollandi: number }>}
 */
export async function kunlikJoylarniQolla(bugun = toDateStr()) {
  let qaytarildi = 0, qollandi = 0;

  // 1. Kuni o'tganlar: doimiy manzil joyiga qaytadi.
  const otgan = await prisma.studentJoy.findMany({ where: { holat: 'qollandi', sana: { lt: bugun } }, orderBy: { id: 'asc' } });
  for (const j of otgan) {
    // Avval yozuv "egallanadi": bu funksiya bir vaqtda ikki joydan (bot va fon ishi)
    // chaqirilsa ham har yozuvni faqat bittasi bajaradi.
    const egalladi = await prisma.studentJoy.updateMany({ where: { id: j.id, holat: 'qollandi' }, data: { holat: 'tugadi' } });
    if (egalladi.count !== 1) continue;
    // Xodim shu orada CRM dan boshqa manzil qo'ygan bo'lsa — unga tegilmaydi.
    const n = await prisma.student.updateMany({ where: { id: j.studentId, location: j.location }, data: { location: j.avvalgi } });
    qaytarildi += n.count;
  }
  // Kuni o'tib ketgan, qo'llanmay qolganlar (o'sha kuni hech kim chaqirmagan).
  await prisma.studentJoy.updateMany({ where: { holat: 'kutilmoqda', sana: { lt: bugun } }, data: { holat: 'tugadi' } });

  // 2. Bugungilar: amalga kiradi.
  const bugungi = await prisma.studentJoy.findMany({ where: { holat: 'kutilmoqda', sana: bugun }, orderBy: { id: 'asc' } });
  for (const j of bugungi) {
    const s = await prisma.student.findUnique({ where: { id: j.studentId }, select: { location: true } });
    if (!s) { await prisma.studentJoy.updateMany({ where: { id: j.id, holat: 'kutilmoqda' }, data: { holat: 'bekor' } }); continue; }
    // Egallash va doimiy manzilni eslab qolish — bitta shartli yozuvda. Ikkinchi parallel
    // chaqiruv bu yerda 0 oladi va "doimiy" o'rniga bir kunlik nuqtani yozib qo'ymaydi.
    const egalladi = await prisma.studentJoy.updateMany({ where: { id: j.id, holat: 'kutilmoqda' }, data: { holat: 'qollandi', avvalgi: s.location } });
    if (egalladi.count !== 1) continue;
    await prisma.student.update({ where: { id: j.studentId }, data: { location: j.location } });
    qollandi++;
  }
  return { qaytarildi, qollandi };
}

/**
 * O'quvchining manzilini yozadi.
 * @param {'doimiy'|'bugun'|'ertaga'} tur
 * @returns {Promise<{ tur: string, sana: string|null, nuqta: string, joyId: number|null }>}
 */
export async function manzilniYoz({ studentId, schoolId, nuqta, tur, kimdan = null, tgChat = null, bugun = toDateStr() }) {
  await kunlikJoylarniQolla(bugun);
  const amalda = await prisma.studentJoy.findFirst({ where: { studentId, holat: 'qollandi', sana: bugun }, orderBy: { id: 'desc' } });

  if (tur === 'doimiy') {
    // Bugun bir kunlik manzil amalda bo'lsa — bugun o'sha qoladi, ertadan yangi doimiy.
    if (amalda) await prisma.studentJoy.update({ where: { id: amalda.id }, data: { avvalgi: nuqta } });
    else await prisma.student.update({ where: { id: studentId }, data: { location: nuqta } });
    return { tur, sana: null, nuqta, joyId: null, bugunBoshqa: !!amalda };
  }

  if (tur === 'bugun') {
    if (amalda) {
      await prisma.studentJoy.update({ where: { id: amalda.id }, data: { location: nuqta, kimdan, tgChat } });
      await prisma.student.update({ where: { id: studentId }, data: { location: nuqta } });
      return { tur, sana: bugun, nuqta, joyId: amalda.id };
    }
    const s = await prisma.student.findUnique({ where: { id: studentId }, select: { location: true } });
    const joy = await prisma.studentJoy.create({
      data: { studentId, schoolId, sana: bugun, location: nuqta, avvalgi: s?.location ?? null, holat: 'qollandi', kimdan, tgChat },
    });
    await prisma.student.update({ where: { id: studentId }, data: { location: nuqta } });
    return { tur, sana: bugun, nuqta, joyId: joy.id };
  }

  // ertaga — kuni kelganda qo'llanadi; shu kunga oldingi kutilayotgani almashtiriladi.
  const sana = ertangiKun(bugun);
  await prisma.studentJoy.updateMany({ where: { studentId, sana, holat: 'kutilmoqda' }, data: { holat: 'bekor' } });
  const joy = await prisma.studentJoy.create({ data: { studentId, schoolId, sana, location: nuqta, holat: 'kutilmoqda', kimdan, tgChat } });
  return { tur, sana, nuqta, joyId: joy.id };
}

/** Bir kunlik manzilni bekor qiladi (amalda bo'lsa — doimiysi qaytadi). */
export async function manzilniBekorQil(joyId) {
  const j = await prisma.studentJoy.findUnique({ where: { id: joyId } });
  if (!j || !['kutilmoqda', 'qollandi'].includes(j.holat)) return null;
  if (j.holat === 'qollandi') {
    const s = await prisma.student.findUnique({ where: { id: j.studentId }, select: { location: true } });
    if (s && s.location === j.location) await prisma.student.update({ where: { id: j.studentId }, data: { location: j.avvalgi } });
  }
  await prisma.studentJoy.update({ where: { id: j.id }, data: { holat: 'bekor' } });
  return j;
}

/** O'quvchining amaldagi va kutilayotgan bir kunlik manzillari (bugundan boshlab). */
export async function kunlikManzillar(studentIds, bugun = toDateStr()) {
  if (!studentIds.length) return [];
  return prisma.studentJoy.findMany({
    where: { studentId: { in: studentIds }, holat: { in: ['kutilmoqda', 'qollandi'] }, sana: { gte: bugun } },
    orderBy: [{ sana: 'asc' }, { id: 'asc' }],
  });
}
