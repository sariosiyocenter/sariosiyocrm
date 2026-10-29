// Javob varaqasi, 2-versiya geometriyasi (markazning Addmen varag'i kabi).
//
// 1-sahifa: sarlavha, ESLATMA va ABITURIYENT MA'LUMOTI, imtihon nomi tasmasi;
// pastda chapda fan tasmasi va savollar ustunlari, o'ngda panel — o'quvchi ID
// si (1–9, 0 qatorlari), kitobcha varianti va «Abituriyent tomonidan
// to'ldiriladi». Savollar kam bo'lsa (hammasi 1-sahifaga sig'sa va boshqa
// turdagi savol bo'lmasa) qatorlar va doirachalar kattalashib, maydonni to'ldiradi.
//
// 1-versiya (layout.ts) o'zgarmaydi: undan oldin qulflangan imtihon varaqlari
// o'sha geometriyada o'qiladi. Markerlar, yo'nalish chizig'i, sahifa belgilari
// va keyingi sahifalar QR i — ikkala versiyada bir joyda.

import {
  CHAP, ONG, KENGLIK, Y0_KEYINGI, Y1, QATOR, DOIRA_R, DOIRA_QADAM, USTUN_ORALIQ, QR_KEYINGI, ID_USTUNLARI,
  KATAK_KENGLIK, KATAK_BALANDLIK, MOSLASH_KENGLIK, MOSLASH_BALANDLIK, YOZMA_BALANDLIK, QISM_BALANDLIK, QISM_ORALIQ, HARF,
  raqamliKatak, moslashTori, yorliqlarniQoy,
} from './layout.ts';
import type { Sahifa, Doira, YopiqSavol, Panel, VaraqParametrlari } from './layout.ts';

/** 1-sahifa QR i — ABITURIYENT MA'LUMOTI blokining chap pastida. */
export const QR_2 = { x: 107, y: 49, s: 22 };
/** O'quvchi rasmi — o'sha blokning o'ng pastida. */
export const RASM_2 = { x: 170.5, y: 48.5, w: 18, h: 22.5 };

/** Fan tasmasi va panel sarlavhalari shu balandlikda; savollar Y0 dan. */
const TASMA_Y = 84;
export const TASMA_H = 5.5;
const Y0 = 92;

// Savol qatori: chapda raqam tasmasi (RAQAM_TASMA), keyin doirachalar.
const RAQAM_JOYI = 8;
export const RAQAM_TASMA = 6.2;
const USTUN_ORA_MAKS = 8;
const QADAM_MAKS = 9;
const QATOR_MAKS = 9.4;
const R_MAKS = 3;

// Panel: ID bloki (qator raqamlari ustuni + 6 ustun), variant bloki, F.I.Sh qutisi.
export const ID_QATOR_BELGI = 5.5;
const ID_QADAM_X = 5;
const ID_QADAM_Y = 4.6;
const ID_R = 1.9;
/** ID qatorlari tartibi — markaz varag'idagidek 1, 2, … 9, 0. */
export const ID_RAQAMLARI = '1234567890';
const VARIANT_QATORI = 10;
const PANEL_ORALIQ = 4;

const oraliq = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Panel o'lchami variantlar sonidan (u qulfdan keyin o'zgarmaydi). Variant
 * doirachalari o'chirilsa ham joyi qoladi — savollar ustunlari siljimaydi.
 */
export function panelGeometriyasi(variantCount: number): Panel {
  const idW = ID_QATOR_BELGI + 1.5 + ID_USTUNLARI * ID_QADAM_X + 1;
  const vc = Math.max(1, Math.ceil(Math.min(26, Math.max(1, variantCount || 1)) / VARIANT_QATORI));
  const varW = Math.max(12, 4 + vc * ID_QADAM_X);
  const w = idW + 2 + varW;
  const x = ONG - w;
  const yozuvY = TASMA_Y + TASMA_H + 1.5;
  const doiraY = yozuvY + 6 + 2;
  const fishY = doiraY + 10 * ID_QADAM_Y + 4;
  return { x, w, y: TASMA_Y, idX: x, idW, varX: x + idW + 2, varW, yozuvY, doiraY, fishY, fishH: 27 };
}

function yangiSahifa2(page: number): Sahifa {
  return {
    page, pages: 0, yopiq: [], raqamli: [], yozma: [], moslash: [], sarlavhalar: [], variantlar: [], idUstunlari: [],
    qr: page === 1 ? QR_2 : QR_KEYINGI, versiya: 2, ustunlar: [],
  };
}

