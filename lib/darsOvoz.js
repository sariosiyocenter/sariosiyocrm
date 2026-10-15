// Video dars ovozi (lib/imtihonDars.js ssenariysi uchun). Butun darsning nutqi BITTA so'rov bilan
// ovozga aylanadi — Gemini TTS, markazning o'sha AI kaliti bilan (o'zbek tilini biladi; tilni
// matndan o'zi aniqlaydi). Bitta so'rov: arzon, bepul kalitning daqiqalik limitiga sig'adi va
// ovoz boshidan oxirigacha bir tekis chiqadi. Qadamlar qachon boshlanishi ovozning o'zidan
// topiladi: nutq uzunligi bo'yicha taxminiy joy eng yaqin pauzaga suriladi.
//
// Natija — MP3 (24 kHz mono, 48 kbit/s: 2 daqiqa ≈ 0,7 MB); video fayl yo'q. Saqlash va
// Storage'ga yuklash — routes/imtihonDars.js.

import { AiXato, aiKaliti } from './imtihonAI.js';
import { NUTQ_TEZLIGI } from './imtihonDars.js';

const STANDART_MODEL = 'gemini-3.8-flash-tts';
// Model nomi eskirsa yoki band bo'lsa — navbatdagisi (arzonrog'i).
const ZAXIRA_MODELLAR = ['gemini-3.8-flash-lite-tts'];
const MANZIL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const KUTISH_MS = 50_000;
const USLUB = 'A calm, clear and friendly teacher explaining a solution to a student, at a moderate pace, with a short pause between paragraphs.';
/** Gemini TTS ovozining chastotasi (WAV sarlavhasi bo'lmasa shu deb olinadi). */
export const CHASTOTA = 24000;
const MP3_KBIT = 48;
const MP3_KADR = 1152;
const MP3_NAVBAT = 200;
// MP3 kodlovchi biladigan chastotalar oralig'i; undan tashqarisi — buzilgan javob.
const CHASTOTA_MIN = 8000;
const CHASTOTA_MAX = 48000;

export const ovozModeli = () => process.env.GEMINI_TTS_MODEL || STANDART_MODEL;
const ovozNomi = () => process.env.DARS_OVOZI || 'Charon';

// Pauza qidirish: 10 ms li oynalar; shundan qisqa jimlik — so'z ichidagi tovush, pauza emas.
const OYNA_S = 0.01;
const PAUZA_ENG_QISQA = 0.18;
const QADAM_ENG_QISQA = 0.5;
// Ovoz uzunligi matndan kutilganiga (NUTQ_TEZLIGI) nisbatan shu oraliqda bo'lishi kerak; zaxira —
// boshidagi va oxiridagi jimlik uchun (qisqa matnda u sezilarli ulush).
const UZUNLIK_ENG_KAM = 0.4;
const UZUNLIK_ENG_KOP = 2.5;
const UZUNLIK_ZAXIRA = 2;

// --- Sinov uchun soxta ovoz -------------------------------------------------

let soxta = null;
/** Sinov uchun: haqiqiy TTS o'rniga funksiya ({matn, nutqlar}) => {pcm: Int16Array, chastota}. */
export function soxtaOvozniQoy(f) { soxta = f; }
/** Ovoz yozdirsa bo'ladimi: kalit bor (markazniki yoki serverniki) yoki soxta ovoz qo'yilgan. */
export const ovozTayyormi = () => !!soxta || !!aiKaliti();

// --- Model javobi → PCM -----------------------------------------------------

const audioQismi = (x) => ({
  data: x.data,
  tur: String(x.mime_type || x.mimeType || '').toLowerCase(),
  chastota: Number(x.sample_rate) || 0,
  kanal: Number(x.channels) || 0,
});

/**
 * Javobdagi ovoz {data — base64, tur — MIME (bo'lmasa ''), chastota, kanal — aytilgan bo'lsa,
 * aks holda 0}: `output_audio` da yoki qadamlar ichidagi {type: 'audio', data} da; topilmasa null.
 */
export function audioniTop(javob) {
  if (typeof javob?.output_audio?.data === 'string' && javob.output_audio.data) return audioQismi(javob.output_audio);
  const navbat = [javob];
  // Javob kichik (bir necha tugun) — chegara faqat kutilmagan ulkan javobdan saqlaydi.
  for (let i = 0; navbat.length && i < 2000; i++) {
    const x = navbat.shift();
    if (!x || typeof x !== 'object') continue;
    if (!Array.isArray(x) && x.type === 'audio' && typeof x.data === 'string' && x.data) return audioQismi(x);
    for (const v of Array.isArray(x) ? x : Object.values(x)) if (v && typeof v === 'object') navbat.push(v);
  }
  return null;
}

