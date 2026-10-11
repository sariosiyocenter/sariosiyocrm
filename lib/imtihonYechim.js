// Savol yechimi (AI) — bank kartasidagi «Yechimni ko'rish» / «Yechimni o'zgartirish»
// (egasi, 2026-10-10). Yechim qo'lda yozilmaydi: ustoz yechim QANDAY bo'lishini o'z
// so'zi bilan aytadi (usul, uzunlik, daraja, til…), yechimni AI yozadi. Aytmasa —
// yozma savol (Milliy sertifikat 41–43) batafsil, har qadam izohi bilan; qolgan turlar
// qisqa, lekin to'liq yechiladi.
//
// Bankdagi to'g'ri javob AI ga beriladi va yechim shu javobga kelishi kerak. AI boshqa
// javobga kelsa — u o'z javobini aytadi va bu yerda kalit bilan solishtiriladi: ekranda
// ogohlantirish chiqadi, yechim jim saqlanmaydi. Hech narsa bazaga yozilmaydi — ustoz
// natijani ko'rib, o'zi saqlaydi (routes/imtihonYechim.js).
//
// Model chaqiruvi, kalit va xatolar — lib/imtihonAI.js dagi umumiy qismlar orqali.

import { HARFLAR, MOSLASH_QATOR, MOSLASH_USTUN, guruhSavolimi, moslashQatorlari, raqamlarTengmi, raqamQiymati } from './imtihon.js';
import { AiXato, aiKaliti, aiSozlanganmi, htmldanMatn, modelgaSora, rasmQismi } from './imtihonAI.js';

/** Ustoz talabining eng ko'p uzunligi (belgi). */
export const KORSATMA_MAX = 600;
/** Yechim matnining eng ko'p uzunligi (savol matni bilan bir xil chegara). */
export const YECHIM_MAX = 20000;
/** AI ga beriladigan rasmlar soni (savol, variantlar va umumiy shartdagi hammasi birga). */
export const RASM_SONI_MAX = 4;
const RASM_HAJMI_MAX = 3 * 1024 * 1024;
const RASM_KUTISH_MS = 6000;
const RASM_TURLARI = ['image/png', 'image/jpeg', 'image/webp'];
const ESKI_YECHIM_MAX = 6000;

const TILLAR = { uz: "o'zbek (lotin yozuvi)", ru: 'rus', en: 'ingliz' };
const LATEX = "Barcha matematik ifodalarni LaTeX da $...$ ichida yozing (alohida qatordagi formula — $$...$$, bitta qatorda). Kimyoviy formulalar ham $...$ ichida: $H_2SO_4$.";

/** Sukutdagi uslub: yozma savol — batafsil, qolganlari — qisqa va to'liq. */
export const sukutUslubi = (tur) => (tur === 'yozma' ? 'batafsil' : 'qisqa');
const USLUB = {
  batafsil: "Batafsil yeching: har qadamni alohida yozing va har qadamda nima qilinayotganini hamda NEGA shunday qilinayotganini (qaysi qoida, formula yoki teorema) izohlang. Oraliq hisoblarni tashlab ketmang. O'quvchi shu yechimni o'qib, masalani o'zi yecha oladigan bo'lsin.",
  qisqa: "Qisqa, lekin to'liq yeching: kerakli qadamlar tartib bilan, ortiqcha gapsiz.",
};
const TUR_TAVSIFI = {
  yopiq: "variantli — bitta to'g'ri javob",
  raqamli: 'javobi son',
  moslash: "moslashtirish — chap ustun (A–D) bandlariga o'ng ustundan (P–T) mos keladiganlari tanlanadi",
  juft: "umumiy javoblar ro'yxatidan (A–F) bitta javob tanlanadi",
  qismli: 'bitta masalaning qismi — javobi yoziladi',
  yozma: "yozma — o'quvchi to'liq yechim yozadi",
};
const JAVOB_SHAKLI = {
  yopiq: "faqat to'g'ri variantning lotin harfi (A–F)",
  juft: "faqat to'g'ri javobning lotin harfi (A–F)",
  raqamli: "faqat son (o'nli kasr yoki oddiy kasr; birliksiz)",
  qismli: 'faqat qisqa yakuniy javob (son yoki ifoda; birliksiz)',
  moslash: "chap ustunning har qatori uchun o'ng ustun harflari, qatorlar «|» bilan: masalan PQ|R|S|T",
  yozma: 'qisqa yakuniy javob',
};

