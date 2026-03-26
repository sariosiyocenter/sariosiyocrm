import React, { useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import { Target, TrendingUp, User, BarChart2, Download } from 'lucide-react';
import { StatCard, BarChart, DonutChart, LineChart, ReportCard, SectionHeader, DataTable } from './shared';

export default function LeadsReport() {
    const { leads } = useCRM();

    const statusMap: Record<string, number> = {};
    leads.forEach(l => { statusMap[l.status] = (statusMap[l.status] || 0) + 1; });

    const donutColors: Record<string, string> = {
        'Yangi': '#0ea5e9', 'Qayta aloqa': '#f59e0b', "Yo'qotildi": '#ef4444', 'Yoqildi': '#10b981'
    };
    const donutSlices = Object.entries(statusMap).map(([label, value]) => ({
        label, value, color: donutColors[label] || '#6b7280'
    }));

    const bySource = useMemo(() => {
        const map: Record<string, number> = {};
        leads.forEach(l => { const src = l.source || 'Boshqa'; map[src] = (map[src] || 0) + 1; });
        return Object.entries(map).map(([label, value]) => ({ label, value, color: 'linear-gradient(180deg,#8b5cf6,#6366f1)' }));
    }, [leads]);

    const weeklyTrend = useMemo(() => {
        const map: Record<string, number> = {};
        leads.forEach(l => { if (l.date) { const w = l.date.slice(0, 7); map[w] = (map[w] || 0) + 1; } });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([label, value]) => ({ label: label.slice(5) + '-oy', value }));
    }, [leads]);

    const statusColors: Record<string, string> = { 'Yangi': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', 'Qayta aloqa': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', "Yo'qotildi": 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', 'Yoqildi': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };

    const handleExport = () => {
        const csv = ['Ism,Tel,Manba,Holat,Sana', ...leads.map(l => `${l.name},${l.phone},${l.source || '-'},${l.status},${l.date || '-'}`)].join('\n');
        const a = document.createElement('a'); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; a.download = 'leads.csv'; a.click();
    };

    const conversionRate = leads.length ? Math.round((leads.filter(l => l.status === 'Yoqildi').length / leads.length) * 100) : 0;

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Jami lidlar" value={leads.length} icon={<Target size={16} />} color="violet" />
                <StatCard label="Yangi so'rovlar" value={statusMap['Yangi'] || 0} icon={<User size={16} />} color="sky" />
                <StatCard label="Konvertatsiya" value={`${conversionRate}%`} sub="yoqildi" trend={conversionRate} icon={<TrendingUp size={16} />} color="emerald" />
                <StatCard label="Qayta aloqa" value={statusMap['Qayta aloqa'] || 0} icon={<BarChart2 size={16} />} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ReportCard>
                    <SectionHeader title="Holat taqsimoti" />
                    <DonutChart slices={donutSlices} />
                </ReportCard>

                <ReportCard>
                    <SectionHeader title="Manba bo'yicha" />
                    {bySource.length > 0 ? <BarChart data={bySource} horizontal /> : <p className="text-xs text-gray-400 py-8 text-center">Ma'lumot yo'q</p>}
                </ReportCard>
            </div>

            {weeklyTrend.length > 1 && (
                <ReportCard>
                    <SectionHeader title="Oylik oqim trendi" />
                    <LineChart data={weeklyTrend} color="#8b5cf6" />
                </ReportCard>
            )}

            <ReportCard>
                <SectionHeader
                    title="Lidlar ro'yxati"
                    action={
                        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-violet-500 transition-all">
                            <Download size={14} /> CSV
                        </button>
                    }
                />
                <DataTable
                    columns={[
                        { key: 'name', label: 'Ism' },
                        { key: 'phone', label: 'Telefon' },
                        { key: 'source', label: 'Manba', render: r => r.source || '-' },
                        { key: 'status', label: 'Holat', render: r => <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${statusColors[r.status] || 'bg-gray-100 text-gray-500'}`}>{r.status}</span> },
                        { key: 'date', label: 'Sana', render: r => r.date || '-' },
                    ]}
                    rows={leads}
                />
            </ReportCard>
        </div>
    );
}
