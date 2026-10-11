// AI chizgan SVG ni tozalash, tekislash va tekshirish (lib/imtihonRasm.js, routes/imtihonRasm.js).
//
// AI javobi — ISHONCHSIZ kirish: fayl ochiq Storage'da turadi va brauzerda ochiladi.
// Shuning uchun matn «tozalanmaydi», balki O'QILIB QAYTA YOZILADI: kirish o'z daraxtimizga
// o'qiladi, chiqish esa faqat ruxsat etilgan element va atributlardan, har qiymati qat'iy
// tekshirilib, noldan yoziladi. Ro'yxatda yo'q narsa (script, foreignObject, image, style,
// on* hodisalar, tashqi havolalar, DOCTYPE/ENTITY, animatsiya…) chiqishga o'ta olmaydi —
// uni yozadigan kodning o'zi yo'q. CSS (<style>, class, style="") atributlarga yoyiladi,
// chiqishda CSS umuman qolmaydi.
//
// Tozalashdan tashqari chizma chopga tayyorlanadi (model tez-tez qiladigan xatolar):
// viewBox mazmunga moslanadi (yozuv chetda kesilmasin, bo'sh joy qolmasin), ranglar oq-qora,
// chiziq qalinligi chopda ko'rinadigan oraliqda, yozuvlar to'liq qora va oq «gardish» bilan
// (chiziq ustiga tushsa ham o'qiladi), «fill» unutilgan konturlar qora bo'yalib qolmaydi,
// ildizga tabiiy o'lcham (width/height) va oq fon qo'yiladi — fayl oddiy rasm kabi har joyda ochiladi.

import { SON, HAVOLA, ZAXIRA_IDISH, sonYaroqli, yur, yaxlit, matritsa, miqyos, birlashtir, kesishma, kesmaBolagi, yuza, olcha, korinishOlchami } from './svgGeometriya.js';

export class SvgXato extends Error {}

const MAKS_KIRISH = 400_000;
const MAKS_TUGUN = 4000;
const MAKS_CHUQURLIK = 48;
const MAKS_NUSXA = 120_000;   // <use> nusxalarining jami hajmi (belgi)

// ---------------------------------------------------------------- 1. XML ni o'qish

const BELGILAR = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '°', alpha: 'α', beta: 'β', gamma: 'γ',
  delta: 'δ', Delta: 'Δ', theta: 'θ', phi: 'φ', pi: 'π', omega: 'ω', Omega: 'Ω', mu: 'μ', lambda: 'λ', rho: 'ρ',
  times: '×', middot: '·', minus: '−', le: '≤', ge: '≥', ne: '≠', radic: '√', ang: '∠', sup2: '²', sup3: '³',
  frac12: '½', infin: '∞', plusmn: '±', rarr: '→',
};

/** &amp; &#60; &#x3c; — bir marta ochiladi (ENTITY e'lonlari hech qachon bajarilmaydi). */
function belgilarniOch(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(#[xX][0-9a-fA-F]{1,6}|#\d{1,7}|[A-Za-z][A-Za-z0-9]{1,10});/g, (hammasi, ichi) => {
    if (ichi[0] !== '#') return Object.hasOwn(BELGILAR, ichi) ? BELGILAR[ichi] : hammasi;
    const kod = /^#[xX]/.test(ichi) ? parseInt(ichi.slice(2), 16) : parseInt(ichi.slice(1), 10);
    return kod > 0 && kod <= 0x10FFFF && !(kod >= 0xD800 && kod <= 0xDFFF) ? String.fromCodePoint(kod) : '';
  });
}

/** XML 1.0 da taqiqlangan belgilar: bittasi ham qolsa brauzer butun rasmni ochmaydi. */
const taqiqsiz = (s) => s
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
  .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');

const BOSHLIQ = /\s/;
const TEG_NOMI = /[A-Za-z_][\w.\-]*(?::[A-Za-z_][\w.\-]*)?/y;

/** <!DOCTYPE …[ichki qism]> ning oxiri (ichidagi > ga aldanmasdan). */
function elonOxiri(src, bosh) {
  let ichki = 0;
  let tirnoq = '';
  for (let i = bosh + 2; i < src.length; i++) {
    const c = src[i];
    if (tirnoq) { if (c === tirnoq) tirnoq = ''; continue; }
    if (c === '"' || c === "'") tirnoq = c;
    else if (c === '[') ichki++;
    else if (c === ']') ichki = Math.max(0, ichki - 1);
    else if (c === '>' && !ichki) return i + 1;
  }
  return src.length;
}

/** Teg ichidagi atributlar. Qaytaradi: keyingi o'rin va teg o'zi yopilganmi (<a/>). */
function atributlarniOqi(src, bosh, tugun) {
  const n = src.length;
  let i = bosh;
  for (;;) {
    while (i < n && BOSHLIQ.test(src[i])) i++;
    if (i >= n) return { i, yopiq: true };
    if (src[i] === '>') return { i: i + 1, yopiq: false };
    if (src[i] === '/') {
      if (src[i + 1] === '>') return { i: i + 2, yopiq: true };
      i++;
      continue;
    }
    let j = i;
    while (j < n && !/[\s=/>]/.test(src[j])) j++;
    const nom = src.slice(i, j);
    i = j;
    while (i < n && BOSHLIQ.test(src[i])) i++;
    let qiymat = '';
    if (src[i] === '=') {
      i++;
      while (i < n && BOSHLIQ.test(src[i])) i++;
      const q = src[i];
      if (q === '"' || q === "'") {
        const e = src.indexOf(q, i + 1);
        qiymat = src.slice(i + 1, e < 0 ? n : e);
        i = e < 0 ? n : e + 1;
      } else {
        j = i;
        while (j < n && !/[\s>]/.test(src[j])) j++;
        qiymat = src.slice(i, j);
        i = j;
      }
    }
    if (nom && tugun.atr.length < 80) tugun.atr.push([nom, taqiqsiz(belgilarniOch(qiymat))]);
  }
}

