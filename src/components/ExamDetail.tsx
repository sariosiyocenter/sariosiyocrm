import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Calendar, Clock, Calculator, CheckCircle2, AlertCircle, FileDown, Users, Printer, FileText } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import { generateQuestionPaper, generateOMRSheet, generateBulkOMRSheets } from '../lib/pdf-generator';

export default function ExamDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { exams, groups, students, generateExamVariants, questions, token, selectedSchoolId, showNotification } = useCRM();
    const confirm = useConfirm();

    const exam = exams.find(e => e.id === Number(id));
    const [isGenerating, setIsGenerating] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
    const [variantCount, setVariantCount] = useState(4);
    const [selectedGroups, setSelectedGroups] = useState<number[]>([]);

    // Load persisted group assignments on mount
    useEffect(() => {
        if (!exam || !token) return;
        fetch(`/api/exams/${exam.id}/assignments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => r.ok ? r.json() : [])
            .then((assignments: { groupId: number }[]) => {
                if (assignments.length > 0) {
                    setSelectedGroups(assignments.map(a => a.groupId));
                }
            })
            .catch(() => { /* ignore if not yet in DB */ });
    }, [exam?.id, token]);

    if (!exam) {
        return (
            <div className="flex flex-col items-center justify-center py-24 bg-sirt rounded-2xl border border-chiziq shadow-sm transition-colors">
                <AlertCircle className="w-12 h-12 text-matn-xira mb-4" />
                <p className="text-gray-455 dark:text-gray-500 font-bold text-xs">Imtihon topilmadi</p>
                <button onClick={() => navigate('/exams')} className="mt-6 text-brand font-bold text-[11px] hover:underline px-6 py-2 bg-teal-50 dark:bg-teal-900/30 rounded-xl transition-all">Orqaga qaytish</button>
            </div>
        );
    }

    const handleGenerate = async () => {
        setIsGenerating(true);
        await generateExamVariants(exam.id, variantCount);
        setIsGenerating(false);
    };

    // Show duplicate warning after variants are generated
    useEffect(() => {
        if (!exam?.variants) return;
        const dupCount = (exam.variants as any)._duplicateCount;
        if (dupCount) {
            showNotification(`Ogohlantirish: ${dupCount} ta savol bir nechta variantda takrorlandi. Savollar banki kichik.`, "info");
        }
    }, [exam?.variants]);

    const toggleGroup = async (groupId: number) => {
        const isSelected = selectedGroups.includes(groupId);
        setSelectedGroups(prev => isSelected ? prev.filter(id => id !== groupId) : [...prev, groupId]);

        if (!exam || !token || !selectedSchoolId) return;
        try {
            if (isSelected) {
                await fetch(`/api/exams/${exam.id}/assignments/${groupId}`, {
                    method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
                });
            } else {
                await fetch(`/api/exams/${exam.id}/assignments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ groupIds: [groupId], schoolId: selectedSchoolId })
                });
            }
        } catch { /* silent — local state already updated */ }
    };

    const handleBulkOMR = async () => {
        if (selectedGroups.length === 0) {
            showNotification("Iltimos, avval kurslarni tanlang!", "info");
            return;
        }

        if (!exam.variants || exam.variants.length === 0) {
            if (!await confirm("Variantlar hali yaratilmagan. OMR varaqlari variant kodisiz yaratiladi. Davom etishni xohlaysizmi?")) return;
        }

        const studentsInSelectedGroups = students.filter(s => {
            const inGroupsByStudent = s.groups && s.groups.some(gid => selectedGroups.includes(gid));
            const inGroupsByIds = selectedGroups.some(gid => {
                const group = groups.find(g => g.id === gid);
                return group && group.studentIds && group.studentIds.includes(s.id);
            });
            return inGroupsByStudent || inGroupsByIds;
        });

        if (studentsInSelectedGroups.length === 0) {
            showNotification("Tanlangan kurslarda o'quvchilar topilmadi!", "info");
            return;
        }

        setBulkProgress({ current: 0, total: studentsInSelectedGroups.length });
        try {
            await generateBulkOMRSheets(exam, studentsInSelectedGroups, (current, total) => {
                setBulkProgress({ current, total });
            });
        } catch (error) {
            showNotification("PDF generatsiya qilishda xatolik: " + (error as Error).message, "error");
        } finally {
            setBulkProgress(null);
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Bulk PDF Progress Overlay */}
            {bulkProgress && (
                <div className="fixed inset-0 z-[250] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
                    <div className="relative bg-sirt rounded-[2rem] shadow-2xl p-8 w-full max-w-xs text-center space-y-6 border border-chiziq">
                        <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-center mx-auto text-brand">
                            <Printer className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-matn">OMR Varaqalari Tayyorlanmoqda</p>
                            <p className="text-[11px] font-bold text-matn-xira mt-1">{bulkProgress.current} / {bulkProgress.total} o'quvchi</p>
                        </div>
                        <div className="w-full bg-ichki rounded-full h-2">
                            <div
                                className="bg-brand h-2 rounded-full transition-all duration-300"
                                style={{ width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%` }}
                            />
                        </div>
                        <p className="text-xl font-black text-brand tracking-tight">{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/exams')}
                        className="w-10 h-10 bg-sirt border border-chiziq rounded-xl flex items-center justify-center text-matn-sokin hover:text-brand hover:bg-gray-55 transition-all shadow-sm cursor-pointer"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-sm font-black text-matn tracking-tight">{exam.name}</h1>
                        <p className="text-[11px] font-bold text-matn-xira mt-0.5">Imtihon tafsilotlari va javob varaqalari</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button 
                        onClick={() => generateOMRSheet(exam)}
                        className="px-4 py-2.5 bg-sirt border border-chiziq rounded-xl text-[11px] font-bold text-matn-sokin hover:text-brand transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                        <FileText size={14} /> JAVOB VARAQASI (SHABLON)
                    </button>
                    <span className={`px-3 py-2 rounded-xl text-[11px] font-black border ${
                        exam.status === 'Tugallangan' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' : 
                        exam.status === 'Yaqinlashmoqda' ? 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400' :
                        'bg-gray-55 text-matn-sokin border-gray-100'
                    }`}>
                        {exam.status}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left: Info & Group Selection */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Bulk OMR Section */}
                    <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm p-4">
                        <h3 className="text-[11px] font-bold text-matn mb-4 flex items-center gap-2">
                            <Users className="text-brand" size={16} />
                            Kurslar Tanlovi
                        </h3>
                        
                        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                            {groups.length === 0 ? (
                                <p className="text-[11px] text-matn-xira font-bold py-4">Kurslar mavjud emas</p>
                            ) : (
                                groups.map(group => (
                                    <label key={group.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                                        selectedGroups.includes(group.id) 
                                        ? 'bg-teal-50 dark:bg-teal-950/20 border-teal-200' 
                                        : 'bg-ichki border-chiziq'
                                    }`}>
                                        <input 
                                            type="checkbox" 
                                            className="hidden" 
                                            checked={selectedGroups.includes(group.id)}
                                            onChange={() => toggleGroup(group.id)}
                                        />
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                            selectedGroups.includes(group.id) 
                                            ? 'bg-brand border-brand text-white' 
                                            : 'border-gray-300 dark:border-gray-605 bg-sirt'
                                        }`}>
                                            {selectedGroups.includes(group.id) && <CheckCircle2 size={10} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-bold text-matn tracking-tight truncate">{group.name}</p>
                                            <p className="text-[11px] font-bold text-matn-xira mt-0.5">{group.studentIds.length} o'quvchi</p>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>

                        <button
                            onClick={handleBulkOMR}
                            disabled={!!bulkProgress}
                            className="w-full py-3 bg-brand hover:bg-brand-dark text-white rounded-xl text-[11px] font-bold transition-all shadow-sm shadow-[#1b6b6b]/20 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            <Printer size={14} />
                            {bulkProgress ? 'TAYYORLANMOQDA...' : 'OMMAVIY CHOP ETISH'}
                        </button>
                    </div>

                    <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm p-4">
                        <h3 className="text-[11px] font-bold text-matn mb-4 flex items-center gap-2">
                            <Layers className="text-brand" size={16} />
                            Blueprint Qoidalari
                        </h3>
                        <div className="space-y-4">
                            {exam.blocks.map((block, idx) => {
                                const blockQCount = block.topicRules.reduce((acc, r) => acc + r.count, 0);
                                return (
                                    <div key={idx} className="space-y-2">
                                        <div className="flex items-center justify-between px-1">
                                            <p className="text-[11px] font-bold text-matn">{block.subject}</p>
                                            <span className="text-[10px] font-bold text-brand bg-teal-50 dark:bg-teal-950/20 px-2 py-0.5 rounded border border-teal-100 dark:border-teal-900/40">{block.pointsPerQuestion} ball/savol</span>
                                        </div>
                                        <div className="p-3 bg-ichki rounded-2xl border border-chiziq space-y-1.5">
                                            {block.topicRules.map((rule, rIdx) => (
                                                <div key={rIdx} className="flex justify-between items-center text-[11px] font-bold text-matn-xira">
                                                    <span>{rule.topic}</span>
                                                    <span className="text-matn">{rule.count} ta</span>
                                                </div>
                                            ))}
                                            <div className="pt-2 mt-2 border-t border-dashed border-chiziq flex justify-between items-center text-[11px] font-bold text-matn">
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xs font-black text-matn tracking-tight flex items-center gap-2">
                            <Layers className="text-brand" size={18} />
                            Variantlar
                        </h2>
                        
                        {!exam.variants && (
                            <div className="flex items-center gap-3">
                                <select 
                                    className="px-3 py-2 bg-sirt border border-chiziq rounded-xl text-[11px] font-bold outline-none focus:border-teal-500 text-matn cursor-pointer"
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
                                    className="px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-[11px] font-extrabold hover:bg-teal-500 transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                >
                                    {isGenerating ? 'Yaratilmoqda...' : 'Variantlarni Yaratish'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {exam.variants?.map((variant) => (
                            <div key={variant.id} className="bg-sirt rounded-2xl border border-chiziq p-5 shadow-sm transition-all flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 flex items-center justify-center text-brand font-black text-xs">
                                            {variant.variantCode}
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-matn">Variant #{variant.variantCode}</p>
                                            <p className="text-[11px] font-bold text-matn-xira mt-0.5">{variant.questions.length} ta savol</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="h-1 bg-ichki rounded-full overflow-hidden">
                                        <div className="h-full bg-brand" style={{ width: '100%' }}></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-matn-xira">
                                        <span>Tayyor</span>
                                        <span>VARIANT: {variant.variantCode}</span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => generateQuestionPaper(exam, variant, questions)}
                                    className="w-full py-3 bg-brand hover:bg-brand-dark text-white text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-[#1b6b6b]/10 cursor-pointer"
                                >
                                    <FileDown size={14} /> SAVOLLARNI YUKLASH
                                </button>
                            </div>
                        ))}
                    </div>

                    {!exam.variants && (
                        <div className="p-16 border border-dashed border-chiziq rounded-2xl flex flex-col items-center justify-center text-center text-matn-xira">
                            <Layers className="w-10 h-10 text-gray-200 dark:text-gray-700 mb-4" />
                            <h4 className="text-[11px] font-bold">Hozircha variantlar yo'q</h4>
                            <p className="text-[11px] font-bold mt-2 max-w-[250px] text-gray-400/80 leading-relaxed">Variantlarni yaratish uchun yuqoridagi tugmani bosing.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
