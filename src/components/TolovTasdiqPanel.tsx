import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Check, X, Loader2, ArrowRight, ExternalLink, AlertTriangle } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import { chekVaqti, isAdminRole } from './KlikChek';

/**
 * Tasdiqlanishi kerak bo'lgan Klik to'lovlari (egasi, 2026-09-24).
 *
 * Moliya sahifasida — to'liq ro'yxat: administrator "Tasdiqlash" bossa pul
 * balansga tushadi (va ota-onaga to'lov SMS i ketadi), "Rad etish" — sabab
 * bilan. Boshqa xodimlar faqat "kutilmoqda" holatini ko'radi.
 * Bosh sahifada (`compact`) — administratorga qisqa eslatma.
 * Ro'yxat bo'sh bo'lsa hech narsa chizilmaydi.
 */

export const TASDIQ_HODISASI = 'tolov-tasdiq-yangilandi';

interface Qator {
    id: number; studentId: number; amount: number; type: string; paidAt: string;
    receipt?: string | null; note?: string | null; createdByName?: string | null; createdAt: string;
    student: { id: number; name: string; phone?: string | null; balance: number } | null;
    /** Shu chek avval ham kiritilgan bo'lsa — server yozgan ogohlantirishlar. */
    takror?: string[];
}

const qachon = (iso: string) => {
    const daq = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (daq < 1) return 'hozirgina';
    if (daq < 60) return `${daq} daqiqa oldin`;
    const soat = Math.round(daq / 60);
    if (soat < 24) return `${soat} soat oldin`;
    return `${Math.round(soat / 24)} kun oldin`;
};

