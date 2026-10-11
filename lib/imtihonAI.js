// Imtihon moduli uchun AI (3-bosqich, docs/IMTIHON_PLAN.md): savollarni
// fayldan ajratish, yechim qoralamasi, klon, tarjima va yozma javobga baho
// taklifi. Qoida: AI faqat QORALAMA yozadi yoki TAKLIF beradi — bankka faol
// savol, o'quvchiga yechim va natijaga ball faqat odam tasdiqlagandan keyin
// o'tadi.
//
// Model — Gemini (@google/genai). Kalit: markaz CRM ichida kiritgani
// (Organization.aiKaliti — routes/imtihonAI.js so'rov davomida `aiBilan` bilan
// beradi) yoki serverdagi GEMINI_API_KEY. Model nomi: GEMINI_MODEL (bo'lmasa
// standart; u topilmasa — zaxiradagi nomlar). Kalit yo'q bo'lsa hamma AI
// tugmalari "sozlanmagan" deydi, qolgan modul ishlayveradi.

import { AsyncLocalStorage } from 'node:async_hooks';
import { HARFLAR, turi, raqamniTozala, raqamlarTengmi, qiyinlikDarajasi } from './imtihon.js';

const STANDART_MODEL = 'gemini-2.5-flash';
// Model nomi eskirsa (Google eski modellarni o'chiradi) — navbatdagisi.
const ZAXIRA_MODELLAR = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

// So'rov davomidagi kalit (markaznikini route beradi) — har funksiyaga parametr qilib o'tkazmaslik uchun.
const kontekst = new AsyncLocalStorage();
/** `f` ni shu kalit bilan bajaradi (kalit bo'sh bo'lsa — serverdagisi). */
export const aiBilan = (kalit, f) => kontekst.run({ kalit: kalit || '' }, f);
export const serverKaliti = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
export const aiKaliti = () => kontekst.getStore()?.kalit || serverKaliti();
export const aiSozlanganmi = () => !!aiKaliti() || !!soxtaModel;
export const aiModel = () => process.env.GEMINI_MODEL || STANDART_MODEL;

const mijozlar = new Map();
let ishlaganModel = null;
// Sinov uchun: haqiqiy model o'rniga funksiya ({tizim, qismlar, sxema}) => obyekt.
let soxtaModel = null;
export function soxtaModelniQoy(f) { soxtaModel = f; }

async function mijozOl(kalit) {
  if (!mijozlar.has(kalit)) {
    // Kutubxona faqat AI chaqirilganda yuklanadi — serverning har bir ishga tushishi sekinlashmasin.
    const { GoogleGenAI } = await import('@google/genai');
    mijozlar.set(kalit, new GoogleGenAI({ apiKey: kalit }));
  }
  return mijozlar.get(kalit);
}

/**
 * Model chaqiruvi: nom topilmasa yoki model band bo'lsa — zaxiradagi modellar;
 * xatolar tushunarli matnga. `sorov` — obyekt yoki (model) => obyekt
 * (modelga qarab sozlama, masalan faqat 2.5 da ishlaydigan thinkingBudget).
 */
export async function modelgaSora(kalit, sorov) {
  const mijoz = await mijozOl(kalit);
  const nomlar = [...new Set([ishlaganModel, aiModel(), ...ZAXIRA_MODELLAR].filter(Boolean))];
  let oxirgi = null;
  let band = false;
  for (const model of nomlar) {
    try {
      const javob = await mijoz.models.generateContent({ model, ...(typeof sorov === 'function' ? sorov(model) : sorov) });
      ishlaganModel = model;
      return javob;
    } catch (e) {
      const matn = String(e?.message || e);
      // "User location is not supported" — model emas, hudud (tekshiruvi oldinroq turadi).
      if (/location is not supported|user location/i.test(matn)) throw new AiXato('AI xizmati bu hududda ishlamayapti', 503);
      if (/not found|404|is not supported/i.test(matn)) { oxirgi = e; continue; }
      if (/API key|API_KEY_INVALID|PERMISSION_DENIED|401|403/.test(matn)) throw new AiXato("AI kaliti qabul qilinmadi — kalitni tekshiring (aistudio.google.com/apikey)", 503);
      if (/429|RESOURCE_EXHAUSTED|quota/i.test(matn)) throw new AiXato("AI limiti tugadi — birozdan keyin qayta urinib ko'ring", 429);
      // Bepul kalitda tez-tez: "503 The model is overloaded" — boshqa model bo'sh bo'lishi mumkin.
      if (/503|UNAVAILABLE|overloaded|high demand/i.test(matn)) { oxirgi = e; band = true; continue; }
      throw new AiXato(`AI xizmati javob bermadi: ${matn.slice(0, 200)}`);
    }
  }
  if (band) throw new AiXato("AI hozir band (Google serverlari yuklangan) — bir daqiqadan keyin qayta urinib ko'ring", 503);
  throw new AiXato(`AI modeli topilmadi: ${String(oxirgi?.message || '').slice(0, 120)} (GEMINI_MODEL ni tekshiring)`, 503);
}

/** Kalit ishlaydimi — kichik so'rov bilan (saqlashdan oldin). Qaytaradi: ishlagan model nomi. */
export async function kalitniTekshir(kalit) {
  if (soxtaModel) return 'soxta';
  const k = String(kalit || '').trim();
  if (!k) throw new AiXato('Kalitni kiriting', 400);
  await modelgaSora(k, { contents: [{ role: 'user', parts: [{ text: 'Faqat OK deb javob bering.' }] }], config: { maxOutputTokens: 16, temperature: 0 } });
  return ishlaganModel;
}

export class AiXato extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

/** Modeldan sxemaga mos JSON so'rash. qismlar — [{text}] va [{inlineData}]. */
async function jsonSora({ tizim, qismlar, sxema, harorat = 0.2, maks = 8192 }) {
  if (soxtaModel) return soxtaModel({ tizim, qismlar, sxema });
  const kalit = aiKaliti();
  if (!kalit) throw new AiXato("AI yoqilmagan: administrator AI kalitini kiritishi kerak", 503);
  const javob = await modelgaSora(kalit, {
    contents: [{ role: 'user', parts: qismlar }],
    config: { systemInstruction: tizim, responseMimeType: 'application/json', responseJsonSchema: sxema, temperature: harorat, maxOutputTokens: maks },
  });
  const matn = String(javob?.text || '').trim();
  try {
    return JSON.parse(matn);
  } catch {
    throw new AiXato("AI javobi tushunarsiz chiqdi — qayta urinib ko'ring");
  }
}

