import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Calendar, Clock, Hash, Calculator, Plus, Eye, Download, FileText, CheckCircle2, AlertCircle, FileDown, Users, Printer } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { generateQuestionPaper, generateOMRSheet, generateBulkOMRSheets } from '../lib/pdf-generator';

export default function ExamDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { exams, groups, students, generateExamVariants, questions } = useCRM();

    const exam = exams.find(e => e.id === Number(id));
    const [isGenerating, setIsGenerating] = useState(false);
    const [isBulkGenerating, setIsBulkGenerating] = useState(false);
    const [variantCount, setVariantCount] = useState(4);
    const [selectedGroups, setSelectedGroups] = useState<number[]>([]);

    if (!exam) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center">
                <AlertCircle className="w-16 h-16 text-gray-300 mb-4" />
                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Imtihon topilmadi</h2>
                <button onClick={() => navigate('/exams')} className="mt-4 text-teal-600 font-bold uppercase tracking-widest text-[10px]">Orqaga qaytish</button>
            </div>
        );
    }

    const handleGenerate = async () => {
        setIsGenerating(true);
        await generateExamVariants(exam.id, variantCount);
        setIsGenerating(false);
    };

    const toggleGroup = (groupId: number) => {
        setSelectedGroups(prev => 
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
    };

    const handleBulkOMR = async () => {
        console.log("Bulk OMR clicked. SelectedGroups:", selectedGroups);
        if (selectedGroups.length === 0) {
            alert("Iltimos, avval guruhlarni tanlang!");
            return;
        }

        if (!exam.variants || exam.variants.length === 0) {
            if (confirm("Variantlar hali yaratilmagan. OMR varaqlari variant kodisiz yaratiladi. Davom etishni xohlaysizmi?")) {
                // Continue without variants
            } else {
                return;
            }
        }

        setIsBulkGenerating(true);
        try {
            console.log("Filtering students... Total students in state:", students.length);
            
            // Robust filtering: check both directions (Student -> Groups and Group -> StudentIds)
            const studentsInSelectedGroups = students.filter(s => {
                const isInSelectedGroup = s.groups && s.groups.some(gid => selectedGroups.includes(gid));
                const isInGroupViaStudentIds = selectedGroups.some(gid => {
                    const group = groups.find(g => g.id === gid);
                    return group && group.studentIds && group.studentIds.includes(s.id);
                });
                
                const match = isInSelectedGroup || isInGroupViaStudentIds;
                if (match) console.log(`Matched student: ${s.name} (ID: ${s.id})`);
                return match;
            });

            console.log("Students found for bulk print:", studentsInSelectedGroups.length);

            if (studentsInSelectedGroups.length === 0) {
                alert("Tanlangan guruhlarda o'quvchilar topilmadi yoki guruhlar bo'sh!");
                setIsBulkGenerating(false);
                return;
            }

            console.log("Starting PDF generation for", studentsInSelectedGroups.length, "students...");
            await generateBulkOMRSheets(exam, studentsInSelectedGroups);
            console.log("PDF generation requested.");
        } catch (error) {
            console.error("Bulk OMR Error:", error);
            alert("PDF generatsiya qilishda xatolik yuz berdi: " + (error as Error).message);
        } finally {
            setIsBulkGenerating(false);
        }
    };

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-700 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => navigate('/exams')}
                        className="w-14 h-14 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm group"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">{exam.name}</h1>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Imtihon tafsilotlari va javob varaqalari</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => generateOMRSheet(exam)}
                        className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-teal-600 transition-all shadow-sm flex items-center gap-2"
                    >
                        <FileText size={14} /> JAVOB VARAQASI (SHABLON)
                    </button>
                    <span className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                        exam.status === 'Tugallangan' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                        exam.status === 'Yaqinlashmoqda' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                        'bg-gray-50 text-gray-500 border-gray-100'
                    }`}>
                        {exam.status}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Info & Group Selection */}
                <div className="lg:col-span-1 space-y-8">
                    {/* Bulk OMR Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl p-8">
                        <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <Users className="text-teal-600 w-4 h-4" />
                            Guruhlar Tanlovi
                        </h3>
                        
                        <div className="space-y-2 mb-8 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {groups.length === 0 ? (
                                <p className="text-[10px] text-gray-400 font-bold uppercase py-4">Guruhlar mavjud emas</p>
                            ) : (
                                groups.map(group => (
                                    <label key={group.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                                        selectedGroups.includes(group.id) 
                                        ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800' 
                                        : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700'
                                    }`}>
                                        <input 
                                            type="checkbox" 
                                            className="hidden" 
                                            checked={selectedGroups.includes(group.id)}
                                            onChange={() => toggleGroup(group.id)}
                                        />
                                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                                            selectedGroups.includes(group.id) 
                                            ? 'bg-teal-600 border-teal-600 text-white' 
                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                                        }`}>
                                            {selectedGroups.includes(group.id) && <CheckCircle2 size={12} />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{group.name}</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">{group.studentIds.length} o'quvchi</p>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>

                        <button 
                            onClick={handleBulkOMR}
                            disabled={isBulkGenerating}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                        >
                            <FileText size={16} className="text-teal-400" />
                            {isBulkGenerating ? 'TAYYORLANMOQDA...' : 'OMMAVIY CHOP ETISH'}
                        </button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-teal-500/5 p-8">
                        <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <Layers className="text-teal-600 w-4 h-4" />
                            Blueprint Qoidalari
                        </h3>
                        <div className="space-y-6">
                            {exam.blocks.map((block, idx) => {
                                const blockQCount = block.topicRules.reduce((acc, r) => acc + r.count, 0);
                                return (
                                    <div key={idx} className="space-y-3">
                                        <div className="flex items-center justify-between px-2">
                                            <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{block.subject}</p>
                                            <span className="text-[9px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-lg border border-teal-100 dark:border-teal-800">{block.pointsPerQuestion} ball/savol</span>
                                        </div>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-2">
                                            {block.topicRules.map((rule, rIdx) => (
                                                <div key={rIdx} className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                                                    <span>{rule.topic}</span>
                                                    <span className="text-gray-900 dark:text-white">{rule.count} ta</span>
                                                </div>
                                            ))}
                                            <div className="pt-2 mt-2 border-t border-dashed border-gray-200 dark:border-gray-700 flex justify-between items-center text-[11px] font-black text-gray-900 dark:text-white uppercase">
                                                <span>Jami {block.subject}</span>
                                                <span>{blockQCount} ta</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right: Variants */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                            <FileText className="text-teal-600" />
                            Variantlar
                        </h2>
                        
                        {!exam.variants && (
                            <div className="flex items-center gap-3">
                                <select 
                                    className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500"
                                    value={variantCount}
                                    onChange={e => setVariantCount(Number(e.target.value))}
                                >
                                    <option value={2}>2 ta variant</option>
                                    <option value={4}>4 ta variant</option>
                                    <option value={8}>8 ta variant</option>
                                </select>
                                <button 
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="px-6 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-teal-500 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isGenerating ? 'Yaratilmoqda...' : 'Variantlarni Yaratish'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {exam.variants?.map((variant) => (
                            <div key={variant.id} className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 p-6 shadow-sm hover:border-teal-200 dark:hover:border-teal-800 transition-all group">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center text-teal-600 font-black text-xs">
                                            {variant.variantCode}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">Variant #{variant.variantCode}</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{variant.questions.length} ta savol</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="h-1 bg-gray-50 dark:bg-gray-900 rounded-full overflow-hidden">
                                        <div className="h-full bg-teal-500" style={{ width: '100%' }}></div>
                                    </div>
                                    <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                        <span>Tayyor</span>
                                        <span>VARIANT: {variant.variantCode}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => generateQuestionPaper(exam, variant, questions)}
                                        className="w-full py-4 bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-teal-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/10"
                                    >
                                        <FileDown size={16} /> SAVOLLARNI YUKLASH
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {!exam.variants && (
                        <div className="p-20 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-[2.5rem] flex flex-col items-center justify-center text-center text-gray-400">
                            <FileText className="w-16 h-16 text-gray-200 mb-6" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest">Hozircha variantlar yo'q</h4>
                            <p className="text-[9px] font-bold mt-2 max-w-[300px] uppercase">Variantlarni yaratish uchun yuqoridagi tugmani bosing.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
