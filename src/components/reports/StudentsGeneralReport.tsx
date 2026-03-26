import React, { useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import { Users, BookOpen, BarChart2, Download, TrendingUp } from 'lucide-react';
import { StatCard, BarChart, DonutChart, LineChart, ReportCard, SectionHeader, DataTable } from './shared';

export default function StudentsGeneralReport() {
    const { students, groups, payments } = useCRM();

    const statusCounts = { Faol: 0, Arxiv: 0, Sinov: 0 };
    students.forEach(s => { if (s.status in statusCounts) (statusCounts as any)[s.status]++; });

    const donutSlices = [
        { label: 'Faol', value: statusCounts.Faol, color: '#10b981' },
        { label: 'Arxiv', value: statusCounts.Arxiv, color: '#6b7280' },
        { label: 'Sinov', value: statusCounts.Sinov, color: '#f59e0b' },
    ];

    // Group-wise student count
    const groupBar = useMemo(() => groups.map(g => ({
        label: g.name.slice(0, 10),
        value: g.studentIds?.length || 0,
        color: 'linear-gradient(180deg,#0ea5e9,#8b5cf6)'
    })), [groups]);

    // Monthly join trend (based on first payment)
    const monthlyTrend = useMemo(() => {
        const map: Record<string, Set<number>> = {};
        payments.forEach(p => {
            const m = p.date?.slice(0, 7);
            if (m) { if (!map[m]) map[m] = new Set(); map[m].add(p.studentId); }
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([label, set]) => ({ label: label.slice(5) + '-oy', value: set.size }));
    }, [payments]);

    // Age distribution
    const ageBuckets = useMemo(() => {
        const buckets: Record<string, number> = { '<12': 0, '12-15': 0, '16-18': 0, '19-25': 0, '25+': 0 };
        students.forEach(s => {
            if (!s.birthDate) return;
            const age = new Date().getFullYear() - new Date(s.birthDate).getFullYear();
            if (age < 12) buckets['<12']++;
            else if (age <= 15) buckets['12-15']++;
            else if (age <= 18) buckets['16-18']++;
            else if (age <= 25) buckets['19-25']++;
            else buckets['25+']++;
        });
        return Object.entries(buckets).map(([label, value]) => ({ label, value, color: 'linear-gradient(180deg,#f59e0b,#ef4444)' }));
    }, [students]);

    const handleExport = () => {
        const csv = ['Ism,Status,Telefon,Tug\'ilgan sana', ...students.map(s => `${s.name},${s.status},${s.phone},${s.birthDate || '-'}`)].join('\n');
        const a = document.createElement('a'); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; a.download = 'students.csv'; a.click();
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Jami talabalar" value={students.length} icon={<Users size={16} />} color="sky" />
                <StatCard label="Faol" value={statusCounts.Faol} icon={<TrendingUp size={16} />} color="emerald" />
                <StatCard label="Guruhlar soni" value={groups.length} icon={<BookOpen size={16} />} color="violet" />
                <StatCard label="Sinov" value={statusCounts.Sinov} icon={<BarChart2 size={16} />} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ReportCard>
                    <SectionHeader title="Status taqsimoti" />
                    <DonutChart slices={donutSlices} />
                </ReportCard>
                <ReportCard>
                    <SectionHeader title="Yosh tarkibi" />
                    <BarChart data={ageBuckets} height={160} />
                </ReportCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {groupBar.length > 0 && (
                    <ReportCard>
                        <SectionHeader title="Guruh bo'yicha talabalar" />
                        <BarChart data={groupBar.slice(0, 8)} horizontal />
                    </ReportCard>
                )}
                {monthlyTrend.length > 1 && (
                    <ReportCard>
                        <SectionHeader title="Oylik faollik trendi" />
                        <LineChart data={monthlyTrend} color="#0ea5e9" />
                    </ReportCard>
                )}
            </div>

            <ReportCard>
                <SectionHeader
                    title="Talabalar ro'yxati"
                    action={
                        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-sky-500 transition-all">
                            <Download size={14} /> CSV
                        </button>
                    }
                />
                <DataTable
                    columns={[
                        { key: 'name', label: 'Ism familiya' },
                        { key: 'status', label: 'Status', render: r => <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${r.status === 'Faol' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{r.status}</span> },
                        { key: 'phone', label: 'Telefon' },
                        { key: 'birthDate', label: "Tug'ilgan sana", render: r => r.birthDate || '-' },
                        { key: 'balance', label: 'Balans', render: r => <span className={r.balance < 0 ? 'text-rose-500' : 'text-emerald-500'}>{r.balance.toLocaleString()} UZS</span> },
                    ]}
                    rows={students}
                />
            </ReportCard>
        </div>
    );
}
