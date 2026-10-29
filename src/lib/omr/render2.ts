// Javob varaqasi, 2-versiya ko'rinishi — markazning Addmen varag'i kabi rangli
// (zangori ramka va tasmalar). Geometriya layout2.ts dan.
//
// O'qigich faqat qora markerlar, doira chiziqlari va bo'yoqqa qaraydi. Shuning
// uchun: doirachalar doim oq fonda; raqam tasmasi doirachalardan ≥2.5 mm
// uzoqda; yo'nalish chizig'i ostidagi (x 92–118, y 14.8–17.8) va pastki
// tomondagi xuddi shu joy bo'sh — u yerga to'liq bo'yalgan tasma qo'yilmaydi.

import { esc } from '../chopEtish';
import { W, H, MARKER, MARKERLAR, YONALISH, SAHIFA_BELGILARI, SAHIFA_BELGI, CHAP, ONG, ID_USTUNLARI, qrMatni } from './layout';
import type { Sahifa, Panel } from './layout';
import { RASM_2, RAQAM_TASMA, ID_QATOR_BELGI } from './layout2';
import { f, matn, doira, qrYol, ikkiQator, type Belgilar, type VaraqUmumiy, type VaraqEgasi } from './render';

const QORA = '#000';
/** Ramka, raqam tasmasi. */
const ZANGORI = '#17808a';
/** Blok sarlavhalari tasmasi, yozuvlar. */
const TOQ = '#2c5866';
const OCH = '#e4f1f2';
const DOIRA_RANG = { chiziq: '#2a4f58', harf: '#8aa3a8', id: 'z' };

const ramka = (x: number, y: number, w: number, h: number, qalin = 0.35) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="none" stroke="${ZANGORI}" stroke-width="${qalin}"/>`;
const tolgan = (x: number, y: number, w: number, h: number, rang: string) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${rang}"/>`;
const chiziq = (x1: number, y1: number, x2: number, y2: number, rang = '#9fbfc4', qalin = 0.25) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${rang}" stroke-width="${qalin}"/>`;

/** Sarlavhali blok: zangori ramka, ustida to'q tasma va oq yozuv. */
function blok(q: string[], x: number, y: number, w: number, h: number, sarlavha: string) {
  q.push(ramka(x, y, w, h), tolgan(x, y, w, 5.5, TOQ));
  q.push(matn(x + w / 2, y + 3.95, sarlavha, { size: 2.6, bold: true, anchor: 'middle', rang: '#fff', maxW: w - 3 }));
}

/** Tepada: logo va markaz, "JAVOBLAR VARAQASI", sana · smena · sahifa. */
function sarlavha(q: string[], u: VaraqUmumiy, s: Sahifa) {
  q.push(ramka(CHAP, 14, ONG - CHAP, 16, 0.45));
  if (u.logo) q.push(`<image href="${esc(u.logo)}" x="${CHAP + 2}" y="16" width="12" height="12" preserveAspectRatio="xMidYMid meet"/>`);
  const mx = u.logo ? CHAP + 16 : CHAP + 3;
  const markazdir = /markaz/i.test(u.markaz);
  q.push(matn(mx, markazdir ? 23.2 : 21.8, u.markaz, { size: 3.6, bold: true, rang: ZANGORI, maxW: 66 - mx }));
  if (!markazdir) q.push(matn(mx, 25.8, "O'QUV MARKAZI", { size: 2.2, bold: true, rang: TOQ }));
  q.push(chiziq(70, 16.5, 70, 27.5, '#b9d6da', 0.3));
  q.push(matn(130, 23.6, u.sarlavha || 'JAVOBLAR VARAQASI', { size: 6.6, bold: true, anchor: 'middle', rang: TOQ, maxW: 110 }));
  q.push(matn(130, 28.2, [u.sana, u.smena, `${s.page}/${s.pages}-sahifa`].filter(Boolean).join('  ·  '), { size: 2.3, anchor: 'middle', rang: '#555', maxW: 110 }));
}

