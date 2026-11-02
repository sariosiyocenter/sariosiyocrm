// Code 128 (B to'plami) shtrix-kodi — varaq kodini oddiy qo'l skaneri (USB «barcode gun») bilan
// kiritish uchun: skaner kodni klaviaturadek yozadi va Enter bosadi. Har belgi — 6 ta chiziq/oraliq
// kengligi (jami 11 modul), oxirida «stop» (13 modul).

/** Qiymatlar 0..106 naqshlari (chiziq, oraliq, chiziq, …) — Code 128 standarti. */
export const NAQSHLAR = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const STOP = 106;

/** Matn (ASCII 32–126) → qiymatlar ketma-ketligi: start, belgilar, nazorat raqami, stop. */
export function code128Qiymatlari(matn: string): number[] {
  const belgilar = [...matn].map(c => c.charCodeAt(0));
  if (!belgilar.length || belgilar.some(k => k < 32 || k > 126)) throw new Error("Shtrix-kod uchun faqat lotin harflari, raqamlar va belgilar");
  const q = belgilar.map(k => k - 32);
  const nazorat = (START_B + q.reduce((a, v, i) => a + v * (i + 1), 0)) % 103;
  return [START_B, ...q, nazorat, STOP];
}

/** Modullar: [kenglik, qora?] ketma-ket (chiziq bilan boshlanadi). */
export function code128Modullari(matn: string): number[] {
  return code128Qiymatlari(matn).flatMap(v => [...NAQSHLAR[v]].map(Number));
}

/**
 * SVG to'rtburchaklari (mm): quti ichida, chap-o'ngda 10 modul jim joy; pastida matn uchun joy.
 * Juda tor quti — modul 0.25 mm dan kichik bo'lmaydi (skaner o'qiy olmaydi), bunday holda kenglik kesilmaydi.
 */
export function shtrixSvg(matn: string, q: { x: number; y: number; w: number; h: number }, f = (n: number) => Math.round(n * 1000) / 1000): string {
  const m = code128Modullari(matn);
  const jami = m.reduce((a, v) => a + v, 0) + 20;
  const modul = Math.max(0.25, q.w / jami);
  const yozuvH = Math.min(3.2, q.h * 0.28);
  const barH = q.h - yozuvH - 0.6;
  const kenglik = jami * modul;
  let x = q.x + (q.w - kenglik) / 2 + 10 * modul;
  const out: string[] = [];
  m.forEach((w, i) => {
    if (i % 2 === 0) out.push(`<rect x="${f(x)}" y="${f(q.y)}" width="${f(w * modul)}" height="${f(barH)}" fill="#000"/>`);
    x += w * modul;
  });
  out.push(`<text x="${f(q.x + q.w / 2)}" y="${f(q.y + q.h - 0.5)}" font-family="'Courier New', monospace" font-size="${f(yozuvH * 0.95)}" text-anchor="middle" letter-spacing="0.4" fill="#000">${matn.replace(/[<&>]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c] as string))}</text>`);
  return out.join('');
}
