// Savollarni ommaviy tarjima qilish (bank ekrani: TarjimaKop.tsx) uchun sof yordamchilar:
// til tanlovi, bir martadagi chegara va cheklangan parallellikdagi navbat.

export const TARJIMA_TILLARI = [
  { v: 'uz', nom: "O'zbekcha" },
  { v: 'ru', nom: 'Ruscha' },
  { v: 'en', nom: 'Inglizcha' },
];

/** Bir martada nechta savol tarjima qilinadi (har biri bitta pullik AI so'rovi). */
export const TARJIMA_KOP_MAX = 30;
/** Bir vaqtda nechta so'rov (AI limiti va Vercel vaqti uchun). */
export const TARJIMA_PARALLEL = 2;

/** Savolning o'z tilidan boshqa tillar (o'zbek tiliga o'tkazish ham kerak bo'ladi). */
export const tarjimaTillari = (til) => TARJIMA_TILLARI.filter(t => t.v !== (til || 'uz'));

/** Tarjima tili bo'yicha boshlang'ich tanlov: o'zbekchaning tarjimasi — ruscha, boshqasiniki — o'zbekcha. */
export const boshTarjimaTili = (til) => ((til || 'uz') === 'uz' ? 'ru' : 'uz');

/** Tilning o'zbekcha nomi («Ruscha»); noma'lum bo'lsa — kodining o'zi. */
export const tilNomi = (til) => TARJIMA_TILLARI.find(t => t.v === til)?.nom || String(til || '');

/** Guruhli (juft, qismli) savol: bitta bo'lagi umumiy shartsiz ma'nosiz — server tarjima qilmaydi. */
export const tarjimaQilinmaydimi = (tur) => tur === 'juft' || tur === 'qismli';

/** id ro'yxatini tozalaydi (butun, takrorsiz) va chegaraga keltiradi. Qaytaradi: {olingan, ortiqcha}. */
export function idlarniChekla(ids, max = TARJIMA_KOP_MAX) {
  const toza = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(n => Number.isInteger(n) && n > 0))];
  return { olingan: toza.slice(0, max), ortiqcha: Math.max(0, toza.length - max) };
}

/**
 * Bitta savol tarjimasi xatosining turi: 'otkazildi' — savolning o'zi sabab (guruhli savol, allaqachon
 * shu tilda; AI ishlatilmagan), 'toxta' — limit yoki AI kaliti muammosi (qolganlari ham o'tmaydi),
 * 'xato' — boshqa xato (keyingisiga o'tiladi).
 */
export function tarjimaXatoTuri(status) {
  if (status === 429 || status === 503) return 'toxta';
  if (status === 400 || status === 404) return 'otkazildi';
  return 'xato';
}

/**
 * Elementlarni ko'pi bilan `parallel` tadan bir vaqtda bajaradi. `toxta()` rost bo'lsa yangisi
 * boshlanmaydi (boshlanganlari tugaydi). `fn(element, indeks)` xato tashlamasligi kerak.
 * @template T
 * @param {T[]} royxat
 * @param {(element: T, indeks: number) => Promise<void>} fn
 * @param {{ parallel?: number, toxta?: () => boolean }} [ayar]
 * @returns {Promise<void>}
 */
export async function navbatBilanBajar(royxat, fn, { parallel = TARJIMA_PARALLEL, toxta = () => false } = {}) {
  let keyingi = 0;
  const ishchi = async () => {
    while (!toxta()) {
      const i = keyingi++;
      if (i >= royxat.length) return;
      await fn(royxat[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, royxat.length)) }, ishchi));
}
