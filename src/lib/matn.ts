// Savol matni: muharrir HTML i + formulalar ($...$ va $$...$$, LaTeX).
//
// Savolni xodim yozadi, lekin u brauzerda innerHTML bilan ko'rsatiladi —
// shuning uchun faqat ruxsat etilgan teg va atributlar qoladi (skript, on*
// hodisalar, javascript: havolalar olib tashlanadi). Formulalar KaTeX bilan
// HTML ga aylanadi: kitobchani chop etishda ham, ekranda ham bir xil.

import katex from 'katex';
import 'katex/dist/katex.min.css';

/** innerHTML bilan chiqadigan savol matni uchun (paragraf, ro'yxat, rasm). */
export const SAVOL_MATNI = '[&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:max-h-64 [&_img]:rounded-lg [&_table]:border-collapse [&_td]:border [&_td]:border-chiziq [&_td]:px-2 leading-relaxed';

const TEGLAR = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'SUB', 'SUP', 'P', 'BR', 'DIV', 'SPAN', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'IMG', 'BLOCKQUOTE', 'CODE', 'PRE', 'H3', 'H4']);
const ATRIBUTLAR: Record<string, string[]> = { IMG: ['src', 'alt', 'width', 'height'], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'] };

export function tozalaHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const ildiz = doc.body.firstElementChild as HTMLElement;
  const yur = (el: Element) => {
    for (const bola of Array.from(el.children)) {
      if (!TEGLAR.has(bola.tagName)) {
        // Noma'lum teg — ichidagi matn qoladi, tegning o'zi ketadi.
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META'].includes(bola.tagName)) bola.remove();
        else bola.replaceWith(...Array.from(bola.childNodes));
        continue;
      }
      for (const a of Array.from(bola.attributes)) {
        const ruxsat = ATRIBUTLAR[bola.tagName] || [];
        if (!ruxsat.includes(a.name)) bola.removeAttribute(a.name);
      }
      if (bola.tagName === 'IMG') {
        const src = bola.getAttribute('src') || '';
        if (!/^(https?:|data:image\/)/i.test(src)) bola.remove();
        else bola.setAttribute('style', 'max-width:100%;height:auto');
      }
      yur(bola);
    }
  };
  yur(ildiz);
  // Ichma-ich tozalash bola o'chirilganda qolib ketgan joyni ham qamrab olsin.
  yur(ildiz);
  return ildiz.innerHTML;
}

function formula(tex: string, blok: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: blok, throwOnError: false, output: 'html', strict: 'ignore' });
  } catch {
    return tex;
  }
}

/** Matn tugunlaridagi $...$ ni KaTeX ga aylantiradi (HTML teglariga tegmaydi). */
export function formulaliHtml(html: string): string {
  const toza = tozalaHtml(html);
  if (!toza.includes('$')) return toza;
  const doc = new DOMParser().parseFromString(`<div>${toza}</div>`, 'text/html');
  const ildiz = doc.body.firstElementChild as HTMLElement;
  const tugunlar: Text[] = [];
  const w = doc.createTreeWalker(ildiz, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) tugunlar.push(w.currentNode as Text);
  for (const t of tugunlar) {
    const s = t.data;
    if (!s.includes('$')) continue;
    const bolaklar = s.split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/g);
    if (bolaklar.length === 1) continue;
    const frag = doc.createDocumentFragment();
    for (const b of bolaklar) {
      if (!b) continue;
      if (b.startsWith('$$') && b.endsWith('$$') && b.length > 4) {
        const span = doc.createElement('span');
        span.innerHTML = formula(b.slice(2, -2), true);
        frag.appendChild(span);
      } else if (b.startsWith('$') && b.endsWith('$') && b.length > 2) {
        const span = doc.createElement('span');
        span.innerHTML = formula(b.slice(1, -1), false);
        frag.appendChild(span);
      } else frag.appendChild(doc.createTextNode(b));
    }
    t.replaceWith(frag);
  }
  return ildiz.innerHTML;
}

/** Oddiy matn (ro'yxat va qidiruv uchun): teglarsiz, formulalar $…$ ko'rinishida qoladi. */
export function oddiyMatn(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}
