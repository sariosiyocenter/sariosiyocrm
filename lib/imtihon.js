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
// 'juft' — moslashtirish guruhining savoli (umumiy A–F ro'yxatidan bitta javob; yopiq kabi
// tekshiriladi); 'qismli' — bitta raqam ostidagi a), b) qismi (javobi yoziladi). Ikkalasi ham
// Passage.tur bilan belgilangan guruhga (passageId) tegishli. Tartib — varaqdagi bo'limlar tartibi.
export const SAVOL_TURLARI = ['yopiq', 'raqamli', 'moslash', 'juft', 'qismli', 'yozma'];
/** Guruhli savol turlari (Passage.tur) va ularning savol turi. */
export const GURUH_TURLARI = { moslash: 'juft', qismli: 'qismli' };
/** Savol guruhli savolning bo'lagimi (juft yoki qismli). */
export const guruhSavolimi = (tur) => Object.values(GURUH_TURLARI).includes(tur);
/** Imtihon qoidasining turi: guruh turlari hali qo'llab-quvvatlanmaydi — 'yopiq' ga tushadi. */
export const qoidaTuri = (v) => (guruhSavolimi(v) ? 'yopiq' : SAVOL_TURLARI.includes(v) ? v : 'yopiq');
export const SAVOL_TURI_NOMI = { yopiq: 'Yopiq (variantli)', raqamli: 'Raqamli javob', moslash: 'Moslashtirish (matritsa)', juft: 'Moslashtirish guruhi savoli', qismli: 'Qismli savol (a, b)', yozma: 'Yozma (qo\'lda baholanadi)' };

// Moslashtirish (Addmen "Matrix"): chap ustun A–D (savol `options`), o'ng ustun P–T
// (savol `answers`), kalit — har qatorga o'ng ustun harflari: "PQ|R|S|T". Varaqda
// har savol uchun 4 × 5 doirachalar to'ri; o'quvchi javobi ham shu ko'rinishda.
export const MOSLASH_QATOR = 'ABCD';
export const MOSLASH_USTUN = 'PQRST';

/** "pq | r|s" → ["PQ", "R", "S"]: har qatorda o'ng ustun harflari (tartiblangan, takrorsiz). */
export function moslashQatorlari(v) {
  return String(v ?? '').toUpperCase().split('|').map(x => [...new Set(x.replace(/[^PQRST]/g, '').split(''))].sort().join(''));
}

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
  '{holat}',
  '📐 Rasch balli: {rasch}',
  '🎓 Daraja: {daraja}',
  '{bloklar}',
  '{orin}',
  '🔎 Batafsil: {havola}',
].join('\n');

// So'rovnoma (Addmen "Survey / Feedback"): tayyor shkalalar.
export const SOROVNOMA_SHKALALARI = {
  likert: ["Mutlaqo qo'shilmayman", "Qo'shilmayman", 'Bilmayman', "Qo'shilaman", "To'liq qo'shilaman"],
  baho: ['1', '2', '3', '4', '5'],
  sifat: ['Juda yomon', 'Yomon', "O'rtacha", 'Yaxshi', "A'lo"],
  haYoq: ['Ha', "Yo'q"],
  haQismanYoq: ['Ha', 'Qisman', "Yo'q"],
};

const ESKI_STANDART_SHABLON = STANDART_SHABLON.replace('\n{holat}', '');

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
  // Manfiy ball (Addmen "negative marking"): xato javob uchun savol balining shu ulushi
  // ayiriladi (0 — yo'q, 0.25 — chorak). Bo'sh javobga jarima yo'q.
  xatoJarima: 0,
  // Jarima bilan ham jami ball 0 dan pastga tushmaydi.
  jarimaNoldan: true,
  // Qo'shimcha ball komponentlari (og'zaki, yozma ish — Excel'dan): [{nom, max}].
  // Har natijadagi ball — ExamResult.extra {nom: ball}; jami ball va foizga qo'shiladi.
  qoshimcha: [],
  // Onlayn test (Addmen CBT): qatnashchi havola orqali telefonda yechadi. Vaqtlar —
  // O'zbekiston vaqti "YYYY-MM-DDTHH:mm" (bo'sh — cheklovsiz); daqiqa 0 — imtihon davomiyligi.
  onlayn: { yoqilgan: false, ochiladi: '', yopiladi: '', daqiqa: 0 },
  // O'rin hisoblash (Addmen RANKING PATTERN): 'otkazib' — 1, 2, 2, 4 (tenglardan keyin
  // o'rin tashlanadi); 'ketma' — 1, 2, 2, 3.
  orinUsuli: 'otkazib',
  // O'tish bali (Addmen MINIMUM MARKS): null — yo'q; {turi: 'foiz' | 'ball', qiymat}.
  otish: null,
  // Addmen "Use <=": bankdan faqat shuncha martagacha ishlatilgan savollar olinadi (null — cheklovsiz).
  // Qo'lda tanlangan savollarga ta'sir qilmaydi.
  ishlatishChegarasi: null,
  // Addmen "Duplicate content": bir xil savol (matni, rasmi; 'variant' — javob variantlari ham)
  // bir imtihonga ikki marta tushmaydi. 'yoq' — tekshirilmaydi.
  takror: 'variant',
  // So'rovnoma (source: 'sorovnoma'): savollar matni, umumiy shkala (har savolda o'zi ham
  // bo'lishi mumkin), anonim — ism va ID siz, universal varaqlar.
  sorovnoma: { anonim: true, shkala: [], savollar: [] },
  // Erkin javob varaqasi (dizayner andozasining nusxasi) — null: standart varaq.
  varaqAndoza: null,
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
      // Eski standart matn ({holat} siz) saqlangan bo'lsa — yangi standart.
      template: typeof n.template === 'string' && n.template.trim() && n.template !== ESKI_STANDART_SHABLON ? n.template.slice(0, 1000) : S.notify.template,
    },
    source: tanlov(k.source, ['bank', 'kalit', 'sorovnoma'], S.source),
    sorovnoma: sorovnomaTozala(k.sorovnoma),
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
    xatoJarima: Number.isFinite(Number(k.xatoJarima)) ? Math.min(1, Math.max(0, Number(k.xatoJarima))) : S.xatoJarima,
    jarimaNoldan: typeof k.jarimaNoldan === 'boolean' ? k.jarimaNoldan : S.jarimaNoldan,
    onlayn: {
      yoqilgan: typeof k.onlayn?.yoqilgan === 'boolean' ? k.onlayn.yoqilgan : S.onlayn.yoqilgan,
      ochiladi: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(k.onlayn?.ochiladi || '')) ? k.onlayn.ochiladi : '',
      yopiladi: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(k.onlayn?.yopiladi || '')) ? k.onlayn.yopiladi : '',
      daqiqa: butun(k.onlayn?.daqiqa, 0, 600, 0),
    },
    orinUsuli: tanlov(k.orinUsuli, ['otkazib', 'ketma'], S.orinUsuli),
    ishlatishChegarasi: butun(k.ishlatishChegarasi, 0, 1000, null),
    takror: tanlov(k.takror, ['yoq', 'savol', 'variant'], S.takror),
    varaqAndoza: varaqAndozaTozala(k.varaqAndoza),
    otish: Number(k.otish?.qiymat) > 0
      ? { turi: tanlov(k.otish.turi, ['foiz', 'ball'], 'foiz'), qiymat: Math.round(Math.min(k.otish.turi === 'ball' ? 10000 : 100, Number(k.otish.qiymat)) * 100) / 100 }
      : null,
    qoshimcha: (Array.isArray(k.qoshimcha) ? k.qoshimcha : [])
      .map(x => ({ nom: String(x?.nom ?? '').replace(/\s+/g, ' ').trim().slice(0, 60), max: Number(x?.max) }))
      .filter((x, i, l) => x.nom && Number.isFinite(x.max) && x.max > 0 && l.findIndex(y => y.nom.toLowerCase() === x.nom.toLowerCase()) === i)
      .slice(0, 10),
  };
}