/** ESLATMA: o'zbekcha va ruscha ko'rsatma, doirachani bo'yash namunasi. */
function eslatma(q: string[]) {
  const x = CHAP, w = 83, o = x + w / 2;
  blok(q, x, 32, w, 41, 'ESLATMA');
  q.push(matn(o, 41.4, 'ABITURIYENT DIQQATIGA!', { size: 2.5, bold: true, anchor: 'middle', rang: TOQ }));
  q.push(matn(x + 2, 45, "1. Har bir test topshirig'iga faqat bitta javob belgilang.", { size: 2.1, rang: '#222', maxW: w - 4 }));
  q.push(matn(x + 2, 48.2, "2. Sharikli ko'k yoki qora ruchkadan foydalaning.", { size: 2.1, rang: '#222', maxW: w - 4 }));
  q.push(matn(o, 52.4, 'ВНИМАНИЮ АБИТУРИЕНТА!', { size: 2.5, bold: true, anchor: 'middle', rang: TOQ }));
  q.push(matn(x + 2, 56, '1. К каждому тестовому заданию отметьте только один ответ.', { size: 2.1, rang: '#222', maxW: w - 4 }));
  q.push(matn(x + 2, 59.2, '2. Используйте синюю или чёрную шариковую ручку.', { size: 2.1, rang: '#222', maxW: w - 4 }));
  q.push(tolgan(x + 0.2, 61, w - 0.4, 4, OCH));
  q.push(matn(o, 63.75, "DOIRACHANI BO'YASH NAMUNASI / ОБРАЗЕЦ ЗАКРАШИВАНИЯ", { size: 1.85, bold: true, anchor: 'middle', rang: TOQ, maxW: w - 3 }));
  q.push(matn(x + 21.5, 67.4, "To'g'ri / Правильно", { size: 1.9, bold: true, anchor: 'middle', rang: '#2f7a3c' }));
  q.push(matn(x + 62, 67.4, "Noto'g'ri / Неправильно", { size: 1.9, bold: true, anchor: 'middle', rang: '#b03030' }));
  bo_yashNamunasi(q, x + 14.75, x + 55.25, 70.6);
}

function bo_yashNamunasi(q: string[], togri: number, notogri: number, y: number) {
  const r = 1.5;
  const bosh = (cx: number) => `<circle cx="${f(cx)}" cy="${f(y)}" r="${r}" fill="#fff" stroke="${DOIRA_RANG.chiziq}" stroke-width="0.25"/>`;
  for (let i = 0; i < 3; i++) q.push(bosh(togri + i * 4.5));
  q.push(`<circle cx="${f(togri + 13.5)}" cy="${f(y)}" r="${r}" fill="#111"/>`);
  const n = notogri;
  q.push(bosh(n), `<path d="M${f(n - 1)} ${f(y - 1)}L${f(n + 1)} ${f(y + 1)}M${f(n + 1)} ${f(y - 1)}L${f(n - 1)} ${f(y + 1)}" stroke="#111" stroke-width="0.35"/>`);
  q.push(bosh(n + 4.5), `<circle cx="${f(n + 4.5)}" cy="${f(y)}" r="0.6" fill="#111"/>`);
  // Chiziqlab bo'yalgan: doira ichida uchta qiya chiziq.
  const c = n + 9;
  let d = '';
  for (const t of [-0.75, 0, 0.75]) {
    const l = Math.sqrt(r * r - t * t) * 0.85;
    const [px, py] = [c + t * Math.SQRT1_2, y + t * Math.SQRT1_2];
    d += `M${f(px - l * Math.SQRT1_2)} ${f(py + l * Math.SQRT1_2)}L${f(px + l * Math.SQRT1_2)} ${f(py - l * Math.SQRT1_2)}`;
  }
  q.push(bosh(c), `<path d="${d}" stroke="#111" stroke-width="0.3"/>`);
  q.push(bosh(n + 13.5), `<path d="M${f(n + 12.5)} ${f(y)}L${f(n + 13.3)} ${f(y + 0.9)}L${f(n + 14.7)} ${f(y - 1)}" fill="none" stroke="#111" stroke-width="0.35"/>`);
}

