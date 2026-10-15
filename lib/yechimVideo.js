// Yechim + video yechimni bitta amalda yaratish (egasi, 2026-10-15: "yechim + videoni bitta qilib
// yaratish"). Bu yerda faqat sof mantiq: qaysi bosqichlar bor, AI yozgan yechim ustozning ko'zisiz
// saqlansa bo'ladimi va natija xabari. So'rovlarning o'zi mijozda ketma-ket yuboriladi
// (src/components/imtihon/bank/yechimVideo.ts): yechim/ai → yechim (PUT) → dars/ai → dars (PUT) → dars/ovoz.
// Yangi saqlangan yechim bazada turadi — video yechim serverda aynan undan tuziladi va «eskirgan» emas.

/** Bosqichlar tartibi: yechim (kerak bo'lsa), video yechim (ssenariy va chizma), ovoz. */
export const BOSQICHLAR = ['yechim', 'video', 'ovoz'];

const BOSQICH_NOMI = {
  yechim: 'AI yechimni yozmoqda… odatda 10–30 soniya',
  video: 'AI video yechimni va chizmani tayyorlamoqda… odatda 15–40 soniya',
  ovoz: 'Ovoz yozilmoqda… odatda 10–40 soniya',
};

/**
 * Amalda qatnashadigan bosqichlar. `yechim` — yechim ham yoziladi; `ovoz` — ovoz yoziladi (AI yoqilgan).
 */
export function bosqichlar({ yechim = false, ovoz = true } = {}) {
  return BOSQICHLAR.filter(b => (b === 'yechim' ? yechim : b === 'ovoz' ? ovoz : true));
}

/** «2/3 · AI video yechimni… tayyorlamoqda» — bitta qatorli jarayon holati. */
export function bosqichMatni(bosqich, { yechim = false, ovoz = true } = {}) {
  const royxat = bosqichlar({ yechim, ovoz });
  const i = royxat.indexOf(bosqich);
  const nom = BOSQICH_NOMI[bosqich];
  if (!nom) return '';
  return i < 0 ? nom : `${i + 1}/${royxat.length} · ${nom}`;
}

/**
 * AI yozgan yechimni (POST yechim/ai javobi) ustoz ko'rmay saqlab bo'lmaydimi: javobi bankdagi
 * javobdan farq qilsa yoki savoldagi rasm modelga to'liq yetmagan bo'lsa. `mos === null`
 * (yozma savol, erkin javob — solishtirib bo'lmadi) bu yerda to'sqinlik emas: qoralama bo'lib saqlanadi.
 */
export function yechimTekshirishKerakmi(r) {
  if (!r) return true;
  if (r.mos === false || r.rasmKerak) return true;
  const rasm = r.rasm || {};
  return (rasm.jami || 0) > (rasm.berildi || 0);
}

/** Yechim o'zi «tasdiqlangan» bo'lib saqlanadimi: AI javobi bankdagi javobga aniq mos chiqqan (va rasm ko'ringan). */
export const yechimOzTasdiqlansinmi = (r) => !!r && r.mos === true && !yechimTekshirishKerakmi(r);

/**
 * Birgalikda yaratish tugagandagi bitta xabar. Qaytaradi: {matn, turi: 'success' | 'info'}.
 * `yechimYozildi` — yechim ham shu amalda yozildi; `yechimTasdiq` — u tasdiqlangan holda saqlandi.
 */
export function natijaXabari({ yechimYozildi = false, yechimTasdiq = false, ovoz = false, ovozXato = null } = {}) {
  const yechim = yechimYozildi ? `Yechim (${yechimTasdiq ? 'tasdiqlangan' : 'qoralama'}) va video yechim` : 'Video yechim';
  if (ovozXato) return { matn: `${yechim} saqlandi, lekin ovoz yozilmadi: ${ovozXato}`, turi: 'info' };
  return { matn: `${yechim} tayyor${ovoz ? '' : ' (ovozsiz)'} — ko'rib, tasdiqlang`, turi: 'success' };
}
