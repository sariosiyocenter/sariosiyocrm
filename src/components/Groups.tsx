import React, { useState } from 'react';
import { Search, Plus, MoreVertical, X, Users, Filter, Layers, ChevronRight } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';

export default function Groups() {
    const { groups, teachers, rooms, addGroup, showNotification } = useCRM();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        courseName: '',
        teacherId: '',
        status: '',
        dayType: 'all', // all, odd, even
        roomId: '',
        timeOfDay: 'all' // all, morning, afternoon, evening
    });
    const [newGroup, setNewGroup] = useState({ name: '', teacherId: 0, courseName: '', startTime: '', endTime: '', days: 'TOQ', room: '' });

    // Auto-calculate 2 hours
    React.useEffect(() => {
        if (newGroup.startTime && !newGroup.endTime) {
            const [h, m] = newGroup.startTime.split(':').map(Number);
            const endH = (h + 2) % 24;
            const endM = m;
            setNewGroup(prev => ({ ...prev, endTime: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}` }));
        }
    }, [newGroup.startTime]);

    const checkRoomConflict = (roomId: number, days: string, start: string, end: string) => {
        return groups.find(g => {
            if (g.room !== roomId) return false;
            
            // Day overlap: HAR_KUNI matches everything, TOQ/JUFT only match themselves
            const daysOverlap = g.days === 'HAR_KUNI' || days === 'HAR_KUNI' || g.days === days;
            if (!daysOverlap) return false;

            // Time overlap: startA < endB && startB < endA
            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            const s1 = h1 * 60 + m1;
            const e1 = h2 * 60 + m2;

            const existingStart = (g.startTime || g.schedule.split(' - ')[0]);
            const existingEnd = (g.endTime || g.schedule.split(' - ')[1]);
            if (!existingStart || !existingEnd) return false;

            const [eh1, em1] = existingStart.split(':').map(Number);
            const [eh2, em2] = existingEnd.split(':').map(Number);
            const s2 = eh1 * 60 + em1;
            const e2 = eh2 * 60 + em2;

            return s1 < e2 && s2 < e1;
        });
    };

    const handleAddGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            const conflict = checkRoomConflict(Number(newGroup.room), newGroup.days, newGroup.startTime, newGroup.endTime);
            if (conflict) {
                showNotification(`Xona band! ${conflict.name} guruhi bilan to'qnashuv: ${conflict.startTime || 'O\'sha vaqtda'}`, "error");
                return;
            }

            setIsAdding(true);
            await addGroup({ 
                ...newGroup, 
                teacherId: Number(newGroup.teacherId), 
                room: Number(newGroup.room),
                schedule: `${newGroup.startTime} - ${newGroup.endTime}`,
                studentsCount: 0, 
                status: 'Ochildi' 
            });
            setIsModalOpen(false);
            setNewGroup({ name: '', teacherId: 0, courseName: '', startTime: '', endTime: '', days: 'TOQ', room: '' });
        } catch (err) {
            console.error("Group creation failed", err);
        } finally {
            setIsAdding(false);
        }
    };

    const getTeacherName = (id: number) => teachers.find(t => t.id === id)?.name || "Noma'lum";

    const filteredGroups = groups.filter(g => {
        const lowerSearch = search.toLowerCase();
        const matchesSearch = (g.name || '').toLowerCase().includes(lowerSearch) || 
               (g.courseName || '').toLowerCase().includes(lowerSearch);
        
        const matchesCourse = !filters.courseName || g.courseName === filters.courseName;
        const matchesTeacher = !filters.teacherId || g.teacherId === Number(filters.teacherId);
        const matchesStatus = !filters.status || g.status === filters.status;
        const matchesRoom = !filters.roomId || g.room === Number(filters.roomId);
        
        let matchesDay = true;
        if (filters.dayType !== 'all') {
            matchesDay = g.days === filters.dayType;
        }

        let matchesTime = true;
        if (filters.timeOfDay !== 'all' && g.startTime) {
            const hour = parseInt(g.startTime.split(':')[0]);
            if (filters.timeOfDay === 'morning') matchesTime = hour < 12;
            else if (filters.timeOfDay === 'afternoon') matchesTime = hour >= 12 && hour < 18;
            else if (filters.timeOfDay === 'evening') matchesTime = hour >= 18;
        }

        return matchesSearch && matchesCourse && matchesTeacher && matchesStatus && matchesDay && matchesRoom && matchesTime;
    });

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Guruhlar</h1>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Barcha guruhlarni boshqarish jadvali</p>
                </div>
            </div>

            {/* Header Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/10 dark:shadow-none overflow-hidden transition-all">
                <div className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <button 
                            onClick={() => setIsModalOpen(true)} 
                            className="px-10 py-4 bg-sky-600 dark:bg-sky-500 text-white rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest hover:bg-sky-500 dark:hover:bg-sky-400 active:scale-[0.98] transition-all shadow-xl shadow-sky-500/30 flex items-center gap-3 group"
                        >
                            <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                            Yangi Guruh
                        </button>
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-3 px-8 py-4 rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest transition-all group shadow-sm border ${
                                showFilters 
                                ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-800' 
                                : 'bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            <Filter size={18} className={showFilters ? 'text-sky-500' : 'group-hover:text-sky-500 transition-colors'} />
                            {showFilters ? 'Filterni yopish' : 'Filterlar'}
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <div className="relative group w-full lg:w-[450px]">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-sky-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Guruh yoki kurs bo'yicha qidiruv..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest outline-none focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all placeholder:text-gray-400/60 dark:text-white text-gray-900 shadow-inner"
                            />
                        </div>
                    </div>
                </div>

                {showFilters && (
                    <div className="px-8 pb-8 pt-2 border-t border-gray-50 dark:border-gray-700/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6 animate-in slide-in-from-top-4 duration-500">
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Kurs bo'yicha</label>
                            <select 
                                value={filters.courseName}
                                onChange={e => setFilters({...filters, courseName: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-sky-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Barchasi</option>
                                {Array.from(new Set(groups.map(g => g.courseName))).map(course => (
                                    <option key={course} value={course}>{course}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">O'qituvchi</label>
                            <select 
                                value={filters.teacherId}
                                onChange={e => setFilters({...filters, teacherId: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-sky-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Barchasi</option>
                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Kunlar</label>
                            <select 
                                value={filters.dayType}
                                onChange={e => setFilters({...filters, dayType: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-sky-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="all">Barchasi</option>
                                <option value="TOQ">Toq kunlar</option>
                                <option value="JUFT">Juft kunlar</option>
                                <option value="HAR_KUNI">Har kuni</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Xona</label>
                            <select 
                                value={filters.roomId}
                                onChange={e => setFilters({...filters, roomId: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-sky-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Barchasi</option>
                                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Vaqt</label>
                            <select 
                                value={filters.timeOfDay}
                                onChange={e => setFilters({...filters, timeOfDay: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-sky-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="all">Barcha vaqt</option>
                                <option value="morning">Ertalab</option>
                                <option value="afternoon">Kush o'rtasi</option>
                                <option value="evening">Kechki</option>
                            </select>
                        </div>
                        <div className="flex items-end pb-1">
                            <button 
                                onClick={() => setFilters({courseName: '', teacherId: '', status: '', dayType: 'all', roomId: '', timeOfDay: 'all'})}
                                className="w-full py-3.5 text-[9px] font-extrabold uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <X size={14} />
                                Tozalash
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredGroups.map((group, idx) => (
                    <div
                        key={group.id}
                        onClick={() => navigate(`/groups/${group.id}`)}
                        className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 group cursor-pointer transition-all shadow-sm hover:shadow-2xl hover:shadow-sky-500/10 hover:border-sky-300 dark:hover:border-sky-500 hover:-translate-y-2 relative overflow-hidden animate-in zoom-in-95 duration-500"
                        style={{ animationDelay: `${idx * 50}ms` }}
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                        
                        <div className="flex items-start justify-between mb-8 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 group-hover:text-white transition-all shadow-inner shrink-0 scale-110">
                                    <Layers size={26} />
                                </div>
                                <div className="min-w-0 pr-2">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate uppercase tracking-tight">{group.name}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1 truncate uppercase tracking-widest">{group.courseName}</p>
                                </div>
                            </div>
                            <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl shrink-0 shadow-sm transition-colors group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600">
                                {group.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-6 py-6 border-y border-dashed border-gray-100 dark:border-gray-700 -mx-8 px-8 relative z-10 transition-colors group-hover:bg-gray-50/50 dark:group-hover:bg-gray-900/30">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 block uppercase tracking-widest">O'qituvchi</span>
                                <span className="text-sm font-bold text-gray-900 dark:text-white leading-none truncate block pr-2 uppercase tracking-tight" title={getTeacherName(group.teacherId)}>{getTeacherName(group.teacherId)}</span>
                            </div>
                            <div className="text-right space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 block uppercase tracking-widest">Vaqt & Kunlar</span>
                                <span className="text-sm font-bold text-gray-900 dark:text-white leading-none truncate block uppercase tracking-tight tabular-nums">
                                    {group.startTime || group.schedule.split(' - ')[0]} &bull; {group.days === 'TOQ' ? 'Toq' : group.days === 'JUFT' ? 'Juft' : 'Har kun'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-6 pt-1 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 group-hover:text-sky-500 transition-all shadow-inner">
                                    <Users size={18} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 block uppercase tracking-widest leading-none mb-1">O'quvchilar</span>
                                    <span className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">{group.studentsCount} ta</span>
                                </div>
                            </div>
                            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 group-hover:bg-sky-600 group-hover:text-white group-hover:border-sky-600 text-gray-300 dark:text-gray-600 transition-all shadow-sm">
                                <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>
                ))}

                {filteredGroups.length === 0 && (
                    <div className="col-span-full py-32 text-center border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-[3rem] bg-gray-50/50 dark:bg-gray-900/20 animate-in fade-in duration-500 scale-95">
                        <Users className="w-20 h-20 text-gray-200 dark:text-gray-700 mx-auto mb-6" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Guruhlar topilmadi</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Boshqa so'z bilan qidirib ko'ring yoki yangi guruh yarating</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="px-10 py-8 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Yangi Guruh</h2>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-widest">Yangi guruh ma'lumotlarini kiriting</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddGroup} className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Guruh nomi <span className="text-rose-500">*</span></label>
                                <input required type="text" placeholder="Masalan: Frontend #12" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400/60 shadow-inner"
                                    value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Kurs <span className="text-rose-500">*</span></label>
                                    <input required type="text" placeholder="Frontend" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400/60 shadow-inner"
                                        value={newGroup.courseName} onChange={e => setNewGroup({ ...newGroup, courseName: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">O'qituvchi <span className="text-rose-500">*</span></label>
                                    <select required className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all cursor-pointer text-gray-900 dark:text-white shadow-inner appearance-none"
                                        value={newGroup.teacherId} onChange={e => setNewGroup({ ...newGroup, teacherId: Number(e.target.value) })}>
                                        <option value={0} disabled>Tanlang...</option>
                                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Kunlar <span className="text-rose-500">*</span></label>
                                    <select 
                                        required 
                                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all cursor-pointer text-gray-900 dark:text-white shadow-inner appearance-none"
                                        value={newGroup.days} 
                                        onChange={e => setNewGroup({ ...newGroup, days: e.target.value })}
                                    >
                                        <option value="TOQ">Toq kunlar (Du/Chor/Jum)</option>
                                        <option value="JUFT">Juft kunlar (Se/Pay/Sha)</option>
                                        <option value="HAR_KUNI">Har kuni (Du-Sha)</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Xona <span className="text-rose-500">*</span></label>
                                    <select 
                                        required 
                                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all cursor-pointer text-gray-900 dark:text-white shadow-inner appearance-none"
                                        value={newGroup.room} 
                                        onChange={e => setNewGroup({ ...newGroup, room: e.target.value })}
                                    >
                                        <option value="" disabled>Xonani tanlang...</option>
                                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.capacity} kishilik)</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Boshlanish Vaqti <span className="text-rose-500">*</span></label>
                                    <input required type="time" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={newGroup.startTime} onChange={e => setNewGroup({ ...newGroup, startTime: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Tugash Vaqti <span className="text-rose-500">*</span></label>
                                    <input required type="time" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={newGroup.endTime} onChange={e => setNewGroup({ ...newGroup, endTime: e.target.value })} />
                                </div>
                            </div>
                            <div className="pt-10 flex items-center justify-end gap-5 border-t border-dashed border-gray-100 dark:border-gray-700">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                                    Bekor Qilish
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isAdding}
                                    className="px-10 py-4 bg-sky-600 dark:bg-sky-500 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-sky-500 dark:hover:bg-sky-400 active:scale-[0.98] transition-all shadow-xl shadow-sky-500/20 disabled:opacity-50"
                                >
                                    {isAdding ? "Saqlanmoqda..." : "Saqlash"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
