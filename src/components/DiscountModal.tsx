import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCRM } from '../context/CRMContext';

/**
 * Chegirma (qayta hisob) oynasi.
 *
 * O'quvchi kasal bo'lib yoki boshqa sababga ko'ra dars qoldirsa, o'sha darslar
 * uchun pul olinmasligi mumkin. Bunday yozuv kassaga pul kirmagani uchun
 * `type: 'Chegirma'` bilan saqlanadi — balansni oshiradi, lekin tushum
 * hisobotlariga tushmaydi (`src/lib/money.ts`).
 *
 * Summa qoldirilgan darslar bo'yicha taklif qilinadi: o'quvchining o'sha oydagi
 * yo'qlama yozuvlari darslar sonini beradi, kurs narxi esa bitta dars narxini.
 * Taklifni qo'lda o'zgartirish mumkin.
 */
export default function DiscountModal({ studentId, onClose, onAdd }: {
    studentId: number;
    onClose: () => void;
    onAdd: (data: any) => Promise<any>;
}) {
    const { students, groups, courses, attendances, showNotification } = useCRM();
    const student = students.find(s => s.id === studentId);

    const today = new Date();
    const [month, setMonth] = useState(
        today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0')
    );
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [touched, setTouched] = useState(false);

    // O'quvchining tanlangan oydagi guruh bo'yicha yo'qlamasi.
    const perGroup = React.useMemo(() => {
        const rows = (attendances || []).filter(
            a => a.studentId === studentId && (a.date || '').startsWith(month)
        );
        const byGroup = new Map<number, { total: number; missed: number }>();
        rows.forEach(a => {
            const cur = byGroup.get(a.groupId) || { total: 0, missed: 0 };
            cur.total += 1;
            if (a.status === 'Kelmapdi' || a.status === 'Sababli') cur.missed += 1;
            byGroup.set(a.groupId, cur);
        });

        return [...byGroup].map(([groupId, v]) => {
            const group = groups.find(g => g.id === groupId);
            const course = group ? courses.find(c => c.id === group.courseId) : null;
            const custom = (student?.customPrices && typeof student.customPrices === 'object')
                ? (student.customPrices as Record<string, any>)[groupId]
                : undefined;
            const price = typeof custom === 'number' ? custom : (course?.price || 0);
            // Bitta dars narxi: oy narxini o'sha oyda bo'lgan darslar soniga bo'lamiz.
            const perLesson = v.total > 0 ? price / v.total : 0;
            return {
                groupId,
                name: group?.name || ('#' + groupId),
                total: v.total,
                missed: v.missed,
                sum: Math.round(perLesson * v.missed),
            };
        }).filter(r => r.missed > 0);
    }, [attendances, studentId, month, groups, courses, student]);

    const suggested = perGroup.reduce((s, r) => s + r.sum, 0);

    // Oy o'zgarsa taklif yangilanadi, lekin summa qo'lda kiritilgan bo'lsa
    // ustidan yozilmaydi.
    React.useEffect(() => {
        if (!touched) setAmount(suggested > 0 ? String(suggested) : '');
    }, [suggested, touched]);

    const monthLabel = (() => {
        const [y, m] = month.split('-').map(Number);
        if (!y || !m) return month;
        return new Date(y, m - 1, 1).toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });
    })();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        const val = Math.round(Number(amount));
        if (!Number.isFinite(val) || val <= 0) {
            showNotification('Summani kiriting', 'error');
            return;
        }
        if (!reason.trim()) {
            showNotification('Sababni yozing', 'error');
            return;
        }
        setSaving(true);
        try {
            await onAdd({
                studentId,
                amount: val,
                type: 'Chegirma',
                date: new Date().toISOString().split('T')[0],
                description: '[CHEGIRMA] ' + monthLabel + ' — ' + reason.trim(),
            });
            showNotification('Chegirma hisobga olindi', 'success');
            onClose();
        } catch (err: any) {
            showNotification("Saqlab bo'lmadi: " + (err?.message || 'xatolik'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const inputCls = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
    const labelCls = "block text-[11px] font-extrabold text-matn-xira mb-2";

    return (
        <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <form onSubmit={handleSubmit}
                className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-md p-8 space-y-4 my-auto">
                <div className="flex items-center justify-between pb-4 border-b border-chiziq-mayin/50">
                    <div>
                        <h3 className="text-lg font-black text-matn tracking-tight">Chegirma</h3>
                        <p className="text-[11px] font-bold text-brand mt-0.5">{student?.name}</p>
                    </div>
                    <button type="button" aria-label="Yopish" onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div>
                    <label className={labelCls}>Qaysi oy uchun</label>
                    <input type="month" value={month} onChange={e => { setMonth(e.target.value); setTouched(false); }}
                        className={inputCls} />
                </div>

                <div className="p-4 bg-ichki rounded-2xl border border-chiziq/80">
                    <span className="text-[10px] font-bold text-matn-xira block mb-2">Qoldirilgan darslar</span>
                    {perGroup.length === 0 ? (
                        <p className="text-[11px] text-matn-xira italic">
                            Bu oyda qoldirilgan dars topilmadi — summani o'zingiz kiriting.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {perGroup.map(r => (
                                <div key={r.groupId} className="flex items-center justify-between gap-2 text-[11px]">
                                    <span className="font-bold text-matn truncate">{r.name}</span>
                                    <span className="text-matn-xira shrink-0">
                                        <span className="num">{r.missed}</span>/<span className="num">{r.total}</span> dars &middot;{' '}
                                        <span className="num font-bold text-matn-2">{r.sum.toLocaleString()}</span> so'm
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <label className={labelCls}>Summa (UZS)</label>
                    <input type="number" value={amount} required
                        onChange={e => { setAmount(e.target.value); setTouched(true); }}
                        placeholder="Masalan: 125 000" className={inputCls} />
                    {suggested > 0 && (
                        <button type="button" onClick={() => { setAmount(String(suggested)); setTouched(false); }}
                            className="mt-2 text-[11px] font-bold text-brand hover:underline cursor-pointer">
                            Taklif: {suggested.toLocaleString()} so'm
                        </button>
                    )}
                </div>

                <div>
                    <label className={labelCls}>Sabab *</label>
                    <input type="text" value={reason} required onChange={e => setReason(e.target.value)}
                        placeholder="Masalan: kasal bo'ldi" className={inputCls} />
                </div>

                <p className="text-[10px] text-matn-xira">
                    Chegirma o'quvchining balansini oshiradi, lekin kassa tushumi sifatida hisoblanmaydi.
                </p>

                <div className="flex gap-3 pt-4 border-t border-dashed border-chiziq/50">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                        Bekor
                    </button>
                    <button type="submit" disabled={saving}
                        className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-xs font-extrabold rounded-2xl cursor-pointer transition-all">
                        {saving ? 'Saqlanmoqda…' : 'Saqlash'}
                    </button>
                </div>
            </form>
        </div>
    );
}
