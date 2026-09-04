import React, { useState, useMemo } from 'react';
import {
  Users, GraduationCap, Target,
  TrendingUp, TrendingDown, ArrowUpRight,
  Activity, Calendar, Clock, ChevronRight, BookOpen, BarChart3, FileText, UserMinus, Award, Star, MoreHorizontal, ChevronDown
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import RoomSchedule from './RoomSchedule';

import LeftStudentsReport from './reports/LeftStudentsReport';
import StaffAttendanceReport from './reports/StaffAttendanceReport';
import StudentBonusReport from './reports/StudentBonusReport';
import LeadsReport from './reports/LeadsReport';
import StudentsGeneralReport from './reports/StudentsGeneralReport';
import GraduatesReport from './reports/GraduatesReport';
import CenterStatsReport from './reports/CenterStatsReport';

export default function Dashboard() {
    const { students, groups, teachers, leads, payments, courses, rooms, attendances, user } = useCRM();
    const { t } = useLang();
    const navigate = useNavigate();

    // Date preset states
    const [selectedPreset, setSelectedPreset] = useState<'this_month' | 'last_30' | 'this_year' | 'all' | 'custom'>('this_month');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const handlePreset = (type: 'this_month' | 'last_30' | 'this_year' | 'all') => {
        setSelectedPreset(type);
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        setEndDate(todayStr);

        if (type === 'this_month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            setStartDate(start.toISOString().split('T')[0]);
        } else if (type === 'last_30') {
            const start = new Date();
            start.setDate(today.getDate() - 30);
            setStartDate(start.toISOString().split('T')[0]);
        } else if (type === 'this_year') {
            const start = new Date(today.getFullYear(), 0, 1);
            setStartDate(start.toISOString().split('T')[0]);
        } else if (type === 'all') {
            setStartDate('2024-01-01');
        }
    };

    // Active tab in reports section of Dashboard
    const [activeReportTab, setActiveReportTab] = useState<string>('stats');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Financial Calculations filtered by selected period
    const periodIncome = useMemo(() => {
        return payments
            .filter(p => p.date >= startDate && p.date <= endDate)
            .reduce((acc, p) => acc + p.amount, 0);
    }, [payments, startDate, endDate]);

    const lastPeriodIncome = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diff = end.getTime() - start.getTime();
        const prevStart = new Date(start.getTime() - diff - 86400000);
        const prevEnd = new Date(start.getTime() - 86400000);
        const prevStartStr = prevStart.toISOString().split('T')[0];
        const prevEndStr = prevEnd.toISOString().split('T')[0];
        return payments
            .filter(p => p.date >= prevStartStr && p.date <= prevEndStr)
            .reduce((acc, p) => acc + p.amount, 0);
    }, [payments, startDate, endDate]);

    const incomeTrend = lastPeriodIncome === 0 ? (periodIncome > 0 ? 100 : 0) : ((periodIncome - lastPeriodIncome) / lastPeriodIncome) * 100;

    const monthlyExpected = (students || [])
        .filter(s => s.status === 'Faol')
        .reduce((acc, s) => {
            const studentGroups = (groups || []).filter(g => (s.groups || []).includes(g.id));
            const studentFees = studentGroups.reduce((gAcc, g) => {
                const course = (courses || []).find(c => c.id === g.courseId);
                return gAcc + (course?.price || 0);
            }, 0);
            return acc + studentFees;
        }, 0);

    const totalDebt = students
        .filter(s => s.balance < 0)
        .reduce((acc, s) => acc + Math.abs(s.balance), 0);


    const monthNames = [t('month_jan'), t('month_feb'), t('month_mar'), t('month_apr'), t('month_may'), t('month_jun'), t('month_jul'), t('month_aug'), t('month_sep'), t('month_oct'), t('month_nov'), t('month_dec')];
    const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return {
            month: d.getMonth(),
            year: d.getFullYear(),
            label: monthNames[d.getMonth()]
        };
    });

    const chartDataValues = last6Months.map(m => {
        // filter payments for that specific month
        return payments
            .filter(p => {
                const d = new Date(p.date);
                return d.getMonth() === m.month && d.getFullYear() === m.year;
            })
            // Faqat kirimlar: oylik hisoblash manfiy yozuv bo'lib, uni qo'shsak
            // ustun manfiyga tushib ketadi (sentabrda -127 chiqqan edi).
            .reduce((acc, p) => acc + (p.amount > 0 ? p.amount : 0), 0) / 1000000;
    });

    const chartLabels = last6Months.map(m => m.label);
    const total6Months = chartDataValues.reduce((acc, v) => acc + v, 0);
    const maxVal = Math.max(...chartDataValues, 0.1);

    const courseStatsMap: { [key: string]: { name: string, students: number, revenue: number } } = {};

    const PLACEHOLDER_COURSE_NAMES = ['birinchi', 'belgilanmagan', '-'];
    courses.filter(c => !PLACEHOLDER_COURSE_NAMES.includes((c.name || '').trim().toLowerCase())).forEach(c => {
        const courseGroups = groups.filter(g => g.courseId === c.id);
        const studentCount = courseGroups.reduce((acc, g) => acc + (g.studentIds || []).length, 0);
        const revenue = studentCount * c.price;
        const normalizedKey = c.name.trim().toUpperCase();

        if (courseStatsMap[normalizedKey]) {
            courseStatsMap[normalizedKey].students += studentCount;
            courseStatsMap[normalizedKey].revenue += revenue;
        } else {
            courseStatsMap[normalizedKey] = { name: c.name, students: studentCount, revenue };
        }
    });

    const topCourseStats = Object.values(courseStatsMap)
        .filter(c => c.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 3);

    // Leads count in period
    const periodNewLeads = useMemo(() => {
        return leads.filter(l => {
            if (!l.createdAt) return false;
            const d = l.createdAt.slice(0, 10);
            return d >= startDate && d <= endDate;
        }).length;
    }, [leads, startDate, endDate]);

    // Sana qo'lda yig'iladi: brauzerlarda 'uz-UZ' lokali yo'q, shuning uchun
    // toLocaleDateString "M09 4, Fri" kabi chala matn qaytarardi.
    const UZ_DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    const todayLabel = `${UZ_DAYS[new Date().getDay()]}, ${new Date().getDate()}-${UZ_MONTHS[new Date().getMonth()]}`;

    // ---- Referensdagi uchta asosiy ko'rsatkich va "Bugun hal qilinsin" ro'yxati.
    // Hammasi mavjud yozuvlardan hisoblanadi; ma'lumot bo'lmasa blok ko'rsatilmaydi.

    const activeStudents = students.filter(s => s.status === 'Faol').length;

    // Joriy oyda qo'shilgan o'quvchilar — "+N" ko'rsatkichi uchun.
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const joinedThisMonth = students.filter(s => (s.joinedDate || '').startsWith(monthPrefix)).length;

    // Umumiy o'rin — guruhlarga biriktirilgan xonalar sig'imi yig'indisi.
    // Xona biriktirilmagan bo'lsa o'rin soni noma'lum, shuning uchun chiziq chizilmaydi.
    const totalSeats = groups.reduce((n, g) => n + (rooms.find(r => r.id === g.room)?.capacity || 0), 0);
    const seatsPct = totalSeats > 0 ? Math.min(100, Math.round((activeStudents / totalSeats) * 100)) : null;

    // Tushum kutilgan oylik yuklamaga nisbatan.
    const incomePct = monthlyExpected > 0 ? Math.min(100, Math.round((periodIncome / monthlyExpected) * 100)) : null;

    // Qarzdorlik: kim qancha vaqtdan beri to'lov qilmagan.
    const debtors = students.filter(s => (s.balance || 0) < 0);
    const daysSinceLastPayment = (studentId: number) => {
        const dates = payments.filter(p => p.studentId === studentId && p.amount > 0).map(p => p.date).sort();
        const last = dates[dates.length - 1];
        if (!last) return null;
        const d = new Date(last);
        if (isNaN(d.getTime())) return null;
        return Math.floor((Date.now() - d.getTime()) / 86400000);
    };
    const staleDebtors = debtors.filter(s => {
        const d = daysSinceLastPayment(s.id);
        return d === null || d > 30;
    });
    const staleDebtSum = staleDebtors.reduce((n, s) => n + Math.abs(s.balance || 0), 0);

    // Uzoq vaqt javobsiz qolgan lidlar.
    const openLeads = leads.filter(l => l.status !== "To'lov qildi" && l.status !== 'Kelishdi');
    const leadAge = (l: any) => {
        const d = new Date(l.createdAt);
        return isNaN(d.getTime()) ? null : Math.floor((Date.now() - d.getTime()) / 86400000);
    };
    const staleLeads = openLeads.filter(l => (leadAge(l) ?? 0) >= 2);
    const oldestLeadAge = staleLeads.reduce((m, l) => Math.max(m, leadAge(l) ?? 0), 0);

    // Yo'qlamasi kiritilmagan guruhlar (oxirgi 3 kun ichida yozuv yo'q).
    const groupsMissingAttendance = groups.filter(g => {
        const dates = (attendances || []).filter(a => a.groupId === g.id).map(a => a.date).sort();
        const last = dates[dates.length - 1];
        if (!last) return true;
        const d = new Date(last);
        return isNaN(d.getTime()) ? true : Math.floor((Date.now() - d.getTime()) / 86400000) > 3;
    });

    const todoItems = [
        staleDebtors.length > 0 && {
            key: 'debt',
            tone: 'bg-rose-500',
            title: `${staleDebtors.length} ta o'quvchi 30+ kun to'lov qilmagan`,
            sub: `Jami ${(staleDebtSum / 1000000).toFixed(1)} mln so'm`,
            path: '/students?filter=debt',
        },
        staleLeads.length > 0 && {
            key: 'leads',
            tone: 'bg-amber-500',
            title: `${staleLeads.length} ta lid javobsiz qolgan`,
            sub: `Eng qadimgisi — ${oldestLeadAge} kun oldin`,
            path: '/leads',
        },
        groupsMissingAttendance.length > 0 && {
            key: 'att',
            tone: 'bg-sky-500',
            title: `${groupsMissingAttendance.length} ta guruh davomati kiritilmagan`,
            sub: groupsMissingAttendance.slice(0, 2).map(g => g.name).join(', '),
            path: `/courses/${groupsMissingAttendance[0].id}`,
        },
    ].filter(Boolean) as { key: string; tone: string; title: string; sub: string; path: string }[];

    const PRIMARY_REPORTS = [
        { id: 'stats', label: t('rep_stats'), icon: <FileText size={12} /> },
        { id: 'leads', label: t('rep_leads'), icon: <Target size={12} /> },
        { id: 'students_general', label: t('rep_students_general'), icon: <Users size={12} /> },
        { id: 'left_students', label: t('rep_left_students'), icon: <UserMinus size={12} /> },
    ];

    const SECONDARY_REPORTS = [
        { id: 'graduates', label: t('rep_graduates'), icon: <GraduationCap size={12} /> },
        { id: 'staff_attendance', label: t('rep_staff_attendance'), icon: <Activity size={12} /> },
        { id: 'bonuses', label: t('rep_bonuses'), icon: <Star size={12} /> },
    ];

    const renderReportContent = () => {
        switch (activeReportTab) {
            case 'left_students': return <LeftStudentsReport startDate={startDate} endDate={endDate} />;
            case 'staff_attendance': return <StaffAttendanceReport startDate={startDate} endDate={endDate} />;
            case 'bonuses': return <StudentBonusReport startDate={startDate} endDate={endDate} />;
            case 'leads': return <LeadsReport startDate={startDate} endDate={endDate} />;
            case 'students_general': return <StudentsGeneralReport startDate={startDate} endDate={endDate} />;
            case 'graduates': return <GraduatesReport startDate={startDate} endDate={endDate} />;
            case 'stats':
            default: return <CenterStatsReport startDate={startDate} endDate={endDate} />;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Sarlavha. Referensdagidek: salomlashuv, ostida bugungi holat,
                o'ngda davr almashtirgichi. */}
            <div>
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                            Xush kelibsiz, {(user?.name || '').split(' ')[0] || t('dashboard_title')}
                        </h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
                            {todayLabel}
                            {todoItems.length > 0 && <> · <span className="num">{todoItems.length}</span> ta ish e'tiboringizni kutmoqda</>}
                        </p>
                    </div>

                    {/* Presets and Custom Inputs */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Presets */}
                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-800">
                            {['this_month', 'last_30', 'this_year', 'all'].map((type) => {
                                const label = type === 'this_month' ? t('preset_this_month') : type === 'last_30' ? t('preset_30_days') : type === 'this_year' ? t('preset_this_year') : t('preset_all');
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handlePreset(type as any)}
                                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                                            selectedPreset === type
                                                ? 'bg-[#1b6b6b] text-white'
                                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Custom inputs */}
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setSelectedPreset('custom'); }}
                                className="bg-gray-55 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none focus:border-[#1b6b6b] w-32 cursor-pointer"
                            />
                            <span className="text-gray-400 dark:text-gray-500 font-extrabold text-[11px] uppercase tracking-wider">{t('date_to')}</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setSelectedPreset('custom'); }}
                                className="bg-gray-55 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none focus:border-[#1b6b6b] w-32 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Uchta asosiy ko'rsatkich. Avval to'rtta mayda karta bor edi
                (o'quvchi / guruh / ustoz / lid) — ular shunchaki sanoq bo'lib,
                holatni ko'rsatmasdi. Endi har birida nisbat chizig'i bor. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div onClick={() => navigate('/students')}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5 cursor-pointer hover:border-[#1b6b6b]/40 transition-colors">
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">{t('stat_active_students')}</span>
                    <div className="mt-1.5 flex items-baseline gap-2">
                        <span className="num text-[30px] font-bold leading-none text-gray-900 dark:text-white">{activeStudents}</span>
                        {joinedThisMonth > 0 && (
                            <span className="num text-[13px] font-medium text-emerald-500">+{joinedThisMonth}</span>
                        )}
                    </div>
                    {seatsPct !== null ? (
                        <>
                            <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                                <div className="h-full rounded-full bg-[#1b6b6b]" style={{ width: `${seatsPct}%` }} />
                            </div>
                            <span className="text-[11px] text-gray-400 block mt-2">
                                <span className="num">{totalSeats}</span> o'rindan <span className="num">{seatsPct}%</span> band
                            </span>
                        </>
                    ) : (
                        <span className="text-[11px] text-gray-400 block mt-2">Xona sig'imi kiritilmagan</span>
                    )}
                </div>

                <div onClick={() => navigate('/finance')}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5 cursor-pointer hover:border-[#1b6b6b]/40 transition-colors">
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">{t('income')}</span>
                    <div className="mt-1.5 flex items-baseline gap-1">
                        <span className="num text-[30px] font-bold leading-none text-gray-900 dark:text-white">{(periodIncome / 1000000).toFixed(1)}</span>
                        <span className="num text-[13px] font-medium text-gray-400">mln</span>
                    </div>
                    {incomePct !== null ? (
                        <>
                            <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                                <div className="h-full rounded-full bg-[#1b6b6b]" style={{ width: `${incomePct}%` }} />
                            </div>
                            <span className="text-[11px] text-gray-400 block mt-2">
                                <span className="num">{(monthlyExpected / 1000000).toFixed(1)}</span> mln kutilgandan <span className="num">{incomePct}%</span>
                            </span>
                        </>
                    ) : (
                        <span className="text-[11px] text-gray-400 block mt-2">Kutilayotgan summa hisoblanmadi</span>
                    )}
                </div>

                <div onClick={() => navigate('/students?filter=debt')}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5 cursor-pointer hover:border-rose-300 dark:hover:border-rose-900/60 transition-colors">
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">{t('debt')}</span>
                    <div className="mt-1.5 flex items-baseline gap-1">
                        <span className="num text-[30px] font-bold leading-none text-rose-500">{(totalDebt / 1000000).toFixed(1)}</span>
                        <span className="num text-[13px] font-medium text-gray-400">mln</span>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex">
                        {debtors.length > 0 && (
                            <>
                                <div className="h-full bg-amber-400" style={{ width: `${Math.round(((debtors.length - staleDebtors.length) / debtors.length) * 100)}%` }} />
                                <div className="h-full bg-rose-500" style={{ width: `${Math.round((staleDebtors.length / debtors.length) * 100)}%` }} />
                            </>
                        )}
                    </div>
                    <span className="text-[11px] text-gray-400 block mt-2">
                        <span className="num">{debtors.length}</span> o'quvchi · <span className="num">{staleDebtors.length}</span> tasi 30 kundan oshgan
                    </span>
                </div>
            </div>

            {/* Main Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* Left 2 Columns */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <TrendingUp size={16} className="text-[#1b6b6b]" />
                                {t('finance_title')}
                            </h3>
                            <button onClick={() => navigate('/finance')} className="flex items-center gap-1 text-[11px] font-extrabold uppercase text-[#1b6b6b] hover:text-[#155252] transition-colors cursor-pointer">
                                {t('rep_stats')} <ArrowUpRight size={12} />
                            </button>
                        </div>

                        {/* Chart Area */}
                        <div className="bg-gray-55 dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-5">
                                <span className="text-[12px] text-gray-500 dark:text-gray-400">So'nggi 6 oy, mln so'm</span>
                                <span className="text-[12px] text-gray-500 dark:text-gray-400">Jami <span className="num text-gray-800 dark:text-gray-100">{total6Months.toFixed(1)}</span> mln</span>
                            </div>
                            <div className="h-[150px] flex items-end gap-4">
                                {chartDataValues.map((val, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full group/bar">
                                        {/* Qiymat ustun tepasida doim ko'rinadi — avval u faqat
                                            sichqoncha olib borilganda chiqardi, ya'ni grafikdan
                                            aniq son o'qib bo'lmasdi. */}
                                        <span className={`num text-[11px] ${val >= maxVal ? 'text-[#1b6b6b] dark:text-teal-400' : 'text-gray-400'}`}>
                                            {val.toFixed(1)}
                                        </span>
                                        <div
                                            className={`w-full rounded-lg transition-colors cursor-pointer min-h-[4px] ${val >= maxVal ? 'bg-[#1b6b6b]' : 'bg-[#1b6b6b]/45 group-hover/bar:bg-[#1b6b6b]'}`}
                                            style={{ height: `${(val / maxVal) * 110}px` }}
                                        />
                                        <span className="text-[11px] text-gray-400">{chartLabels[i]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right 1 Column */}
                <div className="space-y-6">
                    {/* Bugun hal qilinsin — sanoqlar emas, aniq ish. Har bir qator
                        o'sha ishni bajaradigan sahifaga olib boradi. Ro'yxat bo'sh
                        bo'lsa blok umuman ko'rsatilmaydi. */}
                    {todoItems.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50">
                                <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white">Bugun hal qilinsin</h3>
                            </div>
                            <div className="divide-y divide-gray-55 dark:divide-gray-700/40">
                                {todoItems.map(item => (
                                    <button key={item.key} onClick={() => navigate(item.path)}
                                        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-55/70 dark:hover:bg-gray-900/30 transition-colors cursor-pointer">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${item.tone}`} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                                            <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>
                                        </div>
                                        <ChevronRight size={15} className="text-gray-300 dark:text-gray-600 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Top Courses — bo'sh bo'lsa umuman ko'rsatilmaydi */}
                    {topCourseStats.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
                        <div className="mb-4">
                            <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white">Eng ko'p tushum keltirgan kurslar</h3>
                        </div>
                        <div className="space-y-4">
                            {topCourseStats.map((course, i) => (
                                <div key={i}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[12px] text-gray-700 dark:text-gray-300 truncate">{course.name}</span>
                                        <span className="num text-[12px] text-gray-500 dark:text-gray-400 shrink-0">{(course.revenue / 1000000).toFixed(1)} mln</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-50 dark:bg-gray-900 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#1b6b6b] rounded-full transition-all duration-700"
                                            style={{ width: `${(course.revenue / (topCourseStats[0]?.revenue || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-1"><span className="num">{course.students}</span> ta o'quvchi</p>
                                </div>
                            ))}
                            {topCourseStats.length === 0 && (
                                <p className="text-[11px] text-gray-400 font-bold text-center py-4 uppercase tracking-wider">Ma'lumotlar yo'q</p>
                            )}
                        </div>
                    </div>
                    )}
                </div>
            </div>

            {/* Reports Section integrated into Dashboard */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-gray-50 dark:border-gray-800 pb-4 mb-5">
                    <div>
                        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">{t('reports_title')}</h3>
                        <p className="text-[12px] text-gray-400 mt-0.5">Tanlangan muddat uchun markaz ko'rsatkichlari</p>
                    </div>
                    {/* Secondary Tabs for Reports */}
                    {/* `overflow-x-auto` aylantirish uchun kerak edi, lekin brauzer
                        bunday elementni ikkala yo'nalishda ham kesadi — shuning uchun
                        "Boshqalar" ro'yxati tugma ostida ochilib, ko'rinmay qolardi.
                        Endi aylantirish faqat asosiy tablarga tegishli, ro'yxat esa
                        kesuvchi konteynerdan tashqarida. */}
                    <div className="flex items-center gap-1 bg-gray-55 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-800 max-w-full">
                      <div className="flex overflow-x-auto no-scrollbar flex-nowrap gap-1 min-w-0">
                        {PRIMARY_REPORTS.map(r => (
                            <button
                                key={r.id}
                                onClick={() => {
                                    setActiveReportTab(r.id);
                                    setIsDropdownOpen(false);
                                }}
                                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                                    activeReportTab === r.id
                                        ? 'bg-[#1b6b6b] text-white font-semibold'
                                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                <span className="shrink-0">{r.icon}</span>
                                <span>{r.label}</span>
                            </button>
                        ))}

                      </div>

                        {/* Secondary reports dropdown button */}
                        <div className="relative shrink-0">
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                                    SECONDARY_REPORTS.some(r => r.id === activeReportTab)
                                        ? 'bg-[#1b6b6b] text-white font-semibold'
                                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                <span className="shrink-0">
                                    {SECONDARY_REPORTS.find(r => r.id === activeReportTab)?.icon || <MoreHorizontal size={12} />}
                                </span>
                                <span>
                                    {SECONDARY_REPORTS.find(r => r.id === activeReportTab)?.label || t('more')}
                                </span>
                                <ChevronDown size={10} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isDropdownOpen && (
                                <>
                                    {/* Backdrop to close dropdown */}
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setIsDropdownOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-gray-800 rounded-xl border border-gray-150 dark:border-gray-800 shadow-lg p-1 z-20 animate-in fade-in slide-in-from-top-1 duration-100">
                                        {SECONDARY_REPORTS.map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => {
                                                    setActiveReportTab(r.id);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[12px] font-medium text-left transition-colors ${
                                                    activeReportTab === r.id
                                                        ? 'bg-[#1b6b6b]/10 text-[#1b6b6b] dark:text-teal-400'
                                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                            >
                                                <span className="shrink-0">{r.icon}</span>
                                                <span className="truncate">{r.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden">
                    {renderReportContent()}
                </div>
            </div>

            {/* Room Schedule */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
                <RoomSchedule />
            </div>
        </div>
    );
}
