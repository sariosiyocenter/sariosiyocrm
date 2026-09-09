// "Qaysi sanagacha to'langan" — o'quvchining darsga kirish muddati.
//
// Egasi (2026-09-09): "когда он 1 миллион сумм оплатил — до какого числа
// у него есть допуск к урокам, это нужно тоже прописывать."
//
// Hisob puldan emas, DARSDAN yuritiladi: bitta darsning narxi = oylik narx /
// o'sha oydagi dars kunlari soni (lib/lessons.js). Ya'ni yarim oylik pul
// to'langan bo'lsa muddat oyning o'rtasidagi darsda tugaydi, "15-sana" deb
// taxmin qilinmaydi.
//
// Pul kursga biriktirilgani uchun (lib/allocation.js) muddat ham har bir kurs
// uchun alohida: matematikaga to'lagan bo'lsa fizikaning muddati uzaymaydi.

import { lessonDatesBetween, monthBounds, hasSchedule } from './lessons.js';

/** Keyingi oy ("2026-09" → "2026-10"). */
function nextMonth(month) {
  const [y, m] = String(month).split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Bitta kurs bo'yicha to'lov qaysi darsgacha yetadi.
 *
 * @param buckets  shu guruhning chelaklari: [{month, due, covered}] — istalgan tartibda
 * @param opts     { days, monthlyPrice, advance, today, maxMonths }
 *   days         guruh jadvali ("TOQ" | "JUFT" | "HAR_KUNI")
 *   monthlyPrice oylik narx — kelgusi oylarni oldindan hisoblash uchun
 *   advance      shu kursga tegishli sarflanmagan avans
 *   today        "YYYY-MM-DD" — hali hisob yozilmagan kursda sanoq shu oydan boshlanadi
 *   maxMonths    oldinga eng ko'p necha oy qaralsin (himoya, sukut 24)
 *
 * @returns {{
 *   until: string|null,   // "YYYY-MM-DD" — shu kungacha (shu kun ham) darsga kiradi
 *   openDebt: boolean,    // yopilmagan hisob bormi
 *   unknown: boolean,     // jadval yo'q — sanani aytib bo'lmaydi
 *   noCharge: boolean,    // bu kursda hali umuman hisob yozilmagan
 * }}
 */
export function paidUntil(buckets, { days, monthlyPrice, advance = 0, today, maxMonths = 24 } = {}) {
  const hisobBor = buckets.some(b => b.month && b.month !== 'eski');
  if (!hasSchedule(days)) {
    return {
      until: null,
      openDebt: buckets.some(b => b.due - b.covered > 0),
      unknown: true,
      noCharge: !hisobBor,
    };
  }

  const months = [...buckets]
    .filter(b => b.month && b.month !== 'eski')
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

  let until = null;
  // Hisob yozilmagan kursda oldinga sanash shu oydan boshlanadi: o'quvchi
  // kursga avans to'lagan, lekin oylik hisob hali yozilmagan bo'lishi mumkin —
  // ilgari bunday holatda "to'lanmagan" deb chiqardi.
  const shuOy = String(today || new Date().toISOString().slice(0, 10)).slice(0, 7);
  let lastMonth = null;

  for (const b of months) {
    const bounds = monthBounds(b.month);
    if (!bounds) continue;
    const dates = lessonDatesBetween(days, bounds.first, bounds.last) || [];
    lastMonth = b.month;
    if (!dates.length) continue;

    const due = b.due;
    const covered = Math.max(0, Math.min(b.covered, due));
    if (due <= 0) { until = dates[dates.length - 1]; continue; }

    if (covered >= due) { until = dates[dates.length - 1]; continue; }

    // Qisman to'langan: necha dars to'langan bo'lsa, o'shancha.
    const paidLessons = Math.floor((covered / due) * dates.length);
    if (paidLessons > 0) until = dates[paidLessons - 1];
    // Yopilmagan hisob bor — muddat shu yerda tugaydi, oldinga qaralmaydi.
    return { until, openDebt: true, unknown: false, noCharge: false };
  }

  // Hamma hisob yopilgan. Avans qolgan bo'lsa — kelgusi oylarni oldindan
  // hisoblaymiz: pul necha oyga yetsa, muddat o'shancha uzayadi.
  let left = Math.round(advance);
  if (left > 0 && monthlyPrice > 0) {
    // Hisob yozilgan bo'lsa — undan keyingi oydan; yozilmagan bo'lsa shu oydan.
    let m = lastMonth ? nextMonth(lastMonth) : shuOy;
    for (let i = 0; i < maxMonths && left > 0; i++, m = nextMonth(m)) {
      const bounds = monthBounds(m);
      const dates = bounds ? (lessonDatesBetween(days, bounds.first, bounds.last) || []) : [];
      if (!dates.length) continue;
      if (left >= monthlyPrice) {
        until = dates[dates.length - 1];
        left -= monthlyPrice;
        continue;
      }
      const paidLessons = Math.floor((left / monthlyPrice) * dates.length);
      if (paidLessons > 0) until = dates[paidLessons - 1];
      left = 0;
    }
  }

  return { until, openDebt: false, unknown: false, noCharge: !hisobBor };
}
