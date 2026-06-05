import React, { useState } from 'react';
import {
    FileText, TrendingUp, Users, UserMinus,
    CreditCard, BarChart3, GraduationCap,
    Target, ChevronRight, Calendar, Search
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';

import RoomSchedule from './RoomSchedule';

import PaymentsReport from './reports/PaymentsReport';
import StudentsPaymentReport from './reports/StudentsPaymentReport';
import LeftStudentsReport from './reports/LeftStudentsReport';
import StaffAttendanceReport from './reports/StaffAttendanceReport';
import StudentBonusReport from './reports/StudentBonusReport';
import LeadsReport from './reports/LeadsReport';
import StudentsGeneralReport from './reports/StudentsGeneralReport';
import GraduatesReport from './reports/GraduatesReport';
import CenterStatsReport from './reports/CenterStatsReport';

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
    const location = useLocation();

    React.useEffect(() => {
        if (location.state && (location.state as any).activeReport) {
            setActiveReport((location.state as any).activeReport);
        }
    }, [location]);

    const renderReportContent = () => {
        switch (activeReport) {
            case 'room_occupancy': return <div className="p-8"><RoomSchedule /></div>;
            case 'payments': return <PaymentsReport startDate={startDate} endDate={endDate} />;
            case 'students_payment': return <StudentsPaymentReport startDate={startDate} endDate={endDate} />;
            case 'left_students': return <LeftStudentsReport />;
            case 'staff_attendance': return <StaffAttendanceReport />;
            case 'bonuses': return <StudentBonusReport />;
            case 'leads': return <LeadsReport />;
            case 'students_general': return <StudentsGeneralReport />;
            case 'graduates': return <GraduatesReport />;
            case 'stats': return <CenterStatsReport />;
            default: return (
                <div className="flex-1 flex flex-col items-center justify-center p-20 text-center opacity-60">
                    <div className="w-24 h-24 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[2.5rem] flex items-center justify-center text-gray-300 dark:text-gray-700 mb-8">
                        <FileText size={40} />
                    </div>
                    <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Davom etish uchun yuqoridagi filtrlardan bittasini tanlang</p>
                </div>
            );
        }
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
