// Savolning video darsi (egasi, 2026-10-13): o'quvchi natijadan keyin masala QANDAY yechilishini
// ko'radi va eshitadi. Arzon yo'l tanlangan: video fayl chizilmaydi va video-AI (Veo, Sora)
// ishlatilmaydi — AI faqat SSENARIY yozadi (doskaga nima yoziladi va o'qituvchi nima deydi),
// "video"ni brauzerdagi pleer shu ssenariydan o'zi chizadi (src/components/imtihon/dars/
// DarsPleer.tsx); ovoz bir marta yoziladi (lib/darsOvoz.js) va shu savol tushgan hamma
// o'quvchiga xizmat qiladi.
//
// Dars yangi yechim EMAS: bankdagi tayyor yechim qadamlarga bo'linadi (AI masalani qayta
// yechmaydi — arzon va xato qo'shilmaydi). Shuning uchun dars faqat yechimi bor savolga
// tuziladi va yechim yoki to'g'ri javob o'zgarsa eskiradi (`yechimIzi`). Qoida o'zgarmaydi: AI
// yozgani — qoralama, o'quvchi faqat ustoz tasdiqlagan darsni ko'radi. Hech narsa bu yerda
// bazaga yozilmaydi (routes/imtihonDars.js).
//
// Bitta dars — hamma o'quvchiga, variantlar esa har o'quvchida boshqa tartibda chiqadi. Shuning
// uchun variantli savolning darsi javobni harf bilan emas, qiymati bilan aytadi (`harfsizmi`).

import { createHash } from 'node:crypto';
import { HARFLAR } from './imtihon.js';
import { AiXato, htmldanMatn, jsonSora } from './imtihonAI.js';
import { kalitMatni, korsatmaniTozala, savolMatni, yechimBormi } from './imtihonYechim.js';

export const QADAM_MIN = 2;
export const QADAM_MAX = 14;
/** Butun dars nutqining chegarasi (belgi) — taxminan 3 daqiqa ovoz (ovoz bitta so'rovda yoziladi). */
export const NUTQ_JAMI_MAX = 2400;
export const DARS_HOLATLARI = ['qoralama', 'tasdiqlangan'];
const SARLAVHA_MAX = 60;
const DOSKA_MAX = 600;
const DOSKA_QATOR_MAX = 6;
const NUTQ_MAX = 600;
const YECHIM_MATNI_MAX = 8000;
/** O'rtacha nutq tezligi (belgi/soniya): ovozi yozilmagan darsning taxminiy vaqti va yozilgan ovozni tekshirish uchun. */
export const NUTQ_TEZLIGI = 14;
const QADAM_ENG_QISQA = 2.5;

const TILLAR = { uz: "o'zbek (lotin yozuvi)", ru: 'rus', en: 'ingliz' };
// Nutq ovozga aylanadi: formulani model belgi bilan emas, o'qilishi bo'yicha yozishi kerak.
const NUTQ_NAMUNASI = {
  uz: "«iks kvadrat minus besh iks plyus olti nolga teng», «yigirma besh», «uchdan ikki»",
  ru: '«икс в квадрате минус пять икс плюс шесть равно нулю», «двадцать пять», «две третьих»',
  en: '“x squared minus five x plus six equals zero”, “twenty-five”, “two thirds”',
};
const JAVOB_NAMUNASI = {
  uz: "«Javob: 3», «to'g'ri javob — uch»",
  ru: '«Ответ: 3», «правильный ответ — три»',
  en: '“Answer: 3”, “the correct answer is three”',
};

// Variant harfi tilga olingan joylar: «Javob: B», «B varianti», «be varianti», «вариант бэ».
const HARF_QOLIPLARI = [
  /(?<!\p{L})(?:[Jj]avob|[Vv]ariant|[Оо]твет|[Вв]ариант|[Aa]nswer|[Oo]ption)\p{L}*\s*[:—–-]?\s*\(?[A-FА-Е]\)?(?![\p{L}\p{N}])/u,
  /(?<![\p{L}\p{N}])(?:[A-F]|be|se|de|ef)\)?\s*[-–—]?\s*variant/iu,
  /(?<!\p{L})вариант\p{L}*\s+(?:бэ|вэ|гэ|дэ)(?!\p{L})/iu,
];

// --- Matnni tozalash --------------------------------------------------------

const yaxlit = (s) => Math.round(s * 100) / 100;
const BOSHQARUV = /[\u0000-\u0009\u000b-\u001f\u007f]+/g;

