import * as XLSX from 'xlsx';
import { esc } from '../../lib/chopEtish';
import { oddiyMatn } from '../../lib/matn';
import { varaqTuzilmasi } from '../../../lib/imtihon.js';
import type { ImtihonTafsil } from './turlar';

// Natijalar hisobotlari — Addmen "Test Results" dagi hisobot turlari tartibida
// (markaz shunga o'rgangan): 1xxx — chop etish (PDF), 2xxx — Excel. Ma'lumot
// GET /api/exams/:id/hisobot dan; hammasi brauzerda yasaladi.

export interface HisobotNatija {
  id: number; studentId: number | null; name: string; kod: number | null; groupId: number | null; groupName: string; schoolId: number;
  session: number | null; variant: string | null; score: number; percentage: number;
  blockScores: { subject: string; earned: number; max: number; togri?: number; xato?: number; bosh?: number }[];
  rank: number | null; rankGroup: number | null; rankBranch: number | null; raschScore: number | null; grade: string | null; reviewStatus: string;
  /** Qo'shimcha ballar {nom: ball}. */
  extra?: Record<string, number>;
  detail: { n: number; javob: string; holat: string; ball: number }[];
  mavzular: { fan: string; mavzu: string; jami: number; togri: number }[];
}
export interface Kelmagan { name: string; kod: number | null; phone: string | null; groupName: string; roomName: string; schoolId: number; row: number | null; col: number | null; session: number; status: 'kelmadi' | 'skanerlanmagan' }
export interface HisobotMalumoti {
  natijalar: HisobotNatija[];
  kelmaganlar: Kelmagan[];
  tarix: Record<string, { examId: number; nomi: string; sana: string; foiz: number }[]>;
  kalit: Record<string, Record<number, string>> | null;
}
export interface SavolTahlilQatori {
  q: number | string; t: string; b: number; jami: number; togri: number; bosh: number; tanlov: Record<string, number> | null; foiz: number; farq: number; shubhali: boolean;
  subject: string; topic: string; text: string; togriJavob: string | null; bekor: string | null; yorliq?: string | null;
}

export type HisobotTuri =
  | '1111' | '1112' | '1113' | '1211' | '1221' | '1231' | '1241' | '1311'
  | '2111' | '2112' | '2211' | '2214' | '2311' | '2321' | '2331' | '2411';

export const HISOBOT_TURLARI: { v: HisobotTuri; nom: string; tur: 'pdf' | 'excel'; kalit?: boolean; tahlil?: boolean; birlash?: boolean }[] = [
  { v: '1111', nom: "Ball ro'yxati (qisqa)", tur: 'pdf' },
  { v: '1112', nom: "Ball ro'yxati (fanlar bo'yicha)", tur: 'pdf' },
  { v: '1113', nom: "Ball ro'yxati (to'g'ri / xato / bo'sh)", tur: 'pdf' },
  { v: '1211', nom: "O'quvchi javoblari (har savol)", tur: 'pdf' },
  { v: '1221', nom: 'Shaxsiy hisobot (grafik va dinamika)', tur: 'pdf' },
  { v: '1231', nom: "Kelmaganlar ro'yxati", tur: 'pdf' },
  { v: '1241', nom: 'Savollar tahlili', tur: 'pdf', tahlil: true },
  { v: '1311', nom: 'Ikki imtihon birlashtirilgan', tur: 'pdf', birlash: true },
  { v: '2111', nom: "Ball ro'yxati", tur: 'excel' },
  { v: '2112', nom: "Ball ro'yxati (fanlar, to'g'ri/xato/bo'sh)", tur: 'excel' },
  { v: '2211', nom: "O'quvchi javoblari", tur: 'excel' },
  { v: '2214', nom: "Savol bo'yicha ball", tur: 'excel' },
  { v: '2311', nom: 'Kalit', tur: 'excel', kalit: true },
  { v: '2321', nom: "Kelmaganlar ro'yxati", tur: 'excel' },
  { v: '2331', nom: "Hamma ma'lumot", tur: 'excel' },
  { v: '2411', nom: 'Ikki imtihon birlashtirilgan', tur: 'excel', birlash: true },
];

export interface HisobotSozlama {
  tartib: 'orin' | 'alifbo' | 'id';
  /** O'rin ustuni: umumiy yoki kurs ichida. */
  kursOrni: boolean;
  /** Har kurs alohida sahifa (va kurs ichida o'rin). */
  kursSahifa: boolean;
  /** Ball o'rniga foiz. */
  foiz: boolean;
  persentil: boolean;
}

