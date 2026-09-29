import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { toDateStr } from '../../lib/lessons.js';
import type { KursdanChiqishTanlovi } from '../types';

/**
 * Kursdan chiqarish (egasi, 2026-09-29): "2–3 dars keldi — pulni umuman
 * olmasligimiz yoki to'liq emas, bir qismini olishimiz mumkin".
 *
 * Har kurs uchun shu oy hisobi tanlanadi: o'zgarmaydi (sukut), kelgan darslari
 * uchun, olinmaydi yoki boshqa summa. Farqi balansga tushadi — naqd
 * qaytarilmaydi (services/enrollment.js → kursdanChiqish). Darslar va taklif
 * serverdan keladi (preview), balans o'zgarishi shu yerda sanaladi.
 *
 * Ikki xil ishlatiladi:
 *   - kurs sahifasi va o'quvchi kartochkasi — oyna o'zi chiqaradi;
 *   - holat Passiv (Arxiv …) qilinganda — `onTanlov` tanlovni qaytaradi va u
 *     holat bilan birga saqlanadi (PUT /api/students/:id → chiqish).
 */
type Variant = 'qoldir' | 'dars' | 'nol' | 'boshqa';

interface Qator {
    groupId: number;
    groupName: string;
    yozilgan: number;
    since: string;
    otganDars: number | null;
    kelganDars: number | null;
    darsSoni: number | null;
    taklif: number | null;
}

const pul = (n: number) => Math.round(n).toLocaleString('ru-RU');
const kunOy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

