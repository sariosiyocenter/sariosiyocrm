import React, { useState } from 'react';
import { Search, Plus, X, Phone, Mail, Award, TrendingUp, Filter, Wallet, Calendar, User, ChevronDown, Clock, GraduationCap } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';

const salaryTypeLabels: Record<string, string> = {
    'FIXED': 'Fiks',
    'KPI': 'KPI',
    'FIXED_KPI': 'Fiks + KPI'
};

export default function Teachers() {
    const { teachers, addTeacher, showNotification } = useCRM();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        status: '',
        salaryType: '',
        dateRange: 'all' // all, today, week, month
    });
    const [newTeacher, setNewTeacher] = useState({
        name: '', phone: '', salary: 0, sharePercentage: 0, lessonFee: 0,
        salaryType: 'FIXED' as 'FIXED' | 'KPI' | 'FIXED_KPI',
        birthDate: '', hiredDate: '', photo: '', status: 'Faol' as const
    });

    const handleAddTeacher = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addTeacher(newTeacher);
            showNotification("O'qituvchi muvaffaqiyatli qo'shildi", "success");
            setIsModalOpen(false);
            setNewTeacher({ name: '', phone: '', salary: 0, sharePercentage: 0, lessonFee: 0, salaryType: 'FIXED', birthDate: '', hiredDate: '', photo: '', status: 'Faol' });
        } catch (err) {
            showNotification("O'qituvchi qo'shishda xatolik", "error");
        }
    };

    const filteredTeachers = teachers.filter(t => {
        const lowerSearch = search.toLowerCase();
        const matchesSearch = (t.name || '').toLowerCase().includes(lowerSearch) || 
               (t.phone || '').toLowerCase().includes(lowerSearch);
        
        const matchesStatus = !filters.status || t.status === filters.status;
        const matchesSalaryType = !filters.salaryType || t.salaryType === filters.salaryType;
        
        let matchesBirthYear = true;
        if (t.birthDate) {
            const birthYear = new Date(t.birthDate).getFullYear();
            if (filters.minBirthYear && birthYear < Number(filters.minBirthYear)) matchesBirthYear = false;
            if (filters.maxBirthYear && birthYear > Number(filters.maxBirthYear)) matchesBirthYear = false;
        }

        let matchesDate = true;
        if (filters.dateRange !== 'all') {
            const date = new Date(t.hiredDate);
            const now = new Date();
            if (filters.dateRange === 'today') matchesDate = date.toDateString() === now.toDateString();
            else if (filters.dateRange === 'week') matchesDate = (now.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000;
            else if (filters.dateRange === 'month') matchesDate = (now.getTime() - date.getTime()) < 30 * 24 * 60 * 60 * 1000;
        }

        return matchesSearch && matchesStatus && matchesSalaryType && matchesDate && matchesBirthYear;
    });

    return (
        <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header section */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300">
                <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-3xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <GraduationCap size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Ustozlar</h1>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">Jami {teachers.length} ta o'qituvchi</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group flex-1 md:w-80">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-violet-500 transition-colors" />
                            <input 
                                type="text" 
                                placeholder="Qidirish..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 rounded-2xl pl-12 pr-6 py-3.5 text-[10px] font-extrabold uppercase tracking-widest text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all shadow-inner"
                            />
                        </div>
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`w-14 h-14 flex items-center justify-center rounded-2xl border transition-all duration-300 ${showFilters ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-500/30' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:border-violet-500 hover:text-violet-500'}`}
                        >
                            <Filter size={20} />
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="px-8 pb-8 pt-2 border-t border-gray-50 dark:border-gray-700/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6 animate-in slide-in-from-top-4 duration-500">
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Holati</label>
                            <select 
                                value={filters.status}
                                onChange={e => setFilters({...filters, status: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-violet-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Barchasi</option>
                                <option value="Faol">Faol</option>
                                <option value="Arxiv">Arxiv</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ish haqi turi</label>
                            <select 
                                value={filters.salaryType}
                                onChange={e => setFilters({...filters, salaryType: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-violet-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="">Barchasi</option>
                                <option value="FIXED">Fiksirlangan</option>
                                <option value="KPI">KPI</option>
                                <option value="FIXED_KPI">Fiks + KPI</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Tug'ilgan yili (min)</label>
                            <input 
                                type="number"
                                placeholder="1990"
                                value={filters.minBirthYear}
                                onChange={e => setFilters({...filters, minBirthYear: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-violet-500 transition-all dark:text-white"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Tug'ilgan yili (max)</label>
                            <input 
                                type="number"
                                placeholder="2005"
                                value={filters.maxBirthYear}
                                onChange={e => setFilters({...filters, maxBirthYear: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-violet-500 transition-all dark:text-white"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ishga kirgan vaqti</label>
                            <select 
                                value={filters.dateRange}
                                onChange={e => setFilters({...filters, dateRange: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-violet-500 transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="all">Barchasi</option>
                                <option value="today">Bugun</option>
                                <option value="week">Shu hafta</option>
                                <option value="month">Shu oy</option>
                            </select>
                        </div>
                        <div className="flex items-end pb-1">
                            <button 
                                onClick={() => setFilters({status: '', salaryType: '', dateRange: 'all', minBirthYear: '', maxBirthYear: ''})}
                                className="w-full py-3.5 text-[9px] font-extrabold uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <X size={14} />
                                Tozalash
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredTeachers.map((teacher, idx) => (
                    <div
                        key={teacher.id}
                        onClick={() => navigate(`/teachers/${teacher.id}`)}
                        className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-500 group cursor-pointer transition-all shadow-sm hover:shadow-2xl hover:shadow-violet-500/10 hover:-translate-y-2 flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-300"
                        style={{ animationDelay: `${idx * 40}ms` }}
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />

                        <div className="flex items-start justify-between mb-8 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800/50 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-xl group-hover:bg-violet-600 group-hover:text-white transition-all overflow-hidden shadow-inner shrink-0 scale-110">
                                {teacher.photo ? (
                                    <img src={teacher.photo} alt={teacher.name} className="w-full h-full object-cover" />
                                ) : (
                                    teacher.name.charAt(0).toUpperCase()
                                )}
                            </div>
                            <span className={`text-[9px] font-extrabold px-3 py-1.5 rounded-xl uppercase tracking-widest border shadow-sm transition-colors group-hover:bg-opacity-100 group-hover:text-white ${teacher.status === 'Faol' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50 group-hover:bg-emerald-600 group-hover:border-emerald-600' : 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-100 dark:border-gray-800'}`}>
                                {teacher.status}
                            </span>
                        </div>
                        
                        <div className="flex-1 mb-6 relative z-10">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors uppercase tracking-tight line-clamp-1" title={teacher.name}>{teacher.name}</h3>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">
                                <Phone size={14} className="text-violet-500" />
                                <span className="tabular-nums">{teacher.phone}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-6 border-t border-dashed border-gray-100 dark:border-gray-700 mt-auto relative z-10">
                            <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                {salaryTypeLabels[teacher.salaryType] || 'Fiks'}
                            </div>
                            <p className="text-sm font-extrabold text-gray-900 dark:text-white tabular-nums tracking-tight">
                                {teacher.salaryType === 'KPI' ? `${teacher.sharePercentage}%` : teacher.salary.toLocaleString()} <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest ml-1">{teacher.salaryType === 'KPI' ? '' : 'UZS'}</span>
                            </p>
                        </div>
                    </div>
                ))}
            </div>
            
            {filteredTeachers.length === 0 && (
                <div className="py-20 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-dashed rounded-xl">
                    <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">O'qituvchilar topilmadi</p>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="px-10 py-8 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Yangi Ustoz</h2>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-widest">Yangi xodim ma'lumotlarini kiriting</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddTeacher} className="p-10 space-y-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ism Familiya <span className="text-rose-500">*</span></label>
                                    <input required type="text" placeholder="Masalan: Asror" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={newTeacher.name} onChange={e => setNewTeacher({ ...newTeacher, name: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Telefon Raqami <span className="text-rose-500">*</span></label>
                                    <input required type="tel" placeholder="+998" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={newTeacher.phone} onChange={e => setNewTeacher({ ...newTeacher, phone: e.target.value })} />
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ish Haqini Hisoblash Turi</label>
                                <div className="flex gap-3">
                                    {(['FIXED', 'KPI', 'FIXED_KPI'] as const).map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setNewTeacher({ ...newTeacher, salaryType: type })}
                                            className={`flex-1 py-4 rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest transition-all border shadow-sm ${newTeacher.salaryType === type
                                                ? 'bg-violet-50 dark:bg-violet-900/40 border-violet-200 dark:border-violet-500 text-violet-700 dark:text-violet-400 ring-4 ring-violet-500/10'
                                                : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                }`}
                                        >
                                            {salaryTypeLabels[type]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                {(newTeacher.salaryType === 'FIXED' || newTeacher.salaryType === 'FIXED_KPI') && (
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Fiks Oylik (UZS) <span className="text-rose-500">*</span></label>
                                        <input required type="number" placeholder="5 000 000" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                            value={newTeacher.salary || ''} onChange={e => setNewTeacher({ ...newTeacher, salary: Number(e.target.value) })} />
                                    </div>
                                )}
                                {(newTeacher.salaryType === 'KPI' || newTeacher.salaryType === 'FIXED_KPI') && (
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ulush Foizi (%) <span className="text-rose-500">*</span></label>
                                        <input required type="number" placeholder="40" min="0" max="100" step="0.1" className="w-full px-6 py-4 bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-emerald-600 dark:text-emerald-400 shadow-inner"
                                            value={newTeacher.sharePercentage || ''} onChange={e => setNewTeacher({ ...newTeacher, sharePercentage: Number(e.target.value) })} />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Tug'ilgan Sanasi <span className="text-rose-500">*</span></label>
                                    <input required type="date" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={newTeacher.birthDate} onChange={e => setNewTeacher({ ...newTeacher, birthDate: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ishga Kirgan Sanasi <span className="text-rose-500">*</span></label>
                                    <input required type="date" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={newTeacher.hiredDate} onChange={e => setNewTeacher({ ...newTeacher, hiredDate: e.target.value })} />
                                </div>
                            </div>

                            <div className="pt-10 flex items-center justify-end gap-5 mt-6 border-t border-dashed border-gray-100 dark:border-gray-700">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                                    Bekor Qilish
                                </button>
                                <button type="submit" className="px-10 py-4 bg-violet-600 dark:bg-violet-500 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-violet-500 dark:hover:bg-violet-400 active:scale-[0.98] transition-all shadow-xl shadow-violet-500/20">
                                    Saqlash
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
