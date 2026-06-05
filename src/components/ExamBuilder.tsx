import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Calculator, Layers, BookOpen, Clock, Calendar, Hash, Tag, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { ExamBlock, TopicRule } from '../types';

export default function ExamBuilder() {
    const navigate = useNavigate();
    const { addExam, questions, showNotification } = useCRM();

    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, boolean>>({});
    
    // Base info
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [duration, setDuration] = useState<number | ''>(180);
    const [status, setStatus] = useState<'Yaqinlashmoqda' | 'Tugallangan' | 'Qoralama'>('Yaqinlashmoqda');

    // Blocks
    const [blocks, setBlocks] = useState<ExamBlock[]>([
        { 
            id: '1', 
            subject: 'Matematika', 
            topicRules: [{ topic: 'Trigonometriya', count: 10 }], 
            pointsPerQuestion: 3.1 
        }
    ]);

    // Metadata from Questions Bank
    const availableMetadata = useMemo(() => {
        const meta: Record<string, string[]> = {};
        questions.forEach(q => {
            if (!meta[q.subject]) meta[q.subject] = [];
            if (!meta[q.subject].includes(q.topic)) meta[q.subject].push(q.topic);
        });
        return meta;
    }, [questions]);

    const getAvailableCount = (subject: string, topic: string) => {
        return questions.filter(q => 
            q.subject.toLowerCase() === subject.toLowerCase() && 
            q.topic.toLowerCase() === topic.toLowerCase()
        ).length;
    };

    // Computed totals
    const totalQuestions = useMemo(() => {
        return blocks.reduce((acc, b) => acc + b.topicRules.reduce((tAcc, r) => tAcc + (r.count || 0), 0), 0);
    }, [blocks]);

    const maxScore = useMemo(() => {
        return blocks.reduce((acc, b) => {
            const blockQCount = b.topicRules.reduce((tAcc, r) => tAcc + (r.count || 0), 0);
            return acc + (blockQCount * (b.pointsPerQuestion || 0));
        }, 0);
    }, [blocks]);

    const handleAddBlock = () => {
        setBlocks([
            ...blocks,
            { id: Date.now().toString(), subject: '', topicRules: [], pointsPerQuestion: 0 }
        ]);
    };

    const handleUpdateBlock = (id: string, updates: Partial<ExamBlock>) => {
        setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
    };

    const handleAddRule = (blockId: string) => {
        setBlocks(blocks.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    topicRules: [...b.topicRules, { topic: '', count: 0 }]
                };
            }
            return b;
        }));
    };

    const handleUpdateRule = (blockId: string, ruleIndex: number, field: keyof TopicRule, value: any) => {
        setBlocks(blocks.map(b => {
            if (b.id === blockId) {
                const newRules = [...b.topicRules];
                newRules[ruleIndex] = { ...newRules[ruleIndex], [field]: value };
                return { ...b, topicRules: newRules };
            }
            return b;
        }));
    };

    const handleRemoveRule = (blockId: string, ruleIndex: number) => {
        setBlocks(blocks.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    topicRules: b.topicRules.filter((_, i) => i !== ruleIndex)
                };
            }
            return b;
        }));
    };

    const handleRemoveBlock = (id: string) => {
        setBlocks(blocks.filter(b => b.id !== id));
    };

    const handleSave = async () => {
        // Validate
        const newErrors: Record<string, boolean> = {};
        if (!name) newErrors.name = true;
        if (!date) newErrors.date = true;
        if (!duration) newErrors.duration = true;
        if (blocks.length === 0) newErrors.blocks = true;
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showNotification("Iltimos, barcha majburiy maydonlarni to'ldiring", "error");
            return;
        }
        setErrors({});

        try {
            setIsSaving(true);
            await addExam({
                name,
                date,
                duration: Number(duration),
                status,
                blocks,
                totalQuestions,
                maxScore: parseFloat(maxScore.toFixed(1))
            });
            navigate('/exams');
        } catch (err) {
            console.error("Failed to save exam", err);
            showNotification("Imtihonni saqlashda xatolik yuz berdi", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-700 max-w-7xl mx-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => navigate('/exams')}
                        className="w-14 h-14 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm group"
                    >
                        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Exam Rule Builder</h1>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Imtihon savollarini mavzular bo'yicha saralash va tartiblash</p>
                    </div>
                </div>
                
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-10 py-4 bg-teal-600 dark:bg-teal-500 text-white rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest hover:bg-teal-500 active:scale-[0.98] transition-all shadow-xl shadow-teal-500/30 flex items-center gap-3 disabled:opacity-50"
                >
                    <Save size={18} />
                    {isSaving ? "Saqlanmoqda..." : "Imtihonni Saqlash"}
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Left Column: Basic Info */}
                <div className="xl:col-span-1 space-y-8">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-teal-500/5 p-8">
                        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100 dark:border-gray-700">
                            <div className="w-12 h-12 bg-teal-50 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center text-teal-600">
                                <BookOpen size={24} />
                            </div>
                            <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Asosiy<br/><span className="text-teal-600">Ma'lumotlar</span></h2>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Imtihon Nomi <span className="text-rose-500">*</span></label>
                                <input required type="text" placeholder="Masalan: DTM Maxsus 1-Blok" 
                                    className={`w-full px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-teal-500 outline-none transition-all ${errors.name ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-gray-100 dark:border-gray-700'}`}
                                    value={name} onChange={e => { setName(e.target.value); setErrors(p => ({...p, name: false})); }} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Sana <span className="text-rose-500">*</span></label>
                                    <input required type="date" 
                                        className={`w-full px-5 py-4 bg-gray-50 dark:bg-gray-900/50 border rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-teal-500 outline-none transition-all ${errors.date ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-gray-100 dark:border-gray-700'}`}
                                        value={date} onChange={e => { setDate(e.target.value); setErrors(p => ({...p, date: false})); }} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Davomiyligi (Daq) <span className="text-rose-500">*</span></label>
                                    <input required type="number" min="1" placeholder="180"
                                        className={`w-full px-5 py-4 bg-gray-50 dark:bg-gray-900/50 border rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-teal-500 outline-none transition-all ${errors.duration ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-gray-100 dark:border-gray-700'}`}
                                        value={duration} onChange={e => { setDuration(Number(e.target.value)); setErrors(p => ({...p, duration: false})); }} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Holati</label>
                                <select 
                                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:border-teal-500 outline-none transition-all appearance-none cursor-pointer text-gray-900 dark:text-white"
                                    value={status}
                                    onChange={e => setStatus(e.target.value as any)}
                                >
                                    <option value="Yaqinlashmoqda">Yaqinlashmoqda</option>
                                    <option value="Tugallangan">Tugallangan</option>
                                    <option value="Qoralama">Qoralama</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Live Calculator Widget */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-slate-700">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        
                        <div className="flex items-center gap-3 mb-8 relative z-10">
                            <Calculator className="w-6 h-6 text-teal-400" />
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Blueprint Xulosasi</h3>
                        </div>

                        <div className="space-y-6 relative z-10">
                            <div className="flex justify-between items-end border-b border-slate-700 pb-4">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fanlar Soni</div>
                                <div className="text-2xl font-black text-white">{blocks.length} ta fan</div>
                            </div>
                            <div className="flex justify-between items-end border-b border-slate-700 pb-4">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jami Savollar</div>
                                <div className="text-4xl font-black text-teal-400">{totalQuestions} <span className="text-sm font-bold text-slate-500">ta</span></div>
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Maksimal Ball</div>
                                <div className="text-4xl font-black text-amber-500">{maxScore.toFixed(1)} <span className="text-sm font-bold text-slate-500">ball</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Rule Builder */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                            <Layers className="text-teal-600" />
                            Imtihon Qoidalari
                        </h2>
                        
                        <button 
                            onClick={handleAddBlock}
                            className="px-6 py-3 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-800 rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-teal-100 transition-all flex items-center gap-2"
                        >
                            <Plus size={16} />
                            Blok (Fan) Qo'shish
                        </button>
                    </div>

                    <div className="space-y-6">
                        {blocks.map((block, index) => (
                            <div key={block.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[2rem] overflow-hidden shadow-sm transition-all hover:border-teal-200 dark:hover:border-teal-800">
                                
                                {/* Block Header */}
                                <div className="bg-gray-50/50 dark:bg-gray-900/50 p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 font-extrabold shadow-sm border border-gray-100 dark:border-gray-700">
                                            {index + 1}
                                        </div>
                                        <div className="flex gap-4 items-center">
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest ml-1">Fan Tanlang</label>
                                                <select 
                                                    className="w-full min-w-[200px] px-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold uppercase tracking-widest focus:border-teal-500 outline-none"
                                                    value={block.subject}
                                                    onChange={e => handleUpdateBlock(block.id, { subject: e.target.value })}
                                                >
                                                    <option value="">Fan Tanlang...</option>
                                                    {Object.keys(availableMetadata).map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest ml-1">Ball / Savol</label>
                                                <input type="number" step="0.1" 
                                                    className="w-24 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold uppercase tracking-widest focus:border-teal-500 outline-none text-amber-600"
                                                    value={block.pointsPerQuestion || ''}
                                                    onChange={e => handleUpdateBlock(block.id, { pointsPerQuestion: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveBlock(block.id)} className="p-3 text-gray-300 hover:text-rose-500 transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                {/* Rules List */}
                                <div className="p-6 space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mavzu bo'yicha qoidalar</h4>
                                        <button 
                                            onClick={() => handleAddRule(block.id)}
                                            className="text-[9px] font-black text-teal-600 uppercase tracking-widest flex items-center gap-1.5 hover:opacity-70"
                                        >
                                            <Plus size={14} /> Mavzu Qo'shish
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {block.topicRules.map((rule, rIdx) => {
                                            const avail = getAvailableCount(block.subject, rule.topic);
                                            const isError = rule.count > avail;

                                            return (
                                                <div key={rIdx} className="grid grid-cols-12 gap-4 items-end bg-gray-50 dark:bg-gray-900/30 p-4 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-800 transition-all">
                                                    <div className="col-span-6 space-y-1.5">
                                                        <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest ml-1">Mavzu</label>
                                                        <select 
                                                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:border-teal-500 outline-none"
                                                            value={rule.topic}
                                                            onChange={e => handleUpdateRule(block.id, rIdx, 'topic', e.target.value)}
                                                        >
                                                            <option value="">Mavzu Tanlang...</option>
                                                            {(availableMetadata[block.subject] || []).map(t => (
                                                                <option key={t} value={t}>{t}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="col-span-3 space-y-1.5">
                                                        <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest ml-1">Soni</label>
                                                        <div className="relative">
                                                            <input type="number" 
                                                                className={`w-full px-4 py-2.5 bg-white dark:bg-gray-800 border ${isError ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-gray-100 dark:border-gray-700'} rounded-xl text-[10px] font-bold uppercase tracking-widest focus:border-teal-500 outline-none`}
                                                                value={rule.count || ''}
                                                                onChange={e => handleUpdateRule(block.id, rIdx, 'count', Number(e.target.value))}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 pb-2">
                                                        <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase ${isError ? 'text-rose-500' : 'text-gray-400'}`}>
                                                            {isError ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} className="text-teal-500" />}
                                                            {avail} ta bor
                                                        </div>
                                                    </div>
                                                    <div className="col-span-1 flex justify-end pb-1.5">
                                                        <button onClick={() => handleRemoveRule(block.id, rIdx)} className="text-gray-300 hover:text-rose-500">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {block.topicRules.length === 0 && (
                                            <div className="py-8 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                                                <Tag className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Ushbu fan uchun hali qoidalar kiritilmagan</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {blocks.length === 0 && (
                        <div className="p-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[2.5rem] flex flex-col items-center justify-center text-center">
                            <Layers className="w-12 h-12 text-gray-300 mb-4" />
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Hozircha fanlar yo'q. Birinchi blokni qo'shing.</p>
                        </div>
                    )}
                </div>
            </div>
            
        </div>
    );
}