/** data:image/...;base64,... → Gemini inlineData qismi. */
export function rasmQismi(dataUrl) {
  const m = /^data:(image\/(?:png|jpe?g|webp)|application\/pdf);base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!m) throw new AiXato("Rasm formati noto'g'ri (PNG, JPEG, WebP yoki PDF)", 400);
  return { inlineData: { mimeType: m[1].toLowerCase().replace('jpg', 'jpeg'), data: m[2] } };
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** AI ning oddiy matni (LaTeX $...$ bilan) → bank HTML i: bo'sh qator — yangi paragraf. */
export function matnniHtml(s) {
  const t = String(s ?? '').replace(/\r\n/g, '\n').trim();
  if (!t) return '';
  return t.split(/\n{2,}/).map(p => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
}

/** Bank HTML i → AI ga beriladigan oddiy matn (formulalar $...$ ichida qoladi). */
export function htmldanMatn(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<img[^>]*>/gi, '[rasm]')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const TILLAR = { uz: "o'zbek (lotin yozuvi)", ru: 'rus', en: 'ingliz' };
const LATEX = "Barcha matematik ifodalarni LaTeX da $...$ ichida yozing (alohida qatordagi formula — $$...$$). Kimyoviy formulalar ham $...$ ichida: $H_2SO_4$.";

// --- Savollar sxemasi ------------------------------------------------------

const SAVOL_SXEMA = {
  type: 'object',
  properties: {
    matn: { type: 'string', description: 'Savol matni, LaTeX $...$ bilan; variantlarsiz' },
    tur: { type: 'string', enum: ['yopiq', 'raqamli', 'yozma'] },
    variantlar: { type: 'array', items: { type: 'string' }, description: 'Yopiq savol variantlari (A, B, C... tartibida), harfsiz' },
    javob: { type: 'string', description: "Yopiq — to'g'ri variant harfi (A–F); raqamli — son (masalan 0,5 yoki 3/4); noma'lum bo'lsa bo'sh" },
    mavzu: { type: 'string' },
    qiyinlik: { type: 'integer', minimum: 1, maximum: 3, description: "1 — oson, 2 — o'rta, 3 — qiyin" },
    yechim: { type: 'string', description: "Qisqa yechim (bo'lsa), LaTeX bilan" },
    matnId: { type: 'string', description: "Umumiy matnga (o'qish matni, masala sharti) tegishli bo'lsa — o'sha matnning id si" },
    raqam: { type: 'string', description: "Materialdagi tartib raqami (masalan 12); bo'lmasa bo'sh" },
    javobManbasi: { type: 'string', enum: ['material', 'ai', 'yoq'], description: "material — javob materialda belgilangan; ai — o'zingiz yechdingiz; yoq — javob yo'q" },
  },
  required: ['matn', 'tur'],
};

// Guruhli savol (Milliy sertifikat): moslashtirish guruhi yoki qismli savol.
const GURUH_SXEMA = {
  type: 'object',
  properties: {
    tur: { type: 'string', enum: ['moslash', 'qismli'], description: "moslash — bir nechta savol BITTA umumiy javoblar ro'yxatidan javob oladi; qismli — bitta raqam ostida a), b) qismlari" },
    shart: { type: 'string', description: 'Hamma savol (qism) uchun umumiy shart, LaTeX $...$ bilan' },
    variantlar: { type: 'array', items: { type: 'string' }, description: "Faqat moslash: umumiy javoblar ro'yxati (A, B, C... tartibida), harfsiz" },
    savollar: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          matn: { type: 'string', description: 'Kichik savol (qism) matni, raqam va harfsiz' },
          javob: { type: 'string', description: "moslash — umumiy ro'yxatdagi to'g'ri javob harfi (A–F); qismli — qismning javobi (son yoki qisqa ifoda); noma'lum bo'lsa bo'sh" },
        },
        required: ['matn'],
      },
    },
    mavzu: { type: 'string' },
    qiyinlik: { type: 'integer', minimum: 1, maximum: 3 },
    raqam: { type: 'string', description: "Materialdagi (birinchi) tartib raqami; bo'lmasa bo'sh" },
    javobManbasi: { type: 'string', enum: ['material', 'ai', 'yoq'], description: "material — javoblar materialda belgilangan; ai — o'zingiz yechdingiz; yoq — javob yo'q" },
  },
  required: ['tur', 'shart', 'savollar'],
};
const GURUH_KORSATMA = "Milliy sertifikat kabi GURUHLI savollarni `savollar` ga EMAS, `guruhlar` ga yozing: (1) moslash — bitta umumiy shart, bir nechta kichik savol (masalan 33, 34, 35) va hammasi uchun BITTA javoblar ro'yxati (A–F; ortiqcha javoblar bo'ladi) — har kichik savolning javobi shu ro'yxatdagi harf; (2) qismli — bitta raqam ostida umumiy shart va a), b) qismlari, har qismning o'z javobi (son yoki qisqa ifoda).";

// Fayl turi (egasi, 2026-10-10: "fayl turi har doim bo'lsin: 4 variantli, MS-33-35, MS-36-45, yozma"):
// xodim faylda nima borligini o'zi aytadi — AI faqat shu tuzilmadagi savollarni oladi.
export const FAYL_TURLARI = ['yopiq', 'moslash', 'qismli', 'yozma'];
const FAYL_TURI_KORSATMASI = {
  yopiq: "MATERIAL TURI — oddiy test: har savolning variantlari bor (A, B, C, D...). Faqat shunday savollarni oling (tur: yopiq); variantsiz, javobi son bo'lgan savol uchrasa — tur: raqamli. Guruhli (bitta shartga bir nechta savol yoki a), b) qismli) va yechimi yoziladigan yozma savollarni tashlab keting; `guruhlar` bo'sh qolsin.",
  moslash: "MATERIAL TURI — Milliy sertifikatning 33–35-savollari kabi MOSLASHTIRISH guruhlari. Bunday GURUHLI savollarni `savollar` ga EMAS, `guruhlar` ga yozing (tur: moslash): bitta umumiy shart, bir nechta kichik savol (masalan 33, 34, 35) va hammasi uchun BITTA javoblar ro'yxati (A–F; ortiqcha javoblar bo'ladi) — har kichik savolning javobi shu ro'yxatdagi harf. Boshqa turdagi savollarni tashlab keting; `savollar` bo'sh qolsin.",
  qismli: "MATERIAL TURI — Milliy sertifikatning 36–45-savollari kabi QISMLI savollar. Bunday GURUHLI savollarni `savollar` ga EMAS, `guruhlar` ga yozing (tur: qismli): bitta raqam ostida umumiy shart va a), b) qismlari, har qismning o'z javobi (son yoki qisqa ifoda). Qismlarga bo'linmagan savollarni tashlab keting; `savollar` bo'sh qolsin.",
  yozma: "MATERIAL TURI — YOZMA masalalar (Milliy sertifikatning 41–43-savollari kabi): javobi to'liq yechim bilan yoziladi. Har masalani `savollar` ga yozing (tur: yozma), variantlar bo'sh. Materialda masalaning yechimi yoki javobi berilgan bo'lsa — `yechim` ga aynan ko'chiring (javobManbasi: material); berilmagan bo'lsa `yechim` ni bo'sh qoldiring — yechimni o'zingiz yozmang (masala keyingi bosqichda alohida yechiladi). Variantli va guruhli savollarni tashlab keting; `guruhlar` bo'sh qolsin.",
};
/** Skaner tekshira oladigan javob: butun, o'nli yoki oddiy kasr son. */
const SON_JAVOB = /^-?\d+([.,]\d+)?(\/\d+)?$/;

/**
 * AI qaytargan guruhli savollar — bank/guruhlar shakliga yaqin. Chalasi tashlanmaydi: `xato` bilan
 * qaytadi; javobi yo'q yoki AI o'zi yechgani — bankka qoralama bo'lib tushadi (`javobManbasi`).
 */
export function aiGuruhlariniTozala(royxat, { mavzu = '' } = {}) {
  return (Array.isArray(royxat) ? royxat : []).slice(0, 60).map((x) => {
    const tur = x?.tur === 'qismli' ? 'qismli' : 'moslash';
    const variantlar = tur === 'moslash'
      ? (Array.isArray(x?.variantlar) ? x.variantlar : []).map(v => String(v ?? '').replace(/^\s*[A-F][).:]\s*/i, '').trim()).filter(Boolean).slice(0, HARFLAR.length)
      : [];
    // Qismli savolda ko'pi bilan 4 qism (a–d): imtihon varag'i shungacha belgilaydi.
    const savollar = (Array.isArray(x?.savollar) ? x.savollar : []).slice(0, tur === 'qismli' ? 4 : 10).map((s) => {
      let javob = String(s?.javob ?? '').trim().slice(0, 40);
      if (tur === 'moslash') {
        javob = javob.toUpperCase().replace(/[^A-F]/g, '').slice(0, 1);
        if (javob && HARFLAR.indexOf(javob) >= variantlar.length) javob = '';
      }
      return { text: matnniHtml(String(s?.matn ?? '').replace(/^\s*(\d{1,3}\s*[.)](?!\d)|[a-d]\))\s*/i, '')), javob, son: tur === 'qismli' && SON_JAVOB.test(javob) };
    }).filter(s => htmldanMatn(s.text));
    const javobsiz = savollar.filter(s => !s.javob).length;
    const xatolar = [];
    if (!htmldanMatn(matnniHtml(x?.shart))) xatolar.push("umumiy shart yo'q");
    if (savollar.length < (tur === 'moslash' ? 2 : 1)) xatolar.push('savollar kam');
    if (tur === 'moslash' && variantlar.length < 2) xatolar.push("javoblar ro'yxati yo'q");
    return {
      tur, text: matnniHtml(x?.shart), variantlar: variantlar.map(matnniHtml), savollar,
      topic: String(x?.mavzu || mavzu || '').trim().slice(0, 200), difficulty: qiyinlikDarajasi(x?.qiyinlik || 2),
      raqam: String(x?.raqam ?? '').replace(/\D/g, '').slice(0, 6) || null,
      javobManbasi: javobsiz ? 'yoq' : x?.javobManbasi === 'material' ? 'material' : 'ai',
      xato: xatolar.join(', ') || null,
    };
  });
}