/** Matnni chegaragacha qisqartiradi — gap (bo'lmasa so'z) oxirida, yarim so'zda emas. */
function gapdaKes(t, max) {
  if (t.length <= max) return t;
  const kesik = t.slice(0, max);
  const gap = Math.max(kesik.lastIndexOf('. '), kesik.lastIndexOf('! '), kesik.lastIndexOf('? '));
  if (gap > max * 0.5) return kesik.slice(0, gap + 1);
  const soz = kesik.lastIndexOf(' ');
  return soz > 0 ? kesik.slice(0, soz) : kesik;
}

/**
 * Variantlari o'quvchiga aralashtirib beriladigan savolmi: unda harf (A, B…) har o'quvchida boshqa
 * javobni bildiradi. Javoblari aralashtirilmaydigan savolda (lockOptions) harf o'zgarmaydi.
 */
export const harfsizmi = (q) => (q?.type === 'yopiq' || q?.type === 'juft') && !q?.lockOptions;

/** Matnda variant harfi tilga olinganmi («Javob: B», «be varianti») — taxminiy tekshiruv, faqat ogohlantirish uchun. */
export const variantHarfiBormi = (s) => HARF_QOLIPLARI.some(r => r.test(String(s ?? '')));

/** Nutqda formula belgisi qolganmi ($, \, ^, _, {, }) — ovozda noto'g'ri o'qiladi. */
export const nutqdaFormulaBormi = (s) => /[$\\^_{}]/.test(String(s ?? ''));

/**
 * O'qiladigan matn: bir qator, Markdownsiz. Burchakli qavsdagi so'z (<pause>) butunlay olinadi —
 * ovoz modeli uni buyruq (pauza, tovush) deb bajaradi; yolg'iz qolgan qavslar ham ketadi. Oxirida
 * tinish belgisi bo'ladi: qadamlar orasidagi pauza shundan chiqadi (lib/darsOvoz.js chegaralarni
 * pauzadan topadi).
 */
export function nutqniTozala(s) {
  const t = gapdaKes(String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/<\/?[a-zA-Z][^<>]{0,40}>/g, ' ').replace(/[<>]/g, ' ')
    .replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim(), NUTQ_MAX);
  return t && !/[.!?…]$/.test(t) ? `${t}.` : t;
}

/**
 * Doskaga yoziladigani: oddiy matn (HTML emas — pleer uni ekranlab chizadi), formulalar $...$
 * ichida, ko'pi bilan 6 qator. Chegaradan oshsa — oxirgi qatorlar tashlanadi; qator o'rtasidan
 * kesilmaydi (yarmida uzilgan formula chizilmay qolardi).
 */
export function doskaniTozala(s) {
  const qatorlar = String(s ?? '').replace(/\r\n?/g, '\n').replace(BOSHQARUV, ' ')
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => `$$${f.replace(/\s*\n\s*/g, ' ').trim()}$$`)
    .split('\n').map(q => q.replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').trim()).filter(Boolean)
    .slice(0, DOSKA_QATOR_MAX);
  const natija = [];
  let jami = 0;
  for (const q of qatorlar) {
    if (jami + q.length > DOSKA_MAX) break;
    jami += q.length + 1;
    natija.push(q);
  }
  return natija.join('\n');
}

