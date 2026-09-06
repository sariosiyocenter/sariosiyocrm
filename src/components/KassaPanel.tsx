import { useCallback, useEffect, useState } from 'react';
import { Banknote, ArrowDownToLine, Lock, RefreshCw, Trash2, X, CreditCard } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';

/**
 * Kassa — naqd pul nazorati.
 *
 * Tizim ilgari faqat "to'lov bo'ldi"ni bilardi; "hozir seyfda qancha naqd
 * turishi kerak" degan savolga javob yo'q edi. Bu bo'lim shuni beradi:
 *   kassadagi naqd = naqd kirim − naqd chiqim − inkassatsiya.
 * Inkassatsiya — pulni bankka yoki rahbarga topshirish. Kunni yopish —
 * administrator pulni sanaydi, tizim kutilgan summani ko'rsatadi, farq
 * yozib qolinadi.
 */

interface Day {
    date: string;
    in: number; inCount: number;
    out: number; outCount: number;
    handover: number;
    endBalance: number;
    close: { id: number; expected: number; counted: number; diff: number; note: string | null } | null;
}

interface Kassa {
    today: string;
    cashOnHand: number;
    todayIn: number; todayInCount: number;
    todayOut: number; todayOutCount: number;
    todayHandover: number;
    todayNonCash: number;
    todayClosed: boolean;
    days: Day[];
    handovers: { id: number; amount: number; date: string; toWhom: string; note: string | null }[];
}

const money = (n: number) => Math.round(n).toLocaleString('ru-RU');
const dmy = (d: string) => { const [y, m, day] = d.split('-'); return `${day}.${m}.${y}`; };

