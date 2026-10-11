// SVG chizmani O'LCHASH (lib/svgTozala.js uchun): matritsa, yo'l (path) nuqtalari, shakl va yozuv
// qutilari. Shu o'lchovlar bilan tozalagich viewBox ni mazmunga moslaydi, chiziq qalinligini
// tekislaydi va kamchiliklarni topadi (ustma-ust yozuv, yozuv ustidan o'tgan chiziq).
// Bu yerga faqat TOZALANGAN daraxt keladi: { teg, atr: Map, bolalar: [tugun | matn] } —
// atribut qiymatlari allaqachon tekshirilgan (son, ro'yxat, transform — qat'iy ko'rinishda).

export const MAKS_SON = 1e6;
// Bir xil raqamlar ikki xil yo'l bilan mos kelmaydigan ko'rinishda (\d+\.?\d* emas): aks holda uzun
// raqamlar qatori + bitta begona belgi regexni kvadratik vaqtga tushiradi (ReDoS).
export const SON = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
export const HAVOLA = /^url\(\s*['"]?#([A-Za-z_][\w\-]{0,63})['"]?\s*\)$/;
export const sonYaroqli = (v) => Number.isFinite(v) && Math.abs(v) <= MAKS_SON;
export const SHAKLLAR = new Set(['path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse']);
export const ZAXIRA_IDISH = new Set(['defs', 'marker', 'clipPath', 'pattern']);   // chizilmaydi — faqat havola bilan ishlatiladi
export const yur = (tugun, f) => { f(tugun); for (const b of tugun.bolalar) if (typeof b !== 'string') yur(b, f); };

const BIRLIK = [1, 0, 0, 1, 0, 0];
const kopaytir = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const nuqta = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
export const miqyos = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
export const yaxlit = (v) => Math.round(v * 100) / 100;

export function matritsa(str) {
  let m = BIRLIK;
  for (const q of String(str || '').matchAll(/(\w+)\(([^)]*)\)/g)) {
    const a = q[2].split(' ').map(Number);
    const rad = (a[0] * Math.PI) / 180;
    let t = BIRLIK;
    if (q[1] === 'translate') t = [1, 0, 0, 1, a[0], a[1] || 0];
    else if (q[1] === 'scale') t = [a[0], 0, 0, a[1] ?? a[0], 0, 0];
    else if (q[1] === 'rotate') {
      const [c, s] = [Math.cos(rad), Math.sin(rad)];
      const [cx, cy] = [a[1] || 0, a[2] || 0];
      t = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
    } else if (q[1] === 'skewX') t = [1, 0, Math.tan(rad), 1, 0, 0];
    else if (q[1] === 'skewY') t = [1, Math.tan(rad), 0, 1, 0, 0];
    else if (q[1] === 'matrix') t = a;
    m = kopaytir(m, t);
  }
  return m;
}

/** Yoy (A buyrug'i) ustidagi nuqtalar — SVG F.6.5 bo'yicha markaz topiladi. */
function yoyNuqtalari(x1, y1, rx0, ry0, burchak, katta, yonalish, x2, y2) {
  let rx = Math.abs(rx0);
  let ry = Math.abs(ry0);
  if (!rx || !ry || (x1 === x2 && y1 === y2)) return [[x2, y2]];
  const f = (burchak * Math.PI) / 180;
  const [c, s] = [Math.cos(f), Math.sin(f)];
  const [dx, dy] = [(x1 - x2) / 2, (y1 - y2) / 2];
  const [xp, yp] = [c * dx + s * dy, -s * dx + c * dy];
  const l = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (l > 1) { rx *= Math.sqrt(l); ry *= Math.sqrt(l); }
  const maxraj = rx * rx * yp * yp + ry * ry * xp * xp;
  const k = (katta === yonalish ? -1 : 1) * Math.sqrt(Math.max(0, rx * rx * ry * ry - maxraj) / (maxraj || 1));
  const [cxp, cyp] = [(k * rx * yp) / ry, (-k * ry * xp) / rx];
  const [cx, cy] = [c * cxp - s * cyp + (x1 + x2) / 2, s * cxp + c * cyp + (y1 + y2) / 2];
  const t1 = Math.atan2((yp - cyp) / ry, (xp - cxp) / rx);
  let dt = Math.atan2((-yp - cyp) / ry, (-xp - cxp) / rx) - t1;
  if (yonalish && dt < 0) dt += 2 * Math.PI;
  if (!yonalish && dt > 0) dt -= 2 * Math.PI;
  const n = Math.max(2, Math.ceil(Math.abs(dt) / (Math.PI / 12)));
  return Array.from({ length: n }, (_, i) => {
    const t = t1 + (dt * (i + 1)) / n;
    return [cx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, cy + rx * Math.cos(t) * s + ry * Math.sin(t) * c];
  });
}

const YOL_SONI = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const SON_Y = new RegExp(SON, 'y');

/** Yo'l (d) ustidagi nuqtalar (egri chiziqlar namunalanadi). Yaroqsiz bo'lsa — null. */
export function yolNuqtalari(d) {
  const nuqtalar = [];
  let i = 0;
  let joriy = [0, 0];
  let bosh = [0, 0];
  let nazorat = null;   // oldingi egri chiziqning oxirgi nazorat nuqtasi (S, T uchun)
  let buyruq = '';
  let yopiq = false;
  const boshlar = new Set();   // har bo'lak (M) boshlanadigan nuqta o'rni — bo'laklar orasida chiziq yo'q
  const otkaz = () => { while (i < d.length && /[\s,]/.test(d[i])) i++; };
  const son = () => {
    otkaz();
    SON_Y.lastIndex = i;
    const m = SON_Y.exec(d);
    if (!m) return NaN;
    i = SON_Y.lastIndex;
    return Number(m[0]);
  };
  const bayroq = () => { otkaz(); const c = d[i]; if (c !== '0' && c !== '1') return NaN; i++; return Number(c); };
  for (let qadam = 0; qadam < 20000; qadam++) {
    otkaz();
    if (i >= d.length) return nuqtalar.length ? { nuqtalar, yopiq, boshlar } : null;
    if (/[A-Za-z]/.test(d[i])) buyruq = d[i++];
    else if (!buyruq || buyruq.toUpperCase() === 'Z') return null;
    const katta = buyruq.toUpperCase();
    const nisbiy = buyruq !== katta;
    if (YOL_SONI[katta] === undefined || (!nuqtalar.length && katta !== 'M')) return null;
    if (katta === 'Z') { nuqtalar.push(bosh); joriy = bosh; yopiq = true; nazorat = null; continue; }
    const a = [];
    for (let k = 0; k < YOL_SONI[katta]; k++) a.push(katta === 'A' && (k === 3 || k === 4) ? bayroq() : son());
    if (a.some(x => !sonYaroqli(x))) return null;
    const [ox, oy] = nisbiy ? joriy : [0, 0];
    let keyingi;
    if (katta === 'M' || katta === 'L' || katta === 'T') keyingi = [a[0] + ox, a[1] + oy];
    else if (katta === 'H') keyingi = [a[0] + ox, joriy[1]];
    else if (katta === 'V') keyingi = [joriy[0], a[0] + oy];
    else keyingi = [a[a.length - 2] + ox, a[a.length - 1] + oy];
    if (katta === 'C' || katta === 'S') {
      const n1 = katta === 'C' ? [a[0] + ox, a[1] + oy] : nazorat?.kub ? [2 * joriy[0] - nazorat.x, 2 * joriy[1] - nazorat.y] : joriy;
      const n2 = katta === 'C' ? [a[2] + ox, a[3] + oy] : [a[0] + ox, a[1] + oy];
      for (let t = 1; t < 8; t++) {
        const u = t / 8;
        const v = 1 - u;
        nuqtalar.push([0, 1].map(o => v * v * v * joriy[o] + 3 * v * v * u * n1[o] + 3 * v * u * u * n2[o] + u * u * u * keyingi[o]));
      }
      nazorat = { kub: true, x: n2[0], y: n2[1] };
    } else if (katta === 'Q' || katta === 'T') {
      const n1 = katta === 'Q' ? [a[0] + ox, a[1] + oy] : nazorat && !nazorat.kub ? [2 * joriy[0] - nazorat.x, 2 * joriy[1] - nazorat.y] : joriy;
      for (let t = 1; t < 6; t++) {
        const u = t / 6;
        const v = 1 - u;
        nuqtalar.push([0, 1].map(o => v * v * joriy[o] + 2 * v * u * n1[o] + u * u * keyingi[o]));
      }
      nazorat = { kub: false, x: n1[0], y: n1[1] };
    } else {
      if (katta === 'A') nuqtalar.push(...yoyNuqtalari(joriy[0], joriy[1], a[0], a[1], a[2], a[3], a[4], keyingi[0], keyingi[1]).slice(0, -1));
      nazorat = null;
    }
    if (katta === 'M') { bosh = keyingi; buyruq = nisbiy ? 'l' : 'L'; boshlar.add(nuqtalar.length); }
    nuqtalar.push(keyingi);
    joriy = keyingi;
  }
  return null;
}

/** Bir belgining taxminiy eni (shrift o'lchamiga nisbatan) — Arial. */
function belgiEni(b) {
  if (b === ' ') return 0.28;
  if (/[iljtfI.,:;'|!()[\]]/.test(b)) return 0.3;
  if (/[mwMW@%]/.test(b)) return 0.86;
  if (/[A-ZА-ЯЎҚҒҲ]/.test(b)) return 0.68;
  return 0.56;
}

/** Yozuv bo'yog'i: oq (qora shakl ustida) yoki chopda aniq ko'rinadigan to'q rang. */
function yozuvRangi(v) {
  if (!/^#[0-9a-f]{6}$/.test(v)) return '#000000';
  const daraja = parseInt(v.slice(1, 3), 16);
  return daraja >= 238 ? '#ffffff' : daraja > 153 ? '#000000' : v;
}

export const birlashtir = (a, b) => (!a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
export const kesishma = (a, b) => { const q = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]; return q[0] < q[2] && q[1] < q[3] ? q : null; };
/** Kesmaning to'rtburchak ichidagi bo'lagi (Liang–Barsky); tashqarida bo'lsa — null. */
export function kesmaBolagi(q, [x1, y1], [x2, y2]) {
  let [t0, t1] = [0, 1];
  const [dx, dy] = [x2 - x1, y2 - y1];
  for (const [p, r] of [[-dx, x1 - q[0]], [dx, q[2] - x1], [-dy, y1 - q[1]], [dy, q[3] - y1]]) {
    if (p === 0) { if (r < 0) return null; continue; }
    const t = r / p;
    if (p < 0) { if (t > t1) return null; t0 = Math.max(t0, t); } else { if (t < t0) return null; t1 = Math.min(t1, t); }
  }
  return [[x1 + t0 * dx, y1 + t0 * dy], [x1 + t1 * dx, y1 + t1 * dy]];
}

const qutisi = (nuqtalar) => nuqtalar.reduce((q, [x, y]) => [Math.min(q[0], x), Math.min(q[1], y), Math.max(q[2], x), Math.max(q[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
export const yuza = (q) => (q[2] - q[0]) * (q[3] - q[1]);

function shriftOlchami(qiymat, ota) {
  if (!qiymat) return ota;
  const son = parseFloat(qiymat);
  if (!(son > 0)) return ota;
  if (/%$/.test(qiymat)) return (ota * son) / 100;
  if (/e[mx]$/i.test(qiymat)) return ota * son;
  return /pt$/i.test(qiymat) ? son * 1.333 : /mm$/i.test(qiymat) ? son * 3.78 : /cm$/i.test(qiymat) ? son * 37.8 : /in$/i.test(qiymat) ? son * 96 : son;
}

/** Shaklning o'z koordinatalaridagi nuqtalari. `asos` — foiz uchun viewBox o'lchami. */
function shaklNuqtalari(t, asos) {
  const a = (nom, olcham) => { const v = t.atr.get(nom); if (v === undefined) return 0; const son = parseFloat(v); return /%$/.test(v) ? (son / 100) * olcham : son; };
  if (t.teg === 'line') return { nuqtalar: [[a('x1', asos[0]), a('y1', asos[1])], [a('x2', asos[0]), a('y2', asos[1])]], yopiq: false };
  if (t.teg === 'rect') {
    const [x, y, w, h] = [a('x', asos[0]), a('y', asos[1]), a('width', asos[0]), a('height', asos[1])];
    return w > 0 && h > 0 ? { nuqtalar: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], yopiq: true } : null;
  }
  if (t.teg === 'circle' || t.teg === 'ellipse') {
    const [cx, cy] = [a('cx', asos[0]), a('cy', asos[1])];
    const rx = t.teg === 'circle' ? a('r', asos[0]) : a('rx', asos[0]);
    const ry = t.teg === 'circle' ? rx : a('ry', asos[1]);
    if (!(rx > 0 && ry > 0)) return null;
    return { nuqtalar: Array.from({ length: 16 }, (_, i) => [cx + rx * Math.cos((i * Math.PI) / 8), cy + ry * Math.sin((i * Math.PI) / 8)]), yopiq: true };
  }
  if (t.teg === 'polyline' || t.teg === 'polygon') {
    const s = (t.atr.get('points') || '').split(' ').map(Number);
    const nuqtalar = [];
    for (let i = 0; i + 1 < s.length; i += 2) nuqtalar.push([s[i], s[i + 1]]);
    return nuqtalar.length > 1 ? { nuqtalar, yopiq: t.teg === 'polygon' } : null;
  }
  return yolNuqtalari(t.atr.get('d') || '');
}

/** <text> ning yozuv bo'laklari: har biri — matn va ildiz koordinatalaridagi quti. */
function yozuvBolaklari(matnEl, k) {
  const bolaklar = [];
  let joriy = null;
  const birinchi = (el, nom) => { const v = el.atr.get(nom); return v === undefined ? null : v.split(' ')[0]; };
  const uz = (v, fs) => (v === null ? 0 : /e[mx]$/i.test(v) ? parseFloat(v) * fs : parseFloat(v) || 0);
  const boshla = (x, y, u) => { joriy = { x, y, eni: 0, fs: u.fs, matn: '', lagar: u.lagar, asos: u.asos }; bolaklar.push(joriy); };
  const kez = (el, u0) => {
    // <text> ning o'z xossalari kontekstda bor — ikki marta qo'llanmaydi.
    const u = el === matnEl ? u0 : {
      fs: shriftOlchami(el.atr.get('font-size'), u0.fs),
      lagar: el.atr.get('text-anchor') || u0.lagar,
      asos: el.atr.get('dominant-baseline') || el.atr.get('alignment-baseline') || u0.asos,
    };
    const [x, y] = [birinchi(el, 'x'), birinchi(el, 'y')];
    if (el === matnEl || x !== null || y !== null) {
      boshla((x !== null ? uz(x, u.fs) : joriy ? joriy.x : 0) + uz(birinchi(el, 'dx'), u.fs), (y !== null ? uz(y, u.fs) : joriy ? joriy.y : 0) + uz(birinchi(el, 'dy'), u.fs), u);
    }
    for (const b of el.bolalar) {
      if (typeof b !== 'string') { kez(b, u); continue; }
      for (const belgi of b) joriy.eni += belgiEni(belgi) * u.fs;
      joriy.matn += b;
      joriy.fs = Math.max(joriy.fs, u.fs);
    }
  };
  kez(matnEl, k);
  return bolaklar.filter(b => b.matn.trim()).map((b) => {
    const eni = b.eni * 1.08;   // taxmin — biroz zaxira bilan
    const x0 = b.lagar === 'middle' ? b.x - eni / 2 : b.lagar === 'end' ? b.x - eni : b.x;
    const tepa = /middle|central/.test(b.asos || '') ? b.y - b.fs * 0.5 : /hanging|before-edge/.test(b.asos || '') ? b.y : b.y - b.fs * 0.8;
    const burchaklar = [[x0, tepa], [x0 + eni, tepa], [x0 + eni, tepa + b.fs], [x0, tepa + b.fs]].map(p => nuqta(k.m, p));
    return { matn: b.matn.trim(), quti: qutisi(burchaklar), fs: b.fs * miqyos(k.m), egasi: matnEl };
  });
}

/**
 * Chizmani o'lchaydi va yo'l-yo'lakay tuzatadi (unutilgan fill, yozuv rangi va gardishi).
 * `vb0` — model bergan viewBox (bo'lmasa null).
 */
export function olcha(ildiz, vb0, idlar) {
  const g = { quti: null, yozuvlar: [], chiziqlar: [], kesmalar: [], shakllar: 0, qoraShakllar: [], fon: new Set(), noaniq: false, yaroqsiz: 0 };
  const asos = vb0 ? [vb0[2], vb0[3]] : [300, 300];
  const qosh = (q, k) => { const kesilgan = k.qirqim ? kesishma(q, k.qirqim) : q; if (kesilgan) g.quti = birlashtir(g.quti, kesilgan); };
  const kez = (t, k0) => {
    if (ZAXIRA_IDISH.has(t.teg) || t.teg === 'title' || t.teg === 'desc') return;
    const tr = t.atr.get('transform');
    const k = {
      m: tr ? kopaytir(k0.m, matritsa(tr)) : k0.m,
      fs: shriftOlchami(t.atr.get('font-size'), k0.fs),
      lagar: t.atr.get('text-anchor') || k0.lagar,
      asos: t.atr.get('dominant-baseline') || k0.asos,
      fill: t.atr.get('fill') ?? k0.fill,
      stroke: t.atr.get('stroke') ?? k0.stroke,
      sw: t.atr.has('stroke-width') ? parseFloat(t.atr.get('stroke-width')) || 0 : k0.sw,
      dash: t.atr.get('stroke-dasharray') ?? k0.dash,
      qirqim: k0.qirqim,
    };
    if (tr && /skew/.test(tr)) g.noaniq = true;
    const qirqimId = HAVOLA.exec(t.atr.get('clip-path') || '')?.[1];
    if (qirqimId) {
      const qirqimEl = idlar.get(qirqimId);
      const nuqtalar = [];
      if (qirqimEl?.atr.get('clipPathUnits') === 'objectBoundingBox') g.noaniq = true;
      else for (const b of qirqimEl?.bolalar || []) {
        if (typeof b === 'string' || !SHAKLLAR.has(b.teg)) continue;
        const m = b.atr.get('transform') ? kopaytir(k.m, matritsa(b.atr.get('transform'))) : k.m;
        nuqtalar.push(...(shaklNuqtalari(b, asos)?.nuqtalar || []).map(p => nuqta(m, p)));
      }
      if (nuqtalar.length) { const q = qutisi(nuqtalar); k.qirqim = k.qirqim ? kesishma(k.qirqim, q) || [0, 0, 0, 0] : q; }
    }
    if (t.teg === 'text') {
      // Guruhdan meros qolgan fill="none" / stroke yozuvni ichi bo'sh konturga aylantiradi.
      const ozFill = t.atr.get('fill');
      const fill = yozuvRangi(ozFill && ozFill !== 'none' ? ozFill : k0.fill && k0.fill !== 'none' ? k0.fill : '#000000');
      t.atr.set('fill', fill);
      yur(t, (x) => {
        if (x === t) return;
        if (x.atr.has('fill')) x.atr.set('fill', yozuvRangi(x.atr.get('fill')));
        x.atr.delete('stroke');
      });
      if (fill === '#ffffff') { t.atr.set('stroke', 'none'); } else {
        // Oq gardish: yozuv chiziq ustiga tushsa ham o'qiladi (chopda qog'oz rangida — ko'rinmaydi).
        t.atr.set('stroke', '#ffffff');
        t.atr.set('stroke-width', String(yaxlit(k.fs * 0.2)));
        t.atr.set('stroke-linejoin', 'round');
        t.atr.set('paint-order', 'stroke');
      }
      t.atr.set('stroke-dasharray', 'none');
      for (const b of yozuvBolaklari(t, k)) {
        if (!b.quti.every(sonYaroqli)) continue;
        g.yozuvlar.push(b);
        qosh(b.quti, k);
      }
      return;
    }
    if (!SHAKLLAR.has(t.teg)) { for (const b of t.bolalar) if (typeof b !== 'string') kez(b, k); return; }
    const sh = shaklNuqtalari(t, asos);
    if (!sh) { g.fon.add(t); if (t.teg === 'path') g.yaroqsiz++; return; }   // chizilmaydigan (o'lchamsiz yoki buzuq) shakl
    const q0 = qutisi(sh.nuqtalar.map(p => nuqta(k.m, p)));
    if (!q0.every(sonYaroqli)) { g.fon.add(t); return; }
    const chiziqli = !!k.stroke && k.stroke !== 'none' && k.sw > 0;
    // Butun maydonni qoplagan BO'YALGAN to'rtburchak — fon: kerak emas (konturli ramka qoladi — jadval bo'lishi mumkin).
    if (t.teg === 'rect' && k.fill !== 'none' && vb0 && q0[2] - q0[0] >= vb0[2] * 0.97 && q0[3] - q0[1] >= vb0[3] * 0.97) { g.fon.add(t); return; }
    // Ko'rinmaydigan shakl (bo'yoqsiz va chiziqsiz) maydonni behuda kengaytiradi.
    if (!chiziqli && (k.fill === 'none' || t.teg === 'line')) { g.fon.add(t); return; }
    if (k.fill === undefined) {
      // fill ko'rsatilmagan — SVG da bu QORA bo'yoq. Konturli shaklda model uni unutgan.
      if (chiziqli) t.atr.set('fill', 'none');
      else g.qoraShakllar.push(yuza(q0));
    }
    g.shakllar++;
    // Chiziq qalinligi va strelka uchi uchun joy — umumiy hoshiyada (svgniTozala): quti qalinlikka bog'liq emas.
    qosh(q0, k);
    // Har uchiga strelka qo'yiladigan (marker-mid) ko'p nuqtali chiziq brauzerni qotiradi.
    if (sh.nuqtalar.length > 200) t.atr.delete('marker-mid');
    if (!chiziqli) return;
    const ildizda = sh.nuqtalar.map(p => nuqta(k.m, p));
    let uzunlik = 0;
    for (let i = 1; i < ildizda.length; i++) uzunlik += Math.hypot(ildizda[i][0] - ildizda[i - 1][0], ildizda[i][1] - ildizda[i - 1][1]);
    g.chiziqlar.push({ t, sw: k.sw, miqyos: miqyos(k.m), dash: k.dash, uzunlik, qotgan: t.atr.get('vector-effect') === 'non-scaling-stroke' });
    // Ko'rinadigan chiziq bo'laklari — yozuv ustidan o'tganini topish uchun.
    if (k.stroke === '#ffffff' || g.kesmalar.length > 20000) return;
    // Yo'lda (path) yopuvchi nuqta ro'yxatning o'zida; boshqa yopiq shakllarda oxirgi nuqta birinchisiga ulanadi.
    for (let i = sh.yopiq && t.teg !== 'path' ? 0 : 1; i < ildizda.length; i++) {
      if (sh.boshlar?.has(i)) continue;
      const [a, b] = [ildizda[(i || ildizda.length) - 1], ildizda[i]];
      const bolak = k.qirqim ? kesmaBolagi(k.qirqim, a, b) : [a, b];
      if (bolak) g.kesmalar.push(bolak);
    }
  };
  kez(ildiz, { m: BIRLIK, fs: 16, lagar: 'start', asos: '', fill: undefined, stroke: undefined, sw: 1, dash: undefined, qirqim: null });
  return g;
}

/** Ekran va qog'ozdagi o'lcham (CSS px): yozuvlar kitobcha matni bilan bir xil kattalikda chiqsin. */
export function korinishOlchami(vb, shriftlar) {
  const tartib = [...shriftlar].sort((a, b) => a - b);
  const median = tartib.length ? tartib[Math.floor(tartib.length / 2)] : 0;
  let k = median > 0 ? 13.5 / median : 300 / Math.max(vb[2], vb[3]);
  k = Math.max(k, 110 / Math.max(vb[2], vb[3]));
  k = Math.min(k, 480 / vb[2], 400 / vb[3]);
  return { k, eni: Math.max(1, Math.round(vb[2] * k)), boyi: Math.max(1, Math.round(vb[3] * k)) };
}
