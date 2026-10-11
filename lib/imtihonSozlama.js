// Imtihon modulining umumiy sozlamasi — butun markazga bitta
// (Organization.imtihonSozlama). Egasi, 2026-10-10: «imtihonlarni o'zini sozlamasi
// bo'lsin» — Imtihonlar → Sozlamalar.
//
// Shakli: { yangi: { duration, scoring, settings } } — «Yangi imtihon» shu qiymatlar
// bilan ochiladi. `settings` — imtihonning o'z sozlamasidan (lib/imtihon.js
// sozlamaniTozala) faqat markaz bir marta belgilab qo'yadiganlari: format, natija,
// xabar matnlari. Har imtihonda o'zgartirsa bo'ladi; oldin yaratilgan imtihonlarga
// ta'sir qilmaydi. Bitta imtihongagina tegishlilari (xonalar, kalit, onlayn vaqtlari,
// varaq dizayni) bu yerda yo'q.
//
// Sof funksiyalar: server ham, brauzer ham shu fayldan foydalanadi (lib/imtihon.js kabi).

import { sozlamaniTozala, SOZLAMA_STANDART } from './imtihon.js';

/** Markaz standartiga kiradigan imtihon sozlamalari (qolgani — har imtihonning o'zida). */
export const YANGI_KALITLARI = [
  'source', 'sessions', 'variantCount', 'shuffleQuestions', 'shuffleOptions', 'variantBubble',
  'seatMode', 'xatoJarima', 'jarimaNoldan', 'otish',
  'ranking', 'topN', 'orinUsuli', 'showQuestionsAfter', 'rasch', 'notify', 'admit',
];

export const DAVOM_STANDART = 120;
const DAVOM_MIN = 10;
const DAVOM_MAX = 600;

const obyekt = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/**
 * Saqlangan (yoki brauzerdan kelgan) sozlama → to'liq va xavfsiz shakl. Noma'lum kalitlar
 * tashlanadi, yetishmagani — tizim standartidan (null — hali saqlanmagan markaz).
 */
export function imtihonSozlamaTozala(xom) {
  const y = obyekt(obyekt(xom).yangi);
  const toza = sozlamaniTozala(obyekt(y.settings));
  // So'rovnoma o'z tugmasi bilan yaratiladi — imtihonning standart manbasi bo'lolmaydi.
  if (toza.source === 'sorovnoma') toza.source = SOZLAMA_STANDART.source;
  const davom = parseInt(y.duration);
  return {
    yangi: {
      duration: Number.isFinite(davom) ? Math.min(DAVOM_MAX, Math.max(DAVOM_MIN, davom)) : DAVOM_STANDART,
      scoring: y.scoring === 'foiz' ? 'foiz' : 'blok',
      settings: Object.fromEntries(YANGI_KALITLARI.map(k => [k, toza[k]])),
    },
  };
}

/**
 * Yangi imtihon boshlanadigan holat: davomiyligi, ball tizimi va to'liq sozlama
 * (markaz belgilamaganlari — tizim standarti).
 */
export function yangiImtihonBoshi(xom) {
  const { yangi } = imtihonSozlamaTozala(xom);
  return { duration: yangi.duration, scoring: yangi.scoring, settings: sozlamaniTozala(yangi.settings) };
}