export default function KassaPanel() {
    const { selectedSchoolId, showNotification, retryLoad } = useCRM();
    const confirm = useConfirm();
    const [data, setData] = useState<Kassa | null>(null);
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState<'handover' | 'close' | null>(null);

    const [hAmount, setHAmount] = useState('');
    const [hTo, setHTo] = useState('Rahbar');
    const [hNote, setHNote] = useState('');
    const [cCounted, setCCounted] = useState('');
    const [cNote, setCNote] = useState('');
    const [saving, setSaving] = useState(false);

    const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`/api/kassa?schoolId=${selectedSchoolId}&days=30`, { headers: auth() });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Yuklab bo\'lmadi');
            setData(j);
        } catch (e: any) {
            showNotification(e.message || 'Kassa yuklanmadi', 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedSchoolId, showNotification]);

    useEffect(() => { load(); }, [load]);

    const branchNeeded = !selectedSchoolId;   // 0 — "barcha filiallar": yozib bo'lmaydi

    const submitHandover = async () => {
        if (saving) return;
        const amount = Math.round(Number(hAmount));
        if (!amount || amount <= 0) { showNotification('Summani kiriting', 'error'); return; }
        setSaving(true);
        try {
            const r = await fetch('/api/kassa/handover', {
                method: 'POST', headers: auth(),
                body: JSON.stringify({ schoolId: selectedSchoolId, amount, toWhom: hTo.trim() || 'Rahbar', note: hNote.trim() || null }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Saqlanmadi');
            showNotification(`${money(amount)} so'm topshirildi (${hTo})`, 'success');
            setModal(null); setHAmount(''); setHNote('');
            load();
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally { setSaving(false); }
    };

    const submitClose = async () => {
        if (saving) return;
        const counted = Math.round(Number(cCounted));
        if (!Number.isFinite(counted) || cCounted === '') { showNotification('Sanalgan summani kiriting', 'error'); return; }
        setSaving(true);
        try {
            const r = await fetch('/api/kassa/close', {
                method: 'POST', headers: auth(),
                body: JSON.stringify({ schoolId: selectedSchoolId, counted, note: cNote.trim() || null }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Saqlanmadi');
            showNotification(j.diff === 0 ? 'Kun yopildi, farq yo\'q' : `Kun yopildi, farq: ${money(j.diff)} so'm`, j.diff === 0 ? 'success' : 'error');
            setModal(null); setCCounted(''); setCNote('');
            load();
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally { setSaving(false); }
    };

    const removeHandover = async (id: number, amount: number) => {
        const ok = await confirm({ title: 'Inkassatsiyani o\'chirish', message: `${money(amount)} so'mlik topshirish yozuvi o'chirilsinmi? Pul kassaga "qaytadi".`, confirmLabel: 'O\'chirish', danger: true });
        if (ok !== true) return;
        const r = await fetch(`/api/kassa/handover/${id}`, { method: 'DELETE', headers: auth() });
        if (!r.ok) { const j = await r.json().catch(() => ({})); showNotification(j.error || 'O\'chirilmadi', 'error'); return; }
        load();
        retryLoad();
    };

    const inp = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
    const lbl = "block text-[11px] font-extrabold text-matn-xira mb-2";

    if (!data) {
        return (
            <div className="py-16 text-center">
                <RefreshCw size={24} className="animate-spin text-brand mx-auto mb-2" />
                <p className="text-[11px] font-bold text-matn-xira">Kassa yuklanmoqda…</p>
            </div>
        );
    }

    const todayRow = data.days.find(d => d.date === data.today);

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-black text-matn tracking-tight">Kassa</h3>
                    <p className="text-[11px] font-bold text-matn-xira mt-0.5">Naqd pul: bugun {dmy(data.today)}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="w-9 h-9 flex items-center justify-center rounded-xl border border-chiziq text-matn-xira hover:bg-ichki cursor-pointer" title="Yangilash">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => setModal('handover')} disabled={branchNeeded}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-chiziq bg-sirt text-xs font-extrabold text-matn hover:bg-ichki disabled:opacity-50 cursor-pointer">
                        <ArrowDownToLine size={14} /> Inkassatsiya
                    </button>
                    <button onClick={() => { setCCounted(String(data.cashOnHand)); setModal('close'); }} disabled={branchNeeded}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-xs font-extrabold disabled:opacity-50 cursor-pointer">
                        <Lock size={14} /> {data.todayClosed ? 'Kunni qayta yopish' : 'Kunni yopish'}
                    </button>
                </div>
            </div>

            {branchNeeded && (
                <p className="px-4 py-3 rounded-xl bg-ogoh-fon border border-ogoh/30 text-[11px] font-bold text-ogoh">
                    Barcha filiallar yig'indisi ko'rsatilmoqda. Inkassatsiya va kunni yopish uchun bitta filialni tanlang.
                </p>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="px-4 py-4 rounded-2xl border border-brand/30 bg-brand/5">
                    <span className="text-[11px] text-matn-sokin flex items-center gap-1"><Banknote size={12} /> Kassadagi naqd</span>
                    <p className="raqam text-[22px] font-semibold text-brand leading-tight mt-1">{money(data.cashOnHand)}</p>
                    <p className="text-[10px] text-matn-xira mt-0.5">hozir seyfda bo'lishi kerak</p>
                </div>
                <div className="px-4 py-4 rounded-2xl border border-chiziq bg-ichki">
                    <span className="text-[11px] text-matn-sokin">Bugun naqd kirim</span>
                    <p className="raqam text-[22px] font-semibold text-yaxshi leading-tight mt-1">+{money(data.todayIn)}</p>
                    <p className="text-[10px] text-matn-xira mt-0.5">{data.todayInCount} ta to'lov</p>
                </div>
                <div className="px-4 py-4 rounded-2xl border border-chiziq bg-ichki">
                    <span className="text-[11px] text-matn-sokin">Bugun naqd chiqim</span>
                    <p className="raqam text-[22px] font-semibold text-xato leading-tight mt-1">−{money(data.todayOut + data.todayHandover)}</p>
                    <p className="text-[10px] text-matn-xira mt-0.5">{data.todayOutCount} ta xarajat{data.todayHandover > 0 ? ` + ${money(data.todayHandover)} inkassatsiya` : ''}</p>
                </div>
                <div className="px-4 py-4 rounded-2xl border border-chiziq bg-ichki">
                    <span className="text-[11px] text-matn-sokin flex items-center gap-1"><CreditCard size={12} /> Bugun karta / o'tkazma</span>
                    <p className="raqam text-[22px] font-semibold text-matn leading-tight mt-1">{money(data.todayNonCash)}</p>
                    <p className="text-[10px] text-matn-xira mt-0.5">kassaga kirmaydi, bankka tushadi</p>
                </div>
            </div>

            {todayRow?.close && (
                <div className={`px-4 py-3 rounded-2xl border text-[11px] font-bold ${todayRow.close.diff === 0 ? 'bg-yaxshi-fon border-yaxshi/25 text-yaxshi' : 'bg-xato-fon border-xato-chiziq text-xato'}`}>
                    Bugungi kun yopilgan: kutilgan {money(todayRow.close.expected)}, sanalgan {money(todayRow.close.counted)}
                    {todayRow.close.diff !== 0 && ` — farq ${todayRow.close.diff > 0 ? '+' : ''}${money(todayRow.close.diff)} so'm`}
                    {todayRow.close.note && ` (${todayRow.close.note})`}
                </div>
            )}

            <div className="bg-ichki/40 rounded-2xl border border-chiziq overflow-hidden">
                <div className="px-5 py-4 border-b border-chiziq">
                    <p className="text-[11px] font-bold text-matn-xira">Kunlar bo'yicha (oxirgi 30 kun)</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-chiziq">
                                {['SANA', 'NAQD KIRIM', 'NAQD CHIQIM', 'INKASSATSIYA', 'KUN OXIRI', 'SANALGAN', 'FARQ'].map(h => (
                                    <th key={h} className="py-3 px-4 text-[11px] font-bold text-matn-xira whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/30">
                            {data.days.length === 0 && (
                                <tr><td colSpan={7} className="py-8 text-center text-[11px] text-matn-xira font-bold">Bu davrda naqd harakat yo'q</td></tr>
                            )}
                            {data.days.map(d => (
                                <tr key={d.date} className="text-xs">
                                    <td className="py-3 px-4 font-bold text-matn whitespace-nowrap">{dmy(d.date)}</td>
                                    <td className="py-3 px-4 raqam text-yaxshi">{d.in ? '+' + money(d.in) : <span className="text-matn-xira">—</span>}</td>
                                    <td className="py-3 px-4 raqam text-xato">{d.out ? '−' + money(d.out) : <span className="text-matn-xira">—</span>}</td>
                                    <td className="py-3 px-4 raqam text-matn-2">{d.handover ? '−' + money(d.handover) : <span className="text-matn-xira">—</span>}</td>
                                    <td className="py-3 px-4 raqam font-bold text-matn">{money(d.endBalance)}</td>
                                    <td className="py-3 px-4 raqam text-matn-2">{d.close ? money(d.close.counted) : <span className="text-[10px] text-matn-xira font-bold">yopilmagan</span>}</td>
                                    <td className={`py-3 px-4 raqam font-bold ${!d.close ? 'text-matn-xira' : d.close.diff === 0 ? 'text-yaxshi' : 'text-xato'}`}>
                                        {d.close ? (d.close.diff === 0 ? '0' : (d.close.diff > 0 ? '+' : '') + money(d.close.diff)) : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {data.handovers.length > 0 && (
                <div className="bg-ichki/40 rounded-2xl border border-chiziq overflow-hidden">
                    <div className="px-5 py-4 border-b border-chiziq">
                        <p className="text-[11px] font-bold text-matn-xira">Inkassatsiya (topshirilgan pul)</p>
                    </div>
                    <div className="divide-y divide-chiziq/60">
                        {data.handovers.map(h => (
                            <div key={h.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                                <div>
                                    <span className="font-bold text-matn">{dmy(h.date)}</span>
                                    <span className="text-matn-xira"> · {h.toWhom}</span>
                                    {h.note && <span className="block text-[10px] text-matn-xira">{h.note}</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="raqam font-bold text-matn-2">{money(h.amount)}</span>
                                    <button onClick={() => removeHandover(h.id, h.amount)} className="p-1.5 rounded-lg text-matn-xira hover:text-xato hover:bg-xato-fon cursor-pointer" title="O'chirish">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {modal && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setModal(null)} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-md p-8 space-y-4 my-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-chiziq-mayin/50">
                            <div>
                                <h3 className="text-lg font-black text-matn tracking-tight">{modal === 'handover' ? 'Inkassatsiya' : 'Kunni yopish'}</h3>
                                <p className="text-[11px] font-bold text-brand mt-0.5">Kassada hozir: {money(data.cashOnHand)} so'm</p>
                            </div>
                            <button type="button" aria-label="Yopish" onClick={() => setModal(null)} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>

                        {modal === 'handover' ? (
                            <>
                                <div>
                                    <label className={lbl}>Summa (so'm) *</label>
                                    <input type="number" className={inp} value={hAmount} onChange={e => setHAmount(e.target.value)} placeholder="Masalan: 3 000 000" autoFocus />
                                    <button type="button" onClick={() => setHAmount(String(data.cashOnHand))} className="mt-2 text-[11px] font-bold text-brand hover:underline cursor-pointer">Hammasini ({money(data.cashOnHand)})</button>
                                </div>
                                <div>
                                    <label className={lbl}>Kimga topshirildi *</label>
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        {['Rahbar', 'Bank'].map(w => (
                                            <button key={w} type="button" onClick={() => setHTo(w)}
                                                className={`py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${hTo === w ? 'bg-brand border-brand text-white' : 'bg-sirt border-chiziq text-matn-xira'}`}>{w}</button>
                                        ))}
                                    </div>
                                    <input type="text" className={inp} value={hTo} onChange={e => setHTo(e.target.value)} placeholder="yoki ism" />
                                </div>
                                <div>
                                    <label className={lbl}>Izoh</label>
                                    <input type="text" className={inp} value={hNote} onChange={e => setHNote(e.target.value)} placeholder="ixtiyoriy" />
                                </div>
                                <div className="flex gap-3 pt-4 border-t border-dashed border-chiziq/50">
                                    <button type="button" onClick={() => setModal(null)} className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl cursor-pointer">Bekor</button>
                                    <button type="button" onClick={submitHandover} disabled={saving} className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-xs font-extrabold rounded-2xl cursor-pointer">{saving ? 'Saqlanmoqda…' : 'Topshirildi'}</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="px-4 py-3 rounded-2xl bg-ichki border border-chiziq flex items-center justify-between">
                                    <span className="text-[12px] font-bold text-matn-sokin">Tizim bo'yicha bo'lishi kerak</span>
                                    <span className="raqam text-[15px] font-bold text-matn">{money(data.cashOnHand)} so'm</span>
                                </div>
                                <div>
                                    <label className={lbl}>Sanalgan naqd (so'm) *</label>
                                    <input type="number" className={inp} value={cCounted} onChange={e => setCCounted(e.target.value)} autoFocus />
                                    {cCounted !== '' && Number.isFinite(Number(cCounted)) && (
                                        <p className={`mt-2 text-[11px] font-bold ${Math.round(Number(cCounted)) - data.cashOnHand === 0 ? 'text-yaxshi' : 'text-xato'}`}>
                                            Farq: {Math.round(Number(cCounted)) - data.cashOnHand > 0 ? '+' : ''}{money(Math.round(Number(cCounted)) - data.cashOnHand)} so'm
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className={lbl}>Izoh</label>
                                    <input type="text" className={inp} value={cNote} onChange={e => setCNote(e.target.value)} placeholder="farq bo'lsa — sababi" />
                                </div>
                                <div className="flex gap-3 pt-4 border-t border-dashed border-chiziq/50">
                                    <button type="button" onClick={() => setModal(null)} className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl cursor-pointer">Bekor</button>
                                    <button type="button" onClick={submitClose} disabled={saving} className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-xs font-extrabold rounded-2xl cursor-pointer">{saving ? 'Saqlanmoqda…' : 'Kunni yopish'}</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
