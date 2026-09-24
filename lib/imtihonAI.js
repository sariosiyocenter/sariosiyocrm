// Imtihon moduli uchun AI (3-bosqich, docs/IMTIHON_PLAN.md): savollarni
// fayldan ajratish, yechim qoralamasi, klon, tarjima va yozma javobga baho
// taklifi. Qoida: AI faqat QORALAMA yozadi yoki TAKLIF beradi — bankka faol
// savol, o'quvchiga yechim va natijaga ball faqat odam tasdiqlagandan keyin
// o'tadi.
//
// Model — Gemini (@google/genai). Kalit: GEMINI_API_KEY (Vercel muhitida),
// model nomi: GEMINI_MODEL (bo'lmasa quyidagi standart). Kalit yo'q bo'lsa
// hamma AI tugmalari "sozlanmagan" deb javob beradi, qolgan modul ishlayveradi.

import { HARFLAR, turi, raqamniTozala, raqamlarTengmi } from './imtihon.js';

const STANDART_MODEL = 'gemini-2.5-flash';

export const aiKaliti = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
export const aiSozlanganmi = () => !!aiKaliti() || !!soxtaModel;
export const aiModel = () => process.env.GEMINI_MODEL || STANDART_MODEL;

let mijoz = null;
// Sinov uchun: haqiqiy model o'rniga funksiya ({tizim, qismlar, sxema}) => obyekt.
let soxtaModel = null;
export function soxtaModelniQoy(f) { soxtaModel = f; }

export class AiXato extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

/** Modeldan sxemaga mos JSON so'rash. qismlar — [{text}] va [{inlineData}]. */
async function jsonSora({ tizim, qismlar, sxema, harorat = 0.2, maks = 8192 }) {
  if (soxtaModel) return soxtaModel({ tizim, qismlar, sxema });
  if (!aiKaliti()) throw new AiXato("AI sozlanmagan: serverda GEMINI_API_KEY yo'q", 503);
  // Kutubxona faqat AI chaqirilganda yuklanadi — serverning har bir ishga tushishi sekinlashmasin.
  if (!mijoz) {
    const { GoogleGenAI } = await import('@google/genai');
    mijoz = new GoogleGenAI({ apiKey: aiKaliti() });
  }
  let javob;
  try {
    javob = await mijoz.models.generateContent({
      model: aiModel(),
      contents: [{ role: 'user', parts: qismlar }],
      config: { systemInstruction: tizim, responseMimeType: 'application/json', responseJsonSchema: sxema, temperature: harorat, maxOutputTokens: maks },
    });
  } catch (e) {
    const matn = String(e?.message || e);
    if (/API key|PERMISSION_DENIED|401|403/.test(matn)) throw new AiXato("AI kaliti qabul qilinmadi (GEMINI_API_KEY ni tekshiring)", 503);
    if (/not found|404/i.test(matn)) throw new AiXato(`AI modeli topilmadi: ${aiModel()} (GEMINI_MODEL ni tekshiring)`, 503);
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(matn)) throw new AiXato("AI limiti tugadi — birozdan keyin qayta urinib ko'ring", 429);
    throw new AiXato(`AI xizmati javob bermadi: ${matn.slice(0, 200)}`);
  }
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
    qiyinlik: { type: 'integer', minimum: 1, maximum: 5 },
    yechim: { type: 'string', description: "Qisqa yechim (bo'lsa), LaTeX bilan" },
    matnId: { type: 'string', description: "Umumiy matnga (o'qish matni, masala sharti) tegishli bo'lsa — o'sha matnning id si" },
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
      difficulty: Math.min(5, Math.max(1, parseInt(x?.qiyinlik) || 2)),
      language: ['uz', 'ru', 'en'].includes(til) ? til : 'uz',
      solution: x?.yechim ? matnniHtml(x.yechim) : null,
      solutionStatus: x?.yechim ? 'qoralama' : 'yoq',
      status: 'qoralama',
      source: manba,
      matnId: x?.matnId ? String(x.matnId).slice(0, 40) : null,
    };
    const xatolar = [];
    if (!htmldanMatn(q.text)) xatolar.push("matn yo'q");
    if (tur === 'yopiq' && variantlar.length < 2) xatolar.push('variantlar kam');
    if (tur !== 'yozma' && !javob) xatolar.push("to'g'ri javob topilmadi");
    return { ...q, xato: xatolar.join(', ') || null };
  });
}

/**
 * Fayl (PDF sahifalari, rasm) yoki matndan savollarni ajratish. Qaytaradi:
 * {savollar: [...bank shakli, xato], matnlar: [{id, sarlavha, matn}]}.
 */
