// Javob varaqasi geometriyasi — millimetrda, A4 (210 × 297).
//
// Bitta manba: varaqni chizadigan kod (render.ts) ham, skanerdan o'qiydigan
// kod (reader.ts) ham koordinatalarni shu yerdan oladi. Biror o'lcham
// o'zgarsa — ikkalasi birga o'zgaradi, chop etilgan varaq bilan o'qigich
// hech qachon ajrab qolmaydi.
//
// Tuzilma (lib/imtihon.js varaqTuzilmasi): har blokda avval yopiq savollar,
// keyin raqamli (katakli), keyin yozma. Varaq hamma variant va smenada bir xil.

import { RAQAM_BELGILARI, RAQAM_USTUNLARI } from '../../../lib/imtihon.js';

export const W = 210;
export const H = 297;

/** Burchak va o'rta markerlar (qora kvadrat markazi). O'rtadagilari qog'oz egilishi uchun. */
export const MARKER = 7;
export const MARKERLAR = {
  TL: { x: 12, y: 12 }, TR: { x: 198, y: 12 },
  ML: { x: 12, y: 148.5 }, MR: { x: 198, y: 148.5 },
  BL: { x: 12, y: 285 }, BR: { x: 198, y: 285 },
};
/** Yo'nalish chizig'i: faqat tepada. Skan teskari bo'lsa, shu bilan aniqlanadi. */
export const YONALISH = { x: 92, y: 8.8, w: 26, h: 3.2 };
/** Sahifa raqami (ikkilik): i-kvadrat to'la ⇔ sahifa raqamining i-biti 1. */
export const SAHIFA_BELGILARI = [{ x: 24, y: 283.5 }, { x: 30, y: 283.5 }, { x: 36, y: 283.5 }];
export const SAHIFA_BELGI = 3.2;

export const CHAP = 20;
export const ONG = 190;
const KENGLIK = ONG - CHAP;

/** QR joyi: 1-sahifada katta, keyingilarida kichik. */
export const QR_1 = { x: 148, y: 36.5, s: 21 };
export const QR_KEYINGI = { x: 170, y: 16, s: 20 };
export const RASM = { x: 172.5, y: 36.5, w: 17.5, h: 21 };

const Y0_BIRINCHI = 88;
const Y0_KEYINGI = 42;
const Y1 = 278;

// Yopiq savol qatori
export const QATOR = 5.6;
export const DOIRA_R = 2.2;
export const DOIRA_QADAM = 5.8;
const RAQAM_JOYI = 8;
const USTUN_ORALIQ = 3.5;

// Raqamli javob katagi
export const KATAK_R = 1.75;
export const KATAK_QADAM_X = 4.8;
export const KATAK_QADAM_Y = 4.3;
const KATAK_YOZUV = 6.5;
const KATAK_KENGLIK = RAQAM_USTUNLARI * KATAK_QADAM_X + 3;
const KATAK_BALANDLIK = 4 + KATAK_YOZUV + 1 + RAQAM_BELGILARI.length * KATAK_QADAM_Y + 1.5;

// Moslashtirish to'ri: sarlavha, ustun harflari (P–T), 4 qator (A–D).
const MOSLASH_QADAM_X = 5.4;
const MOSLASH_QADAM_Y = 4.7;
const MOSLASH_R = 1.85;
const MOSLASH_KENGLIK = 7 + 5 * MOSLASH_QADAM_X + 2;
const MOSLASH_BALANDLIK = 9.5 + 4 * MOSLASH_QADAM_Y + 1.5;

// Yozma javob maydoni
const YOZMA_BALANDLIK = 40;
// Qismli savol qismi: qisqa javob yoziladigan maydon (bitta savolning qismlari bir qatorda).
const QISM_BALANDLIK = 11;
const QISM_ORALIQ = 4;

// Variant va o'quvchi ID doirachalari (1-sahifa)
export const VARIANT_Y = 75;
export const VARIANT_X0 = 60;
export const VARIANT_R = 2.1;
export const ID_USTUNLARI = 6;
export const ID_X0 = 70;
export const ID_QADAM_X = 5;
export const ID_Y0 = 35.5;
export const ID_QADAM_Y = 3.7;
export const ID_R = 1.6;

/** `v` — o'qilganda javob qiymati; `belgi` — doiracha ichida ko'rinadigan yozuv (bo'lmasa `v`). */
export interface Doira { x: number; y: number; r: number; v: string; belgi?: string }
/** Bezak — o'qilmaydigan yozuv (so'rovnoma savoli, dizayner yorlig'i). */
export interface Bezak { x: number; y: number; matn: string; olcham: number; qalin?: boolean; anchor?: 'start' | 'middle' | 'end'; maxW?: number; rang?: string }
export interface Quti { x: number; y: number; w: number; h: number }

// `y` — varaqda ko'rinadigan raqam (qismli savolda "36a"); bo'lmasa — `n`.
export interface YopiqSavol { n: number; y?: string; raqam: { x: number; y: number }; doiralar: Doira[] }
export interface RaqamliSavol { n: number; y?: string; quti: Quti; yozuv: Quti; ustunlar: Doira[][] }
/** `ixcham` — qismli savol qismining qisqa javob maydoni (bir qatorda bir nechta). */
export interface YozmaSavol { n: number; y?: string; quti: Quti; ball: number | null; ixcham?: boolean }
/** Moslashtirish (matritsa): qatorlar A–D, har qatorda P–T doirachalari. */
export interface MoslashSavol { n: number; y?: string; quti: Quti; qatorlar: Doira[][] }
export interface BlokSarlavha { matn: string; x: number; y: number }

