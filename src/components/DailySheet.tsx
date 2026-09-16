import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, CalendarDays, Info } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import type { Attendance, Group, Student } from '../types';
import { lessonDatesBetween, isLessonDay } from '../../lib/lessons.js';
import { allocate, groupRows, withOpening } from '../../lib/allocation.js';

/**
 * Kunlik ro'yxat — o'qituvchilar har kuni chop etadigan varaq.
 *
 * Markazning eski Excel faylidagi "Kunlik-Monitoring" varag'i bilan bir xil
 * tuzilishda (egasi, 2026-09-16: "o'qituvchilar shunga o'rganib qolgan"):
 *   N · FIO · Dav (bugun, qo'lda belgilanadi) · Dav × 4 (oxirgi darslar) ·
 *   FAN · TEL NOMERLARI · Vada/Kommentariya · SINOV · OXIRGI TEST · Reyting · QARZ
 * va tepada "UMUMIY QARZDORLIK". Excel'dagi SINFI ustuni egasining so'zi bilan
 * olib tashlandi; GURUH ustuni o'rniga har kurs alohida varaqda chiqadi.
 *
 * Chop etish alohida iframe'da: varaq ilova ichida (#root) turadi va
 * `@media print` bilan qolganini yashirish oq varaq chiqarardi (lib/receipt.ts).
 */

const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const HAFTA = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

// Davomat belgisi — Excel'dagidek: + keldi, − kelmadi, x dars bo'lmadi.
const BELGI: Record<string, string> = {
    Keldi: '+', Kelmapdi: '−', Sababli: 'S', Kechikdi: 'K', ErtaKetdi: 'E', "Dars bo'lmadi": 'x',
};

const HOLATLAR = [
    { key: 'faol-sinov', label: 'Faol va sinovdagilar', match: (s: Student) => s.status === 'Faol' || s.status === 'Sinov' },
    { key: 'Faol', label: 'Faqat faol', match: (s: Student) => s.status === 'Faol' },
    { key: 'Sinov', label: 'Faqat sinovdagilar', match: (s: Student) => s.status === 'Sinov' },
    { key: 'Muzlatilgan', label: 'Muzlatilganlar', match: (s: Student) => s.status === 'Muzlatilgan' },
    { key: 'hammasi', label: 'Hammasi', match: (_: Student) => true },
] as const;

const USTUNLAR = [
    { key: 'fan', label: 'Fan' },
    { key: 'tel', label: 'Telefonlar' },
    { key: 'izoh', label: "Va'da / izoh" },
    { key: 'sinov', label: 'Sinov' },
    { key: 'test', label: 'Oxirgi test' },
    { key: 'reyting', label: 'Reyting' },
    { key: 'qarz', label: 'Qarz' },
] as const;
type UstunKey = typeof USTUNLAR[number]['key'];
const USTUN_KEY = 'kunlik_ustunlar';

function toshkentBugun(): string {
    return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}
function kunSurish(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
const ddmm = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}`;
const ddmmyyyy = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const sum = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/\s/g, ' ');

/** "+998901234567" → "90 123 45 67". */
function tel(p?: string | null): string {
    const d = String(p || '').replace(/\D/g, '');
    const n = d.length === 12 && d.startsWith('998') ? d.slice(3) : d.length === 9 ? d : '';
    if (!n) return d ? String(p) : '';
    return `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}
