import React, { useState } from 'react';
import { Group, Attendance } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { useCRM } from '../context/CRMContext';

interface GroupAttendanceCalendarProps {
    group: Group;
    attendances: Attendance[];
    selectedDate: string;
    onSelectDate: (date: string) => void;
    students: any[];
}

export default function GroupAttendanceCalendar({ group, attendances, selectedDate, onSelectDate, students }: GroupAttendanceCalendarProps) {
    const { user, addBatchAttendance, deleteBatchAttendance, showNotification } = useCRM();
    const [viewDate, setViewDate] = useState(new Date());
    const [activePopover, setActivePopover] = useState<string | null>(null);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const blanks = firstDay === 0 ? 6 : firstDay - 1;

    const monthName = new Intl.DateTimeFormat('uz-UZ', { month: 'long', year: 'numeric' }).format(viewDate);

    const isLessonDay = (date: Date) => {
        const dw = date.getDay();
        const pattern = (group.days || '').toUpperCase();
        if (pattern.includes('TOQ')) return [1, 3, 5].includes(dw);
        if (pattern.includes('JUFT')) return [2, 4, 6].includes(dw);
        return dw !== 0; 
    };

    const getDayStatus = (dateStr: string, isLesson: boolean) => {
        if (!isLesson) return 'off';
        const groupAtts = attendances.filter(a => a.date === dateStr && a.groupId === group.id);
        const todayStr = new Date().toISOString().split('T')[0];
        
        if (groupAtts.length > 0) {
            // Any status means it was conducted, except if ALL are "Dars bo'lmadi"
            if (groupAtts.every(a => a.status === 'Dars bo\'lmadi')) return 'not_conducted';
            return 'conducted';
        }
        
        if (dateStr < todayStr) return 'unmarked';
        return 'future';
    };

    const handleBatchStatus = async (date: string, status: string | null) => {
        try {
            if (status === null) {
                await deleteBatchAttendance(group.id, date);
            } else {
                const records = students.map(s => ({ studentId: s.id, status }));
                await addBatchAttendance(group.id, date, records);
            }
            setActivePopover(null);
            showNotification("Muvaffaqiyatli saqlandi", "success");
        } catch (err) {
            showNotification("Xatolik yuz berdi", "error");
        }
    };

    const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const StatusChoicePopover = ({ date }: { date: string }) => (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-2 flex flex-col gap-1 min-w-[170px] animate-in slide-in-from-top-2 duration-200">
            <button 
                onClick={() => handleBatchStatus(date, 'O\'tildi')}
                className="flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl transition-all"
            >
                <div className="w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center text-white"><CalendarIcon size={12} strokeWidth={3} /></div>
                <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Dars o'tildi</span>
            </button>
            <button 
                onClick={() => handleBatchStatus(date, 'Dars bo\'lmadi')}
                className="flex items-center gap-3 px-4 py-3 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl transition-all"
            >
                <div className="w-5 h-5 bg-rose-500 rounded-lg flex items-center justify-center text-white"><XCircle size={12} strokeWidth={3} /></div>
                <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Dars bo'lmadi</span>
            </button>
            <div className="h-px bg-gray-50 dark:bg-gray-700 my-1 px-2" />
            <button onClick={() => setActivePopover(null)} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-400 rounded-xl transition-all">
                <XCircle size={14} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Yopish</span>
            </button>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-900/40 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 shadow-sm transition-all h-full flex flex-col relative overflow-visible">
            <div className="flex items-center justify-between mb-8 px-2">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <CalendarIcon size={16} className="text-sky-500" />
                    {monthName}
                </h4>
                <div className="flex items-center gap-2">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-gray-400 transition-all"><ChevronLeft size={18} /></button>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-gray-400 transition-all"><ChevronRight size={18} /></button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2 flex-grow">
                {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map(d => (
                    <div key={d} className="text-center text-[9px] font-extrabold text-gray-300 dark:text-gray-600 uppercase tracking-widest pb-3">{d}</div>
                ))}
                {Array(blanks).fill(0).map((_, i) => <div key={`b-${i}`} />)}
                {Array(daysInMonth).fill(0).map((_, i) => {
                    const d = i + 1;
                    const date = new Date(year, month, d);
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isLesson = isLessonDay(date);
                    const status = getDayStatus(dateStr, isLesson);
                    const isSelected = selectedDate === dateStr;

                    const bg = status === 'conducted' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 
                               status === 'not_conducted' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 
                               status === 'unmarked' ? 'bg-amber-400/10 text-amber-600 dark:text-amber-400' : 'bg-transparent';
                    const border = isSelected ? 'border-sky-500 ring-2 ring-sky-500 ring-offset-2 dark:ring-offset-gray-900' : 'border-sky-100/50 dark:border-sky-900/30';
                    const dotColor = status === 'conducted' ? 'bg-emerald-500' : 
                                     status === 'not_conducted' ? 'bg-rose-500' : 
                                     status === 'unmarked' ? 'bg-amber-400' : 'bg-gray-300 dark:bg-gray-600';

                    return (
                        <div key={d} className="relative">
                            <button 
                                onClick={() => {
                                    onSelectDate(dateStr);
                                    if (isLesson) {
                                        const today = new Date().toISOString().split('T')[0];
                                        if (dateStr > today) {
                                            showNotification("Kelajakdagi darsga yo'qlama qilib bo'lmaydi", "info");
                                            return;
                                        }
                                        setActivePopover(activePopover === dateStr ? null : dateStr);
                                    }
                                }}
                                className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all border group hover:scale-105 shadow-sm ${bg} ${border} z-10`}
                            >
                                <span className={`text-[10px] font-bold ${isSelected ? 'text-sky-600 dark:text-sky-400 scale-110' : (isLesson ? 'text-gray-600 dark:text-gray-400' : 'text-gray-300 dark:text-gray-700')}`}>
                                    {d}
                                </span>
                                {isLesson && <div className={`absolute bottom-1.5 w-1 h-1 rounded-full ${dotColor}`} />}
                            </button>
                            {activePopover === dateStr && <StatusChoicePopover date={dateStr} />}
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 pt-8 border-t border-dashed border-gray-100 dark:border-gray-800">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatusLink color="bg-emerald-500" label="Dars o'tildi" />
                    <StatusLink color="bg-amber-400" label="Belgilanmagan" />
                    <StatusLink color="bg-rose-500" label="Dars o'tilmadi" />
                    <StatusLink color="bg-gray-300" label="Rejadagi" />
                </div>
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