/** Bag'rikeng XML o'qigich: izoh, CDATA, <?…?>, DOCTYPE tashlanadi; yopilmagan teglar oxirida yopiladi. */
function xmlniOqi(src) {
  const ildiz = { teg: '', atr: [], bolalar: [] };
  const stek = [ildiz];
  const n = src.length;
  let soni = 0;
  let i = 0;
  const matnQosh = (s, xom = false) => { if (s) stek[stek.length - 1].bolalar.push(taqiqsiz(xom ? s : belgilarniOch(s))); };
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { matnQosh(src.slice(i)); break; }
    matnQosh(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt + 4); i = e < 0 ? n : e + 3; continue; }
    if (src.startsWith('<![CDATA[', lt)) {
      const e = src.indexOf(']]>', lt + 9);
      matnQosh(src.slice(lt + 9, e < 0 ? n : e), true);
      i = e < 0 ? n : e + 3;
      continue;
    }
    if (src.startsWith('<?', lt)) { const e = src.indexOf('?>', lt + 2); i = e < 0 ? n : e + 2; continue; }
    if (src[lt + 1] === '!') { i = elonOxiri(src, lt); continue; }
    if (src[lt + 1] === '/') {
      const e = src.indexOf('>', lt + 2);
      const nom = src.slice(lt + 2, e < 0 ? n : e).trim();
      for (let k = stek.length - 1; k > 0; k--) if (stek[k].teg === nom) { stek.length = k; break; }
      i = e < 0 ? n : e + 1;
      continue;
    }
    TEG_NOMI.lastIndex = lt + 1;
    const m = TEG_NOMI.exec(src);
    if (!m) { matnQosh('<', true); i = lt + 1; continue; }   // teg emas — oddiy "<" belgisi
    if (++soni > MAKS_TUGUN) throw new SvgXato('Chizma juda murakkab (elementlar juda ko\'p)');
    const tugun = { teg: m[0], atr: [], bolalar: [] };
    const { i: keyingi, yopiq } = atributlarniOqi(src, TEG_NOMI.lastIndex, tugun);
    stek[stek.length - 1].bolalar.push(tugun);
    if (!yopiq) {
      if (stek.length >= MAKS_CHUQURLIK) throw new SvgXato('Chizma juda murakkab (ichma-ich guruhlar juda ko\'p)');
      stek.push(tugun);
    }
    i = keyingi;
  }
  return ildiz;
}

// ---------------------------------------------------------------- 2. Qiymatlarni tekshirish

const SON_G = new RegExp(SON, 'g');
const UZUNLIK = new RegExp(`^${SON}(?:px|pt|mm|cm|in|em|ex|%)?$`);
const SONLAR = /^[\d\s,.eE+\-]{1,60000}$/;
const YOL = /^[MmZzLlHhVvCcSsQqTtAa\d\s,.eE+\-]{1,60000}$/;
// Kalit so'zli atributlar qiymati (stroke-linecap, text-anchor, font-weight, …) — faqat shu lug'atdan yoki son.
const SOZLAR = new Map('butt round square miter bevel nonzero evenodd start middle end auto central hanging alphabetic mathematical ideographic text-before-edge text-after-edge baseline sub super normal bold bolder lighter italic oblique underline overline line-through none non-scaling-stroke visible hidden collapse inline block stroke fill markers userSpaceOnUse objectBoundingBox strokeWidth spacing spacingAndGlyphs auto-start-reverse meet slice xMinYMin xMidYMin xMaxYMin xMinYMid xMidYMid xMaxYMid xMinYMax xMidYMax xMaxYMax'.split(' ').map(s => [s.toLowerCase(), s]));
const SOZ_SON = /^[+-]?\d{1,6}(?:\.\d{1,6})?(?:deg|%|px|em)?$/;
const ID = /^[A-Za-z_][\w\-]{0,63}$/;
const ICHKI_HAVOLA = /^#([A-Za-z_][\w\-]{0,63})$/;

function uzunlik(v) {
  const s = v.trim();
  if (!s || s.length > 28 || !UZUNLIK.test(s) || !sonYaroqli(parseFloat(s))) return null;
  return s.replace(/px$/i, '');
}

function uzunliklar(v) {
  const bolaklar = v.trim().split(/[\s,]+/).filter(Boolean);
  if (!bolaklar.length || bolaklar.length > 120) return null;
  const toza = bolaklar.map(uzunlik);
  return toza.includes(null) ? null : toza.join(' ');
}

/** Sonlar ro'yxati (points, viewBox): faqat son va ajratgich; qayta yoziladi. */
function sonlar(v) {
  const s = v.trim();
  if (!s || !SONLAR.test(s)) return null;
  const topildi = s.match(SON_G) || [];
  if (!topildi.length || s.replace(SON_G, '').replace(/[\s,]/g, '')) return null;
  return topildi.every(x => sonYaroqli(Number(x))) ? topildi.join(' ') : null;
}

function nisbat(v) {
  const s = v.trim();
  if (s.length > 12 || !UZUNLIK.test(s)) return null;
  const son = parseFloat(s) / (s.endsWith('%') ? 100 : 1);
  return Number.isFinite(son) ? String(Math.min(1, Math.max(0, Math.round(son * 100) / 100))) : null;
}