export interface Sahifa {
  page: number;
  pages: number;
  yopiq: YopiqSavol[];
  raqamli: RaqamliSavol[];
  yozma: YozmaSavol[];
  moslash?: MoslashSavol[];
  sarlavhalar: BlokSarlavha[];
  /** 1-sahifada (sozlamada yoqilgan bo'lsa) — kitobcha varianti. */
  variantlar: Doira[];
  /** 1-sahifada — universal varaqdagi o'quvchi ID si (faqat universal varaqda chiziladi va o'qiladi). */
  idUstunlari: Doira[][];
  qr: { x: number; y: number; s: number };
  bezak?: Bezak[];
  /** Dizayner rasmlari (logo, chizma) — o'qilmaydi. */
  rasmlar?: (Quti & { src: string })[];
}

export interface Tuzilma {
  bloklar: { nomi: string; boshi: number; oxiri: number; yopiq: number; raqamli: number; moslash?: number; yozma: number }[];
  /** `y` — ko'rinadigan raqam ("36a"), `g` — guruhli savol bo'lagi, `harf` — qatordagi doirachalar (juft: 6). */
  savollar: { n: number; blok: number; tur: 'yopiq' | 'raqamli' | 'moslash' | 'yozma'; y?: string; g?: string; harf?: number }[];
  jami: number;
}

export interface VaraqParametrlari {
  tuzilma: Tuzilma;
  /** Har qatordagi javob doirachalari (2–6). */
  optionCount: number;
  variantCount: number;
  variantBubble: boolean;
  /** Yozma savollarning bali (varaqda ko'rsatish uchun), {n: ball}. */
  yozmaBallari?: Record<number, number>;
  /** So'rovnoma: har qatorda savol matni va o'ng tomonda shkala doirachalari. */
  sorovnoma?: { savollar: { matn: string; variantlar?: string[] }[]; shkala: string[]; anonim?: boolean } | null;
  /** Erkin varaq (dizayner andozasi) — bo'lsa, savollar shu bloklarga joylanadi. */
  andoza?: VaraqAndoza | null;
}

/** Matnni taxminiy kenglik bo'yicha qatorlarga bo'lish (Arial, mm). */
function qatorlarga(matn: string, olcham: number, maxW: number, maxQator: number): string[] {
  const sig = Math.max(8, Math.floor(maxW / (olcham * 0.5)));
  const sozlar = matn.split(/\s+/);
  const l: string[] = [];
  let joriy = '';
  for (const s of sozlar) {
    if ((joriy + ' ' + s).trim().length > sig && joriy) { l.push(joriy); joriy = s; } else joriy = (joriy + ' ' + s).trim();
  }
  if (joriy) l.push(joriy);
  if (l.length > maxQator) { l.length = maxQator; l[maxQator - 1] = l[maxQator - 1].replace(/.{0,2}$/, '…'); }
  return l;
}

/**
 * So'rovnoma varag'i: har savol — bitta qator (matni chapda, 2 qatorgacha),
 * o'ngda shkala doirachalari (ichida 1, 2, 3…; qiymat — A, B, C…). Umumiy shkala
 * yorliqlari tepada izoh bo'lib chiqadi; o'z yorlig'i bor savolda — matn oxirida.
 */
function sorovnomaSahifalari(p: VaraqParametrlari): Sahifa[] {
  const sv = p.sorovnoma!;
  const kMax = Math.max(2, ...sv.savollar.map(q => (q.variantlar?.length || sv.shkala.length)));
  const QADAM = 7.2;
  const x0 = ONG - (kMax - 1) * QADAM - 3;   // birinchi doiracha markazi
  const matnW = x0 - 5 - (CHAP + 8);
  const sahifalar: Sahifa[] = [];
  let s = yangiSahifa(1);
  sahifalar.push(s);
  s.bezak = [];
  // Anonim bo'lmasa — universal varaqda o'quvchi ID si (shaxsiy varaqda QR yetadi).
  if (!sv.anonim) {
    for (let c = 0; c < ID_USTUNLARI; c++) {
      const ustun: Doira[] = [];
      for (let d = 0; d < 10; d++) ustun.push({ x: ID_X0 + c * ID_QADAM_X, y: ID_Y0 + d * ID_QADAM_Y, r: ID_R, v: String(d) });
      s.idUstunlari.push(ustun);
    }
  }
  let y = Y0_BIRINCHI;
  const sarlavha = () => {
    // Umumiy shkala izohi: "1 — Mutlaqo qo'shilmayman · 2 — …".
    const izoh = sv.shkala.map((x, i) => `${i + 1} — ${x}`).join('   ·   ');
    s.bezak!.push({ x: CHAP, y: y + 3, matn: izoh, olcham: 2.5, rang: '#333', maxW: ONG - CHAP });
    for (let d = 0; d < kMax; d++) s.bezak!.push({ x: x0 + d * QADAM, y: y + 8.2, matn: String(d + 1), olcham: 2.6, qalin: true, anchor: 'middle' });
    y += 10;
  };
  sarlavha();
  sv.savollar.forEach((q, i) => {
    const yorliq = q.variantlar?.length ? q.variantlar : null;
    const k = yorliq?.length || sv.shkala.length;
    const matn = yorliq ? `${q.matn} (${yorliq.map((x, j) => `${j + 1} — ${x}`).join(', ')})` : q.matn;
    const qatorlar = qatorlarga(matn, 2.7, matnW, 2);
    const h = qatorlar.length > 1 ? 9.6 : 6.6;
    if (y + h > Y1) {
      s = yangiSahifa(sahifalar.length + 1);
      s.bezak = [];
      sahifalar.push(s);
      y = Y0_KEYINGI;
      sarlavha();
    }
    const cy = y + h / 2;
    s.bezak!.push({ x: CHAP + 6, y: cy + 1, matn: `${i + 1}.`, olcham: 2.8, qalin: true, anchor: 'end' });
    qatorlar.forEach((t, j) => s.bezak!.push({ x: CHAP + 8, y: cy + 1 - (qatorlar.length - 1) * 1.7 + j * 3.4, matn: t, olcham: 2.7, maxW: matnW }));
    const doiralar: Doira[] = [];
    for (let d = 0; d < k; d++) doiralar.push({ x: x0 + d * QADAM, y: cy, r: DOIRA_R, v: HARF[d], belgi: String(d + 1) });
    // Raqam yozuvi bezakda — savol raqami doirachalar yonida chizilmaydi (x manfiy emas, lekin bo'sh).
    s.yopiq.push({ n: i + 1, raqam: { x: -100, y: cy }, doiralar });
    y += h + 0.8;
  });
  for (const sh of sahifalar) sh.pages = sahifalar.length;
  return sahifalar;
}

