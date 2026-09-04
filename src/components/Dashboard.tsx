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
import { displayName } from '../lib/displayName';

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
    // Sig'im faqat hamma guruhga xona biriktirilganda ma'noli: aks holda bitta
    // guruhning 80 o'rni butun markaz uchun "100% band" deb chiqib ketardi.
    const groupsWithoutRoom = groups.filter(g => !rooms.find(r => r.id === g.room)).length;
    const totalSeats = groups.reduce((n, g) => n + (rooms.find(r => r.id === g.room)?.capacity || 0), 0);
    const seatsPct = groupsWithoutRoom === 0 && totalSeats > 0 ? Math.min(100, Math.round((activeStudents / totalSeats) * 100)) : null;

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
            tone: 'bg-xato',
            title: `${staleDebtors.length} ta o'quvchi 30+ kun to'lov qilmagan`,
            sub: `Jami ${(staleDebtSum / 1000000).toFixed(1)} mln so'm`,
            path: '/students?filter=debt',
        },
        staleLeads.length > 0 && {
            key: 'leads',
            tone: 'bg-ogoh',
            title: `${staleLeads.length} ta lid javobsiz qolgan`,
            sub: `Eng qadimgisi — ${oldestLeadAge} kun oldin`,
            path: '/leads',
        },
        groupsMissingAttendance.length > 0 && {
            key: 'att',
            tone: 'bg-brand',
            title: `${groupsMissingAttendance.length} ta guruh davomati kiritilmagan`,
            sub: groupsMissingAttendance.slice(0, 2).map(g => g.name).join(', '),
            path: `/courses/${groupsMissingAttendance[0].id}`,
        },
    ].filter(Boolean) as { key: string; tone: string; title: string; sub: string; path: string }[];

    // ---- Bugungi darslar.
    // Faqat jadvali kiritilgan guruhlar. "Belgilanmagan" kunli guruh uchun
    // dars bor deb taxmin qilinmaydi — aks holda ro'yxat o'ylab topilgan
    // bo'lib chiqadi.
    const dowToday = new Date().getDay();
    const todayISO = new Date().toISOString().slice(0, 10);
    const yesterdayISO = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const runsToday = (days: string) => {
        if (days === 'TOQ') return [1, 3, 5].includes(dowToday);
        if (days === 'JUFT') return [2, 4, 6].includes(dowToday);
        if (days === 'HAR_KUNI' || days === 'HARKUNI') return dowToday !== 0;
        return false;
    };

    const todayLessons = groups.filter(g => runsToday(g.days)).map(g => {
        const sched = (g.schedule || '').trim();
        const teacher = teachers.find(tt => tt.id === g.teacherId);
        const room = rooms.find(r => r.id === g.room);
        return {
            id: g.id,
            name: g.name,
            time: sched && !sched.includes('Belgilanmagan') ? sched : null,
            teacher: teacher ? displayName(teacher.name) : null,
            room: room ? room.name : null,
            marked: (attendances || []).some(a => a.groupId === g.id && (a.date || '').slice(0, 10) === todayISO),
        };
    }).sort((a, b) => (a.time || 'zz').localeCompare(b.time || 'zz'));

    const unmarkedToday = todayLessons.filter(l => !l.marked).length;

    // ---- So'nggi to'lovlar. Manfiy yozuvlar oylik hisob, ular to'lov emas.
    const uzDayLabel = (iso: string) => {
        const d = (iso || '').slice(0, 10);
        if (d === todayISO) return 'bugun';
        if (d === yesterdayISO) return 'kecha';
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? d : `${dt.getDate()}-${UZ_MONTHS[dt.getMonth()]}`;
    };

    const recentPayments = (payments || [])
        .filter(p => p.amount > 0 && (p.date || '').slice(0, 10) <= todayISO)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id)
        .slice(0, 5)
        .map(p => {
            const st = students.find(x => x.id === p.studentId);
            return {
                id: p.id,
                studentId: p.studentId,
                name: st ? displayName(st.name) : "O'chirilgan o'quvchi",
                amount: p.amount,
                when: uzDayLabel(p.date),
                type: (p.type || '').toLowerCase(),
            };
        });

    // ---- Guruhlar ko'rsatkichi.
    const groupsWithoutTeacher = groups.filter(g => !teachers.find(tt => tt.id === g.teacherId)).length;

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
                        <h1 className="text-[26px] font-bold text-matn tracking-tight leading-tight">
                            Xush kelibsiz, {(user?.name || '').split(' ')[0] || t('dashboard_title')}
                        </h1>
                        <p className="text-[13px] text-matn-sokin mt-1">
                            {todayLabel}
                            {todoItems.length > 0 && <> · <span className="num">{todoItems.length}</span> ta ish e'tiboringizni kutmoqda</>}
                        </p>
                    </div>

                    {/* Presets and Custom Inputs */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Presets */}
                        <div className="flex items-center gap-1 bg-ichki p-1 rounded-xl border border-chiziq">
                            {['this_month', 'last_30', 'this_year', 'all'].map((type) => {
                                const label = type === 'this_month' ? t('preset_this_month') : type === 'last_30' ? t('preset_30_days') : type === 'this_year' ? t('preset_this_year') : t('preset_all');
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handlePreset(type as any)}
                                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                                            selectedPreset === type
                                                ? 'bg-brand text-brand-ust'
                                                : 'text-matn-xira hover:text-gray-600 dark:hover:text-gray-200'
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
                                className="bg-ichki px-3 py-1.5 rounded-xl border border-chiziq text-xs font-bold text-matn-2 outline-none focus:border-brand w-32 cursor-pointer"
                            />
                            <span className="text-matn-xira font-extrabold text-[11px]">{t('date_to')}</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setSelectedPreset('custom'); }}
                                className="bg-ichki px-3 py-1.5 rounded-xl border border-chiziq text-xs font-bold text-matn-2 outline-none focus:border-brand w-32 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Uchta asosiy ko'rsatkich. Avval to'rtta mayda karta bor edi
                (o'quvchi / guruh / ustoz / lid) — ular shunchaki sanoq bo'lib,
                holatni ko'rsatmasdi. Endi har birida nisbat chizig'i bor. */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <div onClick={() => navigate('/students')}
                    className="bg-sirt rounded-xl border border-chiziq p-4 cursor-pointer hover:border-chiziq-kuchli transition-colors">
                    <span className="text-[12px] text-matn-sokin">{t('stat_active_students')}</span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="raqam text-[27px] font-semibold leading-none text-matn">{activeStudents}</span>
                        {joinedThisMonth > 0 && (
                            <span className="raqam text-[13px] text-yaxshi">+{joinedThisMonth}</span>
                        )}
                    </div>
                    {seatsPct !== null ? (
                        <>
                            <div className="mt-2.5 h-1 rounded-full bg-chiziq overflow-hidden">
                                <div className="h-full rounded-full bg-brand" style={{ width: `${seatsPct}%` }} />
                            </div>
                            <span className="text-[11px] text-matn-xira block mt-1.5">
                                <span className="raqam">{totalSeats}</span> o'rindan <span className="raqam">{seatsPct}%</span> band
                            </span>
                        </>
                    ) : (
                        <span className="text-[11px] text-matn-xira block mt-2">
                            {groupsWithoutRoom > 0 ? <><span className="raqam">{groupsWithoutRoom}</span> ta guruhga xona biriktirilmagan</> : "Xona sig'imi kiritilmagan"}
                        </span>
                    )}
                </div>

                <div onClick={() => navigate('/finance')}
                    className="bg-sirt rounded-xl border border-chiziq p-4 cursor-pointer hover:border-chiziq-kuchli transition-colors">
                    <span className="text-[12px] text-matn-sokin">{t('income')}</span>
                    <div className="mt-1 flex items-baseline">
                        <span className="raqam text-[27px] font-semibold leading-none text-matn">{(periodIncome / 1000000).toFixed(1)}</span>
                        <span className="raqam text-[13px] text-matn-xira ml-1">mln</span>
                    </div>
                    {incomePct !== null ? (
                        <>
                            <div className="mt-2.5 h-1 rounded-full bg-chiziq overflow-hidden">
                                <div className="h-full rounded-full bg-brand" style={{ width: `${incomePct}%` }} />
                            </div>
                            <span className="text-[11px] text-matn-xira block mt-1.5">
                                kutilgan <span className="raqam">{(monthlyExpected / 1000000).toFixed(1)}</span> mln dan <span className="raqam">{incomePct}%</span>
                            </span>
                        </>
                    ) : (
                        <span className="text-[11px] text-matn-xira block mt-2">Kutilayotgan summa hisoblanmadi</span>
                    )}
                </div>

                <div onClick={() => navigate('/students?filter=debt')}
                    className="bg-xato-fon rounded-xl border border-xato-chiziq p-4 cursor-pointer hover:border-xato transition-colors">
                    <span className="text-[12px] text-matn-sokin">{t('debt')}</span>
                    <div className="mt-1 flex items-baseline">
                        <span className="raqam text-[27px] font-semibold leading-none text-xato">{(totalDebt / 1000000).toFixed(1)}</span>
                        <span className="raqam text-[13px] text-matn-xira ml-1">mln</span>
                    </div>
                    <div className="mt-2.5 h-1 rounded-full bg-chiziq overflow-hidden flex">
                        {debtors.length > 0 && (
                            <>
                                <div className="h-full bg-ogoh" style={{ width: `${Math.round(((debtors.length - staleDebtors.length) / debtors.length) * 100)}%` }} />
                                <div className="h-full bg-xato" style={{ width: `${Math.round((staleDebtors.length / debtors.length) * 100)}%` }} />
                            </>
                        )}
                    </div>
                    <span className="text-[11px] text-xato-mayin block mt-1.5">
                        <span className="raqam">{debtors.length}</span> o'quvchi · <span className="raqam">{staleDebtors.length}</span> tasi 30 kundan oshgan
                    </span>
                </div>

                {/* Guruhlar. Sonning o'zi yomon xabar emas, shuning uchun raqam
                    oddiy rangda — ogohlantirish faqat izohda. */}
                <div onClick={() => navigate('/courses')}
                    className="bg-sirt rounded-xl border border-chiziq p-4 cursor-pointer hover:border-chiziq-kuchli transition-colors">
                    <span className="text-[12px] text-matn-sokin">{t('nav_groups')}</span>
                    <div className="mt-1 flex items-baseline">
                        <span className="raqam text-[27px] font-semibold leading-none text-matn">{groups.length}</span>
                    </div>
                    <span className={`text-[11px] block mt-2 ${groupsWithoutTeacher > 0 ? 'text-ogoh' : 'text-matn-xira'}`}>
                        {groupsWithoutTeacher > 0
                            ? <><span className="raqam">{groupsWithoutTeacher}</span> tasiga ustoz biriktirilmagan</>
                            : <><span className="raqam">{groups.reduce((n, g) => n + (g.studentIds || []).length, 0)}</span> ta o'quvchi biriktirilgan</>}
                    </span>
                </div>
            </div>

            {/* Asosiy qism — chizmadagi ikki qator.
                Chapda keng bloklar, o'ngda tor bloklar. Ilgari o'ng ustun
                chapdan ancha kalta tugab, sahifa pastida katta quruq maydon
                qolar edi; endi ikkala ustunda ham mazmun bor. */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">

                {/* ---- CHAP USTUN ---- */}
                <div className="xl:col-span-2 space-y-4">

                    {/* Tushum grafigi. Ilgari kartochka ichida yana bir
                        kartochka bor edi — ikki qavat ramka va ikki qavat
                        ichki bo'shliq. Endi bitta qavat. */}
                    <div className="bg-sirt rounded-xl border border-chiziq p-5">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-[15px] font-semibold text-matn">{t('finance_title')}</h3>
                                <p className="text-[12px] text-matn-sokin mt-0.5">
                                    So'nggi 6 oy, mln so'm · jami <span className="raqam text-matn-2">{total6Months.toFixed(1)}</span> mln
                                </p>
                            </div>
                            <button onClick={() => navigate('/finance')} className="flex items-center gap-1 text-[12px] text-brand hover:underline cursor-pointer shrink-0">
                                {t('rep_stats')} <ArrowUpRight size={13} />
                            </button>
                        </div>
                        <div className="h-[152px] flex items-end gap-4">
                            {chartDataValues.map((val, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full group/bar">
                                    {/* Qiymat ustun tepasida doim ko'rinadi — avval u faqat
                                        sichqoncha olib borilganda chiqardi, ya'ni grafikdan
                                        aniq son o'qib bo'lmasdi. */}
                                    <span className={`num text-[11px] ${val >= maxVal ? 'text-brand' : 'text-matn-xira'}`}>
                                        {val.toFixed(1)}
                                    </span>
                                    <div
                                        className={`w-full rounded-t-md bg-brand transition-opacity cursor-pointer min-h-[3px] ${val >= maxVal ? 'opacity-100' : 'opacity-40 group-hover/bar:opacity-100'}`}
                                        style={{ height: `${(val / maxVal) * 112}px` }}
                                    />
                                    <span className="text-[11px] text-matn-xira">{chartLabels[i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bugungi darslar. Jadvali kiritilmagan guruh bu yerga
                        tushmaydi — dars bor deb taxmin qilinmaydi. */}
                    <div className="bg-sirt rounded-xl border border-chiziq overflow-hidden">
                        <div className="flex items-baseline justify-between px-4 pt-3.5 pb-3">
                            <h3 className="text-[15px] font-semibold text-matn">Bugungi darslar</h3>
                            {todayLessons.length > 0 && (
                                <span className="text-[12px] text-matn-sokin">
                                    <span className="raqam">{todayLessons.length}</span> ta dars
                                    {unmarkedToday > 0 && <> · <span className="raqam">{unmarkedToday}</span> tasida davomat yo'q</>}
                                </span>
                            )}
                        </div>
                        {todayLessons.length === 0 ? (
                            <div className="px-4 py-9 text-center border-t border-chiziq-mayin">
                                <p className="text-[13px] text-matn-sokin">Bugunga dars belgilanmagan</p>
                                <p className="text-[11px] text-matn-xira mt-1">Guruhga kun va vaqt kiritilsa, bugungi darslar shu yerda chiqadi</p>
                            </div>
                        ) : todayLessons.map(l => (
                            <button key={l.id} onClick={() => navigate(`/courses/${l.id}`)}
                                className="w-full flex items-center gap-3.5 px-4 py-3 text-left border-t border-chiziq-mayin hover:bg-ichki transition-colors cursor-pointer">
                                <span className={`num text-[12px] w-[96px] shrink-0 ${l.time ? 'text-matn-2' : 'text-matn-xira'}`}>
                                    {l.time || 'vaqt yo\u2019q'}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="text-[13px] text-matn block truncate">{l.name}</span>
                                    <span className="text-[11px] text-matn-xira block truncate">
                                        {[l.teacher, l.room].filter(Boolean).join(' \u00b7 ') || 'ustoz va xona kiritilmagan'}
                                    </span>
                                </span>
                                <span className={`flex items-center gap-2 text-[12px] shrink-0 ${l.marked ? 'text-yaxshi' : 'text-ogoh'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${l.marked ? 'bg-yaxshi' : 'bg-ogoh'}`} />
                                    {l.marked ? 'davomat olindi' : 'davomat kiritilmagan'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ---- O'NG USTUN ---- */}
                <div className="space-y-4">

                    {/* Bugun hal qilinsin — sanoqlar emas, aniq ish. Har bir qator
                        o'sha ishni bajaradigan sahifaga olib boradi. Ro'yxat bo'sh
                        bo'lsa blok umuman ko'rsatilmaydi. */}
                    {todoItems.length > 0 && (
                        <div className="bg-sirt rounded-xl border border-chiziq overflow-hidden">
                            <div className="px-4 pt-3.5 pb-3">
                                <h3 className="text-[15px] font-semibold text-matn">Bugun hal qilinsin</h3>
                            </div>
                            {todoItems.map(item => (
                                <button key={item.key} onClick={() => navigate(item.path)}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-t border-chiziq-mayin hover:bg-ichki transition-colors cursor-pointer">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.tone}`} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] text-matn truncate">{item.title}</p>
                                        <p className="text-[11px] text-matn-xira truncate">{item.sub}</p>
                                    </div>
                                    <ChevronRight size={15} className="text-matn-xira shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* So'nggi to'lovlar. Manfiy yozuvlar oylik hisob, ular
                        to'lov emas — shuning uchun bu yerga tushmaydi. */}
                    <div className="bg-sirt rounded-xl border border-chiziq overflow-hidden">
                        <div className="flex items-baseline justify-between px-4 pt-3.5 pb-3">
                            <h3 className="text-[15px] font-semibold text-matn">So'nggi to'lovlar</h3>
                            <button onClick={() => navigate('/finance')} className="text-[12px] text-brand hover:underline cursor-pointer">Barchasi</button>
                        </div>
                        {recentPayments.length === 0 ? (
                            <div className="px-4 py-9 text-center border-t border-chiziq-mayin">
                                <p className="text-[13px] text-matn-sokin">Hali to'lov qabul qilinmagan</p>
                            </div>
                        ) : recentPayments.map(p => (
                            <button key={p.id} onClick={() => navigate(`/students/${p.studentId}`)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left border-t border-chiziq-mayin hover:bg-ichki transition-colors cursor-pointer">
                                <span className="min-w-0 flex-1">
                                    <span className="text-[13px] text-matn block truncate">{p.name}</span>
                                    <span className="text-[11px] text-matn-xira block truncate">{p.when} · {p.type}</span>
                                </span>
                                <span className="num text-[13px] text-yaxshi shrink-0">+{p.amount.toLocaleString('ru-RU')}</span>
                            </button>
                        ))}
                    </div>

                    {/* Eng ko'p tushum keltirgan kurslar — bo'sh bo'lsa ko'rsatilmaydi */}
                    {topCourseStats.length > 0 && (
                    <div className="bg-sirt rounded-xl border border-chiziq p-4">
                        <h3 className="text-[15px] font-semibold text-matn mb-3.5">Eng ko'p tushum keltirgan kurslar</h3>
                        <div className="space-y-3.5">
                            {topCourseStats.map((course, i) => (
                                <div key={i}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[12px] text-matn-2 truncate">{course.name}</span>
                                        <span className="num text-[12px] text-matn-sokin shrink-0">{(course.revenue / 1000000).toFixed(1)} mln</span>
                                    </div>
                                    <div className="h-1 w-full bg-chiziq rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-brand rounded-full transition-all duration-700"
                                            style={{ width: `${(course.revenue / (topCourseStats[0]?.revenue || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-[11px] text-matn-xira mt-1"><span className="raqam">{course.students}</span> ta o'quvchi</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    )}
                </div>
            </div>

            {/* Reports Section integrated into Dashboard */}
            <div className="bg-sirt rounded-2xl border border-chiziq p-5 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-chiziq-mayin pb-4 mb-5">
                    <div>
                        <h3 className="text-[15px] font-semibold text-matn">{t('reports_title')}</h3>
                        <p className="text-[12px] text-matn-xira mt-0.5">Tanlangan muddat uchun markaz ko'rsatkichlari</p>
                    </div>
                    {/* Secondary Tabs for Reports */}
                    {/* `overflow-x-auto` aylantirish uchun kerak edi, lekin brauzer
                        bunday elementni ikkala yo'nalishda ham kesadi — shuning uchun
                        "Boshqalar" ro'yxati tugma ostida ochilib, ko'rinmay qolardi.
                        Endi aylantirish faqat asosiy tablarga tegishli, ro'yxat esa
                        kesuvchi konteynerdan tashqarida. */}
                    <div className="flex items-center gap-1 bg-ichki p-1 rounded-xl border border-chiziq max-w-full">
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
                                        ? 'bg-brand text-brand-ust font-semibold'
                                        : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-300'
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
                                        ? 'bg-brand text-brand-ust font-semibold'
                                        : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-300'
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
                                    <div className="absolute right-0 mt-1.5 w-44 bg-sirt rounded-xl border border-chiziq shadow-lg p-1 z-20 animate-in fade-in slide-in-from-top-1 duration-100">
                                        {SECONDARY_REPORTS.map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => {
                                                    setActiveReportTab(r.id);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[12px] font-medium text-left transition-colors ${
                                                    activeReportTab === r.id
                                                        ? 'bg-brand/10 text-brand'
                                                        : 'text-matn-sokin hover:bg-gray-55 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-white'
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
            <div className="bg-sirt rounded-2xl border border-chiziq p-5 shadow-sm">
                <RoomSchedule />
            </div>
        </div>
    );
}
