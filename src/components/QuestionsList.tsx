import React, { useState, useMemo } from 'react';
import { Search, Plus, Filter, FileUp, Download, Eye, Edit, Trash2, X, AlertCircle } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

export default function QuestionsList() {
    const { questions, deleteQuestion, addQuestion } = useCRM();
    const navigate = useNavigate();
    
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        subject: '',
        topic: '',
        difficulty: '' as string | number
    });

    const [isImporting, setIsImporting] = useState(false);

    // Get unique subjects and topics for filters
    const subjects = useMemo(() => Array.from(new Set(questions.map(q => q.subject).filter(Boolean))), [questions]);
    const topics = useMemo(() => {
        if (!filters.subject) return Array.from(new Set(questions.map(q => q.topic).filter(Boolean)));
        return Array.from(new Set(questions.filter(q => q.subject === filters.subject).map(q => q.topic).filter(Boolean)));
    }, [questions, filters.subject]);

    const filteredQuestions = questions.filter(q => {
        const matchesSearch = q.text.toLowerCase().includes(search.toLowerCase()) || 
                             q.subject.toLowerCase().includes(search.toLowerCase()) ||
                             q.topic.toLowerCase().includes(search.toLowerCase());
        const matchesSubject = !filters.subject || q.subject === filters.subject;
        const matchesTopic = !filters.topic || q.topic === filters.topic;
        const matchesDifficulty = !filters.difficulty || q.difficulty === Number(filters.difficulty);
        
        return matchesSearch && matchesSubject && matchesTopic && matchesDifficulty;
    });

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Expected columns: question, optionA, optionB, optionC, optionD, correctAnswer, difficulty, subject, topic
                data.forEach((row: any) => {
                    addQuestion({
                        text: row.question || row.text || '',
                        optionA: String(row.optionA || ''),
                        optionB: String(row.optionB || ''),
                        optionC: String(row.optionC || ''),
                        optionD: String(row.optionD || ''),
                        correctAnswer: (row.correctAnswer || 'A') as any,
                        difficulty: Number(row.difficulty || 1),
                        subject: row.subject || '',
                        topic: row.topic || ''
                    });
                });
                alert(`${data.length} ta savol muvaffaqiyatli import qilindi!`);
            } catch (err) {
                console.error("Import failed", err);
                alert("Import paytida xatolik yuz berdi. Iltimos Excel formatini tekshiring.");
            } finally {
                setIsImporting(false);
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const stripHtml = (html: string) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    };

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Savollar Banki</h1>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Imtihon savollarini professional boshqarish</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <label className="cursor-pointer px-6 py-3.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center gap-2">
                        <FileUp size={16} />
                        {isImporting ? 'Yuklanmoqda...' : 'Excel Import'}
                        <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} disabled={isImporting} />
                    </label>
                    <button 
                        onClick={() => navigate('/questions/new')}
                        className="px-8 py-3.5 bg-teal-600 dark:bg-teal-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-500 shadow-xl shadow-teal-500/20 flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Savol Qo'shish
                    </button>
                </div>
            </div>

            {/* Header Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-teal-500/5 overflow-hidden transition-all">
                <div className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="relative group w-full lg:w-[400px]">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Savol matni yoki fan bo'yicha qidiruv..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-12 pr-6 py-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none focus:bg-white dark:focus:bg-gray-800 focus:border-teal-500 transition-all placeholder:text-gray-400/60 text-gray-900 dark:text-white"
                            />
                        </div>
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-4 rounded-2xl border transition-all ${
                                showFilters ? 'bg-teal-50 border-teal-100 text-teal-600' : 'bg-gray-50 border-gray-100 text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            <Filter size={20} />
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="px-8 pb-8 pt-2 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Fan</label>
                            <select 
                                value={filters.subject}
                                onChange={e => setFilters({...filters, subject: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500 transition-all dark:text-white"
                            >
                                <option value="">Barcha fanlar</option>
                                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Mavzu</label>
                            <select 
                                value={filters.topic}
                                onChange={e => setFilters({...filters, topic: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500 transition-all dark:text-white"
                            >
                                <option value="">Barcha mavzular</option>
                                {topics.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Qiyinlik Darajasi</label>
                            <select 
                                value={filters.difficulty}
                                onChange={e => setFilters({...filters, difficulty: e.target.value})}
                                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500 transition-all dark:text-white"
                            >
                                <option value="">Barcha darajalar</option>
                                <option value="1">Oson</option>
                                <option value="2">O'rta</option>
                                <option value="3">Qiyin</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Questions Table */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-teal-500/5 overflow-hidden transition-all">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest w-20 text-center">ID</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Savol Matni</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fan & Mavzu</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Daraja</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">To'g'ri</th>
                                <th className="p-6 w-24 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {filteredQuestions.map((q, idx) => (
                                <tr key={q.id} className="hover:bg-gray-50/80 dark:hover:bg-teal-900/5 transition-all cursor-pointer group" onClick={() => navigate(`/questions/${q.id}/edit`)}>
                                    <td className="p-6 text-[10px] font-extrabold text-gray-400 text-center tabular-nums">#{q.id.toString().substring(0,4)}</td>
                                    <td className="p-6">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 max-w-[400px]">
                                            {stripHtml(q.text)}
                                        </p>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest">{q.subject}</span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{q.topic || 'Mavzusiz'}</span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                                            q.difficulty === 1 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            q.difficulty === 2 ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                            'bg-rose-50 text-rose-600 border-rose-100'
                                        }`}>
                                            {q.difficulty === 1 ? 'OSON' : q.difficulty === 2 ? 'O\'RTA' : 'QIYIN'}
                                        </span>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600 font-black text-xs border border-teal-100">
                                            {q.correctAnswer}
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 text-gray-400 hover:text-teal-600 transition-colors">
                                                <Edit size={18} />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if(window.confirm('O\'chirilsinmi?')) deleteQuestion(q.id);
                                                }}
                                                className="p-2 text-gray-400 hover:text-rose-600 transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredQuestions.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-24 text-center">
                                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900/50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-gray-100 dark:border-gray-800">
                                            <AlertCircle className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hozircha savollar topilmadi</p>
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
