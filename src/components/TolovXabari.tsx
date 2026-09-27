import React, { useEffect, useMemo, useState } from 'react';
import { Check, Send, Loader2, CheckCheck, Clock, XCircle, MinusCircle } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { QoidaKartasi } from './QoidaKartasi';
import { displayName } from '../lib/displayName';
import { fillTemplate } from '../../lib/xabarMatni.js';
import {
    eskizYuboradi, eskizRadEtdi, eskizHolatMatni, smsMatni, smsSoni, KIMGA_NOMI,
} from '../../lib/tolovXabari.js';

/**
 * To'lov xabari: to'lov qabul qilinganda ota-onaga ketadigan SMS
 * (services/tolovXabari.js, lib/tolovXabari.js).
 *
 *  - TolovQoidaKartasi / TolovQoidaFormasi — Xabarlar → Avtomatik ro'yxatidagi
 *    qoida va uning oynasi: yoqish, shablon, kimga, kanal,
 *    namuna, sinov SMS. Yuborilganlar — Tarix tabida (XabarNavbati, jurnal).
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
// Tarix: navbatdagi (hali yuborilmagan) xabarlar va xato sababi
// ---------------------------------------------------------------------------

/**
 * SMS xatosi odam tushunadigan so'z bilan (Tarix jadvalida). Eskiz javobi
 * ruscha JSON bo'lib keladi: {"message":"Этот смс текст еще не прошёл модерацию…"}.
 */
export function xatoSababi(errorMsg?: string | null, kanal?: string | null): string {
    let m = String(errorMsg || '');
    try { const j = JSON.parse(m); m = String(j?.message || j?.data?.message || j?.error || m); } catch { /* matn */ }
    // Telegram xatosi Eskizga aloqasi yo'q — "Eskiz javob bermadi" deb chalg'itmasin.
    if (kanal === 'TELEGRAM') {
        if (/blocked|bloklagan/i.test(m)) return 'Telegram: botni bloklagan';
        if (/chat not found|deactivated|kicked/i.test(m)) return 'Telegram: chat topilmadi';
        if (/timeout|abort|fetch failed|ECONN|socket|network/i.test(m)) return "Telegram bilan aloqa uzildi — qayta yuborsa bo'ladi";
        if (/bot topilmadi|ulanmagan/i.test(m)) return 'Telegram bot ulanmagan';
        return m.slice(0, 90) || 'Telegram xatosi';
    }
    if (/token olish|fetch failed|ECONN|ENOTFOUND|socket/i.test(m)) return "Eskiz bilan aloqa uzildi — qayta yuborsa bo'ladi";
    if (/модерац|moderat|tasdiqlanmagan/i.test(m)) return "Matn Eskizda tasdiqlangan shablonga mos emas";
    if (/баланс|balance|недостаточно|limit/i.test(m)) return "Eskiz balansida pul yetmadi";
    if (/sozlamalari|email|password|token|unauthor/i.test(m)) return "Eskiz sozlamasi (email/parol) xato";
    if (/lokal server/i.test(m)) return 'Lokal server (sinov) — yuborilmagan';
    if (/blocked|bloklagan/i.test(m)) return 'Telegram: botni bloklagan';
    if (/chat not found|deactivated/i.test(m)) return "Telegram: chat topilmadi";
    if (/timeout|abort|fetch failed|kutish vaqti/i.test(m)) return 'Eskiz javob bermadi';
    if (/Operator yetkazmadi|UNDELIV|EXPIRED|REJECT/i.test(m)) return "Operator yetkazmadi (raqam o'chiq yoki noto'g'ri)";
    return m.slice(0, 90) || 'Xatolik';
}

interface NavbatQatori { id: number; studentId: number; ism: string; summa: number | null; turi?: string | null; holat: string; sabab: string | null; createdAt: string }
interface NavbatShablon { nom: string; holat: string | null; eskizId: string | null }
interface Navbat { tolov: NavbatQatori[]; qarz: NavbatQatori[]; tolovShablon: NavbatShablon | null; qarzShablon: NavbatShablon | null }

/**
 * Tarix tepasida: yuborilishini kutayotgan to'lov SMS lari va qarz
 * eslatmalari. SmsLog yozuvi faqat yuborilganda paydo bo'ladi — ilgari
 * navbatdagi xabar Tarixda umuman ko'rinmas va "ketmayapti" deb o'ylanardi.
 */
