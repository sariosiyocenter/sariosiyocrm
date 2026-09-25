// Imtihon moduli — server va brauzer uchun umumiy toza funksiyalar.
//
// Reja va qarorlar: docs/IMTIHON_PLAN.md. Egasi (2026-09-24): "universal
// bo'lishi kerak" — format, smena, filial, til, reyting va xabar kanali
// imtihon sozlamasida tanlanadi, hech biri kodga qotirilmagan.
//
// Bu yerda bazaga ham, DOM ga ham murojaat yo'q: variantlarni yasash, ball
// hisoblash, o'rinlashtirish va savol tahlili bir xil kirishga har doim bir
// xil natija beradi (tasodif — imtihon urug'idan). Shuning uchun variantni
// istalgan payt aynan qayta tiklash va testda tekshirish mumkin.

import { RASCH_DARAJALAR } from './rasch.js';

export const HARFLAR = ['A', 'B', 'C', 'D', 'E', 'F'];
export const VARIANT_KODLARI = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Savol turlari. Varaqda blok ichida shu tartibda turadi. */
export const SAVOL_TURLARI = ['yopiq', 'raqamli', 'yozma'];
export const SAVOL_TURI_NOMI = { yopiq: 'Yopiq (variantli)', raqamli: 'Raqamli javob', yozma: 'Yozma (qo\'lda baholanadi)' };

export const SAVOL_HOLATLARI = ['qoralama', 'faol', 'arxiv'];
export const YECHIM_HOLATLARI = ['yoq', 'qoralama', 'tasdiqlangan'];

export const IMTIHON_HOLATLARI = {
  QORALAMA: 'Qoralama',
  TAYYOR: 'Tayyor',
  TEKSHIRILMOQDA: 'Tekshirilmoqda',
  ELON: "E'lon qilindi",
};

