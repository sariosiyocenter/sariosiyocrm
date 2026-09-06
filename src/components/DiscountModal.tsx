import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useCRM } from '../context/CRMContext';

/**
 * Chegirma (qayta hisob) oynasi.
 *
 * O'quvchi kasal bo'lib yoki boshqa sababga ko'ra dars qoldirsa, o'sha darslar
 * uchun pul olinmasligi mumkin. Bunday yozuv kassaga pul kirmagani uchun
 * `type: 'Chegirma'` bilan saqlanadi — balansni oshiradi, lekin tushum
 * hisobotlariga tushmaydi (`src/lib/money.ts`).
 *
 * Chegirma HAR BIR KURS uchun alohida yoziladi. Ilgari hamma guruhning
 * summasi bitta yozuvga qo'shib yuborilardi va unda qaysi kurs ekani umuman
 * saqlanmasdi: keyinchalik chegirma qaysi kursga tegishli ekanini bilib
 * bo'lmasdi, ustozning guruhiga tushgan pul ham to'g'ri kamaymasdi.
 *
 * Summa qoldirilgan darslar bo'yicha taklif qilinadi: o'quvchining o'sha oydagi
 * yo'qlama yozuvlari darslar sonini beradi, kurs narxi esa bitta dars narxini.
 * Har bir kursning summasini qo'lda o'zgartirish mumkin.
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
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    /** Qaysi kurslar tanlangan va har biriga qancha summa. */
    const [picked, setPicked] = useState<Record<number, boolean>>({});
    const [sums, setSums] = useState<Record<number, string>>({});
    const [edited, setEdited] = useState<Record<number, boolean>>({});

    // O'quvchining tanlangan oydagi guruh bo'yicha yo'qlamasi.
    const perGroup = React.useMemo(() => {
        const rows = (attendances || []).filter(
            a => a.studentId === studentId && (a.date || '').startsWith(month)
        );
        const byGroup = new Map<number, { total: number; missed: number; dates: string[] }>();
        rows.forEach(a => {
            const cur = byGroup.get(a.groupId) || { total: 0, missed: 0, dates: [] };
            cur.total += 1;
            if (a.status === 'Kelmapdi' || a.status === 'Sababli') {
                cur.missed += 1;
                cur.dates.push(a.date);
            }
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
                courseId: group?.courseId ?? null,
                name: group?.name || ('#' + groupId),
                courseName: course?.name || '',
                total: v.total,
                missed: v.missed,
                dates: v.dates.sort(),
                sum: Math.round(perLesson * v.missed),
            };
        }).filter(r => r.missed > 0);
    }, [attendances, studentId, month, groups, courses, student]);

    // Oy o'zgarsa taklif qayta hisoblanadi. Qo'lda o'zgartirilgan summa saqlanadi.
    React.useEffect(() => {
        setPicked(prev => {
            const next: Record<number, boolean> = {};
            perGroup.forEach(r => { next[r.groupId] = prev[r.groupId] ?? true; });
            return next;
        });
        setSums(prev => {
            const next: Record<number, string> = {};
            perGroup.forEach(r => { next[r.groupId] = edited[r.groupId] ? (prev[r.groupId] ?? '') : String(r.sum); });
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [perGroup]);

    const chosen = perGroup.filter(r => picked[r.groupId]);
    const total = chosen.reduce((s, r) => s + (Number(sums[r.groupId]) || 0), 0);

    const monthLabel = (() => {
        const [y, m] = month.split('-').map(Number);
        if (!y || !m) return month;
        return new Date(y, m - 1, 1).toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });
    })();

    const shortDate = (d: string) => {
        const [, m, day] = d.split('-');
        return `${day}.${m}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        if (chosen.length === 0) {
            showNotification('Kamida bitta kursni tanlang', 'error');
            return;
        }
        if (!reason.trim()) {
            showNotification('Sababni yozing', 'error');
            return;
        }
        const rows = chosen
            .map(r => ({ ...r, val: Math.round(Number(sums[r.groupId])) }))
            .filter(r => Number.isFinite(r.val) && r.val > 0);
        if (rows.length === 0) {
            showNotification('Summani kiriting', 'error');
            return;
        }

        setSaving(true);
        try {
            const date = new Date().toISOString().split('T')[0];
            // Har bir kurs uchun alohida yozuv — shunda chegirma qaysi guruhga
            // tegishli ekani ham, ustozning hisobi ham to'g'ri chiqadi.
            for (const r of rows) {
                await onAdd({
                    studentId,
                    amount: r.val,
                    type: 'Chegirma',
                    groupId: r.groupId,
                    courseId: r.courseId,
                    date,
                    description: `[CHEGIRMA] ${r.name} — ${monthLabel}, ${r.missed} dars (${reason.trim()})`,
                });
            }
            showNotification(
                rows.length > 1
                    ? `${rows.length} ta kurs bo'yicha chegirma hisobga olindi`
                    : 'Chegirma hisobga olindi',
                'success'
            );
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
                className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-lg p-8 space-y-4 my-auto">
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
                    <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={inputCls} />
                </div>

                <div>
                    <label className={labelCls}>Qaysi kurs uchun chegirma</label>
                    {perGroup.length === 0 ? (
                        <div className="p-4 bg-ichki rounded-2xl border border-chiziq/80">
                            <p className="text-[11px] text-matn-xira italic">
                                Bu oyda qoldirilgan dars topilmadi. Yo'qlama belgilanmagan bo'lishi mumkin —
                                summani o'zingiz kiritolmaysiz, avval yo'qlamani to'ldiring.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {perGroup.map(r => {
                                const on = !!picked[r.groupId];
                                return (
                                    <div key={r.groupId}
                                        className={`rounded-2xl border transition-all ${on ? 'border-brand/50 bg-brand/5' : 'border-chiziq bg-ichki'}`}>
                                        <div className="flex items-center gap-3 p-3">
                                            <button type="button"
                                                onClick={() => setPicked(p => ({ ...p, [r.groupId]: !on }))}
                                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                                                    on ? 'bg-brand border-brand text-white' : 'border-chiziq-kuchli text-transparent'
                                                }`}>
                                                <Check size={12} />
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[12px] font-bold text-matn truncate">{r.name}</p>
                                                <p className="text-[10px] text-matn-xira truncate">
                                                    <span className="num">{r.missed}</span>/<span className="num">{r.total}</span> dars qoldirgan
                                                    {r.dates.length > 0 && ' · ' + r.dates.slice(0, 4).map(shortDate).join(', ')}
                                                    {r.dates.length > 4 && ' …'}
                                                </p>
                                            </div>
                                            <input type="number" value={sums[r.groupId] ?? ''}
                                                disabled={!on}
                                                onChange={e => {
                                                    setSums(s => ({ ...s, [r.groupId]: e.target.value }));
                                                    setEdited(x => ({ ...x, [r.groupId]: true }));
                                                }}
                                                className="w-32 px-3 py-2 bg-sirt border border-chiziq rounded-xl text-[12px] font-bold text-matn text-right outline-none focus:border-brand disabled:opacity-40 transition-all" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {chosen.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-ichki rounded-2xl border border-chiziq">
                        <span className="text-[12px] font-bold text-matn-sokin">Jami chegirma</span>
                        <span className="num text-[15px] font-bold text-brand">{total.toLocaleString('ru-RU')} so'm</span>
                    </div>
                )}

                <div>
                    <label className={labelCls}>Sabab *</label>
                    <input type="text" value={reason} required onChange={e => setReason(e.target.value)}
                        placeholder="Masalan: kasal bo'ldi" className={inputCls} />
                </div>

                <p className="text-[10px] text-matn-xira">
                    Chegirma o'quvchining balansini oshiradi, lekin kassa tushumi sifatida hisoblanmaydi.
                    Har bir kurs uchun alohida yozuv qoladi.
                </p>

                <div className="flex gap-3 pt-4 border-t border-dashed border-chiziq/50">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                        Bekor
                    </button>
                    <button type="submit" disabled={saving || chosen.length === 0}
                        className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold rounded-2xl cursor-pointer transition-all">
                        {saving ? 'Saqlanmoqda…' : 'Saqlash'}
                    </button>
                </div>
            </form>
        </div>
    );
}
