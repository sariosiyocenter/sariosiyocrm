// O'quvchi ID si — 5 xonali, har bir o'quvchiga alohida (egasi, 2026-09-26:
// "id o'quvchi telefon raqami emas balki 5 xonali son bo'lsin va har doim
// individual bo'lsin, ota-onasi uni telegramdan so'rab ola olsin").
//
// Kod tasodifiy (10000–99999): ketma-ket raqamda bitta xato raqam boshqa
// bolaning hisobiga to'g'ri kelardi. Takrorlanmasligini baza kafolatlaydi
// (StudentKod.kod — birlamchi kalit, studentId — unique). Kod birinchi kerak
// bo'lganda beriladi: CRM ro'yxati, bot yoki Payme so'raganda.
import { randomInt } from 'node:crypto';
import prisma from '../lib/prisma.js';

export const KOD_MIN = 10000;
export const KOD_MAX = 99999;

/** "48 213", " 48213 " → 48213. 5 xonali bo'lmasa null. */
export function kodniOqi(raw) {
  const s = String(raw ?? '').replace(/\s/g, '');
  if (!/^\d{5}$/.test(s)) return null;
  const n = Number(s);
  return n >= KOD_MIN && n <= KOD_MAX ? n : null;
}

/**
 * Berilgan o'quvchilarning kodlari: Map<studentId, kod>. Kodi yo'qlarga
 * shu yerda beriladi. Parallel so'rov xuddi shu o'quvchiga kod bergan
 * bo'lsa — o'shanisi qaytadi (createMany skipDuplicates).
 */
export async function kodlarniTaminla(studentIds, db = prisma) {
  const ids = [...new Set((studentIds || []).map(Number).filter(n => Number.isInteger(n) && n > 0))];
  const map = new Map();
  if (!ids.length) return map;
  const bor = await db.studentKod.findMany({ where: { studentId: { in: ids } }, select: { kod: true, studentId: true } });
  for (const r of bor) map.set(r.studentId, r.kod);
  let yoq = ids.filter(id => !map.has(id));
  for (let urinish = 0; yoq.length && urinish < 10; urinish++) {
    const tanlangan = new Set();
    const rows = yoq.map(studentId => {
      let kod;
      do { kod = randomInt(KOD_MIN, KOD_MAX + 1); } while (tanlangan.has(kod));
      tanlangan.add(kod);
      return { kod, studentId };
    });
    await db.studentKod.createMany({ data: rows, skipDuplicates: true });
    const yangi = await db.studentKod.findMany({ where: { studentId: { in: yoq } }, select: { kod: true, studentId: true } });
    for (const r of yangi) map.set(r.studentId, r.kod);
    yoq = yoq.filter(id => !map.has(id));
  }
  if (yoq.length) throw new Error(`O'quvchi ID berib bo'lmadi: ${yoq.join(', ')}`);
  return map;
}

/** Bitta o'quvchining kodi (kerak bo'lsa beriladi). */
export async function kodBer(studentId, db = prisma) {
  const map = await kodlarniTaminla([studentId], db);
  return map.get(Number(studentId)) ?? null;
}

/** Kod → o'quvchi ID (Student.id) yoki null. */
export async function kodEgasi(kod, db = prisma) {
  const n = kodniOqi(kod);
  if (n === null) return null;
  const row = await db.studentKod.findUnique({ where: { kod: n }, select: { studentId: true } });
  return row?.studentId ?? null;
}
