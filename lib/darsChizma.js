// Video dars chizmasi (egasi, 2026-10-14: "rasm ham bo'lsin, chizib bersin — avval X o'qi, keyin Y,
// keyin aylana yoki parallelepiped"). AI har qadamga doskaga CHIZILADIGAN elementlarni beradi
// (rasm emas — ro'yxat: o'qlar, nuqta, kesma, aylana, grafik, jism…), pleer ularni SVG qilib
// qadam-baqadam "chizadi" (src/components/imtihon/dars/Chizma.tsx). Elementlar qadamdan qadamga
// yig'iladi — doskadagidek, avval chizilgani o'chmaydi.
//
// Bu fayl ham serverda (AI javobini tozalash), ham brauzerda (geometriya) ishlaydi — Node'ga xos
// narsa ishlatilmaydi. Hamma koordinatalar — matematik (y yuqoriga); pikselga pleer o'giradi.

import { ifodaniKompilyatsiya, IFODA_MAX } from './ifoda.js';

export const CHIZMA_TURLARI = ['oqlar', 'nuqta', 'kesma', 'aylana', 'yoy', 'burchak', 'kopburchak', 'grafik', 'matn', 'jism'];
export const JISM_TURLARI = ['parallelepiped', 'kub', 'piramida', 'silindr', 'konus', 'shar'];
export const CHIZMA_RANGLARI = ['asosiy', 'urgu', 'ikkinchi'];
export const QADAMDA_ELEMENT_MAX = 12;
export const DARSDA_ELEMENT_MAX = 40;
const KOORDINATA_MAX = 1000;
const NOM_MAX = 40;
const NUQTA_MAX = 12;

// --- Tozalash (server) -------------------------------------------------------

const son = (v, standart = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(-KOORDINATA_MAX, Math.min(KOORDINATA_MAX, Math.round(n * 1000) / 1000)) : standart;
};
const musbat = (v, standart = 1) => { const n = son(v, standart); return n > 0 ? n : standart; };
const nom = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NOM_MAX);
const rang = (v) => (CHIZMA_RANGLARI.includes(v) ? v : 'asosiy');

/** Hamma maydon son bo'lib berilganmi (null, '' va yo'q — berilmagan; aks holda element 0;0 da "arvoh" bo'lardi). */
const berilgan = (x, ...kalitlar) => kalitlar.every(k => x[k] !== null && x[k] !== '' && x[k] !== undefined && Number.isFinite(Number(x[k])));
const KERAKLI = { nuqta: ['x', 'y'], aylana: ['x', 'y', 'r'], yoy: ['x', 'y', 'r'], burchak: ['x', 'y', 'x1', 'y1', 'x2', 'y2'], matn: ['x', 'y'] };

