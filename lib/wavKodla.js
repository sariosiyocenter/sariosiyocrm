// Mikrofon yozuvi → WAV (16 kHz, mono, 16 bit). MacBook'dagi Safari MediaRecorder bilan faqat MP4/AAC
// yozadi va bu yozuv ovozni matnga o'girishda ishlamadi (egasi, 2026-10-22: «macbookda ovoz bilan
// qilganimda ovoz yozvolmayapdimi?»). Bunday brauzerda ovoz Web Audio orqali xom namunalar bo'lib
// olinadi va shu yerda WAV ga aylanadi — Gemini uni har doim tushunadi. Sof funksiyalar (brauzer va test).

/** Nutq uchun yetarli chastota: Gemini ovozni baribir 16 kHz ga tushiradi. */
export const WAV_CHASTOTA = 16000;

/**
 * Bo'laklarni (Float32Array, −1…1) bitta qatorga yig'ib, `chastota` ga tushiradi: har yangi namuna — o'z
 * oralig'idagi asl namunalarning o'rtachasi (oddiy past chastota filtri ham bo'ladi).
 */
export function pastlat(bolaklar, aslChastota, chastota = WAV_CHASTOTA) {
  const jami = bolaklar.reduce((s, b) => s + b.length, 0);
  const asl = new Float32Array(jami);
  let joy = 0;
  for (const b of bolaklar) { asl.set(b, joy); joy += b.length; }
  if (!(aslChastota > chastota)) return asl;
  const nisbat = aslChastota / chastota;
  const chiqish = new Float32Array(Math.floor(jami / nisbat));
  for (let i = 0; i < chiqish.length; i++) {
    const [a, b] = [Math.floor(i * nisbat), Math.min(jami, Math.floor((i + 1) * nisbat))];
    let s = 0;
    for (let j = a; j < b; j++) s += asl[j];
    chiqish[i] = b > a ? s / (b - a) : 0;
  }
  return chiqish;
}

/** Float32 namunalar → WAV fayl baytlari (PCM 16 bit, mono). */
export function wavYasa(namunalar, chastota = WAV_CHASTOTA) {
  const bayt = new Uint8Array(44 + namunalar.length * 2);
  const v = new DataView(bayt.buffer);
  const matn = (joy, s) => { for (let i = 0; i < s.length; i++) v.setUint8(joy + i, s.charCodeAt(i)); };
  matn(0, 'RIFF');
  v.setUint32(4, 36 + namunalar.length * 2, true);
  matn(8, 'WAVE');
  matn(12, 'fmt ');
  v.setUint32(16, 16, true);          // fmt bo'lagi uzunligi
  v.setUint16(20, 1, true);           // PCM
  v.setUint16(22, 1, true);           // mono
  v.setUint32(24, chastota, true);
  v.setUint32(28, chastota * 2, true); // bayt/soniya
  v.setUint16(32, 2, true);           // namuna bloki
  v.setUint16(34, 16, true);          // bit
  matn(36, 'data');
  v.setUint32(40, namunalar.length * 2, true);
  for (let i = 0; i < namunalar.length; i++) {
    const s = Math.max(-1, Math.min(1, namunalar[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bayt;
}
