import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Search, RotateCcw, History } from 'lucide-react';
import { useCRM } from '../context/CRMContext';

/**
 * Amallar jurnali: kim, qachon, nimani kiritdi, o'zgartirdi yoki o'chirdi.
 *
 * Rahbar so'ragan edi: "loglar jurnali. kim nima kiritgan, kim nima o'zgartirgan".
 * Yozuvlar serverda (lib/audit.js) har bir amal paytida yoziladi; bu sahifa
 * faqat o'qiydi. Tahrirda qaysi maydon nimadan nimaga o'zgargani qator
 * ochilganda ko'rinadi.
 */

interface Change { field: string; label: string; from: string; to: string }
interface Item {
    id: number;
    createdAt: string;
    schoolId: number | null;
    userId: number | null;
    userName: string | null;
    userRole: string | null;
    action: 'create' | 'update' | 'delete' | 'action';
    entity: string;
    entityLabel: string;
    entityId: number | null;
    title: string | null;
    summary: string | null;
    link: string | null;
    changes: Change[] | null;
}

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin', MANAGER: 'Menejer', TEACHER: "O'qituvchi", SUPPORT_TEACHER: "Yord. o'qituvchi",
    RECEPTIONIST: 'Resepshn', TECH_STAFF: 'Tex. xodim', SUPERADMIN: 'Super admin', SELLER: 'Sotuvchi',
};

const ACTION_STYLE: Record<Item['action'], { label: string; cls: string }> = {
    create: { label: "Qo'shdi", cls: 'bg-yaxshi-fon text-yaxshi' },
    update: { label: "O'zgartirdi", cls: 'bg-ogoh-fon text-ogoh' },
    delete: { label: "O'chirdi", cls: 'bg-xato-fon text-xato' },
    action: { label: 'Bajardi', cls: 'bg-ichki text-matn-sokin border border-chiziq' },
};

const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** Toshkent vaqti bo'yicha "YYYY-MM-DD". */
function uzDate(d: Date): string {
    const uz = new Date(d.getTime() + 5 * 3600 * 1000);
    return uz.toISOString().slice(0, 10);
}
function uzTime(d: Date): string {
    const uz = new Date(d.getTime() + 5 * 3600 * 1000);
    return uz.toISOString().slice(11, 16);
}
function shiftDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
function dayTitle(dateStr: string, today: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const base = `${d}-${OYLAR[m - 1]}${y !== Number(today.slice(0, 4)) ? ` ${y}` : ''}`;
    if (dateStr === today) return `Bugun · ${base}`;
    if (dateStr === shiftDays(today, -1)) return `Kecha · ${base}`;
    return base;
}

const inputCls = 'h-9 px-3 bg-ichki border border-chiziq rounded-lg text-[13px] text-matn outline-none focus:border-brand transition-colors';

