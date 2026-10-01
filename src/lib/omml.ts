import katex from 'katex';

// LaTeX formula → Word formulasi (OMML): KaTeX o'zi tahlil qilib MathML beradi,
// biz MathML ni OMML ga o'giramiz. Kitobchani Word'da ochganda formulalar
// rasm emas — tahrirlanadigan haqiqiy Word formulasi bo'ladi.

export const xmlEsc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const NARY = new Set(['∑', '∏', '∐', '∫', '∬', '∭', '∮', '⋃', '⋂', '⋁', '⋀']);
const OPERATOR_ICHIDA = '⁡'; // funksiya qo'llash (ko'rinmas) — Word'ga kerak emas

function run(matn: string, tekis = false): string {
  const t = matn.replace(new RegExp(OPERATOR_ICHIDA, 'g'), '');
  if (!t) return '';
  return `<m:r>${tekis ? '<m:rPr><m:sty m:val="p"/></m:rPr>' : ''}<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t xml:space="preserve">${xmlEsc(t)}</m:t></m:r>`;
}

const bolalar = (el: Element) => Array.from(el.children);
const ichi = (el: Element | undefined) => (el ? ogir(el) : '');
const qism = (teg: string, el: Element | undefined) => `<m:${teg}>${ichi(el)}</m:${teg}>`;

