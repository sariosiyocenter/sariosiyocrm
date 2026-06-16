import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { Clock, MapPin, Calendar, X, Users, Edit2, Save, Sun, Sunset, Filter, LayoutGrid, CalendarRange, Info } from 'lucide-react';
import { Group } from '../types';

const WEEK_DAYS = [
    { id: 'ALL', label: 'Barchasi', short: 'Barch' },
    { id: 'TOQ', label: 'Toq kunlar', short: 'Toq' },
    { id: 'JUFT', label: 'Juft kunlar', short: 'Juft' },
    { id: 'HAR', label: 'Har kuni', short: 'Har' },
];

const FULL_WEEK = [
    { id: 'Dushanba', label: 'Dushanba (Toq)', isToq: true },
    { id: 'Seshanba', label: 'Seshanba (Juft)', isToq: false },
    { id: 'Chorshanba', label: 'Chorshanba (Toq)', isToq: true },
    { id: 'Payshanba', label: 'Payshanba (Juft)', isToq: false },
    { id: 'Juma', label: 'Juma (Toq)', isToq: true },
    { id: 'Shanba', label: 'Shanba (Juft)', isToq: false },
];

type TimeFilter = 'ALL' | 'BEFORE_NOON' | 'AFTER_NOON';

const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

const getGroupColor = (days: string) => {
    const d = days?.toUpperCase() || '';
    if (d.includes('HAR') || d.includes('EVERY')) return { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400' };
    if (d.includes('TOQ')) return { bg: 'bg-cyan-500/10 dark:bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30', dot: 'bg-cyan-400' };
    return { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' };
};

const inp = "w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-2 focus:ring-[#1b6b6b]/10 outline-none transition-all";

export default function RoomSchedule() {
    const { groups, rooms, teachers, courses, updateGroup } = useCRM();

    const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
    const [selectedDayType, setSelectedDayType] = useState<'TOQ' | 'JUFT'>('TOQ');
    const [selectedRoom, setSelectedRoom] = useState<typeof rooms[0] | null>(null);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [editSchedule, setEditSchedule] = useState({ start: '', end: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    // 30-minute slots: 08:00 to 22:00
    const timeSlots: string[] = [];
    for (let h = 8; h <= 21; h++) {
        timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
        timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
    }

    // Is class running *right now*?
    const isCurrentlyActive = (g: Group) => {
        const day = currentTime.getDay(); // 0=Sun, 1=Mon...
        const d = g.days?.toUpperCase() || '';
        let dayMatches = false;
        if (d.includes('HAR') || d.includes('EVERY')) {
            dayMatches = day !== 0;
        } else if (d.includes('TOQ')) {
            dayMatches = [1, 3, 5].includes(day);
        } else if (d.includes('JUFT')) {
            dayMatches = [2, 4, 6].includes(day);
        }

        if (!dayMatches) return false;

        const parts = g.schedule?.split(' - ') || [];
        if (parts.length < 2) return false;

        const currentMin = currentTime.getHours() * 60 + currentTime.getMinutes();
        const startMin = timeToMinutes(parts[0]);
        const endMin = timeToMinutes(parts[1]);

        return currentMin >= startMin && currentMin <= endMin;
    };

    // Helper: Find occupant for time slot (Daily View)
    const getOccupant = (roomId: number, time: string) => {
        return groups.find(g => {
            if (Number(g.room) !== Number(roomId)) return false;
            
            const groupDays = g.days?.toUpperCase() || '';
            const isGroupHarKuni = groupDays.includes('HAR') || groupDays.includes('EVERY');
            const dayMatch = groupDays.includes(selectedDayType) || isGroupHarKuni;

            if (!dayMatch) return false;
            
            const schedule = g.schedule;
            if (!schedule) return false;
            
            const parts = schedule.split(' - ');
            const start = parts[0];
            const end = parts[1];
            
            if (!start || !end) return false;
            
            const slotTime = timeToMinutes(time);
            const startTime = timeToMinutes(start);
            const endTime = timeToMinutes(end);
            
            return slotTime >= startTime && slotTime < endTime;
        });
    };

    // Helper: Build cells with colspans (Daily View)
    const buildRowCells = (roomId: number) => {
        const cells: { time: string; group: ReturnType<typeof getOccupant>; colspan: number }[] = [];
        let i = 0;
        while (i < timeSlots.length) {
            const time = timeSlots[i];
            const group = getOccupant(roomId, time);
            if (group) {
                const [, end] = group.schedule.split(' - ');
                const endMin = timeToMinutes(end);
                let span = 1;
                while (i + span < timeSlots.length && timeToMinutes(timeSlots[i + span]) < endMin) {
                    span++;
                }
                cells.push({ time, group, colspan: span });
                i += span;
            } else {
                cells.push({ time, group: undefined, colspan: 1 });
                i++;
            }
        }
        return cells;
    };

    // Helper: Get groups for a specific room and day of week (Weekly View)
    const getGroupsForRoomAndDay = (roomId: number, isToq: boolean) => {
        return groups.filter(g => {
            if (Number(g.room) !== Number(roomId)) return false;
            const d = g.days?.toUpperCase() || '';
            const isHarKuni = d.includes('HAR') || d.includes('EVERY');
            return isHarKuni || (isToq ? d.includes('TOQ') : d.includes('JUFT'));
        }).sort((a, b) => {
            const timeA = a.schedule?.split(' - ')[0] || '';
            const timeB = b.schedule?.split(' - ')[0] || '';
            return timeToMinutes(timeA) - timeToMinutes(timeB);
        });
    };

    const openEditGroup = (g: Group) => {
        const parts = g.schedule?.split(' - ') || ['', ''];
        setEditSchedule({ start: parts[0] || '', end: parts[1] || '' });
        setEditingGroup(g);
    };

    const handleSaveSchedule = async () => {
        if (!editingGroup) return;
        setIsSaving(true);
        try {
            await updateGroup(editingGroup.id, {
                schedule: `${editSchedule.start} - ${editSchedule.end}`
            });
            setEditingGroup(null);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header + View Toggle */}
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#1b6b6b]/10 flex items-center justify-center text-[#1b6b6b]">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Jadval Xaritasi (Timetable)</h3>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Xonalar bandligi jadvali</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* View Switcher */}
                        <div className="flex bg-gray-50 dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <button
                                onClick={() => setViewMode('day')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-[1rem] text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${
                                    viewMode === 'day' 
                                        ? 'bg-white dark:bg-gray-800 text-[#1b6b6b] shadow-sm ring-1 ring-black/5 dark:ring-white/5' 
                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                }`}
                            >
                                <Clock size={12} /> Kunlik
                            </button>
                            <button
                                onClick={() => setViewMode('week')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-[1rem] text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${
                                    viewMode === 'week' 
                                        ? 'bg-white dark:bg-gray-800 text-[#1b6b6b] shadow-sm ring-1 ring-black/5 dark:ring-white/5' 
                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                }`}
                            >
                                <CalendarRange size={12} /> Haftalik
                            </button>
                        </div>

                        {/* Day filter for Daily View */}
                        {viewMode === 'day' && (
                            <div className="flex bg-gray-50 dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-800">
                                {[
                                    { id: 'TOQ', label: 'Toq kunlar' },
                                    { id: 'JUFT', label: 'Juft kunlar' }
                                ].map((type) => (
                                    <button
                                        key={type.id}
                                        onClick={() => setSelectedDayType(type.id as any)}
                                        className={`px-4 py-2 rounded-[1rem] text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${
                                            selectedDayType === type.id
                                                ? 'bg-white dark:bg-gray-800 text-[#1b6b6b] shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* DAILY TIMELINE VIEW */}
            {viewMode === 'day' && (
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                    <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-900 p-6 min-w-[200px] text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-left border-r border-gray-100 dark:border-gray-700">
                                        Xona nomi
                                    </th>
                                    {timeSlots.map(time => (
                                        <th key={time} className="p-4 min-w-[90px] text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center border-r border-gray-100/50 dark:border-gray-700/30">
                                            {time}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                {rooms.map(room => {
                                    const cells = buildRowCells(room.id);
                                    return (
                                        <tr key={room.id} className="group hover:bg-gray-50/30 dark:hover:bg-slate-700/20 transition-colors">
                                            {/* Room details */}
                                            <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-5 border-r border-gray-100 dark:border-gray-700 group-hover:bg-gray-50 dark:group-hover:bg-gray-900/50 transition-colors">
                                                <button 
                                                    onClick={() => setSelectedRoom(room)}
                                                    className="text-left flex items-center gap-3 w-full hover:opacity-80 transition-opacity"
                                                >
                                                    <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 group-hover:text-[#1b6b6b] transition-colors">
                                                        <MapPin size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{room.name}</p>
                                                        <p className="text-[9px] font-bold text-gray-450 uppercase tracking-widest">{room.capacity} o'rin</p>
                                                    </div>
                                                </button>
                                            </td>

                                            {/* Occupancy cells */}
                                            {cells.map(({ time, group, colspan }) => {
                                                const isActive = group ? isCurrentlyActive(group) : false;
                                                const color = group ? getGroupColor(group.days) : null;
                                                return (
                                                    <td
                                                        key={time}
                                                        colSpan={colspan}
                                                        onClick={() => group && setSelectedRoom(room)}
                                                        className={`p-1 border-r border-gray-100/40 dark:border-gray-700/20 min-h-[70px] align-middle ${group ? 'cursor-pointer' : ''}`}
                                                        style={{ minWidth: `${colspan * 90}px` }}
                                                    >
                                                        {group ? (
                                                            <div className={`h-full min-h-[50px] p-2.5 rounded-xl flex flex-col justify-center border transition-all ${color?.bg} ${color?.border} ${
                                                                isActive ? 'ring-2 ring-rose-500/30 dark:ring-rose-500/20 border-rose-500/40' : ''
                                                            }`}>
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <p className={`text-[9px] font-black uppercase tracking-tight truncate ${color?.text}`}>{group.name}</p>
                                                                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping flex-shrink-0" />}
                                                                </div>
                                                                <span className="text-[8px] font-bold opacity-80 mt-0.5 tabular-nums block">{group.schedule}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="h-full flex items-center justify-center py-4">
                                                                <span className="text-[8px] font-black text-gray-200 dark:text-gray-700/80 uppercase tracking-widest">Bo'sh</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}

                                {rooms.length === 0 && (
                                    <tr>
                                        <td colSpan={timeSlots.length + 1} className="p-20 text-center text-slate-400">
                                            Xonalar mavjud emas
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* WEEKLY MAP VIEW */}
            {viewMode === 'week' && (
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                    <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-900 p-6 min-w-[200px] text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-left border-r border-gray-100 dark:border-gray-700">
                                        Xona nomi
                                    </th>
                                    {FULL_WEEK.map(day => (
                                        <th key={day.id} className="p-4 min-w-[150px] text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center border-r border-gray-100/50 dark:border-gray-700/30">
                                            {day.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                {rooms.map(room => (
                                    <tr key={room.id} className="group hover:bg-gray-50/30 dark:hover:bg-slate-700/20 transition-colors">
                                        {/* Room details */}
                                        <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 p-5 border-r border-gray-100 dark:border-gray-700 group-hover:bg-gray-50 dark:group-hover:bg-gray-900/50 transition-colors">
                                            <button 
                                                onClick={() => setSelectedRoom(room)}
                                                className="text-left flex items-center gap-3 w-full hover:opacity-80 transition-opacity"
                                            >
                                                <div className="w-9 h-9 rounded-xl bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 group-hover:text-[#1b6b6b] transition-colors">
                                                    <MapPin size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{room.name}</p>
                                                    <p className="text-[9px] font-bold text-gray-450 uppercase tracking-widest">{room.capacity} o'rin</p>
                                                </div>
                                            </button>
                                        </td>

                                        {/* Days schedule */}
                                        {FULL_WEEK.map(day => {
                                            const dayGroups = getGroupsForRoomAndDay(room.id, day.isToq);
                                            return (
                                                <td
                                                    key={day.id}
                                                    className="p-2 border-r border-gray-100/40 dark:border-gray-700/20 min-h-[90px] align-top text-center"
                                                >
                                                    {dayGroups.length > 0 ? (
                                                        <div className="space-y-1.5 text-left">
                                                            {dayGroups.map(g => {
                                                                const color = getGroupColor(g.days);
                                                                const isActive = isCurrentlyActive(g);
                                                                return (
                                                                    <div 
                                                                        key={g.id} 
                                                                        onClick={() => setSelectedRoom(room)}
                                                                        className={`p-2 rounded-lg border transition-all cursor-pointer text-[9px] font-black uppercase tracking-tight ${color.bg} ${color.border} ${color.text} ${
                                                                            isActive ? 'ring-2 ring-rose-500/35 border-rose-500/40' : ''
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center justify-between gap-1">
                                                                            <span className="truncate">{g.name}</span>
                                                                            {isActive && <span className="h-1.5 w-1.5 rounded-full bg-rose-550 animate-ping flex-shrink-0" />}
                                                                        </div>
                                                                        <span className="text-[7.5px] font-extrabold opacity-75 block mt-0.5">{g.schedule}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="py-6 flex items-center justify-center">
                                                            <span className="text-[8px] font-black text-gray-250 dark:text-gray-700/80 uppercase tracking-widest italic">Bo'sh</span>
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}

                                {rooms.length === 0 && (
                                    <tr>
                                        <td colSpan={FULL_WEEK.length + 1} className="p-20 text-center text-slate-400">
                                            Xonalar mavjud emas
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Info Banner */}
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex gap-3 text-slate-500 dark:text-slate-400">
                <Info size={16} className="text-[#1b6b6b] flex-shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed">
                    <strong>Jadval Xaritasi Ko'rsatmasi:</strong> Kunlik yoki Haftalik xaritada xonalarning band bo'lgan vaqtlarini to'liq va aniq ko'rish mumkin. Xona nomiga yoki dars jadvali katagiga bosish orqali guruhlar tarkibi va dars soatlarini interaktiv tahrirlashingiz mumkin.
                </p>
            </div>

            {/* Room Detail Modal */}
            {selectedRoom && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" onClick={() => { setSelectedRoom(null); setEditingGroup(null); }} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-150 dark:border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 text-gray-950 dark:text-white">
                        
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#1b6b6b]/10 flex items-center justify-center text-[#1b6b6b]">
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{selectedRoom.name}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedRoom.capacity} kishilik • {getGroupsForRoomAndDay(selectedRoom.id, true).length + getGroupsForRoomAndDay(selectedRoom.id, false).length} ta guruh</p>
                                </div>
                            </div>
                            <button onClick={() => { setSelectedRoom(null); setEditingGroup(null); }}
                                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750 rounded-xl cursor-pointer transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Group List inside Modal */}
                        <div className="overflow-y-auto flex-1 p-6 space-y-3 custom-scrollbar">
                            {groups.filter(g => Number(g.room) === Number(selectedRoom.id)).length === 0 ? (
                                <div className="py-16 flex flex-col items-center text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center mb-3 text-gray-400">
                                        <Users size={20} />
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Xonada guruhlar yo'q</p>
                                </div>
                            ) : groups.filter(g => Number(g.room) === Number(selectedRoom.id)).map(g => {
                                const color = getGroupColor(g.days);
                                const teacher = teachers.find(t => t.id === g.teacherId);
                                const course = courses.find(c => c.id === g.courseId);
                                const isEditing = editingGroup?.id === g.id;
                                const isCurrentlyOn = isCurrentlyActive(g);

                                return (
                                    <div key={g.id} className={`rounded-2xl border transition-all overflow-hidden bg-gray-50/50 dark:bg-gray-900/30 ${color.border} ${isCurrentlyOn ? 'ring-1 ring-rose-500/40 border-rose-500/40' : ''}`}>
                                        
                                        {/* Group header */}
                                        <div className="flex items-start justify-between p-4">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isCurrentlyOn ? 'bg-rose-500 animate-ping' : color.dot}`} />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-xs font-black uppercase tracking-tight ${color.text}`}>{g.name}</p>
                                                        {isCurrentlyOn && (
                                                            <span className="px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-550 rounded text-[7px] font-black uppercase tracking-widest animate-pulse">
                                                                Hozir Darsda
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-0.5">
                                                        {(course?.name && course.name !== 'birinchi') ? `${course.name} • ` : ''}{teacher?.name || '—'}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                                                            <Users size={9} /> {g.studentIds?.length || 0} o'quvchi
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                                                            <Calendar size={9} /> {g.days}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 ${color.text}`}>
                                                    <Clock size={10} />
                                                    <span className="text-[10px] font-black tabular-nums">{g.schedule}</span>
                                                </div>
                                                <button
                                                    onClick={() => isEditing ? setEditingGroup(null) : openEditGroup(g)}
                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                                        isEditing
                                                            ? 'bg-gray-250 dark:bg-gray-700 text-gray-800 dark:text-white border border-gray-300 dark:border-slate-600'
                                                            : 'bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-550 hover:text-[#1b6b6b] border border-gray-200 dark:border-gray-800'
                                                    }`}
                                                    title="Vaqtni o'zgartirish"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Inline time editor */}
                                        {isEditing && (
                                            <div className="px-4 pb-4 border-t border-gray-150 dark:border-gray-800 pt-3">
                                                <p className="text-[9px] font-black text-gray-450 uppercase tracking-widest mb-2">Dars vaqtini o'zgartirish</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1">
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Boshlanish</label>
                                                        <input
                                                            type="time"
                                                            value={editSchedule.start}
                                                            onChange={e => setEditSchedule(p => ({ ...p, start: e.target.value }))}
                                                            className={inp}
                                                        />
                                                    </div>
                                                    <div className="flex-shrink-0 pt-5 text-gray-400 font-black">→</div>
                                                    <div className="flex-1">
                                                        <label className="text-[9px] font-black text-gray-405 uppercase tracking-widest block mb-1">Tugash</label>
                                                        <input
                                                            type="time"
                                                            value={editSchedule.end}
                                                            onChange={e => setEditSchedule(p => ({ ...p, end: e.target.value }))}
                                                            className={inp}
                                                        />
                                                    </div>
                                                    <div className="flex-shrink-0 pt-5">
                                                        <button
                                                            onClick={handleSaveSchedule}
                                                            disabled={isSaving}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-[#1b6b6b] hover:bg-[#155252] disabled:opacity-50 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg transition-all cursor-pointer"
                                                        >
                                                            <Save size={12} />
                                                            {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-150 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                Guruh vaqtini o'zgartirish uchun ✏️ belgisini bosing
                            </p>
                            <button onClick={() => { setSelectedRoom(null); setEditingGroup(null); }}
                                className="px-5 py-2 bg-gray-105 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-705 text-gray-700 dark:text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer">
                                Yopish
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
