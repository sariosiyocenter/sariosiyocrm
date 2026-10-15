// Savollar banki ro'yxatining «rasmli / rasmsiz» va «yechimi bor / yo'q» filtrlari
// (egasi, 2026-10-10) uchun SQL — routes/savolBanki.js ishlatadi. Bu yerda bazaga
// murojaat yo'q (faqat so'rov matni va qiymatlari): scratch/o10_rasm_sql.mjs shu
// so'rovlarning o'zini xotiradagi Postgres'da sinaydi.
//
// Rasm besh joyda turishi mumkin: savolning o'z rasmi (imageUrl); matn yoki variant
// ichidagi <img> (Word, PDF va rasmdan import shunday yozadi); moslashtirishning o'ng
// ustuni (answers); va — matnli yoki guruhli savolda — umumiy shart (Passage: rasmi,
// matni, javoblar ro'yxati). Variantlar JSON ustunda turadi — Prisma uning ichidan
// qidira olmaydi, shuning uchun xom SQL. So'rov matni qat'iy (foydalanuvchi kiritgan
// narsa unga qo'shilmaydi), qiymatlar esa parametr bo'lib ketadi.

import { NATIJA_OSON, NATIJA_ORTA } from './imtihon.js';

const RASM_BOR = `(
  COALESCE(q."imageUrl", '') <> '' OR q."text" ILIKE '%<img%'
  OR COALESCE(q."options"::text, '') ILIKE '%<img%' OR COALESCE(q."answers"::text, '') ILIKE '%<img%'
  OR COALESCE(q."optionA", '') ILIKE '%<img%' OR COALESCE(q."optionB", '') ILIKE '%<img%'
  OR COALESCE(q."optionC", '') ILIKE '%<img%' OR COALESCE(q."optionD", '') ILIKE '%<img%'
  OR COALESCE(p."imageUrl", '') <> '' OR COALESCE(p."text", '') ILIKE '%<img%'
  OR COALESCE(p."variantlar"::text, '') ILIKE '%<img%'
)`;

// Chizmasi kerak, lekin hali qo'yilmagan: AI va Word importi rasm o'rniga matnda «[rasm]» (Word'dan —
// «[rasm 2]») belgisini qoldiradi, chizma qo'yilgach belgi matndan olinadi (src/lib/svgRasm.ts
// rasmBelgisiBor). Bunday savol haqiqiy rasmi yo'qligi uchun «rasmli» sanalmaydi — alohida holat.
// Belgi POSIX qavslari bilan yoziladi ([[] — «[», []] — «]»): teskari chiziqsiz, JS satrida buzilmaydi.
const BELGI = `'[[]rasm([[:space:]]*[0-9]+)?[]]'`;
const RASM_KUTMOQDA = `(
  q."text" ~* ${BELGI} OR COALESCE(q."options"::text, '') ~* ${BELGI} OR COALESCE(q."answers"::text, '') ~* ${BELGI}
  OR COALESCE(q."optionA", '') ~* ${BELGI} OR COALESCE(q."optionB", '') ~* ${BELGI}
  OR COALESCE(q."optionC", '') ~* ${BELGI} OR COALESCE(q."optionD", '') ~* ${BELGI}
  OR COALESCE(p."text", '') ~* ${BELGI} OR COALESCE(p."variantlar"::text, '') ~* ${BELGI}
)`;
/** `rasmliIdlarSorovi` turlari → shart (faqat shu ro'yxatdagi, tashqaridan SQL kirmaydi). */
const RASM_SHARTLARI = {
  rasmli: RASM_BOR,
  kutmoqda: RASM_KUTMOQDA,
  istalgan: `(${RASM_BOR} OR ${RASM_KUTMOQDA})`,
};

/** Yechim yo'q hisoblanadigan qiymatlar (muharrirning bo'sh paragraflari ham); null ham — yo'q. */
export const YECHIM_BOSH = ['', '<p></p>', '<p><br></p>'];
/** Savolning yechimi bormi (ro'yxatda matnning o'zi emas, shu belgi qaytadi). */
export const yechimBor = (s) => s !== null && s !== undefined && !YECHIM_BOSH.includes(s);
const YECHIM_BOR = `(COALESCE(q."solution", '') NOT IN (${YECHIM_BOSH.map(x => `'${x}'`).join(', ')}))`;

