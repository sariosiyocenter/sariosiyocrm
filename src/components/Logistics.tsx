import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';
import {
    Bus, Search, User, Phone, Truck, Calendar, ChevronLeft, ChevronRight,
    BarChart3, Download, CalendarRange, CheckCircle2, XCircle,
    X, MapPin, Navigation, Clock, Users, Check, Loader2,
    Car, AlertTriangle, ChevronDown, PlayCircle, StopCircle,
    UserCheck, Package, Send, Eye
} from 'lucide-react';
import { DeliveryLog, RouteRun } from '../types';
import { toDateStr, toTimeStr } from '../../lib/lessons.js';

type TabType = 'asosiy' | 'tarix';

const inp = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[11px] font-extrabold text-matn-xira mb-2";

// Bugungi rejaning holati
type RejaHolati = 'draft' | 'active' | 'done';

interface KunlikReja {
    routeId: number;
    haydovchiId: number;
    haydovchiIsmi: string;
    vehicleModel?: string;
    vehicleNumber?: string;
    vehicleCapacity?: number;
    transportId?: number | null;
    oquvchilar: number[]; // student IDs
    sana: string;
    holat: RejaHolati;
}

export default function LogisticsHub() {
    const { t } = useLang();
    const {
        students, users, groups, attendances, routes, routeRuns, deliveryLogs,
        transports, settings,
        addRoute, updateRoute,
        addDeliveryLog, fetchDeliveryLogs, fetchRouteRuns,
        startRouteRun, finishRouteRun, sendDriverLocation,
        showNotification, token, selectedSchoolId, user
    } = useCRM();

    const [activeTab, setActiveTab] = useState<TabType>('asosiy');
    const [selectedDate, setSelectedDate] = useState(toDateStr());

    // ===== ASOSIY TAB HOLATI =====
    // 1-qadam: Guruh tanlab kelganlar
    const [tanlanganGuruhlar, setTanlanganGuruhlar] = useState<number[]>([]);
    const [guruhQidiruv, setGuruhQidiruv] = useState('');

    // 2-qadam: Transport kerak bo'lganlar (filtr + qo'lda chiqarish)
    const [chiqarilganOquvchilar, setChiqarilganOquvchilar] = useState<Set<number>>(new Set());
    const [oquvchiQidiruv, setOquvchiQidiruv] = useState('');

    // 3-qadam: Haydovchi tanlash
    const [tanlanganHaydovchiId, setTanlanganHaydovchiId] = useState<number | null>(null);

    // Reja holati (saqlangan yoki yangi)
    const [saqlangan, setSaqlangan] = useState<KunlikReja | null>(null);
    const [rejaBand, setRejaBand] = useState('');

    // Haydovchi lokatsiyasi
    const [haydovchiLok, setHaydovchiLok] = useState<{ lat: number; lng: number } | null>(null);
    const lokIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ===== TARIX TAB HOLATI =====
    const [statsFrom, setStatsFrom] = useState('');
    const [statsTo, setStatsTo] = useState('');
    const [stats, setStats] = useState<any>(null);
    const [statsYuklanmoqda, setStatsYuklanmoqda] = useState(false);

    // ===== HISOBLAR =====

    const haydovchilar = users.filter(u => u.role === 'DRIVER');

    // Tanlangan guruhlarning barcha o'quvchilari (shu kuni kelganlar)
    const kelganOquvchilar = useCallback(() => {
        if (tanlanganGuruhlar.length === 0) return [];
        const keldi = new Set<number>();
        for (const att of attendances) {
            if (att.date === selectedDate && att.status === 'Keldi' && tanlanganGuruhlar.includes(att.groupId)) {
                keldi.add(att.studentId);
            }
        }
        return [...keldi].map(id => students.find(s => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s && s.status !== 'Arxiv');
    }, [tanlanganGuruhlar, selectedDate, attendances, students]);

    // Transport kerak bo'lganlar (kelganlardan)
    const transportKerakOquvchilar = useCallback(() => {
        return kelganOquvchilar().filter(s => s.needsTransport);
    }, [kelganOquvchilar]);

    // Rejaga kiradigan o'quvchilar (qo'lda chiqarilganlar olib tashlangan)
    const rejaOquvchilari = useCallback(() => {
        return transportKerakOquvchilar().filter(s => !chiqarilganOquvchilar.has(s.id));
    }, [transportKerakOquvchilar, chiqarilganOquvchilar]);

    // Tanlangan haydovchi ma'lumotlari
    const haydovchi = haydovchilar.find(h => h.id === tanlanganHaydovchiId) || null;

    // Tanlangan haydovchiga biriktirilgan transport
    const haydovchiTransport = transports.find(tr => tr.driverId === tanlanganHaydovchiId) || null;

    // Saqlangan rejaning reysi
    const saqlananReys = saqlangan
        ? routeRuns.find(r => r.routeId === saqlangan.routeId && r.date === saqlangan.sana) || null
        : null;

    // Yetkazish yozuvlari (saqlangan reja uchun)
    const rejaYozuvlari = useCallback(() => {
        if (!saqlangan) return [];
        return deliveryLogs.filter(l => l.date === saqlangan.sana
            && (saqlananReys ? l.runId === saqlananReys.id || (!l.runId && l.date === saqlangan?.sana) : true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saqlangan, deliveryLogs, saqlananReys]);

    // O'quvchining yetkazish holati
    const oquvchiHolati = (studentId: number): DeliveryLog['status'] | undefined => {
        return deliveryLogs.find(l =>
            l.studentId === studentId &&
            l.date === selectedDate &&
            (saqlananReys ? l.runId === saqlananReys.id || !l.runId : true)
        )?.status;
    };

    // ===== EFFEKTLAR =====

    useEffect(() => {
        if (activeTab === 'asosiy') {
            fetchRouteRuns(selectedDate);
            fetchDeliveryLogs(selectedDate);
        }
    }, [selectedDate, activeTab]);

    useEffect(() => {
        if (activeTab === 'tarix' && !stats && !statsYuklanmoqda) statsniYuklash();
    }, [activeTab]);

    // Sana o'zgarganda reja va filtrlarni tozalash
    useEffect(() => {
        setSaqlangan(null);
        setChiqarilganOquvchilar(new Set());
        setTanlanganGuruhlar([]);
        setTanlanganHaydovchiId(null);
    }, [selectedDate]);

    // Haydovchi lokatsiyasini har 30 sekundda yuborish (faqat haydovchi uchun)
    useEffect(() => {
        if (user?.role !== 'DRIVER' || !saqlananReys?.startedAt || saqlananReys.finishedAt) {
            if (lokIntervalRef.current) clearInterval(lokIntervalRef.current);
            return;
        }
        const yuborish = () => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(pos => {
                sendDriverLocation(pos.coords.latitude, pos.coords.longitude);
                setHaydovchiLok({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            }, () => {});
        };
        yuborish();
        lokIntervalRef.current = setInterval(yuborish, 30000);
        return () => { if (lokIntervalRef.current) clearInterval(lokIntervalRef.current); };
    }, [user?.role, saqlananReys?.startedAt, saqlananReys?.finishedAt]);

    // ===== AMALLAR =====

    const rejaTuzish = async () => {
        const oquvchilar = rejaOquvchilari();
        if (oquvchilar.length === 0) {
            showNotification("Rejaga kiradigan o'quvchi yo'q", 'error');
            return;
        }
        if (!tanlanganHaydovchiId) {
            showNotification('Haydovchi tanlanmagan', 'error');
            return;
        }
        setRejaBand('yaratilmoqda');
        try {
            // Yangi marshrut yaratish yoki mavjudini topish
            const mavjud = routes.find(r =>
                r.driverId === tanlanganHaydovchiId &&
                r.date === selectedDate &&
                r.autoPlanned
            );
            const routeData = {
                name: `${selectedDate} вЂ” ${haydovchi?.name || 'Haydovchi'}`,
                driverId: tanlanganHaydovchiId,
                transportId: haydovchiTransport?.id || null,
                studentIds: oquvchilar.map(s => s.id),
                days: 'HAR_KUNI' as const,
                direction: 'QAYTISH' as const,
                date: selectedDate,
                autoPlanned: true,
            };
            let marshrut;
            if (mavjud) {
                marshrut = await updateRoute(mavjud.id, routeData);
            } else {
                marshrut = await addRoute(routeData as any);
            }
            const routeId = mavjud?.id || (marshrut as any)?.id;
            if (!routeId) throw new Error("Marshrut yaratilmadi");

            setSaqlangan({
                routeId,
                haydovchiId: tanlanganHaydovchiId,
                haydovchiIsmi: haydovchi?.name || '',
                vehicleModel: haydovchiTransport?.model,
                vehicleNumber: haydovchiTransport?.number,
                vehicleCapacity: haydovchiTransport?.capacity,
                transportId: haydovchiTransport?.id || null,
                oquvchilar: oquvchilar.map(s => s.id),
                sana: selectedDate,
                holat: 'draft',
            });
            showNotification(`${oquvchilar.length} ta o'quvchi uchun reja tuzildi`, 'success');
        } catch (e: any) {
            showNotification(e.message || 'Xatolik', 'error');
        } finally {
            setRejaBand('');
        }
    };

    const qabulQildim = async () => {
        if (!saqlangan) return;
        setRejaBand('qabul');
        try {
            const reys = await startRouteRun(saqlangan.routeId, saqlangan.sana, saqlangan.transportId);
            if (reys) {
                setSaqlangan(prev => prev ? { ...prev, holat: 'active' } : prev);
                showNotification("Reys boshlandi! Haydovchi yo'lda.", 'success');
                await fetchRouteRuns(selectedDate);
            }
        } finally {
            setRejaBand('');
        }
    };

    const yetkazdim = async () => {
        if (!saqlangan) return;
        setRejaBand('tugat');
        try {
            const reys = await finishRouteRun(saqlangan.routeId, saqlangan.sana);
            if (reys) {
                setSaqlangan(prev => prev ? { ...prev, holat: 'done' } : prev);
                showNotification("Reys tugadi! Barcha yetkazildi.", 'success');
                await fetchRouteRuns(selectedDate);
            }
        } finally {
            setRejaBand('');
        }
    };

    const holatBelgilash = async (studentId: number, status: DeliveryLog['status']) => {
        if (!saqlangan?.routeId) return;
        await addDeliveryLog({
            studentId,
            transportId: saqlangan?.transportId || transports[0]?.id || undefined,
            routeId: saqlangan?.routeId,
            date: saqlangan?.sana || selectedDate,
            status,
        });
    };

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

    const excelgaChiqarish = async () => {
        if (!stats) return;
        const XLSX = await import('xlsx');
        const kitob = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(kitob, XLSX.utils.json_to_sheet(
            (stats.oquvchilar || []).map((x: any) => ({
                "O'quvchi": x.name, 'Olib ketildi': x.olindi, 'Uyiga yetkazildi': x.yetkazildi, 'Kelmadi': x.kelmadi,
            }))
        ), "O'quvchilar");
        XLSX.utils.book_append_sheet(kitob, XLSX.utils.json_to_sheet(
            (stats.haydovchilar || []).map((x: any) => ({
                'Haydovchi': x.name, 'Reyslar': x.reys, 'Tugatilgan': x.tugagan, "O'rtacha (daqiqa)": x.ortachaDaqiqa ?? '',
            }))
        ), 'Haydovchilar');
        const nom = `logistika-${statsFrom || 'boshidan'}_${statsTo || toDateStr()}.xlsx`;
        XLSX.writeFile(kitob, nom);
    };

    // ===== RENDER YORDAMCHILARI =====

    const kunlarOldin = (n: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + n);
        return toDateStr(d);
    };

    // Tanlangan guruhlar uchun davomad yozuvi bor kunmi
    const guruhKelganlarSoni = (guruhId: number) => {
        return attendances.filter(a => a.date === selectedDate && a.groupId === guruhId && a.status === 'Keldi').length;
    };

    // Mavjud guruhlar (faol, shu filial)
    const mavjudGuruhlar = groups.filter(g => {
        if (!g.studentIds?.length) return false;
        const nom = g.name?.toLowerCase() || '';
        return nom.includes(guruhQidiruv.toLowerCase());
    });

    // Aktiv haydovchiga biriktirilgan transport ma'lumoti
    const haydovchiVehicleInfo = (driverId: number) => {
        const tr = transports.find(t => t.driverId === driverId);
        if (!tr) return 'Mashina biriktirilmagan';
        return `${tr.model || ''} ${tr.number || ''} В· ${tr.capacity} o'rin`.trim();
    };

    const statusRenk = (status?: DeliveryLog['status']) => {
        if (status === 'Olib ketildi') return 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/40';
        if (status === 'Uyiga yetkazildi') return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40';
        if (status === 'Kelmadi') return 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40';
        return 'bg-gray-50 text-matn-xira border-gray-100 dark:bg-gray-900 dark:border-gray-800';
    };

    // ===== JSX =====

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-sm shadow-[#1b6b6b]/20">
                            <Navigation size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-matn tracking-tight">Logistika</h1>
                            <p className="text-[11px] font-bold text-matn-xira mt-0.5">Transport va yetkazish boshqaruvi</p>
                        </div>
                    </div>

                    <div className="flex bg-ichki p-1 rounded-xl border border-chiziq w-fit">
                        {[
                            { id: 'asosiy', label: 'Asosiy', icon: <Bus size={13} /> },
                            { id: 'tarix', label: 'Tarix', icon: <BarChart3 size={13} /> },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                                    activeTab === tab.id
                                    ? 'bg-brand text-brand-ust shadow'
                                    : 'text-matn-xira hover:text-gray-600'
                                }`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ===== ASOSIY TAB ===== */}
            {activeTab === 'asosiy' && (
                <div className="space-y-4">
                    {/* Sana tanlash */}
                    <div className="bg-sirt rounded-2xl border border-chiziq p-4 shadow-sm flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-brand" />
                            <span className="text-xs font-black text-matn">Bugun:</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelectedDate(kunlarOldin(-1))}
                                className="w-8 h-8 rounded-lg hover:bg-chiziq flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-sm font-black text-matn tabular-nums px-2">{selectedDate}</span>
                            <button
                                onClick={() => setSelectedDate(kunlarOldin(1))}
                                className="w-8 h-8 rounded-lg hover:bg-chiziq flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                onClick={() => setSelectedDate(toDateStr())}
                                className="px-3 py-1.5 bg-ichki border border-chiziq rounded-xl text-[11px] font-extrabold text-matn-xira hover:border-brand transition-all cursor-pointer"
                            >
                                Bugun
                            </button>
                        </div>
                    </div>

                    {saqlangan ? (
                        /* ===== TUZILGAN REJA KO'RINISHI ===== */
                        <div className="space-y-4">
                            {/* Reja sarlavhasi */}
                            <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                                <div className="px-6 py-5 flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${
                                            saqlangan?.holat === 'done'
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400'
                                                : saqlangan?.holat === 'active'
                                                    ? 'bg-brand/10 border-brand text-brand animate-pulse'
                                                    : 'bg-gray-50 border-gray-200 text-matn-xira dark:bg-gray-900 dark:border-gray-800'
                                        }`}>
                                            {saqlangan?.holat === 'done' ? <CheckCircle2 size={22} /> : saqlangan?.holat === 'active' ? <Navigation size={22} /> : <Package size={22} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm font-black text-matn">{saqlangan?.haydovchiIsmi}</h3>
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                                    saqlangan?.holat === 'done' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                                    saqlangan?.holat === 'active' ? 'bg-brand/10 text-brand border-brand/20' :
                                                    'bg-gray-50 text-matn-xira border-gray-100 dark:bg-gray-900 dark:border-gray-800'
                                                }`}>
                                                    {saqlangan?.holat === 'done' ? 'вњ“ Tugadi' : saqlangan?.holat === 'active' ? 'в–¶ Yo\'lda' : 'Tayyor'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-matn-xira mt-0.5">
                                                <Car size={10} className="inline mr-1" />
                                                {saqlangan?.vehicleModel} {saqlangan?.vehicleNumber}
                                                {saqlangan?.vehicleCapacity ? ` В· ${saqlangan.vehicleCapacity} o'rin` : ''}
                                            </p>
                                            <p className="text-[11px] font-bold text-matn-xira mt-0.5">
                                                <Users size={10} className="inline mr-1" />
                                                {saqlangan?.oquvchilar.length} ta o'quvchi В· {saqlangan?.sana}
                                            </p>
                                            {saqlananReys?.startedAt && (
                                                <p className="text-[11px] font-bold text-brand mt-0.5">
                                                    <Clock size={10} className="inline mr-1" />
                                                    Boshlandi: {toTimeStr(saqlananReys.startedAt)}
                                                    {saqlananReys.finishedAt && ` В· Tugadi: ${toTimeStr(saqlananReys.finishedAt)}`}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setSaqlangan(null); setChiqarilganOquvchilar(new Set()); }}
                                        className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-matn-xira flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Haydovchi tugmalari */}
                                {saqlangan?.holat !== 'done' && (
                                    <div className="px-6 pb-5 flex gap-3">
                                        {!saqlananReys?.startedAt ? (
                                            <button
                                                onClick={qabulQildim}
                                                disabled={!!rejaBand}
                                                className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                                            >
                                                {rejaBand === 'qabul' ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                                                Qabul qildim (yo'lga chiqdim)
                                            </button>
                                        ) : (
                                            <>
                                                <div className="flex-1 py-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2">
                                                    <CheckCircle2 size={16} /> Qabul qilingan В· {toTimeStr(saqlananReys.startedAt)}
                                                </div>
                                                <button
                                                    onClick={yetkazdim}
                                                    disabled={!!rejaBand}
                                                    className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                                                >
                                                    {rejaBand === 'tugat' ? <Loader2 size={16} className="animate-spin" /> : <StopCircle size={16} />}
                                                    Yetkazdim (hammani)
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* O'quvchilar ro'yxati va holat belgilash */}
                            <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-chiziq-mayin/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users size={15} className="text-brand" />
                                        <span className="text-xs font-black text-matn">O'quvchilar</span>
                                        <span className="px-2 py-0.5 bg-brand/10 text-brand rounded-md text-[10px] font-black">
                                            {saqlangan?.oquvchilar.length}
                                        </span>
                                    </div>
                                    {/* Progress bar */}
                                    {saqlananReys?.startedAt && (
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-matn-xira">
                                            {(() => {
                                                const yetkazildi = (saqlangan?.oquvchilar || []).filter(id => oquvchiHolati(id) === 'Uyiga yetkazildi').length;
                                                const jami = saqlangan?.oquvchilar.length || 1;
                                                return <><span className="text-emerald-600 font-black">{yetkazildi}</span>/{jami} yetkazildi</>;
                                            })()}
                                        </div>
                                    )}
                                </div>
                                <div className="divide-y divide-chiziq-mayin/50">
                                    {(saqlangan?.oquvchilar || []).map((sid, idx) => {
                                        const st = students.find(s => s.id === sid);
                                        if (!st) return null;
                                        const holat = oquvchiHolati(sid);
                                        return (
                                            <div key={sid} className="flex items-center justify-between px-5 py-3 gap-3 hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-7 h-7 rounded-lg bg-ichki border border-chiziq flex items-center justify-center font-black text-[11px] text-brand shrink-0">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-black text-matn truncate">{st.name}</p>
                                                        <p className="text-[11px] font-bold text-matn-xira truncate flex items-center gap-1">
                                                            <Phone size={9} /> {st.phone}
                                                            {st.address && <><MapPin size={9} className="ml-1" /> {st.address}</>}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {holat && (
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border mr-1 ${statusRenk(holat)}`}>
                                                            {holat === 'Olib ketildi' ? 'Olib ketildi' : holat === 'Uyiga yetkazildi' ? 'Yetkazildi' : 'Kelmadi'}
                                                        </span>
                                                    )}
                                                    {[
                                                        { label: 'в†—', title: 'Olib ketildi', status: 'Olib ketildi' as const, aktiv: holat === 'Olib ketildi', renk: 'hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-950/20' },
                                                        { label: 'вњ“', title: 'Uyiga yetkazildi', status: 'Uyiga yetkazildi' as const, aktiv: holat === 'Uyiga yetkazildi', renk: 'hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/20' },
                                                        { label: 'вњ—', title: 'Kelmadi', status: 'Kelmadi' as const, aktiv: holat === 'Kelmadi', renk: 'hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20' },
                                                    ].map(opt => (
                                                        <button
                                                            key={opt.status}
                                                            title={opt.title}
                                                            onClick={() => holatBelgilash(sid, opt.status)}
                                                            className={`w-7 h-7 rounded-lg text-sm font-black border flex items-center justify-center transition-all cursor-pointer ${
                                                                opt.aktiv
                                                                    ? `${statusRenk(opt.status)} border-current`
                                                                    : `bg-ichki border-chiziq text-matn-xira ${opt.renk}`
                                                            }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ===== REJA TUZISH OQIMI ===== */
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* 1-qadam: Guruh tanlash */}
                            <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-chiziq-mayin/50">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-brand text-brand-ust flex items-center justify-center text-[10px] font-black">1</div>
                                            <span className="text-xs font-black text-matn">Guruh tanlang</span>
                                        </div>
                                        {tanlanganGuruhlar.length > 0 && (
                                            <span className="px-2 py-0.5 bg-brand/10 text-brand rounded-md text-[10px] font-black">
                                                {tanlanganGuruhlar.length} ta
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" size={13} />
                                        <input
                                            type="text"
                                            placeholder="Guruh qidiring..."
                                            value={guruhQidiruv}
                                            onChange={e => setGuruhQidiruv(e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 bg-ichki border border-chiziq rounded-xl text-xs font-bold text-matn outline-none focus:border-brand transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-80 overflow-y-auto divide-y divide-chiziq-mayin/50">
                                    {mavjudGuruhlar.length === 0 && (
                                        <p className="p-6 text-center text-[11px] font-bold text-matn-xira">Guruh topilmadi</p>
                                    )}
                                    {mavjudGuruhlar.map(g => {
                                        const keldi = guruhKelganlarSoni(g.id);
                                        const tanlandi = tanlanganGuruhlar.includes(g.id);
                                        return (
                                            <button
                                                key={g.id}
                                                onClick={() => setTanlanganGuruhlar(prev =>
                                                    prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev, g.id]
                                                )}
                                                className={`w-full flex items-center justify-between px-5 py-3 text-left transition-all cursor-pointer ${
                                                    tanlandi ? 'bg-brand/5 dark:bg-brand/10' : 'hover:bg-gray-50/50 dark:hover:bg-gray-900/30'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                                        tanlandi ? 'bg-brand border-brand text-white' : 'border-chiziq'
                                                    }`}>
                                                        {tanlandi && <Check size={11} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-matn">{g.name}</p>
                                                        <p className="text-[11px] font-bold text-matn-xira">{g.studentIds?.length || 0} o'quvchi</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {keldi > 0 ? (
                                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-md text-[10px] font-black">
                                                            {keldi} keldi
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-matn-xira">yozuv yo'q</span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 2-qadam: Transport kerak bo'lganlar */}
                            <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-chiziq-mayin/50">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-brand text-brand-ust flex items-center justify-center text-[10px] font-black">2</div>
                                            <span className="text-xs font-black text-matn">Transport keraklars</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {chiqarilganOquvchilar.size > 0 && (
                                                <button
                                                    onClick={() => setChiqarilganOquvchilar(new Set())}
                                                    className="text-[10px] font-bold text-brand hover:underline cursor-pointer"
                                                >
                                                    Hammasini qaytarish
                                                </button>
                                            )}
                                            <span className="px-2 py-0.5 bg-brand/10 text-brand rounded-md text-[10px] font-black">
                                                {rejaOquvchilari().length} ta
                                            </span>
                                        </div>
                                    </div>
                                    {tanlanganGuruhlar.length === 0 ? (
                                        <p className="text-[11px] font-bold text-matn-xira">Avval guruh tanlang</p>
                                    ) : (
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" size={13} />
                                            <input
                                                type="text"
                                                placeholder="O'quvchi qidiring..."
                                                value={oquvchiQidiruv}
                                                onChange={e => setOquvchiQidiruv(e.target.value)}
                                                className="w-full pl-8 pr-3 py-2 bg-ichki border border-chiziq rounded-xl text-xs font-bold text-matn outline-none focus:border-brand transition-all"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="max-h-80 overflow-y-auto divide-y divide-chiziq-mayin/50">
                                    {tanlanganGuruhlar.length === 0 ? (
                                        <div className="p-6 text-center">
                                            <Bus size={28} className="text-matn-xira mx-auto mb-2" />
                                            <p className="text-[11px] font-bold text-matn-xira">1-qadamdan guruh tanlang</p>
                                        </div>
                                    ) : transportKerakOquvchilar().length === 0 ? (
                                        <div className="p-6 text-center">
                                            <AlertTriangle size={28} className="text-amber-400 mx-auto mb-2" />
                                            <p className="text-[11px] font-bold text-matn-xira">
                                                {kelganOquvchilar().length > 0
                                                    ? `${kelganOquvchilar().length} ta kelgan, lekin hech birida "transport kerak" belgisi yo'q`
                                                    : 'Shu kuni kelgan o\'quvchi topilmadi'
                                                }
                                            </p>
                                        </div>
                                    ) : (
                                        transportKerakOquvchilar()
                                            .filter(s => s.name.toLowerCase().includes(oquvchiQidiruv.toLowerCase()))
                                            .map(st => {
                                                const chiqarilgan = chiqarilganOquvchilar.has(st.id);
                                                return (
                                                    <div
                                                        key={st.id}
                                                        className={`flex items-center justify-between px-5 py-3 transition-all ${
                                                            chiqarilgan ? 'opacity-40 bg-gray-50/50 dark:bg-gray-900/30' : 'hover:bg-gray-50/30 dark:hover:bg-gray-900/20'
                                                        }`}
                                                    >
                                                        <div className="min-w-0">
                                                            <p className={`text-xs font-black text-matn truncate ${chiqarilgan ? 'line-through' : ''}`}>{st.name}</p>
                                                            <p className="text-[11px] font-bold text-matn-xira truncate">
                                                                {st.phone}{st.address ? ` В· ${st.address}` : ''}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => setChiqarilganOquvchilar(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(st.id)) next.delete(st.id);
                                                                else next.add(st.id);
                                                                return next;
                                                            })}
                                                            title={chiqarilgan ? "Qaytarish" : "Chiqarish"}
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                                                                chiqarilgan
                                                                    ? 'bg-brand/10 text-brand hover:bg-brand/20'
                                                                    : 'bg-rose-50 text-rose-500 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/30'
                                                            }`}
                                                        >
                                                            {chiqarilgan ? <Check size={13} /> : <X size={13} />}
                                                        </button>
                                                    </div>
                                                );
                                            })
                                    )}
                                </div>
                            </div>

                            {/* 3-qadam: Haydovchi tanlash + reja tuzish */}
                            <div className="space-y-4">
                                <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-chiziq-mayin/50">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-brand text-brand-ust flex items-center justify-center text-[10px] font-black">3</div>
                                            <span className="text-xs font-black text-matn">Haydovchi tanlang</span>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-chiziq-mayin/50">
                                        {haydovchilar.length === 0 && (
                                            <p className="p-6 text-center text-[11px] font-bold text-matn-xira">
                                                Haydovchi (DRIVER) rol berilgan xodim yo'q
                                            </p>
                                        )}
                                        {haydovchilar.map(h => {
                                            const tr = transports.find(t => t.driverId === h.id);
                                            const tanlandi = tanlanganHaydovchiId === h.id;
                                            return (
                                                <button
                                                    key={h.id}
                                                    onClick={() => setTanlanganHaydovchiId(tanlandi ? null : h.id)}
                                                    className={`w-full flex items-center justify-between px-5 py-3 text-left transition-all cursor-pointer ${
                                                        tanlandi ? 'bg-brand/5 dark:bg-brand/10' : 'hover:bg-gray-50/50 dark:hover:bg-gray-900/30'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all ${
                                                            tanlandi ? 'bg-brand border-brand text-white' : 'bg-ichki border-chiziq text-matn-xira'
                                                        }`}>
                                                            <User size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-matn">{h.name}</p>
                                                            <p className="text-[11px] font-bold text-matn-xira">
                                                                {tr ? (
                                                                    <><Car size={9} className="inline mr-0.5" />
                                                                    {tr.model} {tr.number} В· {tr.capacity} o'rin</>
                                                                ) : (
                                                                    <span className="text-amber-500">mashina biriktirilmagan</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {tanlandi && <Check size={16} className="text-brand shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Reja tuzish tugmasi */}
                                <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm p-5 space-y-4">
                                    {/* Xulosa */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[11px] font-bold">
                                            <span className="text-matn-xira">Tanlangan guruhlar:</span>
                                            <span className="text-matn">{tanlanganGuruhlar.length} ta</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] font-bold">
                                            <span className="text-matn-xira">Transport kerak:</span>
                                            <span className="text-matn">{transportKerakOquvchilar().length} ta</span>
                                        </div>
                                        {chiqarilganOquvchilar.size > 0 && (
                                            <div className="flex items-center justify-between text-[11px] font-bold">
                                                <span className="text-matn-xira">Chiqarilganlar:</span>
                                                <span className="text-rose-600 dark:text-rose-400">-{chiqarilganOquvchilar.size} ta</span>
                                            </div>
                                        )}
                                        <div className="border-t border-dashed border-chiziq pt-2 flex items-center justify-between text-xs font-black">
                                            <span className="text-matn">Rejaga kiradi:</span>
                                            <span className={rejaOquvchilari().length > 0 ? 'text-brand' : 'text-matn-xira'}>{rejaOquvchilari().length} ta</span>
                                        </div>
                                        {tanlanganHaydovchiId && haydovchiTransport && rejaOquvchilari().length > haydovchiTransport.capacity && (
                                            <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl">
                                                <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                                                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                                    Sig'imdan {rejaOquvchilari().length - haydovchiTransport.capacity} ta oshmoqda!
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={rejaTuzish}
                                        disabled={!!rejaBand || rejaOquvchilari().length === 0 || !tanlanganHaydovchiId}
                                        className="w-full py-3.5 bg-brand hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                                    >
                                        {rejaBand === 'yaratilmoqda' ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                                        Reja tuzish
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ===== TARIX TAB ===== */}
            {activeTab === 'tarix' && (
                <div className="space-y-4">
                    <div className="bg-sirt rounded-2xl border border-chiziq p-4 shadow-sm flex flex-wrap items-end gap-3">
                        <div>
                            <label className={lbl}>Boshlanishi</label>
                            <input type="date" className={inp + ' w-auto'} value={statsFrom} onChange={e => setStatsFrom(e.target.value)} />
                        </div>
                        <div>
                            <label className={lbl}>Tugashi</label>
                            <input type="date" className={inp + ' w-auto'} value={statsTo} onChange={e => setStatsTo(e.target.value)} />
                        </div>
                        <button onClick={statsniYuklash} disabled={statsYuklanmoqda}
                            className="px-4 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-2xl text-[11px] font-extrabold flex items-center gap-2 shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                            <BarChart3 size={14} /> {statsYuklanmoqda ? 'YuklanmoqdaвЂ¦' : "Ko'rsatish"}
                        </button>
                        {(statsFrom || statsTo) && (
                            <button onClick={() => { setStatsFrom(''); setStatsTo(''); }}
                                className="px-4 py-3 bg-ichki border border-chiziq text-matn-sokin rounded-2xl text-[11px] font-extrabold flex items-center gap-2 transition-all cursor-pointer">
                                <CalendarRange size={14} /> Boshidan
                            </button>
                        )}
                        <div className="flex-1" />
                        <button onClick={excelgaChiqarish} disabled={!stats}
                            className="px-4 py-3 bg-ichki border border-chiziq text-matn-sokin hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 rounded-2xl text-[11px] font-extrabold flex items-center gap-2 transition-all cursor-pointer">
                            <Download size={14} /> Excel
                        </button>
                    </div>

                    {!stats ? (
                        <div className="bg-sirt rounded-2xl border border-chiziq p-12 text-center shadow-sm">
                            <BarChart3 size={36} className="text-matn-xira mx-auto mb-3" />
                            <p className="text-[11px] font-bold text-matn-xira">{statsYuklanmoqda ? 'YuklanmoqdaвЂ¦' : "Sana tanlang va В«Ko'rsatishВ» bosing"}</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                {[
                                    { yorliq: 'Reyslar', qiymat: stats.jami?.reys ?? 0, izoh: stats.jami?.birinchiKun ? `${stats.jami.birinchiKun} dan beri` : '' },
                                    { yorliq: 'Olib ketildi', qiymat: stats.jami?.olindi ?? 0 },
                                    { yorliq: 'Yetkazildi', qiymat: stats.jami?.yetkazildi ?? 0 },
                                    { yorliq: 'Kelmadi', qiymat: stats.jami?.kelmadi ?? 0, qizil: true },
                                    { yorliq: "O'quvchilar", qiymat: stats.jami?.oquvchi ?? 0 },
                                ].map(k => (
                                    <div key={k.yorliq} className="bg-sirt rounded-2xl border border-chiziq p-4 shadow-sm">
                                        <p className="text-[10px] font-bold text-matn-xira uppercase tracking-wider">{k.yorliq}</p>
                                        <p className={`text-2xl font-black tabular-nums mt-1 ${k.qizil && k.qiymat > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-matn'}`}>{k.qiymat}</p>
                                        {k.izoh && <p className="text-[10px] font-bold text-matn-xira mt-1">{k.izoh}</p>}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                                    <p className="px-5 py-4 text-xs font-black text-matn border-b border-chiziq-mayin">O'quvchilar bo'yicha</p>
                                    <div className="max-h-[420px] overflow-y-auto custom-scrollbar divide-y divide-chiziq-mayin dark:divide-gray-700/50">
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
                                    <p className="px-5 py-2 text-[10px] font-bold text-matn-xira border-t border-chiziq-mayin">olindi В· yetkazildi В· kelmadi</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                                        <p className="px-5 py-4 text-xs font-black text-matn border-b border-chiziq-mayin">Haydovchilar</p>
                                        <div className="divide-y divide-chiziq-mayin dark:divide-gray-700/50">
                                            {(stats.haydovchilar || []).length === 0 && <p className="p-6 text-center text-[11px] font-bold text-matn-xira">Reys yo'q</p>}
                                            {(stats.haydovchilar || []).map((h: any) => (
                                                <div key={h.driverId} className="flex items-center justify-between gap-3 px-5 py-3">
                                                    <span className="text-xs font-bold text-matn truncate">{h.name}</span>
                                                    <span className="text-[11px] font-bold text-matn-xira tabular-nums shrink-0">
                                                        {h.reys} reys{h.ortachaDaqiqa !== null ? ` В· ~${h.ortachaDaqiqa} daq` : ''}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                                        <p className="px-5 py-4 text-xs font-black text-matn border-b border-chiziq-mayin">Kunlar</p>
                                        <div className="max-h-[240px] overflow-y-auto custom-scrollbar divide-y divide-chiziq-mayin dark:divide-gray-700/50">
                                            {(stats.kunlar || []).length === 0 && <p className="p-6 text-center text-[11px] font-bold text-matn-xira">Yozuv yo'q</p>}
                                            {(stats.kunlar || []).map((k: any) => (
                                                <div key={k.date} className="flex items-center justify-between gap-3 px-5 py-2.5">
                                                    <span className="text-[11px] font-bold text-matn tabular-nums">{k.date}</span>
                                                    <span className="text-[11px] font-bold text-matn-xira tabular-nums">
                                                        {k.reys} reys В· {k.olindi + k.yetkazildi} yozuv
                                                        {k.kelmadi > 0 && <span className="text-rose-600 dark:text-rose-400"> В· {k.kelmadi} kelmadi</span>}
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

