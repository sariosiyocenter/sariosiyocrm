import { CFB } from 'xlsx';
import { rasmTayyorla } from './aiUmumiy';

/**
 * Word (.docx) → AI ga beriladigan matn qismlari (egasi, 2026-09-30: "word tashab
 * bo'lmayapdiku"). Brauzerda o'qiladi: paragraf va jadvallar, Word'ning avto-raqamlari
 * (1., A) ...), Word formulalari (OMML) → LaTeX $...$, rasmlar. Qalin, tagi chizilgan va
 * rangli/ajratilgan yozuvlar belgilanadi — to'g'ri javob ko'pincha shunday ko'rsatiladi.
 * Eski formulalar (MathType, Equation 3.0 — ichida WMF rasm) brauzerda o'qilmaydi:
 * soni qaytadi, oyna faylni PDF qilib yuklashni maslahat beradi.
 */

export interface WordQism { matn: string; rasmlar: string[] }
export interface WordNatija {
  qismlar: WordQism[];
  /** AI ga boradigan rasmlar soni. */
  rasmSoni: number;
  /** Word formulalari (LaTeX ga o'girildi). */
  formulaSoni: number;
  /** O'qib bo'lmagan formula va rasmlar (MathType, WMF/EMF). */
  oqilmagan: number;
  /** Chegaradan oshgani uchun tashlangan rasmlar. */
  tashlangan: number;
}

export const ESKI_DOC = "eski Word formati (.doc) o'qilmaydi — Word'da «Fayl → Saqlash» orqali .docx yoki PDF qilib saqlang";

// Bitta so'rovga: matn (javob hajmi va vaqt chegarasi) va rasmlar (Vercel 4,5 MB).
// Yumshoq chegarada keyingi savol boshida bo'linadi, qattiqda — istalgan paragrafda.
const MATN_YUMSHOQ = 8000;
const MATN_QATTIQ = 12000;
const RASM_YUMSHOQ = 3;
const RASM_QATTIQ = 6;
const MAKS_RASM = 40;
const OQILADIGAN_RASM = /\.(png|jpe?g|gif|bmp|webp)$/i;

const IZOH = "[Word hujjatidan olingan matn. Formulalar LaTeX da ($...$). Asl formatlash: **qalin**, __tagi chizilgan__, ==rangli yoki ajratilgan== — to'g'ri javob shunday belgilangan bo'lishi mumkin; bu belgilarni savol matniga ko'chirmang. [rasm N] — ilova qilingan N-rasm; «o'qilmadi» deganlari faylda bor, lekin o'qib bo'lmadi.]";

// --- XML yordamchilari (nomlar maydoni prefiksiga bog'lanmaydi) ---------------

type Oila = 'w' | 'm' | 'mc' | '';
function oila(el: Element): Oila {
  const ns = el.namespaceURI || '';
  if (ns.includes('wordprocessingml')) return 'w';
  if (ns.includes('/math')) return 'm';
  if (ns.includes('markup-compatibility')) return 'mc';
  return '';
}
const W = (el: Element, nom: string) => el.localName === nom && oila(el) === 'w';
const M = (el: Element, nom: string) => el.localName === nom && oila(el) === 'm';
const bolalar = (el: Element) => Array.from(el.children);
const wBola = (el: Element | null | undefined, nom: string) => (el ? bolalar(el).find(c => W(c, nom)) || null : null);
const mBola = (el: Element | null | undefined, nom: string) => (el ? bolalar(el).find(c => M(c, nom)) || null : null);
function atr(el: Element | null | undefined, nom: string): string | null {
  if (!el) return null;
  for (const a of Array.from(el.attributes)) if (a.localName === nom) return a.value;
  return null;
}
const rId = (el: Element, nom: string) => {
  for (const a of Array.from(el.attributes)) if (a.localName === nom && (a.namespaceURI || '').includes('relationships')) return a.value;
  return null;
};
/** mc:AlternateContent — birinchi tanlov (Fallback takror bo'lmasin). */
const tanlov = (el: Element) => bolalar(el).find(c => c.localName === 'Choice') || bolalar(el).find(c => c.localName === 'Fallback') || null;