// --- Sinov uchun soxta model ------------------------------------------------

let soxta = null;
/** Sinov uchun: haqiqiy model o'rniga funksiya ({tizim, qismlar, sxema}) => obyekt. */
export function soxtaYechimniQoy(f) { soxta = f; }
/** Yechim so'rasa bo'ladimi: kalit bor (markazniki yoki serverniki) yoki soxta model qo'yilgan. */
export const yechimAiTayyormi = () => !!soxta || aiSozlanganmi();

async function jsonSora({ tizim, qismlar, sxema }) {
  if (soxta) return soxta({ tizim, qismlar, sxema });
  const kalit = aiKaliti();
  if (!kalit) throw new AiXato('AI yoqilmagan: administrator AI kalitini kiritishi kerak', 503);
  const javob = await modelgaSora(kalit, {
    contents: [{ role: 'user', parts: qismlar }],
    // Batafsil yechim uzun chiqadi; 2.5 modellarda "o'ylash" ham shu chegaraga kiradi.
    config: { systemInstruction: tizim, responseMimeType: 'application/json', responseJsonSchema: sxema, temperature: 0.2, maxOutputTokens: 16384 },
  });
  try {
    return JSON.parse(String(javob?.text || '').trim());
  } catch {
    throw new AiXato("AI javobi tushunarsiz chiqdi — qayta urinib ko'ring");
  }
}

// --- Matn va HTML -----------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Yechim bormi (bo'sh paragraf — yo'q hisoblanadi). */
export const yechimBormi = (html) => !!htmldanMatn(html);

/** Bitta qator: **qalin** → <b>, "# sarlavha" → qalin, "* band" → "• band"; formulalar ($...$) ga tegilmaydi. */
function qatorHtml(qator) {
  const sarlavha = /^#{1,6}\s+/.test(qator);
  const formulalar = [];
  // Qator boshidagi "- " ga tegilmaydi: u manfiy ishora bo'lishi ham mumkin.
  const s = qator.replace(/^#{1,6}\s+/, '').replace(/^\*\s+/, '• ')
    .replace(/\$\$[^$]+\$\$|\$[^$\n]+\$/g, (f) => `\u0000${formulalar.push(f) - 1}\u0000`);
  const html = esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\u0000(\d+)\u0000/g, (_, i) => esc(formulalar[Number(i)]));
  return sarlavha ? `<b>${html}</b>` : html;
}

/**
 * AI ning oddiy matni (LaTeX $...$ bilan) → bank HTML i: bo'sh qator — yangi paragraf,
 * qator — <br>. AI ba'zan Markdown aralashtiradi — qalin va sarlavha belgilari
 * tozalanadi; $$...$$ ichidagi qator uzilishlari olinadi (formula bitta matn bo'lagida
 * turishi kerak, aks holda ekranda chizilmaydi).
 */