export function XabarNavbati({ schoolId, onAvtomatik }: { schoolId: number; onAvtomatik?: () => void }) {
    const [d, setD] = useState<Navbat | null>(null);
    useEffect(() => {
        let tirik = true;
        fetch(`/api/sms/navbat?schoolId=${schoolId || 0}`, { headers: auth() })
            .then(r => (r.ok ? r.json() : null))
            .then(j => { if (tirik) setD(j); })
            .catch(() => {});
        return () => { tirik = false; };
    }, [schoolId]);
    if (!d) return null;
    const soni = d.tolov.length + d.qarz.length;
    if (!soni) return null;
    const qatorlar = [
        ...d.tolov.map(q => ({ ...q, tur: "to'lov SMS i" })),
        ...d.qarz.map(q => ({ ...q, tur: 'qarz eslatmasi' })),
    ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const tekshiruvda = (sh: NavbatShablon | null) => sh && !eskizYuboradi(sh.holat) && !eskizRadEtdi(sh.holat);
    return (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] font-black text-ogoh flex items-center gap-1.5">
                    <Clock size={14} /> Navbatda {soni} ta xabar — hali yuborilmagan
                </p>
                {onAvtomatik && (
                    <button type="button" onClick={onAvtomatik} className="text-[11px] font-bold text-brand hover:underline cursor-pointer">Avtomatik →</button>
                )}
            </div>
            {([
                { k: 'tolov', sh: d.tolovShablon, n: d.tolov.length },
                { k: 'qarz', sh: d.qarzShablon, n: d.qarz.length },
            ]).map(({ k, sh, n }) => (n > 0 && sh && tekshiruvda(sh) ? (
                <p key={k} className="text-[11px] font-bold text-matn-2">
                    «{sh.nom}» matnini Eskiz hali tasdiqlamagan{sh.eskizId ? ` (Eskiz ID ${sh.eskizId})` : ''} — tasdiqlangach bu xabarlar o'zi ketadi. Dam olish kunlari Eskiz tekshirmasligi mumkin; tezlatish uchun Eskiz yordamiga yozing (Telegram: @eskizhelp).
                </p>
            ) : null))}
            <div className="divide-y divide-amber-200/60 dark:divide-amber-900/40">
                {qatorlar.slice(0, 6).map(q => (
                    <p key={`${q.tur}-${q.id}`} className="py-1.5 text-[11px] font-medium text-matn break-words">
                        <span className="font-bold">{displayName(q.ism)}</span>
                        <span className="text-matn-xira"> · {q.tur}{q.summa !== null ? ` · ${pul(q.summa)} so'm` : ''} · {soat(q.createdAt)}</span>
                        {q.sabab && <span className="text-ogoh"> · {q.sabab}</span>}
                    </p>
                ))}
            </div>
            {qatorlar.length > 6 && <p className="text-[10px] font-bold text-matn-xira">Yana {qatorlar.length - 6} ta — Xabarlar → Avtomatik.</p>}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Qoida: "💰 To'lov qabul qilinganda" — Xabarlar → Avtomatik ro'yxatidagi
// karta va "Yangi qoida yaratish" oynasidagi forma (egasi, 2026-09-27:
// "nimaga alohida qilding, trigger qo'shsang bo'lmasmidi?"). Yuborilganlar
// tarixi — Tarix tabida (XabarNavbati va jurnal).
// ---------------------------------------------------------------------------

const KANAL_QISQA: Record<Kanal, string> = { SMS: 'SMS', BOTH: "Telegram, bo'lmasa SMS", TELEGRAM: 'Telegram' };
const kimgaMatni = (k: string) => k.split(',').map(v => KIMGA.find(x => x.v === v)?.nom || v).join(', ');

/** Qoida sozlamasi, shablonlar va 7 kunlik holat. */
function useTolovQoidasi(schoolId: number, yangilash = 0) {
    const [d, setD] = useState<Javob | null>(null);
    const [xato, setXato] = useState('');
    useEffect(() => {
        let tirik = true;
        fetch(`/api/tolov-xabari?schoolId=${schoolId || 0}`, { headers: auth() })
            .then(async r => {
                const j = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(j.error || "Yuklab bo'lmadi");
                if (tirik) { setD(j); setXato(''); }
            })
            .catch(e => { if (tirik) setXato(e.message); });
        return () => { tirik = false; };
    }, [schoolId, yangilash]);
    return { d, setD, xato };
}

async function tolovSaqla(schoolId: number, sozlama: Sozlama): Promise<Sozlama> {
    const r = await fetch('/api/tolov-xabari', {
        method: 'PUT',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, sozlama }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Saqlab bo'lmadi");
    return j.sozlama;
}

/** SMS matnining Eskiz holati — qoida kartasida va formada. */
export function EskizHolati({ shablon, navbatda = 0 }: { shablon: { name: string; eskizStatus?: string | null } | null; navbatda?: number }) {
    if (!shablon) return <p className="text-[11px] font-bold text-rose-500">SMS matni tanlanmagan — SMS ketmaydi</p>;
    const ok = eskizYuboradi(shablon.eskizStatus);
    const rad = eskizRadEtdi(shablon.eskizStatus);
    return (
        <p className={`text-[11px] font-bold ${ok ? 'text-emerald-500' : rad ? 'text-rose-500' : 'text-amber-500'}`}>
            {ok ? '✓ ' : rad ? '✗ ' : '⏳ '}{eskizHolatMatni(shablon.eskizStatus)}
            {!ok && !rad && " — SMS'lar navbatda turadi, tasdiqlangach o'zi ketadi"}
            {navbatda > 0 && ` · ${navbatda} ta navbatda`}
        </p>
    );
}

/** Yuklanayotgan yoki xato bo'lgan qoida kartasi o'rnida. */
export function QoidaKartasiBosh({ nom, xato }: { nom: string; xato?: string }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 space-y-2">
            <p className="text-xs font-black text-slate-700 dark:text-slate-300">{nom}</p>
            <p className={`text-[11px] font-bold ${xato ? 'text-rose-500' : 'text-slate-400'}`}>{xato || 'Yuklanmoqda…'}</p>
        </div>
    );
}

export function TolovQoidaKartasi({ schoolId, yangilash = 0, onTahrir }: { schoolId: number; yangilash?: number; onTahrir: () => void }) {
    const { ozgartira, showNotification } = useCRM();
    const tahrir = ozgartira('xabarlar.shablon') || ozgartira('xabarlar.avto');
    const { d, setD, xato } = useTolovQoidasi(schoolId, yangilash);
    const [band, setBand] = useState(false);
    if (!d) return <QoidaKartasiBosh nom="💰 To'lov qabul qilinganda" xato={xato} />;
    const s = d.sozlama;
    const shablon = d.shablonlar.find(t => t.id === s.shablonId) || null;
    const st = d.statistika || {};
    const almashtir = async () => {
        setBand(true);
        try {
            const yangi = await tolovSaqla(schoolId, { ...s, yoqilgan: !s.yoqilgan });
            setD({ ...d, sozlama: yangi, saqlangan: true });
            showNotification(yangi.yoqilgan ? "To'lov SMS i yoqildi" : "To'lov SMS i o'chirildi", 'success');
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setBand(false);
        }
    };
    return (
        <QoidaKartasi
            icon="💰" label="To'lov qabul qilinganda" color="bg-teal-100 dark:bg-teal-950/30 text-teal-500"
            nom="To'lov kiritilganda — ota-onaga xabar"
            meta={[
                { k: 'Kanal', v: KANAL_QISQA[s.kanal] },
                { k: 'Vaqt', v: 'darhol' },
                { k: 'Kimga', v: kimgaMatni(s.kimga), keng: true },
            ]}
            matn={shablon ? shablon.body : undefined}
            holat={s.kanal !== 'TELEGRAM' ? <EskizHolati shablon={shablon} navbatda={(st.kutmoqda || 0) + (st.yuborilmoqda || 0)} /> : undefined}
            yoqilgan={s.yoqilgan} onToggle={almashtir} onEdit={onTahrir} tahrir={tahrir} band={band}
        />
    );
}

/**
 * "Yangi qoida yaratish" / tahrirlash oynasidagi forma. yangi — oyna
 * "Yangi qoida" dan ochilgan: saqlanganda qoida yoqiladi.
 */
export function TolovQoidaFormasi({ schoolId, yangi = false, onClose, onSaqlandi }: {
    schoolId: number; yangi?: boolean; onClose: () => void; onSaqlandi: () => void;
}) {
    const { ozgartira, showNotification, settings } = useCRM();
    const tahrir = ozgartira('xabarlar.shablon') || ozgartira('xabarlar.avto');
    const yuborishMumkin = ozgartira('xabarlar.yuborish');
    const { d, xato } = useTolovQoidasi(schoolId);
    const [q, setQ] = useState<Sozlama | null>(null);
    const [band, setBand] = useState('');
    const [sinovTel, setSinovTel] = useState('');
    useEffect(() => { if (d && !q) setQ({ ...d.sozlama, ...(yangi ? { yoqilgan: true } : {}) }); }, [d]);

    const shablon = d && q ? d.shablonlar.find(t => t.id === q.shablonId) || null : null;
    const namuna = useMemo(() => shablon
        ? smsMatni(fillTemplate(shablon.body, { name: 'Alimov Jasur', balance: 0, customPaymentAmount: 500000, lastPaymentAmount: 500000 }, [], { orgName: settings?.orgName }))
        : '', [shablon, settings?.orgName]);

    if (xato) return <p className="text-[11px] font-bold text-rose-500">{xato}</p>;
    if (!d || !q) return <p className="text-[11px] font-bold text-slate-400">Yuklanmoqda…</p>;

    const kimga = q.kimga.split(',');
    const smsKerak = q.kanal !== 'TELEGRAM';
    const soni = smsSoni(namuna);
    const inp = 'w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-brand cursor-pointer disabled:opacity-80';
    const lbl = 'block text-[11px] font-bold text-slate-400 mb-1.5';

    const saqla = async () => {
        setBand('saqla');
        try {
            await tolovSaqla(schoolId, q);
            showNotification("To'lov qoidasi saqlandi", 'success');
            onSaqlandi();
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

    return (
        <div className="space-y-4">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                To'lov kiritilishi bilan (naqd, karta, o'tkazma, Payme, tasdiqlangan Klik) ota-onaga darhol ketadi. Butun markaz uchun bitta qoida.
            </p>
            <div>
                <label className={lbl}>SMS matni — «Shablonlar» bo'limidagi shablon</label>
                <select value={q.shablonId || ''} disabled={!tahrir} onChange={e => setQ({ ...q, shablonId: Number(e.target.value) || null })} className={inp}>
                    <option value="">— tanlanmagan —</option>
                    {d.shablonlar.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {smsKerak && <div className="mt-1.5"><EskizHolati shablon={shablon} /></div>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className={lbl}>Kimga</label>
                    <div className="flex flex-wrap gap-1.5">
                        {KIMGA.map(k => {
                            const on = kimga.includes(k.v);
                            return (
                                <button key={k.v} type="button" disabled={!tahrir || (on && kimga.length === 1)}
                                    onClick={() => setQ({ ...q, kimga: (on ? kimga.filter(x => x !== k.v) : [...kimga, k.v]).join(',') })}
                                    className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:cursor-default ${on ? 'bg-brand/10 border-brand text-brand' : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400'}`}>
                                    {k.nom}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">Raqami yo'q bo'lsa — o'quvchining o'z raqamiga.</p>
                </div>
                <div>
                    <label className={lbl}>Kanal</label>
                    <select value={q.kanal} disabled={!tahrir} onChange={e => setQ({ ...q, kanal: e.target.value as Kanal })} className={inp}>
                        {(Object.keys(KANAL_NOMI) as Kanal[]).map(k => <option key={k} value={k}>{KANAL_NOMI[k]}</option>)}
                    </select>
                    {q.kanal === 'BOTH' && <p className="text-[10px] font-medium text-slate-400 mt-1">Telegram bepul — botga ulanmaganlarga SMS.</p>}
                </div>
            </div>
            {namuna && (
                <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold text-slate-400">
                        Namuna{smsKerak && <> · <span className={soni.soni > 1 ? 'text-amber-500' : ''}>{soni.soni} ta SMS</span> · {soni.belgi} belgi</>}
                    </span>
                    <p className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-[12px] font-medium text-slate-700 dark:text-slate-200 leading-relaxed">{namuna}</p>
                    {smsKerak && yuborishMumkin && shablon && eskizYuboradi(shablon.eskizStatus) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <input value={sinovTel} onChange={e => setSinovTel(e.target.value)} inputMode="tel" placeholder="+998 90 123 45 67"
                                className="flex-1 min-w-[160px] px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-[12px] font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-brand" />
                            <button type="button" onClick={sinov} disabled={!!band || sinovTel.replace(/\D/g, '').length < 9}
                                className="px-3 py-2 rounded-xl border border-brand/40 text-brand hover:bg-brand/10 disabled:opacity-50 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer">
                                {band === 'sinov' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Sinov SMS
                            </button>
                        </div>
                    )}
                </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={onClose}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl text-xs font-black cursor-pointer">
                    Bekor qilish
                </button>
                <button type="button" onClick={saqla} disabled={!tahrir || !!band}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-brand-dark text-white rounded-xl text-xs font-black shadow-sm cursor-pointer disabled:opacity-50">
                    {band === 'saqla' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Saqlash
                </button>
            </div>
        </div>
    );
}
