import React from 'react';
import { GraduationCap, Award, Briefcase, TrendingUp, Download } from 'lucide-react';
import { StatCard, BarChart, LineChart, ReportCard, SectionHeader, DataTable } from './shared';
import { useCRM } from '../../context/CRMContext';

export default function GraduatesReport() {
    const { students, groups } = useCRM();

    const graduates = students.filter(s => s.status === 'Bitiruvchi');

    // Group by course
    const courseMap: Record<string, number> = {};
    graduates.forEach(s => {
        const group = groups.find(g => g.id === s.groups?.[0]);
        const name = group?.courseName || 'Boshqa';
        courseMap[name] = (courseMap[name] || 0) + 1;
    });

    const courseStats = Object.entries(courseMap).map(([label, value]) => ({
        label,
        value,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    })).slice(0, 5);

    // Yearly trend (last 5 years)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - (4 - i));
    const yearlyTrend = years.map(y => ({
        label: y.toString(),
        value: graduates.filter(s => {
            if (!s.statusChangedAt) return false;
            return new Date(s.statusChangedAt).getFullYear() === y;
        }).length
    }));

    const thisYearCount = graduates.filter(s => {
        if (!s.statusChangedAt) return false;
        return new Date(s.statusChangedAt).getFullYear() === currentYear;
    }).length;

    const tableRows = graduates.map(s => ({
        name: s.name,
        course: groups.find(g => g.id === s.groups?.[0])?.courseName || 'Noma\'lum',
        date: s.statusChangedAt ? new Date(s.statusChangedAt).toLocaleDateString() : 'Noma\'lum',
        score: s.rating || 0
    }));

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Jami bitiruvchilar" value={graduates.length} icon={<GraduationCap size={16} />} color="emerald" />
                <StatCard label="Bu yil" value={thisYearCount} icon={<Award size={16} />} color="sky" />
                <StatCard label="O'rtacha ball" value={graduates.length > 0 ? (graduates.reduce((s, g) => s + (g.rating || 0), 0) / graduates.length).toFixed(1) : '0'} icon={<TrendingUp size={16} />} color="amber" />
                <StatCard label="Aktiv guruhlar" value={groups.length} icon={<Briefcase size={16} />} color="violet" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ReportCard>
                    <SectionHeader title="Yillik bitirish dinamikasi" sub="Muvaffaqiyatli yakunlaganlar" />
                    <LineChart data={yearlyTrend} color="#10b981" />
                </ReportCard>
                <ReportCard>
                    <SectionHeader title="Yo'nalishlar bo'yicha" sub="Bitiruvchilar soni" />
                    <BarChart data={courseStats} horizontal />
                </ReportCard>
            </div>

            <ReportCard>
                <SectionHeader 
                    title="Yaqindagi bitiruvchilar" 
                    action={
                        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-emerald-500 transition-all">
                            <Download size={14} /> CERTIFICATES
                        </button>
                    }
                />
                <DataTable 
                    columns={[
                        { key: 'name', label: "Talaba" },
                        { key: 'course', label: "Kurs yo'nalishi" },
                        { key: 'date', label: "Sana" },
                        { key: 'score', label: "Imtihon balli", render: r => <span className="font-extrabold text-emerald-600">{r.score}</span> }
                    ]}
                    rows={tableRows}
                />
            </ReportCard>
        </div>
    );
}
