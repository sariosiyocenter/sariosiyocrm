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

const RASM_BOR = `(
  COALESCE(q."imageUrl", '') <> '' OR q."text" ILIKE '%<img%'
  OR COALESCE(q."options"::text, '') ILIKE '%<img%' OR COALESCE(q."answers"::text, '') ILIKE '%<img%'
  OR COALESCE(q."optionA", '') ILIKE '%<img%' OR COALESCE(q."optionB", '') ILIKE '%<img%'
  OR COALESCE(q."optionC", '') ILIKE '%<img%' OR COALESCE(q."optionD", '') ILIKE '%<img%'
  OR COALESCE(p."imageUrl", '') <> '' OR COALESCE(p."text", '') ILIKE '%<img%'
  OR COALESCE(p."variantlar"::text, '') ILIKE '%<img%'
)`;

/** Yechim yo'q hisoblanadigan qiymatlar (muharrirning bo'sh paragraflari ham); null ham — yo'q. */
export const YECHIM_BOSH = ['', '<p></p>', '<p><br></p>'];
/** Savolning yechimi bormi (ro'yxatda matnning o'zi emas, shu belgi qaytadi). */
export const yechimBor = (s) => s !== null && s !== undefined && !YECHIM_BOSH.includes(s);
const YECHIM_BOR = `(COALESCE(q."solution", '') NOT IN (${YECHIM_BOSH.map(x => `'${x}'`).join(', ')}))`;

const MANBA = 'FROM "Question" q LEFT JOIN "Passage" p ON p."id" = q."passageId"';

/**
 * Rasmi bor savollar id lari: tashkilot filiallari ichida; `mavzuIdlar` berilsa — faqat shu
 * mavzularda (null — hamma mavzu). Qaytaradi: {sql, qiymatlar}.
 */
export function rasmliIdlarSorovi(orgIds, mavzuIdlar, chegara) {
  const qiymatlar = [orgIds];
  let mavzuSharti = '';
  if (mavzuIdlar) { qiymatlar.push(mavzuIdlar); mavzuSharti = `AND q."bankTopicId" = ANY($${qiymatlar.length}::int[])`; }
  qiymatlar.push(chegara);
  return {
    sql: `SELECT q."id" ${MANBA} WHERE q."schoolId" = ANY($1::int[]) ${mavzuSharti} AND ${RASM_BOR} ORDER BY q."id" LIMIT $${qiymatlar.length}::int`,
    qiymatlar,
  };
}

/** Shu mavzulardagi (arxivsiz) savollar: jami, nechtasida rasm va nechtasida yechim bor. Qaytaradi: {sql, qiymatlar}. */
export function rasmYechimSoniSorovi(orgIds, mavzuIdlar) {
  return {
    sql: `SELECT COUNT(*)::int AS "jami", (COUNT(*) FILTER (WHERE ${RASM_BOR}))::int AS "rasmli", (COUNT(*) FILTER (WHERE ${YECHIM_BOR}))::int AS "yechimli"
      ${MANBA} WHERE q."schoolId" = ANY($1::int[]) AND q."bankTopicId" = ANY($2::int[]) AND q."status" <> 'arxiv'`,
    qiymatlar: [orgIds, mavzuIdlar],
  };
}
