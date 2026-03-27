import React, { useState } from 'react';
import { Search, Plus, FileSpreadsheet, MoreVertical, X, Filter, Camera, Sparkles } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';
import PhotoCapture from './PhotoCapture';
import MapPicker from './MapPicker';
import { MapPin } from 'lucide-react';

export default function Students() {
    const { students, groups, teachers, transports, addStudent } = useCRM();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [newStudent, setNewStudent] = useState({ 
        name: '', phone: '', address: '', birthDate: '', location: '', photo: '', 
        fatherName: '', fatherPhone: '', motherName: '', motherPhone: '',
        transportId: '' as string | number,
        studentSchool: ''
    });
    const [isRemovingBg, setIsRemovingBg] = useState(false);
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
                groups: [],
                transportId: newStudent.transportId ? Number(newStudent.transportId) : null,
                studentSchool: newStudent.studentSchool
            });
            setIsModalOpen(false);
            setNewStudent({ 
                name: '', phone: '', address: '', birthDate: '', location: '', photo: '', 
                fatherName: '', fatherPhone: '', motherName: '', motherPhone: '',
                transportId: '',
                studentSchool: ''
            });
        } catch (err) {
            console.error("Add student failed", err);
        } finally {
            setIsAdding(false);
        }
    };
    
    const handleRemoveBg = async () => {
        if (!newStudent.photo) return;
        try {
            setIsRemovingBg(true);
            const token = localStorage.getItem('token');
            const response = await fetch('/api/utils/remove-bg', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ image: newStudent.photo })
            });
            const data = await response.json();
            if (data.success) {
                setNewStudent({ ...newStudent, photo: data.image });
                alert("Orqa fon muvaffaqiyatli tozalandi (Simulatsiya)");
            }
        } catch (err) {
            console.error("BG Removal failed", err);
            alert("Xatolik yuz berdi");
        } finally {
            setIsRemovingBg(false);
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
                    <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-10 py-8 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Yangi O'quvchi</h2>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-widest">O'quvchi haqida birlamchi ma'lumotlar</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddStudent} className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                            <div className="space-y-8 pb-12">
                                {/* Section: Basic Info */}
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-sky-600 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                        Asosiy Ma'lumotlar
                                    </h3>
                                    <div className="grid grid-cols-1 gap-5">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">To'liq Ism <span className="text-rose-500">*</span></label>
                                            <div className="relative group">
                                                <input required type="text" placeholder="Ism Familiya" className="w-full pl-6 pr-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400/60"
                                                    value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Telefon <span className="text-rose-500">*</span></label>
                                                <input required type="tel" placeholder="+998" className="w-full px-5 py-4 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 outline-none transition-all shadow-sm"
                                                    value={newStudent.phone} onChange={e => setNewStudent({ ...newStudent, phone: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Tug'ilgan Sana</label>
                                                <input type="date" className="w-full px-5 py-4 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 underline-none transition-all shadow-sm"
                                                    value={newStudent.birthDate} onChange={e => setNewStudent({ ...newStudent, birthDate: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Maktab / Bog'cha</label>
                                            <input type="text" placeholder="Masalan: 45-maktab" className="w-full px-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 outline-none transition-all shadow-sm"
                                                value={newStudent.studentSchool} onChange={e => setNewStudent({ ...newStudent, studentSchool: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Parents */}
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        Ota-ona Ma'lumotlari
                                    </h3>
                                    <div className="grid grid-cols-1 gap-5">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Otasining ismi</label>
                                                <input type="text" placeholder="FISH" className="w-full px-5 py-3.5 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-emerald-500 outline-none transition-all shadow-sm"
                                                    value={newStudent.fatherName} onChange={e => setNewStudent({ ...newStudent, fatherName: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Telefoni</label>
                                                <input type="tel" placeholder="+998" className="w-full px-5 py-3.5 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-emerald-500 outline-none transition-all shadow-sm"
                                                    value={newStudent.fatherPhone} onChange={e => setNewStudent({ ...newStudent, fatherPhone: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Onasining ismi</label>
                                                <input type="text" placeholder="FISH" className="w-full px-5 py-3.5 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-emerald-500 outline-none transition-all shadow-sm"
                                                    value={newStudent.motherName} onChange={e => setNewStudent({ ...newStudent, motherName: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Telefoni</label>
                                                <input type="tel" placeholder="+998" className="w-full px-5 py-3.5 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-emerald-500 outline-none transition-all shadow-sm"
                                                    value={newStudent.motherPhone} onChange={e => setNewStudent({ ...newStudent, motherPhone: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Logistics */}
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        Logistika va Manzil
                                    </h3>
                                    <div className="grid grid-cols-1 gap-5">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Transport Xizmati</label>
                                            <div className="relative">
                                                <select 
                                                    className="w-full px-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-amber-500 outline-none transition-all appearance-none cursor-pointer shadow-sm"
                                                    value={newStudent.transportId}
                                                    onChange={e => setNewStudent({...newStudent, transportId: e.target.value})}
                                                >
                                                    <option value="">Transport kerak emas</option>
                                                    {transports.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name} ({t.number})</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                    <Plus size={16} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Yashash Manzili</label>
                                            <div className="flex flex-col gap-3">
                                                <input type="text" placeholder="Tuman, ko'cha, uy raqami" className="w-full px-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-amber-500 outline-none transition-all shadow-sm"
                                                    value={newStudent.address} onChange={e => setNewStudent({ ...newStudent, address: e.target.value })} />
                                                <button 
                                                    type="button"
                                                    onClick={() => setIsMapOpen(true)}
                                                    className={`w-full py-4 rounded-2xl border flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest transition-all ${newStudent.location ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 shadow-lg shadow-amber-500/10' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 hover:bg-gray-50 shadow-sm'}`}
                                                >
                                                    <MapPin size={18} />
                                                    {newStudent.location ? 'Kartada belgilandi' : 'Kartadan tanlash'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sticky-like Footer with extra padding */}
                            <div className="pt-8 pb-10 border-t border-dashed border-gray-100 dark:border-gray-700">
                                <div className="flex flex-col gap-6">
                                    {/* Photo Actions Row */}
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsPhotoModalOpen(true)}
                                            className={`flex-1 sm:flex-none px-6 py-3 border rounded-2xl flex items-center justify-center gap-2 transition-all text-[10px] font-black uppercase tracking-widest ${newStudent.photo ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700 hover:bg-gray-50'}`}
                                        >
                                            <Camera size={16} />
                                            {newStudent.photo ? "Rasm Yuklandi" : 'Rasmga Olish'}
                                        </button>
                                        
                                        {newStudent.photo && (
                                            <button 
                                                type="button"
                                                onClick={handleRemoveBg}
                                                disabled={isRemovingBg}
                                                className="flex-1 sm:flex-none px-6 py-3 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/50 rounded-2xl text-[9px] font-bold uppercase tracking-widest hover:bg-violet-600 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                <Sparkles size={14} className={isRemovingBg ? 'animate-spin' : ''} />
                                                {isRemovingBg ? 'Tozalanmoqda...' : 'Fonni tozalash'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Main Form Actions Row */}
                                    <div className="flex items-center gap-4 border-t border-gray-50 dark:border-gray-800 pt-6">
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-8 py-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all">
                                            Bekor Qilish
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={isAdding}
                                            className="flex-[2] px-12 py-4 bg-sky-600 dark:bg-sky-500 text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest hover:bg-sky-500 active:scale-95 transition-all shadow-xl shadow-sky-500/30 disabled:opacity-50"
                                        >
                                            {isAdding ? "Saqlash..." : "Saqlash"}
                                        </button>
                                    </div>
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