function ogir(el: Element): string {
  const teg = el.tagName.toLowerCase();
  const b = bolalar(el);
  switch (teg) {
    case 'math': case 'semantics': case 'mstyle': case 'mpadded': case 'mphantom': case 'menclose':
      return teg === 'semantics' ? ichi(b[0]) : b.map(ogir).join('');
    case 'annotation': case 'annotation-xml':
      return '';
    case 'mrow': {
      // \left( ... \right) — chegaralangan ifoda (qavslar ichidagiga qarab cho'ziladi).
      const bosh = b[0], oxir = b[b.length - 1];
      const fence = (x?: Element) => x && x.tagName.toLowerCase() === 'mo' && x.getAttribute('fence') === 'true';
      if (b.length >= 2 && fence(bosh) && fence(oxir)) {
        return `<m:d><m:dPr><m:begChr m:val="${xmlEsc(bosh.textContent || '')}"/><m:endChr m:val="${xmlEsc(oxir.textContent || '')}"/></m:dPr><m:e>${b.slice(1, -1).map(ogir).join('')}</m:e></m:d>`;
      }
      if (b.length >= 2 && fence(bosh)) {
        return `<m:d><m:dPr><m:begChr m:val="${xmlEsc(bosh.textContent || '')}"/><m:endChr m:val=""/></m:dPr><m:e>${b.slice(1).map(ogir).join('')}</m:e></m:d>`;
      }
      return b.map(ogir).join('');
    }
    case 'mi': {
      const t = el.textContent || '';
      // Bir harfli o'zgaruvchi — kursiv, funksiya nomi (sin, log) va "normal" — tik.
      return run(t, t.length > 1 || el.getAttribute('mathvariant') === 'normal');
    }
    case 'mn': return run(el.textContent || '', true);
    case 'mo': return run(el.textContent || '', true);
    case 'mtext': case 'ms': return run(el.textContent || '', true);
    case 'mspace': return run(' ', true);
    case 'mfrac': {
      const yoq = /^0(px|em|pt)?$/.test(el.getAttribute('linethickness') || '');
      return `<m:f>${yoq ? '<m:fPr><m:type m:val="noBar"/></m:fPr>' : ''}${qism('num', b[0])}${qism('den', b[1])}</m:f>`;
    }
    case 'msqrt': return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${b.map(ogir).join('')}</m:e></m:rad>`;
    case 'mroot': return `<m:rad>${qism('deg', b[1])}${qism('e', b[0])}</m:rad>`;
    case 'msup': case 'msub': case 'msubsup': {
      const asos = b[0];
      const chr = asos?.tagName.toLowerCase() === 'mo' ? (asos.textContent || '').trim() : '';
      if (NARY.has(chr)) {
        const pas = teg === 'msup' ? undefined : b[1];
        const yuq = teg === 'msub' ? undefined : teg === 'msup' ? b[1] : b[2];
        return `<m:nary><m:naryPr><m:chr m:val="${chr}"/>${pas ? '' : '<m:subHide m:val="1"/>'}${yuq ? '' : '<m:supHide m:val="1"/>'}</m:naryPr>${qism('sub', pas)}${qism('sup', yuq)}<m:e/></m:nary>`;
      }
      if (teg === 'msup') return `<m:sSup>${qism('e', b[0])}${qism('sup', b[1])}</m:sSup>`;
      if (teg === 'msub') return `<m:sSub>${qism('e', b[0])}${qism('sub', b[1])}</m:sSub>`;
      return `<m:sSubSup>${qism('e', b[0])}${qism('sub', b[1])}${qism('sup', b[2])}</m:sSubSup>`;
    }
    case 'mover': case 'munder': case 'munderover': {
      const asos = b[0];
      const chr = asos?.tagName.toLowerCase() === 'mo' ? (asos.textContent || '').trim() : '';
      if (NARY.has(chr)) {
        const pas = teg === 'mover' ? undefined : b[1];
        const yuq = teg === 'munder' ? undefined : teg === 'mover' ? b[1] : b[2];
        return `<m:nary><m:naryPr><m:chr m:val="${chr}"/><m:limLoc m:val="undOvr"/>${pas ? '' : '<m:subHide m:val="1"/>'}${yuq ? '' : '<m:supHide m:val="1"/>'}</m:naryPr>${qism('sub', pas)}${qism('sup', yuq)}<m:e/></m:nary>`;
      }
      if (teg === 'mover' && el.getAttribute('accent') === 'true') {
        const belgi = (b[1]?.textContent || '').trim();
        // \overline — chiziq, qolganlari (\vec, \hat, \bar) — urg'u belgisi.
        if (belgi === '‾' || belgi === '¯' || belgi === '_') return `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr>${qism('e', b[0])}</m:bar>`;
        return `<m:acc><m:accPr><m:chr m:val="${xmlEsc(belgi)}"/></m:accPr>${qism('e', b[0])}</m:acc>`;
      }
      if (teg === 'mover') return `<m:limUpp>${qism('e', b[0])}${qism('lim', b[1])}</m:limUpp>`;
      if (teg === 'munder') return `<m:limLow>${qism('e', b[0])}${qism('lim', b[1])}</m:limLow>`;
      return `<m:limUpp><m:e><m:limLow>${qism('e', b[0])}${qism('lim', b[1])}</m:limLow></m:e>${qism('lim', b[2])}</m:limUpp>`;
    }
    case 'mtable': {
      const qatorlar = bolalar(el).filter(x => x.tagName.toLowerCase() === 'mtr');
      const ustun = Math.max(1, ...qatorlar.map(r => bolalar(r).length));
      // Bir ustunli (tenglamalar sistemasi) — tenglamalar massivi, aks holda matritsa.
      if (ustun === 1) return `<m:eqArr>${qatorlar.map(r => `<m:e>${bolalar(r).map(ogir).join('')}</m:e>`).join('')}</m:eqArr>`;
      return `<m:m>${qatorlar.map(r => `<m:mr>${bolalar(r).map(c => `<m:e>${ogir(c)}</m:e>`).join('')}</m:mr>`).join('')}</m:m>`;
    }
    case 'mtr': return b.map(ogir).join('');
    case 'mtd': return b.map(ogir).join('');
    default:
      return b.length ? b.map(ogir).join('') : run(el.textContent || '', true);
  }
}

/** LaTeX → `<m:oMath>` (inline). Tahlil qilib bo'lmasa — oddiy matn. */
export function texDanOmml(tex: string): string {
  let mml = '';
  try { mml = katex.renderToString(tex, { output: 'mathml', throwOnError: true, strict: 'ignore' }); } catch { return ''; }
  const doc = new DOMParser().parseFromString(mml, 'text/html');
  const math = doc.querySelector('math');
  if (!math) return '';
  return `<m:oMath>${ogir(math)}</m:oMath>`;
}
