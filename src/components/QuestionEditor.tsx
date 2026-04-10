import React, { useState, useEffect, useRef, useCallback } from 'react';
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
                    // Reset only the question part, keep subject/topic/difficulty
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

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/questions')}
                        className="w-12 h-12 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                            {isEditMode ? 'Savolni Tahrirlash' : 'Savol Qo\'shish'}
                        </h1>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                            {isEditMode ? 'Savolni tahrirlash va yangilash' : `Fan va mavzuni bir marta kiriting — savollarni ketma-ket qo'shing`}
                        </p>
                    </div>
                    {!isEditMode && addedCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-900/30 rounded-2xl border border-teal-100 dark:border-teal-800">
                            <CheckCircle2 size={14} className="text-teal-600" />
                            <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">
                                {addedCount} ta savol qo'shildi
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {isEditMode && (
                        <button onClick={handleDelete} className="p-3.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all">
                            <Trash2 size={20} />
                        </button>
                    )}
                    {!isEditMode && (
                        <button
                            onClick={() => handleSave(true)}
                            disabled={isSaving}
                            className="px-6 py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center gap-2"
                        >
                            <Plus size={16} />
                            Saqlash & Davom etish
                        </button>
                    )}
                    <button
                        onClick={() => handleSave(false)}
                        disabled={isSaving}
                        className="px-8 py-3.5 bg-teal-600 dark:bg-teal-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-500 shadow-lg shadow-teal-500/20 flex items-center gap-2"
                    >
                        <Save size={18} />
                        {isSaving ? 'Saqlanmoqda...' : isEditMode ? 'Yangilash' : 'Saqlash & Chiqish'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* LEFT COLUMN: Subject/Topic/Difficulty — Persistent */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-teal-500/5 p-8 sticky top-4">
                        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-100 dark:border-gray-700">
                            <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center text-teal-600">
                                <BookOpen size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Fan Sozlamalari</h3>
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Barcha savollarga taalluqli</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {/* Subject */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Fan <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    list="subject-suggestions"
                                    placeholder="Masalan: Matematika"
                                    className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold uppercase tracking-widest focus:bg-white focus:border-teal-500 outline-none transition-all"
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                />
                                <datalist id="subject-suggestions">
                                    {allSubjects.map(s => <option key={s} value={s} />)}
                                </datalist>
                            </div>

                            {/* Topic */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Mavzu <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    list="topic-suggestions"
                                    placeholder="Masalan: Trigonometriya"
                                    className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold uppercase tracking-widest focus:bg-white focus:border-teal-500 outline-none transition-all"
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                />
                                <datalist id="topic-suggestions">
                                    {topicsForSubject.map(t => <option key={t} value={t} />)}
                                </datalist>
                            </div>

                            {/* Difficulty */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Qiyinlik Darajasi</label>
                                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700">
                                    {[1, 2, 3].map((lvl) => (
                                        <button key={lvl} type="button" onClick={() => setDifficulty(lvl)}
                                            className={`flex-1 py-2.5 rounded-lg text-[9px] font-black transition-all ${difficulty === lvl
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
                                <div className="mt-4 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-2xl border border-teal-100 dark:border-teal-800">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Tag size={12} className="text-teal-600" />
                                        <span className="text-[9px] font-black text-teal-600 uppercase tracking-widest">Joriy sozlama</span>
                                    </div>
                                    <p className="text-xs font-bold text-gray-900 dark:text-white">{subject}</p>
                                    <p className="text-[10px] font-bold text-gray-500 mt-0.5">{topic}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Question Form */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Question Text */}
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-teal-500/5 p-8">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block ml-1">
                            Savol Matni
                        </label>
                        <RichTextEditor
                            content={q.text}
                            onChange={(val) => setQ(prev => ({ ...prev, text: val }))}
                        />

                        {/* Image Upload */}
                        <div className="mt-6 pt-6 border-t border-gray-50 dark:border-gray-700">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-3 block">
                                Savol Rasmi (ixtiyoriy)
                            </label>
                            {imagePreview ? (
                                <div className="relative rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 group">
                                    <img src={imagePreview} alt="Savol rasmi" className="max-h-48 w-full object-contain bg-gray-50 dark:bg-gray-900" />
                                    <button
                                        onClick={() => { setImagePreview(null); setQ(prev => ({ ...prev, imageUrl: '' })); }}
                                        className="absolute top-3 right-3 w-8 h-8 bg-rose-500 text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full p-6 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-2xl text-center hover:border-teal-300 dark:hover:border-teal-700 transition-all group"
                                >
                                    <Image size={24} className="mx-auto text-gray-300 group-hover:text-teal-500 transition-colors mb-2" />
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Rasm yuklash uchun bosing</p>
                                </button>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </div>
                    </div>

                    {/* Answer Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                            <div key={opt} className={`relative bg-white dark:bg-gray-800 rounded-[2rem] border transition-all p-6 ${
                                q.correctAnswer === opt
                                    ? 'border-teal-500 ring-4 ring-teal-500/5'
                                    : 'border-gray-100 dark:border-gray-700'
                            }`}>
                                <div className="flex items-center justify-between mb-4">
                                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                                        q.correctAnswer === opt
                                            ? 'bg-teal-500 text-white'
                                            : 'bg-gray-50 dark:bg-gray-900 text-gray-400'
                                    }`}>
                                        {opt}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setQ(prev => ({ ...prev, correctAnswer: opt }))}
                                        className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${
                                            q.correctAnswer === opt
                                                ? 'bg-teal-50 text-teal-600'
                                                : 'text-gray-400 hover:bg-gray-50'
                                        }`}
                                    >
                                        {q.correctAnswer === opt ? 'To\'g\'ri javob ✓' : 'Belgilash'}
                                    </button>
                                </div>
                                <textarea
                                    placeholder={`Variant ${opt}...`}
                                    className="w-full bg-transparent border-none outline-none text-sm font-bold text-gray-700 dark:text-gray-300 resize-none h-20 placeholder:text-gray-300"
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
                                className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={16} />
                                Saqlash & Keyingi Savol ({addedCount + 1} →)
                            </button>
                        )}
                        <button
                            onClick={() => handleSave(false)}
                            disabled={isSaving}
                            className="flex-1 py-4 bg-teal-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-500 transition-all shadow-xl shadow-teal-500/20 flex items-center justify-center gap-2"
                        >
                            <Save size={16} />
                            {isSaving ? 'Saqlanmoqda...' : isEditMode ? 'Yangilash' : 'Saqlash & Ro\'yxatga Qaytish'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