// --- Erkin javob varaqasi (Addmen "OMR Designer") ------------------------------

export const ANDOZA_BLOK_TURLARI = ['yopiq', 'raqamli', 'moslash', 'yozma', 'matn', 'rasm'];
const RASM_MAX = 400000;        // bitta rasm (data URL uzunligi)
const RASMLAR_MAX = 1200000;    // andozadagi hamma rasm

/**
 * Andoza: {nomi, sahifalar (1–4), bloklar}. Koordinatalar millimetrda (A4), savol
 * bloklari — boshlanish raqami, soni va ustunlari (o'lchami geometriyadan:
 * src/lib/omr/layout.ts). Rasm — faqat png/jpeg/webp/gif data URL.
 * @returns {any}
 */
export function varaqAndozaTozala(v) {
  if (!v || typeof v !== 'object' || !Array.isArray(v.bloklar)) return null;
  const son = (x, a, b, s) => (Number.isFinite(Number(x)) && x !== null && x !== '' ? Math.min(b, Math.max(a, Math.round(Number(x) * 10) / 10)) : s);
  const sahifalar = butun(v.sahifalar, 1, 4, 1);
  const bloklar = [];
  let rasmlar = 0;
  for (const b of v.bloklar.slice(0, 150)) {
    if (!b || !ANDOZA_BLOK_TURLARI.includes(b.tur)) continue;
    const o = {
      id: String(b.id ?? '').replace(/[^\w-]/g, '').slice(0, 24) || `b${bloklar.length + 1}`,
      tur: b.tur, sahifa: butun(b.sahifa, 1, sahifalar, 1), x: son(b.x, 0, 210, 20), y: son(b.y, 0, 297, 90),
    };
    if (['yopiq', 'raqamli', 'moslash', 'yozma'].includes(b.tur)) {
      o.boshi = butun(b.boshi, 1, 999, 1);
      o.soni = b.tur === 'yozma' ? 1 : butun(b.soni, 1, 300, 10);
      o.ustunlar = butun(b.ustunlar, 1, 8, 1);
      const s = String(b.sarlavha ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (s) o.sarlavha = s;
    }
    if (b.tur === 'yozma' || b.tur === 'rasm' || b.tur === 'matn') o.w = son(b.w, 5, 170, 60);
    if (b.tur === 'yozma' || b.tur === 'rasm') o.h = son(b.h, 5, 200, 30);
    if (b.tur === 'matn') {
      o.matn = String(b.matn ?? '').slice(0, 600);
      o.olcham = son(b.olcham, 2, 10, 3);
      o.qalin = !!b.qalin;
      o.tekis = tanlov(b.tekis, ['start', 'middle', 'end'], 'start');
    }
    if (b.tur === 'rasm') {
      const src = String(b.src || '');
      if (!/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(src) || src.length > RASM_MAX || rasmlar + src.length > RASMLAR_MAX) continue;
      rasmlar += src.length;
      o.src = src;
    }
    bloklar.push(o);
  }
  return {
    id: Number.isInteger(Number(v.id)) && Number(v.id) > 0 ? Number(v.id) : null,
    nomi: String(v.nomi ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
    sahifalar, bloklar,
    ...(v.yangilangan ? { yangilangan: String(v.yangilangan).slice(0, 40) } : {}),
  };
}

/** "YYYY-MM-DDTHH:mm" (O'zbekiston vaqti, UTC+5) → Date; bo'sh yoki noto'g'ri — null. */
export function uzVaqti(s) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(s || ''))) return null;
  const d = new Date(`${s}:00+05:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Onlayn test holati: 'yopiq' (o'chirilgan), 'kutilmoqda' (hali ochilmagan), 'ochiq',
 * 'tugagan' (yopilish vaqti o'tgan). `hozir` — Date.
 */
export function onlaynHolati(settings, hozir = new Date()) {
  const o = sozlamaniTozala(settings).onlayn;
  if (!o.yoqilgan) return 'yopiq';
  const och = uzVaqti(o.ochiladi), yop = uzVaqti(o.yopiladi);
  if (och && hozir < och) return 'kutilmoqda';
  if (yop && hozir >= yop) return 'tugagan';
  return 'ochiq';
}

/** Qo'shimcha ballar: {ball, maks, qismlar: [{nom, ball, max}]} — sozlamadagi komponentlar bo'yicha. */
export function qoshimchaBallar(settings, extra) {
  const s = sozlamaniTozala(settings);
  const e = extra && typeof extra === 'object' ? extra : {};
  const qismlar = s.qoshimcha.map(q => {
    const v = Number(e[q.nom]);
    return { nom: q.nom, max: q.max, ball: Number.isFinite(v) ? Math.min(q.max, Math.max(0, v)) : null };
  });
  return { ball: qismlar.reduce((a, q) => a + (q.ball || 0), 0), maks: qismlar.reduce((a, q) => a + q.max, 0), qismlar };
}

// --- Savol ---------------------------------------------------------------

export function turi(v) {
  return SAVOL_TURLARI.includes(v) ? v : 'yopiq';
}

// --- Qiyinlik -------------------------------------------------------------

/** Savol qiyinligi uch darajada: 1 — oson, 2 — o'rta, 3 — qiyin. */
export const QIYINLIKLAR = [1, 2, 3];
export const QIYINLIK_NOMI = { 1: 'Oson', 2: "O'rta", 3: 'Qiyin' };

/**
 * Qiyinlik darajasi 1..3. Excel dagi so'z ("oson", "o'rta", "qiyin", "easy",
 * "сложный"...) va eski 1–5 shkala (4–5 → qiyin) ham qabul qilinadi.
 */
export function qiyinlikDarajasi(v) {
  const s = String(v ?? '').trim().toLowerCase().replace(/[ʻʼ’‘`']/g, '');
  if (/^(oson|easy|лег|лёг)/.test(s)) return 1;
  if (/^(orta|medium|сред)/.test(s)) return 2;
  if (/^(qiyin|hard|слож|труд)/.test(s)) return 3;
  const d = parseInt(s);
  return d >= 3 ? 3 : d === 2 ? 2 : 1;
}