const HARF = 'ABCDEF';

function yangiSahifa(page: number): Sahifa {
  return {
    page, pages: 0, yopiq: [], raqamli: [], yozma: [], moslash: [], sarlavhalar: [], variantlar: [], idUstunlari: [],
    qr: page === 1 ? QR_1 : QR_KEYINGI,
  };
}

/** 1-sahifa: kitobcha varianti va (universal varaqda) o'quvchi ID doirachalari. */
function birinchiSahifaDoiralari(s: Sahifa, p: VaraqParametrlari) {
  if (p.variantBubble) {
    const soni = Math.max(1, Math.min(26, p.variantCount || 1));
    for (let i = 0; i < soni; i++) s.variantlar.push({ x: VARIANT_X0 + i * DOIRA_QADAM, y: VARIANT_Y, r: VARIANT_R, v: String.fromCharCode(65 + i) });
  }
  for (let c = 0; c < ID_USTUNLARI; c++) {
    const ustun: Doira[] = [];
    for (let d = 0; d < 10; d++) ustun.push({ x: ID_X0 + c * ID_QADAM_X, y: ID_Y0 + d * ID_QADAM_Y, r: ID_R, v: String(d) });
    s.idUstunlari.push(ustun);
  }
}

/** Yopiq savol qatori: raqam va k ta doiracha (x — qator boshi, y — qator tepasi). */
function yopiqQator(n: number, x: number, y: number, k: number): YopiqSavol {
  const cy = y + QATOR / 2;
  const doiralar: Doira[] = [];
  for (let d = 0; d < k; d++) doiralar.push({ x: x + RAQAM_JOYI + DOIRA_QADAM / 2 + d * DOIRA_QADAM, y: cy, r: DOIRA_R, v: HARF[d] });
  return { n, raqam: { x: x + RAQAM_JOYI - 1.2, y: cy + 1.05 }, doiralar };
}

/** Raqamli javob katagi (bx, by — chap yuqori burchak). */
function raqamliKatak(n: number, bx: number, by: number): RaqamliSavol {
  const yozuv = { x: bx + 1.5, y: by + 4, w: RAQAM_USTUNLARI * KATAK_QADAM_X, h: KATAK_YOZUV };
  const ustunlar: Doira[][] = [];
  for (let c = 0; c < RAQAM_USTUNLARI; c++) {
    const col: Doira[] = [];
    RAQAM_BELGILARI.forEach((v: string, si: number) => {
      col.push({ x: yozuv.x + c * KATAK_QADAM_X + KATAK_QADAM_X / 2, y: by + 4 + KATAK_YOZUV + 1 + si * KATAK_QADAM_Y + KATAK_QADAM_Y / 2, r: KATAK_R, v });
    });
    ustunlar.push(col);
  }
  return { n, quti: { x: bx, y: by, w: KATAK_KENGLIK, h: KATAK_BALANDLIK }, yozuv, ustunlar };
}

/** Moslashtirish to'ri 4 × 5 (bx, by — chap yuqori burchak). */
function moslashTori(n: number, bx: number, by: number): MoslashSavol {
  const qatorlar: Doira[][] = [];
  for (let r = 0; r < 4; r++) {
    const qator: Doira[] = [];
    for (let c = 0; c < 5; c++) qator.push({ x: bx + 7 + c * MOSLASH_QADAM_X + MOSLASH_QADAM_X / 2, y: by + 9.5 + r * MOSLASH_QADAM_Y + MOSLASH_QADAM_Y / 2, r: MOSLASH_R, v: 'PQRST'[c] });
    qatorlar.push(qator);
  }
  return { n, quti: { x: bx, y: by, w: MOSLASH_KENGLIK, h: MOSLASH_BALANDLIK }, qatorlar };
}

/**
 * Varaq sahifalari. Yopiq savollar ustunma-ustun (yuqoridan pastga, keyin
 * o'ngga), har blok boshida uning nomi. Keyin raqamli kataklar qatorlari,
 * keyin yozma maydonlar. Joy tugasa — keyingi sahifa. Dizayner andozasi
 * bo'lsa — savollar uning bloklariga joylanadi (andozaSahifalari).
 */
