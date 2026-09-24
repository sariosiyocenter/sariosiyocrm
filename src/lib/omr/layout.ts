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
export const QR_1 = { x: 146, y: 24, s: 24 };
export const QR_KEYINGI = { x: 170, y: 16, s: 20 };
export const RASM = { x: 173, y: 24, w: 19, h: 24 };

const Y0_BIRINCHI = 80;
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

// Yozma javob maydoni
const YOZMA_BALANDLIK = 40;

// Variant va o'quvchi ID doirachalari (1-sahifa)
export const VARIANT_Y = 67.5;
export const VARIANT_X0 = 60;
export const VARIANT_R = 2.1;
export const ID_USTUNLARI = 6;
export const ID_X0 = 70;
export const ID_QADAM_X = 5;
export const ID_Y0 = 29;
export const ID_QADAM_Y = 3.7;
export const ID_R = 1.6;

export interface Doira { x: number; y: number; r: number; v: string }
export interface Quti { x: number; y: number; w: number; h: number }

export interface YopiqSavol { n: number; raqam: { x: number; y: number }; doiralar: Doira[] }
export interface RaqamliSavol { n: number; quti: Quti; yozuv: Quti; ustunlar: Doira[][] }
export interface YozmaSavol { n: number; quti: Quti; ball: number | null }
export interface BlokSarlavha { matn: string; x: number; y: number }

export interface Sahifa {
  page: number;
  pages: number;
  yopiq: YopiqSavol[];
  raqamli: RaqamliSavol[];
  yozma: YozmaSavol[];
  sarlavhalar: BlokSarlavha[];
  /** 1-sahifada (sozlamada yoqilgan bo'lsa) — kitobcha varianti. */
  variantlar: Doira[];
  /** 1-sahifada — universal varaqdagi o'quvchi ID si (faqat universal varaqda chiziladi va o'qiladi). */
  idUstunlari: Doira[][];
  qr: { x: number; y: number; s: number };
}

export interface Tuzilma {
  bloklar: { nomi: string; boshi: number; oxiri: number; yopiq: number; raqamli: number; yozma: number }[];
  savollar: { n: number; blok: number; tur: 'yopiq' | 'raqamli' | 'yozma' }[];
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
}

const HARF = 'ABCDEF';

function yangiSahifa(page: number): Sahifa {
  return {
    page, pages: 0, yopiq: [], raqamli: [], yozma: [], sarlavhalar: [], variantlar: [], idUstunlari: [],
    qr: page === 1 ? QR_1 : QR_KEYINGI,
  };
}

/**
 * Varaq sahifalari. Yopiq savollar ustunma-ustun (yuqoridan pastga, keyin
 * o'ngga), har blok boshida uning nomi. Keyin raqamli kataklar qatorlari,
 * keyin yozma maydonlar. Joy tugasa — keyingi sahifa.
 */
export function varaqSahifalari(p: VaraqParametrlari): Sahifa[] {
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
    const qatorlar = Math.ceil(olinadi / ustunSoni);
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
export function qrMatni(v: { sheetCode?: string; examId?: number; session?: number; page: number }): string {
  return v.sheetCode ? `IMT1|S|${v.sheetCode}|${v.page}` : `IMT1|U|${v.examId}|${v.session || 1}|${v.page}`;
}

export interface QrMalumot { turi: 'S' | 'U'; sheetCode?: string; examId?: number; session?: number; page: number }

export function qrniOqi(matn: string): QrMalumot | null {
  const q = String(matn || '').trim().split('|');
  if (q[0] !== 'IMT1') return null;
  if (q[1] === 'S' && q[2]) return { turi: 'S', sheetCode: q[2], page: parseInt(q[3]) || 1 };
  if (q[1] === 'U' && parseInt(q[2])) return { turi: 'U', examId: parseInt(q[2]), session: parseInt(q[3]) || 1, page: parseInt(q[4]) || 1 };
  return null;
}
