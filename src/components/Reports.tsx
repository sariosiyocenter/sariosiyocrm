import React, { useState } from 'react';
import {
    FileText, TrendingUp, Users, UserMinus,
    CreditCard, BarChart3, GraduationCap,
    Target, ChevronRight, Calendar, Filter, Search
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';

const REPORT_TYPES = [
    { id: 'payments', label: "To'lovlar hisoboti", icon: <CreditCard className="w-5 h-5" />, color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
    { id: 'students_payment', label: "O'quvchilar to'lovi", icon: <Users className="w-5 h-5" />, color: 'text-amber-500', bgColor: 'bg-amber-50' },
    { id: 'left_students', label: "Ketgan o'quvchilar hisoboti", icon: <UserMinus className="w-5 h-5" />, color: 'text-red-500', bgColor: 'bg-red-50' },
    { id: 'staff_attendance', label: "Xodimlar Davomati Hisoboti", icon: <BarChart3 className="w-5 h-5" />, color: 'text-blue-500', bgColor: 'bg-blue-50' },
    { id: 'bonuses', label: "O'quvchilar Bonuslari", icon: <TrendingUp className="w-5 h-5" />, color: 'text-green-500', bgColor: 'bg-green-50' },
    { id: 'leads', label: "Lidlar Hisoboti", icon: <Target className="w-5 h-5" />, color: 'text-purple-500', bgColor: 'bg-purple-50' },
    { id: 'students_general', label: "O'quvchilar Hisoboti", icon: <Users className="w-5 h-5" />, color: 'text-sky-500', bgColor: 'bg-sky-50' },
    { id: 'graduates', label: "Bitiruvchilar", icon: <GraduationCap className="w-5 h-5" />, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
    { id: 'stats', label: "Markaz Faoliyati Statistikasi", icon: <FileText className="w-5 h-5" />, color: 'text-slate-500', bgColor: 'bg-slate-50' },
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
        if (activeReport === 'payments') {
            return (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="p-4 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">O'quvchi</th>
                                <th className="p-4 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Summa</th>
                                <th className="p-4 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Turi</th>
                                <th className="p-4 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Sana</th>
                                <th className="p-4 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Izoh</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPayments.map(p => {
                                const student = students.find(s => s.id === p.studentId);
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 border-b border-slate-100 text-sm font-bold text-slate-700">{student?.name || 'Noma\'lum'}</td>
                                        <td className="p-4 border-b border-slate-100 text-sm font-black text-emerald-600">{p.amount.toLocaleString()} UZS</td>
                                        <td className="p-4 border-b border-slate-100 text-sm font-medium"><span className="px-2 py-1 bg-indigo-50 text-indigo-500 rounded-md text-[10px] uppercase font-bold">{p.type}</span></td>
                                        <td className="p-4 border-b border-slate-100 text-sm text-slate-500">{p.date}</td>
                                        <td className="p-4 border-b border-slate-100 text-sm text-slate-400 italic">{p.description || '-'}</td>
                                    </tr>
                                );
                            })}
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
                            <tr className="bg-slate-50/50">
                                <th className="p-4 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Ism familiya</th>
                                <th className="p-4 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Balans</th>
                                <th className="p-4 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Status</th>
                                <th className="p-4 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Qarzdorlik</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 border-b border-slate-100 text-sm font-bold text-slate-700">{s.name}</td>
                                    <td className={`p-4 border-b border-slate-100 text-sm font-black ${s.balance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{s.balance.toLocaleString()} UZS</td>
                                    <td className="p-4 border-b border-slate-100 text-sm font-medium">
                                        <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold ${s.status === 'Faol' ? 'bg-green-50 text-green-500' : 'bg-slate-50 text-slate-400'}`}>{s.status}</span>
                                    </td>
                                    <td className="p-4 border-b border-slate-100 text-sm font-bold text-red-500">{s.balance < 0 ? Math.abs(s.balance).toLocaleString() + ' so\'m' : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <img src="https://api.dicebear.com/7.x/shapes/svg?seed=reporting&backgroundColor=ffffff" alt="Report icon" className="w-32 h-32 opacity-20 mb-4" />
                <h3 className="text-slate-400 font-medium italic">Ushbu hisobot turi tez orada ishga tushadi</h3>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Hisobotlar</h1>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                        />
                        <span className="text-slate-300 mx-1">—</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                        />
                    </div>
                    <button className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors">
                        <Search className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {REPORT_TYPES.map((report) => (
                    <button
                        key={report.id}
                        onClick={() => setActiveReport(report.id)}
                        className={`bg-white p-6 rounded-2xl border ${activeReport === report.id ? 'border-indigo-500 ring-2 ring-indigo-50' : 'border-slate-100'} shadow-sm hover:shadow-md transition-all flex items-center justify-between group text-left`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 ${report.bgColor} ${report.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                {report.icon}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-[15px]">{report.label}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Batafsil ma'lumot olish uchun bosing</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                    </button>
                ))}
            </div>

            {activeReport && (
                <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h2 className="font-extrabold text-[#5C67F2] uppercase tracking-[0.2em] text-xs">
                            {REPORT_TYPES.find(r => r.id === activeReport)?.label}
                        </h2>
                    </div>
                    {renderReportContent()}
                </div>
            )}
        </div>
    );
}
