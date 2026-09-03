import React, { useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import {
  Plus, Edit, Trash2, BookOpen, Save, X, ExternalLink,
  GripVertical, Copy, Layers
} from 'lucide-react';
import { Syllabus, Topic } from '../types';

/** Dars materiallari uchun belgilar. Bazada "PDF,Video" ko'rinishida saqlanadi. */
const MATERIAL_KINDS = ['PDF', 'Video', 'Test'] as const;
const STATUSES = ['Rejada', 'Jarayonda', 'Tugallangan'] as const;

const parseMaterials = (raw?: string | null): string[] =>
  (raw || '').split(',').map(s => s.trim()).filter(Boolean);

/** Moduli ko'rsatilmagan mavzular shu nom ostida bir guruhga yig'iladi. */
const NO_MODULE = 'Boshqa mavzular';

type ModuleGroup = { name: string; topics: Topic[] };

/** Mavzularni modul bo'yicha guruhlaydi. Modullar tartibi — ichidagi eng birinchi
 *  darsning tartib raqami bo'yicha, ya'ni darslar ketma-ketligiga mos keladi. */
function groupByModule(sortedTopics: Topic[]): ModuleGroup[] {
  const groups: ModuleGroup[] = [];
  const index = new Map<string, ModuleGroup>();
  sortedTopics.forEach(t => {
    const name = (t.moduleName || '').trim() || NO_MODULE;
    let g = index.get(name);
    if (!g) {
      g = { name, topics: [] };
      index.set(name, g);
      groups.push(g);
    }
    g.topics.push(t);
  });
  return groups;
}

/** Modul holati mavzular holatidan kelib chiqadi: hammasi tugagan bo'lsa —
 *  "Tugallangan", bittasi ham boshlanmagan bo'lsa — "Rejada", oraliqda — "Jarayonda". */
function moduleStatus(topics: Topic[]): typeof STATUSES[number] {
  const done = topics.filter(t => t.status === 'Tugallangan').length;
  const started = topics.filter(t => t.status === 'Jarayonda' || t.status === 'Tugallangan').length;
  if (done === topics.length && topics.length > 0) return 'Tugallangan';
  if (started > 0) return 'Jarayonda';
  return 'Rejada';
}

const STATUS_STYLES: Record<string, string> = {
  Tugallangan: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40',
  Jarayonda: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40',
  Rejada: 'bg-gray-55 text-gray-400 border-gray-100 dark:bg-[#0b111a]/50 dark:text-gray-400 dark:border-[#232d42]/50',
};

const MATERIAL_STYLES: Record<string, string> = {
  PDF: 'bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40',
  Video: 'bg-violet-50 text-violet-500 border-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/40',
  Test: 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/40',
};

export default function SyllabusManager() {
  const {
    syllabuses, addSyllabus, updateSyllabus, deleteSyllabus,
    topics, addTopic, updateTopic, deleteTopic, groups, courses
  } = useCRM();
  const confirm = useConfirm();

  const [selectedSyllabusId, setSelectedSyllabusId] = useState<number | null>(null);

  const [isSyllabusModalOpen, setIsSyllabusModalOpen] = useState(false);
  const [editingSyllabus, setEditingSyllabus] = useState<Syllabus | null>(null);
  const [syllabusForm, setSyllabusForm] = useState({ name: '', materials: '' });

  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [topicForm, setTopicForm] = useState({
    title: '', description: '', order: 1,
    moduleName: '', hours: '' as string, materials: [] as string[], status: 'Rejada' as string,
  });

  const [draggedTopicId, setDraggedTopicId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Ro'yxatdagi birinchi dastur avtomatik ochiladi — maketdagidek, sahifa
  // almashtirmasdan chapdan o'ngga qarab ishlash uchun.
  const activeSyllabusId = selectedSyllabusId ?? syllabuses[0]?.id ?? null;
  const activeSyllabus = syllabuses.find(s => s.id === activeSyllabusId) || null;

  const topicsOf = useMemo(() => {
    const map = new Map<number, Topic[]>();
    (topics || []).forEach(t => {
      if (t.syllabusId == null) return;
      const list = map.get(t.syllabusId);
      if (list) list.push(t); else map.set(t.syllabusId, [t]);
    });
    map.forEach(list => list.sort((a, b) => a.order - b.order));
    return map;
  }, [topics]);

  const groupsOf = useMemo(() => {
    const map = new Map<number, typeof groups>();
    (groups || []).forEach(g => {
      const sid = g.syllabusId || courses.find(c => c.id === g.courseId)?.syllabusId;
      if (!sid) return;
      const list = map.get(sid);
      if (list) list.push(g); else map.set(sid, [g]);
    });
    return map;
  }, [groups, courses]);

  const syllabusTopics = activeSyllabusId ? (topicsOf.get(activeSyllabusId) || []) : [];
  const linkedGroups = activeSyllabusId ? (groupsOf.get(activeSyllabusId) || []) : [];
  const modules = useMemo(() => groupByModule(syllabusTopics), [syllabusTopics]);
  const totalHours = syllabusTopics.reduce((sum, t) => sum + (t.hours || 0), 0);
  const knownModules = useMemo(
    () => Array.from(new Set((topics || []).map(t => (t.moduleName || '').trim()).filter(Boolean))),
    [topics]
  );

  // --- Dastur CRUD ---
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
        const created = await addSyllabus({
          name: syllabusForm.name.trim(),
          materials: syllabusForm.materials.trim() || null
        });
        if (created?.id) setSelectedSyllabusId(created.id);
      }
      setIsSyllabusModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSyllabus = async (id: number) => {
    if (await confirm("Haqiqatan ham ushbu o'quv dasturini o'chirmoqchisiz? Kurslardagi bog'liqliklar bekor qilinadi.")) {
      try {
        await deleteSyllabus(id);
        if (activeSyllabusId === id) setSelectedSyllabusId(null);
      } catch (err) {
        console.error(err);
      }
    }
  };

  /** Dasturni barcha mavzulari bilan nusxalaydi — o'xshash kursni noldan
   *  terib chiqmaslik uchun. */
  const handleDuplicateSyllabus = async () => {
    if (!activeSyllabus || isDuplicating) return;
    if (!await confirm(`"${activeSyllabus.name}" dasturi ${syllabusTopics.length} ta mavzusi bilan nusxalansinmi?`)) return;
    setIsDuplicating(true);
    try {
      const copy = await addSyllabus({
        name: `${activeSyllabus.name} (nusxa)`,
        materials: activeSyllabus.materials || null,
      });
      for (const t of syllabusTopics) {
        await addTopic({
          title: t.title,
          description: t.description || undefined,
          order: t.order,
          moduleName: t.moduleName || null,
          hours: t.hours ?? null,
          materials: t.materials || null,
          status: t.status || null,
          syllabusId: copy.id,
        });
      }
      setSelectedSyllabusId(copy.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDuplicating(false);
    }
  };

  // --- Mavzu CRUD ---
  const handleOpenTopicModal = (topic?: Topic, presetModule?: string) => {
    if (topic) {
      setEditingTopic(topic);
      setTopicForm({
        title: topic.title,
        description: topic.description || '',
        order: topic.order,
        moduleName: topic.moduleName || '',
        hours: topic.hours != null ? String(topic.hours) : '',
        materials: parseMaterials(topic.materials),
        status: topic.status || 'Rejada',
      });
    } else {
      setEditingTopic(null);
      setTopicForm({
        title: '', description: '',
        order: syllabusTopics.length + 1,
        moduleName: presetModule && presetModule !== NO_MODULE ? presetModule : '',
        hours: '', materials: [], status: 'Rejada',
      });
    }
    setIsTopicModalOpen(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicForm.title.trim() || !activeSyllabusId) return;
    const payload = {
      title: topicForm.title.trim(),
      description: topicForm.description.trim() || null,
      order: Number(topicForm.order),
      moduleName: topicForm.moduleName.trim() || null,
      hours: topicForm.hours.trim() === '' ? null : Number(topicForm.hours),
      materials: topicForm.materials.join(',') || null,
      status: topicForm.status || null,
    };
    try {
      if (editingTopic) {
        await updateTopic(editingTopic.id, payload);
      } else {
        await addTopic({ ...payload, syllabusId: activeSyllabusId });
      }
      setIsTopicModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTopic = async (id: number) => {
    if (await confirm("Ushbu dars/mavzuni o'quv programmasidan o'chirmoqchisiz?")) {
      try {
        await deleteTopic(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  /** Bir dars boshqasining oldiga tashlanganda: mavzu maqsad modulga o'tadi va
   *  butun dastur bo'yicha tartib raqamlari qaytadan 1..N qilib yoziladi.
   *  Faqat raqami o'zgargan mavzular serverga yuboriladi. */
  const handleDropOnTopic = async (targetId: number) => {
    const sourceId = draggedTopicId;
    setDraggedTopicId(null);
    setDropTargetId(null);
    if (sourceId == null || sourceId === targetId || isReordering) return;

    const source = syllabusTopics.find(t => t.id === sourceId);
    const target = syllabusTopics.find(t => t.id === targetId);
    if (!source || !target) return;

    const rest = syllabusTopics.filter(t => t.id !== sourceId);
    const targetIndex = rest.findIndex(t => t.id === targetId);
    if (targetIndex === -1) return;
    const reordered = [...rest.slice(0, targetIndex), source, ...rest.slice(targetIndex)];

    const targetModule = (target.moduleName || '').trim() || null;
    const sourceModule = (source.moduleName || '').trim() || null;

    setIsReordering(true);
    try {
      for (let i = 0; i < reordered.length; i++) {
        const topic = reordered[i];
        const nextOrder = i + 1;
        const moduleChanged = topic.id === sourceId && targetModule !== sourceModule;
        if (topic.order === nextOrder && !moduleChanged) continue;
        await updateTopic(topic.id, moduleChanged
          ? { order: nextOrder, moduleName: targetModule }
          : { order: nextOrder });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsReordering(false);
    }
  };

  const labelCls = "block text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-2";
  const inputCls = "w-full px-4 py-3 bg-gray-55 dark:bg-[#0b111a] border border-gray-100 dark:border-[#232d42] rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Sahifa sarlavhasi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">O'quv programmasi</h1>
          <p className="text-xs text-gray-400 font-bold mt-1 tabular-nums">
            {syllabuses.length} ta fan dasturi · {(topics || []).filter(t => t.syllabusId != null).length} mavzu · materiallar bazasi
          </p>
        </div>
        <button
          onClick={() => handleOpenSyllabusModal()}
          className="flex items-center gap-2 px-5 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-2xl text-[11px] font-bold uppercase tracking-wider shadow-sm shadow-[#1b6b6b]/20 active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus size={14} />
          Dastur yaratish
        </button>
      </div>

      {syllabuses.length === 0 ? (
        <div className="bg-white dark:bg-[#151c2c] rounded-3xl border border-gray-100 dark:border-[#232d42]/50 p-12 text-center max-w-lg mx-auto">
          <BookOpen size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-sm font-black text-gray-900 dark:text-white">O'quv programmalari yo'q</h3>
          <p className="text-xs text-gray-400 font-bold mt-2">Hali hech qanday o'quv programmasi yaratilmagan. Darslar ketma-ketligi va o'quv qo'llanmalarini shakllantirish uchun yangi o'quv dasturini qo'shing.</p>
          <button
            onClick={() => handleOpenSyllabusModal()}
            className="mt-6 inline-flex items-center gap-2 px-5 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-2xl text-[11px] font-bold uppercase tracking-wider shadow-sm shadow-[#1b6b6b]/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={14} />
            Dastur yaratish
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Chap panel: fanlar ro'yxati */}
          <div className="lg:col-span-1 bg-white dark:bg-[#151c2c] rounded-3xl border border-gray-100 dark:border-[#232d42]/50 p-3 shadow-sm">
            <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider px-3 py-2">Fanlar</p>
            <div className="space-y-1">
              {syllabuses.map(s => {
                const count = (topicsOf.get(s.id) || []).length;
                const linked = (groupsOf.get(s.id) || []).length;
                const isActive = s.id === activeSyllabusId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSyllabusId(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer border ${isActive
                      ? 'bg-[#1b6b6b]/5 border-[#1b6b6b]/20 dark:bg-[#1b6b6b]/15'
                      : 'border-transparent hover:bg-gray-55 dark:hover:bg-gray-900/40'}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-black uppercase ${isActive
                      ? 'bg-[#1b6b6b] text-white'
                      : 'bg-gray-55 dark:bg-[#0b111a] text-gray-400 border border-gray-100 dark:border-[#232d42]/50'}`}>
                      {s.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <span className={`block text-xs font-black tracking-tight truncate ${isActive ? 'text-[#1b6b6b] dark:text-teal-300' : 'text-gray-900 dark:text-white'}`}>
                        {s.name}
                      </span>
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5 tabular-nums">
                        {count} mavzu · {linked > 0 ? `${linked} guruh` : 'guruh yo\'q'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* O'ng panel: tanlangan dastur */}
          <div className="lg:col-span-3 space-y-6">
            {activeSyllabus && (
              <div className="bg-white dark:bg-[#151c2c] rounded-3xl border border-gray-100 dark:border-[#232d42]/50 shadow-sm overflow-hidden">
                <div className="p-6 flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-gray-55 dark:border-[#232d42]/50">
                  <div className="min-w-0">
                    <h2 className="text-base font-black text-gray-900 dark:text-white tracking-tight">{activeSyllabus.name}</h2>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1 tabular-nums">
                      {syllabusTopics.length} mavzu
                      {totalHours > 0 && <> · {totalHours} akademik soat</>}
                      {' · '}
                      {linkedGroups.length > 0 ? `${linkedGroups.length} guruhda ishlatilmoqda` : 'guruhga ulanmagan'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      onClick={handleDuplicateSyllabus}
                      disabled={isDuplicating}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gray-55 dark:bg-[#0b111a] text-gray-600 dark:text-gray-300 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-gray-100 dark:border-[#232d42] hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Copy size={13} />
                      {isDuplicating ? 'Nusxalanmoqda…' : 'Nusxa olish'}
                    </button>
                    <button
                      onClick={() => handleOpenSyllabusModal(activeSyllabus)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gray-55 dark:bg-[#0b111a] text-gray-600 dark:text-gray-300 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-gray-100 dark:border-[#232d42] hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer"
                    >
                      <Edit size={13} />
                      Tahrirlash
                    </button>
                    <button
                      onClick={() => handleDeleteSyllabus(activeSyllabus.id)}
                      className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-500 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/40 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                      title="Dasturni o'chirish"
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      onClick={() => handleOpenTopicModal()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                    >
                      <Plus size={13} />
                      Mavzu
                    </button>
                  </div>
                </div>

                {activeSyllabus.materials && (
                  <div className="px-6 py-4 bg-gray-55/50 dark:bg-[#0b111a]/25 border-b border-gray-55 dark:border-[#232d42]/50">
                    <span className="text-[10px] font-extrabold text-[#1b6b6b] uppercase tracking-wider block mb-1">O'quv qo'llanmalari</span>
                    <p className="text-[12px] text-gray-600 dark:text-gray-350 leading-relaxed font-semibold">{activeSyllabus.materials}</p>
                  </div>
                )}

                {syllabusTopics.length === 0 ? (
                  <div className="py-16 text-center">
                    <BookOpen size={36} className="text-gray-300 dark:text-gray-650 mx-auto mb-3" />
                    <p className="text-xs text-gray-450 font-bold">Dasturda hali mavzular yo'q</p>
                    <p className="text-[11px] text-gray-400 font-semibold mt-1">Dars kunlarida o'tiladigan mavzularni ketma-ketlik bo'yicha qo'shing.</p>
                    <button
                      onClick={() => handleOpenTopicModal()}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#1b6b6b]/10 hover:bg-[#1b6b6b] text-[#1b6b6b] hover:text-white rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <Plus size={13} />
                      Mavzu qo'shish
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-55 dark:divide-gray-700/50">
                    {modules.map((mod, modIdx) => {
                      const status = moduleStatus(mod.topics);
                      const modHours = mod.topics.reduce((sum, t) => sum + (t.hours || 0), 0);
                      return (
                        <div key={mod.name}>
                          {/* Modul sarlavhasi */}
                          <div className="flex items-center justify-between gap-3 px-6 py-3.5 bg-gray-55/40 dark:bg-[#0b111a]/20">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-[#1b6b6b]/10 text-[#1b6b6b] dark:bg-[#1b6b6b]/25 dark:text-teal-300 flex items-center justify-center text-[11px] font-black shrink-0 tabular-nums">
                                {modIdx + 1}
                              </span>
                              <h4 className="text-xs font-black text-gray-900 dark:text-white tracking-tight truncate">{mod.name}</h4>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider tabular-nums hidden sm:inline">
                                {mod.topics.length} dars{modHours > 0 && ` · ${modHours} soat`}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wider ${STATUS_STYLES[status]}`}>
                                {status}
                              </span>
                            </div>
                          </div>

                          {/* Modul darslari */}
                          {mod.topics.map(topic => {
                            const mats = parseMaterials(topic.materials);
                            const isDragging = draggedTopicId === topic.id;
                            const isDropTarget = dropTargetId === topic.id && draggedTopicId !== topic.id;
                            return (
                              <div
                                key={topic.id}
                                draggable={!isReordering}
                                onDragStart={() => setDraggedTopicId(topic.id)}
                                onDragEnd={() => { setDraggedTopicId(null); setDropTargetId(null); }}
                                onDragOver={e => { e.preventDefault(); setDropTargetId(topic.id); }}
                                onDragLeave={() => setDropTargetId(prev => prev === topic.id ? null : prev)}
                                onDrop={e => { e.preventDefault(); handleDropOnTopic(topic.id); }}
                                className={`group flex items-center gap-3 px-6 py-3 transition-all ${isDragging ? 'opacity-40' : ''} ${isDropTarget ? 'border-t-2 border-[#1b6b6b] bg-[#1b6b6b]/5' : 'border-t-2 border-transparent'} hover:bg-gray-55/60 dark:hover:bg-gray-900/30`}
                              >
                                <GripVertical size={14} className="text-gray-300 dark:text-gray-600 shrink-0 cursor-grab active:cursor-grabbing" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100 truncate">{topic.title}</p>
                                  {topic.description && (
                                    <p className="text-[11px] text-gray-400 font-semibold truncate mt-0.5">{topic.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {mats.map(m => (
                                    <span key={m} className={`px-1.5 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${MATERIAL_STYLES[m] || MATERIAL_STYLES.Test}`}>
                                      {m}
                                    </span>
                                  ))}
                                  {topic.status === 'Jarayonda' && (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${STATUS_STYLES.Jarayonda}`}>
                                      Jarayonda
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] font-bold text-gray-400 tabular-nums w-14 text-right shrink-0">
                                  {topic.hours ? `${topic.hours} soat` : '—'}
                                </span>
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleOpenTopicModal(topic)}
                                    className="p-1.5 hover:bg-white dark:hover:bg-gray-800 text-gray-400 hover:text-gray-750 dark:hover:text-white rounded-lg border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all cursor-pointer"
                                    title="Tahrirlash"
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTopic(topic.id)}
                                    className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-400 hover:text-rose-600 rounded-lg border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all cursor-pointer"
                                    title="O'chirish"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          <div className="px-6 pb-3 pt-1">
                            <button
                              onClick={() => handleOpenTopicModal(undefined, mod.name)}
                              className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 hover:text-[#1b6b6b] flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Plus size={11} /> Shu modulga dars
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <p className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Darsni ushlab boshqa joyga tashlab tartibini yoki modulini o'zgartiring
                      {isReordering && <span className="text-[#1b6b6b] ml-2">saqlanmoqda…</span>}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Biriktirilgan guruhlar */}
            {activeSyllabus && (
              <div className="bg-white dark:bg-[#151c2c] p-6 rounded-3xl border border-gray-100 dark:border-[#232d42]/50 shadow-sm space-y-4">
                <h3 className="text-xs font-black text-gray-900 dark:text-white border-b border-gray-55 dark:border-[#232d42]/50 pb-3 flex items-center gap-2">
                  <Layers size={13} className="text-[#1b6b6b]" />
                  Biriktirilgan guruhlar
                </h3>
                {linkedGroups.length === 0 ? (
                  <p className="text-xs text-gray-400 italic font-bold py-2">Ushbu dastur hali hech bir guruhga ulanmagan. Guruh sahifasida "O'quv programmasi" bo'limidan ulanadi.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {linkedGroups.map(g => (
                      <div key={g.id} className="flex items-center justify-between p-3 bg-gray-55 dark:bg-[#0b111a]/20 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all">
                        <div className="min-w-0">
                          <span className="text-xs font-black text-gray-800 dark:text-white block tracking-tight truncate">{g.name}</span>
                          <span className="text-[11px] text-gray-400 font-bold block mt-0.5">{g.schedule} • {g.days}</span>
                        </div>
                        <a
                          href={`/courses/${g.id}`}
                          className="p-2 bg-white dark:bg-gray-850 hover:bg-teal-50 dark:hover:bg-teal-950/20 text-gray-400 hover:text-[#1b6b6b] border border-gray-100 dark:border-[#232d42] rounded-xl transition-all cursor-pointer shrink-0"
                          title="Guruhga o'tish"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dastur qo'shish / tahrirlash */}
      {isSyllabusModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151c2c] rounded-3xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-[#232d42] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-[#232d42]/50 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 dark:text-white">
                {editingSyllabus ? "Dasturni tahrirlash" : "Yangi o'quv dasturi yaratish"}
              </h2>
              <button aria-label="Yopish"
                onClick={() => setIsSyllabusModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-gray-55 dark:bg-gray-700/50 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSyllabus} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Dastur nomi *</label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Matematika · abituriyent kursi"
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

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-[#232d42]/50">
                <button
                  type="button"
                  onClick={() => setIsSyllabusModalOpen(false)}
                  className="px-5 py-3 rounded-2xl text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-2xl text-[11px] font-bold uppercase tracking-wider shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                >
                  <Save size={14} />
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mavzu qo'shish / tahrirlash */}
      {isTopicModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151c2c] rounded-3xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-[#232d42] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-[#232d42]/50 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 dark:text-white">
                {editingTopic ? "Mavzuni tahrirlash" : "Yangi mavzu/dars qo'shish"}
              </h2>
              <button aria-label="Yopish"
                onClick={() => setIsTopicModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-gray-55 dark:bg-gray-700/50 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
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
                    placeholder="Masalan: Kvadrat tenglamalar"
                    className={inputCls}
                    value={topicForm.title}
                    onChange={e => setTopicForm({ ...topicForm, title: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Modul (bo'lim)</label>
                  <input
                    type="text"
                    list="syllabus-modules"
                    placeholder="Masalan: Tenglama va tengsizliklar"
                    className={inputCls}
                    value={topicForm.moduleName}
                    onChange={e => setTopicForm({ ...topicForm, moduleName: e.target.value })}
                  />
                  <datalist id="syllabus-modules">
                    {knownModules.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>
                <div>
                  <label className={labelCls}>Akademik soat</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="3"
                    className={inputCls}
                    value={topicForm.hours}
                    onChange={e => setTopicForm({ ...topicForm, hours: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Materiallar</label>
                <div className="flex gap-2">
                  {MATERIAL_KINDS.map(kind => {
                    const on = topicForm.materials.includes(kind);
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setTopicForm(f => ({
                          ...f,
                          materials: on ? f.materials.filter(m => m !== kind) : [...f.materials, kind]
                        }))}
                        className={`px-3 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider border transition-all cursor-pointer ${on
                          ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white shadow'
                          : 'bg-gray-55 dark:bg-[#0b111a]/30 border-gray-100 dark:border-[#232d42] text-gray-400 hover:text-gray-600'}`}
                      >
                        {kind}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls}>Holati</label>
                <div className="grid grid-cols-3 gap-2">
                  {STATUSES.map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setTopicForm(f => ({ ...f, status: st }))}
                      className={`py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider border transition-all cursor-pointer ${topicForm.status === st
                        ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white shadow'
                        : 'bg-gray-55 dark:bg-[#0b111a]/30 border-gray-100 dark:border-[#232d42] text-gray-400 hover:text-gray-600'}`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Mavzu tavsifi / Uyga vazifa / Izoh</label>
                <textarea
                  rows={3}
                  placeholder="Darsda o'tiladigan qismlar yoki uyga vazifalarni qisqacha yozing..."
                  className={`${inputCls} resize-none`}
                  value={topicForm.description}
                  onChange={e => setTopicForm({ ...topicForm, description: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-[#232d42]/50">
                <button
                  type="button"
                  onClick={() => setIsTopicModalOpen(false)}
                  className="px-5 py-3 rounded-2xl text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-2xl text-[11px] font-bold uppercase tracking-wider shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer"
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
