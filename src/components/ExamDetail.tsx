import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Calendar, Clock, Hash, Calculator, Plus, Eye, Download, FileText, CheckCircle2, AlertCircle, FileDown, Users, Printer } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { generateQuestionPaper, generateOMRSheet, generateBulkOMRSheets } from '../lib/pdf-generator';

export default function ExamDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { exams, groups, students, generateExamVariants, questions, token, selectedSchoolId, showNotification } = useCRM();

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
            <div className="flex flex-col items-center justify-center p-20 text-center">
                <AlertCircle className="w-16 h-16 text-gray-300 mb-4" />
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Imtihon topilmadi</h2>
                <button onClick={() => navigate('/exams')} className="mt-4 text-teal-600 font-bold uppercase tracking-widest text-[10px]">Orqaga qaytish</button>
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
            showNotification("Iltimos, avval guruhlarni tanlang!", "info");
            return;
        }

        if (!exam.variants || exam.variants.length === 0) {
            if (!confirm("Variantlar hali yaratilmagan. OMR varaqlari variant kodisiz yaratiladi. Davom etishni xohlaysizmi?")) return;
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
            showNotification("Tanlangan guruhlarda o'quvchilar topilmadi!", "info");
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
        <div className="space-y-8 pb-20 animate-in fade-in duration-700 max-w-7xl mx-auto">

            {/* Bulk PDF Progress Overlay */}
            {bulkProgress && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1a2332] rounded-3xl shadow-2xl p-10 w-full max-w-sm text-center space-y-6">
                        <div className="w-16 h-16 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto">
                            <Printer className="w-8 h-8 text-teal-600 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-white uppercase tracking-widest">OMR Varaqalari Tayyorlanmoqda</p>
                            <p className="text-[10px] text-gray-400 mt-1">{bulkProgress.current} / {bulkProgress.total} o'quvchi</p>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-3">
                            <div
                                className="bg-teal-500 h-3 rounded-full transition-all duration-300"
                                style={{ width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%` }}
                            />
                        </div>
                        <p className="text-2xl font-black text-teal-600">{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => navigate('/exams')}
                        className="w-14 h-14 bg-[#141c27] border border-white/5 rounded-2xl flex items-center justify-center text-[#4a5568] hover:text-white hover:bg-white/5 transition-all shadow-sm group"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-extrabold text-white uppercase tracking-tight">{exam.name}</h1>
                        <p className="text-[10px] font-bold text-[#4a5568] mt-2 uppercase tracking-widest">Imtihon tafsilotlari va javob varaqalari</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => generateOMRSheet(exam)}
                        className="px-6 py-3 bg-[#141c27] border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#4a5568] hover:text-teal-500 transition-all shadow-sm flex items-center gap-2"
                    >
                        <FileText size={14} /> JAVOB VARAQASI (SHABLON)
                    </button>
                    <span className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                        exam.status === 'Tugallangan' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        exam.status === 'Yaqinlashmoqda' ? 'bg-sky-500/10 text-sky-500 border-sky-500/20' :
                        'bg-white/5 text-[#4a5568] border-white/5'
                    }`}>
                        {exam.status}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Info & Group Selection */}
                <div className="lg:col-span-1 space-y-8">
                    {/* Bulk OMR Section */}
                    <div className="bg-[#141c27] rounded-[2.5rem] border border-white/5 shadow-xl p-8">
                        <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
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
                                        ? 'bg-teal-500/10 border-teal-500/30'
                                        : 'bg-white/5 border-white/5'
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
                                            : 'border-white/20 bg-white/5'
                                        }`}>
                                            {selectedGroups.includes(group.id) && <CheckCircle2 size={12} />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-white uppercase tracking-widest">{group.name}</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">{group.studentIds.length} o'quvchi</p>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>

                        <button
                            onClick={handleBulkOMR}
                            disabled={!!bulkProgress}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                        >
                            <FileText size={16} className="text-teal-400" />
                            {bulkProgress ? 'TAYYORLANMOQDA...' : 'OMMAVIY CHOP ETISH'}
                        </button>
                    </div>

                    <div className="bg-[#141c27] rounded-[2.5rem] border border-white/5 shadow-xl shadow-teal-500/5 p-8">
                        <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <Layers className="text-teal-600 w-4 h-4" />
                            Blueprint Qoidalari
                        </h3>
                        <div className="space-y-6">
                            {exam.blocks.map((block, idx) => {
                                const blockQCount = block.topicRules.reduce((acc, r) => acc + r.count, 0);
                                return (
                                    <div key={idx} className="space-y-3">
                                        <div className="flex items-center justify-between px-2">
                                            <p className="text-[10px] font-black text-white uppercase tracking-widest">{block.subject}</p>
                                            <span className="text-[9px] font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-lg border border-teal-500/20">{block.pointsPerQuestion} ball/savol</span>
                                        </div>
                                        <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 space-y-2">
                                            {block.topicRules.map((rule, rIdx) => (
                                                <div key={rIdx} className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                                                    <span>{rule.topic}</span>
                                                    <span className="text-white">{rule.count} ta</span>
                                                </div>
                                            ))}
                                            <div className="pt-2 mt-2 border-t border-dashed border-white/5 flex justify-between items-center text-[11px] font-black text-white uppercase">
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
                        <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <FileText className="text-teal-600" />
                            Variantlar
                        </h2>
                        
                        {!exam.variants && (
                            <div className="flex items-center gap-3">
                                <select 
                                    className="px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-teal-500"
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
                                    className="px-6 py-3 bg-teal-600 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-teal-500 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isGenerating ? 'Yaratilmoqda...' : 'Variantlarni Yaratish'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {exam.variants?.map((variant) => (
                            <div key={variant.id} className="bg-[#141c27] rounded-[2rem] border border-white/5 p-6 shadow-sm hover:border-teal-500/30 transition-all group">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center text-teal-400 font-black text-xs">
                                            {variant.variantCode}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-white uppercase tracking-widest">Variant #{variant.variantCode}</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{variant.questions.length} ta savol</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
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
                        <div className="p-20 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-center text-[#4a5568]">
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