/** Raqamli javob katagida bo'yaladigan belgilar (yuqoridan pastga). */
export const RAQAM_BELGILARI = ['-', ',', '/', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** Raqamli javobning eng ko'p belgisi (varaqdagi ustunlar soni). */
export const RAQAM_USTUNLARI = 6;

export const STANDART_SHABLON = [
  '📊 {imtihon} natijasi',
  '👤 {ism}',
  '✅ Ball: {ball} / {maks} ({foiz}%)',
  '📐 Rasch balli: {rasch}',
  '🎓 Daraja: {daraja}',
  '{bloklar}',
  '{orin}',
  '🔎 Batafsil: {havola}',
].join('\n');

// Imtihondan bir kun oldin qatnashchiga (va ota-onaga) boradigan ruxsatnoma.
// Qiymati bo'sh o'zgaruvchi turgan qator tushib qoladi (o'rin berilmagan bo'lsa — xona qatori).
export const RUXSATNOMA_SHABLON = [
  '📝 Imtihonga ruxsatnoma — {markaz}',
  '{imtihon}',
  '👤 {ism}',
  '📅 {sana}',
  '⏰ Soat {vaqt}',
  '🏫 {filial}',
  "🚪 {xona}, {qator}-qator, {orin}-o'rin",
  '',
  'Imtihonga 20 daqiqa oldin keling. Qora gelli ruchka olib keling, telefon olib kirilmaydi.',
].join('\n');

export const SOZLAMA_STANDART = {
  sessions: [{ id: 1, name: '1-smena', time: '09:00' }],
  // Smenalarga bir xil savollar ('bir') yoki har smenaga boshqa savollar ('alohida').
  sessionQuestions: 'bir',
  variantCount: 4,
  shuffleQuestions: true,
  shuffleOptions: true,
  // Bankdan faqat shu tildagi savollar olinadi; '' — hammasi.
  language: '',
  // 'hammasi' — har o'rin, 'shaxmat' — bittadan tashlab (oldida ham, yonida ham bo'sh).
  seatMode: 'hammasi',
  // O'quvchilarni smenalarga bo'lish: 'teng' — teng, 'ketma' — birinchisi to'lgach
  // keyingisi, 'kurs' — bir kurs bitta smenada.
  sessionFill: 'teng',
  // Ishlatiladigan xonalar id lari (har filial o'z xonasida); bo'sh — hamma xona.
  roomIds: [],
  // Varaqda o'quvchi kitobcha variantini ham bo'yaydi (almashib qolsa ushlanadi).
  variantBubble: true,
  // Bekor qilingan savollar: {savol id: 'hammaga' (hammaga ball) | 'chiqarish' (hisobdan chiqadi)}.
  cancelled: {},
  // Kalit tuzatishlari: {savol id: ['B'] | ['0.5', '1/2']} — asl (aralashtirilmagan) harflarda.
  keyFix: {},
  // Reyting: 'hammasi' — o'rin xabarda va ekranda, 'top' — faqat birinchi topN, 'yoq' — o'rin ko'rsatilmaydi.
  ranking: 'hammasi',
  topN: 10,
  // E'londan keyin o'quvchi savollarni, o'z javobini va tasdiqlangan yechimni ko'radi.
  showQuestionsAfter: false,
  notify: { channel: 'BOTH', to: 'PARENT', template: STANDART_SHABLON },
  // Ruxsatnoma: kanal, kimga, imtihondan bir kun oldin o'zi yuborilsinmi, matn.
  admit: { channel: 'TELEGRAM', to: 'ALL', auto: true, template: RUXSATNOMA_SHABLON },
  // Rasch (Milliy sertifikat uslubi): e'londa T-ball (50 ± 10) va daraja; yoqilsa reyting shu bo'yicha.
  rasch: { enabled: false, grades: RASCH_DARAJALAR },
  // Savollar manbasi: 'bank' — variantlar savollar bankidan yasaladi; 'kalit' —
  // markazning o'z kitobchasi, CRM ga faqat har variantning javob kaliti kiritiladi.
  source: 'bank',
  // "Faqat kalit" rejimidagi kalitlar: {'smena|variant': [1-savol, 2-savol, ...]}.
  keys: {},
  // Shu rejimda savollarning mavzusi (ixtiyoriy, tahlil uchun) — keys bilan bir xil shakl.
  keyTopics: {},
  // Varaqdagi javob doirachalari soni — qulflashda eng ko'p variantli savolga qarab qo'yiladi.
  optionCount: 4,
};

const KANALLAR = ['BOTH', 'TELEGRAM', 'SMS', 'NONE'];
const QABUL_QILUVCHI = ['PARENT', 'STUDENT', 'ALL'];

function butun(v, min, max, standart) {
  const n = parseInt(v);
  if (!Number.isFinite(n)) return standart;
  return Math.min(max, Math.max(min, n));
}

function tanlov(v, royxat, standart) {
  return royxat.includes(v) ? v : standart;
}

/** Kalitlar: {'1|A': ['B', 'AC', '0,5', '*', '-', ...]} — boshqa kalit va qiymatlar tashlanadi. */
function kalitlarniTozala(v, katta = true) {
  const out = {};
  for (const [kalit, qiymat] of Object.entries(v && typeof v === 'object' && !Array.isArray(v) ? v : {})) {
    if (!/^\d{1,2}\|[A-Z]$/.test(kalit) || !Array.isArray(qiymat)) continue;
    out[kalit] = qiymat.slice(0, 500).map(x => {
      const t = String(x ?? '').trim();
      return katta ? t.toUpperCase().slice(0, 60) : t.replace(/\s+/g, ' ').slice(0, 120);
    });
  }
  return out;
}

/**
 * Saqlangan (yoki brauzerdan kelgan) sozlamani to'liq va xavfsiz shaklga
 * keltiradi. Noma'lum kalitlar tashlanadi, yetishmagani standartdan olinadi.
 */
export function sozlamaniTozala(kirish) {
  const k = kirish && typeof kirish === 'object' ? kirish : {};
  const S = SOZLAMA_STANDART;

  let sessions = Array.isArray(k.sessions) ? k.sessions : S.sessions;
  sessions = sessions
    .slice(0, 10)
    .map((x, i) => ({
      id: i + 1,
      name: String(x?.name || `${i + 1}-smena`).slice(0, 40),
      time: /^\d{1,2}:\d{2}$/.test(String(x?.time || '')) ? String(x.time) : '',
    }));
  if (!sessions.length) sessions = S.sessions.map(x => ({ ...x }));

  const obyekt = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const cancelled = {};
  for (const [id, v] of Object.entries(obyekt(k.cancelled))) {
    if (Number.isInteger(Number(id)) && ['hammaga', 'chiqarish'].includes(v)) cancelled[id] = v;
  }
  const keyFix = {};
  for (const [id, v] of Object.entries(obyekt(k.keyFix))) {
    const list = (Array.isArray(v) ? v : [v]).map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 10);
    if (Number.isInteger(Number(id)) && list.length) keyFix[id] = list;
  }
  const roomIds = Array.isArray(k.roomIds) ? k.roomIds.map(Number).filter(Number.isInteger) : [];
  const n = obyekt(k.notify);
  const a = obyekt(k.admit);
  const r = obyekt(k.rasch);

  return {
    sessions,
    sessionQuestions: tanlov(k.sessionQuestions, ['bir', 'alohida'], S.sessionQuestions),
    variantCount: butun(k.variantCount, 1, VARIANT_KODLARI.length, S.variantCount),
    shuffleQuestions: typeof k.shuffleQuestions === 'boolean' ? k.shuffleQuestions : S.shuffleQuestions,
    shuffleOptions: typeof k.shuffleOptions === 'boolean' ? k.shuffleOptions : S.shuffleOptions,
    language: tanlov(k.language, ['', 'uz', 'ru', 'en'], S.language),
    seatMode: tanlov(k.seatMode, ['hammasi', 'shaxmat'], S.seatMode),
    sessionFill: tanlov(k.sessionFill, ['teng', 'ketma', 'kurs'], S.sessionFill),
    roomIds,
    variantBubble: typeof k.variantBubble === 'boolean' ? k.variantBubble : S.variantBubble,
    cancelled,
    keyFix,
    ranking: tanlov(k.ranking, ['hammasi', 'top', 'yoq'], S.ranking),
    topN: butun(k.topN, 1, 1000, S.topN),
    showQuestionsAfter: typeof k.showQuestionsAfter === 'boolean' ? k.showQuestionsAfter : S.showQuestionsAfter,
    notify: {
      channel: tanlov(n.channel, KANALLAR, S.notify.channel),
      to: tanlov(n.to, QABUL_QILUVCHI, S.notify.to),
      template: typeof n.template === 'string' && n.template.trim() ? n.template.slice(0, 1000) : S.notify.template,
    },
    source: tanlov(k.source, ['bank', 'kalit'], S.source),
    keys: kalitlarniTozala(k.keys),
    keyTopics: kalitlarniTozala(k.keyTopics, false),
    rasch: {
      enabled: typeof r.enabled === 'boolean' ? r.enabled : S.rasch.enabled,
      grades: Array.isArray(r.grades) && r.grades.length
        ? r.grades.slice(0, 12)
          .map(g => ({ label: String(g?.label ?? '').trim().slice(0, 6), min: Number(g?.min) }))
          .filter(g => g.label && Number.isFinite(g.min))
          .sort((x, y) => y.min - x.min)
        : S.rasch.grades.map(g => ({ ...g })),
    },
    admit: {
      channel: tanlov(a.channel, KANALLAR, S.admit.channel),
      to: tanlov(a.to, QABUL_QILUVCHI, S.admit.to),
      auto: typeof a.auto === 'boolean' ? a.auto : S.admit.auto,
      template: typeof a.template === 'string' && a.template.trim() ? a.template.slice(0, 1000) : S.admit.template,
    },
    optionCount: butun(k.optionCount, 2, HARFLAR.length, S.optionCount),
  };
}

// --- Savol ---------------------------------------------------------------

export function turi(v) {
  return SAVOL_TURLARI.includes(v) ? v : 'yopiq';
}

/** Yopiq savolning variantlari matni. Eski yozuvlar optionA–D da. */
export function savolVariantlari(q) {
  if (Array.isArray(q?.options)) return q.options.map(x => String(x ?? ''));
  return [q?.optionA, q?.optionB, q?.optionC, q?.optionD].filter(x => x !== null && x !== undefined && x !== '').map(String);
}

/** Raqamli javobni solishtirish uchun: bo'shliqsiz, vergul → nuqta. */
export function raqamniTozala(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[−–]/g, '-')
    .replace(/,/g, '.')
    .replace(/^\+/, '');
}

/** "1/2", "-0.5", "3" → son; o'qib bo'lmasa null. */
export function raqamQiymati(s) {
  const t = raqamniTozala(s);
  if (!t) return null;
  const kasr = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(t);
  if (kasr) {
    const b = Number(kasr[2]);
    return b === 0 ? null : Number(kasr[1]) / b;
  }
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return Number(t);
  return null;
}