/** Bitta element → toza shakl; tanilmasa yoki ma'nosiz bo'lsa — null. */
export function elementniTozala(x) {
  if (!x || typeof x !== 'object' || !CHIZMA_TURLARI.includes(x.tur)) return null;
  if (KERAKLI[x.tur] && !berilgan(x, ...KERAKLI[x.tur])) return null;
  if (x.tur === 'kesma' && !(x.uch1 && x.uch2) && !berilgan(x, 'x1', 'y1', 'x2', 'y2')) return null;
  const umumiy = { tur: x.tur, rang: rang(x.rang), ...(nom(x.nom) ? { nom: nom(x.nom) } : {}) };
  switch (x.tur) {
    case 'oqlar': {
      const xdan = son(x.xdan, -5), xgacha = son(x.xgacha, 5), ydan = son(x.ydan, -5), ygacha = son(x.ygacha, 5);
      if (!(xgacha > xdan && ygacha > ydan)) return null;
      // birlik 'pi' — X o'qidagi bo'linmalar π bilan (π/2, π, 3π/2…): trigonometrik grafiklar uchun.
      return { tur: 'oqlar', xdan, xgacha, ydan, ygacha, ...(x.birlik === 'pi' ? { birlik: 'pi' } : {}) };
    }
    case 'nuqta': return { ...umumiy, x: son(x.x), y: son(x.y) };
    case 'kesma': {
      // Jism uchlari orasidagi kesma (diagonal, balandlik): uchlar nomi bilan — AI proyeksiyani bilmaydi.
      const uchlar = nom(x.uch1) && nom(x.uch2) ? { uch1: nom(x.uch1).slice(0, 4), uch2: nom(x.uch2).slice(0, 4) } : null;
      return {
        ...umumiy, ...(uchlar || { x1: son(x.x1), y1: son(x.y1), x2: son(x.x2), y2: son(x.y2) }),
        ...(x.uzuq ? { uzuq: true } : {}), ...(x.strelka ? { strelka: true } : {}),
      };
    }
    case 'aylana': return { ...umumiy, x: son(x.x), y: son(x.y), r: musbat(x.r), ...(x.uzuq ? { uzuq: true } : {}) };
    case 'yoy': return { ...umumiy, x: son(x.x), y: son(x.y), r: musbat(x.r), dan: son(x.dan, 0), gacha: son(x.gacha, 90) };
    // Burchak belgisi: uchi (x, y) va ikki tomonidagi nuqtalar; to'g'ri burchak — kvadratcha bilan.
    case 'burchak': return { ...umumiy, x: son(x.x), y: son(x.y), x1: son(x.x1), y1: son(x.y1), x2: son(x.x2), y2: son(x.y2), ...(x.togri ? { togri: true } : {}) };
    case 'kopburchak': {
      const nuqtalar = (Array.isArray(x.nuqtalar) ? x.nuqtalar : []).slice(0, NUQTA_MAX)
        .filter(n => n && typeof n === 'object').map(n => ({ x: son(n.x), y: son(n.y), ...(nom(n.nom) ? { nom: nom(n.nom) } : {}) }));
      if (nuqtalar.length < 2) return null;
      return { ...umumiy, nuqtalar, ...(x.yopiq === false ? { yopiq: false } : {}), ...(x.uzuq ? { uzuq: true } : {}) };
    }
    case 'grafik': {
      const ifoda = String(x.ifoda ?? '').slice(0, IFODA_MAX);
      if (!ifodaniKompilyatsiya(ifoda)) return null;
      const dan = x.dan == null ? null : son(x.dan);
      const gacha = x.gacha == null ? null : son(x.gacha);
      return { ...umumiy, ifoda, ...(dan != null && gacha != null && gacha > dan ? { dan, gacha } : {}), ...(x.uzuq ? { uzuq: true } : {}) };
    }
    case 'matn': {
      const matn = nom(x.matn);
      return matn ? { tur: 'matn', rang: umumiy.rang, x: son(x.x), y: son(x.y), matn } : null;
    }
    case 'jism': {
      if (!JISM_TURLARI.includes(x.jism)) return null;
      const a = musbat(x.a, 4);
      return {
        ...umumiy, jism: x.jism, x: son(x.x), y: son(x.y),
        a, b: x.jism === 'kub' ? a : musbat(x.b, 3), c: x.jism === 'kub' ? a : musbat(x.c, 3),
        r: musbat(x.r, 2), h: musbat(x.h, 4),
        ...(nom(x.belgilar) ? { belgilar: nom(x.belgilar).replace(/\s+/g, '').slice(0, 8) } : {}),
      };
    }
    default: return null;
  }
}

/** Qadamning chizmasi: toza elementlar (ko'pi bilan 12 ta). `qolgan` — darsda yana nechta element sig'adi. */
export function chizmaniTozala(xom, qolgan = DARSDA_ELEMENT_MAX) {
  return (Array.isArray(xom) ? xom : []).map(elementniTozala).filter(Boolean).slice(0, Math.max(0, Math.min(QADAMDA_ELEMENT_MAX, qolgan)));
}