export interface HisobotKirish {
  exam: ImtihonTafsil;
  markaz: string;
  royxat: HisobotNatija[];
  kelmaganlar: Kelmagan[];
  malumot: HisobotMalumoti;
  tahlil: SavolTahlilQatori[];
  s: HisobotSozlama;
  filialNomi: (id: number) => string;
  /** Birlashtirish (Addmen "Merge test"): ikkinchi imtihon (masalan 2-qism). */
  ikkinchi?: { nomi: string; maxScore: number; natijalar: HisobotNatija[] } | null;
}

export interface BirlashQatori { kalit: string; kod: number | null; name: string; groupName: string; birinchi: number | null; ikkinchi: number | null; jami: number; foiz: number; orin: number }

/** Ikki imtihon natijalari o'quvchi bo'yicha (tashqi qatnashchi — ismi bo'yicha) qo'shiladi, o'rin jami bo'yicha. */
export function birlashtir(k: HisobotKirish): BirlashQatori[] {
  const ik = k.ikkinchi;
  if (!ik) return [];
  const kalit = (r: HisobotNatija) => (r.studentId ? `s${r.studentId}` : `g${r.name.trim().toLowerCase()}`);
  const m = new Map<string, BirlashQatori>();
  for (const r of k.royxat) m.set(kalit(r), { kalit: kalit(r), kod: r.kod, name: r.name, groupName: r.groupName, birinchi: r.score, ikkinchi: null, jami: 0, foiz: 0, orin: 0 });
  const filtr = new Set(k.royxat.map(kalit));
  for (const r of ik.natijalar) {
    const x = m.get(kalit(r));
    if (x) x.ikkinchi = r.score;
    // Kurs/ID filtri birinchi imtihon ro'yxatiga qo'llangan: faqat birinchisida yo'q, lekin filtrsiz holatda qo'shiladi.
    else if (!filtr.size || k.royxat.length === k.malumot.natijalar.length) m.set(kalit(r), { kalit: kalit(r), kod: r.kod, name: r.name, groupName: r.groupName, birinchi: null, ikkinchi: r.score, jami: 0, foiz: 0, orin: 0 });
  }
  const maks = (k.exam.maxScore || 0) + (ik.maxScore || 0);
  const l = [...m.values()].map(x => ({ ...x, jami: Math.round(((x.birinchi || 0) + (x.ikkinchi || 0)) * 100) / 100 }))
    .map(x => ({ ...x, foiz: maks ? Math.round((x.jami / maks) * 1000) / 10 : 0 }))
    .sort((a, b) => b.jami - a.jami || a.name.localeCompare(b.name, 'uz'));
  let oldingi = NaN, orin = 0;
  l.forEach((x, i) => { if (x.jami !== oldingi) { orin = i + 1; oldingi = x.jami; } x.orin = orin; });
  if (k.s.tartib === 'alifbo') l.sort((a, b) => a.name.localeCompare(b.name, 'uz'));
  else if (k.s.tartib === 'id') l.sort((a, b) => (a.kod ?? 1e9) - (b.kod ?? 1e9));
  return l;
}

export function birlashHtml(k: HisobotKirish): string {
  const l = birlashtir(k);
  const ik = k.ikkinchi!;
  return `<section class="bet">${sarlavha(k, 'Birlashtirilgan natija', `+ ${esc(ik.nomi)} · ${l.length} kishi`)}
    <table><tr><th class="m">№</th><th class="m">O'rin</th><th class="m">ID</th><th>Familiya va ism</th><th>Kurs</th>
      <th class="m">${esc(k.exam.name)}<br><small>/ ${v(k.exam.maxScore)}</small></th><th class="m">${esc(ik.nomi)}<br><small>/ ${v(ik.maxScore)}</small></th><th class="m">Jami</th><th class="m">%</th></tr>
    ${l.map((x, i) => `<tr><td class="m">${i + 1}</td><td class="m"><b>${x.orin}</b></td><td class="m mono">${x.kod ?? ''}</td><td>${esc(x.name)}</td><td>${esc(x.groupName)}</td>
      <td class="m">${x.birinchi == null ? '—' : v(x.birinchi)}</td><td class="m">${x.ikkinchi == null ? '—' : v(x.ikkinchi)}</td><td class="m"><b>${v(x.jami)}</b></td><td class="m">${v(x.foiz)}</td></tr>`).join('')}
    </table><p class="belgilar">«—» — o'sha imtihonda natija yo'q (0 deb qo'shildi).</p></section>`;
}

