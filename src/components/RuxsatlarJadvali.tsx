import React, { useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw, Lock, Send, ShieldCheck, Loader2 } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import { MODULLAR, SOZLANADIGAN_ROLLAR, ROL_NOMLARI, USTOZ_ROLLARI, standartSozlama, sozlamaniTozala } from '../../lib/ruxsatlar.js';

// Sozlamalar → Ruxsatlar. Egasi maketdan jadval ko'rinishini tanladi
// (2026-09-24): qatorda modul va uning bo'limlari, ustunda lavozimlar, har
// katakda Yo'q / Ko'radi / O'zgartiradi. Saqlangan sozlama butun markazga
// bitta (Organization.permissions) va server har so'rovda shunga qaraydi.

type Sozlama = { rollar: Record<string, Record<string, number>>; faqatOzKurslari: Record<string, boolean> };

const DARAJA_NOMI = ["Yo'q", "Ko'radi", "O'zgartiradi"];

/** Bo'lim turi qaysi darajalarni ruxsat etadi. */
function variantlar(tur: string): number[] {
    if (tur === 'korish') return [0, 1];
    if (tur === 'amal') return [0, 2];
    return [0, 1, 2];
}

function yorliq(tur: string, d: number) {
    return tur === 'amal' && d === 2 ? 'Ruxsat' : DARAJA_NOMI[d];
}

function katakRangi(d: number) {
    if (d === 2) return 'bg-brand text-white border-brand';
    if (d === 1) return 'bg-brand-fon text-brand-dark border-brand/25 dark:bg-brand/20 dark:text-brand-accent';
    return 'bg-sirt text-matn-sokin border-chiziq';
}

const QISQA_NOM: Record<string, string> = { SUPPORT_TEACHER: "Yordamchi o'qit." };