export default function AuditLog() {
    const { token, selectedSchoolId, users, schools } = useCRM();
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const today = uzDate(new Date());
    const [from, setFrom] = useState(params.get('from') || shiftDays(today, -6));
    const [to, setTo] = useState(params.get('to') || today);
    const [userId, setUserId] = useState(params.get('userId') || '');
    const [entity, setEntity] = useState(params.get('entity') || '');
    const [action, setAction] = useState(params.get('action') || '');
    const [q, setQ] = useState('');
    const [qDebounced, setQDebounced] = useState('');

    const [items, setItems] = useState<Item[]>([]);
    const [nextBefore, setNextBefore] = useState<number | null>(null);
    const [entities, setEntities] = useState<{ key: string; label: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState<Set<number>>(new Set());
    const request = useRef(0);

    useEffect(() => {
        const t = setTimeout(() => setQDebounced(q.trim()), 300);
        return () => clearTimeout(t);
    }, [q]);

    const load = async (before?: number) => {
        if (!token) return;
        const so = ++request.current;
        setLoading(true);
        setError(null);
        const qs = new URLSearchParams();
        if (selectedSchoolId !== null && selectedSchoolId !== undefined) qs.set('schoolId', String(selectedSchoolId));
        if (from) qs.set('from', from);
        if (to) qs.set('to', to);
        if (userId) qs.set('userId', userId);
        if (entity) qs.set('entity', entity);
        if (action) qs.set('action', action);
        if (qDebounced) qs.set('q', qDebounced);
        if (before) qs.set('before', String(before));
        try {
            const res = await fetch(`/api/audit-logs?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json().catch(() => ({}));
            if (so !== request.current) return;
            if (!res.ok) throw new Error(data.error || `Server ${res.status}`);
            setItems(prev => before ? [...prev, ...data.items] : data.items);
            setNextBefore(data.nextBefore);
            if (Array.isArray(data.entities)) setEntities(data.entities);
        } catch (e: any) {
            if (so === request.current) setError(e.message || 'Yuklab bo\'lmadi');
        } finally {
            if (so === request.current) setLoading(false);
        }
    };

    useEffect(() => { load(); }, [token, selectedSchoolId, from, to, userId, entity, action, qDebounced]);

    const byDay = useMemo(() => {
        const out: { day: string; rows: Item[] }[] = [];
        for (const it of items) {
            const day = uzDate(new Date(it.createdAt));
            const last = out[out.length - 1];
            if (last && last.day === day) last.rows.push(it);
            else out.push({ day, rows: [it] });
        }
        return out;
    }, [items]);

    const staffOptions = useMemo(
        () => [...(users || [])].filter((u: any) => u.role !== 'DRIVER').sort((a: any, b: any) => a.name.localeCompare(b.name)),
        [users]
    );
    const multiBranch = (schools || []).length > 1 && selectedSchoolId === 0;
    const branchName = (id: number | null) => (schools || []).find(s => s.id === id)?.name;

    const toggle = (id: number) => setOpen(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const reset = () => {
        setFrom(shiftDays(today, -6)); setTo(today); setUserId(''); setEntity(''); setAction(''); setQ('');
    };
    const filtered = userId || entity || action || q || from !== shiftDays(today, -6) || to !== today;

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            <div>
                <h1 className="text-[26px] font-bold text-matn tracking-tight leading-tight">Jurnal</h1>
                <p className="text-[13px] text-matn-sokin mt-1">
                    Kim, qachon nimani kiritdi, o'zgartirdi yoki o'chirdi. Qatorni bosing — nima nimaga o'zgargani ochiladi.
                </p>
            </div>

            {/* Filtrlar */}
            <div className="bg-sirt border border-chiziq rounded-xl p-3 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ism, o'quvchi, izoh bo'yicha qidirish"
                        className={`${inputCls} w-full pl-8`} />
                </div>
                <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className={inputCls} aria-label="Boshlanish sanasi" />
                <span className="text-matn-xira text-[13px]">—</span>
                <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className={inputCls} aria-label="Tugash sanasi" />
                <select value={userId} onChange={e => setUserId(e.target.value)} className={inputCls} aria-label="Xodim">
                    <option value="">Barcha xodimlar</option>
                    {staffOptions.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    <option value="0">Onlayn ariza</option>
                </select>
                <select value={entity} onChange={e => setEntity(e.target.value)} className={inputCls} aria-label="Bo'lim">
                    <option value="">Barcha bo'limlar</option>
                    {entities.filter(e => e.key !== 'other').map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
                </select>
                <select value={action} onChange={e => setAction(e.target.value)} className={inputCls} aria-label="Amal">
                    <option value="">Barcha amallar</option>
                    <option value="create">Qo'shildi</option>
                    <option value="update">O'zgartirildi</option>
                    <option value="delete">O'chirildi</option>
                    <option value="action">Boshqa amallar</option>
                </select>
                {filtered && (
                    <button onClick={reset} className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-[12px] text-matn-sokin hover:text-matn hover:bg-ichki transition-colors cursor-pointer">
                        <RotateCcw size={13} /> Tozalash
                    </button>
                )}
            </div>

            {error && (
                <div role="alert" className="rounded-xl border border-xato-chiziq bg-xato-fon px-4 py-3 text-[13px] text-xato">
                    Jurnalni yuklab bo'lmadi: {error}
                </div>
            )}

            {!error && !loading && items.length === 0 && (
                <div className="py-16 text-center bg-sirt rounded-xl border border-chiziq">
                    <History size={28} className="mx-auto text-matn-xira mb-3" />
                    <p className="text-[14px] text-matn">Bu oraliqda yozuv yo'q</p>
                    <p className="text-[12px] text-matn-xira mt-1">Jurnal shu kundan boshlab yuritiladi — undan oldingi amallar yozilmagan.</p>
                </div>
            )}

            {byDay.map(({ day, rows }) => (
                <section key={day} className="bg-sirt border border-chiziq rounded-xl overflow-hidden">
                    <header className="px-4 py-2.5 border-b border-chiziq bg-ichki flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-matn">{dayTitle(day, today)}</span>
                        <span className="num text-[12px] text-matn-xira">{rows.length} ta</span>
                    </header>
                    <ul className="divide-y divide-chiziq-mayin">
                        {rows.map(it => {
                            const hasChanges = (it.changes || []).length > 0;
                            const isOpen = open.has(it.id);
                            const st = ACTION_STYLE[it.action] || ACTION_STYLE.action;
                            return (
                                <li key={it.id}>
                                    {/* Telefonda ikki qavat: vaqt · xodim · amal, pastida nima qilingani. */}
                                    <div
                                        onClick={() => hasChanges && toggle(it.id)}
                                        className={`px-4 py-2.5 flex flex-wrap sm:flex-nowrap items-start gap-x-3 gap-y-1 ${hasChanges ? 'cursor-pointer hover:bg-ichki' : ''} transition-colors`}
                                    >
                                        <span className="num text-[12px] text-matn-xira w-10 shrink-0 pt-0.5">{uzTime(new Date(it.createdAt))}</span>
                                        <div className="flex-1 sm:flex-none sm:w-40 shrink-0 min-w-0">
                                            <p className="text-[13px] text-matn truncate">{it.userName || '—'}</p>
                                            <p className="text-[11px] text-matn-xira truncate">
                                                {it.userRole ? (ROLE_LABELS[it.userRole] || it.userRole) : 'Tizimdan tashqari'}
                                            </p>
                                        </div>
                                        <span className={`shrink-0 mt-0.5 w-[5.5rem] text-center py-0.5 rounded-md text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                                        <div className="order-last sm:order-none basis-full sm:basis-auto sm:flex-1 min-w-0 pl-[3.25rem] sm:pl-0">
                                            <p className="text-[13px] text-matn">
                                                <span className="text-matn-sokin">{it.entityLabel}</span>
                                                {it.title && <>
                                                    <span className="text-matn-xira"> · </span>
                                                    {it.link ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); navigate(it.link!); }}
                                                            className="font-medium hover:text-brand hover:underline cursor-pointer text-left"
                                                        >{it.title}</button>
                                                    ) : <span className="font-medium">{it.title}</span>}
                                                </>}
                                            </p>
                                            {(it.summary || multiBranch) && (
                                                <p className="text-[12px] text-matn-sokin mt-0.5 break-words">
                                                    {it.summary}
                                                    {multiBranch && branchName(it.schoolId) && (
                                                        <span className="text-matn-xira">{it.summary ? ' · ' : ''}{branchName(it.schoolId)}</span>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                        {hasChanges && (
                                            <span className="shrink-0 text-matn-xira pt-0.5">
                                                {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                            </span>
                                        )}
                                    </div>
                                    {hasChanges && isOpen && (
                                        <div className="px-4 pb-3 sm:pl-[15rem] overflow-x-auto">
                                            <table className="w-full table-fixed text-[12px] border border-chiziq rounded-lg overflow-hidden">
                                                <thead>
                                                    <tr className="bg-ichki text-matn-xira">
                                                        <th className="text-left font-medium px-3 py-1.5 w-28 sm:w-44">Maydon</th>
                                                        {it.action !== 'create' && <th className="text-left font-medium px-3 py-1.5">{it.action === 'delete' ? 'Qiymat' : 'Oldin'}</th>}
                                                        {it.action !== 'delete' && <th className="text-left font-medium px-3 py-1.5">{it.action === 'create' ? 'Qiymat' : 'Keyin'}</th>}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-chiziq-mayin">
                                                    {(it.changes || []).map((c, i) => (
                                                        <tr key={i}>
                                                            <td className="px-3 py-1.5 text-matn-sokin align-top">{c.label}</td>
                                                            {it.action !== 'create' && <td className={`px-3 py-1.5 align-top break-words ${it.action === 'update' ? 'text-xato line-through decoration-xato/40' : 'text-matn'}`}>{c.from}</td>}
                                                            {it.action !== 'delete' && <td className={`px-3 py-1.5 align-top break-words ${it.action === 'update' ? 'text-yaxshi' : 'text-matn'}`}>{c.to}</td>}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}

            {(loading || nextBefore) && (
                <div className="flex justify-center">
                    <button
                        onClick={() => nextBefore && load(nextBefore)}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg border border-chiziq-kuchli text-[13px] text-matn-2 hover:bg-ichki disabled:opacity-60 cursor-pointer transition-colors"
                    >
                        {loading ? 'Yuklanmoqda…' : 'Yana yuklash'}
                    </button>
                </div>
            )}
        </div>
    );
}
