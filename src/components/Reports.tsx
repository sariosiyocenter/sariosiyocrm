import React, { useState } from 'react';
import {
    FileText, TrendingUp, Users, UserMinus,
    CreditCard, BarChart3, GraduationCap,
    Target, ChevronRight, Calendar, Search
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';

import RoomSchedule from './RoomSchedule';

const REPORT_TYPES = [
    { id: 'payments', label: "To'lovlar hisoboti", icon: <CreditCard className="w-5 h-5 text-indigo-500" /> },
    { id: 'students_payment', label: "O'quvchilar to'lovi", icon: <Users className="w-5 h-5 text-emerald-500" /> },
    { id: 'room_occupancy', label: "Xonalar Bandligi", icon: <Calendar className="w-5 h-5 text-sky-500" /> },
    { id: 'left_students', label: "Ketgan o'quvchilar hisoboti", icon: <UserMinus className="w-5 h-5 text-rose-500" /> },
    { id: 'staff_attendance', label: "Xodimlar Davomati Hisoboti", icon: <BarChart3 className="w-5 h-5 text-blue-500" /> },
    { id: 'bonuses', label: "O'quvchilar Bonuslari", icon: <TrendingUp className="w-5 h-5 text-amber-500" /> },
    { id: 'leads', label: "Lidlar Hisoboti", icon: <Target className="w-5 h-5 text-purple-500" /> },
    { id: 'students_general', label: "O'quvchilar Hisoboti", icon: <Users className="w-5 h-5 text-indigo-500" /> },
    { id: 'graduates', label: "Bitiruvchilar", icon: <GraduationCap className="w-5 h-5 text-emerald-500" /> },
    { id: 'stats', label: "Markaz Faoliyati Statistikasi", icon: <FileText className="w-5 h-5 text-gray-500" /> },
];

export default function Reports() {
    const { students, payments } = useCRM();
    const [activeReport, setActiveReport] = useState<string | null>(null);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const filteredPayments = payments.filter(p => {
        return p.date >= startDate && p.date <= endDate;
    });

    const renderReportContent = () => {
        if (activeReport === 'room_occupancy') {
            return <div className="p-8"><RoomSchedule /></div>;
        }

        if (activeReport === 'payments') {
            return (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                                <th className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-loose">O'quvchi</th>
                                <th className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-loose text-right">Summa</th>
                                <th className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-loose text-center">Turi</th>
                                <th className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-loose">Sana</th>
                                <th className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-loose">Izoh</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {filteredPayments.map(p => {
                                const student = students.find(s => s.id === p.studentId);
                                return (
                                    <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/10 transition-colors group">
                                        <td className="p-6 text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-sky-600 transition-colors">{student?.name || 'Noma\'lum'}</td>
                                        <td className="p-6 text-sm font-extrabold text-emerald-600 dark:text-emerald-400 text-right">+{p.amount.toLocaleString()} UZS</td>
                                        <td className="p-6 text-center">
                                            <span className="px-4 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-[10px] font-extrabold uppercase tracking-widest border border-gray-200 dark:border-gray-600 shadow-sm">{p.type}</span>
                                        </td>
                                        <td className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{p.date}</td>
                                        <td className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest whitespace-nowrap">{p.description || '-'}</td>
                                    </tr>
                                );
                            })}
                            {filteredPayments.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-16 text-center">
                                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-[2.5rem] bg-gray-50/30 dark:bg-gray-900/10">
                                            <FileText className="w-12 h-12 text-gray-200 dark:text-gray-700 mb-4" />
                                            <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Hech qanday ma'lumot topilmadi</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (activeReport === 'students_payment') {
            return (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                                <th className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-loose">Ism familiya</th>
                                <th className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-loose text-right">Balans (UZS)</th>
                                <th className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-loose text-center">Status</th>
                                <th className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-loose text-right">Qarzdorlik</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {students.map(s => (
                                <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/10 transition-colors group">
                                    <td className="p-6 text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-sky-600 transition-colors">{s.name}</td>
                                    <td className={`p-6 text-sm font-extrabold text-right ${s.balance < 0 ? 'text-rose-600' : 'text-gray-900 dark:text-white'}`}>
                                        {s.balance.toLocaleString()}
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest border transition-all shadow-sm ${s.status === 'Faol' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'}`}>
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="p-6 text-sm font-extrabold text-rose-600 dark:text-rose-400 text-right">
                                        {s.balance < 0 ? Math.abs(s.balance).toLocaleString() : '-'}
                                    </td>
                                </tr>
                            ))}
                            {students.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-16 text-center uppercase tracking-widest text-[10px] font-extrabold text-gray-400 dark:text-gray-500">Hech qanday ma'lumot topilmadi.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            );
        }

        return (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-gray-50/30 dark:bg-gray-900/10">
                <div className="w-24 h-24 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[2rem] flex items-center justify-center text-gray-300 dark:text-gray-600 mb-8 shadow-xl shadow-gray-200/20">
                    <FileText className="w-10 h-10" />
                </div>
                <h3 className="text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">Ushbu hisobot turi tez orada ishga tushadi</h3>
                <div className="mt-8 flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce duration-1000"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce duration-1000 delay-150"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce duration-1000 delay-300"></div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 py-4 animate-in fade-in duration-700">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Hisobotlar Tizimi</h1>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Markaz statistikasi va ma'lumotlar tahlili</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md p-4 rounded-[1.75rem] border border-gray-100 dark:border-gray-700 shadow-sm w-full lg:w-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg flex items-center justify-center text-gray-400">
                            <Calendar size={14} />
                        </div>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-100 dark:border-gray-700 text-[9px] font-extrabold uppercase tracking-widest text-gray-700 dark:text-gray-300 outline-none focus:border-violet-500 transition-all shadow-inner w-32"
                        />
                        <span className="text-gray-300 dark:text-gray-600 font-extrabold text-xs">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-100 dark:border-gray-700 text-[9px] font-extrabold uppercase tracking-widest text-gray-700 dark:text-gray-300 outline-none focus:border-violet-500 transition-all shadow-inner w-32"
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-50 dark:border-gray-700 shadow-xl shadow-gray-200/10 dark:shadow-none animate-in slide-in-from-top-4 duration-500">
                {REPORT_TYPES.map((report, idx) => (
                    <button
                        key={report.id}
                        onClick={() => setActiveReport(report.id)}
                        className={`flex items-center gap-3 px-5 py-3 rounded-2xl border text-left transition-all group scale-in duration-300 ${
                            activeReport === report.id 
                            ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-600/20' 
                            : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-violet-300 dark:hover:border-violet-600 hover:bg-white dark:hover:bg-gray-800'
                        }`}
                        style={{ animationDelay: `${idx * 30}ms` }}
                    >
                        <div className={`p-2 rounded-xl transition-colors ${activeReport === report.id ? 'bg-white/20' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm'}`}>
                            {React.cloneElement(report.icon as React.ReactElement, { size: 16, className: activeReport === report.id ? 'text-white' : (report.icon as any).props.className })}
                        </div>
                        <span className={`text-[10px] font-extrabold uppercase tracking-widest ${activeReport === report.id ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                            {report.label}
                        </span>
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[3rem] shadow-2xl shadow-gray-200/20 dark:shadow-none border border-gray-50 dark:border-gray-700 overflow-hidden min-h-[500px] animate-in slide-in-from-bottom-6 duration-700">
                <div className="px-10 py-8 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-3 h-3 rounded-full bg-violet-500 ring-4 ring-violet-500/20"></div>
                        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">
                            {activeReport ? REPORT_TYPES.find(r => r.id === activeReport)?.label : "Hisobotni tanlang"}
                        </h2>
                    </div>
                </div>
                {activeReport ? renderReportContent() : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center opacity-60">
                        <div className="w-24 h-24 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[2.5rem] flex items-center justify-center text-gray-300 dark:text-gray-700 mb-8">
                            <FileText size={40} />
                        </div>
                        <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Davom etish uchun yuqoridagi filtrlardan bittasini tanlang</p>
                    </div>
                )}
            </div>
        </div>
    );
}