export function varaqSahifalari(p: VaraqParametrlari): Sahifa[] {
  if (p.sorovnoma?.savollar.length) return sorovnomaSahifalari(p);
  if (p.andoza?.bloklar?.length) return yorliqlarniQoy(andozaSahifalari(p), p);
  const k = Math.min(6, Math.max(2, p.optionCount || 4));
  const katak = new Map(p.tuzilma.savollar.map(x => [x.n, x]));
  const sahifalar: Sahifa[] = [];
  let s = yangiSahifa(1);
  sahifalar.push(s);
  birinchiSahifaDoiralari(s, p);

  // --- Yopiq savollar ---
  // Moslashtirish guruhi qatorlarida doim A–F: ustun kengligi eng keng qatorga qarab olinadi.
  const kMaks = Math.max(k, ...p.tuzilma.savollar.map(x => (x.tur === 'yopiq' ? x.harf || 0 : 0)));
  const ustunKeng = RAQAM_JOYI + kMaks * DOIRA_QADAM;
  const ustunSoni = Math.max(1, Math.floor((KENGLIK + USTUN_ORALIQ) / (ustunKeng + USTUN_ORALIQ)));
  const ustunQadam = ustunSoni > 1 ? (KENGLIK - ustunKeng) / (ustunSoni - 1) : 0;

  // Katakchalar ketma-ketligi: blok sarlavhasi yoki savol.
  type Katak = { tur: 'sarlavha'; matn: string } | { tur: 'savol'; n: number };
  const kataklar: Katak[] = [];
  const bloklarSoni = p.tuzilma.bloklar.filter(b => b.yopiq > 0).length;
  for (const b of p.tuzilma.bloklar) {
    if (!b.yopiq) continue;
    if (bloklarSoni > 1) kataklar.push({ tur: 'sarlavha', matn: b.nomi });
    for (let n = b.boshi; n < b.boshi + b.yopiq; n++) kataklar.push({ tur: 'savol', n });
  }

  // Sahifaga sig'adigani ustunlarga teng bo'linadi (1–30, 31–60, ...): pastda
  // raqamli kataklar va yozma maydonlar uchun joy qoladi.
  let y0 = Y0_BIRINCHI;
  let engPast = y0;
  let i = 0;
  while (i < kataklar.length) {
    const qatorlarMax = Math.floor((Y1 - y0) / QATOR);
    const sigim = ustunSoni * qatorlarMax;
    const olinadi = Math.min(kataklar.length - i, sigim);
    // Ustunda kamida 15 qator (Addmen varag'idagidek: 30 savol — 2 ustun × 15).
    const qatorlar = Math.min(qatorlarMax, Math.max(Math.ceil(olinadi / ustunSoni), Math.min(15, olinadi)));
    for (let j = 0; j < olinadi; j++) {
      const kt = kataklar[i + j];
      const ustun = Math.floor(j / qatorlar);
      const qator = j % qatorlar;
      const x = CHAP + ustun * ustunQadam;
      const y = y0 + qator * QATOR;
      if (kt.tur === 'sarlavha') {
        s.sarlavhalar.push({ matn: kt.matn, x, y: y + QATOR * 0.72 });
      } else {
        s.yopiq.push(yopiqQator(kt.n, x, y, Math.min(6, katak.get(kt.n)?.harf || k)));
      }
    }
    i += olinadi;
    engPast = y0 + qatorlar * QATOR;
    if (i < kataklar.length) {
      s = yangiSahifa(sahifalar.length + 1);
      sahifalar.push(s);
      y0 = Y0_KEYINGI;
      engPast = y0;
    }
  }

  // --- Raqamli kataklar va yozma maydonlar ---
  let joriyY = kataklar.length ? engPast + 4 : y0;
  const joy = (balandlik: number) => {
    if (joriyY + balandlik > Y1 + 1) {
      s = yangiSahifa(sahifalar.length + 1);
      sahifalar.push(s);
      joriyY = Y0_KEYINGI;
    }
  };

  const raqamlilar = p.tuzilma.savollar.filter(x => x.tur === 'raqamli').map(x => x.n);
  const qatordaKatak = Math.max(1, Math.floor((KENGLIK + 3) / (KATAK_KENGLIK + 3)));
  const katakQadam = qatordaKatak > 1 ? (KENGLIK - KATAK_KENGLIK) / (qatordaKatak - 1) : 0;
  for (let i = 0; i < raqamlilar.length; i += qatordaKatak) {
    joy(KATAK_BALANDLIK);
    raqamlilar.slice(i, i + qatordaKatak).forEach((n, j) => s.raqamli.push(raqamliKatak(n, CHAP + j * katakQadam, joriyY)));
    joriyY += KATAK_BALANDLIK + 3;
  }

  // Moslashtirish to'rlari: 4 × 5, qatorda bir nechta.
  const moslashlar = p.tuzilma.savollar.filter(x => x.tur === 'moslash').map(x => x.n);
  const qatordaMoslash = Math.max(1, Math.floor((KENGLIK + 4) / (MOSLASH_KENGLIK + 4)));
  const moslashQadam = qatordaMoslash > 1 ? (KENGLIK - MOSLASH_KENGLIK) / (qatordaMoslash - 1) : 0;
  for (let i = 0; i < moslashlar.length; i += qatordaMoslash) {
    joy(MOSLASH_BALANDLIK);
    moslashlar.slice(i, i + qatordaMoslash).forEach((n, j) => (s.moslash ||= []).push(moslashTori(n, CHAP + j * moslashQadam, joriyY)));
    joriyY += MOSLASH_BALANDLIK + 3;
  }

  // Qismli savollarning qisqa javob maydonlari: bitta savolning qismlari (36a, 36b) bir qatorda.
  const qismlar = p.tuzilma.savollar.filter(x => x.tur === 'yozma' && x.g === 'qismli');
  const raqami = (x: { n: number; y?: string }) => String(x.y ?? x.n).replace(/[a-z]+$/, '');
  for (let i = 0; i < qismlar.length;) {
    let j = i + 1;
    while (j < qismlar.length && raqami(qismlar[j]) === raqami(qismlar[i])) j++;
    const qator = qismlar.slice(i, j);
    joy(QISM_BALANDLIK + 2.5);
    const w = (KENGLIK - (qator.length - 1) * QISM_ORALIQ) / qator.length;
    qator.forEach((x, c) => s.yozma.push({ n: x.n, quti: { x: CHAP + c * (w + QISM_ORALIQ), y: joriyY, w, h: QISM_BALANDLIK }, ball: p.yozmaBallari?.[x.n] ?? null, ixcham: true }));
    joriyY += QISM_BALANDLIK + 2.5;
    i = j;
  }
  if (qismlar.length) joriyY += 1.5;

  const yozmalar = p.tuzilma.savollar.filter(x => x.tur === 'yozma' && x.g !== 'qismli').map(x => x.n);
  for (const n of yozmalar) {
    joy(YOZMA_BALANDLIK + 4);
    s.yozma.push({ n, quti: { x: CHAP, y: joriyY + 4, w: KENGLIK, h: YOZMA_BALANDLIK }, ball: p.yozmaBallari?.[n] ?? null });
    joriyY += YOZMA_BALANDLIK + 7;
  }

  for (const sh of sahifalar) sh.pages = sahifalar.length;
  return yorliqlarniQoy(sahifalar, p);
}