export function raqamlarTengmi(a, b) {
  const x = raqamQiymati(a);
  const y = raqamQiymati(b);
  if (x === null || y === null) {
    const ta = raqamniTozala(a).toLowerCase();
    return ta !== '' && ta === raqamniTozala(b).toLowerCase();
  }
  return Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
}

/** Raqamli savolning qabul qilinadigan javoblari: asosiy + qo'shimchalari. */
export function qabulJavoblari(q) {
  const list = [q?.correctAnswer, ...(Array.isArray(q?.answers) ? q.answers : [])]
    .map(raqamniTozala)
    .filter(Boolean);
  return [...new Set(list)];
}

/**
 * Savol imtihonga yaraydimi. Yaramasa — sababi (bankda ko'rsatiladi,
 * variant yasashda bunday savol olinmaydi).
 */
export function savolXatosi(q) {
  if (!String(q?.text || '').trim() && !q?.imageUrl && !q?.passageId) return "Savol matni yo'q";
  const t = turi(q?.type);
  if (t === 'yopiq') {
    const v = savolVariantlari(q);
    if (v.length < 2) return 'Kamida 2 ta variant kerak';
    if (v.length > HARFLAR.length) return `Ko'pi bilan ${HARFLAR.length} ta variant`;
    if (v.some(x => !x.trim())) return "Bo'sh variant bor";
    const k = HARFLAR.indexOf(String(q.correctAnswer || '').trim().toUpperCase());
    if (k < 0 || k >= v.length) return "To'g'ri javob belgilanmagan";
  }
  if (t === 'raqamli') {
    const j = qabulJavoblari(q);
    if (!j.length) return "To'g'ri javob kiritilmagan";
    const yomon = j.find(x => raqamQiymati(x) === null || x.length > RAQAM_USTUNLARI);
    if (yomon) return `"${yomon}" varaqqa sig'maydi (${RAQAM_USTUNLARI} belgigacha son yoki kasr)`;
  }
  return null;
}

// --- Varaq tuzilmasi ------------------------------------------------------

function sonMi(v) {
  return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
}

/** Qoidadagi bir savolning bali: 'foiz' da 1 (yoki qoidada yozilgani), 'blok' da blok bali. */
export function qoidaBali(rule, block, scoring) {
  if (sonMi(rule?.points)) return Number(rule.points);
  if (scoring === 'foiz') return 1;
  return sonMi(block?.pointsPerQuestion) ? Number(block.pointsPerQuestion) : 1;
}

const yaxlit = (x, k = 100) => Math.round(x * k) / k;

/**
 * Javob varaqasi tuzilmasi: har blokda avval yopiq, keyin raqamli, keyin
 * yozma savollar. Hamma variant va smenada bir xil (faqat savollar va ularning
 * tartibi o'zgaradi), shuning uchun bitta varaq shabloni hammaga yaraydi.
 */
export function varaqTuzilmasi(blocks, scoring = 'blok') {
  const bloklar = [];
  const savollar = [];
  let n = 0;
  let maks = 0;
  (Array.isArray(blocks) ? blocks : []).forEach((b, bi) => {
    const soni = { yopiq: 0, raqamli: 0, yozma: 0 };
    let blokMaks = 0;
    for (const r of b?.topicRules || []) {
      const c = Math.max(0, parseInt(r?.count) || 0);
      soni[turi(r?.type)] += c;
      blokMaks += c * qoidaBali(r, b, scoring);
    }
    const boshi = n + 1;
    for (const t of SAVOL_TURLARI) for (let i = 0; i < soni[t]; i++) savollar.push({ n: ++n, blok: bi, tur: t });
    bloklar.push({ nomi: String(b?.subject || `${bi + 1}-blok`), boshi, oxiri: n, ...soni, maks: yaxlit(blokMaks) });
    maks += blokMaks;
  });
  const sana = t => savollar.filter(x => x.tur === t).length;
  return { bloklar, savollar, jami: n, yopiq: sana('yopiq'), raqamli: sana('raqamli'), yozma: sana('yozma'), maks: yaxlit(maks) };
}

// --- "Faqat kalit" rejimi --------------------------------------------------
//
// Markaz o'z kitobchasi bilan imtihon o'tkazadi (sotib olingan to'plam yoki
// ustoz tuzgan test): savollar bankka kiritilmaydi, CRM faqat javob
// varaqasini chiqaradi, o'qiydi va har kitobcha variantining kalitiga ko'ra
// baholaydi.

/**
 * Varaqdagi tartib bilan (har blokda yopiq → raqamli → yozma, qoidalar
 * tartibida) har savolning raqami, bloki, turi va bali — varaqTuzilmasi bilan
 * bir xil raqamlash.
 */
export function kalitTuzilmasi(blocks, scoring = 'blok') {
  const out = [];
  let n = 0;
  (Array.isArray(blocks) ? blocks : []).forEach((b, bi) => {
    const rules = Array.isArray(b?.topicRules) ? b.topicRules : [];
    for (const t of SAVOL_TURLARI) {
      for (const r of rules) {
        if (turi(r?.type) !== t) continue;
        const c = Math.max(0, parseInt(r?.count) || 0);
        const p = qoidaBali(r, b, scoring);
        for (let i = 0; i < c; i++) out.push({ n: ++n, b: bi, t, p });
      }
    }
  });
  return out;
}

/**
 * Bitta savolning kaliti. Yopiq — harf ("B") yoki bir nechtasi ("AC",
 * istalgani to'g'ri); raqamli — son ("0,5"), bir nechtasi ";" bilan; yozma —
 * bo'sh (ustoz baholaydi). "*" — savol bekor, hammaga ball; "-" — hisobdan
 * chiqariladi. Qaytaradi: {el} (variant elementi maydonlari) yoki {xato}.
 */
export function kalitQiymati(t, qiymat, optionCount = 4) {
  const v = String(qiymat ?? '').trim().toUpperCase();
  if (v === '*') return { el: { bekor: 'hammaga' } };
  if (v === '-') return { el: { bekor: 'chiqarish' } };
  if (t === 'yozma') return { el: {} };
  if (!v) return { xato: "kalit yo'q" };
  if (t === 'yopiq') {
    const harflar = [...new Set(v.replace(/[^A-Z]/g, '').split(''))].filter(Boolean);
    const ruxsat = HARFLAR.slice(0, optionCount);
    if (!harflar.length || harflar.some(h => !ruxsat.includes(h))) return { xato: `${ruxsat.join(', ')} dan biri bo'lishi kerak` };
    return { el: { k: HARFLAR.indexOf(harflar[0]), ...(harflar.length > 1 ? { ka: harflar } : {}) } };
  }
  const javoblar = [...new Set(v.split(/[;|]/).map(raqamniTozala).filter(Boolean))];
  if (!javoblar.length) return { xato: 'son yozilmagan' };
  const yomon = javoblar.find(x => raqamQiymati(x) === null || x.length > RAQAM_USTUNLARI);
  if (yomon) return { xato: `"${yomon}" varaqqa sig'maydi (${RAQAM_USTUNLARI} belgigacha son yoki kasr)` };
  return { el: { j: javoblar } };
}

