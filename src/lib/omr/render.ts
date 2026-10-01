// Javob varaqasini SVG qilib chizish (brauzerda chop etiladi). Koordinatalar —
// layout.ts dan, millimetrda. Oq-qora: rangli bosma kerak emas, o'qigich
// faqat qora markerlar, doira chiziqlari va bo'yoqqa qaraydi. Doira ichidagi
// harflar och kulrang — o'qigich ularni belgi deb olmaydi.

import QRCode from 'qrcode';
import { esc } from '../chopEtish';
import {
  W, H, MARKER, MARKERLAR, YONALISH, SAHIFA_BELGILARI, SAHIFA_BELGI, RASM, QR_1, CHAP, ONG,
  VARIANT_Y, ID_X0, ID_QADAM_X, ID_USTUNLARI, qrMatni,
} from './layout';
import type { Sahifa, Doira } from './layout';

export interface VaraqUmumiy {
  markaz: string;
  imtihon: string;
  sana: string;
  examId: number;
  session: number;
  smena?: string;
  /** Markaz logosi (Sozlamalar), manzil va telefon — varaq tepasi va pastida. */
  logo?: string | null;
  manzil?: string | null;
  telefon?: string | null;
  /** Fan bandi: "MATEMATIKA — 30 ta savol". */
  fanlar?: string;
}

/** Shaxsiy varaq egasi. null — universal (nomsiz) varaq. */
export interface VaraqEgasi {
  ism: string;
  kurs?: string;
  xona?: string;
  qator?: number | null;
  orin?: number | null;
  variant?: string | null;
  sheetCode: string;
  rasm?: string | null;
  mehmon?: boolean;
  filial?: string | null;
  maktab?: string | null;
  sinf?: string | null;
  /** O'quvchi ID si (5 xonali). */
  kod?: number | null;
}

const f = (n: number) => Math.round(n * 100) / 100;
const QORA = '#000';
const CHIZIQ = '#222';
const HARF = '#9a9a9a';

function matn(x: number, y: number, s: string, o: { size?: number; bold?: boolean; anchor?: 'start' | 'middle' | 'end'; rang?: string; mono?: boolean; maxW?: number } = {}): string {
  let size = o.size ?? 3;
  // Uzun ism sig'maganda shrift kichrayadi (taxminiy kenglik: 0.55 × shrift × belgi).
  if (o.maxW) while (size > 2 && s.length * size * (o.bold ? 0.66 : 0.55) > o.maxW) size -= 0.2;
  const shrift = o.mono ? "'Courier New', monospace" : 'Arial, Helvetica, sans-serif';
  return `<text x="${f(x)}" y="${f(y)}" font-size="${f(size)}" font-family="${shrift}"${o.bold ? ' font-weight="700"' : ''}${o.anchor ? ` text-anchor="${o.anchor}"` : ''} fill="${o.rang || QORA}">${esc(s)}</text>`;
}

// Doiracha bir marta <symbol> bo'lib chiziladi, keyin <use> bilan qo'yiladi:
// 400 kishilik chop etishda hujjat bir necha barobar yengil bo'ladi.
type Belgilar = Map<string, string>;
function doira(belgilar: Belgilar, d: Doira, harfOlchami = 2.3): string {
  const id = `d${String(d.r).replace('.', '_')}_${String(harfOlchami).replace('.', '_')}_${d.v.charCodeAt(0)}`;
  if (!belgilar.has(id)) {
    const w = d.r + 0.2;
    belgilar.set(id, `<symbol id="${id}" viewBox="${-w} ${-w} ${2 * w} ${2 * w}" width="${f(2 * w)}" height="${f(2 * w)}" overflow="visible">` +
      `<circle r="${d.r}" fill="#fff" stroke="${CHIZIQ}" stroke-width="0.3"/>` +
      `<text y="${f(harfOlchami * 0.36)}" font-size="${harfOlchami}" font-family="Arial, sans-serif" text-anchor="middle" fill="${HARF}">${esc(d.v === '-' ? '−' : d.v)}</text></symbol>`);
  }
  const w = d.r + 0.2;
  return `<use href="#${id}" x="${f(d.x - w)}" y="${f(d.y - w)}" width="${f(2 * w)}" height="${f(2 * w)}"/>`;
}

function qrYol(text: string, x: number, y: number, s: number): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const m = s / n;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      // Bir qatordagi ketma-ket modullar bitta to'rtburchak.
      let e = c;
      while (e + 1 < n && qr.modules.get(r, e + 1)) e++;
      d += `M${f(x + c * m)} ${f(y + r * m)}h${f((e - c + 1) * m)}v${f(m)}h${f(-(e - c + 1) * m)}z`;
      c = e;
    }
  }
  return `<path d="${d}" fill="${QORA}"/>`;
}

