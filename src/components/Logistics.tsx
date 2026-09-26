import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCRM } from '../context/CRMContext';
import {
    Bus, Loader2, BarChart3, Download, CalendarRange, Navigation, Check, Wallet, Pencil,
} from 'lucide-react';
import { toDateStr } from '../../lib/lessons.js';
import { tarifMatni, somMatni } from '../../lib/transportNarx.js';
import TransportTarif, { type Tarif } from './TransportTarif';
import RejaTab from './logistika/RejaTab';

/**
 * Logistika — kunlik transport rejasi.
 *
 * Reja bo'limi (2026-09-26 dan) — xarita markazidagi ish joyi, ./logistika/RejaTab.tsx:
 * kunning bolalari xaritada mashinalar rangida, xohlagancha o'zgartiriladi va
 * "Haydovchilarga yuborish" bilan faqat o'zgargani haydovchilarning
 * Telegramiga boradi. Haydovchi botda "Qabul qildim" va "Yetkazdim" bosadi.
 *
 * Marshrut va Avtopark bo'limlari yo'q (egasi: "kerakmas") — mashina
 * ma'lumoti xodim kartasida (Xodimlar → Haydovchi) kiritiladi. Yo'l haqi
 * tarifi shu sahifaning "Yo'l haqi" bo'limida — hamma haydovchi uchun bitta
 * (egasi, 2026-09-25: "har bir haydovchi uchun emas, hammaga bitta qoida").
 */

type Tab = 'reja' | 'narx' | 'tarix';

interface NarxHaydovchi { id: number; name: string }

const inp = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[11px] font-extrabold text-matn-xira mb-2";
const karta = "bg-sirt rounded-2xl border border-chiziq shadow-sm";