/**
 * Kalit to'plamlari: smenalarga savol bir xil bo'lsa — faqat 1-smena
 * ('1|A', '1|B', ...), har smenaga alohida bo'lsa — har smena uchun.
 */
export function kalitToplamlari(settings) {
  const s = sozlamaniTozala(settings);
  const alohida = s.sessionQuestions === 'alohida' && s.sessions.length > 1;
  const kodlar = VARIANT_KODLARI.slice(0, s.variantCount);
  return (alohida ? s.sessions : [s.sessions[0]]).flatMap(sm => kodlar.map(code => ({ kalit: `${sm.id}|${code}`, session: sm.id, code })));
}

/**
 * "Faqat kalit" rejimida variantlar — kiritilgan kalitlardan. Kalit
 * to'liq bo'lmasa variant yasalmaydi. Qaytaradi: {variants, xatolar: [{kalit, n, xato}]}.
 */
export function kalitdanVariantlar({ blocks, scoring = 'blok', settings }) {
  const s = sozlamaniTozala(settings);
  const tuz = kalitTuzilmasi(blocks, scoring);
  const alohida = s.sessionQuestions === 'alohida' && s.sessions.length > 1;
  const asl = HARFLAR.slice(0, s.optionCount).map((_, i) => i);
  const xatolar = [];
  const toplam = new Map();
  for (const { kalit } of kalitToplamlari(s)) {
    const qiymatlar = s.keys[kalit] || [];
    const mavzular = s.keyTopics[kalit] || [];
    const items = [];
    for (const q of tuz) {
      const r = kalitQiymati(q.t, qiymatlar[q.n - 1], s.optionCount);
      if (r.xato) { xatolar.push({ kalit, n: q.n, xato: r.xato }); continue; }
      const mv = mavzular[q.n - 1];
      items.push({ n: q.n, q: null, b: q.b, t: q.t, p: q.p, ...(q.t === 'yopiq' ? { m: asl } : {}), ...r.el, ...(mv ? { mv } : {}) });
    }
    toplam.set(kalit, items);
  }
  if (xatolar.length) return { variants: [], xatolar };
  const variants = [];
  for (const sm of s.sessions) {
    for (const code of VARIANT_KODLARI.slice(0, s.variantCount)) {
      variants.push({ session: sm.id, code, items: toplam.get(`${alohida ? sm.id : 1}|${code}`) });
    }
  }
  return { variants, xatolar };
}

/**
 * Kalit matnini savollarga ajratish (bitta blok uchun): "ABCD…" (bo'shliqsiz,
 * faqat yopiq), "1A 2B 3C", "1-A, 2-B" yoki qatorma-qator. Raqamli javoblar
 * ";" yoki qator bilan ("0,5; 12; 3/4"). Qaytaradi: qiymatlar massivi.
 */
export function kalitMatniniOqi(matn, soni) {
  const t = String(matn ?? '').trim().toUpperCase();
  if (!t) return [];
  // "1A 2B" / "1-A, 2) B" — raqam + javob juftlari.
  const juftlar = [...t.matchAll(/(\d+)\s*[-.):]?\s*([A-F]{1,6}|\*|-(?!\d))/g)];
  if (juftlar.length >= 2) {
    const out = new Array(soni).fill('');
    for (const [, n, v] of juftlar) { const i = parseInt(n) - 1; if (i >= 0 && i < soni) out[i] = v; }
    return out;
  }
  // Faqat harflar: "ABCDA…" (bo'shliq, vergul va chiziqlar e'tiborsiz).
  if (/^[A-F\s,.*]+$/.test(t)) return t.replace(/[\s,.]/g, '').split('').slice(0, soni);
  // Aks holda — ";" yoki qatorlar bilan ajratilgan qiymatlar.
  return t.split(/[;\n]+/).map(x => x.trim()).slice(0, soni);
}

/**
 * Butun kitobcha kalitini matndan olish (kalitTuzilmasi savollari bo'yicha):
 *   "1A 2B 3-C 4) D" — raqamlari bilan (raqam — kitobchadagi savol raqami);
 *   "ABCDA…" — faqat harflar: yopiq savollarga tartib bilan;
 *   qatorma-qator yoki ";" bilan — hamma savolga tartib bilan (raqamli ham).
 * Qaytaradi: {savol raqami: qiymat}.
 */
export function kalitMatnidan(matn, tuz) {
  const t = String(matn ?? '').trim().toUpperCase();
  const out = {};
  if (!t) return out;
  const bor = new Set((tuz || []).map(q => q.n));
  const juftlar = [...t.matchAll(/(\d+)\s*[-.):]?\s*([A-F]{1,6}|\*|-(?!\d))/g)];
  if (juftlar.length >= 2 && /^[\d\sA-F*().:,;-]+$/.test(t)) {
    for (const [, n, v] of juftlar) { const k = parseInt(n); if (bor.has(k)) out[k] = v; }
    return out;
  }
  if (/^[A-F\s,.*-]+$/.test(t)) {
    const belgilar = t.replace(/[\s,.]/g, '').split('');
    (tuz || []).filter(q => q.t === 'yopiq').forEach((q, i) => { if (belgilar[i]) out[q.n] = belgilar[i]; });
    return out;
  }
  const bolaklar = t.split(/[;\n]+/).map(x => x.trim());
  (tuz || []).forEach((q, i) => { if (bolaklar[i]) out[q.n] = bolaklar[i]; });
  return out;
}

// --- Tasodif (urug'dan) ---------------------------------------------------