// --- Geometriya (pleer va chegaralar) ----------------------------------------

// Fazoviy jism — qiya proyeksiya (darslikdagidek): chuqurlik o'qi 45° da, yarim uzunlikda.
const CHUQURLIK = 0.38;
const proyeksiya = (x0, y0, X, Y, Z) => [x0 + X + Z * CHUQURLIK, y0 + Y + Z * CHUQURLIK];
const indeksli = (h) => `${h}₁`;

/**
 * Jism → oddiy bo'laklar (matematik koordinatada): chiziqlar [{a, b, yashirin}], ellipslar
 * [{c, rx, ry, yarim: 'old' | 'orqa' | null, yashirin}], belgilar [{p, matn}].
 */
export function jismBolaklari(j) {
  const chiziqlar = [];
  const ellipslar = [];
  const belgilar = [];
  const { x, y } = j;
  if (j.jism === 'parallelepiped' || j.jism === 'kub' || j.jism === 'piramida') {
    const { a, b } = j;
    const balandlik = j.jism === 'piramida' ? j.h : j.c;
    // Asos: A (old chap), B (old o'ng), C (orqa o'ng), D (orqa chap — ko'rinmaydigan uch).
    const asos = [[0, 0], [a, 0], [a, b], [0, b]].map(([X, Z]) => proyeksiya(x, y, X, 0, Z));
    const harflar = (j.belgilar || (j.jism === 'piramida' ? 'ABCDS' : 'ABCD')).split('');
    const yashirinmi = (i, k) => i === 3 || k === 3;
    for (let i = 0; i < 4; i++) chiziqlar.push({ a: asos[i], b: asos[(i + 1) % 4], yashirin: yashirinmi(i, (i + 1) % 4) });
    asos.forEach((p, i) => harflar[i] && belgilar.push({ p, matn: harflar[i] }));
    if (j.jism === 'piramida') {
      const S = proyeksiya(x, y, a / 2, balandlik, b / 2);
      asos.forEach((p, i) => chiziqlar.push({ a: p, b: S, yashirin: i === 3 }));
      belgilar.push({ p: S, matn: harflar[4] || 'S' });
    } else {
      const tepa = [[0, 0], [a, 0], [a, b], [0, b]].map(([X, Z]) => proyeksiya(x, y, X, balandlik, Z));
      for (let i = 0; i < 4; i++) {
        chiziqlar.push({ a: tepa[i], b: tepa[(i + 1) % 4], yashirin: false });
        chiziqlar.push({ a: asos[i], b: tepa[i], yashirin: i === 3 });
      }
      tepa.forEach((p, i) => harflar[i] && belgilar.push({ p, matn: harflar.length > 4 ? (harflar[i + 4] || indeksli(harflar[i])) : indeksli(harflar[i]) }));
    }
  } else if (j.jism === 'silindr' || j.jism === 'konus') {
    const { r, h } = j;
    const ry = r * CHUQURLIK;
    ellipslar.push({ c: [x, y], rx: r, ry, yarim: 'old', yashirin: false }, { c: [x, y], rx: r, ry, yarim: 'orqa', yashirin: true });
    if (j.jism === 'silindr') {
      ellipslar.push({ c: [x, y + h], rx: r, ry, yarim: null, yashirin: false });
      chiziqlar.push({ a: [x - r, y], b: [x - r, y + h] }, { a: [x + r, y], b: [x + r, y + h] });
    } else {
      chiziqlar.push({ a: [x - r, y], b: [x, y + h] }, { a: [x + r, y], b: [x, y + h] });
    }
    // Balandlik va radius — uzuq chiziq bilan (darslikdagidek).
    chiziqlar.push({ a: [x, y], b: [x, y + h], yashirin: true }, { a: [x, y], b: [x + r, y], yashirin: true });
  } else if (j.jism === 'shar') {
    const { r } = j;
    ellipslar.push({ c: [x, y], rx: r, ry: r, yarim: null, yashirin: false });
    ellipslar.push({ c: [x, y], rx: r, ry: r * CHUQURLIK, yarim: 'old', yashirin: false }, { c: [x, y], rx: r, ry: r * CHUQURLIK, yarim: 'orqa', yashirin: true });
    chiziqlar.push({ a: [x, y], b: [x + r, y], yashirin: true });
  }
  return { chiziqlar, ellipslar, belgilar: belgilar.map(b => ({ ...b, matn: b.matn.slice(0, 4) })) };
}