const v = (n: number | null | undefined) => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
const foizM = (n: number) => `${v(n)}%`;

/** Persentil: shu balldan past olganlar ulushi (tenglar yarmi bilan), %. */
export function persentillar(royxat: HisobotNatija[]): Map<number, number> {
  const ballar = royxat.map(r => r.score);
  const out = new Map<number, number>();
  for (const r of royxat) {
    const past = ballar.filter(b => b < r.score).length;
    const teng = ballar.filter(b => b === r.score).length;
    out.set(r.id, Math.round(((past + teng / 2) / Math.max(1, ballar.length)) * 100));
  }
  return out;
}

/**
 * Test ishonchliligi — KR-20 (0..1, 0,7 dan yuqori — yaxshi). Savollar to'g'ri
 * topilish ulushidan va o'quvchilarning to'g'ri javoblar sonining dispersiyasidan.
 */
export function kr20(royxat: HisobotNatija[], tahlil: SavolTahlilQatori[]): number | null {
  const savollar = tahlil.filter(t => !t.bekor && t.jami > 0);
  const k = savollar.length;
  if (k < 2 || royxat.length < 3) return null;
  const sumPQ = savollar.reduce((a, t) => a + t.foiz * (1 - t.foiz), 0);
  const togrilar = royxat.map(r => r.detail.filter(d => d.holat === 'togri').length);
  const ort = togrilar.reduce((a, x) => a + x, 0) / togrilar.length;
  const disp = togrilar.reduce((a, x) => a + (x - ort) ** 2, 0) / togrilar.length;
  if (!disp) return null;
  return Math.round((k / (k - 1)) * (1 - sumPQ / disp) * 100) / 100;
}

function tartibla(l: HisobotNatija[], t: HisobotSozlama['tartib']) {
  const c = [...l];
  if (t === 'alifbo') c.sort((a, b) => a.name.localeCompare(b.name, 'uz'));
  else if (t === 'id') c.sort((a, b) => (a.kod ?? 1e9) - (b.kod ?? 1e9) || a.name.localeCompare(b.name, 'uz'));
  else c.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'uz'));
  return c;
}

/** Kurs bo'yicha guruhlar (kursSahifa) yoki bitta guruh. */
function guruhlar(k: HisobotKirish): { nom: string; l: HisobotNatija[] }[] {
  if (!k.s.kursSahifa) return [{ nom: '', l: tartibla(k.royxat, k.s.tartib) }];
  const m = new Map<string, HisobotNatija[]>();
  for (const r of k.royxat) { const n = r.groupName || 'Kurssiz'; if (!m.has(n)) m.set(n, []); m.get(n)!.push(r); }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'uz')).map(([nom, l]) => ({ nom, l: tartibla(l, k.s.tartib) }));
}

const orni = (r: HisobotNatija, k: HisobotKirish) => (k.s.kursOrni || k.s.kursSahifa ? r.rankGroup : r.rank);

function sarlavha(k: HisobotKirish, nom: string, qoshimcha = '') {
  return `<header class="hs"><div><div class="markaz">${esc(k.markaz)}</div><h1>${esc(nom)}</h1>
    <div class="izoh">${esc(k.exam.name)} · ${esc(k.exam.date)}${qoshimcha ? ` · ${qoshimcha}` : ''}</div></div>
    <div class="sana">${new Date().toLocaleDateString('uz-UZ')}</div></header>`;
}

// --- Chop etish (PDF) ----------------------------------------------------------