/** Har katakka ko'rinadigan raqamini qo'yadi (tuzilmadagi `y` — tartib raqamidan farq qilsa). */
function yorliqlarniQoy(sahifalar: Sahifa[], p: VaraqParametrlari): Sahifa[] {
  const y = new Map(p.tuzilma.savollar.filter(x => x.y).map(x => [x.n, x.y as string]));
  if (!y.size) return sahifalar;
  const qoy = <T extends { n: number }>(l: T[]): T[] => l.map(q => (y.has(q.n) ? { ...q, y: y.get(q.n) } : q));
  return sahifalar.map(sh => ({ ...sh, yopiq: qoy(sh.yopiq), raqamli: qoy(sh.raqamli), yozma: qoy(sh.yozma), moslash: qoy(sh.moslash || []) }));
}

// --- Erkin varaq (Addmen "OMR Designer") ------------------------------------
//
// Andoza — sahifalarga joylangan bloklar. Savol bloklarining o'lchami savollar
// soni va ustunlardan kelib chiqadi (qo'lda cho'zilmaydi — doirachalar oralig'i
// doim o'qigichga mos); yozma, yozuv va rasm bloklari kengligi/balandligi erkin.
// Sarlavha (markerlar, QR, ID, variant) standart varaqdagidek qoladi.

export type AndozaTuri = 'yopiq' | 'raqamli' | 'moslash' | 'yozma' | 'matn' | 'rasm';
export interface AndozaBlok {
  id: string;
  tur: AndozaTuri;
  sahifa: number;
  /** Chap yuqori burchak, mm. */
  x: number;
  y: number;
  /** Savol bloklari: birinchi savol raqami, soni va ustunlar (raqamli/moslash — qatordagi kataklar). */
  boshi?: number;
  soni?: number;
  ustunlar?: number;
  sarlavha?: string;
  /** Yozma, yozuv, rasm: kenglik (va balandlik), mm. */
  w?: number;
  h?: number;
  matn?: string;
  olcham?: number;
  qalin?: boolean;
  tekis?: 'start' | 'middle' | 'end';
  src?: string;
}
export interface VaraqAndoza { id?: number | null; nomi?: string; sahifalar: number; bloklar: AndozaBlok[]; yangilangan?: string }

/** Bloklar turadigan maydon: sarlavha, markerlar va sahifa belgilaridan tashqari. */
export const ANDOZA_MAYDONI = { x0: CHAP, x1: ONG, y0: (page: number) => (page === 1 ? 86 : 40), y1: Y1 + 1 };
const BLOK_SARLAVHA = 5;
export const SAVOL_BLOKLARI: AndozaTuri[] = ['yopiq', 'raqamli', 'moslash', 'yozma'];

/** Yozuv blokining qatorlari (\n — yangi qator, uzunlari kenglikka bo'linadi). */
export function yozuvQatorlari(b: AndozaBlok): string[] {
  const o = b.olcham || 3;
  return String(b.matn || '').split('\n').flatMap(q => (q.trim() ? qatorlarga(q.trim(), o, b.w || 60, 12) : [''])).slice(0, 20);
}

/** Blok o'lchami, mm. */
/**
 * Erkin varaqda yopiq blok ustunining kengligi shuncha doirachaga hisoblanadi: imtihonning umumiy soni,
 * moslashtirish guruhi (A-F) qatorlari bo'lsa - 6. Qatorning o'zi esa o'z doirachalarini chizadi.
 */
export function andozaDoiralari(p: { tuzilma: Tuzilma | null; optionCount: number }): number {
  return Math.min(6, Math.max(2, p.optionCount || 4, ...(p.tuzilma?.savollar || []).map(x => (x.tur === 'yopiq' ? x.harf || 0 : 0))));
}