export function yechimniHtml(matn) {
  const t = String(matn ?? '').replace(/\r\n?/g, '\n').trim()
    .replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '')
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => `$$${f.replace(/\s*\n\s*/g, ' ').trim()}$$`);
  if (!t.trim()) return '';
  return t.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${p.split('\n').map(q => qatorHtml(q.trim())).join('<br>')}</p>`).join('');
}

/**
 * Saqlanadigan yechim HTML i: AI yozgan matnda faqat <p>, <br>, <b> bo'ladi — boshqa har
 * qanday teg (atributli <p> ham) matnga aylanadi, ya'ni brauzerda teg bo'lib ishlamaydi.
 */
export function yechimniTozala(html) {
  const teglar = [];
  return String(html ?? '').replace(/\u0000/g, '')
    .replace(/<(\/?)(p|br|b)\s*\/?>/gi, (_, yopuvchi, teg) => {
      const t = teg.toLowerCase();
      return `\u0000${teglar.push(`<${t === 'br' ? '' : yopuvchi}${t}>`) - 1}\u0000`;
    })
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => teglar[Number(i)] ?? '');
}

/**
 * Saqlash so'rovi ({solution?, solutionStatus?}) → bazaga yoziladigan maydonlar. `eski` —
 * savolning hozirgi {solution}. Yechim bo'sh bo'lsa — holati «yo'q»; yangi yechimning holati
 * aytilmasa — qoralama (o'quvchi faqat tasdiqlanganini ko'radi). Qaytaradi: {d} yoki {xato}.
 */
export function yechimMalumoti(body, eski) {
  const b = body && typeof body === 'object' ? body : {};
  if (b.solution === undefined && b.solutionStatus === undefined) return { xato: 'Yechim yoki uning holati kerak' };
  const d = {};
  if (b.solution !== undefined) {
    const xom = String(b.solution ?? '');
    // Kesib saqlanmaydi: yarmida uzilgan yechim o'quvchiga chala ko'rinardi.
    if (xom.length > YECHIM_MAX) return { xato: `Yechim juda uzun (${YECHIM_MAX} belgidan ko'p) — «Qisqaroq» deb qayta yozdiring` };
    const matn = yechimniTozala(xom);
    d.solution = yechimBormi(matn) ? matn : null;
  }
  const bor = d.solution !== undefined ? !!d.solution : yechimBormi(eski?.solution);
  if (!bor) {
    if (b.solution === undefined) return { xato: "Bu savolning yechimi yo'q — avval yechim yozdiring" };
    d.solutionStatus = 'yoq';
  } else if (b.solutionStatus === undefined) {
    if (d.solution !== undefined) d.solutionStatus = 'qoralama';
  } else if (['qoralama', 'tasdiqlangan'].includes(b.solutionStatus)) {
    d.solutionStatus = b.solutionStatus;
  } else return { xato: "Yechim holati noto'g'ri" };
  return { d };
}

/**
 * So'rov yo'li aynan "/api/questions/<id><oxiri>" ko'rinishidami — shunda savol id si, aks holda 0.
 * Express yo'lni harf kattaligiga qaramay ("/API/…") va "042", "%34%32" kabi id bilan ham
 * handlerga olib keladi; umumiy ruxsat tekshiruvi va jurnal esa faqat aniq ko'rinishni taniydi —
 * shuning uchun boshqa ko'rinishdagi so'rov bajarilmaydi. `yol` — req.path, `idMatni` — req.params.id.
 */
export function aniqYolId(yol, idMatni, oxiri) {
  const id = /^[1-9]\d{0,9}$/.test(String(idMatni ?? '')) ? Number(idMatni) : 0;
  return id && String(yol ?? '').replace(/\/$/, '') === `/api/questions/${id}${oxiri}` ? id : 0;
}

/** Ustoz talabi: bir qatorga, ortiqcha bo'shliqsiz, chegaralangan. */
export const korsatmaniTozala = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, KORSATMA_MAX);

// --- Rasmlar ----------------------------------------------------------------

