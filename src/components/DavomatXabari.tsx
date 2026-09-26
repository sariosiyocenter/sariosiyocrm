import React, { useEffect, useMemo, useState } from 'react';
import { X, Send, Check, AlertTriangle, Settings2 } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { displayName } from '../lib/displayName';
import { fillTemplate } from '../../lib/xabarMatni.js';
import { DAVOMAT_HOLATLARI, holatKaliti, eskizTasdiqlangan } from '../../lib/davomatXabari.js';

/**
 * Davomat xabari (egasi, 2026-09-26): kurs yo'qlamasidan keyin ota-onaga har
 * holat uchun Xabarlar → Shablonlar dagi tanlangan shablon ketadi.
 *
 *  - DavomatXabariSozlama — qaysi holatga qaysi shablon, kanal va kimga
 *    (butun markazga bitta). Xabarlar → Avtomatik tabida (2026-09-27 gacha
 *    Shablonlar da edi — egasi "bu nima?" dedi) va kurs oynasida.
 *  - DavomatXabarModal — kurs → Yo'qlama → "Xabar yuborish": shu kun
 *    kelmagan / kechikkan / … o'quvchilar holat bo'yicha guruhlangan, har
 *    birini belgilab yoki olib tashlab yuboriladi. Ilgari ikki tugma bor edi:
 *    biri qattiq yozilgan "Davomat xabarnomasi / Holat: Kelmapdi" ni, ikkinchisi
 *    Eskizda tasdiqlanmagan SMS ni yuborardi (hammasi FAILED).
 */

export interface Shablon { id: number; name: string; body: string; eskizStatus?: string | null }
export interface Sozlama { kanal: 'BOTH' | 'SMS' | 'TELEGRAM'; kimga: string; shablon: Record<string, number> }
interface Javob { sozlama: Sozlama; saqlangan: boolean; shablonlar: Shablon[]; yuborilgan: Record<string, string> }

const KANAL_NOMI: Record<Sozlama['kanal'], string> = {
    BOTH: "Telegram, bo'lmasa SMS",
    TELEGRAM: 'Faqat Telegram',
    SMS: 'Faqat SMS',
};
const KIMGA = [
    { v: 'FATHER', nom: 'Otasi' },
    { v: 'MOTHER', nom: 'Onasi' },
    { v: 'STUDENT', nom: "O'quvchi" },
];
const HOLAT_RANGI: Record<string, string> = {
    Kelmapdi: 'bg-rose-500', Sababli: 'bg-sky-500', Kechikdi: 'bg-orange-400', ErtaKetdi: 'bg-purple-500', Keldi: 'bg-emerald-500',
};

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

async function yuklash(schoolId: number, groupId?: number, date?: string): Promise<Javob> {
    const q = new URLSearchParams({ schoolId: String(schoolId) });
    if (groupId && date) { q.set('groupId', String(groupId)); q.set('date', date); }
    const r = await fetch(`/api/davomat-xabari?${q}`, { headers: auth() });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Sozlamani yuklab bo'lmadi");
    return j;
}

