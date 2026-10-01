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

export interface YopiqSavol { n: number; raqam: { x: number; y: number }; doiralar: Doira[] }
export interface RaqamliSavol { n: number; quti: Quti; yozuv: Quti; ustunlar: Doira[][] }
export interface YozmaSavol { n: number; quti: Quti; ball: number | null }
/** Moslashtirish (matritsa): qatorlar A–D, har qatorda P–T doirachalari. */
export interface MoslashSavol { n: number; quti: Quti; qatorlar: Doira[][] }
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
}

export interface Tuzilma {
  bloklar: { nomi: string; boshi: number; oxiri: number; yopiq: number; raqamli: number; moslash?: number; yozma: number }[];
  savollar: { n: number; blok: number; tur: 'yopiq' | 'raqamli' | 'moslash' | 'yozma' }[];
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

/**
 * Varaq sahifalari. Yopiq savollar ustunma-ustun (yuqoridan pastga, keyin
 * o'ngga), har blok boshida uning nomi. Keyin raqamli kataklar qatorlari,
 * keyin yozma maydonlar. Joy tugasa — keyingi sahifa.
 */
export function varaqSahifalari(p: VaraqParametrlari): Sahifa[] {
  if (p.sorovnoma?.savollar.length) return sorovnomaSahifalari(p);
  const k = Math.min(6, Math.max(2, p.optionCount || 4));
  const sahifalar: Sahifa[] = [];
  let s = yangiSahifa(1);
  sahifalar.push(s);

  // 1-sahifa: variant va ID doirachalari.
  if (p.variantBubble) {
    const soni = Math.max(1, Math.min(26, p.variantCount || 1));
    for (let i = 0; i < soni; i++) s.variantlar.push({ x: VARIANT_X0 + i * DOIRA_QADAM, y: VARIANT_Y, r: VARIANT_R, v: String.fromCharCode(65 + i) });
  }
  for (let c = 0; c < ID_USTUNLARI; c++) {
    const ustun: Doira[] = [];
    for (let d = 0; d < 10; d++) ustun.push({ x: ID_X0 + c * ID_QADAM_X, y: ID_Y0 + d * ID_QADAM_Y, r: ID_R, v: String(d) });
    s.idUstunlari.push(ustun);
  }

  // --- Yopiq savollar ---
  const ustunKeng = RAQAM_JOYI + k * DOIRA_QADAM;
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
        const cy = y + QATOR / 2;
        const doiralar: Doira[] = [];
        for (let d = 0; d < k; d++) doiralar.push({ x: x + RAQAM_JOYI + DOIRA_QADAM / 2 + d * DOIRA_QADAM, y: cy, r: DOIRA_R, v: HARF[d] });
        s.yopiq.push({ n: kt.n, raqam: { x: x + RAQAM_JOYI - 1.2, y: cy + 1.05 }, doiralar });
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
    raqamlilar.slice(i, i + qatordaKatak).forEach((n, j) => {
      const bx = CHAP + j * katakQadam;
      const by = joriyY;
      const yozuv = { x: bx + 1.5, y: by + 4, w: RAQAM_USTUNLARI * KATAK_QADAM_X, h: KATAK_YOZUV };
      const ustunlar: Doira[][] = [];
      for (let c = 0; c < RAQAM_USTUNLARI; c++) {
        const col: Doira[] = [];
        RAQAM_BELGILARI.forEach((v: string, si: number) => {
          col.push({ x: yozuv.x + c * KATAK_QADAM_X + KATAK_QADAM_X / 2, y: by + 4 + KATAK_YOZUV + 1 + si * KATAK_QADAM_Y + KATAK_QADAM_Y / 2, r: KATAK_R, v });
        });
        ustunlar.push(col);
      }
      s.raqamli.push({ n, quti: { x: bx, y: by, w: KATAK_KENGLIK, h: KATAK_BALANDLIK }, yozuv, ustunlar });
    });
    joriyY += KATAK_BALANDLIK + 3;
  }

  // Moslashtirish to'rlari: 4 × 5, qatorda bir nechta.
  const moslashlar = p.tuzilma.savollar.filter(x => x.tur === 'moslash').map(x => x.n);
  const qatordaMoslash = Math.max(1, Math.floor((KENGLIK + 4) / (MOSLASH_KENGLIK + 4)));
  const moslashQadam = qatordaMoslash > 1 ? (KENGLIK - MOSLASH_KENGLIK) / (qatordaMoslash - 1) : 0;
  for (let i = 0; i < moslashlar.length; i += qatordaMoslash) {
    joy(MOSLASH_BALANDLIK);
    moslashlar.slice(i, i + qatordaMoslash).forEach((n, j) => {
      const bx = CHAP + j * moslashQadam;
      const by = joriyY;
      const qatorlar: Doira[][] = [];
      for (let r = 0; r < 4; r++) {
        const qator: Doira[] = [];
        for (let c = 0; c < 5; c++) qator.push({ x: bx + 7 + c * MOSLASH_QADAM_X + MOSLASH_QADAM_X / 2, y: by + 9.5 + r * MOSLASH_QADAM_Y + MOSLASH_QADAM_Y / 2, r: MOSLASH_R, v: 'PQRST'[c] });
        qatorlar.push(qator);
      }
      (s.moslash ||= []).push({ n, quti: { x: bx, y: by, w: MOSLASH_KENGLIK, h: MOSLASH_BALANDLIK }, qatorlar });
    });
    joriyY += MOSLASH_BALANDLIK + 3;
  }

  const yozmalar = p.tuzilma.savollar.filter(x => x.tur === 'yozma').map(x => x.n);
  for (const n of yozmalar) {
    joy(YOZMA_BALANDLIK + 4);
    s.yozma.push({ n, quti: { x: CHAP, y: joriyY + 4, w: KENGLIK, h: YOZMA_BALANDLIK }, ball: p.yozmaBallari?.[n] ?? null });
    joriyY += YOZMA_BALANDLIK + 7;
  }

  for (const sh of sahifalar) sh.pages = sahifalar.length;
  return sahifalar;
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
