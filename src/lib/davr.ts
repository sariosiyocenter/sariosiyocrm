import { toDateStr } from '../../lib/lessons.js';

/**
 * Davr tanlagichi (Kun / Hafta / Shu oy …) — Toshkent vaqti bo'yicha.
 *
 * Ilgari Moliya va Bosh sahifa sanani brauzerning `toISOString()` (UTC) bilan
 * olardi: mahalliy yarim tun UTC da kechagi kun 19:00 — "Shu oy" o'tgan oyning
 * 31-kunidan, "Shu yil" 31-dekabrdan boshlanardi, ertalab 5 gacha "Kun" esa
 * kechani ko'rsatardi (2026-09-30 tekshiruvi).
 */
export type Davr = 'today' | 'this_week' | 'this_month' | 'last_30' | 'this_year' | 'all' | 'custom';

const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** UTC kalendar sanasi — mahalliy soat mintaqasiga bog'liq emas. */
const kun = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

/** Davrning birinchi va oxirgi kuni ("YYYY-MM-DD", ikkalasi ham kiradi). */
export function davrOraligi(tur: Exclude<Davr, 'custom'>, bugun: string = toDateStr()): { start: string; end: string } {
    const [y, m, d] = bugun.split('-').map(Number);
    switch (tur) {
        case 'today': return { start: bugun, end: bugun };
        case 'this_week': {
            // Hafta dushanbadan (getUTCDay: yakshanba — 0).
            const shift = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
            return { start: kun(y, m, d - shift), end: bugun };
        }
        case 'this_month': return { start: `${bugun.slice(0, 8)}01`, end: bugun };
        case 'last_30': return { start: kun(y, m, d - 29), end: bugun };
        case 'this_year': return { start: `${y}-01-01`, end: bugun };
        case 'all': return { start: '2000-01-01', end: bugun };
    }
}

/** Davr nomi: "Sentabr 2026", "Bugun", "01.09 — 15.09" … */
export function davrNomi(tur: Davr, start: string, end: string): string {
    const qisqa = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}`;
    const oy = (s: string) => OYLAR[Number(s.slice(5, 7)) - 1] || s;
    switch (tur) {
        case 'today': return 'Bugun';
        case 'this_week': return 'Shu hafta';
        case 'this_month': { const o = oy(start); return `${o.charAt(0).toUpperCase()}${o.slice(1)} ${start.slice(0, 4)}`; }
        case 'last_30': return 'Oxirgi 30 kun';
        case 'this_year': return `${start.slice(0, 4)} yil`;
        case 'all': return 'Barcha vaqt';
        default: return start === end ? qisqa(start) : `${qisqa(start)} — ${qisqa(end)}`;
    }
}

/** Oldingi teng davr — o'zgarishni ko'rsatish uchun. */
export function oldingiDavr(start: string, end: string): { start: string; end: string } {
    const a = Date.parse(start + 'T00:00:00Z'), b = Date.parse(end + 'T00:00:00Z');
    const kunlar = Math.round((b - a) / 86400000) + 1;
    const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
    return { start: iso(a - kunlar * 86400000), end: iso(a - 86400000) };
}

/** Davrga tushgan oylar ("YYYY-MM"), eskisidan. */
export function davrOylari(start: string, end: string): string[] {
    const out: string[] = [];
    let [y, m] = start.slice(0, 7).split('-').map(Number);
    const [ey, em] = end.slice(0, 7).split('-').map(Number);
    while ((y < ey || (y === ey && m <= em)) && out.length < 400) {
        out.push(`${y}-${String(m).padStart(2, '0')}`);
        m++; if (m > 12) { m = 1; y++; }
    }
    return out;
}