/** Sarlavhali blok (ESLATMA, ABITURIYENT MA'LUMOTI): ramka va och kulrang sarlavha chizig'i. */
function blok(q: string[], x: number, y: number, w: number, h: number, sarlavha: string) {
  q.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="none" stroke="${CHIZIQ}" stroke-width="0.3"/>`);
  q.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="4.6" fill="#e3e3e3" stroke="${CHIZIQ}" stroke-width="0.3"/>`);
  q.push(matn(x + w / 2, y + 3.4, sarlavha, { size: 2.6, bold: true, anchor: 'middle', maxW: w - 2 }));
}

/** Bo'yash namunasi: to'g'ri (to'liq bo'yalgan) va noto'g'ri (×, nuqta, ✓) doirachalar. */
function bo_yashNamunasi(q: string[], x: number, y: number, qisqa = false) {
  const r = 1.6;
  const doiraCh = (cx: number) => `<circle cx="${f(cx)}" cy="${f(y)}" r="${r}" fill="#fff" stroke="${CHIZIQ}" stroke-width="0.25"/>`;
  q.push(matn(x, y + 0.9, "To'g'ri:", { size: 2.2, rang: '#333' }));
  const t = x + (qisqa ? 9.5 : 10);
  q.push(`<circle cx="${f(t)}" cy="${f(y)}" r="${r}" fill="#111"/>`);
  const n0 = t + (qisqa ? 6 : 9);
  q.push(matn(n0, y + 0.9, "Noto'g'ri:", { size: 2.2, rang: '#333' }));
  const n = n0 + (qisqa ? 12 : 13);
  // ×
  q.push(doiraCh(n), `<path d="M${f(n - 1)} ${f(y - 1)}L${f(n + 1)} ${f(y + 1)}M${f(n + 1)} ${f(y - 1)}L${f(n - 1)} ${f(y + 1)}" stroke="#111" stroke-width="0.35"/>`);
  // nuqta
  q.push(doiraCh(n + 5), `<circle cx="${f(n + 5)}" cy="${f(y)}" r="0.6" fill="#111"/>`);
  // ✓
  q.push(doiraCh(n + 10), `<path d="M${f(n + 9)} ${f(y)}L${f(n + 9.8)} ${f(y + 0.9)}L${f(n + 11.2)} ${f(y - 1)}" fill="none" stroke="#111" stroke-width="0.35"/>`);
}

/** Uzun ismni ikki qatorga (so'z chegarasida). */
function ikkiQator(s: string, max: number): [string, string] {
  if (s.length <= max) return [s, ''];
  const sozlar = s.split(/\s+/);
  let a = '';
  while (sozlar.length && (a + ' ' + sozlar[0]).trim().length <= max) a = (a + ' ' + sozlar.shift()).trim();
  if (!a) a = sozlar.shift() || '';
  return [a, sozlar.join(' ')];
}