/** 1-sahifa: panel, kitobcha varianti va o'quvchi ID doirachalari. */
function panelDoiralari(s: Sahifa, p: VaraqParametrlari, P: Panel) {
  s.panel = P;
  if (p.variantBubble) {
    const soni = Math.max(1, Math.min(26, p.variantCount || 1));
    const vc = Math.ceil(soni / VARIANT_QATORI);
    const x0 = P.varX + (P.varW - vc * ID_QADAM_X) / 2 + ID_QADAM_X / 2;
    for (let i = 0; i < soni; i++) {
      s.variantlar.push({ x: x0 + Math.floor(i / VARIANT_QATORI) * ID_QADAM_X, y: P.doiraY + (i % VARIANT_QATORI) * ID_QADAM_Y + ID_QADAM_Y / 2, r: ID_R, v: String.fromCharCode(65 + i) });
    }
  }
  for (let c = 0; c < ID_USTUNLARI; c++) {
    const ustun: Doira[] = [];
    for (const [i, raqam] of [...ID_RAQAMLARI].entries()) {
      ustun.push({ x: P.idX + ID_QATOR_BELGI + 1.5 + c * ID_QADAM_X + ID_QADAM_X / 2, y: P.doiraY + i * ID_QADAM_Y + ID_QADAM_Y / 2, r: ID_R, v: raqam });
    }
    s.idUstunlari.push(ustun);
  }
}

/** Yopiq savol qatori (x — ustun boshi, y — qator tepasi). */
function yopiqQator2(n: number, x: number, y: number, k: number, qator: number, qadam: number, r: number): YopiqSavol {
  const cy = y + qator / 2;
  const doiralar: Doira[] = [];
  for (let d = 0; d < k; d++) doiralar.push({ x: x + RAQAM_JOYI + qadam / 2 + d * qadam, y: cy, r, v: HARF[d] });
  return { n, raqam: { x: x + RAQAM_TASMA / 2, y: cy + 1 }, doiralar };
}