function chiziqcha(v) {
  const s = v.trim().toLowerCase();
  if (s === 'none') return 'none';
  const toza = sonlar(s.replace(/px/g, ''));
  if (!toza) return null;
  const qiymatlar = toza.split(' ').map(Number);
  // Juda mayda uzuq chiziq uzun yo'lda brauzerni qotiradi.
  return qiymatlar.length <= 12 && qiymatlar.every(x => x >= 0) && qiymatlar.some(x => x >= 0.2) ? toza : null;
}

const yol = (v) => { const s = v.trim(); return s && YOL.test(s) && /^[Mm]/.test(s) ? s.replace(/\s+/g, ' ') : null; };

const TRANSFORM_SONI = { translate: [1, 2], scale: [1, 2], rotate: [1, 3], skewX: [1, 1], skewY: [1, 1], matrix: [6, 6] };
/** transform: faqat ma'lum funksiyalar, sonlari tekshirilib qayta yoziladi. */
function transform(v) {
  const s = v.trim();
  if (!s || s.length > 600) return null;
  const qismlar = [];
  let qoldi = s;
  for (const m of s.matchAll(/(translate|scale|rotate|skewX|skewY|matrix)\s*\(([^()]{0,200})\)/g)) {
    const sonlari = sonlar(m[2]);
    const [kam, kop] = TRANSFORM_SONI[m[1]];
    const soni = sonlari ? sonlari.split(' ').length : 0;
    if (soni < kam || soni > kop || (m[1] === 'rotate' && soni === 2)) return null;
    qismlar.push(`${m[1]}(${sonlari})`);
    qoldi = qoldi.replace(m[0], '');
  }
  return qismlar.length && qismlar.length <= 12 && !qoldi.replace(/[\s,]/g, '') ? qismlar.join(' ') : null;
}

// Map: oddiy obyektda «constructor», «__proto__» kabi nomlar ham «topilib» qolardi.
const NOMLI_RANG = new Map(Object.entries({
  black: [0, 0, 0], white: [255, 255, 255], gray: [128, 128, 128], grey: [128, 128, 128], silver: [192, 192, 192],
  lightgray: [211, 211, 211], lightgrey: [211, 211, 211], darkgray: [169, 169, 169], darkgrey: [169, 169, 169],
  dimgray: [105, 105, 105], dimgrey: [105, 105, 105], gainsboro: [220, 220, 220], whitesmoke: [245, 245, 245],
  red: [255, 0, 0], blue: [0, 0, 255], green: [0, 128, 0], yellow: [255, 255, 0], orange: [255, 165, 0],
  purple: [128, 0, 128], navy: [0, 0, 128], brown: [165, 42, 42], pink: [255, 192, 203], cyan: [0, 255, 255],
  lightblue: [173, 216, 230], lightgreen: [144, 238, 144], lightyellow: [255, 255, 224],
}));

/** Rang → [r, g, b, alfa] yoki null. */
function rangniOqi(s) {
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m && [3, 4, 6, 8].includes(m[1].length)) {
    const h = m[1].length <= 4 ? m[1].replace(/./g, '$&$&') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  m = /^rgba?\(\s*([\d.]{1,8}%?)[\s,]+([\d.]{1,8}%?)[\s,]+([\d.]{1,8}%?)(?:[\s,/]+([\d.]{1,8}%?))?\s*\)$/.exec(s);
  if (m) {
    const kanal = (x) => Math.min(255, Math.max(0, x.endsWith('%') ? parseFloat(x) * 2.55 : parseFloat(x))) || 0;
    const alfa = m[4] === undefined ? 1 : Math.min(1, Math.max(0, m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]))) || 0;
    return [kanal(m[1]), kanal(m[2]), kanal(m[3]), alfa];
  }
  m = /^hsla?\(\s*[\d.]{1,8}(?:deg)?[\s,]+([\d.]{1,8})%[\s,]+([\d.]{1,8})%/.exec(s);
  if (m) {
    // Oq-qora uchun faqat yorug'lik kerak; to'yingan rang — «rangli» deb belgilanadi.
    const l = Math.min(100, parseFloat(m[2]) || 0) * 2.55;
    return parseFloat(m[1]) > 15 ? [l, l / 2, l / 2, 1] : [l, l, l, 1];
  }
  if (/^[a-z]{3,24}$/.test(s)) return [...(NOMLI_RANG.get(s) || [0, 0, 120]), 1];   // noma'lum nom — to'q rang
  return null;
}

const kulrang = (daraja) => { const h = Math.round(Math.min(255, Math.max(0, daraja))).toString(16).padStart(2, '0'); return `#${h}${h}${h}`; };

/**
 * Rang → oq-qora chopga mos qiymat. `joyi`: 'fill' (bo'yoq — och kulrang soya qolishi mumkin)
 * yoki 'stroke' (chiziq — rangli bo'lsa qora). url(#id) — naqsh (shtrix) uchun.
 */
function rang(v, joyi) {
  const s = v.trim().toLowerCase();
  if (!s || s.length > 60) return null;
  if (s === 'none' || s === 'transparent') return 'none';
  if (s === 'currentcolor' || s === 'inherit') return '#000000';
  const havola = HAVOLA.exec(v.trim());
  if (havola) return `url(#${havola[1]})`;
  const r = rangniOqi(s);
  if (!r) return null;
  if (r[3] <= 0.02) return 'none';
  // Shaffoflik oq qog'oz ustida hisoblanadi.
  const [qizil, yashil, kok] = r.slice(0, 3).map(x => 255 - r[3] * (255 - x));
  const yoruglik = 0.2126 * qizil + 0.7152 * yashil + 0.0722 * kok;
  const rangli = Math.max(qizil, yashil, kok) - Math.min(qizil, yashil, kok) > 40;
  if (joyi === 'fill') return rangli ? (yoruglik < 128 ? '#000000' : '#d9d9d9') : kulrang(yoruglik);
  if (rangli) return '#000000';
  return yoruglik >= 238 ? '#ffffff' : kulrang(Math.min(yoruglik, 153));
}

