// Chop etiladigan hujjatlar: variant kitobchasi, javob varaqalari, eshik
// ro'yxati, nazoratchi vedomosti. Hammasi HTML (brauzer chop etadi yoki PDF
// qilib saqlaydi) — formulalar, kirill va rasm muammosiz chiqadi.

import { esc } from '../../lib/chopEtish';
import { formulaliHtml, oddiyMatn } from '../../lib/matn';
import { HARFLAR } from '../../../lib/imtihon.js';
import type { Exam } from '../../types';

export interface KitobchaMalumoti {
  variants: { session: number; code: string; items: { n: number; q: number; b: number; t: string; p: number; m?: number[]; pa?: number }[] }[];
  savollar: { id: number; text: string; imageUrl?: string | null; type: string; options: string[]; passageId?: number | null }[];
  matnlar: { id: number; title?: string | null; text: string; imageUrl?: string | null }[];
}

/** Ilovaga yuklangan KaTeX uslublari (shriftlari bilan) — iframe'ga ko'chirish uchun. */
let katexUslubi: string | null = null;
export function katexCss(): string {
  if (katexUslubi !== null) return katexUslubi;
  const qismlar: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const r of Array.from(rules || [])) {
      const t = r.cssText;
      if (t.includes('katex') || t.includes('KaTeX')) qismlar.push(t);
    }
  }
  katexUslubi = qismlar.join('\n');
  return katexUslubi;
}

export const KITOBCHA_CSS = `
@page { size: A4; margin: 11mm 11mm 13mm; @bottom-center { content: counter(page); font: 9pt Arial, sans-serif; color: #444; } }
html, body { margin: 0; background: #fff; }
body { font: 10.5pt/1.38 Arial, Helvetica, sans-serif; color: #000; }
.kitobcha { break-after: page; }
.kitobcha:last-child { break-after: auto; }
.muqova { border: 1.4pt solid #000; padding: 5mm 6mm; margin-bottom: 5mm; display: grid; grid-template-columns: 1fr auto; gap: 2mm 6mm; }
.muqova .markaz { font-size: 9pt; color: #333; }
.muqova .nom { font-size: 15pt; font-weight: 700; }
.muqova .meta { font-size: 9.5pt; color: #333; }
.muqova .variant { grid-row: 1 / span 3; grid-column: 2; border: 1.4pt solid #000; padding: 2mm 5mm; text-align: center; align-self: start; }
.muqova .variant small { display: block; font-size: 8pt; letter-spacing: 1pt; }
.muqova .variant b { font-size: 34pt; line-height: 1; }
.muqova table { grid-column: 1 / span 2; border-collapse: collapse; width: 100%; font-size: 9pt; margin-top: 1mm; }
.muqova td, .muqova th { border: 0.5pt solid #555; padding: 1mm 2mm; text-align: left; }
.muqova ul { grid-column: 1 / span 2; margin: 1mm 0 0; padding-left: 5mm; font-size: 9pt; }
.blok { column-span: all; font-size: 11.5pt; font-weight: 700; border-bottom: 1pt solid #000; margin: 4mm 0 2.5mm; padding-bottom: 1mm; }
.savollar { column-count: 2; column-gap: 8mm; column-rule: 0.4pt solid #aaa; }
.savol { break-inside: avoid; margin: 0 0 3.2mm; }
.savol .bosh { display: flex; gap: 1.6mm; }
.savol .bosh > b { min-width: 6mm; }
.savol .matn p { margin: 0 0 1mm; }
.savol img { max-width: 100%; max-height: 58mm; display: block; margin: 1.2mm 0; }
.javoblar { list-style: none; padding: 0; margin: 1.2mm 0 0 7.6mm; }
.javoblar li { margin: 0.6mm 0; display: flex; gap: 1.4mm; }
.javoblar.ikki { display: grid; grid-template-columns: 1fr 1fr; column-gap: 4mm; }
.javoblar p { margin: 0; }
.izoh { margin: 1mm 0 0 7.6mm; font-size: 9pt; font-style: italic; color: #333; }
.matn-quti { border: 0.8pt solid #000; padding: 2.4mm 3mm; margin: 0 0 3mm; break-inside: avoid; }
.matn-quti .sarlavha { font-weight: 700; font-size: 9.5pt; margin-bottom: 1mm; }
.katex { font-size: 1.04em; }
`;

