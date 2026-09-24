// Javob varaqasini rasmdan o'qish — DOM siz, toza hisob (brauzerda Web Worker
// ichida, testda Node'da ishlaydi).
//
// Bosqichlar:
//   1. Kichraytirilgan rasmda mahalliy (adaptiv) chegara bilan qora dog'lar →
//      burchakdagi 4 ta kvadrat marker. O'rtadagi 2 tasi bo'lsa — qog'oz
//      egilishini ham to'g'rilaymiz (yuqori va pastki yarimga alohida gomografiya).
//   2. Yo'nalish: tepadagi qora chiziq qaysi tomonda qora chiqsa — o'sha.
//      Teskari yoki yonboshlab skanerlangan varaq ham o'qiladi.
//   3. Varaq mm koordinatasidagi to'g'rilangan tasvirga ko'chiriladi.
//   4. Qog'oz va siyoh darajasi varaqning o'zidan (markerlar — siyoh).
//   5. Har qatorda doirachalar chizig'iga qarab ±1.2 mm siljish topiladi,
//      keyin har doiracha ichining qancha qismi bo'yalgani o'lchanadi.
//   6. Aniq — javob; bo'sh — bo'sh; ikki belgi yoki noaniq — operatorga.

import jsQR from 'jsqr';
import { MARKER, MARKERLAR, YONALISH, SAHIFA_BELGILARI, SAHIFA_BELGI, W, H, qrniOqi } from './layout.ts';
import type { Sahifa, Doira, QrMalumot } from './layout.ts';

export interface Kulrang { w: number; h: number; d: Uint8Array }

type Nuqta = { x: number; y: number };
type Gomo = number[];

/** RGBA → kulrang (0 qora … 255 oq). */
export function kulrangga(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Kulrang {
  const d = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < d.length; i++, j += 4) d[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return { w, h, d };
}

function kichraytir(img: Kulrang, maxW: number): { img: Kulrang; k: number } {
  const k = Math.max(1, img.w / maxW);
  if (k === 1) return { img, k };
  const w = Math.max(1, Math.floor(img.w / k));
  const h = Math.max(1, Math.floor(img.h / k));
  const d = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * k), y1 = Math.max(y0 + 1, Math.floor((y + 1) * k));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * k), x1 = Math.max(x0 + 1, Math.floor((x + 1) * k));
      let s = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        const row = yy * img.w;
        for (let xx = x0; xx < x1; xx++) { s += img.d[row + xx]; n++; }
      }
      d[y * w + x] = s / n;
    }
  }
  return { img: { w, h, d }, k };
}

/** Mahalliy o'rtachadan sezilarli qora nuqtalar (soyali telefon rasmida ham ishlaydi). */
function adaptivQora(img: Kulrang): Uint8Array {
  const { w, h, d } = img;
  const W1 = w + 1;
  const S = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let qator = 0;
    for (let x = 0; x < w; x++) {
      qator += d[y * w + x];
      S[(y + 1) * W1 + x + 1] = S[y * W1 + x + 1] + qator;
    }
  }
  const r = Math.max(8, Math.round(w / 16));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r), yb = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r), xb = Math.min(w, x + r + 1);
      const n = (yb - ya) * (xb - xa);
      const sum = S[yb * W1 + xb] - S[ya * W1 + xb] - S[yb * W1 + xa] + S[ya * W1 + xa];
      const mean = sum / n;
      const v = d[y * w + x];
      if (v < mean - Math.max(14, mean * 0.16)) out[y * w + x] = 1;
    }
  }
  return out;
}

interface Dog { area: number; cx: number; cy: number; minx: number; maxx: number; miny: number; maxy: number }

