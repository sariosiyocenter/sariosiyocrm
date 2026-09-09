// Guruh jadvali bo'yicha dars kunlarini sanash.
//
// Bitta darsning narxi = oylik narx / o'sha oydagi dars kunlari soni. Guruhlar
// orasida ko'chirishda va pul qaytarishda aynan shu hisob ishlatiladi:
// o'quvchi guruhda necha kun bo'lgan bo'lsa, shuncha darsga haq to'laydi.
//
// Jadval `Group.days` maydonida saqlanadi va uchta qiymatdan biri bo'ladi.
// To'ldirilmagan bo'lsa (`Belgilanmagan`) darslarni sanab bo'lmaydi — bunday
// holatda null qaytadi va chaqiruvchi foydalanuvchidan jadvalni to'ldirishni
// so'rashi kerak. Taxmin qilib hisoblash pul masalasida yaramaydi.

/** Hafta kunlari: 0 — yakshanba, 1 — dushanba, ... 6 — shanba. */
const DAY_PATTERNS = {
  TOQ: [1, 3, 5],        // dushanba, chorshanba, juma
  JUFT: [2, 4, 6],       // seshanba, payshanba, shanba
  HAR_KUNI: [1, 2, 3, 4, 5, 6], // yakshanbadan boshqa har kuni
};

/** Jadval to'ldirilganmi. */
export function hasSchedule(days) {
  return Object.prototype.hasOwnProperty.call(DAY_PATTERNS, String(days || '').trim());
}

/**
 * `from` va `to` oralig'idagi (ikkalasi ham kiradi) dars kunlari sanalari.
 * Sanalar "YYYY-MM-DD" ko'rinishida.
 * Jadval noma'lum bo'lsa null.
 */
export function lessonDatesBetween(days, from, to) {
  const pattern = DAY_PATTERNS[String(days || '').trim()];
  if (!pattern) return null;

  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end || start > end) return [];

  const out = [];
  const cur = new Date(start.getTime());
  while (cur <= end) {
    if (pattern.includes(cur.getDay())) out.push(toISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** O'zbekiston vaqti UTC+5. */
const UZ_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Berilgan onni O'zbekiston vaqtidagi "soat" sifatida ko'radigan Date. */
function uzVaqti(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.getTime() + UZ_OFFSET_MS);
}

/**
 * Sanani O'zbekiston vaqti bo'yicha "YYYY-MM-DD" ga aylantiradi.
 *
 * Ikki xil xato shu yerdan chiqardi: brauzerda `toISOString()` UTC berib,
 * ertalab soat 5 gacha kechagi kunni ko'rsatardi; serverda esa (Vercel UTC
 * da ishlaydi) yarim kechadan keyin sana bir kun orqaga surilardi. Kun
 * jadvali ham, yetkazish yozuvi ham shu sanaga bog'liq.
 */
export function toDateStr(date = new Date()) {
  const uz = uzVaqti(date);
  return `${uz.getUTCFullYear()}-${String(uz.getUTCMonth() + 1).padStart(2, '0')}-${String(uz.getUTCDate()).padStart(2, '0')}`;
}

/** Vaqtni O'zbekiston bo'yicha "07:52" ko'rinishida. */
export function toTimeStr(date = new Date()) {
  const uz = uzVaqti(date);
  return `${String(uz.getUTCHours()).padStart(2, '0')}:${String(uz.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * Shu sana jadvalga tushadimi.
 *
 * Marshrutlar ham, guruhlar ham aynan shu jadvalni ishlatadi: "TOQ" —
 * dushanba/chorshanba/juma, "JUFT" — seshanba/payshanba/shanba. Ilgari
 * Logistika sahifasi hafta kuniga, bot esa oy kunining juftligiga
 * (`sana % 2`) qarardi — bir kunda admin bir ro'yxatni, haydovchi
 * boshqasini ko'rardi.
 *
 * Jadval noma'lum ("Belgilanmagan") bo'lsa false: taxmin qilinmaydi.
 */
export function isLessonDay(days, dateStr) {
  const pattern = DAY_PATTERNS[String(days || '').trim()];
  if (!pattern) return false;
  const dt = parseDate(dateStr);
  return dt ? pattern.includes(dt.getDay()) : false;
}

/** Oraliqdagi dars kunlari soni; jadval noma'lum bo'lsa null. */
export function countLessons(days, from, to) {
  const dates = lessonDatesBetween(days, from, to);
  return dates === null ? null : dates.length;
}

/** "YYYY-MM" oyining birinchi va oxirgi kuni. */
export function monthBounds(month) {
  const [year, monthNum] = String(month).split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    return null;
  }
  const lastDay = new Date(year, monthNum, 0).getDate();
  const mm = String(monthNum).padStart(2, '0');
  return { first: `${year}-${mm}-01`, last: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * Oy uchun bitta dars narxi va dars kunlari soni.
 * Jadval noma'lum yoki oyda dars yo'q bo'lsa null.
 */
export function lessonPrice(days, month, monthlyPrice) {
  const bounds = monthBounds(month);
  if (!bounds) return null;
  const total = countLessons(days, bounds.first, bounds.last);
  if (total === null || total === 0) return null;
  return { total, perLesson: monthlyPrice / total };
}

/** Bir kun oldingi sana ("YYYY-MM-DD"). */
export function dayBefore(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  d.setDate(d.getDate() - 1);
  return toISO(d);
}

function parseDate(s) {
  const [y, m, d] = String(s || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
