// Xarajatni o'chirish muddati. Egasi (2026-09-29): "xarajatlarni o'chirish
// imkoniyati bo'lmasligi kerak, 15 minut". Xarajat faqat kiritilganidan
// keyin 15 daqiqa ichida (xato yozilganini darrov tuzatish uchun) o'chiriladi,
// keyin — hech kim, administrator ham o'chira olmaydi: kassa va hisobotdagi
// chiqim izsiz yo'qolmasin. Oylik to'lovi ham xarajat — unga ham shu qoida.
// Server (server.js) ham, mijoz (Finance, xodim kartasi) ham shu fayldan oladi.

export const XARAJAT_OCHIRISH_DAQIQA = 15;
const MUDDAT_MS = XARAJAT_OCHIRISH_DAQIQA * 60 * 1000;

/**
 * Yana necha millisoniya o'chirsa bo'ladi (0 — muddat o'tgan).
 * Vaqti yo'q (eski) yozuv — o'chirib bo'lmaydi.
 */
export function ochirishQoldi(createdAt, hozir = Date.now()) {
  const t = createdAt ? new Date(createdAt).getTime() : NaN;
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, t + MUDDAT_MS - hozir);
}

export const OCHIRISH_MUDDATI_XATO =
  `Xarajatni faqat kiritilganidan keyin ${XARAJAT_OCHIRISH_DAQIQA} daqiqa ichida o'chirish mumkin. Muddat o'tgan.`;