const rasmManbalari = (html) => [...String(html ?? '').matchAll(/<img\b[^>]*?\ssrc\s*=\s*(["'])(.*?)\1/gi)].map(m => m[2].replace(/&amp;/g, '&'));

/**
 * Savoldagi hamma rasm manbalari (takrorsiz, o'qilish tartibida): umumiy shart (rasmi, matni,
 * javoblar ro'yxati), savolning o'z rasmi, matni va variantlari.
 */
export function savolRasmlari(q, variantlar = []) {
  const p = q?.passage || null;
  const royxat = [
    p?.imageUrl, ...rasmManbalari(p?.text),
    q?.imageUrl, ...rasmManbalari(q?.text),
    ...(Array.isArray(variantlar) ? variantlar : []).flatMap(rasmManbalari),
    ...(Array.isArray(q?.answers) ? q.answers : []).flatMap(rasmManbalari),
    // Guruh javoblari odatda savolning o'z variantlarida ham turadi — takrori tashlanadi.
    ...(Array.isArray(p?.variantlar) ? p.variantlar : []).flatMap(rasmManbalari),
  ];
  return [...new Set(royxat.map(x => String(x || '').trim()).filter(Boolean))];
}

/** Havola shu loyihaning Supabase Storage'idagi ochiq faylmi (boshqa manzilga server so'rov yubormaydi). */
function ozStorage(url, asos) {
  try {
    const u = new URL(url);
    const b = new URL(asos || '');
    return u.protocol === 'https:' && u.host === b.host && u.pathname.startsWith('/storage/v1/object/public/');
  } catch { return false; }
}

async function rasmniOl(url, { olib, asos }) {
  // data: rasm matnning o'zida (base64 — baytdan ~1,37 barobar uzun): chegaradan kattasi modelga berilmaydi.
  if (/^data:/i.test(url)) return url.length > RASM_HAJMI_MAX * 1.4 ? null : rasmQismi(url);
  if (!ozStorage(url, asos)) return null;
  // Yo'naltirishga ergashilmaydi: tekshirilgan manzildan boshqa joyga so'rov ketmasin.
  const r = await olib(url, { signal: AbortSignal.timeout(RASM_KUTISH_MS), redirect: 'error' });
  if (!r.ok) return null;
  const tur = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase().replace('image/jpg', 'image/jpeg');
  if (!RASM_TURLARI.includes(tur) || Number(r.headers.get('content-length') || 0) > RASM_HAJMI_MAX) return null;
  const bufer = Buffer.from(await r.arrayBuffer());
  if (!bufer.length || bufer.length > RASM_HAJMI_MAX) return null;
  return { inlineData: { mimeType: tur, data: bufer.toString('base64') } };
}

/**
 * Rasmlarni modelga beriladigan qismlarga aylantiradi. Olinmagan rasm (boshqa manzil, juda
 * katta, format mos emas, tarmoq xatosi) yechimni to'xtatmaydi — AI ga "rasm berilmagan"
 * deyiladi va ekranda ogohlantirish chiqadi. Qaytaradi: {qismlar, jami}.
 */
export async function rasmlarniOl(urllar, { olib = globalThis.fetch, asos = process.env.SUPABASE_URL } = {}) {
  const royxat = (Array.isArray(urllar) ? urllar : []).filter(Boolean);
  const natija = await Promise.all(royxat.slice(0, RASM_SONI_MAX).map(u => rasmniOl(u, { olib, asos }).catch(() => null)));
  return { qismlar: natija.filter(Boolean), jami: royxat.length };
}

// --- Kalit bilan solishtirish -----------------------------------------------

// Ko'rinishi lotincha harf bilan bir xil kirill harflari (AI ruscha savolda shunday yozib yuborishi mumkin).
const KIRILL = { А: 'A', В: 'B', С: 'C', Е: 'E' };
/** AI javobidagi variant harflari: "B", "b)", "Javob: B" → ["B"]; "A, C" yoki "AC" → ["A", "C"]; topilmasa []. */
function aiHarflari(a) {
  const s = String(a ?? '').replace(/[$*]/g, '').trim().toUpperCase().replace(/[АВСЕ]/g, h => KIRILL[h]);
  if (/^[A-F]{2,6}$/.test(s)) return [...new Set(s.split(''))];
  // Alohida turgan harf: so'z ichidagisi ("JAVOB" dagi A va B) hisobga olinmaydi.
  return [...new Set([...s.matchAll(/(?<![\p{L}'‘’ʻ])([A-F])(?![\p{L}\p{N}'‘’ʻ])/gu)].map(m => m[1]))];
}

/** Javob matnidan birinchi son (LaTeX va birliksiz): "$2{,}5$ sm" → "2,5", "\frac{5}{2}" → "5/2". */
function sonQismi(a) {
  const s = String(a ?? '').replace(/[−–]/g, '-').replace(/\{,\}/g, ',').replace(/\\[dt]?frac\{(-?\d+)\}\{(\d+)\}/g, '$1/$2').replace(/\s+/g, '');
  return (/-?\d+(?:[.,]\d+)?(?:\/\d+)?/.exec(s) || [])[0] || '';
}

/** Son javob kalitlardan biriga tengmi: true / false; AI javobida son topilmasa — null. */
function sonMos(kalitlar, a) {
  if (kalitlar.some(k => raqamlarTengmi(k, a))) return true;
  const son = sonQismi(a);
  if (!son) return null;
  return kalitlar.some(k => raqamlarTengmi(k, son));
}

const matnIzi = (s) => htmldanMatn(s).toLowerCase().replace(/[\s$]+/g, '');

/**
 * AI javobi bankdagi to'g'ri javob bilan mosmi: true / false; solishtirib bo'lmasa (kalit
 * yo'q, yozma savol, javob erkin matn) — null.
 */
export function javobniTekshir(q, aiJavobi) {
  const a = String(aiJavobi ?? '').trim();
  if (!a) return null;
  if (q.type === 'yopiq' || q.type === 'juft') {
    const kalit = String(q.correctAnswer || '').toUpperCase().split('').filter(h => HARFLAR.includes(h));
    const harflar = aiHarflari(a);
    return kalit.length && harflar.length ? harflar.every(h => kalit.includes(h)) : null;
  }
  if (q.type === 'raqamli') {
    const kalitlar = [q.correctAnswer, ...(Array.isArray(q.answers) ? q.answers : [])].map(k => String(k ?? '').trim()).filter(Boolean);
    // Raqamli savolning javobi son: AI son bermagan bo'lsa ham — mos emas.
    return kalitlar.length ? sonMos(kalitlar, a) === true : null;
  }
  if (q.type === 'qismli') {
    const kalit = String(q.correctAnswer || '').trim();
    if (!kalit) return null;
    if (matnIzi(kalit) === matnIzi(a)) return true;
    // Kalit son bo'lsa — aniq solishtiriladi; erkin matnli javobni mashina solishtira olmaydi.
    return raqamQiymati(kalit) === null ? null : sonMos([kalit, ...(Array.isArray(q.answers) ? q.answers.map(String) : [])], a);
  }
  if (q.type === 'moslash') {
    const kalit = moslashQatorlari(q.correctAnswer);
    const javob = moslashQatorlari(a);
    if (!kalit.some(Boolean) || !javob.some(Boolean)) return null;
    return kalit.join('|') === javob.slice(0, kalit.length).join('|') && javob.slice(kalit.length).every(x => !x);
  }
  return null;
}

/** Bankdagi to'g'ri javob — odam o'qiydigan ko'rinishda (AI ga va ekrandagi ogohlantirishga); yo'q bo'lsa ''. */
export function kalitMatni(q, variantlar = []) {
  const kalit = String(q?.correctAnswer || '').trim();
  if (!kalit) return '';
  if (q.type === 'yopiq' || q.type === 'juft') {
    return kalit.toUpperCase().split('').filter(h => HARFLAR.includes(h))
      .map(h => `${h}) ${htmldanMatn(variantlar[HARFLAR.indexOf(h)] || '')}`.trim()).join('; ');
  }
  if (q.type === 'raqamli') return [...new Set([kalit, ...(Array.isArray(q.answers) ? q.answers : []).map(x => String(x ?? '').trim())].filter(Boolean))].join(' yoki ');
  if (q.type === 'moslash') return moslashQatorlari(kalit).map((x, i) => `${MOSLASH_QATOR[i] || i + 1} — ${x.split('').join(', ') || '?'}`).join('; ');
  return q.type === 'yozma' ? '' : kalit;
}

// --- So'rov -----------------------------------------------------------------

const harfli = (royxat, harflar) => royxat.map((v, i) => `${harflar[i] || i + 1}) ${htmldanMatn(v) || '[rasm]'}`).join('\n');

/** Savol AI ga tushunarli matn bo'lib: umumiy shart, (qismli savolda) boshqa qismlar, savol va variantlar. */
function savolMatni(q, variantlar, qoshnilar, qism) {
  const bolaklar = [];
  const shart = htmldanMatn(q.passage?.text) || (q.passage?.imageUrl ? '[rasm]' : '');
  if (shart) bolaklar.push(`${guruhSavolimi(q.type) ? 'Umumiy shart' : 'Umumiy matn'}:\n${shart}`);
  if (qoshnilar.length) {
    bolaklar.push(`Shu masalaning boshqa qismlari (faqat ma'lumot uchun — ularni yechmang):\n${qoshnilar.map(x => `${x.belgi}) ${htmldanMatn(x.matn)}${x.javob ? ` — javobi: ${x.javob}` : ''}`).join('\n')}`);
  }
  const matn = [htmldanMatn(q.text), q.imageUrl ? '[rasm]' : ''].filter(Boolean).join('\n') || '[rasm]';
  bolaklar.push(`${guruhSavolimi(q.type) ? `Yechiladigan savol${qism ? ` (${qism} qismi)` : ''}` : 'Savol'}:\n${matn}`);
  if (q.type === 'moslash') {
    bolaklar.push(`Chap ustun:\n${harfli(variantlar, MOSLASH_QATOR)}`, `O'ng ustun:\n${harfli(Array.isArray(q.answers) ? q.answers : [], MOSLASH_USTUN)}`);
  } else if ((q.type === 'yopiq' || q.type === 'juft') && variantlar.length) {
    bolaklar.push(`${q.type === 'juft' ? "Javoblar ro'yxati" : 'Variantlar'}:\n${harfli(variantlar, HARFLAR)}`);
  }
  return bolaklar.join('\n\n');
}

/**
 * Modelga yuboriladigan so'rov matni. `korsatma` — ustozning talabi; `rasmSoni` — modelga
 * ilova qilingan rasmlar, `rasmJami` — savolda bor rasmlar; `qoshnilar` — qismli savolning
 * boshqa qismlari [{belgi, matn, javob}], `qism` — yechilayotgan qismning harfi. `asos` — talab
 * qaysi yechimga tegishli ekani (ekranda turgan, hali saqlanmagan yechim); berilmasa — bankdagisi.
 */
export function sorovMatni(q, variantlar = [], { korsatma = '', rasmSoni = 0, rasmJami = 0, qoshnilar = [], qism = '', asos = null } = {}) {
  const talab = korsatmaniTozala(korsatma);
  const kalit = kalitMatni(q, variantlar);
  // Talab ("qisqaroq", "boshqa usulda") nimaga nisbatan aytilgani AI ga ko'rinishi kerak.
  const eski = talab ? htmldanMatn(asos ?? q.solution).slice(0, ESKI_YECHIM_MAX) : '';
  return [
    savolMatni(q, variantlar, Array.isArray(qoshnilar) ? qoshnilar : [], qism),
    `Savol turi: ${TUR_TAVSIFI[q.type] || TUR_TAVSIFI.yopiq}.`,
    rasmSoni ? `Savolga ${rasmSoni} ta rasm ilova qilingan (matndagi [rasm] o'rinlari tartibida) — ulardagi ma'lumotdan foydalaning.` : '',
    rasmJami > rasmSoni
      ? `Savolda ${rasmSoni ? 'yana ' : ''}rasm bor, lekin u sizga berilmagan. Rasmsiz yechib bo'lmasa — taxmin qilmang: "rasmKerak" ga true qo'ying va yechimda aynan qaysi ma'lumot yetishmayotganini yozing.`
      : '',
    kalit
      ? `BANKDAGI TO'G'RI JAVOB: ${kalit}\nYechim shu javobga olib kelishi kerak. Lekin avval masalani o'zingiz halol yeching: natijangiz bankdagi javobdan farq qilsa, yechimni unga majburlab moslamang — "javob" ga O'Z natijangizni yozing, "kalitgaMos" ga false qo'ying va "farq" ga sababini bir-ikki jumlada yozing (masalan, bankdagi javob xato bo'lishi mumkin).`
      : `Bankda bu savolning to'g'ri javobi yozilmagan — o'zingiz yechib toping ("kalitgaMos" ga true qo'ying).`,
    `USLUB: ${USLUB[sukutUslubi(q.type)]}`,
    talab ? `USTOZNING TALABI — yechim aynan shunday bo'lsin (uslub va tildan ustun turadi; to'g'ri javob va yozish qoidalari o'zgarmaydi):\n«${talab}»` : '',
    eski ? `HOZIRGI YECHIM (ustoz uni o'zgartirmoqchi — talabga qarab qaytadan yozing):\n${eski}` : '',
    `Yechimni ${TILLAR[q.language] || TILLAR.uz} tilida yozing. Oddiy matn bo'lsin: Markdown belgilarisiz (**, #, \`\`\`), jadvalsiz. Har qadam yangi qatordan, katta bosqichlar orasida bo'sh qator. Oxirgi qatorda alohida: «Javob: …».`,
    LATEX,
    `"javob" ga — ${JAVOB_SHAKLI[q.type] || JAVOB_SHAKLI.yozma}.`,
  ].filter(Boolean).join('\n\n');
}

const SXEMA = {
  type: 'object',
  properties: {
    yechim: { type: 'string', description: 'Yechim matni (LaTeX $...$ bilan)' },
    javob: { type: 'string', description: "O'zingiz chiqargan yakuniy javob" },
    kalitgaMos: { type: 'boolean', description: 'Javobingiz bankdagi javob bilan bir xilmi' },
    farq: { type: 'string', description: "Bankdagi javobdan farq qilsa — sababi (qisqa)" },
    rasmKerak: { type: 'boolean', description: "Berilmagan rasmsiz yechib bo'lmadi" },
  },
  required: ['yechim', 'javob'],
};

/**
 * Savolni yechtirish. `q` — bankdagi savol (passage bilan), `variantlar` — savolVariantlari(q).
 * `rasmlar` — rasmlarniOl() natijasi ({qismlar, jami}); `asos` — talab qaysi yechimga nisbatan
 * aytilgani (ekrandagi saqlanmagan yechim HTML i). Qaytaradi (bazaga yozilmaydi):
 * {yechim — HTML, aiJavobi, mos — true | false | null, kalit, izoh, rasmKerak}.
 */
export async function yechimTuz(q, variantlar = [], { korsatma = '', rasmlar = null, qoshnilar = [], qism = '', asos = null } = {}) {
  const rasmQismlari = rasmlar?.qismlar || [];
  const j = await jsonSora({
    tizim: "Siz tajribali o'qituvchisiz. Savolni o'quvchiga tushunarli qilib, xatosiz yechasiz: har hisobni tekshirib yozing, o'ylab topilgan ma'lumot qo'shmang.",
    qismlar: [{ text: sorovMatni(q, variantlar, { korsatma, rasmSoni: rasmQismlari.length, rasmJami: rasmlar?.jami || 0, qoshnilar, qism, asos }) }, ...rasmQismlari],
    sxema: SXEMA,
  });
  const yechim = yechimniHtml(j?.yechim);
  if (!yechim) throw new AiXato("AI yechim yozmadi — qayta urinib ko'ring");
  const aiJavobi = String(j?.javob ?? '').trim().slice(0, 200);
  const kalit = kalitMatni(q, variantlar);
  // Aniq solishtirib bo'lmaydigan javobda (erkin matn) — AI ning o'zi "mos emas" desa, shunga ishoniladi.
  const mos = javobniTekshir(q, aiJavobi) ?? (kalit && j?.kalitgaMos === false ? false : null);
  return {
    yechim, aiJavobi, mos, kalit,
    izoh: mos === false ? String(j?.farq ?? '').replace(/\s+/g, ' ').trim().slice(0, 400) : '',
    rasmKerak: j?.rasmKerak === true,
  };
}