/** Shaxsiy varaq: ism, filial/maktab/kurs/xona, ID · variant · o'rin, rasm (QR — umumiy joyda). */
function abituriyent(q: string[], e: VaraqEgasi, sahifa: Sahifa) {
  const x = 105, w = ONG - x;
  blok(q, x, 32, w, 41, "ABITURIYENT MA'LUMOTI");
  const ism = ikkiQator((e.ism || '').toUpperCase(), 34);
  q.push(matn(x + w / 2, ism[1] ? 41.6 : 43, ism[0], { size: 3, bold: true, anchor: 'middle', rang: TOQ, maxW: w - 4 }));
  if (ism[1]) q.push(matn(x + w / 2, 45.1, ism[1], { size: 3, bold: true, anchor: 'middle', rang: TOQ, maxW: w - 4 }));
  const tx = 132, tw = 36.5;
  let y = 51.2;
  const qator = (nom: string, qiymat?: string | null) => {
    if (!qiymat || y > 61.5) return;
    q.push(matn(tx, y, `${nom}: ${qiymat}`, { size: 2.25, rang: '#222', maxW: tw }));
    y += 3.4;
  };
  qator('Filial', e.filial);
  qator('Maktab', [e.maktab, e.sinf].filter(Boolean).join(', ') || null);
  qator('Kurs', e.mehmon ? 'Tashqi qatnashchi' : e.kurs);
  qator('Xona', [e.xona, e.qator != null ? `${e.qator}-qator` : ''].filter(Boolean).join(' · ') || null);
  // Pastda uchta katak: ID, variant, o'rin — tarqatishda ko'zga tashlanadi.
  const kataklar: [string, string, number, number][] = [
    ['ID', e.kod ? String(e.kod) : '—', 13.6, 3.1], ['VARIANT', e.variant || '—', 9.6, 4], ["O'RIN", e.orin != null ? String(e.orin) : '—', 12, 3.8],
  ];
  let kx = tx;
  for (const [nom, qiymat, kw, o] of kataklar) {
    q.push(tolgan(kx, 63.4, kw, 8.2, OCH));
    q.push(matn(kx + kw / 2, 65.6, nom, { size: 1.6, bold: true, anchor: 'middle', rang: TOQ }));
    q.push(matn(kx + kw / 2, 70.7, qiymat, { size: o, bold: true, anchor: 'middle', rang: QORA, mono: nom === 'ID', maxW: kw - 1 }));
    kx += kw + 0.6;
  }
  const R = RASM_2;
  if (e.rasm) {
    q.push(`<clipPath id="rasm${sahifa.page}"><rect x="${R.x}" y="${R.y}" width="${R.w}" height="${R.h}"/></clipPath>`);
    q.push(`<image href="${esc(e.rasm)}" x="${R.x}" y="${R.y}" width="${R.w}" height="${R.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#rasm${sahifa.page})"/>`);
  } else {
    q.push(matn(R.x + R.w / 2, R.y + R.h / 2 + 0.8, '3×4', { size: 2.4, anchor: 'middle', rang: '#9fbfc4' }));
  }
  q.push(ramka(R.x, R.y, R.w, R.h, 0.3));
}

/** Universal varaq: ism, kurs va xona qo'lda yoziladi, ID paneldan o'qiladi. */
function qatnashchi(q: string[], u: VaraqUmumiy) {
  const x = 105, w = ONG - x;
  blok(q, x, 32, w, 41, 'QATNASHCHI / УЧАСТНИК');
  q.push(matn(x + w / 2, 42.6, `UNIVERSAL VARAQ · ${u.smena || `${u.session}-smena`}`, { size: 2.6, bold: true, anchor: 'middle', rang: TOQ, maxW: w - 4 }));
  const tx = 132;
  q.push(matn(tx, 52, 'Kurs / guruh:', { size: 2.3, rang: '#444' }), chiziq(tx, 56.4, ONG - 2, 56.4, '#8aa3a8'));
  q.push(matn(tx, 61, "Xona / o'rin:", { size: 2.3, rang: '#444' }), chiziq(tx, 65.4, ONG - 2, 65.4, '#8aa3a8'));
  q.push(matn(tx, 70.2, "O'quvchi ID sini o'ngdagi jadvalda bo'yang.", { size: 1.9, rang: '#666', maxW: ONG - 2 - tx }));
}

