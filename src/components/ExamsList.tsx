import React, { useState } from 'react';
import { Search, Plus, X, Calendar, Clock, BookOpen, ScanLine, FileText } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import QuestionsList from './QuestionsList';
import Scanner from './Scanner';

export default function ExamsList() {
    const { exams, deleteExam } = useCRM();
    const { t } = useLang();
    const navigate = useNavigate();
    
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'exams' | 'questions' | 'scanner'>('exams');

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Imtihonni o'chirishni xohlaysizmi?")) {
            await deleteExam(id);
        }
    };

    const filteredExams = exams.filter(e => 
        (e.name || '').toLowerCase().includes(search.toLowerCase())
    );

    if (activeTab === 'questions') {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Tabs Header */}
                <div className="flex border-b border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800 rounded-2xl overflow-hidden p-1 shadow-sm gap-1">
                    <button
                        onClick={() => setActiveTab('exams')}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                    >
                        <FileText size={14} />
                        Imtihonlar
                    </button>
                    <button
                        onClick={() => setActiveTab('questions')}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all bg-teal-50 dark:bg-teal-950/20 text-[#1b6b6b] cursor-pointer"
                    >
                        <BookOpen size={14} />
                        Savollar Banki
                    </button>
                    <button
                        onClick={() => setActiveTab('scanner')}
                        className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                    >
                        <ScanLine size={14} />
                        OMR Skaner
                    </button>
                </div>
                <QuestionsList />
            </div>
        );
    }

    if (activeTab === 'scanner') {
        return <Scanner onClose={() => setActiveTab('exams')} />;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Tabs Header */}
            <div className="flex border-b border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800 rounded-2xl overflow-hidden p-1 shadow-sm gap-1">
                <button
                    onClick={() => setActiveTab('exams')}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all bg-teal-50 dark:bg-teal-950/20 text-[#1b6b6b] cursor-pointer"
                >
                    <FileText size={14} />
                    Imtihonlar
                </button>
                <button
                    onClick={() => setActiveTab('questions')}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                >
                    <BookOpen size={14} />
                    Savollar Banki
                </button>
                <button
                    onClick={() => setActiveTab('scanner')}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                >
                    <ScanLine size={14} />
                    OMR Skaner
                </button>
            </div>

            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 flex items-center justify-center text-[#1b6b6b]">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('exams_title')}</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Jami imtihonlar ro'yxati</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Qidirish..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-gray-55 dark:bg-gray-905 border border-gray-100 dark:border-gray-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>
                        <button
                            onClick={() => navigate('/exams/new')}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-2xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all cursor-pointer"
                        >
                            <Plus size={14} />
                            Yangi Imtihon
                        </button>
                    </div>
                </div>
            </div>

            {/* Data Grid / Table */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-55 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700/50">
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest w-20 text-center">ID</th>
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Imtihon Nomi & Fanlar</th>
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Sana & Vaqt</th>
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Savollar</th>
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Holati</th>
                                <th className="p-4 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {filteredExams.map((exam) => (
                                <tr key={exam.id} className="hover:bg-gray-50/30 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/exams/${exam.id}`)}
                                >
                                    <td className="p-4 text-[10px] font-bold text-gray-400 text-center tabular-nums">#{exam.id.toString().substring(0,4)}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 flex items-center justify-center text-[#1b6b6b] shrink-0">
                                                <BookOpen size={16} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-gray-900 dark:text-white group-hover:text-[#1b6b6b] transition-colors uppercase tracking-tight">{exam.name}</p>
                                                <p className="text-[9px] font-bold text-gray-400 mt-0.5">{exam.blocks?.length || 0} ta fan</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] font-bold text-gray-650 dark:text-gray-300 bg-gray-55 dark:bg-gray-900 px-2.5 py-1 rounded-md border border-gray-100 dark:border-gray-700 inline-flex items-center gap-1.5 uppercase tracking-wide">
                                                <Calendar size={12} className="text-gray-400" /> {exam.date}
                                            </span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                                {exam.duration} daqiqa
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/20 text-[#1b6b6b] border border-teal-100 dark:border-teal-900/40 text-[9px] font-black uppercase tracking-wider">
                                                {exam.totalQuestions || 0} ta
                                            </span>
                                            <span className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">{exam.maxScore || 0} ball</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className={`px-2.5 py-1 rounded-md text-[9px] font-black border uppercase tracking-wider ${
                                            exam.status === 'Tugallangan' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' : 
                                            exam.status === 'Yaqinlashmoqda' ? 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400' :
                                            'bg-gray-55 text-gray-400 border-gray-100'
                                        }`}>
                                            {exam.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button 
                                            onClick={(e) => handleDelete(exam.id, e)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-rose-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                        >
                                            <X size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredExams.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-16 text-center">
                                        <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
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
