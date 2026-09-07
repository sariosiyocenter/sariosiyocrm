import React, { useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import { BarChart2, Users, TrendingUp, Download, CalendarCheck } from 'lucide-react';
import { StatCard, BarChart, ProgressBar, LineChart, ReportCard, SectionHeader, DataTable } from './shared';
import { displayName } from '../../lib/displayName';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin',
    MANAGER: 'Menejer',
    TEACHER: "O'qituvchi",
    SUPPORT_TEACHER: "Yord. o'qituvchi",
    RECEPTIONIST: 'Receptionist',
    DRIVER: 'Haydovchi',
    TECH_STAFF: 'Tex. xodim',
    SELLER: 'Sotuvchi',
};

/**
 * Xodimlar davomati.
 *
 * Ilgari bu hisobot faqat ustozlarni sanar va TeacherAttendance jadvalidan
 * o'qirdi. Profillar birlashtirilgach davomat xodim kartasidagi "Ish grafigi"
 * kalendariga — StaffAttendance ga — yoziladi, eski jadvalga esa hech narsa
 * yozilmay qolgan edi: shu sababli davomat qo'yilgan bo'lsa ham hamma 0%
 * ko'rinardi, haydovchi va resepshn esa ro'yxatda umuman yo'q edi.
 */
export default function StaffAttendanceReport({ startDate, endDate }: { startDate?: string; endDate?: string }) {
    const { users, staffAttendances } = useCRM();

    const records = useMemo(() => {
        const rows = staffAttendances || [];
        if (!startDate || !endDate) return rows;
        return rows.filter((a: any) => a.date && a.date >= startDate && a.date <= endDate);
    }, [staffAttendances, startDate, endDate]);

    // Arxivdagi xodim hisobotni chalg'itmasin — u endi ishlamaydi.
    const staff = useMemo(
        () => (users || []).filter((u: any) => u.status !== 'Arxiv'),
        [users]
    );

    const statsPerStaff = useMemo(() => staff.map((u: any) => {
        const mine = records.filter((a: any) => a.userId === u.id);
        const present = mine.filter((a: any) => a.status === 'Keldi').length;
        const absent = mine.filter((a: any) => a.status === 'Kelmadi').length;
        const excused = mine.filter((a: any) => a.status === 'Sababli').length;
        const total = mine.length;
        const pct = total ? Math.round((present / total) * 100) : null;
        return {
            ...u,
            name: displayName(u.name),
            roleLabel: ROLE_LABELS[u.role] || u.role,
            present, absent, excused, total, pct,
        };
    }), [staff, records]);

    // Davomati umuman qo'yilmagan xodim o'rtachani pastga tortmasin: u
    // "0% keldi" emas, "ma'lumot yo'q".
    const belgilanganlar = statsPerStaff.filter(s => s.total > 0);
    const avgPct = belgilanganlar.length
        ? Math.round(belgilanganlar.reduce((s, t) => s + (t.pct || 0), 0) / belgilanganlar.length)
        : null;
    const best = belgilanganlar.reduce(
        (b, t) => (t.pct || 0) > (b?.pct || 0) ? t : b,
        belgilanganlar[0]
    );

    const monthlyTrend = useMemo(() => {
        const map: Record<string, number> = {};
        records.forEach((a: any) => {
            if (!a.date || a.status !== 'Keldi') return;
            const m = a.date.slice(0, 7);
            map[m] = (map[m] || 0) + 1;
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
            .map(([label, value]) => ({ label: label.slice(5) + '-oy', value }));
    }, [records]);

    const handleExport = () => {
        const csv = ["Ism,Lavozim,Jami kun,Keldi,Kelmadi,Sababli,Davomat %",
            ...statsPerStaff.map(t =>
                `${t.name},${t.roleLabel},${t.total},${t.present},${t.absent},${t.excused},${t.pct === null ? '' : t.pct + '%'}`)
        ].join('\n');
        const a = document.createElement('a');
        a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
        a.download = 'xodimlar_davomati.csv';
        a.click();
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Jami xodimlar" value={staff.length} icon={<Users size={16} />} color="sky" />
                <StatCard
                    label="O'rtacha davomat"
                    value={avgPct === null ? '—' : `${avgPct}%`}
                    sub={avgPct === null ? "davomat qo'yilmagan" : `${belgilanganlar.length} ta xodim bo'yicha`}
                    icon={<BarChart2 size={16} />}
                    color={avgPct === null ? 'sky' : avgPct >= 80 ? 'emerald' : 'rose'}
                />
                <StatCard
                    label="Eng yaxshi davomat"
                    value={best?.name?.split(' ')[0] || '—'}
                    sub={best ? `${best.pct}%` : "ma'lumot yo'q"}
                    icon={<TrendingUp size={16} />}
                    color="emerald"
                />
                <StatCard label="Belgilangan kunlar" value={records.length} icon={<CalendarCheck size={16} />} color="violet" />
            </div>

            <ReportCard>
                <SectionHeader title="Xodimlar davomati %" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    {statsPerStaff.filter(t => t.total > 0).map(t => (
                        <div key={t.id}>
                            <ProgressBar label={t.name} value={t.present} max={t.total}
                                color={(t.pct || 0) >= 80 ? '#10b981' : (t.pct || 0) >= 60 ? '#f59e0b' : '#ef4444'}
                                sub={`${t.present}/${t.total} kun`}
                            />
                        </div>
                    ))}
                    {belgilanganlar.length === 0 && (
                        <p className="text-xs text-matn-xira col-span-2 text-center py-8">
                            Bu davrda hech kimga davomat qo'yilmagan. Davomat xodim kartasidagi
                            "Ish grafigi" bo'limidan belgilanadi.
                        </p>
                    )}
                </div>
            </ReportCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ReportCard>
                    <SectionHeader title="Davomat solishtirma" />
                    <BarChart
                        data={belgilanganlar.map(t => ({
                            label: t.name.split(' ')[0],
                            value: t.pct || 0,
                            color: (t.pct || 0) >= 80 ? '#10b981' : (t.pct || 0) >= 60 ? '#f59e0b' : '#ef4444'
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
                        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl text-[11px] font-extrabold hover:bg-sky-500 transition-all">
                            <Download size={14} /> CSV
                        </button>
                    }
                />
                <DataTable
                    columns={[
                        { key: 'name', label: 'Ism familiya' },
                        { key: 'roleLabel', label: 'Lavozim' },
                        { key: 'total', label: 'Jami kun' },
                        { key: 'present', label: 'Keldi' },
                        { key: 'absent', label: 'Kelmadi' },
                        { key: 'pct', label: 'Davomat %', render: r => {
                            // Davomat qo'yilmagan xodim uchun 0% yozish yolg'on
                            // bo'lardi: u kelmagani emas, belgilanmagani.
                            if (r.pct === null) return <span className="text-matn-xira">—</span>;
                            const color = r.pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : r.pct >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
                            return <span className={`font-extrabold ${color}`}>{r.pct}%</span>;
                        }},
                        { key: 'phone', label: 'Telefon raqami', render: r => r.phone || '—' },
                    ]}
                    rows={statsPerStaff}
                />
            </ReportCard>
        </div>
    );
}
