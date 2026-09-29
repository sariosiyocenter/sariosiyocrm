/**
 * Vercel javob qaytgach funksiyani muzlatadi: fondagi ish (Telegram, Eskiz)
 * yarmida uzilib "Telegram timeout" / "fetch failed" bo'lardi — 2026-09-27
 * dagi 12:00 tug'ilgan kun tabrigi shunday ketmadi. waitUntil funksiyani ish
 * tugaguncha tirik tutadi (@vercel/functions shu kontekstdan foydalanadi).
 * Lokal serverda yo'q — oddiy fon ishi bo'lib qoladi.
 *
 * server.js va Telegram bot (ommaviy xabar) shu yerdan oladi.
 */
export function vercelKonteksti() {
  try {
    return globalThis[Symbol.for('@vercel/request-context')]?.get?.() || null;
  } catch {
    return null;
  }
}

/** Ishni javobdan keyin ham oxirigacha bajartiradi. Vercel'da bo'lmasa — false. */
export function fondaTugat(promise) {
  const ctx = vercelKonteksti();
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(promise);
    return true;
  }
  return false;
}
