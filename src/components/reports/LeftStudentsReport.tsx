import React, { useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import { UserMinus, TrendingDown, AlertCircle, Calendar, Download } from 'lucide-react';
import { StatCard, BarChart, LineChart, ReportCard, SectionHeader, DataTable } from './shared';

export default function LeftStudentsReport() {
    const { students, groups } = useCRM();

    const leftStudents = useMemo(() => students.filter(s => s.status === 'Arxiv'), [students]);

    const reasonsMap: Record<string, number> = {};
    leftStudents.forEach(s => {
        const reason = s.leaveReason || 'Sabab ko\'rsatilmadi';
        reasonsMap[reason] = (reasonsMap[reason] || 0) + 1;
    });

    const reasonsData = Object.entries(reasonsMap).map(([label, value]) => ({
        label,
        value,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    })).slice(0, 5);

    // Monthly Trend
    const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return { month: d.getMonth(), year: d.getFullYear(), label: ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"][d.getMonth()] };
    });

    const monthlyTrend = last6Months.map(m => ({
        label: m.label,
        value: leftStudents.filter(s => {
            if (!s.statusChangedAt) return false;
            const d = new Date(s.statusChangedAt);
            return d.getMonth() === m.month && d.getFullYear() === m.year;
        }).length
    }));

    const tableRows = leftStudents.map(s => ({
        name: s.name,
        group: groups.find(g => g.id === s.groups?.[0])?.name || 'Noma\'lum',
        date: s.statusChangedAt ? new Date(s.statusChangedAt).toLocaleDateString() : 'Noma\'lum',
        reason: s.leaveReason || 'Sabab ko\'rsatilmadi'
    }));

    const thisMonthCount = leftStudents.filter(s => {
        if (!s.statusChangedAt) return false;
        const d = new Date(s.statusChangedAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Jami ketganlar" value={leftStudents.length} icon={<UserMinus size={16} />} color="rose" />
                <StatCard label="Bu oy" value={thisMonthCount} icon={<Calendar size={16} />} color="amber" />
                <StatCard label="Asosiy sabab" value={reasonsData[0]?.label || "Noma'lum"} sub={leftStudents.length > 0 ? `${Math.round((reasonsData[0]?.value / leftStudents.length) * 100)}%` : '0%'} icon={<AlertCircle size={16} />} color="sky" />
                <StatCard label="Aktiv o'quvchilar" value={students.filter(s => s.status === 'Faol').length} icon={<TrendingDown size={16} />} color="emerald" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ReportCard>
                    <SectionHeader title="Oylik chiqish trendi" sub="Oxirgi 6 oy" />
                    <LineChart data={monthlyTrend} color="#ef4444" />
                </ReportCard>
                <ReportCard>
                    <SectionHeader title="Ketish sabablari taqsimoti" />
                    <BarChart data={reasonsData} horizontal />
                </ReportCard>
            </div>

            <ReportCard>
                <SectionHeader 
                    title="Ketgan o'quvchilar ro'yxati" 
                    action={
                        <button className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-rose-500 transition-all">
                            <Download size={14} /> EXPORT
                        </button>
                    }
                />
                <DataTable 
                    columns={[
                        { key: 'name', label: "O'quvchi" },
                        { key: 'group', label: "Guruh" },
                        { key: 'date', label: "Ketgan sana" },
                        { key: 'reason', label: "Sabab", render: r => <span className="text-gray-500 italic">{r.reason}</span> }
                    ]}
                    rows={tableRows}
                />
            </ReportCard>
        </div>
    );
}