const sarlavhaniTozala = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/[*#`$]/g, '').replace(/\s+/g, ' ').trim().slice(0, SARLAVHA_MAX);
const doskaniQosh = (a, b) => doskaniTozala([a, b].filter(Boolean).join('\n'));

/**
 * AI (yoki mijoz) bergan qadamlar → toza [{sarlavha, doska, nutq}]. Har qadamning nutqi bo'ladi:
 * nutqsiz qadamning doskasi qo'shni qadamga qo'shiladi (ovozda unga vaqt to'g'ri kelmaydi).
 * `kesildi` — dars chegaradan (qadam soni yoki nutq uzunligi) oshgani uchun oxiri olinmadi.
 */
export function qadamlarniTozala(xom) {
  const qadamlar = [];
  let jami = 0;
  let kutgan = '';
  let kesildi = false;
  for (const x of Array.isArray(xom) ? xom : []) {
    if (!x || typeof x !== 'object') continue;
    const doska = doskaniTozala(x.doska);
    const nutq = nutqniTozala(x.nutq);
    if (!nutq) {
      if (!doska) continue;
      if (qadamlar.length) qadamlar[qadamlar.length - 1] = { ...qadamlar.at(-1), doska: doskaniQosh(qadamlar.at(-1).doska, doska) };
      else kutgan = doskaniQosh(kutgan, doska);
      continue;
    }
    if (qadamlar.length >= QADAM_MAX || jami + nutq.length > NUTQ_JAMI_MAX) { kesildi = true; break; }
    jami += nutq.length;
    qadamlar.push({ sarlavha: sarlavhaniTozala(x.sarlavha), doska: doskaniQosh(kutgan, doska), nutq });
    kutgan = '';
  }
  return { qadamlar, kesildi };
}

// --- Vaqt -------------------------------------------------------------------

/** Ovozi yozilmagan qadam taxminan necha soniya o'qiladi. */
export const taxminiyDavom = (nutq) => Math.max(QADAM_ENG_QISQA, yaxlit(String(nutq ?? '').length / NUTQ_TEZLIGI));

/**
 * Qadamlarga vaqt qo'yadi (soniya). `chegaralar` — ovozdagi haqiqiy chegaralar [0, t1, …, T]
 * (lib/darsOvoz.js); berilmasa — nutq uzunligidan taxmin (ovozsiz pleer shu vaqt bilan yuradi).
 * Qaytaradi: {qadamlar: [{sarlavha, doska, nutq, boshi, davomi}], davomiylik}.
 */
export function vaqtlarniQoy(qadamlar, chegaralar = null) {
  const aniq = Array.isArray(chegaralar) && chegaralar.length === qadamlar.length + 1;
  let boshi = 0;
  const natija = qadamlar.map((q, i) => {
    const davomi = aniq ? Math.max(0, chegaralar[i + 1] - chegaralar[i]) : taxminiyDavom(q.nutq);
    const qadam = { sarlavha: q.sarlavha || '', doska: q.doska || '', nutq: q.nutq || '', boshi: yaxlit(aniq ? chegaralar[i] : boshi), davomi: yaxlit(davomi) };
    boshi += davomi;
    return qadam;
  });
  return { qadamlar: natija, davomiylik: yaxlit(aniq ? chegaralar[qadamlar.length] : boshi) };
}

// --- Yechim bilan bog'liqlik ------------------------------------------------

/**
 * Savol yechimining izi: dars qaysi yechimdan (va qaysi to'g'ri javob bilan) tuzilganini eslab
 * qolish uchun. Bo'shliqlar farqi hisobga olinmaydi. `q` — {solution, correctAnswer}.
 */
export const yechimIzi = (q) => createHash('sha256')
  .update(`${String(q?.correctAnswer ?? '').trim()}\n${htmldanMatn(q?.solution).replace(/\s+/g, ' ')}`).digest('hex').slice(0, 16);

/** Dars eskirganmi: u tuzilgandan keyin savolning yechimi yoki to'g'ri javobi o'zgargan. */
export const darsEskirganmi = (dars, q) => !!dars && dars.yechimIzi !== yechimIzi(q);

/**
 * Dars ovozining Storage'dagi fayl nomi ("dars_….mp3"); havola o'zimizning ochiq Storage'dagi
 * dars fayli bo'lmasa — '' (boshqa fayl hech qachon o'chirilmaydi). `asos` — SUPABASE_URL.
 */
export function ovozFayli(url, asos = process.env.SUPABASE_URL) {
  try {
    const u = new URL(url);
    const nom = /^\/storage\/v1\/object\/public\/uploads\/(dars_[\w-]+\.mp3)$/.exec(u.pathname)?.[1];
    return nom && u.protocol === 'https:' && u.host === new URL(asos || '').host ? nom : '';
  } catch { return ''; }
}

const darsQadamlari = (dars) => (Array.isArray(dars?.qadamlar) ? dars.qadamlar : []);

/**
 * Bank filtri uchun dars holati: darsi yo'q — 'yoq'; yechim o'zgargan (o'quvchiga ko'rinmaydi) —
 * 'eskirgan' (tasdiqdan ustun: qayta tuzish kerak); aks holda 'tasdiqlangan' yoki 'qoralama'.
 * `q` — {solution, correctAnswer}.
 */
export function darsHolati(dars, q) {
  if (!dars) return 'yoq';
  if (darsEskirganmi(dars, q)) return 'eskirgan';
  return dars.status === 'tasdiqlangan' ? 'tasdiqlangan' : 'qoralama';
}

/** Bank ekraniga (ustozga) qaytadigan dars; yo'q bo'lsa null. */
export function bankDarsi(dars, q) {
  if (!dars) return null;
  return {
    qadamlar: darsQadamlari(dars), davomiylik: dars.davomiylik || 0, ovoz: dars.ovozUrl || null,
    status: dars.status === 'tasdiqlangan' ? 'tasdiqlangan' : 'qoralama',
    eskirgan: darsEskirganmi(dars, q), korsatma: dars.korsatma || null,
  };
}

/**
 * O'quvchiga ko'rinadigan dars: faqat tasdiqlangani, yechimi ham tasdiqlangan va dars shu
 * yechimdan tuzilgan bo'lsa. Aks holda null (yechimi yoki to'g'ri javobi tuzatilgan savolning
 * eski darsi ko'rinmaydi).
 */
export function oquvchiDarsi(dars, q) {
  if (!dars || dars.status !== 'tasdiqlangan' || q?.solutionStatus !== 'tasdiqlangan' || darsEskirganmi(dars, q)) return null;
  const qadamlar = darsQadamlari(dars);
  return qadamlar.length ? { qadamlar, davomiylik: dars.davomiylik || 0, ovoz: dars.ovozUrl || null } : null;
}

/**
 * Saqlash so'rovi ({qadamlar?, status?, korsatma?}) → bazaga yoziladigan maydonlar. `eski` —
 * savolning hozirgi darsi (yo'q bo'lsa null). Yangi ssenariy — qoralama (holati aytilmasa) va
 * taxminiy vaqt bilan: ovoz keyin alohida yoziladi. Qaytaradi: {d} yoki {xato}.
 */
export function darsMalumoti(body, eski) {
  const b = body && typeof body === 'object' ? body : {};
  if (b.qadamlar === undefined && b.status === undefined) return { xato: 'Dars qadamlari yoki holati kerak' };
  if (b.status !== undefined && !DARS_HOLATLARI.includes(b.status)) return { xato: "Dars holati noto'g'ri" };
  if (b.qadamlar === undefined) {
    return eski ? { d: { status: b.status } } : { xato: "Bu savolning video darsi yo'q — avval dars tuzdiring" };
  }
  const { qadamlar, kesildi } = qadamlarniTozala(b.qadamlar);
  // Kesib saqlanmaydi: javobgacha yetmagan dars o'quvchiga chala ko'rinardi.
  if (kesildi) return { xato: 'Dars juda uzun — «Qisqaroq» deb qayta tuzdiring' };
  if (qadamlar.length < QADAM_MIN) return { xato: `Darsda kamida ${QADAM_MIN} ta qadam bo'lishi kerak` };
  return { d: { ...vaqtlarniQoy(qadamlar), korsatma: korsatmaniTozala(b.korsatma) || null, status: b.status ?? 'qoralama' } };
}

// --- So'rov -----------------------------------------------------------------

/**
 * Ustoz ko'rishi kerak bo'lgan kamchiliklar (dars baribir qaytadi — qayta tuzdirsa bo'ladi).
 * `harfsiz` — savol variantlari aralashtiriladi (harfsizmi): darsda harf uchramasligi kerak.
 */
export function darsOgohlari(qadamlar, { kesildi = false, harfsiz = false } = {}) {
  return [
    harfsiz && qadamlar.some(q => variantHarfiBormi(q.doska) || variantHarfiBormi(q.nutq))
      ? "Darsda variant harfi tilga olingan (masalan «B varianti»). Variantlar har o'quvchida boshqa tartibda chiqadi — harf mos kelmasligi mumkin. Qayta tuzdiring."
      : '',
    qadamlar.some(q => nutqdaFormulaBormi(q.nutq)) ? "Ba'zi qadamlarning nutqida formula belgilari qolgan — ovozda noto'g'ri o'qilishi mumkin. Qayta tuzdiring." : '',
    kesildi ? "Dars juda uzun chiqdi va oxiri olinmadi — «Qisqaroq» deb qayta tuzdiring." : '',
  ].filter(Boolean);
}

/** Variantli savolning to'g'ri javobi harfsiz — javobning o'zi (variantlar har o'quvchida boshqa tartibda). */
const harfsizKalit = (q, variantlar) => String(q?.correctAnswer || '').toUpperCase().split('').filter(h => HARFLAR.includes(h))
  .map(h => htmldanMatn(variantlar[HARFLAR.indexOf(h)] || '')).filter(Boolean).join('; ');

/**
 * Modelga yuboriladigan so'rov matni: savol, to'g'ri javob, tayyor yechim va ssenariy qoidalari.
 * `korsatma` — ustozning talabi; `qoshnilar`, `qism` — qismli savol uchun (lib/imtihonYechim.js).
 */
export function darsSorovi(q, variantlar = [], { korsatma = '', qoshnilar = [], qism = '' } = {}) {
  const talab = korsatmaniTozala(korsatma);
  const harfsiz = harfsizmi(q);
  const kalit = harfsiz ? harfsizKalit(q, variantlar) : kalitMatni(q, variantlar);
  const til = TILLAR[q.language] ? q.language : 'uz';
  return [
    savolMatni(q, variantlar, Array.isArray(qoshnilar) ? qoshnilar : [], qism),
    kalit ? `TO'G'RI JAVOB: ${kalit}` : '',
    `TAYYOR YECHIM (ustoz tekshirgan):\n${htmldanMatn(q.solution).slice(0, YECHIM_MATNI_MAX)}`,
    "VAZIFA: shu tayyor yechimni qisqa VIDEO DARS ssenariysiga aylantiring — o'qituvchi doskaga yozib, og'zaki tushuntirayotgandek. Masalani qayta yechmang: yechimdagi usul, hisob va javob aynan saqlansin, yangi ma'lumot qo'shilmasin.",
    `QADAMLAR: 4–10 ta (qisqa masalada kamroq). Birinchi qadam — masala sharti: nima berilgan va nimani topish kerak. Oxirgi qadam — javob (sarlavhasi «Javob»). Har qadamda:
- "sarlavha" — qadam nomi, 1–4 so'z;
- "doska" — doskaga yoziladigani: 1–4 qisqa qator (har biri yangi qatordan), asosan formula va hisob, so'z kam. Matematik ifodalar LaTeX da $...$ ichida. Markdown va HTML ishlatmang;
- "nutq" — o'qituvchi shu qadamda aytadigan gap: 1–3 jumla, sodda va jonli — nima qilinayotgani va NEGA shunday qilinayotgani.`,
    `"nutq" ovozga aylantiriladi, shuning uchun unda FAQAT so'zlar bo'lsin: $, \\, ^, _, {, } kabi formula belgilari, LaTeX va qisqartmalar bo'lmasin. Formulani o'qilishi bo'yicha so'z bilan yozing, sonlarni ham so'z bilan: ${NUTQ_NAMUNASI[til]}.`,
    harfsiz
      ? `Variantlar har o'quvchida BOSHQA TARTIBDA chiqadi, shuning uchun variant harfini (A, B, C…) doskada ham, nutqda ham ishlatmang — yechimda harf yozilgan bo'lsa ham. Javobni qiymatining o'zi bilan yozing va ayting: ${JAVOB_NAMUNASI[til]}.`
      : '',
    "Butun darsning nutqi 2 daqiqadan oshmasin (taxminan 1500 belgi).",
    talab ? `USTOZNING TALABI — dars aynan shunday bo'lsin (yechim va yozish qoidalari o'zgarmaydi):\n«${talab}»` : '',
    `Darsni ${TILLAR[til]} tilida yozing.`,
  ].filter(Boolean).join('\n\n');
}

const SXEMA = {
  type: 'object',
  properties: {
    qadamlar: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sarlavha: { type: 'string', description: "Qadam nomi, 1–4 so'z" },
          doska: { type: 'string', description: 'Doskaga yoziladigani: 1–4 qisqa qator, formulalar $...$ ichida' },
          nutq: { type: 'string', description: "O'qituvchi aytadigan gap: faqat so'zlar, formula belgilarisiz" },
        },
        required: ['sarlavha', 'doska', 'nutq'],
      },
    },
  },
  required: ['qadamlar'],
};

