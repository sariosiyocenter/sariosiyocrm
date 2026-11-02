import { useState } from 'react';
import { Banknote, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { taqsimla, oyMatni, AVVALGI_OY } from '../../../lib/oylikDaftar.js';
import { ochirishQoldi } from '../../../lib/xarajat.js';

/**
 * Xodim kartasi → Oylik: markaz xodimga qancha qarz, oylar bo'yicha hisob va
 * berilgan pullar, "Oylik berish" paneli.
 *
 * Egasi (2026-11-02): "10 mln berishimiz kerak, 5 mln berdik — 5 mln qarz qoladi;
 * noyabrda shu oy va umuman qancha berishimiz kerakligi ko'rinsin". Hisob qoidasi
 * serverniki bilan bitta — lib/oylikDaftar.js.
 */

export interface OyQatori {
    month: string; yopiq: boolean; eski?: boolean; id?: number;
    baseSalary?: number; kpi?: number; bonuses?: number; fines?: number; amount: number;
    note?: string | null; closedAt?: string;
    berilgan: number; qoldiq: number;
    tolovlar: { tolovId: number; paidAt: string; summa: number; note: string | null }[];
}
export interface Tolov {
    id: number; amount: number; paidAt: string; note: string | null; month: string | null;
    taqsim: { month: string; summa: number }[]; avans: number;
}
export interface Daftar {
    oylar: OyQatori[]; tolovlar: Tolov[]; yopiqQarz: number; avans: number; engEski: string | null; joriyOy: string;
}

type Xabar = (matn: string, tur: 'success' | 'error' | 'info') => void;

interface Props {
    daftar: Daftar | null;
    xodimId: number;
    xodimIsmi: string;
    token: string;
    tahrir: boolean;
    tanlanganOy: string;
    /** Joriy oy yopilmagan bo'lsa — hozirgi hisob-kitob (asosiy + KPI + bonus − jarima). */
    joriyTaxmin: number | null;
    onOyTanla: (month: string) => void;
    onYangila: () => void;
    xabar: Xabar;
}

const som = (n: number) => Math.round(n).toLocaleString('ru-RU');
const raqam = (s: string) => parseInt(String(s).replace(/\D/g, ''), 10) || 0;
const qisqaOy = (m: string) => m === AVVALGI_OY ? 'Avvalgi qarz' : oyMatni(m).split(' ')[0];

async function sorov(url: string, token: string, method: string, body?: unknown) {
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Server ${res.status}`);
    return data;
}

function Holat({ o }: { o: OyQatori }) {
    const cls = 'inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap';
    if (!o.yopiq) return <span className={`${cls} bg-brand/10 text-brand`}>Yopilmagan</span>;
    if (o.qoldiq <= 0) return <span className={`${cls} bg-yaxshi-fon text-yaxshi`}>To'langan ✓</span>;
    if (o.berilgan > 0) return <span className={`${cls} bg-ogoh-fon text-ogoh`}>Qisman</span>;
    return <span className={`${cls} bg-xato-fon text-xato`}>Berilmagan</span>;
}

export default function OylikDaftari({ daftar, xodimId, xodimIsmi, token, tahrir, tanlanganOy, joriyTaxmin, onOyTanla, onYangila, xabar }: Props) {
    const [panel, setPanel] = useState(false);
    const [avvalgi, setAvvalgi] = useState<{ summa: string; izoh: string } | null>(null);
    const [tahrirTolov, setTahrirTolov] = useState<{ id: number; summa: string } | null>(null);
    const [band, setBand] = useState(false);

    if (!daftar) return <div className="py-6 text-center text-[12px] text-matn-xira">Oylik daftari yuklanmoqda…</div>;

    const joriy = daftar.oylar.find(o => o.month === daftar.joriyOy);
    const joriySumma = joriy && !joriy.yopiq ? (joriyTaxmin || 0) : 0;
    const jami = Math.max(0, daftar.yopiqQarz - daftar.avans + joriySumma);
    const avvalgiQator = daftar.oylar.find(o => o.month === AVVALGI_OY);
    const yopilmaganOtgan = daftar.oylar.filter(o => !o.yopiq && o.month < daftar.joriyOy);

    const avvalgiSaqla = async () => {
        if (!avvalgi || band) return;
        setBand(true);
        try {
            await sorov('/api/salary-accruals', token, 'POST', { userId: xodimId, month: AVVALGI_OY, baseSalary: raqam(avvalgi.summa), note: avvalgi.izoh || null });
            setAvvalgi(null);
            xabar('Avvalgi qarz saqlandi', 'success');
            onYangila();
        } catch (e: any) { xabar("Saqlanmadi: " + e.message, 'error'); }
        finally { setBand(false); }
    };

    const tolovniOchir = async (t: Tolov) => {
        if (band) return;
        setBand(true);
        try {
            await sorov(`/api/salary-payments/${t.id}`, token, 'DELETE');
            xabar("Berilgan pul yozuvi o'chirildi", 'success');
            onYangila();
        } catch (e: any) { xabar("O'chirib bo'lmadi: " + e.message, 'error'); }
        finally { setBand(false); }
    };

    const tolovniTuzat = async () => {
        if (!tahrirTolov || band) return;
        const summa = raqam(tahrirTolov.summa);
        if (!summa) { xabar("Summani kiriting", 'error'); return; }
        setBand(true);
        try {
            await sorov(`/api/salary-payments/${tahrirTolov.id}`, token, 'PUT', { amount: summa });
            setTahrirTolov(null);
            xabar('Summa tuzatildi, Moliyadagi xarajat ham', 'success');
            onYangila();
        } catch (e: any) { xabar("Tuzatib bo'lmadi: " + e.message, 'error'); }
        finally { setBand(false); }
    };

    const qatorlar = [...daftar.oylar].reverse();

    return (
        <div className="space-y-4">
            {/* Xulosa: markaz xodimga qancha qarz */}
            <div className="bg-sirt border border-chiziq rounded-2xl grid grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
                <div className="col-span-2 lg:col-span-1 px-5 py-4 min-w-0">
                    <span className="text-[11px] font-semibold text-matn-xira">Biz qarzdormiz — jami</span>
                    <p className={`num text-[26px] font-semibold leading-tight mt-1 ${jami > 0 ? 'text-xato' : 'text-yaxshi'}`}>{som(jami)} <span className="text-[13px] text-matn-xira font-normal">so'm</span></p>
                    <p className="text-[12px] text-matn-sokin mt-1">
                        {daftar.engEski ? `${oyMatni(daftar.engEski)} dan beri to'lanmagan qoldiq bor`
                            : daftar.avans > 0 ? `Avans: ${som(daftar.avans)} — keyingi oydan ushlanadi`
                            : "Yopilgan oylar bo'yicha qarz yo'q"}
                    </p>
                </div>
                <div className="px-5 py-4 border-t lg:border-t-0 lg:border-l border-chiziq min-w-0">
                    <span className="text-[11px] font-semibold text-matn-xira">Yopilgan oylar</span>
                    <p className="num text-[18px] font-semibold text-matn mt-1">{som(Math.max(0, daftar.yopiqQarz - daftar.avans))}</p>
                    <p className="text-[12px] text-matn-sokin mt-0.5">{daftar.avans > 0 ? `avans ${som(daftar.avans)}` : 'aniq summa'}</p>
                </div>
                <div className="px-5 py-4 border-t lg:border-t-0 border-l border-chiziq min-w-0">
                    <span className="text-[11px] font-semibold text-matn-xira">{qisqaOy(daftar.joriyOy)} {joriy?.yopiq ? '(yopilgan)' : '(ochiq)'}</span>
                    {!joriy?.yopiq && joriyTaxmin == null ? (
                        <button onClick={() => onOyTanla(daftar.joriyOy)} className="mt-1.5 text-[13px] text-brand hover:underline cursor-pointer">Hisobni ko'rish →</button>
                    ) : (
                        <p className={`num text-[18px] font-semibold mt-1 ${joriy?.yopiq ? 'text-matn' : 'text-matn-sokin italic'}`}>
                            {joriy?.yopiq ? som(joriy.amount) : `≈ ${som(joriySumma)}`}
                        </p>
                    )}
                    <p className="text-[12px] text-matn-sokin mt-0.5">{joriy?.yopiq ? 'qarzga qo\'shilgan' : 'oy yopilganda aniqlanadi'}</p>
                </div>
                {tahrir && (
                    <div className="col-span-2 lg:col-span-1 px-5 py-4 border-t lg:border-t-0 lg:border-l border-chiziq flex items-center">
                        <button onClick={() => setPanel(true)}
                            className="w-full lg:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-brand hover:bg-brand-dark text-white rounded-xl text-[13px] font-semibold cursor-pointer transition-colors whitespace-nowrap">
                            <Banknote size={15} /> Oylik berish
                        </button>
                    </div>
                )}
            </div>

            {yopilmaganOtgan.length > 0 && (
                <p className="text-[12px] text-ogoh bg-ogoh-fon rounded-xl px-4 py-2.5">
                    Yopilmagan o'tgan oylar: {yopilmaganOtgan.map(o => qisqaOy(o.month)).join(', ')}. Oyni tanlab, hisobini tekshiring va «Oyni yopish» ni bosing — shunda qarzga qo'shiladi.
                </p>
            )}

            {/* Oylar bo'yicha hisob */}
            <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden">
                <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3 flex-wrap">
                    <h3 className="text-[14px] font-semibold text-matn">Oylar bo'yicha hisob</h3>
                    <span className="text-[12px] text-matn-xira">Oyni bosing — tarkibi pastda ochiladi</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[560px]">
                        <thead>
                            <tr className="bg-ichki border-y border-chiziq">
                                {['Oy', 'Hisoblangan', 'Berilgan', 'Qoldiq', 'Holat'].map((n, i) => (
                                    <th key={n} className={`px-5 py-2.5 text-[11px] font-semibold text-matn-xira ${i > 0 && i < 4 ? 'text-right' : ''}`}>{n}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-chiziq">
                            {daftar.avans > 0 && (
                                <tr className="text-ogoh">
                                    <td className="px-5 py-3 text-[12.5px] font-medium">Avans (oyga tushmagan)</td>
                                    <td className="px-5 py-3 text-right num text-[12.5px]">—</td>
                                    <td className="px-5 py-3 text-right num text-[12.5px]">{som(daftar.avans)}</td>
                                    <td className="px-5 py-3 text-right num text-[12.5px]">−{som(daftar.avans)}</td>
                                    <td className="px-5 py-3 text-[11px]">keyingi oydan ushlanadi</td>
                                </tr>
                            )}
                            {qatorlar.map(o => {
                                const tanlangan = o.month === tanlanganOy;
                                const bosiladi = o.month !== AVVALGI_OY;
                                const taxminiy = !o.yopiq && o.month === daftar.joriyOy && joriyTaxmin != null;
                                return (
                                    <tr key={o.month}
                                        onClick={bosiladi ? () => onOyTanla(o.month) : undefined}
                                        className={`${bosiladi ? 'cursor-pointer hover:bg-ichki/60' : ''} ${tanlangan ? 'bg-brand/5' : ''}`}>
                                        <td className="px-5 py-3 text-[12.5px] font-medium text-matn">
                                            <span className="flex items-center gap-1.5">
                                                {bosiladi && <ChevronRight size={13} className={`text-matn-xira ${tanlangan ? 'text-brand' : ''}`} />}
                                                {oyMatni(o.month)}
                                                {o.eski && <span className="text-[10.5px] font-normal text-matn-xira">· eski yozuv</span>}
                                            </span>
                                        </td>
                                        <td className={`px-5 py-3 text-right num text-[12.5px] ${o.yopiq ? 'text-matn-2' : 'text-matn-xira italic'}`}>
                                            {o.yopiq ? som(o.amount) : taxminiy ? `≈ ${som(joriyTaxmin!)}` : '—'}
                                        </td>
                                        <td className="px-5 py-3 text-right num text-[12.5px] text-yaxshi">{o.berilgan ? som(o.berilgan) : '—'}</td>
                                        <td className={`px-5 py-3 text-right num text-[12.5px] ${o.yopiq && o.qoldiq > 0 ? 'text-xato font-semibold' : 'text-matn-xira'}`}>
                                            {o.yopiq ? som(Math.max(0, o.qoldiq)) : '—'}
                                        </td>
                                        <td className="px-5 py-3"><Holat o={o} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-ichki border-t border-chiziq">
                                <td className="px-5 py-3 text-[12px] font-semibold text-matn">Yopilgan oylar jami</td>
                                <td className="px-5 py-3 text-right num text-[12px] font-semibold">{som(daftar.oylar.filter(o => o.yopiq).reduce((s, o) => s + o.amount, 0))}</td>
                                <td className="px-5 py-3 text-right num text-[12px] font-semibold text-yaxshi">{som(daftar.tolovlar.reduce((s, t) => s + t.amount, 0))}</td>
                                <td className={`px-5 py-3 text-right num text-[12px] font-semibold ${daftar.yopiqQarz > 0 ? 'text-xato' : ''}`}>{som(daftar.yopiqQarz - daftar.avans)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
                {tahrir && (
                    <div className="px-5 py-3 border-t border-chiziq flex flex-wrap items-center gap-2">
                        {avvalgi ? (
                            <>
                                <input aria-label="Avvalgi qarz summasi" inputMode="numeric" placeholder="Summa" autoFocus
                                    value={avvalgi.summa} onChange={e => setAvvalgi({ ...avvalgi, summa: raqam(e.target.value) ? som(raqam(e.target.value)) : '' })}
                                    className="w-40 px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[12.5px] num text-matn outline-none focus:border-brand" />
                                <input aria-label="Izoh" placeholder="Izoh: qaysi oylar uchun"
                                    value={avvalgi.izoh} onChange={e => setAvvalgi({ ...avvalgi, izoh: e.target.value })}
                                    className="flex-1 min-w-[160px] px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[12.5px] text-matn outline-none focus:border-brand" />
                                <button onClick={avvalgiSaqla} disabled={band} className="px-4 py-2 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-[12px] font-semibold rounded-xl cursor-pointer">Saqlash</button>
                                <button onClick={() => setAvvalgi(null)} className="px-3 py-2 text-[12px] text-matn-sokin hover:text-matn cursor-pointer">Bekor</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setAvvalgi({ summa: avvalgiQator ? som(avvalgiQator.amount) : '', izoh: avvalgiQator?.note || '' })}
                                    className="flex items-center gap-1.5 px-3 py-1.5 border border-chiziq rounded-xl text-[12px] text-brand hover:bg-brand/5 cursor-pointer">
                                    {avvalgiQator ? <Pencil size={12} /> : <Plus size={12} />} {avvalgiQator ? 'Avvalgi qarzni tuzatish' : 'Avvalgi qarzni kiritish'}
                                </button>
                                <span className="text-[11.5px] text-matn-xira">CRM ga o'tishdan oldingi qarz bo'lsa — bir marta</span>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Berilgan pullar */}
            {daftar.tolovlar.length > 0 && (
                <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden">
                    <div className="px-5 pt-4 pb-3"><h3 className="text-[14px] font-semibold text-matn">Berilgan pullar</h3></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[520px]">
                            <thead>
                                <tr className="bg-ichki border-y border-chiziq">
                                    {['Sana', 'Summa', 'Qaysi oyga tushdi', 'Izoh', ''].map((n, i) => (
                                        <th key={i} className={`px-5 py-2.5 text-[11px] font-semibold text-matn-xira ${i === 1 ? 'text-right' : ''}`}>{n}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-chiziq">
                                {[...daftar.tolovlar].reverse().map(t => (
                                    <tr key={t.id}>
                                        <td className="px-5 py-3 text-[12.5px] text-matn-2 whitespace-nowrap">{new Date(t.paidAt).toLocaleDateString('ru-RU')}</td>
                                        <td className="px-5 py-3 text-right num text-[12.5px] font-medium text-matn">
                                            {tahrirTolov?.id === t.id ? (
                                                <span className="flex items-center justify-end gap-1.5">
                                                    <input aria-label="Yangi summa" inputMode="numeric" autoFocus value={tahrirTolov.summa}
                                                        onChange={e => setTahrirTolov({ id: t.id, summa: raqam(e.target.value) ? som(raqam(e.target.value)) : '' })}
                                                        onKeyDown={e => { if (e.key === 'Enter') tolovniTuzat(); if (e.key === 'Escape') setTahrirTolov(null); }}
                                                        className="w-32 px-2 py-1 bg-ichki border border-chiziq rounded-lg text-right num text-[12.5px] outline-none focus:border-brand" />
                                                    <button onClick={tolovniTuzat} disabled={band} className="px-2 py-1 bg-brand text-white rounded-lg text-[11px] cursor-pointer">✓</button>
                                                    <button onClick={() => setTahrirTolov(null)} aria-label="Bekor" className="text-matn-xira cursor-pointer"><X size={14} /></button>
                                                </span>
                                            ) : som(t.amount)}
                                        </td>
                                        <td className="px-5 py-3 text-[12px] text-matn-sokin">
                                            {[...t.taqsim.map(q => `${oyMatni(q.month)}: ${som(q.summa)}`), t.avans > 0 ? `avans: ${som(t.avans)}` : null].filter(Boolean).join(' · ') || '—'}
                                        </td>
                                        <td className="px-5 py-3 text-[12px] text-matn-xira">{t.note || ''}</td>
                                        <td className="px-5 py-3 text-right whitespace-nowrap">
                                            {tahrir && tahrirTolov?.id !== t.id && (
                                                <span className="inline-flex items-center gap-2">
                                                    <button onClick={() => setTahrirTolov({ id: t.id, summa: som(t.amount) })} title="Summani tuzatish"
                                                        className="text-matn-xira hover:text-brand cursor-pointer"><Pencil size={13} /></button>
                                                    {ochirishQoldi(t.paidAt) > 0 && (
                                                        <button onClick={() => tolovniOchir(t)} title="O'chirish (15 daqiqa ichida)"
                                                            className="text-matn-xira hover:text-rose-500 cursor-pointer"><Trash2 size={13} /></button>
                                                    )}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {panel && (
                <BerishPaneli daftar={daftar} xodimId={xodimId} xodimIsmi={xodimIsmi} token={token}
                    joriySumma={joriySumma} onYop={() => setPanel(false)}
                    onBerildi={() => { setPanel(false); onYangila(); }} xabar={xabar} />
            )}
        </div>
    );
}

function BerishPaneli({ daftar, xodimId, xodimIsmi, token, joriySumma, onYop, onBerildi, xabar }: {
    daftar: Daftar; xodimId: number; xodimIsmi: string; token: string; joriySumma: number;
    onYop: () => void; onBerildi: () => void; xabar: Xabar;
}) {
    const qarz = Math.max(0, daftar.yopiqQarz);
    const [summa, setSumma] = useState(() => som(qarz || joriySumma));
    const [izoh, setIzoh] = useState('');
    const [band, setBand] = useState(false);
    const s = raqam(summa);
    const { qismlar, avans } = taqsimla(daftar, s);
    const engEski = daftar.oylar.find(o => o.yopiq && o.qoldiq > 0);
    const tugmalar: [string, number][] = [
        ...(qarz > 0 ? [[`Yopilgan qarz · ${som(qarz)}`, qarz] as [string, number]] : []),
        ...(engEski && engEski.qoldiq !== qarz ? [[`Faqat ${qisqaOy(engEski.month)} · ${som(engEski.qoldiq)}`, engEski.qoldiq] as [string, number]] : []),
        ...(joriySumma > 0 ? [[`Joriy oy bilan · ${som(qarz + joriySumma)}`, qarz + joriySumma] as [string, number]] : []),
    ];

    const ber = async () => {
        if (!s || band) return;
        setBand(true);
        try {
            const p = await sorov('/api/salary-payments', token, 'POST', { userId: xodimId, amount: s, note: izoh || null });
            xabar(p?.telegram?.sent
                ? "Oylik berildi, Moliyaga yozildi va xodimga Telegram xabari yuborildi"
                : "Oylik berildi va Moliyaga xarajat sifatida yozildi"
                  + (p?.telegram?.reason === 'telegram ulanmagan' ? " (xodim Telegram botga ulanmagan)" : ''), 'success');
            onBerildi();
        } catch (e: any) { xabar("Oylikni saqlab bo'lmadi: " + e.message, 'error'); }
        finally { setBand(false); }
    };

    return (
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-gray-900/40" onClick={onYop} />
            <aside role="dialog" aria-label="Oylik berish" className="relative w-full max-w-md h-full bg-sirt border-l border-chiziq flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-chiziq">
                    <h3 className="text-[15px] font-semibold text-matn">Oylik berish — {xodimIsmi}</h3>
                    <button onClick={onYop} aria-label="Yopish" className="w-8 h-8 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-lg cursor-pointer"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                    <div className="space-y-2">
                        <label htmlFor="oylik-summa" className="block text-[12px] font-semibold text-matn-2">Beriladigan summa, so'm</label>
                        <input id="oylik-summa" inputMode="numeric" autoFocus autoComplete="off" value={summa}
                            onChange={e => setSumma(raqam(e.target.value) ? som(raqam(e.target.value)) : '')}
                            onKeyDown={e => { if (e.key === 'Enter') ber(); }}
                            className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-xl num text-[20px] text-matn outline-none focus:border-brand" />
                        {tugmalar.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {tugmalar.map(([nom, v]) => (
                                    <button key={nom} onClick={() => setSumma(som(v))}
                                        className="px-3 py-1.5 rounded-full border border-chiziq bg-ichki text-[12px] text-matn-2 hover:border-brand hover:text-brand cursor-pointer">{nom}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border border-chiziq rounded-xl overflow-hidden">
                        <p className="px-4 py-2 bg-ichki border-b border-chiziq text-[11px] font-semibold text-matn-xira">Pul qayerga tushadi</p>
                        {qismlar.map(q => (
                            <div key={q.month} className="px-4 py-2.5 border-b border-chiziq last:border-b-0 flex justify-between gap-3 text-[13px]">
                                <span><span className="font-medium text-matn">{oyMatni(q.month)}</span>
                                    <span className="block text-[12px] text-matn-sokin">{q.keyin > 0 ? `yana ${som(q.keyin)} qoladi` : "to'liq yopiladi ✓"}</span></span>
                                <span className="num text-matn">{som(q.summa)}</span>
                            </div>
                        ))}
                        {avans > 0 && (
                            <div className="px-4 py-2.5 flex justify-between gap-3 text-[13px] text-ogoh">
                                <span><span className="font-medium">Avans</span>
                                    <span className="block text-[12px]">keyingi oy yopilganda o'sha oyning hisobidan ushlanadi</span></span>
                                <span className="num">{som(avans)}</span>
                            </div>
                        )}
                        {!s && <p className="px-4 py-3 text-[12px] text-matn-xira">Summani kiriting</p>}
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="oylik-izoh" className="block text-[12px] font-semibold text-matn-2">Izoh (ixtiyoriy)</label>
                        <input id="oylik-izoh" value={izoh} onChange={e => setIzoh(e.target.value)} placeholder="Masalan: naqd, qolgani 20-sanada"
                            className="w-full px-4 py-2.5 bg-ichki border border-chiziq rounded-xl text-[13px] text-matn outline-none focus:border-brand" />
                    </div>
                    <p className="text-[12px] text-matn-xira">Pul eng eski qarzdan yopiladi. Moliyaga «Ish haqi» xarajati bo'lib yoziladi, xodimga Telegram xabar ketadi.</p>
                </div>
                <div className="px-5 py-4 border-t border-chiziq flex gap-2">
                    <button onClick={onYop} className="flex-1 py-3 border border-chiziq rounded-xl text-[13px] text-matn-2 hover:bg-ichki cursor-pointer">Bekor qilish</button>
                    <button onClick={ber} disabled={!s || band}
                        className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[13px] font-semibold cursor-pointer">
                        {band ? 'Saqlanmoqda…' : s ? `Berildi — ${som(s)}` : 'Berildi'}
                    </button>
                </div>
            </aside>
        </div>
    );
}
