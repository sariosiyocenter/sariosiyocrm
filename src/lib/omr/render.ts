// Javob varaqasini SVG qilib chizish (brauzerda chop etiladi). Koordinatalar —
// layout.ts dan, millimetrda. Oq-qora: rangli bosma kerak emas, o'qigich
// faqat qora markerlar, doira chiziqlari va bo'yoqqa qaraydi. Doira ichidagi
// harflar och kulrang — o'qigich ularni belgi deb olmaydi.

import QRCode from 'qrcode';
import { esc } from '../chopEtish';
import {
  W, H, MARKER, MARKERLAR, YONALISH, SAHIFA_BELGILARI, SAHIFA_BELGI, RASM, CHAP, ONG,
  VARIANT_Y, ID_X0, ID_Y0, ID_QADAM_X, ID_QADAM_Y, ID_USTUNLARI, qrMatni,
} from './layout';
import type { Sahifa, Doira } from './layout';

export interface VaraqUmumiy {
  markaz: string;
  imtihon: string;
  sana: string;
  examId: number;
  session: number;
  smena?: string;
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
}

const f = (n: number) => Math.round(n * 100) / 100;
const QORA = '#000';
const CHIZIQ = '#222';
const HARF = '#9a9a9a';

function matn(x: number, y: number, s: string, o: { size?: number; bold?: boolean; anchor?: 'start' | 'middle' | 'end'; rang?: string; mono?: boolean; maxW?: number } = {}): string {
  let size = o.size ?? 3;
  // Uzun ism sig'maganda shrift kichrayadi (taxminiy kenglik: 0.55 × shrift × belgi).
  if (o.maxW) while (size > 2 && s.length * size * 0.55 > o.maxW) size -= 0.2;
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

  // Sarlavha
  q.push(matn(CHAP, 17, u.markaz, { size: 2.6, rang: '#444', maxW: 70 }));
  q.push(matn(CHAP, 21.8, u.imtihon, { size: 3.8, bold: true, maxW: birinchi ? 100 : 118 }));
  const oPastki = [u.sana, u.smena].filter(Boolean).join(' · ');
  q.push(matn(birinchi ? 142 : 166, 17, oPastki, { size: 2.6, anchor: 'end', rang: '#444' }));
  q.push(matn(birinchi ? 142 : 166, 21.8, `${sahifa.page}/${sahifa.pages}-sahifa`, { size: 2.6, anchor: 'end', rang: '#444' }));

  if (birinchi) {
    if (egasi) {
      q.push(matn(CHAP, 30.5, egasi.ism || '', { size: 4.6, bold: true, maxW: 98 }));
      if (egasi.kurs) q.push(matn(CHAP, 36, `Kurs: ${egasi.kurs}`, { size: 2.9, maxW: 98 }));
      const joy = [egasi.xona, egasi.qator != null ? `${egasi.qator}-qator` : '', egasi.orin != null ? `${egasi.orin}-o'rin` : ''].filter(Boolean).join(' · ');
      if (joy) q.push(matn(CHAP, 41, `Joyi: ${joy}`, { size: 2.9, maxW: 98 }));
      if (egasi.mehmon) q.push(matn(CHAP, 46, 'Tashqi qatnashchi', { size: 2.6, rang: '#444' }));
      q.push(matn(CHAP, 52, 'Varaq kodi:', { size: 2.6, rang: '#444' }));
      q.push(matn(CHAP + 17, 52.2, egasi.sheetCode, { size: 3.6, bold: true, mono: true }));
      // Variant: katta harf
      q.push(`<rect x="122" y="24" width="20" height="24" fill="#fff" stroke="${CHIZIQ}" stroke-width="0.4"/>`);
      q.push(matn(132, 28, 'VARIANT', { size: 2.2, anchor: 'middle', rang: '#444' }));
      q.push(matn(132, 44.5, egasi.variant || '—', { size: 14, bold: true, anchor: 'middle' }));
      // Rasm
      if (egasi.rasm) {
        q.push(`<clipPath id="rasm${sahifa.page}"><rect x="${RASM.x}" y="${RASM.y}" width="${RASM.w}" height="${RASM.h}"/></clipPath>`);
        q.push(`<image href="${esc(egasi.rasm)}" x="${RASM.x}" y="${RASM.y}" width="${RASM.w}" height="${RASM.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#rasm${sahifa.page})"/>`);
      }
      q.push(`<rect x="${RASM.x}" y="${RASM.y}" width="${RASM.w}" height="${RASM.h}" fill="none" stroke="${CHIZIQ}" stroke-width="0.3"/>`);
      q.push(matn(CHAP, 60, "Imzo: ______________________", { size: 2.8, rang: '#444' }));
    } else {
      q.push(matn(CHAP, 30.5, 'F.I.Sh:', { size: 2.8, rang: '#444' }));
      q.push(`<line x1="${CHAP}" y1="37" x2="66" y2="37" stroke="#999" stroke-width="0.2"/>`);
      q.push(`<line x1="${CHAP}" y1="44" x2="66" y2="44" stroke="#999" stroke-width="0.2"/>`);
      q.push(matn(CHAP, 50, 'Kurs / xona / o\'rin:', { size: 2.6, rang: '#444' }));
      q.push(`<line x1="${CHAP}" y1="56" x2="66" y2="56" stroke="#999" stroke-width="0.2"/>`);
      q.push(matn(ID_X0 + ((ID_USTUNLARI - 1) * ID_QADAM_X) / 2, 25.8, "O'quvchi ID raqami", { size: 2.4, anchor: 'middle', rang: '#444' }));
      q.push(`<rect x="${f(ID_X0 - 3)}" y="${f(ID_Y0 - 2.6)}" width="${f((ID_USTUNLARI - 1) * ID_QADAM_X + 6)}" height="${f(9 * ID_QADAM_Y + 5.2)}" fill="none" stroke="${CHIZIQ}" stroke-width="0.3"/>`);
      for (const ustun of sahifa.idUstunlari) for (const d of ustun) q.push(doira(belgilar, d, 2));
      q.push(`<rect x="122" y="24" width="20" height="24" fill="#fff" stroke="${CHIZIQ}" stroke-width="0.4"/>`);
      q.push(matn(132, 28, 'UNIVERSAL', { size: 2.2, anchor: 'middle', rang: '#444' }));
      q.push(matn(132, 38, `${u.session}-smena`, { size: 3, anchor: 'middle', bold: true }));
    }
    if (sahifa.variantlar.length) {
      q.push(matn(CHAP, VARIANT_Y + 1, 'Kitobcha varianti:', { size: 2.7, bold: true }));
      for (const d of sahifa.variantlar) q.push(doira(belgilar, d, 2.3));
    }
    q.push(matn(W / 2, 75.4, "Faqat qora yoki ko'k ruchka. Doirachani to'liq bo'yang. Belgini o'zgartirmoqchi bo'lsangiz — nazoratchiga ayting.", { size: 2.35, anchor: 'middle', rang: '#333' }));
  } else if (egasi) {
    q.push(matn(CHAP, 30, egasi.ism || '', { size: 3.6, bold: true, maxW: 120 }));
    q.push(matn(CHAP, 35.5, `Varaq kodi: ${egasi.sheetCode}${egasi.variant ? ` · Variant ${egasi.variant}` : ''}`, { size: 2.7, mono: true }));
  } else {
    q.push(matn(CHAP, 30, 'F.I.Sh: ____________________________   ID: __________', { size: 2.8, rang: '#444' }));
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

  // Past: kod va sahifa
  q.push(matn(W / 2, 290.5, `${egasi ? `Varaq kodi ${egasi.sheetCode}` : `Universal varaq · ${u.session}-smena`} · ${sahifa.page}/${sahifa.pages}`, { size: 2.3, anchor: 'middle', rang: '#666' }));
  q.push(matn(ONG, 290.5, 'Bukilmasin, g\'ijimlanmasin', { size: 2.1, anchor: 'end', rang: '#999' }));

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