export default function RuxsatlarJadvali() {
    const { token, showNotification } = useCRM();
    const confirm = useConfirm();
    const [asl, setAsl] = useState<Sozlama | null>(null);
    const [joriy, setJoriy] = useState<Sozlama | null>(null);
    const [xodimlar, setXodimlar] = useState<Record<string, number>>({});
    const [xato, setXato] = useState<string | null>(null);
    const [saqlanmoqda, setSaqlanmoqda] = useState(false);

    useEffect(() => {
        let faol = true;
        (async () => {
            try {
                const res = await fetch('/api/permissions', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json().catch(() => null);
                if (!res.ok) throw new Error(data?.error || "Ruxsatlarni yuklab bo'lmadi");
                if (!faol) return;
                setAsl(data.sozlama);
                setJoriy(data.sozlama);
                setXodimlar(data.xodimlar || {});
            } catch (e: any) {
                if (faol) setXato(e.message);
            }
        })();
        return () => { faol = false; };
    }, [token]);

    const ozgargan = useMemo(() => {
        if (!asl || !joriy) return 0;
        let n = 0;
        for (const rol of SOZLANADIGAN_ROLLAR) {
            for (const [k, v] of Object.entries(joriy.rollar[rol] || {})) if (asl.rollar[rol]?.[k] !== v) n++;
        }
        for (const rol of USTOZ_ROLLARI) if (asl.faqatOzKurslari[rol] !== joriy.faqatOzKurslari[rol]) n++;
        return n;
    }, [asl, joriy]);

    const qoy = (rol: string, bolimlar: { id: string; tur: string }[], d: number) => {
        setJoriy(prev => {
            if (!prev) return prev;
            const rolniki = { ...prev.rollar[rol] };
            for (const b of bolimlar) {
                if (b.tur === 'admin') continue;
                const mumkin = variantlar(b.tur);
                // "Hammasi: Ko'radi" amal qatorini yopadi, "faqat ko'rish" qatorini ochadi.
                rolniki[b.id] = mumkin.includes(d) ? d : (d === 1 ? 0 : Math.max(...mumkin.filter(x => x <= d)));
            }
            return { ...prev, rollar: { ...prev.rollar, [rol]: rolniki } };
        });
    };

    const saqlash = async () => {
        if (!joriy) return;
        setSaqlanmoqda(true);
        try {
            const res = await fetch('/api/permissions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ sozlama: joriy }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || "Saqlab bo'lmadi");
            setAsl(data.sozlama);
            setJoriy(data.sozlama);
            showNotification("Ruxsatlar saqlandi. Xodimlar sahifani yangilaganda kuchga kiradi, server esa darhol shunga qaraydi.", 'success');
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setSaqlanmoqda(false);
        }
    };

    const standartga = async () => {
        const ok = await confirm({
            title: 'Standartga qaytarish',
            message: "Barcha lavozimlar uchun boshlang'ich ruxsatlar qo'yiladi. Saqlash tugmasini bosmaguningizcha hech narsa o'zgarmaydi.",
            confirmLabel: 'Qaytarish',
            cancelLabel: 'Bekor qilish',
        });
        if (ok) setJoriy(sozlamaniTozala(standartSozlama()) as Sozlama);
    };

    if (xato) {
        return <div className="p-6 bg-xato-fon border border-xato-chiziq rounded-2xl text-xs font-bold text-xato">{xato}</div>;
    }
    if (!joriy) {
        return <div className="py-16 flex items-center justify-center text-matn-xira"><Loader2 size={18} className="animate-spin" /></div>;
    }

    const ustunlar = SOZLANADIGAN_ROLLAR;

    return (
        <div className="space-y-5">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h2 className="text-xs font-black text-matn">Ruxsatlar</h2>
                    <p className="text-[11px] font-bold text-matn-xira mt-0.5 max-w-xl">
                        Har bir lavozim qaysi bo'limni ko'radi va qaysi birini o'zgartiradi. Ko'rmaydigan bo'lim menyuda chiqmaydi,
                        server ham uning ma'lumotini bermaydi. Butun markazga (hamma filialga) bitta sozlama.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {ozgargan > 0 && <span className="text-[11px] font-bold text-ogoh">{ozgargan} ta o'zgarish saqlanmagan</span>}
                    <button type="button" onClick={standartga}
                        className="px-3.5 py-2.5 rounded-xl border border-chiziq bg-sirt text-matn-2 text-[11px] font-extrabold flex items-center gap-1.5 hover:bg-ichki cursor-pointer">
                        <RotateCcw size={13} />Standartga qaytarish
                    </button>
                    <button type="button" onClick={saqlash} disabled={!ozgargan || saqlanmoqda}
                        className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer">
                        {saqlanmoqda ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Saqlash
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-4 text-[11px] font-bold text-matn-2">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand" />O'zgartiradi</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-fon border border-brand/30" />Ko'radi</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-chiziq-kuchli" />Yo'q — menyuda ham chiqmaydi</span>
                <span className="flex items-center gap-1.5 text-matn-xira">«Amal» qatorlarida faqat Yo'q / Ruxsat</span>
            </div>

            <div className="bg-sirt rounded-2xl border border-chiziq overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[860px] border-collapse text-left">
                    <thead>
                        <tr className="bg-ichki/60 border-b border-chiziq">
                            <th className="p-3 pl-5 text-[11px] font-bold text-matn-sokin">Bo'lim</th>
                            <th className="p-3 w-[112px] text-center text-[11px] font-bold text-matn-sokin">Admin</th>
                            {ustunlar.map(rol => (
                                <th key={rol} className="p-3 w-[132px] text-center text-[11px] font-bold text-matn-2">
                                    {QISQA_NOM[rol] || ROL_NOMLARI[rol]}
                                    <span className="block text-[10px] font-medium text-matn-xira">{xodimlar[rol] || 0} ta xodim</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {MODULLAR.map(m => {
                            const sozlanadigan = m.bolimlar.filter(b => b.tur !== 'admin');
                            return (
                                <React.Fragment key={m.id}>
                                    <tr className="border-t border-chiziq bg-ichki/25">
                                        <td className="px-5 pt-3.5 pb-2 text-xs font-black text-matn">{m.nom}</td>
                                        <td className="px-2 pt-3.5 pb-2 text-center text-[10px] font-bold text-matn-xira">hammasi</td>
                                        {ustunlar.map(rol => {
                                            const qiymatlar = sozlanadigan.map(b => joriy.rollar[rol]?.[b.id] ?? 0);
                                            const birXil = qiymatlar.length > 0 && qiymatlar.every(v => v === qiymatlar[0]);
                                            return (
                                                <td key={rol} className="px-2 pt-3.5 pb-2 text-center">
                                                    {sozlanadigan.length > 1 ? (
                                                        <select
                                                            aria-label={`${m.nom} — ${ROL_NOMLARI[rol]}: hamma bo'lim`}
                                                            title="Moduldagi hamma bo'limni bir yo'la o'rnatish"
                                                            value={birXil ? String(qiymatlar[0]) : ''}
                                                            onChange={e => qoy(rol, m.bolimlar, Number(e.target.value))}
                                                            className="w-full max-w-[118px] px-2 py-1 rounded-lg border border-dashed border-chiziq-kuchli bg-transparent text-[10px] font-bold text-matn-sokin cursor-pointer outline-none focus:border-brand">
                                                            {!birXil && <option value="" disabled>Aralash</option>}
                                                            <option value="0">Yo'q</option>
                                                            <option value="1">Ko'radi</option>
                                                            <option value="2">To'liq</option>
                                                        </select>
                                                    ) : null}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                    {m.bolimlar.map(b => (
                                        <tr key={b.id} className="border-t border-chiziq-mayin hover:bg-ichki/30 transition-colors">
                                            <td className="py-2 pl-9 pr-3">
                                                <div className="text-xs font-bold text-matn">{b.nom}</div>
                                                {b.izoh && <div className="text-[10px] font-medium text-matn-xira mt-0.5 leading-snug max-w-md">{b.izoh}</div>}
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${katakRangi(b.tur === 'korish' ? 1 : 2)}`}>
                                                    {yorliq(b.tur, b.tur === 'korish' ? 1 : 2)}
                                                </span>
                                            </td>
                                            {ustunlar.map(rol => {
                                                if (b.tur === 'admin') {
                                                    return (
                                                        <td key={rol} className="px-2 py-2 text-center">
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-matn-xira border border-dashed border-chiziq-kuchli">
                                                                <Lock size={10} />Faqat admin
                                                            </span>
                                                        </td>
                                                    );
                                                }
                                                const d = joriy.rollar[rol]?.[b.id] ?? 0;
                                                const eski = asl?.rollar[rol]?.[b.id];
                                                return (
                                                    <td key={rol} className="px-2 py-2 text-center">
                                                        <select
                                                            aria-label={`${m.nom} → ${b.nom} — ${ROL_NOMLARI[rol]}`}
                                                            value={String(d)}
                                                            onChange={e => qoy(rol, [b], Number(e.target.value))}
                                                            className={`w-full max-w-[118px] px-2 py-1.5 rounded-full border text-[11px] font-extrabold text-center cursor-pointer outline-none focus:ring-2 focus:ring-brand/30 ${katakRangi(d)} ${eski !== undefined && eski !== d ? 'ring-2 ring-amber-400/70' : ''}`}>
                                                            {variantlar(b.tur).map(v => (
                                                                <option key={v} value={v} className="bg-sirt text-matn">{yorliq(b.tur, v)}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                        <tr className="border-t-2 border-chiziq bg-brand-light dark:bg-brand/10">
                            <td className="py-3 pl-5 pr-3">
                                <div className="text-xs font-black text-matn">Faqat o'z kurslari va o'quvchilari</div>
                                <div className="text-[10px] font-medium text-matn-2 mt-0.5 max-w-md">
                                    Yoqilganda o'qituvchi faqat o'zi dars beradigan kurslarni, shu kurslardagi o'quvchilarni va ularning davomatini ko'radi
                                </div>
                            </td>
                            <td className="px-2 py-3 text-center text-[11px] font-bold text-matn-xira">—</td>
                            {ustunlar.map(rol => {
                                if (!USTOZ_ROLLARI.includes(rol)) {
                                    return <td key={rol} className="px-2 py-3 text-center text-[11px] font-bold text-matn-xira">—</td>;
                                }
                                const on = !!joriy.faqatOzKurslari[rol];
                                return (
                                    <td key={rol} className="px-2 py-3 text-center">
                                        <button type="button" role="switch" aria-checked={on}
                                            aria-label={`${ROL_NOMLARI[rol]}: faqat o'z kurslari`}
                                            onClick={() => setJoriy(prev => prev ? { ...prev, faqatOzKurslari: { ...prev.faqatOzKurslari, [rol]: !on } } : prev)}
                                            className={`inline-flex items-center w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${on ? 'bg-brand justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'}`}>
                                            <span className="w-5 h-5 rounded-full bg-white shadow" />
                                        </button>
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-sirt border border-chiziq rounded-2xl flex gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-brand text-white flex items-center justify-center"><ShieldCheck size={16} /></div>
                    <div>
                        <p className="text-xs font-black text-matn">Admin — hammasi</p>
                        <p className="text-[11px] font-medium text-matn-sokin mt-1 leading-relaxed">Cheklab bo'lmaydi. Ruxsatlar, filiallar, Payme va admin/menejer hisoblari faqat adminda.</p>
                    </div>
                </div>
                <div className="p-4 bg-sirt border border-chiziq rounded-2xl flex gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-sky-50 text-sky-650 dark:bg-sky-950/30 dark:text-sky-455 flex items-center justify-center"><Send size={16} /></div>
                    <div>
                        <p className="text-xs font-black text-matn">Haydovchi — faqat Telegram bot</p>
                        <p className="text-[11px] font-medium text-matn-sokin mt-1 leading-relaxed">CRM saytiga kirmaydi, email va parol berilmaydi. Botga telefon raqami bilan ulanadi va faqat o'z rejasini ko'radi.</p>
                    </div>
                </div>
                <div className="p-4 bg-sirt border border-chiziq rounded-2xl flex gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-ichki text-matn-2 flex items-center justify-center"><Lock size={16} /></div>
                    <div>
                        <p className="text-xs font-black text-matn">Texnik xodim — kirmaydi</p>
                        <p className="text-[11px] font-medium text-matn-sokin mt-1 leading-relaxed">Login berilmaydi. HR'da faqat maosh va davomat uchun turadi.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