function xml(fayllar: Map<string, Uint8Array>, yol: string): Document | null {
  const b = fayllar.get(yol.toLowerCase());
  if (!b) return null;
  const d = new DOMParser().parseFromString(new TextDecoder().decode(b), 'application/xml');
  return d.getElementsByTagName('parsererror').length ? null : d;
}

// --- Word formulasi (OMML) → LaTeX ---------------------------------------------

const BELGI: Record<string, string> = {
  '×': '\\times ', '·': '\\cdot ', '⋅': '\\cdot ', '∙': '\\cdot ', '÷': '\\div ', '−': '-', '–': '-', '±': '\\pm ', '∓': '\\mp ',
  '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ', '≈': '\\approx ', '≡': '\\equiv ', '∼': '\\sim ', '∞': '\\infty ', '°': '^\\circ ',
  '∠': '\\angle ', '△': '\\triangle ', '⊥': '\\perp ', '∥': '\\parallel ', '∈': '\\in ', '∉': '\\notin ', '⊂': '\\subset ',
  '⊆': '\\subseteq ', '∪': '\\cup ', '∩': '\\cap ', '∅': '\\varnothing ', '→': '\\to ', '←': '\\leftarrow ', '⇒': '\\Rightarrow ',
  '⇔': '\\Leftrightarrow ', '∀': '\\forall ', '∃': '\\exists ', '√': '\\surd ', '∑': '\\sum ', '∏': '\\prod ', '∫': '\\int ',
  '′': "'", '″': "''", '…': '\\ldots ', '⋯': '\\cdots ', '∗': '*', '∣': '|', '∂': '\\partial ', '∇': '\\nabla ',
  'ℝ': '\\mathbb{R}', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℂ': '\\mathbb{C}',
  'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ', 'ε': '\\varepsilon ', 'ζ': '\\zeta ', 'η': '\\eta ',
  'θ': '\\theta ', 'ι': '\\iota ', 'κ': '\\kappa ', 'λ': '\\lambda ', 'μ': '\\mu ', 'ν': '\\nu ', 'ξ': '\\xi ', 'π': '\\pi ',
  'ρ': '\\rho ', 'σ': '\\sigma ', 'τ': '\\tau ', 'υ': '\\upsilon ', 'φ': '\\varphi ', 'ϕ': '\\phi ', 'χ': '\\chi ', 'ψ': '\\psi ',
  'ω': '\\omega ', 'Γ': '\\Gamma ', 'Δ': '\\Delta ', '∆': '\\Delta ', 'Θ': '\\Theta ', 'Λ': '\\Lambda ', 'Ξ': '\\Xi ',
  'Π': '\\Pi ', 'Σ': '\\Sigma ', 'Φ': '\\Phi ', 'Ψ': '\\Psi ', 'Ω': '\\Omega ',
};
const KATTA_AMAL: Record<string, string> = {
  '∑': '\\sum', '∏': '\\prod', '∐': '\\coprod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint',
  '⋃': '\\bigcup', '⋂': '\\bigcap', '⋁': '\\bigvee', '⋀': '\\bigwedge',
};
const QAVS: Record<string, string> = {
  '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|', '⟨': '\\langle', '⟩': '\\rangle',
  '〈': '\\langle', '〉': '\\rangle', '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil', '': '.',
};
const URGU: Record<string, string> = {
  '̂': '\\hat', '^': '\\hat', '̄': '\\bar', '̅': '\\bar', '¯': '\\bar', '⃗': '\\vec', '→': '\\vec',
  '̇': '\\dot', '˙': '\\dot', '̈': '\\ddot', '̃': '\\tilde', '~': '\\tilde', '̌': '\\check',
  '́': '\\acute', '̀': '\\grave',
};
const FUNKSIYA: Record<string, string> = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', sec: '\\sec', csc: '\\csc', log: '\\log', ln: '\\ln', lg: '\\lg',
  lim: '\\lim', max: '\\max', min: '\\min', exp: '\\exp', arcsin: '\\arcsin', arccos: '\\arccos', arctan: '\\arctan',
  sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', tg: '\\operatorname{tg}', ctg: '\\operatorname{ctg}',
  arctg: '\\operatorname{arctg}', arcctg: '\\operatorname{arcctg}',
};