export async function savollarniAjrat({ matn = '', rasmlar = [], fan = '', mavzu = '', til = 'uz' }) {
  const qismlar = [{
    text: [
      `Quyidagi test materialidan barcha savollarni ajratib bering. Fan: ${fan || "noma'lum"}${mavzu ? `, mavzu: ${mavzu}` : ''}.`,
      "Har savolning matni, turi (yopiq — variantli; raqamli — javobi son; yozma — ochiq javob), variantlari (A, B, C... tartibida, harflarsiz) va to'g'ri javobi.",
      "To'g'ri javob materialda (kalit, belgi, javoblar jadvali) bo'lsa — o'shani oling; bo'lmasa o'zingiz yechib toping, ishonchingiz komil bo'lmasa bo'sh qoldiring.",
      "Bir nechta savolga umumiy matn (o'qish matni, jadval, masala sharti) bo'lsa — uni `matnlar` ga bir marta yozing va savollarda `matnId` bilan bog'lang.",
      LATEX,
      "Savol matnini o'zgartirmang va tarjima qilmang — asl tilida qoldiring. Rasm yoki chizmani so'z bilan tasvirlamang: o'rniga [rasm] deb yozing.",
      matn ? `\nMATERIAL:\n${String(matn).slice(0, 60000)}` : '',
    ].join('\n'),
  }, ...rasmlar.slice(0, 8).map(rasmQismi)];
  const javob = await jsonSora({
    tizim: "Siz o'quv markazi uchun test savollarini raqamlashtiruvchi yordamchisiz. Faqat berilgan materialdagi savollarni oling, o'zingizdan savol qo'shmang.",
    qismlar,
    sxema: {
      type: 'object',
      properties: {
        savollar: { type: 'array', items: SAVOL_SXEMA },
        matnlar: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, sarlavha: { type: 'string' }, matn: { type: 'string' } }, required: ['id', 'matn'] } },
      },
      required: ['savollar'],
    },
    maks: 32768,
  });
  return {
    savollar: aiSavollariniTozala(javob?.savollar, { fan, mavzu, til }),
    matnlar: (Array.isArray(javob?.matnlar) ? javob.matnlar : []).slice(0, 50).map(m => ({
      id: String(m?.id || '').slice(0, 40), sarlavha: String(m?.sarlavha || '').slice(0, 200), matn: matnniHtml(m?.matn),
    })).filter(m => m.id && m.matn),
  };
}

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

/**
 * Klonlar: shu ko'nikmani tekshiradigan, lekin boshqa son va vaziyatli yangi
 * savollar. Keyin ALOHIDA so'rovda AI ularni kalitni ko'rmay yechadi —
 * javoblari mos kelgani "tekshirildi". Qaytaradi: bank shaklidagi savollar.
 */
export async function klonlarYasa(q, variantlar, soni = 3) {
  const n = Math.min(5, Math.max(1, parseInt(soni) || 3));
  const tilNomi = TILLAR[q.language] || TILLAR.uz;
  const j = await jsonSora({
    tizim: "Siz test tuzuvchi metodistsiz. Asl savol bilan bir xil ko'nikmani, bir xil qiyinlikda tekshiradigan YANGI savollar tuzasiz.",
    qismlar: [{
      text: [
        `Asl savol (${q.type === 'yopiq' ? 'yopiq, variantli' : q.type === 'raqamli' ? 'raqamli javobli' : 'yozma'}):`,
        savolMatni(q, variantlar),
        q.type !== 'yozma' ? `To'g'ri javob: ${q.correctAnswer}` : '',
        `\n${n} ta yangi savol tuzing: sonlar, nomlar va vaziyat boshqa, yechish usuli va qiyinlik o'sha. Matnni so'zma-so'z takrorlamang.`,
        q.type === 'yopiq' ? `Har savolda ${Math.max(4, variantlar.length)} ta variant, bittasi to'g'ri; noto'g'rilari o'quvchi odatda qiladigan xatolardan chiqsin. To'g'ri javob harfi har xil bo'lsin.` : '',
        q.type === 'raqamli' ? "Javob aniq son bo'lsin (butun yoki o'nli kasr, masalan 2,5)." : '',
        `Til: ${tilNomi}. ${LATEX} Har savolga qisqa yechim yozing.`,
      ].filter(Boolean).join('\n'),
    }],
    sxema: { type: 'object', properties: { savollar: { type: 'array', items: SAVOL_SXEMA } }, required: ['savollar'] },
    harorat: 0.7,
  });
  const klonlar = aiSavollariniTozala((j?.savollar || []).slice(0, n).map(x => ({ ...x, tur: q.type, mavzu: q.topic, qiyinlik: q.difficulty })), {
    fan: q.subject, mavzu: q.topic, til: q.language || 'uz', manba: 'AI klon',
  }).filter(k => !k.xato || q.type === 'yozma');
  if (!klonlar.length) return [];
  // Mustaqil tekshiruv: kalitsiz yechtiramiz.
  if (q.type !== 'yozma') {
    const t = await jsonSora({
      tizim: "Siz diqqatli o'qituvchisiz. Har savolni mustaqil yeching.",
      qismlar: [{ text: klonlar.map((k, i) => `${i + 1}-savol:\n${savolMatni(k, k.options)}`).join('\n\n') + `\n\nHar savolga faqat yakuniy javob: yopiq savolda variant harfi, raqamli savolda son. Tartib o'sha.` }],
      sxema: { type: 'object', properties: { javoblar: { type: 'array', items: { type: 'string' } } }, required: ['javoblar'] },
      harorat: 0,
    });
    klonlar.forEach((k, i) => { k.tekshirildi = javobMosmi(k, t?.javoblar?.[i]) === true; });
  } else klonlar.forEach(k => { k.tekshirildi = null; });
  return klonlar;
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