export function varaqSahifalari2(p: VaraqParametrlari): Sahifa[] {
  const k = Math.min(6, Math.max(2, p.optionCount || 4));
  const katak = new Map(p.tuzilma.savollar.map(x => [x.n, x]));
  const P = panelGeometriyasi(p.variantCount);
  const sahifalar: Sahifa[] = [];
  let s = yangiSahifa2(1);
  sahifalar.push(s);
  panelDoiralari(s, p, P);
  // 1-sahifada savollar panelning chapida, keyingilarida — butun kenglikda.
  const maydon = (page: number) => (page === 1 ? { x0: CHAP, w: P.x - PANEL_ORALIQ - CHAP, y0: Y0 } : { x0: CHAP, w: KENGLIK, y0: Y0_KEYINGI });
  s.fanTasma = { x: CHAP, y: TASMA_Y, w: maydon(1).w, h: TASMA_H };

  // --- Yopiq savollar ---
  const kMaks = Math.max(k, ...p.tuzilma.savollar.map(x => (x.tur === 'yopiq' ? x.harf || 0 : 0)));
  type Katak = { tur: 'sarlavha'; matn: string } | { tur: 'savol'; n: number };
  const kataklar: Katak[] = [];
  const bloklarSoni = p.tuzilma.bloklar.filter(b => b.yopiq > 0).length;
  for (const b of p.tuzilma.bloklar) {
    if (!b.yopiq) continue;
    if (bloklarSoni > 1) kataklar.push({ tur: 'sarlavha', matn: b.nomi });
    for (let n = b.boshi; n < b.boshi + b.yopiq; n++) kataklar.push({ tur: 'savol', n });
  }
  const boshqasiBor = p.tuzilma.savollar.some(x => x.tur !== 'yopiq');

  let m = maydon(1);
  let engPast = m.y0;
  let i = 0;
  while (i < kataklar.length) {
    const ukAsos = RAQAM_JOYI + kMaks * DOIRA_QADAM;
    const ustunSoni = Math.max(1, Math.floor((m.w + USTUN_ORALIQ) / (ukAsos + USTUN_ORALIQ)));
    const qatorlarMax = Math.floor((Y1 - m.y0) / QATOR);
    const olinadi = Math.min(kataklar.length - i, ustunSoni * qatorlarMax);
    const qatorlar = Math.min(qatorlarMax, Math.max(Math.ceil(olinadi / ustunSoni), Math.min(15, olinadi)));
    const c = Math.ceil(olinadi / qatorlar);
    // Hammasi shu (1-) sahifaga sig'sa va pastda boshqa savol bo'lmasa — kattalashadi.
    const kengayadi = s.page === 1 && i === 0 && olinadi === kataklar.length && !boshqasiBor;
    const qadam = kengayadi ? oraliq(((m.w - (c - 1) * USTUN_ORALIQ) / c - RAQAM_JOYI) / kMaks, DOIRA_QADAM, QADAM_MAKS) : DOIRA_QADAM;
    const qator = kengayadi ? oraliq((Y1 - m.y0) / qatorlar, QATOR, QATOR_MAKS) : QATOR;
    const r = kengayadi ? oraliq(Math.min(qadam, qator) * 0.34, DOIRA_R, R_MAKS) : DOIRA_R;
    const uk = RAQAM_JOYI + kMaks * qadam;
    const ora = c > 1 ? Math.min(USTUN_ORA_MAKS, (m.w - c * uk) / (c - 1)) : 0;
    const chap = m.x0 + (m.w - c * uk - (c - 1) * ora) / 2;
    for (let j = 0; j < olinadi; j++) {
      const kt = kataklar[i + j];
      const x = chap + Math.floor(j / qatorlar) * (uk + ora);
      const y = m.y0 + (j % qatorlar) * qator;
      if (kt.tur === 'sarlavha') s.sarlavhalar.push({ matn: kt.matn, x, y, w: uk, h: qator });
      else s.yopiq.push(yopiqQator2(kt.n, x, y, Math.min(6, katak.get(kt.n)?.harf || k), qator, qadam, r));
    }
    for (let u = 0; u < c; u++) {
      const soni = Math.min(qatorlar, olinadi - u * qatorlar);
      s.ustunlar!.push({ x: chap + u * (uk + ora), y: m.y0, w: uk, h: soni * qator });
    }
    i += olinadi;
    engPast = m.y0 + qatorlar * qator;
    if (i < kataklar.length) {
      s = yangiSahifa2(sahifalar.length + 1);
      sahifalar.push(s);
      m = maydon(s.page);
      engPast = m.y0;
    }
  }

  // --- Raqamli kataklar, moslashtirish to'rlari, yozma maydonlar ---
  let joriyY = kataklar.length ? engPast + 4 : m.y0;
  const joy = (balandlik: number) => {
    if (joriyY + balandlik > Y1 + 1) {
      s = yangiSahifa2(sahifalar.length + 1);
      sahifalar.push(s);
      m = maydon(s.page);
      joriyY = m.y0;
    }
  };
  /** Qatorga bir nechta katak: sahifa kengligiga teng taqsimlanadi. */
  const qatorlab = (ns: number[], kw: number, kh: number, ora: number, qoy: (n: number, x: number, y: number) => void) => {
    for (let a = 0; a < ns.length;) {
      joy(kh);
      const qatorda = Math.max(1, Math.floor((m.w + ora) / (kw + ora)));
      const qadamX = qatorda > 1 ? (m.w - kw) / (qatorda - 1) : 0;
      ns.slice(a, a + qatorda).forEach((n, j) => qoy(n, m.x0 + j * qadamX, joriyY));
      joriyY += kh + 3;
      a += qatorda;
    }
  };
  qatorlab(p.tuzilma.savollar.filter(x => x.tur === 'raqamli').map(x => x.n), KATAK_KENGLIK, KATAK_BALANDLIK, 3, (n, x, y) => s.raqamli.push(raqamliKatak(n, x, y)));
  qatorlab(p.tuzilma.savollar.filter(x => x.tur === 'moslash').map(x => x.n), MOSLASH_KENGLIK, MOSLASH_BALANDLIK, 4, (n, x, y) => s.moslash!.push(moslashTori(n, x, y)));

  // Qismli savollarning qisqa javob maydonlari: bitta savolning qismlari bir qatorda.
  const qismlar = p.tuzilma.savollar.filter(x => x.tur === 'yozma' && x.g === 'qismli');
  const raqami = (x: { n: number; y?: string }) => String(x.y ?? x.n).replace(/[a-z]+$/, '');
  for (let a = 0; a < qismlar.length;) {
    let b = a + 1;
    while (b < qismlar.length && raqami(qismlar[b]) === raqami(qismlar[a])) b++;
    const qator = qismlar.slice(a, b);
    joy(QISM_BALANDLIK + 2.5);
    const w = (m.w - (qator.length - 1) * QISM_ORALIQ) / qator.length;
    qator.forEach((x, c) => s.yozma.push({ n: x.n, quti: { x: m.x0 + c * (w + QISM_ORALIQ), y: joriyY, w, h: QISM_BALANDLIK }, ball: p.yozmaBallari?.[x.n] ?? null, ixcham: true }));
    joriyY += QISM_BALANDLIK + 2.5;
    a = b;
  }
  if (qismlar.length) joriyY += 1.5;

  for (const n of p.tuzilma.savollar.filter(x => x.tur === 'yozma' && x.g !== 'qismli').map(x => x.n)) {
    joy(YOZMA_BALANDLIK + 4);
    s.yozma.push({ n, quti: { x: m.x0, y: joriyY + 4, w: m.w, h: YOZMA_BALANDLIK }, ball: p.yozmaBallari?.[n] ?? null });
    joriyY += YOZMA_BALANDLIK + 7;
  }

  for (const sh of sahifalar) sh.pages = sahifalar.length;
  return yorliqlarniQoy(sahifalar, p);
}