/**
 * AI qaytargan savollarni bank shakliga keltiradi. Noto'g'rilari tashlanmaydi —
 * `xato` bilan qaytadi (ko'rib chiqish ekranida tuzatiladi). Hammasi qoralama.
 */
export function aiSavollariniTozala(royxat, { fan = '', mavzu = '', til = 'uz', manba = 'AI import' } = {}) {
  return (Array.isArray(royxat) ? royxat : []).slice(0, 200).map((x) => {
    const tur = turi(x?.tur);
    const variantlar = tur === 'yopiq'
      ? (Array.isArray(x?.variantlar) ? x.variantlar : []).map(v => String(v ?? '').replace(/^\s*[A-F][).:]\s*/i, '').trim()).filter(Boolean).slice(0, HARFLAR.length)
      : [];
    let javob = String(x?.javob ?? '').trim();
    if (tur === 'yopiq') {
      javob = javob.toUpperCase().replace(/[^A-F]/g, '').slice(0, 1);
      if (javob && HARFLAR.indexOf(javob) >= variantlar.length) javob = '';
    } else if (tur === 'raqamli') {
      javob = raqamniTozala(javob);
    } else javob = '';
    const q = {
      subject: String(fan || '').trim().slice(0, 200),
      topic: String(x?.mavzu || mavzu || '').trim().slice(0, 200),
      type: tur,
      text: matnniHtml(x?.matn),
      options: tur === 'yopiq' ? variantlar.map(matnniHtml) : null,
      correctAnswer: javob,
      answers: null,
      difficulty: qiyinlikDarajasi(x?.qiyinlik || 2),
      language: ['uz', 'ru', 'en'].includes(til) ? til : 'uz',
      solution: x?.yechim ? matnniHtml(x.yechim) : null,
      solutionStatus: x?.yechim ? 'qoralama' : 'yoq',
      status: 'qoralama',
      source: manba,
      matnId: x?.matnId ? String(x.matnId).slice(0, 40) : null,
      // Bazaga yozilmaydi: javoblar kalitini (boshqa sahifadagi) raqam bo'yicha ulash uchun.
      raqam: String(x?.raqam ?? '').replace(/\D/g, '').slice(0, 6) || null,
      javobManbasi: javob ? (x?.javobManbasi === 'material' ? 'material' : 'ai') : null,
      // Yozma masalada kalit yo'q: yechim materialdan ko'chirilganmi (bo'lmasa keyin alohida, batafsil yechiladi).
      yechimManbasi: tur === 'yozma' && x?.yechim ? (x?.javobManbasi === 'material' ? 'material' : 'ai') : null,
    };
    const xatolar = [];
    if (!htmldanMatn(q.text)) xatolar.push("matn yo'q");
    if (tur === 'yopiq' && variantlar.length < 2) xatolar.push('variantlar kam');
    if (tur !== 'yozma' && !javob) xatolar.push("to'g'ri javob topilmadi");
    return { ...q, xato: xatolar.join(', ') || null };
  });
}

/**
 * Fayl (PDF sahifalari, rasm) yoki matndan savollarni ajratish. `mavzular` —
 * fanning bor mavzulari: AI har savolni shulardan biriga (mos kelmasa — yangi
 * qisqa nom) ajratadi; `mavzu` berilsa — hammasi shu mavzu. `til: 'auto'` —
 * materialning tili aniqlanadi. Qaytaradi: {savollar: [...bank shakli, xato,
 * raqam, javobManbasi], matnlar: [{id, sarlavha, matn}], kalit: [{raqam, javob}], til}.
 * `kalit` — materialdagi javoblar jadvali (u ko'pincha boshqa sahifada bo'ladi —
 * mijoz barcha qismlarni o'qigach raqam bo'yicha ulaydi).
 * `tur` — fayl turi (FAYL_TURLARI): faqat shu tuzilmadagi savollar olinadi; bo'sh — hammasi (eski xulq).
 * `mavzula: false` — mavzuga ajratilmaydi (xodim «Noma'lum» ni tanlagan: bankda o'zi taqsimlaydi).
 */
export async function savollarniAjrat({ matn = '', rasmlar = [], fan = '', mavzu = '', mavzular = [], til = 'uz', tur = '', mavzula = true }) {
  const royxat = (Array.isArray(mavzular) ? mavzular : []).map(m => String(m || '').trim()).filter(Boolean).slice(0, 150);
  const faylTuri = FAYL_TURLARI.includes(tur) ? tur : '';
  const guruhli = faylTuri === 'moslash' || faylTuri === 'qismli';
  const nima = guruhli ? 'guruh' : 'savol';
  const qismlar = [{
    text: [
      `Quyidagi test materialidan barcha savollarni ajratib bering. Fan: ${fan || "noma'lum"}${mavzu ? `, mavzu: ${mavzu}` : ''}.`,
      faylTuri ? FAYL_TURI_KORSATMASI[faylTuri] : '',
      guruhli ? ''
        : faylTuri === 'yozma' ? 'Har masalaning matni va materialdagi tartib raqami.'
        : "Har savolning matni, turi (yopiq — variantli; raqamli — javobi son; yozma — ochiq javob), variantlari (A, B, C... tartibida, harflarsiz), materialdagi tartib raqami va to'g'ri javobi.",
      faylTuri === 'yozma' ? ''
        : "To'g'ri javob materialda (belgi, kalit) bo'lsa — o'shani oling (javobManbasi: material); bo'lmasa o'zingiz yechib toping (javobManbasi: ai), ishonchingiz komil bo'lmasa bo'sh qoldiring.",
      faylTuri === 'yozma' ? ''
        : "Materialda javoblar jadvali (kalit: \"1-B, 2-C...\") bo'lsa — uni `kalit` ga ham yozing (raqam va javob), savollar boshqa sahifada bo'lsa ham.",
      !mavzula || mavzu ? ''
        : royxat.length
          ? `Har ${nima === 'guruh' ? 'guruhga' : 'savolga'} mavzu bering — quyidagi ro'yxatdan eng mosini, nomini aynan shunday yozing; hech biri mos kelmasa — qisqa yangi mavzu nomi:\n${royxat.map(m => `- ${m}`).join('\n')}`
          : `Har ${nima === 'guruh' ? 'guruhga' : 'savolga'} qisqa mavzu nomi bering (maktab darsligidagidek, masalan: Kasrlar, Harakat masalalari).`,
      "Qiyinlik — o'quvchi uchun: 1 — bir qadamli, oddiy; 2 — o'rtacha; 3 — ko'p qadamli yoki chuqur bilim talab qiladi.",
      guruhli ? '' : "Bir nechta savolga umumiy matn (o'qish matni, jadval, masala sharti) bo'lsa — uni `matnlar` ga bir marta yozing va savollarda `matnId` bilan bog'lang.",
      faylTuri ? '' : GURUH_KORSATMA,
      LATEX,
      // «[rasm]» — chizma o'rni: keyin AI uni shu sahifa (yoki Word'dagi N-rasm) bo'yicha vektor qilib chizadi.
      "Savol matnini o'zgartirmang va tarjima qilmang — asl tilida qoldiring. Rasm yoki chizmani so'z bilan tasvirlamang: o'rniga [rasm] deb yozing (materialda «[rasm N]» belgisi turgan bo'lsa — uni raqami bilan aynan ko'chiring).",
      til === 'auto' ? "`til` ga materialning tilini yozing: uz, ru yoki en." : '',
      matn ? `\nMATERIAL:\n${String(matn).slice(0, 60000)}` : '',
    ].filter(Boolean).join('\n'),
  }, ...rasmlar.slice(0, 8).map(rasmQismi)];
  const javob = await jsonSora({
    tizim: "Siz o'quv markazi uchun test savollarini raqamlashtiruvchi yordamchisiz. Faqat berilgan materialdagi savollarni oling, o'zingizdan savol qo'shmang.",
    qismlar,
    sxema: {
      type: 'object',
      properties: {
        savollar: { type: 'array', items: SAVOL_SXEMA },
        guruhlar: { type: 'array', items: GURUH_SXEMA },
        matnlar: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, sarlavha: { type: 'string' }, matn: { type: 'string' } }, required: ['id', 'matn'] } },
        kalit: { type: 'array', items: { type: 'object', properties: { raqam: { type: 'string' }, javob: { type: 'string' } }, required: ['raqam', 'javob'] } },
        til: { type: 'string', enum: ['uz', 'ru', 'en'] },
      },
      required: ['savollar'],
    },
    maks: 32768,
  });
  const tilNatija = til === 'auto' ? (['uz', 'ru', 'en'].includes(javob?.til) ? javob.til : 'uz') : til;
  // Fayl turi tanlangan bo'lsa — natijada faqat shu tur qoladi (model boshqasini ham qaytarib yuborsa).
  const xomSavollar = guruhli ? [] : (Array.isArray(javob?.savollar) ? javob.savollar : [])
    .filter(x => (faylTuri === 'yopiq' ? x?.tur !== 'yozma' : true))
    .map(x => (faylTuri === 'yozma' ? { ...x, tur: 'yozma' } : x));
  const xomGuruhlar = !faylTuri ? javob?.guruhlar
    : guruhli ? (Array.isArray(javob?.guruhlar) ? javob.guruhlar : []).filter(x => !x?.tur || x.tur === faylTuri).map(x => ({ ...x, tur: faylTuri }))
    : [];
  return {
    savollar: aiSavollariniTozala(xomSavollar, { fan, mavzu, til: tilNatija }),
    guruhlar: aiGuruhlariniTozala(xomGuruhlar, { mavzu }),
    matnlar: (Array.isArray(javob?.matnlar) ? javob.matnlar : []).slice(0, 50).map(m => ({
      id: String(m?.id || '').slice(0, 40), sarlavha: String(m?.sarlavha || '').slice(0, 200), matn: matnniHtml(m?.matn),
    })).filter(m => m.id && m.matn),
    kalit: (Array.isArray(javob?.kalit) ? javob.kalit : []).slice(0, 500).map(k => ({
      raqam: String(k?.raqam ?? '').replace(/\D/g, '').slice(0, 6), javob: String(k?.javob ?? '').trim().slice(0, 40),
    })).filter(k => k.raqam && k.javob),
    til: tilNatija,
  };
}