/** O'ng panel: ABITURIYENT ID (1–9, 0), VARIANT, «Abituriyent tomonidan to'ldiriladi». */
function panel(q: string[], belgilar: Belgilar, s: Sahifa, P: Panel, e: VaraqEgasi | null, u: VaraqUmumiy) {
  const pastki = P.doiraY + 10 * 4.6 + 1.5;
  // ID: yozish kataklari, qator raqamlari tasmasi va doirachalar. Shaxsiy varaqda — oldindan to'ldirilgan.
  blok(q, P.idX, P.y, P.idW, pastki - P.y, 'ABITURIYENT ID');
  const kod = e?.kod ? String(e.kod).padStart(ID_USTUNLARI, '0').slice(-ID_USTUNLARI) : '';
  q.push(tolgan(P.idX + 0.5, P.yozuvY, ID_QATOR_BELGI - 0.5, 6, ZANGORI));
  q.push(matn(P.idX + 0.25 + ID_QATOR_BELGI / 2, P.yozuvY + 4.1, '№', { size: 2.4, bold: true, anchor: 'middle', rang: '#fff' }));
  q.push(tolgan(P.idX + 0.5, P.doiraY, ID_QATOR_BELGI - 0.5, 46, ZANGORI));
  s.idUstunlari[0]?.forEach(d => q.push(matn(P.idX + 0.25 + ID_QATOR_BELGI / 2, d.y + 0.8, d.v, { size: 2.3, bold: true, anchor: 'middle', rang: '#fff' })));
  s.idUstunlari.forEach((ustun, c) => {
    const cx = ustun[0].x;
    q.push(`<rect x="${f(cx - 2.2)}" y="${f(P.yozuvY)}" width="4.4" height="6" fill="#fff" stroke="${ZANGORI}" stroke-width="0.3"/>`);
    if (kod) q.push(matn(cx, P.yozuvY + 4.4, kod[c], { size: 3.2, bold: true, anchor: 'middle', rang: TOQ }));
    for (const d of ustun) {
      q.push(doira(belgilar, d, 1.9, DOIRA_RANG));
      if (kod && kod[c] === d.v) q.push(`<circle cx="${f(d.x)}" cy="${f(d.y)}" r="${f(d.r * 0.92)}" fill="#333"/>`);
    }
  });
  // Variant: doirachalar (yoqilgan bo'lsa) va yozish katagi; shaxsiy varaqda harfi yozilgan.
  blok(q, P.varX, P.y, P.varW, pastki - P.y, 'VARIANT');
  q.push(`<rect x="${f(P.varX + 1.5)}" y="${f(P.yozuvY)}" width="${f(P.varW - 3)}" height="6" fill="#fff" stroke="${ZANGORI}" stroke-width="0.3"/>`);
  if (e?.variant) q.push(matn(P.varX + P.varW / 2, P.yozuvY + 4.5, e.variant, { size: 3.6, bold: true, anchor: 'middle', rang: TOQ }));
  for (const d of s.variantlar) q.push(doira(belgilar, d, 2, DOIRA_RANG));
  if (!s.variantlar.length) q.push(matn(P.varX + P.varW / 2, P.doiraY + 24, e?.variant || '—', { size: 7, bold: true, anchor: 'middle', rang: TOQ }));
  // Abituriyent tomonidan to'ldiriladi: F.I.Sh va imzo.
  const fy = P.fishY;
  q.push(ramka(P.x, fy, P.w, P.fishH), tolgan(P.x, fy, P.w, 5.5, ZANGORI));
  q.push(matn(P.x + P.w / 2, fy + 3.95, "ABITURIYENT TOMONIDAN TO'LDIRILADI!", { size: 2.1, bold: true, anchor: 'middle', rang: '#fff', maxW: P.w - 2 }));
  q.push(matn(P.x + 2, fy + 10.2, 'F.I.Sh / ФИО:', { size: 2.2, bold: true, rang: TOQ }), chiziq(P.x + 2, fy + 15.6, P.x + P.w - 2, fy + 15.6, '#8aa3a8'));
  q.push(matn(P.x + 2, fy + 20.6, 'Imzo / Подпись:', { size: 2.2, bold: true, rang: TOQ }), chiziq(P.x + 20, fy + 24.6, P.x + P.w - 2, fy + 24.6, '#8aa3a8'));
  if (!e) q.push(matn(P.x + P.w / 2, fy + P.fishH + 4, `Universal · ${u.session}-smena`, { size: 2, anchor: 'middle', rang: '#777' }));
}

