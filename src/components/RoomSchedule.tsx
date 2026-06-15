import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { Clock, MapPin, Calendar, X, Users, Edit2, Save, ChevronLeft, ChevronRight, Sun, Sunset, Filter } from 'lucide-react';
import { Group } from '../types';

const WEEK_DAYS = [
    { id: 'ALL', label: 'Barchasi', short: 'Barch' },
    { id: 'TOQ', label: 'Toq kunlar', short: 'Toq' },
    { id: 'JUFT', label: 'Juft kunlar', short: 'Juft' },
    { id: 'HAR', label: 'Har kuni', short: 'Har' },
];

type TimeFilter = 'ALL' | 'BEFORE_NOON' | 'AFTER_NOON';

const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

const getGroupColor = (days: string) => {
    const d = days?.toUpperCase() || '';
    if (d.includes('HAR') || d.includes('EVERY')) return { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-400' };
    if (d.includes('TOQ')) return { bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800', dot: 'bg-sky-400' };
    return { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800', dot: 'bg-violet-400' };
};

const inp = "w-full px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-2 focus:ring-[#1b6b6b]/10 outline-none transition-all";

export default function RoomSchedule() {
    const { groups, rooms, teachers, courses, updateGroup } = useCRM();

    const [dayFilter, setDayFilter] = useState<'ALL' | 'TOQ' | 'JUFT' | 'HAR'>('ALL');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
    const [selectedRoom, setSelectedRoom] = useState<typeof rooms[0] | null>(null);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [editSchedule, setEditSchedule] = useState({ start: '', end: '' });
    const [isSaving, setIsSaving] = useState(false);

    // Filter groups by day type
    const filterGroup = (g: Group) => {
        const d = g.days?.toUpperCase() || '';
        const isHarKuni = d.includes('HAR') || d.includes('EVERY');

        if (dayFilter === 'HAR') return isHarKuni;
        if (dayFilter === 'TOQ') return d.includes('TOQ') || isHarKuni;
        if (dayFilter === 'JUFT') return d.includes('JUFT') || isHarKuni;
        return true;
    };

    // Filter by time
    const filterByTime = (g: Group) => {
        if (timeFilter === 'ALL') return true;
        const parts = g.schedule?.split(' - ') || [];
        if (!parts[0]) return true;
        const startMin = timeToMinutes(parts[0]);
        if (timeFilter === 'BEFORE_NOON') return startMin < 13 * 60;
        if (timeFilter === 'AFTER_NOON') return startMin >= 13 * 60;
        return true;
    };

    const getGroupsForRoom = (roomId: number) =>
        groups.filter(g => Number(g.room) === Number(roomId) && filterGroup(g) && filterByTime(g));

    const getRoomUtilization = (roomId: number) => {
        const total = groups.filter(g => Number(g.room) === Number(roomId)).length;
        return total;
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

    const roomGroupsInModal = selectedRoom ? getGroupsForRoom(selectedRoom.id) : [];

    // Stats
    const totalGroups = groups.filter(filterGroup).filter(filterByTime).length;
    const occupiedRooms = rooms.filter(r => getGroupsForRoom(r.id).length > 0).length;

    return (
        <div className="space-y-5">
            {/* Header + Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Xonalar Boshqaruvi</h3>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Interaktiv jadval • Xonaga bosing</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                            {occupiedRooms} band
                        </span>
                        <span className="px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-500 border border-gray-100 dark:border-gray-700">
                            {totalGroups} guruh
                        </span>
                    </div>
                </div>

                {/* Day Filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5"><Filter size={10} />Kun filtri</p>
                        <div className="flex bg-gray-50 dark:bg-gray-900 p-1 rounded-2xl border border-gray-100 dark:border-gray-800 w-fit gap-0.5">
                            {WEEK_DAYS.map(d => (
                                <button
                                    key={d.id}
                                    onClick={() => setDayFilter(d.id as any)}
                                    className={`px-4 py-2 rounded-[1rem] text-[10px] font-extrabold uppercase tracking-widest transition-all ${
                                        dayFilter === d.id
                                            ? 'bg-white dark:bg-gray-800 text-[#1b6b6b] shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                    }`}
                                >{d.short}</button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5"><Clock size={10} />Vaqt filtri</p>
                        <div className="flex bg-gray-50 dark:bg-gray-900 p-1 rounded-2xl border border-gray-100 dark:border-gray-800 w-fit gap-0.5">
                            {[
                                { id: 'ALL', label: 'Barchasi', icon: <Calendar size={10} /> },
                                { id: 'BEFORE_NOON', label: 'Tushgacha', icon: <Sun size={10} /> },
                                { id: 'AFTER_NOON', label: 'Tushdan keyin', icon: <Sunset size={10} /> },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTimeFilter(t.id as TimeFilter)}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-[1rem] text-[10px] font-extrabold uppercase tracking-widest transition-all ${
                                        timeFilter === t.id
                                            ? 'bg-white dark:bg-gray-800 text-[#1b6b6b] shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                    }`}
                                >{t.icon}{t.label}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Room Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {rooms.map(room => {
                    const roomGroups = getGroupsForRoom(room.id);
                    const totalRoomGroups = getRoomUtilization(room.id);
                    const isBusy = roomGroups.length > 0;

                    return (
                        <button
                            key={room.id}
                            onClick={() => setSelectedRoom(room)}
                            className={`text-left bg-white dark:bg-gray-800 rounded-[1.75rem] border transition-all shadow-sm hover:shadow-xl hover:-translate-y-0.5 group cursor-pointer overflow-hidden ${
                                isBusy
                                    ? 'border-[#1b6b6b]/30 dark:border-[#1b6b6b]/40 hover:border-[#1b6b6b]/60'
                                    : 'border-gray-100 dark:border-gray-700 hover:border-gray-200'
                            }`}
                        >
                            {/* Card top */}
                            <div className={`p-5 ${isBusy ? 'bg-gradient-to-br from-[#1b6b6b]/5 to-transparent' : ''}`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isBusy ? 'bg-[#1b6b6b]/10 text-[#1b6b6b]' : 'bg-gray-50 dark:bg-gray-900 text-gray-400'} transition-colors`}>
                                        <MapPin size={20} />
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                                            isBusy
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800'
                                                : 'bg-gray-50 dark:bg-gray-900 text-gray-400 border-gray-100 dark:border-gray-700'
                                        }`}>
                                            {isBusy ? `${roomGroups.length} guruh` : "Bo'sh"}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{room.name}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{room.capacity} kishilik</p>
                            </div>

                            {/* Group pills */}
                            <div className="px-5 pb-5 space-y-2">
                                {roomGroups.slice(0, 3).map(g => {
                                    const color = getGroupColor(g.days);
                                    return (
                                        <div key={g.id} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${color.bg} ${color.border}`}>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.dot}`} />
                                                <span className={`text-[10px] font-black uppercase tracking-tight truncate ${color.text}`}>{g.name}</span>
                                            </div>
                                            <span className={`text-[9px] font-bold tabular-nums ml-2 flex-shrink-0 ${color.text} opacity-80`}>{g.schedule}</span>
                                        </div>
                                    );
                                })}
                                {roomGroups.length > 3 && (
                                    <p className="text-[9px] font-black text-center text-gray-400 uppercase tracking-widest pt-1">
                                        +{roomGroups.length - 3} ta guruh yana
                                    </p>
                                )}
                                {roomGroups.length === 0 && (
                                    <p className="text-[9px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest text-center py-3">
                                        Filtr bo'yicha guruh yo'q
                                    </p>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-5 pb-4 pt-0">
                                <div className="flex items-center justify-between pt-3 border-t border-dashed border-gray-100 dark:border-gray-700">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Jami: {totalRoomGroups} guruh</span>
                                    <span className="text-[9px] font-black text-[#1b6b6b] uppercase tracking-widest group-hover:underline">Ko'rish →</span>
                                </div>
                            </div>
                        </button>
                    );
                })}

                {rooms.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center mb-3 text-gray-400">
                            <MapPin size={24} />
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Xonalar mavjud emas</p>
                        <p className="text-[9px] text-gray-300 dark:text-gray-600 font-bold uppercase tracking-widest mt-1">Sozlamalarda xona qo'shing</p>
                    </div>
                )}
            </div>

            {/* Room Detail Modal */}
            {selectedRoom && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => { setSelectedRoom(null); setEditingGroup(null); }} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#1b6b6b]/10 flex items-center justify-center text-[#1b6b6b]">
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{selectedRoom.name}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedRoom.capacity} kishilik • {roomGroupsInModal.length} ta guruh</p>
                                </div>
                            </div>
                            <button onClick={() => { setSelectedRoom(null); setEditingGroup(null); }}
                                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl cursor-pointer transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Filters */}
                        <div className="px-6 pt-4 flex flex-wrap gap-3 flex-shrink-0">
                            <div className="flex bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-800 gap-0.5">
                                {WEEK_DAYS.map(d => (
                                    <button key={d.id} onClick={() => setDayFilter(d.id as any)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-all ${
                                            dayFilter === d.id ? 'bg-white dark:bg-gray-800 text-[#1b6b6b] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                        }`}>{d.short}</button>
                                ))}
                            </div>
                            <div className="flex bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-800 gap-0.5">
                                {[
                                    { id: 'ALL', label: 'Barchasi' },
                                    { id: 'BEFORE_NOON', label: '08:00–13:00' },
                                    { id: 'AFTER_NOON', label: '13:00–22:00' },
                                ].map(t => (
                                    <button key={t.id} onClick={() => setTimeFilter(t.id as TimeFilter)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-all ${
                                            timeFilter === t.id ? 'bg-white dark:bg-gray-800 text-[#1b6b6b] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                        }`}>{t.label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Group List */}
                        <div className="overflow-y-auto flex-1 p-6 space-y-3 custom-scrollbar">
                            {roomGroupsInModal.length === 0 ? (
                                <div className="py-16 flex flex-col items-center text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-center mb-3 text-gray-400">
                                        <Users size={20} />
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bu filtrlarda guruh yo'q</p>
                                </div>
                            ) : roomGroupsInModal.map(g => {
                                const color = getGroupColor(g.days);
                                const teacher = teachers.find(t => t.id === g.teacherId);
                                const course = courses.find(c => c.id === g.courseId);
                                const isEditing = editingGroup?.id === g.id;

                                return (
                                    <div key={g.id} className={`rounded-2xl border transition-all overflow-hidden ${color.bg} ${color.border}`}>
                                        {/* Group header */}
                                        <div className="flex items-start justify-between p-4">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${color.dot}`} />
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-black uppercase tracking-tight ${color.text}`}>{g.name}</p>
                                                    <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-0.5">
                                                        {course?.name || '—'} • {teacher?.name || '—'}
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
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/60 dark:bg-black/20 border border-white/40 ${color.text}`}>
                                                    <Clock size={10} />
                                                    <span className="text-[10px] font-black tabular-nums">{g.schedule}</span>
                                                </div>
                                                <button
                                                    onClick={() => isEditing ? setEditingGroup(null) : openEditGroup(g)}
                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                                        isEditing
                                                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                                            : 'bg-white/60 dark:bg-black/20 text-gray-500 hover:text-[#1b6b6b]'
                                                    }`}
                                                    title="Vaqtni o'zgartirish"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Inline time editor */}
                                        {isEditing && (
                                            <div className="px-4 pb-4 border-t border-white/40 dark:border-black/20 pt-3">
                                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Dars vaqtini o'zgartirish</p>
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
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Tugash</label>
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
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-[#1b6b6b] hover:bg-[#155252] disabled:opacity-50 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow transition-all cursor-pointer"
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
                        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                Guruh vaqtini o'zgartirish uchun ✏️ belgisini bosing
                            </p>
                            <button onClick={() => { setSelectedRoom(null); setEditingGroup(null); }}
                                className="px-5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer">
                                Yopish
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