export default function KursdanChiqarishModal({ studentId, groupIds, sarlavha, izoh, tugma, onClose, onTanlov, onDone }: {
    studentId: number;
    groupIds: number[];
    sarlavha?: string;
    izoh?: string;
    tugma?: string;
    onClose: () => void;
    /** Berilsa oyna o'zi chiqarmaydi — tanlovni qaytaradi. */
    onTanlov?: (t: KursdanChiqishTanlovi) => void;
    onDone?: () => void;
}) {
    const { students, showNotification, kursdanChiqarish, ozgartira } = useCRM();
    const student = students.find(s => s.id === studentId);
    // Shu oy hisobini o'zgartirish — "Kurs hisobi" ruxsati (birinchi oy summasi kabi).
    const hisobTahrir = ozgartira('oquvchilar.kursHisobi');
    const bugun = toDateStr();
    const [sana, setSana] = useState(bugun);
    const [korinish, setKorinish] = useState<any>(null);
    const [xato, setXato] = useState<string | null>(null);
    const [yuklanmoqda, setYuklanmoqda] = useState(true);
    const [saqlanmoqda, setSaqlanmoqda] = useState(false);
    const [variant, setVariant] = useState<Record<number, Variant>>({});
    const [boshqa, setBoshqa] = useState<Record<number, string>>({});

    // Sana o'zgarsa darslar va taklif qayta sanaladi (hech narsa yozilmaydi).
    const kalit = groupIds.join(',');
    useEffect(() => {
        if (!sana) return;
        let off = false;
        setYuklanmoqda(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/students/${studentId}/kursdan-chiqarish`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('token') },
                    body: JSON.stringify({ schoolId: student?.schoolId, date: sana, kurslar: groupIds.map(groupId => ({ groupId })), preview: true }),
                });
                const data = await res.json();
                if (off) return;
                if (res.ok) { setKorinish(data); setXato(null); }
                else setXato(data.error || "Hisoblab bo'lmadi");
            } catch {
                if (!off) setXato('Aloqa xatosi');
            } finally {
                if (!off) setYuklanmoqda(false);
            }
        }, 250);
        return () => { off = true; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sana, studentId, kalit]);

    const qatorlar: Qator[] = korinish?.lines || [];
    const trial = !!korinish?.trial;
    const tanlash = hisobTahrir && !trial;
    const oy = String(korinish?.oy || '');
    const Oy = oy.charAt(0).toUpperCase() + oy.slice(1);

    /** Kurs bo'yicha shu oy uchun olinadigan summa; null — hisob o'zgarmaydi. */
    const summaOf = (q: Qator): number | null => {
        if (!tanlash) return null;
        const v = variant[q.groupId] || 'qoldir';
        if (v === 'dars') return q.taklif;
        if (v === 'nol') return 0;
        if (v === 'boshqa') {
            const matn = String(boshqa[q.groupId] || '').trim();
            const n = Number(matn);
            return matn && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
        }
        return null;
    };
    const farq = qatorlar.reduce((s, q) => { const v = summaOf(q); return s + (v === null ? 0 : q.yozilgan - v); }, 0);
    const oldin = Number(korinish?.balanceBefore ?? student?.balance ?? 0);
    const keyin = oldin + farq;
    const boshqaBosh = qatorlar.some(q => variant[q.groupId] === 'boshqa' && summaOf(q) === null);

    const tanla = (gid: number, v: Variant) => setVariant(p => ({ ...p, [gid]: v }));

    const tasdiqlash = async () => {
        if (saqlanmoqda || !korinish || boshqaBosh) return;
        const summalar: Record<number, number | null> = {};
        for (const q of qatorlar) summalar[q.groupId] = summaOf(q);
        const t: KursdanChiqishTanlovi = { sana, summalar };
        if (onTanlov) { onTanlov(t); return; }
        setSaqlanmoqda(true);
        try {
            const r = await kursdanChiqarish(studentId, groupIds, t);
            const nomlar = (r.lines || []).map((l: any) => l.groupName).join(', ');
            const d = Number(r.balanceDelta || 0);
            showNotification(`${nomlar} kursidan chiqarildi` + (d ? ` · balans ${d > 0 ? '+' : '−'}${pul(Math.abs(d))} so'm` : ''), 'success');
            onDone?.();
            onClose();
        } catch (e: any) {
            showNotification(e?.message || "Chiqarib bo'lmadi", 'error');
        } finally {
            setSaqlanmoqda(false);
        }
    };

    const kiritish = 'w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand outline-none transition-all';

    // Bitta tanlov qatori: chapda nomi, o'ngda summasi.
    const Tanlov = ({ faol, onClick, nom, izoh: qoshimcha, summa }: { faol: boolean; onClick: () => void; nom: string; izoh?: string; summa: number }) => (
        <button type="button" onClick={onClick}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${faol ? 'border-brand bg-brand/10' : 'border-chiziq bg-sirt hover:border-brand/50'}`}>
            <span className="flex items-center gap-2.5 min-w-0">
                <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${faol ? 'border-brand' : 'border-chiziq'}`}>
                    {faol && <span className="w-2 h-2 rounded-full bg-brand" />}
                </span>
                <span className="min-w-0">
                    <span className="block text-[12px] font-bold text-matn">{nom}</span>
                    {qoshimcha && <span className="block text-[10px] text-matn-xira">{qoshimcha}</span>}
                </span>
            </span>
            <span className="num text-[12px] font-black text-matn shrink-0">{pul(summa)}</span>
        </button>
    );

    return (
        <div className="fixed inset-0 z-[250] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div role="dialog" aria-modal="true" aria-label={sarlavha || 'Kursdan chiqarish'}
                className="relative bg-sirt w-full max-w-md rounded-[2rem] p-6 sm:p-8 shadow-2xl border border-chiziq">
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-chiziq-mayin/50">
                    <div className="min-w-0">
                        <h3 className="text-sm font-black text-matn tracking-tight">{sarlavha || 'Kursdan chiqarish'}</h3>
                        <p className="text-[11px] font-bold text-brand mt-0.5 truncate">{student?.name}</p>
                    </div>
                    <button aria-label="Yopish" onClick={onClose} className="w-8 h-8 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer"><X size={18} /></button>
                </div>

                <div className="space-y-4">
                    {izoh && <p className="text-[11px] font-medium text-matn-sokin leading-relaxed">{izoh}</p>}

                    {tanlash && (
                        <div>
                            <label className="block text-[11px] font-bold text-matn-xira mb-2">Chiqish sanasi</label>
                            <input type="date" value={sana} min={bugun.slice(0, 8) + '01'} max={bugun}
                                onChange={e => setSana(e.target.value)} className={kiritish} />
                        </div>
                    )}

                    {xato && (
                        <p className="text-[11px] font-bold text-xato bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl px-3 py-2">{xato}</p>
                    )}
                    {!korinish && yuklanmoqda && !xato && (
                        <p className="text-[11px] font-bold text-matn-xira bg-ichki/50 border border-chiziq rounded-2xl p-3">Hisoblanmoqda…</p>
                    )}

                    {korinish && (
                        <div className={`space-y-3 transition-opacity ${yuklanmoqda ? 'opacity-50' : ''}`}>
                            {qatorlar.map(q => {
                                const v = variant[q.groupId] || 'qoldir';
                                return (
                                    <div key={q.groupId} className="p-4 bg-ichki/40 border border-chiziq rounded-2xl space-y-3">
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-bold text-matn truncate">{q.groupName}</p>
                                            {!trial && (
                                                <p className="num text-[11px] text-matn-xira mt-0.5">
                                                    {Oy} hisobi: <span className="font-bold text-matn">{pul(q.yozilgan)} so'm</span>
                                                </p>
                                            )}
                                            {!trial && q.otganDars !== null && (
                                                <p className="num text-[11px] text-matn-xira">
                                                    {kunOy(q.since)}–{kunOy(sana)}: {q.otganDars} dars o'tdi
                                                    {q.kelganDars !== null ? `, ${q.kelganDars} tasiga keldi` : ' (davomat belgilanmagan)'}
                                                </p>
                                            )}
                                        </div>

                                        {trial && <p className="text-[11px] font-bold text-matn-xira">Sinov o'quvchi — hisob yozilmagan.</p>}
                                        {!trial && !hisobTahrir && (
                                            <p className="text-[11px] text-matn-xira">Hisob o'zgarmaydi (uni «Kurs hisobi» ruxsati bor xodim o'zgartiradi).</p>
                                        )}

                                        {tanlash && (
                                            <div className="space-y-2">
                                                <p className="text-[11px] font-bold text-matn">Shu oy uchun qancha olinadi?</p>
                                                <Tanlov faol={v === 'qoldir'} onClick={() => tanla(q.groupId, 'qoldir')} nom="O'zgarmaydi" summa={q.yozilgan} />
                                                {q.taklif !== null && q.darsSoni !== null && q.taklif > 0 && q.taklif < q.yozilgan && (
                                                    <Tanlov faol={v === 'dars'} onClick={() => tanla(q.groupId, 'dars')}
                                                        nom={`${q.darsSoni} dars uchun`}
                                                        izoh={q.kelganDars !== null ? 'kelgan darslari' : "jadval bo'yicha o'tgan darslar"}
                                                        summa={q.taklif} />
                                                )}
                                                {q.yozilgan > 0 && (
                                                    <Tanlov faol={v === 'nol'} onClick={() => tanla(q.groupId, 'nol')} nom="Olinmaydi" summa={0} />
                                                )}
                                                <input type="number" min={0} inputMode="numeric" placeholder="Boshqa summa"
                                                    value={boshqa[q.groupId] || ''}
                                                    onFocus={() => { if ((boshqa[q.groupId] || '').trim()) tanla(q.groupId, 'boshqa'); }}
                                                    onChange={e => {
                                                        const m = e.target.value;
                                                        setBoshqa(p => ({ ...p, [q.groupId]: m }));
                                                        tanla(q.groupId, m.trim() ? 'boshqa' : 'qoldir');
                                                    }}
                                                    className={`${kiritish} num ${v === 'boshqa' ? '!border-brand' : ''}`} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {!trial && (
                                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-ichki/50 border border-chiziq rounded-2xl">
                                    <span className="text-[11px] font-bold text-matn">Balans</span>
                                    <span className={`num text-[12px] font-black ${farq > 0 ? 'text-yaxshi' : farq < 0 ? 'text-xato' : 'text-matn'}`}>
                                        {farq === 0 ? `${pul(oldin)} — o'zgarmaydi` : `${pul(oldin)} → ${pul(keyin)}`}
                                    </span>
                                </div>
                            )}
                            {farq > 0 && keyin > 0 && (
                                <p className="text-[10px] font-medium text-matn-xira">Naqd qaytarilmaydi — {pul(keyin)} so'm o'quvchining balansida qoladi.</p>
                            )}
                            {farq < 0 && (
                                <p className="text-[10px] font-bold text-ogoh">Diqqat: summa yozilgan hisobdan katta — hisob oshadi.</p>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-3 bg-ichki hover:bg-gray-100 dark:hover:bg-gray-800 text-matn-xira rounded-xl text-[11px] font-bold transition-all cursor-pointer">
                            Bekor
                        </button>
                        <button type="button" onClick={tasdiqlash} disabled={saqlanmoqda || yuklanmoqda || !korinish || !!xato || boshqaBosh}
                            className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer">
                            {saqlanmoqda ? 'Chiqarilmoqda…' : (tugma || 'Kursdan chiqarish')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
