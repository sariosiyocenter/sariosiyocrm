import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useCRM } from '../context/CRMContext';

/**
 * Kursga kelgan sanani o'zgartirish oynasi.
 *
 * O'quvchi ro'yxatga oy boshida olinib, darsga oy o'rtasidan kelishi mumkin —
 * oylik hisob aynan shu kundan yuritiladi (services/enrollment.js →
 * setCourseStart). Pulga tegadigan amal, shuning uchun avval "qancha
 * o'zgaradi" ko'rsatiladi, keyin saqlanadi.
 *
 * O'quvchi kartochkasida ham, kurs sahifasidagi ro'yxatda ham shu oyna.
 */
export default function KelganSanaModal({ studentId, schoolId, groupId, groupName, current, onClose, onSaved }: {
    studentId: number;
    schoolId: number;
    groupId: number;
    groupName: string;
    current: string;
    onClose: () => void;
    onSaved?: () => void;
}) {
    const { showNotification, retryLoad } = useCRM();
    const [sana, setSana] = useState(current);
    const [korinish, setKorinish] = useState<any>(null);
    const [saqlanmoqda, setSaqlanmoqda] = useState(false);

    const sorov = (preview: boolean, date: string) => fetch(`/api/students/${studentId}/course-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
        body: JSON.stringify({ schoolId, groupId, date, preview }),
    });

    // Sana o'zgarishi bilan — hisob qanday o'zgarishini ko'rsatish.
    useEffect(() => {
        if (!sana) { setKorinish(null); return; }
        let off = false;
        (async () => {
            try {
                const res = await sorov(true, sana);
                const data = await res.json();
                if (!off) setKorinish(res.ok ? data : { error: data.error });
            } catch {
                if (!off) setKorinish({ error: 'Aloqa xatosi' });
            }
        })();
        return () => { off = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sana]);

    const saqlash = async () => {
        if (!sana || saqlanmoqda) return;
        setSaqlanmoqda(true);
        try {
            const res = await sorov(false, sana);
            const data = await res.json();
            if (!res.ok) { showNotification(data.error || 'Saqlanmadi', 'error'); return; }
            const farq = Number(data.balanceDelta || 0);
            showNotification(
                farq === 0
                    ? `Kelgan sana ${sana.split('-').reverse().join('.')} qilib belgilandi`
                    : `Kelgan sana ${sana.split('-').reverse().join('.')} · hisob ${farq > 0 ? 'kamaydi' : 'oshdi'}: ${Math.abs(farq).toLocaleString('ru-RU')} so'm`,
                'success'
            );
            if (data.warning) showNotification(data.warning, 'error');
            retryLoad();
            onSaved?.();
            onClose();
        } catch {
            showNotification('Aloqa xatosi', 'error');
        } finally {
            setSaqlanmoqda(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[250] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-chiziq">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq-mayin/50">
                    <div>
                        <h3 className="text-sm font-black text-matn tracking-tight">Kursga kelgan sana</h3>
                        <p className="text-[11px] font-bold text-brand mt-0.5">{groupName}</p>
                    </div>
                    <button aria-label="Yopish" onClick={onClose} className="w-8 h-8 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer"><X size={18} /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[11px] font-bold text-matn-xira mb-2">Qaysi kundan kelib boshlagan</label>
                        <input type="date" value={sana} onChange={e => setSana(e.target.value)}
                            className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand outline-none transition-all" />
                        <span className="block text-[10px] text-matn-xira font-medium mt-1">
                            Oylik hisob shu kundan oy oxirigacha bo'lgan darslar uchun yoziladi
                        </span>
                    </div>

                    {korinish?.error && (
                        <p className="text-[11px] font-bold text-xato bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl px-3 py-2">{korinish.error}</p>
                    )}
                    {korinish && !korinish.error && (
                        <div className="bg-ichki/50 border border-chiziq rounded-2xl p-3 space-y-2">
                            {korinish.trial ? (
                                <p className="text-[11px] font-bold text-matn-xira">Sinov o'quvchisi — hisob yozilmaydi.</p>
                            ) : (korinish.lines || []).length === 0 ? (
                                <p className="text-[11px] font-bold text-matn-xira">Hisob o'zgarmaydi.</p>
                            ) : (
                                (korinish.lines || []).map((l: any) => (
                                    <div key={l.month} className="flex items-center justify-between gap-3">
                                        <span className="num text-[11px] font-bold text-matn-xira">{l.month} · {l.lessons} dars</span>
                                        <span className={`num text-[11px] font-black ${l.adjust > 0 ? 'text-yaxshi' : l.adjust < 0 ? 'text-xato' : 'text-matn-xira'}`}>
                                            {l.adjust > 0 ? '+' : ''}{Math.round(l.adjust).toLocaleString('ru-RU')}
                                        </span>
                                    </div>
                                ))
                            )}
                            {!korinish.trial && (
                                <div className="flex items-center justify-between gap-3 pt-2 border-t border-chiziq-mayin">
                                    <span className="text-[11px] font-bold text-matn">Balans</span>
                                    <span className="num text-[11px] font-black text-matn">
                                        {Math.round(korinish.balanceBefore).toLocaleString('ru-RU')} → {Math.round(korinish.balanceAfter).toLocaleString('ru-RU')}
                                    </span>
                                </div>
                            )}
                            {korinish.warning && <p className="text-[10px] font-bold text-ogoh">{korinish.warning}</p>}
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-3 bg-ichki hover:bg-gray-100 dark:hover:bg-gray-800 text-matn-xira rounded-xl text-[11px] font-bold transition-all cursor-pointer">
                            Bekor
                        </button>
                        <button type="button" onClick={saqlash} disabled={saqlanmoqda || !sana || !!korinish?.error}
                            className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer">
                            {saqlanmoqda ? 'Saqlanmoqda…' : 'Saqlash'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