/** Keyingi sahifalar: qisqa sarlavha va egasi (sahifalar aralashib ketmasin). */
function keyingiSarlavha(q: string[], u: VaraqUmumiy, s: Sahifa, e: VaraqEgasi | null) {
  q.push(matn(CHAP, 17, u.markaz, { size: 2.6, bold: true, rang: ZANGORI, maxW: 70 }));
  q.push(matn(CHAP, 21.8, u.imtihon, { size: 3.8, bold: true, rang: TOQ, maxW: 118 }));
  q.push(matn(166, 17, [u.sana, u.smena].filter(Boolean).join(' · '), { size: 2.6, anchor: 'end', rang: '#444' }));
  q.push(matn(166, 21.8, `${s.page}/${s.pages}-sahifa`, { size: 2.6, anchor: 'end', rang: '#444' }));
  if (e) {
    q.push(matn(CHAP, 30, (e.ism || '').toUpperCase(), { size: 3.6, bold: true, maxW: 120 }));
    q.push(matn(CHAP, 35.5, `Varaq kodi: ${e.sheetCode}${e.variant ? ` · Variant ${e.variant}` : ''}`, { size: 2.7, mono: true }));
  } else {
    q.push(matn(CHAP, 30, 'F.I.Sh: ____________________________   ID: __________', { size: 2.8, rang: '#444' }));
  }
  q.push(chiziq(CHAP, 38.6, 166, 38.6, ZANGORI, 0.4));
}

/** Yopiq savollar: ustun ramkasi, zangori raqam tasmasi (oq raqamlar), blok sarlavhalari, doirachalar. */
function yopiqlar(q: string[], belgilar: Belgilar, s: Sahifa) {
  for (const u of s.ustunlar || []) q.push(ramka(u.x, u.y, u.w + 0.4, u.h), tolgan(u.x, u.y, RAQAM_TASMA, u.h, ZANGORI));
  for (const b of s.sarlavhalar) {
    const w = b.w ?? 34, h = b.h ?? 5.6;
    q.push(tolgan(b.x, b.y + 0.5, w + 0.4, h - 1, TOQ));
    q.push(matn(b.x + w / 2, b.y + h / 2 + 0.85, b.matn.toUpperCase(), { size: 2.4, bold: true, anchor: 'middle', rang: '#fff', maxW: w - 2 }));
  }
  for (const sv of s.yopiq) {
    const r = sv.doiralar[0]?.r ?? 2.2;
    const qator = Math.min(3.3, r * 1.25);
    q.push(matn(sv.raqam.x, sv.raqam.y + (qator - 2.7) * 0.35, sv.y ?? String(sv.n), { size: qator, bold: true, anchor: 'middle', rang: '#fff', maxW: RAQAM_TASMA - 0.6 }));
    for (const d of sv.doiralar) q.push(doira(belgilar, d, f(r * 1.05), DOIRA_RANG));
  }
}