export function blokOlchami(b: AndozaBlok, optionCount = 4): { w: number; h: number } {
  const sh = b.sarlavha && SAVOL_BLOKLARI.includes(b.tur) ? BLOK_SARLAVHA : 0;
  const soni = Math.max(1, b.soni || 1);
  const c = Math.min(Math.max(1, b.ustunlar || 1), soni);
  if (b.tur === 'yopiq') {
    const uk = RAQAM_JOYI + Math.min(6, Math.max(2, optionCount)) * DOIRA_QADAM;
    return { w: c * uk + (c - 1) * USTUN_ORALIQ, h: sh + Math.ceil(soni / c) * QATOR };
  }
  if (b.tur === 'raqamli' || b.tur === 'moslash') {
    const [kw, kh, ora] = b.tur === 'raqamli' ? [KATAK_KENGLIK, KATAK_BALANDLIK, 3] : [MOSLASH_KENGLIK, MOSLASH_BALANDLIK, 4];
    const qatorlar = Math.ceil(soni / c);
    return { w: c * kw + (c - 1) * ora, h: sh + qatorlar * kh + (qatorlar - 1) * 3 };
  }
  if (b.tur === 'yozma') return { w: b.w || KENGLIK, h: sh + 4 + (b.h || YOZMA_BALANDLIK) };
  if (b.tur === 'matn') return { w: b.w || 60, h: Math.max(1, yozuvQatorlari(b).length) * (b.olcham || 3) * 1.3 + 0.8 };
  return { w: b.w || 30, h: b.h || 20 };
}

/** Blok nomi (xato xabarlari va dizayner uchun): "Yopiq 1–30", "Yozuv". */
export function blokNomi(b: AndozaBlok): string {
  const oraliq = (b.soni || 1) > 1 ? `${b.boshi}–${(b.boshi || 1) + (b.soni || 1) - 1}` : String(b.boshi || 1);
  return b.tur === 'yopiq' ? `Yopiq ${oraliq}` : b.tur === 'raqamli' ? `Raqamli ${oraliq}` : b.tur === 'moslash' ? `Moslash ${oraliq}`
    : b.tur === 'yozma' ? `Yozma ${b.boshi}` : b.tur === 'matn' ? 'Yozuv' : 'Rasm';
}

export function andozaSahifalari(p: VaraqParametrlari): Sahifa[] {
  const a = p.andoza!;
  const k = Math.min(6, Math.max(2, p.optionCount || 4));
  const kUstun = andozaDoiralari(p);
  const katak = new Map(p.tuzilma.savollar.map(x => [x.n, x]));
  const soni = Math.min(4, Math.max(1, a.sahifalar || 1));
  const sahifalar = Array.from({ length: soni }, (_, i) => ({ ...yangiSahifa(i + 1), bezak: [] as Bezak[], rasmlar: [] as (Quti & { src: string })[] }));
  birinchiSahifaDoiralari(sahifalar[0], p);
  for (const b of a.bloklar) {
    const s = sahifalar[(b.sahifa || 1) - 1];
    if (!s) continue;
    const { w } = blokOlchami(b, kUstun);
    let y = b.y;
    if (b.sarlavha && SAVOL_BLOKLARI.includes(b.tur)) {
      s.bezak.push({ x: b.x, y: b.y + 3.4, matn: b.sarlavha, olcham: 2.7, qalin: true, maxW: w });
      y += BLOK_SARLAVHA;
    }
    const n0 = b.boshi || 1;
    const jami = Math.max(1, b.soni || 1);
    const c = Math.min(Math.max(1, b.ustunlar || 1), jami);
    if (b.tur === 'yopiq') {
      const qatorlar = Math.ceil(jami / c);
      const uk = RAQAM_JOYI + kUstun * DOIRA_QADAM;
      for (let j = 0; j < jami; j++) s.yopiq.push(yopiqQator(n0 + j, b.x + Math.floor(j / qatorlar) * (uk + USTUN_ORALIQ), y + (j % qatorlar) * QATOR, Math.min(6, katak.get(n0 + j)?.harf || k)));
    } else if (b.tur === 'raqamli') {
      for (let j = 0; j < jami; j++) s.raqamli.push(raqamliKatak(n0 + j, b.x + (j % c) * (KATAK_KENGLIK + 3), y + Math.floor(j / c) * (KATAK_BALANDLIK + 3)));
    } else if (b.tur === 'moslash') {
      for (let j = 0; j < jami; j++) s.moslash!.push(moslashTori(n0 + j, b.x + (j % c) * (MOSLASH_KENGLIK + 4), y + Math.floor(j / c) * (MOSLASH_BALANDLIK + 3)));
    } else if (b.tur === 'yozma') {
      s.yozma.push({ n: n0, quti: { x: b.x, y: y + 4, w: b.w || KENGLIK, h: b.h || YOZMA_BALANDLIK }, ball: p.yozmaBallari?.[n0] ?? null, ...(katak.get(n0)?.g === 'qismli' ? { ixcham: true } : {}) });
    } else if (b.tur === 'matn') {
      const o = b.olcham || 3;
      const bw = b.w || 60;
      const x = b.tekis === 'middle' ? b.x + bw / 2 : b.tekis === 'end' ? b.x + bw : b.x;
      yozuvQatorlari(b).forEach((t, i) => { if (t) s.bezak.push({ x, y: b.y + (i + 1) * o * 1.3 - o * 0.35, matn: t, olcham: o, qalin: b.qalin, anchor: b.tekis || 'start', maxW: bw }); });
    } else if (b.tur === 'rasm' && b.src) {
      s.rasmlar.push({ x: b.x, y: b.y, w: b.w || 30, h: b.h || 20, src: b.src });
    }
  }
  for (const sh of sahifalar) sh.pages = soni;
  return sahifalar;
}

