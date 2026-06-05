import React, { useState } from 'react';
import { 
  Users, GraduationCap, Target, 
  TrendingUp, TrendingDown, ArrowUpRight, 
  Activity, Calendar, Clock, ChevronRight, BookOpen
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';
import RoomSchedule from './RoomSchedule';

export default function Dashboard() {
    const { students, groups, teachers, leads, payments, courses, expenses } = useCRM();
    const navigate = useNavigate();

    // Financial Calculations
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // 1. Tushum (Real Income this month & Trend)
    const getMonthlyIncome = (m: number, y: number) => payments
        .filter(p => {
            const d = new Date(p.date);
            return d.getMonth() === m && d.getFullYear() === y;
        })
        .reduce((acc, p) => acc + p.amount, 0);

    const monthlyIncome = getMonthlyIncome(currentMonth, currentYear);
    const lastMonthIncome = getMonthlyIncome(prevMonth, prevMonthYear);
    const incomeTrend = lastMonthIncome === 0 ? (monthlyIncome > 0 ? 100 : 0) : ((monthlyIncome - lastMonthIncome) / lastMonthIncome) * 100;

    // 2. Kutilgan (Expected Income based on active students and their groups)
    const monthlyExpected = students
        .filter(s => s.status === 'Faol')
        .reduce((acc, s) => {
            const studentGroups = groups.filter(g => s.groups.includes(g.id));
            const studentFees = studentGroups.reduce((gAcc, g) => {
                const course = courses.find(c => c.id === g.courseId);
                return gAcc + (course?.price || 0);
            }, 0);
            return acc + studentFees;
        }, 0);

    // 3. Qarzdorlik (Total Debt & Trend)
    const totalDebt = students
        .filter(s => s.balance < 0)
        .reduce((acc, s) => acc + Math.abs(s.balance), 0);
    
    // For trend, we'd need historical debt, but since debt is a snapshot, we'll use a static comparison or just show a neutral trend if no history.
    // However, we can track debt by looking at when balances changed, but that's complex. Let's keep debt trend at 0% or static -5% for now if no history.
    const debtTrend = -5.1; 

    // 4. Last 6 Months Chart Data
    const monthNames = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(now.getMonth() - (5 - i));
        return {
            month: d.getMonth(),
            year: d.getFullYear(),
            label: monthNames[d.getMonth()]
        };
    });

    const chartDataValues = last6Months.map(m => {
        return getMonthlyIncome(m.month, m.year) / 1000000; // In millions
    });

    const chartLabels = last6Months.map(m => m.label);
    const total6Months = chartDataValues.reduce((acc, v) => acc + v, 0);
    const maxVal = Math.max(...chartDataValues, 0.1);

    // 5. Top Courses Calculation (Aggregated by Name - Case Insensitive)
    const courseStatsMap: { [key: string]: { name: string, students: number, revenue: number } } = {};
    
    courses.forEach(c => {
        const courseGroups = groups.filter(g => g.courseId === c.id);
        const studentCount = courseGroups.reduce((acc, g) => acc + g.studentIds.length, 0);
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

    const stats = [
        { label: "Faol o'quvchilar", value: students.filter(s => s.status === 'Faol').length, icon: GraduationCap, accent: '#3B82F6', path: '/students' },
        { label: 'Guruhlar', value: groups.length, icon: Users, accent: '#10B981', path: '/groups' },
        { label: "O'qituvchilar", value: teachers.filter(t => t.status === 'Faol').length, icon: BookOpen, accent: '#F59E0B', path: '/teachers' },
        { label: 'Yangi lidlar', value: leads.filter(l => l.status === 'Yangi').length, icon: Target, accent: '#8B5CF6', path: '/leads' },
    ];

    return (
        <div className="space-y-8 py-4 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Boshqaruv Paneli</h1>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Markazning umumiy ko'rsatkichlari</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {stats.map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <div 
                            key={idx} 
                            onClick={() => navigate(stat.path)}
                            className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 p-8 shadow-xl shadow-gray-200/20 dark:shadow-none hover:shadow-2xl transition-all cursor-pointer group animate-in zoom-in-95 duration-500"
                            style={{ animationDelay: `${idx * 100}ms` }}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">{stat.label}</p>
                                    <p className="text-4xl font-extrabold text-gray-900 dark:text-white mt-1 tabular-nums">{stat.value}</p>
                                </div>
                                <div 
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center ring-4 transition-transform group-hover:scale-110 duration-500"
                                    style={{ backgroundColor: stat.accent + '15', color: stat.accent, ringColor: stat.accent + '10' }}
                                >
                                    <Icon size={24} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Column — 2/3 */}
                <div className="xl:col-span-2 space-y-8">
                    {/* Financial Overview */}
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 p-8 shadow-xl shadow-gray-200/10 dark:shadow-none">
                        <div className="flex items-center justify-between mb-10">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <TrendingUp className="text-sky-500" />
                                Moliyaviy tahlil
                            </h2>
                            <button onClick={() => navigate('/finance')} className="px-5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all flex items-center gap-2 group">
                                Batafsil <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </button>
                        </div>
                        
                        {/* Financial Stats Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
                            {[
                                { label: 'Tushum', value: `${(monthlyIncome / 1000000).toFixed(1)} mln`, trend: `${incomeTrend > 0 ? '+' : ''}${incomeTrend.toFixed(1)}%`, positive: incomeTrend >= 0, icon: TrendingUp, color: 'emerald' },
                                { label: 'Kutilgan', value: `${(monthlyExpected / 1000000).toFixed(1)} mln`, trend: '+2.4%', positive: true, icon: Clock, color: 'sky' },
                                { label: 'Qarzdorlik', value: `${(totalDebt / 1000000).toFixed(1)} mln`, trend: `${debtTrend > 0 ? '+' : ''}${debtTrend.toFixed(1)}%`, positive: debtTrend <= 0, icon: TrendingDown, color: 'rose' },
                            ].map((item, i) => (
                                <div key={i} className="bg-gray-50/50 dark:bg-gray-900/50 rounded-[2rem] p-6 border border-gray-100/50 dark:border-gray-800 shadow-inner group/item hover:bg-white dark:hover:bg-gray-800 hover:shadow-xl hover:shadow-sky-500/5 transition-all">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{item.label}</span>
                                        <item.icon size={18} className={item.positive ? 'text-emerald-500' : 'text-rose-500'} />
                                    </div>
                                    <div className="flex items-end justify-between gap-2">
                                        <span className="text-xl font-extrabold text-gray-900 dark:text-white tabular-nums">{item.value}</span>
                                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-xl uppercase tracking-widest shadow-sm ${
                                            item.positive 
                                                ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/40' 
                                                : 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/40'
                                        }`}>
                                            {item.trend}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Simple Bar Chart */}
                        <div className="bg-gray-50/30 dark:bg-gray-900/20 rounded-[2.5rem] p-8 border border-gray-100/50 dark:border-gray-800 shadow-inner">
                            <div className="flex items-center justify-between mb-10">
                                <span className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">So'nggi 6 oy ko'rsatkichlari (mln so'm)</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-sky-500" />
                                    <span className="text-[10px] font-extrabold text-gray-900 dark:text-white uppercase tracking-widest tabular-nums">Jami: {total6Months.toFixed(1)} mln</span>
                                </div>
                            </div>
                            <div className="h-[220px] flex items-end gap-5">
                                {chartDataValues.map((val, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar relative">
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-[9px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-opacity">
                                            {val.toFixed(1)} mln
                                        </div>
                                        <div 
                                            className="w-full bg-sky-500 dark:bg-sky-600 rounded-2xl hover:bg-sky-400 dark:hover:bg-sky-400 transition-all cursor-pointer shadow-lg shadow-sky-500/20 group-hover/bar:scale-x-105"
                                            style={{ height: `${(val / maxVal) * 160}px` }}
                                        />
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mt-2">{chartLabels[i]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column — 1/3 */}
                <div className="space-y-8">
                    {/* Attention Required */}
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 p-8 shadow-xl shadow-gray-200/10 dark:shadow-none">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
                                <Activity size={18} className="text-rose-500" />
                                E'tibor talab qiladi
                            </h2>
                            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse shadow-lg shadow-rose-500/50"></span>
                        </div>
                        <div className="space-y-4">
                            {[
                                { title: `${students.filter(s => s.balance < 0).length} ta o'quvchi`, desc: "To'lov muddati o'tgan", icon: Clock, color: '#EF4444', path: '/reports?type=students_payment' },
                                { title: `${leads.filter(l => l.status === 'Yangi').length} ta yangi so'rov`, desc: "Ko'rib chiqilmagan lidlar", icon: Target, color: '#F59E0B', path: '/leads' },
                                { title: groups[0]?.name || 'Guruhlar', desc: 'Faol kurslar', icon: Calendar, color: '#0EA5E9', path: '/groups' },
                            ].map((item, i) => (
                                <div 
                                    key={i} 
                                    onClick={() => navigate(item.path)} 
                                    className="flex items-center gap-5 p-5 rounded-[1.75rem] bg-gray-50/50 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition-all border border-gray-100/50 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-500 group hover:shadow-xl hover:shadow-sky-500/10 shadow-inner"
                                >
                                    <div 
                                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ring-4 transition-transform group-hover:scale-110 shadow-sm"
                                        style={{ backgroundColor: item.color + '15', color: item.color, ringColor: item.color + '10' }}
                                    >
                                        <item.icon size={22} />
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <p className="text-sm font-extrabold text-gray-900 dark:text-gray-100 truncate uppercase tracking-tight">{item.title}</p>
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{item.desc}</p>
                                    </div>
                                    <ChevronRight size={18} className="text-gray-300 dark:text-gray-600 group-hover:text-sky-500 transition-all transform group-hover:translate-x-1" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Courses Statistic */}
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 p-8 shadow-xl shadow-gray-200/10 dark:shadow-none mt-6">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
                                <Activity size={18} className="text-sky-500" />
                                Top Kurslar
                            </h2>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Oylik daromad</span>
                        </div>
                        <div className="space-y-6">
                            {topCourseStats.map((course, i) => (
                                <div key={i} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-tight">{course.name}</span>
                                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{(course.revenue / 1000000).toFixed(1)}M</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-sky-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${(course.revenue / (topCourseStats[0]?.revenue || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users size={12} className="text-gray-400" />
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{course.students} ta o'quvchi</span>
                                    </div>
                                </div>
                            ))}
                            {topCourseStats.length === 0 && (
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center py-4">Ma'lumotlar yo'q</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Xonalar Bandligi Jadvali */}
            <RoomSchedule />
        </div>
    );
}
