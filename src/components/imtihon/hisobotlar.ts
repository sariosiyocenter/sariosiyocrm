import * as XLSX from 'xlsx';
import { esc } from '../../lib/chopEtish';
import { oddiyMatn } from '../../lib/matn';
import { varaqTuzilmasi, reytingOrinlari as reytingOrinlariJs, otishHolati } from '../../../lib/imtihon.js';
import type { ImtihonTafsil } from './turlar';

// Natijalar hisobotlari — Addmen "Test Results" dagi hisobot turlari va
// raqamlari aynan (markaz shu raqamlarga o'rgangan): 1xxx — chop etish (PDF),
// 2xxx — Excel. Addmen'da yo'q, bizda qo'shilganlari: 1241, 1251, 1311, 2411.
// Ma'lumot GET /api/exams/:id/hisobot dan; hammasi brauzerda yasaladi.

export interface HisobotNatija {
  id: number; studentId: number | null; name: string; kod: number | null; groupId: number | null; groupName: string; schoolId: number;
  session: number | null; variant: string | null; score: number; percentage: number;
  blockScores: { subject: string; earned: number; max: number; togri?: number; xato?: number; bosh?: number }[];
  rank: number | null; rankGroup: number | null; rankBranch: number | null; raschScore: number | null; grade: string | null; reviewStatus: string;
  /** Qo'shimcha ballar {nom: ball}. */
  extra?: Record<string, number>;
  /** Skanerlangan varaq rasmlari. */
  rasmlar?: { sahifa: number; url: string }[];
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
  | '1111' | '1112' | '1113' | '1114' | '1115' | '1116' | '1121' | '1211' | '1221' | '1231' | '1241' | '1251' | '1311'
  | '2111' | '2112' | '2113' | '2116' | '2121' | '2211' | '2212' | '2213' | '2214' | '2311' | '2321' | '2331' | '2411';

export interface HisobotTavsifi {
  v: HisobotTuri; nom: string; tur: 'pdf' | 'excel';
  /** Kalit ruxsati kerak. */ kalit?: boolean;
  /** Savollar tahlili kerak. */ tahlil?: boolean;
  /** Ikkinchi imtihon tanlanadi (Merge test). */ birlash?: boolean;
  /** Ustunlarni tanlash ishlaydi. */ ustunli?: boolean;
  /** Har o'quvchiga alohida bo'lim — alohida PDF bo'lishi mumkin. */ shaxsiy?: boolean;
  /** Kelmaganlar ro'yxati. */ kelmagan?: boolean;
}

export const HISOBOT_TURLARI: HisobotTavsifi[] = [
  { v: '1111', nom: "Ball ro'yxati (qisqa)", tur: 'pdf', ustunli: true },
  { v: '1112', nom: "Ball ro'yxati (1 bo'lim — fanlar bali)", tur: 'pdf', ustunli: true },
  { v: '1113', nom: "Ball ro'yxati (3 bo'lim — T / X / B)", tur: 'pdf', ustunli: true },
  { v: '1114', nom: "Ball ro'yxati (5 bo'lim — U / T / X / B / ball)", tur: 'pdf', ustunli: true },
  { v: '1115', nom: "Ball ro'yxati (2 qismli, qisqa)", tur: 'pdf', ustunli: true },
  { v: '1116', nom: "Ball ro'yxati (2 qismli, kengaytirilgan)", tur: 'pdf', ustunli: true },
  { v: '1121', nom: "Ball ro'yxati (mavzular — kichik bo'limlar)", tur: 'pdf', ustunli: true },
  { v: '1211', nom: "O'quvchi javoblari (har savol)", tur: 'pdf', shaxsiy: true },
  { v: '1221', nom: 'Shaxsiy hisobot (baholash)', tur: 'pdf', shaxsiy: true },
  { v: '1231', nom: "O'sish grafigi (bir necha imtihon)", tur: 'pdf', shaxsiy: true },
  { v: '1241', nom: 'Savollar tahlili', tur: 'pdf', tahlil: true },
  { v: '1251', nom: "Kelmaganlar ro'yxati", tur: 'pdf', kelmagan: true },
  { v: '1311', nom: 'Ikki imtihon birlashtirilgan', tur: 'pdf', birlash: true },
  { v: '2111', nom: "Ball ro'yxati (qisqa)", tur: 'excel', ustunli: true },
  { v: '2112', nom: "Ball ro'yxati (fanlar bali)", tur: 'excel', ustunli: true },
  { v: '2113', nom: "Ball ro'yxati (kengaytirilgan)", tur: 'excel', ustunli: true },
  { v: '2116', nom: 'Har fan bo\'yicha TOP-N', tur: 'excel' },
  { v: '2121', nom: "Ball ro'yxati (mavzular)", tur: 'excel', ustunli: true },
  { v: '2211', nom: "O'quvchi javoblari", tur: 'excel' },
  { v: '2212', nom: "O'quvchi javoblari (T / X / B)", tur: 'excel' },
  { v: '2213', nom: "O'quvchi javoblari (ikki imtihon)", tur: 'excel', birlash: true },
  { v: '2214', nom: "Savol bo'yicha ball", tur: 'excel' },
  { v: '2311', nom: 'Kalit', tur: 'excel', kalit: true },
  { v: '2321', nom: "Kelmaganlar ro'yxati", tur: 'excel', kelmagan: true },
  { v: '2331', nom: "Hamma ma'lumot", tur: 'excel' },
  { v: '2411', nom: 'Ikki imtihon birlashtirilgan', tur: 'excel', birlash: true },
];

/** Ball ro'yxatlarida tanlanadigan ustunlar (Addmen "Select columns"). */
export type UstunKodi = 'orin' | 'id' | 'kurs' | 'filial' | 'variant' | 'ball' | 'foiz' | 'persentil' | 'rasch' | 'holat';
export const USTUN_NOMI: Record<UstunKodi, string> = {
  orin: "O'rin", id: 'ID', kurs: 'Kurs', filial: 'Filial', variant: 'Variant', ball: 'Ball', foiz: 'Foiz (%)', persentil: 'Persentil', rasch: 'Rasch va daraja', holat: "O'tdi / o'tmadi",
};

export interface HisobotSozlama {
  tartib: 'orin' | 'alifbo' | 'id';
  /** O'rin ustuni: umumiy yoki kurs ichida (Addmen "Group rank"). */
  kursOrni: boolean;
  /** Har kurs alohida sahifa (va kurs ichida o'rin). */
  kursSahifa: boolean;
  /** Pastda xulosa: o'rtacha, eng yuqori, eng past, o'tganlar. */
  xulosa: boolean;
  ustunlar: UstunKodi[];
  /** 2116 — har fandan nechta eng yaxshisi. */
  topN: number;
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

// lib/imtihon.js dagi funksiya (JS) — turini aniq beramiz.
const reytingOrinlari = reytingOrinlariJs as unknown as <K>(l: { id: K; score: number }[], kalit?: (r: any) => unknown, usul?: string) => { orin: Map<K, number> };

const v = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
const yaxlit = (n: number) => Math.round(n * 100) / 100;

/**
 * E'lon qilinmagan imtihonda o'rinlar hali hisoblanmagan — hisobot uchun shu
 * yerning o'zida (imtihonning o'rin hisoblash usuli bilan).
 */
export function orinlarniToldir(natijalar: HisobotNatija[], usul: string): HisobotNatija[] {
  if (natijalar.every(r => r.rank != null)) return natijalar;
  const umumiy = reytingOrinlari(natijalar, undefined, usul).orin;
  const kurs = reytingOrinlari(natijalar, (r: HisobotNatija) => r.groupId ?? null, usul).orin;
  return natijalar.map(r => ({ ...r, rank: r.rank ?? umumiy.get(r.id) ?? null, rankGroup: r.rankGroup ?? kurs.get(r.id) ?? null }));
}

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
const otdimi = (k: HisobotKirish, r: HisobotNatija) => otishHolati(k.exam.settings, r.score, r.percentage) as boolean | null;
const holatMatni = (h: boolean | null) => (h == null ? '' : h ? "O'tdi" : "O'tmadi");
const urinish = (b?: { togri?: number; xato?: number }) => (b?.togri == null && b?.xato == null ? null : (b?.togri || 0) + (b?.xato || 0));

/** Imtihonda bor ustunlardan tanlanganlari (filial — ko'p filialli, Rasch — yoqilgan, holat — o'tish bali bo'lsa). */
export function mavjudUstunlar(exam: ImtihonTafsil): UstunKodi[] {
  const l: UstunKodi[] = ['orin', 'id', 'kurs'];
  if ((exam.branchIds || []).length) l.push('filial');
  l.push('variant', 'ball', 'foiz', 'persentil');
  if (exam.settings.rasch?.enabled) l.push('rasch');
  if (exam.settings.otish) l.push('holat');
  return l;
}

function sarlavha(k: HisobotKirish, nom: string, qoshimcha = '') {
  return `<header class="hs"><div><div class="markaz">${esc(k.markaz)}</div><h1>${esc(nom)}</h1>
    <div class="izoh">${esc(k.exam.name)} · ${esc(k.exam.date)}${qoshimcha ? ` · ${qoshimcha}` : ''}</div></div>
    <div class="sana">${new Date().toLocaleDateString('uz-UZ')}</div></header>`;
}

// --- Ustunli jadval ------------------------------------------------------------

interface Ustun {
  sar: string;
  /** Ikki qatorli sarlavhada ustki guruh (fan nomi). */
  guruh?: string;
  m?: boolean;
  qalin?: boolean;
  qiymat: (r: HisobotNatija, i: number) => string;
  /** Xulosa qatori uchun son. */
  son?: (r: HisobotNatija) => number | null;
}

function asosUstunlar(k: HisobotKirish): Ustun[] {
  const u = new Set(k.s.ustunlar);
  const l: Ustun[] = [{ sar: '№', m: true, qiymat: (_, i) => String(i + 1) }];
  if (u.has('orin')) l.push({ sar: "O'rin", m: true, qalin: true, qiymat: r => String(orni(r, k) ?? '') });
  if (u.has('id')) l.push({ sar: 'ID', m: true, qiymat: r => `<span class="mono">${r.kod ?? ''}</span>` });
  l.push({ sar: 'Familiya va ism', qiymat: r => esc(r.name) });
  if (u.has('kurs') && !k.s.kursSahifa) l.push({ sar: 'Kurs', qiymat: r => esc(r.groupName) });
  if (u.has('filial') && (k.exam.branchIds || []).length) l.push({ sar: 'Filial', qiymat: r => esc(k.filialNomi(r.schoolId)) });
  if (u.has('variant')) l.push({ sar: 'Var.', m: true, qiymat: r => esc(r.variant || '') });
  return l;
}

function yakunUstunlar(k: HisobotKirish): Ustun[] {
  const u = new Set(k.s.ustunlar);
  const pers = u.has('persentil') ? persentillar(k.malumot.natijalar) : null;
  const l: Ustun[] = [];
  if (u.has('ball')) l.push({ sar: 'Ball', m: true, qalin: true, qiymat: r => v(r.score), son: r => r.score });
  if (u.has('foiz')) l.push({ sar: '%', m: true, qalin: !u.has('ball'), qiymat: r => v(r.percentage), son: r => r.percentage });
  if (pers) l.push({ sar: 'Persentil', m: true, qiymat: r => String(pers.get(r.id) ?? ''), son: r => pers.get(r.id) ?? null });
  if (u.has('rasch') && k.exam.settings.rasch.enabled) {
    l.push({ sar: 'Rasch', m: true, qiymat: r => v(r.raschScore), son: r => r.raschScore });
    l.push({ sar: 'Daraja', m: true, qiymat: r => esc(r.grade || '') });
  }
  if (u.has('holat') && k.exam.settings.otish) l.push({ sar: 'Holat', m: true, qiymat: r => { const h = otdimi(k, r); return h == null ? '' : `<span class="${h ? 'otdi' : 'otmadi'}">${holatMatni(h)}</span>`; } });
  return l;
}

const qoshimchaUstunlar = (k: HisobotKirish): Ustun[] => (k.exam.settings.qoshimcha || []).map(q => ({
  sar: esc(q.nom), m: true, qiymat: r => v(r.extra?.[q.nom]), son: r => r.extra?.[q.nom] ?? null,
}));

/** Fan ustunlari: 1 — ball; 3 — T/X/B; 5 — U/T/X/B/ball. */
function blokUstunlari(k: HisobotKirish, bolim: 1 | 3 | 5): Ustun[] {
  return k.exam.blocks.flatMap((b, bi): Ustun[] => {
    const bs = (r: HisobotNatija) => r.blockScores[bi];
    const ball: Ustun = { sar: bolim === 1 ? esc(b.subject) : 'Ball', guruh: bolim === 1 ? undefined : b.subject, m: true, qiymat: r => v(bs(r)?.earned), son: r => bs(r)?.earned ?? null };
    if (bolim === 1) return [ball];
    const txb: Ustun[] = [
      { sar: 'T', guruh: b.subject, m: true, qiymat: r => String(bs(r)?.togri ?? ''), son: r => bs(r)?.togri ?? null },
      { sar: 'X', guruh: b.subject, m: true, qiymat: r => String(bs(r)?.xato ?? ''), son: r => bs(r)?.xato ?? null },
      { sar: 'B', guruh: b.subject, m: true, qiymat: r => String(bs(r)?.bosh ?? ''), son: r => bs(r)?.bosh ?? null },
    ];
    if (bolim === 3) return txb;
    return [{ sar: 'U', guruh: b.subject, m: true, qiymat: r => String(urinish(bs(r)) ?? ''), son: r => urinish(bs(r)) }, ...txb, ball];
  });
}

/** Mavzular (kichik bo'limlar): har fan ichida mavzu — to'g'ri javoblar soni. */
function mavzuRoyxati(k: HisobotKirish): { fan: string; mavzu: string; jami: number }[] {
  const m = new Map<string, { fan: string; mavzu: string; jami: number }>();
  for (const r of k.royxat) for (const x of r.mavzular) {
    const kalit = `${x.fan}|${x.mavzu}`;
    if (!m.has(kalit)) m.set(kalit, { fan: x.fan, mavzu: x.mavzu || 'Mavzusiz', jami: x.jami });
    else m.get(kalit)!.jami = Math.max(m.get(kalit)!.jami, x.jami);
  }
  const fanTartibi = k.exam.blocks.map(b => b.subject);
  return [...m.values()].sort((a, b) => ((fanTartibi.indexOf(a.fan) + 1 || 99) - (fanTartibi.indexOf(b.fan) + 1 || 99)) || a.mavzu.localeCompare(b.mavzu, 'uz'));
}

function mavzuUstunlari(k: HisobotKirish): Ustun[] {
  return mavzuRoyxati(k).map(x => {
    const ol = (r: HisobotNatija) => r.mavzular.find(y => y.fan === x.fan && (y.mavzu || 'Mavzusiz') === x.mavzu);
    return { sar: `${esc(x.mavzu)} <small>(${x.jami})</small>`, guruh: x.fan, m: true, qiymat: r => String(ol(r)?.togri ?? ''), son: r => ol(r)?.togri ?? null };
  });
}

function jadvalHtml(k: HisobotKirish, ustunlar: Ustun[], l: HisobotNatija[], xulosa = k.s.xulosa): string {
  const guruhli = ustunlar.some(u => u.guruh);
  let bosh = '';
  if (guruhli) {
    const yuqori: string[] = [];
    for (let i = 0; i < ustunlar.length;) {
      const g = ustunlar[i].guruh;
      if (!g) { yuqori.push(`<th rowspan="2"${ustunlar[i].m ? ' class="m"' : ''}>${ustunlar[i].sar}</th>`); i++; continue; }
      let j = i;
      while (j < ustunlar.length && ustunlar[j].guruh === g) j++;
      yuqori.push(`<th class="m" colspan="${j - i}">${esc(g)}</th>`);
      i = j;
    }
    bosh = `<tr>${yuqori.join('')}</tr><tr>${ustunlar.filter(u => u.guruh).map(u => `<th class="m kichik">${u.sar}</th>`).join('')}</tr>`;
  } else bosh = `<tr>${ustunlar.map(u => `<th${u.m ? ' class="m"' : ''}>${u.sar}</th>`).join('')}</tr>`;
  const qatorlar = l.map((r, i) => `<tr>${ustunlar.map(u => `<td${u.m ? ' class="m"' : ''}>${u.qalin ? `<b>${u.qiymat(r, i)}</b>` : u.qiymat(r, i)}</td>`).join('')}</tr>`).join('');
  let oxiri = '';
  if (xulosa && l.length) {
    const birinchiSon = Math.max(1, ustunlar.findIndex(u => u.son));
    const qator = (nom: string, f: (x: number[]) => number) => `<tr class="xulosa"><td colspan="${birinchiSon}">${nom}</td>${ustunlar.slice(birinchiSon).map(u => {
      if (!u.son) return '<td></td>';
      const sonlar = l.map(u.son).filter((x): x is number => x != null && Number.isFinite(x));
      return `<td class="m">${sonlar.length ? v(f(sonlar)) : ''}</td>`;
    }).join('')}</tr>`;
    oxiri = qator("O'rtacha", x => x.reduce((a, b) => a + b, 0) / x.length) + qator('Eng yuqori', x => Math.max(...x)) + qator('Eng past', x => Math.min(...x));
    if (k.exam.settings.otish) {
      const otdi = l.filter(r => otdimi(k, r)).length;
      oxiri += `<tr class="xulosa"><td colspan="${ustunlar.length}">O'tdi: <b>${otdi}</b> (${Math.round((otdi / l.length) * 100)}%) · O'tmadi: <b>${l.length - otdi}</b> · o'tish bali ${v(k.exam.settings.otish.qiymat)}${k.exam.settings.otish.turi === 'foiz' ? '%' : ' ball'}</td></tr>`;
    }
  }
  return `<table><thead>${bosh}</thead><tbody>${qatorlar}</tbody>${oxiri ? `<tfoot>${oxiri}</tfoot>` : ''}</table>`;
}

const ortachaMatn = (l: HisobotNatija[]) => (l.length ? `o'rtacha ${v(l.reduce((a, r) => a + r.score, 0) / l.length)} ball` : '');

// --- Chop etish (PDF) ----------------------------------------------------------

const BALL_NOMI: Partial<Record<HisobotTuri, string>> = {
  1111: "Ball ro'yxati", 1112: "Ball ro'yxati — fanlar bo'yicha", 1113: "Ball ro'yxati — to'g'ri / xato / bo'sh",
  1114: "Ball ro'yxati — kengaytirilgan", 1121: "Ball ro'yxati — mavzular bo'yicha",
};

/** 1111–1114, 1121: ustunli ball ro'yxati (har kurs alohida bo'lishi mumkin). */
export function ballRoyxatiHtml(k: HisobotKirish, turi: '1111' | '1112' | '1113' | '1114' | '1121'): string {
  const orta = turi === '1112' ? [...blokUstunlari(k, 1), ...qoshimchaUstunlar(k)]
    : turi === '1113' ? blokUstunlari(k, 3)
      : turi === '1114' ? [...blokUstunlari(k, 5), ...qoshimchaUstunlar(k)]
        : turi === '1121' ? mavzuUstunlari(k) : [];
  const ustunlar = [...asosUstunlar(k), ...orta, ...yakunUstunlar(k)];
  // Ustun ko'p bo'lsa — yotiq varaq.
  const yotiq = ustunlar.length > 16;
  const izoh = turi === '1114' ? '<p class="belgilar">U — urinilgan (javob berilgan), T — to\'g\'ri, X — xato, B — bo\'sh.</p>'
    : turi === '1113' ? '<p class="belgilar">T — to\'g\'ri, X — xato, B — bo\'sh.</p>'
      : turi === '1121' ? '<p class="belgilar">Har mavzuda to\'g\'ri javoblar soni; qavsda — mavzudagi savollar soni.</p>' : '';
  return guruhlar(k).map(g => `<section class="bet${yotiq ? ' yotiq' : ''}">${sarlavha(k, BALL_NOMI[turi]!, `${g.nom ? `${esc(g.nom)} · ` : ''}${g.l.length} kishi · ${ortachaMatn(g.l)}`)}
    ${izoh}${jadvalHtml(k, ustunlar, g.l)}</section>`).join('');
}

/** 1115 / 1116 — ikki qismli ro'yxat: bet ikki ustunga bo'linadi (qog'oz tejaladi). */
export function ikkiQismliHtml(k: HisobotKirish, kengaytirilgan: boolean): string {
  const u = new Set(k.s.ustunlar);
  const ustunlar: Ustun[] = [
    { sar: '№', m: true, qiymat: (_, i) => String(i + 1) },
    ...(u.has('orin') ? [{ sar: "O'rin", m: true, qalin: true, qiymat: (r: HisobotNatija) => String(orni(r, k) ?? '') }] : []),
    ...(u.has('id') ? [{ sar: 'ID', m: true, qiymat: (r: HisobotNatija) => `<span class="mono">${r.kod ?? ''}</span>` }] : []),
    { sar: 'Familiya va ism', qiymat: r => esc(r.name) },
    ...(kengaytirilgan && u.has('kurs') && !k.s.kursSahifa ? [{ sar: 'Kurs', qiymat: (r: HisobotNatija) => esc(r.groupName) }] : []),
    ...(kengaytirilgan ? blokUstunlari(k, 1).map((x, bi) => ({ ...x, sar: esc(k.exam.blocks[bi].subject.slice(0, 10)) })) : []),
    ...yakunUstunlar(k).filter(x => x.sar !== 'Persentil' && x.sar !== 'Rasch' && x.sar !== 'Daraja'),
  ];
  const yarim = kengaytirilgan ? 42 : 48;
  return guruhlar(k).map(g => {
    const betlar: string[] = [];
    for (let bosh = 0; bosh < g.l.length || bosh === 0; bosh += yarim * 2) {
      const chap = g.l.slice(bosh, bosh + yarim);
      const ong = g.l.slice(bosh + yarim, bosh + yarim * 2);
      const qism = (l: HisobotNatija[], dan: number) => (l.length ? jadvalHtml(k, ustunlar.map(x => (x.sar === '№' ? { ...x, qiymat: (_: HisobotNatija, i: number) => String(dan + i + 1) } : x)), l, false) : '<div></div>');
      betlar.push(`<section class="bet">${bosh === 0
        ? sarlavha(k, "Ball ro'yxati", `${g.nom ? `${esc(g.nom)} · ` : ''}${g.l.length} kishi · ${ortachaMatn(g.l)}`)
        : `<div class="davomi">${esc(k.exam.name)}${g.nom ? ` · ${esc(g.nom)}` : ''} — davomi</div>`}
        <div class="ikki${kengaytirilgan ? ' keng' : ''}">${qism(chap, bosh)}${qism(ong, bosh + yarim)}</div></section>`);
      if (!g.l.length) break;
    }
    return betlar.join('');
  }).join('');
}

/** 1211 — har o'quvchi: har savolga javobi, natija belgisi va (ruxsat bo'lsa) kalit. */
export function javoblarBolaklari(k: HisobotKirish): { r: HisobotNatija; html: string }[] {
  const tuz = varaqTuzilmasi(k.exam.blocks, k.exam.scoring) as { bloklar: { nomi: string; boshi: number; oxiri: number }[]; savollar: { n: number; y?: string }[] };
  const yorliq = (n: number) => tuz.savollar[n - 1]?.y ?? String(n);
  const belgi = (h: string) => (h === 'togri' ? '✓' : h === 'bosh' ? '–' : h === 'bekor' ? '∗' : h === 'qisman' ? '½' : h === 'ortiqcha' ? '○' : '✗');
  return guruhlar(k).flatMap(g => g.l).map(r => {
    const kalit = k.malumot.kalit?.[`${r.session ?? 1}|${r.variant}`];
    const dmap = new Map(r.detail.map(d => [d.n, d]));
    const bloklar = tuz.bloklar.map((b, bi) => {
      const kataklar: string[] = [];
      for (let n = b.boshi; n <= b.oxiri; n++) {
        const d = dmap.get(n);
        const h = d?.holat || 'bosh';
        kataklar.push(`<div class="kt ${h}"><span class="n">${esc(yorliq(n))}</span><b>${esc(d?.javob || '')}</b><i>${belgi(h)}</i>${kalit ? `<small>${esc(kalit[n] || '')}</small>` : ''}</div>`);
      }
      const bs = r.blockScores[bi];
      return `<div class="blok"><div class="bn">${esc(b.nomi)} <span>${bs ? `${v(bs.earned)} / ${v(bs.max)} · T ${bs.togri ?? ''} · X ${bs.xato ?? ''} · B ${bs.bosh ?? ''}` : ''}</span></div><div class="kataklar">${kataklar.join('')}</div></div>`;
    }).join('');
    const h = otdimi(k, r);
    return {
      r, html: `<section class="bet kichik-bet">${sarlavha(k, "O'quvchi javoblari")}
      <div class="egasi"><b>${esc(r.name)}</b><span>ID ${r.kod ?? '—'}</span><span>${esc(r.groupName)}</span><span>Variant ${esc(r.variant || '—')}</span>
      <span>Ball <b>${v(r.score)}</b> (${v(r.percentage)}%)</span><span>O'rin ${r.rank ?? '—'}</span>${h != null ? `<span class="${h ? 'otdi' : 'otmadi'}">${holatMatni(h)}</span>` : ''}</div>
      <p class="belgilar">✓ to'g'ri · ✗ xato · – bo'sh · ∗ bekor qilingan · ○ ortiqcha (hisobga olinmadi)${kalit ? ' · kichik harf — kalit' : ''}</p>${bloklar}</section>`,
    };
  });
}

/** 1221 — shaxsiy hisobot: ball, o'rin, persentil, fanlar, mavzular va oldingi imtihonlar. */
export function shaxsiyBolaklar(k: HisobotKirish): { r: HisobotNatija; html: string }[] {
  const pers = persentillar(k.malumot.natijalar);
  const jami = k.malumot.natijalar.length;
  const ortacha = jami ? k.malumot.natijalar.reduce((a, r) => a + r.percentage, 0) / jami : 0;
  const ustun = (f: number, rang = '#1b6b6b') => `<div class="bar"><div style="width:${Math.max(0, Math.min(100, f))}%;background:${rang}"></div></div>`;
  return guruhlar(k).flatMap(g => g.l).map(r => {
    const fanlar = r.blockScores.map(b => {
      const f = b.max ? (b.earned / b.max) * 100 : 0;
      return `<tr><td>${esc(b.subject)}</td><td class="m">${v(b.earned)} / ${v(b.max)}</td><td class="m">${b.togri ?? ''}</td><td class="m">${b.xato ?? ''}</td><td class="m">${b.bosh ?? ''}</td><td>${ustun(f, rang(f))}</td><td class="m">${Math.round(f)}%</td></tr>`;
    }).join('');
    const mavzular = [...r.mavzular].map(m => ({ ...m, f: m.jami ? (m.togri / m.jami) * 100 : 0 })).sort((a, b) => a.f - b.f);
    const zaif = mavzular.filter(m => m.f < 50).slice(0, 3);
    const tarix = tarixi(k, r);
    const dinamika = tarix.length > 1 ? `<h3>Oldingi imtihonlar</h3><div class="dinamika">${tarix.map(t => `<div class="dt${t.examId === k.exam.id ? ' joriy' : ''}"><div class="dc"><div style="height:${Math.max(2, t.foiz)}%;background:${rang(t.foiz)}"></div></div><b>${Math.round(t.foiz)}%</b><span>${esc(t.sana)}</span></div>`).join('')}</div>` : '';
    const h = otdimi(k, r);
    return {
      r, html: `<section class="bet">${sarlavha(k, 'Shaxsiy natija hisoboti')}
      <div class="egasi katta"><b>${esc(r.name)}</b><span>ID ${r.kod ?? '—'}</span><span>${esc(r.groupName)}</span>${k.filialNomi(r.schoolId) ? `<span>${esc(k.filialNomi(r.schoolId))}</span>` : ''}</div>
      <div class="kartalar">
        <div class="kr"><span>Ball</span><b>${v(r.score)}</b><small>/ ${v(k.exam.maxScore)}</small></div>
        <div class="kr"><span>Foiz</span><b>${v(r.percentage)}%</b><small>o'rtacha ${Math.round(ortacha)}%</small></div>
        <div class="kr"><span>O'rin</span><b>${r.rank ?? '—'}</b><small>${jami} kishidan${r.rankGroup ? ` · kursda ${r.rankGroup}` : ''}</small></div>
        <div class="kr"><span>Persentil</span><b>${pers.get(r.id) ?? '—'}</b><small>qatnashchilarning ${pers.get(r.id) ?? 0}% idan yaxshi</small></div>
        ${h != null ? `<div class="kr ${h ? 'otdi' : 'otmadi'}"><span>Holat</span><b>${holatMatni(h)}</b><small>o'tish bali ${v(k.exam.settings.otish!.qiymat)}${k.exam.settings.otish!.turi === 'foiz' ? '%' : ''}</small></div>` : ''}
        ${r.grade ? `<div class="kr"><span>Daraja</span><b>${esc(r.grade)}</b><small>Rasch ${v(r.raschScore)}</small></div>` : ''}
      </div>
      <h3>Fanlar bo'yicha</h3>
      <table><tr><th>Fan</th><th class="m">Ball</th><th class="m">To'g'ri</th><th class="m">Xato</th><th class="m">Bo'sh</th><th style="width:45mm"></th><th class="m">%</th></tr>${fanlar}</table>
      ${mavzular.length ? `<h3>Mavzular bo'yicha</h3><table><tr><th>Mavzu</th><th class="m">Savol</th><th class="m">To'g'ri</th><th style="width:45mm"></th><th class="m">%</th></tr>
        ${mavzular.map(m => `<tr><td>${esc(m.mavzu || m.fan)}${m.mavzu ? ` <small>· ${esc(m.fan)}</small>` : ''}</td><td class="m">${m.jami}</td><td class="m">${m.togri}</td><td>${ustun(m.f, rang(m.f))}</td><td class="m">${Math.round(m.f)}%</td></tr>`).join('')}</table>` : ''}
      ${zaif.length ? `<p class="tavsiya"><b>Takrorlash kerak:</b> ${zaif.map(m => esc(m.mavzu || m.fan)).join(', ')}</p>` : ''}
      ${dinamika}</section>`,
    };
  });
}

const rang = (f: number) => (f >= 70 ? '#2e7d32' : f >= 40 ? '#b7791f' : '#c62828');

/** O'quvchining imtihonlar tarixi (e'lon qilinganlari) + shu imtihon, sana bo'yicha, oxirgi 10 tasi. */
function tarixi(k: HisobotKirish, r: HisobotNatija) {
  const t = r.studentId ? [...(k.malumot.tarix[r.studentId] || [])] : [];
  if (!t.some(x => x.examId === k.exam.id)) t.push({ examId: k.exam.id, nomi: k.exam.name, sana: k.exam.date, foiz: r.percentage });
  return t.sort((a, b) => String(a.sana).localeCompare(String(b.sana))).slice(-10);
}

/** 1231 — o'sish grafigi: har o'quvchining bir necha imtihondagi foizi (chiziqli grafik va jadval). */
export function osishBolaklari(k: HisobotKirish): { r: HisobotNatija; html: string }[] {
  return guruhlar(k).flatMap(g => g.l).map(r => {
    const t = tarixi(k, r);
    const W = 170, H = 46; // mm
    const x = (i: number) => (t.length < 2 ? W / 2 : 8 + (i * (W - 16)) / (t.length - 1));
    const y = (f: number) => H - 6 - (Math.max(0, Math.min(100, f)) / 100) * (H - 12);
    const nuqtalar = t.map((p, i) => `${x(i).toFixed(1)},${y(p.foiz).toFixed(1)}`).join(' ');
    const ozgarish = t.length > 1 ? t[t.length - 1].foiz - t[t.length - 2].foiz : null;
    const svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" xmlns="http://www.w3.org/2000/svg">
      ${[0, 50, 100].map(f => `<line x1="6" x2="${W - 4}" y1="${y(f)}" y2="${y(f)}" stroke="#ddd" stroke-width=".3"/><text x="1" y="${y(f) + 1}" font-size="2.6" fill="#777">${f}</text>`).join('')}
      ${t.length > 1 ? `<polyline points="${nuqtalar}" fill="none" stroke="#1b6b6b" stroke-width=".8"/>` : ''}
      ${t.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.foiz)}" r="1.3" fill="${p.examId === k.exam.id ? '#c62828' : '#1b6b6b'}"/><text x="${x(i)}" y="${y(p.foiz) - 2.4}" font-size="2.8" text-anchor="middle" font-weight="700">${Math.round(p.foiz)}</text>`).join('')}
    </svg>`;
    return {
      r, html: `<section class="bet kichik-bet osish">${sarlavha(k, "O'sish grafigi")}
      <div class="egasi"><b>${esc(r.name)}</b><span>ID ${r.kod ?? '—'}</span><span>${esc(r.groupName)}</span><span>${t.length} ta imtihon</span>
        ${ozgarish != null ? `<span class="${ozgarish >= 0 ? 'otdi' : 'otmadi'}">${ozgarish >= 0 ? '▲' : '▼'} ${v(Math.abs(ozgarish))}% oldingisiga nisbatan</span>` : ''}</div>
      ${svg}
      <table class="ixcham"><tr><th>Imtihon</th>${t.map(p => `<th class="m">${esc(p.sana)}</th>`).join('')}</tr>
        <tr><td>Nomi</td>${t.map(p => `<td class="m"><small>${esc(p.nomi.slice(0, 22))}</small></td>`).join('')}</tr>
        <tr><td>Foiz</td>${t.map(p => `<td class="m"><b>${v(p.foiz)}</b></td>`).join('')}</tr></table></section>`,
    };
  });
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
  const l = [...k.tahlil].sort((a, b) => a.b - b.b);
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

// --- Birlashtirish (Merge test) -------------------------------------------------

export interface BirlashQatori { kalit: string; kod: number | null; name: string; groupName: string; birinchi: number | null; ikkinchi: number | null; jami: number; foiz: number; orin: number }
const birlashKaliti = (r: HisobotNatija) => (r.studentId ? `s${r.studentId}` : `g${r.name.trim().toLowerCase()}`);

/** Ikki imtihon natijalari o'quvchi bo'yicha (tashqi qatnashchi — ismi bo'yicha) qo'shiladi, o'rin jami bo'yicha. */
export function birlashtir(k: HisobotKirish): BirlashQatori[] {
  const ik = k.ikkinchi;
  if (!ik) return [];
  const m = new Map<string, BirlashQatori>();
  for (const r of k.royxat) m.set(birlashKaliti(r), { kalit: birlashKaliti(r), kod: r.kod, name: r.name, groupName: r.groupName, birinchi: r.score, ikkinchi: null, jami: 0, foiz: 0, orin: 0 });
  const filtr = new Set(k.royxat.map(birlashKaliti));
  for (const r of ik.natijalar) {
    const x = m.get(birlashKaliti(r));
    if (x) x.ikkinchi = r.score;
    // Kurs/ID filtri birinchi imtihon ro'yxatiga qo'llangan: faqat birinchisida yo'q, lekin filtrsiz holatda qo'shiladi.
    else if (!filtr.size || k.royxat.length === k.malumot.natijalar.length) m.set(birlashKaliti(r), { kalit: birlashKaliti(r), kod: r.kod, name: r.name, groupName: r.groupName, birinchi: null, ikkinchi: r.score, jami: 0, foiz: 0, orin: 0 });
  }
  const maks = (k.exam.maxScore || 0) + (ik.maxScore || 0);
  const l = [...m.values()].map(x => ({ ...x, jami: yaxlit((x.birinchi || 0) + (x.ikkinchi || 0)) }))
    .map(x => ({ ...x, foiz: maks ? Math.round((x.jami / maks) * 1000) / 10 : 0 }))
    .sort((a, b) => b.jami - a.jami || a.name.localeCompare(b.name, 'uz'));
  const orin = reytingOrinlari(l.map(x => ({ id: x.kalit, score: x.jami })), undefined, k.exam.settings.orinUsuli).orin as Map<string, number>;
  l.forEach(x => { x.orin = orin.get(x.kalit) || 0; });
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

export const HISOBOT_CSS = `
@page { size: A4; margin: 11mm; }
@page yotiq { size: A4 landscape; margin: 9mm; }
html, body { margin: 0; background: #fff; }
body { font: 9.5pt/1.3 Arial, Helvetica, sans-serif; color: #000; }
.bet { break-after: page; }
.bet:last-child { break-after: auto; }
.bet.yotiq { page: yotiq; }
.bet.yotiq table { font-size: 7.3pt; }
.hs { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1.2pt solid #000; padding-bottom: 2mm; margin-bottom: 3mm; }
.hs .markaz { font-size: 8.5pt; color: #444; text-transform: uppercase; letter-spacing: .5pt; }
.hs h1 { font-size: 15pt; margin: .5mm 0; }
.hs .izoh, .hs .sana { font-size: 8.5pt; color: #333; }
.davomi { font-size: 8.5pt; color: #444; border-bottom: .6pt solid #999; margin-bottom: 2mm; padding-bottom: 1mm; }
table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
th, td { border: .5pt solid #555; padding: 1.1mm 1.5mm; text-align: left; vertical-align: top; }
th { background: #eee; font-size: 8.5pt; }
thead { display: table-header-group; }
tfoot { display: table-row-group; }
tr { break-inside: avoid; }
tr.xulosa td { background: #f4f4f4; font-weight: 700; }
.yotiq th, .yotiq td { padding: .6mm .7mm; }
.yotiq th { font-size: 7pt; }
.yotiq th.kichik { font-size: 6.3pt; padding: .4mm .3mm; overflow-wrap: anywhere; }
.m { text-align: center; }
.mono { font-family: 'Courier New', monospace; }
th.kichik { font-size: 7.5pt; padding: .5mm; }
th small { font-weight: normal; color: #555; }
.ikki { display: flex; gap: 4mm; align-items: flex-start; }
.ikki > * { flex: 1; min-width: 0; }
.ikki table { font-size: 8pt; }
.ikki th, .ikki td { padding: .7mm 1.2mm; }
.ikki.keng table { font-size: 7.2pt; }
.otdi { color: #1b5e20; font-weight: 700; }
.otmadi { color: #b71c1c; font-weight: 700; }
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
.osish svg { display: block; margin: 1mm 0 2mm; }
table.ixcham td, table.ixcham th { padding: .6mm 1mm; font-size: 8pt; }
.kartalar { display: flex; gap: 3mm; margin: 2mm 0 3mm; }
.kr { flex: 1; border: .6pt solid #555; border-radius: 2mm; padding: 2mm; text-align: center; }
.kr span { display: block; font-size: 8pt; color: #444; text-transform: uppercase; }
.kr b { display: block; font-size: 18pt; }
.kr.otdi b, .kr.otmadi b { font-size: 13pt; padding: 1.5mm 0; }
.kr small { font-size: 7.5pt; color: #555; }
.bar { height: 3mm; background: #eee; border-radius: 1mm; overflow: hidden; }
.bar div { height: 100%; }
.tavsiya { border-left: 2pt solid #b7791f; padding: 1.5mm 3mm; background: #fff8e1; }
.dinamika { display: flex; gap: 3mm; align-items: flex-end; height: 38mm; }
.dt { flex: 1; display: flex; flex-direction: column; align-items: center; font-size: 7.5pt; }
.dt .dc { height: 28mm; width: 8mm; background: #f2f2f2; display: flex; align-items: flex-end; }
.dt .dc div { width: 100%; }
.dt.joriy b { text-decoration: underline; }
.savol { font-size: 7.5pt; color: #555; }
tr.shubha td { background: #fdecea; }
td small { color: #555; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

// --- Excel ----------------------------------------------------------------------

export function excelYukla(k: HisobotKirish, turi: HisobotTuri) {
  const u = new Set(k.s.ustunlar);
  const bloklar = k.exam.blocks.map(b => b.subject);
  const pers = persentillar(k.malumot.natijalar);
  const wb = XLSX.utils.book_new();
  const varaq = (nom: string, qatorlar: Record<string, unknown>[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qatorlar.length ? qatorlar : [{ '': "Ma'lumot yo'q" }]), nom.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  const kopFilial = (k.exam.branchIds || []).length > 0;
  const asos = (r: HisobotNatija, i: number): Record<string, unknown> => ({
    '№': i + 1,
    ...(u.has('orin') ? { "O'rin": orni(r, k) ?? '' } : {}),
    ...(u.has('id') ? { ID: r.kod ?? '' } : {}),
    'Familiya va ism': r.name,
    ...(u.has('kurs') ? { Kurs: r.groupName } : {}),
    ...(u.has('filial') && kopFilial ? { Filial: k.filialNomi(r.schoolId) } : {}),
    ...(u.has('variant') ? { Variant: r.variant || '' } : {}),
  });
  const yakun = (r: HisobotNatija): Record<string, unknown> => ({
    ...(u.has('ball') ? { Ball: r.score } : {}),
    ...(u.has('foiz') ? { 'Foiz (%)': r.percentage } : {}),
    ...(u.has('persentil') ? { Persentil: pers.get(r.id) } : {}),
    ...(u.has('rasch') && k.exam.settings.rasch.enabled ? { Rasch: r.raschScore, Daraja: r.grade } : {}),
    ...(u.has('holat') && k.exam.settings.otish ? { Holat: holatMatni(otdimi(k, r)) } : {}),
  });
  const qoshimcha = (r: HisobotNatija, o: Record<string, unknown>) => { for (const q of k.exam.settings.qoshimcha || []) o[q.nom] = r.extra?.[q.nom] ?? ''; };
  const royxat = guruhlar(k).flatMap(g => g.l);
  const tuz = varaqTuzilmasi(k.exam.blocks, k.exam.scoring) as { jami: number; savollar: { n: number; y?: string }[] };
  /** Excel ustuni nomi: savolning ko'rinadigan raqami ("36a"). */
  const ustun = (n: number) => tuz.savollar[n - 1]?.y ?? String(n);
  const hammasi = turi === '2331';
  if (turi === '2111' || hammasi) varaq("Ball ro'yxati", royxat.map((r, i) => ({ ...asos(r, i), ...yakun(r) })));
  if (turi === '2112') {
    varaq('Fanlar', royxat.map((r, i) => {
      const o = asos(r, i);
      bloklar.forEach((b, bi) => { o[b] = r.blockScores[bi]?.earned ?? ''; });
      qoshimcha(r, o);
      return { ...o, ...yakun(r) };
    }));
  }
  if (turi === '2113' || hammasi) {
    varaq('Kengaytirilgan', royxat.map((r, i) => {
      const o = asos(r, i);
      bloklar.forEach((b, bi) => {
        const x = r.blockScores[bi];
        o[`${b} U`] = urinish(x) ?? ''; o[`${b} T`] = x?.togri ?? ''; o[`${b} X`] = x?.xato ?? ''; o[`${b} B`] = x?.bosh ?? ''; o[`${b} ball`] = x?.earned ?? '';
      });
      qoshimcha(r, o);
      return { ...o, ...yakun(r) };
    }));
  }
  if (turi === '2116') {
    const n = Math.max(1, Math.min(500, k.s.topN || 10));
    bloklar.forEach((b, bi) => {
      const l = royxat.filter(r => r.blockScores[bi]).sort((a, c) => (c.blockScores[bi].earned - a.blockScores[bi].earned) || a.name.localeCompare(c.name, 'uz'));
      const orin = reytingOrinlari(l.map(r => ({ id: r.id, score: r.blockScores[bi].earned })), undefined, k.exam.settings.orinUsuli).orin as Map<number, number>;
      const chegara = l[n - 1] ? orin.get(l[n - 1].id)! : Infinity;
      varaq(`${bi + 1}. ${b}`, l.filter(r => orin.get(r.id)! <= chegara).map((r, i) => ({
        '№': i + 1, "O'rin": orin.get(r.id), ID: r.kod ?? '', 'Familiya va ism': r.name, Kurs: r.groupName,
        Ball: r.blockScores[bi].earned, Maks: r.blockScores[bi].max, 'Foiz (%)': r.blockScores[bi].max ? yaxlit((r.blockScores[bi].earned / r.blockScores[bi].max) * 100) : '',
        "To'g'ri": r.blockScores[bi].togri ?? '', Xato: r.blockScores[bi].xato ?? '', "Bo'sh": r.blockScores[bi].bosh ?? '',
      })));
    });
  }
  if (turi === '2121' || hammasi) {
    const mavzular = mavzuRoyxati(k);
    varaq('Mavzular', royxat.map((r, i) => {
      const o = asos(r, i);
      for (const x of mavzular) o[`${x.fan} · ${x.mavzu} (${x.jami})`] = r.mavzular.find(y => y.fan === x.fan && (y.mavzu || 'Mavzusiz') === x.mavzu)?.togri ?? '';
      return { ...o, ...yakun(r) };
    }));
  }
  if (turi === '2211' || turi === '2212' || hammasi) {
    const harf = (h: string) => ({ togri: 'T', bosh: 'B', bekor: '*', ortiqcha: 'O', qisman: 'Q', baholanmagan: '?' } as Record<string, string>)[h] || 'X';
    const rwl = turi === '2212';
    varaq(rwl ? 'Javoblar (T-X-B)' : 'Javoblar', royxat.map((r, i) => {
      const o = asos(r, i);
      const d = new Map(r.detail.map(x => [x.n, x]));
      for (let n = 1; n <= tuz.jami; n++) { const x = d.get(n); o[ustun(n)] = rwl ? harf(x?.holat || 'bosh') : x?.javob || ''; }
      if (rwl) { o["To'g'ri"] = r.detail.filter(x => x.holat === 'togri').length; o.Xato = r.detail.filter(x => x.holat === 'xato').length; o["Bo'sh"] = r.detail.filter(x => x.holat === 'bosh').length; }
      return o;
    }));
  }
  if (turi === '2213' && k.ikkinchi) {
    const ikkinchi = new Map(k.ikkinchi.natijalar.map(r => [birlashKaliti(r), r]));
    const n2 = Math.max(0, ...k.ikkinchi.natijalar.flatMap(r => r.detail.map(d => d.n)));
    varaq('Ikki imtihon javoblari', royxat.map((r, i) => {
      const o = asos(r, i);
      const d1 = new Map(r.detail.map(x => [x.n, x]));
      for (let n = 1; n <= tuz.jami; n++) o[`1-${ustun(n)}`] = d1.get(n)?.javob || '';
      o['1-ball'] = r.score;
      const r2 = ikkinchi.get(birlashKaliti(r));
      const d2 = new Map((r2?.detail || []).map(x => [x.n, x]));
      for (let n = 1; n <= n2; n++) o[`2-${n}`] = d2.get(n)?.javob || '';
      o['2-ball'] = r2 ? r2.score : '';
      return o;
    }));
  }
  if (turi === '2214' || hammasi) {
    varaq("Savol bo'yicha ball", royxat.map((r, i) => {
      const o = asos(r, i);
      const d = new Map(r.detail.map(x => [x.n, x]));
      for (let n = 1; n <= tuz.jami; n++) { const x = d.get(n); o[ustun(n)] = !x || x.holat === 'bosh' ? '' : x.ball; }
      o.Jami = r.score;
      return o;
    }));
  }
  if ((turi === '2311' || hammasi) && k.malumot.kalit) {
    varaq('Kalit', Object.entries(k.malumot.kalit).map(([kod, javoblar]) => {
      const [smena, variant] = kod.split('|');
      const o: Record<string, unknown> = { Smena: smena, Variant: variant };
      for (let n = 1; n <= tuz.jami; n++) o[ustun(n)] = javoblar[n] || '';
      return o;
    }));
  }
  if (turi === '2411' && k.ikkinchi) {
    varaq('Birlashtirilgan', birlashtir(k).map((x, i) => ({
      '№': i + 1, "O'rin": x.orin, ID: x.kod ?? '', 'Familiya va ism': x.name, Kurs: x.groupName,
      [k.exam.name]: x.birinchi ?? '', [k.ikkinchi!.nomi]: x.ikkinchi ?? '', Jami: x.jami, 'Foiz (%)': x.foiz,
    })));
  }
  if (turi === '2321' || hammasi) {
    varaq('Kelmaganlar', k.kelmaganlar.map((x, i) => ({ '№': i + 1, ID: x.kod ?? '', 'Familiya va ism': x.name, Kurs: x.groupName, Telefon: x.phone || '', Xona: x.roomName, Holat: x.status })));
  }
  XLSX.writeFile(wb, `${k.exam.name} — ${turi} ${HISOBOT_TURLARI.find(x => x.v === turi)?.nom || 'hisobot'}.xlsx`.replace(/[\\/:*?"<>|]/g, ' '));
}