export default function TolovTasdiqPanel({ compact = false }: { compact?: boolean }) {
    const { selectedSchoolId, user, showNotification, retryLoad, kora } = useCRM();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const admin = isAdminRole(user?.role);
    const [rows, setRows] = useState<Qator[]>([]);
    const [band, setBand] = useState<string>('');
    const [radId, setRadId] = useState<number | null>(null);
    const [sabab, setSabab] = useState('');

    // Bosh sahifadagi eslatma faqat administratorga — boshqalar so'rov ham yubormaydi.
    const korinadi = compact ? admin : (admin || kora('oquvchilar.tolov') || kora('moliya.tolovlar'));

    const yuklash = useCallback(async () => {
        if (!selectedSchoolId || !korinadi) return;
        try {
            const r = await fetch(`/api/tolov-tasdiq?schoolId=${selectedSchoolId}&status=kutilmoqda`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (r.ok) setRows(await r.json());
        } catch { /* keyingi safar */ }
    }, [selectedSchoolId, korinadi]);

    useEffect(() => {
        yuklash();
        const t = setInterval(yuklash, 60000);
        window.addEventListener(TASDIQ_HODISASI, yuklash);
        return () => { clearInterval(t); window.removeEventListener(TASDIQ_HODISASI, yuklash); };
    }, [yuklash]);

    const tasdiqlash = async (q: Qator) => {
        if (!await confirm(`${q.student?.name || "O'quvchi"}: ${q.amount.toLocaleString('ru-RU')} so'm ${q.type} to'lovi bank ilovasida ko'rindimi?\n\nChekdagi vaqt: ${chekVaqti(q.paidAt)}\nTasdiqlansa pul balansga tushadi.`)) return;
        setBand(`ok-${q.id}`);
        try {
            const r = await fetch(`/api/tolov-tasdiq/${q.id}/tasdiqlash`, {
                method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'Tasdiqlanmadi');
            showNotification(`Tasdiqlandi — ${q.amount.toLocaleString('ru-RU')} so'm balansga tushdi${d.xabar?.yuborildi ? ". Ota-onaga xabar yuborildi" : ''}`, 'success');
            await yuklash();
            retryLoad();
        } catch (e: any) {
            showNotification(e.message, 'error');
            yuklash();
        } finally { setBand(''); }
    };

    const radEtish = async (q: Qator) => {
        if (!sabab.trim()) { showNotification('Rad etish sababini yozing', 'error'); return; }
        setBand(`rad-${q.id}`);
        try {
            const r = await fetch(`/api/tolov-tasdiq/${q.id}/rad`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ reason: sabab.trim() }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'Rad etilmadi');
            showNotification("To'lov rad etildi — balansga tushmadi", 'info');
            setRadId(null); setSabab('');
            await yuklash();
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally { setBand(''); }
    };

    if (!rows.length) return null;

    if (compact) {
        if (!admin) return null;
        const jami = rows.reduce((s, q) => s + q.amount, 0);
        return (
            <button onClick={() => navigate('/finance')}
                className="w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-left cursor-pointer hover:border-amber-400 transition-colors">
                <span className="flex items-center gap-3 min-w-0">
                    <Receipt size={18} className="text-amber-600 shrink-0" />
                    <span className="min-w-0">
                        <span className="block text-[13px] font-black text-amber-800 dark:text-amber-300">
                            {rows.length} ta Klik to'lovi tasdiqlashingizni kutmoqda
                        </span>
                        <span className="block text-[11px] font-bold text-amber-700/80 dark:text-amber-400/80 num">
                            Jami {jami.toLocaleString('ru-RU')} so'm — tasdiqlanmaguncha balansga tushmaydi
                            {rows.some(q => q.takror?.length) && <span className="text-rose-600 dark:text-rose-400"> · ⚠️ {rows.filter(q => q.takror?.length).length} tasida takror chek</span>}
                        </span>
                    </span>
                </span>
                <span className="flex items-center gap-1 text-[11px] font-extrabold text-amber-800 dark:text-amber-300 shrink-0">Ko'rish <ArrowRight size={13} /></span>
            </button>
        );
    }

    return (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-sirt overflow-hidden">
            <div className="px-5 py-3.5 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[13px] font-black text-amber-800 dark:text-amber-300">
                    <Receipt size={16} /> Tasdiqlanishi kerak — Klik to'lovlari
                    <span className="px-2 py-0.5 rounded-md bg-amber-200/70 dark:bg-amber-900/50 text-[11px] num">{rows.length}</span>
                </span>
                <span className="text-[11px] font-bold text-amber-700/80 dark:text-amber-400/80 hidden sm:block">
                    {admin ? "Bank ilovasida pul kelganini ko'rib tasdiqlang" : 'Administrator tasdiqlagach balansga tushadi'}
                </span>
            </div>
            <div className="divide-y divide-chiziq-mayin">
                {rows.map(q => (
                    <div key={q.id} className="px-5 py-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                {q.receipt ? (
                                    <a href={q.receipt} target="_blank" rel="noreferrer" title="Chekni katta ko'rish" className="relative shrink-0">
                                        <img src={q.receipt} alt="Chek" className="w-11 h-11 object-cover rounded-xl border border-chiziq" />
                                        <ExternalLink size={10} className="absolute bottom-0.5 right-0.5 text-white drop-shadow" />
                                    </a>
                                ) : (
                                    <span className="w-11 h-11 rounded-xl border border-dashed border-chiziq flex items-center justify-center text-[9px] font-bold text-matn-xira shrink-0 text-center leading-tight">rasm<br />yo'q</span>
                                )}
                                <div className="min-w-0">
                                    <button onClick={() => q.student && navigate(`/students/${q.student.id}`)}
                                        className="text-[13px] font-black text-matn hover:text-brand truncate block text-left cursor-pointer">
                                        {q.student?.name || "O'chirilgan o'quvchi"}
                                    </button>
                                    <p className="text-[11px] font-bold text-matn-xira">
                                        Chek: <span className="text-matn-2 num">{chekVaqti(q.paidAt)}</span>
                                        {' · '}kiritdi {q.createdByName || '—'}, {qachon(q.createdAt)}
                                        {q.note && <> · {q.note}</>}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[14px] font-black text-emerald-600 num">+{q.amount.toLocaleString('ru-RU')}</span>
                                <span className="px-2 py-0.5 rounded-md border border-chiziq text-[10px] font-bold text-matn-2">{q.type}</span>
                                {admin ? (
                                    <>
                                        <button onClick={() => tasdiqlash(q)} disabled={!!band}
                                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer">
                                            {band === `ok-${q.id}` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Tasdiqlash
                                        </button>
                                        <button onClick={() => { setRadId(radId === q.id ? null : q.id); setSabab(''); }} disabled={!!band}
                                            className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer">
                                            <X size={13} /> Rad etish
                                        </button>
                                    </>
                                ) : (
                                    <span className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[11px] font-bold">Tasdiq kutilmoqda</span>
                                )}
                            </div>
                        </div>
                        {!!q.takror?.length && (
                            <div className="ml-14 p-2.5 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 space-y-1">
                                <p className="flex items-center gap-1.5 text-[11.5px] font-black text-rose-700 dark:text-rose-300">
                                    <AlertTriangle size={13} /> Takror chek — pul ikki marta tushmasin
                                </p>
                                {q.takror.map((t, i) => (
                                    <p key={i} className="text-[11px] font-bold text-rose-700/90 dark:text-rose-300/90 leading-relaxed">• {t}</p>
                                ))}
                            </div>
                        )}
                        {radId === q.id && (
                            <div className="flex flex-wrap items-center gap-2 pl-14">
                                <input autoFocus value={sabab} onChange={e => setSabab(e.target.value)} placeholder="Sabab: pul kelmagan, summa boshqa..."
                                    onKeyDown={e => { if (e.key === 'Enter') radEtish(q); }}
                                    className="flex-1 min-w-[200px] px-3 py-2 bg-ichki border border-chiziq rounded-xl text-xs font-bold text-matn outline-none focus:border-rose-400" />
                                <button onClick={() => radEtish(q)} disabled={!!band}
                                    className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer">
                                    {band === `rad-${q.id}` ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Rad etishni tasdiqlash
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