/** Qoidadagi qiyinlik: 1..3 yoki 0 — istalgan (aralash). */
export function qoidaQiyinligi(r) {
  const d = parseInt(r?.difficulty);
  return d >= 1 ? qiyinlikDarajasi(d) : 0;
}

/**
 * Natijaga ko'ra qiyinlik: savolni to'g'ri topganlar ulushi 70% va undan
 * ko'p — oson, 40–70% — o'rta, 40% dan kam — qiyin. Ma'lumot yo'q — null.
 */
export function natijaQiyinligi(pCorrect) {
  if (pCorrect === null || pCorrect === undefined || pCorrect === '') return null;
  const p = Number(pCorrect);
  if (!Number.isFinite(p)) return null;
  return p >= 0.7 ? 1 : p >= 0.4 ? 2 : 3;
}

/**
 * Belgilangan qiyinlik natijaga aniq mos kelmaydimi (chegara atrofidagi ±10% farq
 * hisobga olinmaydi): oson — 60% dan kam topilgan, qiyin — 50% va undan ko'p,
 * o'rta — 30% dan kam yoki 80% va undan ko'p. Ma'lumot yo'q — mos (false).
 */
export function qiyinlikMosEmas(d, pCorrect) {
  if (pCorrect === null || pCorrect === undefined || pCorrect === '') return false;
  const p = Number(pCorrect);
  if (!Number.isFinite(p)) return false;
  const q = qiyinlikDarajasi(d);
  return q === 1 ? p < 0.6 : q === 3 ? p >= 0.5 : (p < 0.3 || p >= 0.8);
}

/** Qiyinlik aralashmasi — [oson, o'rta, qiyin] ulushlari (imtihon tuzishdagi tayyor tanlovlar). */
export const QIYINLIK_ARALASHMASI = {
  oson: [0.5, 0.35, 0.15],
  muvozanat: [0.3, 0.4, 0.3],
  qiyin: [0.15, 0.35, 0.5],
};

/** Eng katta qoldiq usuli: `jami` ni ulushlarga butun sonlar bilan bo'ladi (yig'indi aynan jami). */
export function ulushlargaBol(jami, ulushlar) {
  const n = Math.max(0, Math.round(Number(jami) || 0));
  const w = (ulushlar || []).map(x => Math.max(0, Number(x) || 0));
  if (!w.length) return [];
  const s = w.reduce((a, x) => a + x, 0) || 1;
  const xom = w.map(x => (n * x) / s);
  const out = xom.map(Math.floor);
  let qoldi = n - out.reduce((a, x) => a + x, 0);
  const tartib = xom.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; qoldi > 0; k = (k + 1) % out.length, qoldi--) out[tartib[k][1]]++;
  return out;
}

/**
 * Blok savollarini tanlangan mavzular va qiyinlik bo'yicha taqsimlaydi.
 *   jami   — nechta savol;  ulush — [oson, o'rta, qiyin] ulushlari;
 *   mavzular — [{ id, bor: [oson, o'rta, qiyin] }] — bankdagi yaroqli savollar.
 * Qiyinliklar navbatma-navbat (har mavzuga har xil qiyinlik tushsin) eng kam
 * savol olgan mavzuga beriladi, bankdagidan oshmaydi; biror qiyinlikda yetmasa
 * qo'shni qiyinlikdan olinadi. Qaytaradi: { jadval: {id: [oson, o'rta, qiyin]}, yetmadi }.
 */
export function taqsimla({ jami, ulush, mavzular }) {
  const m = (mavzular || []).map(x => ({ id: x.id, bor: [0, 1, 2].map(i => Math.max(0, parseInt(x.bor?.[i]) || 0)) }));
  const jadval = Object.fromEntries(m.map(x => [x.id, [0, 0, 0]]));
  const maqsad = ulushlargaBol(jami, ulush && ulush.length === 3 ? ulush : QIYINLIK_ARALASHMASI.muvozanat);
  const n = maqsad.reduce((a, x) => a + x, 0);
  // Silliq vaznli navbat: 2-1-3-2-1-2-3… — maqsaddagi sonlar aynan saqlanadi.
  const ketma = [];
  const joriy = [0, 0, 0];
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < 3; i++) joriy[i] += maqsad[i];
    let eng = 0;
    for (let i = 1; i < 3; i++) if (joriy[i] > joriy[eng]) eng = i;
    joriy[eng] -= n;
    ketma.push(eng);
  }
  const jami_ = id => jadval[id][0] + jadval[id][1] + jadval[id][2];
  const qoy = d => {
    let eng = null;
    for (const x of m) {
      if (jadval[x.id][d] >= x.bor[d]) continue;
      if (!eng) { eng = x; continue; }
      const a = jami_(x.id), b = jami_(eng.id);
      if (a < b || (a === b && x.bor[d] - jadval[x.id][d] > eng.bor[d] - jadval[eng.id][d])) eng = x;
    }
    if (!eng) return false;
    jadval[eng.id][d]++;
    return true;
  };
  const qolgan = [0, 0, 0];
  for (const d of ketma) if (!qoy(d)) qolgan[d]++;
  const zaxira = [[1, 2], [0, 2], [1, 0]];
  let yetmadi = 0;
  for (let d = 0; d < 3; d++) for (let k = 0; k < qolgan[d]; k++) if (!zaxira[d].some(qoy)) yetmadi++;
  return { jadval, yetmadi };
}

