import React, { useState } from 'react';
import {
    FileText, TrendingUp, Users, UserMinus,
    CreditCard, BarChart3, GraduationCap,
    Target, Calendar
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';

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

export default function Reports() {
    const { students, payments } = useCRM();
    const { t } = useLang();
    const REPORT_TYPES = [
        { id: 'payments', label: t('rep_payments'), icon: <CreditCard className="w-4 h-4 text-indigo-500" /> },
        { id: 'students_payment', label: t('rep_students_payment'), icon: <Users className="w-4 h-4 text-emerald-500" /> },
        { id: 'room_occupancy', label: t('rep_room_occupancy'), icon: <Calendar className="w-4 h-4 text-sky-500" /> },
        { id: 'left_students', label: t('rep_left_students'), icon: <UserMinus className="w-4 h-4 text-rose-500" /> },
        { id: 'staff_attendance', label: t('rep_staff_attendance'), icon: <BarChart3 className="w-4 h-4 text-blue-500" /> },
        { id: 'bonuses', label: t('rep_bonuses'), icon: <TrendingUp className="w-4 h-4 text-amber-500" /> },
        { id: 'leads', label: t('rep_leads'), icon: <Target className="w-4 h-4 text-purple-500" /> },
        { id: 'students_general', label: t('rep_students_general'), icon: <Users className="w-4 h-4 text-indigo-500" /> },
        { id: 'graduates', label: t('rep_graduates'), icon: <GraduationCap className="w-4 h-4 text-emerald-500" /> },
        { id: 'stats', label: t('rep_stats'), icon: <FileText className="w-4 h-4 text-gray-500" /> },
    ];

    const [activeReport, setActiveReport] = useState<string | null>(null);
    const [selectedPreset, setSelectedPreset] = useState<'this_month' | 'last_30' | 'this_year' | 'all' | 'custom'>('this_month');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const location = useLocation();

    const handlePreset = (type: 'this_month' | 'last_30' | 'this_year' | 'all') => {
        setSelectedPreset(type);
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        setEndDate(todayStr);

        if (type === 'this_month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            setStartDate(start.toISOString().split('T')[0]);
        } else if (type === 'last_30') {
            const start = new Date();
            start.setDate(today.getDate() - 30);
            setStartDate(start.toISOString().split('T')[0]);
        } else if (type === 'this_year') {
            const start = new Date(today.getFullYear(), 0, 1);
            setStartDate(start.toISOString().split('T')[0]);
        } else if (type === 'all') {
            setStartDate('2024-01-01');
        }
    };

    React.useEffect(() => {
        if (location.state && (location.state as any).activeReport) {
            setActiveReport((location.state as any).activeReport);
        }
    }, [location]);

    const renderReportContent = () => {
        switch (activeReport) {
            case 'room_occupancy': return <div className="p-6"><RoomSchedule /></div>;
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
                <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-750 rounded-2xl flex items-center justify-center text-gray-300 dark:text-gray-700 mb-6">
                        <FileText size={28} />
                    </div>
                    <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('report_select_hint')}</p>
                </div>
            );
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-lg shadow-[#1b6b6b]/20">
                            <FileText size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('reports_title')}</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                {t('reports_subtitle')}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Presets */}
                        <div className="flex items-center gap-1 bg-gray-55 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-800">
                          {['this_month', 'last_30', 'this_year', 'all'].map((type) => {
                            const label = type === 'this_month' ? t('preset_this_month') : type === 'last_30' ? t('preset_30_days') : type === 'this_year' ? t('preset_this_year') : t('preset_all');
                            return (
                              <button 
                                key={type}
                                type="button"
                                onClick={() => handlePreset(type as any)}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                                  selectedPreset === type
                                  ? 'bg-[#1b6b6b] text-white shadow-sm'
                                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom inputs */}
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setSelectedPreset('custom'); }}
                            className="bg-gray-55 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none focus:border-[#1b6b6b] w-32 cursor-pointer"
                          />
                          <span className="text-gray-400 dark:text-gray-500 font-extrabold text-[9px] uppercase tracking-wider">{t('date_to')}</span>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setSelectedPreset('custom'); }}
                            className="bg-gray-55 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none focus:border-[#1b6b6b] w-32 cursor-pointer"
                          />
                        </div>
                    </div>
                </div>
            </div>

            {/* Report Types Buttons */}
            <div className="flex flex-wrap gap-2 bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
                {REPORT_TYPES.map((report, idx) => (
                    <button
                        key={report.id}
                        onClick={() => setActiveReport(report.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            activeReport === report.id 
                            ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white shadow-sm' 
                            : 'bg-gray-55 dark:bg-gray-900 border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-100'
                        }`}
                    >
                        <div className={`p-1.5 rounded-lg ${activeReport === report.id ? 'bg-white/20 text-white [&_svg]:!text-white' : 'bg-white dark:bg-gray-800'}`}>
                            {report.icon}
                        </div>
                        <span className="text-[9px] font-extrabold uppercase tracking-widest">
                            {report.label}
                        </span>
                    </button>
                ))}
            </div>

            {/* Report Body */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden min-h-[400px]">
                {renderReportContent()}
            </div>
        </div>
    );
}
