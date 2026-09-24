import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import {
    Bus, Search, Phone, Calendar, ChevronLeft, ChevronRight, ChevronDown,
    BarChart3, Download, CalendarRange, CheckCircle2, X, MapPin, Navigation,
    Users, Check, Loader2, Car, AlertTriangle, Send, Trash2, RotateCcw, Filter,
    UserCheck, Bot, ArrowRight,
} from 'lucide-react';
import { toDateStr, toTimeStr } from '../../lib/lessons.js';
import { reyalarniTuzish } from '../../lib/rejalash.js';
import { narxHisobla, uyMasofasi, tarifMatni, somMatni, rejaSummasi } from '../../lib/transportNarx.js';
import { parseLatLng, ZAXIRA_MARKAZ } from '../lib/mapMarkers';
import { displayName } from '../lib/displayName';
import LogisticsMap, { qachon, jonlimi } from './LogisticsMap';

/**
 * Logistika — kunlik transport rejasi.
 *
 * Egasining oqimi (2026-09-19): hamma o'quvchi ro'yxatda turadi, filtrlar
 * bilan toraytiriladi — bugun kelganlar → transportga ehtiyoji borlar → shu
 * kurs(lar)dagilar. Qolganidan (masalan 20 ta) keraksizini qo'lda chiqaradi
 * (18 ta qoladi) va "Haydovchilarga taqsimlash" bosadi: tizim bolalarni
 * haydovchilar mashinasining sig'imi va uylarning joylashuviga qarab o'zi
 * bo'ladi. Tasdiqlangach reja har bir haydovchining Telegramiga o'zi boradi,
 * haydovchi botda "Qabul qildim" va "Yetkazdim" bosadi.
 *
 * Marshrut va Avtopark bo'limlari yo'q (egasi: "kerakmas") — mashina
 * ma'lumoti xodim kartasida (Xodimlar → Haydovchi) kiritiladi.
 */

type Tab = 'reja' | 'tarix';

interface DayStop { studentId: number; name: string; phone?: string; address?: string; location?: string; photo?: string; narx?: number | null; masofaKm?: number | null }
interface DayPlan {
    id: number; name: string; date: string; navbat: number;
    driver: { id: number; name: string; phone?: string; telegram: boolean } | null;
    transport: { id: number; name: string; model?: string; number?: string; capacity: number } | null;
    stops: DayStop[];
    run: { startedAt?: string | null; finishedAt?: string | null } | null;
    holatlar: Record<number, string>;
    /** Yo'l haqi: hammasi uchun, narxi aniqlanmaganlar soni, olib ketilganlar uchun. */
    pul?: { jami: number; aniqlanmagan: number; olingan: number };
}
interface DayDriver {
    id: number; name: string; phone?: string; telegram: boolean;
    transport: { id: number; name: string; model?: string; number?: string; capacity: number; status: string; tarif?: any } | null;
    location: { lat: number; lng: number; live: boolean; liveUntil?: string | null; updatedAt: string } | null;
}
interface Taqsimot {
    rejalar: { key: string; driverId: number; navbat: number; studentIds: number[] }[];
    sigmagan: number[];
}

/** Haydovchilar ranglari: xaritada ham, ro'yxatda ham bir xil. */
const RANGLAR = ['#1b6b6b', '#e11d48', '#2563eb', '#d97706', '#7c3aed', '#059669', '#db2777', '#0891b2', '#65a30d', '#9333ea'];

/** Davomatda "keldi" hisoblanadigan holatlar (erta ketgan uyiga o'zi ketgan). */
const KELGAN = new Set(['Keldi', 'Kechikdi']);