/** `jami` ta savolni mavzularga teng yoyadi (har mavzuda bankdagidan oshmaydi): { jadval: {id: n}, yetmadi }. */
export function tengYoy(jami, mavzular) {
  const m = (mavzular || []).map(x => ({ id: x.id, bor: Math.max(0, parseInt(x.bor) || 0) }));
  const jadval = Object.fromEntries(m.map(x => [x.id, 0]));
  let yetmadi = 0;
  for (let k = 0; k < Math.max(0, parseInt(jami) || 0); k++) {
    let eng = null;
    for (const x of m) {
      if (jadval[x.id] >= x.bor) continue;
      if (!eng || jadval[x.id] < jadval[eng.id] || (jadval[x.id] === jadval[eng.id] && x.bor - jadval[x.id] > eng.bor - jadval[eng.id])) eng = x;
    }
    if (eng) jadval[eng.id]++; else yetmadi++;
  }
  return { jadval, yetmadi };
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

/** Oraliq javob ("2..3", "-1..1/2") → [kichik, katta]; oraliq bo'lmasa null. */
export function raqamOraligi(s) {
  const m = /^(.+?)\.\.(.+)$/.exec(raqamniTozala(s));
  if (!m) return null;
  const a = raqamQiymati(m[1]), b = raqamQiymati(m[2]);
  if (a === null || b === null) return null;
  return a <= b ? [a, b] : [b, a];
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
  // Kalitda oraliq bo'lsa — o'quvchi javobi shu oraliqda bo'lsa to'g'ri.
  const o = raqamOraligi(a);
  if (o) {
    const y = raqamQiymati(b);
    return y !== null && y >= o[0] - 1e-9 && y <= o[1] + 1e-9;
  }
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
  if (t === 'qismli' && !String(q?.correctAnswer || '').trim()) return "To'g'ri javob kiritilmagan";
  if (t === 'yopiq' || t === 'juft') {
    const v = savolVariantlari(q);
    if (v.length < 2) return 'Kamida 2 ta variant kerak';
    if (v.length > HARFLAR.length) return `Ko'pi bilan ${HARFLAR.length} ta variant`;
    if (v.some(x => !x.trim())) return "Bo'sh variant bor";
    const k = HARFLAR.indexOf(String(q.correctAnswer || '').trim().toUpperCase());
    if (k < 0 || k >= v.length) return "To'g'ri javob belgilanmagan";
  }
  if (t === 'moslash') {
    const chap = savolVariantlari(q);
    const ong = (Array.isArray(q.answers) ? q.answers : []).map(x => String(x ?? ''));
    if (chap.length < 2 || chap.length > MOSLASH_QATOR.length) return `Chap ustunda 2–${MOSLASH_QATOR.length} ta band kerak`;
    if (ong.length < 2 || ong.length > MOSLASH_USTUN.length) return `O'ng ustunda 2–${MOSLASH_USTUN.length} ta band kerak`;
    if ([...chap, ...ong].some(x => !x.trim())) return "Bo'sh band bor";
    const k = moslashQatorlari(q.correctAnswer);
    if (k.length !== chap.length || k.some(x => !x)) return "Har qatorning javobi belgilanmagan";
    if (k.some(x => [...x].some(h => MOSLASH_USTUN.indexOf(h) >= ong.length))) return "Javobda o'ng ustunda yo'q harf bor";
  }
  if (t === 'raqamli') {
    const j = qabulJavoblari(q);
    if (!j.length) return "To'g'ri javob kiritilmagan";
    const yomon = j.find(x => !raqamOraligi(x) && (raqamQiymati(x) === null || x.length > RAQAM_USTUNLARI));
    if (yomon) return `"${yomon}" varaqqa sig'maydi (${RAQAM_USTUNLARI} belgigacha son yoki kasr, oraliq — "2..3")`;
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
    const soni = { yopiq: 0, raqamli: 0, moslash: 0, juft: 0, qismli: 0, yozma: 0 };
    let blokMaks = 0;
    for (const r of b?.topicRules || []) {
      const c = Math.max(0, parseInt(r?.count) || 0);
      soni[turi(r?.type)] += c;
      blokMaks += c * qoidaBali(r, b, scoring);
    }
    const boshi = n + 1;
    for (const t of SAVOL_TURLARI) for (let i = 0; i < soni[t]; i++) savollar.push({ n: ++n, blok: bi, tur: t });
    // "m tadan n": blokning eng yuqori bali — n ta savol (o'rtacha bal bilan).
    const jami = soni.yopiq + soni.raqamli + soni.moslash + soni.yozma;
    const tanlab = parseInt(b?.tanlab);
    if (tanlab > 0 && tanlab < jami) blokMaks = (blokMaks / jami) * tanlab;
    bloklar.push({ nomi: String(b?.subject || `${bi + 1}-blok`), boshi, oxiri: n, ...soni, maks: yaxlit(blokMaks), ...(tanlab > 0 && tanlab < jami ? { tanlab } : {}) });
    maks += blokMaks;
  });
  const sana = t => savollar.filter(x => x.tur === t).length;
  return { bloklar, savollar, jami: n, yopiq: sana('yopiq'), raqamli: sana('raqamli'), moslash: sana('moslash'), yozma: sana('yozma'), maks: yaxlit(maks) };
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
  if (t === 'moslash') {
    // "PQ|R|S|T" — har qatorga o'ng ustun harflari (qatorlar soni — kalitdagi bo'laklar).
    const mk = moslashQatorlari(v);
    if (mk.length < 2 || mk.length > MOSLASH_QATOR.length || mk.some(x => !x)) return { xato: `"PQ|R|S|T" ko'rinishida, 2–${MOSLASH_QATOR.length} qator` };
    return { el: { r: mk.length, c: MOSLASH_USTUN.length, mk } };
  }
  const javoblar = [...new Set(v.split(/[;|]/).map(raqamniTozala).filter(Boolean))];
  if (!javoblar.length) return { xato: 'son yozilmagan' };
  const yomon = javoblar.find(x => !raqamOraligi(x) && (raqamQiymati(x) === null || x.length > RAQAM_USTUNLARI));
  if (yomon) return { xato: `"${yomon}" varaqqa sig'maydi (${RAQAM_USTUNLARI} belgigacha son yoki kasr, oraliq — "2..3")` };
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

/** Savol blokning fanidanmi: bank tuzilmasidagi fan id si bo'yicha, bo'lmasa nomi bo'yicha. */
function fanMos(q, b) {
  if (b?.fanId && q?.fanId != null) return Number(q.fanId) === Number(b.fanId);
  return teng(q?.subject, b?.subject);
}

/**
 * Andoza qatoridan kelgan qo'shimcha filtrlar: bo'lim, manba va belgilar (har
 * biri bo'lsa — savolda ham bo'lishi shart; belgilar hammasi).
 */
export function filtrMos(q, r) {
  if (String(r?.section || '').trim() && !teng(q?.section, r.section)) return false;
  if (String(r?.source || '').trim() && !teng(q?.source, r.source)) return false;
  const belgilar = Array.isArray(r?.tagIds) ? r.tagIds.map(Number).filter(Boolean) : [];
  if (belgilar.length) {
    const bor = new Set((Array.isArray(q?.tagIds) ? q.tagIds : []).map(Number));
    if (!belgilar.every(t => bor.has(t))) return false;
  }
  return true;
}

/** Qoidada mavzudan tashqari filtr bormi (bo'lim, manba, belgilar). */
function filtrBor(r) {
  return !!(String(r?.section || '').trim() || String(r?.source || '').trim() || (Array.isArray(r?.tagIds) && r.tagIds.length));
}

/** Savol qoidaning mavzusidanmi (mavzu berilmagan — fanning istalgan mavzusi) va filtrlariga mosmi. */
function mavzuMos(q, r) {
  if (!filtrMos(q, r)) return false;
  if (r?.mavzuId && q?.mavzuId != null) return Number(q.mavzuId) === Number(r.mavzuId);
  return !String(r?.topic || '').trim() || teng(q?.topic, r.topic);
}

/** Qoidada qo'lda tanlangan savollar (bo'lmasa — tasodifiy tanlanadi). */
export function tanlanganSavollar(r) {
  return Array.isArray(r?.questionIds) ? r.questionIds.map(Number).filter(n => Number.isInteger(n) && n > 0) : [];
}

/**
 * Qoidalar tartibi: avval qo'lda tanlangan savollar, keyin aniq mavzu va
 * qiyinlik, keyin mavzu, keyin qiyinlik, oxirida "istalgan" — umumiy qoida
 * aniqroq qoidaga kerakli savolni olib qo'ymasin.
 */
function qoidaUstuvorligi(r) {
  if (tanlanganSavollar(r).length) return 0;
  const m = !!(r?.mavzuId || String(r?.topic || '').trim() || filtrBor(r));
  const d = !!qoidaQiyinligi(r);
  return m && d ? 1 : m ? 2 : d ? 3 : 4;
}

function ustuvorlikTartibi(rules) {
  return rules.map((r, ri) => ({ r, ri })).sort((a, b) => qoidaUstuvorligi(a.r) - qoidaUstuvorligi(b.r) || a.ri - b.ri);
}

/** Matnga bog'langan savollar bitta birlik: birga tanlanadi va birga turadi. */
export function birliklar(savollar) {
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

/** Birlikning qiyinligi: matnli savollar birga turadi, darajasi — o'rtachasi. */
export function birlikQiyinligi(u) {
  return qiyinlikDarajasi(Math.round(u.reduce((a, q) => a + qiyinlikDarajasi(q.difficulty), 0) / (u.length || 1)));
}

/** Qoidaga mos birliklar: fan, mavzu, tur va (birlik) qiyinlik bo'yicha; `band` dagi savollarsiz. */
function qoidaBirliklari(yaroqli, b, r, band) {
  const tur = turi(r?.type);
  const d = qoidaQiyinligi(r);
  const hovuz = yaroqli.filter(q => fanMos(q, b) && mavzuMos(q, r) && turi(q.type) === tur && !band.has(q.id));
  return birliklar(hovuz).filter(u => !d || birlikQiyinligi(u) === d);
}

/**
 * Bitta mavzudagi yaroqli savollardan imtihonga olsa bo'ladiganlari — tur va
 * qiyinlik bo'yicha (matnli savollar birlik bo'lib, o'rtacha qiyinligida sanaladi):
 * { yopiq: [oson, o'rta, qiyin], raqamli: [...], yozma: [...] }.
 */
export function mavzuMavjudligi(savollar) {
  const out = Object.fromEntries(SAVOL_TURLARI.map(t => [t, [0, 0, 0]]));
  for (const t of SAVOL_TURLARI) {
    for (const u of birliklar((savollar || []).filter(q => turi(q.type) === t))) out[t][birlikQiyinligi(u) - 1] += u.length;
  }
  return out;
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
  if (qayerdan[kerak] === undefined) {
    // Butun matnlar bilan aniq yig'indi chiqmasa — bitta matnning bir qismi olinadi
    // (masalan, 3 savolli matndan 2 tasi): savollar baribir birga, matni bilan turadi.
    if (tartib.reduce((a, u) => a + u.length, 0) < kerak) return null;
    const natija = [];
    let qoldi = kerak;
    for (const u of tartib) {
      if (!qoldi) break;
      if (u.length > qoldi && natija.length + 1 < tartib.length && tartib.slice(tartib.indexOf(u) + 1).some(v => v.length <= qoldi)) continue;
      const olin = u.slice(0, qoldi);
      natija.push(olin);
      qoldi -= olin.length;
    }
    return qoldi ? null : natija;
  }
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
  } else if (t === 'moslash') {
    // Qatorlar va ustunlar aralashtirilmaydi (varaqdagi to'r savoldagi tartibda).
    el.r = savolVariantlari(q).length;
    el.c = (Array.isArray(q.answers) ? q.answers : []).length;
    el.mk = moslashQatorlari(q.correctAnswer);
  }
  return el;
}

function sorovnomaTozala(v) {
  const o = v && typeof v === 'object' ? v : {};
  const yorliqlar = l => (Array.isArray(l) ? l : []).map(x => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)).filter(Boolean).slice(0, HARFLAR.length);
  const shkala = yorliqlar(o.shkala);
  return {
    anonim: o.anonim !== false,
    shkala: shkala.length >= 2 ? shkala : [...SOROVNOMA_SHKALALARI.likert],
    savollar: (Array.isArray(o.savollar) ? o.savollar : [])
      .map(q => {
        const v = yorliqlar(q?.variantlar);
        return { matn: String(q?.matn ?? '').replace(/\s+/g, ' ').trim().slice(0, 300), ...(v.length >= 2 ? { variantlar: v } : {}) };
      })
      .filter(q => q.matn)
      .slice(0, 200),
  };
}