/** Matnni solishtirish uchun iz: teglar, bo'shliqlar va katta-kichik harf farqisiz. */
export const matnIzi = (html) => htmldanMatn(html).toLowerCase().replace(/\s+/g, '');

/** Savolni AI ga tushunarli matnga aylantirish (variantlar harflari bilan). */
function savolMatni(q, variantlar) {
  let s = htmldanMatn(q.text);
  if (q.passage?.text) s = `Umumiy matn:\n${htmldanMatn(q.passage.text)}\n\nSavol:\n${s}`;
  if (variantlar?.length) s += '\n' + variantlar.map((v, i) => `${HARFLAR[i]}) ${htmldanMatn(v)}`).join('\n');
  return s;
}

/** AI javobi kalit bilan mosmi (yopiq — harf, raqamli — son; yozma — tekshirilmaydi). */
export function javobMosmi(q, aiJavobi) {
  const a = String(aiJavobi ?? '').trim();
  if (!a) return null;
  if (q.type === 'yopiq') {
    const kalit = String(q.correctAnswer || '').toUpperCase().split('').filter(h => HARFLAR.includes(h));
    return kalit.length ? kalit.includes(a.toUpperCase().replace(/[^A-F]/g, '').slice(0, 1)) : null;
  }
  if (q.type === 'raqamli') {
    const kalitlar = [q.correctAnswer, ...(Array.isArray(q.answers) ? q.answers : [])].filter(Boolean);
    return kalitlar.length ? kalitlar.some(k => raqamlarTengmi(k, a)) : null;
  }
  return null;
}

/** Yechim qoralamasi va AI ning o'z javobi (kalitga mosligi tekshiriladi). */
export async function yechimYoz(q, variantlar) {
  const tilNomi = TILLAR[q.language] || TILLAR.uz;
  const j = await jsonSora({
    tizim: "Siz tajribali o'qituvchisiz. Savolni bosqichma-bosqich, o'quvchiga tushunarli qilib yeching.",
    // Yozma masalada yechim — baholash mezoni: batafsil yoziladi (boshqa turlarda — qisqa).
    qismlar: [{ text: `${savolMatni(q, variantlar)}\n\nYechimni ${tilNomi} tilida yozing${q.type === 'yozma' ? `. ${BATAFSIL_YECHIM}` : ', qisqa va aniq, har qadam yangi qatordan.'} ${LATEX}\n"javob" ga: yopiq savolda — to'g'ri variant harfi, raqamli savolda — son, yozma savolda — qisqa yakuniy javob.` }],
    sxema: { type: 'object', properties: { yechim: { type: 'string' }, javob: { type: 'string' } }, required: ['yechim', 'javob'] },
    harorat: 0.1,
    ...(q.type === 'yozma' ? { maks: 16384 } : {}),
  });
  const yechim = q.type === 'yozma' ? yechimgaJavob(j?.yechim, j?.javob, q.language) : j?.yechim;
  return { yechim: matnniHtml(yechim), aiJavobi: String(j?.javob ?? '').trim().slice(0, 60), mos: javobMosmi(q, j?.javob) };
}

/** Savolning to'g'ri javobi (yopiq — to'g'ri variant matni) — javoblarni solishtirish uchun. */
function javobQiymati(q, variantlar) {
  if (q.type === 'yopiq') {
    const i = HARFLAR.indexOf(String(q.correctAnswer || '').trim().toUpperCase().slice(0, 1));
    return i >= 0 ? htmldanMatn((variantlar || [])[i] || '') : '';
  }
  return q.type === 'raqamli' ? String(q.correctAnswer || '') : '';
}

const TUR_NOMI = { yopiq: 'yopiq, variantli', raqamli: 'raqamli javobli', yozma: 'yozma' };

/**
 * O'xshash savollar (klonlar). `usul`: 'sonlar' — matn va tuzilish o'sha, faqat
 * sonlar (kerak bo'lsa nomlar) boshqa, javob ham boshqa; 'vaziyat' — vaziyat
 * ham boshqa, ko'nikma o'sha. `tur` — yangilarining turi (bo'sh — aslidagidek;
 * masalan kitobdagi masaladan variantli test). Asl yoki bir-biri bilan bir xil
 * matnlilari tashlanadi, javobi asliniki bilan tengi `aslBilanBir`.
 * `tekshir` — keyin ALOHIDA so'rovda kalitsiz yechtirib `tekshirildi` qo'yiladi
 * (false bo'lsa buni mijoz /api/ai/tekshir bilan o'zi qiladi: so'rovlar qisqa).
 * Qaytaradi: bank shaklidagi savollar (saqlanmaydi).
 */
