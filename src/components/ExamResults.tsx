import React, { useState, useMemo } from 'react';
import { Users, Trophy, TrendingUp, Target, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { StatCard, BarChart } from './reports/shared';
import * as XLSX from 'xlsx';

export default function ExamResults() {
    const { exams, examResults, students, groups } = useCRM();

    const [selectedExamId, setSelectedExamId] = useState<number | null>(
        exams.length > 0 ? exams[0].id : null
    );
    const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('');
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<'score' | 'name' | 'percentage'>('score');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const exam = exams.find(e => e.id === selectedExamId) || null;

    const filteredResults = useMemo(() => {
        if (!selectedExamId) return [];
        let results = examResults.filter(r => r.examId === selectedExamId);

        if (selectedGroupId) {
            const group = groups.find(g => g.id === selectedGroupId);
            const groupStudentIds = group
                ? [...(group.studentIds || []), ...(students.filter(s => s.groups?.includes(group.id)).map(s => s.id))]
                : [];
            results = results.filter(r => groupStudentIds.includes(r.studentId));
        }

        return [...results].sort((a, b) => {
            let av: string | number, bv: string | number;
            if (sortBy === 'name') {
                const aStudent = students.find(s => s.id === a.studentId);
                const bStudent = students.find(s => s.id === b.studentId);
                av = aStudent?.name || '';
                bv = bStudent?.name || '';
            } else if (sortBy === 'percentage') {
                av = a.percentage; bv = b.percentage;
            } else {
                av = a.score; bv = b.score;
            }
            if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
            return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
        });
    }, [selectedExamId, examResults, selectedGroupId, groups, students, sortBy, sortDir]);

    // KPI stats
    const stats = useMemo(() => {
        if (filteredResults.length === 0) return null;
        const scores = filteredResults.map(r => r.score);
        const percentages = filteredResults.map(r => r.percentage);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const avgPct = percentages.reduce((a, b) => a + b, 0) / percentages.length;
        const passed = filteredResults.filter(r => r.percentage >= 50).length;
        const maxScore = Math.max(...scores);
        return { avg, avgPct, passed, passRate: Math.round((passed / filteredResults.length) * 100), maxScore };
    }, [filteredResults]);

    // Score distribution buckets
    const scoreDistribution = useMemo(() => {
        if (!exam || filteredResults.length === 0) return [];
        const bucketSize = Math.ceil(exam.maxScore / 5) || 10;
        const buckets: { label: string; value: number }[] = [];
        for (let lo = 0; lo < exam.maxScore; lo += bucketSize) {
            const hi = Math.min(lo + bucketSize, exam.maxScore);
            const count = filteredResults.filter(r => r.score >= lo && r.score < hi + (hi === exam.maxScore ? 1 : 0)).length;
            buckets.push({ label: `${lo}-${hi}`, value: count });
        }
        return buckets;
    }, [filteredResults, exam]);

    // Per-subject performance
    const subjectPerformance = useMemo(() => {
        if (filteredResults.length === 0) return [];
        const subjectMap: Record<string, { earned: number; max: number; count: number }> = {};
        filteredResults.forEach(r => {
            if (!r.blockScores) return;
            (r.blockScores as { subject: string; earned: number; max: number }[]).forEach(bs => {
                if (!subjectMap[bs.subject]) subjectMap[bs.subject] = { earned: 0, max: 0, count: 0 };
                subjectMap[bs.subject].earned += bs.earned;
                subjectMap[bs.subject].max += bs.max;
                subjectMap[bs.subject].count++;
            });
        });
        return Object.entries(subjectMap).map(([subject, { earned, max }]) => ({
            label: subject,
            value: max > 0 ? Math.round((earned / max) * 100) : 0,
            color: 'linear-gradient(90deg,#14b8a6,#0ea5e9)'
        }));
    }, [filteredResults]);

    const toggleSort = (col: typeof sortBy) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir('desc'); }
    };

    const exportToExcel = () => {
        if (!exam) return;
        const rows = filteredResults.map(r => {
            const student = students.find(s => s.id === r.studentId);
            const studentObj = students.find(s => s.id === r.studentId);
            const group = groups.find(g =>
                g.studentIds?.includes(r.studentId) ||
                studentObj?.groups?.includes(g.id)
            );
            return {
                'Ism': student?.name || r.studentId,
                'Guruh': group?.name || '-',
                'Variant': r.variantCode || '-',
                'Ball': r.score,
                'Foiz (%)': r.percentage,
                'Sana': new Date(r.scannedAt).toLocaleDateString('uz')
            };
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Natijalar');
        XLSX.writeFile(wb, `${exam.name}-natijalar.xlsx`);
    };

    const SortIcon = ({ col }: { col: typeof sortBy }) => (
        <span className="ml-1 opacity-50">
            {sortBy === col ? (sortDir === 'desc' ? <ChevronDown size={12} className="inline" /> : <ChevronUp size={12} className="inline" />) : <ChevronDown size={12} className="inline opacity-30" />}
        </span>
    );

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Imtihon Natijalari</h1>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Statistika va tahlil</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <select
                        value={selectedExamId || ''}
                        onChange={e => { setSelectedExamId(Number(e.target.value) || null); setExpandedRow(null); }}
                        className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500 dark:text-white"
                    >
                        <option value="">Imtihon tanlang</option>
                        {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>

                    <select
                        value={selectedGroupId}
                        onChange={e => setSelectedGroupId(e.target.value ? Number(e.target.value) : '')}
                        className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500 dark:text-white"
                    >
                        <option value="">Barcha guruhlar</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>

                    <button
                        onClick={exportToExcel}
                        disabled={filteredResults.length === 0}
                        className="px-5 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-40 flex items-center gap-2"
                    >
                        <Download size={14} /> Excel
                    </button>
                </div>
            </div>

            {!selectedExamId ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-16 border border-gray-100 dark:border-gray-700 text-center">
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Yuqoridan imtihon tanlang</p>
                </div>
            ) : filteredResults.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-16 border border-gray-100 dark:border-gray-700 text-center">
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Hali natijalar kiritilmagan</p>
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    {stats && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard label="Ishtirokchilar" value={filteredResults.length} sub="o'quvchi" icon={<Users size={18} />} color="sky" />
                            <StatCard label="O'rtacha ball" value={stats.avg.toFixed(1)} sub={`${exam?.maxScore || 0} balldan`} icon={<TrendingUp size={18} />} color="violet" />
                            <StatCard label="O'tish darajasi" value={`${stats.passRate}%`} sub={`${stats.passed} ta o'quvchi`} icon={<Target size={18} />} color="emerald" />
                            <StatCard label="Eng yuqori" value={stats.maxScore} sub="ball" icon={<Trophy size={18} />} color="amber" />
                        </div>
                    )}

                    {/* Charts row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Score distribution */}
                        {scoreDistribution.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Ball Taqsimoti</h3>
                                <BarChart data={scoreDistribution} height={160} unit=" kishi" />
                            </div>
                        )}

                        {/* Subject performance */}
                        {subjectPerformance.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Fan Bo'yicha Ko'rsatkichlar</h3>
                                <BarChart data={subjectPerformance} horizontal unit="%" />
                            </div>
                        )}
                    </div>

                    {/* Results table */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600" onClick={() => toggleSort('name')}>
                                            Ism <SortIcon col="name" />
                                        </th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Guruh</th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Variant</th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center cursor-pointer hover:text-gray-600" onClick={() => toggleSort('score')}>
                                            Ball <SortIcon col="score" />
                                        </th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center cursor-pointer hover:text-gray-600" onClick={() => toggleSort('percentage')}>
                                            % <SortIcon col="percentage" />
                                        </th>
                                        <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Sana</th>
                                        <th className="p-5 w-10" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                    {filteredResults.map(result => {
                                        const student = students.find(s => s.id === result.studentId);
                                        const group = groups.find(g =>
                                            g.studentIds?.includes(result.studentId) ||
                                            student?.groups?.includes(g.id)
                                        );
                                        const isExpanded = expandedRow === result.id;

                                        return (
                                            <React.Fragment key={result.id}>
                                                <tr
                                                    className="hover:bg-gray-50/80 dark:hover:bg-teal-900/5 cursor-pointer transition-all"
                                                    onClick={() => setExpandedRow(isExpanded ? null : result.id)}
                                                >
                                                    <td className="p-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 font-black text-xs">
                                                                {student?.name?.[0] || '?'}
                                                            </div>
                                                            <span className="text-sm font-bold text-gray-900 dark:text-white">{student?.name || `ID: ${result.studentId}`}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                                        {group?.name || '-'}
                                                    </td>
                                                    <td className="p-5 text-center">
                                                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-[10px] font-black text-gray-600 dark:text-gray-300">
                                                            {result.variantCode || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="p-5 text-center">
                                                        <span className="text-lg font-black text-gray-900 dark:text-white">{result.score}</span>
                                                        <span className="text-[10px] text-gray-400 ml-1">/ {exam?.maxScore}</span>
                                                    </td>
                                                    <td className="p-5 text-center">
                                                        <span className={`px-3 py-1 rounded-xl text-[10px] font-black ${
                                                            result.percentage >= 80 ? 'bg-emerald-50 text-emerald-600' :
                                                            result.percentage >= 50 ? 'bg-amber-50 text-amber-600' :
                                                            'bg-rose-50 text-rose-600'
                                                        }`}>
                                                            {result.percentage}%
                                                        </span>
                                                    </td>
                                                    <td className="p-5 text-center text-[10px] text-gray-400">
                                                        {new Date(result.scannedAt).toLocaleDateString('uz')}
                                                    </td>
                                                    <td className="p-5 text-center">
                                                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                                    </td>
                                                </tr>

                                                {isExpanded && result.blockScores && (
                                                    <tr>
                                                        <td colSpan={7} className="px-5 pb-4">
                                                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-5 space-y-3">
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Fan Bo'yicha Natijalar</p>
                                                                {(result.blockScores as { subject: string; earned: number; max: number }[]).map((bs, i) => (
                                                                    <div key={i} className="flex items-center gap-4">
                                                                        <span className="text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest w-28 shrink-0">{bs.subject}</span>
                                                                        <div className="flex-1 h-5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all ${bs.max > 0 && bs.earned / bs.max >= 0.5 ? 'bg-teal-500' : 'bg-rose-400'}`}
                                                                                style={{ width: `${bs.max > 0 ? (bs.earned / bs.max) * 100 : 0}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-[10px] font-black text-gray-600 dark:text-gray-300 w-16 text-right">
                                                                            {bs.earned}/{bs.max}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
