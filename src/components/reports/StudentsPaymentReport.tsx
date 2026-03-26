import React, { useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import { Users, AlertTriangle, CheckCircle, TrendingDown, Download } from 'lucide-react';
import { StatCard, BarChart, DonutChart, ProgressBar, ReportCard, SectionHeader, DataTable } from './shared';

interface Props { startDate: string; endDate: string; }

export default function StudentsPaymentReport({ startDate, endDate }: Props) {
    const { students, payments } = useCRM();

    const debtors = students.filter(s => s.balance < 0);
    const positives = students.filter(s => s.balance >= 0);
    const totalDebt = debtors.reduce((s, st) => s + Math.abs(st.balance), 0);
    const totalPositive = positives.reduce((s, st) => s + st.balance, 0);

    // Payment status per student
    const studentRows = useMemo(() => {
        return students.map(s => {
            const lastPay = payments
                .filter(p => p.studentId === s.id)
                .sort((a, b) => b.date.localeCompare(a.date))[0];
            return {
                name: s.name,
                status: s.status,
                balance: s.balance,
                lastPayDate: lastPay?.date || '-',
                lastPayAmt: lastPay?.amount || 0,
            };
        }).sort((a, b) => a.balance - b.balance);
    }, [students, payments]);

    const donutSlices = [
        { label: 'Faol', value: students.filter(s => s.status === 'Faol').length, color: '#10b981' },
        { label: 'Arxiv', value: students.filter(s => s.status === 'Arxiv').length, color: '#6b7280' },
        { label: 'Sinov', value: students.filter(s => s.status === 'Sinov').length, color: '#f59e0b' },
    ];

    const topDebtors = debtors.slice(0, 7).map(s => ({
        label: s.name.split(' ')[0],
        value: Math.abs(s.balance),
        color: 'linear-gradient(90deg,#ef4444,#f59e0b)'
    }));

    const handleExport = () => {
        const csv = ['Ism,Status,Balans,So\'nggi to\'lov,So\'nggi to\'lov summasi',
            ...studentRows.map(r => `${r.name},${r.status},${r.balance},${r.lastPayDate},${r.lastPayAmt}`)
        ].join('\n');
        const a = document.createElement('a'); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; a.download = 'students_payment.csv'; a.click();
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Jami talabalar" value={students.length} sub="ro'yxatda" icon={<Users size={16} />} color="sky" />
                <StatCard label="Qarzli talabalar" value={debtors.length} sub="ta" trend={-debtors.length} icon={<AlertTriangle size={16} />} color="rose" />
                <StatCard label="Jami qarzdorlik" value={`${(totalDebt / 1000000).toFixed(2)} mln`} sub="UZS" icon={<TrendingDown size={16} />} color="rose" />
                <StatCard label="Musbat balans" value={`${(totalPositive / 1000000).toFixed(2)} mln`} sub="UZS" icon={<CheckCircle size={16} />} color="emerald" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ReportCard>
                    <SectionHeader title="Status taqsimoti" />
                    <DonutChart slices={donutSlices} />
                </ReportCard>

                <ReportCard>
                    <SectionHeader title="Eng ko'p qarzdorlar (Top 7)" />
                    {topDebtors.length > 0
                        ? <BarChart data={topDebtors} horizontal unit=" so'm" />
                        : <p className="text-xs text-gray-400 text-center py-8">Qarzlilar yo'q — ajoyib! 🎉</p>
                    }
                </ReportCard>
            </div>

            {/* Progress per student (debtors) */}
            {debtors.length > 0 && (
                <ReportCard>
                    <SectionHeader title="Qarzlilar holati" sub={`${debtors.length} ta o'quvchi`} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {debtors.slice(0, 10).map(s => (
                            <div key={s.id}>
                                <ProgressBar
                                    label={s.name}
                                    value={Math.abs(s.balance)}
                                    max={Math.max(...debtors.map(d => Math.abs(d.balance)))}
                                    color="#ef4444"
                                    sub={`${Math.abs(s.balance).toLocaleString()} UZS`}
                                />
                            </div>
                        ))}
                    </div>
                </ReportCard>
            )}

            {/* Table */}
            <ReportCard>
                <SectionHeader
                    title="Barcha talabalar balansi"
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
                        { key: 'balance', label: 'Balans (UZS)', render: r => <span className={r.balance < 0 ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-emerald-600 dark:text-emerald-400 font-extrabold'}>{r.balance.toLocaleString()}</span> },
                        { key: 'lastPayDate', label: "So'nggi to'lov" },
                        { key: 'lastPayAmt', label: 'Summa', render: r => r.lastPayAmt ? `${r.lastPayAmt.toLocaleString()} UZS` : '-' },
                    ]}
                    rows={studentRows}
                />
            </ReportCard>
        </div>
    );
}
