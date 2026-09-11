import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Send, Link2, Ban, ExternalLink } from 'lucide-react';
import { useCRM } from '../context/CRMContext';

/**
 * Payme havolasi. Xodim kurs va summani tanlaydi, server buyurtma yaratadi,
 * havola + QR ko'rsatiladi; ota-onaning Telegramiga tugma bilan yuborish
 * mumkin. Summa buyurtmada qotib qoladi — havolani o'zgartirib boshqa summa
 * to'lab bo'lmaydi.
 */

type Course = { groupId: number; groupName: string; courseName: string; monthlyPrice: number; debt: number; advance: number; isMember: boolean };
type Order = {
    id: string; amount: number; status: string; source: string; test: boolean; createdAt: string; expiresAt: string;
    url: string | null; groupId: number | null; transactions: { state: number }[];
};

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });
const money = (n: number) => Number(n || 0).toLocaleString('ru-RU');

const STATUS: Record<string, { text: string; cls: string }> = {
    new:       { text: 'Kutilmoqda', cls: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40' },
    paid:      { text: "To'landi",   cls: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40' },
    refunded:  { text: 'Qaytarildi', cls: 'bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40' },
    cancelled: { text: 'Bekor',      cls: 'bg-gray-100 text-matn-xira border-gray-200 dark:bg-gray-900 dark:border-gray-800' },
    expired:   { text: 'Muddati o\'tgan', cls: 'bg-gray-100 text-matn-xira border-gray-200 dark:bg-gray-900 dark:border-gray-800' },
};

export default function PaymeLinkModal({ studentId, onClose }: { studentId: number; onClose: () => void }) {
    const { students, settings, showNotification } = useCRM();
    const student = students.find(s => s.id === studentId);

    const [courses, setCourses] = useState<Course[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [groupId, setGroupId] = useState<number | ''>('');
    const [amount, setAmount] = useState('');
    const [orders, setOrders] = useState<Order[]>([]);
    const [creating, setCreating] = useState(false);
    const [current, setCurrent] = useState<{ order: Order; url: string; qr: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const [sending, setSending] = useState(false);

    const mode = settings.paymeMode || 'off';
    const configured = mode !== 'off' && !!settings.paymeMerchantId;

    const loadOrders = () =>
        fetch(`/api/payme/orders?studentId=${studentId}`, { headers: auth() })
            .then(r => r.ok ? r.json() : [])
            .then(setOrders)
            .catch(() => setOrders([]));

    useEffect(() => {
        fetch(`/api/students/${studentId}/ledger`, { headers: auth() })
            .then(r => r.ok ? r.json() : null)
            .then(l => {
                const list: Course[] = (l?.courses || []).filter((c: Course) => c.isMember);
                setCourses(list);
                if (list.length === 1) pick(list[0]);
            })
            .catch(e => console.error('[payme] ledger:', e))
            .finally(() => setLoadingCourses(false));
        loadOrders();
    }, [studentId]);

    const pick = (c: Course) => {
        setGroupId(c.groupId);
        // Taklif: qarz bo'lsa qarz, bo'lmasa oylik narx.
        setAmount(String(c.debt > 0 ? c.debt : c.monthlyPrice || ''));
    };

    const selected = courses.find(c => c.groupId === groupId);

    const create = async (e: React.FormEvent) => {
        e.preventDefault();
        const sum = Math.round(Number(String(amount).replace(/[^\d]/g, '')));
        if (!sum) { showNotification('Summani kiriting', 'error'); return; }
        if (courses.length && !groupId) { showNotification('Kursni tanlang', 'error'); return; }
        setCreating(true);
        try {
            const r = await fetch('/api/payme/orders', { method: 'POST', headers: auth(), body: JSON.stringify({ studentId, groupId: groupId || null, amount: sum }) });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Xatolik');
            const QRCodeLib = await import('qrcode');
            const QRCode = (QRCodeLib as any).default || QRCodeLib;
            const qr = await QRCode.toDataURL(j.url, { width: 220, margin: 2 });
            setCurrent({ order: j.order, url: j.url, qr });
            loadOrders();
        } catch (err: any) {
            showNotification(err.message, 'error');
        } finally {
            setCreating(false);
        }
    };

    const copy = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { showNotification("Nusxalab bo'lmadi", 'error'); }
    };

    const send = async (orderId: string) => {
        setSending(true);
        try {
            const r = await fetch(`/api/payme/orders/${orderId}/send`, { method: 'POST', headers: auth(), body: '{}' });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Xatolik');
            const who = j.sent.length ? `Yuborildi: ${j.sent.join(', ')}` : '';
            const bad = j.failed.length ? ` · Ketmadi: ${j.failed.join(', ')}` : '';
            showNotification(who + bad || 'Yuborilmadi', j.sent.length ? 'success' : 'error');
        } catch (err: any) {
            showNotification(err.message, 'error');
        } finally {
            setSending(false);
        }
    };

    const cancel = async (orderId: string) => {
        try {
            const r = await fetch(`/api/payme/orders/${orderId}/cancel`, { method: 'POST', headers: auth(), body: '{}' });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Xatolik');
            if (current?.order.id === orderId) setCurrent(null);
            loadOrders();
        } catch (err: any) {
            showNotification(err.message, 'error');
        }
    };

    const inp = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-sm font-bold text-matn focus:border-brand outline-none";

    return (
        <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-lg p-8 space-y-5 my-auto">
                <div className="flex items-center justify-between pb-4 border-b border-chiziq-mayin/50">
                    <div>
                        <h3 className="text-lg font-black text-matn tracking-tight">Payme havola</h3>
                        <p className="text-[11px] font-bold text-brand mt-0.5">{student?.name}</p>
                    </div>
                    <button type="button" aria-label="Yopish" onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {!configured ? (
                    <p className="text-sm font-bold text-matn-xira">Payme ulanmagan. Sozlamalar → Payme bo'limida Merchant ID va kalitlarni kiriting.</p>
                ) : current ? (
                    <div className="space-y-4">
                        {current.order.test && (
                            <p className="text-[11px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl px-3 py-2">
                                TEST rejim — haqiqiy pul yechilmaydi, balans o'zgarmaydi.
                            </p>
                        )}
                        <div className="flex flex-col sm:flex-row gap-5 items-center">
                            <img src={current.qr} alt="QR" className="w-44 h-44 rounded-2xl border border-chiziq bg-white" />
                            <div className="flex-1 space-y-2 text-center sm:text-left">
                                <p className="text-2xl font-black text-matn">{money(current.order.amount)} <span className="text-sm text-matn-xira">so'm</span></p>
                                <p className="text-[11px] font-bold text-matn-xira">
                                    {selected ? `${selected.courseName} · ${selected.groupName}` : 'Umumiy'}<br />
                                    Buyurtma: <span className="font-mono text-matn">{current.order.id}</span><br />
                                    {new Date(current.order.expiresAt).toLocaleDateString('ru-RU')} gacha amal qiladi
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <input readOnly value={current.url} onFocus={e => e.target.select()} className={inp + ' font-mono text-[11px]'} />
                            <button type="button" onClick={() => copy(current.url)} className="px-3 rounded-2xl bg-ichki border border-chiziq text-matn cursor-pointer" title="Nusxalash">
                                {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={sending} onClick={() => send(current.order.id)}
                                className="flex-1 h-10 px-4 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer">
                                <Send size={14} /> {sending ? 'Yuborilmoqda...' : 'Telegramga yuborish'}
                            </button>
                            <a href={current.url} target="_blank" rel="noopener noreferrer"
                                className="h-10 px-4 border border-chiziq-kuchli text-brand hover:bg-brand hover:text-white rounded-xl text-[13px] font-semibold flex items-center gap-2">
                                <ExternalLink size={14} /> Ochish
                            </a>
                            <button type="button" onClick={() => setCurrent(null)}
                                className="h-10 px-4 border border-chiziq text-matn-xira rounded-xl text-[13px] font-semibold cursor-pointer">
                                Yangi
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={create} className="space-y-4">
                        {mode === 'test' && (
                            <p className="text-[11px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl px-3 py-2">
                                Payme TEST rejimda — havola sandbox kassaga olib boradi, haqiqiy pul yechilmaydi.
                            </p>
                        )}
                        {loadingCourses && (
                            <p className="text-[11px] font-bold text-matn-xira">Kurslar yuklanmoqda...</p>
                        )}
                        {courses.length > 0 && (
                            <div>
                                <label className="block text-[11px] font-extrabold text-matn-xira mb-2">Kurs</label>
                                <div className="space-y-2">
                                    {courses.map(c => (
                                        <button type="button" key={c.groupId} onClick={() => pick(c)}
                                            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-left cursor-pointer transition-colors ${groupId === c.groupId ? 'border-brand bg-brand/5' : 'border-chiziq bg-ichki hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                            <span>
                                                <span className="block text-sm font-bold text-matn">{c.courseName} <span className="text-matn-xira">· {c.groupName}</span></span>
                                                <span className="block text-[11px] font-bold text-matn-xira mt-0.5">
                                                    Oylik {money(c.monthlyPrice)}{c.debt > 0 ? ` · qarz ${money(c.debt)}` : c.advance > 0 ? ` · avans ${money(c.advance)}` : ''}
                                                </span>
                                            </span>
                                            {groupId === c.groupId && <Check size={16} className="text-brand shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-[11px] font-extrabold text-matn-xira mb-2">Summa (so'm)</label>
                            <input type="text" inputMode="numeric" className={inp} value={amount} placeholder="500000"
                                onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
                            {selected && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {selected.debt > 0 && (
                                        <button type="button" onClick={() => setAmount(String(selected.debt))} className="px-3 py-1.5 rounded-lg bg-ichki border border-chiziq text-[11px] font-bold text-matn cursor-pointer">Qarz: {money(selected.debt)}</button>
                                    )}
                                    {selected.monthlyPrice > 0 && (
                                        <button type="button" onClick={() => setAmount(String(selected.monthlyPrice))} className="px-3 py-1.5 rounded-lg bg-ichki border border-chiziq text-[11px] font-bold text-matn cursor-pointer">Oylik: {money(selected.monthlyPrice)}</button>
                                    )}
                                </div>
                            )}
                        </div>
                        <button type="submit" disabled={creating || loadingCourses}
                            className="w-full h-11 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer">
                            <Link2 size={15} /> {creating ? 'Yaratilmoqda...' : 'Havola yaratish'}
                        </button>
                    </form>
                )}

                {orders.length > 0 && (
                    <div className="pt-4 border-t border-chiziq-mayin/50">
                        <p className="text-[11px] font-extrabold text-matn-xira mb-2">Oldingi havolalar</p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {orders.map(o => {
                                const s = STATUS[o.status] || STATUS.new;
                                const pending = o.status === 'new' && o.transactions.some(t => t.state === 1);
                                return (
                                    <div key={o.id} className="flex items-center justify-between gap-2 text-[11px] font-bold text-matn">
                                        <span className="whitespace-nowrap text-matn-xira">{new Date(o.createdAt).toLocaleDateString('ru-RU')}</span>
                                        <span className="flex-1 truncate">{money(o.amount)} so'm{o.test ? ' · TEST' : ''}{o.source === 'bot' ? ' · bot' : ''}</span>
                                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${s.cls}`}>{pending ? "To'lanmoqda" : s.text}</span>
                                        {o.status === 'new' && o.url && (
                                            <>
                                                <button type="button" title="Nusxalash" onClick={() => copy(o.url!)} className="text-matn-xira hover:text-matn cursor-pointer"><Copy size={13} /></button>
                                                <button type="button" title="Telegramga yuborish" onClick={() => send(o.id)} className="text-matn-xira hover:text-matn cursor-pointer"><Send size={13} /></button>
                                                {!pending && <button type="button" title="Bekor qilish" onClick={() => cancel(o.id)} className="text-matn-xira hover:text-rose-500 cursor-pointer"><Ban size={13} /></button>}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
