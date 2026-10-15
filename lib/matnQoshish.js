// Ovozli ko'rsatma (MikrofonTugma) matni mavjud maydonga qo'shiladi — yozilgan narsa hech qachon o'chmaydi.

/**
 * `oldingi` matn oxiriga `qoshiladigan` ni bo'sh joy bilan qo'shadi; natija `maks` belgidan oshmaydi
 * (oshsa oxiri kesiladi, oldingi matn saqlanadi). Bo'sh qo'shiladigan matn — oldingisi o'zgarmaydi.
 * @param {string | null | undefined} oldingi
 * @param {string | null | undefined} qoshiladigan
 * @param {number} [maks]
 * @returns {string}
 */
export function matnQoshish(oldingi, qoshiladigan, maks = Infinity) {
  const eski = String(oldingi ?? '');
  const yangi = String(qoshiladigan ?? '').trim();
  if (!yangi) return eski;
  const bosh = eski.trim();
  return `${bosh ? `${bosh} ` : ''}${yangi}`.slice(0, maks);
}
