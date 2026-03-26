import React, { useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import { BookOpen, BarChart2, Users, TrendingUp, Download } from 'lucide-react';
import { StatCard, BarChart, ProgressBar, LineChart, ReportCard, SectionHeader, DataTable } from './shared';

export default function StaffAttendanceReport() {
    const { teachers, teacherAttendances } = useCRM();

    const statsPerTeacher = useMemo(() => teachers.map(t => {
        const records = teacherAttendances.filter((a: any) => a.teacherId === t.id);
        const present = records.filter((a: any) => a.status === 'Keldi' || a.status === 'present').length;
        const total = records.length;
        const pct = total ? Math.round((present / total) * 100) : 0;
        return { ...t, present, total, pct };
    }), [teachers, teacherAttendances]);

    const avgPct = statsPerTeacher.length ? Math.round(statsPerTeacher.reduce((s, t) => s + t.pct, 0) / statsPerTeacher.length) : 0;
    const best = statsPerTeacher.reduce((b, t) => t.pct > (b?.pct || 0) ? t : b, statsPerTeacher[0]);

    // Monthly attendance count
    const monthlyTrend = useMemo(() => {
        const map: Record<string, number> = {};
        teacherAttendances.forEach((a: any) => {
            if (!a.date) return;
            const m = a.date.slice(0, 7);
            if (a.status === 'Keldi' || a.status === 'present') map[m] = (map[m] || 0) + 1;
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([label, value]) => ({ label: label.slice(5) + '-oy', value }));
    }, [teacherAttendances]);

    const handleExport = () => {
        const csv = ["Ism,Jami kun,Keldi,Davomat %", ...statsPerTeacher.map(t => `${t.name},${t.total},${t.present},${t.pct}%`)].join('\n');
        const a = document.createElement('a'); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; a.download = 'staff_attendance.csv'; a.click();
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Jami xodimlar" value={teachers.length} icon={<Users size={16} />} color="sky" />
                <StatCard label="O'rtacha davomat" value={`${avgPct}%`} icon={<BarChart2 size={16} />} color={avgPct >= 80 ? 'emerald' : 'rose'} trend={avgPct - 75} />
                <StatCard label="Eng yaxshi davomat" value={best?.name?.split(' ')[0] || '-'} sub={`${best?.pct || 0}%`} icon={<TrendingUp size={16} />} color="emerald" />
                <StatCard label="Jami darslar" value={teacherAttendances.length} icon={<BookOpen size={16} />} color="violet" />
            </div>

            {/* Progress per teacher */}
            <ReportCard>
                <SectionHeader title="Xodimlar davomati %" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    {statsPerTeacher.map(t => (
                        <div key={t.id}>
                            <ProgressBar label={t.name} value={t.present} max={t.total || 1}
                                color={t.pct >= 80 ? '#10b981' : t.pct >= 60 ? '#f59e0b' : '#ef4444'}
                                sub={`${t.present}/${t.total} kun`}
                            />
                        </div>
                    ))}
                    {teachers.length === 0 && <p className="text-xs text-gray-400 col-span-2 text-center py-8">Xodimlar mavjud emas</p>}
                </div>
            </ReportCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Bar chart */}
                <ReportCard>
                    <SectionHeader title="Davomat solishtirma" />
                    <BarChart
                        data={statsPerTeacher.map(t => ({
                            label: t.name.split(' ')[0],
                            value: t.pct,
                            color: t.pct >= 80 ? '#10b981' : t.pct >= 60 ? '#f59e0b' : '#ef4444'
                        }))}
                        unit="%"
                        height={180}
                    />
                </ReportCard>

                {monthlyTrend.length > 1 && (
                    <ReportCard>
                        <SectionHeader title="Oylik davomat trendi" />
                        <LineChart data={monthlyTrend} color="#0ea5e9" />
                    </ReportCard>
                )}
            </div>

            <ReportCard>
                <SectionHeader
                    title="Xodimlar davomati ro'yxati"
                    action={
                        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-sky-500 transition-all">
                            <Download size={14} /> CSV
                        </button>
                    }
                />
                <DataTable
                    columns={[
                        { key: 'name', label: 'Ism familiya' },
                        { key: 'total', label: 'Jami kun' },
                        { key: 'present', label: 'Keldi' },
                        { key: 'pct', label: 'Davomat %', render: r => {
                            const color = r.pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : r.pct >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
                            return <span className={`font-extrabold ${color}`}>{r.pct}%</span>;
                        }},
                        { key: 'subject', label: 'Fan', render: r => r.subject || '-' },
                    ]}
                    rows={statsPerTeacher}
                />
            </ReportCard>
        </div>
    );
}