/**
 * Imtihon tuzilmasidan boshlang'ich andoza: har fanning yopiq savollari — o'z
 * sarlavhali bloki (15 qatordan ustunlar), keyin raqamli, moslash va yozma.
 * Sig'masa — keyingi sahifa (yopiq blok bo'linadi). Dizaynerda shundan boshlanadi.
 */
export function tuzilmadanAndoza(p: VaraqParametrlari): VaraqAndoza {
  const k = andozaDoiralari(p);
  const uk = RAQAM_JOYI + k * DOIRA_QADAM;
  const maxUstun = Math.max(1, Math.floor((KENGLIK + USTUN_ORALIQ) / (uk + USTUN_ORALIQ)));
  const bloklar: AndozaBlok[] = [];
  let sahifa = 1;
  let y = ANDOZA_MAYDONI.y0(1);
  let id = 0;
  const qosh = (b: Omit<AndozaBlok, 'id' | 'sahifa' | 'x' | 'y'>) => {
    let { h } = blokOlchami(b as AndozaBlok, k);
    if (y + h > ANDOZA_MAYDONI.y1 && sahifa < 4) {
      // Yopiq blok bo'linadi: sig'ganicha shu sahifada, qolgani keyingisida.
      const sh = b.sarlavha ? BLOK_SARLAVHA : 0;
      const sigadi = Math.floor((ANDOZA_MAYDONI.y1 - y - sh) / QATOR) * (b.ustunlar || 1);
      if (b.tur === 'yopiq' && sigadi >= (b.ustunlar || 1) * 5 && sigadi < (b.soni || 1)) {
        bloklar.push({ ...b, id: `b${++id}`, sahifa, x: CHAP, y, soni: sigadi });
        b = { ...b, boshi: (b.boshi || 1) + sigadi, soni: (b.soni || 1) - sigadi, sarlavha: undefined };
      }
      sahifa++;
      y = ANDOZA_MAYDONI.y0(sahifa);
      h = blokOlchami(b as AndozaBlok, k).h;
    }
    bloklar.push({ ...b, id: `b${++id}`, sahifa, x: CHAP, y });
    y += h + 4;
  };
  const fanlar = p.tuzilma.bloklar.filter(b => b.yopiq > 0).length;
  for (const b of p.tuzilma.bloklar) {
    if (!b.yopiq) continue;
    const ustunlar = Math.min(maxUstun, Math.max(1, Math.ceil(b.yopiq / 15)));
    qosh({ tur: 'yopiq', boshi: b.boshi, soni: b.yopiq, ustunlar, ...(fanlar > 1 ? { sarlavha: b.nomi } : {}) });
  }
  // Raqamli va moslash: ketma-ket raqamlar bitta blok.
  for (const tur of ['raqamli', 'moslash'] as const) {
    const ns = p.tuzilma.savollar.filter(x => x.tur === tur).map(x => x.n);
    const kw = tur === 'raqamli' ? KATAK_KENGLIK + 3 : MOSLASH_KENGLIK + 4;
    const qatorda = Math.max(1, Math.floor((KENGLIK + (tur === 'raqamli' ? 3 : 4)) / kw));
    // Bo'sh sahifaga ham sig'maydigan blok bo'linadi (masalan, 20 ta raqamli katak) - aks holda u varaqdan chiqib ketardi.
    const kh = tur === 'raqamli' ? KATAK_BALANDLIK : MOSLASH_BALANDLIK;
    const sigadi = Math.max(1, Math.floor((ANDOZA_MAYDONI.y1 - ANDOZA_MAYDONI.y0(2) + 3) / (kh + 3))) * qatorda;
    for (let i = 0; i < ns.length;) {
      let j = i;
      while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1 && j - i + 1 < sigadi) j++;
      qosh({ tur, boshi: ns[i], soni: j - i + 1, ustunlar: Math.min(qatorda, j - i + 1) });
      i = j + 1;
    }
  }
  // Qismli savol qismlari: qisqa javob maydonlari, bitta savolning qismlari bir qatorda.
  const qismlar = p.tuzilma.savollar.filter(q => q.tur === 'yozma' && q.g === 'qismli');
  const raqami = (x: { n: number; y?: string }) => String(x.y ?? x.n).replace(/[a-z]+$/, '');
  for (let i = 0; i < qismlar.length;) {
    let j = i + 1;
    while (j < qismlar.length && raqami(qismlar[j]) === raqami(qismlar[i])) j++;
    const qator = qismlar.slice(i, j);
    const w = (KENGLIK - (qator.length - 1) * QISM_ORALIQ) / qator.length;
    qosh({ tur: 'yozma', boshi: qator[0].n, soni: 1, w, h: QISM_BALANDLIK });
    const birinchi = bloklar[bloklar.length - 1];
    qator.slice(1).forEach((x, c) => bloklar.push({ tur: 'yozma', boshi: x.n, soni: 1, w, h: QISM_BALANDLIK, id: `b${++id}`, sahifa: birinchi.sahifa, x: CHAP + (c + 1) * (w + QISM_ORALIQ), y: birinchi.y }));
    i = j;
  }
  for (const x of p.tuzilma.savollar.filter(q => q.tur === 'yozma' && q.g !== 'qismli')) qosh({ tur: 'yozma', boshi: x.n, soni: 1, w: KENGLIK, h: YOZMA_BALANDLIK });
  return { sahifalar: sahifa, bloklar };
}

