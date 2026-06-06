import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Image, X, Plus, CheckCircle2, BookOpen, Tag } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import RichTextEditor from './RichTextEditor';

const EMPTY_QUESTION = {
    text: '',
    imageUrl: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A' as 'A' | 'B' | 'C' | 'D',
    difficulty: 1,
};

export default function QuestionEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { questions, addQuestion, updateQuestion, deleteQuestion, showNotification } = useCRM();
    const isEditMode = !!id;

    const [isSaving, setIsSaving] = useState(false);

    // PERSISTENT: stays across multiple question additions
    const [subject, setSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [difficulty, setDifficulty] = useState(1);

    // PER-QUESTION: resets after each save
    const [q, setQ] = useState(EMPTY_QUESTION);

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Suggestions from existing questions
    const allSubjects = [...new Set(questions.map(q => q.subject).filter(Boolean))];
    const topicsForSubject = [...new Set(questions.filter(q => q.subject === subject).map(q => q.topic).filter(Boolean))];

    // Session counter
    const [addedCount, setAddedCount] = useState(0);

    useEffect(() => {
        if (id) {
            const existing = questions.find(item => item.id === Number(id));
            if (existing) {
                setSubject(existing.subject);
                setTopic(existing.topic);
                setDifficulty(existing.difficulty);
                setQ({
                    text: existing.text,
                    imageUrl: existing.imageUrl || '',
                    optionA: existing.optionA,
                    optionB: existing.optionB,
                    optionC: existing.optionC,
                    optionD: existing.optionD,
                    correctAnswer: existing.correctAnswer,
                    difficulty: existing.difficulty,
                });
                if (existing.imageUrl) setImagePreview(existing.imageUrl);
            }
        }
    }, [id, questions]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setImagePreview(dataUrl);
            setQ(prev => ({ ...prev, imageUrl: dataUrl }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async (andContinue = false) => {
        if (!q.text || !q.optionA || !q.optionB || !q.optionC || !q.optionD) {
            showNotification("Savol matni va barcha 4 ta variantni to'ldiring", "error");
            return;
        }
        if (!subject || !topic) {
            showNotification("Fan va mavzuni kiriting", "error");
            return;
        }

        try {
            setIsSaving(true);
            const payload = { ...q, subject, topic, difficulty };

            if (isEditMode) {
                await updateQuestion(Number(id), payload);
                navigate('/questions');
            } else {
                await addQuestion(payload);
                if (andContinue) {
                    setQ({ ...EMPTY_QUESTION, difficulty });
                    setImagePreview(null);
                    setAddedCount(c => c + 1);
                } else {
                    navigate('/questions');
                }
            }
        } catch (err) {
            showNotification("Saqlashda xatolik", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm("Bu savolni o'chirib tashlamoqchimisiz?")) {
            await deleteQuestion(Number(id));
            navigate('/questions');
        }
    };

    const labelCls = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";
    const inputCls = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/questions')}
                        className="w-10 h-10 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-xl flex items-center justify-center text-gray-450 hover:text-[#1b6b6b] hover:bg-gray-55 transition-all shadow-sm cursor-pointer"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            {isEditMode ? 'Savolni Tahrirlash' : 'Savol Qo\'shish'}
                        </h1>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                            {isEditMode ? 'Savolni tahrirlash va yangilash' : `Fan va mavzuni bir marta kiriting — savollarni ketma-ket qo'shing`}
                        </p>
                    </div>
                    {!isEditMode && addedCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-teal-50 dark:bg-teal-950/20 rounded-lg border border-teal-100 dark:border-teal-900/40">
                            <CheckCircle2 size={12} className="text-[#1b6b6b]" />
                            <span className="text-[9px] font-black text-[#1b6b6b] uppercase tracking-widest">
                                {addedCount} ta savol qo'shildi
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {isEditMode && (
                        <button onClick={handleDelete} className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all cursor-pointer">
                            <Trash2 size={18} />
                        </button>
                    )}
                    {!isEditMode && (
                        <button
                            onClick={() => handleSave(true)}
                            disabled={isSaving}
                            className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-gray-250 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <Plus size={14} />
                            Saqlash & Davom etish
                        </button>
                    )}
                    <button
                        onClick={() => handleSave(false)}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-teal-550 shadow-lg shadow-[#1b6b6b]/20 flex items-center gap-1.5 cursor-pointer"
                    >
                        <Save size={14} />
                        {isSaving ? 'Saqlanmoqda...' : isEditMode ? 'Yangilash' : 'Saqlash & Chiqish'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* LEFT COLUMN: Subject/Topic/Difficulty — Persistent */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-6 sticky top-4">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-dashed border-gray-100 dark:border-gray-700/50">
                            <div className="w-10 h-10 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-center text-[#1b6b6b]">
                                <BookOpen size={18} />
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">Fan Sozlamalari</h3>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Barcha savollarga taalluqli</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Subject */}
                            <div>
                                <label className={labelCls}>Fan <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    list="subject-suggestions"
                                    placeholder="Masalan: Matematika"
                                    className={inputCls}
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                />
                                <datalist id="subject-suggestions">
                                    {allSubjects.map(s => <option key={s} value={s} />)}
                                </datalist>
                            </div>

                            {/* Topic */}
                            <div>
                                <label className={labelCls}>Mavzu <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    list="topic-suggestions"
                                    placeholder="Masalan: Trigonometriya"
                                    className={inputCls}
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                />
                                <datalist id="topic-suggestions">
                                    {topicsForSubject.map(t => <option key={t} value={t} />)}
                                </datalist>
                            </div>

                            {/* Difficulty */}
                            <div>
                                <label className={labelCls}>Qiyinlik Darajasi</label>
                                <div className="flex items-center gap-2 bg-gray-55 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-100 dark:border-gray-705">
                                    {[1, 2, 3].map((lvl) => (
                                        <button key={lvl} type="button" onClick={() => setDifficulty(lvl)}
                                            className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all cursor-pointer ${difficulty === lvl
                                                ? lvl === 1 ? 'bg-emerald-500 text-white shadow-md'
                                                    : lvl === 2 ? 'bg-amber-500 text-white shadow-md'
                                                        : 'bg-rose-500 text-white shadow-md'
                                                : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            {lvl === 1 ? 'OSON' : lvl === 2 ? 'O\'RTA' : 'QIYIN'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Info card */}
                            {!isEditMode && subject && topic && (
                                <div className="mt-4 p-4 bg-teal-50 dark:bg-teal-950/20 rounded-2xl border border-teal-100 dark:border-teal-900/40">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <Tag size={12} className="text-[#1b6b6b]" />
                                        <span className="text-[9px] font-black text-[#1b6b6b] uppercase tracking-widest">Joriy sozlama</span>
                                    </div>
                                    <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{subject}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{topic}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Question Form */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Question Text */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-6">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block ml-1">
                            Savol Matni
                        </label>
                        <RichTextEditor
                            content={q.text}
                            onChange={(val) => setQ(prev => ({ ...prev, text: val }))}
                        />

                        {/* Image Upload */}
                        <div className="mt-6 pt-6 border-t border-dashed border-gray-100 dark:border-gray-700/50">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-3 block">
                                Savol Rasmi (ixtiyoriy)
                            </label>
                            {imagePreview ? (
                                <div className="relative rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 group">
                                    <img src={imagePreview} alt="Savol rasmi" className="max-h-48 w-full object-contain bg-gray-55 dark:bg-gray-900" />
                                    <button
                                        onClick={() => { setImagePreview(null); setQ(prev => ({ ...prev, imageUrl: '' })); }}
                                        className="absolute top-3 right-3 w-8 h-8 bg-rose-500 text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full p-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-center hover:border-teal-300 transition-all group cursor-pointer"
                                >
                                    <Image size={24} className="mx-auto text-gray-300 group-hover:text-[#1b6b6b] transition-colors mb-2" />
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Rasm yuklash uchun bosing</p>
                                </button>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </div>
                    </div>

                    {/* Answer Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                            <div key={opt} className={`relative bg-white dark:bg-gray-800 rounded-3xl border transition-all p-5 ${
                                q.correctAnswer === opt
                                    ? 'border-[#1b6b6b] ring-4 ring-[#1b6b6b]/5'
                                    : 'border-gray-100 dark:border-gray-700/50'
                            }`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                                        q.correctAnswer === opt
                                            ? 'bg-[#1b6b6b] text-white'
                                            : 'bg-gray-55 dark:bg-gray-900 text-gray-400'
                                    }`}>
                                        {opt}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setQ(prev => ({ ...prev, correctAnswer: opt }))}
                                        className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                                            q.correctAnswer === opt
                                                ? 'bg-[#1b6b6b]/10 text-[#1b6b6b]'
                                                : 'text-gray-405 hover:bg-gray-50'
                                        }`}
                                    >
                                        {q.correctAnswer === opt ? 'To\'g\'ri' : 'Tanlash'}
                                    </button>
                                </div>
                                <textarea
                                    placeholder={`Variant ${opt}...`}
                                    className="w-full bg-transparent border-none outline-none text-xs font-bold text-gray-700 dark:text-gray-300 resize-none h-16 placeholder:text-gray-300 focus:ring-0"
                                    value={q[`option${opt}` as keyof typeof q] as string}
                                    onChange={(e) => setQ(prev => ({ ...prev, [`option${opt}`]: e.target.value }))}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Save buttons (bottom, for convenience) */}
                    <div className="flex items-center gap-3 pt-2">
                        {!isEditMode && (
                            <button
                                onClick={() => handleSave(true)}
                                disabled={isSaving}
                                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Plus size={14} />
                                Saqlash & Keyingi Savol ({addedCount + 1} →)
                            </button>
                        )}
                        <button
                            onClick={() => handleSave(false)}
                            disabled={isSaving}
                            className="flex-1 py-3 bg-[#1b6b6b] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-teal-500 transition-all shadow-lg shadow-[#1b6b6b]/20 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <Save size={14} />
                            {isSaving ? 'Saqlanmoqda...' : isEditMode ? 'Yangilash' : 'Saqlash & Chiqish'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