/** Kichik, tez va qayta tiklanadigan PRNG. */
export function mulberry32(a) {
  let s = a >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bir nechta butun sondan bitta urug'. */
export function urug(...sonlar) {
  let h = 2166136261 >>> 0;
  for (const s of sonlar) {
    h = Math.imul(h ^ (Number(s) >>> 0), 16777619) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

export function aralashtir(royxat, rng) {
  const a = [...royxat];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Variantlar -----------------------------------------------------------

const teng = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/** Matnga bog'langan savollar bitta birlik: birga tanlanadi va birga turadi. */
function birliklar(savollar) {
  const matnli = new Map();
  const yakka = [];
  for (const q of savollar) {
    if (q.passageId) {
      if (!matnli.has(q.passageId)) matnli.set(q.passageId, []);
      matnli.get(q.passageId).push(q);
    } else yakka.push([q]);
  }
  return [...yakka, ...[...matnli.values()].map(l => l.sort((a, b) => a.id - b.id))];
}

/**
 * Birliklardan aynan `kerak` ta savol tanlaydi. Kam ishlatilgani oldin
 * (bir xil bo'lsa — urug' bo'yicha tasodifiy). Matnli birliklar turli
 * o'lchamda bo'lgani uchun oddiy "boshidan olish" ba'zan yig'indini topolmaydi —
 * shuning uchun yig'indi bo'yicha dinamik tanlov (har birlik bir marta).
 */
function tanla(birlikRoyxati, kerak, rng) {
  const ishlatilgan = u => Math.max(...u.map(q => Number(q.usedCount) || 0));
  const tartib = aralashtir(birlikRoyxati, rng).sort((a, b) => ishlatilgan(a) - ishlatilgan(b));
  const qayerdan = new Array(kerak + 1).fill(undefined);
  qayerdan[0] = null;
  tartib.forEach((u, i) => {
    const o = u.length;
    for (let s = kerak; s >= o; s--) {
      if (qayerdan[s] === undefined && qayerdan[s - o] !== undefined) qayerdan[s] = { i, oldingi: s - o };
    }
  });
  if (qayerdan[kerak] === undefined) return null;
  const natija = [];
  for (let s = kerak; s > 0; s = qayerdan[s].oldingi) natija.push(tartib[qayerdan[s].i]);
  // Tanlov tartibi urug'ga bog'liq bo'lsin, lekin birlik ichidagi tartib saqlansin.
  return natija.sort((a, b) => tartib.indexOf(a) - tartib.indexOf(b));
}

function savolElementi(q, n, b, t, p, s, rng) {
  const el = { n, q: q.id, b, t, p };
  if (q.passageId) el.pa = q.passageId;
  if (t === 'yopiq') {
    const variantlar = savolVariantlari(q);
    const togri = HARFLAR.indexOf(String(q.correctAnswer || '').trim().toUpperCase());
    const asl = variantlar.map((_, i) => i);
    const m = s.shuffleOptions && !q.lockOptions ? aralashtir(asl, rng) : asl;
    el.m = m;
    el.k = m.indexOf(togri);
  } else if (t === 'raqamli') {
    el.j = qabulJavoblari(q);
  }
  return el;
}

/**
 * Imtihon variantlarini yasaydi. Bank — tashkilotning savollari (faqat
 * 'faol' va yaroqlilari olinadi). Qaytadi:
 *   variants  — [{session, code, items}] (bo'sh bo'lsa `kamchiliklar` bor)
 *   kamchiliklar — [{blok, mavzu, tur, kerak, bor}] — bank yetmagan qoidalar
 *   ogohlantirishlar — matnlar
 *   ishlatilgan — tanlangan savollar id lari
 *   optionCount — varaqdagi javob doirachalari soni
 */
export function variantlarniYasash({ blocks, scoring = 'blok', settings, seed = 1, bank }) {
  const s = sozlamaniTozala(settings);
  const kamchiliklar = [];
  const ogohlantirishlar = [];
  const yaroqli = [];
  let yaroqsiz = 0;
  for (const q of bank || []) {
    if ((q.status || 'faol') !== 'faol') continue;
    if (s.language && (q.language || 'uz') !== s.language) continue;
    if (savolXatosi(q)) { yaroqsiz++; continue; }
    yaroqli.push(q);
  }
  if (yaroqsiz) ogohlantirishlar.push(`${yaroqsiz} ta faol savol xato (kalit yoki variant yo'q) — ular olinmadi`);

  const smenalar = s.sessions.map(x => x.id);
  const tanlovSmenalari = s.sessionQuestions === 'alohida' ? smenalar : [smenalar[0]];
  const tanlovlar = new Map();
  const boshqaSmenada = new Set();
  const hammasi = new Set();
  const rngTanlov = mulberry32(urug(seed, 1));

  for (const sid of tanlovSmenalari) {
    const buSmena = new Set();
    const bloklar = [];
    (blocks || []).forEach((b, bi) => {
      const turlar = { yopiq: [], raqamli: [], yozma: [] };
      for (const r of b.topicRules || []) {
        const kerak = Math.max(0, parseInt(r.count) || 0);
        if (!kerak) continue;
        const tur = turi(r.type);
        const qiyinlik = parseInt(r.difficulty) || 0;
        const hovuz = yaroqli.filter(q =>
          teng(q.subject, b.subject) &&
          (!String(r.topic || '').trim() || teng(q.topic, r.topic)) &&
          turi(q.type) === tur &&
          (!qiyinlik || Number(q.difficulty) === qiyinlik) &&
          !buSmena.has(q.id));
        const hammaBirlik = birliklar(hovuz);
        const toza = hammaBirlik.filter(u => u.every(q => !boshqaSmenada.has(q.id)));
        let tanlangan = tanla(toza, kerak, rngTanlov);
        if (!tanlangan && toza.length !== hammaBirlik.length) {
          tanlangan = tanla(hammaBirlik, kerak, rngTanlov);
          if (tanlangan) ogohlantirishlar.push(`${b.subject} · ${r.topic || 'har qanday mavzu'}: boshqa smenadagi savollar ham olindi`);
        }
        if (!tanlangan) {
          kamchiliklar.push({ blok: b.subject, mavzu: r.topic || '', tur, kerak, bor: hovuz.length });
          continue;
        }
        const p = qoidaBali(r, b, scoring);
        for (const u of tanlangan) {
          turlar[tur].push({ savollar: u, p });
          u.forEach(q => buSmena.add(q.id));
        }
      }
      bloklar.push(turlar);
    });
    buSmena.forEach(id => { boshqaSmenada.add(id); hammasi.add(id); });
    tanlovlar.set(sid, bloklar);
  }

  if (kamchiliklar.length) return { variants: [], kamchiliklar, ogohlantirishlar, ishlatilgan: [], optionCount: s.optionCount };

  const byId = new Map(yaroqli.map(q => [q.id, q]));
  let optionCount = 4;
  for (const id of hammasi) {
    const q = byId.get(id);
    if (turi(q.type) === 'yopiq') optionCount = Math.max(optionCount, savolVariantlari(q).length);
  }

  const variants = [];
  for (const sid of smenalar) {
    const bloklar = tanlovlar.get(s.sessionQuestions === 'alohida' ? sid : smenalar[0]);
    for (let v = 0; v < s.variantCount; v++) {
      const rng = mulberry32(urug(seed, 2, sid, v));
      const items = [];
      let n = 0;
      bloklar.forEach((turlar, bi) => {
        for (const t of SAVOL_TURLARI) {
          const tartib = s.shuffleQuestions ? aralashtir(turlar[t], rng) : turlar[t];
          for (const { savollar, p } of tartib) {
            for (const q of savollar) items.push(savolElementi(q, ++n, bi, t, p, s, rng));
          }
        }
      });
      variants.push({ session: sid, code: VARIANT_KODLARI[v], items });
    }
  }
  return { variants, kamchiliklar: [], ogohlantirishlar, ishlatilgan: [...hammasi], optionCount };
}

/**
 * Har qoida uchun bankda nechta yaroqli savol borligi — "bank yetarlimi".
 * Smenalarga alohida savol bo'lsa, kerakli son smenalar soniga ko'payadi.
 */
export function bankYetarliligi({ blocks, settings, bank }) {
  const s = sozlamaniTozala(settings);
  const kopaytma = s.sessionQuestions === 'alohida' ? s.sessions.length : 1;
  const hammasi = bank || [];
  const tilMos = q => !s.language || (q.language || 'uz') === s.language;
  const yaroqli = hammasi.filter(q => (q.status || 'faol') === 'faol' && tilMos(q) && !savolXatosi(q));
  return (blocks || []).map(b => ({
    blok: b.subject,
    qoidalar: (b.topicRules || []).map(r => {
      const tur = turi(r.type);
      const qiyinlik = parseInt(r.difficulty) || 0;
      const mavzuMos = q => teng(q.subject, b.subject) && (!String(r.topic || '').trim() || teng(q.topic, r.topic)) && turi(q.type) === tur;
      const bor = yaroqli.filter(q => mavzuMos(q) && (!qiyinlik || Number(q.difficulty) === qiyinlik)).length;
      const kerak = (Math.max(0, parseInt(r.count) || 0)) * kopaytma;
      // Nega yetmayapti: mos savollar boshqa holatda, boshqa qiyinlikda yoki boshqa tilda bo'lishi mumkin.
      const sabab = {};
      if (bor < kerak) {
        const mos = hammasi.filter(mavzuMos);
        sabab.qoralama = mos.filter(q => (q.status || 'faol') !== 'faol' && q.status !== 'arxiv').length;
        sabab.xatoli = mos.filter(q => (q.status || 'faol') === 'faol' && savolXatosi(q)).length;
        if (qiyinlik) sabab.boshqaQiyinlik = yaroqli.filter(q => mavzuMos(q) && Number(q.difficulty) !== qiyinlik).length;
        if (s.language) sabab.boshqaTil = hammasi.filter(q => mavzuMos(q) && (q.status || 'faol') === 'faol' && !tilMos(q) && !savolXatosi(q)).length;
        sabab.fandaJami = hammasi.filter(q => teng(q.subject, b.subject)).length;
      }
      return { mavzu: r.topic || '', tur, qiyinlik, kerak, bor, yetadi: bor >= kerak, sabab };
    }),
  }));
}

// --- Ball hisoblash -------------------------------------------------------

/** Yopiq savolda o'quvchi javobi to'g'rimi (kalit tuzatishi hisobga olinadi). */
function yopiqTogrimi(it, javob, tuzatish) {
  const i = HARFLAR.indexOf(javob);
  if (i < 0) return false;
  if (tuzatish?.length) {
    const qabul = tuzatish.map(h => it.m?.indexOf(HARFLAR.indexOf(String(h).toUpperCase()))).filter(x => x >= 0);
    return qabul.includes(i);
  }
  // "Faqat kalit" rejimida bir nechta to'g'ri javob bo'lishi mumkin ("AC").
  if (Array.isArray(it.ka) && it.ka.length) return it.ka.includes(javob);
  return i === it.k;
}

/**
 * Bitta varaqning bali. `javoblar` — skaner o'qigani, `qolda` — operator
 * qarori (u ustun turadi). Javob qiymatlari: yopiq — 'A'..'F', '' (bo'sh),
 * '*' (bir nechta belgi); raqamli — satr; yozma — {ball}.
 */
export function natijaniHisobla({ items, javoblar, qolda, blocks, settings }) {
  const s = sozlamaniTozala(settings);
  const bl = (blocks || []).map(b => ({ subject: String(b.subject || ''), earned: 0, max: 0, togri: 0, xato: 0, bosh: 0 }));
  const detail = [];
  let ball = 0, maks = 0, togri = 0, xato = 0, bosh = 0, baholanmagan = 0;

  for (const it of items || []) {
    // "Faqat kalit" rejimida bekor qilish kalitning o'zida ("*" yoki "-").
    const bekor = it.bekor || s.cancelled[it.q];
    const blok = bl[it.b] || bl[0] || { earned: 0, max: 0, togri: 0, xato: 0, bosh: 0 };
    const qoldaQiymat = qolda && Object.prototype.hasOwnProperty.call(qolda, it.n) ? qolda[it.n] : undefined;
    const v = qoldaQiymat !== undefined ? qoldaQiymat : javoblar?.[it.n];

    if (bekor === 'chiqarish') {
      detail.push({ n: it.n, q: it.q, javob: v ?? '', holat: 'bekor', ball: 0 });
      continue;
    }

    let olindi = 0;
    let holat;
    if (bekor === 'hammaga') {
      olindi = it.p;
      holat = 'bekor';
    } else if (it.t === 'yozma') {
      const g = v && typeof v === 'object' ? v.ball : undefined;
      if (!sonMi(g)) { holat = 'baholanmagan'; baholanmagan++; }
      else {
        olindi = Math.min(it.p, Math.max(0, Number(g)));
        holat = olindi >= it.p ? 'togri' : olindi > 0 ? 'qisman' : 'xato';
      }
    } else {
      const javob = typeof v === 'string' ? v : '';
      if (!javob) holat = 'bosh';
      else if (javob === '*') holat = 'xato';
      else if (it.t === 'yopiq' ? yopiqTogrimi(it, javob, s.keyFix[it.q]) : (s.keyFix[it.q] || it.j || []).some(a => raqamlarTengmi(a, javob))) {
        olindi = it.p;
        holat = 'togri';
      } else holat = 'xato';
    }

    maks += it.p;
    blok.max += it.p;
    ball += olindi;
    blok.earned += olindi;
    if (holat === 'togri' || holat === 'bekor') { togri++; blok.togri++; }
    else if (holat === 'bosh') { bosh++; blok.bosh++; }
    else if (holat === 'xato' || holat === 'qisman') { xato++; blok.xato++; }
    detail.push({ n: it.n, q: it.q, javob: v ?? '', holat, ball: yaxlit(olindi) });
  }

  return {
    ball: yaxlit(ball),
    maks: yaxlit(maks),
    foiz: maks > 0 ? yaxlit((ball / maks) * 100, 10) : 0,
    blockScores: bl.map(b => ({ ...b, earned: yaxlit(b.earned), max: yaxlit(b.max) })),
    detail,
    togri, xato, bosh, baholanmagan,
  };
}

// --- O'rinlashtirish ------------------------------------------------------

/** Xonadagi o'rinlar (0 dan sanaladi), qator bo'yicha. */
export function xonaOrinlari(room, seatMode = 'hammasi') {
  const sxemali = parseInt(room?.rows) > 0 && parseInt(room?.cols) > 0;
  const cols = sxemali ? parseInt(room.cols) : 6;
  const sigim = Math.max(0, parseInt(room?.capacity) || 0);
  const rows = sxemali ? parseInt(room.rows) : Math.ceil(sigim / cols);
  const band = new Set(Array.isArray(room?.blocked) ? room.blocked.map(String) : []);
  const list = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!sxemali && r * cols + c >= sigim) continue;
      if (band.has(`${r + 1}-${c + 1}`)) continue;
      if (seatMode === 'shaxmat' && (r + c) % 2 === 1) continue;
      list.push({ row: r, col: c });
    }
  }
  return list;
}

/**
 * O'rindagi variant. (2·qator + o'rin) mod N: N ≥ 4 da yon, old, orqa va
 * diagonaldagi 8 qo'shnining hech biriga bir xil variant tushmaydi.
 */
export function orinVarianti(row, col, variantCount) {
  const n = Math.max(1, variantCount);
  return VARIANT_KODLARI[((2 * row + col) % n + n) % n];
}

/** Kurslarni navbat bilan aralashtiradi: yonma-yon o'rinlarga boshqa kurs tushsin. */
function kurslarniAralashtir(royxat) {
  const kurslar = new Map();
  for (const p of royxat) {
    const k = p.groupId ?? `yakka-${p.studentId ?? p.guestName}`;
    if (!kurslar.has(k)) kurslar.set(k, []);
    kurslar.get(k).push(p);
  }
  const navbat = [...kurslar.values()].sort((a, b) => b.length - a.length);
  const natija = [];
  for (let i = 0; navbat.some(l => i < l.length); i++) {
    for (const l of navbat) if (i < l.length) natija.push(l[i]);
  }
  return natija;
}

/**
 * Qatnashchilarni smena, xona va o'ringa joylashtiradi. Har filial o'z
 * xonalarida. Qaytadi: {seats: [{...qatnashchi, session, roomId, row, col,
 * variant}], sigmadi: [qatnashchi]}.
 */
export function orinlashtirish({ qatnashchilar, xonalar, settings }) {
  const s = sozlamaniTozala(settings);
  const seats = [];
  const sigmadi = [];
  const filiallar = new Map();
  for (const p of qatnashchilar || []) {
    if (!filiallar.has(p.schoolId)) filiallar.set(p.schoolId, []);
    filiallar.get(p.schoolId).push(p);
  }

  for (const [schoolId, royxat] of filiallar) {
    const xonaRoyxati = (xonalar || []).filter(x => x.schoolId === schoolId && (!s.roomIds.length || s.roomIds.includes(x.id)));
    const orinlar = xonaRoyxati.flatMap(x => xonaOrinlari(x, s.seatMode).map(o => ({ roomId: x.id, ...o })));
    const S = s.sessions.length;

    // Smenalarga bo'lish.
    const smenaga = s.sessions.map(() => []);
    if (s.sessionFill === 'kurs') {
      const kurslar = new Map();
      for (const p of royxat) {
        const k = p.groupId ?? 'boshqa';
        if (!kurslar.has(k)) kurslar.set(k, []);
        kurslar.get(k).push(p);
      }
      for (const l of [...kurslar.values()].sort((a, b) => b.length - a.length)) {
        // Eng ko'p bo'sh joy qolgan smenaga.
        let eng = 0;
        for (let i = 1; i < S; i++) if (orinlar.length - smenaga[i].length > orinlar.length - smenaga[eng].length) eng = i;
        smenaga[eng].push(...l);
      }
    } else {
      const tartib = kurslarniAralashtir(royxat);
      const har = s.sessionFill === 'teng' ? Math.ceil(tartib.length / S) : orinlar.length;
      let i = 0;
      for (let k = 0; k < S; k++) {
        smenaga[k] = tartib.slice(i, i + har);
        i += smenaga[k].length;
      }
      sigmadi.push(...tartib.slice(i));
    }

    s.sessions.forEach((sess, k) => {
      const tartib = kurslarniAralashtir(smenaga[k]);
      tartib.forEach((p, i) => {
        const o = orinlar[i];
        if (!o) { sigmadi.push(p); return; }
        seats.push({ ...p, session: sess.id, roomId: o.roomId, row: o.row, col: o.col, variant: orinVarianti(o.row, o.col, s.variantCount) });
      });
    });
  }
  return { seats, sigmadi };
}

// --- Reyting va tahlil ----------------------------------------------------

/** Musobaqa tartibi: 1, 2, 2, 4. `kalit` — guruhlash (filial, kurs). */
export function reytingOrinlari(natijalar, kalit = () => 'hammasi') {
  const guruhlar = new Map();
  for (const r of natijalar) {
    const k = kalit(r);
    if (k === null || k === undefined) continue;
    if (!guruhlar.has(k)) guruhlar.set(k, []);
    guruhlar.get(k).push(r);
  }
  const orin = new Map();
  for (const l of guruhlar.values()) {
    l.sort((a, b) => b.score - a.score);
    l.forEach((r, i) => orin.set(r.id, i > 0 && l[i - 1].score === r.score ? orin.get(l[i - 1].id) : i + 1));
  }
  return { orin, soni: k => guruhlar.get(k)?.length || 0 };
}

/**
 * Savol tahlili: nechta o'quvchi to'g'ri topdi, qaysi variantni tanladi
 * (asl harflarda), kuchli va kuchsiz 27% farqi. Kalit xatosini topishga
 * yordam beradi: kuchlilar kuchsizlardan ko'p xato qilgan savol — shubhali.
 */
export function savolTahlili({ variants, natijalar, smenaBilan = false }) {
  const vmap = new Map((variants || []).map(v => [`${v.session}|${v.code}`, v]));
  const tartib = [...(natijalar || [])].sort((a, b) => b.score - a.score);
  const k = Math.max(1, Math.round(tartib.length * 0.27));
  const yuqori = new Set(tartib.slice(0, k).map(r => r.id));
  const quyi = new Set(tartib.slice(-k).map(r => r.id));
  const stat = new Map();

  for (const r of natijalar || []) {
    const v = vmap.get(`${r.session}|${r.variantCode}`);
    if (!v) continue;
    const holatlar = new Map((r.detail || []).map(d => [d.n, d]));
    for (const it of v.items) {
      // Bank savoli — id si bo'yicha (variantlarda tartibi boshqa); "faqat kalit"
      // savoli — kitobcha varianti va raqami bo'yicha (har kitobcha o'zicha).
      const qk = it.q ?? `${smenaBilan ? `${v.session}:` : ''}${v.code}:${it.n}`;
      if (!stat.has(qk)) stat.set(qk, { q: qk, t: it.t, b: it.b, jami: 0, togri: 0, bosh: 0, tanlov: {}, yJami: 0, yTogri: 0, qJami: 0, qTogri: 0, ...(it.q == null ? { n: it.n, kod: v.code, smena: v.session } : {}) });
      const st = stat.get(qk);
      const d = holatlar.get(it.n);
      if (!d || d.holat === 'bekor') continue;
      st.jami++;
      const tog = d.holat === 'togri';
      if (tog) st.togri++;
      if (d.holat === 'bosh') st.bosh++;
      if (it.t === 'yopiq' && typeof d.javob === 'string' && d.javob.length === 1) {
        const asl = it.m?.[HARFLAR.indexOf(d.javob)];
        if (asl !== undefined) st.tanlov[HARFLAR[asl]] = (st.tanlov[HARFLAR[asl]] || 0) + 1;
      }
      if (yuqori.has(r.id)) { st.yJami++; if (tog) st.yTogri++; }
      if (quyi.has(r.id)) { st.qJami++; if (tog) st.qTogri++; }
    }
  }

  return [...stat.values()].map(st => {
    const foiz = st.jami ? st.togri / st.jami : 0;
    const farq = (st.yJami ? st.yTogri / st.yJami : 0) - (st.qJami ? st.qTogri / st.qJami : 0);
    return {
      q: st.q, t: st.t, b: st.b, jami: st.jami, togri: st.togri, bosh: st.bosh, tanlov: st.tanlov,
      ...(st.kod ? { n: st.n, kod: st.kod, smena: st.smena } : {}),
      foiz: yaxlit(foiz, 1000), farq: yaxlit(farq, 1000),
      shubhali: st.jami >= 5 && (foiz < 0.15 || farq < 0),
    };
  });
}

// --- Xabar ----------------------------------------------------------------

/** Natija xabari. `m` — {ism, imtihon, sana, ball, maks, foiz, bloklar, orin, markaz, havola}. */
// --- O'zbekcha ko'rinish (server xabarlari va brauzer uchun bir xil) --------

/** O'nli kasr vergul bilan: 33.4 → "33,4" (varaqda ham vergul bo'yaladi). */
export const vergul = (v) => String(v ?? '').replace(/(\d)\.(\d)/g, '$1,$2');

export const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** "2026-10-05" → "5-oktabr 2026". Tanilmagan qiymat o'zicha qaytadi. */
export function sanaMatni(sana) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(sana || ''));
  if (!m) return String(sana || '');
  return `${Number(m[3])}-${OYLAR[Number(m[2]) - 1] || m[2]} ${m[1]}`;
}

