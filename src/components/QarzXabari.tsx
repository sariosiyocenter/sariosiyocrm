import React, { useEffect, useMemo, useState } from 'react';
import {
    X, Search, Send, Loader2, RefreshCw, Settings2, Check, CheckCheck, Clock, XCircle, MinusCircle,
    ListChecks, Paperclip, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import { displayName } from '../lib/displayName';
import { fillTemplate } from '../../lib/xabarMatni.js';
import { eskizYuboradi, eskizRadEtdi, eskizHolatMatni, smsMatni, smsSoni, raqamYashir, KIMGA_NOMI } from '../../lib/tolovXabari.js';
import { telegramMatni, oylarMatni, sanaKor, som, HOLAT_NOMI } from '../../lib/qarzXabari.js';

/**
 * Qarz eslatmasi (services/qarzXabari.js, lib/qarzXabari.js).
 *
 *  - QarzXabariSozlama — Xabarlar → Avtomatik: "Qarzdorlar ro'yxati" tugmasi,
 *    ota-onalar javobi ("✅ To'laganman"), avtomatik jadval va uning sozlamasi,
 *    namuna, oxirgi eslatmalar holati bilan.
 *  - QarzdorlarModal — tekshirib yuborish: har o'quvchi kurslar bo'yicha
 *    qarzi, oxirgi qayd etilgan to'lovi, shu oydagi eslatmalari bilan.
 *    To'lagan, lekin CRM ga kiritilmaganlar belgidan olinadi (egasi: "может
 *    быть, они на самом деле уже платили, но мы не написали").
 *    Moliya → Oylik nazorat ham shu oynani ochadi.
 */

type Kanal = 'SMS' | 'BOTH' | 'TELEGRAM';
interface Sozlama {
    yoqilgan: boolean; shablonId: number | null; kanal: Kanal; kimga: string;
    kun: number; soat: string; takror: number; maks: number; minQarz: number; aloqa: string;
}
interface Shablon { id: number; name: string; body: string; eskizStatus?: string | null }
interface Kurs { groupId: number; nom: string; qarz: number; oylar: string[] }
interface Qarzdor {
    id: number; ism: string; status: string; jami: number; kurslar: Kurs[]; eski: number; avans: number;
    oxirgiTolov: { sana: string; summa: number } | null; yaqindaTolagan: boolean;
    eslatma: { soni: number; oxirgi: { sana: string; holat: string; kanal: string | null } | null };
    javob: { id: number; matn: string | null; rasm: boolean; sana: string } | null;
    qabul: { kimga: string; tg: boolean; tel: boolean }[];
    schoolId: number; filial: string;
}
interface Eslatma {
    id: number; studentId: number; ism: string; manba: string; holat: string; sabab: string | null; kanal: string | null;
    summa: number | null; raqamlar: { kimga: string; kanal: string; manzil: string; holat: string; xato?: string | null }[];
    yuboruvchi: string | null; createdAt: string; yuborilganAt: string | null; yetkazilganAt: string | null;
}
interface Javob {
    id: number; studentId: number; ism: string; hozirgiQarz: number; kimdan: string | null; matn: string | null;
    rasm: boolean; qarz: number | null; holat: string; natija: string | null; izoh: string | null;
    halQildi: string | null; createdAt: string; halAt: string | null;
}
interface KartaJavobi {
    sozlama: Sozlama; saqlangan: boolean; shablonlar: Shablon[];
    statistika: Record<string, number>; royxat: Eslatma[]; javoblar: Javob[];
}

const KANAL_NOMI: Record<Kanal, string> = {
    BOTH: "Telegram, bo'lmasa SMS",
    SMS: 'Faqat SMS',
    TELEGRAM: 'Faqat Telegram',
};
const KIMGA = [
    { v: 'FATHER', nom: 'Otasi' },
    { v: 'MOTHER', nom: 'Onasi' },
    { v: 'STUDENT', nom: "O'quvchi" },
];

// Kartadagi namuna — ikki kursli o'quvchi (egasi: "несколько ставок и несколько курсов").
const NAMUNA = {
    ism: 'Alimov Jasur',
    tafsil: {
        jami: 800000,
        kurslar: [
            { groupId: 1, nom: 'Matematika-4', qarz: 500000, oylar: ['2026-09'] },
            { groupId: 2, nom: 'Fizika-1', qarz: 300000, oylar: ['2026-09'] },
        ],
        eski: 0, avans: 0,
    },
    oxirgiTolov: { sana: '2026-08-05', summa: 800000 },
};

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const soat = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const bugun = new Date().toDateString() === d.toDateString();
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return bugun ? hm : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`;
};
const kun = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
};

async function soro<T = any>(url: string, method = 'GET', body?: unknown): Promise<T> {
    const r = await fetch(url, {
        method,
        headers: { ...auth(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "So'rov bajarilmadi");
    return j as T;
}

function holatKorinishi(holat: string) {
    switch (holat) {
        case 'yetkazildi': return { Icon: CheckCheck, rang: 'text-yaxshi' };
        case 'yuborildi': return { Icon: Check, rang: 'text-yaxshi' };
        case 'kutmoqda':
        case 'yuborilmoqda': return { Icon: Clock, rang: 'text-ogoh' };
        case 'bekor': return { Icon: MinusCircle, rang: 'text-matn-xira' };
        default: return { Icon: XCircle, rang: 'text-xato' };
    }
}

/** Telegram namunasi — faqat statik namuna ma'lumoti bilan (telegramMatni o'zi ekranlaydi). */
function TelegramNamuna({ html }: { html: string }) {
    return (
        <div className="px-3 py-2.5 rounded-xl bg-ichki border border-chiziq text-[12px] font-medium text-matn leading-relaxed whitespace-pre-line"
            dangerouslySetInnerHTML={{ __html: html }} />
    );
}

// ---------------------------------------------------------------------------
// Karta (Xabarlar → Avtomatik)
// ---------------------------------------------------------------------------

export function QarzXabariSozlama({ schoolId }: { schoolId: number }) {
    const { ozgartira, showNotification, settings } = useCRM();
    const confirm = useConfirm();
    const tahrir = ozgartira('xabarlar.avto');
    const yuborishMumkin = ozgartira('moliya.oylik') || ozgartira('xabarlar.yuborish');
    const yopishMumkin = ozgartira('moliya.oylik') || ozgartira('oquvchilar.tolov') || ozgartira('xabarlar.avto');
    const [d, setD] = useState<KartaJavobi | null>(null);
    const [xato, setXato] = useState('');
    const [band, setBand] = useState('');
    const [q, setQ] = useState<Sozlama | null>(null);     // sozlamalar qoralamasi
    const [sozlashOchiq, setSozlashOchiq] = useState(false);
    const [royxatOchiq, setRoyxatOchiq] = useState(false);
    const [hammasi, setHammasi] = useState(false);
    const [sinovTel, setSinovTel] = useState('');

    const yukla = async (yangila = false) => {
        try {
            const p = new URLSearchParams({ schoolId: String(schoolId) });
            if (yangila) p.set('yangila', '1');
            const j = await soro<KartaJavobi>(`/api/qarz-xabari?${p}`);
            setD(j);
            setQ(j.sozlama);
            setXato('');
        } catch (e: any) {
            setXato(e.message);
        }
    };
    useEffect(() => { if (schoolId !== undefined) yukla(); }, [schoolId]);

    const saqla = async (yangi: Sozlama, xabar = "Qarz eslatmasi sozlamasi saqlandi") => {
        if (!d) return;
        setBand('saqla');
        try {
            const j = await soro<{ sozlama: Sozlama }>('/api/qarz-xabari', 'PUT', { schoolId, sozlama: yangi });
            setD({ ...d, sozlama: j.sozlama, saqlangan: true });
            setQ(j.sozlama);
            showNotification(xabar, 'success');
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setBand('');
        }
    };

    const avtoniAlmashtir = async () => {
        if (!d) return;
        const s = d.sozlama;
        if (!s.yoqilgan) {
            const ok = await confirm({
                title: 'Avtomatik eslatma yoqilsinmi?',
                message: `Har oyning ${s.kun}-kunidan boshlab soat ${s.soat} da qarzi ${som(s.minQarz)} so'mdan ko'p o'quvchilarning ota-onasiga eslatma o'zi ketadi${s.takror ? `, keyin har ${s.takror} kunda` : ''} (oyiga ko'pi bilan ${s.maks} marta). CRM ga kiritilmagan to'lovlar bo'lsa, to'lagan ota-onaga ham ketadi — avval «Qarzdorlar ro'yxati»ni tekshirib chiqing.`,
                confirmLabel: 'Ha, yoqilsin',
                danger: false,
            });
            if (!ok) return;
        }
        await saqla({ ...s, yoqilgan: !s.yoqilgan }, s.yoqilgan ? "Avtomatik qarz eslatmasi o'chirildi" : 'Avtomatik qarz eslatmasi yoqildi');
    };

    const qayta = async (e: Eslatma) => {
        setBand(`q-${e.id}`);
        try {
            const r = await soro<{ holat: string; sabab?: string }>(`/api/qarz-xabari/${e.id}/qayta`, 'POST');
            const ok = ['yuborildi', 'yetkazildi'].includes(r.holat);
            showNotification(ok ? 'Eslatma yuborildi' : `Ketmadi: ${r.sabab || r.holat}`, ok ? 'success' : 'error');
            await yukla();
        } catch (err: any) {
            showNotification(err.message, 'error');
        } finally {
            setBand('');
        }
    };

    const sinov = async () => {
        setBand('sinov');
        try {
            await soro('/api/qarz-xabari/sinov', 'POST', { schoolId, telefon: sinovTel });
            showNotification(`Sinov SMS yuborildi: ${sinovTel}`, 'success');
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setBand('');
        }
    };

    const shablon = d && q ? d.shablonlar.find(t => t.id === q.shablonId) || null : null;
    const smsNamuna = useMemo(() => shablon
        ? smsMatni(fillTemplate(shablon.body, { name: NAMUNA.ism, balance: -NAMUNA.tafsil.jami, lastPaymentAmount: NAMUNA.oxirgiTolov.summa }, [], { orgName: settings?.orgName }))
        : '', [shablon, settings?.orgName]);
    const tgNamuna = useMemo(() => telegramMatni({
        ism: NAMUNA.ism, kimga: 'FATHER', tafsil: NAMUNA.tafsil, oxirgiTolov: NAMUNA.oxirgiTolov,
        aloqa: q?.aloqa || '', markaz: settings?.orgName || '',
    }), [q?.aloqa, settings?.orgName]);

    if (xato) return <p className="text-[11px] font-bold text-xato">{xato}</p>;
    if (!d || !q) return <div className="bg-sirt rounded-2xl border border-chiziq p-4 text-[11px] font-bold text-matn-xira">Qarz eslatmasi yuklanmoqda…</div>;

    const s = d.sozlama;
    const ozgargan = JSON.stringify(q) !== JSON.stringify(s);
    const kimga = q.kimga.split(',');
    const smsKerak = q.kanal !== 'TELEGRAM';
    const soni = smsSoni(smsNamuna);
    const st = d.statistika || {};
    const yetdi = (st.yetkazildi || 0) + (st.yuborildi || 0);
    const navbatda = (st.kutmoqda || 0) + (st.yuborilmoqda || 0);
    const ketmadi = (st.xato || 0) + (st.yetkazilmadi || 0);
    const royxat = hammasi ? d.royxat : d.royxat.slice(0, 6);
    const ochiqJavoblar = d.javoblar.filter(j => j.holat === 'ochiq');
    const aloqaSmsda = !!shablon && !!q.aloqa && shablon.body.replace(/\D/g, '').includes(q.aloqa.replace(/\D/g, '').slice(-9));
    const inp = 'w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[12px] font-bold text-matn outline-none focus:border-brand disabled:opacity-80';
    const lbl = 'block text-[11px] font-bold text-matn-xira mb-1';

    return (
        <div className="bg-sirt rounded-2xl border border-chiziq p-4 space-y-4">
            {/* Sarlavha */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-64">
                    <h3 className="text-xs font-black text-matn">💸 Qarzdorlik eslatmasi</h3>
                    <p className="text-[11px] font-medium text-matn-xira mt-0.5">
                        Qarzdor o'quvchining ota-onasiga: har bir kurs bo'yicha qarzi va oxirgi qayd etilgan to'lovi. Telegram'da «Payme» va «✅ To'laganman» tugmalari bor, Telegrami yo'qlarga — qisqa SMS.
                    </p>
                </div>
                {yuborishMumkin && (
                    <button type="button" onClick={() => setRoyxatOchiq(true)}
                        className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-[12px] font-black hover:opacity-90 cursor-pointer">
                        <ListChecks size={15} /> Qarzdorlar ro'yxati
                    </button>
                )}
            </div>

            {/* Ota-onalar javobi */}
            {ochiqJavoblar.length > 0 && (
                <JavoblarBolimi javoblar={ochiqJavoblar} yopa={yopishMumkin} onYopildi={() => yukla()} />
            )}

            {/* Avtomatik jadval */}
            <div className="rounded-xl border border-chiziq p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-[12px] font-black text-matn">Avtomatik yuborish</p>
                        <p className="text-[11px] font-medium text-matn-xira">
                            Har oyning {s.kun}-kunidan, soat {s.soat} da{s.takror ? ` · keyin har ${s.takror} kunda` : ''} · oyiga ko'pi bilan {s.maks} marta · qarz {som(s.minQarz)} so'mdan ko'p bo'lsa
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {tahrir && (
                            <button type="button" onClick={() => setSozlashOchiq(v => !v)} aria-expanded={sozlashOchiq} aria-label="Qarz eslatmasi sozlamalari"
                                className={`h-9 px-3 flex items-center gap-1.5 rounded-xl text-[11px] font-bold border cursor-pointer ${sozlashOchiq ? 'bg-ichki border-brand text-brand' : 'border-chiziq text-matn-2 hover:border-brand'}`}>
                                <Settings2 size={13} /> Sozlamalar
                            </button>
                        )}
                        <button type="button" disabled={!tahrir || !!band} onClick={avtoniAlmashtir} aria-pressed={s.yoqilgan}
                            className={`h-9 flex items-center gap-2 px-3 rounded-xl text-[11px] font-black border transition-colors cursor-pointer disabled:cursor-default ${s.yoqilgan
                                ? 'bg-brand border-brand text-white' : 'bg-ichki border-chiziq text-matn-xira'}`}>
                            <span className={`w-2 h-2 rounded-full ${s.yoqilgan ? 'bg-white' : 'bg-matn-xira'}`} />
                            {s.yoqilgan ? 'Yoqilgan' : "O'chirilgan"}
                        </button>
                    </div>
                </div>
                {!s.yoqilgan && (
                    <p className="text-[11px] font-bold text-matn-xira">O'chiq turganda eslatma faqat «Qarzdorlar ro'yxati»dan tekshirib yuborilganda ketadi.</p>
                )}
                <p className="text-[10px] font-medium text-matn-xira">
                    Kechasi (21:30–08:00) yuborilmaydi. Oxirgi 3 kunda to'lov qilganlarga va «To'laganman» deganlarga (xodim tekshirmaguncha) avtomatik eslatma ketmaydi. Qarz yuborish paytida qayta hisoblanadi — to'lov kiritilgan bo'lsa, eslatma bekor bo'ladi.
                </p>
            </div>

            {/* Sozlamalar */}
            {sozlashOchiq && tahrir && (
                <div className="rounded-xl border border-chiziq bg-ichki/40 p-3 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <label className="block"><span className={lbl}>Oyning kuni</span>
                            <input type="number" min={1} max={28} value={q.kun} onChange={e => setQ({ ...q, kun: Number(e.target.value) })} className={inp} /></label>
                        <label className="block"><span className={lbl}>Soat</span>
                            <input type="time" min="08:00" max="21:00" value={q.soat} onChange={e => setQ({ ...q, soat: e.target.value })} className={inp} /></label>
                        <label className="block"><span className={lbl}>Keyin har (kun)</span>
                            <input type="number" min={0} max={31} value={q.takror} onChange={e => setQ({ ...q, takror: Number(e.target.value) })} className={inp} /></label>
                        <label className="block"><span className={lbl}>Oyiga ko'pi bilan</span>
                            <input type="number" min={1} max={10} value={q.maks} onChange={e => setQ({ ...q, maks: Number(e.target.value) })} className={inp} /></label>
                        <label className="block col-span-2 sm:col-span-1"><span className={lbl}>Qarz kamida (so'm)</span>
                            <input type="number" min={0} step={10000} value={q.minQarz} onChange={e => setQ({ ...q, minQarz: Number(e.target.value) })} className={inp} /></label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <span className={lbl}>Kimga</span>
                            <div className="flex flex-wrap gap-1.5">
                                {KIMGA.map(k => {
                                    const on = kimga.includes(k.v);
                                    return (
                                        <button key={k.v} type="button" disabled={on && kimga.length === 1}
                                            onClick={() => setQ({ ...q, kimga: (on ? kimga.filter(x => x !== k.v) : [...kimga, k.v]).join(',') })}
                                            className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer disabled:cursor-default ${on ? 'bg-brand border-brand text-white' : 'bg-sirt border-chiziq text-matn-xira'}`}>
                                            {on && <Check size={11} className="inline -mt-0.5 mr-1" />}{k.nom}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] font-medium text-matn-xira mt-1">Raqami yo'q bo'lsa — o'quvchining o'z raqamiga.</p>
                        </div>
                        <label className="block"><span className={lbl}>Kanal</span>
                            <select value={q.kanal} onChange={e => setQ({ ...q, kanal: e.target.value as Kanal })} className={`${inp} cursor-pointer`}>
                                {(Object.keys(KANAL_NOMI) as Kanal[]).map(k => <option key={k} value={k}>{KANAL_NOMI[k]}</option>)}
                            </select>
                            <span className="block text-[10px] font-medium text-matn-xira mt-1">Telegram bepul va to'liq tafsilot bilan; SMS pullik va qisqa.</span>
                        </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block"><span className={lbl}>SMS matni — «Shablonlar» bo'limidagi shablon</span>
                            <select value={q.shablonId || ''} onChange={e => setQ({ ...q, shablonId: Number(e.target.value) || null })} className={`${inp} cursor-pointer`}>
                                <option value="">— tanlanmagan —</option>
                                {d.shablonlar.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </label>
                        <label className="block"><span className={lbl}>Aloqa raqami (Telegram xabarida)</span>
                            <input value={q.aloqa} onChange={e => setQ({ ...q, aloqa: e.target.value })} inputMode="tel" placeholder="+998 91 511 55 32" className={inp} />
                        </label>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {ozgargan && <button type="button" onClick={() => setQ(s)} className="px-3 py-2 rounded-xl text-[11px] font-bold text-matn-xira hover:bg-ichki cursor-pointer">Bekor qilish</button>}
                        <button type="button" disabled={!ozgargan || !!band} onClick={() => saqla(q)}
                            className="px-4 py-2 rounded-xl bg-brand text-white text-[11px] font-black disabled:opacity-40 cursor-pointer disabled:cursor-default flex items-center gap-1.5">
                            {band === 'saqla' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Saqlash
                        </button>
                    </div>
                </div>
            )}

            {/* SMS matni holati */}
            {smsKerak && (
                shablon ? (
                    <p className={`text-[11px] font-bold ${eskizYuboradi(shablon.eskizStatus) ? 'text-yaxshi' : eskizRadEtdi(shablon.eskizStatus) ? 'text-xato' : 'text-ogoh'}`}>
                        SMS matni: «{shablon.name}» — {eskizYuboradi(shablon.eskizStatus) ? '✓ ' : eskizRadEtdi(shablon.eskizStatus) ? '✗ ' : '⏳ '}{eskizHolatMatni(shablon.eskizStatus)}
                        {!eskizYuboradi(shablon.eskizStatus) && !eskizRadEtdi(shablon.eskizStatus) && " — SMS'lar navbatda turadi, tasdiqlangach o'zi ketadi (3 kun ichidagilar). Telegram'dagilarga darhol ketadi."}
                        {q.aloqa && !aloqaSmsda && <span className="text-ogoh"> · SMS matnida {q.aloqa} raqami yo'q</span>}
                    </p>
                ) : (
                    <p className="text-[11px] font-bold text-ogoh">SMS matni tanlanmagan — eslatma faqat Telegram'dagi ota-onalarga ketadi. {tahrir ? 'Sozlamalar → «SMS matni».' : ''}</p>
                )
            )}

            {/* Namuna */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {q.kanal !== 'SMS' && (
                    <div className="space-y-1.5">
                        <span className="block text-[11px] font-bold text-matn-xira">Namuna — Telegram (ikki kursli o'quvchi)</span>
                        <TelegramNamuna html={tgNamuna} />
                        <div className="flex flex-wrap gap-1.5">
                            <span className="px-2.5 py-1.5 rounded-lg border border-chiziq text-[10px] font-bold text-matn-2">💳 Payme orqali to'lash</span>
                            <span className="px-2.5 py-1.5 rounded-lg border border-chiziq text-[10px] font-bold text-matn-2">✅ To'laganman</span>
                        </div>
                    </div>
                )}
                {smsKerak && smsNamuna && (
                    <div className="space-y-1.5">
                        <span className="block text-[11px] font-bold text-matn-xira">
                            Namuna — SMS · <span className={soni.soni > 2 ? 'text-ogoh' : ''}>{soni.soni} ta SMS</span> · {soni.belgi} belgi
                        </span>
                        <p className="px-3 py-2.5 rounded-xl bg-ichki border border-chiziq text-[12px] font-medium text-matn leading-relaxed">{smsNamuna}</p>
                        {yuborishMumkin && shablon && eskizYuboradi(shablon.eskizStatus) && (
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
            </div>

            {/* Oxirgi eslatmalar */}
            <div className="pt-3 border-t border-chiziq-mayin space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-matn-2">
                        Bu oy: <span className="text-yaxshi">{yetdi} yuborildi</span>
                        {navbatda > 0 && <> · <span className="text-ogoh">{navbatda} navbatda</span></>}
                        {ketmadi > 0 && <> · <span className="text-xato">{ketmadi} ketmadi</span></>}
                        {(st.bekor || 0) > 0 && <span className="text-matn-xira"> · {st.bekor} bekor</span>}
                    </p>
                    <button type="button" onClick={async () => { setBand('yangila'); await yukla(true); setBand(''); }} disabled={!!band}
                        className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline cursor-pointer disabled:opacity-50">
                        <RefreshCw size={11} className={band === 'yangila' ? 'animate-spin' : ''} /> Yangilash
                    </button>
                </div>
                {d.royxat.length === 0 ? (
                    <p className="text-[11px] font-medium text-matn-xira">Hali qarz eslatmasi yuborilmagan.</p>
                ) : (
                    <div className="divide-y divide-chiziq-mayin rounded-xl border border-chiziq overflow-hidden">
                        {royxat.map(e => {
                            const { Icon, rang } = holatKorinishi(e.holat);
                            const kimgaMatn = [...new Set(e.raqamlar.filter(x => x.holat !== 'xato').map(x => `${KIMGA_NOMI[x.kimga as keyof typeof KIMGA_NOMI] || x.kimga} (${x.kanal === 'TELEGRAM' ? 'Telegram' : 'SMS'})`))].join(', ');
                            const qaytaMumkin = yuborishMumkin && ['xato', 'yetkazilmadi', 'kutmoqda'].includes(e.holat);
                            return (
                                <div key={e.id} className="px-3 py-2.5 flex items-start gap-2.5">
                                    <Icon size={15} className={`shrink-0 mt-0.5 ${rang}`} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[12px] font-bold text-matn leading-snug break-words">
                                            <a href={`/students/${e.studentId}`} target="_blank" rel="noreferrer" className="hover:text-brand">{displayName(e.ism)}</a>
                                            {e.summa !== null && <span className="text-matn-xira font-medium"> · {som(e.summa)} so'm</span>}
                                            <span className="text-matn-xira font-medium"> · {e.manba === 'avto' ? 'avtomatik' : e.yuboruvchi || "qo'lda"}</span>
                                        </p>
                                        <p className={`text-[11px] font-medium ${['xato', 'yetkazilmadi', 'kutmoqda', 'yuborilmoqda'].includes(e.holat) ? rang : 'text-matn-xira'}`}>
                                            <span className="font-bold">{HOLAT_NOMI[e.holat as keyof typeof HOLAT_NOMI] || e.holat}</span>
                                            {kimgaMatn && ['yuborildi', 'yetkazildi', 'yetkazilmadi'].includes(e.holat) && <> · {kimgaMatn}</>}
                                            {e.sabab && <> · {e.sabab}</>}
                                        </p>
                                        {e.raqamlar.some(x => x.kanal === 'SMS') && ['yuborildi', 'yetkazildi', 'yetkazilmadi'].includes(e.holat) && (
                                            <p className="text-[10px] font-medium text-matn-xira truncate">
                                                {e.raqamlar.filter(x => x.kanal === 'SMS').map(x => `${raqamYashir(x.manzil)}${x.holat === 'yetkazildi' ? ' ✓✓' : x.holat === 'yetkazilmadi' ? ' ✗' : ''}`).join(' · ')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="shrink-0 flex flex-col items-end gap-1">
                                        <span className="text-[10px] font-bold text-matn-xira tabular-nums">{soat(e.yetkazilganAt || e.yuborilganAt || e.createdAt)}</span>
                                        {qaytaMumkin && (
                                            <button type="button" onClick={() => qayta(e)} disabled={!!band}
                                                className="px-2 py-1 rounded-lg border border-chiziq text-[10px] font-bold text-matn-2 hover:border-brand hover:text-brand disabled:opacity-50 cursor-pointer">
                                                {band === `q-${e.id}` ? <Loader2 size={10} className="animate-spin" /> : 'Qayta yuborish'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {d.royxat.length > 6 && (
                    <button type="button" onClick={() => setHammasi(v => !v)} className="text-[11px] font-bold text-brand hover:underline cursor-pointer">
                        {hammasi ? 'Kamroq' : `Yana ${d.royxat.length - 6} ta`}
                    </button>
                )}
            </div>
            {!tahrir && <p className="text-[10px] font-bold text-matn-xira">Sozlamani «Avtomatik qoidalar» ruxsati bor xodim o'zgartiradi.</p>}

            {royxatOchiq && <QarzdorlarModal schoolId={schoolId} onClose={() => { setRoyxatOchiq(false); yukla(); }} />}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Bosh sahifa: tekshirilmagan "to'laganman" javoblari (bo'sh bo'lsa chizilmaydi)
// ---------------------------------------------------------------------------

export function QarzJavobBanner() {
    const { kora, selectedSchoolId } = useCRM();
    const navigate = useNavigate();
    const korinadi = kora('moliya.oylik') || kora('oquvchilar.tolov') || kora('xabarlar.avto');
    const [soni, setSoni] = useState(0);
    useEffect(() => {
        if (!korinadi) return;
        let tirik = true;
        fetch(`/api/qarz-javob/soni?schoolId=${selectedSchoolId || 0}`, { headers: auth() })
            .then(r => (r.ok ? r.json() : { ochiq: 0 }))
            .then(j => { if (tirik) setSoni(Number(j.ochiq) || 0); })
            .catch(() => {});
        return () => { tirik = false; };
    }, [korinadi, selectedSchoolId]);
    if (!korinadi || !soni) return null;
    return (
        <button type="button" onClick={() => navigate('/messaging?tab=auto')}
            className="w-full text-left flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 cursor-pointer hover:border-amber-400">
            <span className="flex items-center gap-2 text-[12px] font-black text-ogoh">
                <AlertTriangle size={15} /> {soni} ta ota-ona qarz eslatmasiga «to'laganman» dedi — tekshiring
            </span>
            <span className="text-[11px] font-bold text-brand">Xabarlar → Avtomatik →</span>
        </button>
    );
}

// ---------------------------------------------------------------------------
// Ota-onalar javobi ("✅ To'laganman")
// ---------------------------------------------------------------------------

function JavobRasmi({ id }: { id: number }) {
    const [url, setUrl] = useState<string | null>(null);
    const [tur, setTur] = useState('');
    const [holat, setHolat] = useState<'yoq' | 'yuklanmoqda' | 'xato'>('yoq');
    useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
    const och = async () => {
        setHolat('yuklanmoqda');
        try {
            const r = await fetch(`/api/qarz-javob/${id}/rasm`, { headers: auth() });
            if (!r.ok) throw new Error();
            const b = await r.blob();
            setTur(b.type);
            setUrl(URL.createObjectURL(b));
            setHolat('yoq');
        } catch {
            setHolat('xato');
        }
    };
    if (url) {
        return tur.startsWith('image/')
            ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Chek" className="mt-1.5 max-h-56 rounded-lg border border-chiziq" /></a>
            : <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-brand hover:underline"><ExternalLink size={11} /> Chek faylini ochish</a>;
    }
    return (
        <button type="button" onClick={och} disabled={holat === 'yuklanmoqda'}
            className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-brand hover:underline cursor-pointer disabled:opacity-50">
            {holat === 'yuklanmoqda' ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />}
            {holat === 'xato' ? "Chekni olib bo'lmadi — qayta urinish" : "Chekni ko'rish"}
        </button>
    );
}

function JavoblarBolimi({ javoblar, yopa, onYopildi }: { javoblar: Javob[]; yopa: boolean; onYopildi: () => void }) {
    const { showNotification } = useCRM();
    const [ochiq, setOchiq] = useState<{ id: number; natija: 'kiritildi' | 'togri' } | null>(null);
    const [izoh, setIzoh] = useState('');
    const [band, setBand] = useState(false);

    const yop = async () => {
        if (!ochiq) return;
        setBand(true);
        try {
            const r = await soro<{ xabar: string | null }>(`/api/qarz-javob/${ochiq.id}/yop`, 'POST', { natija: ochiq.natija, izoh });
            showNotification(r.xabar === 'yuborildi' ? "Yopildi — ota-onaga Telegram'da javob ketdi" : `Yopildi${r.xabar ? ` (ota-onaga ketmadi: ${r.xabar})` : ''}`, 'success');
            setOchiq(null);
            setIzoh('');
            onYopildi();
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setBand(false);
        }
    };

    return (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 p-3 space-y-2">
            <p className="text-[12px] font-black text-ogoh flex items-center gap-1.5">
                <AlertTriangle size={14} /> Ota-onalar «to'laganman» dedi — {javoblar.length} ta tekshirilmagan
            </p>
            <p className="text-[10px] font-medium text-matn-xira">
                Tekshiring: to'lov haqiqatan bo'lsa — uni o'quvchi kartasida kiriting va «To'lov kiritildi»ni bosing. Tekshirilguncha shu o'quvchiga avtomatik eslatma ketmaydi. Natija ota-onaga Telegram'da boradi.
            </p>
            <div className="divide-y divide-chiziq-mayin rounded-xl border border-chiziq bg-sirt overflow-hidden">
                {javoblar.map(j => (
                    <div key={j.id} className="px-3 py-2.5 space-y-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-[12px] font-bold text-matn min-w-0 break-words">
                                <a href={`/students/${j.studentId}`} target="_blank" rel="noreferrer" className="hover:text-brand">{displayName(j.ism)}</a>
                                <span className="text-matn-xira font-medium">{j.kimdan ? ` · ${KIMGA_NOMI[j.kimdan as keyof typeof KIMGA_NOMI] || ''}` : ''} · {soat(j.createdAt)} · CRM dagi qarz: {som(j.hozirgiQarz)} so'm</span>
                            </p>
                        </div>
                        {j.matn && <p className="text-[12px] font-medium text-matn whitespace-pre-line break-words">«{j.matn}»</p>}
                        {j.rasm && <JavobRasmi id={j.id} />}
                        {yopa && (ochiq?.id === j.id ? (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <input autoFocus value={izoh} onChange={e => setIzoh(e.target.value)} maxLength={500}
                                    placeholder={ochiq.natija === 'kiritildi' ? "Izoh (ixtiyoriy): masalan, 5-sentabr kassada topildi" : "Ota-onaga izoh: masalan, bu sanada to'lov kelmagan"}
                                    className="flex-1 min-w-[200px] px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[12px] font-medium text-matn outline-none focus:border-brand" />
                                <button type="button" onClick={yop} disabled={band}
                                    className={`px-3 py-2 rounded-xl text-[11px] font-black text-white cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${ochiq.natija === 'kiritildi' ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                                    {band ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                    {ochiq.natija === 'kiritildi' ? "To'lov kiritildi" : "Qarz to'g'ri"} — yopish
                                </button>
                                <button type="button" onClick={() => { setOchiq(null); setIzoh(''); }} className="px-2 py-2 text-[11px] font-bold text-matn-xira hover:text-matn cursor-pointer">Bekor</button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button type="button" onClick={() => { setOchiq({ id: j.id, natija: 'kiritildi' }); setIzoh(''); }}
                                    className="px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold text-yaxshi hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer">
                                    ✓ To'lov kiritildi
                                </button>
                                <button type="button" onClick={() => { setOchiq({ id: j.id, natija: 'togri' }); setIzoh(''); }}
                                    className="px-3 py-1.5 rounded-lg border border-chiziq text-[11px] font-bold text-matn-2 hover:border-brand cursor-pointer">
                                    Qarz to'g'ri
                                </button>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Qarzdorlar ro'yxati — tekshirib yuborish
// ---------------------------------------------------------------------------

interface RoyxatJavobi { sozlama: Sozlama | null; shablonlar: Shablon[]; royxat: Qarzdor[]; filiallar: number }
interface Jarayon { jami: number; holatlar: Record<string, number>; qoldi: number; tugadi: boolean; takror: number }

/**
 * Sukut bo'yicha tanlanmaydi: "to'laganman" degan, yaqinda to'lagan, yaqinda
 * eslatma olgan yoki hech qanday aloqasi (raqam ham, Telegram ham) yo'q.
 */
const sukutdaTanlanmaydi = (q: Qarzdor) => !!q.javob || q.yaqindaTolagan
    || (!!q.eslatma.oxirgi && Date.now() - new Date(q.eslatma.oxirgi.sana).getTime() < 3 * 864e5)
    || !q.qabul.some(x => x.tg || x.tel);

export function QarzdorlarModal({ schoolId, onClose }: { schoolId: number; onClose: () => void }) {
    const { showNotification } = useCRM();
    const confirm = useConfirm();
    const [d, setD] = useState<RoyxatJavobi | null>(null);
    const [xato, setXato] = useState('');
    const [hammasi, setHammasi] = useState(false);     // Passiv/Ketgan ham
    const [qidir, setQidir] = useState('');
    const [kursId, setKursId] = useState(0);
    const [minQarz, setMinQarz] = useState('');
    const [faqatOlmagan, setFaqatOlmagan] = useState(false);
    const [tanlangan, setTanlangan] = useState<Set<number>>(new Set());
    const [jarayon, setJarayon] = useState<Jarayon | null>(null);

    const yukla = async () => {
        try {
            setD(null);
            const p = new URLSearchParams({ schoolId: String(schoolId || 0) });
            if (hammasi) p.set('hammasi', '1');
            const j = await soro<RoyxatJavobi>(`/api/qarz-xabari/qarzdorlar?${p}`);
            setD(j);
            setTanlangan(new Set(j.royxat.filter(q => !sukutdaTanlanmaydi(q)).map(q => q.id)));
            setXato('');
        } catch (e: any) {
            setXato(e.message);
        }
    };
    useEffect(() => { yukla(); }, [schoolId, hammasi]);

    const kurslar = useMemo(() => {
        const m = new Map<number, string>();
        for (const q of d?.royxat || []) for (const k of q.kurslar) m.set(k.groupId, k.nom);
        return [...m].sort((a, b) => a[1].localeCompare(b[1]));
    }, [d]);

    const korinadi = useMemo(() => {
        const s = qidir.trim().toLowerCase();
        const min = Number(minQarz) || 0;
        return (d?.royxat || []).filter(q =>
            (!s || q.ism.toLowerCase().includes(s))
            && (!kursId || q.kurslar.some(k => k.groupId === kursId))
            && q.jami >= min
            && (!faqatOlmagan || q.eslatma.soni === 0));
    }, [d, qidir, kursId, minQarz, faqatOlmagan]);

    const sozlama = d?.sozlama;
    const shablon = d && sozlama ? d.shablonlar.find(t => t.id === sozlama.shablonId) || null : null;
    // Yuboriladi — tanlangan VA hozir ko'rinib turganlar (filtr bilan yashiringan ketmaydi).
    const tanlanganlar = korinadi.filter(q => tanlangan.has(q.id));
    const hisob = useMemo(() => {
        let tg = 0, sms = 0, yetmaydi = 0, summa = 0;
        const kanal = sozlama?.kanal || 'BOTH';
        for (const q of tanlanganlar) {
            summa += q.jami;
            const tgBor = kanal !== 'SMS' && q.qabul.some(x => x.tg);
            const tellar = q.qabul.filter(x => x.tel).length;
            if (tgBor) tg++;
            if (kanal === 'SMS' || (kanal === 'BOTH' && !tgBor)) sms += tellar;
            if (!tgBor && (kanal === 'TELEGRAM' || !tellar)) yetmaydi++;
        }
        return { tg, sms, yetmaydi, summa };
    }, [tanlanganlar, sozlama?.kanal]);

    const hammasiTanlangan = korinadi.length > 0 && korinadi.every(q => tanlangan.has(q.id));
    const almashtir = (id: number) => setTanlangan(prev => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
    });
    const hammasiniAlmashtir = () => setTanlangan(prev => {
        const n = new Set(prev);
        if (hammasiTanlangan) korinadi.forEach(q => n.delete(q.id)); else korinadi.forEach(q => n.add(q.id));
        return n;
    });

    const yubor = async () => {
        const ids = tanlanganlar.map(q => q.id);
        if (!ids.length) return;
        const ok = await confirm({
            title: `${ids.length} ta o'quvchiga eslatma yuborilsinmi?`,
            message: `Jami qarz: ${som(hisob.summa)} so'm. Telegram: ${hisob.tg} ta, SMS: ~${hisob.sms} ta${hisob.yetmaydi ? `, ${hisob.yetmaydi} tasiga aloqa yo'q` : ''}. To'lagan, lekin CRM ga kiritilmaganlarni belgidan olib tashlaganingizga ishonch hosil qiling.`,
            confirmLabel: 'Ha, yuborilsin',
            danger: false,
        });
        if (!ok) return;
        setJarayon({ jami: ids.length, holatlar: {}, qoldi: ids.length, tugadi: false, takror: 0 });
        try {
            let r = await soro<{ idlar: number[]; takror: number; holatlar: Record<string, number>; qoldi: number }>('/api/qarz-xabari/yubor', 'POST', { studentIds: ids });
            const idlar = r.idlar;
            setJarayon({ jami: idlar.length, holatlar: r.holatlar || {}, qoldi: r.qoldi, tugadi: false, takror: r.takror });
            let aylana = 0;
            while (r.qoldi > 0 && aylana < 200) {
                aylana++;
                r = { ...r, ...(await soro<{ holatlar: Record<string, number>; qoldi: number }>('/api/qarz-xabari/navbat', 'POST', { idlar })) };
                setJarayon(j => j && { ...j, holatlar: r.holatlar || {}, qoldi: r.qoldi });
            }
            setJarayon(j => j && { ...j, tugadi: true });
        } catch (e: any) {
            showNotification(e.message, 'error');
            setJarayon(j => j && { ...j, tugadi: true });
        }
    };

    const h = jarayon?.holatlar || {};
    const ketdi = (h.yuborildi || 0) + (h.yetkazildi || 0);
    const navbatda = (h.kutmoqda || 0) + (h.yuborilmoqda || 0);
    const ketmadi = (h.xato || 0) + (h.yetkazilmadi || 0);

    return (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center-safe justify-center sm:p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => { if (!jarayon || jarayon.tugadi) onClose(); }} />
            <div className="relative bg-sirt w-full sm:max-w-3xl max-h-[92dvh] flex flex-col rounded-t-[1.75rem] sm:rounded-[1.75rem] shadow-2xl border border-chiziq">
                {/* Sarlavha */}
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-chiziq-mayin/60">
                    <div className="min-w-0">
                        <h3 className="text-sm font-black text-matn tracking-tight">Qarzdorlar ro'yxati</h3>
                        <p className="text-[11px] font-bold text-brand mt-0.5">
                            {d ? `${d.royxat.length} ta o'quvchi · jami ${som(d.royxat.reduce((a, q) => a + q.jami, 0))} so'm` : 'Yuklanmoqda…'}
                        </p>
                    </div>
                    <button aria-label="Yopish" disabled={!!jarayon && !jarayon.tugadi} onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer disabled:opacity-40"><X size={18} /></button>
                </div>

                {jarayon ? (
                    /* Yuborish jarayoni */
                    <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
                        <div className="flex items-center gap-3">
                            {jarayon.tugadi ? <CheckCheck size={22} className="text-yaxshi" /> : <Loader2 size={22} className="animate-spin text-brand" />}
                            <p className="text-[13px] font-black text-matn">
                                {jarayon.tugadi ? 'Tayyor' : `Yuborilmoqda… ${jarayon.jami - jarayon.qoldi} / ${jarayon.jami}`}
                            </p>
                        </div>
                        <div className="h-2 rounded-full bg-ichki overflow-hidden">
                            <div className="h-full bg-brand transition-all" style={{ width: `${jarayon.jami ? Math.round(((jarayon.jami - jarayon.qoldi) / jarayon.jami) * 100) : 100}%` }} />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                            <div className="rounded-xl border border-chiziq p-2"><p className="text-lg font-black text-yaxshi">{ketdi}</p><p className="text-[10px] font-bold text-matn-xira">yuborildi</p></div>
                            <div className="rounded-xl border border-chiziq p-2"><p className="text-lg font-black text-ogoh">{navbatda}</p><p className="text-[10px] font-bold text-matn-xira">navbatda</p></div>
                            <div className="rounded-xl border border-chiziq p-2"><p className="text-lg font-black text-xato">{ketmadi}</p><p className="text-[10px] font-bold text-matn-xira">ketmadi</p></div>
                            <div className="rounded-xl border border-chiziq p-2"><p className="text-lg font-black text-matn-xira">{h.bekor || 0}</p><p className="text-[10px] font-bold text-matn-xira">bekor (qarz yopilgan)</p></div>
                        </div>
                        {jarayon.takror > 0 && <p className="text-[11px] font-bold text-matn-xira">{jarayon.takror} ta o'quvchiga 10 daqiqa ichida yuborilgan — takrorlanmadi.</p>}
                        {jarayon.tugadi && navbatda > 0 && (
                            <p className="text-[11px] font-bold text-ogoh">Navbatdagilar o'zi yuboriladi (Eskiz tasdig'i yoki kechasi bo'lsa — ertalab). Holati: Xabarlar → Avtomatik → Qarzdorlik eslatmasi.</p>
                        )}
                        {jarayon.tugadi && ketmadi > 0 && (
                            <p className="text-[11px] font-bold text-xato">Ketmaganlarning sababi kartadagi ro'yxatda (masalan, telefon raqami yo'q).</p>
                        )}
                        {jarayon.tugadi && (
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => { setJarayon(null); yukla(); }} className="px-4 py-2 rounded-xl border border-chiziq text-[12px] font-bold text-matn-2 hover:border-brand cursor-pointer">Ro'yxatga qaytish</button>
                                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-brand text-white text-[12px] font-black cursor-pointer">Yopish</button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Filtrlar */}
                        <div className="px-5 pt-3 pb-2 space-y-2 border-b border-chiziq-mayin/60">
                            <div className="flex flex-wrap gap-2">
                                <div className="relative flex-1 min-w-[180px]">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
                                    <input value={qidir} onChange={e => setQidir(e.target.value)} placeholder="Ism bo'yicha qidirish"
                                        className="w-full pl-9 pr-3 py-2 bg-ichki border border-chiziq rounded-xl text-[12px] font-bold text-matn outline-none focus:border-brand" />
                                </div>
                                <select value={kursId} onChange={e => setKursId(Number(e.target.value))}
                                    className="px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[12px] font-bold text-matn outline-none focus:border-brand cursor-pointer max-w-[200px]">
                                    <option value={0}>Barcha kurslar</option>
                                    {kurslar.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
                                </select>
                                <input value={minQarz} onChange={e => setMinQarz(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Qarz kamida"
                                    className="w-32 px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[12px] font-bold text-matn outline-none focus:border-brand" />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-matn-2 cursor-pointer">
                                    <input type="checkbox" checked={faqatOlmagan} onChange={e => setFaqatOlmagan(e.target.checked)} className="accent-brand" /> Bu oy eslatma olmaganlar
                                </label>
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-matn-2 cursor-pointer">
                                    <input type="checkbox" checked={hammasi} onChange={e => setHammasi(e.target.checked)} className="accent-brand" /> Passiv va ketganlar ham
                                </label>
                            </div>
                            <p className="text-[11px] font-bold text-ogoh bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl px-3 py-2">
                                Qarz CRM dagi to'lovlardan hisoblanadi. To'lagan, lekin to'lovi kiritilmagan o'quvchini belgidan oling (yoki avval to'lovini kiriting). «To'laganman» deganlar, oxirgi 3 kunda to'laganlar yoki eslatma olganlar va aloqasi yo'qlar belgilanmagan.
                            </p>
                            {sozlama && sozlama.kanal !== 'TELEGRAM' && (!shablon || !eskizYuboradi(shablon.eskizStatus)) && (
                                <p className="text-[11px] font-bold text-ogoh">
                                    {!shablon ? "SMS matni tanlanmagan — faqat Telegram'dagilarga ketadi." : `SMS matni Eskiz tekshiruvida — SMS'lar navbatda turadi va tasdiqlangach o'zi ketadi; Telegram'dagilarga darhol.`}
                                </p>
                            )}
                        </div>

                        {/* Ro'yxat */}
                        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-2">
                            {xato && <p className="text-[11px] font-bold text-xato py-3">{xato}</p>}
                            {!d && !xato && <p className="text-[11px] font-bold text-matn-xira py-3 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Qarzlar hisoblanmoqda…</p>}
                            {d && korinadi.length === 0 && <p className="text-[11px] font-bold text-matn-xira py-3">Qarzdor topilmadi.</p>}
                            {d && korinadi.length > 0 && (
                                <label className="flex items-center gap-2 py-2 text-[11px] font-black text-matn-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={hammasiTanlangan} onChange={hammasiniAlmashtir} className="accent-brand w-4 h-4" />
                                    Hammasini tanlash ({korinadi.length})
                                </label>
                            )}
                            <div className="divide-y divide-chiziq-mayin">
                                {korinadi.map(q => {
                                    const on = tanlangan.has(q.id);
                                    const yetadi = q.qabul.filter(x => x.tg || x.tel);
                                    return (
                                        <label key={q.id} className={`flex items-start gap-3 py-2.5 cursor-pointer ${on ? '' : 'opacity-70'}`}>
                                            <input type="checkbox" checked={on} onChange={() => almashtir(q.id)} className="accent-brand w-4 h-4 mt-0.5 shrink-0" />
                                            <div className="min-w-0 flex-1 space-y-0.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <a href={`/students/${q.id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                                        className="text-[12px] font-black text-matn hover:text-brand break-words">{displayName(q.ism)}</a>
                                                    <span className="text-[12px] font-black text-xato tabular-nums shrink-0">{som(q.jami)}</span>
                                                </div>
                                                <p className="text-[11px] font-medium text-matn-2 break-words">
                                                    {[
                                                        ...q.kurslar.map(k => `${k.nom}${k.oylar.length ? ` (${oylarMatni(k.oylar)})` : ''}: ${som(k.qarz)}`),
                                                        ...(q.eski > 0 ? [`Oldingi qarz: ${som(q.eski)}`] : []),
                                                        ...(q.avans > 0 ? [`Balansda: −${som(q.avans)}`] : []),
                                                    ].join(' · ')}
                                                    {d && d.filiallar > 1 && q.filial ? <span className="text-matn-xira"> · {q.filial}</span> : null}
                                                    {q.status !== 'Faol' && <span className="text-matn-xira"> · {q.status}</span>}
                                                </p>
                                                <p className="text-[10px] font-bold text-matn-xira">
                                                    {q.oxirgiTolov ? `Oxirgi to'lov: ${sanaKor(q.oxirgiTolov.sana)} — ${som(q.oxirgiTolov.summa)}` : "To'lov qayd etilmagan"}
                                                    {' · '}{q.eslatma.soni ? `Eslatma: bu oy ${q.eslatma.soni} marta, oxirgisi ${kun(q.eslatma.oxirgi?.sana)}` : 'Bu oy eslatma olmagan'}
                                                    {' · '}{yetadi.length
                                                        ? yetadi.map(x => `${KIMGA_NOMI[x.kimga as keyof typeof KIMGA_NOMI]} ${x.tg && sozlama?.kanal !== 'SMS' ? 'TG' : 'SMS'}`).join(', ')
                                                        : <span className="text-xato">aloqa yo'q</span>}
                                                </p>
                                                {q.javob && (
                                                    <p className="text-[11px] font-bold text-ogoh break-words">⚠ Ota-ona «to'laganman» dedi ({kun(q.javob.sana)}){q.javob.matn ? `: «${q.javob.matn.slice(0, 120)}»` : ''}{q.javob.rasm ? ' · chek bor' : ''}</p>
                                                )}
                                                {!q.javob && q.yaqindaTolagan && <p className="text-[11px] font-bold text-ogoh">Oxirgi 3 kunda to'lov qilgan</p>}
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Pastki qism */}
                        <div className="px-5 py-3 border-t border-chiziq-mayin/60 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] font-bold text-matn-2">
                                Tanlangan: <span className="text-matn">{tanlanganlar.length} ta</span> · {som(hisob.summa)} so'm
                                <span className="text-matn-xira"> · Telegram {hisob.tg}, SMS ~{hisob.sms}{hisob.yetmaydi ? `, aloqasiz ${hisob.yetmaydi}` : ''}</span>
                            </p>
                            <button type="button" onClick={yubor} disabled={!tanlanganlar.length}
                                className="px-4 py-2.5 rounded-xl bg-brand text-white text-[12px] font-black disabled:opacity-40 cursor-pointer disabled:cursor-default flex items-center gap-1.5">
                                <Send size={13} /> Yuborish ({tanlanganlar.length})
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