// Siqilgan ovoz belgilari: bunday baytlar PCM deb o'qilsa — shovqin chiqadi va u dars bo'lib saqlanib qoladi.
const SIQILGAN_BOSHI = ['ID3', 'OggS', 'fLaC'];
const SIQILGAN_TUR = /mpeg|mp3|ogg|opus|aac|flac|webm|mp4/;

/**
 * Ovoz baytlari → {pcm: Int16Array, chastota}. WAV (RIFF, mono 16-bit PCM) sarlavhasidan o'qiladi.
 * Sarlavhasiz kelgani — xom 16-bit PCM (oqimli javob shunday keladi): chastotasi javobda aytilgani
 * (`chastota`) yoki `tur` dagi "rate=" (bo'lmasa 24 kHz), `kanal` — birdan ko'p bo'lsa xato.
 * Siqilgan format (MP3, Ogg…) ham xato: PCM deb o'qilsa shovqin chiqardi.
 */
export function wavdanPcm(bufer, { tur = '', chastota: aytilgan = 0, kanal = 0 } = {}) {
  const b = Buffer.isBuffer(bufer) ? bufer : Buffer.from(bufer || []);
  const wav = b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WAVE';
  if (!wav && (SIQILGAN_TUR.test(tur) || SIQILGAN_BOSHI.some(x => b.toString('latin1', 0, x.length) === x))) {
    throw new AiXato(`Ovoz formati kutilmagan${tur ? ` (${tur.slice(0, 40)})` : ''} — PCM yoki WAV kerak`);
  }
  if (!wav && kanal > 1) throw new AiXato('Ovoz formati kutilmagan (mono 16-bit PCM emas)');
  let chastota = aytilgan || Number(/rate=(\d+)/.exec(tur)?.[1]) || CHASTOTA;
  let boshi = 0;
  let oxiri = b.length;
  if (wav) {
    boshi = -1;
    for (let i = 12; i + 8 <= b.length;) {
      const nom = b.toString('latin1', i, i + 4);
      const hajm = b.readUInt32LE(i + 4);
      if (nom === 'fmt ' && i + 24 <= b.length) {
        if (b.readUInt16LE(i + 8) !== 1 || b.readUInt16LE(i + 10) !== 1 || b.readUInt16LE(i + 22) !== 16) throw new AiXato('Ovoz formati kutilmagan (mono 16-bit PCM emas)');
        chastota = b.readUInt32LE(i + 12);
      } else if (nom === 'data') {
        boshi = i + 8;
        // Oqimli WAV da hajm 0 yoki 0xFFFFFFFF bo'lib keladi — o'shanda fayl oxirigacha.
        oxiri = hajm && hajm !== 0xFFFFFFFF ? Math.min(b.length, boshi + hajm) : b.length;
        break;
      }
      i += 8 + hajm + (hajm % 2);
    }
    if (boshi < 0) throw new AiXato("Ovoz fayli buzilgan — qayta urinib ko'ring");
  }
  if (chastota < CHASTOTA_MIN || chastota > CHASTOTA_MAX) throw new AiXato("Ovoz formati kutilmagan (chastotasi noto'g'ri)");
  const uzunlik = Math.floor((oxiri - boshi) / 2);
  const pcm = new Int16Array(uzunlik);
  for (let k = 0; k < uzunlik; k++) pcm[k] = b.readInt16LE(boshi + k * 2);
  return { pcm, chastota };
}

// --- Qadam chegaralari ------------------------------------------------------

/** Ovozdagi pauzalar [{boshi, oxiri}] (soniya): kamida 0,18 s jimlik; boshidagi va oxiridagi jimlik kirmaydi. */
export function pauzalar(pcm, chastota) {
  const oyna = Math.max(1, Math.round(chastota * OYNA_S));
  const soni = Math.floor(pcm.length / oyna);
  const kuch = new Float32Array(soni);
  let eng = 0;
  for (let w = 0; w < soni; w++) {
    let yigindi = 0;
    for (let i = w * oyna, oxiri = i + oyna; i < oxiri; i++) yigindi += pcm[i] * pcm[i];
    kuch[w] = Math.sqrt(yigindi / oyna);
    if (kuch[w] > eng) eng = kuch[w];
  }
  // Jimlik chegarasi — eng baland joyning 3% i (TTS ovozi toza: pauzada deyarli nol).
  const chegara = Math.max(60, eng * 0.03);
  const soniya = oyna / chastota;
  const natija = [];
  let bosh = -1;
  for (let w = 0; w < soni; w++) {
    if (kuch[w] < chegara) { if (bosh < 0) bosh = w; continue; }
    if (bosh > 0 && (w - bosh) * soniya >= PAUZA_ENG_QISQA) natija.push({ boshi: bosh * soniya, oxiri: w * soniya });
    bosh = -1;
  }
  return natija;
}