export function ballRoyxatiHtml(k: HisobotKirish, turi: '1111' | '1112' | '1113'): string {
  // Fanlar bo'yicha ro'yxatda qo'shimcha ballar ham alohida ustun (og'zaki, yozma ish).
  const bloklar = k.exam.blocks.map(b => b.subject);
  const qoshimcha = turi === '1112' ? (k.exam.settings.qoshimcha || []) : [];
  const kopFilial = (k.exam.branchIds || []).length > 0;
  const pers = k.s.persentil ? persentillar(k.royxat) : null;
  const nom = turi === '1111' ? "Ball ro'yxati" : turi === '1112' ? "Ball ro'yxati — fanlar bo'yicha" : "Ball ro'yxati — to'g'ri / xato / bo'sh";
  return guruhlar(k).map(g => {
    const bosh = `<tr><th class="m">№</th><th class="m">O'rin</th><th class="m">ID</th><th>Familiya va ism</th>${k.s.kursSahifa ? '' : '<th>Kurs</th>'}${kopFilial ? '<th>Filial</th>' : ''}<th class="m">Var.</th>
      ${turi === '1112' ? bloklar.map(b => `<th class="m">${esc(b)}</th>`).join('') : ''}${qoshimcha.map(q => `<th class="m">${esc(q.nom)}</th>`).join('')}
      ${turi === '1113' ? bloklar.map(b => `<th class="m" colspan="3">${esc(b)}</th>`).join('') : ''}
      <th class="m">${k.s.foiz ? 'Foiz' : 'Ball'}</th>${k.s.foiz ? '' : '<th class="m">%</th>'}${pers ? '<th class="m">Persentil</th>' : ''}${k.exam.settings.rasch.enabled ? '<th class="m">Rasch</th><th class="m">Daraja</th>' : ''}</tr>
      ${turi === '1113' ? `<tr><th colspan="${4 + (k.s.kursSahifa ? 0 : 1) + (kopFilial ? 1 : 0) + 1}"></th>${bloklar.map(() => '<th class="m kichik">T</th><th class="m kichik">X</th><th class="m kichik">B</th>').join('')}<th colspan="9"></th></tr>` : ''}`;
    const qatorlar = g.l.map((r, i) => `<tr><td class="m">${i + 1}</td><td class="m"><b>${orni(r, k) ?? ''}</b></td><td class="m mono">${r.kod ?? ''}</td><td>${esc(r.name)}</td>
      ${k.s.kursSahifa ? '' : `<td>${esc(r.groupName)}</td>`}${kopFilial ? `<td>${esc(k.filialNomi(r.schoolId))}</td>` : ''}<td class="m">${esc(r.variant || '')}</td>
      ${turi === '1112' ? bloklar.map((_, bi) => `<td class="m">${v(r.blockScores[bi]?.earned)}</td>`).join('') : ''}${qoshimcha.map(q => `<td class="m">${v(r.extra?.[q.nom])}</td>`).join('')}
      ${turi === '1113' ? bloklar.map((_, bi) => { const b = r.blockScores[bi]; return `<td class="m">${b?.togri ?? ''}</td><td class="m">${b?.xato ?? ''}</td><td class="m">${b?.bosh ?? ''}</td>`; }).join('') : ''}
      <td class="m"><b>${k.s.foiz ? foizM(r.percentage) : v(r.score)}</b></td>${k.s.foiz ? '' : `<td class="m">${v(r.percentage)}</td>`}${pers ? `<td class="m">${pers.get(r.id)}</td>` : ''}
      ${k.exam.settings.rasch.enabled ? `<td class="m">${v(r.raschScore)}</td><td class="m">${esc(r.grade || '')}</td>` : ''}</tr>`).join('');
    const ortacha = g.l.length ? g.l.reduce((a, r) => a + r.score, 0) / g.l.length : 0;
    return `<section class="bet">${sarlavha(k, nom, `${g.nom ? `${esc(g.nom)} · ` : ''}${g.l.length} kishi · o'rtacha ${v(ortacha)} ball`)}
      <table>${bosh}${qatorlar}</table></section>`;
  }).join('');
}

/** 1211 — har o'quvchi: har savolga javobi, natija belgisi va (ruxsat bo'lsa) kalit. */
export function javoblarHtml(k: HisobotKirish): string {
  const tuz = varaqTuzilmasi(k.exam.blocks, k.exam.scoring) as { bloklar: { nomi: string; boshi: number; oxiri: number }[] };
  const belgi = (h: string) => (h === 'togri' ? '✓' : h === 'bosh' ? '–' : h === 'bekor' ? '∗' : h === 'qisman' ? '½' : h === 'ortiqcha' ? '○' : '✗');
  return guruhlar(k).map(g => g.l.map(r => {
    const kalit = k.malumot.kalit?.[`${r.session ?? 1}|${r.variant}`];
    const dmap = new Map(r.detail.map(d => [d.n, d]));
    const bloklar = tuz.bloklar.map(b => {
      const kataklar: string[] = [];
      for (let n = b.boshi; n <= b.oxiri; n++) {
        const d = dmap.get(n);
        const h = d?.holat || 'bosh';
        kataklar.push(`<div class="kt ${h}"><span class="n">${n}</span><b>${esc(d?.javob || '')}</b><i>${belgi(h)}</i>${kalit ? `<small>${esc(kalit[n] || '')}</small>` : ''}</div>`);
      }
      const bs = r.blockScores[tuz.bloklar.indexOf(b)];
      return `<div class="blok"><div class="bn">${esc(b.nomi)} <span>${bs ? `${v(bs.earned)} / ${v(bs.max)} · T ${bs.togri ?? ''} · X ${bs.xato ?? ''} · B ${bs.bosh ?? ''}` : ''}</span></div><div class="kataklar">${kataklar.join('')}</div></div>`;
    }).join('');
    return `<section class="bet kichik-bet">${sarlavha(k, "O'quvchi javoblari")}
      <div class="egasi"><b>${esc(r.name)}</b><span>ID ${r.kod ?? '—'}</span><span>${esc(r.groupName)}</span><span>Variant ${esc(r.variant || '—')}</span>
      <span>Ball <b>${v(r.score)}</b> (${v(r.percentage)}%)</span><span>O'rin ${r.rank ?? '—'}</span></div>
      <p class="belgilar">✓ to'g'ri · ✗ xato · – bo'sh · ∗ bekor qilingan · ○ ortiqcha (hisobga olinmadi)${kalit ? ' · kichik harf — kalit' : ''}</p>${bloklar}</section>`;
  }).join('')).join('');
}