/** Raqamli kataklar, moslashtirish to'rlari va yozma maydonlar — 1-versiyadagi joylashuv, zangori ramka. */
function boshqaSavollar(q: string[], belgilar: Belgilar, s: Sahifa) {
  for (const sv of s.raqamli) {
    const { quti, yozuv } = sv;
    q.push(ramka(quti.x, quti.y, quti.w, quti.h), tolgan(quti.x, quti.y, quti.w, 4.2, OCH));
    q.push(matn(quti.x + 1.5, quti.y + 3, `${sv.y ?? sv.n}-savol (javob)`, { size: 2.5, bold: true, rang: TOQ }));
    sv.ustunlar.forEach((ustun, c) => {
      const x = yozuv.x + c * (yozuv.w / sv.ustunlar.length);
      q.push(`<rect x="${f(x + 0.3)}" y="${f(yozuv.y)}" width="${f(yozuv.w / sv.ustunlar.length - 0.6)}" height="${f(yozuv.h)}" fill="#fff" stroke="#8aa3a8" stroke-width="0.2"/>`);
      for (const d of ustun) q.push(doira(belgilar, d, 1.9, DOIRA_RANG));
    });
  }
  for (const sv of s.moslash || []) {
    const { quti } = sv;
    q.push(ramka(quti.x, quti.y, quti.w, quti.h), tolgan(quti.x, quti.y, quti.w, 4.4, OCH));
    q.push(matn(quti.x + 1.5, quti.y + 3.2, `${sv.y ?? sv.n}-savol (moslash)`, { size: 2.5, bold: true, rang: TOQ, maxW: quti.w - 3 }));
    sv.qatorlar[0].forEach(d => q.push(matn(d.x, quti.y + 8, d.v, { size: 2.4, bold: true, anchor: 'middle', rang: TOQ })));
    sv.qatorlar.forEach((qator, r) => {
      q.push(matn(quti.x + 3.5, qator[0].y + 0.9, 'ABCD'[r], { size: 2.6, bold: true, anchor: 'middle', rang: TOQ }));
      for (const d of qator) q.push(doira(belgilar, d, 1.9, DOIRA_RANG));
    });
  }
  for (const sv of s.yozma) {
    const { quti } = sv;
    if (sv.ixcham) {
      q.push(ramka(quti.x, quti.y, quti.w, quti.h), tolgan(quti.x, quti.y, 11, quti.h, OCH));
      q.push(chiziq(quti.x + 11, quti.y, quti.x + 11, quti.y + quti.h, ZANGORI, 0.25));
      q.push(matn(quti.x + 5.5, quti.y + quti.h / 2 + 1.2, sv.y ?? String(sv.n), { size: 3.2, bold: true, anchor: 'middle', rang: TOQ }));
      q.push(matn(quti.x + quti.w - 1.5, quti.y + quti.h - 1.3, 'javob', { size: 1.9, anchor: 'end', rang: '#999' }));
      continue;
    }
    q.push(matn(quti.x, quti.y - 1.2, `${sv.y ?? sv.n}-savol — yozma javob${sv.ball ? ` (${sv.ball} ball)` : ''}`, { size: 2.7, bold: true, rang: TOQ }));
    q.push(ramka(quti.x, quti.y, quti.w, quti.h));
    for (let y = quti.y + 8; y < quti.y + quti.h - 2; y += 8) q.push(chiziq(quti.x + 2, y, quti.x + quti.w - 2, y, '#d5e6e8', 0.2));
    q.push(matn(quti.x + quti.w - 1.5, quti.y + quti.h - 1.5, 'Ball: ______ (ustoz)', { size: 2.3, anchor: 'end', rang: '#888' }));
  }
}

