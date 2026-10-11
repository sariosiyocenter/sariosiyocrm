// Andoza (Savollar banki → Andoza) ning sof qoidalari: nomi, savollar soni va bankdan
// qo'shilgan aniq savollar. Bazaga tegmaydi — routes/savolBanki.js ishlatadi, sinovi
// scratch/o10_andoza_sof.mjs. Savollardan imtihon qoidalari yasash — lib/imtihon.js
// (andozaBirliklari, andozaSavolQoidalari, andozaniToldir).

import { turi, savolXatosi, guruhSavolimi, QISM_HARFLARI, andozaBirliklari, andozaSavolSoni } from './imtihon.js';

/** Bitta andozadagi savollar chegarasi (imtihon bloki ham shuncha savol oladi). */
export const ANDOZA_MAX = 300;

/** Savol guruhli savolning (MS-33-35, MS-36-45) bo'lagimi. */
const guruhimi = q => guruhSavolimi(turi(q?.type)) && !!q?.passageId;

/** Saqlanadigan tartib — qog'ozdagi tartib (bo'limlar bo'yicha, guruh bo'laklari yonma-yon). */
export const andozaIdlari = savollar => andozaBirliklari(savollar).flatMap(u => u.idlar);

/**
 * Andozaga nechta savol kerak: yozilgani (`soni`); eski, qoidali andozada (soni 0) — qoidalardagi
 * savollar yig'indisi. Andozadagi savollardan kam bo'lmaydi.
 */
export function andozaSoni(soni, savollar, qoidalarda = 0) {
  return Math.max(andozaSavolSoni(savollar), Number(soni) > 0 ? Number(soni) : Number(qoidalarda) || 0);
}

/** Blok fani: savollarning ko'pchiligi qaysi fandan (teng bo'lsa — birinchisi); savol yo'q — `zaxira`. */
export function andozaFani(savollar, zaxira = null) {
  const soni = new Map();
  for (const q of savollar || []) {
    const f = q?.bankTopic?.subjectId;
    if (f) soni.set(f, (soni.get(f) || 0) + 1);
  }
  return [...soni.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? zaxira ?? null;
}

/**
 * Har savol nega qog'ozga tushmasligi (tushsa — null): savol faol va to'liq bo'lishi kerak;
 * guruhli savol — butun (hamma bo'lagi shu ro'yxatda, faol va to'liq), qismlari 4 tagacha.
 * `azolar` — Map: umumiy shart id si → guruhning hamma bo'laklari id lari (holatidan qat'i nazar).
 */
export function andozaTosiqlari(savollar, azolar) {
  const ozi = q => (q.status === 'arxiv' ? 'arxivda' : (q.status || 'faol') !== 'faol' ? 'qoralama — faol emas' : savolXatosi(q));
  const bor = new Map(savollar.map(q => [q.id, q]));
  const out = new Map();
  for (const q of savollar) {
    let t = ozi(q);
    if (!t && guruhSavolimi(turi(q.type))) {
      const hammasi = (q.passageId && azolar?.get(q.passageId)) || [];
      if (!hammasi.length) t = "guruhi (umumiy sharti) yo'q";
      else if (hammasi.some(id => !bor.has(id) || ozi(bor.get(id)))) t = "guruhning bir bo'lagi faol emas yoki chala";
      else if (turi(q.type) === 'qismli' && hammasi.length > QISM_HARFLARI.length) t = `${QISM_HARFLARI.length} tadan ko'p qism — varaqqa sig'maydi`;
    }
    out.set(q.id, t || null);
  }
  return out;
}

/** Tanlangan savollar va ularning guruhlari: guruhli savolning bitta bo'lagi kelsa ham — hamma bo'laklari. */
export function guruhlariBilan(savollar, azolar) {
  return [...new Set((savollar || []).flatMap(q => (guruhimi(q) ? azolar?.get(q.passageId) || [q.id] : [q.id])))];
}

/**
 * Savollarni andozaga qo'shish. Faol bo'lmagan, chala va butun bo'lmagan guruh savollari
 * qo'shilmaydi; andozada borlari o'tkazib yuboriladi. Sig'masa — `kengaytir` bo'lsa savollar
 * soni oshadi, aks holda xato (`sigmadi`).
 *   bor — andozadagi savollar; nomzodlar — qo'shilayotganlar (guruhlari bilan); topilmadi — bankda
 *   yo'q id lar soni; soni — andozaga kerakli savollar soni.
 * Qaytadi: {xato: {status, error, …}} yoki {hammasi, soni, qoshildi, borEdi, yaroqsiz}.
 */
export function andozagaQoshish({ bor, nomzodlar, azolar, topilmadi = 0, soni, kengaytir = false }) {
  const borId = new Set(bor.map(q => q.id));
  const tosiq = andozaTosiqlari(nomzodlar, azolar);
  const yangi = nomzodlar.filter(q => !borId.has(q.id) && !tosiq.get(q.id));
  const yaroqsiz = topilmadi + nomzodlar.filter(q => !borId.has(q.id) && tosiq.get(q.id)).length;
  if (!yangi.length) return { xato: { status: 400, error: yaroqsiz ? "Tanlangan savollar faol emas yoki chala — andozaga qo'shilmadi" : 'Tanlangan savollar andozada bor' } };
  const hammasi = [...bor, ...yangi];
  const joriy = andozaSavolSoni(bor), jami = andozaSavolSoni(hammasi);
  if (jami > ANDOZA_MAX) return { xato: { status: 400, error: `Bitta andozada ko'pi bilan ${ANDOZA_MAX} ta savol bo'ladi` } };
  if (jami > soni && !kengaytir) {
    return { xato: { status: 409, error: `Andozada ${soni - joriy} ta bo'sh o'rin bor, ${jami - joriy} ta savol qo'shilmoqda`, sigmadi: true, bosh: soni - joriy, kerak: jami - joriy, yangiSoni: jami } };
  }
  return { hammasi, soni: Math.max(soni, jami), qoshildi: jami - joriy, borEdi: nomzodlar.filter(q => borId.has(q.id)).length, yaroqsiz };
}

/** Savollarni andozadan olish: guruhli savolning bo'lagi olinsa — butun guruh olinadi. Qaytadi: {qoldi, olindi}. */
export function andozadanOlish(bor, ids) {
  const olinadi = new Set((ids || []).map(Number));
  const guruhlar = new Set(bor.filter(q => olinadi.has(q.id) && guruhimi(q)).map(q => q.passageId));
  const qoldi = bor.filter(q => !olinadi.has(q.id) && !(guruhimi(q) && guruhlar.has(q.passageId)));
  return { qoldi, olindi: andozaSavolSoni(bor) - andozaSavolSoni(qoldi) };
}

/** Yangi tartib: `ids` — andozadagi hamma savol (aynan o'shalar). Mos kelmasa — null. */
export function andozaTartibi(bor, ids) {
  const byId = new Map(bor.map(q => [q.id, q]));
  const yangi = [...new Set((ids || []).map(Number))];
  if (yangi.length !== byId.size || yangi.some(id => !byId.has(id))) return null;
  return yangi.map(id => byId.get(id));
}
