import React, { useState } from 'react';
import { Search, Plus, X, Calendar, Clock, BookOpen } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';

export default function ExamsList() {
    const { exams, deleteExam } = useCRM();
    const navigate = useNavigate();
    
    const [search, setSearch] = useState('');

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Imtihonni uchirmoqchimisiz?")) {
            await deleteExam(id);
        }
    };

    const filteredExams = exams.filter(e => 
        (e.name || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Imtihonlar</h1>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Markazdagi jami imtihonlar ro'yxati</p>
                </div>
            </div>

            {/* Header Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-teal-500/5 overflow-hidden transition-all">
                <div className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <button 
                            onClick={() => navigate('/exams/new')} 
                            className="px-10 py-4 bg-teal-600 dark:bg-teal-500 text-white rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest hover:bg-teal-500 active:scale-[0.98] transition-all shadow-xl shadow-teal-500/20 flex items-center gap-3 group"
                        >
                            <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                            Yangi Imtihon (Blueprint)
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <div className="relative group w-full lg:w-[450px]">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Nomi bo'yicha qidirish..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest outline-none focus:bg-white dark:focus:bg-gray-800 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all placeholder:text-gray-400/60 dark:text-white text-gray-900 shadow-inner"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Grid / Table */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-teal-500/5 overflow-hidden transition-all">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center w-20">ID</th>
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Imtihon Nomi & Fanlar</th>
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">Sana & Vaqt</th>
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">Savollar</th>
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Holati</th>
                                <th className="p-6 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {filteredExams.map((exam, idx) => (
                                <tr key={exam.id} className="hover:bg-gray-50/80 dark:hover:bg-teal-900/5 transition-all cursor-pointer group animate-in slide-in-from-left-2 duration-300"
                                    style={{ animationDelay: `${idx * 30}ms` }}
                                    onClick={() => navigate(`/exams/${exam.id}`)}
                                >
                                    <td className="p-6 text-[10px] font-extrabold text-gray-400 dark:text-gray-600 text-center tabular-nums">#{exam.id.toString().substring(0,4)}</td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800/50 flex items-center justify-center text-teal-600 font-bold text-sm shadow-inner group-hover:scale-110 transition-transform">
                                                <BookOpen size={20} />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-teal-600 transition-colors">{exam.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">To'plam:</span>
                                                    <span className="text-[10px] font-extrabold text-gray-500 dark:text-gray-400 tracking-tight">
                                                        {exam.blocks?.length || 0} ta fan
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-100 flex items-center gap-2">
                                                <Calendar size={12} className="text-gray-400" /> {exam.date}
                                            </span>
                                            <span className="text-[9px] font-bold text-gray-500 flex items-center gap-1">
                                                <Clock size={10} /> {exam.duration} daqiqa
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 border border-teal-100 dark:border-teal-800 text-[11px] font-black">
                                                {exam.totalQuestions || 0}
                                            </div>
                                            <span className="text-[8px] font-bold text-amber-600 uppercase tracking-widest">{exam.maxScore || 0} BALL</span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-right">
                                        <div className="flex flex-col items-end gap-2 text-right">
                                            <span className={`px-3 py-1.5 rounded-xl text-[9px] font-extrabold border uppercase tracking-widest shadow-sm ${
                                                exam.status === 'Tugallangan' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                                exam.status === 'Yaqinlashmoqda' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                                                'bg-gray-50 text-gray-500 border-gray-100'
                                            }`}>
                                                {exam.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <button 
                                            onClick={(e) => handleDelete(exam.id, e)}
                                            className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-300 hover:text-white hover:bg-rose-500 transition-all border border-transparent"
                                        >
                                            <X size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredExams.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-24 text-center">
                                        <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                            <BookOpen className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hech qanday imtihon topilmadi</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
