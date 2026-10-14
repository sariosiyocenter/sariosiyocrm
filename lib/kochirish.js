// Kursdan kursga ko'chirish oyining puli (egasi, 2026-10-14: "переводится в
// другую группу — балансы неправильно становятся").
//
// Ko'chirish to'lovsiz (2026-09-22) — balans o'zgarmaydi. Lekin pul kursga
// biriktiriladi (lib/allocation.js): butun oy eski kursda qolsa, yangi kursda
// shu oy hisobi yo'q — "darsga kirish" ko'rinmaydi, eski kurs "(chiqqan)" qarzi
// bo'lib turadi, oyning qolgan qismi uchun pul eski ustozga ketadi.
//
// Shuning uchun eski kursning o'tilmagan darslari puli yangi kursga o'tadi:
// eski kursga +X, yangi kursga −X — yig'indi nol, balans o'zgarmaydi.

import { hasSchedule, countLessons, monthBounds } from './lessons.js';

/**
 * Eski kursdan yangi kursga o'tadigan summa: eski kursga shu oy SOF yozilgan
 * hisobning (chegirma ayirilgan) o'tilmagan darslarga to'g'ri keladigan ulushi.
 *
 *   X = yozilgan × (ko'chirish kunidan oy oxirigacha darslar)
 *                / (hisob boshlangan kundan oy oxirigacha darslar)
 *
 * Hisob boshlangan kun — oy boshi yoki o'quvchi oy o'rtasida kelgan bo'lsa
 * o'sha kun. Yalpi narxdan sanalsa chegirmali yoki oy o'rtasida kelgan
 * o'quvchida o'tilgan darslar puli ham yangi kursga o'tib ketardi.
 *
 * @param {{ days: string, month: string, yozilgan: number, sana: string, boshi?: string }} p
 *   days — eski kurs jadvali; month — "YYYY-MM"; yozilgan — eski kursga shu oy
 *   sof yozilgan hisob; sana — ko'chirish kuni; boshi — shu oyda hisob boshlangan kun.
 * @returns {{ summa: number, darslar: number|null, oyDarslari?: number, darsNarxi?: number, sabab?: string }}
 */
export function kochirishUlushi({ days, month, yozilgan, sana, boshi }) {
  const b = monthBounds(month);
  const bor = Math.round(Number(yozilgan) || 0);
  if (!b || bor <= 0) return { summa: 0, darslar: 0, sabab: 'hisob' };
  if (!hasSchedule(days)) return { summa: 0, darslar: null, sabab: 'jadval' };
  const bosh = boshi && boshi > b.first ? boshi : b.first;
  const jami = countLessons(days, bosh, b.last) || 0;
  if (!jami) return { summa: 0, darslar: 0, sabab: 'hisob' };
  const darslar = countLessons(days, sana > bosh ? sana : bosh, b.last) || 0;
  const summa = Math.max(0, Math.min(bor, Math.round(bor * darslar / jami)));
  return { summa, darslar, oyDarslari: jami, darsNarxi: Math.round(bor / jami) };
}
