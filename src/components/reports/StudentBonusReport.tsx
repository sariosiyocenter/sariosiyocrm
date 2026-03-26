import React, { useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import { Star, TrendingUp, Users, Award, Download } from 'lucide-react';
import { StatCard, BarChart, LineChart, ProgressBar, ReportCard, SectionHeader, DataTable } from './shared';

export default function StudentBonusReport() {
    const { students, scores } = useCRM();

    const studentScores = useMemo(() => students.map(s => {
        const sScores = scores.filter((sc: any) => sc.studentId === s.id);
        const total = sScores.reduce((sum: number, sc: any) => sum + (sc.score || sc.value || 0), 0);
        const avg = sScores.length ? Math.round(total / sScores.length) : 0;
        return { ...s, totalScore: total, avgScore: avg, count: sScores.length };
    }), [students, scores]);

    const sorted = [...studentScores].sort((a, b) => b.totalScore - a.totalScore);
    const topStudents = sorted.slice(0, 5);
    const totalBalls = scores.reduce((s: number, sc: any) => s + (sc.score || sc.value || 0), 0);
    const avgBall = students.length ? Math.round(totalBalls / students.length) : 0;

    const monthlyTrend = useMemo(() => {
        const map: Record<string, number> = {};
        scores.forEach((sc: any) => {
            if (!sc.date) return;
            const m = sc.date.slice(0, 7);
            map[m] = (map[m] || 0) + (sc.score || sc.value || 0);
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([label, value]) => ({ label: label.slice(5) + '-oy', value }));
    }, [scores]);

    const handleExport = () => {
        const csv = ['Ism,Jami ball,O\'rtacha ball,Yozuvlar soni', ...sorted.map(s => `${s.name},${s.totalScore},${s.avgScore},${s.count}`)].join('\n');
        const a = document.createElement('a'); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; a.download = 'scores.csv'; a.click();
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Jami ball" value={totalBalls.toLocaleString()} icon={<Star size={16} />} color="amber" />
                <StatCard label="O'rtacha ball" value={avgBall} icon={<TrendingUp size={16} />} color="sky" />
                <StatCard label="Top o'quvchi" value={topStudents[0]?.name?.split(' ')[0] || '-'} sub={`${topStudents[0]?.totalScore || 0} ball`} icon={<Award size={16} />} color="emerald" />
                <StatCard label="Baholangan" value={students.filter(s => (studentScores.find(ss => ss.id === s.id)?.count || 0) > 0).length} sub="ta talaba" icon={<Users size={16} />} color="violet" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ReportCard>
                    <SectionHeader title="Top 5 o'quvchi — Leaderboard" />
                    {topStudents.length > 0 ? (
                        <div className="space-y-3 mt-2">
                            {topStudents.map((s, i) => (
                                <div key={s.id} className="flex items-center gap-3">
                                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-extrabold shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' : i === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-700' : 'bg-orange-50 text-orange-400 dark:bg-orange-900/20'}`}>{i + 1}</span>
                                    <ProgressBar label={s.name} value={s.totalScore} max={topStudents[0].totalScore || 1} color={i === 0 ? '#f59e0b' : '#0ea5e9'} sub={`${s.totalScore} ball`} />
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-xs text-gray-400 text-center py-8">Hali baholashlar yo'q</p>}
                </ReportCard>

                <ReportCard>
                    <SectionHeader title="Ball taqsimoti (Top 8)" />
                    <BarChart
                        data={sorted.slice(0, 8).map(s => ({ label: s.name.split(' ')[0], value: s.totalScore, color: 'linear-gradient(180deg,#f59e0b,#ef4444)' }))}
                        height={160}
                    />
                </ReportCard>
            </div>

            {monthlyTrend.length > 1 && (
                <ReportCard>
                    <SectionHeader title="Oylik ball dinamikasi" />
                    <LineChart data={monthlyTrend} color="#f59e0b" />
                </ReportCard>
            )}

            <ReportCard>
                <SectionHeader
                    title="Barcha talabalar ballari"
                    action={
                        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-amber-400 transition-all">
                            <Download size={14} /> CSV
                        </button>
                    }
                />
                <DataTable
                    columns={[
                        { key: 'name', label: 'Ism familiya' },
                        { key: 'count', label: 'Baholashlar soni' },
                        { key: 'totalScore', label: 'Jami ball', render: r => <span className="text-amber-600 dark:text-amber-400 font-extrabold">{r.totalScore}</span> },
                        { key: 'avgScore', label: "O'rtacha ball", render: r => r.avgScore || '-' },
                        { key: 'status', label: 'Status', render: r => <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${r.status === 'Faol' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{r.status}</span> },
                    ]}
                    rows={sorted}
                />
            </ReportCard>
        </div>
    );
}