const HOLAT_BELGI: Record<string, { belgi: string; cls: string }> = {
    'Olib ketildi': { belgi: 'Olindi', cls: 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/40' },
    'Uyiga yetkazildi': { belgi: 'Yetkazildi', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40' },
    'Kelmadi': { belgi: 'Chiqmadi', cls: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40' },
};

const inp = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[11px] font-extrabold text-matn-xira mb-2";
const karta = "bg-sirt rounded-2xl border border-chiziq shadow-sm";

const mashinaMatni = (t?: { model?: string; name?: string; number?: string; capacity?: number } | null) =>
    t ? [t.model || t.name, t.number, t.capacity ? `${t.capacity} o'rin` : ''].filter(Boolean).join(' · ') : '';

export default function LogisticsHub() {
    const { students, groups, attendances, settings, showNotification, token, selectedSchoolId, kora, ozgartira } = useCRM();
    // Lavozim ruxsati (Sozlamalar → Ruxsatlar): reja tuzish/belgilash va tarix alohida.
    const rejaKorinadi = kora('logistika.reja');
    const rejaTahrir = ozgartira('logistika.reja');
    const tarixKorinadi = kora('logistika.tarix');
    const confirm = useConfirm();

    const [tab, setTab] = useState<Tab>(() => (rejaKorinadi ? 'reja' : 'tarix'));
    const [sana, setSana] = useState(toDateStr());

    // ===== Kun ma'lumoti (rejalar + haydovchilar) =====
    const [kun, setKun] = useState<{ plans: DayPlan[]; drivers: DayDriver[] } | null>(null);
    const [kunYuklanmoqda, setKunYuklanmoqda] = useState(false);
    const sorov = useRef(0);

    const kunniYuklash = useCallback(async (jim = false) => {
        if (!selectedSchoolId) return;
        const so = ++sorov.current;
        if (!jim) setKunYuklanmoqda(true);
        try {
            const r = await fetch(`/api/logistics/day?schoolId=${selectedSchoolId}&date=${sana}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Yuklab bo'lmadi");
            const d = await r.json();
            if (so === sorov.current) setKun({ plans: d.plans || [], drivers: d.drivers || [] });
        } catch (e: any) {
            if (!jim) showNotification(e.message || "Logistika ma'lumoti yuklanmadi", 'error');
        } finally {
            if (so === sorov.current) setKunYuklanmoqda(false);
        }
    }, [selectedSchoolId, sana, token]);

    useEffect(() => { if (tab === 'reja' && rejaKorinadi) kunniYuklash(); }, [tab, kunniYuklash]);

    // Haydovchi joylashuvi va bot tugmalari (Qabul qildim / Yetkazdim) shu
    // yerda ko'rinsin: bugungi kun ochiq turganda har 30 soniyada yangilanadi.
    useEffect(() => {
        if (tab !== 'reja' || sana !== toDateStr()) return;
        const t = setInterval(() => kunniYuklash(true), 30000);
        return () => clearInterval(t);
    }, [tab, sana, kunniYuklash]);

    const rejalar = kun?.plans || [];
    const haydovchilar = kun?.drivers || [];
    const rangi = useMemo(() => {
        const m = new Map<number, string>();
        haydovchilar.forEach((h, i) => m.set(h.id, RANGLAR[i % RANGLAR.length]));
        rejalar.forEach(p => { if (p.driver && !m.has(p.driver.id)) m.set(p.driver.id, RANGLAR[m.size % RANGLAR.length]); });
        return m;
    }, [haydovchilar, rejalar]);

    // ===== Filtrlar =====
    const [fKelgan, setFKelgan] = useState(false);
    const [fTransport, setFTransport] = useState(false);
    const [fKurslar, setFKurslar] = useState<number[]>([]);
    const [fRejasizlar, setFRejasizlar] = useState(true);
    const [qidiruv, setQidiruv] = useState('');
    const [chiqarilgan, setChiqarilgan] = useState<Set<number>>(new Set());
    const [kursOchiq, setKursOchiq] = useState(false);
    const [kursQidiruv, setKursQidiruv] = useState('');

    const kelganlar = useMemo(() => {
        const s = new Set<number>();
        for (const a of attendances || []) if (a.date === sana && KELGAN.has(a.status)) s.add(a.studentId);
        return s;
    }, [attendances, sana]);

    /** Bugungi rejalarda turgan bola → qaysi reja. */
    const rejadagi = useMemo(() => {
        const m = new Map<number, DayPlan>();
        for (const p of rejalar) for (const st of p.stops) m.set(st.studentId, p);
        return m;
    }, [rejalar]);

    const kursSet = useMemo(() => new Set(fKurslar), [fKurslar]);

    // Filtrlar zinasi: har bosqichda nechta qolgani ko'rinadi.
    const zina = useMemo(() => {
        const jami = students.filter(s => s.status !== 'Arxiv');
        const b1 = fKelgan ? jami.filter(s => kelganlar.has(s.id)) : jami;
        const b2 = fTransport ? b1.filter(s => s.needsTransport) : b1;
        const b3 = kursSet.size ? b2.filter(s => (s.groups || []).some(g => kursSet.has(g))) : b2;
        const b4 = fRejasizlar ? b3.filter(s => !rejadagi.has(s.id)) : b3;
        const rejaga = b4.filter(s => !chiqarilgan.has(s.id));
        return { jami, b1, b2, b3, b4, rejaga };
    }, [students, fKelgan, fTransport, kursSet, fRejasizlar, kelganlar, rejadagi, chiqarilgan]);

    const korinadigan = useMemo(() => {
        const q = qidiruv.trim().toLowerCase();
        const r = q ? zina.b4.filter(s => (s.name || '').toLowerCase().includes(q) || (s.phone || '').includes(q)) : zina.b4;
        return [...r].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uz'));
    }, [zina.b4, qidiruv]);

    const kursNomi = useMemo(() => new Map(groups.map(g => [g.id, g.name])), [groups]);

    // ===== Haydovchilar tanlovi =====
    // Sukut bo'yicha — mashinasi (sig'imi) kiritilgan hamma haydovchi.
    const [olinmagan, setOlinmagan] = useState<Set<number>>(new Set());
    const ishlaydigan = haydovchilar.filter(h => (h.transport?.capacity || 0) > 0 && h.transport?.status !== 'Arxiv');
    const tanlanganH = ishlaydigan.filter(h => !olinmagan.has(h.id));
    const jamiOrin = tanlanganH.reduce((s, h) => s + (h.transport?.capacity || 0), 0);

    // Yo'l haqi: markazdan uygacha masofa va haydovchining tarifi. Server reja
    // yozilganda aynan shu funksiya bilan hisoblaydi (lib/transportNarx.js).
    const markazNuqta = parseLatLng(settings?.centerLocation) || ZAXIRA_MARKAZ;
    const bolaNarxi = (driverId: number, studentId: number) => {
        const s = students.find(x => x.id === studentId);
        const km = uyMasofasi(markazNuqta, s?.location);
        const tarif = haydovchilar.find(h => h.id === driverId)?.transport?.tarif || null;
        return { km, ...narxHisobla(tarif, km) };
    };

    // ===== Taqsimot (oldindan ko'rish) =====
    const [taqsimot, setTaqsimot] = useState<Taqsimot | null>(null);
    const [band, setBand] = useState('');

    // Sana almashsa — boshqa kunning ro'yxati: tanlovlar qaytadan.
    useEffect(() => { setChiqarilgan(new Set()); setTaqsimot(null); }, [sana]);

    const taqsimlash = () => {
        const bolalar = zina.rejaga;
        if (!bolalar.length) { showNotification("Rejaga kiradigan o'quvchi yo'q", 'error'); return; }
        if (!tanlanganH.length) { showNotification("Haydovchi tanlanmagan (yoki mashina sig'imi kiritilmagan)", 'error'); return; }

        const markaz = parseLatLng(settings?.centerLocation) || ZAXIRA_MARKAZ;
        // Kalit — haydovchi: har haydovchining bitta mashinasi bor.
        const natija = reyalarniTuzish({
            markaz,
            oquvchilar: bolalar.map(s => ({ id: s.id, location: s.location })),
            mashinalar: tanlanganH.map(h => ({ id: h.id, name: h.name, capacity: h.transport!.capacity })),
            direction: 'QAYTISH',
            startTime: '00:00',
            rejim: 'tez',
        });
        const reja = natija.rejalar.map((r: any) => ({
            key: `${r.transportId}-${r.navbat}`, driverId: r.transportId as number, navbat: r.navbat as number,
            studentIds: [...r.studentIds] as number[],
        }));
        const sigmagan: number[] = [...natija.sigmaganlar];

        // Xaritada joyi belgilanmagan bolalar ham qolib ketmasin: bo'sh joyi
        // eng ko'p mashinaga. Joy qolmasa — "sig'magan" ro'yxatiga, admin qo'lda qo'yadi.
        const sigim = (driverId: number) => tanlanganH.find(h => h.id === driverId)?.transport?.capacity || 0;
        for (const id of natija.nuqtasiz as number[]) {
            let eng = reja.filter(r => r.navbat === 1).sort((a, b) => (sigim(b.driverId) - b.studentIds.length) - (sigim(a.driverId) - a.studentIds.length))[0];
            if (!eng || sigim(eng.driverId) - eng.studentIds.length <= 0) {
                // Birinchi reyslarda joy yo'q yoki reja umuman bo'sh — bo'sh mashinaga yangi reja.
                const bosh = tanlanganH.find(h => !reja.some(r => r.driverId === h.id));
                if (bosh) {
                    eng = { key: `${bosh.id}-1`, driverId: bosh.id, navbat: 1, studentIds: [] };
                    reja.push(eng);
                } else { sigmagan.push(id); continue; }
            }
            eng.studentIds.push(id);
        }
        setTaqsimot({ rejalar: reja.sort((a, b) => a.driverId - b.driverId || a.navbat - b.navbat), sigmagan });
    };

    /** Oldindan ko'rishda bolani boshqa rejaga ko'chirish ('' — rejadan chiqarish). */
    const kochirish = (studentId: number, qayerga: string) => {
        if (qayerga === '') setChiqarilgan(c => new Set(c).add(studentId));
        setTaqsimot(prev => {
            if (!prev) return prev;
            const rejalar = prev.rejalar.map(r => ({ ...r, studentIds: r.studentIds.filter(id => id !== studentId) }));
            let sigmagan = prev.sigmagan.filter(id => id !== studentId);
            if (qayerga === '') {
                // Ro'yxatda ham chiqarilgan bo'lib qoladi (yuqorida).
            } else if (qayerga === 'sigmagan') {
                sigmagan = [...sigmagan, studentId];
            } else if (qayerga.startsWith('yangi-')) {
                const driverId = Number(qayerga.slice(6));
                const navbat = Math.max(0, ...rejalar.filter(r => r.driverId === driverId).map(r => r.navbat)) + 1;
                rejalar.push({ key: `${driverId}-${navbat}`, driverId, navbat, studentIds: [studentId] });
            } else {
                const r = rejalar.find(x => x.key === qayerga);
                if (r) r.studentIds.push(studentId);
            }
            return { rejalar: rejalar.filter(r => r.studentIds.length > 0), sigmagan };
        });
    };

    const tasdiqlash = async () => {
        if (!taqsimot) return;
        const plans = taqsimot.rejalar.filter(r => r.studentIds.length).map(r => ({ driverId: r.driverId, studentIds: r.studentIds }));
        if (!plans.length) return;
        if (taqsimot.sigmagan.length && !await confirm(`${taqsimot.sigmagan.length} ta o'quvchi hech bir mashinaga sig'madi va rejaga kirmaydi. Davom etasizmi?`)) return;
        setBand('tasdiq');
        try {
            const r = await fetch('/api/logistics/plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ schoolId: selectedSchoolId, date: sana, plans }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'Reja saqlanmadi');
            const yuborildi = (d.yuborish || []).filter((y: any) => y.ok).length;
            const yuborilmadi = (d.yuborish || []).filter((y: any) => !y.ok);
            const nomi = (routeId: number) => (d.plans || []).find((p: DayPlan) => p.id === routeId)?.driver?.name || '';
            showNotification(
                `${plans.length} ta reja tuzildi. Haydovchilarga yuborildi: ${yuborildi}` +
                (yuborilmadi.length ? `. Yuborilmadi: ${yuborilmadi.map((y: any) => `${nomi(y.routeId)} (${y.sabab})`).join(', ')}` : '') +
                (d.otaOnaXabarlari
                    ? `. Ota-onalarga narx yuborildi: ${d.otaOnagaYuborildi}`
                    : ". Ota-onalarga narx xabari o'chiq (Sozlamalar → Transport xabarlari)"),
                yuborilmadi.length ? 'info' : 'success');
            setTaqsimot(null);
            setChiqarilgan(new Set());
            await kunniYuklash(true);
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setBand('');
        }
    };

    // ===== Reja amallari (haydovchi o'rniga ham bosish mumkin) =====
    const [ochiq, setOchiq] = useState<number | null>(null);

    const rejaAmali = async (p: DayPlan, amal: 'accept' | 'deliver' | 'send' | 'delete') => {
        if (!rejaTahrir) return;
        const savol = {
            accept: `${p.driver?.name}: bolalar mashinaga olindimi? («Qabul qildim» — haydovchi o'rniga)`,
            deliver: `${p.driver?.name}: hammasi uyiga yetkazildimi? («Yetkazdim» — haydovchi o'rniga)`,
            send: '',
            delete: `«${p.name}» rejasini bekor qilasizmi? Haydovchiga xabar boradi.`,
        }[amal];
        if (savol && !await confirm(savol)) return;
        setBand(`${amal}-${p.id}`);
        try {
            const r = await fetch(`/api/logistics/plans/${p.id}${amal === 'delete' ? '' : '/' + amal}`, {
                method: amal === 'delete' ? 'DELETE' : 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'Xatolik');
            showNotification({
                accept: 'Qabul qilindi', deliver: 'Yetkazildi deb belgilandi',
                send: 'Reja haydovchiga qayta yuborildi', delete: 'Reja bekor qilindi',
            }[amal], 'success');
            await kunniYuklash(true);
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

    const kunSurish = (n: number) => {
        const d = new Date(sana + 'T12:00:00');
        d.setDate(d.getDate() + n);
        setSana(toDateStr(d));
    };

    // Xarita uchun: rejadagi bolalar haydovchi rangida; hali rejaga
    // kirmagan, lekin tanlangan bolalar kulrang.
    const xaritaBolalari = useMemo(() => {
        const out: { id: number; name: string; photo?: string | null; location?: string | null; color: string; izoh?: string }[] = [];
        for (const p of rejalar) {
            for (const st of p.stops) {
                const h = p.holatlar[st.studentId];
                out.push({
                    id: st.studentId, name: st.name, photo: st.photo, location: st.location,
                    color: rangi.get(p.driver?.id || 0) || '#64748b',
                    izoh: `${p.driver?.name || ''}${h ? ' · ' + (HOLAT_BELGI[h]?.belgi || h) : ''}`,
                });
            }
        }
        return out;
    }, [rejalar, rangi]);

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
                    {([['reja', 'Reja', <Bus size={13} key="i" />], ['tarix', 'Tarix', <BarChart3 size={13} key="i" />]] as const).filter(([id]) => id === 'reja' ? rejaKorinadi : tarixKorinadi).map(([id, label, icon]) => (
                        <button key={id} onClick={() => setTab(id as Tab)}
                            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${tab === id ? 'bg-brand text-brand-ust shadow' : 'text-matn-xira hover:text-matn'}`}>
                            {icon} {label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'reja' && rejaKorinadi && (
                <div className="space-y-5">
                    {/* Sana */}
                    <div className={`${karta} p-3 flex flex-wrap items-center justify-between gap-3`}>
                        <div className="flex items-center gap-2 px-1">
                            <Calendar size={16} className="text-brand" />
                            <span className="text-xs font-black text-matn">Sana</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => kunSurish(-1)} className="w-8 h-8 rounded-lg hover:bg-chiziq flex items-center justify-center cursor-pointer"><ChevronLeft size={16} /></button>
                            <input type="date" value={sana} onChange={e => e.target.value && setSana(e.target.value)}
                                className="px-3 py-1.5 bg-ichki border border-chiziq rounded-xl text-xs font-black text-matn outline-none focus:border-brand" />
                            <button onClick={() => kunSurish(1)} className="w-8 h-8 rounded-lg hover:bg-chiziq flex items-center justify-center cursor-pointer"><ChevronRight size={16} /></button>
                            {sana !== toDateStr() && (
                                <button onClick={() => setSana(toDateStr())}
                                    className="px-3 py-1.5 bg-ichki border border-chiziq rounded-xl text-[11px] font-extrabold text-matn-xira hover:border-brand cursor-pointer">
                                    Bugun
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ===== Rejalar va xarita ===== */}
                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
                        <div className={`${karta} xl:col-span-3 overflow-hidden`}>
                            <div className="px-5 py-4 border-b border-chiziq-mayin flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <Bus size={15} className="text-brand" />
                                    <span className="text-xs font-black text-matn">{sana === toDateStr() ? 'Bugungi rejalar' : `${sana} rejalari`}</span>
                                    <span className="px-2 py-0.5 bg-brand/10 text-brand rounded-md text-[10px] font-black">{rejalar.length}</span>
                                </div>
                                {kunYuklanmoqda && <Loader2 size={14} className="animate-spin text-matn-xira" />}
                            </div>
                            {rejalar.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Bus size={30} className="text-matn-xira mx-auto mb-2" />
                                    <p className="text-[12px] font-bold text-matn-sokin">Bu kunga hali reja tuzilmagan</p>
                                    <p className="text-[11px] text-matn-xira mt-1">Pastdagi ro'yxatdan o'quvchilarni tanlab, haydovchilarga taqsimlang.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-chiziq-mayin">
                                    {rejalar.map(p => {
                                        const rang = rangi.get(p.driver?.id || 0) || '#64748b';
                                        const holatlar = Object.values(p.holatlar);
                                        const yetkazildi = holatlar.filter(h => h === 'Uyiga yetkazildi').length;
                                        const olindi = holatlar.filter(h => h === 'Olib ketildi').length;
                                        const chiqmadi = holatlar.filter(h => h === 'Kelmadi').length;
                                        const tugagan = !!p.run?.finishedAt;
                                        const boshlangan = !!p.run?.startedAt;
                                        return (
                                            <div key={p.id}>
                                                <div className="px-5 py-3.5 flex flex-wrap items-center gap-3">
                                                    <button onClick={() => setOchiq(ochiq === p.id ? null : p.id)} className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer">
                                                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: rang }} />
                                                        <div className="min-w-0">
                                                            <p className="text-[13px] font-black text-matn truncate">{p.name}</p>
                                                            <p className="text-[11px] font-bold text-matn-xira truncate">
                                                                {mashinaMatni(p.transport) || 'mashina kiritilmagan'} · {p.stops.length} ta o'quvchi
                                                                {p.pul && (p.pul.jami > 0 || p.pul.aniqlanmagan < p.stops.length) && (
                                                                    <> · <span className="text-matn-2">{somMatni(p.pul.jami)} so'm</span>
                                                                        {p.pul.aniqlanmagan > 0 && <span className="text-amber-600"> (+{p.pul.aniqlanmagan} ta narxsiz)</span>}</>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <ChevronDown size={14} className={`text-matn-xira shrink-0 transition-transform ${ochiq === p.id ? 'rotate-180' : ''}`} />
                                                    </button>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {tugagan ? (
                                                            <span className="px-2 py-1 rounded-lg text-[10px] font-black border bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40">
                                                                ✓ Yetkazildi {toTimeStr(p.run!.finishedAt!)}
                                                            </span>
                                                        ) : boshlangan ? (
                                                            <span className="px-2 py-1 rounded-lg text-[10px] font-black border bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/40">
                                                                Qabul qilindi {toTimeStr(p.run!.startedAt!)} · yo'lda
                                                            </span>
                                                        ) : p.driver?.telegram ? (
                                                            <span className="px-2 py-1 rounded-lg text-[10px] font-black border bg-ichki text-matn-sokin border-chiziq">Yuborildi · kutilmoqda</span>
                                                        ) : (
                                                            <span className="px-2 py-1 rounded-lg text-[10px] font-black border bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40"
                                                                title="Haydovchi Telegram botga ulanmagan — reja unga bormadi. Botda telefon raqamini ulashsin yoki o'rniga siz belgilang.">
                                                                <Bot size={10} className="inline -mt-0.5 mr-0.5" /> Botga ulanmagan
                                                            </span>
                                                        )}
                                                        <span className="text-[11px] font-bold text-matn-xira tabular-nums">
                                                            {boshlangan && <><span className="text-sky-600">{olindi}</span> · </>}
                                                            <span className="text-emerald-600">{yetkazildi}</span>
                                                            {chiqmadi > 0 && <> · <span className="text-rose-600">{chiqmadi}</span></>}
                                                            /{p.stops.length}
                                                        </span>
                                                    </div>
                                                </div>
                                                {ochiq === p.id && (
                                                    <div className="px-5 pb-4 space-y-3">
                                                        {rejaTahrir && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {!boshlangan && (
                                                                <button onClick={() => rejaAmali(p, 'accept')} disabled={!!band}
                                                                    className="px-3 py-2 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer">
                                                                    {band === `accept-${p.id}` ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />} Qabul qildim
                                                                </button>
                                                            )}
                                                            {!tugagan && (
                                                                <button onClick={() => rejaAmali(p, 'deliver')} disabled={!!band}
                                                                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer">
                                                                    {band === `deliver-${p.id}` ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Yetkazdim
                                                                </button>
                                                            )}
                                                            {!tugagan && p.driver?.telegram && (
                                                                <button onClick={() => rejaAmali(p, 'send')} disabled={!!band}
                                                                    className="px-3 py-2 bg-ichki border border-chiziq text-matn-2 hover:border-brand hover:text-brand disabled:opacity-50 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer">
                                                                    {band === `send-${p.id}` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Qayta yuborish
                                                                </button>
                                                            )}
                                                            {!boshlangan && (
                                                                <button onClick={() => rejaAmali(p, 'delete')} disabled={!!band}
                                                                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer">
                                                                    <Trash2 size={13} /> Bekor qilish
                                                                </button>
                                                            )}
                                                        </div>
                                                        )}
                                                        <p className="text-[10px] font-bold text-matn-xira">
                                                            Odatda bu tugmalarni haydovchi Telegram botda bosadi. Bu yerdagilari — haydovchi o'rniga belgilash uchun.
                                                        </p>
                                                        {p.pul && boshlangan && (
                                                            <p className="text-[11px] font-bold text-matn-2">
                                                                Haydovchi oladi (olib ketilganlar uchun): <span className="text-emerald-600">{somMatni(p.pul.olingan)} so'm</span>
                                                                <span className="text-matn-xira"> / rejada {somMatni(p.pul.jami)} so'm</span>
                                                                <span className="block text-[10px] font-bold text-matn-xira">Naqd: o'quvchi mashinada haydovchiga to'laydi — kassaga tushmaydi va qarziga yozilmaydi.</span>
                                                            </p>
                                                        )}
                                                        <div className="rounded-xl border border-chiziq divide-y divide-chiziq-mayin">
                                                            {p.stops.map((st, i) => {
                                                                const h = p.holatlar[st.studentId];
                                                                return (
                                                                    <div key={st.studentId} className="flex items-center justify-between gap-3 px-3 py-2">
                                                                        <div className="min-w-0 flex items-center gap-2.5">
                                                                            <span className="text-[10px] font-black text-matn-xira tabular-nums w-5 text-right">{i + 1}</span>
                                                                            <div className="min-w-0">
                                                                                <p className="text-[12px] font-bold text-matn truncate">{displayName(st.name)}</p>
                                                                                <p className="text-[10px] font-bold text-matn-xira truncate">
                                                                                    {st.phone && <><Phone size={9} className="inline -mt-0.5" /> {st.phone}</>}
                                                                                    {st.address && <> · {st.address}</>}
                                                                                    {st.masofaKm !== null && st.masofaKm !== undefined && <> · {st.masofaKm} km</>}
                                                                                    {!st.location && <span className="text-amber-600"> · xaritada joyi yo'q</span>}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <span className={`text-[11px] font-black tabular-nums shrink-0 ${st.narx === null || st.narx === undefined ? 'text-amber-600' : 'text-matn-2'}`}>
                                                                            {st.narx === null || st.narx === undefined ? 'narxsiz' : `${somMatni(st.narx)} so'm`}
                                                                        </span>
                                                                        {h && (
                                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border shrink-0 ${HOLAT_BELGI[h]?.cls || ''}`}>
                                                                                {HOLAT_BELGI[h]?.belgi || h}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Xarita va haydovchilar joylashuvi */}
                        <div className={`${karta} xl:col-span-2 p-4 space-y-3`}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-matn flex items-center gap-2"><MapPin size={14} className="text-brand" /> Xarita</span>
                                <span className="text-[10px] font-bold text-matn-xira">30 soniyada yangilanadi</span>
                            </div>
                            <LogisticsMap
                                className="h-[340px]"
                                centerLocation={settings?.centerLocation}
                                orgName={settings?.orgName}
                                logo={settings?.logo}
                                students={xaritaBolalari}
                                drivers={haydovchilar.map(h => ({ id: h.id, name: h.name, color: rangi.get(h.id) || '#64748b', location: h.location }))}
                            />
                            <div className="space-y-1.5">
                                {haydovchilar.length === 0 && (
                                    <p className="text-[11px] font-bold text-matn-xira">Haydovchi yo'q. Xodimlar bo'limida "Haydovchi" lavozimi bilan qo'shing (mashina rusumi, raqami, sig'imi bilan).</p>
                                )}
                                {haydovchilar.map(h => (
                                    <div key={h.id} className="flex items-center justify-between gap-2 text-[11px]">
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: rangi.get(h.id) }} />
                                            <span className="font-bold text-matn truncate">{h.name}</span>
                                        </span>
                                        <span className="font-bold text-matn-xira shrink-0">
                                            {h.location
                                                ? <>{jonlimi(h.location) && <span className="text-emerald-600">● jonli · </span>}{qachon(h.location.updatedAt)}</>
                                                : !h.telegram ? <span className="text-amber-600">botga ulanmagan</span> : "joylashuv yo'q"}
                                        </span>
                                    </div>
                                ))}
                                {haydovchilar.some(h => !h.location || !jonlimi(h.location)) && (
                                    <p className="text-[10px] font-bold text-matn-xira leading-relaxed pt-1">
                                        Haydovchi doim ko'rinib turishi uchun Telegram botda 📎 → «Joylashuv» → «Jonli joylashuvni ulashish» ni tanlaydi
                                        (8 soat yoki «to'xtatmaguncha»). Bot buni «Qabul qildim» dan keyin o'zi eslatadi.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ===== Yangi reja ===== */}
                    <div className={`${karta} overflow-hidden`}>
                        <div className="px-5 py-4 border-b border-chiziq-mayin flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Filter size={15} className="text-brand" />
                                <span className="text-xs font-black text-matn">Yangi reja — o'quvchilarni tanlang</span>
                            </div>
                            {/* Zina: har bosqichdan keyin nechta qoldi */}
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-matn-xira">
                                <span>Jami <b className="text-matn tabular-nums">{zina.jami.length}</b></span>
                                {fKelgan && <><ArrowRight size={11} /><span>kelgan <b className="text-matn tabular-nums">{zina.b1.length}</b></span></>}
                                {fTransport && <><ArrowRight size={11} /><span>transport kerak <b className="text-matn tabular-nums">{zina.b2.length}</b></span></>}
                                {fKurslar.length > 0 && <><ArrowRight size={11} /><span>kursda <b className="text-matn tabular-nums">{zina.b3.length}</b></span></>}
                                {fRejasizlar && zina.b3.length !== zina.b4.length && <><ArrowRight size={11} /><span>rejada yo'q <b className="text-matn tabular-nums">{zina.b4.length}</b></span></>}
                                {chiqarilgan.size > 0 && <><ArrowRight size={11} /><span className="text-rose-600">chiqarildi −{zina.b4.length - zina.rejaga.length}</span></>}
                                <ArrowRight size={11} />
                                <span className="px-2 py-0.5 rounded-md bg-brand text-brand-ust font-black tabular-nums">{zina.rejaga.length} ta</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3">
                            {/* Filtrlar va ro'yxat */}
                            <div className="lg:col-span-2 lg:border-r border-chiziq-mayin">
                                <div className="p-4 space-y-3 border-b border-chiziq-mayin">
                                    <div className="flex flex-wrap gap-2">
                                        {([
                                            [fKelgan, setFKelgan, `Bugun kelganlar`, kelganlar.size],
                                            [fTransport, setFTransport, 'Transport kerak', students.filter(s => s.status !== 'Arxiv' && s.needsTransport).length],
                                            [fRejasizlar, setFRejasizlar, "Rejaga kirmaganlar", null],
                                        ] as const).map(([yoqiq, set, nom, son]) => (
                                            <button key={nom} onClick={() => (set as any)(!yoqiq)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold border transition-colors cursor-pointer ${yoqiq
                                                    ? 'bg-brand border-brand text-white' : 'bg-sirt border-chiziq text-matn-sokin hover:border-brand hover:text-brand'}`}>
                                                {yoqiq ? <Check size={12} /> : <span className="w-3 h-3 rounded border border-current opacity-60" />}
                                                {nom}{son !== null && <span className="opacity-70 tabular-nums">{son}</span>}
                                            </button>
                                        ))}
                                        <div className="relative">
                                            <button onClick={() => setKursOchiq(v => !v)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold border transition-colors cursor-pointer ${fKurslar.length
                                                    ? 'bg-brand border-brand text-white' : 'bg-sirt border-chiziq text-matn-sokin hover:border-brand hover:text-brand'}`}>
                                                Kurs{fKurslar.length ? `: ${fKurslar.length} ta` : ''} <ChevronDown size={12} />
                                            </button>
                                            {kursOchiq && (
                                                <>
                                                    <div className="fixed inset-0 z-30" onClick={() => setKursOchiq(false)} />
                                                    <div className="absolute z-40 mt-1 left-0 w-72 bg-sirt border border-chiziq rounded-xl shadow-xl p-2">
                                                        <div className="relative mb-2">
                                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-matn-xira" size={12} />
                                                            <input autoFocus value={kursQidiruv} onChange={e => setKursQidiruv(e.target.value)} placeholder="Kurs qidirish..."
                                                                className="w-full pl-7 pr-2 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12px] text-matn outline-none focus:border-brand" />
                                                        </div>
                                                        <div className="max-h-64 overflow-y-auto">
                                                            {groups.filter(g => (g.name || '').toLowerCase().includes(kursQidiruv.toLowerCase())).map(g => {
                                                                const bor = fKurslar.includes(g.id);
                                                                return (
                                                                    <button key={g.id} onClick={() => setFKurslar(prev => bor ? prev.filter(x => x !== g.id) : [...prev, g.id])}
                                                                        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-ichki text-left cursor-pointer">
                                                                        <span className="flex items-center gap-2 min-w-0">
                                                                            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${bor ? 'bg-brand border-brand text-white' : 'border-chiziq'}`}>{bor && <Check size={10} />}</span>
                                                                            <span className="text-[12px] font-bold text-matn truncate">{g.name}</span>
                                                                        </span>
                                                                        <span className="text-[10px] text-matn-xira tabular-nums shrink-0">{g.studentIds?.length || 0}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        {fKurslar.length > 0 && (
                                                            <button onClick={() => setFKurslar([])} className="w-full mt-2 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer">Kurs tanlovini tozalash</button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {fKurslar.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {fKurslar.map(id => (
                                                <span key={id} className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-chiziq text-[11px] text-matn-2">
                                                    {kursNomi.get(id)}
                                                    <button onClick={() => setFKurslar(prev => prev.filter(x => x !== id))} className="text-matn-xira hover:text-rose-600 cursor-pointer"><X size={11} /></button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" size={13} />
                                            <input value={qidiruv} onChange={e => setQidiruv(e.target.value)} placeholder="Ro'yxatdan qidirish (faqat ko'rinish uchun)..."
                                                className="w-full pl-8 pr-3 py-2 bg-ichki border border-chiziq rounded-xl text-xs font-bold text-matn outline-none focus:border-brand" />
                                        </div>
                                        {chiqarilgan.size > 0 && (
                                            <button onClick={() => setChiqarilgan(new Set())}
                                                className="flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold text-brand hover:bg-ichki cursor-pointer shrink-0">
                                                <RotateCcw size={12} /> Chiqarilganlarni qaytarish
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="max-h-[520px] overflow-y-auto divide-y divide-chiziq-mayin">
                                    {korinadigan.length === 0 && (
                                        <div className="p-8 text-center">
                                            <AlertTriangle size={26} className="text-amber-400 mx-auto mb-2" />
                                            <p className="text-[12px] font-bold text-matn-sokin">
                                                {fKelgan && kelganlar.size === 0
                                                    ? `${sana} kuni hali hech kimga «keldi» belgilanmagan — davomat qilinmagan bo'lishi mumkin`
                                                    : "Filtrlarga mos o'quvchi yo'q"}
                                            </p>
                                        </div>
                                    )}
                                    {korinadigan.map(s => {
                                        const chiq = chiqarilgan.has(s.id);
                                        const reja = rejadagi.get(s.id);
                                        const kurslar = (s.groups || []).map(g => kursNomi.get(g)).filter(Boolean);
                                        return (
                                            <div key={s.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors ${chiq ? 'opacity-45 bg-ichki/60' : 'hover:bg-ichki/50'}`}>
                                                <div className="min-w-0">
                                                    <p className={`text-[12px] font-bold text-matn truncate ${chiq ? 'line-through' : ''}`}>
                                                        {displayName(s.name)}
                                                        {kelganlar.has(s.id) && <span className="ml-1.5 text-[10px] font-black text-emerald-600">keldi</span>}
                                                        {s.needsTransport && <Car size={11} className="inline ml-1.5 -mt-0.5 text-brand" />}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-matn-xira truncate">
                                                        {kurslar.length ? kurslar.join(', ') : 'kurssiz'}
                                                        {s.address && <> · {s.address}</>}
                                                        {!s.location && <span className="text-amber-600"> · xaritada joyi yo'q</span>}
                                                        {reja && <span className="text-sky-600"> · rejada: {reja.driver?.name}</span>}
                                                    </p>
                                                </div>
                                                <button onClick={() => setChiqarilgan(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                                                    title={chiq ? 'Rejaga qaytarish' : 'Rejadan chiqarish'}
                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-colors ${chiq
                                                        ? 'bg-brand/10 text-brand hover:bg-brand/20'
                                                        : 'bg-rose-50 text-rose-500 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40'}`}>
                                                    {chiq ? <RotateCcw size={12} /> : <X size={13} />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Haydovchilar va taqsimlash */}
                            <div className="p-4 space-y-4">
                                <div>
                                    <p className="text-[11px] font-extrabold text-matn-xira mb-2">Bugun ishlaydigan haydovchilar</p>
                                    <div className="space-y-1.5">
                                        {haydovchilar.length === 0 && <p className="text-[11px] font-bold text-matn-xira">Haydovchi yo'q</p>}
                                        {haydovchilar.map(h => {
                                            const ishlaydi = ishlaydigan.includes(h);
                                            const tanlandi = ishlaydi && !olinmagan.has(h.id);
                                            return (
                                                <button key={h.id} disabled={!ishlaydi}
                                                    onClick={() => setOlinmagan(prev => { const n = new Set(prev); n.has(h.id) ? n.delete(h.id) : n.add(h.id); return n; })}
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-colors ${tanlandi
                                                        ? 'border-brand bg-brand/5' : 'border-chiziq'} ${ishlaydi ? 'cursor-pointer hover:border-brand' : 'opacity-60 cursor-not-allowed'}`}>
                                                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${tanlandi ? 'bg-brand border-brand text-white' : 'border-chiziq'}`}>{tanlandi && <Check size={10} />}</span>
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: rangi.get(h.id) }} />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-[12px] font-bold text-matn truncate">{h.name}</span>
                                                        <span className="block text-[10px] font-bold text-matn-xira truncate">
                                                            {ishlaydi ? mashinaMatni(h.transport) : <span className="text-amber-600">mashina sig'imi kiritilmagan (Xodimlar)</span>}
                                                            {!h.telegram && <span className="text-amber-600"> · botga ulanmagan</span>}
                                                        </span>
                                                        <span className={`block text-[10px] font-bold truncate ${h.transport?.tarif ? 'text-matn-sokin' : 'text-amber-600'}`}>
                                                            {h.transport?.tarif ? `💰 ${tarifMatni(h.transport.tarif)}` : "yo'l haqi kiritilmagan (Xodimlar)"}
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="rounded-xl bg-ichki border border-chiziq p-3 space-y-1.5 text-[11px] font-bold">
                                    <div className="flex justify-between"><span className="text-matn-xira">Rejaga kiradi</span><span className="text-matn tabular-nums">{zina.rejaga.length} ta</span></div>
                                    <div className="flex justify-between"><span className="text-matn-xira">Mashinalarda joy</span><span className="text-matn tabular-nums">{jamiOrin} ta</span></div>
                                    {zina.rejaga.length > jamiOrin && jamiOrin > 0 && (
                                        <p className="text-amber-600 pt-1">Joy yetmaydi — ba'zi haydovchilar ikkinchi reysga chiqadi.</p>
                                    )}
                                    {zina.rejaga.filter(s => !s.location).length > 0 && (
                                        <p className="text-amber-600 pt-1">{zina.rejaga.filter(s => !s.location).length} ta o'quvchining uyi xaritada belgilanmagan — bo'sh joyi ko'p mashinaga qo'yiladi.</p>
                                    )}
                                </div>

                                {rejaTahrir && (
                                <button onClick={taqsimlash} disabled={!zina.rejaga.length || !tanlanganH.length}
                                    className="w-full py-3.5 bg-brand hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer">
                                    <Users size={15} /> Haydovchilarga taqsimlash ({zina.rejaga.length} ta)
                                </button>
                                )}
                                <p className="text-[10px] font-bold text-matn-xira leading-relaxed">
                                    Tizim bolalarni mashina sig'imi va uylar joylashuviga qarab o'zi bo'ladi. Tasdiqlashdan oldin istalgan bolani boshqa haydovchiga o'tkazish mumkin; tasdiqlangach reja har bir haydovchining Telegramiga o'zi boradi.
                                    Yo'l haqini o'quvchi mashinada haydovchiga naqd to'laydi — kassaga tushmaydi va qarziga yozilmaydi.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== Taqsimotni ko'rish va tasdiqlash ===== */}
            {taqsimot && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => !band && setTaqsimot(null)} />
                    <div className="relative bg-sirt rounded-[1.5rem] border border-chiziq shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-chiziq-mayin flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base font-black text-matn">Taqsimot — {sana}</h3>
                                <p className="text-[11px] font-bold text-matn-xira mt-0.5">
                                    {taqsimot.rejalar.reduce((s, r) => s + r.studentIds.length, 0)} ta o'quvchi · {taqsimot.rejalar.length} ta reja
                                · yo'l haqi jami {somMatni(rejaSummasi(taqsimot.rejalar.flatMap(r => r.studentIds.map(id => bolaNarxi(r.driverId, id).narx))).jami)} so'm (naqd)
                                    {taqsimot.sigmagan.length > 0 && <span className="text-rose-600"> · {taqsimot.sigmagan.length} tasi sig'madi</span>}
                                </p>
                            </div>
                            <button onClick={() => setTaqsimot(null)} disabled={!!band} className="w-9 h-9 rounded-xl hover:bg-ichki flex items-center justify-center text-matn-xira cursor-pointer"><X size={18} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-max">
                            {[...taqsimot.rejalar.map(r => ({ ...r, sigmagan: false })), ...(taqsimot.sigmagan.length ? [{ key: 'sigmagan', driverId: 0, navbat: 0, studentIds: taqsimot.sigmagan, sigmagan: true }] : [])].map(r => {
                                const h = haydovchilar.find(x => x.id === r.driverId);
                                const sigim = h?.transport?.capacity || 0;
                                const pul = r.sigmagan ? null : rejaSummasi(r.studentIds.map(id => bolaNarxi(r.driverId, id).narx));
                                return (
                                    <div key={r.key} className={`rounded-2xl border ${r.sigmagan ? 'border-rose-200 dark:border-rose-900/50' : 'border-chiziq'} overflow-hidden`}>
                                        <div className="px-4 py-3 bg-ichki border-b border-chiziq-mayin flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {!r.sigmagan && <span className="w-3 h-3 rounded-full shrink-0" style={{ background: rangi.get(r.driverId) }} />}
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-black text-matn truncate">
                                                        {r.sigmagan ? "Hech bir mashinaga sig'madi" : `${h?.name}${r.navbat > 1 ? ` — ${r.navbat}-reys` : ''}`}
                                                    </p>
                                                    {!r.sigmagan && <p className="text-[10px] font-bold text-matn-xira truncate">{mashinaMatni(h?.transport)}</p>}
                                                    {pul && (
                                                        <p className="text-[11px] font-black text-emerald-600 truncate">
                                                            Haydovchi oladi: {somMatni(pul.jami)} so'm
                                                            {pul.aniqlanmagan > 0 && <span className="text-amber-600 font-bold"> · {pul.aniqlanmagan} ta narxsiz</span>}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {!r.sigmagan && (
                                                <span className={`text-[11px] font-black tabular-nums shrink-0 ${r.studentIds.length > sigim ? 'text-rose-600' : 'text-matn-sokin'}`}>
                                                    {r.studentIds.length}/{sigim}
                                                </span>
                                            )}
                                        </div>
                                        <div className="divide-y divide-chiziq-mayin">
                                            {r.studentIds.map((id, i) => {
                                                const s = students.find(x => x.id === id);
                                                const n = r.sigmagan ? null : bolaNarxi(r.driverId, id);
                                                return (
                                                    <div key={id} className="flex items-center justify-between gap-2 px-4 py-2">
                                                        <div className="min-w-0 flex items-center gap-2">
                                                            <span className="text-[10px] font-black text-matn-xira w-4 text-right tabular-nums">{i + 1}</span>
                                                            <div className="min-w-0">
                                                                <p className="text-[12px] font-bold text-matn truncate">{displayName(s?.name || '')}</p>
                                                                <p className="text-[10px] font-bold text-matn-xira truncate">
                                                                    {n && (n.narx !== null
                                                                        ? <span className="text-matn-2">{somMatni(n.narx)} so'm</span>
                                                                        : <span className="text-amber-600">narxsiz — {n.sabab}</span>)}
                                                                    {n?.km !== null && n?.km !== undefined && <> · {n.km} km</>}
                                                                    {s?.address && <> · {s.address}</>}
                                                                    {!s?.location && !n && " · joyi belgilanmagan"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <select value={r.key} onChange={e => kochirish(id, e.target.value)} title="Boshqa haydovchiga o'tkazish"
                                                            className="max-w-[140px] px-2 py-1 bg-ichki border border-chiziq rounded-lg text-[10px] font-bold text-matn outline-none cursor-pointer shrink-0">
                                                            {r.sigmagan && <option value="sigmagan">— tanlang —</option>}
                                                            {taqsimot.rejalar.map(x => {
                                                                const xh = haydovchilar.find(y => y.id === x.driverId);
                                                                return <option key={x.key} value={x.key}>{xh?.name}{x.navbat > 1 ? ` (${x.navbat}-reys)` : ''}</option>;
                                                            })}
                                                            {tanlanganH.filter(x => !taqsimot.rejalar.some(y => y.driverId === x.id)).map(x => (
                                                                <option key={`yangi-${x.id}`} value={`yangi-${x.id}`}>{x.name}</option>
                                                            ))}
                                                            <option value="">Rejadan chiqarish</option>
                                                        </select>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="px-6 py-4 border-t border-chiziq-mayin flex flex-wrap items-center justify-end gap-3">
                            <button onClick={() => setTaqsimot(null)} disabled={!!band}
                                className="px-5 py-3 rounded-2xl bg-ichki border border-chiziq text-[12px] font-extrabold text-matn-2 cursor-pointer">Bekor qilish</button>
                            <button onClick={tasdiqlash} disabled={!!band || !taqsimot.rejalar.length || !rejaTahrir}
                                className="px-5 py-3 rounded-2xl bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-[12px] font-extrabold flex items-center gap-2 shadow-sm cursor-pointer">
                                {band === 'tasdiq' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                Tasdiqlash va haydovchilarga yuborish
                            </button>
                        </div>
                    </div>
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