/** 1221 — shaxsiy hisobot: ball, o'rin, persentil, fanlar, mavzular va oldingi imtihonlar. */
export function shaxsiyHisobotHtml(k: HisobotKirish): string {
  const pers = persentillar(k.malumot.natijalar);
  const jami = k.malumot.natijalar.length;
  const ortacha = jami ? k.malumot.natijalar.reduce((a, r) => a + r.percentage, 0) / jami : 0;
  const ustun = (f: number, rang = '#1b6b6b') => `<div class="bar"><div style="width:${Math.max(0, Math.min(100, f))}%;background:${rang}"></div></div>`;
  const rang = (f: number) => (f >= 70 ? '#2e7d32' : f >= 40 ? '#b7791f' : '#c62828');
  return guruhlar(k).map(g => g.l.map(r => {
    const fanlar = r.blockScores.map(b => {
      const f = b.max ? (b.earned / b.max) * 100 : 0;
      return `<tr><td>${esc(b.subject)}</td><td class="m">${v(b.earned)} / ${v(b.max)}</td><td class="m">${b.togri ?? ''}</td><td class="m">${b.xato ?? ''}</td><td class="m">${b.bosh ?? ''}</td><td>${ustun(f, rang(f))}</td><td class="m">${Math.round(f)}%</td></tr>`;
    }).join('');
    const mavzular = [...r.mavzular].map(m => ({ ...m, f: m.jami ? (m.togri / m.jami) * 100 : 0 })).sort((a, b) => a.f - b.f);
    const zaif = mavzular.filter(m => m.f < 50).slice(0, 3);
    const tarix = r.studentId ? k.malumot.tarix[r.studentId] || [] : [];
    const dinamika = tarix.length > 1 ? `<h3>Oldingi imtihonlar</h3><div class="dinamika">${tarix.map(t => `<div class="dt${t.examId === k.exam.id ? ' joriy' : ''}"><div class="dc"><div style="height:${Math.max(2, t.foiz)}%;background:${rang(t.foiz)}"></div></div><b>${Math.round(t.foiz)}%</b><span>${esc(t.sana)}</span></div>`).join('')}</div>` : '';
    return `<section class="bet">${sarlavha(k, 'Shaxsiy natija hisoboti')}
      <div class="egasi katta"><b>${esc(r.name)}</b><span>ID ${r.kod ?? '—'}</span><span>${esc(r.groupName)}</span>${k.filialNomi(r.schoolId) ? `<span>${esc(k.filialNomi(r.schoolId))}</span>` : ''}</div>
      <div class="kartalar">
        <div class="kr"><span>Ball</span><b>${v(r.score)}</b><small>/ ${v(k.exam.maxScore)}</small></div>
        <div class="kr"><span>Foiz</span><b>${v(r.percentage)}%</b><small>o'rtacha ${Math.round(ortacha)}%</small></div>
        <div class="kr"><span>O'rin</span><b>${r.rank ?? '—'}</b><small>${jami} kishidan${r.rankGroup ? ` · kursda ${r.rankGroup}` : ''}</small></div>
        <div class="kr"><span>Persentil</span><b>${pers.get(r.id) ?? '—'}</b><small>qatnashchilarning ${pers.get(r.id) ?? 0}% idan yaxshi</small></div>
        ${r.grade ? `<div class="kr"><span>Daraja</span><b>${esc(r.grade)}</b><small>Rasch ${v(r.raschScore)}</small></div>` : ''}
      </div>
      <h3>Fanlar bo'yicha</h3>
      <table><tr><th>Fan</th><th class="m">Ball</th><th class="m">To'g'ri</th><th class="m">Xato</th><th class="m">Bo'sh</th><th style="width:45mm"></th><th class="m">%</th></tr>${fanlar}</table>
      ${mavzular.length ? `<h3>Mavzular bo'yicha</h3><table><tr><th>Mavzu</th><th class="m">Savol</th><th class="m">To'g'ri</th><th style="width:45mm"></th><th class="m">%</th></tr>
        ${mavzular.map(m => `<tr><td>${esc(m.mavzu || m.fan)}${m.mavzu ? ` <small>· ${esc(m.fan)}</small>` : ''}</td><td class="m">${m.jami}</td><td class="m">${m.togri}</td><td>${ustun(m.f, rang(m.f))}</td><td class="m">${Math.round(m.f)}%</td></tr>`).join('')}</table>` : ''}
      ${zaif.length ? `<p class="tavsiya"><b>Takrorlash kerak:</b> ${zaif.map(m => esc(m.mavzu || m.fan)).join(', ')}</p>` : ''}
      ${dinamika}</section>`;
  }).join('')).join('');
}

