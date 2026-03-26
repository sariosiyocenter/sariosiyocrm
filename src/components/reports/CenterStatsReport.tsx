import React, { useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import { Activity, TrendingUp, Users, DollarSign, Target, Briefcase } from 'lucide-react';
import { StatCard, BarChart, LineChart, DonutChart, ReportCard, SectionHeader } from './shared';

export default function CenterStatsReport() {
    const { students, teachers, groups, leads, payments, expenses } = useCRM();

    const stats = useMemo(() => {
        const totalIncome = payments.reduce((s, p) => s + p.amount, 0);
        const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
        const netProfit = totalIncome - totalExpenses;
        
        // ROI % = (Net Profit / Investment) * 100
        const roiVal = totalExpenses > 0 ? ((netProfit / totalExpenses) * 100).toFixed(1) : '0';
        
        // Distribution (Real categories)
        const salaries = expenses.filter(e => e.category === 'Ish haqi').reduce((s, e) => s + e.amount, 0);
        const otherEx = totalExpenses - salaries;
        
        const distribution = [
            { label: "Xodimlar", value: salaries, color: "#0ea5e9" },
            { label: "Boshqa xarajat", value: otherEx, color: "#ef4444" },
            { label: "Sof foyda", value: Math.max(0, netProfit), color: "#10b981" }
        ];

        // Growth last 6 months
        const months = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
        const last6 = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (5 - i));
            return { m: d.getMonth(), y: d.getFullYear(), label: months[d.getMonth()] };
        });

        const growth = last6.map(m => {
            const count = students.filter(s => {
                const jd = new Date(s.joinedDate);
                return jd.getMonth() === m.m && jd.getFullYear() === m.y;
            }).length;
            return { label: m.label, value: count };
        });

        // Stats by course
        const courses: Record<string, number> = {};
        groups.forEach(g => {
            const n = g.courseName || 'Boshqa';
            courses[n] = (courses[n] || 0) + g.studentIds.length;
        });
        const dept = Object.entries(courses).map(([label, value]) => ({
            label,
            value,
            color: '#8b5cf6'
        })).sort((a,b) => b.value - a.value).slice(0, 5);

        return { totalIncome, totalExpenses, netProfit, roiVal, distribution, growth, dept };
    }, [students, groups, payments, expenses]);

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* KPI Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    label="Umumiy Tushum" 
                    value={`${(stats.totalIncome / 1000000).toFixed(1)}M`} 
                    sub="UZS"
                    icon={<DollarSign size={16} />} 
                    color="sky" 
                />
                <StatCard 
                    label="Jami Xarajat" 
                    value={`${(stats.totalExpenses / 1000000).toFixed(1)}M`} 
                    sub="UZS"
                    icon={<Activity size={16} />} 
                    color="rose" 
                />
                <StatCard 
                    label="ROI (Rentabellik)" 
                    value={`${stats.roiVal}%`} 
                    sub="investitsiyadan"
                    icon={<Target size={16} />} 
                    color="violet" 
                />
                <StatCard 
                    label="Faol O'quvchilar" 
                    value={students.filter(s => s.status === 'Faol').length} 
                    sub="ta o'quvchi"
                    icon={<Users size={16} />} 
                    color="emerald" 
                />
            </div>

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <ReportCard className="lg:col-span-2">
                    <SectionHeader title="Markaz O'sish Dinamikasi" sub="Yangi qo'shilgan o'quvchilar (6 oy)" />
                    <LineChart data={stats.growth} color="#8b5cf6" />
                </ReportCard>
                <ReportCard>
                    <SectionHeader title="Byudjet Taqsimoti" sub="Daromadning sarflanishi" />
                    <DonutChart slices={stats.distribution} />
                </ReportCard>
            </div>

            {/* Secondary Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ReportCard>
                    <SectionHeader title="Yo'nalishlar Kesimida Faollik" sub="O'quvchilar soni bo'yicha" />
                    {stats.dept.length > 0 ? (
                        <BarChart data={stats.dept} horizontal />
                    ) : (
                        <div className="h-[180px] flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ma'lumot mavjud emas</div>
                    )}
                </ReportCard>
                
                <div className="grid grid-cols-2 gap-4">
                    <ReportCard className="flex flex-col items-center justify-center text-center">
                        <Users className="text-sky-500 mb-2" size={24} />
                        <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{students.length}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Jami O'quvchi</p>
                    </ReportCard>
                    <ReportCard className="flex flex-col items-center justify-center text-center">
                        <Briefcase className="text-emerald-500 mb-2" size={24} />
                        <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{teachers.length}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Ustozlar</p>
                    </ReportCard>
                    <ReportCard className="flex flex-col items-center justify-center text-center">
                        <Activity className="text-violet-500 mb-2" size={24} />
                        <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{groups.length}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Guruhlar</p>
                    </ReportCard>
                    <ReportCard className="flex flex-col items-center justify-center text-center">
                        <Target className="text-amber-500 mb-2" size={24} />
                        <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{leads.length}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Leadlar</p>
                    </ReportCard>
                </div>
            </div>
        </div>
    );
}