/**
 * Ruxsatnoma matni. {ism} {imtihon} {sana} {vaqt} {filial} {xona} {qator}
 * {orin} {markaz}; qiymati bo'sh ixtiyoriy o'zgaruvchi turgan qator tushadi.
 */
export function ruxsatnomaMatni(shablon, m) {
  const ixtiyoriy = ['markaz', 'vaqt', 'filial', 'xona', 'qator', 'orin'];
  const boshlar = ixtiyoriy.filter(k => !String(m[k] ?? '').trim());
  let matn = String(shablon || RUXSATNOMA_SHABLON)
    .split('\n')
    .filter(satr => !boshlar.some(k => satr.toLowerCase().includes(`{${k}}`)))
    .join('\n');
  for (const k of ['ism', 'imtihon', 'sana', 'vaqt', 'filial', 'xona', 'qator', 'orin', 'markaz']) {
    matn = matn.replace(new RegExp(`\\{${k}\\}`, 'gi'), String(m[k] ?? ''));
  }
  return matn.split('\n').filter((satr, i, a) => satr.trim() || (i > 0 && a[i - 1].trim())).join('\n').trim();
}

export function natijaXabari(shablon, m) {
  // Qiymati bo'sh o'zgaruvchi turgan qator ("🔎 Batafsil: " kabi) butunlay tushib qoladi.
  const boshlar = ['bloklar', 'orin', 'havola', 'markaz', 'rasch', 'daraja'].filter(k => !String(m[k] ?? '').trim());
  const qatorlar = String(shablon || STANDART_SHABLON)
    .split('\n')
    .filter(satr => !boshlar.some(k => satr.toLowerCase().includes(`{${k}}`)));
  return qatorlar.join('\n')
    .replace(/\{havola\}/gi, m.havola ?? '')
    .replace(/\{ism\}/gi, m.ism ?? '')
    .replace(/\{imtihon\}/gi, m.imtihon ?? '')
    .replace(/\{sana\}/gi, m.sana ?? '')
    .replace(/\{ball\}/gi, String(m.ball ?? ''))
    .replace(/\{maks\}/gi, String(m.maks ?? ''))
    .replace(/\{foiz\}/gi, String(m.foiz ?? ''))
    .replace(/\{bloklar\}/gi, m.bloklar ?? '')
    .replace(/\{orin\}/gi, m.orin ?? '')
    .replace(/\{markaz\}/gi, m.markaz ?? '')
    .replace(/\{rasch\}/gi, m.rasch ?? '')
    .replace(/\{daraja\}/gi, m.daraja ?? '')
    .split('\n')
    .filter((satr, i, a) => satr.trim() || (i > 0 && a[i - 1].trim()))
    .join('\n')
    .trim();
}