export function kelmaganlarHtml(k: HisobotKirish): string {
  const l = [...k.kelmaganlar].sort((a, b) => a.groupName.localeCompare(b.groupName, 'uz') || a.name.localeCompare(b.name, 'uz'));
  return `<section class="bet">${sarlavha(k, "Kelmaganlar ro'yxati", `${l.length} kishi`)}
    <table><tr><th class="m">№</th><th class="m">ID</th><th>Familiya va ism</th><th>Kurs</th><th>Telefon</th><th>Xona / o'rin</th><th class="m">Holat</th></tr>
    ${l.map((x, i) => `<tr><td class="m">${i + 1}</td><td class="m mono">${x.kod ?? ''}</td><td>${esc(x.name)}</td><td>${esc(x.groupName)}</td><td>${esc(x.phone || '')}</td>
      <td>${esc(x.roomName)}${x.row != null ? ` · ${x.row + 1}-${(x.col ?? 0) + 1}` : ''}</td><td class="m">${x.status === 'kelmadi' ? 'kelmadi' : 'varaq yo\'q'}</td></tr>`).join('')}</table></section>`;
}

export function savollarTahliliHtml(k: HisobotKirish): string {
  const ish = kr20(k.malumot.natijalar, k.tahlil);
  const harflar = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, Math.max(4, k.exam.settings.optionCount || 4));
  const l = [...k.tahlil].sort((a, b) => a.b - b.b || (typeof a.q === 'number' && typeof b.q === 'number' ? 0 : 0));
  return `<section class="bet">${sarlavha(k, 'Savollar tahlili', `${k.malumot.natijalar.length} natija${ish != null ? ` · ishonchlilik (KR-20): ${v(ish)}` : ''}`)}
    <table><tr><th class="m">№</th><th>Fan · mavzu</th><th class="m">To'g'ri</th>${harflar.map(h => `<th class="m">${h}</th>`).join('')}<th class="m">Bo'sh</th><th class="m" title="Kuchli va kuchsiz 27% farqi">Farq</th>${k.malumot.kalit ? '<th class="m">Kalit</th>' : ''}<th></th></tr>
    ${l.map((t, i) => {
      const jamiT = t.tanlov ? Object.values(t.tanlov).reduce((a, x) => a + x, 0) : 0;
      return `<tr class="${t.shubhali && !t.bekor ? 'shubha' : ''}"><td class="m">${t.yorliq ? esc(t.yorliq) : i + 1}</td><td>${esc(t.subject)}${t.topic ? ` · ${esc(t.topic)}` : ''}<div class="savol">${esc(oddiyMatn(t.text).slice(0, 110))}</div></td>
      <td class="m"><b>${Math.round(t.foiz * 100)}%</b></td>${harflar.map(h => `<td class="m">${t.tanlov && jamiT ? `${Math.round(((t.tanlov[h] || 0) / jamiT) * 100)}` : ''}</td>`).join('')}
      <td class="m">${t.bosh}</td><td class="m">${v(t.farq)}</td>${k.malumot.kalit ? `<td class="m">${esc(t.togriJavob || '')}</td>` : ''}<td>${t.bekor ? 'bekor' : t.shubhali ? 'kalitni tekshiring' : ''}</td></tr>`;
    }).join('')}</table>
    <p class="belgilar">Variantlar ustunida — o'sha javobni tanlaganlar ulushi (%). Farq — kuchli 27% va kuchsiz 27% o'quvchilarning to'g'ri topish farqi (manfiy — kalit shubhali). KR-20 0,7 dan yuqori bo'lsa test ishonchli.</p></section>`;
}

