import React, { useState } from 'react';
import { Search, Plus, X, Users, Filter, Layers, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';

const inp = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-750 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

export default function Groups() {
    const { groups, teachers, rooms, addGroup, showNotification, courses } = useCRM();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        courseId: '',
        teacherId: '',
        dayType: 'all', // all, odd, even
        roomId: '',
        timeOfDay: 'all' // all, morning, afternoon, evening
    });
    const [newGroup, setNewGroup] = useState({ name: '', teacherId: 0, courseId: 0, startTime: '', endTime: '', days: 'TOQ', room: '' });

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
            const daysOverlap = g.days === 'HAR_KUNI' || days === 'HAR_KUNI' || g.days === days;
            if (!daysOverlap) return false;

            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            const s1 = h1 * 60 + m1;
            const e1 = h2 * 60 + m2;

            const scheduleParts = g.schedule ? g.schedule.split(' - ') : [];
            const existingStart = scheduleParts[0];
            const existingEnd = scheduleParts[1];
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
                const existingStart = conflict.schedule ? conflict.schedule.split(' - ')[0] : 'O\'sha vaqtda';
                showNotification(`Xona band! ${conflict.name} guruhi bilan to'qnashuv: ${existingStart}`, "error");
                return;
            }

            setIsAdding(true);
            await addGroup({ 
                name: newGroup.name,
                teacherId: Number(newGroup.teacherId), 
                courseId: Number(newGroup.courseId),
                room: Number(newGroup.room),
                days: newGroup.days,
                schedule: `${newGroup.startTime} - ${newGroup.endTime}`,
                studentIds: []
            });
            setIsModalOpen(false);
            setNewGroup({ name: '', teacherId: 0, courseId: 0, startTime: '', endTime: '', days: 'TOQ', room: '' });
            showNotification("Guruh muvaffaqiyatli ochildi!", "success");
        } catch (err) {
            showNotification("Guruh yaratishda xatolik yuz berdi", "error");
        } finally {
            setIsAdding(false);
        }
    };

    const getTeacherName = (id: number) => teachers.find(t => t.id === id)?.name || "Noma'lum";
    const getCourseName = (id: number) => courses.find(c => c.id === id)?.name || "Noma'lum";

    const filteredGroups = groups.filter(g => {
        const lowerSearch = search.toLowerCase();
        const courseName = getCourseName(g.courseId);
        const matchesSearch = (g.name || '').toLowerCase().includes(lowerSearch) || 
               courseName.toLowerCase().includes(lowerSearch);
        
        const matchesCourse = !filters.courseId || g.courseId === Number(filters.courseId);
        const matchesTeacher = !filters.teacherId || g.teacherId === Number(filters.teacherId);
        const matchesRoom = !filters.roomId || g.room === Number(filters.roomId);
        
        let matchesDay = true;
        if (filters.dayType !== 'all') {
            matchesDay = g.days === filters.dayType;
        }

        let matchesTime = true;
        const scheduleParts = g.schedule ? g.schedule.split(' - ') : [];
        const startTime = scheduleParts[0];
        if (filters.timeOfDay !== 'all' && startTime) {
            const hour = parseInt(startTime.split(':')[0]);
            if (filters.timeOfDay === 'morning') matchesTime = hour < 12;
            else if (filters.timeOfDay === 'afternoon') matchesTime = hour >= 12 && hour < 18;
            else if (filters.timeOfDay === 'evening') matchesTime = hour >= 18;
        }

        return matchesSearch && matchesCourse && matchesTeacher && matchesDay && matchesRoom && matchesTime;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-lg shadow-[#1b6b6b]/20">
                            <Layers size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Guruhlar</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                Jami {groups.length} ta guruh • Barcha dars jadvallari
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text" placeholder="Guruh yoki kurs..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-750 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all w-52"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${showFilters ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white' : 'bg-gray-55 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700 text-gray-400 hover:border-[#1b6b6b]'}`}
                        >
                            <SlidersHorizontal size={15} />
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> Qo'shish
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="px-6 pb-5 pt-4 border-t border-gray-50 dark:border-gray-700/50 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div>
                            <label className={lbl}>Kurs bo'yicha</label>
                            <select value={filters.courseId} onChange={e => setFilters({...filters, courseId: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="">Barchasi</option>
                                {courses.map(course => (
                                    <option key={course.id} value={course.id}>{course.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>O'qituvchi</label>
                            <select value={filters.teacherId} onChange={e => setFilters({...filters, teacherId: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="">Barchasi</option>
                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Kunlar</label>
                            <select value={filters.dayType} onChange={e => setFilters({...filters, dayType: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="all">Barchasi</option>
                                <option value="TOQ">Toq kunlar</option>
                                <option value="JUFT">Juft kunlar</option>
                                <option value="HAR_KUNI">Har kuni</option>
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Xona</label>
                            <select value={filters.roomId} onChange={e => setFilters({...filters, roomId: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-[#1b6b6b] transition-all cursor-pointer">
                                <option value="">Barchasi</option>
                                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button onClick={() => setFilters({courseId: '', teacherId: '', dayType: 'all', roomId: '', timeOfDay: 'all'})}
                                className="w-full py-2 text-[10px] font-extrabold uppercase text-rose-500 hover:text-rose-600 flex items-center justify-center gap-1.5 cursor-pointer">
                                <X size={12} /> Tozalash
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Grid */}
            {filteredGroups.length === 0 ? (
                <div className="py-24 text-center bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 border-dashed">
                    <Layers size={40} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
                    <p className="text-sm font-bold text-gray-400">Guruhlar topilmadi</p>
                    <button onClick={() => setIsModalOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#1b6b6b] text-white text-xs font-extrabold uppercase tracking-widest rounded-xl cursor-pointer">
                        <Plus size={13} /> Yangi Guruh
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredGroups.map(group => {
                        const scheduleParts = group.schedule ? group.schedule.split(' - ') : [];
                        const startTime = scheduleParts[0] || '';
                        return (
                            <div key={group.id} onClick={() => navigate(`/groups/${group.id}`)}
                                className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-xl hover:border-[#1b6b6b]/40 dark:hover:border-[#1b6b6b]/40 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer p-5 flex flex-col">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[#1b6b6b]/10 dark:bg-[#1b6b6b]/20 flex items-center justify-center text-[#1b6b6b] font-black text-lg group-hover:scale-105 transition-transform overflow-hidden shrink-0">
                                        <Layers size={22} />
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40">
                                        Faol
                                    </span>
                                </div>

                                <div className="flex-1 mb-4">
                                    <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-[#1b6b6b] transition-colors line-clamp-1">{group.name}</h3>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{getCourseName(group.courseId)}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-3 border-y border-dashed border-gray-100 dark:border-gray-700 mb-3 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                                    <div>
                                        <span className="block text-[8px] text-gray-400 mb-0.5">Ustoz</span>
                                        <span className="text-gray-900 dark:text-white truncate block">{getTeacherName(group.teacherId)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[8px] text-gray-400 mb-0.5">Vaqt</span>
                                        <span className="text-gray-900 dark:text-white truncate block tabular-nums">
                                            {startTime} • {group.days === 'TOQ' ? 'Toq' : group.days === 'JUFT' ? 'Juft' : 'Har kun'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex items-center gap-2">
                                        <Users size={14} className="text-[#1b6b6b]" />
                                        <span className="text-xs font-black text-gray-900 dark:text-white tabular-nums">{(group.studentIds || []).length} ta o'quvchi</span>
                                    </div>
                                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-55 dark:bg-gray-900/50 group-hover:bg-[#1b6b6b] group-hover:text-white text-gray-400 transition-all">
                                        <ChevronRight size={16} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Yangi Guruh</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">Guruh ma'lumotlarini kiriting</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleAddGroup} className="space-y-4">
                            <div>
                                <label className={lbl}>Guruh Nomi *</label>
                                <input required type="text" placeholder="Frontend #5" className={inp} value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>Kurs *</label>
                                    <select required className={inp} value={newGroup.courseId || ''} onChange={e => setNewGroup({ ...newGroup, courseId: Number(e.target.value) })}>
                                        <option value="" disabled>Tanlang...</option>
                                        {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>O'qituvchi *</label>
                                    <select required className={inp} value={newGroup.teacherId} onChange={e => setNewGroup({ ...newGroup, teacherId: Number(e.target.value) })}>
                                        <option value={0} disabled>Tanlang...</option>
                                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>Kunlar *</label>
                                    <select required className={inp} value={newGroup.days} onChange={e => setNewGroup({ ...newGroup, days: e.target.value })}>
                                        <option value="TOQ">Toq kunlar (Du/Chor/Jum)</option>
                                        <option value="JUFT">Juft kunlar (Se/Pay/Sha)</option>
                                        <option value="HAR_KUNI">Har kuni (Du-Sha)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>Xona *</label>
                                    <select required className={inp} value={newGroup.room} onChange={e => setNewGroup({ ...newGroup, room: e.target.value })}>
                                        <option value="" disabled>Tanlang...</option>
                                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.capacity} kishi)</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>Boshlanish vaqti *</label>
                                    <input required type="time" className={inp} value={newGroup.startTime} onChange={e => setNewGroup({ ...newGroup, startTime: e.target.value })} />
                                </div>
                                <div>
                                    <label className={lbl}>Tugash vaqti *</label>
                                    <input required type="time" className={inp} value={newGroup.endTime} onChange={e => setNewGroup({ ...newGroup, endTime: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-750 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700">
                                    Bekor
                                </button>
                                <button type="submit" disabled={isAdding}
                                    className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer disabled:opacity-50">
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