const havola = (v) => { const s = v.trim(); if (s.toLowerCase() === 'none') return 'none'; const m = HAVOLA.exec(s); return m ? `url(#${m[1]})` : null; };
function soz(v) {
  const s = v.trim().replace(/\s+/g, ' ');
  if (!s || s.length > 60) return null;
  if (SOZ_SON.test(s)) return s;
  const sozlar = s.split(' ').map(x => SOZLAR.get(x.toLowerCase()));
  return sozlar.length <= 4 && !sozlar.includes(undefined) ? sozlar.join(' ') : null;
}
const id = (v) => (ID.test(v.trim()) ? v.trim() : null);
const ichkiHavola = (v) => (ICHKI_HAVOLA.test(v.trim()) ? v.trim() : null);

/** Shrift: faqat uchta tayyor to'plamdan biri (tashqi shrift nomi chiqishga o'tmaydi). */
function shrift(v) {
  if (/mono|courier|consolas/i.test(v)) return 'Courier New, monospace';
  if (/times|georgia|cambria|garamond/i.test(v) || (/serif/i.test(v) && !/sans/i.test(v))) return 'Times New Roman, Times, serif';
  return 'Arial, Helvetica, sans-serif';
}

const TEKSHIRUVCHI = { uzunlik, uzunliklar, sonlar, nisbat, chiziqcha, yol, transform, havola, soz, id, ichkiHavola, shrift, fill: v => rang(v, 'fill'), stroke: v => rang(v, 'stroke') };

