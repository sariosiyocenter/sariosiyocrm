import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { Clock, MapPin, Calendar, X, Users, Edit2, Save, Sun, Sunset, Filter, LayoutGrid, Map, Info, Compass } from 'lucide-react';
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
    if (d.includes('HAR') || d.includes('EVERY')) return { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-500', border: 'border-amber-500/30', dot: 'bg-amber-400' };
    if (d.includes('TOQ')) return { bg: 'bg-cyan-500/10 dark:bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', dot: 'bg-cyan-455' };
    return { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' };
};

const inp = "w-full px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-xl text-xs font-bold text-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all";

export default function RoomSchedule() {
    const { groups, rooms, teachers, courses, updateGroup } = useCRM();

    const [viewMode, setViewMode] = useState<'map' | 'grid'>('map');
    const [dayFilter, setDayFilter] = useState<'ALL' | 'TOQ' | 'JUFT' | 'HAR'>('ALL');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
    const [selectedRoom, setSelectedRoom] = useState<typeof rooms[0] | null>(null);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [editSchedule, setEditSchedule] = useState({ start: '', end: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Live update for checking current classes
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    // Helper: Is group active *right now*?
    const isGroupActiveNow = (g: Group) => {
        const day = currentTime.getDay(); // 0=Sun, 1=Mon, 2=Tue...
        const d = g.days?.toUpperCase() || '';
        
        let dayMatches = false;
        if (d.includes('HAR') || d.includes('EVERY')) {
            dayMatches = day !== 0; // Mon-Sat
        } else if (d.includes('TOQ')) {
            dayMatches = [1, 3, 5].includes(day); // Mon, Wed, Fri
        } else if (d.includes('JUFT')) {
            dayMatches = [2, 4, 6].includes(day); // Tue, Thu, Sat
        }

        if (!dayMatches) return false;

        const parts = g.schedule?.split(' - ') || [];
        if (parts.length < 2) return false;

        const currentMin = currentTime.getHours() * 60 + currentTime.getMinutes();
        const startMin = timeToMinutes(parts[0]);
        const endMin = timeToMinutes(parts[1]);

        return currentMin >= startMin && currentMin <= endMin;
    };

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
        return groups.filter(g => Number(g.room) === Number(roomId)).length;
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

    // Split rooms dynamically for North/South wing of floor map
    const northRooms = rooms.filter((_, idx) => idx % 2 === 0);
    const southRooms = rooms.filter((_, idx) => idx % 2 !== 0);
    const mapColCount = Math.max(1, Math.max(northRooms.length, southRooms.length));

    return (
        <div className="space-y-6">
            {/* Header + Control Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] shadow-xl p-6 text-white">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                            <Compass className="animate-spin-slow" size={24} />
                        </div>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-tight text-white">Xonalar Xaritasi & Boshqaruvi</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Interaktiv bino chizmasi • Guruhlar va darslar nazorati</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Status Pills */}
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800">
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {occupiedRooms} band xona
                            </span>
                            <span className="px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                {totalGroups} guruh
                            </span>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
                            <button
                                onClick={() => setViewMode('map')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-[1rem] text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${
                                    viewMode === 'map' ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Map size={12} /> Xarita
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-[1rem] text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${
                                    viewMode === 'grid' ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <LayoutGrid size={12} /> Ro'yxat
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Filter size={10} /> Kun filtri</p>
                        <div className="flex flex-wrap bg-slate-950 p-1 rounded-2xl border border-slate-800 w-fit gap-0.5">
                            {WEEK_DAYS.map(d => (
                                <button
                                    key={d.id}
                                    onClick={() => setDayFilter(d.id as any)}
                                    className={`px-4 py-2 rounded-[1rem] text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${
                                        dayFilter === d.id
                                            ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >{d.short}</button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Clock size={10} /> Vaqt filtri</p>
                        <div className="flex flex-wrap bg-slate-950 p-1 rounded-2xl border border-slate-800 w-fit gap-0.5">
                            {[
                                { id: 'ALL', label: 'Barchasi', icon: <Calendar size={10} /> },
                                { id: 'BEFORE_NOON', label: 'Tushgacha', icon: <Sun size={10} /> },
                                { id: 'AFTER_NOON', label: 'Tushdan keyin', icon: <Sunset size={10} /> },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTimeFilter(t.id as TimeFilter)}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-[1rem] text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${
                                        timeFilter === t.id
                                            ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >{t.icon}{t.label}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* MAP VIEW (Blueprint Style) */}
            {viewMode === 'map' && (
                <div className="relative bg-[#0b1329] rounded-[2.5rem] border border-slate-800 shadow-2xl p-6 sm:p-8 overflow-hidden text-white">
                    {/* Blueprint grid background lines */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                         style={{ 
                             backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
                             backgroundSize: '20px 20px' 
                         }} 
                    />

                    {/* Architectural Map Header Details */}
                    <div className="relative flex justify-between items-center text-[8px] font-mono tracking-widest text-slate-500 uppercase border-b border-slate-800/80 pb-4 mb-8">
                        <div>Blueprint Ref: SARIOSIYO-EDU-FLOOR1</div>
                        <div className="hidden sm:block">Scale: 1:50 | North Oriented 🧭</div>
                        <div>Date: 2026-06-15</div>
                    </div>

                    <div className="space-y-4 relative">
                        {/* NORTH WING (Top row of rooms) */}
                        <div 
                            className="grid gap-4"
                            style={{ gridTemplateColumns: `repeat(${mapColCount}, minmax(0, 1fr))` }}
                        >
                            {northRooms.map(room => {
                                const roomGroups = getGroupsForRoom(room.id);
                                const isBusy = roomGroups.length > 0;
                                const hasLiveClass = roomGroups.some(isGroupActiveNow);

                                return (
                                    <button
                                        key={room.id}
                                        onClick={() => setSelectedRoom(room)}
                                        className={`group relative text-left bg-slate-900/60 backdrop-blur-sm p-5 rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-cyan-500/10 hover:shadow-xl cursor-pointer ${
                                            hasLiveClass 
                                                ? 'border-rose-500/65 shadow-rose-500/5 bg-gradient-to-b from-rose-500/5 to-transparent' 
                                                : isBusy 
                                                    ? 'border-cyan-500/35 bg-gradient-to-b from-cyan-500/5 to-transparent' 
                                                    : 'border-slate-800 hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <span className="text-[8px] font-mono text-slate-500 tracking-wider">ROOM #{room.id}</span>
                                            <div className="flex items-center gap-1.5">
                                                {hasLiveClass && (
                                                    <span className="flex h-2 w-2 relative">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                                    </span>
                                                )}
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                                                    hasLiveClass 
                                                        ? 'bg-rose-500/10 text-rose-455 border-rose-500/30'
                                                        : isBusy 
                                                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                                                            : 'bg-slate-950/60 text-slate-500 border-slate-800'
                                                }`}>
                                                    {hasLiveClass ? 'Darsda' : isBusy ? 'Band' : 'Bo\'sh'}
                                                </span>
                                            </div>
                                        </div>

                                        <h4 className="text-sm font-black uppercase tracking-tight text-white">{room.name}</h4>
                                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{room.capacity} seats / {room.capacity * 1.5} m²</span>

                                        {/* Stylized blueprint chairs representation */}
                                        <div className="grid grid-cols-5 gap-1.5 my-4 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/40">
                                            {Array.from({ length: Math.min(10, room.capacity) }).map((_, i) => (
                                                <div 
                                                    key={i} 
                                                    className={`h-2 rounded-sm transition-all ${
                                                        hasLiveClass 
                                                            ? 'bg-rose-500/70 border border-rose-400/50 animate-pulse'
                                                            : (isBusy && i < roomGroups.length * 3)
                                                                ? 'bg-cyan-400/55' 
                                                                : 'bg-slate-800'
                                                    }`} 
                                                />
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 pt-2 border-t border-slate-800/60">
                                            <span>Guruhlar: {roomGroups.length}</span>
                                            <span className="text-cyan-400 group-hover:translate-x-1 transition-transform">Kirish →</span>
                                        </div>

                                        {/* Door swinging arc at bottom */}
                                        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-6 h-6 overflow-hidden pointer-events-none">
                                            <div className="w-12 h-12 border border-slate-800 rounded-full absolute -bottom-6 -left-3" />
                                            <div className="w-0.5 h-6 bg-slate-700/60 absolute bottom-0 left-1/2" />
                                        </div>
                                    </button>
                                );
                            })}
                            {/* Empty space filler to keep grid aligned */}
                            {northRooms.length < mapColCount && 
                                Array.from({ length: mapColCount - northRooms.length }).map((_, i) => <div key={i} />)
                            }
                        </div>

                        {/* CENTRAL CORRIDOR & RECEPTION */}
                        <div className="grid grid-cols-12 gap-4 bg-slate-900/35 border-y border-dashed border-slate-800 my-6 py-5 px-6 rounded-3xl relative">
                            {/* Left: Kutish Zali (Lounge) */}
                            <div className="col-span-3 bg-[#0f172a] rounded-2xl p-4 border border-slate-800 flex flex-col justify-between min-h-[90px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-mono text-slate-500">LOUNGE</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                </div>
                                <div>
                                    <h5 className="text-[10px] font-black uppercase tracking-wider text-cyan-400">Kutish Zali</h5>
                                    <span className="text-[8px] font-mono text-slate-500">Sofa / Coffee Bar</span>
                                </div>
                            </div>

                            {/* Middle: Corridor pathway */}
                            <div className="col-span-6 flex flex-col items-center justify-center border-x border-dashed border-slate-800/80">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 block">Dahliz • Main Corridor</span>
                                <div className="flex gap-4 mt-2">
                                    <span className="text-[8px] font-mono text-slate-700">← EXIT</span>
                                    <span className="text-[8px] font-mono text-slate-700">CLASSROOMS →</span>
                                </div>
                            </div>

                            {/* Right: Reception */}
                            <div className="col-span-3 bg-[#0f172a] rounded-2xl p-4 border border-slate-800 flex flex-col justify-between min-h-[90px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-mono text-slate-500">RECEPTION</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                </div>
                                <div>
                                    <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-450">Qabulxona</h5>
                                    <span className="text-[8px] font-mono text-slate-500">Info / Desk</span>
                                </div>
                            </div>
                        </div>

                        {/* SOUTH WING (Bottom row of rooms) */}
                        <div 
                            className="grid gap-4"
                            style={{ gridTemplateColumns: `repeat(${mapColCount}, minmax(0, 1fr))` }}
                        >
                            {southRooms.map(room => {
                                const roomGroups = getGroupsForRoom(room.id);
                                const isBusy = roomGroups.length > 0;
                                const hasLiveClass = roomGroups.some(isGroupActiveNow);

                                return (
                                    <button
                                        key={room.id}
                                        onClick={() => setSelectedRoom(room)}
                                        className={`group relative text-left bg-slate-900/60 backdrop-blur-sm p-5 rounded-3xl border transition-all hover:translate-y-1 hover:shadow-cyan-500/10 hover:shadow-xl cursor-pointer ${
                                            hasLiveClass 
                                                ? 'border-rose-500/65 shadow-rose-500/5 bg-gradient-to-t from-rose-500/5 to-transparent' 
                                                : isBusy 
                                                    ? 'border-cyan-500/35 bg-gradient-to-t from-cyan-500/5 to-transparent' 
                                                    : 'border-slate-800 hover:border-slate-700'
                                        }`}
                                    >
                                        {/* Door swinging arc at top */}
                                        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-6 h-6 overflow-hidden pointer-events-none">
                                            <div className="w-12 h-12 border border-slate-800 rounded-full absolute -top-6 -left-3" />
                                            <div className="w-0.5 h-6 bg-slate-700/60 absolute top-0 left-1/2" />
                                        </div>

                                        <div className="flex items-start justify-between mb-4 pt-4">
                                            <span className="text-[8px] font-mono text-slate-500 tracking-wider">ROOM #{room.id}</span>
                                            <div className="flex items-center gap-1.5">
                                                {hasLiveClass && (
                                                    <span className="flex h-2 w-2 relative">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                                    </span>
                                                )}
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                                                    hasLiveClass 
                                                        ? 'bg-rose-500/10 text-rose-455 border-rose-500/30'
                                                        : isBusy 
                                                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                                                            : 'bg-slate-950/60 text-slate-500 border-slate-800'
                                                }`}>
                                                    {hasLiveClass ? 'Darsda' : isBusy ? 'Band' : 'Bo\'sh'}
                                                </span>
                                            </div>
                                        </div>

                                        <h4 className="text-sm font-black uppercase tracking-tight text-white">{room.name}</h4>
                                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{room.capacity} seats / {room.capacity * 1.5} m²</span>

                                        {/* Stylized blueprint chairs representation */}
                                        <div className="grid grid-cols-5 gap-1.5 my-4 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/40">
                                            {Array.from({ length: Math.min(10, room.capacity) }).map((_, i) => (
                                                <div 
                                                    key={i} 
                                                    className={`h-2 rounded-sm transition-all ${
                                                        hasLiveClass 
                                                            ? 'bg-rose-500/70 border border-rose-400/50 animate-pulse'
                                                            : (isBusy && i < roomGroups.length * 3)
                                                                ? 'bg-cyan-400/55' 
                                                                : 'bg-slate-800'
                                                    }`} 
                                                />
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 pt-2 border-t border-slate-800/60">
                                            <span>Guruhlar: {roomGroups.length}</span>
                                            <span className="text-cyan-400 group-hover:translate-x-1 transition-transform">Kirish →</span>
                                        </div>
                                    </button>
                                );
                            })}
                            {/* Empty space filler to keep grid aligned */}
                            {southRooms.length < mapColCount && 
                                Array.from({ length: mapColCount - southRooms.length }).map((_, i) => <div key={i} />)
                            }
                        </div>
                    </div>

                    {/* Bottom Info Banner */}
                    <div className="flex items-start gap-3 mt-8 p-4 rounded-2xl bg-cyan-950/25 border border-cyan-800/30 text-cyan-400/90">
                        <Info size={16} className="mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] leading-relaxed">
                            <strong>Interaktiv Xarita Xizmati:</strong> Qizil rangda miltillab turgan xonalarda hozir ayni daqiqada dars ketmoqda. Xonalarga bosish orqali darslar jadvalini ko'rishingiz, o'zgartirishingiz va xonadagi dars soatlarini boshqarishingiz mumkin.
                        </p>
                    </div>
                </div>
            )}

            {/* GRID VIEW (Traditional Grid) */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {rooms.map(room => {
                        const roomGroups = getGroupsForRoom(room.id);
                        const totalRoomGroups = getRoomUtilization(room.id);
                        const isBusy = roomGroups.length > 0;
                        const hasLiveClass = roomGroups.some(isGroupActiveNow);

                        return (
                            <button
                                key={room.id}
                                onClick={() => setSelectedRoom(room)}
                                className={`text-left bg-slate-900 border transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 group cursor-pointer overflow-hidden rounded-[1.75rem] ${
                                    hasLiveClass
                                        ? 'border-rose-500/50 shadow-rose-500/5 bg-gradient-to-br from-rose-500/5 to-transparent'
                                        : isBusy
                                            ? 'border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-transparent'
                                            : 'border-slate-800 hover:border-slate-700'
                                }`}
                            >
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                                            hasLiveClass 
                                                ? 'bg-rose-500/10 text-rose-455' 
                                                : isBusy 
                                                    ? 'bg-cyan-500/10 text-cyan-400' 
                                                    : 'bg-slate-950 text-slate-500'
                                        }`}>
                                            <MapPin size={20} />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {hasLiveClass && <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />}
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                                                hasLiveClass 
                                                    ? 'bg-rose-500/10 text-rose-455 border-rose-500/20'
                                                    : isBusy
                                                        ? 'bg-cyan-500/10 text-cyan-455 border-cyan-500/20'
                                                        : 'bg-slate-950 text-slate-500 border-slate-800'
                                            }`}>
                                                {hasLiveClass ? 'Hozir darsda' : isBusy ? `${roomGroups.length} guruh` : "Bo'sh"}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm font-black text-white uppercase tracking-tight">{room.name}</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{room.capacity} kishilik</p>
                                </div>

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
                                        <p className="text-[9px] font-black text-center text-slate-500 uppercase tracking-widest pt-1">
                                            +{roomGroups.length - 3} ta guruh yana
                                        </p>
                                    )}
                                    {roomGroups.length === 0 && (
                                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest text-center py-3">
                                            Filtr bo'yicha guruh yo'q
                                        </p>
                                    )}
                                </div>

                                <div className="px-5 pb-4 pt-0">
                                    <div className="flex items-center justify-between pt-3 border-t border-dashed border-slate-800">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Jami: {totalRoomGroups} guruh</span>
                                        <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest group-hover:underline">Ko'rish →</span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Room Detail Modal */}
            {selectedRoom && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => { setSelectedRoom(null); setEditingGroup(null); }} />
                    <div className="relative bg-slate-900 rounded-[2rem] border border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 text-white">
                        
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-800 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-tight">{selectedRoom.name}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedRoom.capacity} kishilik • {roomGroupsInModal.length} ta guruh</p>
                                </div>
                            </div>
                            <button onClick={() => { setSelectedRoom(null); setEditingGroup(null); }}
                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Filters */}
                        <div className="px-6 pt-4 flex flex-wrap gap-3 flex-shrink-0">
                            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-0.5">
                                {WEEK_DAYS.map(d => (
                                    <button key={d.id} onClick={() => setDayFilter(d.id as any)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-all ${
                                            dayFilter === d.id ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
                                        }`}>{d.short}</button>
                                ))}
                            </div>
                            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-0.5">
                                {[
                                    { id: 'ALL', label: 'Barchasi' },
                                    { id: 'BEFORE_NOON', label: '08:00–13:00' },
                                    { id: 'AFTER_NOON', label: '13:00–22:00' },
                                ].map(t => (
                                    <button key={t.id} onClick={() => setTimeFilter(t.id as TimeFilter)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-all ${
                                            timeFilter === t.id ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
                                        }`}>{t.label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Group List */}
                        <div className="overflow-y-auto flex-1 p-6 space-y-3 custom-scrollbar">
                            {roomGroupsInModal.length === 0 ? (
                                <div className="py-16 flex flex-col items-center text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mb-3 text-slate-500">
                                        <Users size={20} />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bu filtrlarda guruh yo'q</p>
                                </div>
                            ) : roomGroupsInModal.map(g => {
                                const color = getGroupColor(g.days);
                                const teacher = teachers.find(t => t.id === g.teacherId);
                                const course = courses.find(c => c.id === g.courseId);
                                const isEditing = editingGroup?.id === g.id;
                                const isCurrentlyOn = isGroupActiveNow(g);

                                return (
                                    <div key={g.id} className={`rounded-2xl border transition-all overflow-hidden bg-slate-950/40 ${color.border} ${isCurrentlyOn ? 'ring-1 ring-rose-500/40 border-rose-500/40' : ''}`}>
                                        
                                        {/* Group header */}
                                        <div className="flex items-start justify-between p-4">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isCurrentlyOn ? 'bg-rose-550 animate-ping' : color.dot}`} />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-xs font-black uppercase tracking-tight ${color.text}`}>{g.name}</p>
                                                        {isCurrentlyOn && (
                                                            <span className="px-1.5 py-0.5 bg-rose-550/10 border border-rose-500/30 text-rose-500 rounded text-[7px] font-black uppercase tracking-widest animate-pulse">
                                                                Hozir Darsda
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                        {course?.name || '—'} • {teacher?.name || '—'}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                                            <Users size={9} /> {g.studentIds?.length || 0} o'quvchi
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                                            <Calendar size={9} /> {g.days}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 ${color.text}`}>
                                                    <Clock size={10} />
                                                    <span className="text-[10px] font-black tabular-nums">{g.schedule}</span>
                                                </div>
                                                <button
                                                    onClick={() => isEditing ? setEditingGroup(null) : openEditGroup(g)}
                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                                        isEditing
                                                            ? 'bg-slate-800 text-white border border-slate-700'
                                                            : 'bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-cyan-400 border border-slate-800'
                                                    }`}
                                                    title="Vaqtni o'zgartirish"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Inline time editor */}
                                        {isEditing && (
                                            <div className="px-4 pb-4 border-t border-slate-800 pt-3">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Dars vaqtini o'zgartirish</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Boshlanish</label>
                                                        <input
                                                            type="time"
                                                            value={editSchedule.start}
                                                            onChange={e => setEditSchedule(p => ({ ...p, start: e.target.value }))}
                                                            className={inp}
                                                        />
                                                    </div>
                                                    <div className="flex-shrink-0 pt-5 text-slate-500 font-black">→</div>
                                                    <div className="flex-1">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Tugash</label>
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
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-slate-950 rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
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
                        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                Guruh vaqtini o'zgartirish uchun ✏️ belgisini bosing
                            </p>
                            <button onClick={() => { setSelectedRoom(null); setEditingGroup(null); }}
                                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer">
                                Yopish
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
