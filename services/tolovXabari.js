// To'lov qabul qilinganda ota-onaga avtomatik xabar (egasi, 2026-09-24:
// "to'lov qilinganda ham sms borishi kerak avtomatik").
//
// Xabar matni, kanali va kimga ketishi — Xabarlar → Avtomatik qoidalardagi
// "To'lov qabul qilinganda" (PAYMENT_CONFIRM) qoidasi. Yuborish SMS/Telegram
// kodiga bog'liq, u esa server.js da — shuning uchun server o'zini shu yerga
// ulaydi (transportNotify.js dagi kabi), Payme marshruti ham shu funksiyani
// chaqiradi.

let yuboruvchi = null;

export function tolovXabariniUlash(fn) {
  yuboruvchi = fn;
}

// Vercel javobdan keyingi ishni to'xtatadi, shuning uchun javobdan oldin
// kutiladi — lekin Eskiz sekinlashsa kassa oynasi osilib qolmasin.
const KUTISH_MS = 8000;

/**
 * @param {object} payment  Payment qatori (id, studentId, amount, type, schoolId)
 * @param {object} [opts]   { kanal: 'SMS' } — Payme Telegram xabarini o'zi yuboradi
 * @returns {Promise<{yuborildi?: boolean, sabab?: string}|null>}
 */
export async function tolovXabari(payment, opts = {}) {
  if (!yuboruvchi || !payment) return null;
  let timer;
  try {
    return await Promise.race([
      yuboruvchi(payment, opts),
      new Promise(resolve => { timer = setTimeout(() => resolve({ yuborildi: false, sabab: 'kutish vaqti tugadi' }), KUTISH_MS); }),
    ]);
  } catch (e) {
    console.error("[To'lov xabari]", e.message);
    return { yuborildi: false, sabab: e.message };
  } finally {
    clearTimeout(timer);
  }
}