export const HISOBOT_CSS = `
@page { size: A4; margin: 11mm; }
html, body { margin: 0; background: #fff; }
body { font: 9.5pt/1.3 Arial, Helvetica, sans-serif; color: #000; }
.bet { break-after: page; }
.bet:last-child { break-after: auto; }
.hs { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1.2pt solid #000; padding-bottom: 2mm; margin-bottom: 3mm; }
.hs .markaz { font-size: 8.5pt; color: #444; text-transform: uppercase; letter-spacing: .5pt; }
.hs h1 { font-size: 15pt; margin: .5mm 0; }
.hs .izoh, .hs .sana { font-size: 8.5pt; color: #333; }
table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
th, td { border: .5pt solid #555; padding: 1.1mm 1.5mm; text-align: left; vertical-align: top; }
th { background: #eee; font-size: 8.5pt; }
.m { text-align: center; }
.mono { font-family: 'Courier New', monospace; }
th.kichik { font-size: 7.5pt; padding: .5mm; }
h3 { font-size: 10.5pt; margin: 4mm 0 1.5mm; }
.egasi { display: flex; flex-wrap: wrap; gap: 2mm 5mm; align-items: baseline; margin-bottom: 2mm; }
.egasi b { font-size: 11pt; }
.egasi.katta b { font-size: 14pt; }
.belgilar { font-size: 8pt; color: #444; margin: 0 0 2mm; }
.blok { margin-bottom: 2.5mm; break-inside: avoid; }
.bn { font-weight: 700; border-bottom: .5pt solid #999; margin-bottom: 1mm; }
.bn span { font-weight: 400; color: #333; margin-left: 3mm; }
.kataklar { display: grid; grid-template-columns: repeat(10, 1fr); gap: .8mm; }
.kt { border: .5pt solid #999; border-radius: 1mm; padding: .6mm 1mm; display: flex; gap: 1mm; align-items: baseline; font-size: 8.5pt; }
.kt .n { color: #666; min-width: 5mm; }
.kt i { font-style: normal; margin-left: auto; font-weight: 700; }
.kt small { color: #777; }
.kt.togri { background: #e8f5e9; }
.kt.xato, .kt.qisman { background: #fdecea; }
.kt.bosh { background: #f5f5f5; }
.bet.kichik-bet { break-after: auto; break-inside: avoid; page-break-inside: avoid; margin-bottom: 7mm; }
.kartalar { display: flex; gap: 3mm; margin: 2mm 0 3mm; }
.kr { flex: 1; border: .6pt solid #555; border-radius: 2mm; padding: 2mm; text-align: center; }
.kr span { display: block; font-size: 8pt; color: #444; text-transform: uppercase; }
.kr b { display: block; font-size: 18pt; }
.kr small { font-size: 7.5pt; color: #555; }
.bar { height: 3mm; background: #eee; border-radius: 1mm; overflow: hidden; }
.bar div { height: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.tavsiya { border-left: 2pt solid #b7791f; padding: 1.5mm 3mm; background: #fff8e1; }
.dinamika { display: flex; gap: 3mm; align-items: flex-end; height: 38mm; }
.dt { flex: 1; display: flex; flex-direction: column; align-items: center; font-size: 7.5pt; }
.dt .dc { height: 28mm; width: 8mm; background: #f2f2f2; display: flex; align-items: flex-end; }
.dt .dc div { width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.dt.joriy b { text-decoration: underline; }
.savol { font-size: 7.5pt; color: #555; }
tr.shubha td { background: #fdecea; }
td small { color: #555; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

// --- Excel ----------------------------------------------------------------------

export function excelYukla(k: HisobotKirish, turi: HisobotTuri) {
  const bloklar = k.exam.blocks.map(b => b.subject);
  const pers = persentillar(k.malumot.natijalar);
  const wb = XLSX.utils.book_new();
  const varaq = (nom: string, qatorlar: Record<string, unknown>[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qatorlar.length ? qatorlar : [{ '': "Ma'lumot yo'q" }]), nom.slice(0, 31));
  const asos = (r: HisobotNatija, i: number): Record<string, unknown> => ({
    '№': i + 1, "O'rin": k.s.kursOrni ? r.rankGroup : r.rank, ID: r.kod ?? '', 'Familiya va ism': r.name, Kurs: r.groupName,
    ...((k.exam.branchIds || []).length ? { Filial: k.filialNomi(r.schoolId) } : {}), Variant: r.variant || '',
  });
  const royxat = guruhlar(k).flatMap(g => g.l);
  const tuz = varaqTuzilmasi(k.exam.blocks, k.exam.scoring) as { jami: number };
  if (turi === '2111' || turi === '2331') {
    varaq("Ball ro'yxati", royxat.map((r, i) => ({ ...asos(r, i), Ball: r.score, 'Foiz (%)': r.percentage, Persentil: pers.get(r.id), ...(k.exam.settings.rasch.enabled ? { Rasch: r.raschScore, Daraja: r.grade } : {}) })));
  }
  if (turi === '2112' || turi === '2331') {
    varaq('Fanlar', royxat.map((r, i) => {
      const o = asos(r, i);
      bloklar.forEach((b, bi) => { const x = r.blockScores[bi]; o[`${b} ball`] = x?.earned ?? ''; o[`${b} T`] = x?.togri ?? ''; o[`${b} X`] = x?.xato ?? ''; o[`${b} B`] = x?.bosh ?? ''; });
      for (const q of k.exam.settings.qoshimcha || []) o[q.nom] = r.extra?.[q.nom] ?? '';
      o.Ball = r.score; o['Foiz (%)'] = r.percentage;
      return o;
    }));
  }
  if (turi === '2211' || turi === '2331') {
    varaq('Javoblar', royxat.map((r, i) => {
      const o = asos(r, i);
      const d = new Map(r.detail.map(x => [x.n, x]));
      for (let n = 1; n <= tuz.jami; n++) o[String(n)] = d.get(n)?.javob || '';
      return o;
    }));
  }
  if (turi === '2214' || turi === '2331') {
    varaq("Savol bo'yicha ball", royxat.map((r, i) => {
      const o = asos(r, i);
      const d = new Map(r.detail.map(x => [x.n, x]));
      for (let n = 1; n <= tuz.jami; n++) { const x = d.get(n); o[String(n)] = !x || x.holat === 'bosh' ? '' : x.ball; }
      o.Jami = r.score;
      return o;
    }));
  }
  if ((turi === '2311' || turi === '2331') && k.malumot.kalit) {
    varaq('Kalit', Object.entries(k.malumot.kalit).map(([kod, javoblar]) => {
      const [smena, variant] = kod.split('|');
      const o: Record<string, unknown> = { Smena: smena, Variant: variant };
      for (let n = 1; n <= tuz.jami; n++) o[String(n)] = javoblar[n] || '';
      return o;
    }));
  }
  if (turi === '2411' && k.ikkinchi) {
    varaq('Birlashtirilgan', birlashtir(k).map((x, i) => ({
      '№': i + 1, "O'rin": x.orin, ID: x.kod ?? '', 'Familiya va ism': x.name, Kurs: x.groupName,
      [k.exam.name]: x.birinchi ?? '', [k.ikkinchi!.nomi]: x.ikkinchi ?? '', Jami: x.jami, 'Foiz (%)': x.foiz,
    })));
  }
  if (turi === '2321' || turi === '2331') {
    varaq('Kelmaganlar', k.kelmaganlar.map((x, i) => ({ '№': i + 1, ID: x.kod ?? '', 'Familiya va ism': x.name, Kurs: x.groupName, Telefon: x.phone || '', Xona: x.roomName, Holat: x.status })));
  }
  XLSX.writeFile(wb, `${k.exam.name} — ${HISOBOT_TURLARI.find(x => x.v === turi)?.nom || 'hisobot'}.xlsx`);
}