function mathMatn(s: string, oddiy: boolean): string {
  if (oddiy && /\p{L}{2,}/u.test(s)) return `\\text{${s.replace(/[{}\\]/g, '')}}`;
  let out = '';
  for (const ch of s) {
    if ('{}%#$&_'.includes(ch)) out += '\\' + ch;
    else if (ch === '\\') out += '\\backslash ';
    else if (ch === '~') out += '\\sim ';
    else out += BELGI[ch] ?? ch;
  }
  return out;
}

const pr = (el: Element, xususiyat: string, nom: string) => atr(mBola(mBola(el, xususiyat), nom), 'val');

function omml(el: Element): string {
  const ich = (e: Element | null) => (e ? bolalar(e).map(omml).join('') : '');
  const q = (nom: string) => ich(mBola(el, nom));
  switch (oila(el) === 'm' ? el.localName : '') {
    case 'r': {
      const rPr = mBola(el, 'rPr');
      const oddiy = !!mBola(rPr, 'nor') || atr(mBola(rPr, 'sty'), 'val') === 'p';
      const t = bolalar(el).filter(c => c.localName === 't').map(c => c.textContent || '').join('');
      return mathMatn(t, oddiy);
    }
    case 'f': {
      const tur = pr(el, 'fPr', 'type');
      if (tur === 'lin' || tur === 'skw') return `{${q('num')}}/{${q('den')}}`;
      if (tur === 'noBar') return `\\genfrac{}{}{0pt}{}{${q('num')}}{${q('den')}}`;
      return `\\frac{${q('num')}}{${q('den')}}`;
    }
    case 'sSup': return `{${q('e')}}^{${q('sup')}}`;
    case 'sSub': return `{${q('e')}}_{${q('sub')}}`;
    case 'sSubSup': return `{${q('e')}}_{${q('sub')}}^{${q('sup')}}`;
    case 'sPre': return `{}_{${q('sub')}}^{${q('sup')}}{${q('e')}}`;
    case 'rad': {
      const d = q('deg').trim();
      return d && pr(el, 'radPr', 'degHide') !== '1' && pr(el, 'radPr', 'degHide') !== 'on' ? `\\sqrt[${d}]{${q('e')}}` : `\\sqrt{${q('e')}}`;
    }
    case 'd': {
      const dPr = mBola(el, 'dPr');
      const boshi = atr(mBola(dPr, 'begChr'), 'val');
      const oxiri = atr(mBola(dPr, 'endChr'), 'val');
      const ajrat = atr(mBola(dPr, 'sepChr'), 'val') ?? '|';
      const L = QAVS[boshi ?? '('] ?? '.';
      const R = QAVS[oxiri ?? ')'] ?? '.';
      const qismlar = bolalar(el).filter(c => M(c, 'e')).map(c => ich(c));
      return `\\left${L} ${qismlar.join(` ${QAVS[ajrat] ?? ajrat} `)} \\right${R}`;
    }
    case 'nary': {
      const belgi = pr(el, 'naryPr', 'chr') ?? '∫';
      const amal = KATTA_AMAL[belgi] ?? '\\int';
      const pastki = pr(el, 'naryPr', 'subHide') === '1' ? '' : q('sub').trim();
      const yuqori = pr(el, 'naryPr', 'supHide') === '1' ? '' : q('sup').trim();
      return `${amal}${pastki ? `_{${pastki}}` : ''}${yuqori ? `^{${yuqori}}` : ''} {${q('e')}}`;
    }
    case 'func': {
      const nom = q('fName').trim();
      const f = nom.replace(/^\\text\{([^}]*)\}/, '$1').replace(/^([a-z]+)/, (m) => FUNKSIYA[m] ?? `\\operatorname{${m}}`);
      return `${f} {${q('e')}}`;
    }
    case 'limLow': {
      const asos = q('e').trim();
      const nom = asos.replace(/^\\text\{([^}]*)\}$/, '$1');
      return `${FUNKSIYA[nom] ?? `{${asos}}`}_{${q('lim')}}`;
    }
    case 'limUpp': return `\\overset{${q('lim')}}{${q('e')}}`;
    case 'acc': return `${URGU[pr(el, 'accPr', 'chr') ?? '̂'] ?? '\\hat'}{${q('e')}}`;
    case 'bar': return pr(el, 'barPr', 'pos') === 'top' ? `\\overline{${q('e')}}` : `\\underline{${q('e')}}`;
    case 'groupChr': {
      const belgi = pr(el, 'groupChrPr', 'chr') ?? '⏟';
      return belgi === '⏞' ? `\\overbrace{${q('e')}}` : belgi === '⏟' ? `\\underbrace{${q('e')}}` : q('e');
    }
    case 'eqArr':
      return `\\begin{array}{l} ${bolalar(el).filter(c => M(c, 'e')).map(c => ich(c).replace(/\\&/g, '')).join(' \\\\ ')} \\end{array}`;
    case 'm':
      return `\\begin{matrix} ${bolalar(el).filter(c => M(c, 'mr')).map(r => bolalar(r).filter(c => M(c, 'e')).map(c => ich(c)).join(' & ')).join(' \\\\ ')} \\end{matrix}`;
    case 'box': case 'borderBox': case 'phant': return q('e');
    case 'oMathPara': return bolalar(el).filter(c => M(c, 'oMath')).map(omml).join(' \\\\ ');
    default:
      // Xususiyatlar (fPr, dPr, rPr, ctrlPr...) — matn emas.
      if (/Pr$/.test(el.localName)) return '';
      return ich(el);
  }
}