/** So'rovnoma savolining javob yorliqlari (o'zi bo'lmasa — umumiy shkala). */
export const sorovnomaYorliqlari = (sv, q) => (q?.variantlar?.length >= 2 ? q.variantlar : sv.shkala);

/** So'rovnoma bloki (varaq va natija uchun): bitta "So'rovnoma" bloki, hamma savol yopiq. */
export function sorovnomaBloklari(settings) {
  const sv = sozlamaniTozala(settings).sorovnoma;
  return [{ id: 'sorovnoma', subject: "So'rovnoma", pointsPerQuestion: 0, topicRules: [{ topic: '', type: 'yopiq', count: sv.savollar.length }] }];
}

/** So'rovnoma "variantlari": har smenaga bitta (A), kalitsiz; doirachalar — savol yorliqlari soni. */
export function sorovnomaVariantlari(settings) {
  const s = sozlamaniTozala(settings);
  const items = s.sorovnoma.savollar.map((q, i) => ({ n: i + 1, q: null, b: 0, t: 'yopiq', p: 0, k: -1, m: sorovnomaYorliqlari(s.sorovnoma, q).map((_, j) => j) }));
  return s.sessions.map(sm => ({ session: sm.id, code: 'A', items }));
}

/** Takrorni aniqlash uchun matn izi: teglar, $ va bo'shliqlarsiz, kichik harf. */
function izMatni(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\$|\\[,;!: ]/g, '').replace(/\s+/g, '').toLowerCase();
}