/** Andoza tekshiruvi: xatolar (chop etib bo'lmaydi) va ogohlantirishlar. */
export function andozaXatolari(a: VaraqAndoza, p: { tuzilma: Tuzilma | null; optionCount: number }): { xatolar: string[]; ogohlar: string[] } {
  const xatolar: string[] = [];
  const ogohlar: string[] = [];
  const k = andozaDoiralari(p);
  const qutilar = a.bloklar.map(b => ({ b, ...blokOlchami(b, k) }));
  for (const q of qutilar) {
    if (q.b.sahifa > a.sahifalar) { xatolar.push(`${blokNomi(q.b)}: ${q.b.sahifa}-sahifa yo'q`); continue; }
    const m = ANDOZA_MAYDONI;
    if (q.b.x < m.x0 - 0.05 || q.b.x + q.w > m.x1 + 0.05 || q.b.y < m.y0(q.b.sahifa) - 0.05 || q.b.y + q.h > m.y1 + 0.05) xatolar.push(`${blokNomi(q.b)} (${q.b.sahifa}-sahifa) varaq maydonidan chiqqan`);
  }
  for (let i = 0; i < qutilar.length; i++) for (let j = i + 1; j < qutilar.length; j++) {
    const u = qutilar[i], v = qutilar[j];
    if (u.b.sahifa !== v.b.sahifa) continue;
    const kesish = Math.min(u.b.x + u.w, v.b.x + v.w) - Math.max(u.b.x, v.b.x) > 0.5 && Math.min(u.b.y + u.h, v.b.y + v.h) - Math.max(u.b.y, v.b.y) > 0.5;
    if (kesish) xatolar.push(`${blokNomi(u.b)} va ${blokNomi(v.b)} ustma-ust (${u.b.sahifa}-sahifa)`);
  }
  if (!p.tuzilma) return { xatolar, ogohlar };
  // Har savol varaqda bir marta va o'z turidagi blokda.
  const joyi = new Map<number, AndozaTuri[]>();
  for (const b of a.bloklar) {
    if (!SAVOL_BLOKLARI.includes(b.tur)) continue;
    for (let n = b.boshi || 1; n < (b.boshi || 1) + (b.soni || 1); n++) joyi.set(n, [...(joyi.get(n) || []), b.tur]);
  }
  const oraliqlar = (l: number[]) => {
    const out: string[] = [];
    for (let i = 0; i < l.length;) { let j = i; while (j + 1 < l.length && l[j + 1] === l[j] + 1) j++; out.push(i === j ? `${l[i]}` : `${l[i]}–${l[j]}`); i = j + 1; }
    return out.join(', ');
  };
  const yoq: number[] = [], ikki: number[] = [], boshqaTur: string[] = [];
  const TUR: Record<string, string> = { yopiq: 'yopiq', raqamli: 'raqamli', moslash: 'moslash', yozma: 'yozma' };
  for (const sv of p.tuzilma.savollar) {
    const l = joyi.get(sv.n) || [];
    if (!l.length) yoq.push(sv.n);
    else if (l.length > 1) ikki.push(sv.n);
    else if (l[0] !== sv.tur) boshqaTur.push(`${sv.n}-savol ${TUR[sv.tur]}, blokda — ${TUR[l[0]]}`);
  }
  if (yoq.length) xatolar.push(`Varaqda yo'q savollar: ${oraliqlar(yoq)}`);
  if (ikki.length) xatolar.push(`Ikki joyda turgan savollar: ${oraliqlar(ikki)}`);
  xatolar.push(...boshqaTur.slice(0, 5));
  const ortiqcha = [...joyi.keys()].filter(n => n > p.tuzilma.jami).sort((x, y) => x - y);
  if (ortiqcha.length) ogohlar.push(`Imtihonda yo'q savollar ham varaqda: ${oraliqlar(ortiqcha)} (o'qilmaydi)`);
  return { xatolar, ogohlar };
}

/** QR matni. Shaxsiy varaq: varaq kodi; universal: imtihon va smena. */
/**
 * QR matni. Shaxsiy varaq: varaq kodi; universal: imtihon va smena; anonim
 * so'rovnoma: imtihon, smena va nusxa kodi (bir nusxaning betlari birga, ismsiz).
 */
export function qrMatni(v: { sheetCode?: string; examId?: number; session?: number; anonimKod?: string; page: number }): string {
  if (v.sheetCode) return `IMT1|S|${v.sheetCode}|${v.page}`;
  if (v.anonimKod) return `IMT1|A|${v.examId}|${v.session || 1}|${v.anonimKod}|${v.page}`;
  return `IMT1|U|${v.examId}|${v.session || 1}|${v.page}`;
}

export interface QrMalumot { turi: 'S' | 'U' | 'A'; sheetCode?: string; examId?: number; session?: number; kod?: string; page: number }

export function qrniOqi(matn: string): QrMalumot | null {
  const q = String(matn || '').trim().split('|');
  if (q[0] !== 'IMT1') return null;
  if (q[1] === 'S' && q[2]) return { turi: 'S', sheetCode: q[2], page: parseInt(q[3]) || 1 };
  if (q[1] === 'U' && parseInt(q[2])) return { turi: 'U', examId: parseInt(q[2]), session: parseInt(q[3]) || 1, page: parseInt(q[4]) || 1 };
  if (q[1] === 'A' && parseInt(q[2]) && q[4]) return { turi: 'A', examId: parseInt(q[2]), session: parseInt(q[3]) || 1, kod: q[4], page: parseInt(q[5]) || 1 };
  return null;
}