// --- Raqamlash (Word avto-raqamlari: 1., 2. / A), B)) ----------------------------

interface Daraja { start: number; fmt: string; matn: string }
interface Raqamlash {
  darajalar: Map<string, Daraja[]>;                     // abstractNumId → darajalar
  nums: Map<string, { abs: string; qayta: Map<number, number> }>;
  uslublar: Map<string, { numId?: string; ilvl?: number; asos?: string }>;
}

function raqamlashniOqi(fayllar: Map<string, Uint8Array>): Raqamlash {
  const r: Raqamlash = { darajalar: new Map(), nums: new Map(), uslublar: new Map() };
  const n = xml(fayllar, 'word/numbering.xml');
  if (n) {
    for (const a of Array.from(n.getElementsByTagNameNS('*', 'abstractNum'))) {
      const d: Daraja[] = [];
      for (const l of bolalar(a).filter(c => W(c, 'lvl'))) {
        d[Number(atr(l, 'ilvl')) || 0] = {
          start: Number(atr(wBola(l, 'start'), 'val') ?? 1),
          fmt: atr(wBola(l, 'numFmt'), 'val') || 'decimal',
          matn: atr(wBola(l, 'lvlText'), 'val') ?? '',
        };
      }
      r.darajalar.set(atr(a, 'abstractNumId') || '', d);
    }
    for (const num of Array.from(n.getElementsByTagNameNS('*', 'num'))) {
      if (!W(num, 'num')) continue;
      const qayta = new Map<number, number>();
      for (const o of bolalar(num).filter(c => W(c, 'lvlOverride'))) {
        const s = atr(wBola(o, 'startOverride'), 'val');
        if (s !== null) qayta.set(Number(atr(o, 'ilvl')) || 0, Number(s));
      }
      r.nums.set(atr(num, 'numId') || '', { abs: atr(wBola(num, 'abstractNumId'), 'val') || '', qayta });
    }
  }
  const s = xml(fayllar, 'word/styles.xml');
  if (s) {
    for (const st of Array.from(s.getElementsByTagNameNS('*', 'style'))) {
      if (!W(st, 'style')) continue;
      const numPr = wBola(wBola(st, 'pPr'), 'numPr');
      const ilvl = atr(wBola(numPr, 'ilvl'), 'val');
      r.uslublar.set(atr(st, 'styleId') || '', {
        numId: atr(wBola(numPr, 'numId'), 'val') ?? undefined,
        ilvl: ilvl !== null ? Number(ilvl) : undefined,
        asos: atr(wBola(st, 'basedOn'), 'val') ?? undefined,
      });
    }
  }
  return r;
}

