import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';
import { 
  Plus, Edit, Trash2, BookOpen, FileText, ArrowLeft, 
  Settings, ChevronRight, PlusCircle, Save, X, ExternalLink
} from 'lucide-react';
import { Syllabus, Topic } from '../types';

export default function SyllabusManager() {
  const { 
    syllabuses, addSyllabus, updateSyllabus, deleteSyllabus,
    topics, addTopic, updateTopic, deleteTopic, groups, user
  } = useCRM();
  const { t } = useLang();

  // Navigation / state
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<number | null>(null);
  
  // Modals / forms
  const [isSyllabusModalOpen, setIsSyllabusModalOpen] = useState(false);
  const [editingSyllabus, setEditingSyllabus] = useState<Syllabus | null>(null);
  const [syllabusForm, setSyllabusForm] = useState({ name: '', materials: '' });

  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [topicForm, setTopicForm] = useState({ title: '', description: '', order: 1 });

  // Get active syllabus details
  const activeSyllabus = syllabuses.find(s => s.id === selectedSyllabusId);
  const syllabusTopics = activeSyllabus 
    ? (topics || []).filter(t => t.syllabusId === activeSyllabus.id).sort((a, b) => a.order - b.order) 
    : [];

  const linkedGroups = activeSyllabus 
    ? (groups || []).filter(g => g.syllabusId === activeSyllabus.id)
    : [];

  // Syllabus CRUD Handlers
  const handleOpenSyllabusModal = (syllabus?: Syllabus) => {
    if (syllabus) {
      setEditingSyllabus(syllabus);
      setSyllabusForm({ name: syllabus.name, materials: syllabus.materials || '' });
    } else {
      setEditingSyllabus(null);
      setSyllabusForm({ name: '', materials: '' });
    }
    setIsSyllabusModalOpen(true);
  };

  const handleSaveSyllabus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syllabusForm.name.trim()) return;

    try {
      if (editingSyllabus) {
        await updateSyllabus(editingSyllabus.id, {
          name: syllabusForm.name.trim(),
          materials: syllabusForm.materials.trim() || null
        });
      } else {
        await addSyllabus({
          name: syllabusForm.name.trim(),
          materials: syllabusForm.materials.trim() || null
        });
      }
      setIsSyllabusModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSyllabus = async (id: number) => {
    if (window.confirm("Haqiqatan ham ushbu o'quv dasturini o'chirmoqchisiz? Guruhlardagi bog'liqliklar bekor qilinadi.")) {
      try {
        await deleteSyllabus(id);
        if (selectedSyllabusId === id) {
          setSelectedSyllabusId(null);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Topic CRUD Handlers
  const handleOpenTopicModal = (topic?: Topic) => {
    if (!selectedSyllabusId) return;
    if (topic) {
      setEditingTopic(topic);
      setTopicForm({ 
        title: topic.title, 
        description: topic.description || '', 
        order: topic.order 
      });
    } else {
      setEditingTopic(null);
      // Auto-increment order based on current topics
      const nextOrder = syllabusTopics.length > 0 
        ? Math.max(...syllabusTopics.map(t => t.order)) + 1 
        : 1;
      setTopicForm({ title: '', description: '', order: nextOrder });
    }
    setIsTopicModalOpen(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSyllabusId || !topicForm.title.trim()) return;

    try {
      if (editingTopic) {
        await updateTopic(editingTopic.id, {
          title: topicForm.title.trim(),
          description: topicForm.description.trim() || null,
          order: Number(topicForm.order)
        });
      } else {
        await addTopic({
          title: topicForm.title.trim(),
          description: topicForm.description.trim() || null,
          order: Number(topicForm.order),
          syllabusId: selectedSyllabusId
        });
      }
      setIsTopicModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTopic = async (id: number) => {
    if (window.confirm("Ushbu dars/mavzuni o'quv programmasidan o'chirmoqchisiz?")) {
      try {
        await deleteTopic(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Styles
  const labelCls = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";
  const inputCls = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

  // RENDER SYLLABUS LIST VIEW
  if (selectedSyllabusId === null) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">O'quv programmasi</h1>
            <p className="text-xs text-gray-400 font-bold mt-1">O'quv rejalari va o'quv qo'llanmalarini yaratish hamda boshqarish</p>
          </div>
          <button 
            onClick={() => handleOpenSyllabusModal()}
            className="flex items-center gap-2 px-5 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus size={14} />
            Dastur yaratish
          </button>
        </div>

        {syllabuses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-12 text-center max-w-lg mx-auto">
            <BookOpen size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">O'quv programmalari yo'q</h3>
            <p className="text-xs text-gray-400 font-bold mt-2">Hali hech qanday o'quv programmasi yaratilmagan. Darslar ketma-ketligi va o'quv qo'llanmalarini shakllantirish uchun yangi o'quv dasturini qo'shing.</p>
            <button 
              onClick={() => handleOpenSyllabusModal()}
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={14} />
              Dastur yaratish
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {syllabuses.map(s => {
              const count = (topics || []).filter(t => t.syllabusId === s.id).length;
              const activeGroups = (groups || []).filter(g => g.syllabusId === s.id).length;
              return (
                <div 
                  key={s.id} 
                  className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 hover:border-[#1b6b6b]/40 dark:hover:border-[#1b6b6b]/40 transition-all overflow-hidden flex flex-col justify-between group shadow-sm"
                >
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="p-3 bg-teal-50 dark:bg-teal-950/20 text-[#1b6b6b] rounded-2xl border border-teal-100/50 dark:border-teal-900/40">
                        <FileText size={20} />
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOpenSyllabusModal(s); }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-xl transition-all cursor-pointer"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteSyllabus(s.id); }}
                          className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-400 hover:text-rose-600 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight line-clamp-1">{s.name}</h3>
                      <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">
                        {count} ta dars/mavzu • {activeGroups} ta guruh biriktirilgan
                      </p>
                    </div>
                    {s.materials && (
                      <div className="bg-gray-55 dark:bg-gray-900/40 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800/50">
                        <span className="text-[9px] font-extrabold text-[#1b6b6b] block uppercase tracking-widest mb-1">O'quv qo'llanmalari</span>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{s.materials}</p>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-55 dark:border-gray-700/50 p-4 bg-gray-55/30 dark:bg-gray-800/30">
                    <button 
                      onClick={() => setSelectedSyllabusId(s.id)}
                      className="w-full flex items-center justify-between text-[10px] font-black text-[#1b6b6b] hover:text-[#155252] dark:text-teal-400 dark:hover:text-teal-300 uppercase tracking-widest group/btn cursor-pointer"
                    >
                      Dastur tarkibi va darslar
                      <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Syllabus Add/Edit Modal */}
        {isSyllabusModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-700 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  {editingSyllabus ? "Dasturni tahrirlash" : "Yangi o'quv dasturi yaratish"}
                </h2>
                <button 
                  onClick={() => setIsSyllabusModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-gray-55 dark:bg-gray-700/50 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveSyllabus} className="p-6 space-y-4">
                <div>
                  <label className={labelCls}>Dastur nomi *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Masalan: Web Frontend (React) - 4 oylik" 
                    className={inputCls} 
                    value={syllabusForm.name} 
                    onChange={e => setSyllabusForm({ ...syllabusForm, name: e.target.value })} 
                  />
                </div>
                <div>
                  <label className={labelCls}>Uchebniy posobiyalar (O'quv materiallari)</label>
                  <textarea 
                    rows={4}
                    placeholder="O'qituvchi foydalanadigan darsliklar, qo'llanmalar, kitoblar, taqdimotlar va onlayn manbalarni yozing..." 
                    className={`${inputCls} resize-none`} 
                    value={syllabusForm.materials} 
                    onChange={e => setSyllabusForm({ ...syllabusForm, materials: e.target.value })} 
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                  <button 
                    type="button" 
                    onClick={() => setIsSyllabusModalOpen(false)}
                    className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Bekor qilish
                  </button>
                  <button 
                    type="submit" 
                    className="flex items-center gap-2 px-6 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                  >
                    <Save size={14} />
                    Saqlash
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // RENDER SYLLABUS DETAILS & TOPICS VIEW
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header and Back Button */}
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => setSelectedSyllabusId(null)} 
          className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-[#1b6b6b] transition-all text-[10px] font-extrabold uppercase tracking-widest group cursor-pointer"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Dasturlar ro'yxatiga qaytish
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{activeSyllabus.name}</h1>
            <p className="text-xs text-gray-400 font-bold mt-1">O'quv programmasi mavzulari va ketma-ketligi</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => handleOpenSyllabusModal(activeSyllabus)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-200/50 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
            >
              Dasturni tahrirlash
            </button>
            <button 
              onClick={() => handleOpenTopicModal()}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer"
            >
              <Plus size={14} />
              Mavzu qo'shish
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column: Info details */}
        <div className="space-y-6">
          {/* Syllabus details */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-55 dark:border-gray-700/50 pb-3">Dastur ma'lumotlari</h3>
            
            <div className="space-y-1.5">
              <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block">Uchebniy Posobiyalar</span>
              {activeSyllabus.materials ? (
                <p className="text-xs text-gray-600 dark:text-gray-350 leading-relaxed font-semibold bg-gray-55 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                  {activeSyllabus.materials}
                </p>
              ) : (
                <p className="text-xs text-gray-400 italic font-bold">Qo'llanmalar va manbalar kiritilmagan.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-gray-55 dark:bg-gray-900/30 p-3.5 rounded-2xl text-center">
                <span className="text-[20px] font-black text-[#1b6b6b] block">{syllabusTopics.length}</span>
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Jami darslar</span>
              </div>
              <div className="bg-gray-55 dark:bg-gray-900/30 p-3.5 rounded-2xl text-center">
                <span className="text-[20px] font-black text-emerald-500 block">{linkedGroups.length}</span>
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Guruhlar soni</span>
              </div>
            </div>
          </div>

          {/* Linked Groups */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-55 dark:border-gray-700/50 pb-3 font-bold">Biriktirilgan Guruhlar</h3>
            {linkedGroups.length === 0 ? (
              <p className="text-xs text-gray-400 italic font-bold py-2">Ushbu dastur hali hech bir guruhga ulanmagan. Kurs sahifasida "O'quv programmasi" bo'limidan ulanadi.</p>
            ) : (
              <div className="space-y-3">
                {linkedGroups.map(g => (
                  <div key={g.id} className="flex items-center justify-between p-3 bg-gray-55 dark:bg-gray-900/20 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all">
                    <div>
                      <span className="text-xs font-black text-gray-800 dark:text-white block uppercase tracking-tight">{g.name}</span>
                      <span className="text-[9px] text-gray-400 font-bold block mt-0.5">{g.schedule} • {g.days}</span>
                    </div>
                    <a 
                      href={`/courses/${g.id}`} 
                      className="p-2 bg-white dark:bg-gray-850 hover:bg-teal-50 dark:hover:bg-teal-950/20 text-gray-400 hover:text-[#1b6b6b] border border-gray-100 dark:border-gray-700 rounded-xl transition-all cursor-pointer"
                      title="Guruhga o'tish"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Topics / Lessons List */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-55 dark:border-gray-700/50 pb-4">
            <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider font-bold">Mavzular va dars rejalari ketma-ketligi</h3>
            <span className="px-2.5 py-1 bg-teal-50 text-[#1b6b6b] border border-teal-100/50 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40 rounded-xl text-[9px] font-bold">
              {syllabusTopics.length} ta dars
            </span>
          </div>

          {syllabusTopics.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen size={36} className="text-gray-300 dark:text-gray-650 mx-auto mb-3" />
              <p className="text-xs text-gray-450 font-bold">Dasturda hali mavzular yo'q</p>
              <p className="text-[10px] text-gray-400 font-semibold mt-1">Dars kunlarida o'tiladigan mavzularni birma-bir ketma-ketlik bo'yicha qo'shing.</p>
              <button 
                onClick={() => handleOpenTopicModal()}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#1b6b6b]/10 hover:bg-[#1b6b6b] text-[#1b6b6b] hover:text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer"
              >
                <Plus size={13} />
                Mavzu qo'shish
              </button>
            </div>
          ) : (
            <div className="relative border-l border-gray-100 dark:border-gray-700 ml-4 pl-6 space-y-6">
              {syllabusTopics.map((t, idx) => (
                <div key={t.id} className="relative group">
                  {/* Timeline dot showing lesson number */}
                  <span className="absolute -left-[37px] top-1.5 w-6 h-6 rounded-full bg-[#1b6b6b] text-white flex items-center justify-center text-[9px] font-black border-4 border-white dark:border-gray-800 shadow-sm shrink-0">
                    {t.order}
                  </span>

                  <div className="bg-gray-55 dark:bg-gray-900/25 hover:bg-gray-55/60 dark:hover:bg-gray-900/40 p-4 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-800 transition-all flex flex-col sm:flex-row justify-between gap-4 items-start">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{t.title}</h4>
                      </div>
                      {t.description ? (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">{t.description}</p>
                      ) : (
                        <span className="text-[9px] text-gray-400 italic block font-bold">Tavsif kiritilmagan</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-start shrink-0">
                      <button 
                        onClick={() => handleOpenTopicModal(t)}
                        className="p-1.5 hover:bg-white dark:hover:bg-gray-800 text-gray-400 hover:text-gray-750 dark:hover:text-white rounded-lg border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all cursor-pointer"
                        title="Tahrirlash"
                      >
                        <Edit size={13} />
                      </button>
                      <button 
                        onClick={() => handleDeleteTopic(t.id)}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-400 hover:text-rose-600 rounded-lg border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all cursor-pointer"
                        title="O'chirish"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Topic Add/Edit Modal */}
      {isTopicModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                {editingTopic ? "Mavzuni tahrirlash" : "Yangi mavzu/dars qo'shish"}
              </h2>
              <button 
                onClick={() => setIsTopicModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-gray-55 dark:bg-gray-700/50 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTopic} className="p-6 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1">
                  <label className={labelCls}>Dars # *</label>
                  <input 
                    type="number" 
                    required 
                    min={1}
                    className={inputCls} 
                    value={topicForm.order} 
                    onChange={e => setTopicForm({ ...topicForm, order: Number(e.target.value) })} 
                  />
                </div>
                <div className="col-span-3">
                  <label className={labelCls}>Mavzu nomi *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Masalan: React component life-cycle" 
                    className={inputCls} 
                    value={topicForm.title} 
                    onChange={e => setTopicForm({ ...topicForm, title: e.target.value })} 
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Mavzu tavsifi / Uyga vazifa / Izoh</label>
                <textarea 
                  rows={4}
                  placeholder="Darsda o'tiladigan qismlar yoki uyga vazifalarni qisqacha yozing..." 
                  className={`${inputCls} resize-none`} 
                  value={topicForm.description} 
                  onChange={e => setTopicForm({ ...topicForm, description: e.target.value })} 
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                <button 
                  type="button" 
                  onClick={() => setIsTopicModalOpen(false)}
                  className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button 
                  type="submit" 
                  className="flex items-center gap-2 px-6 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                >
                  <Save size={14} />
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
