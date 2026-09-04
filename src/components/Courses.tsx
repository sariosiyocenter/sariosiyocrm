import React, { useState } from 'react';
import { Search, Plus, X, Users, Layers, ChevronRight, SlidersHorizontal, BookOpen, DollarSign } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';

const inp = "w-full px-4 py-3 bg-ichki border border-gray-100 dark:border-gray-750 rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[11px] font-extrabold   text-matn-xira mb-2";

export default function Courses() {
    const {
        groups, teachers, rooms, addGroup, showNotification, courses, syllabuses,
        addCourse, students, attendances, topics
    } = useCRM();
    const { t } = useLang();
    const navigate = useNavigate();

    // Modals / forms state for Courses
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        teacherId: '',
        dayType: 'all',
        roomId: '',
        timeOfDay: 'all'
    });
    const [newGroup, setNewGroup] = useState({
        name: '',
        price: '',
        teacherId: 0,
        startTime: '',
        endTime: '',
        days: 'TOQ',
        room: '',
        syllabusId: '' as number | ''
    });

    // Auto-calculate 2 hours for Course schedule
    React.useEffect(() => {
        if (newGroup.startTime && !newGroup.endTime) {
            const [h, m] = newGroup.startTime.split(':').map(Number);
            const endH = (h + 2) % 24;
            const endM = m;
            setNewGroup(prev => ({
                ...prev,
                endTime: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
            }));
        }
    }, [newGroup.startTime]);

    const checkRoomConflict = (roomId: number, days: string, start: string, end: string) => {
        return groups.find(g => {
            if (g.room !== roomId) return false;
            const daysOverlap = g.days === 'HAR_KUNI' || days === 'HAR_KUNI' || g.days === days;
            if (!daysOverlap) return false;

            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            const s1 = h1 * 60 + m1;
            const e1 = h2 * 60 + m2;

            const scheduleParts = g.schedule ? g.schedule.split(' - ') : [];
            const existingStart = scheduleParts[0];
            const existingEnd = scheduleParts[1];
            if (!existingStart || !existingEnd) return false;

            const [eh1, em1] = existingStart.split(':').map(Number);
            const [eh2, em2] = existingEnd.split(':').map(Number);
            const s2 = eh1 * 60 + em1;
            const e2 = eh2 * 60 + em2;

            return s1 < e2 && s2 < e1;
        });
    };

    const handleAddGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroup.name.trim()) {
            showNotification("Iltimos, kurs nomini kiriting.", "error");
            return;
        }
        if (!newGroup.price.trim()) {
            showNotification("Iltimos, kurs narxini kiriting.", "error");
            return;
        }
        if (!newGroup.syllabusId) {
            showNotification("Iltimos, o'quv programmasini tanlang.", "error");
            return;
        }
        try {
            const conflict = checkRoomConflict(Number(newGroup.room), newGroup.days, newGroup.startTime, newGroup.endTime);
            if (conflict) {
                const existingStart = conflict.schedule ? conflict.schedule.split(' - ')[0] : 'O\'sha vaqtda';
                showNotification(`Xona band! ${conflict.name} guruhi bilan to'qnashuv: ${existingStart}`, "error");
                return;
            }

            setIsAdding(true);

            // Find or create Course template
            let courseId: number;
            const existingCourse = courses.find(
                c => c.name.toLowerCase() === newGroup.name.trim().toLowerCase() &&
                     c.price === Number(newGroup.price.trim()) &&
                     c.syllabusId === Number(newGroup.syllabusId)
            );
            if (existingCourse) {
                courseId = existingCourse.id;
            } else {
                const newCourse = await addCourse({
                    name: newGroup.name.trim(),
                    price: Number(newGroup.price.trim()),
                    syllabusId: Number(newGroup.syllabusId)
                });
                courseId = newCourse.id;
            }

            await addGroup({
                name: newGroup.name.trim(),
                teacherId: Number(newGroup.teacherId),
                courseId: courseId,
                room: Number(newGroup.room),
                days: newGroup.days,
                schedule: `${newGroup.startTime} - ${newGroup.endTime}`,
                studentIds: [],
                syllabusId: Number(newGroup.syllabusId)
            });
            setIsModalOpen(false);
            setNewGroup({
                name: '',
                price: '',
                teacherId: 0,
                startTime: '',
                endTime: '',
                days: 'TOQ',
                room: '',
                syllabusId: ''
            });
            showNotification(t('group_added_success'), "success");
        } catch (err) {
            showNotification(t('group_added_error'), "error");
        } finally {
            setIsAdding(false);
        }
    };

    const getTeacherName = (id: number) => teachers.find(t => t.id === id)?.name || t('unknown_teacher');

    /** Guruh holati alohida maydon emas — mavjud ma'lumotdan aniqlanadi:
     *  ustozsiz guruh alohida ajratiladi, o'quvchisi yo'q guruh hali
     *  to'planmoqda, qolgani faol. */
    const groupState = (g: any): 'faol' | 'toplanmoqda' | 'ustozsiz' => {
        if (!teachers.find(tc => tc.id === g.teacherId)) return 'ustozsiz';
        if (((g.studentIds || []).length) === 0) return 'toplanmoqda';
        return 'faol';
    };

    const [stateFilter, setStateFilter] = useState<'all' | 'faol' | 'toplanmoqda' | 'ustozsiz'>('all');
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

    const stateCounts = {
        all: groups.length,
        faol: groups.filter(g => groupState(g) === 'faol').length,
        toplanmoqda: groups.filter(g => groupState(g) === 'toplanmoqda').length,
        ustozsiz: groups.filter(g => groupState(g) === 'ustozsiz').length,
    };

    /** Kartochkadagi uchta ko'rsatkich va to'ldirilish. Hech biri o'ylab
     *  topilmaydi: ma'lumot bo'lmasa "—" qaytadi. */
    const getGroupStats = (group: any) => {
        const ids: number[] = group.studentIds || [];
        const members = (students || []).filter(st => ids.includes(st.id));
        const capacity = rooms.find(r => r.id === group.room)?.capacity || null;

        const paidCount = members.filter(st => (st.balance || 0) >= 0).length;
        const payRate = members.length ? Math.round((paidCount / members.length) * 100) : null;

        const att = (attendances || []).filter(a => a.groupId === group.id);
        const attRate = att.length
            ? Math.round((att.filter(a => a.status === 'Keldi').length / att.length) * 100)
            : null;

        const syllabusId = group.syllabusId || courses.find(c => c.id === group.courseId)?.syllabusId;
        const totalTopics = syllabusId ? (topics || []).filter(tp => tp.syllabusId === syllabusId).length : 0;
        const doneTopics = new Set(att.map(a => a.topicId).filter(Boolean)).size;

        return { members: members.length, capacity, payRate, attRate, doneTopics, totalTopics };
    };
    const getCoursePrice = (courseId: number) => {
        const c = courses.find(c => c.id === courseId);
        return c ? c.price : 0;
    };

    const filteredGroups = groups.filter(g => {
        const lowerSearch = search.toLowerCase();
        const matchesSearch = (g.name || '').toLowerCase().includes(lowerSearch);

        const matchesTeacher = !filters.teacherId || g.teacherId === Number(filters.teacherId);
        const matchesRoom = !filters.roomId || g.room === Number(filters.roomId);

        let matchesDay = true;
        if (filters.dayType !== 'all') {
            matchesDay = g.days === filters.dayType;
        }

        let matchesTime = true;
        const scheduleParts = g.schedule ? g.schedule.split(' - ') : [];
        const startTime = scheduleParts[0];
        if (filters.timeOfDay !== 'all' && startTime) {
            const hour = parseInt(startTime.split(':')[0]);
            if (filters.timeOfDay === 'morning') matchesTime = hour < 12;
            else if (filters.timeOfDay === 'afternoon') matchesTime = hour >= 12 && hour < 18;
            else if (filters.timeOfDay === 'evening') matchesTime = hour >= 18;
        }

        const matchesState = stateFilter === 'all' || groupState(g) === stateFilter;
        return matchesSearch && matchesTeacher && matchesDay && matchesRoom && matchesTime && matchesState;
    });

    return (
        <div className="space-y-6">
            {/* Courses Header & Filters */}
            <div>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-[26px] font-bold text-matn tracking-tight leading-tight">{t('groups_title')}</h1>
                            <p className="text-[13px] text-matn-sokin mt-1">
                                <span className="num">{stateCounts.faol}</span> faol guruh · <span className="num">{groups.reduce((n, g) => n + ((g.studentIds || []).length), 0)}</span> o'quvchi
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-sirt p-1 rounded-xl border border-chiziq">
                            {(['cards', 'table'] as const).map(mode => (
                                <button key={mode} onClick={() => setViewMode(mode)}
                                    className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${viewMode === mode
                                        ? 'bg-brand text-brand-ust'
                                        : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-200'}`}>
                                    {mode === 'cards' ? 'Kartalar' : 'Jadval'}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-matn-xira" />
                            <input
                                type="text" placeholder={t('search_group_placeholder')}
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2.5 bg-ichki border border-gray-100 dark:border-gray-750 rounded-xl text-xs font-bold text-matn outline-none focus:border-brand transition-all w-52"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${showFilters ? 'bg-brand border-brand text-white' : 'bg-ichki border-chiziq text-matn-xira hover:border-brand'}`}
                        >
                            <SlidersHorizontal size={15} />
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-extrabold shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> {t('add')}
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="mt-4 p-5 bg-sirt border border-chiziq rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className={lbl}>{t('group_teacher')}</label>
                            <select value={filters.teacherId} onChange={e => setFilters({...filters, teacherId: e.target.value})}
                                className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-brand transition-all cursor-pointer">
                                <option value="">{t('all')}</option>
                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>{t('days')}</label>
                            <select value={filters.dayType} onChange={e => setFilters({...filters, dayType: e.target.value})}
                                className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-brand transition-all cursor-pointer">
                                <option value="all">{t('all')}</option>
                                <option value="TOQ">{t('odd_days')}</option>
                                <option value="JUFT">{t('even_days')}</option>
                                <option value="HAR_KUNI">{t('every_day')}</option>
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>{t('group_room')}</label>
                            <select value={filters.roomId} onChange={e => setFilters({...filters, roomId: e.target.value})}
                                className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-gray-700 dark:text-white outline-none focus:border-brand transition-all cursor-pointer">
                                <option value="">{t('all')}</option>
                                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button onClick={() => setFilters({teacherId: '', dayType: 'all', roomId: '', timeOfDay: 'all'})}
                                className="w-full py-2 text-[11px] font-extrabold text-rose-500 hover:text-rose-600 flex items-center justify-center gap-1.5 cursor-pointer">
                                <X size={12} /> {t('filter_clear')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Courses Grid */}

            {/* Holat chiplari. Alohida "status" maydoni yo'q, shuning uchun holat
                mavjud ma'lumotdan aniqlanadi — ustozsiz guruh alohida ajratiladi,
                chunki uni tezda ko'rish kerak bo'ladi. */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {([
                    ['all', t('all'), stateCounts.all, false],
                    // Jami bilan teng bo'lsa ko'rsatilmaydi — ikkita bir xil raqamli chip chalkashtiradi.
                    ['faol', t('status_active'), stateCounts.faol === stateCounts.all ? 0 : stateCounts.faol, false],
                    ['toplanmoqda', "Yangi to'planmoqda", stateCounts.toplanmoqda, false],
                    ['ustozsiz', "Ustoz yo'q", stateCounts.ustozsiz, true],
                ] as const).map(([key, label, count, warn]) => (
                    count > 0 || key === 'all' ? (
                        <button key={key} onClick={() => setStateFilter(key as any)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium border transition-colors cursor-pointer shrink-0 ${stateFilter === key
                                ? (warn ? 'bg-rose-500 border-rose-500 text-white' : 'bg-brand border-brand text-white')
                                : warn
                                    ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/40 text-rose-500 hover:border-rose-300'
                                    : 'bg-sirt border-chiziq text-matn-sokin hover:text-brand hover:border-brand'}`}>
                            {label} <span className="num opacity-60">{count}</span>
                        </button>
                    ) : null
                ))}
            </div>

            {filteredGroups.length === 0 ? (
                <div className="py-24 text-center bg-sirt rounded-2xl border border-chiziq border-dashed">
                    <Layers size={40} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
                    <p className="text-sm font-bold text-matn-xira">{t('no_groups_found')}</p>
                    <button onClick={() => setIsModalOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-brand-ust text-xs font-extrabold rounded-xl cursor-pointer">
                        <Plus size={13} /> {t('new_group_title')}
                    </button>
                </div>
            ) : (
                viewMode === 'table' ? (
                <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left min-w-[760px]">
                            <thead>
                                <tr className="border-b border-chiziq">
                                    <th className="px-5 py-3 text-[11px] font-medium text-matn-xira">{t('group_name')}</th>
                                    <th className="px-3 py-3 text-[11px] font-medium text-matn-xira">{t('group_teacher')}</th>
                                    <th className="px-3 py-3 text-[11px] font-medium text-matn-xira">{t('time')}</th>
                                    <th className="px-3 py-3 text-[11px] font-medium text-matn-xira text-right">O'quvchi</th>
                                    <th className="px-3 py-3 text-[11px] font-medium text-matn-xira text-right">{t('payments_tab')}</th>
                                    <th className="px-5 py-3 text-[11px] font-medium text-matn-xira text-right">{t('attendance')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-chiziq-mayin dark:divide-gray-700/40">
                                {filteredGroups.map(group => {
                                    const st = getGroupStats(group);
                                    const teacher = teachers.find(tc => tc.id === group.teacherId);
                                    return (
                                        <tr key={group.id} onClick={() => navigate(`/courses/${group.id}`)}
                                            className="group hover:bg-ichki transition-colors cursor-pointer">
                                            <td className="px-5 py-3 text-[13px] font-medium text-matn group-hover:text-brand transition-colors">{group.name}</td>
                                            <td className={`px-3 py-3 text-[12px] ${teacher ? 'text-matn-sokin' : 'text-amber-500'}`}>
                                                {teacher?.name || "Biriktirilmagan"}
                                            </td>
                                            <td className="px-3 py-3 text-[12px] text-matn-sokin">
                                                {group.days === 'TOQ' ? t('odd_days') : group.days === 'JUFT' ? t('even_days') : t('every_day')}
                                            </td>
                                            <td className="num px-3 py-3 text-[13px] text-right text-matn-2">
                                                {st.members}{st.capacity ? ` / ${st.capacity}` : ''}
                                            </td>
                                            <td className={`num px-3 py-3 text-[13px] text-right ${st.payRate === null ? 'text-matn-xira' : st.payRate >= 80 ? 'text-emerald-500' : st.payRate >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                {st.payRate === null ? '—' : `${st.payRate}%`}
                                            </td>
                                            <td className={`num px-5 py-3 text-[13px] text-right ${st.attRate === null ? 'text-matn-xira' : st.attRate >= 85 ? 'text-emerald-500' : st.attRate >= 70 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                {st.attRate === null ? '—' : `${st.attRate}%`}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredGroups.map(group => {
                        const scheduleParts = group.schedule ? group.schedule.split(' - ') : [];
                        const startTime = scheduleParts[0] || '';
                        const priceVal = getCoursePrice(group.courseId);
                        return (
                            <div key={group.id} onClick={() => navigate(`/courses/${group.id}`)}
                                className="group bg-sirt rounded-2xl border border-slate-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-brand/40 transition-all duration-300 cursor-pointer p-5 flex flex-col">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-11 h-11 rounded-xl bg-brand/10 dark:bg-brand/20 flex items-center justify-center text-brand font-bold text-lg group-hover:scale-105 transition-transform overflow-hidden shrink-0">
                                        <Layers size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-[14px] font-semibold text-matn truncate group-hover:text-brand transition-colors">{group.name}</h3>
                                        <p className={`text-[11px] truncate ${teachers.find(tc => tc.id === group.teacherId) ? 'text-matn-xira' : 'text-amber-500'}`}>
                                            {teachers.find(tc => tc.id === group.teacherId)?.name || "Ustoz biriktirilmagan"}
                                        </p>
                                    </div>
                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 shrink-0">
                                        {t('status_active')}
                                    </span>
                                </div>

                                <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-3 text-[11px] text-matn-xira">
                                    {startTime && startTime !== 'Belgilanmagan' && <span className="num">{startTime}</span>}
                                    <span>{group.days === 'TOQ' ? t('odd_days') : group.days === 'JUFT' ? t('even_days') : t('every_day')}</span>
                                    {group.room ? <span>{rooms.find(r => r.id === group.room)?.name || `#${group.room}`}</span> : null}
                                    {priceVal > 0 && <span className="num ml-auto text-brand">{priceVal.toLocaleString()}</span>}
                                </div>

                                {/* To'ldirilish va uchta ko'rsatkich — kartochkani
                                    ochmasdan guruhning ahvolini ko'rish uchun. */}
                                {(() => {
                                    const st = getGroupStats(group);
                                    const fillPct = st.capacity ? Math.min(100, Math.round((st.members / st.capacity) * 100)) : null;
                                    const barTone = fillPct === null ? 'bg-gray-300 dark:bg-gray-600'
                                        : fillPct >= 90 ? 'bg-emerald-500'
                                        : fillPct >= 60 ? 'bg-brand'
                                        : 'bg-amber-400';
                                    return (
                                        <>
                                            <div className="mt-3 pt-3 border-t border-chiziq">
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-matn-xira">To'ldirilish</span>
                                                    <span className="num text-matn-2">
                                                        {st.members}{st.capacity ? ` / ${st.capacity}` : ''}
                                                    </span>
                                                </div>
                                                {/* Sig'im faqat xona biriktirilganda ma'lum. Aks holda
                                                    chiziq chizilmaydi — bo'sh chiziq "guruh to'lmagan"
                                                    degan noto'g'ri taassurot qoldirardi. */}
                                                {fillPct !== null && (
                                                    <div className="mt-1.5 h-1.5 rounded-full bg-chiziq overflow-hidden">
                                                        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${fillPct}%` }} />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 mt-3">
                                                <div>
                                                    <span className="block text-[10px] text-matn-xira">{t('payments_tab')}</span>
                                                    <span className={`num text-[13px] font-semibold ${st.payRate === null ? 'text-matn-xira' : st.payRate >= 80 ? 'text-emerald-500' : st.payRate >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                        {st.payRate === null ? '—' : `${st.payRate}%`}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[10px] text-matn-xira">{t('attendance')}</span>
                                                    <span className={`num text-[13px] font-semibold ${st.attRate === null ? 'text-matn-xira' : st.attRate >= 85 ? 'text-emerald-500' : st.attRate >= 70 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                        {st.attRate === null ? '—' : `${st.attRate}%`}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[10px] text-matn-xira">{t('topic_label')}</span>
                                                    <span className="num text-[13px] font-semibold text-matn-2">
                                                        {st.totalTopics ? `${st.doneTopics}/${st.totalTopics}` : '—'}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        );
                    })}
                </div>
                )
            )}

            {/* Course Add Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-55 dark:border-gray-800/50">
                            <div>
                                <h3 className="text-lg font-black text-matn tracking-tight">{t('new_group_title')}</h3>
                                <p className="text-[11px] font-bold text-brand mt-0.5">{t('group_details_subtitle')}</p>
                            </div>
                            <button aria-label="Yopish" onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleAddGroup} className="space-y-4">
                            <div>
                                <label className={lbl}>{t('group_name')} *</label>
                                <input required type="text" placeholder="Matematika" className={inp} value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>Kurs Narxi (UZS/oy) *</label>
                                    <input required type="number" placeholder="400000" className={inp} value={newGroup.price} onChange={e => setNewGroup({ ...newGroup, price: e.target.value })} />
                                </div>
                                <div>
                                    <label className={lbl}>{t('group_teacher')} *</label>
                                    <select required className={inp} value={newGroup.teacherId} onChange={e => setNewGroup({ ...newGroup, teacherId: Number(e.target.value) })}>
                                        <option value={0} disabled>{t('select_placeholder')}</option>
                                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>{t('days')} *</label>
                                    <select required className={inp} value={newGroup.days} onChange={e => setNewGroup({ ...newGroup, days: e.target.value })}>
                                        <option value="TOQ">{t('odd_days_hint')}</option>
                                        <option value="JUFT">{t('even_days_hint')}</option>
                                        <option value="HAR_KUNI">{t('every_day_hint')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>{t('group_room')} *</label>
                                    <select required className={inp} value={newGroup.room} onChange={e => setNewGroup({ ...newGroup, room: e.target.value })}>
                                        <option value="" disabled>{t('select_placeholder')}</option>
                                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.capacity} {t('staff_count_unit')})</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>{t('start_time')} *</label>
                                    <input required type="time" className={inp} value={newGroup.startTime} onChange={e => setNewGroup({ ...newGroup, startTime: e.target.value })} />
                                </div>
                                <div>
                                    <label className={lbl}>{t('end_time')} *</label>
                                    <input required type="time" className={inp} value={newGroup.endTime} onChange={e => setNewGroup({ ...newGroup, endTime: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>O'quv programmasi (Syllabus) *</label>
                                <select required className={inp} value={newGroup.syllabusId} onChange={e => setNewGroup({ ...newGroup, syllabusId: e.target.value === '' ? '' : Number(e.target.value) })}>
                                    <option value="" disabled>O'quv programmasini tanlang</option>
                                    {syllabuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-755 text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700">
                                    {t('cancel')}
                                </button>
                                <button type="submit" disabled={isAdding}
                                    className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white text-xs font-extrabold rounded-2xl shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer disabled:opacity-50">
                                    {isAdding ? t('saving') : t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