export async function klonlarYasa(q, variantlar, { soni = 3, usul = 'vaziyat', tur = null, tekshir = true, daraja = null, rasmli = false } = {}) {
  const n = Math.min(10, Math.max(1, parseInt(soni) || 3));
  const t = ['yopiq', 'raqamli', 'yozma'].includes(tur) ? tur : q.type;
  const tilNomi = TILLAR[q.language] || TILLAR.uz;
  const sonlar = usul === 'sonlar';
  const j = await jsonSora({
    tizim: daraja
      ? "Siz test tuzuvchi metodistsiz. Asl savol bilan bir xil mavzu va ko'nikmani tekshiradigan, lekin qiyinligi boshqa YANGI savollar tuzasiz."
      : sonlar
        ? "Siz test tuzuvchi metodistsiz. Berilgan masalaning xuddi o'zini, faqat boshqa sonlar bilan tuzasiz: har yangi masalaning javobi boshqa chiqadi."
        : "Siz test tuzuvchi metodistsiz. Asl savol bilan bir xil ko'nikmani, bir xil qiyinlikda tekshiradigan YANGI savollar tuzasiz.",
    qismlar: [{
      text: [
        `Asl savol (${TUR_NOMI[q.type] || TUR_NOMI.yopiq}):`,
        savolMatni(q, variantlar),
        q.type !== 'yozma' && q.correctAnswer ? `To'g'ri javob: ${q.correctAnswer}` : '',
        daraja
          ? `\n${n} ta yangi savol tuzing: mavzu va ko'nikma o'sha, sonlar${sonlar ? '' : ', nomlar va vaziyat'} boshqa. To'g'ri javob asl masaladagidan va bir-biridan farq qilsin.`
          : sonlar
          ? `\n${n} ta yangi masala tuzing: matni, tuzilishi va yechish usuli asl masaladagidek, faqat sonlar (kerak bo'lsa ism va narsa nomlari) boshqa. To'g'ri javob asl masaladagidan va bir-biridan farq qilsin. Sonlarni shunday tanlangki, masala ma'noli va yechimi toza chiqsin (butun son yoki oddiy kasr).`
          : `\n${n} ta yangi savol tuzing: sonlar, nomlar va vaziyat boshqa, yechish usuli va qiyinlik o'sha. Matnni so'zma-so'z takrorlamang.`,
        // `rasmli` — asl masalaning chizmasi bor: yangilari ham chizmali bo'ladi (mijoz keyin «[rasm]» o'rniga vektor chizdiradi).
        rasmli ? `Asl masalada chizma bor. ${CHIZMALI}` : CHIZMASIZ,
        t !== q.type ? `Yangi savollar ${TUR_NOMI[t]} bo'lsin.` : '',
        // `daraja` — asl savoldan osonroq yoki qiyinroq variant.
        daraja === 'oson' ? "MUHIM: yangi masalalar asl masaladan bir pog'ona OSONROQ bo'lsin — yechimda bir qadam kam yoki sonlari qulayroq; mavzu va ko'nikma o'sha." : '',
        daraja === 'qiyin' ? "MUHIM: yangi masalalar asl masaladan bir pog'ona QIYINROQ bo'lsin — yechimga yana bir qadam yoki qo'shimcha shart qo'shing; mavzu va ko'nikma o'sha, maktab dasturidan chiqmang." : '',
        t === 'yopiq' ? `Har savolda ${Math.max(4, t === q.type ? variantlar.length : 0)} ta variant, bittasi to'g'ri; noto'g'rilari o'quvchi odatda qiladigan xatolardan chiqsin. To'g'ri javob harfi har xil bo'lsin.` : '',
        t === 'raqamli' ? "Javob aniq son bo'lsin (butun yoki o'nli kasr, masalan 2,5); variant kerak emas." : '',
        // Yozma masalada kalit yo'q — yechimning o'zi mezon: batafsil yoziladi.
        t === 'yozma' ? `Til: ${tilNomi}. ${LATEX} Har masalaning \`yechim\` iga: ${BATAFSIL_YECHIM} Oxirgi qatorda «${JAVOB_SOZI[q.language] || JAVOB_SOZI.uz}: …».`
          : `Til: ${tilNomi}. ${LATEX} Har savolga qisqa yechim yozing.`,
      ].filter(Boolean).join('\n'),
    }],
    sxema: { type: 'object', properties: { savollar: { type: 'array', items: SAVOL_SXEMA } }, required: ['savollar'] },
    harorat: sonlar ? 0.5 : 0.7,
    maks: t === 'yozma' ? 32768 : 16384,
  });
  const izlar = new Set([matnIzi(q.text)]);
  const asliJavob = javobQiymati(q, variantlar);
  const klonlar = aiSavollariniTozala((j?.savollar || []).slice(0, n).map(x => ({ ...x, tur: t, mavzu: q.topic, qiyinlik: q.difficulty, ...(t === 'yozma' ? { yechim: yechimgaJavob(x?.yechim, x?.javob, q.language) } : {}) })), {
    fan: q.subject, mavzu: q.topic, til: q.language || 'uz', manba: 'AI klon',
  }).filter((k) => {
    if (k.xato && t !== 'yozma') return false;
    const iz = matnIzi(k.text);
    if (izlar.has(iz)) return false;
    izlar.add(iz);
    return true;
  });
  klonlar.forEach((k) => { k.aslBilanBir = !!asliJavob && raqamlarTengmi(asliJavob, javobQiymati(k, k.options)); });
  if (!klonlar.length || !tekshir) return klonlar;
  const natija = await savollarniTekshir(klonlar.map(k => ({ ...k, variantlar: k.options })));
  klonlar.forEach((k, i) => { k.tekshirildi = natija[i].tekshirildi; });
  return klonlar;
}