/** Past: qo'shimcha ma'lumotlar (manzil, telefon) va test sanasi. Faqat yozuv — tasma yo'q (yo'nalish tekshiruvi). */
function pastki(q: string[], u: VaraqUmumiy, s: Sahifa, e: VaraqEgasi | null) {
  q.push(chiziq(42, 279.6, ONG, 279.6, ZANGORI, 0.35));
  q.push(matn(42, 283.3, "QO'SHIMCHA MA'LUMOTLAR", { size: 2.1, bold: true, rang: ZANGORI }));
  const aloqa = [u.manzil, u.telefon].filter(Boolean).join('  ·  ');
  if (aloqa) q.push(matn(42, 287.4, aloqa, { size: 2.05, rang: TOQ, maxW: 98 }));
  q.push(matn(ONG, 283.3, `Test sanasi: ${u.sana}`, { size: 2.5, bold: true, anchor: 'end', rang: TOQ }));
  q.push(matn(ONG, 287.4, `${e ? `Varaq kodi ${e.sheetCode}` : `Universal · ${u.session}-smena`} · ${s.page}/${s.pages} · bukilmasin`, { size: 2, anchor: 'end', rang: '#777' }));
}

export function varaqSvg2(sahifa: Sahifa, u: VaraqUmumiy, egasi: VaraqEgasi | null): string {
  const q: string[] = [];
  const belgilar: Belgilar = new Map();

  // Markerlar, yo'nalish chizig'i, sahifa belgilari — 1-versiyadagi joyda, qora.
  for (const m of Object.values(MARKERLAR)) q.push(`<rect x="${f(m.x - MARKER / 2)}" y="${f(m.y - MARKER / 2)}" width="${MARKER}" height="${MARKER}" fill="${QORA}"/>`);
  q.push(`<rect x="${YONALISH.x}" y="${YONALISH.y}" width="${YONALISH.w}" height="${YONALISH.h}" fill="${QORA}"/>`);
  SAHIFA_BELGILARI.forEach((p, i) => {
    const toliq = sahifa.page & (1 << i);
    q.push(`<rect x="${f(p.x - SAHIFA_BELGI / 2)}" y="${f(p.y - SAHIFA_BELGI / 2)}" width="${SAHIFA_BELGI}" height="${SAHIFA_BELGI}" fill="${toliq ? QORA : '#fff'}" stroke="#222" stroke-width="0.25"/>`);
  });

  const qrText = egasi ? qrMatni({ sheetCode: egasi.sheetCode, page: sahifa.page }) : qrMatni({ examId: u.examId, session: u.session, page: sahifa.page });
  q.push(qrYol(qrText, sahifa.qr.x, sahifa.qr.y, sahifa.qr.s));

  if (sahifa.page === 1) {
    sarlavha(q, u, sahifa);
    eslatma(q);
    if (egasi) abituriyent(q, egasi, sahifa);
    else qatnashchi(q, u);
    // Imtihon nomi tasmasi va fan tasmasi (savollar ustida).
    q.push(tolgan(CHAP, 75, ONG - CHAP, 6, ZANGORI));
    q.push(matn(W / 2, 79.2, u.imtihon, { size: 3.1, bold: true, anchor: 'middle', rang: '#fff', maxW: ONG - CHAP - 6 }));
    const t = sahifa.fanTasma;
    if (t) {
      q.push(tolgan(t.x, t.y, t.w, t.h, TOQ));
      // Ko'p fanli imtihonda "FAN — N ta savol" qatori sig'masa — faqat fan nomlari (soni ustundagi sarlavhalarda ko'rinadi).
      const toliq = u.fanlar || 'JAVOBLAR';
      const yozuv = toliq.length * 2.2 * 0.66 > t.w - 4 ? toliq.split(/\s+·\s+/).map(x => x.replace(/\s+—.*$/, '')).join('  ·  ') : toliq;
      q.push(matn(t.x + t.w / 2, t.y + 3.95, yozuv, { size: 2.6, bold: true, anchor: 'middle', rang: '#fff', maxW: t.w - 4 }));
    }
    if (sahifa.panel) panel(q, belgilar, sahifa, sahifa.panel, egasi, u);
  } else {
    keyingiSarlavha(q, u, sahifa, egasi);
  }

  yopiqlar(q, belgilar, sahifa);
  boshqaSavollar(q, belgilar, sahifa);
  pastki(q, u, sahifa, egasi);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"><defs>${[...belgilar.values()].join('')}</defs>${q.join('')}</svg>`;
}
