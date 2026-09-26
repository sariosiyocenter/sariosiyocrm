import React, { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, Send, Loader2, CheckCheck, Clock, XCircle, MinusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { displayName } from '../lib/displayName';
import { fillTemplate } from '../../lib/xabarMatni.js';
import {
    eskizYuboradi, eskizRadEtdi, eskizHolatMatni, smsMatni, smsSoni, raqamYashir, KIMGA_NOMI,
} from '../../lib/tolovXabari.js';

/**
 * To'lov xabari: to'lov qabul qilinganda ota-onaga ketadigan SMS
 * (services/tolovXabari.js, lib/tolovXabari.js).
 *
 *  - TolovXabariSozlama — Xabarlar → Shablonlar: yoqish, shablon, kimga, kanal,
 *    namuna, sinov SMS, oxirgi to'lovlar xabari holati bilan (qayta yuborish).
 *  - TolovXabarQatori — chek ostida: "SMS yuborildi / navbatda / ketmadi".
 */

type Kanal = 'SMS' | 'BOTH' | 'TELEGRAM';
interface Sozlama { yoqilgan: boolean; shablonId: number | null; kanal: Kanal; kimga: string }
interface Shablon { id: number; name: string; body: string; eskizStatus?: string | null }
interface Qabul { kimga: string; kanal: string; holat: string }
export interface XabarQisqa { id?: number; holat: string; sabab?: string | null; kanal?: string | null; qabul?: Qabul[] }
interface Qator extends XabarQisqa {
    paymentId: number; studentId: number; ism: string; summa: number | null; turi: string | null;
    raqamlar: { kimga: string; kanal: string; manzil: string; holat: string; xato?: string | null }[];
    createdAt: string; yuborilganAt?: string | null; yetkazilganAt?: string | null;
}
interface Javob {
    sozlama: Sozlama; saqlangan: boolean; shablonlar: Shablon[];
    royxat: Qator[]; statistika: Record<string, number>; eskizBalans: number | null;
}

const KANAL_NOMI: Record<Kanal, string> = {
    SMS: 'Faqat SMS',
    BOTH: "Telegram, bo'lmasa SMS",
    TELEGRAM: 'Faqat Telegram',
};
const KIMGA = [
    { v: 'FATHER', nom: 'Otasi' },
    { v: 'MOTHER', nom: 'Onasi' },
    { v: 'STUDENT', nom: "O'quvchi" },
];

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const pul = (n: number | null | undefined) => Math.round(Number(n) || 0).toLocaleString('en-US');
const soat = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const bugun = new Date().toDateString() === d.toDateString();
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return bugun ? hm : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`;
};

/** Holat belgisi va rangi — ro'yxatda va chek ostida bir xil. */
function holatKorinishi(holat: string) {
    switch (holat) {
        case 'yetkazildi': return { Icon: CheckCheck, rang: 'text-yaxshi', soz: 'yetib bordi' };
        case 'yuborildi': return { Icon: Check, rang: 'text-yaxshi', soz: 'yuborildi' };
        case 'kutmoqda':
        case 'yuborilmoqda': return { Icon: Clock, rang: 'text-ogoh', soz: 'navbatda' };
        case 'bekor': return { Icon: MinusCircle, rang: 'text-matn-xira', soz: 'bekor' };
        case 'yetkazilmadi': return { Icon: XCircle, rang: 'text-xato', soz: 'yetib bormadi' };
        default: return { Icon: XCircle, rang: 'text-xato', soz: 'ketmadi' };
    }
}

/** Kimga ketgani: "otasi, onasi". */
const kimlar = (qabul?: Qabul[]) => [...new Set((qabul || []).map(q => KIMGA_NOMI[q.kimga as keyof typeof KIMGA_NOMI] || q.kimga))].join(', ');

// ---------------------------------------------------------------------------
// Chek ostidagi qator
// ---------------------------------------------------------------------------

export function TolovXabarQatori({ xabar }: { xabar?: XabarQisqa | null }) {
    if (!xabar || !xabar.holat || xabar.holat === 'ochiq_emas') return null;
    const { Icon, rang } = holatKorinishi(xabar.holat);
    const tg = xabar.kanal === 'TELEGRAM';
    const matn = ['yuborildi', 'yetkazildi'].includes(xabar.holat)
        ? `Ota-onaga ${tg ? 'Telegram xabari' : 'SMS'} yuborildi${kimlar(xabar.qabul) ? ` (${kimlar(xabar.qabul)})` : ''}`
        : ['kutmoqda', 'yuborilmoqda'].includes(xabar.holat)
            ? `SMS navbatda: ${xabar.sabab || "o'zi yuboriladi"}`
            : `SMS ketmadi: ${xabar.sabab || "noma'lum sabab"}`;
    return (
        <p className={`flex items-start gap-2 text-[11px] font-bold leading-snug ${rang}`}>
            <Icon size={14} className="shrink-0 mt-px" />
            <span>{matn}</span>
        </p>
    );
}

/** Bildirishnoma uchun qisqa matn (Klik tasdig'idan keyin). */
export function xabarHolatiMatni(xabar?: XabarQisqa | null): string {
    if (!xabar || !xabar.holat || xabar.holat === 'ochiq_emas') return '';
    if (['yuborildi', 'yetkazildi'].includes(xabar.holat)) return '. Ota-onaga SMS yuborildi';
    if (['kutmoqda', 'yuborilmoqda'].includes(xabar.holat)) return '. SMS navbatda';
    return `. SMS ketmadi: ${xabar.sabab || ''}`;
}

// ---------------------------------------------------------------------------
// Sozlama kartasi
// ---------------------------------------------------------------------------

export function TolovXabariSozlama({ schoolId }: { schoolId: number }) {
    const { ozgartira, showNotification, settings } = useCRM();
    const navigate = useNavigate();
    const tahrir = ozgartira('xabarlar.shablon');
    const yuborishMumkin = ozgartira('xabarlar.yuborish');
    const [d, setD] = useState<Javob | null>(null);
    const [xato, setXato] = useState('');
    const [band, setBand] = useState('');
    const [sinovTel, setSinovTel] = useState('');
    const [hammasi, setHammasi] = useState(false);

    const yukla = async (yangila = false) => {
        try {
            const q = new URLSearchParams({ schoolId: String(schoolId) });
            if (yangila) q.set('yangila', '1');
            const r = await fetch(`/api/tolov-xabari?${q}`, { headers: auth() });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Yuklab bo'lmadi");
            setD(j);
            setXato('');
        } catch (e: any) {
            setXato(e.message);
        }
    };
    useEffect(() => { if (schoolId) yukla(); }, [schoolId]);

    const ozgartir = async (yangi: Sozlama) => {
        if (!d) return;
        setBand('saqla');
        try {
            const r = await fetch('/api/tolov-xabari', {
                method: 'PUT',
                headers: { ...auth(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ schoolId, sozlama: yangi }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Saqlab bo'lmadi");
            setD({ ...d, sozlama: j.sozlama, saqlangan: true });
            showNotification("To'lov xabari sozlamasi saqlandi", 'success');
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setBand('');
        }
    };

    const qayta = async (q: Qator) => {
        setBand(`q-${q.id}`);
        try {
            const r = await fetch(`/api/tolov-xabari/${q.id}/qayta`, { method: 'POST', headers: auth() });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Yuborib bo'lmadi");
            const ok = ['yuborildi', 'yetkazildi'].includes(j.holat);
            showNotification(ok ? 'SMS yuborildi' : `SMS ketmadi: ${j.sabab || ''}`, ok ? 'success' : 'error');
            await yukla();
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setBand('');
        }
    };

    const sinov = async () => {
        setBand('sinov');
        try {
            const r = await fetch('/api/tolov-xabari/sinov', {
                method: 'POST',
                headers: { ...auth(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ schoolId, telefon: sinovTel }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || "Yuborib bo'lmadi");
            showNotification(`Sinov SMS yuborildi: ${sinovTel}`, 'success');
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setBand('');
        }
    };

    const shablon = d?.shablonlar.find(t => t.id === d.sozlama.shablonId) || null;
    const namuna = useMemo(() => shablon
        ? smsMatni(fillTemplate(shablon.body, { name: 'Alimov Jasur', balance: 0, customPaymentAmount: 500000, lastPaymentAmount: 500000 }, [], { orgName: settings?.orgName }))
        : '', [shablon, settings?.orgName]);

    if (xato) return <p className="text-[11px] font-bold text-xato">{xato}</p>;
    if (!d) return <div className="bg-sirt rounded-2xl border border-chiziq p-4 text-[11px] font-bold text-matn-xira">To'lov xabari yuklanmoqda…</div>;

    const s = d.sozlama;
    const kimga = s.kimga.split(',');
    const smsKerak = s.kanal !== 'TELEGRAM';
    const soni = smsSoni(namuna);
    const st = d.statistika || {};
    const yetdi = (st.yetkazildi || 0) + (st.yuborildi || 0);
    const navbatda = (st.kutmoqda || 0) + (st.yuborilmoqda || 0);
    const ketmadi = (st.xato || 0) + (st.yetkazilmadi || 0);
    const royxat = hammasi ? d.royxat : d.royxat.slice(0, 8);

    return (
        <div className="bg-sirt rounded-2xl border border-chiziq p-4 space-y-4">
            {/* Sarlavha va yoqish */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-xs font-black text-matn">To'lov xabari (SMS)</h3>
                    <p className="text-[11px] font-medium text-matn-xira mt-0.5">
                        To'lov kiritilishi bilan ota-onaga ketadi: naqd, karta, o'tkazma, Payme va tasdiqlangan Klik. Butun markaz uchun bitta.
                    </p>
                </div>
                <button type="button" disabled={!tahrir || !!band} onClick={() => ozgartir({ ...s, yoqilgan: !s.yoqilgan })}
                    aria-pressed={s.yoqilgan}
                    className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black border transition-colors cursor-pointer disabled:cursor-default ${s.yoqilgan
                        ? 'bg-brand border-brand text-white' : 'bg-ichki border-chiziq text-matn-xira'}`}>
                    <span className={`w-2 h-2 rounded-full ${s.yoqilgan ? 'bg-white' : 'bg-matn-xira'}`} />
                    {s.yoqilgan ? 'Yoqilgan' : "O'chirilgan"}
                </button>
            </div>

            {!d.saqlangan && (
                <p className="text-[11px] font-bold text-ogoh bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl px-3 py-2">
                    Shablon nomiga qarab o'zi tanlandi. Tekshirib chiqing{tahrir ? " — biror narsani o'zgartirsangiz saqlanadi" : ''}.
                </p>
            )}

            {/* Shablon */}
            <div className="space-y-1.5">
                <span className="block text-[11px] font-bold text-matn-xira">Shablon (Xabarlar → Shablonlar)</span>
                <select value={s.shablonId || ''} disabled={!tahrir || !!band}
                    onChange={e => ozgartir({ ...s, shablonId: Number(e.target.value) || null })}
                    className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-matn outline-none focus:border-brand cursor-pointer disabled:cursor-default disabled:opacity-80">
                    <option value="">— tanlanmagan —</option>
                    {d.shablonlar.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {shablon && smsKerak && (
                    <p className={`text-[11px] font-bold ${eskizYuboradi(shablon.eskizStatus) ? 'text-yaxshi' : eskizRadEtdi(shablon.eskizStatus) ? 'text-xato' : 'text-ogoh'}`}>
                        {eskizYuboradi(shablon.eskizStatus) ? '✓ ' : eskizRadEtdi(shablon.eskizStatus) ? '✗ ' : '⏳ '}
                        {eskizHolatMatni(shablon.eskizStatus)}
                        {!eskizYuboradi(shablon.eskizStatus) && !eskizRadEtdi(shablon.eskizStatus)
                            && " — shu vaqtgacha SMS'lar navbatda turadi va tasdiqlangach o'zi ketadi (48 soat ichidagilar)"}
                    </p>
                )}
                {!shablon && <p className="text-[11px] font-bold text-xato">Shablon tanlanmaguncha to'lov SMS'i ketmaydi.</p>}
            </div>

            {/* Kimga va kanal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <span className="block text-[11px] font-bold text-matn-xira mb-1.5">Kimga</span>
                    <div className="flex flex-wrap gap-1.5">
                        {KIMGA.map(k => {
                            const on = kimga.includes(k.v);
                            return (
                                <button key={k.v} type="button" disabled={!tahrir || !!band || (on && kimga.length === 1)}
                                    onClick={() => ozgartir({ ...s, kimga: (on ? kimga.filter(x => x !== k.v) : [...kimga, k.v]).join(',') })}
                                    className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer disabled:cursor-default ${on ? 'bg-brand border-brand text-white' : 'bg-ichki border-chiziq text-matn-xira'}`}>
                                    {on && <Check size={11} className="inline -mt-0.5 mr-1" />}{k.nom}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] font-medium text-matn-xira mt-1">Raqami yo'q bo'lsa — o'quvchining o'z raqamiga.</p>
                </div>
                <div>
                    <span className="block text-[11px] font-bold text-matn-xira mb-1.5">Kanal</span>
                    <select value={s.kanal} disabled={!tahrir || !!band}
                        onChange={e => ozgartir({ ...s, kanal: e.target.value as Kanal })}
                        className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-matn outline-none focus:border-brand cursor-pointer disabled:cursor-default">
                        {(Object.keys(KANAL_NOMI) as Kanal[]).map(k => <option key={k} value={k}>{KANAL_NOMI[k]}</option>)}
                    </select>
                    {s.kanal === 'BOTH' && <p className="text-[10px] font-medium text-matn-xira mt-1">Telegram bepul — botga ulanmaganlarga SMS.</p>}
                </div>
            </div>

            {/* Namuna */}
            {namuna && (
                <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold text-matn-xira">
                        Namuna{smsKerak && <> · <span className={soni.soni > 1 ? 'text-ogoh' : ''}>{soni.soni} ta SMS</span> · {soni.belgi} belgi{soni.kodlash === 'UCS-2' ? ' (kirill/maxsus belgi — SMS qisqaroq)' : ''}</>}
                    </span>
                    <p className="px-3 py-2.5 rounded-xl bg-ichki border border-chiziq text-[12px] font-medium text-matn leading-relaxed">{namuna}</p>
                    {smsKerak && yuborishMumkin && shablon && eskizYuboradi(shablon.eskizStatus) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <input value={sinovTel} onChange={e => setSinovTel(e.target.value)} inputMode="tel" placeholder="+998 90 123 45 67"
                                className="flex-1 min-w-[160px] px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[12px] font-bold text-matn outline-none focus:border-brand" />
                            <button type="button" onClick={sinov} disabled={!!band || sinovTel.replace(/\D/g, '').length < 9}
                                className="px-3 py-2 rounded-xl border border-brand/40 text-brand hover:bg-brand/10 disabled:opacity-50 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer">
                                {band === 'sinov' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Sinov SMS
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Holat va oxirgi to'lovlar */}
            <div className="pt-3 border-t border-chiziq-mayin space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-matn-2">
                        Oxirgi 7 kun: <span className="text-yaxshi">{yetdi} yuborildi</span>
                        {navbatda > 0 && <> · <span className="text-ogoh">{navbatda} navbatda</span></>}
                        {ketmadi > 0 && <> · <span className="text-xato">{ketmadi} ketmadi</span></>}
                        {d.eskizBalans !== null && d.eskizBalans !== undefined && (
                            <span className="text-matn-xira"> · Eskiz balansi: <span className={d.eskizBalans < 10000 ? 'text-xato' : 'text-matn-2'}>{pul(d.eskizBalans)} so'm</span></span>
                        )}
                    </p>
                    <button type="button" onClick={async () => { setBand('yangila'); await yukla(true); setBand(''); }} disabled={!!band}
                        className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline cursor-pointer disabled:opacity-50">
                        <RefreshCw size={11} className={band === 'yangila' ? 'animate-spin' : ''} /> Yangilash
                    </button>
                </div>

                {d.royxat.length === 0 ? (
                    <p className="text-[11px] font-medium text-matn-xira">Hali to'lov xabari yo'q — birinchi to'lovdan keyin shu yerda ko'rinadi.</p>
                ) : (
                    <div className="divide-y divide-chiziq-mayin rounded-xl border border-chiziq overflow-hidden">
                        {royxat.map(q => {
                            const { Icon, rang, soz } = holatKorinishi(q.holat);
                            const kimgaMatn = kimlar(q.qabul) || [...new Set(q.raqamlar.map(r => KIMGA_NOMI[r.kimga as keyof typeof KIMGA_NOMI] || r.kimga))].join(', ');
                            const qaytaMumkin = yuborishMumkin && ['xato', 'yetkazilmadi', 'kutmoqda'].includes(q.holat);
                            return (
                                <div key={q.id} className="px-3 py-2.5 flex items-start gap-2.5">
                                    <Icon size={15} className={`shrink-0 mt-0.5 ${rang}`} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12px] font-bold text-matn leading-snug break-words">
                                            <button type="button" onClick={() => navigate(`/students/${q.studentId}`)} className="hover:text-brand cursor-pointer">{displayName(q.ism)}</button>
                                            {q.summa !== null && <span className="text-matn-xira font-medium"> · {pul(q.summa)} so'm{q.turi ? ` · ${q.turi}` : ''}</span>}
                                        </p>
                                        <p className={`text-[11px] font-medium ${['xato', 'yetkazilmadi', 'kutmoqda', 'yuborilmoqda'].includes(q.holat) ? rang : 'text-matn-xira'}`}>
                                            <span className="font-bold">{soz}</span>
                                            {kimgaMatn && ['yuborildi', 'yetkazildi', 'yetkazilmadi'].includes(q.holat) && <> · {kimgaMatn}</>}
                                            {q.sabab && ['xato', 'kutmoqda', 'yuborilmoqda', 'yetkazilmadi', 'bekor'].includes(q.holat) && <> · {q.sabab}</>}
                                        </p>
                                        {q.raqamlar.some(r => r.kanal === 'SMS') && ['yuborildi', 'yetkazildi', 'yetkazilmadi'].includes(q.holat) && (
                                            <p className="text-[10px] font-medium text-matn-xira truncate">
                                                {q.raqamlar.filter(r => r.kanal === 'SMS').map(r => `${raqamYashir(r.manzil)}${r.holat === 'yetkazildi' ? ' ✓✓' : r.holat === 'yetkazilmadi' ? ' ✗' : ''}`).join(' · ')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="shrink-0 flex flex-col items-end gap-1">
                                        <span className="text-[10px] font-bold text-matn-xira tabular-nums">{soat(q.yetkazilganAt || q.yuborilganAt || q.createdAt)}</span>
                                        {qaytaMumkin && (
                                            <button type="button" onClick={() => qayta(q)} disabled={!!band}
                                                className="px-2 py-1 rounded-lg border border-chiziq text-[10px] font-bold text-matn-2 hover:border-brand hover:text-brand disabled:opacity-50 cursor-pointer">
                                                {band === `q-${q.id}` ? <Loader2 size={10} className="animate-spin" /> : 'Qayta yuborish'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {d.royxat.length > 8 && (
                    <button type="button" onClick={() => setHammasi(v => !v)} className="text-[11px] font-bold text-brand hover:underline cursor-pointer">
                        {hammasi ? 'Kamroq' : `Yana ${d.royxat.length - 8} ta`}
                    </button>
                )}
            </div>
            {!tahrir && <p className="text-[10px] font-bold text-matn-xira">Sozlamani «Shablonlar» ruxsati bor xodim o'zgartiradi.</p>}
        </div>
    );
}