// --- Chizmali masalalar (egasi, 2026-10-10: «o'xshash savol tuzganda — vector qilib rasm tuzsin») ---
// Yangi masalaning chizmasini model so'z bilan tasvirlamaydi: matnda «[rasm]» belgisini qoldiradi, mijoz
// esa uni vektor qilib chizdiradi (lib/imtihonRasm.js). Chizma faqat MATN (va asl masala rasmi) bo'yicha
// chiziladi — shuning uchun chizmadagi hamma berilganlar matnda ham bo'lishi shart.
const CHIZMALI = "Yangi masalalar ham chizmali bo'lsin: har birining matnida chizma turadigan joyga [rasm] deb yozing (chizmani so'z bilan tasvirlamang, «rasmda ko'rsatilgan» deyish mumkin). Chizma keyin shu matn bo'yicha chiziladi, shuning uchun chizmadagi HAMMA berilganlar (shakl turi, uzunliklar, burchaklar, nuqta va tomon nomlari, o'qlardagi qiymatlar) matnning o'zida aniq yozilgan bo'lsin.";
const CHIZMASIZ = "Masala rasmga (chizma, grafik) tayansa — kerakli ma'lumotni matnning o'ziga yozing: yangi masala rasmsiz yechilsin.";
// Namunasiz, faqat mavzu bo'yicha tuzishda chizmaga ruxsat tejamkor: har chizma — AI ga yana 1–2 so'rov.
const CHIZMA_MAVZUDA = "Bu mavzuda ba'zi masalalar chizmasiz tushunarsiz bo'ladi. FAQAT chizmasiz tushunib bo'lmaydigan masalaning matniga, chizma turadigan joyga [rasm] deb yozing — ko'pi bilan masalalarning yarmida; qolganlari chizmasiz, to'liq matn bilan bo'lsin. [rasm] qo'yilgan masalada ham chizmadagi HAMMA berilganlar (shakl turi, uzunliklar, burchaklar, nuqta va tomon nomlari) matnda aniq yozilsin — chizma keyin shu matn bo'yicha chiziladi.";
const CHIZMA_YOQ = "Masalalar chizmasiz, to'liq matn bilan bo'lsin: [rasm] yozmang, rasmga tayanmang.";
// Chizma kerak bo'ladigan mavzular: geometriya, grafik va sxemalar (o'zbek, rus, ingliz atamalari).
// So'z boshidan qidiriladi: «biografik», «geografiya», «rasmiy» kabi so'zlar adashtirmasin; chizmaga aloqasi yo'q
// iboralar ham chiqarilgan («geometrik progressiya», «kub ildiz», «koordinatsion birikma», «mavzu doirasida», «aylanadi»).
const RASMLI_MAVZU = /geometri(?!k\s+progress)|planimetri|stereometri|uchburchak|to['ʻʼ’‘`]?rtburchak|ko['ʻʼ’‘`]?pburchak|\baylana(?:lar\w*|ning|ni|ga|da|dan)?\b|\bdoira(?!si)|trapetsiya|parallelogramm|\bromb|piramida|prizma|silindr|\bkonus|\bshar(?:lar\w*|ning|ni|ga|da|dan)?\b|\bkub(?:lar\w*|ning|ni|ga|da|dan)?\b(?!\s+ildiz)|\bvektor|koordinat(?!sion)|\bgrafi[kg]|diagramma|\bchizma|\bsxema|\brasm(?:li|lar|da|dagi)?\b|elektr zanjir|\blinza|ko['ʻʼ’‘`]?zgu|геометр(?!ическ\S*\s+прогресс)|планиметр|стереометр|треугольн|окружност|(?<![а-яё])график|диаграмм|чертеж|чертёж|рисун|(?<![а-яё])схем|geometry|\btriangle|\bcircle|\bgraph|\bdiagram/i;
// Ustoz chizma KERAK EMASligini yozgan («chizmasiz», «rasmli bo'lmasin», «без рисунков») — mavzu qanday bo'lsa ham chizmasiz.
const RASMSIZ_TALAB = /(?:chizma|rasm|grafi[kg]|sxema)\w*siz\b|(?:chizma|rasm|grafi[kg]|sxema)\w*\s+(?:bo['ʻʼ’‘`]?lmasin|kerak\s+emas|qo['ʻʼ’‘`]?shma|qo['ʻʼ’‘`]?yma|yo['ʻʼ’‘`]?q)|без\s+(?:рисунк|чертеж|чертёж|график|схем)|without\s+(?:figures?|diagrams?|pictures?|graphs?)|\bno\s+(?:figures?|diagrams?|pictures?)/i;
/**
 * Mavzu (va ustoz talabi) chizma talab qiladimi — namunasiz tuzishda «[rasm]» ga ruxsat berish uchun.
 * Ataylab tor: faqat geometriya, grafik va sxema so'zlari uchrasa.
 */
export const mavzuRasmlimi = (...matnlar) => {
  const matn = matnlar.filter(Boolean).join(' ');
  return !RASMSIZ_TALAB.test(matn) && RASMLI_MAVZU.test(matn);
};

const DARAJA_NOMI = ['oson', "o'rta", 'qiyin'];
/** Qiyinlik so'rovda: asosiy uch daraja; `darajaNomi` — foydalanuvchining o'z darajasi ("Juda qiyin") bo'lsa — u ham. */
const qiyinlikMatni = (d, darajaNomi) => (darajaNomi ? `«${String(darajaNomi).slice(0, 60)}» (uch pog'onali shkalada — ${DARAJA_NOMI[d - 1]})` : DARAJA_NOMI[d - 1]);

/**
 * Namuna (ixtiyoriy) so'rovda: `oxshash` — 'sonlar' (namunaning o'zi, faqat sonlar boshqa), 'vaziyat'
 * (yechish usuli o'sha, vaziyat boshqa); bo'sh — namuna faqat uslub va daraja uchun.
 */
function namunaKorsatmasi(namuna, oxshash, rasmli = false) {
  if (!namuna) return '';
  const rasmsiz = rasmli ? `Namunada chizma bor. ${CHIZMALI}` : CHIZMASIZ.replace('Masala', 'Namuna');
  if (oxshash === 'sonlar') return `Namuna:\n${namuna}\n\nYangilari shu namunaning o'zidek bo'lsin: matni, tuzilishi va yechish usuli o'sha, faqat sonlar (kerak bo'lsa ism va narsa nomlari) boshqa. To'g'ri javob namunadagidan va bir-biridan farq qilsin. ${rasmsiz}`;
  if (oxshash === 'vaziyat') return `Namuna:\n${namuna}\n\nYangilari shu namunaga o'xshash bo'lsin: yechish usuli va qiyinligi o'sha, vaziyat, nomlar va sonlar boshqa. Matnni so'zma-so'z takrorlamang. ${rasmsiz}`;
  return `Namuna (shu uslub va darajada tuzing, o'zini takrorlamang):\n${namuna}${rasmli ? `\n\nNamunada chizma bor. ${CHIZMALI}` : ''}`;
}

/**
 * Namunasiz (faqat mavzu bo'yicha) tuzishda chizma qoidasi: `rasmli === 'mavzu'` — mavzu chizma talab qiladi
 * (mavzuRasmlimi): faqat zarur masalada «[rasm]»; aks holda — chizmasiz. Namuna bo'lsa — namunaKorsatmasi hal qiladi.
 */
const chizmaQoidasi = (namuna, rasmli) => (namuna ? '' : rasmli === 'mavzu' ? CHIZMA_MAVZUDA : rasmli === true ? CHIZMALI : CHIZMA_YOQ);

// Yozma masala yechimi (egasi, 2026-10-10: "uni yechish kerak bo'ladi, batafsil izohlar bilan chiqish kerak").
const BATAFSIL_YECHIM = "Yechimni BATAFSIL, bosqichma-bosqich yozing: avval bir jumlada nima berilgani va nima so'ralayotgani; keyin har qadam alohida xatboshida, tartib raqami bilan («1-qadam.», «2-qadam.» ...) — har qadamda nima qilinayotgani va NIMA UCHUN (qaysi qoida, formula yoki teorema ishlatilgani) so'z bilan izohlansin, oraliq hisoblar tashlab ketilmasin; qadamlar orasida bo'sh qator qoldiring. O'quvchi yechimni mustaqil o'qib tushunadigan bo'lsin.";
const JAVOB_SOZI = { uz: 'Javob', ru: 'Ответ', en: 'Answer' };

/** Yechim matni oxirida yakuniy javob qatori bo'lsin («Javob: …») — model qo'ymagan bo'lsa qo'shiladi. */
function yechimgaJavob(yechim, javob, til = 'uz') {
  const y = String(yechim ?? '').trim();
  const j = String(javob ?? '').trim().slice(0, 300);
  if (!y || !j) return y;
  const oxiri = y.split('\n').filter(s => s.trim()).slice(-2).join('\n');
  return /(javob|ответ|answer)\s*[:—-]/i.test(oxiri) ? y : `${y}\n\n${JAVOB_SOZI[til] || JAVOB_SOZI.uz}: ${j}`;
}

/**
 * Mavzu bo'yicha yangi savollar: ustozning talabi (`tavsif`) va namunasi (`namuna`) ixtiyoriy.
 * `tur` — 'yopiq', 'raqamli' yoki 'yozma' (batafsil yechimi bilan; bir so'rovda 5 tagacha).
 * `bor` — shu so'rovlar davomida allaqachon tuzilgan savollar (takrorlanmasin).
 */
export async function savollarniTuz({ fan = '', mavzu = '', tavsif = '', namuna = '', oxshash = '', rasmli = false, soni = 5, tur = 'yopiq', qiyinlik = 2, darajaNomi = '', til = 'uz', bor = [] }) {
  const t = ['yopiq', 'raqamli', 'yozma'].includes(tur) ? tur : 'yopiq';
  const n = Math.min(t === 'yozma' ? 5 : 10, Math.max(1, parseInt(soni) || 5));
  const d = Math.min(3, Math.max(1, parseInt(qiyinlik) || 2));
  const j = await jsonSora({
    tizim: "Siz maktab va abituriyent testlarini tuzuvchi tajribali metodistsiz. Savollaringiz aniq, bir ma'noli, o'quv dasturiga mos va to'g'ri javobi bitta bo'ladi.",
    qismlar: [{
      text: [
        `Fan: ${fan}. Mavzu: ${mavzu}.`,
        tavsif ? `Ustozning talabi: ${tavsif}` : '',
        namunaKorsatmasi(namuna, oxshash, rasmli === true),
        chizmaQoidasi(namuna, rasmli),
        `\n${n} ta yangi ${TUR_NOMI[t]} savol tuzing. Qiyinligi: ${qiyinlikMatni(d, darajaNomi)}. Savollar bir-birini takrorlamasin${namuna && oxshash ? '' : ' va mavzuning turli jihatlarini qamrasin'}. Sonlarni shunday tanlangki, yechimi toza chiqsin.`,
        bor.length ? `Bu savollar allaqachon tuzilgan — ularni takrorlamang:\n${bor.map(b => `- ${b}`).join('\n')}` : '',
        t === 'yopiq' ? "Har savolda 4 ta variant, bittasi to'g'ri; noto'g'rilari o'quvchi odatda qiladigan xatolardan chiqsin. To'g'ri javob harfi har xil o'rinda bo'lsin." : '',
        t === 'raqamli' ? "Javob aniq son bo'lsin (butun yoki o'nli kasr, masalan 2,5); variant kerak emas." : '',
        t === 'yozma' ? `Bular YOZMA masalalar (Milliy sertifikatning 41–43-savollari kabi): o'quvchi to'liq yechimini yozadi; variant kerak emas. Har masalaning \`yechim\` iga: ${BATAFSIL_YECHIM} Oxirgi qatorda «${JAVOB_SOZI[til] || JAVOB_SOZI.uz}: …».` : '',
        `Til: ${TILLAR[til] || TILLAR.uz}. ${LATEX}${t === 'yozma' ? '' : ' Har savolga qisqa yechim yozing.'}`,
      ].filter(Boolean).join('\n'),
    }],
    sxema: { type: 'object', properties: { savollar: { type: 'array', items: SAVOL_SXEMA } }, required: ['savollar'] },
    harorat: 0.8,
    maks: t === 'yozma' ? 32768 : 16384,
  });
  const izlar = new Set();
  return aiSavollariniTozala((j?.savollar || []).slice(0, n).map(x => ({ ...x, tur: t, mavzu, qiyinlik: d, ...(t === 'yozma' ? { yechim: yechimgaJavob(x?.yechim, x?.javob, til) } : {}) })), { fan, mavzu, til, manba: 'AI tuzdi' })
    .filter((k) => {
      if (k.xato) return false;
      const iz = matnIzi(k.text);
      if (!iz || izlar.has(iz)) return false;
      izlar.add(iz);
      return true;
    });
}

/**
 * Mavzu bo'yicha yangi GURUHLI savollar (Milliy sertifikat uslubi): `tur` — 'moslash' (umumiy shart,
 * 3 ta savol, 6 ta umumiy javob) yoki 'qismli' (umumiy shart, a va b qismlari). Bir so'rovda 5 tagacha.
 */
export async function guruhlarniTuz({ fan = '', mavzu = '', tavsif = '', namuna = '', oxshash = '', rasmli = false, soni = 2, tur = 'moslash', qiyinlik = 2, darajaNomi = '', til = 'uz' }) {
  const n = Math.min(5, Math.max(1, parseInt(soni) || 2));
  const t = tur === 'qismli' ? 'qismli' : 'moslash';
  const d = Math.min(3, Math.max(1, parseInt(qiyinlik) || 2));
  const j = await jsonSora({
    tizim: "Siz Milliy sertifikat imtihoni uslubida savol tuzuvchi tajribali metodistsiz. Savollaringiz aniq, bir ma'noli va to'g'ri javobi bitta bo'ladi.",
    qismlar: [{
      text: [
        `Fan: ${fan}. Mavzu: ${mavzu}.`,
        tavsif ? `Ustozning talabi: ${tavsif}` : '',
        namunaKorsatmasi(namuna, oxshash, rasmli === true),
        chizmaQoidasi(namuna, rasmli),
        rasmli ? "Guruhli savolda [rasm] belgisi faqat umumiy shart (`shart`) matnida turadi — kichik savollarda emas." : '',
        t === 'moslash'
          ? `\n${n} ta MOSLASHTIRISH guruhi tuzing (tur: moslash). Har birida: bitta umumiy shart (masala vaziyati), shu shart bo'yicha 3 ta kichik savol va hammasi uchun BITTA umumiy javoblar ro'yxati — 6 ta javob (A–F): uchtasi to'g'ri javoblar, uchtasi o'quvchi odatda qiladigan xatolardan chiqqan chalg'ituvchilar. Har kichik savolning javobi — ro'yxatdagi harf; bitta harf ikki savolga to'g'ri kelmasin; to'g'ri javoblar ro'yxatda aralash o'rinda tursin.`
          : `\n${n} ta QISMLI savol tuzing (tur: qismli). Har birida: bitta umumiy shart va ikkita qism — a) va b); b) qism a) dan qiyinroq bo'lsin. Har qismning javobi aniq son bo'lsin (butun yoki o'nli kasr, masalan 2,5).`,
        `Qiyinligi: ${qiyinlikMatni(d, darajaNomi)}. Guruhlar bir-birini takrorlamasin. Sonlarni shunday tanlangki, yechimi toza chiqsin. javobManbasi: ai.`,
        `Til: ${TILLAR[til] || TILLAR.uz}. ${LATEX}`,
      ].filter(Boolean).join('\n'),
    }],
    sxema: { type: 'object', properties: { guruhlar: { type: 'array', items: GURUH_SXEMA } }, required: ['guruhlar'] },
    harorat: 0.8,
    maks: 16384,
  });
  // Javoblarni model o'zi tuzgan — manbasi doim 'ai' (model nima deb yozmasin).
  return aiGuruhlariniTozala((Array.isArray(j?.guruhlar) ? j.guruhlar : []).slice(0, n).map(x => ({ ...x, tur: t, mavzu, qiyinlik: d, javobManbasi: 'ai' })), { mavzu }).filter(g => !g.xato);
}

/**
 * Mustaqil tekshiruv: AI savollarni kalitni ko'rmay yechadi. Har biriga
 * {tekshirildi: true | false | null (yozma yoki kalit yo'q), aiJavobi}.
 * Kalitsiz savolga aiJavobi — taklif (masalan rasmdan o'qilgan, javobi yo'q masala).
 */
export async function savollarniTekshir(royxat) {
  const natija = royxat.map(() => ({ tekshirildi: null, aiJavobi: '' }));
  const yechiladi = royxat.map((q, i) => ({ q, i })).filter(x => x.q.type !== 'yozma');
  if (!yechiladi.length) return natija;
  const r = await jsonSora({
    tizim: "Siz diqqatli o'qituvchisiz. Har savolni mustaqil yeching.",
    qismlar: [{ text: yechiladi.map((x, k) => `${k + 1}-savol:\n${savolMatni(x.q, x.q.variantlar || x.q.options || [])}`).join('\n\n') + `\n\nHar savolga faqat yakuniy javob: yopiq savolda variant harfi, raqamli savolda son. Tartib o'sha.` }],
    sxema: { type: 'object', properties: { javoblar: { type: 'array', items: { type: 'string' } } }, required: ['javoblar'] },
    harorat: 0,
  });
  yechiladi.forEach((x, k) => {
    const a = String(r?.javoblar?.[k] ?? '').trim().slice(0, 60);
    const mos = javobMosmi(x.q, a);
    natija[x.i] = {
      tekshirildi: mos === null ? null : mos,
      aiJavobi: x.q.type === 'yopiq' ? a.toUpperCase().replace(/[^A-F]/g, '').slice(0, 1) : raqamniTozala(a).replace('.', ','),
    };
  });
  return natija;
}

/**
 * Yozma masalalarni yechadi — har biriga BATAFSIL yechim (qadamma-qadam, har qadam izohi bilan) va yakuniy
 * javob. Bir so'rovda 4 tagacha (yechimlar uzun — so'rov qisqa qolsin). `rasmlar` — masalalar olingan
 * sahifalar: matnda [rasm] bo'lsa, model chizmani o'sha sahifadan ko'radi. Qaytadi: har masalaga
 * {yechim (HTML; bo'sh — yechilmadi), javob}. Yechim bankka QORALAMA bo'lib tushadi — ustoz tasdiqlaydi.
 */
export async function yozmalarniYech(royxat, { fan = '', rasmlar = [] } = {}) {
  const savollar = (Array.isArray(royxat) ? royxat : []).slice(0, 4);
  const natija = savollar.map(() => ({ yechim: '', javob: '' }));
  if (!savollar.length) return natija;
  const til = ['uz', 'ru', 'en'].includes(savollar[0]?.language) ? savollar[0].language : 'uz';
  const r = await jsonSora({
    tizim: "Siz tajribali o'qituvchisiz. Yozma masalalarni to'liq va xatosiz yechasiz, yechimni o'quvchiga tushuntirib yozasiz.",
    qismlar: [{
      text: [
        fan ? `Fan: ${fan}.` : '',
        // Ustoz yakuniy javobni bergan bo'lsa (Word shablonidagi «Javob» ustuni) — yechim shunga olib kelishi kerak.
        savollar.map((q, k) => `${k + 1}-masala:\n${savolMatni(q, [])}${q.correctAnswer ? `\n(Ustoz bergan yakuniy javob: ${q.correctAnswer})` : ''}`).join('\n\n'),
        `\nHar masalani yeching. ${BATAFSIL_YECHIM}`,
        savollar.some(q => q.correctAnswer) ? "Ustoz bergan yakuniy javob bo'lsa — yechim shu javobga olib kelishi kerak; o'zingiz boshqa javob chiqarsangiz, yechim boshida «Diqqat: berilgan javob bilan mos kelmadi» deb yozing va o'z yechimingizni qoldiring." : '',
        `Yechimning oxirgi qatorida «${JAVOB_SOZI[til]}: …» bo'lsin; "javob" ga shu yakuniy javobni qisqa yozing.`,
        rasmlar.length ? "Masala matnidagi [rasm] — ilova qilingan sahifadagi shu masalaning chizmasi: undagi ma'lumotlardan foydalaning." : "Masala matnida [rasm] bo'lib, chizmasiz yechib bo'lmasa — \"yechim\" ni bo'sh qoldiring.",
        `Til: ${TILLAR[til]}. ${LATEX}`,
        `Javob: "yechimlar" — aynan ${savollar.length} ta, har birida "n" (masala raqami, 1 dan), "yechim" va "javob".`,
      ].filter(Boolean).join('\n'),
    }, ...rasmlar.slice(0, 3).map(rasmQismi)],
    sxema: {
      type: 'object',
      properties: { yechimlar: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, yechim: { type: 'string' }, javob: { type: 'string' } }, required: ['n', 'yechim'] } } },
      required: ['yechimlar'],
    },
    harorat: 0.1,
    maks: 32768,
  });
  // Yechim masalaga raqami (`n`) bo'yicha bog'lanadi; raqam bo'lmasa — o'rni bo'yicha (soni mos kelsagina).
  const l = Array.isArray(r?.yechimlar) ? r.yechimlar : [];
  const raqamli = l.every(x => Number.isInteger(x?.n) && x.n >= 1 && x.n <= savollar.length) && new Set(l.map(x => x.n)).size === l.length;
  if (!raqamli && l.length !== savollar.length) return natija;
  l.forEach((x, k) => {
    const javob = String(x?.javob ?? '').trim().slice(0, 300);
    natija[raqamli ? x.n - 1 : k] = { yechim: matnniHtml(yechimgaJavob(x?.yechim, javob, til)), javob };
  });
  return natija;
}