/**
 * Qadam chegaralari [0, t1, …, T] (soniya). `vaznlar` — har qadam nutqining nisbiy uzunligi.
 * Har chegara avval vaznga qarab taxmin qilinadi (oldingi topilgan chegaradan boshlab — xato
 * yig'ilib bormaydi), so'ng shu atrofdagi eng uzun pauzaga suriladi; pauza topilmasa taxmin qoladi.
 */
export function chegaralarniTop(pcm, chastota, vaznlar) {
  const jami = pcm.length / chastota;
  const n = vaznlar.length;
  if (n <= 1) return [0, jami];
  const royxat = pauzalar(pcm, chastota);
  const chegaralar = [0];
  let qolgan = vaznlar.reduce((a, b) => a + b, 0);
  for (let k = 0; k < n - 1; k++) {
    const oldingi = chegaralar[k];
    const kutilgan = oldingi + (vaznlar[k] / qolgan) * (jami - oldingi);
    const oyna = Math.max(1.2, (kutilgan - oldingi) * 0.5);
    let tanlangan = null;
    let ball = -Infinity;
    for (const p of royxat) {
      if (p.oxiri <= oldingi + QADAM_ENG_QISQA || p.oxiri >= jami - QADAM_ENG_QISQA) continue;
      const farq = Math.abs((p.boshi + p.oxiri) / 2 - kutilgan);
      if (farq > oyna) continue;
      const b = (p.oxiri - p.boshi) - farq * 0.15;
      if (b > ball) { ball = b; tanlangan = p; }
    }
    // Chegara — pauzadan keyingi gap boshlanishidan sal oldin: doska o'qituvchi gapira boshlaganda almashadi.
    const t = tanlangan ? tanlangan.oxiri - 0.06 : kutilgan;
    chegaralar.push(Math.min(jami, Math.max(oldingi, t)));
    qolgan -= vaznlar[k];
  }
  chegaralar.push(jami);
  return chegaralar;
}

// --- MP3 --------------------------------------------------------------------

/** PCM (mono 16-bit) → MP3 baytlari. */
export async function mp3ga(pcm, chastota) {
  // Kutubxona faqat ovoz yozilganda yuklanadi — serverning har bir ishga tushishi sekinlashmasin.
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const kodlovchi = new Mp3Encoder(1, chastota, MP3_KBIT);
  const bolaklar = [];
  for (let i = 0, kadr = 0; i < pcm.length; i += MP3_KADR, kadr++) {
    // Kodlash sinxron (bir daqiqa ovoz ≈ 0,7 s): har ~10 soniyalik ovozdan keyin navbat beriladi —
    // uzoq yashaydigan serverda boshqa so'rovlar shu paytda qotib qolmasin.
    if (kadr && kadr % MP3_NAVBAT === 0) await new Promise(setImmediate);
    const b = kodlovchi.encodeBuffer(pcm.subarray(i, i + MP3_KADR));
    if (b.length) bolaklar.push(Buffer.from(b));
  }
  const oxiri = kodlovchi.flush();
  if (oxiri.length) bolaklar.push(Buffer.from(oxiri));
  return Buffer.concat(bolaklar);
}

// --- Model chaqiruvi --------------------------------------------------------

/** Bitta modelga so'rov. Qaytaradi: {bufer, tur}. Tarmoq xatosi va kutish vaqti — AiXato; HTTP xatosi — {status} li Error. */
async function modeldanOvoz(kalit, model, matn, olib) {
  let javob;
  let j;
  try {
    javob = await olib(MANZIL, {
      method: 'POST',
      headers: { 'x-goog-api-key': kalit, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(KUTISH_MS),
      body: JSON.stringify({
        model,
        input: [{ type: 'user_input', content: [{ type: 'text', text: matn, annotations: [{ type: 'speech_metadata', style: USLUB }] }] }],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice: ovozNomi() }] },
      }),
    });
    // Javob tanasi (bir necha MB ovoz) ham shu kutish vaqti ichida o'qiladi; JSON bo'lmagan tana — null.
    j = await javob.json().catch((e) => { if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw e; return null; });
  } catch (e) {
    throw e?.name === 'TimeoutError' || e?.name === 'AbortError'
      ? new AiXato("Ovoz xizmati javob berishga ulgurmadi — qayta urinib ko'ring", 504)
      : new AiXato("Ovoz xizmatiga ulanib bo'lmadi — qayta urinib ko'ring");
  }
  if (!javob.ok) throw Object.assign(new Error(String(j?.error?.message || `HTTP ${javob.status}`)), { status: javob.status });
  const audio = audioniTop(j);
  if (!audio) {
    // Javob shakli kutilganidan boshqa: qayta urinish yordam bermaydi — sababini jurnaldan topish uchun.
    console.error("[dars] ovoz javobida audio yo'q:", { model, kalitlar: Object.keys(j || {}), status: j?.status });
    throw new AiXato('Ovoz xizmati ovoz qaytarmadi (javob shakli kutilmagan)');
  }
  return { bufer: Buffer.from(audio.data, 'base64'), tur: audio.tur, chastota: audio.chastota, kanal: audio.kanal };
}