export default function LogisticsHub() {
    const { showNotification, token, selectedSchoolId, kora, ozgartira } = useCRM();
    // Lavozim ruxsati (Sozlamalar → Ruxsatlar): reja tuzish/belgilash va tarix alohida.
    const rejaKorinadi = kora('logistika.reja');
    const rejaTahrir = ozgartira('logistika.reja');
    const tarixKorinadi = kora('logistika.tarix');

    const [tab, setTab] = useState<Tab>(() => (rejaKorinadi ? 'reja' : 'tarix'));

    // ===== Yo'l haqi bo'limi uchun: tarif va haydovchilar =====
    const [kun, setKun] = useState<{ drivers: NarxHaydovchi[]; tarif: Tarif | null } | null>(null);
    const [kunYuklanmoqda, setKunYuklanmoqda] = useState(false);
    const sorov = useRef(0);
    const kunniYuklash = useCallback(async () => {
        if (!selectedSchoolId) return;
        const so = ++sorov.current;
        setKunYuklanmoqda(true);
        try {
            const r = await fetch(`/api/logistics/day?schoolId=${selectedSchoolId}&date=${toDateStr()}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Yuklab bo'lmadi");
            const d = await r.json();
            if (so === sorov.current) setKun({ drivers: d.drivers || [], tarif: d.tarif ?? null });
        } catch (e: any) {
            showNotification(e.message || "Logistika ma'lumoti yuklanmadi", 'error');
        } finally {
            if (so === sorov.current) setKunYuklanmoqda(false);
        }
    }, [selectedSchoolId, token]);
    useEffect(() => { if (tab === 'narx' && rejaKorinadi) kunniYuklash(); }, [tab, kunniYuklash]);
    const haydovchilar = kun?.drivers || [];
    const [band, setBand] = useState('');

    // ===== Yo'l haqi (haydovchi tarifi) =====
    // Ilgari Xodimlar → haydovchi kartasida edi; egasi (2026-09-24) Logistikaga ko'chirdi.
    const [tarifTahrir, setTarifTahrir] = useState<{ qiymat: Tarif | null } | null>(null);
    const tarifniSaqlash = async () => {
        if (!tarifTahrir || !rejaTahrir) return;
        setBand('tarif');
        try {
            const r = await fetch('/api/logistics/tarif', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ schoolId: selectedSchoolId, tarif: tarifTahrir.qiymat }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'Saqlanmadi');
            showNotification("Yo'l haqi saqlandi", 'success');
            setTarifTahrir(null);
            await kunniYuklash();
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setBand('');
        }
    };

    // ===== Tarix =====
    const [statsFrom, setStatsFrom] = useState('');
    const [statsTo, setStatsTo] = useState('');
    const [stats, setStats] = useState<any>(null);
    const [statsYuklanmoqda, setStatsYuklanmoqda] = useState(false);

    const statsniYuklash = async () => {
        setStatsYuklanmoqda(true);
        try {
            const q = new URLSearchParams({ schoolId: String(selectedSchoolId || '') });
            if (statsFrom) q.set('from', statsFrom);
            if (statsTo) q.set('to', statsTo);
            const r = await fetch(`/api/logistics/stats?${q}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!r.ok) throw new Error("So'rov muvaffaqiyatsiz");
            setStats(await r.json());
        } catch {
            showNotification("Statistikani yuklab bo'lmadi", 'error');
        } finally {
            setStatsYuklanmoqda(false);
        }
    };
    useEffect(() => { if (tab === 'tarix' && tarixKorinadi && !stats && !statsYuklanmoqda) statsniYuklash(); }, [tab]);

    const excelgaChiqarish = async () => {
        if (!stats) return;
        const XLSX = await import('xlsx');
        const kitob = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(kitob, XLSX.utils.json_to_sheet(
            (stats.oquvchilar || []).map((x: any) => ({
                "O'quvchi": x.name, 'Olib ketildi': x.olindi, 'Uyiga yetkazildi': x.yetkazildi, 'Kelmadi': x.kelmadi, "Yo'l haqi (so'm)": x.summa ?? 0,
            }))
        ), "O'quvchilar");
        XLSX.utils.book_append_sheet(kitob, XLSX.utils.json_to_sheet(
            (stats.haydovchilar || []).map((x: any) => ({
                'Haydovchi': x.name, 'Reyslar': x.reys, 'Tugatilgan': x.tugagan, "O'rtacha (daqiqa)": x.ortachaDaqiqa ?? '', "Ishlagan (so'm)": x.summa ?? 0,
            }))
        ), 'Haydovchilar');
        XLSX.writeFile(kitob, `logistika-${statsFrom || 'boshidan'}_${statsTo || toDateStr()}.xlsx`);
    };

    // ===== JSX =====
    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* Sarlavha */}
            <div className={`${karta} px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-sm">
                        <Navigation size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-matn tracking-tight">Logistika</h1>
                        <p className="text-[11px] font-bold text-matn-xira mt-0.5">Kunlik transport rejasi va haydovchilar</p>
                    </div>
                </div>
                <div className="flex bg-ichki p-1 rounded-xl border border-chiziq w-fit">
                    {([['reja', 'Reja', <Bus size={13} key="i" />], ['narx', "Yo'l haqi", <Wallet size={13} key="i" />], ['tarix', 'Tarix', <BarChart3 size={13} key="i" />]] as const).filter(([id]) => id === 'tarix' ? tarixKorinadi : rejaKorinadi).map(([id, label, icon]) => (
                        <button key={id} onClick={() => setTab(id as Tab)}
                            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${tab === id ? 'bg-brand text-brand-ust shadow' : 'text-matn-xira hover:text-matn'}`}>
                            {icon} {label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'reja' && rejaKorinadi && <RejaTab onTarif={() => setTab('narx')} />}

            {/* ===== YO'L HAQI — hamma haydovchi uchun bitta tarif ===== */}
            {tab === 'narx' && rejaKorinadi && (
                <div className={`${karta} p-5 space-y-4 max-w-2xl`}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-black text-matn flex items-center gap-2"><Wallet size={16} className="text-brand" /> Yo'l haqi — hamma haydovchi uchun bitta</p>
                            <p className="text-[11px] font-bold text-matn-xira mt-1 leading-relaxed">
                                Bir o'quvchini olib borish narxi — qaysi haydovchi olib borishidan qat'i nazar bir xil. Reja tuzilganda har bola uchun
                                shu tarifdan hisoblanadi va haydovchiga botda ko'rinadi. O'quvchi pulni mashinada haydovchiga naqd beradi — kassaga tushmaydi, qarziga yozilmaydi.
                            </p>
                        </div>
                        {kunYuklanmoqda && <Loader2 size={14} className="animate-spin text-matn-xira shrink-0" />}
                    </div>

                    {tarifTahrir ? (
                        <div className="space-y-3 pt-3 border-t border-chiziq-mayin">
                            <TransportTarif value={tarifTahrir.qiymat} onChange={t => setTarifTahrir({ qiymat: t })} />
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setTarifTahrir(null)} disabled={!!band}
                                    className="px-4 py-2 rounded-xl bg-ichki border border-chiziq text-[11px] font-extrabold text-matn-2 cursor-pointer">Bekor qilish</button>
                                <button onClick={tarifniSaqlash} disabled={!!band}
                                    className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer">
                                    {band === 'tarif' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Saqlash
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap items-center gap-3">
                            <p className={`flex-1 min-w-[220px] text-[13px] font-bold px-4 py-3 rounded-xl border ${kun?.tarif
                                ? 'bg-ichki border-chiziq text-matn'
                                : 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400'}`}>
                                {kun?.tarif ? `💰 ${tarifMatni(kun.tarif)}` : "Yo'l haqi kiritilmagan — rejada bolalar «narxsiz» chiqadi"}
                            </p>
                            {rejaTahrir && (
                                <button onClick={() => setTarifTahrir({ qiymat: kun?.tarif || null })} disabled={!!band || !kun}
                                    className="px-4 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[12px] font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0">
                                    <Pencil size={13} /> {kun?.tarif ? "O'zgartirish" : 'Kiritish'}
                                </button>
                            )}
                        </div>
                    )}

                    <p className="text-[11px] font-bold text-matn-xira pt-3 border-t border-chiziq-mayin">
                        {!kun ? '' : haydovchilar.length
                            ? `Haydovchilar: ${haydovchilar.map(h => h.name).join(', ')} — hammasiga shu tarif.`
                            : "Haydovchi yo'q. Xodimlar bo'limida \"Haydovchi\" lavozimi bilan qo'shing."}
                    </p>
                </div>
            )}

            {/* ===== TARIX ===== */}
            {tab === 'tarix' && tarixKorinadi && (
                <div className="space-y-4">
                    <div className={`${karta} p-4 flex flex-wrap items-end gap-3`}>
                        <div>
                            <label className={lbl}>Boshlanishi</label>
                            <input type="date" className={inp + ' w-auto'} value={statsFrom} onChange={e => setStatsFrom(e.target.value)} />
                        </div>
                        <div>
                            <label className={lbl}>Tugashi</label>
                            <input type="date" className={inp + ' w-auto'} value={statsTo} onChange={e => setStatsTo(e.target.value)} />
                        </div>
                        <button onClick={statsniYuklash} disabled={statsYuklanmoqda}
                            className="px-4 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-2xl text-[11px] font-extrabold flex items-center gap-2 shadow-sm transition-all cursor-pointer">
                            <BarChart3 size={14} /> {statsYuklanmoqda ? 'Yuklanmoqda…' : "Ko'rsatish"}
                        </button>
                        {(statsFrom || statsTo) && (
                            <button onClick={() => { setStatsFrom(''); setStatsTo(''); }}
                                className="px-4 py-3 bg-ichki border border-chiziq text-matn-sokin rounded-2xl text-[11px] font-extrabold flex items-center gap-2 transition-all cursor-pointer">
                                <CalendarRange size={14} /> Boshidan
                            </button>
                        )}
                        <div className="flex-1" />
                        <button onClick={excelgaChiqarish} disabled={!stats}
                            className="px-4 py-3 bg-ichki border border-chiziq text-matn-sokin hover:border-brand disabled:opacity-50 rounded-2xl text-[11px] font-extrabold flex items-center gap-2 transition-all cursor-pointer">
                            <Download size={14} /> Excel
                        </button>
                    </div>

                    {!stats ? (
                        <div className={`${karta} p-12 text-center`}>
                            <BarChart3 size={36} className="text-matn-xira mx-auto mb-3" />
                            <p className="text-[11px] font-bold text-matn-xira">{statsYuklanmoqda ? 'Yuklanmoqda…' : "Sana tanlang va «Ko'rsatish» bosing"}</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                                {[
                                    { yorliq: 'Reyslar', qiymat: stats.jami?.reys ?? 0, izoh: stats.jami?.birinchiKun ? `${stats.jami.birinchiKun} dan beri` : '' },
                                    { yorliq: 'Olib ketildi', qiymat: stats.jami?.olindi ?? 0 },
                                    { yorliq: 'Yetkazildi', qiymat: stats.jami?.yetkazildi ?? 0 },
                                    { yorliq: 'Kelmadi', qiymat: stats.jami?.kelmadi ?? 0, qizil: true },
                                    { yorliq: "O'quvchilar", qiymat: stats.jami?.oquvchi ?? 0 },
                                    { yorliq: "Yo'l haqi, so'm", qiymat: somMatni(stats.jami?.summa ?? 0), izoh: 'olib ketilganlar uchun' },
                                ].map((k: any) => (
                                    <div key={k.yorliq} className={`${karta} p-4`}>
                                        <p className="text-[10px] font-bold text-matn-xira uppercase tracking-wider">{k.yorliq}</p>
                                        <p className={`text-2xl font-black tabular-nums mt-1 ${k.qizil && k.qiymat > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-matn'}`}>{k.qiymat}</p>
                                        {k.izoh && <p className="text-[10px] font-bold text-matn-xira mt-1">{k.izoh}</p>}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className={`${karta} overflow-hidden`}>
                                    <p className="px-5 py-4 text-xs font-black text-matn border-b border-chiziq-mayin">O'quvchilar bo'yicha</p>
                                    <div className="max-h-[420px] overflow-y-auto custom-scrollbar divide-y divide-chiziq-mayin">
                                        {(stats.oquvchilar || []).length === 0 && <p className="p-6 text-center text-[11px] font-bold text-matn-xira">Yozuv yo'q</p>}
                                        {(stats.oquvchilar || []).map((o: any) => (
                                            <div key={o.studentId} className="flex items-center justify-between gap-3 px-5 py-3">
                                                <span className="text-xs font-bold text-matn truncate">{o.name}</span>
                                                <span className="flex items-center gap-2 shrink-0 tabular-nums text-[11px] font-black">
                                                    <span className="text-brand">{o.olindi}</span>
                                                    <span className="text-emerald-600 dark:text-emerald-400">{o.yetkazildi}</span>
                                                    <span className={o.kelmadi > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-matn-xira'}>{o.kelmadi}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="px-5 py-2 text-[10px] font-bold text-matn-xira border-t border-chiziq-mayin">olindi · yetkazildi · kelmadi</p>
                                </div>

                                <div className="space-y-4">
                                    <div className={`${karta} overflow-hidden`}>
                                        <p className="px-5 py-4 text-xs font-black text-matn border-b border-chiziq-mayin">Haydovchilar</p>
                                        <div className="divide-y divide-chiziq-mayin">
                                            {(stats.haydovchilar || []).length === 0 && <p className="p-6 text-center text-[11px] font-bold text-matn-xira">Reys yo'q</p>}
                                            {(stats.haydovchilar || []).map((h: any) => (
                                                <div key={h.driverId} className="flex items-center justify-between gap-3 px-5 py-3">
                                                    <span className="text-xs font-bold text-matn truncate">{h.name}</span>
                                                    <span className="text-[11px] font-bold text-matn-xira tabular-nums shrink-0">
                                                        {h.reys} reys{h.ortachaDaqiqa !== null ? ` · ~${h.ortachaDaqiqa} daq` : ''}
                                                        {h.summa > 0 && <span className="text-emerald-600"> · {somMatni(h.summa)} so'm</span>}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={`${karta} overflow-hidden`}>
                                        <p className="px-5 py-4 text-xs font-black text-matn border-b border-chiziq-mayin">Kunlar</p>
                                        <div className="max-h-[240px] overflow-y-auto custom-scrollbar divide-y divide-chiziq-mayin">
                                            {(stats.kunlar || []).length === 0 && <p className="p-6 text-center text-[11px] font-bold text-matn-xira">Yozuv yo'q</p>}
                                            {(stats.kunlar || []).map((k: any) => (
                                                <div key={k.date} className="flex items-center justify-between gap-3 px-5 py-2.5">
                                                    <span className="text-[11px] font-bold text-matn tabular-nums">{k.date}</span>
                                                    <span className="text-[11px] font-bold text-matn-xira tabular-nums">
                                                        {k.reys} reys · {k.olindi + k.yetkazildi} yozuv
                                                        {k.kelmadi > 0 && <span className="text-rose-600 dark:text-rose-400"> · {k.kelmadi} kelmadi</span>}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