const MANBA = 'FROM "Question" q LEFT JOIN "Passage" p ON p."id" = q."passageId"';

/**
 * Rasmli savollar id lari: tashkilot filiallari ichida; `mavzuIdlar` berilsa — faqat shu
 * mavzularda (null — hamma mavzu). `tur`: 'rasmli' (haqiqiy rasm bor, standart), 'kutmoqda'
 * («[rasm]» belgisi matnda — chizma hali yo'q) yoki 'istalgan' (ikkalasidan biri). Qaytaradi: {sql, qiymatlar}.
 */
export function rasmliIdlarSorovi(orgIds, mavzuIdlar, chegara, tur = 'rasmli') {
  const shart = RASM_SHARTLARI[tur] ?? RASM_BOR;
  const qiymatlar = [orgIds];
  let mavzuSharti = '';
  if (mavzuIdlar) { qiymatlar.push(mavzuIdlar); mavzuSharti = `AND q."bankTopicId" = ANY($${qiymatlar.length}::int[])`; }
  qiymatlar.push(chegara);
  return {
    sql: `SELECT q."id" ${MANBA} WHERE q."schoolId" = ANY($1::int[]) ${mavzuSharti} AND ${shart} ORDER BY q."id" LIMIT $${qiymatlar.length}::int`,
    qiymatlar,
  };
}

// --- Qo'shimcha filtrlar: yechim holati, video dars, ishlatilgani, natija, tarjima, yangiligi ---
// Hammasi mavjud ustunlardan (yangi ustun yo'q); sonlar bitta so'rovda, video dars — alohida
// (dars eskirganmi — yechim izi JS da hisoblanadi: lib/imtihonDars.js darsHolati).

/** «Yechim holati»: ustoz tasdiqlagan yoki hali tasdiqlanmagan (AI qoralamasi) yechim. */
export const YECHIM_HOLATI_FILTRI = ['tasdiqlangan', 'qoralama'];
/** «Video dars»: tasdiqlangan, tasdiqlanmagan, eskirgan (yechim o'zgargan) yoki darsi yo'q. */
export const DARS_FILTRI = ['tasdiqlangan', 'qoralama', 'eskirgan', 'yoq'];
/** «Natija bo'yicha qiyinlik»: to'g'ri topganlar ulushi bo'yicha; 'yoq' — hali natija yig'ilmagan. */
export const NATIJA_FILTRI = ['oson', 'orta', 'qiyin', 'yoq'];
/** «Qo'shilgan vaqti»: oxirgi shuncha kun (1 — oxirgi 24 soat). */
export const YANGI_KUNLAR = [1, 7, 30];

/**
 * Natija bo'yicha qiyinlik sharti (Prisma `where`); tanlov bo'sh yoki hammasi tanlangan bo'lsa — null.
 * Natija — savol imtihonda ishlatilgan va to'g'ri topganlar ulushi hisoblangan bo'lsa
 * (kartadagi «% to'g'ri topgan» shu shartda ko'rinadi).
 */
export function natijaSharti(qiymatlar) {
  const l = [...new Set((Array.isArray(qiymatlar) ? qiymatlar : []).filter(k => NATIJA_FILTRI.includes(k)))];
  if (!l.length || l.length === NATIJA_FILTRI.length) return null;
  const ishlatilgan = { usedCount: { gt: 0 } };
  const parcha = {
    oson: { ...ishlatilgan, pCorrect: { gte: NATIJA_OSON } },
    orta: { ...ishlatilgan, pCorrect: { gte: NATIJA_ORTA, lt: NATIJA_OSON } },
    qiyin: { ...ishlatilgan, pCorrect: { lt: NATIJA_ORTA } },
    yoq: { OR: [{ usedCount: { lte: 0 } }, { pCorrect: null }] },
  };
  return { OR: l.map(k => parcha[k]) };
}

/** Oxirgi `kun` kunda qo'shilganlar boshlanadigan vaqt (1, 7 yoki 30; boshqasi — null). */
export function yangiChegara(kun, hozir = new Date()) {
  const n = Number(kun);
  return YANGI_KUNLAR.includes(n) ? new Date(hozir.getTime() - n * 86400000) : null;
}