const RUS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ';
function rim(n: number): string {
  const q: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, h] of q) while (n >= v) { s += h; n -= v; }
  return s;
}
function sonMatni(n: number, fmt: string): string {
  const harf = (abc: string) => abc[(n - 1) % abc.length].repeat(Math.floor((n - 1) / abc.length) + 1);
  switch (fmt) {
    case 'upperLetter': return harf('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    case 'lowerLetter': return harf('abcdefghijklmnopqrstuvwxyz');
    case 'russianUpper': return harf(RUS);
    case 'russianLower': return harf(RUS.toLowerCase());
    case 'upperRoman': return rim(n);
    case 'lowerRoman': return rim(n).toLowerCase();
    case 'decimalZero': return String(n).padStart(2, '0');
    case 'none': return '';
    default: return String(n);
  }
}

function raqamlagich(r: Raqamlash) {
  const hisob = new Map<string, (number | undefined)[]>();
  const qaytaQoyildi = new Set<string>();
  const uslubdan = (id: string | null) => {
    for (let i = 0, u = id ? r.uslublar.get(id) : undefined; u && i < 6; i++, u = u.asos ? r.uslublar.get(u.asos) : undefined) {
      if (u.numId !== undefined) return { numId: u.numId, ilvl: u.ilvl };
    }
    return null;
  };
  return (pPr: Element | null): string => {
    const numPr = wBola(pPr, 'numPr');
    const uslub = uslubdan(atr(wBola(pPr, 'pStyle'), 'val'));
    const numId = atr(wBola(numPr, 'numId'), 'val') ?? uslub?.numId;
    if (!numId || numId === '0') return '';
    const ilvl = Number(atr(wBola(numPr, 'ilvl'), 'val') ?? uslub?.ilvl ?? 0) || 0;
    const num = r.nums.get(numId);
    const darajalar = num ? r.darajalar.get(num.abs) : undefined;
    const d = darajalar?.[ilvl];
    if (!num || !darajalar || !d) return '';
    const h = hisob.get(num.abs) || [];
    const kalit = `${numId}:${ilvl}`;
    if (num.qayta.has(ilvl) && !qaytaQoyildi.has(kalit)) { h[ilvl] = num.qayta.get(ilvl)!; qaytaQoyildi.add(kalit); }
    else h[ilvl] = h[ilvl] === undefined ? d.start : h[ilvl]! + 1;
    for (let k = ilvl + 1; k < h.length; k++) h[k] = undefined;
    hisob.set(num.abs, h);
    if (d.fmt === 'bullet') return '• ';
    const yorliq = d.matn.replace(/%(\d)/g, (_, x) => {
      const i = Number(x) - 1;
      return sonMatni(h[i] ?? darajalar[i]?.start ?? 1, darajalar[i]?.fmt || 'decimal');
    }).trim();
    return yorliq ? `${yorliq} ` : '';
  };
}

// --- Hujjat ----------------------------------------------------------------------

// b — qalin, u — tagi chizilgan, h — sariq/fon bilan ajratilgan, r — shrift rangi.
type Bolak = { t: string; b: boolean; u: boolean; h: boolean; r: boolean } | { raw: string };
interface Paragraf { bolaklar: Bolak[]; rasmlar: number[] }

// Symbol shriftidagi belgilar (w:sym): eski hujjatlarda × ≤ ≥ ...
const SYMBOL: Record<string, string> = {
  F0B4: '×', F0B1: '±', F0A3: '≤', F0B3: '≥', F0B9: '≠', F0BB: '≈', F0D6: '√', F0B0: '°', F0E5: '∑', F070: 'π',
  F061: 'α', F062: 'β', F067: 'γ', F064: 'δ', F044: 'Δ', F0DE: '⇒', F0AE: '→', F0A5: '∞', F0CE: '∈', F0D0: '∠', F0B7: '•',
  F0D7: '·', F02D: '−', F0B8: '÷', F06C: 'λ', F06D: 'μ', F077: 'ω', F057: 'Ω', F06A: 'φ', F0A2: '′',
};

export async function wordniOqi(fayl: File): Promise<WordNatija> {
  const bayt = new Uint8Array(await fayl.arrayBuffer());
  if (bayt[0] === 0xD0 && bayt[1] === 0xCF) throw new Error(ESKI_DOC);
  if (bayt[0] !== 0x50 || bayt[1] !== 0x4B) throw new Error("Word fayli emas yoki buzilgan");
  let zip: any;
  try { zip = CFB.read(bayt, { type: 'array' }); } catch { throw new Error("faylni ochib bo'lmadi — Word'da qayta saqlab ko'ring"); }
  const fayllar = new Map<string, Uint8Array>();
  (zip.FullPaths as string[]).forEach((p, i) => {
    const e = zip.FileIndex[i];
    if (e?.type === 2 && e.content) fayllar.set(p.replace(/^[^/]*\//, '').toLowerCase(), e.content instanceof Uint8Array ? e.content : new Uint8Array(e.content));
  });
  const hujjat = xml(fayllar, 'word/document.xml');
  const body = hujjat?.getElementsByTagNameNS('*', 'body')[0];
  if (!body) throw new Error("Word hujjati o'qilmadi — Word'da qayta saqlab ko'ring");

  // Bog'lanishlar: rasm id → fayl yo'li.
  const boglar = new Map<string, string>();
  const rels = xml(fayllar, 'word/_rels/document.xml.rels');
  for (const r of Array.from(rels?.getElementsByTagNameNS('*', 'Relationship') || [])) {
    if (atr(r, 'TargetMode') === 'External') continue;
    const t = atr(r, 'Target') || '';
    const yol = t.startsWith('/') ? t.slice(1) : `word/${t}`;
    const qismlar: string[] = [];
    for (const s of yol.split('/')) { if (s === '..') qismlar.pop(); else if (s && s !== '.') qismlar.push(s); }
    boglar.set(atr(r, 'Id') || '', qismlar.join('/').toLowerCase());
  }

  const raqam = raqamlagich(raqamlashniOqi(fayllar));
  const rasmYollari: string[] = [];
  let formulaSoni = 0, oqilmagan = 0, tashlangan = 0;

  const rasm = (id: string | null, p: Paragraf): Bolak => {
    const yol = id ? boglar.get(id) : undefined;
    if (!yol || !fayllar.has(yol)) return { raw: '' };
    if (!OQILADIGAN_RASM.test(yol)) { oqilmagan++; return { raw: " [rasm o'qilmadi] " }; }
    if (rasmYollari.length >= MAKS_RASM) { tashlangan++; return { raw: ' [rasm] ' }; }
    p.rasmlar.push(rasmYollari.length);
    rasmYollari.push(yol);
    return { raw: ` \u0000R${rasmYollari.length - 1}\u0000 ` };
  };

  const bloklar = (el: Element, out: Paragraf[]) => {
    for (const c of bolalar(el)) {
      if (W(c, 'p')) paragraf(c, out);
      else if (W(c, 'tbl')) jadval(c, out);
      else if (W(c, 'sdt')) bloklar(wBola(c, 'sdtContent') || c, out);
      else if (c.localName === 'AlternateContent') { const t = tanlov(c); if (t) bloklar(t, out); }
      else if (W(c, 'customXml')) bloklar(c, out);
    }
  };

  // Jadval qatori — bitta paragraf: kataklar « | », katak ichidagi paragraflar « / » bilan.
  const jadval = (tbl: Element, out: Paragraf[]) => {
    for (const tr of bolalar(tbl).filter(c => W(c, 'tr'))) {
      const qator: Paragraf = { bolaklar: [], rasmlar: [] };
      let bor = false;
      for (const [ci, tc] of bolalar(tr).filter(c => W(c, 'tc')).entries()) {
        const ichki: Paragraf[] = [];
        bloklar(tc, ichki);
        const toliq = ichki.filter(p => p.bolaklar.some(b => ('raw' in b ? b.raw : b.t).trim()));
        if (ci) qator.bolaklar.push({ raw: ' | ' });
        toliq.forEach((p, i) => {
          if (i) qator.bolaklar.push({ raw: ' / ' });
          qator.bolaklar.push(...p.bolaklar);
          qator.rasmlar.push(...p.rasmlar);
          bor = true;
        });
      }
      if (bor) out.push(qator);
    }
  };

  const paragraf = (el: Element, out: Paragraf[]) => {
    const p: Paragraf = { bolaklar: [], rasmlar: [] };
    const qoshimcha: Paragraf[] = [];   // matn qutilari — paragrafdan keyin
    const yorliq = raqam(wBola(el, 'pPr'));
    if (yorliq) p.bolaklar.push({ raw: yorliq });
    const matnQutilari = (e: Element) => {
      for (const q of Array.from(e.getElementsByTagNameNS('*', 'txbxContent'))) bloklar(q, qoshimcha);
    };
    const run = (r: Element) => {
      const rPr = wBola(r, 'rPr');
      const yoq = (v: string | null) => v === '0' || v === 'false' || v === 'off';
      const b = !!wBola(rPr, 'b') && !yoq(atr(wBola(rPr, 'b'), 'val'));
      const u = !!wBola(rPr, 'u') && (atr(wBola(rPr, 'u'), 'val') || 'single') !== 'none';
      const hl = atr(wBola(rPr, 'highlight'), 'val');
      const rang = (atr(wBola(rPr, 'color'), 'val') || 'auto').toLowerCase();
      const fon = (atr(wBola(rPr, 'shd'), 'fill') || 'auto').toLowerCase();
      const h = (!!hl && hl !== 'none') || !['auto', 'ffffff', ''].includes(fon);
      const r2 = !['auto', '000000'].includes(rang);
      const matn = (t: string) => p.bolaklar.push({ t, b, u, h, r: r2 });
      const ichki = (e: Element) => {
        for (const c of bolalar(e)) {
          if (W(c, 't')) matn(c.textContent || '');
          else if (W(c, 'tab') || W(c, 'ptab')) matn('\t');
          else if (W(c, 'br') || W(c, 'cr')) matn('\n');
          else if (W(c, 'noBreakHyphen')) matn('-');
          else if (W(c, 'sym')) matn(SYMBOL[(atr(c, 'char') || '').toUpperCase()] || '');
          else if (W(c, 'drawing')) {
            for (const b2 of Array.from(c.getElementsByTagNameNS('*', 'blip'))) p.bolaklar.push(rasm(rId(b2, 'embed'), p));
            matnQutilari(c);
          } else if (W(c, 'pict')) {
            for (const im of Array.from(c.getElementsByTagNameNS('*', 'imagedata'))) p.bolaklar.push(rasm(rId(im, 'id'), p));
            matnQutilari(c);
          } else if (W(c, 'object')) {
            // OLE obyekt: MathType / Equation 3.0 formulasi yoki boshqa ilova.
            const ole = c.getElementsByTagNameNS('*', 'OLEObject')[0];
            const formula = /equation|dsmt|mathtype/i.test(atr(ole, 'ProgID') || '');
            oqilmagan++;
            p.bolaklar.push({ raw: formula ? " [formula o'qilmadi] " : " [rasm o'qilmadi] " });
          } else if (c.localName === 'AlternateContent') { const t = tanlov(c); if (t) ichki(t); }
        }
      };
      ichki(r);
    };
    const inline = (e: Element) => {
      for (const c of bolalar(e)) {
        if (W(c, 'r')) run(c);
        else if (M(c, 'oMath')) { formulaSoni++; p.bolaklar.push({ raw: ` $${omml(c).replace(/\s+/g, ' ').trim()}$ ` }); }
        else if (M(c, 'oMathPara')) { formulaSoni++; p.bolaklar.push({ raw: `\n$$${omml(c).replace(/\s+/g, ' ').trim()}$$\n` }); }
        else if (c.localName === 'AlternateContent') { const t = tanlov(c); if (t) inline(t); }
        else if (W(c, 'pPr') || W(c, 'del') || W(c, 'moveFrom') || W(c, 'rPr')) continue;
        else inline(c);   // hyperlink, ins, smartTag, sdt, fldSimple, customXml...
      }
    };
    inline(el);
    out.push(p, ...qoshimcha);
  };

  const paragraflar: Paragraf[] = [];
  bloklar(body, paragraflar);

  // Butun hujjat qalin (yoki rangli) bo'lsa — belgi hech narsani ajratmaydi, olib tashlanadi.
  let jami = 0; const ulush = { b: 0, u: 0, h: 0, r: 0 };
  for (const p of paragraflar) for (const b of p.bolaklar) {
    if ('raw' in b || !b.t.trim()) continue;
    jami += b.t.length;
    if (b.b) ulush.b += b.t.length;
    if (b.u) ulush.u += b.t.length;
    if (b.h) ulush.h += b.t.length;
    if (b.r) ulush.r += b.t.length;
  }
  const ochir = { b: ulush.b > jami * 0.5, u: ulush.u > jami * 0.5, h: ulush.h > jami * 0.5, r: ulush.r > jami * 0.5 };
  for (const p of paragraflar) {
    p.bolaklar = p.bolaklar.map(b => ('raw' in b ? b : { ...b, b: b.b && !ochir.b, u: b.u && !ochir.u, h: b.h && !ochir.h, r: b.r && !ochir.r }));
  }

  // Qismlarga bo'lish: yumshoq chegarada — keyingi savol boshida, qattiqda — shu yerda.
  const savolBoshi = /^\s*(\d{1,3}|[IVXLC]{1,6})\s*[.)]/;
  const qatorlar = paragraflar.map(p => ({ matn: matnniYig(p.bolaklar).replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').trimEnd(), rasmlar: p.rasmlar }));
  const guruhlar: { matn: string[]; rasmlar: number[]; uzun: number }[] = [];
  let joriy = { matn: [] as string[], rasmlar: [] as number[], uzun: 0 };
  for (const q of qatorlar) {
    const uzun = joriy.uzun + q.matn.length;
    const rasmlar = joriy.rasmlar.length + q.rasmlar.length;
    const yumshoq = uzun > MATN_YUMSHOQ || rasmlar > RASM_YUMSHOQ;
    const qattiq = uzun > MATN_QATTIQ || rasmlar > RASM_QATTIQ;
    if (joriy.matn.length && (qattiq || (yumshoq && savolBoshi.test(q.matn)))) {
      guruhlar.push(joriy);
      joriy = { matn: [], rasmlar: [], uzun: 0 };
    }
    joriy.matn.push(q.matn);
    joriy.rasmlar.push(...q.rasmlar);
    joriy.uzun += q.matn.length + 1;
  }
  if (joriy.matn.some(s => s.trim())) guruhlar.push(joriy);

  const qismlar: WordQism[] = [];
  for (const g of guruhlar) {
    const tartib = new Map(g.rasmlar.map((r, i) => [r, i + 1]));
    const matn = g.matn.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\u0000R(\d+)\u0000/g, (_, i) => `[rasm ${tartib.get(Number(i)) ?? ''}]`).trim();
    if (!matn.replace(/\[rasm \d*\]/g, '').trim() && !g.rasmlar.length) continue;
    const rasmlar = await Promise.all(g.rasmlar.map(async (i) => {
      const yol = rasmYollari[i];
      const tur = /\.png$/i.test(yol) ? 'image/png' : /\.gif$/i.test(yol) ? 'image/gif' : /\.bmp$/i.test(yol) ? 'image/bmp' : /\.webp$/i.test(yol) ? 'image/webp' : 'image/jpeg';
      try { return await rasmTayyorla(new File([fayllar.get(yol)! as BlobPart], yol.split('/').pop() || 'rasm', { type: tur })); } catch { return ''; }
    }));
    qismlar.push({ matn: `${IZOH}\n\n${matn}`, rasmlar: rasmlar.filter(Boolean) });
  }
  if (!qismlar.length) throw new Error("hujjatda matn topilmadi");
  return { qismlar, rasmSoni: qismlar.reduce((a, q) => a + q.rasmlar.length, 0), formulaSoni, oqilmagan, tashlangan };
}

/** Bo'laklar → matn: bir xil belgili qo'shni yozuvlar birlashadi, belgi bo'sh joyga qo'yilmaydi. */
function matnniYig(bolaklar: Bolak[]): string {
  let s = '';
  for (let i = 0; i < bolaklar.length;) {
    const b = bolaklar[i];
    if ('raw' in b) { s += b.raw; i++; continue; }
    let t = b.t;
    let j = i + 1;
    for (; j < bolaklar.length; j++) {
      const c = bolaklar[j];
      if ('raw' in c || c.b !== b.b || c.u !== b.u || (c.h || c.r) !== (b.h || b.r)) break;
      t += c.t;
    }
    if ((b.b || b.u || b.h || b.r) && t.trim()) {
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(t)!;
      let ich = m[2];
      if (b.h || b.r) ich = `==${ich}==`;
      if (b.u) ich = `__${ich}__`;
      if (b.b) ich = `**${ich}**`;
      t = m[1] + ich + m[3];
    }
    s += t;
    i = j;
  }
  return s.replace(/[ ]{2,}/g, ' ');
}
