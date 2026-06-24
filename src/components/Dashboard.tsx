import React, { useState, useMemo } from 'react';
import { 
  Users, GraduationCap, Target, 
  TrendingUp, TrendingDown, ArrowUpRight, 
  Activity, Calendar, Clock, ChevronRight, BookOpen, BarChart3, LayoutDashboard, FileText, UserMinus, Award, Star
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
    const { students, groups, teachers, leads, payments, courses } = useCRM();
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
    
    const debtTrend = -5.1; 

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
            .reduce((acc, p) => acc + p.amount, 0) / 1000000; // In millions
    });

    const chartLabels = last6Months.map(m => m.label);
    const total6Months = chartDataValues.reduce((acc, v) => acc + v, 0);
    const maxVal = Math.max(...chartDataValues, 0.1);

    const courseStatsMap: { [key: string]: { name: string, students: number, revenue: number } } = {};
    
    courses.filter(c => c.name !== 'birinchi').forEach(c => {
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

    const stats = [
        { label: t('stat_active_students'), value: students.filter(s => s.status === 'Faol').length, icon: GraduationCap, accent: '#1b6b6b', path: '/students' },
        { label: t('stat_groups'), value: groups.length, icon: Users, accent: '#6366f1', path: '/courses' },
        { label: t('stat_teachers'), value: teachers.filter(t => t.status === 'Faol').length, icon: BookOpen, accent: '#f59e0b', path: '/teachers' },
        { label: t('stat_new_leads'), value: periodNewLeads, icon: Target, accent: '#ec4899', path: '/leads' },
    ];

    const DASHBOARD_REPORTS = [
        { id: 'stats', label: t('rep_stats'), icon: <FileText size={12} /> },
        { id: 'leads', label: t('rep_leads'), icon: <Target size={12} /> },
        { id: 'students_general', label: t('rep_students_general'), icon: <Users size={12} /> },
        { id: 'graduates', label: t('rep_graduates'), icon: <GraduationCap size={12} /> },
        { id: 'left_students', label: t('rep_left_students'), icon: <UserMinus size={12} /> },
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
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-lg shadow-[#1b6b6b]/20">
                            <LayoutDashboard size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('dashboard_title')}</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                {t('dashboard_subtitle')}
                            </p>
                        </div>
                    </div>

                    {/* Presets and Custom Inputs */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Presets */}
                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-700/50">
                            {['this_month', 'last_30', 'this_year', 'all'].map((type) => {
                                const label = type === 'this_month' ? t('preset_this_month') : type === 'last_30' ? t('preset_30_days') : type === 'this_year' ? t('preset_this_year') : t('preset_all');
                                return (
                                    <button 
                                        key={type}
                                        type="button"
                                        onClick={() => handlePreset(type as any)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                                            selectedPreset === type
                                                ? 'bg-[#1b6b6b] text-white shadow'
                                                : 'text-gray-400 hover:text-gray-600'
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
                                className="bg-gray-55 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none focus:border-[#1b6b6b] w-32 cursor-pointer"
                            />
                            <span className="text-gray-400 dark:text-gray-500 font-extrabold text-[9px] uppercase tracking-wider">{t('date_to')}</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setSelectedPreset('custom'); }}
                                className="bg-gray-55 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none focus:border-[#1b6b6b] w-32 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <div
                            key={idx}
                            onClick={() => navigate(stat.path)}
                            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5 hover:shadow-lg hover:border-gray-250 transition-all cursor-pointer group flex items-center justify-between"
                        >
                            <div>
                                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1">{stat.label}</span>
                                <h4 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight tabular-nums">{stat.value}</h4>
                            </div>
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
                                style={{ backgroundColor: stat.accent + '15', color: stat.accent }}
                            >
                                <Icon size={18} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Main Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left 2 Columns */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <TrendingUp size={16} className="text-[#1b6b6b]" />
                                {t('finance_title')}
                            </h3>
                            <button onClick={() => navigate('/finance')} className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-[#1b6b6b] hover:text-[#155252] transition-colors cursor-pointer">
                                {t('rep_stats')} <ArrowUpRight size={12} />
                            </button>
                        </div>
                        
                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            {[
                                { label: t('income'), value: `${(periodIncome / 1000000).toFixed(1)}M`, trend: `${incomeTrend > 0 ? '+' : ''}${incomeTrend.toFixed(1)}%`, positive: incomeTrend >= 0, icon: TrendingUp },
                                { label: t('expected'), value: `${(monthlyExpected / 1000000).toFixed(1)}M`, trend: '+2.4%', positive: true, icon: Clock },
                                { label: t('debt'), value: `${(totalDebt / 1000000).toFixed(1)}M`, trend: `${debtTrend > 0 ? '+' : ''}${debtTrend.toFixed(1)}%`, positive: debtTrend <= 0, icon: TrendingDown },
                            ].map((item, i) => (
                                <div key={i} className="bg-gray-55 dark:bg-gray-900/60 rounded-2xl p-4 border border-gray-100 dark:border-gray-700/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{item.label}</span>
                                        <item.icon size={14} className={item.positive ? 'text-emerald-500' : 'text-rose-500'} />
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <span className="text-lg font-black text-gray-900 dark:text-white tabular-nums">{item.value}</span>
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${
                                            item.positive 
                                                ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20' 
                                                : 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20'
                                        }`}>
                                            {item.trend}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Chart Area */}
                        <div className="bg-gray-55 dark:bg-gray-900/40 rounded-2xl p-5 border border-gray-100 dark:border-gray-700/50">
                            <div className="flex items-center justify-between mb-5">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">So'nggi 6 oy (mln so'm)</span>
                                <span className="text-[9px] font-black text-[#1b6b6b] uppercase tracking-wider tabular-nums">Jami: {total6Months.toFixed(1)}M</span>
                            </div>
                            <div className="h-[150px] flex items-end gap-4">
                                {chartDataValues.map((val, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group/bar relative">
                                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-[9px] px-2 py-1 rounded-md opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10 font-bold">
                                            {val.toFixed(1)} mln
                                        </div>
                                        <div 
                                            className="w-full bg-[#1b6b6b] rounded-lg hover:bg-[#2e9c9c] transition-colors cursor-pointer min-h-[4px]"
                                            style={{ height: `${(val / maxVal) * 110}px` }}
                                        />
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{chartLabels[i]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right 1 Column */}
                <div className="space-y-6">
                    {/* Attention list */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <Activity size={16} className="text-rose-500" />
                                {t('attention_title')}
                            </h3>
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                        </div>
                        <div className="space-y-2">
                            {[
                                { title: `${students.filter(s => s.balance < 0).length} ${t('attention_debtors')}`, desc: t('attention_debt_desc'), icon: Clock, color: '#ef4444', path: '/finance' },
                                { title: `${leads.filter(l => l.status === 'Yangi').length} ${t('stat_new_leads').toLowerCase()}`, desc: t('attention_leads_desc'), icon: Target, color: '#f59e0b', path: '/leads' },
                                { title: groups[0]?.name || t('stat_groups'), desc: t('attention_top_group'), icon: Calendar, color: '#1b6b6b', path: '/courses' },
                            ].map((item, i) => (
                                <div
                                    key={i}
                                    onClick={() => navigate(item.path)}
                                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900/60 cursor-pointer transition-colors group border border-transparent hover:border-gray-100"
                                >
                                    <div
                                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: item.color + '15', color: item.color }}
                                    >
                                        <item.icon size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate uppercase tracking-tight">{item.title}</p>
                                        <p className="text-[9px] text-gray-400 font-bold block mt-0.5 uppercase tracking-widest">{item.desc}</p>
                                    </div>
                                    <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Courses */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <BarChart3 size={16} className="text-[#1b6b6b]" />
                                Top Kurslar
                            </h3>
                        </div>
                        <div className="space-y-4">
                            {topCourseStats.map((course, i) => (
                                <div key={i}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[130px] uppercase tracking-wide">{course.name}</span>
                                        <span className="text-[10px] font-black text-[#1b6b6b] tabular-nums">{(course.revenue / 1000000).toFixed(1)}M UZS</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-50 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#1b6b6b] rounded-full transition-all duration-700"
                                            style={{ width: `${(course.revenue / (topCourseStats[0]?.revenue || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{course.students} ta o'quvchi</p>
                                </div>
                            ))}
                            {topCourseStats.length === 0 && (
                                <p className="text-[10px] text-gray-400 font-bold text-center py-4 uppercase tracking-widest">Ma'lumotlar yo'q</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Reports Section integrated into Dashboard */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-gray-50 dark:border-gray-700/50 pb-4 mb-6">
                    <div>
                        <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <BarChart3 size={16} className="text-[#1b6b6b]" />
                            {t('reports_title')}
                        </h3>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Markaz tahliliy ko'rsatkichlari (Tanlangan muddat uchun)</p>
                    </div>
                    {/* Secondary Tabs for Reports */}
                    <div className="flex flex-wrap gap-1 bg-gray-55 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700/50 w-fit">
                        {DASHBOARD_REPORTS.map(r => (
                            <button
                                key={r.id}
                                onClick={() => setActiveReportTab(r.id)}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                                    activeReportTab === r.id
                                        ? 'bg-[#1b6b6b] text-white shadow'
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-hidden">
                    {renderReportContent()}
                </div>
            </div>

            {/* Room Schedule */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                <RoomSchedule />
            </div>
        </div>
    );
}
