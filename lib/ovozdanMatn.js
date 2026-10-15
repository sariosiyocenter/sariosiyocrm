// Ustozning ovozli ko'rsatmasi → matn (egasi, 2026-10-15: "yechim videosi uchun mikrofonni yoqib
// yo'l-yo'riq berish"). Brauzer yozgan qisqa audio (webm/ogg/m4a) Gemini ga beriladi, u so'zma-so'z
// matnga yozadi. Matn ustozga qaytadi — u ko'rib, tuzatib, keyin AI ga yuboradi (jim o'tib ketmaydi).
// Model chaqiruvi, kalit va xatolar — lib/imtihonAI.js dagi umumiy qismlar orqali.

import { AiXato, aiKaliti, modelgaSora } from './imtihonAI.js';

/** Audio hajmi chegarasi (bayt) — taxminan 2 daqiqa nutq; so'rovning umumiy 3 MB chegarasiga sig'adi. */
export const AUDIO_MAX = 2 * 1024 * 1024;
export const MATN_MAX = 1200;
// Brauzerlar yozadigan formatlar (Chrome — webm, Firefox — ogg, Safari — mp4/m4a) → Gemini tushunadigan nom.
const TURLAR = { 'audio/webm': 'audio/webm', 'audio/ogg': 'audio/ogg', 'audio/mp4': 'audio/m4a', 'audio/m4a': 'audio/m4a', 'audio/x-m4a': 'audio/m4a', 'audio/mpeg': 'audio/mpeg', 'audio/wav': 'audio/wav', 'audio/aac': 'audio/aac' };

let soxta = null;
/** Sinov uchun: haqiqiy model o'rniga funksiya ({qism}) => matn. */
export function soxtaOvozdanMatnniQoy(f) { soxta = f; }

/**
 * data URL ("data:audio/webm;codecs=opus;base64,....") → Gemini inlineData qismi. Format yoki hajm
 * mos kelmasa — AiXato (400).
 */
export function audioQismi(dataUrl) {
  const m = /^data:(audio\/[a-z0-9.+-]+)(?:;[^,;]*?)*;base64,([A-Za-z0-9+/=]+)$/i.exec(String(dataUrl ?? ''));
  const tur = m && TURLAR[m[1].toLowerCase()];
  if (!tur) throw new AiXato("Ovoz formati noto'g'ri — qayta yozib ko'ring", 400);
  if (m[2].length * 0.75 > AUDIO_MAX) throw new AiXato('Ovoz juda uzun — 2 daqiqagacha gapiring', 413);
  if (m[2].length < 400) throw new AiXato("Ovoz juda qisqa — qayta yozib ko'ring", 400);
  return { inlineData: { mimeType: tur, data: m[2] } };
}

/** Model javobini toza matnga: bir-ikki qator, Markdownsiz, chegaralangan. */
export function matnniTozala(s) {
  return String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').replace(/[*`#]+/g, '')
    .replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim().slice(0, MATN_MAX);
}

const KORSATMA = "Bu — o'qituvchining qisqa ovozli ko'rsatmasi (o'zbek yoki rus tilida, aralash bo'lishi mumkin). Uni AYNAN, so'zma-so'z matnga yozing: tinish belgilarini qo'ying, o'zbekcha so'zlarni lotin yozuvida yozing, o'zingizdan hech narsa qo'shmang va javob bermang. Nutq bo'lmasa yoki tushunarsiz bo'lsa — bo'sh qator qaytaring. Faqat matnning o'zini qaytaring.";

/** Audio data URL → matn ('' — nutq topilmadi). */
export async function ovozdanMatn(dataUrl) {
  const qism = audioQismi(dataUrl);
  if (soxta) return matnniTozala(await soxta({ qism }));
  const kalit = aiKaliti();
  if (!kalit) throw new AiXato('AI yoqilmagan: administrator AI kalitini kiritishi kerak', 503);
  const javob = await modelgaSora(kalit, {
    contents: [{ role: 'user', parts: [{ text: KORSATMA }, qism] }],
    // 2.5 modellarda "o'ylash" ham shu chegaraga kiradi.
    config: { temperature: 0, maxOutputTokens: 4096 },
  });
  return matnniTozala(javob?.text);
}