async function saqlash(schoolId: number, sozlama: Sozlama): Promise<Sozlama> {
    const r = await fetch('/api/davomat-xabari', {
        method: 'PUT',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, sozlama }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Saqlab bo'lmadi");
    return j.sozlama;
}

/** Shablonning Eskiz holati — SMS kerak bo'lganda ogohlantirish uchun. */
function EskizBelgi({ holat }: { holat?: string | null }) {
    if (eskizTasdiqlangan(holat)) return <span className="text-[10px] font-bold text-yaxshi">SMS: tasdiqlangan</span>;
    return (
        <span className="text-[10px] font-bold text-ogoh" title={holat || undefined}>
            SMS: Eskizda tasdiqlanmagan — SMS yetib bormaydi
        </span>
    );
}

// ---------------------------------------------------------------------------
// Sozlama
// ---------------------------------------------------------------------------

export function DavomatXabariSozlama({ schoolId, ixcham = false, onChange }: {
    schoolId: number;
    /** Kurs oynasi ichida — sarlavhasiz. */
    ixcham?: boolean;
    onChange?: (s: Sozlama, shablonlar: Shablon[]) => void;
}) {
    const { ozgartira, showNotification } = useCRM();
    // Karta Avtomatik tabida: avtomatik qoidalar ruxsati ham yetadi.
    const tahrir = ozgartira('xabarlar.shablon') || ozgartira('xabarlar.avto');
    const [d, setD] = useState<Javob | null>(null);
    const [xato, setXato] = useState('');
    const [band, setBand] = useState(false);

    useEffect(() => {
        let off = false;
        yuklash(schoolId).then(j => { if (!off) setD(j); }).catch(e => !off && setXato(e.message));
        return () => { off = true; };
    }, [schoolId]);

    const ozgartir = async (yangi: Sozlama) => {
        if (!d) return;
        setBand(true);
        try {
            const s = await saqlash(schoolId, yangi);
            setD({ ...d, sozlama: s, saqlangan: true });
            onChange?.(s, d.shablonlar);
            showNotification('Davomat xabari sozlamasi saqlandi', 'success');
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setBand(false);
        }
    };

    if (xato) return <p className="text-[11px] font-bold text-xato">{xato}</p>;
    if (!d) return <p className="text-[11px] font-bold text-matn-xira">Yuklanmoqda…</p>;
    const s = d.sozlama;
    const kimga = s.kimga.split(',');

    return (
        <div className={ixcham ? 'space-y-3' : 'bg-sirt rounded-2xl border border-chiziq p-4 space-y-4'}>
            {!ixcham && (
                <div>
                    <h3 className="text-xs font-black text-matn">📋 Davomat qilinganda — ota-onaga xabar</h3>
                    <p className="text-[11px] font-medium text-matn-xira mt-0.5">
                        Ustoz yo'qlamani saqlaganda (Telegram botda «Saqlash» yoki kurs sahifasida Yo'qlama → «Xabar yuborish») darsga kelmagan, kechikkan yoki erta ketgan o'quvchining ota-onasiga shu matn ketadi. Har holat uchun matnni tanlang — matnlarning o'zi «Shablonlar» bo'limida. Butun markaz uchun bitta.
                    </p>
                </div>
            )}
            {!d.saqlangan && (
                <p className="text-[11px] font-bold text-ogoh bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl px-3 py-2">
                    Shablon nomiga qarab o'zi tanlandi. Tekshirib chiqing{tahrir ? ' — biror narsani o\'zgartirsangiz saqlanadi' : ''}.
                </p>
            )}

            <div className="space-y-2">
                {DAVOMAT_HOLATLARI.map(h => {
                    const tanlangan = d.shablonlar.find(t => t.id === s.shablon[h.key]);
                    return (
                        <div key={h.key} className="grid grid-cols-[92px_1fr] items-center gap-2">
                            <span className="flex items-center gap-2 text-[11px] font-bold text-matn">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${HOLAT_RANGI[h.key]}`} />{h.nom}
                            </span>
                            <div className="min-w-0">
                                <select
                                    value={s.shablon[h.key] || ''}
                                    disabled={!tahrir || band}
                                    onChange={e => {
                                        const id = Number(e.target.value);
                                        const shablon = { ...s.shablon };
                                        if (id) shablon[h.key] = id; else delete shablon[h.key];
                                        ozgartir({ ...s, shablon });
                                    }}
                                    className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-matn outline-none focus:border-brand cursor-pointer disabled:cursor-default disabled:opacity-80"
                                >
                                    <option value="">— xabar yuborilmaydi —</option>
                                    {d.shablonlar.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                {tanlangan && s.kanal !== 'TELEGRAM' && !eskizTasdiqlangan(tanlangan.eskizStatus) && (
                                    <span className="block mt-0.5"><EskizBelgi holat={tanlangan.eskizStatus} /></span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <span className="block text-[11px] font-bold text-matn-xira mb-1.5">Kanal (standart)</span>
                    <select value={s.kanal} disabled={!tahrir || band}
                        onChange={e => ozgartir({ ...s, kanal: e.target.value as Sozlama['kanal'] })}
                        className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-matn outline-none focus:border-brand cursor-pointer disabled:cursor-default">
                        {(Object.keys(KANAL_NOMI) as Sozlama['kanal'][]).map(k => <option key={k} value={k}>{KANAL_NOMI[k]}</option>)}
                    </select>
                </div>
                <div>
                    <span className="block text-[11px] font-bold text-matn-xira mb-1.5">Kimga</span>
                    <div className="flex flex-wrap gap-1.5">
                        {KIMGA.map(k => {
                            const on = kimga.includes(k.v);
                            return (
                                <button key={k.v} type="button" disabled={!tahrir || band || (on && kimga.length === 1)}
                                    onClick={() => ozgartir({ ...s, kimga: (on ? kimga.filter(x => x !== k.v) : [...kimga, k.v]).join(',') })}
                                    className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer disabled:cursor-default ${on ? 'bg-brand border-brand text-white' : 'bg-ichki border-chiziq text-matn-xira'}`}>
                                    {on && <Check size={11} className="inline -mt-0.5 mr-1" />}{k.nom}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
            {!tahrir && <p className="text-[10px] font-bold text-matn-xira">Sozlamani «Avtomatik qoidalar» yoki «Shablonlar» ruxsati bor xodim o'zgartiradi.</p>}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Kurs oynasi
// ---------------------------------------------------------------------------

interface Oquvchi {
    id: number; name: string; phone?: string | null;
    fatherPhone?: string | null; motherPhone?: string | null;
    telegramId?: string | null; fatherTelegramId?: string | null; motherTelegramId?: string | null;
    balance?: number;
}

/** Shu kanal va "kimga" bilan xabar yetib boradimi (server sendToOne bilan bir xil). */
function aloqa(s: Oquvchi, kanal: Sozlama['kanal'], kimga: string[]): 'tg' | 'sms' | null {
    const tg = (kimga.includes('FATHER') && !!s.fatherTelegramId) || (kimga.includes('MOTHER') && !!s.motherTelegramId)
        || (kimga.includes('STUDENT') && !!s.telegramId);
    const sms = (kimga.includes('FATHER') && !!s.fatherPhone) || (kimga.includes('MOTHER') && !!s.motherPhone)
        || !!s.phone;
    if (kanal === 'TELEGRAM') return tg ? 'tg' : null;
    if (kanal === 'SMS') return sms ? 'sms' : null;
    return tg ? 'tg' : sms ? 'sms' : null;
}

const vaqt = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function DavomatXabarModal({ group, date, students, statusOf, onClose }: {
    group: { id: number; name: string; schoolId: number; courseId?: number; teacherId?: number };
    date: string;
    /** Kurs o'quvchilari — ko'rsatish tartibida (kurs sahifasidagi bilan bir xil). */
    students: Oquvchi[];
    statusOf: (studentId: number) => string | null;
    onClose: () => void;
}) {
    const { ozgartira, settings, courses, teachers } = useCRM();
    const smsMumkin = ozgartira('xabarlar.yuborish');
    const [d, setD] = useState<Javob | null>(null);
    const [xato, setXato] = useState('');
    const [kanal, setKanal] = useState<Sozlama['kanal']>('TELEGRAM');
    const [tanlov, setTanlov] = useState<Record<number, boolean>>({});
    const [sozlashOchiq, setSozlashOchiq] = useState(false);
    const [yuborilmoqda, setYuborilmoqda] = useState(false);
    const [natija, setNatija] = useState<any>(null);
    // Shabloni yo'q holat (odatda Keldi) ro'yxati yig'iq turadi — 26 ta keldini
    // aylantirib o'tirmasdan kerakli bo'limga yetib borilsin.
    const [ochiq, setOchiq] = useState<Record<string, boolean>>({});

    const qayta = () => yuklash(group.schoolId, group.id, date).then(j => {
        setD(j);
        setKanal(smsMumkin ? j.sozlama.kanal : 'TELEGRAM');
        return j;
    });

    useEffect(() => {
        qayta().catch(e => setXato(e.message));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group.id, date]);

    const kimga = (d?.sozlama.kimga || 'FATHER,MOTHER').split(',');

    // Holat bo'yicha guruhlar (faqat yo'qlama qo'yilganlar).
    const guruhlar = useMemo(() => DAVOMAT_HOLATLARI.map(h => ({
        ...h,
        oquvchilar: students.filter(s => holatKaliti(statusOf(s.id) || '') === h.key),
    })).filter(g => g.oquvchilar.length > 0), [students, statusOf]);
    const belgilanmagan = students.filter(s => !statusOf(s.id)).length;

    // Standart tanlov: shablon bor, aloqa bor, bugun hali yuborilmagan.
    useEffect(() => {
        if (!d) return;
        const t: Record<number, boolean> = {};
        for (const g of guruhlar) {
            const bor = !!d.shablonlar.find(x => x.id === d.sozlama.shablon[g.key]);
            for (const s of g.oquvchilar) t[s.id] = bor && !!aloqa(s, kanal, kimga) && !d.yuborilgan[s.id];
        }
        setTanlov(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [d, kanal, guruhlar]);

    const kursMalumoti = [{
        id: group.id, name: group.name,
        courseName: (courses || []).find((c: any) => c.id === group.courseId)?.name || '',
        teacherName: (teachers || []).find((t: any) => t.id === group.teacherId)?.name || '',
    }];
    const markaz = { name: settings?.orgName || '', orgName: settings?.orgName || '' };

    const tanlanganlar = Object.entries(tanlov).filter(([, v]) => v).map(([k]) => Number(k));

    const yuborish = async () => {
        if (!tanlanganlar.length) return;
        setYuborilmoqda(true);
        try {
            const r = await fetch('/api/attendances/notify', {
                method: 'POST',
                headers: { ...auth(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: group.id, date, studentIds: tanlanganlar, kanal }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error || 'Yuborilmadi');
            setNatija(j);
            await qayta().catch(() => {});
        } catch (e: any) {
            setNatija({ error: e.message });
        } finally {
            setYuborilmoqda(false);
        }
    };

    const sana = date.split('-').reverse().join('.');

    return (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center-safe justify-center sm:p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt w-full sm:max-w-2xl max-h-[92dvh] flex flex-col rounded-t-[1.75rem] sm:rounded-[1.75rem] shadow-2xl border border-chiziq">
                {/* Sarlavha */}
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-chiziq-mayin/60">
                    <div className="min-w-0">
                        <h3 className="text-sm font-black text-matn tracking-tight">Ota-onaga davomat xabari</h3>
                        <p className="text-[11px] font-bold text-brand mt-0.5 truncate">{group.name} · {sana}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => setSozlashOchiq(v => !v)} title="Shablonlar va kanal"
                            className={`h-9 px-3 flex items-center gap-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${sozlashOchiq ? 'bg-brand text-white' : 'text-matn-xira hover:bg-ichki'}`}>
                            <Settings2 size={14} /> <span className="hidden sm:inline">Shablonlar</span>
                        </button>
                        <button aria-label="Yopish" onClick={onClose} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer"><X size={18} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
                    {xato && <p className="text-[11px] font-bold text-xato">{xato}</p>}
                    {!d && !xato && <p className="text-[11px] font-bold text-matn-xira">Yuklanmoqda…</p>}

                    {d && sozlashOchiq && (
                        <div className="bg-ichki/50 border border-chiziq rounded-2xl p-3">
                            <DavomatXabariSozlama schoolId={group.schoolId} ixcham onChange={() => { qayta().catch(() => {}); }} />
                        </div>
                    )}

                    {d && natija && (
                        <div className={`rounded-2xl border p-3 space-y-1.5 ${natija.error ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20' : 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20'}`}>
                            {natija.error ? (
                                <p className="text-[12px] font-bold text-xato">{natija.error}</p>
                            ) : (
                                <>
                                    <p className="text-[12px] font-black text-matn">
                                        <Check size={13} className="inline -mt-0.5 mr-1 text-yaxshi" />
                                        {natija.yuborildi} ta ota-onaga yuborildi
                                        {(natija.xato + natija.aloqasiz) > 0 && <span className="text-xato"> · {natija.xato + natija.aloqasiz} tasiga yetib bormadi</span>}
                                    </p>
                                    {(natija.xatolar || []).slice(0, 20).map((x: any) => (
                                        <p key={x.studentId} className="text-[11px] font-medium text-matn-2">
                                            {displayName(x.ism)} — <span className="text-xato">{x.sabab}</span>
                                        </p>
                                    ))}
                                </>
                            )}
                        </div>
                    )}

                    {d && (
                        <>
                            {/* Kanal */}
                            <div>
                                <span className="block text-[11px] font-bold text-matn-xira mb-1.5">Qayerga</span>
                                <div className="grid grid-cols-3 gap-1 bg-ichki p-1 rounded-xl border border-chiziq">
                                    {(['BOTH', 'TELEGRAM', 'SMS'] as Sozlama['kanal'][]).map(k => {
                                        const yopiq = k !== 'TELEGRAM' && !smsMumkin;
                                        return (
                                            <button key={k} type="button" disabled={yopiq} onClick={() => setKanal(k)}
                                                className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${kanal === k ? 'bg-sirt text-brand shadow-sm' : 'text-matn-xira'}`}>
                                                {KANAL_NOMI[k]}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] font-medium text-matn-xira mt-1">
                                    Kimga: {kimga.map(k => KIMGA.find(x => x.v === k)?.nom?.toLowerCase()).join(', ')}
                                    {!smsMumkin && ' · SMS uchun «SMS va Telegram yuborish» ruxsati kerak'}
                                </p>
                            </div>

                            {guruhlar.length === 0 && (
                                <p className="text-[12px] font-bold text-matn-xira bg-ichki/50 border border-chiziq rounded-2xl p-4 text-center">
                                    Bu kunga hali yo'qlama qo'yilmagan
                                </p>
                            )}

                            {guruhlar.map(g => {
                                const shablon = d.shablonlar.find(x => x.id === d.sozlama.shablon[g.key]);
                                const namuna = shablon ? fillTemplate(shablon.body, g.oquvchilar[0], kursMalumoti, markaz) : '';
                                const tanlanadigan = g.oquvchilar.filter(s => shablon && aloqa(s, kanal, kimga));
                                const hammasi = tanlanadigan.length > 0 && tanlanadigan.every(s => tanlov[s.id]);
                                return (
                                    <div key={g.key} className="border border-chiziq rounded-2xl overflow-hidden">
                                        <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-ichki/60">
                                            <span className="flex items-center gap-2 text-[12px] font-black text-matn">
                                                <span className={`w-2.5 h-2.5 rounded-full ${HOLAT_RANGI[g.key]}`} />
                                                {g.nom} <span className="num text-matn-xira font-bold">{g.oquvchilar.length}</span>
                                            </span>
                                            {tanlanadigan.length > 0 && (
                                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-matn-xira cursor-pointer">
                                                    <input type="checkbox" checked={hammasi}
                                                        onChange={e => setTanlov(t => {
                                                            const n = { ...t };
                                                            tanlanadigan.forEach(s => { n[s.id] = e.target.checked; });
                                                            return n;
                                                        })}
                                                        className="w-4 h-4 rounded border-chiziq text-brand focus:ring-brand cursor-pointer" />
                                                    Hammasi
                                                </label>
                                            )}
                                        </div>

                                        <div className="px-3 pt-2.5">
                                            {shablon ? (
                                                <>
                                                    <p className="text-[10px] font-bold text-matn-xira truncate">Shablon: {shablon.name}</p>
                                                    <p className="mt-1 text-[12px] leading-relaxed text-matn-2 bg-ichki/50 border border-chiziq-mayin rounded-xl px-3 py-2 whitespace-pre-wrap">{namuna}</p>
                                                    {kanal !== 'TELEGRAM' && !eskizTasdiqlangan(shablon.eskizStatus) && (
                                                        <p className="mt-1 flex items-center gap-1"><AlertTriangle size={11} className="text-ogoh" /><EskizBelgi holat={shablon.eskizStatus} /></p>
                                                    )}
                                                </>
                                            ) : (
                                                <p className="text-[11px] font-bold text-matn-xira">
                                                    Shablon tanlanmagan — bu holatga xabar ketmaydi.
                                                    <button type="button" onClick={() => setSozlashOchiq(true)} className="ml-1 text-brand hover:underline cursor-pointer">Shablon tanlash</button>
                                                </p>
                                            )}
                                        </div>

                                        {!shablon && !ochiq[g.key] ? (
                                            <button type="button" onClick={() => setOchiq(o => ({ ...o, [g.key]: true }))}
                                                className="w-full text-left px-3 py-2.5 text-[11px] font-bold text-matn-xira hover:text-brand cursor-pointer">
                                                Ro'yxatni ko'rsatish ({g.oquvchilar.length})
                                            </button>
                                        ) : (
                                        <div className="px-1.5 py-1.5">
                                            {g.oquvchilar.map(s => {
                                                const yol = aloqa(s, kanal, kimga);
                                                const ketgan = d.yuborilgan[s.id];
                                                const mumkin = !!shablon && !!yol;
                                                return (
                                                    <label key={s.id} className={`flex items-center gap-2.5 px-1.5 py-2 rounded-xl ${mumkin ? 'cursor-pointer hover:bg-ichki/60' : 'opacity-60'}`}>
                                                        <input type="checkbox" disabled={!mumkin} checked={!!tanlov[s.id]}
                                                            onChange={e => setTanlov(t => ({ ...t, [s.id]: e.target.checked }))}
                                                            className="w-4 h-4 shrink-0 rounded border-chiziq text-brand focus:ring-brand cursor-pointer disabled:cursor-not-allowed" />
                                                        <span className="flex-1 min-w-0 text-[12px] font-bold text-matn truncate">{displayName(s.name)}</span>
                                                        {ketgan && <span className="shrink-0 text-[10px] font-bold text-yaxshi">✓ {vaqt(ketgan)} da ketgan</span>}
                                                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${yol === 'tg' ? 'bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400' : yol === 'sms' ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-500'}`}>
                                                            {yol === 'tg' ? 'Telegram' : yol === 'sms' ? 'SMS' : kanal === 'TELEGRAM' ? 'Telegram yo\'q' : "aloqa yo'q"}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        )}
                                    </div>
                                );
                            })}

                            {belgilanmagan > 0 && (
                                <p className="text-[11px] font-medium text-matn-xira">{belgilanmagan} ta o'quvchiga bu kunga yo'qlama qo'yilmagan — ularga xabar ketmaydi.</p>
                            )}
                        </>
                    )}
                </div>

                {/* Pastki tugmalar */}
                <div className="flex gap-2 px-5 py-4 border-t border-chiziq-mayin/60">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-3 bg-ichki hover:bg-gray-100 dark:hover:bg-gray-800 text-matn-xira rounded-xl text-[12px] font-bold transition-all cursor-pointer">
                        Yopish
                    </button>
                    <button type="button" onClick={yuborish} disabled={!d || yuborilmoqda || tanlanganlar.length === 0}
                        className="flex-[2] py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[12px] font-black transition-all cursor-pointer flex items-center justify-center gap-2">
                        <Send size={14} />
                        {yuborilmoqda ? 'Yuborilmoqda…' : `Yuborish — ${tanlanganlar.length} ta`}
                    </button>
                </div>
            </div>
        </div>
    );
}
