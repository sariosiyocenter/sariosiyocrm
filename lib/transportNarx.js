/**
 * Transport yo'l haqi: har bir haydovchining o'z tarifi.
 *
 * Egasi (2026-09-19): "за одного ученика условно 5 000 сум или сами
 * настраиваем: до 5 км — 3 000, до 10 км — 10 000 … для каждого водителя".
 * Ikki xil tarif:
 *   - bir:    har bir o'quvchi uchun bir xil narx;
 *   - masofa: markazdan uyigacha masofaga qarab oraliqlar ("5 km gacha — 3 000"),
 *             oxirgi oraliqdan uzog'i — `uzoq` narxi (bo'lmasa oxirgi oraliq narxi).
 *
 * Masofa — markazdan uygacha TO'G'RI CHIZIQ bo'yicha (xaritadagi nuqtalar).
 * Yo'l bo'ylab odatda biroz uzunroq; tarif oraliqlari shuni hisobga olib
 * qo'yiladi. Narx reja tuzilgan paytda bekatga yozib qo'yiladi — keyin tarif
 * o'zgarsa ham o'tgan rejalar o'zgarmaydi.
 *
 * Fayl sof: bazaga ham, brauzerga ham bog'liq emas (ikkalasida ishlatiladi).
 */
import { distanceKm, parseLatLng } from './tartib.js';

export const TARIF_TURLARI = ['bir', 'masofa'];
const ENG_KATTA_NARX = 10_000_000;
const ENG_KOP_ORALIQ = 10;

const butun = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= ENG_KATTA_NARX ? n : null;
};

/**
 * So'rovdan kelgan tarifni tekshiradi va tozalaydi.
 * @returns {{tarif: object|null, xato?: string}} — null: tarif olib tashlandi
 */
export function tarifniTozalash(raw) {
  if (raw === null || raw === undefined || raw === '') return { tarif: null };
  if (typeof raw !== 'object') return { tarif: null, xato: "Tarif noto'g'ri" };
  if (!TARIF_TURLARI.includes(raw.tur)) return { tarif: null, xato: "Tarif turi noto'g'ri" };

  if (raw.tur === 'bir') {
    const narx = butun(raw.narx);
    if (narx === null) return { tarif: null, xato: "Bir o'quvchi uchun narxni kiriting" };
    return { tarif: { tur: 'bir', narx } };
  }

  const oraliqlar = (Array.isArray(raw.oraliqlar) ? raw.oraliqlar : [])
    .map(o => ({ km: Number(o?.km), narx: butun(o?.narx) }))
    .filter(o => Number.isFinite(o.km) && o.km > 0 && o.narx !== null)
    .map(o => ({ km: Math.round(o.km * 10) / 10, narx: o.narx }))
    .sort((a, b) => a.km - b.km);
  if (!oraliqlar.length) return { tarif: null, xato: 'Kamida bitta masofa oralig\'ini kiriting (masalan: 5 km gacha — 3 000)' };
  if (oraliqlar.length > ENG_KOP_ORALIQ) return { tarif: null, xato: `Oraliqlar ${ENG_KOP_ORALIQ} tadan oshmasin` };
  if (new Set(oraliqlar.map(o => o.km)).size !== oraliqlar.length) return { tarif: null, xato: 'Bir xil masofa ikki marta yozilgan' };
  const uzoq = raw.uzoq === '' || raw.uzoq === null || raw.uzoq === undefined ? null : butun(raw.uzoq);
  return { tarif: { tur: 'masofa', oraliqlar, uzoq } };
}

/** Markazdan uygacha masofa (km, 0.1 gacha yaxlitlangan) yoki null. */
export function uyMasofasi(markaz, location) {
  const uy = parseLatLng(location);
  if (!markaz || !uy) return null;
  return Math.round(distanceKm(markaz, uy) * 10) / 10;
}

/**
 * Bitta o'quvchining yo'l haqi.
 * @returns {{narx: number|null, sabab?: string}}
 */
export function narxHisobla(tarif, km) {
  if (!tarif) return { narx: null, sabab: 'haydovchi tarifi kiritilmagan' };
  if (tarif.tur === 'bir') return { narx: tarif.narx };
  if (km === null || km === undefined) return { narx: null, sabab: 'uy xaritada belgilanmagan' };
  const oraliq = tarif.oraliqlar.find(o => km <= o.km);
  if (oraliq) return { narx: oraliq.narx };
  const oxirgi = tarif.oraliqlar[tarif.oraliqlar.length - 1];
  return { narx: tarif.uzoq ?? oxirgi.narx };
}

const som = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/ /g, ' ');

/** Tarifning qisqa matni: "5 000 so'm" yoki "5 km gacha 3 000 · 10 km gacha 10 000 · uzog'i 15 000". */
export function tarifMatni(tarif) {
  if (!tarif) return '';
  if (tarif.tur === 'bir') return `${som(tarif.narx)} so'm`;
  const qismlar = tarif.oraliqlar.map(o => `${o.km} km gacha ${som(o.narx)}`);
  if (tarif.uzoq !== null && tarif.uzoq !== undefined) qismlar.push(`uzog'i ${som(tarif.uzoq)}`);
  return qismlar.join(' · ') + " so'm";
}

/** Rejaning puli: hamma o'quvchi uchun va narxi aniqlanmaganlar soni. */
export function rejaSummasi(narxlar) {
  let jami = 0;
  let aniqlanmagan = 0;
  for (const n of narxlar) {
    if (n === null || n === undefined) aniqlanmagan++;
    else jami += n;
  }
  return { jami, aniqlanmagan };
}

export { som as somMatni };
