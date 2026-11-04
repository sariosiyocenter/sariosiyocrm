// Savollar bankidagi kichik mavzu (2026-11-05): tuzilma bo'lim → mavzu → kichik mavzu.
// Kichik mavzu (QuestionTopic.parentId) otasi bilan bitta bo'limda turadi, uning o'z kichik
// mavzusi bo'lmaydi. Bu yerda bazaga murojaat yo'q — routes/savolBanki.js ishlatadi.

/**
 * Mavzular ro'yxat tartibida, har kichik mavzu otasidan keyin. Otasi ro'yxatda yo'q
 * kichik mavzu oddiy mavzu kabi o'z o'rnida turadi.
 * @template {{ id: number, order: number, parentId?: number | null }} T
 * @param {T[]} topics
 * @returns {T[]}
 */
export function mavzuTartibi(topics) {
  const l = [...topics].sort((a, b) => a.order - b.order || a.id - b.id);
  // Ota — faqat oddiy mavzu. Bir vaqtdagi ikki ko'chirish nabira yoki aylana qoldirsa ham
  // (server bitta pog'onani so'rov ichida tekshiradi), mavzu yo'qolmaydi — oddiy mavzu bo'lib turadi.
  const ildizlar = new Set(l.filter(t => !t.parentId).map(t => t.id));
  const otasiBor = t => !!t.parentId && ildizlar.has(t.parentId);
  const bolalar = new Map();
  for (const t of l) if (otasiBor(t)) bolalar.set(t.parentId, [...(bolalar.get(t.parentId) || []), t]);
  return l.filter(t => !otasiBor(t)).flatMap(t => [t, ...(bolalar.get(t.id) || [])]);
}

/** Tanlangan mavzular va ularning kichik mavzulari (ota tanlansa — bolalari ham ro'yxatga kiradi). */
export function kichiklariBilan(topics, tanlangan) {
  const set = new Set(tanlangan);
  return topics.filter(t => set.has(t.id) || (!!t.parentId && set.has(t.parentId)));
}
