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
 */
export async function savollarniAjrat({ matn = '', rasmlar = [], fan = '', mavzu = '', mavzular = [], til = 'uz' }) {
  const royxat = (Array.isArray(mavzular) ? mavzular : []).map(m => String(m || '').trim()).filter(Boolean).slice(0, 150);
  const qismlar = [{
    text: [
      `Quyidagi test materialidan barcha savollarni ajratib bering. Fan: ${fan || "noma'lum"}${mavzu ? `, mavzu: ${mavzu}` : ''}.`,
      "Har savolning matni, turi (yopiq — variantli; raqamli — javobi son; yozma — ochiq javob), variantlari (A, B, C... tartibida, harflarsiz), materialdagi tartib raqami va to'g'ri javobi.",
      "To'g'ri javob materialda (belgi, kalit) bo'lsa — o'shani oling (javobManbasi: material); bo'lmasa o'zingiz yechib toping (javobManbasi: ai), ishonchingiz komil bo'lmasa bo'sh qoldiring.",
      "Materialda javoblar jadvali (kalit: \"1-B, 2-C...\") bo'lsa — uni `kalit` ga ham yozing (raqam va javob), savollar boshqa sahifada bo'lsa ham.",
      !mavzu && royxat.length
        ? `Har savolga mavzu bering — quyidagi ro'yxatdan eng mosini, nomini aynan shunday yozing; hech biri mos kelmasa — qisqa yangi mavzu nomi:\n${royxat.map(m => `- ${m}`).join('\n')}`
        : !mavzu ? "Har savolga qisqa mavzu nomi bering (maktab darsligidagidek, masalan: Kasrlar, Harakat masalalari)." : '',
      "Qiyinlik — o'quvchi uchun: 1 — bir qadamli, oddiy; 2 — o'rtacha; 3 — ko'p qadamli yoki chuqur bilim talab qiladi.",
      "Bir nechta savolga umumiy matn (o'qish matni, jadval, masala sharti) bo'lsa — uni `matnlar` ga bir marta yozing va savollarda `matnId` bilan bog'lang.",
      LATEX,
      "Savol matnini o'zgartirmang va tarjima qilmang — asl tilida qoldiring. Rasm yoki chizmani so'z bilan tasvirlamang: o'rniga [rasm] deb yozing.",
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
        matnlar: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, sarlavha: { type: 'string' }, matn: { type: 'string' } }, required: ['id', 'matn'] } },
        kalit: { type: 'array', items: { type: 'object', properties: { raqam: { type: 'string' }, javob: { type: 'string' } }, required: ['raqam', 'javob'] } },
        til: { type: 'string', enum: ['uz', 'ru', 'en'] },
      },
      required: ['savollar'],
    },
    maks: 32768,
  });
  const tilNatija = til === 'auto' ? (['uz', 'ru', 'en'].includes(javob?.til) ? javob.til : 'uz') : til;
  return {
    savollar: aiSavollariniTozala(javob?.savollar, { fan, mavzu, til: tilNatija }),
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
    qismlar: [{ text: `${savolMatni(q, variantlar)}\n\nYechimni ${tilNomi} tilida yozing, qisqa va aniq, har qadam yangi qatordan. ${LATEX}\n"javob" ga: yopiq savolda — to'g'ri variant harfi, raqamli savolda — son, yozma savolda — qisqa yakuniy javob.` }],
    sxema: { type: 'object', properties: { yechim: { type: 'string' }, javob: { type: 'string' } }, required: ['yechim', 'javob'] },
    harorat: 0.1,
  });
  return { yechim: matnniHtml(j?.yechim), aiJavobi: String(j?.javob ?? '').trim().slice(0, 60), mos: javobMosmi(q, j?.javob) };
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
export async function klonlarYasa(q, variantlar, { soni = 3, usul = 'vaziyat', tur = null, tekshir = true, daraja = null } = {}) {
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
        "Masala rasmga (chizma, grafik) tayansa — kerakli ma'lumotni matnning o'ziga yozing: yangi masala rasmsiz yechilsin.",
        t !== q.type ? `Yangi savollar ${TUR_NOMI[t]} bo'lsin.` : '',
        // `daraja` — asl savoldan osonroq yoki qiyinroq variant.
        daraja === 'oson' ? "MUHIM: yangi masalalar asl masaladan bir pog'ona OSONROQ bo'lsin — yechimda bir qadam kam yoki sonlari qulayroq; mavzu va ko'nikma o'sha." : '',
        daraja === 'qiyin' ? "MUHIM: yangi masalalar asl masaladan bir pog'ona QIYINROQ bo'lsin — yechimga yana bir qadam yoki qo'shimcha shart qo'shing; mavzu va ko'nikma o'sha, maktab dasturidan chiqmang." : '',
        t === 'yopiq' ? `Har savolda ${Math.max(4, t === q.type ? variantlar.length : 0)} ta variant, bittasi to'g'ri; noto'g'rilari o'quvchi odatda qiladigan xatolardan chiqsin. To'g'ri javob harfi har xil bo'lsin.` : '',
        t === 'raqamli' ? "Javob aniq son bo'lsin (butun yoki o'nli kasr, masalan 2,5); variant kerak emas." : '',
        `Til: ${tilNomi}. ${LATEX} Har savolga qisqa yechim yozing.`,
      ].filter(Boolean).join('\n'),
    }],
    sxema: { type: 'object', properties: { savollar: { type: 'array', items: SAVOL_SXEMA } }, required: ['savollar'] },
    harorat: sonlar ? 0.5 : 0.7,
    maks: 16384,
  });
  const izlar = new Set([matnIzi(q.text)]);
  const asliJavob = javobQiymati(q, variantlar);
  const klonlar = aiSavollariniTozala((j?.savollar || []).slice(0, n).map(x => ({ ...x, tur: t, mavzu: q.topic, qiyinlik: q.difficulty })), {
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

/**
 * Mavzu bo'yicha yangi savollar: ustozning talabi (`tavsif`) va namunasi (`namuna`) ixtiyoriy.
 * `bor` — shu so'rovlar davomida allaqachon tuzilgan savollar (takrorlanmasin).
 */
export async function savollarniTuz({ fan = '', mavzu = '', tavsif = '', namuna = '', soni = 5, tur = 'yopiq', qiyinlik = 2, til = 'uz', bor = [] }) {
  const n = Math.min(10, Math.max(1, parseInt(soni) || 5));
  const t = ['yopiq', 'raqamli'].includes(tur) ? tur : 'yopiq';
  const d = Math.min(3, Math.max(1, parseInt(qiyinlik) || 2));
  const j = await jsonSora({
    tizim: "Siz maktab va abituriyent testlarini tuzuvchi tajribali metodistsiz. Savollaringiz aniq, bir ma'noli, o'quv dasturiga mos va to'g'ri javobi bitta bo'ladi.",
    qismlar: [{
      text: [
        `Fan: ${fan}. Mavzu: ${mavzu}.`,
        tavsif ? `Ustozning talabi: ${tavsif}` : '',
        namuna ? `Namuna (shu uslub va darajada tuzing, o'zini takrorlamang):\n${namuna}` : '',
        `\n${n} ta yangi ${TUR_NOMI[t]} savol tuzing. Qiyinligi: ${['oson', "o'rta", 'qiyin'][d - 1]}. Savollar bir-birini takrorlamasin va mavzuning turli jihatlarini qamrasin. Sonlarni shunday tanlangki, yechimi toza chiqsin.`,
        bor.length ? `Bu savollar allaqachon tuzilgan — ularni takrorlamang:\n${bor.map(b => `- ${b}`).join('\n')}` : '',
        t === 'yopiq' ? "Har savolda 4 ta variant, bittasi to'g'ri; noto'g'rilari o'quvchi odatda qiladigan xatolardan chiqsin. To'g'ri javob harfi har xil o'rinda bo'lsin." : '',
        t === 'raqamli' ? "Javob aniq son bo'lsin (butun yoki o'nli kasr, masalan 2,5); variant kerak emas." : '',
        `Til: ${TILLAR[til] || TILLAR.uz}. ${LATEX} Har savolga qisqa yechim yozing.`,
      ].filter(Boolean).join('\n'),
    }],
    sxema: { type: 'object', properties: { savollar: { type: 'array', items: SAVOL_SXEMA } }, required: ['savollar'] },
    harorat: 0.8,
    maks: 16384,
  });
  const izlar = new Set();
  return aiSavollariniTozala((j?.savollar || []).slice(0, n).map(x => ({ ...x, tur: t, mavzu, qiyinlik: d })), { fan, mavzu, til, manba: 'AI tuzdi' })
    .filter((k) => {
      if (k.xato) return false;
      const iz = matnIzi(k.text);
      if (!iz || izlar.has(iz)) return false;
      izlar.add(iz);
      return true;
    });
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
  // qolganlari boshqa savolga tushib qoladi — bunday javob ishlatilmaydi (savollar «Aralash»da qoladi).
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