/** Matnni ovozga aylantiradi ({bufer, tur, chastota, kanal}): model topilmasa yoki band bo'lsa — zaxiradagisi; xatolar tushunarli matnga. */
export async function ovozSora(kalit, matn, { olib = globalThis.fetch } = {}) {
  const nomlar = [...new Set([ovozModeli(), ...ZAXIRA_MODELLAR])];
  let band = false;
  let oxirgi = '';
  for (const model of nomlar) {
    try {
      return await modeldanOvoz(kalit, model, matn, olib);
    } catch (e) {
      if (e instanceof AiXato) throw e;
      const xabar = String(e?.message || e);
      const holat = e?.status;
      oxirgi = xabar;
      if (/location is not supported|user location/i.test(xabar)) throw new AiXato('AI xizmati bu hududda ishlamayapti', 503);
      if (holat === 404 || /not found|is not supported/i.test(xabar)) continue;
      if (holat === 401 || holat === 403 || /API key|API_KEY_INVALID|PERMISSION_DENIED/.test(xabar)) throw new AiXato('AI kaliti ovoz yozishga ruxsat bermadi — kalitni tekshiring (aistudio.google.com/apikey)', 503);
      if (holat === 429 || /RESOURCE_EXHAUSTED|quota/i.test(xabar)) throw new AiXato("Ovoz limiti tugadi — birozdan keyin qayta urinib ko'ring", 429);
      if (holat >= 500) { band = true; continue; }
      throw new AiXato(`Ovoz xizmati javob bermadi: ${xabar.slice(0, 200)}`);
    }
  }
  if (band) throw new AiXato("Ovoz xizmati hozir band — bir daqiqadan keyin qayta urinib ko'ring", 503);
  throw new AiXato(`Ovoz modeli topilmadi: ${oxirgi.slice(0, 120)} (GEMINI_TTS_MODEL ni tekshiring)`, 503);
}

/**
 * Dars qadamlarining nutqini ovozga aylantiradi. Qaytaradi (hech narsa saqlanmaydi):
 * {mp3: Buffer, chegaralar: [0, t1, …, T], davomiylik} — chegaralar lib/imtihonDars.js
 * vaqtlarniQoy() ga beriladi.
 */
export async function nutqniOvozga(qadamlar) {
  const nutqlar = (Array.isArray(qadamlar) ? qadamlar : []).map(q => String(q?.nutq ?? '').trim());
  if (!nutqlar.length || nutqlar.some(n => !n)) throw new AiXato("Video yechimning har qadamida o'qiladigan matn bo'lishi kerak", 400);
  // Qadamlar orasida bo'sh qator: model u yerda uzunroq pauza qiladi — chegara shundan topiladi.
  const matn = nutqlar.join('\n\n');
  let ovoz;
  if (soxta) ovoz = await soxta({ matn, nutqlar });
  else {
    const kalit = aiKaliti();
    if (!kalit) throw new AiXato('AI yoqilmagan: administrator AI kalitini kiritishi kerak', 503);
    const javob = await ovozSora(kalit, matn);
    ovoz = wavdanPcm(javob.bufer, javob);
  }
  const { pcm, chastota } = ovoz;
  const davomiylik = pcm.length / chastota;
  if (davomiylik < QADAM_ENG_QISQA) throw new AiXato("Ovoz juda qisqa chiqdi — qayta urinib ko'ring");
  // Matnga mos kelmaydigan uzunlik — yarmida uzilgan yoki noto'g'ri o'qilgan ovoz: dars bo'lib saqlanmasin.
  const kutilgan = matn.length / NUTQ_TEZLIGI;
  if (davomiylik < kutilgan * UZUNLIK_ENG_KAM || davomiylik > kutilgan * UZUNLIK_ENG_KOP + UZUNLIK_ZAXIRA) {
    throw new AiXato("Ovoz uzunligi matnga mos kelmadi — qayta urinib ko'ring");
  }
  // +6 — qadam oxiridagi pauza ham vaqt oladi (bir necha belgi o'qilgancha).
  const chegaralar = chegaralarniTop(pcm, chastota, nutqlar.map(n => n.length + 6));
  return { mp3: await mp3ga(pcm, chastota), chegaralar, davomiylik };
}