/**
 * Shu mavzulardagi (arxivsiz) savollar bo'yicha qo'shimcha filtrlar sonlari — bitta so'rovda.
 * Qaytaradi: {sql, qiymatlar}. «Yangi» sanalar bazaning o'z vaqtidan (UTC) hisoblanadi.
 */
export function boshqaSonlarSorovi(orgIds, mavzuIdlar) {
  const sana = kun => `(COUNT(*) FILTER (WHERE q."createdAt" >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '${kun} day'))::int`;
  const natija = shart => `(COUNT(*) FILTER (WHERE q."usedCount" > 0 AND ${shart}))::int`;
  return {
    sql: `SELECT COUNT(*)::int AS "jami",
      (COUNT(*) FILTER (WHERE q."solutionStatus" = 'tasdiqlangan'))::int AS "yechimTasdiqlangan",
      (COUNT(*) FILTER (WHERE q."solutionStatus" = 'qoralama'))::int AS "yechimQoralama",
      (COUNT(*) FILTER (WHERE q."usedCount" > 0))::int AS "ishlatilgan",
      (COUNT(*) FILTER (WHERE q."tarjima" IS NOT NULL AND q."tarjima"::text <> 'null'))::int AS "tarjimali",
      ${natija('q."pCorrect" >= $3')} AS "oson",
      ${natija('q."pCorrect" >= $4 AND q."pCorrect" < $3')} AS "orta",
      ${natija('q."pCorrect" < $4')} AS "qiyin",
      ${sana(1)} AS "yangi1", ${sana(7)} AS "yangi7", ${sana(30)} AS "yangi30"
      FROM "Question" q WHERE q."schoolId" = ANY($1::int[]) AND q."bankTopicId" = ANY($2::int[]) AND q."status" <> 'arxiv'`,
    qiymatlar: [orgIds, mavzuIdlar, NATIJA_OSON, NATIJA_ORTA],
  };
}

/**
 * Ekranga ketadigan sonlar: so'rov qatori va darslar (savol id → dars holati, arxivsiz) dan.
 * «Yo'q» sonlari jami dan olinadi. Qator bo'sh bo'lsa — hammasi 0.
 */
export function boshqaSonlari(qator, darslar) {
  const n = k => Number(qator?.[k]) || 0;
  const jami = n('jami');
  const dars = { tasdiqlangan: 0, qoralama: 0, eskirgan: 0 };
  for (const h of darslar.values()) if (h in dars) dars[h]++;
  const natija = { oson: n('oson'), orta: n('orta'), qiyin: n('qiyin') };
  const bor = k => ({ bor: n(k), yoq: Math.max(0, jami - n(k)) });
  return {
    yechim: { tasdiqlangan: n('yechimTasdiqlangan'), qoralama: n('yechimQoralama') },
    dars: { ...dars, yoq: Math.max(0, jami - dars.tasdiqlangan - dars.qoralama - dars.eskirgan) },
    ishlatilgan: bor('ishlatilgan'),
    tarjimali: bor('tarjimali'),
    natija: { ...natija, yoq: Math.max(0, jami - natija.oson - natija.orta - natija.qiyin) },
    yangi: { 1: n('yangi1'), 7: n('yangi7'), 30: n('yangi30') },
  };
}

/** Shu mavzulardagi (arxivsiz) savollar: jami, rasmli, chizmasi kutilayotgan («[rasm]» belgisi), rasmsiz va yechimi bor soni. Qaytaradi: {sql, qiymatlar}. */
export function rasmYechimSoniSorovi(orgIds, mavzuIdlar) {
  return {
    sql: `SELECT COUNT(*)::int AS "jami", (COUNT(*) FILTER (WHERE ${RASM_BOR}))::int AS "rasmli",
      (COUNT(*) FILTER (WHERE ${RASM_KUTMOQDA}))::int AS "kutmoqda",
      (COUNT(*) FILTER (WHERE NOT ${RASM_SHARTLARI.istalgan}))::int AS "rasmsiz",
      (COUNT(*) FILTER (WHERE ${YECHIM_BOR}))::int AS "yechimli"
      ${MANBA} WHERE q."schoolId" = ANY($1::int[]) AND q."bankTopicId" = ANY($2::int[]) AND q."status" <> 'arxiv'`,
    qiymatlar: [orgIds, mavzuIdlar],
  };
}