export function varaqSvg(sahifa: Sahifa, u: VaraqUmumiy, egasi: VaraqEgasi | null): string {
  const q: string[] = [];
  const belgilar: Belgilar = new Map();
  const birinchi = sahifa.page === 1;

  // Markerlar, yo'nalish chizig'i, sahifa belgilari
  for (const m of Object.values(MARKERLAR)) q.push(`<rect x="${f(m.x - MARKER / 2)}" y="${f(m.y - MARKER / 2)}" width="${MARKER}" height="${MARKER}" fill="${QORA}"/>`);
  q.push(`<rect x="${YONALISH.x}" y="${YONALISH.y}" width="${YONALISH.w}" height="${YONALISH.h}" fill="${QORA}"/>`);
  SAHIFA_BELGILARI.forEach((p, i) => {
    const s = SAHIFA_BELGI;
    const toliq = sahifa.page & (1 << i);
    q.push(`<rect x="${f(p.x - s / 2)}" y="${f(p.y - s / 2)}" width="${s}" height="${s}" fill="${toliq ? QORA : '#fff'}" stroke="${CHIZIQ}" stroke-width="0.25"/>`);
  });

  const qrText = egasi ? qrMatni({ sheetCode: egasi.sheetCode, page: sahifa.page }) : qrMatni({ examId: u.examId, session: u.session, page: sahifa.page });
  q.push(qrYol(qrText, sahifa.qr.x, sahifa.qr.y, sahifa.qr.s));

  if (birinchi) {
    // Sarlavha — markazning Addmen varag'idagidek: chapda logo va markaz, o'rtada
    // "JAVOBLAR VARAQASI" va imtihon nomi, o'ngda sana, smena, sahifa.
    if (u.logo) q.push(`<image href="${esc(u.logo)}" x="${CHAP}" y="14" width="11" height="11" preserveAspectRatio="xMidYMid meet"/>`);
    const markazX = u.logo ? CHAP + 13 : CHAP;
    q.push(matn(markazX, 19, u.markaz, { size: 3.3, bold: true, maxW: 48 - (u.logo ? 13 : 0) }));
    q.push(matn(markazX, 23.2, "o'quv markazi", { size: 2.3, rang: '#555' }));
    q.push(matn(105, 20, 'JAVOBLAR VARAQASI', { size: 6.2, bold: true, anchor: 'middle' }));
    q.push(matn(105, 25.6, u.imtihon, { size: 3, anchor: 'middle', rang: '#333', maxW: 76 }));
    q.push(matn(ONG, 18, u.sana, { size: 2.7, anchor: 'end', rang: '#333' }));
    if (u.smena) q.push(matn(ONG, 22, u.smena, { size: 2.5, anchor: 'end', rang: '#333', maxW: 40 }));
    q.push(matn(ONG, 26, `${sahifa.page}/${sahifa.pages}-sahifa`, { size: 2.3, anchor: 'end', rang: '#666' }));

    if (egasi) {
      // ESLATMA (chap blok) — ko'rsatma, bo'yash namunasi, abituriyent imzosi.
      blok(q, CHAP, 29, 78, 42.5, 'ESLATMA');
      const yoriq = [
        'Har bir savolga faqat bitta javob belgilang.',
        "Faqat qora yoki ko'k ruchkadan foydalaning.",
        "Doirachani to'liq bo'yang, chetiga chiqarmang.",
        "Javobni o'zgartirish kerak bo'lsa — nazoratchiga ayting.",
      ];
      yoriq.forEach((s, i) => q.push(matn(CHAP + 2, 38 + i * 3.6, `${i + 1}. ${s}`, { size: 2.35, rang: '#222', maxW: 74 })));
      bo_yashNamunasi(q, CHAP + 2, 55);
      q.push(`<line x1="${CHAP}" y1="61" x2="${CHAP + 78}" y2="61" stroke="#bbb" stroke-width="0.2"/>`);
      q.push(matn(CHAP + 2, 64.2, 'Abituriyent tomonidan to\'ldiriladi:', { size: 2.2, bold: true, rang: '#333' }));
      q.push(matn(CHAP + 2, 69.3, 'F.I.Sh: ________________________', { size: 2.4, rang: '#444' }));
      q.push(matn(CHAP + 76, 69.3, 'Imzo: ________', { size: 2.4, anchor: 'end', rang: '#444' }));

      // ABITURIYENT MA'LUMOTI (o'ng blok) — ism, filial, maktab, kurs, joy, ID; QR va rasm.
      blok(q, 100, 29, ONG - 100, 42.5, "ABITURIYENT MA'LUMOTI");
      const ism = ikkiQator(egasi.ism || '', 22);
      q.push(matn(102, 38.6, ism[0], { size: 3.1, bold: true, maxW: 38 }));
      if (ism[1]) q.push(matn(102, 42.4, ism[1], { size: 3.1, bold: true, maxW: 38 }));
      let y = ism[1] ? 46.8 : 43.2;
      const qator = (nom: string, qiymat?: string | null) => {
        if (!qiymat) return;
        q.push(matn(102, y, `${nom}: ${qiymat}`, { size: 2.45, maxW: 38, rang: '#222' }));
        y += 3.7;
      };
      qator('Filial', egasi.filial);
      qator('Maktab', [egasi.maktab, egasi.sinf].filter(Boolean).join(', ') || null);
      qator('Kurs', egasi.mehmon ? 'Tashqi qatnashchi' : egasi.kurs);
      qator('Xona', [egasi.xona, egasi.qator != null ? `${egasi.qator}-qator` : ''].filter(Boolean).join(' · ') || null);
      if (egasi.kod) {
        q.push(matn(102, 69.3, 'ID:', { size: 2.5, rang: '#444' }));
        q.push(matn(108, 69.5, String(egasi.kod), { size: 3.6, bold: true, mono: true }));
      }
      q.push(matn(145, 69.3, egasi.sheetCode, { size: 2.3, anchor: 'end', mono: true, rang: '#555' }));
      // Rasm
      if (egasi.rasm) {
        q.push(`<clipPath id="rasm${sahifa.page}"><rect x="${RASM.x}" y="${RASM.y}" width="${RASM.w}" height="${RASM.h}"/></clipPath>`);
        q.push(`<image href="${esc(egasi.rasm)}" x="${RASM.x}" y="${RASM.y}" width="${RASM.w}" height="${RASM.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#rasm${sahifa.page})"/>`);
      }
      q.push(`<rect x="${RASM.x}" y="${RASM.y}" width="${RASM.w}" height="${RASM.h}" fill="none" stroke="${CHIZIQ}" stroke-width="0.3"/>`);
      // QR va rasm ostida: variant va o'rin — tarqatishda ko'zga tashlanadi.
      q.push(matn(QR_1.x + QR_1.s / 2, 62.6, 'VARIANT', { size: 2, anchor: 'middle', rang: '#555' }));
      q.push(matn(QR_1.x + QR_1.s / 2, 69.6, egasi.variant || '—', { size: 7, bold: true, anchor: 'middle' }));
      q.push(matn(RASM.x + RASM.w / 2, 62.6, "O'RIN", { size: 2, anchor: 'middle', rang: '#555' }));
      q.push(matn(RASM.x + RASM.w / 2, 69.6, egasi.orin != null ? String(egasi.orin) : '—', { size: 7, bold: true, anchor: 'middle' }));
    } else {
      // Universal varaq: ism qo'lda yoziladi, ID doirachalardan o'qiladi.
      blok(q, CHAP, 29, 43, 42.5, 'ESLATMA');
      ["Bitta savolga — bitta javob.", "Qora yoki ko'k ruchka.", "Doirachani to'liq bo'yang.", "O'quvchi ID ni yozib, bo'yang."]
        .forEach((s, i) => q.push(matn(CHAP + 2, 38 + i * 3.6, `${i + 1}. ${s}`, { size: 2.3, rang: '#222', maxW: 40 })));
      bo_yashNamunasi(q, CHAP + 2, 55, true);
      q.push(matn(CHAP + 2, 64.2, 'F.I.Sh:', { size: 2.3, bold: true, rang: '#333' }));
      q.push(`<line x1="${CHAP + 2}" y1="69.5" x2="${CHAP + 41}" y2="69.5" stroke="#999" stroke-width="0.2"/>`);
      const idX0 = ID_X0 - 3.5, idW = (ID_USTUNLARI - 1) * ID_QADAM_X + 7;
      blok(q, idX0, 29, idW, 42.5, "O'QUVCHI ID");
      for (const ustun of sahifa.idUstunlari) for (const d of ustun) q.push(doira(belgilar, d, 2));
      blok(q, 100, 29, ONG - 100, 42.5, 'QATNASHCHI');
      q.push(matn(102, 39, 'Kurs / xona / o\'rin:', { size: 2.4, rang: '#444' }));
      q.push(`<line x1="102" y1="45" x2="144" y2="45" stroke="#999" stroke-width="0.2"/>`);
      q.push(matn(102, 51.5, 'Imzo:', { size: 2.4, rang: '#444' }));
      q.push(`<line x1="102" y1="57" x2="144" y2="57" stroke="#999" stroke-width="0.2"/>`);
      q.push(matn(102, 68, `UNIVERSAL · ${u.session}-smena`, { size: 2.6, bold: true }));
    }
    if (sahifa.variantlar.length) {
      q.push(matn(CHAP, VARIANT_Y + 1, 'Kitobcha varianti:', { size: 2.7, bold: true }));
      for (const d of sahifa.variantlar) q.push(doira(belgilar, d, 2.3));
    }
    // Fan bandi: "MATEMATIKA — 30 ta savol" (bir nechta fan — hammasi).
    if (u.fanlar) {
      q.push(`<rect x="${CHAP}" y="79.5" width="${ONG - CHAP}" height="5.4" fill="#e3e3e3" stroke="${CHIZIQ}" stroke-width="0.25"/>`);
      q.push(matn(W / 2, 83.3, u.fanlar, { size: 2.9, bold: true, anchor: 'middle', maxW: ONG - CHAP - 6 }));
    }
  } else {
    // Keyingi sahifalar: qisqa sarlavha va egasi (sahifalar aralashib ketmasin).
    q.push(matn(CHAP, 17, u.markaz, { size: 2.6, rang: '#444', maxW: 70 }));
    q.push(matn(CHAP, 21.8, u.imtihon, { size: 3.8, bold: true, maxW: 118 }));
    q.push(matn(166, 17, [u.sana, u.smena].filter(Boolean).join(' · '), { size: 2.6, anchor: 'end', rang: '#444' }));
    q.push(matn(166, 21.8, `${sahifa.page}/${sahifa.pages}-sahifa`, { size: 2.6, anchor: 'end', rang: '#444' }));
    if (egasi) {
      q.push(matn(CHAP, 30, egasi.ism || '', { size: 3.6, bold: true, maxW: 120 }));
      q.push(matn(CHAP, 35.5, `Varaq kodi: ${egasi.sheetCode}${egasi.variant ? ` · Variant ${egasi.variant}` : ''}`, { size: 2.7, mono: true }));
    } else {
      q.push(matn(CHAP, 30, 'F.I.Sh: ____________________________   ID: __________', { size: 2.8, rang: '#444' }));
    }
  }

  // Blok sarlavhalari va yopiq savollar
  for (const s of sahifa.sarlavhalar) q.push(matn(s.x, s.y, s.matn, { size: 2.5, bold: true, rang: '#333', maxW: 34 }));
  for (const sv of sahifa.yopiq) {
    q.push(matn(sv.raqam.x, sv.raqam.y, String(sv.n), { size: 2.7, bold: true, anchor: 'end' }));
    for (const d of sv.doiralar) q.push(doira(belgilar, d));
  }

  // Raqamli kataklar
  for (const sv of sahifa.raqamli) {
    const { quti, yozuv } = sv;
    q.push(`<rect x="${f(quti.x)}" y="${f(quti.y)}" width="${f(quti.w)}" height="${f(quti.h)}" fill="none" stroke="${CHIZIQ}" stroke-width="0.3"/>`);
    q.push(matn(quti.x + 1.5, quti.y + 3, `${sv.n}-savol (javob)`, { size: 2.5, bold: true }));
    sv.ustunlar.forEach((ustun, c) => {
      const x = yozuv.x + c * (yozuv.w / sv.ustunlar.length);
      q.push(`<rect x="${f(x + 0.3)}" y="${f(yozuv.y)}" width="${f(yozuv.w / sv.ustunlar.length - 0.6)}" height="${f(yozuv.h)}" fill="#fff" stroke="#888" stroke-width="0.2"/>`);
      for (const d of ustun) q.push(doira(belgilar, d, 1.9));
    });
  }

  // Yozma maydonlar
  for (const sv of sahifa.yozma) {
    const { quti } = sv;
    q.push(matn(quti.x, quti.y - 1.2, `${sv.n}-savol — yozma javob${sv.ball ? ` (${sv.ball} ball)` : ''}`, { size: 2.7, bold: true }));
    q.push(`<rect x="${f(quti.x)}" y="${f(quti.y)}" width="${f(quti.w)}" height="${f(quti.h)}" fill="none" stroke="${CHIZIQ}" stroke-width="0.35"/>`);
    for (let y = quti.y + 8; y < quti.y + quti.h - 2; y += 8) q.push(`<line x1="${f(quti.x + 2)}" y1="${f(y)}" x2="${f(quti.x + quti.w - 2)}" y2="${f(y)}" stroke="#ddd" stroke-width="0.2"/>`);
    q.push(matn(quti.x + quti.w - 1.5, quti.y + quti.h - 1.5, 'Ball: ______ (ustoz)', { size: 2.3, anchor: 'end', rang: '#888' }));
  }

  // Past: qo'shimcha ma'lumotlar (manzil, telefon) va test sanasi — markaz varag'idagidek.
  // Sahifa belgilari (x 22–38) va pastki markerlar orasida.
  const aloqa = [u.manzil, u.telefon].filter(Boolean).join(' · ');
  q.push(matn(42, 283.2, "QO'SHIMCHA MA'LUMOTLAR", { size: 2.1, bold: true, rang: '#444' }));
  if (aloqa) q.push(matn(42, 287.4, aloqa, { size: 2.1, rang: '#555', maxW: 98 }));
  q.push(matn(ONG, 283.2, `Test sanasi: ${u.sana}`, { size: 2.4, bold: true, anchor: 'end' }));
  q.push(matn(ONG, 287.4, `${egasi ? `Varaq kodi ${egasi.sheetCode}` : `Universal · ${u.session}-smena`} · ${sahifa.page}/${sahifa.pages} · bukilmasin`, { size: 2, anchor: 'end', rang: '#777' }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"><defs>${[...belgilar.values()].join('')}</defs>${q.join('')}</svg>`;
}

/** Chop etish uchun CSS: har varaq alohida A4, chetsiz. */
export const VARAQ_CSS = `
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.varaq { width: 210mm; height: 297mm; page-break-after: always; break-after: page; overflow: hidden; }
.varaq:last-child { page-break-after: auto; break-after: auto; }
.varaq svg { display: block; width: 210mm; height: 297mm; }
`;