/**
 * Tayyor savollarni (Word jadvali) fan mavzulariga ajratadi: har savolga bitta mavzu nomi.
 * Bankdagi mavzulardan biri mos kelsa — aynan o'sha nom; bo'lmasa — qisqa yangi nom.
 */
export async function savollarniMavzula({ fan = '', mavzular = [], savollar = [] }) {
  if (!savollar.length) return [];
  const r = await jsonSora({
    tizim: 'Siz maktab va abituriyent testlarini mavzularga ajratuvchi metodistsiz.',
    qismlar: [{
      text: [
        `Fan: ${fan}.`,
        mavzular.length ? `Bankdagi mavzular:\n${mavzular.map(m => `- ${m}`).join('\n')}` : "Bankda hali mavzu yo'q.",
        "Har savolga bitta mavzu bering. Savol bankdagi mavzulardan biriga mos kelsa — o'sha mavzuning nomini AYNAN shunday yozing. Hech biri mos kelmasa — darslikdagidek qisqa (1–4 so'z) yangi mavzu nomi (o'zbek tilida, lotin yozuvida); bir xil mavzudagi savollarga bir xil nom bering.",
        `SAVOLLAR:\n${savollar.map((s, k) => `${k + 1}) ${s}`).join('\n')}`,
        `Javob: "mavzular" — aynan ${savollar.length} ta nom, savollar tartibida.`,
      ].join('\n\n'),
    }],
    sxema: { type: 'object', properties: { mavzular: { type: 'array', items: { type: 'string' } } }, required: ['mavzular'] },
    harorat: 0,
  });
  // Nomlar savolga o'rni bo'yicha bog'lanadi: soni mos kelmasa (model bittasini tashlab ketgan)
  // qolganlari boshqa savolga tushib qoladi — bunday javob ishlatilmaydi (savollar «Noma'lum» mavzusida qoladi).
  if (!Array.isArray(r?.mavzular) || r.mavzular.length !== savollar.length) return savollar.map(() => '');
  return r.mavzular.map(m => String(m ?? '').replace(/\s+/g, ' ').trim().slice(0, 120));
}

