import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Calculator, Layers, BookOpen, Clock, Calendar, Tag, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

    const labelCls = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";
    const inputCls = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/exams')}
                        className="w-10 h-10 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-xl flex items-center justify-center text-gray-450 hover:text-[#1b6b6b] hover:bg-gray-50 transition-all shadow-sm group cursor-pointer"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Imtihon Konstruktori</h1>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Mavzular bo'yicha savollarni saralash va qoidalar yaratish</p>
                    </div>
                </div>
                
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                    <Save size={14} />
                    {isSaving ? "Saqlanmoqda..." : "Imtihonni Saqlash"}
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Left Column: Basic Info */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-6">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-dashed border-gray-100 dark:border-gray-700/50">
                            <div className="w-10 h-10 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-center text-[#1b6b6b]">
                                <BookOpen size={18} />
                            </div>
                            <div>
                                <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">Asosiy Ma'lumotlar</h2>
                                <p className="text-[9px] font-bold text-gray-450 uppercase tracking-widest">Imtihon parametrlari</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className={labelCls}>Imtihon Nomi <span className="text-rose-500">*</span></label>
                                <input required type="text" placeholder="Masalan: 1-Chorak imtihoni" 
                                    className={`${inputCls} ${errors.name ? 'border-rose-500 ring-2 ring-rose-500/10' : ''}`}
                                    value={name} onChange={e => { setName(e.target.value); setErrors(p => ({...p, name: false})); }} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>Sana <span className="text-rose-500">*</span></label>
                                    <input required type="date" 
                                        className={`${inputCls} ${errors.date ? 'border-rose-500 ring-2 ring-rose-500/10' : ''}`}
                                        value={date} onChange={e => { setDate(e.target.value); setErrors(p => ({...p, date: false})); }} />
                                </div>
                                <div>
                                    <label className={labelCls}>Davomiyligi (Daq) <span className="text-rose-500">*</span></label>
                                    <input required type="number" min="1" placeholder="180"
                                        className={`${inputCls} ${errors.duration ? 'border-rose-500 ring-2 ring-rose-500/10' : ''}`}
                                        value={duration} onChange={e => { setDuration(Number(e.target.value)); setErrors(p => ({...p, duration: false})); }} />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Holati</label>
                                <select 
                                    className={inputCls}
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
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden border border-slate-700/50">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
                        
                        <div className="flex items-center gap-2 mb-6 relative z-10">
                            <Calculator className="w-5 h-5 text-teal-400" />
                            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Imtihon Blueprinti</h3>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-end border-b border-slate-700/50 pb-3">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fanlar Soni</span>
                                <span className="text-sm font-black text-white">{blocks.length} ta fan</span>
                            </div>
                            <div className="flex justify-between items-end border-b border-slate-700/50 pb-3">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Jami Savollar</span>
                                <span className="text-xl font-black text-teal-400">{totalQuestions} <span className="text-[10px] font-bold text-slate-500">ta</span></span>
                            </div>
                            <div className="flex justify-between items-end">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Maksimal Ball</span>
                                <span className="text-xl font-black text-amber-500">{maxScore.toFixed(1)} <span className="text-[10px] font-bold text-slate-500">ball</span></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Rule Builder */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            <Layers className="text-[#1b6b6b]" size={18} />
                            Imtihon Qoidalari
                        </h2>
                        
                        <button 
                            onClick={handleAddBlock}
                            className="px-4 py-2.5 bg-teal-50 dark:bg-teal-950/20 text-[#1b6b6b] border border-teal-100 dark:border-teal-900/40 rounded-xl text-[9px] font-extrabold uppercase tracking-widest hover:bg-teal-100 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <Plus size={14} />
                            Blok (Fan) Qo'shish
                        </button>
                    </div>

                    <div className="space-y-4">
                        {blocks.map((block, index) => (
                            <div key={block.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-3xl overflow-hidden shadow-sm transition-all">
                                
                                {/* Block Header */}
                                <div className="bg-gray-55 dark:bg-gray-900 p-4 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="w-8 h-8 bg-white dark:bg-gray-850 rounded-lg flex items-center justify-center text-gray-400 font-bold text-xs shadow-sm border border-gray-100 dark:border-gray-700">
                                            {index + 1}
                                        </div>
                                        <div className="flex flex-wrap gap-3 items-center">
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-bold text-gray-405 uppercase tracking-widest ml-1">Fan Tanlang</label>
                                                <select 
                                                    className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:border-teal-500 outline-none text-gray-900 dark:text-white cursor-pointer"
                                                    value={block.subject}
                                                    onChange={e => handleUpdateBlock(block.id, { subject: e.target.value })}
                                                >
                                                    <option value="">Fan...</option>
                                                    {Object.keys(availableMetadata).map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-bold text-gray-405 uppercase tracking-widest ml-1">Ball / Savol</label>
                                                <input type="number" step="0.1" 
                                                    className="w-20 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:border-teal-500 outline-none text-amber-600"
                                                    value={block.pointsPerQuestion || ''}
                                                    onChange={e => handleUpdateBlock(block.id, { pointsPerQuestion: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveBlock(block.id)} className="p-2 text-gray-300 hover:text-rose-500 transition-colors cursor-pointer">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {/* Rules List */}
                                <div className="p-5 space-y-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mavzu bo'yicha qoidalar</h4>
                                        <button 
                                            onClick={() => handleAddRule(block.id)}
                                            className="text-[9px] font-black text-[#1b6b6b] uppercase tracking-widest flex items-center gap-1 hover:opacity-70 cursor-pointer"
                                        >
                                            <Plus size={12} /> Mavzu Qo'shish
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {block.topicRules.map((rule, rIdx) => {
                                            const avail = getAvailableCount(block.subject, rule.topic);
                                            const isError = rule.count > avail;

                                            return (
                                                <div key={rIdx} className="grid grid-cols-12 gap-3 items-end bg-gray-55 dark:bg-gray-900/30 p-3.5 rounded-2xl border border-transparent hover:border-gray-100 transition-all">
                                                    <div className="col-span-5 space-y-1.5">
                                                        <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest ml-1">Mavzu</label>
                                                        <select 
                                                            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:border-teal-500 outline-none text-gray-900 dark:text-white cursor-pointer"
                                                            value={rule.topic}
                                                            onChange={e => handleUpdateRule(block.id, rIdx, 'topic', e.target.value)}
                                                        >
                                                            <option value="">Mavzu...</option>
                                                            {(availableMetadata[block.subject] || []).map(t => (
                                                                <option key={t} value={t}>{t}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="col-span-3 space-y-1.5">
                                                        <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest ml-1">Soni</label>
                                                        <input type="number" 
                                                            className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border ${isError ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-gray-100 dark:border-gray-700'} rounded-xl text-[10px] font-bold uppercase tracking-widest focus:border-teal-500 outline-none`}
                                                            value={rule.count || ''}
                                                            onChange={e => handleUpdateRule(block.id, rIdx, 'count', Number(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="col-span-3 pb-2">
                                                        <div className={`flex items-center gap-1 text-[9px] font-black uppercase ${isError ? 'text-rose-500' : 'text-gray-450'}`}>
                                                            {isError ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} className="text-teal-500" />}
                                                            {avail} ta bor
                                                        </div>
                                                    </div>
                                                    <div className="col-span-1 flex justify-end pb-2">
                                                        <button onClick={() => handleRemoveRule(block.id, rIdx)} className="text-gray-300 hover:text-rose-500 cursor-pointer">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {block.topicRules.length === 0 && (
                                            <div className="py-8 text-center border border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                                                <Tag className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Mavzu qoidalari mavjud emas</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {blocks.length === 0 && (
                        <div className="p-12 border border-dashed border-gray-200 dark:border-gray-700 rounded-3xl flex flex-col items-center justify-center text-center">
                            <Layers className="w-10 h-10 text-gray-300 mb-4" />
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Hozircha fanlar yo'q. Birinchi blokni qo'shing.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