/** Uch nomi taqqoslash uchun: katta harf, pastki indeks — oddiy raqam ("C₁" = "c1"). */
const uchNomi = (s) => String(s ?? '').toUpperCase().replace(/[₀-₉]/g, h => String(h.charCodeAt(0) - 0x2080));

/** Doskadagi jismlarning uchlari: nom → [x, y] (kesmaning uch1/uch2 si shundan topiladi). */
export function jismUchlari(elementlar) {
  const uchlar = new Map();
  for (const e of elementlar) if (e.tur === 'jism') jismBolaklari(e).belgilar.forEach(b => uchlar.set(uchNomi(b.matn), b.p));
  return { top: (nomi) => uchlar.get(uchNomi(nomi)) || null };
}

/** Elementlarning matematik chegarasi {xdan, xgacha, ydan, ygacha} (grafik — o'qlar oralig'ida chiziladi). */
export function chizmaChegarasi(elementlar) {
  const xs = [];
  const ys = [];
  const qosh = (x, y) => { xs.push(x); ys.push(y); };
  for (const e of elementlar) {
    if (e.tur === 'oqlar') { qosh(e.xdan, e.ydan); qosh(e.xgacha, e.ygacha); }
    else if (e.tur === 'nuqta' || e.tur === 'matn') qosh(e.x, e.y);
    else if (e.tur === 'kesma' && !e.uch1) { qosh(e.x1, e.y1); qosh(e.x2, e.y2); }
    else if (e.tur === 'aylana' || e.tur === 'yoy') { qosh(e.x - e.r, e.y - e.r); qosh(e.x + e.r, e.y + e.r); }
    else if (e.tur === 'burchak') qosh(e.x, e.y);
    else if (e.tur === 'kopburchak') e.nuqtalar.forEach(n => qosh(n.x, n.y));
    else if (e.tur === 'grafik' && e.dan != null) { qosh(e.dan, 0); qosh(e.gacha, 0); }
    else if (e.tur === 'jism') {
      const { chiziqlar, ellipslar } = jismBolaklari(e);
      chiziqlar.forEach(c => { qosh(...c.a); qosh(...c.b); });
      ellipslar.forEach(el => { qosh(el.c[0] - el.rx, el.c[1] - el.ry); qosh(el.c[0] + el.rx, el.c[1] + el.ry); });
    }
  }
  if (!xs.length) return { xdan: -5, xgacha: 5, ydan: -5, ygacha: 5 };
  let xdan = Math.min(...xs), xgacha = Math.max(...xs), ydan = Math.min(...ys), ygacha = Math.max(...ys);
  // Bitta nuqta yoki tekis chiziq — bo'sh joy qo'shiladi (nolga bo'linmasin).
  if (xgacha - xdan < 1) { xdan -= 1; xgacha += 1; }
  if (ygacha - ydan < 1) { ydan -= 1; ygacha += 1; }
  return { xdan, xgacha, ydan, ygacha };
}

/** O'q bo'linmalari qadami: oraliqda 4–8 ta bo'linma bo'ladigan "chiroyli" son (1, 2, 5, 10…). */
export function bolinmaQadami(oraliq) {
  const xom = oraliq / 8;
  const daraja = Math.pow(10, Math.floor(Math.log10(xom)));
  return [1, 2, 5, 10].map(k => k * daraja).find(q => oraliq / q <= 8) || 10 * daraja;
}
