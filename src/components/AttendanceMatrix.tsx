import React, { useState } from 'react';
import { Attendance, Student, Group } from '../types';
import { useCRM } from '../context/CRMContext';
import { Check, X, HelpCircle, XCircle } from 'lucide-react';

interface AttendanceMatrixProps {
    group: Group;
    students: Student[];
    attendances: Attendance[];
}

export default function AttendanceMatrix({ group, students, attendances }: AttendanceMatrixProps) {
    const { addAttendance, showNotification } = useCRM();
    const [activePopover, setActivePopover] = useState<{ studentId: number, date: string } | null>(null);

    // Helper to get last 12 lesson dates
    const getLessonDates = (count: number) => {
        const dates: string[] = [];
        let curr = new Date();
        const isMatch = (d: Date) => {
            const dw = d.getDay();
            const pattern = (group.days || '').toUpperCase();
            if (pattern.includes('TOQ')) return [1, 3, 5].includes(dw);
            if (pattern.includes('JUFT')) return [2, 4, 6].includes(dw);
            return dw !== 0; // HAR_KUNI
        };

        let attempts = 0;
        while (dates.length < count && attempts < 60) {
            if (isMatch(curr)) {
                dates.unshift(curr.toISOString().split('T')[0]);
            }
            curr.setDate(curr.getDate() - 1);
            attempts++;
        }
        return dates;
    };

    const lessonDates = getLessonDates(12);

    const getStatus = (studentId: number, date: string) => {
        return attendances.find(a => a.studentId === studentId && a.date === date && a.groupId === group.id);
    };

    const getStatusColor = (studentId: number, date: string) => {
        const att = getStatus(studentId, date);
        if (!att) {
            const today = new Date().toISOString().split('T')[0];
            if (date < today) return 'bg-amber-400 shadow-sm shadow-amber-500/20'; // Unmarked/Waiting
            return 'bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700'; // Future
        }
        if (att.status === 'Keldi') return 'bg-emerald-500 shadow-sm shadow-emerald-500/20';
        if (att.status === 'Kelmapdi') return 'bg-rose-500 shadow-sm shadow-rose-500/20';
        if (att.status === 'Sababli') return 'bg-sky-500 shadow-sm shadow-sky-500/20';
        if (att.status === 'Dars bo\'lmadi') return 'bg-gray-400 dark:bg-gray-600';
        if (att.status === 'O\'tildi') return 'bg-amber-400 shadow-sm shadow-amber-500/20'; // Neutral Yellow
        return 'bg-amber-400';
    };

    const handleStatusSelect = async (studentId: number, date: string, status: string) => {
        try {
            await addAttendance({ studentId, groupId: group.id, date, status });
            setActivePopover(null);
        } catch (err) {
            console.error("Attendance update failed", err);
        }
    };

    const getDayLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        return `${date.getDate()}/${date.getMonth() + 1}`;
    };

    return (
        <div className="bg-white dark:bg-gray-900/40 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-800 transition-all">
            <div className="overflow-x-auto custom-scrollbar min-h-[500px] p-2">
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                            <th className="sticky left-0 z-30 bg-gray-50 dark:bg-gray-800 p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-r border-gray-100 dark:border-gray-700 min-w-[200px]">O'quvchi</th>
                            {lessonDates.map(date => (
                                <th key={date} className="p-6 text-center text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">{getDayLabel(date)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {students.map(student => (
                            <tr key={student.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/30 transition-colors">
                                <td className="sticky left-0 z-20 bg-white dark:bg-gray-900 p-6 border-r border-gray-100 dark:border-gray-700">
                                    <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tighter truncate">{student.name}</p>
                                </td>
                                {lessonDates.map(date => (
                                    <td key={date} className="p-4 text-center relative overflow-visible">
                                        <button 
                                            onClick={() => {
                                                const today = new Date().toISOString().split('T')[0];
                                                if (date > today) {
                                                    showNotification("Kelajakdagi darsga yo'qlama qilib bo'lmaydi", "info");
                                                    return;
                                                }
                                                setActivePopover(activePopover?.studentId === student.id && activePopover?.date === date ? null : { studentId: student.id, date });
                                            }}
                                            className={`w-10 h-10 rounded-xl mx-auto transition-all transform hover:scale-110 active:scale-90 flex items-center justify-center text-[11px] font-black text-white ${getStatusColor(student.id, date)}`}
                                            title={`${student.name}: ${date}`}
                                        >
                                            {getStatus(student.id, date)?.status === 'Keldi' && 'K'}
                                            {getStatus(student.id, date)?.status === 'Kelmapdi' && 'Q'}
                                            {getStatus(student.id, date)?.status === 'Sababli' && 'S'}
                                            {getStatus(student.id, date)?.status === 'Dars bo\'lmadi' && 'X'}
                                        </button>

                                        {activePopover?.studentId === student.id && activePopover?.date === date && (
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 flex flex-col gap-1 min-w-[140px] animate-in slide-in-from-top-2 duration-200">
                                                <button onClick={() => handleStatusSelect(student.id, date, 'Keldi')} className="flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl transition-all">
                                                    <div className="w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center text-white"><Check size={12} strokeWidth={4} /></div>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">Keldi</span>
                                                </button>
                                                <button onClick={() => handleStatusSelect(student.id, date, 'Kelmapdi')} className="flex items-center gap-3 px-4 py-3 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl transition-all">
                                                    <div className="w-5 h-5 bg-rose-500 rounded-lg flex items-center justify-center text-white"><X size={12} strokeWidth={4} /></div>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">Qoldi</span>
                                                </button>
                                                <button onClick={() => handleStatusSelect(student.id, date, 'Sababli')} className="flex items-center gap-3 px-4 py-3 hover:bg-sky-50 dark:hover:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-xl transition-all">
                                                    <div className="w-5 h-5 bg-sky-500 rounded-lg flex items-center justify-center text-white"><HelpCircle size={12} strokeWidth={4} /></div>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">Sababli</span>
                                                </button>
                                                <button onClick={() => handleStatusSelect(student.id, date, 'Dars bo\'lmadi')} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl transition-all">
                                                    <div className="w-5 h-5 bg-gray-400 dark:bg-gray-600 rounded-lg flex items-center justify-center text-white font-bold text-[10px]">X</div>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Dars bo'lmadi</span>
                                                </button>
                                                <div className="h-px bg-gray-50 dark:bg-gray-700 my-1 px-2" />
                                                <button onClick={() => setActivePopover(null)} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-400 rounded-xl transition-all">
                                                    <XCircle size={14} />
                                                    <span className="text-[9px] font-bold uppercase tracking-widest">Yopish</span>
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="p-8 bg-gray-50/20 dark:bg-gray-800/20 border-t border-dashed border-gray-100 dark:border-gray-800 flex flex-wrap gap-6 justify-center">
                <StatusLink color="bg-emerald-500" label="K - Keldi" />
                <StatusLink color="bg-rose-500" label="Q - Qoldirdi" />
                <StatusLink color="bg-sky-500" label="S - Sababli" />
                <StatusLink color="bg-gray-400 dark:bg-gray-600" label="X - Dars bo'lmadi" />
                <StatusLink color="bg-amber-400" label="Belgilanmagan" />
                <StatusLink color="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700" label="Rejadagi" />
            </div>
        </div>
    );
}

function StatusLink({ color, label }: { color: string, label: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{label}</span>
        </div>
    );
}