/** Tarjima: matn, variantlar va yechim; variantlar tartibi saqlanadi (kalit o'zgarmaydi). */
export async function tarjimaQil(q, variantlar, til) {
  const tilNomi = TILLAR[til];
  if (!tilNomi) throw new AiXato("Til noto'g'ri", 400);
  const j = await jsonSora({
    tizim: "Siz o'quv materiallarini tarjima qiluvchi mutaxassissiz. Fan atamalarini o'sha tildagi maktab darsliklaridagidek ishlating.",
    qismlar: [{
      text: [
        `Quyidagi test savolini ${tilNomi} tiliga tarjima qiling. Formulalar ($...$) va sonlar o'zgarmasin. Variantlar soni va tartibi aynan saqlansin.`,
        `SAVOL:\n${htmldanMatn(q.text)}`,
        variantlar.length ? `VARIANTLAR:\n${variantlar.map((v, i) => `${HARFLAR[i]}) ${htmldanMatn(v)}`).join('\n')}` : '',
        q.solution ? `YECHIM:\n${htmldanMatn(q.solution)}` : '',
      ].filter(Boolean).join('\n\n'),
    }],
    sxema: {
      type: 'object',
      properties: { matn: { type: 'string' }, variantlar: { type: 'array', items: { type: 'string' } }, yechim: { type: 'string' }, mavzu: { type: 'string' } },
      required: ['matn'],
    },
    harorat: 0.2,
  });
  const tv = Array.isArray(j?.variantlar) ? j.variantlar : [];
  if (variantlar.length && tv.length !== variantlar.length) throw new AiXato("Tarjimada variantlar soni o'zgardi — qayta urinib ko'ring");
  return {
    text: matnniHtml(j?.matn),
    options: variantlar.length ? tv.map(v => matnniHtml(String(v).replace(/^\s*[A-F][).:]\s*/i, ''))) : null,
    solution: q.solution && j?.yechim ? matnniHtml(j.yechim) : null,
    topic: String(j?.mavzu || '').trim().slice(0, 200),
  };
}

/**
 * Yozma javob: varaqdagi kesilgan rasmni o'qib, mezon (yechim) bo'yicha ball
 * TAKLIF qiladi (0 dan maksimumgacha, 0,5 qadam). Ballni operator qo'yadi.
 */
export async function yozmaBaho({ savol, maks, mezon, rasm }) {
  const j = await jsonSora({
    tizim: "Siz imtihonda yozma ishlarni tekshiruvchi adolatli o'qituvchisiz. Faqat rasmda ko'ringan yozuvni baholang; o'qib bo'lmasa — shuni ayting.",
    qismlar: [
      { text: [
        `Savol:\n${htmldanMatn(savol)}`,
        mezon ? `To'g'ri yechim / baholash mezoni:\n${htmldanMatn(mezon)}` : "Mezon berilmagan — to'g'ri yechimni o'zingiz aniqlang.",
        `Eng yuqori ball: ${maks}. Qisman to'g'ri yechimga qisman ball bering (0,5 qadam bilan).`,
        "Rasmdagi o'quvchi javobini o'qing (`oqildi`), ball qo'ying va qisqa izoh yozing: nima to'g'ri, nima xato.",
      ].join('\n\n') },
      rasmQismi(rasm),
    ],
    sxema: {
      type: 'object',
      properties: { oqildi: { type: 'string' }, ball: { type: 'number' }, izoh: { type: 'string' }, oqibBolmadi: { type: 'boolean' } },
      required: ['ball', 'izoh'],
    },
    harorat: 0,
  });
  const m = Number(maks) || 0;
  const ball = Math.max(0, Math.min(m, Math.round((Number(j?.ball) || 0) * 2) / 2));
  return { ball, maks: m, izoh: String(j?.izoh || '').slice(0, 1000), oqildi: String(j?.oqildi || '').slice(0, 2000), oqibBolmadi: !!j?.oqibBolmadi };
}
