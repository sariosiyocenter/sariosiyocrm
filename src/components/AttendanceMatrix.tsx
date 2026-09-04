import React, { useState } from 'react';
import { Attendance, Student, Group } from '../types';
import { useCRM } from '../context/CRMContext';
import { Check, X, HelpCircle, XCircle, Clock, LogOut, Ban } from 'lucide-react';

interface AttendanceMatrixProps {
    group: Group;
    students: Student[];
    attendances: Attendance[];
    selectedDate?: string;
}

const STATUSES = [
    { key: 'Keldi',       label: 'Keldi',           color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', light: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30', icon: <Check size={11} strokeWidth={3} />, short: '✓' },
    { key: 'Kelmapdi',    label: 'Kelmadi',          color: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400',       light: 'hover:bg-rose-50 dark:hover:bg-rose-900/30',       icon: <X size={11} strokeWidth={3} />, short: '✗' },
    { key: 'Sababli',     label: 'Sababli',          color: 'bg-sky-500',     text: 'text-sky-600 dark:text-sky-400',         light: 'hover:bg-sky-50 dark:hover:bg-sky-900/30',         icon: <HelpCircle size={11} />, short: 'S' },
    { key: 'Kechikdi',    label: 'Kechikib keldi',   color: 'bg-orange-400',  text: 'text-orange-600 dark:text-orange-400',   light: 'hover:bg-orange-50 dark:hover:bg-orange-900/30',   icon: <Clock size={11} />, short: '~' },
    { key: 'ErtaKetdi',   label: 'Erta ketdi',       color: 'bg-purple-500',  text: 'text-purple-600 dark:text-purple-400',   light: 'hover:bg-purple-50 dark:hover:bg-purple-900/30',   icon: <LogOut size={11} />, short: '↓' },
    { key: "Dars bo'lmadi", label: "Dars bo'lmadi",  color: 'bg-gray-400 dark:bg-gray-600', text: 'text-matn-sokin', light: 'hover:bg-gray-100 dark:hover:bg-gray-700', icon: <Ban size={11} />, short: '—' },
] as const;

export default function AttendanceMatrix({ group, students, attendances, selectedDate }: AttendanceMatrixProps) {
    const { addAttendance, showNotification } = useCRM();
    const [activePopover, setActivePopover] = useState<{
        studentId: number;
        date: string;
        coords: { top: number; left: number };
    } | null>(null);

    const today = new Date().toISOString().split('T')[0];

    const getLessonDates = (count: number) => {
        const dates: string[] = [];
        let curr = new Date();
        const pattern = (group.days || '').toUpperCase();
        const isMatch = (d: Date) => {
            const dw = d.getDay();
            if (pattern.includes('TOQ')) return [1, 3, 5].includes(dw);
            if (pattern.includes('JUFT')) return [2, 4, 6].includes(dw);
            return dw !== 0;
        };
        let attempts = 0;
        while (dates.length < count && attempts < 90) {
            if (isMatch(curr)) dates.unshift(curr.toISOString().split('T')[0]);
            curr.setDate(curr.getDate() - 1);
            attempts++;
        }
        return dates;
    };

    const lessonDates = getLessonDates(14);

    const getAtt = (studentId: number, date: string) =>
        attendances.find(a => a.studentId === studentId && a.date === date && a.groupId === group.id);

    const getAttendancePct = (studentId: number) => {
        const pastDates = lessonDates.filter(d => d <= today);
        if (!pastDates.length) return null;
        const came = pastDates.filter(d => {
            const s = getAtt(studentId, d)?.status;
            return s === 'Keldi' || s === 'Kechikdi' || s === 'ErtaKetdi';
        }).length;
        return Math.round((came / pastDates.length) * 100);
    };

    const handleStatusSelect = async (studentId: number, date: string, status: typeof STATUSES[number]['key']) => {
        try {
            const existingWithTopic = attendances.find(a => a.groupId === group.id && a.date === date && a.topicId);
            await addAttendance({ studentId, groupId: group.id, date, status, topicId: existingWithTopic?.topicId });
            setActivePopover(null);
        } catch {
            showNotification("Xatolik yuz berdi", "error");
        }
    };

    const getDayLabel = (dateStr: string) => {
        const d = new Date(dateStr);
        const days = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
        return { day: days[d.getDay()], date: `${d.getDate()}/${d.getMonth() + 1}` };
    };

    const isToday = (d: string) => d === today;
    const isSelected = (d: string) => selectedDate && d === selectedDate;

    return (
        <div className="bg-sirt rounded-2xl border border-chiziq overflow-hidden shadow-sm">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-separate border-spacing-0">
                    <thead>
                        <tr>
                            {/* Name column header */}
                            <th className="sticky left-0 z-30 bg-ichki/80 px-4 py-3 text-left border-b border-r border-chiziq min-w-[160px]">
                                <span className="text-[11px] font-bold text-matn-xira">O'quvchi</span>
                            </th>
                            {/* % column */}
                            <th className="bg-ichki/80 px-3 py-3 border-b border-r border-chiziq min-w-[52px]">
                                <span className="text-[11px] font-bold text-matn-xira block text-center">%</span>
                            </th>
                            {/* Date columns */}
                            {lessonDates.map(date => {
                                const { day, date: dateNum } = getDayLabel(date);
                                const highlight = isToday(date) || isSelected(date);
                                return (
                                    <th key={date} className={`px-1 py-2 border-b border-chiziq min-w-[44px] ${highlight ? 'bg-emerald-50 dark:bg-emerald-950/30 border-b-2 border-b-emerald-400' : 'bg-gray-50/50 dark:bg-gray-800/50'}`}>
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className={`text-[7px] font-black ${highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-matn-xira'}`}>{day}</span>
                                            <span className={`text-[11px] font-bold ${highlight ? 'text-emerald-700 dark:text-emerald-300' : 'text-matn-sokin'}`}>{dateNum}</span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student, si) => {
                            const pct = getAttendancePct(student.id);
                            const rowBg = si % 2 === 0 ? 'bg-sirt' : 'bg-gray-50/30 dark:bg-gray-800/20';
                            return (
                                <tr key={student.id} className={`${rowBg} hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 transition-colors`}>
                                    {/* Name */}
                                    <td className={`sticky left-0 z-20 ${rowBg} px-4 py-2.5 border-r border-b border-chiziq`}>
                                        <p className="text-[11px] font-bold text-matn tracking-tight truncate max-w-[140px]">{student.name}</p>
                                    </td>
                                    {/* % */}
                                    <td className="px-2 py-2.5 border-r border-b border-chiziq text-center">
                                        {pct !== null && (
                                            <span className={`text-[11px] font-bold tabular-nums ${pct >= 80 ? 'text-emerald-500' : pct >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                {pct}%
                                            </span>
                                        )}
                                    </td>
                                    {/* Date cells */}
                                    {lessonDates.map(date => {
                                        const att = getAtt(student.id, date);
                                        const isFuture = date > today;
                                        const isHighlight = isToday(date) || isSelected(date);
                                        let cellClass = '';
                                        let content: React.ReactNode = null;

                                        // normalize legacy status names (e.g. old "Kelmadi" → "Kelmapdi")
                                        const rawStatus: string = att?.status ?? '';
                                        const normalizedStatus = rawStatus === 'Kelmadi' ? 'Kelmapdi' : rawStatus;
                                        const resolvedStatusObj = att ? STATUSES.find(s => s.key === normalizedStatus) : null;

                                        if (isFuture) {
                                            cellClass = 'border border-dashed border-gray-200 dark:border-gray-800 opacity-30';
                                        } else if (!att) {
                                            cellClass = 'border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:border-gray-400 dark:hover:border-gray-500';
                                            content = <span className="text-matn-xira text-[11px] font-bold">—</span>;
                                        } else if (resolvedStatusObj) {
                                            cellClass = `${resolvedStatusObj.color} text-white`;
                                            content = <span className="text-[11px] font-bold">{resolvedStatusObj.short}</span>;
                                        } else if (att) {
                                            // unknown/legacy status — treat as unrecorded so user can re-set
                                            cellClass = 'border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:border-gray-400 dark:hover:border-gray-500';
                                            content = <span className="text-matn-xira text-[11px] font-bold">—</span>;
                                        }

                                        return (
                                            <td key={date} className={`p-1 text-center border-b border-chiziq-mayin/50 ${isHighlight ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}`}>
                                                <button
                                                    onClick={e => {
                                                        if (isFuture) {
                                                            showNotification("Kelajakdagi darsga yo'qlama qilib bo'lmaydi", "info");
                                                            return;
                                                        }
                                                        if (activePopover?.studentId === student.id && activePopover?.date === date) {
                                                            setActivePopover(null);
                                                        } else {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setActivePopover({ studentId: student.id, date, coords: { top: rect.bottom, left: rect.left + rect.width / 2 } });
                                                        }
                                                    }}
                                                    className={`w-8 h-8 rounded-xl mx-auto flex items-center justify-center transition-all hover:scale-110 active:scale-90 cursor-pointer ${cellClass}`}
                                                    title={`${student.name} — ${date}${att ? `: ${att.status}` : ''}`}
                                                >
                                                    {content}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {students.length === 0 && (
                            <tr>
                                <td colSpan={lessonDates.length + 2} className="py-12 text-center text-[11px] font-bold text-matn-xira">
                                    Bu kursda o'quvchilar yo'q
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Legend — compact */}
            <div className="px-4 py-2.5 border-t border-chiziq flex flex-wrap gap-x-4 gap-y-1">
                {STATUSES.map(s => (
                    <div key={s.key} className="flex items-center gap-1.5">
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center text-white ${s.color}`}>
                            <span className="text-[7px] font-black">{s.short}</span>
                        </div>
                        <span className="text-[10px] font-bold text-matn-xira">{s.label}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-md border border-gray-200 dark:border-gray-800 flex items-center justify-center">
                        <span className="text-[7px] font-black text-gray-300">—</span>
                    </div>
                    <span className="text-[10px] font-bold text-matn-xira">Belgilanmagan</span>
                </div>
            </div>

            {/* Popover */}
            {activePopover && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                    <div
                        style={{ position: 'fixed', top: `${activePopover.coords.top + 6}px`, left: `${activePopover.coords.left}px`, transform: 'translateX(-50%)' }}
                        className="z-50 bg-sirt rounded-2xl shadow-2xl border border-chiziq p-1.5 flex flex-col gap-0.5 min-w-[160px] animate-in slide-in-from-top-2 duration-150"
                    >
                        {STATUSES.map(s => (
                            <button
                                key={s.key}
                                onClick={() => handleStatusSelect(activePopover.studentId, activePopover.date, s.key)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${s.light} ${s.text}`}
                            >
                                <div className={`w-5 h-5 ${s.color} rounded-lg flex items-center justify-center text-white`}>{s.icon}</div>
                                <span className="text-[11px] font-bold">{s.label}</span>
                            </button>
                        ))}
                        <div className="h-px bg-chiziq my-0.5" />
                        <button onClick={() => setActivePopover(null)} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-matn-xira transition-all cursor-pointer">
                            <XCircle size={14} />
                            <span className="text-[11px] font-bold">Yopish</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