function doglar(bin: Uint8Array, w: number, h: number): Dog[] {
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const out: Dog[] = [];
  let id = 0;
  for (let i = 0; i < bin.length; i++) {
    if (!bin[i] || label[i]) continue;
    id++;
    let sp = 0;
    stack[sp++] = i;
    label[i] = id;
    let area = 0, sx = 0, sy = 0, minx = w, maxx = 0, miny = h, maxy = 0;
    while (sp) {
      const p = stack[--sp];
      const x = p % w, y = (p - x) / w;
      area++; sx += x; sy += y;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      if (x > 0 && bin[p - 1] && !label[p - 1]) { label[p - 1] = id; stack[sp++] = p - 1; }
      if (x < w - 1 && bin[p + 1] && !label[p + 1]) { label[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && bin[p - w] && !label[p - w]) { label[p - w] = id; stack[sp++] = p - w; }
      if (y < h - 1 && bin[p + w] && !label[p + w]) { label[p + w] = id; stack[sp++] = p + w; }
    }
    if (area >= 12) out.push({ area, cx: sx / area, cy: sy / area, minx, maxx, miny, maxy });
  }
  return out;
}

// --- Gomografiya -------------------------------------------------------------

/** 4 juft nuqta: varaq (mm) → rasm (px). */
export function gomografiya(src: Nuqta[], dst: Nuqta[]): Gomo {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const piv = A[c][c] || 1e-12;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / piv;
      if (!f) continue;
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  const h = A.map((row, i) => row[8] / (row[i] || 1e-12));
  return [...h, 1];
}

export function qolla(Hm: Gomo, x: number, y: number): Nuqta {
  const z = Hm[6] * x + Hm[7] * y + Hm[8];
  return { x: (Hm[0] * x + Hm[1] * y + Hm[2]) / z, y: (Hm[3] * x + Hm[4] * y + Hm[5]) / z };
}

function bilinear(img: Kulrang, x: number, y: number): number {
  if (x < 0 || y < 0 || x > img.w - 1 || y > img.h - 1) return 255;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(img.w - 1, x0 + 1), y1 = Math.min(img.h - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const a = img.d[y0 * img.w + x0], b = img.d[y0 * img.w + x1];
  const c = img.d[y1 * img.w + x0], e = img.d[y1 * img.w + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
}

/** Varaq (mm) → rasm: yuqori yarim va pastki yarim uchun alohida (egilish). */
interface Xarita { yuqori: Gomo; pastki: Gomo }
function xarita(x: Xarita, mx: number, my: number): Nuqta {
  return qolla(my < MARKERLAR.ML.y ? x.yuqori : x.pastki, mx, my);
}

/** To'g'rilangan tasvir: `s` px/mm. */
function togrila(img: Kulrang, x: Xarita, s: number, quti = { x: 0, y: 0, w: W, h: H }): Kulrang {
  const w = Math.round(quti.w * s), h = Math.round(quti.h * s);
  const d = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const my = quti.y + (j + 0.5) / s;
    const Hm = my < MARKERLAR.ML.y ? x.yuqori : x.pastki;
    for (let i = 0; i < w; i++) {
      const mx = quti.x + (i + 0.5) / s;
      const z = Hm[6] * mx + Hm[7] * my + Hm[8];
      const u = (Hm[0] * mx + Hm[1] * my + Hm[2]) / z;
      const v = (Hm[3] * mx + Hm[4] * my + Hm[5]) / z;
      d[j * w + i] = bilinear(img, u, v);
    }
  }
  return { w, h, d };
}

// --- Markerlar ---------------------------------------------------------------

type Burchak = 'TL' | 'TR' | 'BR' | 'BL';
interface Topilgan { burchak: Record<Burchak, Nuqta>; tomon: Record<Burchak, number>; kichik: Kulrang; k: number; doglar: Dog[] }

function markerlar(img: Kulrang): Topilgan | { xato: string } {
  const { img: kichik, k } = kichraytir(img, 720);
  const bin = adaptivQora(kichik);
  const hamma = doglar(bin, kichik.w, kichik.h);
  const s0 = (MARKER / W) * kichik.w;
  const nomzod = hamma.filter(c => {
    const bw = c.maxx - c.minx + 1, bh = c.maxy - c.miny + 1;
    const tomon = Math.sqrt(c.area);
    return tomon >= s0 * 0.28 && tomon <= s0 * 1.7 && bw / bh > 0.5 && bw / bh < 2 && c.area / (bw * bh) >= 0.55;
  });
  if (nomzod.length < 4) return { xato: 'Burchakdagi qora kvadratlar topilmadi' };
  const eng = (f: (c: Dog) => number) => nomzod.reduce((a, b) => (f(b) > f(a) ? b : a));
  const tl = eng(c => -(c.cx + c.cy)), br = eng(c => c.cx + c.cy);
  const tr = eng(c => c.cx - c.cy), bl = eng(c => -(c.cx - c.cy));
  const tort = [tl, tr, br, bl];
  if (new Set(tort).size < 4) return { xato: 'Burchakdagi qora kvadratlar topilmadi' };
  const maxA = Math.max(...tort.map(c => c.area));
  if (tort.some(c => c.area < maxA * 0.35)) return { xato: 'Markerlardan biri yirtilgan yoki yopilgan' };
  const uz = (a: Dog, b: Dog) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
  const tepa = uz(tl, tr), past = uz(bl, br), chap = uz(tl, bl), ong = uz(tr, br);
  if (tepa / past < 0.6 || tepa / past > 1.66 || chap / ong < 0.6 || chap / ong > 1.66) return { xato: 'Varaq to\'liq tushmagan yoki juda qiyshiq' };
  const P = (c: Dog) => ({ x: c.cx, y: c.cy });
  const T = (c: Dog) => Math.sqrt(c.area);
  return { burchak: { TL: P(tl), TR: P(tr), BR: P(br), BL: P(bl) }, tomon: { TL: T(tl), TR: T(tr), BR: T(br), BL: T(bl) }, kichik, k, doglar: nomzod };
}

/** Markerning markazini to'liq o'lchamdagi rasmda aniqlashtirish. */
function aniqlashtir(img: Kulrang, n: Nuqta, yarim: number): Nuqta {
  const x0 = Math.max(0, Math.round(n.x - yarim)), x1 = Math.min(img.w - 1, Math.round(n.x + yarim));
  const y0 = Math.max(0, Math.round(n.y - yarim)), y1 = Math.min(img.h - 1, Math.round(n.y + yarim));
  let mn = 255, mx = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const v = img.d[y * img.w + x]; if (v < mn) mn = v; if (v > mx) mx = v; }
  if (mx - mn < 40) return n;
  const t = (mn + mx) / 2;
  let sx = 0, sy = 0, c = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (img.d[y * img.w + x] < t) { sx += x; sy += y; c++; }
  return c ? { x: sx / c, y: sy / c } : n;
}

const BURILISHLAR: Record<number, ['TL' | 'TR' | 'BR' | 'BL', 'TL' | 'TR' | 'BR' | 'BL', 'TL' | 'TR' | 'BR' | 'BL', 'TL' | 'TR' | 'BR' | 'BL']> = {
  // Varaqning [TL, TR, BR, BL] burchagi rasmning qaysi burchagida.
  0: ['TL', 'TR', 'BR', 'BL'],
  90: ['TR', 'BR', 'BL', 'TL'],
  180: ['BR', 'BL', 'TL', 'TR'],
  270: ['BL', 'TL', 'TR', 'BR'],
};

function ortacha(img: Kulrang, xar: (x: number, y: number) => Nuqta, q: { x: number; y: number; w: number; h: number }, qadam = 0.8): number {
  let s = 0, n = 0;
  for (let y = q.y + qadam / 2; y < q.y + q.h; y += qadam) {
    for (let x = q.x + qadam / 2; x < q.x + q.w; x += qadam) {
      const p = xar(x, y);
      s += bilinear(img, p.x, p.y);
      n++;
    }
  }
  return n ? s / n : 255;
}

// --- O'qish ------------------------------------------------------------------

/**
 * Qarorlar chegaralari (to'lganlik ulushi 0..1). Ruchka bilan to'liq bo'yalgan
 * doira 0.9 dan yuqori; "X" yoki "✓" belgisi 0.3–0.55 — u javob emas,
 * operatorga "noaniq" bo'lib boradi (taklif sifatida ko'rsatiladi).
 */
export const CHEGARA = { QORA: 0.45, TOLIQ: 0.6, BOSH: 0.16 };

export interface Shubha { n: number; sabab: string; f?: number[] }

export interface OqishNatijasi {
  ok: boolean;
  xato?: string;
  qr: QrMalumot | null;
  page: number;
  sahifaBelgisi: number;
  javoblar: Record<number, string>;
  shubhalar: Shubha[];
  /** Har savolning doirachalari to'lganligi (operator oynasi uchun). */
  toliqlik: Record<number, number[]>;
  variant: string | null;
  idRaqam: string | null;
  /** To'g'rilangan varaq (px/mm = `masshtab`) — saqlash va kesib ko'rsatish uchun. */
  tasvir: Kulrang | null;
  masshtab: number;
  burilish: number;
  markerlar: number;
  kontrast: number;
}

export interface OqishSozlamasi {
  /** Varaq sahifalari (layout.ts varaqSahifalari) — imtihon tuzilmasidan. */
  sahifalar: Sahifa[];
  /** To'g'rilangan tasvir o'lchami, px/mm. */
  masshtab?: number;
  /** QR o'qilmasa qaysi sahifa deb qaralsin (sahifa belgisidan ham aniqlanadi). */
  sahifa?: number;
}

export function varaqniOqi(img: Kulrang, o: OqishSozlamasi): OqishNatijasi {
  const S = o.masshtab || 5;
  const bosh: OqishNatijasi = {
    ok: false, qr: null, page: 0, sahifaBelgisi: 0, javoblar: {}, shubhalar: [], toliqlik: {},
    variant: null, idRaqam: null, tasvir: null, masshtab: S, burilish: 0, markerlar: 0, kontrast: 0,
  };
  const m = markerlar(img);
  if ('xato' in m) return { ...bosh, xato: m.xato };

  // Yo'nalish: portret — tepa qirra chap qirradan qisqa.
  const b = m.burchak;
  const kattalik = (p: Nuqta, q: Nuqta) => Math.hypot(p.x - q.x, p.y - q.y);
  const portret = kattalik(b.TL, b.TR) < kattalik(b.TL, b.BL);
  const nomzodlar = portret ? [0, 180] : [90, 270];
  const toK = (p: Nuqta) => ({ x: p.x * m.k, y: p.y * m.k });
  // Oyna — dog'ning o'z o'lchamidan: yonidagi doirachalar markazni siljitmasin.
  const yarim = (tomon: number) => tomon * m.k * 0.75;
  const aniq = {
    TL: aniqlashtir(img, toK(b.TL), yarim(m.tomon.TL)), TR: aniqlashtir(img, toK(b.TR), yarim(m.tomon.TR)),
    BR: aniqlashtir(img, toK(b.BR), yarim(m.tomon.BR)), BL: aniqlashtir(img, toK(b.BL), yarim(m.tomon.BL)),
  };
  const varaqBurchak = [MARKERLAR.TL, MARKERLAR.TR, MARKERLAR.BR, MARKERLAR.BL];

  let tanlov: { bur: number; Hm: Gomo; qoralik: number } | null = null;
  for (const bur of nomzodlar) {
    const tartib = BURILISHLAR[bur];
    const Hm = gomografiya(varaqBurchak, tartib.map(t => aniq[t]));
    const xar = (x: number, y: number) => qolla(Hm, x, y);
    const chiziq = ortacha(img, xar, YONALISH);
    const atrof = ortacha(img, xar, { x: YONALISH.x, y: YONALISH.y + 6, w: YONALISH.w, h: 3 });
    const qoralik = atrof - chiziq;
    if (!tanlov || qoralik > tanlov.qoralik) tanlov = { bur, Hm, qoralik };
  }
  if (!tanlov || tanlov.qoralik < 25) return { ...bosh, xato: "Varaqning tepasi aniqlanmadi (yo'nalish chizig'i ko'rinmadi)" };

  // O'rta markerlar — qog'oz egilishi uchun.
  let xar: Xarita = { yuqori: tanlov.Hm, pastki: tanlov.Hm };
  let markerSoni = 4;
  const kichikPx = (p: Nuqta) => ({ x: p.x / m.k, y: p.y / m.k });
  const yaqin = (kutilgan: Nuqta) => {
    const kp = kichikPx(kutilgan);
    const chegara = (6 / W) * m.kichik.w * 1.5;
    let eng: Dog | null = null, ed = Infinity;
    for (const c of m.doglar) {
      const dd = Math.hypot(c.cx - kp.x, c.cy - kp.y);
      if (dd < ed) { ed = dd; eng = c; }
    }
    return eng && ed < chegara ? aniqlashtir(img, toK({ x: eng.cx, y: eng.cy }), yarim(Math.sqrt(eng.area))) : null;
  };
  const ml = yaqin(qolla(tanlov.Hm, MARKERLAR.ML.x, MARKERLAR.ML.y));
  const mr = yaqin(qolla(tanlov.Hm, MARKERLAR.MR.x, MARKERLAR.MR.y));
  if (ml && mr) {
    const tartib = BURILISHLAR[tanlov.bur];
    const TL = aniq[tartib[0]], TR = aniq[tartib[1]], BR = aniq[tartib[2]], BL = aniq[tartib[3]];
    xar = {
      yuqori: gomografiya([MARKERLAR.TL, MARKERLAR.TR, MARKERLAR.MR, MARKERLAR.ML], [TL, TR, mr, ml]),
      pastki: gomografiya([MARKERLAR.ML, MARKERLAR.MR, MARKERLAR.BR, MARKERLAR.BL], [ml, mr, BR, BL]),
    };
    markerSoni = 6;
  }

  const t = togrila(img, xar, S);

  // Qog'oz va siyoh — varaqning o'zidan.
  const namuna = (x0: number, y0: number, w: number, h: number) => {
    const v: number[] = [];
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) {
      const px = Math.round(x * S), py = Math.round(y * S);
      if (px >= 0 && py >= 0 && px < t.w && py < t.h) v.push(t.d[py * t.w + px]);
    }
    return v.sort((a, c) => a - c);
  };
  const siyohlar = (['TL', 'TR', 'BL', 'BR'] as const).map(k => {
    const v = namuna(MARKERLAR[k].x - 1.5, MARKERLAR[k].y - 1.5, 3, 3);
    return v[Math.floor(v.length / 2)] ?? 0;
  }).sort((a, c) => a - c);
  const siyoh = (siyohlar[1] + siyohlar[2]) / 2;
  const fon = namuna(20, 80, 170, 195);
  const qogoz = fon[Math.floor(fon.length * 0.85)] ?? 255;
  const kontrast = qogoz - siyoh;
  if (kontrast < 50) return { ...bosh, xato: 'Rasm juda xira — qayta skanerlang', kontrast, burilish: tanlov.bur, markerlar: markerSoni };

  const qoralikPx = (v: number) => (qogoz - v) / kontrast;

  // Mahalliy qog'oz darajasi: telefon suratida varaqning bir tomoni soyada
  // qoladi. Har 6 mm katakda yorug' nuqtalar (90-foiz) — qog'oz; atrofdagi
  // 3×3 katak medianasi bilan silliqlanadi. Siyoh ham yorug'likka mutanosib.
  const KATAK = 6;
  const kw = Math.ceil(W / KATAK), kh = Math.ceil(H / KATAK);
  const katakFon = new Float32Array(kw * kh);
  for (let cy = 0; cy < kh; cy++) {
    for (let cx = 0; cx < kw; cx++) {
      const v: number[] = [];
      const x0 = Math.round(cx * KATAK * S), x1 = Math.min(t.w, Math.round((cx + 1) * KATAK * S));
      const y0 = Math.round(cy * KATAK * S), y1 = Math.min(t.h, Math.round((cy + 1) * KATAK * S));
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) v.push(t.d[y * t.w + x]);
      v.sort((a, c) => a - c);
      katakFon[cy * kw + cx] = v.length ? v[Math.floor(v.length * 0.9)] : qogoz;
    }
  }
  const silliq = new Float32Array(kw * kh);
  for (let cy = 0; cy < kh; cy++) {
    for (let cx = 0; cx < kw; cx++) {
      const v: number[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < kw && y < kh) v.push(katakFon[y * kw + x]);
      }
      v.sort((a, c) => a - c);
      // Kuchli bosma (marker, QR) katakni qoraytirmasin: umumiy qog'ozdan uzoqlashmaydi.
      silliq[cy * kw + cx] = Math.max(v[Math.floor(v.length / 2)], qogoz * 0.55);
    }
  }
  const mahalliyFon = (x: number, y: number) => {
    const gx = Math.min(kw - 1.001, Math.max(0, x / KATAK - 0.5)), gy = Math.min(kh - 1.001, Math.max(0, y / KATAK - 0.5));
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const a = silliq[y0 * kw + x0], b = silliq[y0 * kw + x0 + 1], c = silliq[(y0 + 1) * kw + x0], e = silliq[(y0 + 1) * kw + x0 + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
  };
  const nuqta = (x: number, y: number) => {
    const px = x * S - 0.5, py = y * S - 0.5;
    const p = mahalliyFon(x, y);
    const siyohMahalliy = siyoh * (p / qogoz);
    return (p - bilinear(t, px, py)) / Math.max(30, p - siyohMahalliy);
  };
  // Doiracha ichining to'lganligi: markazdan 0.62·r ichidagi nuqtalar ulushi.
  const DOIRA_NUQTALAR: Nuqta[] = [];
  for (let yy = -1; yy <= 1; yy += 0.2) for (let xx = -1; xx <= 1; xx += 0.2) if (xx * xx + yy * yy <= 1) DOIRA_NUQTALAR.push({ x: xx, y: yy });
  const HALQA: Nuqta[] = [];
  for (let i = 0; i < 20; i++) HALQA.push({ x: Math.cos((i / 20) * 2 * Math.PI), y: Math.sin((i / 20) * 2 * Math.PI) });
  const toliq = (d: Doira, dx: number, dy: number) => {
    const r = d.r * 0.62;
    let q = 0;
    for (const p of DOIRA_NUQTALAR) if (nuqta(d.x + dx + p.x * r, d.y + dy + p.y * r) >= CHEGARA.QORA) q++;
    return q / DOIRA_NUQTALAR.length;
  };
  const halqa = (d: Doira, dx: number, dy: number) => {
    let s = 0;
    for (const p of HALQA) s += nuqta(d.x + dx + p.x * d.r, d.y + dy + p.y * d.r);
    return s / HALQA.length;
  };
  /** Qator (yoki ustun) uchun eng yaxshi siljish: chop etilgan doira chiziqlariga moslash. */
  const siljish = (doiralar: Doira[], oraliq = 1.2, qadam = 0.3) => {
    let eng = { dx: 0, dy: 0, s: -Infinity };
    for (let dy = -oraliq; dy <= oraliq + 1e-9; dy += qadam) {
      for (let dx = -oraliq; dx <= oraliq + 1e-9; dx += qadam) {
        let s = 0;
        for (const d of doiralar) s += halqa(d, dx, dy);
        // Teng bo'lsa — kamroq siljish.
        s -= 0.002 * (Math.abs(dx) + Math.abs(dy));
        if (s > eng.s) eng = { dx, dy, s };
      }
    }
    return eng;
  };

  // Sahifa: QR (bo'lsa) yoki sahifa belgilari.
  let sahifaBelgisi = 0;
  SAHIFA_BELGILARI.forEach((p, i) => {
    const q = ortacha(t, (x, y) => ({ x: x * S, y: y * S }), { x: p.x - SAHIFA_BELGI / 4, y: p.y - SAHIFA_BELGI / 4, w: SAHIFA_BELGI / 2, h: SAHIFA_BELGI / 2 }, 0.3);
    if (qoralikPx(q) > 0.5) sahifaBelgisi |= 1 << i;
  });

  // QR — to'g'rilangan, kattaroq masshtabdagi kesimdan (8 px/mm).
  let qr: QrMalumot | null = null;
  for (const qq of [o.sahifalar[0]?.qr, o.sahifalar[1]?.qr].filter(Boolean) as { x: number; y: number; s: number }[]) {
    const quti = { x: qq.x - 3, y: qq.y - 3, w: qq.s + 6, h: qq.s + 6 };
    const kesim = togrila(img, xar, 8, quti);
    const rgba = new Uint8ClampedArray(kesim.w * kesim.h * 4);
    for (let i = 0; i < kesim.d.length; i++) { const v = kesim.d[i]; rgba[i * 4] = v; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255; }
    const kod = jsQR(rgba, kesim.w, kesim.h, { inversionAttempts: 'dontInvert' });
    if (kod?.data) { qr = qrniOqi(kod.data); if (qr) break; }
  }
  const page = qr?.page || sahifaBelgisi || o.sahifa || 1;
  const sahifa = o.sahifalar.find(x => x.page === page);
  const natija: OqishNatijasi = { ...bosh, ok: true, qr, page, sahifaBelgisi, tasvir: t, masshtab: S, burilish: tanlov.bur, markerlar: markerSoni, kontrast };
  if (!sahifa) return { ...natija, ok: false, xato: `${page}-sahifa bu imtihon varag'ida yo'q` };
  if (qr && sahifaBelgisi && qr.page !== sahifaBelgisi) natija.shubhalar.push({ n: 0, sabab: 'Sahifa belgisi QR bilan mos emas' });

  // Sahifadagi hamma yopiq doirachalarning "bo'sh" darajasi (xira skan uchun asos).
  const oqish = (doiralar: Doira[], oraliq?: number) => {
    const s = siljish(doiralar, oraliq);
    return doiralar.map(d => toliq(d, s.dx, s.dy));
  };
  // "Bo'sh" darajasi har doirachalar turi uchun alohida: kichik katak ichidagi
  // belgi (−, 0..9) katta doiradagi harfdan ko'ra ko'proq joy egallaydi.
  const asosi = (toliqliklar: number[]) => {
    const tartib = [...toliqliklar].sort((a, c) => a - c);
    return Math.min(0.25, tartib.length ? tartib[Math.floor(tartib.length * 0.25)] : 0);
  };
  const moslagich = (asos: number) => (f: number) => Math.max(0, (f - asos) / (1 - asos));
  const yopiqF = sahifa.yopiq.map(q => oqish(q.doiralar));
  const moslash = moslagich(asosi(yopiqF.flat()));
  const raqamliF = sahifa.raqamli.map(q => q.ustunlar.map(ustun => oqish(ustun, 1.0)));
  const moslashRaqam = moslagich(asosi(raqamliF.flat(2)));
  const yaxlit = (f: number) => Math.round(f * 100) / 100;

  sahifa.yopiq.forEach((q, i) => {
    const f = yopiqF[i].map(moslash);
    natija.toliqlik[q.n] = f.map(yaxlit);
    const toliqlar = f.map((x, j) => ({ x, j })).filter(o2 => o2.x >= CHEGARA.TOLIQ);
    const noaniq = f.filter(x => x >= CHEGARA.BOSH && x < CHEGARA.TOLIQ).length;
    if (toliqlar.length === 1 && !noaniq) natija.javoblar[q.n] = q.doiralar[toliqlar[0].j].v;
    else if (!toliqlar.length && !noaniq) natija.javoblar[q.n] = '';
    else if (toliqlar.length >= 2) {
      natija.javoblar[q.n] = '*';
      natija.shubhalar.push({ n: q.n, sabab: 'Bir nechta doira bo\'yalgan', f: f.map(yaxlit) });
    } else {
      const eng = f.reduce((a, x, j) => (x > f[a] ? j : a), 0);
      natija.javoblar[q.n] = q.doiralar[eng].v;
      natija.shubhalar.push({ n: q.n, sabab: 'Noaniq belgi', f: f.map(yaxlit) });
    }
  });

  for (const [qi, q] of sahifa.raqamli.entries()) {
    let matn = '';
    let muammo = '';
    const barchasi: number[] = [];
    for (const [ui, ustun] of q.ustunlar.entries()) {
      const f = raqamliF[qi][ui].map(moslashRaqam);
      barchasi.push(...f.map(yaxlit));
      const toliqlar = f.map((x, j) => ({ x, j })).filter(o2 => o2.x >= CHEGARA.TOLIQ);
      const noaniq = f.filter(x => x >= CHEGARA.BOSH && x < CHEGARA.TOLIQ).length;
      if (toliqlar.length === 1) matn += ustun[toliqlar[0].j].v;
      if (toliqlar.length > 1) muammo = 'Ustunda bir nechta belgi';
      else if (noaniq) muammo = muammo || 'Noaniq belgi';
    }
    natija.toliqlik[q.n] = barchasi;
    natija.javoblar[q.n] = matn;
    if (muammo) natija.shubhalar.push({ n: q.n, sabab: muammo });
    else if (matn && !/^-?(\d+([.,]\d+)?|[.,]\d+)(\/-?\d+([.,]\d+)?)?$/.test(matn)) natija.shubhalar.push({ n: q.n, sabab: `Javob son emas: ${matn}` });
  }

  if (sahifa.variantlar.length) {
    const f = oqish(sahifa.variantlar).map(moslash);
    const toliqlar = f.map((x, j) => ({ x, j })).filter(o2 => o2.x >= CHEGARA.TOLIQ);
    if (toliqlar.length === 1) natija.variant = sahifa.variantlar[toliqlar[0].j].v;
  }
  if (sahifa.idUstunlari.length && qr?.turi !== 'S') {
    let raqam = '';
    let buzuq = false;
    for (const ustun of sahifa.idUstunlari) {
      const f = oqish(ustun, 0.8).map(moslash);
      const toliqlar = f.map((x, j) => ({ x, j })).filter(o2 => o2.x >= CHEGARA.TOLIQ);
      if (toliqlar.length === 1) raqam += ustun[toliqlar[0].j].v;
      else if (toliqlar.length > 1) buzuq = true;
    }
    natija.idRaqam = !buzuq && raqam ? raqam : null;
  }
  return natija;
}

/** To'g'rilangan kulrang tasvirni kichraytirish (saqlash uchun). */
export function tasvirniKichrayt(t: Kulrang, maxW: number): Kulrang {
  return kichraytir(t, maxW).img;
}
