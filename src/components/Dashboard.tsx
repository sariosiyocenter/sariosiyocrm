import React from 'react';
import { 
  Users, GraduationCap, Target, 
  TrendingUp, TrendingDown, ArrowUpRight, 
  Activity, Calendar, Clock, ChevronRight, BookOpen, BarChart3, LayoutDashboard
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';
import RoomSchedule from './RoomSchedule';

export default function Dashboard() {
    const { students, groups, teachers, leads, payments, courses } = useCRM();
    const navigate = useNavigate();

    // Financial Calculations
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const getMonthlyIncome = (m: number, y: number) => payments
        .filter(p => {
            const d = new Date(p.date);
            return d.getMonth() === m && d.getFullYear() === y;
        })
        .reduce((acc, p) => acc + p.amount, 0);

    const monthlyIncome = getMonthlyIncome(currentMonth, currentYear);
    const lastMonthIncome = getMonthlyIncome(prevMonth, prevMonthYear);
    const incomeTrend = lastMonthIncome === 0 ? (monthlyIncome > 0 ? 100 : 0) : ((monthlyIncome - lastMonthIncome) / lastMonthIncome) * 100;

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

    const courseStatsMap: { [key: string]: { name: string, students: number, revenue: number } } = {};
    
    courses.forEach(c => {
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

    const stats = [
        { label: "Faol o'quvchilar", value: students.filter(s => s.status === 'Faol').length, icon: GraduationCap, accent: '#1b6b6b', path: '/students' },
        { label: 'Guruhlar', value: groups.length, icon: Users, accent: '#6366f1', path: '/groups' },
        { label: "O'qituvchilar", value: teachers.filter(t => t.status === 'Faol').length, icon: BookOpen, accent: '#f59e0b', path: '/teachers' },
        { label: 'Yangi lidlar', value: leads.filter(l => l.status === 'Yangi').length, icon: Target, accent: '#ec4899', path: '/leads' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-lg shadow-[#1b6b6b]/20">
                            <LayoutDashboard size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Boshqaruv Paneli</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                Markazning umumiy faoliyat statistikasi
                            </p>
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
                                Moliyaviy Tahlil
                            </h3>
                            <button onClick={() => navigate('/finance')} className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-[#1b6b6b] hover:text-[#155252] transition-colors cursor-pointer">
                                Batafsil <ArrowUpRight size={12} />
                            </button>
                        </div>
                        
                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            {[
                                { label: 'Tushum', value: `${(monthlyIncome / 1000000).toFixed(1)}M`, trend: `${incomeTrend > 0 ? '+' : ''}${incomeTrend.toFixed(1)}%`, positive: incomeTrend >= 0, icon: TrendingUp },
                                { label: 'Kutilgan', value: `${(monthlyExpected / 1000000).toFixed(1)}M`, trend: '+2.4%', positive: true, icon: Clock },
                                { label: 'Qarzdorlik', value: `${(totalDebt / 1000000).toFixed(1)}M`, trend: `${debtTrend > 0 ? '+' : ''}${debtTrend.toFixed(1)}%`, positive: debtTrend <= 0, icon: TrendingDown },
                            ].map((item, i) => (
                                <div key={i} className="bg-gray-50 dark:bg-gray-900/60 rounded-2xl p-4 border border-gray-100 dark:border-gray-700/50">
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
                        <div className="bg-gray-50/50 dark:bg-gray-900/40 rounded-2xl p-5 border border-gray-100 dark:border-gray-700/50">
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
                                E'tibor talab qiladi
                            </h3>
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                        </div>
                        <div className="space-y-2">
                            {[
                                { title: `${students.filter(s => s.balance < 0).length} ta qarzdor`, desc: "To'lov muddati o'tgan", icon: Clock, color: '#ef4444', path: '/reports' },
                                { title: `${leads.filter(l => l.status === 'Yangi').length} ta yangi lid`, desc: "Aloqaga chiqilmagan", icon: Target, color: '#f59e0b', path: '/leads' },
                                { title: groups[0]?.name || 'Guruhlar', desc: 'Eng faol guruh', icon: Calendar, color: '#1b6b6b', path: '/groups' },
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

            {/* Room Schedule */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                <RoomSchedule />
            </div>
        </div>
    );
}
