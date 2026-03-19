import React, { useState } from 'react';
import { Search, Plus, FileSpreadsheet, MoreVertical, X, Filter, Camera } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';
import PhotoCapture from './PhotoCapture';
import MapPicker from './MapPicker';
import { MapPin } from 'lucide-react';

export default function Students() {
    const { students, groups, teachers, addStudent } = useCRM();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: '', phone: '', address: '', birthDate: '', location: '', photo: '' });
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        status: '',
        groupId: '',
        balanceStatus: 'all', // all, debtor, positive
        dateRange: 'all' // all, today, week, month
    });

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsAdding(true);
            await addStudent({
                ...newStudent,
                status: 'Faol',
                joinedDate: new Date().toISOString().split('T')[0],
                balance: 0,
                groups: []
            });
            setIsModalOpen(false);
            setNewStudent({ name: '', phone: '', address: '', birthDate: '', location: '', photo: '' });
        } catch (err) {
            console.error("Add student failed", err);
        } finally {
            setIsAdding(false);
        }
    };

    const getStudentGroups = (studentGroupIds: number[]) => {
        return groups.filter(g => studentGroupIds.includes(g.id)).map(g => {
            const teacher = teachers.find(t => t.id === g.teacherId);
            return {
                ...g, teacherName: teacher?.name || "Noma'lum"
            };
        });
    }
    const filteredStudents = students.filter(s => {
        const lowerSearch = search.toLowerCase();
        const matchesSearch = (s.name || '').toLowerCase().includes(lowerSearch) || 
               (s.phone || '').toLowerCase().includes(lowerSearch);
        
        const matchesStatus = !filters.status || s.status === filters.status;
        const matchesGroup = !filters.groupId || s.groups.includes(Number(filters.groupId));
        const matchesRating = !filters.rating || s.rating === Number(filters.rating);
        const matchesLocation = !filters.location || s.location === filters.location;
        
        let matchesBalance = true;
        if (filters.balanceStatus === 'debt') matchesBalance = (s.balance || 0) < 0;
        else if (filters.balanceStatus === 'positive') matchesBalance = (s.balance || 0) >= 0;

        let matchesDate = true;
        if (filters.dateRange !== 'all') {
            const date = new Date(s.joinedDate);
            const now = new Date();
            if (filters.dateRange === 'today') matchesDate = date.toDateString() === now.toDateString();
            else if (filters.dateRange === 'week') matchesDate = (now.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000;
            else if (filters.dateRange === 'month') matchesDate = (now.getTime() - date.getTime()) < 30 * 24 * 60 * 60 * 1000;
        }

        return matchesSearch && matchesStatus && matchesGroup && matchesBalance && matchesDate;
    });

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">O'quvchilar</h1>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Markazdagi jami o'quvchilar ro'yxati</p>
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
                            Yangi O'quvchi
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
                                placeholder="Ism yoki telefon raqami..."
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
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Holati</label>
                            <select 
                                value={filters.status}
                                onChange={e => setFilters({...filters, status: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-sky-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Barchasi</option>
                                <option value="Faol">Faol</option>
                                <option value="Arxiv">Arxiv</option>
                                <option value="Sinov">Sinov</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Guruh</label>
                            <select 
                                value={filters.groupId}
                                onChange={e => setFilters({...filters, groupId: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-sky-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Barchasi</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Balans</label>
                            <select 
                                value={filters.balanceStatus}
                                onChange={e => setFilters({...filters, balanceStatus: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-sky-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Barchasi</option>
                                <option value="debt">Qarzdorlar</option>
                                <option value="positive">To'laganlar</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Reyting</label>
                            <select 
                                value={filters.rating}
                                onChange={e => setFilters({...filters, rating: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-sky-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Barchasi</option>
                                {[1,2,3,4,5].map(r => <option key={r} value={r}>{r} yulduz</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Manzil</label>
                            <select 
                                value={filters.location}
                                onChange={e => setFilters({...filters, location: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-sky-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Barchasi</option>
                                {Array.from(new Set(students.map(s => s.location).filter(Boolean))).map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end pb-1">
                            <button 
                                onClick={() => setFilters({status: '', groupId: '', balanceStatus: '', dateRange: 'all', rating: '', location: ''})}
                                className="w-full py-3.5 text-[9px] font-extrabold uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <X size={14} />
                                Tozalash
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-sky-500/5 overflow-hidden transition-all">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">ID</th>
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">O'quvchi</th>
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">Telefon</th>
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Guruhlar</th>
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Moliyaviy Holat</th>
                                <th className="p-6 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {filteredStudents.map((student, idx) => (
                                <tr key={student.id} className="hover:bg-gray-50/80 dark:hover:bg-sky-900/10 transition-all cursor-pointer group animate-in slide-in-from-left-2 duration-300" 
                                    style={{ animationDelay: `${idx * 30}ms` }}
                                    onClick={() => navigate(`/students/${student.id}`)}>
                                    <td className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-600 text-center tabular-nums">#{student.id}</td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm shadow-inner overflow-hidden shrink-0 group-hover:scale-110 transition-transform">
                                                {student.photo ? (
                                                    <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                                                ) : student.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{student.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">A'zo:</span>
                                                    <span className="text-[10px] font-extrabold text-gray-500 dark:text-gray-400 tracking-tight">{student.joinedDate}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className="text-[10px] font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900/50 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 group-hover:border-sky-300 transition-colors tabular-nums">
                                            {student.phone}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-wrap gap-2 min-w-[180px]">
                                            {getStudentGroups(student.groups).map(g => (
                                                <span key={g.id} className="px-3 py-1.5 bg-sky-50 dark:bg-sky-900/40 border border-sky-100 dark:border-sky-800 text-sky-700 dark:text-sky-300 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm">
                                                    {g.name}
                                                </span>
                                            ))}
                                            {student.groups.length === 0 && <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest italic opacity-60">Guruhsiz</span>}
                                        </div>
                                    </td>
                                    <td className="p-6 text-right">
                                        <div className="flex flex-col items-end gap-2 text-right">
                                            <span className={`px-2.5 py-1 rounded-xl text-[9px] font-extrabold border uppercase tracking-widest shadow-sm ${student.status === 'Faol' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50' : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700'}`}>
                                                {student.status}
                                            </span>
                                            <span className={`text-sm font-extrabold tabular-nums tracking-tight ${student.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {student.balance.toLocaleString()} UZS
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-300 dark:text-gray-600 group-hover:text-white group-hover:bg-sky-600 group-hover:border-sky-600 transition-all border border-transparent shadow-sm">
                                            <MoreVertical size={20} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredStudents.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-24 text-center">
                                        <Search className="w-16 h-16 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Hech qanday o'quvchi topilmadi</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="px-10 py-8 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Yangi O'quvchi</h2>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-widest">O'quvchi haqida birlamchi ma'lumotlar</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddStudent} className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ism Familiya <span className="text-rose-500">*</span></label>
                                <input required type="text" placeholder="Masalan: Jamshid Karimov" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400/60 shadow-inner"
                                    value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} />
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Telefon Raqami <span className="text-rose-500">*</span></label>
                                    <input required type="tel" placeholder="+998" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400/60 shadow-inner"
                                        value={newStudent.phone} onChange={e => setNewStudent({ ...newStudent, phone: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Tug'ilgan Sanasi</label>
                                    <input type="date" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={newStudent.birthDate} onChange={e => setNewStudent({ ...newStudent, birthDate: e.target.value })} />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Yashash Manzili</label>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <input type="text" placeholder="Tuman, ko'cha, uy raqami" className="flex-1 px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400/60 shadow-inner"
                                        value={newStudent.address} onChange={e => setNewStudent({ ...newStudent, address: e.target.value })} />
                                    <button 
                                        type="button"
                                        onClick={() => setIsMapOpen(true)}
                                        className={`px-6 py-4 rounded-[1.25rem] border border-gray-100 dark:border-gray-700 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 ${newStudent.location ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                    >
                                        <MapPin size={18} />
                                        {newStudent.location ? 'Kartada belgilandi' : 'Kartadan tanlash'}
                                    </button>
                                </div>
                                {newStudent.location && (
                                    <p className="text-[9px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest ml-1 animate-in fade-in slide-in-from-left-2">Lokatsiya: {newStudent.location}</p>
                                )}
                            </div>

                            <div className="pt-10 flex flex-col sm:flex-row items-center justify-between gap-6 mt-6 border-t border-dashed border-gray-100 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setIsPhotoModalOpen(true)}
                                    className={`w-full sm:w-auto px-6 py-4 border rounded-2xl flex items-center justify-center gap-3 transition-all text-[10px] font-bold uppercase tracking-widest ${newStudent.photo ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 shadow-lg shadow-emerald-500/10' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'}`}
                                >
                                    <Camera size={20} className={newStudent.photo ? 'animate-pulse' : ''} />
                                    {newStudent.photo ? "Rasm Saqlandi" : 'Rasmga Olish'}
                                </button>
                                <div className="flex items-center gap-5 w-full sm:w-auto">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 sm:flex-none px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                                        Bekor Qilish
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={isAdding}
                                        className="flex-1 sm:flex-none px-10 py-4 bg-sky-600 dark:bg-sky-500 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-sky-500 dark:hover:bg-sky-400 active:scale-[0.98] transition-all shadow-xl shadow-sky-500/20 disabled:opacity-50 disabled:active:scale-100"
                                    >
                                        {isAdding ? "Saqlanmoqda..." : "Saqlash"}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isPhotoModalOpen && (
                <PhotoCapture
                    onCapture={(photo) => setNewStudent({ ...newStudent, photo })}
                    onClose={() => setIsPhotoModalOpen(false)}
                />
            )}

            {isMapOpen && (
                <MapPicker 
                    initialLocation={newStudent.location}
                    onSelect={(loc) => setNewStudent({ ...newStudent, location: loc })}
                    onClose={() => setIsMapOpen(false)}
                />
            )}
        </div>
    );
}
