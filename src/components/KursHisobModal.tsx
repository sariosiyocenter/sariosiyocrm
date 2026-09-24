import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useCRM } from '../context/CRMContext';

/**
 * Kurs hisobi — bitta o'quvchining bitta kursdagi puli, hammasi bitta joyda
 * (egasi, 2026-09-23): kursga kelgan sana, shu o'quvchi uchun oylik narx va
 * birinchi oy summasi.
 *
 * Tizim birinchi oy summasini kelgan sanadan hisoblab beradi, xodim uni
 * o'zi yozishi mumkin ("oy o'rtasida kelsa 300 000 to'lasin"). Saqlashdan
 * oldin balans qanchaga o'zgarishi ko'rsatiladi (services/enrollment.js →
 * setKursHisob). Narxni faqat rahbar o'zgartiradi.
 *
 * O'quvchi kartochkasida ham, kurs sahifasidagi ro'yxatda ham shu oyna.
 */
const pul = (n: number) => Math.round(n).toLocaleString('ru-RU');
const oyNomi = (m: string) => {
    const oylar = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    return `${oylar[Number(m.slice(5, 7)) - 1] || m} ${m.slice(0, 4)}`;
};

export default function KursHisobModal({ studentId, schoolId, groupId, groupName, current, onClose, onSaved }: {
    studentId: number;
    schoolId: number;
    groupId: number;
    groupName: string;
    current: string;
    onClose: () => void;
    onSaved?: () => void;
}) {
    const { showNotification, retryLoad, user, ozgartira } = useCRM();
    // O'quvchiga alohida narx — "O'quvchilar → Alohida narx va chegirma" ruxsati.
    const rahbar = ozgartira('oquvchilar.narx');
    const [sana, setSana] = useState(current);
    // Narx: '' — o'zgarmaydi (birinchi ko'rinishda amaldagisi qo'yiladi).
    const [narx, setNarx] = useState('');
    const [narxTegildi, setNarxTegildi] = useState(false);
    // Birinchi oy summasi: qo'lda yozilmaguncha tizim hisoblagani turadi.
    const [summa, setSumma] = useState('');
    const [qolda, setQolda] = useState(false);
    const [korinish, setKorinish] = useState<any>(null);
    const [yuklanmoqda, setYuklanmoqda] = useState(true);
    const [saqlanmoqda, setSaqlanmoqda] = useState(false);

    const tanaFn = (preview: boolean) => ({
        schoolId, groupId, startDate: sana, preview,
        ...(narxTegildi && rahbar ? { price: narx.trim() === '' ? null : Number(narx) } : {}),
        ...(qolda && summa.trim() !== '' ? { firstMonthDue: Number(summa) } : {}),
    });
    const sorov = (preview: boolean) => fetch(`/api/students/${studentId}/kurs-hisob`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
        body: JSON.stringify(tanaFn(preview)),
    });

    // Har o'zgarishda — hisob qanday bo'lishini oldindan ko'rsatish. Faqat
    // serverga ketadigan narsa o'zgarganda (tizim taklifini maydonga qo'yish
    // qayta so'rov yubormaydi).
    const kalit = JSON.stringify(tanaFn(true));
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
                if (res.ok) {
                    if (!narxTegildi) setNarx(data.price !== data.standardPrice ? String(data.price) : '');
                    if (!qolda) setSumma(data.suggested != null ? String(data.suggested) : '');
                }
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
                    ? 'Kurs hisobi saqlandi'
                    : `Kurs hisobi saqlandi · balans ${farq > 0 ? '+' : '−'}${pul(Math.abs(farq))} so'm`,
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

    const k = korinish && !korinish.error ? korinish : null;
    const birinchi = k?.lines?.find((l: any) => l.first);
    const kiritish = 'w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand outline-none transition-all';

    return (
        <div className="fixed inset-0 z-[250] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt w-full max-w-md rounded-[2rem] p-6 sm:p-8 shadow-2xl border border-chiziq">
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-chiziq-mayin/50">
                    <div className="min-w-0">
                        <h3 className="text-sm font-black text-matn tracking-tight">Kurs hisobi</h3>
                        <p className="text-[11px] font-bold text-brand mt-0.5 truncate">{groupName}</p>
                    </div>
                    <button aria-label="Yopish" onClick={onClose} className="w-8 h-8 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer"><X size={18} /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[11px] font-bold text-matn-xira mb-2">Kursga kelgan sana</label>
                        <input type="date" value={sana} onChange={e => { setSana(e.target.value); setQolda(false); }} className={kiritish} />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-matn-xira mb-2">Oylik narx (shu o'quvchi uchun)</label>
                        {rahbar ? (
                            <>
                                <input type="number" min={0} inputMode="numeric" value={narx}
                                    placeholder={k ? `${pul(k.standardPrice)} — standart` : ''}
                                    onChange={e => { setNarx(e.target.value); setNarxTegildi(true); setQolda(false); }}
                                    className={kiritish + ' num'} />
                                <span className="block text-[10px] text-matn-xira font-medium mt-1">
                                    Bo'sh qoldirsangiz — kursning standart narxi{k ? ` (${pul(k.standardPrice)})` : ''}
                                </span>
                            </>
                        ) : (
                            <p className="num px-4 py-3 bg-ichki/50 border border-chiziq rounded-2xl text-xs font-bold text-matn">
                                {k ? `${pul(k.price)} so'm` : '…'}
                                <span className="text-[10px] text-matn-xira font-medium"> · narxni rahbar o'zgartiradi</span>
                            </p>
                        )}
                    </div>

                    {!k?.trial && (
                        <div>
                            <label className="block text-[11px] font-bold text-matn-xira mb-2">
                                Birinchi oy summasi{sana ? ` — ${oyNomi(sana.slice(0, 7))}` : ''}
                            </label>
                            <input type="number" min={0} inputMode="numeric" value={summa}
                                onChange={e => { setSumma(e.target.value); setQolda(true); }}
                                className={kiritish + ' num'} />
                            <span className="flex items-center justify-between gap-2 text-[10px] text-matn-xira font-medium mt-1">
                                <span>
                                    {!k ? (yuklanmoqda ? 'Hisoblanmoqda…' : '')
                                        : k.suggested != null
                                            ? `Tizim hisobi: ${pul(k.suggested)} so'm (${k.suggestedLessons} dars)`
                                            : 'Jadval yo\'q — summani o\'zingiz yozing'}
                                </span>
                                {qolda && k?.suggested != null && (
                                    <button type="button" onClick={() => setQolda(false)} className="font-bold text-brand hover:underline cursor-pointer">
                                        hisoblanganini qo'yish
                                    </button>
                                )}
                            </span>
                        </div>
                    )}

                    {korinish?.error && (
                        <p className="text-[11px] font-bold text-xato bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl px-3 py-2">{korinish.error}</p>
                    )}
                    {!k && yuklanmoqda && !korinish?.error && (
                        <p className="text-[11px] font-bold text-matn-xira bg-ichki/50 border border-chiziq rounded-2xl p-3">Hisoblanmoqda…</p>
                    )}
                    {k && (
                        <div className={`bg-ichki/50 border border-chiziq rounded-2xl p-3 space-y-2 transition-opacity ${yuklanmoqda ? 'opacity-50' : ''}`}>
                            {k.trial ? (
                                <p className="text-[11px] font-bold text-matn-xira">Sinov o'quvchisi — hisob yozilmaydi. Faolga o'tganda shu sana va narxdan yoziladi.</p>
                            ) : (
                                <>
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
                                </>
                            )}
                            {k.warning && <p className="text-[10px] font-bold text-ogoh">{k.warning}</p>}
                            {!birinchi && !k.trial && !k.lines?.length && <p className="text-[11px] font-bold text-matn-xira">Hisob o'zgarmaydi.</p>}
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
