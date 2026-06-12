import React, { useState } from 'react';
import { Search, Plus, X, Phone, Filter, GraduationCap, SlidersHorizontal } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';

const salaryColors: Record<string, string> = {
    'FIXED': 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/40',
    'KPI': 'bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/40',
    'FIXED_KPI': 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40',
};

const inp = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

export default function Teachers() {
    const { teachers, addTeacher, showNotification } = useCRM();
    const { t } = useLang();
    const navigate = useNavigate();

    const salaryTypeLabels: Record<string, string> = {
        'FIXED': t('salary_fixed'),
        'KPI': t('salary_kpi'),
        'FIXED_KPI': t('salary_fixed_kpi')
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({ status: '', salaryType: '', dateRange: 'all', minBirthYear: '', maxBirthYear: '' });
    const [newTeacher, setNewTeacher] = useState({
        name: '', phone: '', salary: 0, sharePercentage: 0, lessonFee: 0,
        salaryType: 'FIXED' as 'FIXED' | 'KPI' | 'FIXED_KPI',
        birthDate: '', hiredDate: '', photo: '', status: 'Faol' as const
    });

    const handleAddTeacher = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addTeacher(newTeacher);
            showNotification(t('teacher_added_success'), "success");
            setIsModalOpen(false);
            setNewTeacher({ name: '', phone: '', salary: 0, sharePercentage: 0, lessonFee: 0, salaryType: 'FIXED', birthDate: '', hiredDate: '', photo: '', status: 'Faol' });
        } catch {
            showNotification(t('teacher_added_error'), "error");
        }
    };

    const filteredTeachers = teachers.filter(t => {
        const s = search.toLowerCase();
        const matchesSearch = (t.name || '').toLowerCase().includes(s) || (t.phone || '').toLowerCase().includes(s);
        const matchesStatus = !filters.status || t.status === filters.status;
        const matchesSalaryType = !filters.salaryType || t.salaryType === filters.salaryType;
        let matchesBirthYear = true;
        if (t.birthDate) {
            const y = new Date(t.birthDate).getFullYear();
            if (filters.minBirthYear && y < Number(filters.minBirthYear)) matchesBirthYear = false;
            if (filters.maxBirthYear && y > Number(filters.maxBirthYear)) matchesBirthYear = false;
        }
        let matchesDate = true;
        if (filters.dateRange !== 'all') {
            const d = new Date(t.hiredDate), now = new Date();
            if (filters.dateRange === 'today') matchesDate = d.toDateString() === now.toDateString();
            else if (filters.dateRange === 'week') matchesDate = (now.getTime() - d.getTime()) < 7 * 864e5;
            else if (filters.dateRange === 'month') matchesDate = (now.getTime() - d.getTime()) < 30 * 864e5;
        }
        return matchesSearch && matchesStatus && matchesSalaryType && matchesDate && matchesBirthYear;
    });

    const activeCount = teachers.filter(t => t.status === 'Faol').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-violet-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <GraduationCap size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('teachers_title')}</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                {t('teachers_count_summary').replace('{total}', teachers.length.toString()).replace('{active}', activeCount.toString())}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text" placeholder={t('search_placeholder_students')}
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2.5 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-violet-500 transition-all w-52"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${showFilters ? 'bg-violet-600 border-violet-600 text-white' : 'bg-gray-55 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700 text-gray-400 hover:border-violet-400 hover:text-violet-500'}`}
                        >
                            <SlidersHorizontal size={15} />
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> {t('add')}
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="px-6 pb-5 pt-4 border-t border-gray-50 dark:border-gray-700/50 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        {[
                            { label: t('filter_status'), key: 'status', opts: [['', t('all')], ['Faol', t('status_active')], ['Arxiv', t('status_archive')]] },
                            { label: t('salary_type'), key: 'salaryType', opts: [['', t('all')], ['FIXED', t('salary_fixed')], ['KPI', t('salary_kpi')], ['FIXED_KPI', t('salary_fixed_kpi')]] },
                            { label: t('date'), key: 'dateRange', opts: [['all', t('all')], ['today', 'Bugun'], ['week', 'Hafta'], ['month', 'Oy']] },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1.5">{f.label}</label>
                                <select value={(filters as any)[f.key]} onChange={e => setFilters({ ...filters, [f.key]: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-violet-400 transition-all cursor-pointer">
                                    {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                            </div>
                        ))}
                        <div>
                            <label className={lbl.replace('mb-2','mb-1.5')}>{t('birth_date')} (min)</label>
                            <input type="number" placeholder="1990" value={filters.minBirthYear} onChange={e => setFilters({ ...filters, minBirthYear: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-violet-400 transition-all" />
                        </div>
                        <div>
                            <label className={lbl.replace('mb-2','mb-1.5')}>{t('birth_date')} (max)</label>
                            <input type="number" placeholder="2005" value={filters.maxBirthYear} onChange={e => setFilters({ ...filters, maxBirthYear: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-700 dark:text-white outline-none focus:border-violet-400 transition-all" />
                        </div>
                        <div className="flex items-end">
                            <button onClick={() => setFilters({ status: '', salaryType: '', dateRange: 'all', minBirthYear: '', maxBirthYear: '' })}
                                className="w-full py-2 text-[10px] font-extrabold uppercase text-rose-500 hover:text-rose-600 flex items-center justify-center gap-1.5 cursor-pointer">
                                <X size={12} /> {t('filter_clear')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Grid */}
            {filteredTeachers.length === 0 ? (
                <div className="py-24 text-center bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 border-dashed">
                    <GraduationCap size={40} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
                    <p className="text-sm font-bold text-gray-400">{t('teachers_not_found')}</p>
                    <button onClick={() => setIsModalOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#1b6b6b] text-white text-xs font-extrabold uppercase tracking-widest rounded-xl cursor-pointer">
                        <Plus size={13} /> {t('add')}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredTeachers.map(teacher => (
                        <div key={teacher.id} onClick={() => navigate(`/teachers/${teacher.id}`)}
                            className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-xl hover:border-violet-300 dark:hover:border-violet-700/50 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer p-5 flex flex-col">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-violet-400 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform overflow-hidden shrink-0">
                                    {teacher.photo
                                        ? <img src={teacher.photo} alt={teacher.name} className="w-full h-full object-cover" />
                                        : teacher.name.charAt(0).toUpperCase()
                                    }
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${teacher.status === 'Faol' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40' : 'bg-gray-50 text-gray-400 border-gray-100 dark:bg-gray-900/50 dark:border-gray-700'}`}>
                                    {teacher.status}
                                </span>
                            </div>

                            <div className="flex-1 mb-4">
                                <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-1">{teacher.name}</h3>
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-bold mt-1">
                                    <Phone size={11} /> {teacher.phone}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-gray-700/50">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${salaryColors[teacher.salaryType] || salaryColors.FIXED}`}>
                                    {salaryTypeLabels[teacher.salaryType] || 'Fiks'}
                                </span>
                                <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
                                    {teacher.salaryType === 'KPI' ? `${teacher.sharePercentage}%` : teacher.salary.toLocaleString()}
                                    {teacher.salaryType !== 'KPI' && <span className="text-[10px] text-gray-400 ml-1">UZS</span>}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('new_teacher_title')}</h3>
                                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mt-0.5">{t('teacher_details_subtitle')}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleAddTeacher} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>{t('student_name')} *</label>
                                    <input required type="text" placeholder="Asror Karimov" className={inp} value={newTeacher.name} onChange={e => setNewTeacher({ ...newTeacher, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className={lbl}>{t('student_phone')} *</label>
                                    <input required type="tel" placeholder="+998 90 123 45 67" className={inp} value={newTeacher.phone} onChange={e => setNewTeacher({ ...newTeacher, phone: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>{t('salary_type')}</label>
                                <div className="flex gap-2">
                                    {(['FIXED', 'KPI', 'FIXED_KPI'] as const).map(type => (
                                        <button key={type} type="button" onClick={() => setNewTeacher({ ...newTeacher, salaryType: type })}
                                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest border transition-all cursor-pointer ${newTeacher.salaryType === type ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white' : 'bg-gray-55 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700 text-gray-500 hover:border-[#1b6b6b]/30'}`}>
                                            {salaryTypeLabels[type]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {(newTeacher.salaryType === 'FIXED' || newTeacher.salaryType === 'FIXED_KPI') && (
                                    <div>
                                        <label className={lbl}>{t('fixed_salary')}</label>
                                        <input required type="number" placeholder="5 000 000" className={inp} value={newTeacher.salary || ''} onChange={e => setNewTeacher({ ...newTeacher, salary: Number(e.target.value) })} />
                                    </div>
                                )}
                                {(newTeacher.salaryType === 'KPI' || newTeacher.salaryType === 'FIXED_KPI') && (
                                    <div>
                                        <label className={lbl}>{t('share_percentage')}</label>
                                        <input required type="number" placeholder="40" min="0" max="100" className={inp} value={newTeacher.sharePercentage || ''} onChange={e => setNewTeacher({ ...newTeacher, sharePercentage: Number(e.target.value) })} />
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>{t('birth_date')} *</label>
                                    <input required type="date" className={inp} value={newTeacher.birthDate} onChange={e => setNewTeacher({ ...newTeacher, birthDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className={lbl}>{t('hired_date')}</label>
                                    <input required type="date" className={inp} value={newTeacher.hiredDate} onChange={e => setNewTeacher({ ...newTeacher, hiredDate: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                    {t('cancel')}
                                </button>
                                <button type="submit"
                                    className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                                    {t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
