import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import StatTile from './ui/StatTile';
import { displayName } from '../lib/displayName';
import { useConfirm } from './ConfirmDialog';
import {
    Users, Calendar, Clock, BookOpen, Plus,
    XCircle, ArrowLeft, Search, ClipboardCheck, ChevronRight, Presentation, Check, Sparkles,
    CreditCard, DollarSign, Wallet, Trash2
} from 'lucide-react';
import AttendanceMatrix from './AttendanceMatrix';
import GroupAttendanceCalendar from './GroupAttendanceCalendar';
import FaceAttendance from './FaceAttendance';

export default function CourseDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { groups, students, teachers, courses, rooms, attendances, payments, addBatchAttendance, addAttendance, updateDayTopic, addStudentToGroup, removeStudentFromGroup, updateGroup, updateCourse, deleteGroup, showNotification, topics, addTopic, updateTopic, addPayment, syllabuses, loadAttendanceFor } = useCRM();
    const confirm = useConfirm();
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editForm, setEditForm] = useState({
        teacherId: 0,
        days: '',
        startTime: '',
        endTime: '',
        room: 0,
        coursePrice: 0,
        syllabusId: '' as number | ''
    });
    const [activeTab, setActiveTab] = useState('umumiy');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedTopicId, setSelectedTopicId] = useState<number | ''>('');
    const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState<any | null>(null);
    const [topicForm, setTopicForm] = useState({ title: '', description: '', order: 1 });

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<number | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentType, setPaymentType] = useState<'Naqd' | 'Karta' | 'Peyme' | 'Klik'>('Naqd');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    const [paymentMonth, setPaymentMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [isFaceAttendanceOpen, setIsFaceAttendanceOpen] = useState(false);

    const group = groups.find(g => g.id === Number(id));
    if (!group) return <div className="p-12 text-center text-matn-sokin font-medium">Kurs topilmadi</div>;

    const teacher = teachers.find(t => t.id === group.teacherId);
    const course = courses.find(c => c.id === group.courseId);
    const groupStudents = students.filter(s => (group.studentIds || []).includes(s.id));

    // "Davomat" va "Amaliy darslar" raqamlari kodda 94% va 12 deb qo'lda yozib
    // qo'yilgan edi — ya'ni har qanday guruh uchun bir xil soxta qiymat
    // ko'rsatardi. Endi ikkalasi ham shu guruhning o'z yozuvlaridan olinadi.
    const groupAttendances = (attendances || []).filter(a => a.groupId === group.id);
    const groupAttendanceRate = groupAttendances.length
        ? Math.round((groupAttendances.filter(a => a.status === 'Keldi').length / groupAttendances.length) * 100)
        : null;
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const lessonsThisMonth = new Set(
        groupAttendances.filter(a => (a.date || '').startsWith(monthPrefix)).map(a => a.date)
    ).size;
    const groupDebt = groupStudents.reduce((sum, st) => sum + (st.balance < 0 ? -st.balance : 0), 0);
    const debtorCount = groupStudents.filter(st => st.balance < 0).length;

    // Xona sig'imi — guruhga xona biriktirilgan bo'lsagina ma'lum.
    // Kiritilmagan bo'lsa nisbat chizig'i chizilmaydi: 60 o'quvchi "necha
    // foiz to'lgan" degani nimaga nisbatan ekani noma'lum.
    const roomCapacity = rooms.find(r => r.id === group.room)?.capacity || null;

    // Har o'quvchining shu guruhdagi davomati. "Dars bo'lmadi" hisobga
    // olinmaydi — bu o'quvchining aybi emas. Yozuvi yo'q o'quvchida foiz
    // ko'rsatilmaydi.
    const studentAtt = (() => {
        const acc = new Map<number, { keldi: number; jami: number }>();
        for (const a of groupAttendances) {
            if (a.status === 'Dars bo\'lmadi') continue;
            const e = acc.get(a.studentId) || { keldi: 0, jami: 0 };
            e.jami++;
            if (a.status === 'Keldi' || a.status === 'Kechikdi' || a.status === 'ErtaKetdi') e.keldi++;
            acc.set(a.studentId, e);
        }
        const out = new Map<number, number>();
        acc.forEach((v, k) => { if (v.jami) out.set(k, Math.round((v.keldi / v.jami) * 100)); });
        return out;
    })();
    const shortSum = (n: number) =>
        n >= 1000000 ? (n / 1000000).toFixed(1).replace('.0', '') + ' mln' : n.toLocaleString();


    // The attendance matrix and calendar span far more than the recent window loaded at
    // startup, so fetch this group's full history once the page opens.
    React.useEffect(() => {
        if (group.id) loadAttendanceFor({ groupId: group.id, sinceDays: 120 });
    }, [group.id]);

    // Auto-load topic for selected date
    React.useEffect(() => {
        const existing = attendances.filter(a => a.groupId === group.id && a.date === selectedDate);
        const firstRecord = existing.find(a => a.topicId !== null && a.topicId !== undefined);
        setSelectedTopicId(firstRecord?.topicId || '');
    }, [selectedDate, group.id, attendances]);

    type AttStatus = 'Keldi' | 'Kelmapdi' | 'Sababli' | "Dars bo'lmadi" | 'Kechikdi' | 'ErtaKetdi';
    const saveAttendance = (studentId: number, status: AttStatus) => {
        addAttendance({ studentId, groupId: group.id, date: selectedDate, status, topicId: selectedTopicId ? Number(selectedTopicId) : undefined });
    };
    const getStudentAttStatus = (studentId: number): AttStatus | null => {
        const rec = attendances.find(a => a.groupId === group.id && a.date === selectedDate && a.studentId === studentId);
        return (rec?.status as AttStatus) || null;
    };

    const handleSendAttendanceSms = async () => {
        if (!await confirm("Kelmagan o'quvchilar ota-onalariga SMS yuborilsinmi?")) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/sms/attendance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ groupId: group.id, date: selectedDate })
            });
            const data = await response.json();
            if (data.success) {
                showNotification(`SMS yuborish boshlandi: ${data.count} ta xabar`, "success");
            } else {
                showNotification("Xatolik: " + data.error, "error");
            }
        } catch (err) {
            console.error("SMS sending failed", err);
            showNotification("SMS yuborishda xatolik yuz berdi", "error");
        }
    };



    const handleAddStudent = async (studentId: number) => {
        await addStudentToGroup(group.id, studentId);
        setIsAddStudentModalOpen(false);
        setStudentSearch('');
    };

    const courseObj = (courses || []).find(c => c.id === group.courseId);
    const activeSyllabusId = group.syllabusId || courseObj?.syllabusId;
    const activeSyllabus = activeSyllabusId ? (syllabuses || []).find(s => s.id === activeSyllabusId) : null;
    /** Dastur bo'yicha o'zlashtirish: mavzular modul bo'yicha guruhlanadi,
     *  har modulda "Tugallangan" holatdagi mavzular ulushi. Holat O'quv reja
     *  sahifasida belgilanadi; hech qanday holat qo'yilmagan bo'lsa 0%. */
    const moduleProgress = (() => {
        const order: string[] = [];
        const map = new Map<string, { total: number; done: number }>();
        ((topics || []).filter(t => activeSyllabus && t.syllabusId === activeSyllabus.id).sort((a, b) => a.order - b.order)).forEach(t => {
            const key = (t.moduleName || '').trim() || 'Boshqa mavzular';
            if (!map.has(key)) { map.set(key, { total: 0, done: 0 }); order.push(key); }
            const m = map.get(key)!;
            m.total += 1;
            if (t.status === 'Tugallangan') m.done += 1;
        });
        return order.map(name => ({ name, ...map.get(name)! }));
    })();

    /** So'nggi 10 dars: yo'qlama yozuvlari sana bo'yicha guruhlanadi,
     *  har darsda kelganlar ulushi. */
    const recentLessons = (() => {
        const byDate = new Map<string, { total: number; present: number }>();
        (attendances || []).filter(a => a.groupId === group.id).forEach(a => {
            const d = byDate.get(a.date) || { total: 0, present: 0 };
            d.total += 1;
            if (a.status === 'Keldi') d.present += 1;
            byDate.set(a.date, d);
        });
        return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10).reverse()
            .map(([date, d]) => ({ date, pct: d.total ? Math.round((d.present / d.total) * 100) : 0 }));
    })();

    const courseTopics = activeSyllabus
        ? (topics || []).filter(t => t.syllabusId === activeSyllabus.id).sort((a, b) => a.order - b.order)
        : [];

    const handleSaveTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingTopic) {
                await updateTopic(editingTopic.id, {
                    title: topicForm.title,
                    description: topicForm.description,
                    order: Number(topicForm.order)
                });
            } else {
                if (activeSyllabusId) {
                    await addTopic({
                        title: topicForm.title,
                        description: topicForm.description,
                        order: Number(topicForm.order),
                        syllabusId: activeSyllabusId
                    });
                } else {
                    showNotification("Mavzu qo'shish uchun avval guruh kursiga o'quv programmasini biriktiring.", "error");
                    return;
                }
            }
            setIsTopicModalOpen(false);
            setEditingTopic(null);
            setTopicForm({ title: '', description: '', order: courseTopics.length + 2 });
        } catch (err) {
            console.error("Save topic failed", err);
        }
    };

    const openPaymentModal = (studentId: number) => {
        setSelectedStudentForPayment(studentId);
        const targetStudent = students.find(s => s.id === studentId);
        const studentCustomPrice = targetStudent?.customPrices && typeof targetStudent.customPrices === 'object'
            ? (targetStudent.customPrices as Record<string, number>)[group.id]
            : undefined;
        setPaymentAmount(String(studentCustomPrice !== undefined ? studentCustomPrice : (course?.price || '')));
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentType('Naqd');
        setIsPaymentModalOpen(true);
    };

    const handleAddPayment = async () => {
        if (!selectedStudentForPayment || !paymentAmount) return;
        const st = students.find(s => s.id === selectedStudentForPayment);
        try {
            await addPayment({
                studentId: selectedStudentForPayment,
                amount: Number(paymentAmount),
                type: paymentType,
                date: paymentDate,
                description: `${course?.name || group.name} — oylik to'lov`
            });
            setIsPaymentModalOpen(false);
            showNotification(`${st?.name} dan ${Number(paymentAmount).toLocaleString()} UZS qabul qilindi`, "success");
        } catch {
            showNotification("Xatolik yuz berdi", "error");
        }
    };

    // Monthly payment status based on actual payment records (not balance)
    const getMonthlyPayStatus = (studentId: number, price: number) => {
        if (!price) return null;
        const sPayments = payments.filter(p => p.studentId === studentId && p.date.startsWith(paymentMonth));
        const incoming = sPayments.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0);
        const deducted = Math.abs(sPayments.filter(p => p.amount < 0).reduce((s, p) => s + p.amount, 0));
        const monthClosed = deducted > 0;
        // prepaid = paid before month close; full = paid after close; partial = not enough; none = nothing paid
        const status = monthClosed
            ? (incoming >= deducted ? 'full' : incoming > 0 ? 'partial' : 'debt')
            : (incoming >= price ? 'prepaid' : incoming > 0 ? 'partial' : 'none');
        return { incoming, deducted, monthClosed, status };
    };

    const getPayStatus = (balance: number, customPrice?: number) => {
        const price = customPrice !== undefined ? customPrice : (course?.price || 0);
        if (!price) return null;
        if (balance >= price) return 'full';
        if (balance > 0) return 'partial';
        return 'debt';
    };

    const handleStartEdit = () => {
        const [start, end] = group.schedule.split(' - ');
        setEditForm({
            teacherId: group.teacherId,
            days: group.days,
            startTime: start || '',
            endTime: end || '',
            room: group.room || 0,
            coursePrice: course?.price || 0,
            syllabusId: group.syllabusId || ''
        });
        setIsEditingInfo(true);
    };

    const handleSaveInfo = async () => {
        try {
            // "Not chosen" is 0 in the selects, but there is no room or teacher with id 0 —
            // sending it produced a foreign key error and the save failed with a generic
            // "Xatolik yuz berdi". An empty room means no room, so send null.
            const roomId = Number(editForm.room) || null;
            const teacherId = Number(editForm.teacherId) || null;
            if (!teacherId) {
                showNotification("O'qituvchini tanlang", "error");
                return;
            }
            await updateGroup(group.id, {
                teacherId,
                days: editForm.days,
                schedule: `${editForm.startTime} - ${editForm.endTime}`,
                room: roomId,
                syllabusId: editForm.syllabusId === '' ? null : Number(editForm.syllabusId)
            });
            if (course && editForm.coursePrice !== course.price) {
                await updateCourse(course.id, { price: Number(editForm.coursePrice) });
            }
            setIsEditingInfo(false);
            showNotification("Kurs ma'lumotlari yangilandi", "success");
        } catch (err) {
            showNotification("Xatolik yuz berdi", "error");
        }
    };

    const getValidDate = (dateStr: string, pattern: string, direction: 'prev' | 'next' | 'stay' = 'stay'): string => {
        const [year, month, day] = dateStr.split('-').map(Number);
        let date = new Date(year, month - 1, day);

        const isMatch = (d: Date) => {
            const dw = d.getDay();
            if (pattern === 'TOQ') return [1, 3, 5].includes(dw);
            if (pattern === 'JUFT') return [2, 4, 6].includes(dw);
            return dw !== 0;
        };

        if (direction === 'stay' && isMatch(date)) return dateStr;

        let attempts = 0;
        const step = direction === 'prev' ? -1 : 1;

        if (direction === 'stay') {
            let nextD = new Date(date);
            let prevD = new Date(date);
            while (attempts < 7) {
                nextD.setDate(nextD.getDate() + 1);
                if (isMatch(nextD)) return nextD.toISOString().split('T')[0];
                prevD.setDate(prevD.getDate() - 1);
                if (isMatch(prevD)) return prevD.toISOString().split('T')[0];
                attempts++;
            }
        } else {
            while (attempts < 7) {
                date.setDate(date.getDate() + step);
                if (isMatch(date)) return date.toISOString().split('T')[0];
                attempts++;
            }
        }
        return dateStr;
    };

    const getDayName = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return new Intl.DateTimeFormat('uz-UZ', { weekday: 'long' }).format(date);
    };

    React.useEffect(() => {
        const valid = getValidDate(selectedDate, group.days, 'stay');
        if (valid !== selectedDate) setSelectedDate(valid);
    }, [group.days]);

    const isDayValid = (pattern: string, dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        const dw = d.getDay();
        if (pattern === 'TOQ') return [1, 3, 5].includes(dw);
        if (pattern === 'JUFT') return [2, 4, 6].includes(dw);
        return dw !== 0;
    };

    const availableStudents = students.filter(s => !(group.studentIds || []).includes(s.id) && s.name.toLowerCase().includes(studentSearch.toLowerCase()));

    const labelCls = "block text-[11px] font-extrabold   text-matn-xira mb-2";
    const inputCls = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Back Button + Delete */}
            <div className="flex items-center justify-between">
                <button onClick={() => navigate('/courses')} className="flex items-center gap-2 text-matn-xira hover:text-brand transition-all text-[11px] font-extrabold group cursor-pointer">
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    Orqaga
                </button>
                <button
                    onClick={async () => {
                        if (!await confirm(`"${group.name}" guruhini o'chirishni tasdiqlaysizmi? Bu amalni ortga qaytarib bo'lmaydi.`)) return;
                        try {
                            await deleteGroup(group.id);
                            navigate('/courses');
                        } catch {
                            showNotification("Guruhni o'chirishda xatolik yuz berdi", "error");
                        }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all text-[11px] font-extrabold cursor-pointer"
                >
                    <Trash2 size={13} />
                    Guruhni o'chirish
                </button>
            </div>

            <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                {/* Sarlavha. Avval o'ng tomonda "O'QITUVCHI / BELGILANMAGAN" degan
                    alohida quti turardi va u guruh nomidan kuchliroq ko'rinardi.
                    Endi ustoz, jadval, xona va narx — nom ostidagi bitta qatorda. */}
                <div className="p-5 border-b border-chiziq">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-xl font-semibold text-matn tracking-tight">{group.name}</h1>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 text-[11px] font-medium">Faol</span>
                        <span className="num text-[11px] font-medium text-matn-xira">#{group.id}</span>
                    </div>

                    {isEditingInfo ? (
                        <div className="flex flex-col gap-1.5 mt-4 max-w-xs">
                            <label className={labelCls}>O'qituvchi</label>
                            <select
                                value={editForm.teacherId}
                                onChange={e => setEditForm({ ...editForm, teacherId: Number(e.target.value) })}
                                className={inputCls}
                            >
                                {teachers.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        // Bitta qator, bitta ajratgich. Kiritilmagan qiymat
                        // "Belgilanmagan" bo'lib turmaydi — u shunchaki tushib
                        // qoladi, ustoz bundan mustasno: ustozsiz guruh
                        // ko'rinib turishi kerak.
                        <div className="flex items-center gap-x-2 gap-y-1 flex-wrap mt-2 text-[13px] text-matn-sokin">
                            {teacher?.name
                                ? <span className="text-matn-2">{displayName(teacher.name)}</span>
                                : <span className="text-ogoh">Ustoz biriktirilmagan</span>}
                            {group.room && (
                                <><span className="text-matn-xira">·</span>
                                <span>{rooms.find(r => r.id === group.room)?.name || `#${group.room}`}</span></>
                            )}
                            {group.schedule && !group.schedule.includes('Belgilanmagan') && (
                                <><span className="text-matn-xira">·</span>
                                <span>
                                    {group.days === 'TOQ' ? 'Toq kunlar' : group.days === 'JUFT' ? 'Juft kunlar' : group.days === 'Belgilanmagan' ? '' : 'Har kuni'}{' '}
                                    <span className="num">{group.schedule}</span>
                                </span></>
                            )}
                            {course?.price ? (
                                <><span className="text-matn-xira">·</span>
                                <span><span className="num text-matn-2">{course.price.toLocaleString('ru-RU')}</span> so'm/oy</span></>
                            ) : null}
                        </div>
                    )}
                </div>

                <div className="flex px-4 bg-ichki border-b border-chiziq gap-2 pt-2">
                    <TabButton label="Umumiy" icon={<Users size={14} />} active={activeTab === 'umumiy'} onClick={() => setActiveTab('umumiy')} />
                    <TabButton label="Yo'qlama" icon={<ClipboardCheck size={14} />} active={activeTab === 'yoqlama'} onClick={() => setActiveTab('yoqlama')} />
                    <TabButton label="To'lovlar" icon={<CreditCard size={14} />} active={activeTab === 'tolovlar'} onClick={() => setActiveTab('tolovlar')} />
                </div>

                <div className="p-5">
                    {activeTab === 'umumiy' && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatTile
                                    label="O'quvchilar"
                                    value={groupStudents.length}
                                    bar={roomCapacity ? Math.min(100, Math.round((groupStudents.length / roomCapacity) * 100)) : null}
                                    barCaption={roomCapacity
                                        ? <><span className="raqam">{roomCapacity}</span> o'rindan <span className="raqam">{Math.min(100, Math.round((groupStudents.length / roomCapacity) * 100))}%</span> band</>
                                        : undefined}
                                    subValue={roomCapacity ? undefined : "Xona sig'imi kiritilmagan"}
                                />
                                <StatTile
                                    label="Davomat"
                                    value={groupAttendanceRate === null ? '—' : groupAttendanceRate}
                                    unit={groupAttendanceRate === null ? undefined : '%'}
                                    tone={groupAttendanceRate !== null && groupAttendanceRate < 85 ? (groupAttendanceRate >= 70 ? 'warn' : 'bad') : undefined}
                                    bar={groupAttendanceRate}
                                    barTone={groupAttendanceRate === null ? 'brand' : groupAttendanceRate >= 85 ? 'good' : groupAttendanceRate >= 70 ? 'warn' : 'bad'}
                                    barCaption={<><span className="raqam">{groupAttendances.length}</span> ta yozuv asosida</>}
                                    subValue={groupAttendances.length ? undefined : "Yo'qlama qilinmagan"}
                                />
                                <StatTile
                                    label="Darslar"
                                    value={lessonsThisMonth}
                                    subValue="Shu oyda o'tildi"
                                />
                                <StatTile
                                    label="Qarzdorlik"
                                    value={groupDebt > 0 ? shortSum(groupDebt) : '0'}
                                    tone={groupDebt > 0 ? 'bad' : 'good'}
                                    accent={groupDebt > 0}
                                    subValue={debtorCount
                                        ? <><span className="raqam">{debtorCount}</span> ta o'quvchidan yig'ilmagan</>
                                        : "Qarzdor yo'q"}
                                    subTone={debtorCount ? 'bad' : 'good'}
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                <div className="lg:col-span-2 space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-55 dark:border-gray-800">
                                        <span className="text-[11px] font-bold text-matn-xira">O'quvchilar</span>
                                        <button onClick={() => setIsAddStudentModalOpen(true)}
                                            className="px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-[11px] font-extrabold shadow-sm shadow-[#1b6b6b]/20 active:scale-95 transition-all flex items-center gap-1.5 group cursor-pointer">
                                            <Plus size={14} />
                                            Qo'shish
                                        </button>
                                    </div>
                                    {/* Avval bu ro'yxat ikki ustunli kartochka gridi edi:
                                        kartaning eni tor bo'lgani uchun ismlar
                                        "ABDUHAYEVA SHAHNOZ..." bo'lib kesilardi va bir
                                        o'quvchi ikki qatorni egallardi. Jadvalda ism
                                        to'liq sig'adi va qatorlarni solishtirish oson. */}
                                    {groupStudents.length === 0 ? (
                                        <p className="py-12 text-center text-[12px] text-matn-xira">Bu kursda o'quvchilar yo'q</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse text-left min-w-[520px]">
                                                <thead>
                                                    <tr className="border-b border-chiziq">
                                                        <th className="py-2 pr-3 text-[12px] font-normal text-matn-sokin w-8">&#8470;</th>
                                                        <th className="py-2 pr-3 text-[12px] font-normal text-matn-sokin">O'quvchi</th>
                                                        <th className="py-2 px-3 text-[12px] font-normal text-matn-sokin text-right">Balans</th>
                                                        <th className="py-2 px-3 text-[12px] font-normal text-matn-sokin text-right w-20">Davomat</th>
                                                        <th className="py-2 pl-3 w-20" />
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-chiziq-mayin ">
                                                    {groupStudents.map((s, idx) => {
                                                        return (
                                                            <tr key={s.id} className="group hover:bg-gray-55/70  transition-colors">
                                                                <td className="num py-2.5 pr-3 text-[11px] text-matn-xira align-middle">
                                                                    {String(idx + 1).padStart(2, '0')}
                                                                </td>
                                                                <td className="py-2.5 pr-3 align-middle">
                                                                    <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => navigate(`/students/${s.id}`)}>
                                                                        <div className="w-8 h-8 bg-ichki border border-chiziq rounded-lg flex items-center justify-center text-brand font-semibold text-[11px] shrink-0">
                                                                            {s.name.charAt(0)}
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <p className="text-[13px] font-medium text-matn truncate group-hover:text-brand transition-colors">{displayName(s.name)}</p>
                                                                            <p className="num text-[11px] text-matn-xira truncate">{s.phone}</p>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className={`num py-2.5 px-3 text-right text-[13px] align-middle ${s.balance > 0 ? 'text-yaxshi' : s.balance < 0 ? 'text-xato' : 'text-matn-xira'}`}>
                                                                    {s.balance.toLocaleString('ru-RU')}
                                                                </td>
                                                                {/* Ilgari bu yerda "Qarzdor" belgisi turardi — yonidagi
                                                                    qizil balans allaqachon shuni aytadi. Davomat esa
                                                                    hech qayerda ko'rinmasdi. */}
                                                                <td className="py-2.5 px-3 text-right align-middle">
                                                                    {studentAtt.has(s.id) ? (
                                                                        <span className={`num text-[13px] ${
                                                                            (studentAtt.get(s.id) as number) >= 85 ? 'text-matn-2' :
                                                                            (studentAtt.get(s.id) as number) >= 70 ? 'text-ogoh' : 'text-xato'
                                                                        }`}>{studentAtt.get(s.id)}%</span>
                                                                    ) : (
                                                                        <span className="num text-[13px] text-matn-xira">&#8212;</span>
                                                                    )}
                                                                </td>
                                                                <td className="py-2.5 pl-3 align-middle">
                                                                    <div className="flex items-center justify-end gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={e => { e.stopPropagation(); openPaymentModal(s.id); }}
                                                                            title="To'lov qo'shish"
                                                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-matn-xira hover:text-white hover:bg-emerald-500 transition-colors cursor-pointer"
                                                                        >
                                                                            <CreditCard size={13} />
                                                                        </button>
                                                                        <button
                                                                            onClick={e => { e.stopPropagation(); removeStudentFromGroup(group.id, s.id); }}
                                                                            title="Kursdan chiqarish"
                                                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-matn-xira hover:text-white hover:bg-rose-500 transition-colors cursor-pointer"
                                                                        >
                                                                            <XCircle size={14} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-55 dark:border-gray-800">
                                        <span className="text-[11px] font-bold text-matn-xira">Ma'lumotlar</span>
                                        {!isEditingInfo ? (
                                            <button
                                                onClick={handleStartEdit}
                                                className="text-[11px] font-bold text-brand hover:underline cursor-pointer"
                                            >
                                                O'zgartirish
                                            </button>
                                        ) : (
                                            <div className="flex gap-2.5">
                                                <button
                                                    onClick={handleSaveInfo}
                                                    className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                                                >
                                                    Saqlash
                                                </button>
                                                <button
                                                    onClick={() => setIsEditingInfo(false)}
                                                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                                                >
                                                    Bekor
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-sirt border border-chiziq rounded-2xl p-4 space-y-4">
                                        {isEditingInfo ? (
                                            <>
                                                <div>
                                                    <label className={labelCls}>Kunlar</label>
                                                    <select
                                                        value={editForm.days}
                                                        onChange={e => setEditForm({ ...editForm, days: e.target.value })}
                                                        className={inputCls}
                                                    >
                                                        <option value="TOQ">Toq kunlar</option>
                                                        <option value="JUFT">Juft kunlar</option>
                                                        <option value="HAR_KUNI">Har kuni</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className={labelCls}>Vaqt</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="time"
                                                            value={editForm.startTime}
                                                            onChange={e => setEditForm({ ...editForm, startTime: e.target.value })}
                                                            className={inputCls}
                                                        />
                                                        <span className="text-gray-300">-</span>
                                                        <input
                                                            type="time"
                                                            value={editForm.endTime}
                                                            onChange={e => setEditForm({ ...editForm, endTime: e.target.value })}
                                                            className={inputCls}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className={labelCls}>Xona</label>
                                                    <select
                                                        value={editForm.room}
                                                        onChange={e => setEditForm({ ...editForm, room: Number(e.target.value) })}
                                                        className={inputCls}
                                                    >
                                                        <option value="">Tanlang...</option>
                                                        {rooms.map(r => (
                                                            <option key={r.id} value={r.id}>{r.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className={labelCls}>Kurs narxi (UZS/oy)</label>
                                                    <input
                                                        type="number"
                                                        placeholder="Masalan: 600000"
                                                        value={editForm.coursePrice || ''}
                                                        onChange={e => setEditForm({ ...editForm, coursePrice: Number(e.target.value) })}
                                                        className={inputCls}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelCls}>O'quv programmasi (Syllabus)</label>
                                                    <select
                                                        value={editForm.syllabusId}
                                                        onChange={e => setEditForm({ ...editForm, syllabusId: e.target.value === '' ? '' : Number(e.target.value) })}
                                                        className={inputCls}
                                                    >
                                                        <option value="">Faol dastur yo'q (Kurs mavzulari)</option>
                                                        {syllabuses.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <InfoItem icon={<Calendar size={13} />} label="Kunlar" value={group.days === 'TOQ' ? 'Toq kunlar' : group.days === 'JUFT' ? 'Juft kunlar' : 'Har kuni'} />
                                                <InfoItem icon={<Clock size={13} />} label="Vaqt" value={group.schedule} />
                                                <InfoItem icon={<Presentation size={13} />} label="Xona" value={rooms.find(r => r.id === group.room)?.name || `#${group.room || '-'}`} />
                                                <InfoItem icon={<DollarSign size={13} />} label="Kurs narxi" value={course?.price ? `${course.price.toLocaleString()} UZS` : "Belgilanmagan"} />
                                                <InfoItem icon={<BookOpen size={13} />} label="O'quv programmasi" value={activeSyllabus ? activeSyllabus.name : "Kurs mavzulari (Dastursiz)"} />
                                            </>
                                        )}
                                    </div>

                                    {/* Dastur bo'yicha o'zlashtirish. Guruh dasturning qayerida
                                        turganini ochmasdan ko'rish uchun. */}
                                    {moduleProgress.length > 0 && (
                                        <div className="pt-4 border-t border-chiziq">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-[13px] font-semibold text-matn">Dastur bo'yicha o'zlashtirish</span>
                                                <button onClick={() => navigate('/syllabus')} className="text-[12px] text-brand hover:underline cursor-pointer">Dastur →</button>
                                            </div>
                                            <div className="space-y-2.5">
                                                {moduleProgress.map((m, i) => {
                                                    const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
                                                    return (
                                                        <div key={m.name}>
                                                            <div className="flex items-center justify-between gap-3 text-[12px]">
                                                                <span className={`flex items-center gap-2 min-w-0 ${pct === 0 ? 'text-matn-xira' : 'text-matn-2'}`}>
                                                                    <span className={`num w-5 h-5 rounded-md flex items-center justify-center text-[10px] shrink-0 ${pct === 100 ? 'bg-emerald-500/15 text-emerald-500' : pct > 0 ? 'bg-brand/15 text-brand' : 'bg-ichki text-matn-xira'}`}>
                                                                        {pct === 100 ? '✓' : i + 1}
                                                                    </span>
                                                                    <span className="truncate">{m.name}</span>
                                                                </span>
                                                                <span className="num text-matn-xira shrink-0">{pct}%</span>
                                                            </div>
                                                            <div className="mt-1 h-1 rounded-full bg-ichki overflow-hidden">
                                                                <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* So'nggi 10 dars davomati — bitta qatorda, har dars uchun ustun. */}
                                    {recentLessons.length > 0 && (
                                        <div className="pt-4 border-t border-chiziq">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-[13px] font-semibold text-matn">So'nggi {recentLessons.length} dars davomati</span>
                                                <span className="num text-[12px] text-matn-xira">
                                                    o'rtacha {Math.round(recentLessons.reduce((n, l) => n + l.pct, 0) / recentLessons.length)}%
                                                </span>
                                            </div>
                                            {/* O'q noldan emas, eng past qiymatdan pastroqdan
                                                boshlanadi. Davomat 85–95 oralig'ida o'zgarsa,
                                                noldan chizilgan o'nta ustun bir xil bo'lib
                                                qoladi va grafik hech narsa ko'rsatmaydi. */}
                                            {(() => {
                                                const eng = Math.min(...recentLessons.map(l => l.pct));
                                                const baza = Math.max(0, Math.min(eng - 5, 90));
                                                return (
                                                    <div className="flex items-end gap-1.5 h-16">
                                                        {recentLessons.map(l => (
                                                            <div key={l.date} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${l.date} · ${l.pct}%`}>
                                                                <span className="num text-[9px] text-matn-xira">{l.pct}</span>
                                                                <div className={`w-full rounded-sm ${l.pct >= 85 ? 'bg-yaxshi' : l.pct >= 70 ? 'bg-ogoh' : 'bg-xato'}`}
                                                                    style={{ height: `${Math.max(6, ((l.pct - baza) / Math.max(1, 100 - baza)) * 100)}%` }} />
                                                                <span className="num text-[9px] text-matn-xira">{l.date.slice(8, 10)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'yoqlama' && (
                        <div className="space-y-6 animate-in duration-300">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-ichki border border-chiziq rounded-2xl relative overflow-hidden">
                                <div>
                                    <h3 className="text-xs font-black text-matn tracking-tight">Davomat belgilash</h3>
                                    {!isDayValid(group.days, selectedDate) ? (
                                        <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                            <XCircle size={12} />
                                            Bugun kurs kuni emas ({group.days})
                                        </p>
                                    ) : (
                                        <p className="text-[11px] font-bold text-matn-xira mt-1 flex items-center gap-1">
                                            <Calendar size={12} className="text-brand" />
                                            {getDayName(selectedDate)}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                                    {/* Date navigation */}
                                    <div className="flex items-center gap-2 bg-sirt p-1.5 rounded-xl border border-chiziq shadow-sm w-full sm:w-auto justify-between">
                                        <button
                                            onClick={() => setSelectedDate(prev => getValidDate(prev, group.days, 'prev'))}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-matn-sokin hover:text-brand transition-all cursor-pointer"
                                            title="Oldingi dars"
                                        >
                                            <ArrowLeft size={16} />
                                        </button>

                                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                                            className={`px-3 py-1.5 bg-transparent text-[11px] font-bold outline-none border-none cursor-pointer ${!isDayValid(group.days, selectedDate) ? 'text-amber-600' : 'text-matn'}`} />

                                        <button
                                            onClick={() => setSelectedDate(prev => getValidDate(prev, group.days, 'next'))}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-matn-sokin hover:text-brand transition-all cursor-pointer"
                                            title="Keyingi dars"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>

                                    {/* Topic Selector */}
                                    <div className="flex items-center gap-2 bg-sirt p-1.5 rounded-xl border border-chiziq shadow-sm w-full sm:w-auto">
                                        <BookOpen size={14} className="text-brand ml-2 shrink-0" />
                                        <select
                                            value={selectedTopicId}
                                            onChange={e => {
                                                const newId = e.target.value ? Number(e.target.value) : '';
                                                setSelectedTopicId(newId);
                                                updateDayTopic(group.id, selectedDate, newId ? Number(newId) : null);
                                            }}
                                            className="bg-transparent text-[11px] font-bold outline-none border-none cursor-pointer text-gray-750 dark:text-white max-w-[200px]"
                                        >
                                            <option value="">-- Dars mavzusi --</option>
                                            {courseTopics.map(t => (
                                                <option key={t.id} value={t.id}>{t.order}. {t.title}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* SMS only */}
                                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                        <button
                                            onClick={handleSendAttendanceSms}
                                            className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 rounded-xl text-[11px] font-extrabold hover:bg-amber-600 hover:text-white transition-all flex items-center gap-1.5 group cursor-pointer"
                                            title="Kelmaganlarga SMS yuborish"
                                        >
                                            <Sparkles size={13} className="group-hover:animate-pulse" />
                                            SMS
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* Students checklist for selected Date */}
                                <div className="lg:col-span-1 bg-sirt p-4 rounded-2xl border border-chiziq shadow-sm space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-chiziq-mayin">
                                        <span className="text-[11px] font-bold text-matn-xira">Dars yo'qlamasi ({selectedDate})</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-matn-sokin">{groupStudents.length} ta o'quvchi</span>
                                            <button
                                                onClick={() => addBatchAttendance(group.id, selectedDate, groupStudents.map(s => ({ studentId: s.id, status: 'Keldi' })), selectedTopicId ? Number(selectedTopicId) : undefined)}
                                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 transition-all cursor-pointer"
                                            >
                                                Hammasi keldi
                                            </button>
                                            <button
                                                onClick={() => setIsFaceAttendanceOpen(true)}
                                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-50 text-violet-600 border border-violet-100 hover:bg-violet-500 hover:text-white hover:border-violet-500 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/40 transition-all cursor-pointer"
                                            >
                                                Face ID
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                                        {groupStudents.map(s => {
                                            const status = getStudentAttStatus(s.id);
                                            return (
                                                <div key={s.id} className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${status ? 'bg-sirt border-chiziq' : 'bg-ichki/40 border-dashed border-chiziq/50'}`}>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className={`w-1.5 h-5 rounded-full shrink-0 ${status === 'Keldi' ? 'bg-emerald-400' : status === 'Kelmapdi' ? 'bg-rose-400' : status === 'Sababli' ? 'bg-sky-400' : status === 'Kechikdi' ? 'bg-orange-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                                                        <span className="text-[11px] font-bold text-matn tracking-tight truncate max-w-[100px]">{s.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                        <button onClick={() => saveAttendance(s.id, 'Keldi')}
                                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${status === 'Keldi' ? 'bg-emerald-500 text-white' : 'bg-ichki text-matn-xira hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'}`}>
                                                            Keldi
                                                        </button>
                                                        <button onClick={() => saveAttendance(s.id, 'Kelmapdi')}
                                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${status === 'Kelmapdi' ? 'bg-rose-500 text-white' : 'bg-ichki text-matn-xira hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20'}`}>
                                                            Yo'q
                                                        </button>
                                                        <button onClick={() => saveAttendance(s.id, 'Sababli')}
                                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${status === 'Sababli' ? 'bg-sky-500 text-white' : 'bg-ichki text-matn-xira hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/20'}`}>
                                                            Sababli
                                                        </button>
                                                        <button onClick={() => saveAttendance(s.id, 'Kechikdi')}
                                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${status === 'Kechikdi' ? 'bg-orange-400 text-white' : 'bg-ichki text-matn-xira hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20'}`}>
                                                            Kech
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {groupStudents.length === 0 && (
                                            <p className="py-12 text-center text-[11px] text-matn-xira font-bold italic">Bu kursda o'quvchilar yo'q</p>
                                        )}
                                    </div>
                                </div>

                                {/* Historical Calendar */}
                                <div className="lg:col-span-2">
                                    <GroupAttendanceCalendar
                                        group={group}
                                        attendances={attendances}
                                        selectedDate={selectedDate}
                                        onSelectDate={setSelectedDate}
                                        students={groupStudents}
                                    />
                                </div>
                            </div>

                            {/* Full width Matrix below the upper grid */}
                            <div className="space-y-3">
                                <span className="text-[11px] font-bold text-matn-xira block pb-1 border-b border-chiziq-mayin">Davomat Matritsasi</span>
                                <AttendanceMatrix group={group} students={groupStudents} attendances={attendances} />
                            </div>
                        </div>
                    )}



                    {activeTab === 'tolovlar' && (() => {
                        const price = course?.price || 0;

                        const getStudentPrice = (s: typeof groupStudents[0]) => {
                            const cp = s.customPrices && typeof s.customPrices === 'object'
                                ? (s.customPrices as Record<string, number>)[group.id]
                                : undefined;
                            return cp !== undefined ? cp : price;
                        };

                        const totalExpected = groupStudents.reduce((sum, s) => sum + getStudentPrice(s), 0);

                        // Monthly stats based on actual payment records
                        const monthGroupPayments = payments.filter(p =>
                            (group.studentIds || []).includes(p.studentId) &&
                            p.date.startsWith(paymentMonth)
                        );
                        const totalIncoming = monthGroupPayments.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0);
                        const totalDeducted = Math.abs(monthGroupPayments.filter(p => p.amount < 0).reduce((s, p) => s + p.amount, 0));
                        const monthIsClosed = totalDeducted > 0;

                        const fullPaid = groupStudents.filter(s => {
                            const ms = getMonthlyPayStatus(s.id, getStudentPrice(s));
                            return ms?.status === 'full' || ms?.status === 'prepaid';
                        }).length;
                        const partial = groupStudents.filter(s => {
                            const ms = getMonthlyPayStatus(s.id, getStudentPrice(s));
                            return ms?.status === 'partial';
                        }).length;
                        const debtors = groupStudents.filter(s => {
                            const ms = getMonthlyPayStatus(s.id, getStudentPrice(s));
                            return ms?.status === 'debt' || ms?.status === 'none';
                        }).length;

                        return (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Header row with month selector and close-month button */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-sm font-bold text-matn-2">To'lovlar holati</h3>
                                    {monthIsClosed && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-50 text-violet-600 border border-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/40 rounded-md">
                                            Yopilgan
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="month"
                                        value={paymentMonth}
                                        onChange={e => setPaymentMonth(e.target.value)}
                                        className="px-3 py-1.5 text-xs font-semibold bg-sirt border border-chiziq rounded-xl outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                                    />
                                </div>
                            </div>
                            {/* Summary stats */}
                            {price > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                <div className="bg-sirt border border-chiziq rounded-2xl p-4 space-y-1">
                                    <span className="text-[11px] font-bold text-matn-xira">Kurs narxi</span>
                                    <p className="text-sm font-black text-matn tabular-nums">{price.toLocaleString()}</p>
                                    <p className="text-[11px] font-bold text-matn-xira">UZS / oy</p>
                                </div>
                                <div className="bg-sirt border border-chiziq rounded-2xl p-4 space-y-1">
                                    <span className="text-[11px] font-bold text-matn-xira">Bu oy tushum</span>
                                    <p className="text-sm font-black text-matn tabular-nums">{totalIncoming.toLocaleString()}</p>
                                    <p className="text-[11px] font-bold text-matn-xira">/ {totalExpected.toLocaleString()} UZS</p>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 space-y-1">
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">To'liq</span>
                                    <p className="text-sm font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{fullPaid}</p>
                                    <p className="text-[11px] font-bold text-emerald-600/70">ta o'quvchi</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl p-4 space-y-1">
                                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Qisman</span>
                                    <p className="text-sm font-black text-amber-700 dark:text-amber-300 tabular-nums">{partial}</p>
                                    <p className="text-[11px] font-bold text-amber-600/70">ta o'quvchi</p>
                                </div>
                                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-4 space-y-1">
                                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">Qarzdor</span>
                                    <p className="text-sm font-black text-rose-700 dark:text-rose-300 tabular-nums">{debtors}</p>
                                    <p className="text-[11px] font-bold text-rose-600/70">ta o'quvchi</p>
                                </div>
                            </div>
                            )}

                            {/* Student payment table */}
                            <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[600px]">
                                        <thead>
                                            <tr className="bg-ichki border-b border-chiziq">
                                                <th className="p-4 text-[11px] font-bold text-matn-xira">O'quvchi</th>
                                                {price > 0 && <th className="p-4 text-[11px] font-bold text-matn-xira text-right">Kurs narxi</th>}
                                                <th className="p-4 text-[11px] font-bold text-matn-xira text-right">Bu oy to'lov</th>
                                                {price > 0 && <th className="p-4 text-[11px] font-bold text-matn-xira text-right">Farq</th>}
                                                <th className="p-4 text-[11px] font-bold text-matn-xira text-center">Status</th>
                                                <th className="p-4 w-12 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {groupStudents.map(s => {
                                                const studentCustomPrice = s.customPrices && typeof s.customPrices === 'object'
                                                    ? (s.customPrices as Record<string, number>)[group.id]
                                                    : undefined;
                                                const finalPrice = studentCustomPrice !== undefined ? studentCustomPrice : price;
                                                const ms = getMonthlyPayStatus(s.id, finalPrice);
                                                const payStatus = ms?.status || null;
                                                const monthlyIncoming = ms?.incoming || 0;
                                                const diff = finalPrice ? monthlyIncoming - finalPrice : 0;
                                                return (
                                                <tr key={s.id} className="hover:bg-gray-50/30 transition-colors group cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 flex items-center justify-center text-brand font-bold text-xs shrink-0">
                                                                {s.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-matn tracking-tight group-hover:text-brand transition-colors">{displayName(s.name)}</p>
                                                                <p className="text-[11px] font-bold text-matn-xira mt-0.5">{s.phone}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {price > 0 && (
                                                        <td className="p-4 text-right">
                                                            <span className="text-[11px] font-bold text-matn-2 tabular-nums">
                                                                {finalPrice.toLocaleString()} UZS
                                                                {studentCustomPrice !== undefined && (
                                                                    <span className="block text-[10px] text-brand font-bold lowercase tracking-tight">(maxsus)</span>
                                                                )}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="p-4 text-right">
                                                        <span className={`text-[11px] font-bold tabular-nums ${monthlyIncoming > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-matn-xira'}`}>
                                                            {monthlyIncoming.toLocaleString()} UZS
                                                        </span>
                                                    </td>
                                                    {price > 0 && (
                                                        <td className="p-4 text-right">
                                                            <span className={`text-[11px] font-bold tabular-nums ${diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                {diff >= 0 ? '+' : ''}{diff.toLocaleString()} UZS
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="p-4 text-center">
                                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border ${
                                                            payStatus === 'full' || payStatus === 'prepaid'
                                                                ? 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40' :
                                                            payStatus === 'partial'
                                                                ? 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40' :
                                                            payStatus === 'debt'
                                                                ? 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40' :
                                                                'text-matn-xira bg-gray-50 border-gray-100 dark:bg-gray-900 dark:border-gray-800'
                                                        }`}>
                                                            {payStatus === 'full' || payStatus === 'prepaid' ? "To'liq" :
                                                             payStatus === 'partial' ? 'Qisman' :
                                                             payStatus === 'debt' ? 'Qarzdor' :
                                                             "To'lamagan"}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => openPaymentModal(s.id)}
                                                            title="To'lov qo'shish"
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer"
                                                        >
                                                            <CreditCard size={15} />
                                                        </button>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                            {groupStudents.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="p-16 text-center">
                                                        <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                                        <p className="text-[11px] font-bold text-matn-xira">Bu kursda o'quvchilar yo'q</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        );
                    })()}

                </div>
            </div>

            {/* Add Score Modal */}


            {/* Add Student Modal */}
            {isAddStudentModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsAddStudentModalOpen(false)} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-sm p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq-mayin/50">
                            <div>
                                <h3 className="text-lg font-black text-matn tracking-tight">O'quvchi qo'shish</h3>
                                <p className="text-[11px] font-bold text-brand mt-0.5">Kursga biriktirish</p>
                            </div>
                            <button onClick={() => setIsAddStudentModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-matn-xira" />
                                <input type="text" placeholder="Ism bo'yicha qidirish..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-ichki border border-chiziq rounded-xl text-xs font-bold text-matn outline-none focus:border-brand" />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {availableStudents.map(s => (
                                    <button key={s.id} onClick={() => handleAddStudent(s.id)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-teal-50/10 border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all group cursor-pointer text-left">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-teal-50 dark:bg-teal-950/20 rounded-lg flex items-center justify-center text-brand font-bold text-xs">
                                                {s.name.charAt(0)}
                                            </div>
                                            <span className="text-xs font-bold text-matn group-hover:text-brand transition-colors tracking-tight">{s.name}</span>
                                        </div>
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-brand">
                                            <Plus size={16} />
                                        </div>
                                    </button>
                                ))}
                                {availableStudents.length === 0 && (
                                    <p className="py-12 text-center text-[11px] text-matn-sokin font-bold">O'quvchi topilmadi</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsPaymentModalOpen(false)} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-sm p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq-mayin/50">
                            <div>
                                <h3 className="text-lg font-black text-matn tracking-tight">To'lov qabul qilish</h3>
                                <p className="text-[11px] font-bold text-brand mt-0.5">
                                    {students.find(s => s.id === selectedStudentForPayment)?.name}
                                </p>
                            </div>
                            <button onClick={() => setIsPaymentModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                        </div>
                        {course?.price && (
                            <div className="mb-4 p-3 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-between">
                                <span className="text-[11px] font-bold text-matn-xira">Kurs narxi</span>
                                <span className="text-sm font-black text-brand">{course.price.toLocaleString()} UZS</span>
                            </div>
                        )}
                        <div className="space-y-4">
                            <div>
                                <label className={labelCls}>To'lov miqdori (UZS)</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    className={inputCls}
                                />
                                {course?.price && (
                                    <div className="flex gap-2 mt-2">
                                        <button type="button" onClick={() => setPaymentAmount(String(course.price))}
                                            className="flex-1 py-1.5 bg-chiziq rounded-lg text-[11px] font-bold text-matn-2 hover:bg-teal-50 hover:text-brand transition-all cursor-pointer">
                                            To'liq ({course.price.toLocaleString()})
                                        </button>
                                        <button type="button" onClick={() => setPaymentAmount(String(Math.round(course.price / 2)))}
                                            className="flex-1 py-1.5 bg-chiziq rounded-lg text-[11px] font-bold text-matn-2 hover:bg-amber-50 hover:text-amber-600 transition-all cursor-pointer">
                                            Yarmi ({Math.round(course.price / 2).toLocaleString()})
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className={labelCls}>To'lov turi</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['Naqd', 'Karta', 'Click', 'Payme'] as const).map(type => (
                                        <button key={type} type="button"
                                            onClick={() => setPaymentType(type as any)}
                                            className={`py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${paymentType === type ? 'bg-brand text-brand-ust border-brand' : 'bg-ichki text-matn-2 border-chiziq hover:border-brand'}`}>
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Sana</label>
                                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={inputCls} />
                            </div>
                            <button onClick={handleAddPayment}
                                disabled={!paymentAmount || Number(paymentAmount) <= 0}
                                className="w-full py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl font-bold text-[11px] shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer flex items-center justify-center gap-1.5">
                                <Check size={14} />
                                To'lovni tasdiqlash
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Topic Modal */}
            {isTopicModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => { setIsTopicModalOpen(false); setEditingTopic(null); }} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-sm p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq-mayin/50">
                            <div>
                                <h3 className="text-lg font-black text-matn tracking-tight">
                                    {editingTopic ? "Mavzuni tahrirlash" : "Mavzu qo'shish"}
                                </h3>
                                <p className="text-[11px] font-bold text-brand mt-0.5">Kurs dasturi</p>
                            </div>
                            <button onClick={() => { setIsTopicModalOpen(false); setEditingTopic(null); }} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer">
                                <XCircle size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveTopic} className="space-y-4">
                            <div>
                                <label className={labelCls}>Tartib raqami</label>
                                <input
                                    type="number"
                                    required
                                    value={topicForm.order}
                                    onChange={e => setTopicForm({ ...topicForm, order: Number(e.target.value) })}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Mavzu nomi</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Masalan: JavaScript Kirish"
                                    value={topicForm.title}
                                    onChange={e => setTopicForm({ ...topicForm, title: e.target.value })}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Tavsif (ixtiyoriy)</label>
                                <textarea
                                    placeholder="Mavzu mazmuni haqida..."
                                    value={topicForm.description}
                                    onChange={e => setTopicForm({ ...topicForm, description: e.target.value })}
                                    className={inputCls + " min-h-[80px] resize-none"}
                                />
                            </div>
                            <button type="submit" className="w-full py-3 bg-brand hover:bg-brand-dark text-white rounded-xl font-bold text-[11px] shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer flex items-center justify-center gap-1.5">
                                <Check size={14} />
                                Saqlash
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isFaceAttendanceOpen && (
                <FaceAttendance
                    students={groupStudents}
                    attendanceStatus={Object.fromEntries(
                        groupStudents.map(s => {
                            const rec = attendances.find(a => a.groupId === group.id && a.date === selectedDate && a.studentId === s.id);
                            return [s.id, rec?.status || ''];
                        })
                    )}
                    onMatch={(studentId) => saveAttendance(studentId, 'Keldi')}
                    onUnmatch={(studentId) => saveAttendance(studentId, 'Kelmapdi')}
                    onClose={(markedIds) => {
                        setIsFaceAttendanceOpen(false);
                        // Mark everyone NOT detected by Face ID as absent (override any previous record)
                        const markedSet = new Set(markedIds);
                        groupStudents.forEach(s => {
                            if (!markedSet.has(s.id)) saveAttendance(s.id, 'Kelmapdi');
                        });
                    }}
                />
            )}

        </div>
    );
}


function TabButton({ label, icon, active, onClick }: any) {
    return (
        <button onClick={onClick} className={`px-5 py-3.5 text-[12px] font-semibold flex items-center gap-2 transition-colors relative shrink-0 cursor-pointer ${active ? 'text-brand bg-sirt' : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {icon}
            {label}
            {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full" />}
        </button>
    );
}

function InfoItem({ icon, label, value }: any) {
    // Avval har bir qator 36px ikonka kvadrati va ikki qatorli matndan iborat edi —
    // besh maydon uchun ~300px balandlik. Endi bitta qatorda: chapda nomi, o'ngda
    // qiymati; ikonka esa mayda va sokin.
    return (
        <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="flex items-center gap-2 text-[11px] font-medium text-matn-xira shrink-0">
                <span className="text-matn-xira shrink-0">{icon}</span>
                {label}
            </span>
            <span className="text-[12px] font-medium text-matn text-right truncate min-w-0" title={value}>
                {value || '—'}
            </span>
        </div>
    );
}
