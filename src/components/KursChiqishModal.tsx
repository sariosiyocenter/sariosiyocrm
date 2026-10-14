import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
// Bugun — Toshkent vaqti bo'yicha (toISOString UTC: tungi 00–05 da kechani berardi).
import { toDateStr } from '../../lib/lessons.js';

/**
 * Chiqib ketgan kursning chiqish sanasi (egasi, 2026-10-14: "kursga kirish
 * sanasini belgilagandek chiqish sanasini ham belgilasin"). "Kurs hisobi"
 * oynasining ko'zgusi: sana tanlanadi, chiqish oyi shu kungacha hisoblanadi,
 * keyingi oylarning hisobi bekor bo'ladi. Saqlashdan oldin balans qanchaga
 * o'zgarishi ko'rsatiladi (services/enrollment.js → setKursChiqish).
 */
const pul = (n: number) => Math.round(n).toLocaleString('ru-RU');
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const oyNomi = (m: string) => `${OYLAR[Number(m.slice(5, 7)) - 1] || m} ${m.slice(0, 4)}`;

export default function KursChiqishModal({ studentId, schoolId, groupId, groupName, current, onClose, onSaved }: {
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
    // Chiqish oyi summasi: qo'lda yozilmaguncha tizim hisoblagani turadi.
    const [summa, setSumma] = useState('');
    const [qolda, setQolda] = useState(false);
    const [korinish, setKorinish] = useState<any>(null);
    const [yuklanmoqda, setYuklanmoqda] = useState(true);
    const [saqlanmoqda, setSaqlanmoqda] = useState(false);

    const tana = (preview: boolean) => ({
        schoolId, groupId, endDate: sana, preview,
        ...(qolda && summa.trim() !== '' ? { summa: Number(summa) } : {}),
    });
    const sorov = (preview: boolean) => fetch(`/api/students/${studentId}/kurs-chiqish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
        body: JSON.stringify(tana(preview)),
    });

    const kalit = JSON.stringify(tana(true));
    useEffect(() => {
        if (!sana) { setKorinish(null); return; }
        let off = false;
        setYuklanmoqda(true);
        const t = setTimeout(async () => {
            try {
                const res = await sorov(true);
                const data = await res.json();
                if (off) return;
                setKorinish(res.ok ? data : { error: data.error });
                if (res.ok && !qolda) setSumma(data.suggested != null ? String(data.suggested) : '');
            } catch {
                if (!off) setKorinish({ error: 'Aloqa xatosi' });
            } finally {
                if (!off) setYuklanmoqda(false);
            }
        }, 350);
        return () => { off = true; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kalit]);

    const saqlash = async () => {
        if (!sana || saqlanmoqda) return;
        setSaqlanmoqda(true);
        try {
            const res = await sorov(false);
            const data = await res.json();
            if (!res.ok) { showNotification(data.error || 'Saqlanmadi', 'error'); return; }
            const farq = Number(data.balanceDelta || 0);
            showNotification(
                farq === 0
                    ? 'Chiqish sanasi saqlandi'
                    : `Chiqish sanasi saqlandi · balans ${farq > 0 ? '+' : '−'}${pul(Math.abs(farq))} so'm`,
                'success'
            );
            retryLoad();
            onSaved?.();
            onClose();
        } catch {
            showNotification('Aloqa xatosi', 'error');
        } finally {
            setSaqlanmoqda(false);
        }
    };

    const k = korinish && !korinish.error ? korinish : null;
    const kiritish = 'w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand outline-none transition-all';

    return (
        <div className="fixed inset-0 z-[250] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt w-full max-w-md rounded-[2rem] p-6 sm:p-8 shadow-2xl border border-chiziq">
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-chiziq-mayin/50">
                    <div className="min-w-0">
                        <h3 className="text-sm font-black text-matn tracking-tight">Kursdan chiqish sanasi</h3>
                        <p className="text-[11px] font-bold text-brand mt-0.5 truncate">{groupName}</p>
                    </div>
                    <button aria-label="Yopish" onClick={onClose} className="w-8 h-8 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer"><X size={18} /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[11px] font-bold text-matn-xira mb-2">Kursdan chiqqan sana</label>
                        <input type="date" value={sana} max={toDateStr()}
                            onChange={e => { setSana(e.target.value); setQolda(false); }} className={kiritish} />
                        <span className="block text-[10px] text-matn-xira font-medium mt-1">
                            Shu kungacha o'tilgan darslar hisoblanadi, keyingi oylar hisobi bekor bo'ladi.
                        </span>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-matn-xira mb-2">
                            Chiqish oyi summasi{sana ? ` — ${oyNomi(sana.slice(0, 7))}` : ''}
                        </label>
                        <input type="number" min={0} inputMode="numeric" value={summa}
                            onChange={e => { setSumma(e.target.value); setQolda(true); }}
                            className={kiritish + ' num'} />
                        <span className="flex items-center justify-between gap-2 text-[10px] text-matn-xira font-medium mt-1">
                            <span>
                                {!k ? (yuklanmoqda ? 'Hisoblanmoqda…' : '')
                                    : k.suggested != null
                                        ? `Tizim hisobi: ${pul(k.suggested)} so'm (${k.suggestedLessons} dars)`
                                        : "Jadval yo'q — summani o'zingiz yozing"}
                            </span>
                            {qolda && k?.suggested != null && (
                                <button type="button" onClick={() => setQolda(false)} className="font-bold text-brand hover:underline cursor-pointer">
                                    hisoblanganini qo'yish
                                </button>
                            )}
                        </span>
                    </div>

                    {korinish?.error && (
                        <p className="text-[11px] font-bold text-xato bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl px-3 py-2">{korinish.error}</p>
                    )}
                    {!k && yuklanmoqda && !korinish?.error && (
                        <p className="text-[11px] font-bold text-matn-xira bg-ichki/50 border border-chiziq rounded-2xl p-3">Hisoblanmoqda…</p>
                    )}
                    {k && (
                        <div className={`bg-ichki/50 border border-chiziq rounded-2xl p-3 space-y-2 transition-opacity ${yuklanmoqda ? 'opacity-50' : ''}`}>
                            {(k.lines || []).map((l: any) => (
                                <div key={l.month} className="flex items-center justify-between gap-3">
                                    <span className="text-[11px] font-bold text-matn-xira">{oyNomi(l.month)}</span>
                                    <span className="num text-[11px] font-black text-matn">
                                        {l.alreadyCharged === l.due
                                            ? `${pul(l.due)} — o'zgarmaydi`
                                            : `${pul(l.alreadyCharged)} → ${pul(l.due)}`}
                                    </span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between gap-3 pt-2 border-t border-chiziq-mayin">
                                <span className="text-[11px] font-bold text-matn">Balans</span>
                                <span className={`num text-[11px] font-black ${k.balanceDelta > 0 ? 'text-yaxshi' : k.balanceDelta < 0 ? 'text-xato' : 'text-matn'}`}>
                                    {pul(k.balanceBefore)} → {pul(k.balanceAfter)}
                                </span>
                            </div>
                            {k.warning && <p className="text-[10px] font-bold text-ogoh">{k.warning}</p>}
                            {!k.lines?.length && <p className="text-[11px] font-bold text-matn-xira">Hisob o'zgarmaydi.</p>}
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-3 bg-ichki hover:bg-gray-100 dark:hover:bg-gray-800 text-matn-xira rounded-xl text-[11px] font-bold transition-all cursor-pointer">
                            Bekor
                        </button>
                        <button type="button" onClick={saqlash} disabled={saqlanmoqda || yuklanmoqda || !sana || !k}
                            className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer">
                            {saqlanmoqda ? 'Saqlanmoqda…' : 'Saqlash'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
