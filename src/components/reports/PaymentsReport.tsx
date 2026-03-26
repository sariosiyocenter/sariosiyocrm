import React, { useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import { CreditCard, Download, TrendingUp, Users, Calendar, Hash } from 'lucide-react';
import { StatCard, BarChart, DonutChart, LineChart, ReportCard, SectionHeader, DataTable } from './shared';

interface Props { startDate: string; endDate: string; }

export default function PaymentsReport({ startDate, endDate }: Props) {
    const { payments, students } = useCRM();

    const filtered = useMemo(() =>
        payments.filter(p => p.date >= startDate && p.date <= endDate),
        [payments, startDate, endDate]
    );

    const total = filtered.reduce((s, p) => s + p.amount, 0);
    const avg = filtered.length ? Math.round(total / filtered.length) : 0;

    // Payment type breakdown
    const byType = useMemo(() => {
        const map: Record<string, number> = {};
        filtered.forEach(p => { map[p.type] = (map[p.type] || 0) + p.amount; });
        return map;
    }, [filtered]);

    const typeColors: Record<string, string> = { Naqd: '#10b981', Karta: '#0ea5e9', Transfer: '#8b5cf6', Online: '#f59e0b' };
    const donutSlices = Object.entries(byType).map(([label, value]) => ({
        label, value: value as number, color: typeColors[label] || '#6b7280'
    }));

    // Daily breakdown
    const byDay = useMemo(() => {
        const map: Record<string, number> = {};
        filtered.forEach(p => { map[p.date] = (map[p.date] || 0) + p.amount; });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-10);
    }, [filtered]);

    const barData = byDay.map(([date, value]) => ({
        label: date.slice(5), value, color: 'linear-gradient(180deg,#0ea5e9,#6366f1)'
    }));

    // Monthly trend (last 6 months)
    const monthlyTrend = useMemo(() => {
        const map: Record<string, number> = {};
        payments.forEach(p => {
            const m = p.date.slice(0, 7);
            map[m] = (map[m] || 0) + p.amount;
        });
        const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
        return sorted.map(([label, value]) => ({ label: label.slice(5) + '-oy', value }));
    }, [payments]);

    // Top students by payment
    const topPayers = useMemo(() => {
        const map: Record<number, number> = {};
        filtered.forEach(p => { map[p.studentId] = (map[p.studentId] || 0) + p.amount; });
        return Object.entries(map)
            .map(([id, sum]) => ({ student: students.find(s => s.id === Number(id))?.name || 'Noma\'lum', sum }))
            .sort((a, b) => b.sum - a.sum).slice(0, 5);
    }, [filtered, students]);

    const tableRows = filtered.map(p => ({
        student: students.find(s => s.id === p.studentId)?.name || 'Noma\'lum',
        amount: p.amount,
        type: p.type,
        date: p.date,
        desc: p.description || '-'
    }));

    const handleExport = () => {
        const csv = ['O\'quvchi,Summa,Turi,Sana,Izoh', ...tableRows.map(r => `${r.student},${r.amount},${r.type},${r.date},${r.desc}`)].join('\n');
        const a = document.createElement('a'); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; a.download = `payments_${startDate}_${endDate}.csv`; a.click();
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Jami tushum" value={`${(total / 1000000).toFixed(1)} mln`} sub="UZS" trend={8} icon={<CreditCard size={16} />} color="emerald" />
                <StatCard label="To'lovlar soni" value={filtered.length} sub="ta operatsiya" icon={<Hash size={16} />} color="sky" />
                <StatCard label="O'rtacha to'lov" value={avg.toLocaleString()} sub="UZS" icon={<TrendingUp size={16} />} color="violet" />
                <StatCard label="Faol o'quvchilar" value={new Set(filtered.map(p => p.studentId)).size} sub="ta talaba" icon={<Users size={16} />} color="amber" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Daily Bar Chart */}
                <ReportCard className="lg:col-span-2">
                    <SectionHeader title="Kunlik to'lovlar" sub={`${startDate} — ${endDate}`} />
                    {barData.length > 0 ? <BarChart data={barData} unit=" so'm" height={200} /> : <p className="text-xs text-gray-400 text-center py-8">Ma'lumot yo'q</p>}
                </ReportCard>

                {/* Donut by type */}
                <ReportCard>
                    <SectionHeader title="To'lov turlari" />
                    {donutSlices.length > 0 ? <DonutChart slices={donutSlices} /> : <p className="text-xs text-gray-400 text-center py-8">Ma'lumot yo'q</p>}
                </ReportCard>
            </div>

            {/* Monthly Trend + Top Payers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ReportCard>
                    <SectionHeader title="6 Oylik tushum trendi" />
                    {monthlyTrend.length > 1 ? <LineChart data={monthlyTrend} color="#0ea5e9" unit=" so'm" /> : <p className="text-xs text-gray-400 text-center py-8">Ma'lumot yo'q</p>}
                </ReportCard>

                <ReportCard>
                    <SectionHeader title="Top 5 to'lovchi" />
                    <BarChart
                        data={topPayers.map(t => ({ label: t.student.split(' ')[0], value: t.sum, color: 'linear-gradient(90deg,#10b981,#0ea5e9)' }))}
                        horizontal={true}
                        unit=" so'm"
                    />
                </ReportCard>
            </div>

            {/* Table */}
            <ReportCard>
                <SectionHeader
                    title="To'lovlar ro'yxati"
                    sub={`${filtered.length} ta yozuv`}
                    action={
                        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-sky-500 transition-all">
                            <Download size={14} /> CSV
                        </button>
                    }
                />
                <DataTable
                    columns={[
                        { key: 'student', label: "O'quvchi" },
                        { key: 'amount', label: 'Summa', render: r => <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">+{r.amount.toLocaleString()} UZS</span> },
                        { key: 'type', label: 'Turi', render: r => <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-[10px] font-bold uppercase">{r.type}</span> },
                        { key: 'date', label: 'Sana' },
                        { key: 'desc', label: 'Izoh' }
                    ]}
                    rows={tableRows}
                />
            </ReportCard>
        </div>
    );
}