// kichik harfli nom → [asl nom, tekshiruvchi]. SVG nomlari harf kattaligiga sezgir (viewBox, clipPath).
const ATRIBUTLAR = new Map([
  ['uzunlik', ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'refX', 'refY', 'markerWidth', 'markerHeight', 'stroke-width', 'stroke-dashoffset', 'stroke-miterlimit', 'font-size', 'letter-spacing', 'word-spacing', 'textLength']],
  ['uzunliklar', ['x', 'y', 'dx', 'dy', 'rotate']],
  ['nisbat', ['opacity', 'fill-opacity', 'stroke-opacity']],
  ['sonlar', ['points', 'viewBox']],
  ['chiziqcha', ['stroke-dasharray']],
  ['yol', ['d']],
  ['transform', ['transform', 'patternTransform']],
  ['fill', ['fill']],
  ['stroke', ['stroke']],
  ['havola', ['marker-start', 'marker-mid', 'marker-end', 'clip-path']],
  ['soz', ['stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule', 'text-anchor', 'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'font-weight', 'font-style', 'text-decoration', 'vector-effect', 'visibility', 'display', 'paint-order', 'markerUnits', 'patternUnits', 'patternContentUnits', 'clipPathUnits', 'lengthAdjust', 'orient', 'preserveAspectRatio']],
  ['shrift', ['font-family']],
  ['id', ['id']],
  ['ichkiHavola', ['href']],
].flatMap(([tur, nomlar]) => nomlar.map(nom => [nom.toLowerCase(), [nom, tur]])));

/** CSS orqali berilishi mumkin bo'lgan xossalar (geometriya va id — faqat atribut bilan). */
const CSS_XOSSALARI = new Set(['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'clip-rule', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'letter-spacing', 'word-spacing', 'text-decoration', 'visibility', 'display', 'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'vector-effect', 'paint-order']);

// Map: oddiy obyektda «constructor», «__proto__» degan teglar ham «ruxsat etilgan» bo'lib chiqardi.
const ELEMENTLAR = new Map(['svg', 'g', 'defs', 'title', 'desc', 'path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse', 'text', 'tspan', 'marker', 'clipPath', 'pattern', 'use'].map(e => [e.toLowerCase(), e]));
/** Strelka uchi (marker) faqat shu shakllarda: guruhdan meros bo'lsa, har chiziqqa minglab nusxa tushishi mumkin. */
const MARKERLI = new Set(['path', 'line', 'polyline', 'polygon']);
/** Atribut qiymatining eng katta uzunligi: yo'l va nuqtalar uzun bo'lishi tabiiy, qolgani — qisqa. */
const MAKS_QIYMAT = { yol: 60000, sonlar: 60000, uzunliklar: 2000 };
const MAKS_MATN = 400;   // bitta yozuv bo'lagi (chizmada yozuv — qisqa belgi)
const IDISHLAR = new Set(['svg', 'g', 'defs', 'marker', 'clipPath', 'pattern']);
/** Tashlangani ogohlantirishga chiqmaydigan (chizmaga ta'sir qilmaydigan) teglar. */
const ZARARSIZ = new Set(['metadata', 'style', 'script', 'sodipodi:namedview']);

const tegNomi = (t) => t.replace(/^svg:/i, '').toLowerCase();

// ---------------------------------------------------------------- 3. CSS ni atributlarga yoyish

function xossalar(matn) {
  const juftlar = [];
  for (const bolak of String(matn).slice(0, 4000).split(';')) {
    const k = bolak.indexOf(':');
    if (k < 1) continue;
    const nom = bolak.slice(0, k).trim().toLowerCase();
    const qiymat = bolak.slice(k + 1).replace(/!important/i, '').trim();
    if (CSS_XOSSALARI.has(nom) && qiymat.length <= 200) juftlar.push([nom, qiymat]);
  }
  return juftlar;
}

/** <style> matni → oddiy qoidalar (teg, .sinf, #id; boshqa tanlagichlar e'tiborga olinmaydi). */
function cssQoidalari(matn) {
  const qoidalar = [];
  const toza = matn.slice(0, 40000).replace(/\/\*[^]*?\*\//g, '');
  for (const m of toza.matchAll(/([^{}]{1,400})\{([^{}]{0,4000})\}/g)) {
    const juftlar = xossalar(m[2]);
    if (!juftlar.length) continue;
    if (qoidalar.length >= 300) break;
    for (const tanlagich of m[1].split(',')) {
      const t = /^([A-Za-z]{1,20}|\*)?((?:[.#][\w\-]{1,64}){0,6})$/.exec(tanlagich.trim());
      if (!t || !tanlagich.trim()) continue;
      const belgilar = t[2].match(/[.#][\w\-]+/g) || [];
      const sinflar = belgilar.filter(b => b[0] === '.').map(b => b.slice(1));
      const idsi = belgilar.find(b => b[0] === '#')?.slice(1) || null;
      const teg = t[1] && t[1] !== '*' ? t[1].toLowerCase() : null;
      qoidalar.push({ teg, sinflar, id: idsi, vazn: (idsi ? 100 : 0) + sinflar.length * 10 + (teg ? 1 : 0), juftlar });
    }
  }
  return qoidalar.sort((a, b) => a.vazn - b.vazn);
}

function uslubMatnlari(tugun, yigma = []) {
  for (const b of tugun.bolalar) {
    if (typeof b === 'string') continue;
    if (tegNomi(b.teg) === 'style') yigma.push(b.bolalar.filter(x => typeof x === 'string').join(''));
    else uslubMatnlari(b, yigma);
  }
  return yigma;
}

// ---------------------------------------------------------------- 4. Daraxtni tozalash

const matnBolalari = (tugun) => tugun.bolalar.filter(b => typeof b === 'string').join('');

function atributlarniTozala(xom, teg, kt) {
  const kelgan = new Map();
  let sinflar = [];
  let ichkiUslub = '';
  for (const [nomi, qiymat] of xom.atr) {
    const nom = nomi.toLowerCase().replace(/^xlink:/, '');
    if (nom === 'class') sinflar = qiymat.split(/\s+/).filter(Boolean);
    else if (nom === 'style') ichkiUslub = qiymat;
    else if (!nom.includes(':') && !kelgan.has(nom)) kelgan.set(nom, qiymat);
  }
  // CSS ustunligi: atribut < <style> qoidasi < style="".
  const elId = kelgan.get('id');
  for (const q of kt.qoidalar) {
    if ((q.teg && q.teg !== teg.toLowerCase()) || (q.id && q.id !== elId) || !q.sinflar.every(s => sinflar.includes(s))) continue;
    for (const [n, v] of q.juftlar) kelgan.set(n, v);
  }
  for (const [n, v] of xossalar(ichkiUslub)) kelgan.set(n, v);

  const atr = new Map();
  let yaroqsiz = false;
  for (const [nom, qiymat] of kelgan) {
    const tavsif = ATRIBUTLAR.get(nom);
    if (!tavsif) continue;   // ro'yxatda yo'q (on*, xmlns, data-*, …) — chiqishga o'tmaydi
    const [aslNom, tur] = tavsif;
    if (aslNom === 'href' && teg !== 'use') continue;
    if ((aslNom === 'viewBox' || aslNom === 'preserveAspectRatio') && !['svg', 'marker', 'pattern'].includes(teg)) continue;
    if (aslNom.startsWith('marker-') && !MARKERLI.has(teg)) continue;
    const toza = String(qiymat).length > (MAKS_QIYMAT[tur] || 600) ? null : TEKSHIRUVCHI[tur](String(qiymat));
    if (toza === null) { if (aslNom === 'd' || aslNom === 'points') yaroqsiz = true; continue; }
    atr.set(aslNom, toza);
  }
  return { atr, yaroqsiz };
}

/** Xom tugun → toza tugunlar ro'yxati (odatda bitta; <a> — ichidagilar; noma'lum teg — bo'sh). */
function tozalaTugun(xom, kt, otaTeg) {
  const kichik = tegNomi(xom.teg);
  if (kichik === 'a') return xom.bolalar.flatMap(b => (typeof b === 'string' ? (otaTeg === 'text' || otaTeg === 'tspan' ? [b.replace(/\s+/g, ' ').slice(0, MAKS_MATN)] : []) : tozalaTugun(b, kt, otaTeg)));
  const teg = ELEMENTLAR.get(kichik);
  const joyida = teg && teg !== 'svg' && (otaTeg === 'text' || otaTeg === 'tspan' ? teg === 'tspan' : teg !== 'tspan');
  if (!joyida) {
    if (!ZARARSIZ.has(kichik)) kt.tashlandi.add(/^[\w:\-]{1,30}$/.test(kichik) ? kichik : '?');
    return [];
  }
  const { atr, yaroqsiz } = atributlarniTozala(xom, teg, kt);
  if (yaroqsiz) { kt.yaroqsiz++; return []; }
  // Ko'rinmaydigan element kerak emas (yashirin matnda javob bo'lishi ham mumkin).
  if (atr.get('display') === 'none' || atr.get('visibility') === 'hidden' || atr.get('opacity') === '0') return [];
  const tugun = { teg, atr, bolalar: [] };
  if (teg === 'title' || teg === 'desc') {
    const matn = matnBolalari(xom).replace(/\s+/g, ' ').trim().slice(0, 300);
    return matn ? [{ teg, atr: new Map(), bolalar: [matn] }] : [];
  }
  if (IDISHLAR.has(teg)) {
    tugun.bolalar = xom.bolalar.flatMap(b => (typeof b === 'string' ? [] : tozalaTugun(b, kt, teg)));
  } else if (teg === 'text' || teg === 'tspan') {
    tugun.bolalar = xom.bolalar.flatMap(b => (typeof b === 'string' ? [b.replace(/\s+/g, ' ').slice(0, MAKS_MATN)] : tozalaTugun(b, kt, teg))).filter(b => b !== '');
    if (teg === 'text') {
      // Brauzer ham bosh va oxiridagi bo'shliqni tashlaydi.
      if (typeof tugun.bolalar[0] === 'string') tugun.bolalar[0] = tugun.bolalar[0].trimStart();
      const oxiri = tugun.bolalar.length - 1;
      if (typeof tugun.bolalar[oxiri] === 'string') tugun.bolalar[oxiri] = tugun.bolalar[oxiri].trimEnd();
      tugun.bolalar = tugun.bolalar.filter(b => b !== '');
      if (!tugun.bolalar.length) return [];
    }
  }
  return [tugun];
}

const nusxa = (t) => ({ teg: t.teg, atr: new Map([...t.atr].filter(([k]) => k !== 'id')), bolalar: t.bolalar.map(b => (typeof b === 'string' ? b : nusxa(b))) });

/** id lar (takrori tashlanadi), <use> ni yoyish, topilmagan havolalarni olib tashlash. */
function havolalarniTartibla(ildiz, kt) {
  const idlar = new Map();
  yur(ildiz, (t) => {
    const i = t.atr.get('id');
    if (!i) return;
    if (idlar.has(i)) t.atr.delete('id'); else idlar.set(i, t);
  });
  // <use href="#id"> — nishon nusxasi bilan almashtiriladi. Ichida yana use bo'lgan nishon
  // yoyilmaydi: zanjirli use bir necha baytdan millionlab shakl yasaydi.
  const useli = new Set();
  for (const nishon of idlar.values()) yur(nishon, (x) => { if (x.teg === 'use') useli.add(nishon); });
  const hajmi = (t) => 30 + [...t.atr].reduce((j, [k, v]) => j + k.length + v.length + 4, 0) + t.bolalar.reduce((j, b) => j + (typeof b === 'string' ? b.length : hajmi(b)), 0);
  let qoshildi = 0;
  const yoy = (ota) => {
    ota.bolalar = ota.bolalar.flatMap((b) => {
      if (typeof b === 'string') return [b];
      if (b.teg !== 'use') { yoy(b); return [b]; }
      const nishon = idlar.get((b.atr.get('href') || '').slice(1));
      const yoyilmaydi = !nishon || nishon.teg === 'svg' || ZAXIRA_IDISH.has(nishon.teg) || useli.has(nishon);
      if (!yoyilmaydi) qoshildi += hajmi(nishon);
      if (yoyilmaydi || qoshildi > MAKS_NUSXA) { kt.tashlandi.add('use'); return []; }
      const atr = new Map([...b.atr].filter(([k]) => !['href', 'x', 'y', 'width', 'height', 'id'].includes(k)));
      const [x, y] = [parseFloat(b.atr.get('x')) || 0, parseFloat(b.atr.get('y')) || 0];
      if (x || y) atr.set('transform', `${atr.get('transform') || ''} translate(${x} ${y})`.trim());
      return [{ teg: 'g', atr, bolalar: [nusxa(nishon)] }];
    });
  };
  yoy(ildiz);
  // Naqsh, belgi va qirqim ichida boshqasiga havola bo'lmaydi (ichma-ich naqsh — brauzerni qotiradi).
  const tekshir = (t, zaxirada) => {
    for (const nom of ['fill', 'stroke', 'marker-start', 'marker-mid', 'marker-end', 'clip-path']) {
      const m = HAVOLA.exec(t.atr.get(nom) || '');
      if (!m) continue;
      const nishon = idlar.get(m[1]);
      const kerak = nom === 'clip-path' ? 'clipPath' : nom.startsWith('marker') ? 'marker' : 'pattern';
      if (zaxirada || !nishon || nishon.teg !== kerak) { if (nom === 'fill') t.atr.set('fill', 'none'); else t.atr.delete(nom); }
    }
    for (const b of t.bolalar) if (typeof b !== 'string') tekshir(b, zaxirada || ZAXIRA_IDISH.has(b.teg));
  };
  tekshir(ildiz, false);
  // Juda mayda katakli naqsh katta maydonda millionlab bo'lak chizadi.
  yur(ildiz, (t) => {
    if (t.teg !== 'pattern' && t.teg !== 'marker') return;
    let ichida = 0;
    yur(t, () => { ichida++; });
    if (ichida > 24) t.bolalar = [];
    if (t.teg !== 'pattern') return;
    const [w, h] = [parseFloat(t.atr.get('width')), parseFloat(t.atr.get('height'))];
    const foizli = /%/.test(`${t.atr.get('width')}${t.atr.get('height')}`);
    // Birlik ko'rsatilmasa SVG da o'lcham — shakl ulushi (0..1); model esa odatda birlikda yozadi (6×6).
    if (!t.atr.has('patternUnits') && !foizli && w >= 1.5 && h >= 1.5) t.atr.set('patternUnits', 'userSpaceOnUse');
    const birlikda = !foizli && t.atr.get('patternUnits') === 'userSpaceOnUse';
    const kam = birlikda ? 1.5 : foizli ? 1 : 0.01;
    if (!(w >= kam && h >= kam)) t.bolalar = [];
  });
  return idlar;
}

// ---------------------------------------------------------------- 5. O'lchash (lib/svgGeometriya.js), tuzatish va yozish

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function yoz(t) {
  const atr = [...t.atr].map(([k, v]) => ` ${k}="${xmlEsc(v)}"`).join('');
  if (!t.bolalar.length) return `<${t.teg}${atr}/>`;
  return `<${t.teg}${atr}>${t.bolalar.map(b => (typeof b === 'string' ? xmlEsc(b) : yoz(b))).join('')}</${t.teg}>`;
}

const qisqa = (s) => (s.length > 24 ? `${s.slice(0, 22)}…` : s);

/**
 * Ishonchsiz SVG matni → xavfsiz, chopga tayyor SVG.
 * Qaytaradi: { svg, eni, boyi (CSS px), viewBox, ogohlar: string[], jiddiy: soni, shakllar, yozuvlar }.
 * `jiddiy` > 0 — chizmada ko'zga tashlanadigan kamchilik bor (qayta chizdirishga arziydi).
 * `fon: false` — oq fon qo'yilmaydi (modelga namuna qilib beriladigan nusxa uchun).
 * Chizma yaroqsiz bo'lsa — SvgXato.
 */
export function svgniTozala(kirish, { maksBayt = 200_000, fon = true } = {}) {
  if (typeof kirish !== 'string' || !kirish.trim()) throw new SvgXato('Chizma bo\'sh');
  if (kirish.length > MAKS_KIRISH) throw new SvgXato('Chizma juda katta');
  const daraxt = xmlniOqi(kirish.replace(/^\uFEFF/, ''));
  let xomIldiz = null;
  yur(daraxt, (t) => { if (!xomIldiz && tegNomi(t.teg) === 'svg') xomIldiz = t; });
  if (!xomIldiz) throw new SvgXato('Chizma topilmadi (<svg> yo\'q)');

  const kt = { qoidalar: cssQoidalari(uslubMatnlari(xomIldiz).join('\n')), tashlandi: new Set(), yaroqsiz: 0 };
  const { atr } = atributlarniTozala(xomIldiz, 'svg', kt);
  const ildiz = { teg: 'svg', atr, bolalar: xomIldiz.bolalar.flatMap(b => (typeof b === 'string' ? [] : tozalaTugun(b, kt, 'svg'))) };
  const idlar = havolalarniTartibla(ildiz, kt);

  // Model bergan maydon: viewBox, bo'lmasa width/height.
  const vbXom = (atr.get('viewBox') || '').split(' ').map(Number);
  const [w0, h0] = [parseFloat(atr.get('width')), parseFloat(atr.get('height'))];
  const vb0 = vbXom.length === 4 && vbXom[2] > 0 && vbXom[3] > 0 ? vbXom
    : w0 > 0 && h0 > 0 && !/%/.test(`${atr.get('width')}${atr.get('height')}`) ? [0, 0, w0, h0] : null;
  for (const nom of ['x', 'y', 'width', 'height', 'viewBox', 'preserveAspectRatio', 'id', 'transform']) atr.delete(nom);
  if (!atr.has('font-family')) atr.set('font-family', 'Arial, Helvetica, sans-serif');

  const g = olcha(ildiz, vb0, idlar);
  const tozalaFon = (t) => { t.bolalar = t.bolalar.filter(b => typeof b === 'string' || !g.fon.has(b)); for (const b of t.bolalar) if (typeof b !== 'string') tozalaFon(b); };
  tozalaFon(ildiz);
  if (!g.quti || !(g.shakllar + g.yozuvlar.length)) throw new SvgXato('Chizma bo\'sh chiqdi');

  // viewBox — mazmun atrofida bir tekis hoshiya bilan: kamida ~9 px (chiziq qalinligi, strelka uchi,
  // yozuv enini taxmin qilishdagi xato shunga sig'adi).
  const shriftlar = g.yozuvlar.map(y => y.fs);
  const [cw, ch] = [Math.max(g.quti[2] - g.quti[0], 1e-3), Math.max(g.quti[3] - g.quti[1], 1e-3)];
  const chet = Math.max(0.03 * Math.max(cw, ch), 9 / korinishOlchami([0, 0, cw, ch], shriftlar).k);
  let vb = [g.quti[0] - chet, g.quti[1] - chet, cw + 2 * chet, ch + 2 * chet];
  if (g.noaniq && vb0) { const q = birlashtir([vb0[0], vb0[1], vb0[0] + vb0[2], vb0[1] + vb0[3]], [vb[0], vb[1], vb[0] + vb[2], vb[1] + vb[3]]); vb = [q[0], q[1], q[2] - q[0], q[3] - q[1]]; }
  vb = vb.map(yaxlit);
  // 0,01 gacha yaxlitlash juda mayda chizmada viewBox ni nolga aylantiradi — bunday chizma yaroqsiz.
  if (!vb.every(sonYaroqli) || vb[2] < 2 || vb[3] < 2) throw new SvgXato('Chizma o\'lchami yaroqsiz');
  const { k, eni, boyi } = korinishOlchami(vb, shriftlar);

  // Brauzerni qiynaydigan mayda uzuq chiziq va mayda naqsh — EKRAN nuqtasida o'lchanadi (birlik katta-kichik bo'lishi mumkin).
  for (const c of g.chiziqlar) {
    if (!c.dash || c.dash === 'none') continue;
    const bolaklar = c.dash.split(' ').map(x => Number(x) * c.miqyos * k);
    const davr = bolaklar.reduce((j, x) => j + x, 0);
    if (Math.min(...bolaklar.filter(x => x > 0)) < 0.3 || (c.uzunlik * k / Math.max(davr, 1e-9)) * bolaklar.length > 4000) c.t.atr.set('stroke-dasharray', 'none');
  }
  yur(ildiz, (t) => {
    if (t.teg !== 'pattern' || t.atr.get('patternUnits') !== 'userSpaceOnUse') return;
    const katak = Math.min(parseFloat(t.atr.get('width')), parseFloat(t.atr.get('height'))) * miqyos(matritsa(t.atr.get('patternTransform'))) * k;
    if (!(katak >= 1.5)) t.bolalar = [];
  });

  // Chiziq qalinligi chopda ko'rinadigan oraliqda (0,6–3,2 px).
  for (const c of g.chiziqlar) {
    if (c.qotgan) continue;
    const korinadi = c.sw * c.miqyos * k;
    const kerak = Math.min(3.2, Math.max(0.6, korinadi));
    if (Math.abs(kerak - korinadi) > 0.01) c.t.atr.set('stroke-width', String(yaxlit(kerak / (c.miqyos * k))));
  }

  const ogohlar = [];
  let jiddiy = 0;
  const jiddiyOgoh = (matn) => { ogohlar.push(matn); jiddiy++; };
  // Juft-juft solishtirish qimmat: odatdagi chizmada yozuv o'nlab, ortig'i (dushman kirish) tekshirilmaydi.
  const tekshiriladi = g.yozuvlar.slice(0, 300);
  const ustmaUst = [];
  for (let i = 0; i < tekshiriladi.length && ustmaUst.length < 4; i++) {
    for (let j = i + 1; j < tekshiriladi.length; j++) {
      const [a, b] = [tekshiriladi[i], tekshiriladi[j]];
      if (a.egasi === b.egasi) continue;
      const q = kesishma(a.quti, b.quti);
      if (q && yuza(q) > 0.25 * Math.min(yuza(a.quti), yuza(b.quti))) ustmaUst.push(`«${qisqa(a.matn)}» va «${qisqa(b.matn)}»`);
    }
  }
  if (ustmaUst.length) jiddiyOgoh(`Yozuvlar ustma-ust tushgan: ${ustmaUst.slice(0, 4).join('; ')}`);
  // Yozuvning o'rtasidan (harflar turgan joydan) chiziq o'tsa — o'qiladi (oq gardish), lekin chiroyli emas.
  const chiziqda = tekshiriladi.filter((y) => {
    const [x0, y0, x1, y1] = y.quti;
    const ichi = [x0 + 0.12 * (x1 - x0), y0 + 0.25 * (y1 - y0), x1 - 0.12 * (x1 - x0), y1 - 0.2 * (y1 - y0)];
    return g.kesmalar.some(([a, b]) => kesmaBolagi(ichi, a, b));
  });
  if (chiziqda.length) jiddiyOgoh(`Yozuv ustidan chiziq o'tgan: ${chiziqda.slice(0, 5).map(y => `«${qisqa(y.matn)}»`).join(', ')}`);
  const latex = g.yozuvlar.find(y => /\$|\\[A-Za-z]{2,}|[\^_]\{/.test(y.matn));
  if (latex) jiddiyOgoh(`Yozuvda formula belgilari qolgan: «${qisqa(latex.matn)}»`);
  if (kt.tashlandi.size) jiddiyOgoh(`Ruxsat etilmagan qismlar olib tashlandi: ${[...kt.tashlandi].slice(0, 6).join(', ')}`);
  if (kt.yaroqsiz + g.yaroqsiz) jiddiyOgoh(`${kt.yaroqsiz + g.yaroqsiz} ta shakl koordinatasi yaroqsiz bo'lgani uchun tashlandi`);
  if (g.qoraShakllar.some(y => y > 0.2 * cw * ch && y > 400)) jiddiyOgoh('Katta shakl qora bo\'yalgan (bo\'yoq ko\'rsatilmagan)');
  if (g.yozuvlar.some(y => y.matn.length > 70)) ogohlar.push('Chizmada uzun matn bor');
  if (g.yozuvlar.some(y => y.fs * k < 7.5)) ogohlar.push('Yozuvlar juda mayda');
  if (Math.max(vb[2] / vb[3], vb[3] / vb[2]) > 6) ogohlar.push('Chizma juda cho\'ziq');

  const tartibli = new Map([['xmlns', 'http://www.w3.org/2000/svg'], ['viewBox', vb.join(' ')], ['width', String(eni)], ['height', String(boyi)], ...atr]);
  // Oq fon: chizma qayerda ochilmasin (qorong'i mavzu, Telegram, boshqa dastur) qora chiziqlar oq
  // qog'ozda turadi; chopda oq bo'yoq bosilmaydi. Qayta tozalashda bu to'rtburchak «fon» deb olinadi.
  const oqFon = { teg: 'rect', atr: new Map([['x', String(vb[0])], ['y', String(vb[1])], ['width', String(vb[2])], ['height', String(vb[3])], ['fill', '#ffffff'], ['stroke', 'none']]), bolalar: [] };
  const svg = yoz({ teg: 'svg', atr: tartibli, bolalar: fon ? [oqFon, ...ildiz.bolalar] : ildiz.bolalar });
  if (Buffer.byteLength(svg, 'utf8') > maksBayt) throw new SvgXato('Chizma juda katta');
  return { svg, eni, boyi, viewBox: vb, ogohlar, jiddiy, shakllar: g.shakllar, yozuvlar: g.yozuvlar.length };
}