const ball = (n: number | null) => (n === null ? '' : String(Math.round(n * 10) / 10));
const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Varaq uslubi ekrandagi ko'rinishda ham, chop etishda ham bir xil — ikkalasi shu CSS'dan.
const SHEET_CSS = `
.ks-sheet { background:#fff; color:#111; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; padding: 8mm 7mm; box-sizing: border-box; width: 297mm; }
.ks-sheet + .ks-sheet { break-before: page; page-break-before: always; }
.ks-top { display:grid; grid-template-columns: 1fr auto 1fr; align-items:end; border-bottom: 2px solid #111; padding-bottom: 3px; }
.ks-org { font-size: 13px; font-weight: 700; letter-spacing: .3px; }
.ks-branch { font-size: 10.5px; color:#444; font-weight: 400; }
.ks-title { font-size: 19px; font-weight: 800; letter-spacing: 3px; text-align:center; }
.ks-date { text-align:right; font-size: 12px; }
.ks-meta { display:flex; justify-content:space-between; align-items:flex-end; gap: 12px; font-size: 11.5px; margin: 5px 0 5px; }
.ks-meta b { font-weight: 700; }
.ks-debt { font-size: 12px; font-weight: 700; white-space: nowrap; }
.ks-debt span { font-weight: 400; color:#444; }
table.ks-table { width:100%; border-collapse:collapse; table-layout:fixed; font-size: 11px; }
.ks-table th, .ks-table td { border: 1px solid #444; padding: 1px 4px; height: 6.3mm; vertical-align: middle; overflow:hidden; }
.ks-table th { background:#e9eeec; font-size: 9.5px; font-weight: 700; text-align:center; line-height: 1.1; padding: 1px 2px; }
.ks-table th .ks-d { display:block; font-size: 8px; font-weight: 400; letter-spacing: -0.2px; }
.ks-table thead { display: table-header-group; }
.ks-table tr { break-inside: avoid; page-break-inside: avoid; }
.ks-c { text-align:center; }
.ks-r { text-align:right; white-space:nowrap; }
.ks-name { font-weight: 600; font-size: 10.5px; white-space:nowrap; text-overflow: ellipsis; letter-spacing: -0.1px; }
.ks-tel { font-size: 9.5px; white-space:nowrap; text-overflow: ellipsis; letter-spacing: -0.2px; }
.ks-mark { text-align:center; font-weight: 700; font-size: 12.5px; padding: 0 !important; }
.ks-today { background:#fffbe6; }
.ks-nowrap { white-space:nowrap; text-overflow: ellipsis; }
.ks-small { font-size: 10px; }
.ks-debtcell { font-weight: 700; }
.ks-zero { color:#999; font-weight: 400; }
.ks-tag { font-size: 8.5px; font-weight: 700; color:#a86a00; margin-left: 4px; letter-spacing: .3px; }
.ks-foot { display:flex; justify-content:space-between; font-size: 9.5px; color:#555; margin-top: 4px; }
`;
const PRINT_CSS = `
@page { size: A4 landscape; margin: 5mm; }
html, body { margin: 0; padding: 0; background: #fff; }
.ks-sheet { width: auto; padding: 0; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

interface Qator {
    student: Student;
    marks: string[];
    fan: string;
    tel: string;
    izoh: string;
    sinov: string;
    test: string;
    reyting: string;
    qarz: number;
}

export default function DailySheet() {
    const {
        user, token, groups, students, teachers, courses, rooms, payments, exams, examResults,
        settings, schools, selectedSchoolId, showNotification,
    } = useCRM();
    const [params] = useSearchParams();

    const [sana, setSana] = useState(() => /^\d{4}-\d{2}-\d{2}$/.test(params.get('sana') || '') ? params.get('sana')! : toshkentBugun());
    const [holat, setHolat] = useState<typeof HOLATLAR[number]['key']>('faol-sinov');
    const [ustunlar, setUstunlar] = useState<Record<UstunKey, boolean>>(() => {
        const base = Object.fromEntries(USTUNLAR.map(u => [u.key, true])) as Record<UstunKey, boolean>;
        try { return { ...base, ...JSON.parse(localStorage.getItem(USTUN_KEY) || '{}') }; } catch { return base; }
    });
    // Kurslar tanlovi. Foydalanuvchi o'zi o'zgartirmaguncha sana almashsa ham
    // "shu kuni darsi bor kurslar" avtomatik tanlanib turadi.
    const urlKurs = (params.get('kurs') || '').split(',').map(Number).filter(n => n > 0);
    const [tanlov, setTanlov] = useState<number[]>(urlKurs);
    const [qolda, setQolda] = useState(urlKurs.length > 0);
    const [davomat, setDavomat] = useState<Attendance[]>([]);
    const [davomatXato, setDavomatXato] = useState<string | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try { localStorage.setItem(USTUN_KEY, JSON.stringify(ustunlar)); } catch { /* private mode */ }
    }, [ustunlar]);

    // O'qituvchi o'z kurslarini ko'radi; boshqalar — filialning barcha kurslari.
    const ustozRoli = ['TEACHER', 'SUPPORT_TEACHER'].includes(String(user?.role));
    const meningUstozIdlarim = useMemo(
        () => (teachers || []).filter(t => t.userId === user?.id).map(t => t.id),
        [teachers, user?.id]
    );
    const vaqtKaliti = (g: Group) => (String(g.schedule || '').match(/\d{1,2}:\d{2}/)?.[0] || '99:99').padStart(5, '0');
    const kurslar = useMemo(() => {
        const list = (groups || []).filter(g => !ustozRoli || !meningUstozIdlarim.length || meningUstozIdlarim.includes(g.teacherId));
        return [...list].sort((a, b) => vaqtKaliti(a).localeCompare(vaqtKaliti(b)) || a.name.localeCompare(b.name));
    }, [groups, ustozRoli, meningUstozIdlarim]);

    useEffect(() => {
        if (qolda) return;
        const bugungi = kurslar.filter(g => isLessonDay(g.days, sana) && (g.studentIds || []).length > 0);
        setTanlov((bugungi.length ? bugungi : kurslar.filter(g => (g.studentIds || []).length > 0)).map(g => g.id));
    }, [kurslar, sana, qolda]);

    const tanlanganKurslar = kurslar.filter(g => tanlov.includes(g.id));

    /** Kursning `sana` dan oldingi oxirgi 4 dars kuni, eng yangisi birinchi. null — jadval yo'q. */
    const oldingiDarslar = (g: Group): string[] | null => {
        const list = lessonDatesBetween(g.days, kunSurish(sana, -28), kunSurish(sana, -1));
        return list ? list.slice(-4).reverse() : null;
    };

    // Davomat: tanlangan kurslarning oxirgi darslari oralig'i, har filial uchun bitta so'rov.
    const davomatKaliti = tanlanganKurslar.map(g => g.id).join(',') + '|' + sana;
    useEffect(() => {
        if (!token || tanlanganKurslar.length === 0) { setDavomat([]); return; }
        let bekor = false;
        const from = kunSurish(sana, -28);
        const filiallar = [...new Set(tanlanganKurslar.map(g => g.schoolId))];
        Promise.all(filiallar.map(async sid => {
            const res = await fetch(`/api/attendances?schoolId=${sid}&from=${from}&to=${sana}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error(`Davomat yuklanmadi (${res.status})`);
            return res.json();
        }))
            .then(lists => { if (!bekor) { setDavomat(lists.flat()); setDavomatXato(null); } })
            .catch(e => { if (!bekor) setDavomatXato(e.message); });
        return () => { bekor = true; };
    }, [token, davomatKaliti]);

    const davomatMap = useMemo(() => {
        const m = new Map<string, string>();
        for (const a of davomat) m.set(`${a.studentId}|${a.groupId}|${a.date}`, a.status);
        return m;
    }, [davomat]);

    // Kurs bo'yicha qarz: shu kursning yopilmagan hisoblari + hech bir kursga
    // bog'lanmagan (eski) qarz. Hisob serverdagi bilan bir xil funksiyada.
    const qarzlar = useMemo(() => {
        const out = new Map<number, Map<number | null, number>>();
        const rows = groupRows((payments || []) as any[]);
        for (const st of students || []) {
            const res = allocate(withOpening(rows.get(st.id) || [], st.balance));
            const m = new Map<number | null, number>();
            for (const x of res.debtByGroup) m.set(x.groupId ?? null, x.amount);
            out.set(st.id, m);
        }
        return out;
    }, [students, payments]);

    // Imtihon natijalari: nomida "sinov" bo'lgan imtihon — SINOV ustuni, qolganlari
    // OXIRGI TEST (eng so'nggisi) va Reyting (o'rtachasi).
    const natijalar = useMemo(() => {
        const examById = new Map((exams || []).map(e => [e.id, e]));
        const out = new Map<number, { sinov: number | null; test: number | null; reyting: number | null }>();
        const byStudent = new Map<number, any[]>();
        for (const r of (examResults || []) as any[]) {
            if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, []);
            byStudent.get(r.studentId)!.push(r);
        }
        for (const [sid, list] of byStudent) {
            const withDate = list.map(r => ({ r, e: examById.get(r.examId) }))
                .sort((a, b) => String(a.e?.date || a.r.scannedAt || '').localeCompare(String(b.e?.date || b.r.scannedAt || '')));
            const sinovlar = withDate.filter(x => /sinov/i.test(x.e?.name || ''));
            const testlar = withDate.filter(x => !/sinov/i.test(x.e?.name || ''));
            out.set(sid, {
                sinov: sinovlar.length ? Number(sinovlar[sinovlar.length - 1].r.score) : null,
                test: testlar.length ? Number(testlar[testlar.length - 1].r.score) : null,
                reyting: testlar.length ? testlar.reduce((s, x) => s + Number(x.r.score || 0), 0) / testlar.length : null,
            });
        }
        return out;
    }, [exams, examResults]);

    const holatMatch = HOLATLAR.find(h => h.key === holat)!.match;
    const studentById = useMemo(() => new Map((students || []).map(s => [s.id, s])), [students]);
    const fanHarfi = (g?: Group) => {
        const nom = (courses || []).find(c => c.id === g?.courseId)?.name || g?.name || '';
        return nom.trim().charAt(0).toUpperCase();
    };

    const varaqlar = tanlanganKurslar.map(g => {
        const darslar = oldingiDarslar(g);
        const qatorlar: Qator[] = (g.studentIds || [])
            .map(id => studentById.get(id))
            .filter((s): s is Student => !!s && holatMatch(s))
            .sort((a, b) => a.name.localeCompare(b.name, 'uz'))
            .map(s => {
                const boshqa = (s.groups || []).filter(id => id !== g.id).map(id => (groups || []).find(x => x.id === id));
                const harflar = [fanHarfi(g), ...boshqa.map(fanHarfi)].filter(Boolean);
                const nat = natijalar.get(s.id);
                const q = qarzlar.get(s.id);
                const izoh = String(s.comment || '').trim();
                return {
                    student: s,
                    marks: (darslar || []).map(d => BELGI[davomatMap.get(`${s.id}|${g.id}|${d}`) || ''] || ''),
                    fan: [...new Set(harflar)].join('-'),
                    tel: [s.phone, s.fatherPhone, s.motherPhone].some(Boolean)
                        ? [s.phone, s.fatherPhone, s.motherPhone].map(p => tel(p) || '—').join(' / ') : '',
                    // Onlayn arizaning avtomatik izohi ("[Onlayn Ariza] Kurs: …") va'da emas.
                    izoh: izoh.startsWith('[Onlayn Ariza]') ? '' : izoh,
                    sinov: ball(nat?.sinov ?? null),
                    test: ball(nat?.test ?? null),
                    reyting: ball(nat?.reyting ?? null),
                    qarz: (q?.get(g.id) || 0) + (q?.get(null) || 0),
                };
            });
        return { g, darslar, qatorlar, jamiQarz: qatorlar.reduce((n, r) => n + r.qarz, 0) };
    });

    const orgNomi = (() => {
        const n = String(settings?.orgName || '').trim();
        if (!n) return "O'QUV MARKAZI";
        return /markaz/i.test(n) ? n.toUpperCase() : `"${n.toUpperCase()}" O'QUV MARKAZI`;
    })();
    const filialNomi = (schools || []).length > 1 ? (schools || []).find(s => s.id === tanlanganKurslar[0]?.schoolId)?.name : '';
    const sanaD = new Date(sana + 'T12:00:00Z');
    const sanaMatni = `${ddmmyyyy(sana)}, ${HAFTA[sanaD.getUTCDay()]}`;
    const kunlarMatni = (days: string) => days === 'TOQ' ? 'Dush · Chor · Juma' : days === 'JUFT' ? 'Sesh · Pay · Shan' : days === 'HAR_KUNI' ? 'Har kuni' : 'Kunlari belgilanmagan';

    const chopEt = () => {
        const html = previewRef.current?.innerHTML;
        if (!html || varaqlar.every(v => v.qatorlar.length === 0)) {
            showNotification("Chop etish uchun ro'yxat bo'sh", 'error');
            return;
        }
        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument!;
        doc.open();
        doc.write(`<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><title>Kunlik ro'yxat ${esc(ddmmyyyy(sana))}</title><style>${SHEET_CSS}${PRINT_CSS}</style></head><body>${html}</body></html>`);
        doc.close();
        const win = iframe.contentWindow!;
        const tozala = () => setTimeout(() => iframe.remove(), 500);
        win.onafterprint = tozala;
        setTimeout(() => { win.focus(); win.print(); setTimeout(tozala, 60000); }, 250);
    };

    const kursniAlmashtir = (id: number) => {
        setQolda(true);
        setTanlov(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    const ustoz = (g: Group) => (teachers || []).find(t => t.id === g.teacherId)?.name || '—';
    const xona = (g: Group) => (rooms || []).find(r => r.id === g.room)?.name;

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            <style>{SHEET_CSS}</style>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                <div>
                    <h1 className="text-[26px] font-bold text-matn tracking-tight leading-tight">Kunlik ro'yxat</h1>
                    <p className="text-[13px] text-matn-sokin mt-1">
                        Har kuni chop etiladigan kurs ro'yxati — Excel'dagi «Kunlik monitoring» bilan bir xil.
                    </p>
                </div>
                <button
                    onClick={chopEt}
                    disabled={tanlanganKurslar.length === 0}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-brand-ust rounded-xl text-[13px] font-semibold disabled:opacity-50 cursor-pointer transition-colors"
                >
                    <Printer size={15} /> Chop etish
                </button>
            </div>

            <div className="bg-sirt border border-chiziq rounded-xl p-4 space-y-4">
                <div className="flex flex-wrap items-end gap-4">
                    <label className="block">
                        <span className="block text-[11px] text-matn-xira mb-1.5">Sana</span>
                        <div className="relative">
                            <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira pointer-events-none" />
                            <input type="date" value={sana} onChange={e => e.target.value && setSana(e.target.value)}
                                className="h-9 pl-8 pr-3 bg-ichki border border-chiziq rounded-lg text-[13px] text-matn outline-none focus:border-brand" />
                        </div>
                    </label>
                    <label className="block">
                        <span className="block text-[11px] text-matn-xira mb-1.5">O'quvchilar</span>
                        <select value={holat} onChange={e => setHolat(e.target.value as any)}
                            className="h-9 px-3 bg-ichki border border-chiziq rounded-lg text-[13px] text-matn outline-none focus:border-brand">
                            {HOLATLAR.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
                        </select>
                    </label>
                    <div>
                        <span className="block text-[11px] text-matn-xira mb-1.5">Ustunlar</span>
                        <div className="flex flex-wrap gap-1.5">
                            {USTUNLAR.map(u => (
                                <button key={u.key} onClick={() => setUstunlar(p => ({ ...p, [u.key]: !p[u.key] }))}
                                    className={`h-9 px-3 rounded-lg text-[12px] border transition-colors cursor-pointer ${ustunlar[u.key] ? 'bg-brand/12 text-brand border-brand/30' : 'border-chiziq text-matn-xira hover:text-matn'}`}>
                                    {u.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-matn-xira">
                            Kurslar {!qolda && <span className="text-matn-sokin">— shu kuni darsi borlar avtomatik tanlandi</span>}
                        </span>
                        <div className="flex gap-3 text-[12px]">
                            <button onClick={() => { setQolda(true); setTanlov(kurslar.map(g => g.id)); }} className="text-brand hover:underline cursor-pointer">Hammasi</button>
                            <button onClick={() => { setQolda(false); }} className="text-brand hover:underline cursor-pointer">Bugungi darslar</button>
                            <button onClick={() => { setQolda(true); setTanlov([]); }} className="text-matn-sokin hover:underline cursor-pointer">Tozalash</button>
                        </div>
                    </div>
                    {kurslar.length === 0 ? (
                        <p className="text-[13px] text-matn-sokin">{ustozRoli ? "Sizga biriktirilgan kurs yo'q." : "Bu filialda kurs yo'q."}</p>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {kurslar.map(g => {
                                const on = tanlov.includes(g.id);
                                const bugun = isLessonDay(g.days, sana);
                                return (
                                    <button key={g.id} onClick={() => kursniAlmashtir(g.id)}
                                        className={`px-3 py-1.5 rounded-lg text-[12px] border transition-colors cursor-pointer text-left ${on ? 'bg-brand text-brand-ust border-brand' : 'border-chiziq-kuchli text-matn-2 hover:text-matn'}`}>
                                        <span className="font-medium">{g.name}</span>
                                        <span className={`ml-1.5 num ${on ? 'opacity-80' : 'text-matn-xira'}`}>{(g.studentIds || []).length}</span>
                                        {bugun && <span className={`ml-1.5 text-[10px] ${on ? 'opacity-80' : 'text-yaxshi'}`}>bugun</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <p className="flex items-start gap-2 text-[12px] text-matn-xira">
                    <Info size={13} className="shrink-0 mt-0.5" />
                    <span>
                        Birinchi «Dav» ustuni bo'sh — darsda qo'lda belgilanadi; keyingi to'rttasi kursning oxirgi darslari.
                        Qarz — shu kurs bo'yicha va hech bir kursga bog'lanmagan eski qarz. Sinov — nomida «sinov» so'zi bor imtihon natijasi.
                    </span>
                </p>
                {davomatXato && <p className="text-[12px] text-xato">{davomatXato}</p>}
            </div>

            {/* Ko'rinish = chop etiladigan varaq (bir xil HTML va CSS). */}
            <div className="bg-ichki border border-chiziq rounded-xl p-3 overflow-x-auto">
                {tanlanganKurslar.length === 0 ? (
                    <p className="py-12 text-center text-[13px] text-matn-sokin">Chop etish uchun kurs tanlang.</p>
                ) : (
                    <div ref={previewRef} className="space-y-3 w-max mx-auto">
                        {varaqlar.map(({ g, darslar, qatorlar, jamiQarz }) => (
                            <div key={g.id} className="ks-sheet shadow-sm">
                                <div className="ks-top">
                                    <div className="ks-org">
                                        {orgNomi}
                                        {filialNomi && <div className="ks-branch">{filialNomi}</div>}
                                    </div>
                                    <div className="ks-title">KUNLIK MONITORING</div>
                                    <div className="ks-date">{sanaMatni}</div>
                                </div>
                                <div className="ks-meta">
                                    <div>
                                        Kurs: <b>{g.name}</b> &nbsp;·&nbsp; Ustoz: <b>{ustoz(g)}</b> &nbsp;·&nbsp; {kunlarMatni(g.days)}
                                        {g.schedule && !String(g.schedule).includes('Belgilanmagan') ? `, ${g.schedule}` : ''}
                                        {xona(g) ? <> &nbsp;·&nbsp; Xona: {xona(g)}</> : null}
                                        &nbsp;·&nbsp; O'quvchilar: <b>{qatorlar.length}</b>
                                    </div>
                                    {ustunlar.qarz && (
                                        <div className="ks-debt"><span>Umumiy qarzdorlik:</span> {sum(jamiQarz)} so'm</div>
                                    )}
                                </div>
                                <table className="ks-table">
                                    <colgroup>
                                        <col style={{ width: '3%' }} />
                                        <col style={{ width: '25.5%' }} />
                                        <col style={{ width: '3.4%' }} />
                                        {[0, 1, 2, 3].map(i => <col key={i} style={{ width: '3.3%' }} />)}
                                        {ustunlar.fan && <col style={{ width: '4.2%' }} />}
                                        {ustunlar.tel && <col style={{ width: '20%' }} />}
                                        {ustunlar.izoh && <col style={{ width: '11%' }} />}
                                        {ustunlar.sinov && <col style={{ width: '4.2%' }} />}
                                        {ustunlar.test && <col style={{ width: '4.2%' }} />}
                                        {ustunlar.reyting && <col style={{ width: '4.4%' }} />}
                                        {ustunlar.qarz && <col style={{ width: '7.8%' }} />}
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th>N</th>
                                            <th>FIO</th>
                                            <th className="ks-today">Dav<span className="ks-d">{ddmm(sana)}</span></th>
                                            {[0, 1, 2, 3].map(i => <th key={i}>Dav<span className="ks-d">{darslar && darslar[i] ? ddmm(darslar[i]) : ''}</span></th>)}
                                            {ustunlar.fan && <th>FAN</th>}
                                            {ustunlar.tel && <th>TEL NOMERLARI<br /><span className="ks-small">o'zi / otasi / onasi</span></th>}
                                            {ustunlar.izoh && <th>Vada / Kommentariya</th>}
                                            {ustunlar.sinov && <th>SINOV</th>}
                                            {ustunlar.test && <th>OXIRGI TEST</th>}
                                            {ustunlar.reyting && <th>Reyting</th>}
                                            {ustunlar.qarz && <th>QARZ</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {qatorlar.length === 0 ? (
                                            <tr><td colSpan={20} className="ks-c">Bu kursda tanlangan holatdagi o'quvchi yo'q</td></tr>
                                        ) : qatorlar.map((r, i) => (
                                            <tr key={r.student.id}>
                                                <td className="ks-c">{i + 1}</td>
                                                <td className="ks-name">
                                                    {r.student.name}
                                                    {r.student.status === 'Sinov' && <span className="ks-tag">SINOV</span>}
                                                </td>
                                                <td className="ks-today" />
                                                {[0, 1, 2, 3].map(k => <td key={k} className="ks-mark">{r.marks[k] || ''}</td>)}
                                                {ustunlar.fan && <td className="ks-c">{r.fan}</td>}
                                                {ustunlar.tel && <td className="ks-tel">{r.tel}</td>}
                                                {ustunlar.izoh && <td className="ks-nowrap ks-small">{r.izoh}</td>}
                                                {ustunlar.sinov && <td className="ks-c">{r.sinov}</td>}
                                                {ustunlar.test && <td className="ks-c">{r.test}</td>}
                                                {ustunlar.reyting && <td className="ks-c">{r.reyting}</td>}
                                                {ustunlar.qarz && (
                                                    <td className={`ks-r ks-debtcell ${r.qarz > 0 ? '' : 'ks-zero'}`}>{sum(r.qarz)}</td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="ks-foot">
                                    <span>+ keldi &nbsp; − kelmadi &nbsp; S sababli &nbsp; K kechikdi &nbsp; E erta ketdi &nbsp; x dars bo'lmadi
                                        {darslar === null ? " · kurs kunlari belgilanmagan, oldingi darslar ko'rsatilmadi" : ''}</span>
                                    <span>{orgNomi} · {ddmmyyyy(sana)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
