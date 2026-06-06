import React, { useState, useMemo } from 'react';
import { Search, Plus, Filter, FileUp, Trash2, X, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const COL_MAP: Record<string, string> = {
    question: 'text', savol: 'text', text: 'text',
    optiona: 'optionA', a: 'optionA',
    optionb: 'optionB', b: 'optionB',
    optionc: 'optionC', c: 'optionC',
    optiond: 'optionD', d: 'optionD',
    correctanswer: 'correctAnswer', togri: 'correctAnswer', answer: 'correctAnswer', javob: 'correctAnswer',
    subject: 'subject', fan: 'subject',
    topic: 'topic', mavzu: 'topic',
    difficulty: 'difficulty', qiyinlik: 'difficulty', daraja: 'difficulty',
};

interface ImportRow {
    text: string; optionA: string; optionB: string; optionC: string; optionD: string;
    correctAnswer: string; difficulty: number; subject: string; topic: string;
}
interface ImportError { row: number; field: string; message: string; }

function normalizeRow(raw: any): { data: ImportRow | null; errors: ImportError[]; rowNum: number } {
    const mapped: any = {};
    for (const key of Object.keys(raw)) {
        const norm = key.toLowerCase().replace(/\s+/g, '');
        const canonical = COL_MAP[norm];
        if (canonical) mapped[canonical] = raw[key];
    }

    const errors: ImportError[] = [];
    const rowNum = 0;
    if (!mapped.text) errors.push({ row: rowNum, field: 'text', message: 'Savol matni bo\'sh' });
    if (!mapped.optionA) errors.push({ row: rowNum, field: 'optionA', message: 'A varianti bo\'sh' });
    if (!mapped.optionB) errors.push({ row: rowNum, field: 'optionB', message: 'B varianti bo\'sh' });
    if (!mapped.optionC) errors.push({ row: rowNum, field: 'optionC', message: 'C varianti bo\'sh' });
    if (!mapped.optionD) errors.push({ row: rowNum, field: 'optionD', message: 'D varianti bo\'sh' });
    if (!mapped.correctAnswer) errors.push({ row: rowNum, field: 'correctAnswer', message: 'To\'g\'ri javob ko\'rsatilmagan' });
    else if (!['A', 'B', 'C', 'D'].includes(String(mapped.correctAnswer).toUpperCase())) {
        errors.push({ row: rowNum, field: 'correctAnswer', message: `To\'g\'ri javob A/B/C/D bo\'lishi kerak (${mapped.correctAnswer} berilgan)` });
    }
    if (!mapped.subject) errors.push({ row: rowNum, field: 'subject', message: 'Fan nomi bo\'sh' });

    if (errors.length > 0) return { data: null, errors, rowNum };

    return {
        data: {
            text: String(mapped.text),
            optionA: String(mapped.optionA),
            optionB: String(mapped.optionB),
            optionC: String(mapped.optionC),
            optionD: String(mapped.optionD),
            correctAnswer: String(mapped.correctAnswer).toUpperCase() as any,
            difficulty: Number(mapped.difficulty) || 1,
            subject: String(mapped.subject),
            topic: String(mapped.topic || ''),
        },
        errors: [],
        rowNum,
    };
}

export default function QuestionsList() {
    const { questions, deleteQuestion, showNotification, token, selectedSchoolId } = useCRM();
    const navigate = useNavigate();

    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        subject: '',
        topic: '',
        difficulty: '' as string | number
    });

    const [isImporting, setIsImporting] = useState(false);
    const [importPreview, setImportPreview] = useState<{
        valid: ImportRow[];
        errors: (ImportError & { row: number })[];
        total: number;
    } | null>(null);

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

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawData: any[] = XLSX.utils.sheet_to_json(ws);

                const valid: ImportRow[] = [];
                const errors: (ImportError & { row: number })[] = [];

                rawData.forEach((row, idx) => {
                    const result = normalizeRow(row);
                    if (result.data) {
                        valid.push(result.data);
                    } else {
                        result.errors.forEach(err => errors.push({ ...err, row: idx + 2 }));
                    }
                });

                setImportPreview({ valid, errors, total: rawData.length });
            } catch (err) {
                console.error("Import failed", err);
                showNotification("Excel faylni o'qishda xatolik. Fayl formatini tekshiring.", "error");
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const confirmImport = async () => {
        if (!importPreview || importPreview.valid.length === 0) return;
        setIsImporting(true);
        try {
            const res = await fetch('/api/questions/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ questions: importPreview.valid, schoolId: selectedSchoolId })
            });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            showNotification(`${result.count} ta savol muvaffaqiyatli import qilindi!`, "success");
            setImportPreview(null);
            window.location.reload();
        } catch (err: any) {
            showNotification("Import xatoligi: " + err.message, "error");
        } finally {
            setIsImporting(false);
        }
    };

    const stripHtml = (html: string) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Import Preview Modal */}
            {importPreview && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-905/65 backdrop-blur-sm" />
                    <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4 border border-gray-100 dark:border-gray-700/50">
                        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-700/50 pb-3">
                            <div>
                                <h2 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">Excel Import Tekshiruvi</h2>
                                <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Jami {importPreview.total} ta qator</p>
                            </div>
                            <button onClick={() => setImportPreview(null)} className="p-1 text-gray-400 hover:text-gray-650 rounded-lg cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex gap-3">
                            <div className="flex-1 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                                <div>
                                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{importPreview.valid.length}</p>
                                    <p className="text-[8px] text-emerald-500 uppercase tracking-widest font-black">To'g'ri</p>
                                </div>
                            </div>
                            <div className="flex-1 bg-rose-50 dark:bg-rose-955/20 rounded-xl p-3 border border-rose-100 dark:border-rose-900/40 flex items-center gap-2">
                                <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                                <div>
                                    <p className="text-sm font-black text-rose-600 dark:text-rose-400">{importPreview.errors.length}</p>
                                    <p className="text-[8px] text-rose-500 uppercase tracking-widest font-black">Xatolik</p>
                                </div>
                            </div>
                        </div>

                        {importPreview.errors.length > 0 && (
                            <div className="bg-rose-50 dark:bg-rose-950/10 rounded-2xl p-3 max-h-32 overflow-y-auto border border-rose-100 dark:border-rose-900/20 space-y-1">
                                {importPreview.errors.map((err, i) => (
                                    <p key={i} className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase">
                                        <span>Qator {err.row}:</span> {err.message}
                                    </p>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2 pt-3 border-t border-dashed border-gray-100 dark:border-gray-700/50">
                            <button
                                onClick={() => setImportPreview(null)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-55 cursor-pointer transition-all"
                            >
                                Bekor
                            </button>
                            <button
                                onClick={confirmImport}
                                disabled={isImporting || importPreview.valid.length === 0}
                                className="flex-1 py-2.5 rounded-xl bg-[#1b6b6b] hover:bg-[#155252] text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                {isImporting ? 'Yuklanmoqda...' : `Import (${importPreview.valid.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header / Filter Toolbar */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Savollarni qidirish..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-55 dark:bg-gray-905 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                            />
                        </div>
                        <button 
                            onClick={() => setShowFilters(!showFilters)}
                            className={`w-10 h-10 flex items-center justify-center rounded-2xl border transition-colors cursor-pointer ${
                                showFilters ? 'bg-teal-50 border-teal-200 text-[#1b6b6b] dark:bg-teal-950/20' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 hover:text-gray-650'
                            }`}
                        >
                            <Filter size={16} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="cursor-pointer px-4 py-2.5 bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-405 border border-amber-100 dark:border-amber-900/40 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 transition-colors flex items-center gap-1.5">
                            <FileUp size={14} />
                            {isImporting ? 'Kutilmoqda...' : 'Excel Import'}
                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} disabled={isImporting} />
                        </label>
                        <button 
                            onClick={() => navigate('/questions/new')}
                            className="px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#1b6b6b]/20"
                        >
                            <Plus size={14} />
                            Savol Qo'shish
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="mt-4 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-dashed border-gray-105 dark:border-gray-700/50 animate-in slide-in-from-top duration-300">
                        <div>
                            <label className="text-[9px] font-black text-gray-400 block mb-1.5 uppercase tracking-widest">Fan</label>
                            <select 
                                value={filters.subject}
                                onChange={e => setFilters({...filters, subject: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-white outline-none focus:border-teal-500 cursor-pointer"
                            >
                                <option value="">Barcha fanlar</option>
                                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-gray-400 block mb-1.5 uppercase tracking-widest">Mavzu</label>
                            <select 
                                value={filters.topic}
                                onChange={e => setFilters({...filters, topic: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-white outline-none focus:border-teal-500 cursor-pointer"
                            >
                                <option value="">Barcha mavzular</option>
                                {topics.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-gray-400 block mb-1.5 uppercase tracking-widest">Qiyinlik Darajasi</label>
                            <select 
                                value={filters.difficulty}
                                onChange={e => setFilters({...filters, difficulty: e.target.value})}
                                className="w-full px-3 py-2 bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-white outline-none focus:border-teal-500 cursor-pointer"
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
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-55 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700/50">
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest w-20 text-center">ID</th>
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Savol Matni</th>
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Fan & Mavzu</th>
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Daraja</th>
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">To'g'ri</th>
                                <th className="p-4 w-20 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {filteredQuestions.map((q) => (
                                <tr key={q.id} className="hover:bg-gray-50/50 dark:hover:bg-teal-950/20 transition-all cursor-pointer group" onClick={() => navigate(`/questions/${q.id}/edit`)}>
                                    <td className="p-4 text-[10px] font-bold text-gray-400 text-center tabular-nums">#{q.id.toString().substring(0,4)}</td>
                                    <td className="p-4">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white line-clamp-1 max-w-[400px]">
                                            {stripHtml(q.text)}
                                        </p>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-black text-[#1b6b6b] uppercase tracking-wide">{q.subject}</span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{q.topic || 'Mavzusiz'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2.5 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider ${
                                            q.difficulty === 1 ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/20' :
                                            q.difficulty === 2 ? 'bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/20' :
                                            'bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-455 border-rose-100 dark:border-rose-900/20'
                                        }`}>
                                            {q.difficulty === 1 ? 'Oson' : q.difficulty === 2 ? 'O\'rta' : 'Qiyin'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/20 text-[#1b6b6b] font-black text-xs border border-teal-100 dark:border-teal-900/40">
                                            {q.correctAnswer}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if(window.confirm('O\'chirishni xohlaysizmi?')) deleteQuestion(q.id);
                                                }}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredQuestions.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-16 text-center">
                                        <AlertCircle className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hozircha savollar topilmadi</p>
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