/**
 * Dars ssenariysini tuzdirish. `q` — bankdagi savol (yechimi va passage bilan), `variantlar` —
 * savolVariantlari(q). Qaytaradi (bazaga yozilmaydi): {qadamlar, davomiylik, ogohlar} — vaqtlar
 * taxminiy, haqiqiysi ovoz yozilganda qo'yiladi.
 */
export async function darsTuz(q, variantlar = [], { korsatma = '', qoshnilar = [], qism = '' } = {}) {
  if (!yechimBormi(q?.solution)) throw new AiXato('Video dars tayyor yechimdan tuziladi — avval yechim yozdiring', 400);
  const j = await jsonSora({
    tizim: "Siz tajribali o'qituvchisiz. Tayyor yechimni o'quvchi ko'rib va eshitib tushunadigan qisqa video darsga aylantirasiz: aniq, sodda, ortiqcha gapsiz.",
    qismlar: [{ text: darsSorovi(q, variantlar, { korsatma, qoshnilar, qism }) }],
    sxema: SXEMA,
    harorat: 0.3,
  });
  const { qadamlar, kesildi } = qadamlarniTozala(j?.qadamlar);
  if (qadamlar.length < QADAM_MIN) throw new AiXato("AI dars tuza olmadi — qayta urinib ko'ring");
  return { ...vaqtlarniQoy(qadamlar), ogohlar: darsOgohlari(qadamlar, { kesildi, harfsiz: harfsizmi(q) }) };
}