/**
 * Savolning "izi": bir xil izli ikki savol — takror. 'savol' — matn va rasm,
 * 'variant' — javob variantlari ham (tartibidan qat'i nazar). Matnli (passage)
 * savollar va bo'sh matn tekshirilmaydi.
 */
export function savolIzi(q, rejim) {
  if (!rejim || rejim === 'yoq' || q.passageId) return null;
  const matn = izMatni(q.text);
  if (!matn && !q.imageUrl) return null;
  const asos = `${matn}|${q.imageUrl || ''}`;
  return rejim === 'variant' ? `${asos}|${savolVariantlari(q).map(izMatni).sort().join('|')}` : asos;
}

/**
 * Avtomatik tanlov hovuzi: ishlatish chegarasidan oshganlar va takrorlar chiqariladi
 * (takrordan kam ishlatilgani qoladi; qo'lda tanlangan savol doim qoladi va uning
 * takrori hovuzdan chiqadi).
 */
function tanlovHovuzi(yaroqli, blocks, s) {
  const qolda = new Set();
  for (const b of blocks || []) for (const r of b.topicRules || []) tanlanganSavollar(r).forEach(id => qolda.add(id));
  let chegara = 0, takror = 0;
  const izlar = new Set();
  const tartib = [...yaroqli].sort((a, b) => (qolda.has(b.id) - qolda.has(a.id)) || ((Number(a.usedCount) || 0) - (Number(b.usedCount) || 0)) || a.id - b.id);
  const hovuz = [];
  for (const q of tartib) {
    if (!qolda.has(q.id) && s.ishlatishChegarasi != null && (Number(q.usedCount) || 0) > s.ishlatishChegarasi) { chegara++; continue; }
    const iz = savolIzi(q, s.takror);
    if (iz && izlar.has(iz) && !qolda.has(q.id)) { takror++; continue; }
    if (iz) izlar.add(iz);
    hovuz.push(q);
  }
  return { hovuz, chegara, takror };
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
  const yaroqliId = new Map(yaroqli.map(q => [q.id, q]));
  const { hovuz, chegara, takror } = tanlovHovuzi(yaroqli, blocks, s);
  if (chegara) ogohlantirishlar.push(`${chegara} ta savol ${s.ishlatishChegarasi} martadan ko'p ishlatilgani uchun olinmadi`);
  if (takror) ogohlantirishlar.push(`${takror} ta takroriy savol (bankda bir xili bor) olinmadi`);

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
      const rules = b.topicRules || [];
      // Qoidalar ustuvorlik tartibida tanlanadi, variantga esa o'z tartibida tushadi.
      const olingan = new Map();
      for (const { r, ri } of ustuvorlikTartibi(rules)) {
        const tur = turi(r.type);
        const p = qoidaBali(r, b, scoring);
        const idlar = tanlanganSavollar(r);
        if (idlar.length) {
          const topilgan = idlar.map(id => yaroqliId.get(id)).filter(q => q && turi(q.type) === tur);
          if (topilgan.length !== idlar.length) {
            kamchiliklar.push({ blok: b.subject, mavzu: 'Tanlangan savollar', tur, kerak: idlar.length, bor: topilgan.length, tanlangan: true });
            continue;
          }
          topilgan.forEach(q => buSmena.add(q.id));
          olingan.set(ri, birliklar(topilgan).map(u => ({ savollar: u, p })));
          continue;
        }
        const kerak = Math.max(0, parseInt(r.count) || 0);
        if (!kerak) continue;
        const hammaBirlik = qoidaBirliklari(hovuz, b, r, buSmena);
        const toza = hammaBirlik.filter(u => u.every(q => !boshqaSmenada.has(q.id)));
        let tanlangan = tanla(toza, kerak, rngTanlov);
        if (!tanlangan && toza.length !== hammaBirlik.length) {
          tanlangan = tanla(hammaBirlik, kerak, rngTanlov);
          if (tanlangan) ogohlantirishlar.push(`${b.subject} · ${r.label || r.topic || 'har qanday mavzu'}: boshqa smenadagi savollar ham olindi`);
        }
        if (!tanlangan) {
          kamchiliklar.push({ blok: b.subject, mavzu: r.label || r.topic || '', tur, qiyinlik: qoidaQiyinligi(r), kerak, bor: hammaBirlik.reduce((a, u) => a + u.length, 0) });
          continue;
        }
        tanlangan.forEach(u => u.forEach(q => buSmena.add(q.id)));
        olingan.set(ri, tanlangan.map(u => ({ savollar: u, p })));
      }
      const turlar = { yopiq: [], raqamli: [], moslash: [], juft: [], qismli: [], yozma: [] };
      rules.forEach((r, ri) => { for (const x of olingan.get(ri) || []) turlar[turi(r.type)].push(x); });
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
 * Addmen "Align questions / select question IDs of choice": qulflangan imtihonda
 * bitta savolni boshqasiga almashtirish uchun nomzodlar — o'sha fan (blok),
 * o'sha mavzu va tur; avval o'sha qiyinlikdagilar, kam ishlatilgani oldin.
 * Imtihondagi savollar, ularning takrorlari, matnli savollar va chegaradan
 * ko'p ishlatilganlar olinmaydi.
 */
export function almashtirishNomzodlari({ eski, blok, bank, imtihonIdlari, settings }) {
  const s = sozlamaniTozala(settings);
  const band = new Set(imtihonIdlari || []);
  const izlar = new Set((bank || []).filter(q => band.has(q.id)).map(q => savolIzi(q, s.takror)).filter(Boolean));
  const mavzuMosmi = q => (eski.bankTopicId ? q.bankTopicId === eski.bankTopicId : q.subject === eski.subject && q.topic === eski.topic);
  const l = (bank || []).filter(q => !band.has(q.id) && !q.passageId && (q.status || 'faol') === 'faol' && !savolXatosi(q)
    && turi(q.type) === turi(eski.type) && fanMos(q, blok) && mavzuMosmi(q)
    && (!s.language || (q.language || 'uz') === s.language)
    && (s.ishlatishChegarasi == null || (Number(q.usedCount) || 0) <= s.ishlatishChegarasi)
    && !(savolIzi(q, s.takror) && izlar.has(savolIzi(q, s.takror))));
  const d = qiyinlikDarajasi(eski.difficulty);
  return l.sort((a, b) => ((qiyinlikDarajasi(a.difficulty) !== d) - (qiyinlikDarajasi(b.difficulty) !== d))
    || ((Number(a.usedCount) || 0) - (Number(b.usedCount) || 0)) || a.id - b.id);
}

/** Variantlarda `eski` savol o'rniga `yangi` (o'sha raqam, ball va blokda; variantlari yangidan aralashtiriladi). */
export function savolniAlmashtir({ variants, eski, yangi, settings, seed = 1 }) {
  const s = sozlamaniTozala(settings);
  return (variants || []).map((v, vi) => {
    const rng = mulberry32(urug(seed, 7, yangi.id, vi));
    return { ...v, items: v.items.map(it => (it.q === eski ? savolElementi(yangi, it.n, it.b, it.t, it.p, s, rng) : it)) };
  });
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
  const { hovuz } = tanlovHovuzi(yaroqli, blocks, s);
  const hovuzId = new Set(hovuz.map(q => q.id));
  const byId = new Map(hammasi.map(q => [q.id, q]));
  const yaroqliId = new Set(yaroqli.map(q => q.id));
  // Qoidalar variant yasashdagi tartibda "band" qiladi: aniqroq qoida olgan savol
  // umumiyroq qoidaning hisobiga kirmaydi (aks holda qulflashda yetmay qolardi).
  const band = new Set();
  const ishlatish = u => Math.max(...u.map(q => Number(q.usedCount) || 0));
  return (blocks || []).map(b => {
    const rules = b.topicRules || [];
    const natija = new Array(rules.length);
    for (const { r, ri } of ustuvorlikTartibi(rules)) {
      const tur = turi(r.type);
      const qiyinlik = qoidaQiyinligi(r);
      const idlar = tanlanganSavollar(r);
      if (idlar.length) {
        const bor = idlar.filter(id => yaroqliId.has(id) && turi(byId.get(id)?.type) === tur).length;
        idlar.forEach(id => band.add(id));
        const sabab = bor < idlar.length
          ? { yoq: idlar.filter(id => !byId.has(id)).length, faolEmas: idlar.filter(id => byId.has(id) && !yaroqliId.has(id)).length }
          : {};
        natija[ri] = { mavzu: '', tur, qiyinlik: 0, tanlangan: true, kerak: idlar.length, bor, yetadi: bor >= idlar.length, sabab };
        continue;
      }
      const kerak = Math.max(0, parseInt(r.count) || 0) * kopaytma;
      const birlik = qoidaBirliklari(hovuz, b, r, band);
      const bor = birlik.reduce((a, u) => a + u.length, 0);
      let olindi = 0;
      for (const u of [...birlik].sort((x, y) => ishlatish(x) - ishlatish(y))) {
        if (olindi >= kerak) break;
        u.forEach(q => band.add(q.id));
        olindi += u.length;
      }
      // Nega yetmayapti: mos savollar boshqa holatda, boshqa qiyinlikda, boshqa tilda
      // yoki boshqa (aniqroq) qoidaga ketgan bo'lishi mumkin.
      const sabab = {};
      if (bor < kerak) {
        const mos = hammasi.filter(q => fanMos(q, b) && mavzuMos(q, r) && turi(q.type) === tur);
        sabab.qoralama = mos.filter(q => (q.status || 'faol') !== 'faol' && q.status !== 'arxiv').length;
        sabab.xatoli = mos.filter(q => (q.status || 'faol') === 'faol' && savolXatosi(q)).length;
        if (qiyinlik) sabab.boshqaQiyinlik = yaroqli.filter(q => fanMos(q, b) && mavzuMos(q, r) && turi(q.type) === tur && qiyinlikDarajasi(q.difficulty) !== qiyinlik).length;
        if (s.language) sabab.boshqaTil = mos.filter(q => (q.status || 'faol') === 'faol' && !tilMos(q) && !savolXatosi(q)).length;
        sabab.boshqaQoida = qoidaBirliklari(hovuz, b, r, new Set()).reduce((a, u) => a + u.length, 0) - bor;
        // Ishlatish chegarasi yoki takror sababli chiqarilganlar.
        sabab.chiqarilgan = qoidaBirliklari(yaroqli.filter(q => !hovuzId.has(q.id)), b, r, new Set()).reduce((a, u) => a + u.length, 0);
        sabab.fandaJami = hammasi.filter(q => fanMos(q, b)).length;
      }
      natija[ri] = { mavzu: r.label || r.topic || '', mavzuId: r.mavzuId || null, tur, qiyinlik, kerak, bor, yetadi: bor >= kerak, sabab };
    }
    return { blok: b.subject, qoidalar: natija.filter(Boolean) };
  });
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
  // So'rovnoma: to'g'ri javob yo'q — faqat javoblar yig'iladi (ball 0).
  if (s.source === 'sorovnoma') {
    let bosh = 0;
    const detail = (items || []).map(it => {
      const q = qolda && Object.prototype.hasOwnProperty.call(qolda, it.n) ? qolda[it.n] : javoblar?.[it.n];
      const v = typeof q === 'string' ? q : '';
      if (!v) bosh++;
      return { n: it.n, q: null, javob: v, holat: !v ? 'bosh' : v === '*' ? 'ortiqcha' : 'javob', ball: 0 };
    });
    return { ball: 0, maks: 0, foiz: 0, blockScores: [{ subject: "So'rovnoma", earned: 0, max: 0, togri: 0, xato: 0, bosh }], detail, togri: 0, xato: 0, bosh, baholanmagan: 0 };
  }
  const bl = (blocks || []).map(b => ({ subject: String(b.subject || ''), earned: 0, max: 0, togri: 0, xato: 0, bosh: 0 }));
  // "m tadan n tasini yeching" (blokda `tanlab`): birinchi n ta javob hisoblanadi.
  const tanlab = (blocks || []).map(b => (Number.isInteger(Number(b?.tanlab)) && Number(b.tanlab) > 0 ? Number(b.tanlab) : 0));
  const hisoblangan = tanlab.map(() => 0);
  const bloqBallar = tanlab.map(() => []);
  const detail = [];
  let ball = 0, maks = 0, togri = 0, xato = 0, bosh = 0, baholanmagan = 0;

  for (const it of items || []) {
    // "Faqat kalit" rejimida bekor qilish kalitning o'zida ("*" yoki "-").
    const bekor = it.bekor || s.cancelled[it.q];
    const blok = bl[it.b] || bl[0] || { earned: 0, max: 0, togri: 0, xato: 0, bosh: 0 };
    const n = tanlab[it.b] || 0;
    if (n) bloqBallar[it.b].push(it.p);
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
      else if (javob === '*') {
        // Bir nechta doiracha bo'yalgan — xato (jarima bo'lsa, u ham).
        holat = 'xato';
        if (s.xatoJarima > 0) olindi = -it.p * s.xatoJarima;
      } else if (it.t === 'moslash') {
        // Har to'g'ri qator — balning ulushi; hammasi — to'g'ri, birortasi — qisman.
        const kalit = s.keyFix[it.q]?.[0] ? moslashQatorlari(s.keyFix[it.q][0]) : (it.mk || []);
        const javoblar = moslashQatorlari(javob);
        const r = it.r || kalit.length || 1;
        if (javoblar.every(x => !x)) { holat = 'bosh'; olindi = 0; } else {
        const togriQator = kalit.slice(0, r).filter((k, i) => k && k === (javoblar[i] || '')).length;
        olindi = yaxlit((it.p * togriQator) / r);
        holat = togriQator === r ? 'togri' : togriQator > 0 ? 'qisman' : 'xato';
        if (holat === 'xato' && s.xatoJarima > 0) olindi = -it.p * s.xatoJarima;
        }
      } else if (it.t === 'yopiq' ? yopiqTogrimi(it, javob, s.keyFix[it.q]) : (s.keyFix[it.q] || it.j || []).some(a => raqamlarTengmi(a, javob))) {
        olindi = it.p;
        holat = 'togri';
      } else {
        holat = 'xato';
        // Manfiy ball: xato (va bir nechta belgilangan) javob uchun.
        if (s.xatoJarima > 0) olindi = -it.p * s.xatoJarima;
      }
    }

    // "m tadan n": blokdagi n-javobdan keyingilari hisobga olinmaydi; bo'shlar maksimumga keyin qo'shiladi.
    if (n) {
      if (holat === 'bosh') { bosh++; blok.bosh++; detail.push({ n: it.n, q: it.q, javob: v ?? '', holat, ball: 0 }); continue; }
      if (hisoblangan[it.b] >= n) { detail.push({ n: it.n, q: it.q, javob: v ?? '', holat: 'ortiqcha', ball: 0 }); continue; }
      hisoblangan[it.b]++;
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
  // "m tadan n": javob berilmagan joylar — blokning qolgan savollari balidan (eng kattasidan) maksimumga.
  tanlab.forEach((n, bi) => {
    if (!n || hisoblangan[bi] >= n) return;
    const qoldi = [...bloqBallar[bi]].sort((a, b) => b - a).slice(0, n - hisoblangan[bi]).reduce((a, x) => a + x, 0);
    bl[bi].max += qoldi;
    maks += qoldi;
  });
  // Jarima bilan: har fan bloki 0 dan past emas, jami — bloklar yig'indisi.
  if (s.xatoJarima > 0 && s.jarimaNoldan) {
    for (const b of bl) b.earned = Math.max(0, b.earned);
    ball = bl.length ? bl.reduce((a, b) => a + b.earned, 0) : Math.max(0, ball);
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

/**
 * O'rinlar. `usul` 'otkazib' — 1, 2, 2, 4 (musobaqa tartibi); 'ketma' — 1, 2, 2, 3.
 * `kalit` — guruhlash (filial, kurs).
 */
export function reytingOrinlari(natijalar, kalit = () => 'hammasi', usul = 'otkazib') {
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
    let ketma = 0;
    l.forEach((r, i) => {
      const teng = i > 0 && l[i - 1].score === r.score;
      if (!teng) ketma++;
      orin.set(r.id, teng ? orin.get(l[i - 1].id) : usul === 'ketma' ? ketma : i + 1);
    });
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
      if (!d || d.holat === 'bekor' || d.holat === 'ortiqcha') continue;
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
  const ixtiyoriy = ['markaz', 'vaqt', 'filial', 'xona', 'qator', 'orin', 'test_havola'];
  const boshlar = ixtiyoriy.filter(k => !String(m[k] ?? '').trim());
  let matn = String(shablon || RUXSATNOMA_SHABLON)
    .split('\n')
    .filter(satr => !boshlar.some(k => satr.toLowerCase().includes(`{${k}}`)))
    .join('\n');
  for (const k of ['ism', 'imtihon', 'sana', 'vaqt', 'filial', 'xona', 'qator', 'orin', 'markaz', 'test_havola']) {
    matn = matn.replace(new RegExp(`\\{${k}\\}`, 'gi'), String(m[k] ?? ''));
  }
  return matn.split('\n').filter((satr, i, a) => satr.trim() || (i > 0 && a[i - 1].trim())).join('\n').trim();
}

/** O'tish bali bo'yicha: true — o'tdi, false — o'tmadi, null — o'tish bali qo'yilmagan. */
export function otishHolati(s, ball, foiz) {
  if (!s?.otish) return null;
  return (s.otish.turi === 'ball' ? Number(ball) : Number(foiz)) >= s.otish.qiymat;
}

export function natijaXabari(shablon, m) {
  // Qiymati bo'sh o'zgaruvchi turgan qator ("🔎 Batafsil: " kabi) butunlay tushib qoladi.
  const boshlar = ['bloklar', 'orin', 'havola', 'markaz', 'rasch', 'daraja', 'holat'].filter(k => !String(m[k] ?? '').trim());
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
    .replace(/\{holat\}/gi, m.holat ?? '')
    .split('\n')
    .filter((satr, i, a) => satr.trim() || (i > 0 && a[i - 1].trim()))
    .join('\n')
    .trim();
}
