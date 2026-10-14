// Video dars chizmasidagi funksiya grafigi uchun formula (masalan "x^2 - 4*x + 3", "2sin(x)",
// "sqrt(x+1)"). eval ishlatilmaydi: kichik tahlilchi faqat ruxsat etilgan narsani taniydi — son,
// x, pi, e, + - * / ^, qavslar va oddiy funksiyalar; "2x", "3(x+1)" kabi yashirin ko'paytirish ham.
// Server (lib/darsChizma.js — formulani tekshiradi) va pleer (grafikni chizadi) bir xil tahlilchini
// ishlatadi.

const FUNKSIYALAR = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, tg: Math.tan,
  cot: (v) => 1 / Math.tan(v), ctg: (v) => 1 / Math.tan(v),
  asin: Math.asin, acos: Math.acos, atan: Math.atan, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, arctg: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, lg: Math.log10, exp: Math.exp,
};
const OZGARMASLAR = { pi: Math.PI, e: Math.E };
export const IFODA_MAX = 120;

function belgilar(matn) {
  const natija = [];
  const s = matn.replace(/\s+/g, '').replace(/[·×]/g, '*').replace(/[−–]/g, '-').replace(/π/g, 'pi').replace(/,/g, '.');
  for (let i = 0; i < s.length;) {
    const h = s[i];
    const son = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(s.slice(i));
    if (/[\d.]/.test(h) && son) { natija.push({ t: 'son', v: Number(son[0]) }); i += son[0].length; continue; }
    const soz = /^[a-z]+/i.exec(s.slice(i));
    if (soz) {
      // "xsin" kabi qo'shilib ketgan nomlar: avval funksiya/o'zgarmas, qolmasa — x.
      let w = soz[0].toLowerCase();
      while (w) {
        const nom = Object.keys(FUNKSIYALAR).concat(Object.keys(OZGARMASLAR), ['x']).sort((a, b) => b.length - a.length).find(n => w.startsWith(n));
        if (!nom) return null;
        natija.push(nom === 'x' ? { t: 'x' } : nom in OZGARMASLAR ? { t: 'son', v: OZGARMASLAR[nom] } : { t: 'fn', v: nom });
        w = w.slice(nom.length);
      }
      i += soz[0].length;
      continue;
    }
    if ('+-*/^()'.includes(h)) { natija.push({ t: h }); i++; continue; }
    return null;
  }
  return natija;
}

/**
 * Formula → f(x) (son qaytaradi; aniqlanmagan joyda NaN). Tanilmasa — null.
 * Grammatika: yig'indi → ko'paytma ((+|-) ko'paytma)*; ko'paytma → unar ((*|/) unar | yashirin daraja)*;
 * unar → -unar | daraja; daraja → asos (^ unar)?; asos → son | x | fn asos | ( yig'indi ).
 */
export function ifodaniKompilyatsiya(matn) {
  const s = String(matn ?? '');
  if (!s.trim() || s.length > IFODA_MAX) return null;
  const b = belgilar(s);
  if (!b || !b.length) return null;
  let i = 0;
  const keyingi = () => b[i];
  const yigindi = () => {
    let chap = kopaytma();
    while (keyingi()?.t === '+' || keyingi()?.t === '-') {
      const amal = b[i++].t;
      const ong = kopaytma();
      const l = chap;
      chap = amal === '+' ? (x) => l(x) + ong(x) : (x) => l(x) - ong(x);
    }
    return chap;
  };
  const kopaytma = () => {
    let chap = unar();
    for (;;) {
      const t = keyingi()?.t;
      if (t === '*' || t === '/') {
        i++;
        const ong = unar();
        const l = chap;
        chap = t === '*' ? (x) => l(x) * ong(x) : (x) => l(x) / ong(x);
      } else if (t === 'son' || t === 'x' || t === 'fn' || t === '(') {
        const ong = daraja();
        const l = chap;
        chap = (x) => l(x) * ong(x);
      } else return chap;
    }
  };
  // "-x^2" = -(x^2): unar minus darajadan past turadi; daraja ko'rsatkichi esa manfiy bo'la oladi (2^-x).
  const unar = () => {
    if (keyingi()?.t === '-') { i++; const u = unar(); return (x) => -u(x); }
    if (keyingi()?.t === '+') { i++; return unar(); }
    return daraja();
  };
  const daraja = () => {
    const asosi = asos();
    if (keyingi()?.t !== '^') return asosi;
    i++;
    const kor = unar();
    return (x) => Math.pow(asosi(x), kor(x));
  };
  const asos = () => {
    const tk = b[i++];
    if (!tk) throw new Error('oxiri');
    if (tk.t === 'son') { const v = tk.v; return () => v; }
    if (tk.t === 'x') return (x) => x;
    // sin(x)^2 = (sin x)^2: funksiya faqat o'zidan keyingi asosni oladi, daraja tashqarida qo'llanadi.
    if (tk.t === 'fn') { const f = FUNKSIYALAR[tk.v]; const a = asos(); return (x) => f(a(x)); }
    if (tk.t === '(') { const ich = yigindi(); if (b[i++]?.t !== ')') throw new Error('qavs'); return ich; }
    throw new Error('kutilmagan');
  };
  try {
    const f = yigindi();
    return i === b.length ? f : null;
  } catch {
    return null;
  }
}