function variantHtml(q: KitobchaMalumoti['savollar'][number], it: { m?: number[] }): string {
  const tartib = it.m && it.m.length ? it.m : q.options.map((_, i) => i);
  const qisqa = tartib.every(i => oddiyMatn(q.options[i] || '').length <= 28 && !/<img/i.test(q.options[i] || ''));
  return `<ol class="javoblar${qisqa ? ' ikki' : ''}">${tartib.map((asl, i) => `<li><b>${HARFLAR[i]})</b><span>${formulaliHtml(q.options[asl] || '')}</span></li>`).join('')}</ol>`;
}

export function kitobchaHtml(exam: Exam, markaz: string, d: KitobchaMalumoti, tanlov: { session: number; code: string }[]): string {
  const savolMap = new Map(d.savollar.map(q => [q.id, q]));
  const matnMap = new Map(d.matnlar.map(p => [p.id, p]));
  const s = exam.settings;
  return tanlov.map(({ session, code }) => {
    const v = d.variants.find(x => x.session === session && x.code === code);
    if (!v) return '';
    const sessiya = s.sessions.find(x => x.id === session);
    const bloklar = exam.blocks.map((b, bi) => {
      const lar = v.items.filter(it => it.b === bi);
      return { nomi: b.subject, soni: lar.length, boshi: lar[0]?.n, oxiri: lar[lar.length - 1]?.n, ball: exam.scoring === 'blok' ? b.pointsPerQuestion : null };
    });
    const muqova = `
      <div class="muqova">
        <div class="markaz">${esc(markaz)}</div>
        <div class="nom">${esc(exam.name)}</div>
        <div class="meta">${esc(exam.date)}${sessiya ? ` · ${esc(sessiya.name)}${sessiya.time ? ` (${esc(sessiya.time)})` : ''}` : ''} · ${exam.duration} daqiqa · ${v.items.length} ta savol</div>
        <div class="variant"><small>VARIANT</small><b>${esc(code)}</b></div>
        <table><tr><th>Fan</th><th>Savollar</th><th>Soni</th>${exam.scoring === 'blok' ? '<th>Bir savol bali</th>' : ''}</tr>
          ${bloklar.map(b => `<tr><td>${esc(b.nomi)}</td><td>${b.boshi ?? ''}–${b.oxiri ?? ''}</td><td>${b.soni}</td>${exam.scoring === 'blok' ? `<td>${b.ball}</td>` : ''}</tr>`).join('')}
        </table>
        <ul>
          <li>Javoblarni faqat javob varaqasiga belgilang: doirachani qora yoki ko'k ruchka bilan to'liq bo'yang.</li>
          <li>Javob varaqasida kitobcha variantini (<b>${esc(code)}</b>) ham bo'yang. Kitobchaga yozish mumkin — u tekshirilmaydi.</li>
          ${v.items.some(it => it.t === 'raqamli') ? "<li>Raqamli javobni katak tepasiga yozing va har belgini ostidagi ustunda bo'yang (minus, vergul, kasr chizig'i ham).</li>" : ''}
        </ul>
      </div>`;
    let joriyBlok = -1;
    let joriyMatn: number | null = null;
    const qismlar: string[] = [];
    v.items.forEach((it, idx) => {
      if (it.b !== joriyBlok) {
        joriyBlok = it.b;
        const b = bloklar[it.b];
        qismlar.push(`<div class="blok">${esc(b?.nomi || '')} — ${b?.boshi}–${b?.oxiri}-savollar${b?.ball != null ? `, har biri ${b.ball} ball` : ''}</div>`);
        joriyMatn = null;
      }
      const q = savolMap.get(it.q);
      if (!q) return;
      if (it.pa && it.pa !== joriyMatn) {
        joriyMatn = it.pa;
        const p = matnMap.get(it.pa);
        let oxiri = it.n;
        for (let j = idx + 1; j < v.items.length && v.items[j].pa === it.pa; j++) oxiri = v.items[j].n;
        if (p) {
          qismlar.push(`<div class="matn-quti"><div class="sarlavha">${p.title ? `${esc(p.title)}. ` : ''}Matnni o'qing va ${it.n}–${oxiri}-savollarga javob bering.</div>${formulaliHtml(p.text)}${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="">` : ''}</div>`);
        }
      } else if (!it.pa) joriyMatn = null;
      let pastki = '';
      if (it.t === 'yopiq') pastki = variantHtml(q, it);
      else if (it.t === 'raqamli') pastki = `<div class="izoh">Javobni javob varaqasidagi ${it.n}-katakka yozing va bo'yang.</div>`;
      else pastki = `<div class="izoh">Yechimni javob varaqasidagi ${it.n}-maydonga yozing (${it.p} ball).</div>`;
      qismlar.push(`<div class="savol"><div class="bosh"><b>${it.n}.</b><div class="matn">${formulaliHtml(q.text)}</div></div>${q.imageUrl ? `<img src="${esc(q.imageUrl)}" alt="">` : ''}${pastki}</div>`);
    });
    return `<section class="kitobcha">${muqova}<div class="savollar">${qismlar.join('')}</div></section>`;
  }).join('');
}

// --- Ro'yxatlar ---------------------------------------------------------------

export interface RoyxatOrni { name: string; groupName: string; row: number | null; col: number | null; variant: string | null; sheetCode: string; mehmon: boolean; studentId?: number | null }

export const ROYXAT_CSS = `
@page { size: A4; margin: 12mm; }
html, body { margin: 0; background: #fff; }
body { font: 11pt/1.3 Arial, Helvetica, sans-serif; color: #000; }
.bet { break-after: page; }
.bet:last-child { break-after: auto; }
h1 { font-size: 20pt; margin: 0 0 1mm; }
h2 { font-size: 11pt; font-weight: normal; margin: 0 0 4mm; color: #333; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 0.6pt solid #444; padding: 1.6mm 2mm; text-align: left; }
th { background: #eee; font-size: 9.5pt; }
td.m, th.m { text-align: center; }
.katta td { font-size: 12.5pt; }
.imzo { margin-top: 8mm; display: flex; justify-content: space-between; font-size: 10.5pt; }
.bosh-katak { width: 10mm; }
`;

export function eshikRoyxatiHtml(p: { exam: Exam; smena: string; xona: string; orinlar: RoyxatOrni[] }): string {
  const tartib = [...p.orinlar].sort((a, b) => a.name.localeCompare(b.name, 'uz'));
  return `<section class="bet">
    <h1>${esc(p.xona)}</h1>
    <h2>${esc(p.exam.name)} · ${esc(p.exam.date)} · ${esc(p.smena)} · ${tartib.length} kishi</h2>
    <table class="katta"><tr><th class="m">№</th><th>Familiya va ism</th><th class="m">Qator</th><th class="m">O'rin</th><th class="m">Variant</th></tr>
      ${tartib.map((o, i) => `<tr><td class="m">${i + 1}</td><td>${esc(o.name)}${o.mehmon ? ' <small>(tashqi)</small>' : ''}</td><td class="m">${o.row != null ? o.row + 1 : ''}</td><td class="m">${o.col != null ? o.col + 1 : ''}</td><td class="m"><b>${esc(o.variant || '')}</b></td></tr>`).join('')}
    </table>
  </section>`;
}

export function vedomostHtml(p: { exam: Exam; smena: string; xona: string; orinlar: RoyxatOrni[] }): string {
  const tartib = [...p.orinlar].sort((a, b) => (a.row ?? 0) - (b.row ?? 0) || (a.col ?? 0) - (b.col ?? 0));
  return `<section class="bet">
    <h1 style="font-size:15pt">Nazoratchi vedomosti — ${esc(p.xona)}</h1>
    <h2>${esc(p.exam.name)} · ${esc(p.exam.date)} · ${esc(p.smena)} · ${tartib.length} kishi</h2>
    <table><tr><th class="m">№</th><th class="m">Joyi</th><th>Familiya va ism</th><th>Kurs</th><th class="m">ID</th><th class="m">Varaq kodi</th><th class="m">Var.</th><th class="m bosh-katak">Keldi</th><th style="width:28mm">Imzo</th></tr>
      ${tartib.map((o, i) => `<tr><td class="m">${i + 1}</td><td class="m">${o.row != null ? `${o.row + 1}-${(o.col ?? 0) + 1}` : ''}</td><td>${esc(o.name)}</td><td>${esc(o.groupName || (o.mehmon ? 'tashqi' : ''))}</td><td class="m">${o.studentId ?? ''}</td><td class="m" style="font-family:monospace">${esc(o.sheetCode)}</td><td class="m"><b>${esc(o.variant || '')}</b></td><td></td><td></td></tr>`).join('')}
    </table>
    <div class="imzo"><span>Keldi: ____ · Kelmadi: ____ · Qaytarilgan varaq: ____</span><span>Nazoratchi: ______________________ Imzo: __________</span></div>
  </section>`;
}
