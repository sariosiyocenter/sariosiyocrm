import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import {
    Users, Calendar, Clock, BookOpen, Plus, TrendingUp,
    CheckCircle, XCircle, ArrowLeft, Search, ClipboardCheck, ChevronRight, Presentation, Award, Check, Sparkles,
    Pencil, Trash2, CreditCard, DollarSign, Wallet, AlertTriangle, ReceiptText
} from 'lucide-react';
import AttendanceMatrix from './AttendanceMatrix';
import GroupAttendanceCalendar from './GroupAttendanceCalendar';

export default function CourseDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { groups, students, teachers, courses, rooms, attendances, payments, addBatchAttendance, addStudentToGroup, removeStudentFromGroup, updateGroup, updateCourse, showNotification, topics, addTopic, updateTopic, deleteTopic, addPayment, syllabuses } = useCRM();
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
    const [batchAttendance, setBatchAttendance] = useState<Record<number, string>>({});
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

    const [isCloseMonthOpen, setIsCloseMonthOpen] = useState(false);
    const [closeMonthValue, setCloseMonthValue] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [paymentMonth, setPaymentMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [isProcessing, setIsProcessing] = useState(false);

    const group = groups.find(g => g.id === Number(id));
    if (!group) return <div className="p-12 text-center text-gray-500 font-medium">Kurs topilmadi</div>;

    const teacher = teachers.find(t => t.id === group.teacherId);
    const course = courses.find(c => c.id === group.courseId);
    const groupStudents = students.filter(s => (group.studentIds || []).includes(s.id));


    const handleSaveAttendance = async () => {
        const records = Object.entries(batchAttendance).map(([studentId, status]) => ({
            studentId: Number(studentId),
            status
        }));
        if (records.length === 0) return;
        await addBatchAttendance(group.id, selectedDate, records, selectedTopicId ? Number(selectedTopicId) : undefined);
        showNotification("Davomat saqlandi", "success");
    };

    React.useEffect(() => {
        if (!group) return;
        const existing = attendances.filter(a => a.groupId === group.id && a.date === selectedDate);
        const initialBatch: Record<number, string> = {};
        groupStudents.forEach(s => {
            const rec = existing.find(a => a.studentId === s.id);
            initialBatch[s.id] = rec ? rec.status : 'Keldi';
        });
        setBatchAttendance(initialBatch);

        const firstRecord = existing.find(a => a.topicId !== null && a.topicId !== undefined);
        setSelectedTopicId(firstRecord?.topicId || '');
    }, [selectedDate, group.id, attendances]);

    const handleSendAttendanceSms = async () => {
        if (!window.confirm("Kelmagan o'quvchilar ota-onalariga SMS yuborilsinmi?")) return;
        
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

    const activeSyllabus = group.syllabusId ? (syllabuses || []).find(s => s.id === group.syllabusId) : null;
    const courseTopics = activeSyllabus 
        ? (topics || []).filter(t => t.syllabusId === activeSyllabus.id).sort((a, b) => a.order - b.order)
        : (topics || []).filter(t => t.courseId === group.courseId).sort((a, b) => a.order - b.order);

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
                if (group.syllabusId) {
                    await addTopic({
                        title: topicForm.title,
                        description: topicForm.description,
                        order: Number(topicForm.order),
                        syllabusId: group.syllabusId
                    });
                } else {
                    await addTopic({
                        title: topicForm.title,
                        description: topicForm.description,
                        order: Number(topicForm.order),
                        courseId: group.courseId
                    });
                }
            }
            setIsTopicModalOpen(false);
            setEditingTopic(null);
            setTopicForm({ title: '', description: '', order: courseTopics.length + 2 });
        } catch (err) {
            console.error("Save topic failed", err);
        }
    };

    const handleEditTopic = (topic: any) => {
        setEditingTopic(topic);
        setTopicForm({
            title: topic.title,
            description: topic.description || '',
            order: topic.order
        });
        setIsTopicModalOpen(true);
    };

    const handleDeleteTopic = async (id: number) => {
        if (!window.confirm("Haqiqatan ham ushbu mavzuni o'chirmoqchimisiz?")) return;
        await deleteTopic(id);
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

    const openCloseModal = () => {
        setCloseMonthValue(paymentMonth);
        setIsCloseMonthOpen(true);
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

    const handleCloseMonth = async () => {
        if (!course?.price || isProcessing) return;
        setIsProcessing(true);
        const [year, month] = closeMonthValue.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        const monthNames = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
        const monthLabel = `${monthNames[month - 1]} ${year}`;
        try {
            for (const st of groupStudents) {
                const studentCustomPrice = st.customPrices && typeof st.customPrices === 'object'
                    ? (st.customPrices as Record<string, number>)[group.id]
                    : undefined;
                const finalPrice = studentCustomPrice !== undefined ? studentCustomPrice : course.price;
                await addPayment({
                    studentId: st.id,
                    amount: -(finalPrice),
                    type: 'Naqd',
                    date: dateStr,
                    description: `${course.name} — ${monthLabel} oylik hisob`
                });
            }
            setIsCloseMonthOpen(false);
            showNotification(`${monthLabel}: ${groupStudents.length} ta o'quvchidan dars to'lovlari muvaffaqiyatli yechildi`, "success");
        } catch {
            showNotification("Xatolik yuz berdi", "error");
        } finally {
            setIsProcessing(false);
        }
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
            await updateGroup(group.id, {
                teacherId: Number(editForm.teacherId),
                days: editForm.days,
                schedule: `${editForm.startTime} - ${editForm.endTime}`,
                room: Number(editForm.room),
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

    const labelCls = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";
    const inputCls = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Back Button */}
            <button onClick={() => navigate('/courses')} className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-[#1b6b6b] transition-all text-[10px] font-extrabold uppercase tracking-widest group cursor-pointer">
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                Orqaga
            </button>

            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="bg-teal-50/20 dark:bg-teal-950/10 p-6 md:p-8 border-b border-gray-100 dark:border-gray-700/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 text-[8px] font-black uppercase tracking-wider">Kurs faol</span>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">ID: #{group.id}</span>
                            </div>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{group.name}</h1>
                            <div className="flex items-center gap-3 mt-3">
                                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                                    <BookOpen size={13} className="text-[#1b6b6b]" />
                                    {course?.name || "Noma'lum kurs"}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-white dark:bg-gray-950 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shrink-0">
                            {isEditingInfo ? (
                                <div className="flex flex-col gap-1.5 min-w-[200px]">
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
                                <>
                                    <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950/20 rounded-xl flex items-center justify-center text-[#1b6b6b] border border-teal-100 dark:border-teal-900/40 shrink-0">
                                        <Presentation size={22} />
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold text-gray-400 block mb-0.5 uppercase tracking-widest">O'qituvchi</span>
                                        <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{teacher?.name}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex px-4 bg-gray-55 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/50 gap-2">
                    <TabButton label="Umumiy" icon={<Users size={14} />} active={activeTab === 'umumiy'} onClick={() => setActiveTab('umumiy')} />
                    <TabButton label="Yo'qlama" icon={<ClipboardCheck size={14} />} active={activeTab === 'yoqlama'} onClick={() => setActiveTab('yoqlama')} />
                    <TabButton label="To'lovlar" icon={<CreditCard size={14} />} active={activeTab === 'tolovlar'} onClick={() => setActiveTab('tolovlar')} />
                    <TabButton label="Mavzular" icon={<BookOpen size={14} />} active={activeTab === 'mavzular'} onClick={() => setActiveTab('mavzular')} />
                </div>

                <div className="p-6">
                    {activeTab === 'umumiy' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <StatCardV3 
                                    label="O'quvchilar" 
                                    value={groupStudents.length}
                                    subValue="Jami faol"
                                    icon={<Users className="text-[#1b6b6b]" size={16} />} 
                                    color="teal"
                                />
                                <StatCardV3 
                                    label="Davomat" 
                                    value="94%"
                                    subValue="O'rtacha ko'rsatkich"
                                    icon={<ClipboardCheck className="text-emerald-500" size={16} />} 
                                    color="emerald"
                                />
                                <StatCardV3 
                                    label="Amaliy Darslar" 
                                    value="12"
                                    subValue="Ushbu oyda"
                                    icon={<Presentation className="text-rose-500" size={16} />} 
                                    color="rose"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-55 dark:border-gray-700/50">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">O'quvchilar</span>
                                        <button onClick={() => setIsAddStudentModalOpen(true)} 
                                            className="px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all flex items-center gap-1.5 group cursor-pointer">
                                            <Plus size={14} />
                                            Qo'shish
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {groupStudents.map(s => {
                                            const payStatus = getPayStatus(s.balance);
                                            return (
                                            <div key={s.id} className="group bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all flex items-center justify-between">
                                                <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => navigate(`/students/${s.id}`)}>
                                                    <div className="w-10 h-10 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-xl flex items-center justify-center text-[#1b6b6b] font-bold text-sm shrink-0">
                                                        {s.name.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-black text-gray-900 dark:text-white truncate uppercase tracking-tight group-hover:text-[#1b6b6b] transition-colors">{s.name}</p>
                                                        <p className="text-[9px] font-bold text-gray-405 mt-0.5">{s.phone}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {payStatus && (
                                                        <span className={`text-[8px] font-black px-2 py-1 rounded-md border uppercase tracking-wider ${
                                                            payStatus === 'full' ? 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                                            payStatus === 'partial' ? 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400' :
                                                            'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400'
                                                        }`}>
                                                            {payStatus === 'full' ? "To'liq" : payStatus === 'partial' ? 'Qisman' : 'Qarzdor'}
                                                        </span>
                                                    )}
                                                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-md border ${s.balance >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' : 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400'}`}>
                                                        {s.balance.toLocaleString()}
                                                    </span>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); openPaymentModal(s.id); }}
                                                        title="To'lov qo'shish"
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer"
                                                    >
                                                        <CreditCard size={13} />
                                                    </button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); removeStudentFromGroup(group.id, s.id); }}
                                                        title="Kursdan chiqarish"
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                                                    >
                                                        <XCircle size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                            );
                                        })}
                                        {groupStudents.length === 0 && (
                                            <p className="col-span-full py-12 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">Bu kursda o'quvchilar yo'q</p>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-55 dark:border-gray-700/50">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ma'lumotlar</span>
                                        {!isEditingInfo ? (
                                            <button 
                                                onClick={handleStartEdit}
                                                className="text-[9px] font-black text-[#1b6b6b] uppercase tracking-widest hover:underline cursor-pointer"
                                            >
                                                O'zgartirish
                                            </button>
                                        ) : (
                                            <div className="flex gap-2.5">
                                                <button 
                                                    onClick={handleSaveInfo}
                                                    className="text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:underline cursor-pointer"
                                                >
                                                    Saqlash
                                                </button>
                                                <button 
                                                    onClick={() => setIsEditingInfo(false)}
                                                    className="text-[9px] font-black text-rose-600 uppercase tracking-widest hover:underline cursor-pointer"
                                                >
                                                    Bekor
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-3xl p-5 space-y-4">
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
                                                <InfoItem icon={<Calendar size={16} />} label="Kunlar" value={group.days === 'TOQ' ? 'Toq kunlar' : group.days === 'JUFT' ? 'Juft kunlar' : 'Har kuni'} />
                                                <InfoItem icon={<Clock size={16} />} label="Vaqt" value={group.schedule} />
                                                <InfoItem icon={<Presentation size={16} />} label="Xona" value={rooms.find(r => r.id === group.room)?.name || `#${group.room || '-'}`} />
                                                <InfoItem icon={<DollarSign size={16} />} label="Kurs narxi" value={course?.price ? `${course.price.toLocaleString()} UZS` : "Belgilanmagan"} />
                                                <InfoItem icon={<BookOpen size={16} />} label="O'quv programmasi" value={activeSyllabus ? activeSyllabus.name : "Kurs mavzulari (Dastursiz)"} />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'yoqlama' && (
                        <div className="space-y-6 animate-in duration-300">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-gray-55 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-2xl relative overflow-hidden">
                                <div>
                                    <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">Davomat belgilash</h3>
                                    {!isDayValid(group.days, selectedDate) ? (
                                        <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-1 uppercase tracking-widest flex items-center gap-1">
                                            <XCircle size={12} />
                                            Bugun kurs kuni emas ({group.days})
                                        </p>
                                    ) : (
                                        <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest flex items-center gap-1">
                                            <Calendar size={12} className="text-[#1b6b6b]" />
                                            {getDayName(selectedDate)}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                                    {/* Date navigation */}
                                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm w-full sm:w-auto justify-between">
                                        <button 
                                            onClick={() => setSelectedDate(prev => getValidDate(prev, group.days, 'prev'))}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-gray-450 hover:text-[#1b6b6b] transition-all cursor-pointer"
                                            title="Oldingi dars"
                                        >
                                            <ArrowLeft size={16} />
                                        </button>
                                        
                                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                                            className={`px-3 py-1.5 bg-transparent text-[10px] font-black uppercase tracking-wider outline-none border-none cursor-pointer ${!isDayValid(group.days, selectedDate) ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`} />

                                        <button 
                                            onClick={() => setSelectedDate(prev => getValidDate(prev, group.days, 'next'))}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-50 text-gray-450 hover:text-[#1b6b6b] transition-all cursor-pointer"
                                            title="Keyingi dars"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>

                                    {/* Topic Selector */}
                                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm w-full sm:w-auto">
                                        <BookOpen size={14} className="text-[#1b6b6b] ml-2 shrink-0" />
                                        <select 
                                            value={selectedTopicId} 
                                            onChange={e => setSelectedTopicId(e.target.value ? Number(e.target.value) : '')}
                                            className="bg-transparent text-[10px] font-black uppercase tracking-wider outline-none border-none cursor-pointer text-gray-750 dark:text-white max-w-[200px]"
                                        >
                                            <option value="">-- Dars mavzusi --</option>
                                            {(topics || []).filter(t => t.courseId === group.courseId).sort((a, b) => a.order - b.order).map(t => (
                                                <option key={t.id} value={t.id}>{t.order}. {t.title}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Save and SMS */}
                                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                        <button 
                                            onClick={handleSendAttendanceSms}
                                            className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 rounded-xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all flex items-center gap-1.5 group cursor-pointer"
                                            title="Kelmaganlarga SMS yuborish"
                                        >
                                            <Sparkles size={13} className="group-hover:animate-pulse" />
                                            SMS
                                        </button>
                                        <button onClick={handleSaveAttendance} 
                                            className={`flex-1 sm:flex-none px-6 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all cursor-pointer ${!isDayValid(group.days, selectedDate) ? 'opacity-50' : ''}`}>
                                            Saqlash
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Students checklist for selected Date */}
                                <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-50 dark:border-gray-700">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dars yo'qlamasi ({selectedDate})</span>
                                        <span className="text-[9px] font-bold text-gray-450">{groupStudents.length} ta o'quvchi</span>
                                    </div>
                                    <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                                        {groupStudents.map(s => {
                                            const status = batchAttendance[s.id] || 'Keldi';
                                            return (
                                                <div key={s.id} className="flex items-center justify-between p-2 bg-gray-55 dark:bg-gray-900/30 rounded-xl border border-transparent hover:border-gray-100 dark:hover:border-gray-755 transition-all">
                                                    <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tight truncate max-w-[120px]">{s.name}</span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button 
                                                            onClick={() => setBatchAttendance(prev => ({ ...prev, [s.id]: 'Keldi' }))}
                                                            className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer ${status === 'Keldi' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-emerald-500'}`}
                                                        >
                                                            Keldi
                                                        </button>
                                                        <button 
                                                            onClick={() => setBatchAttendance(prev => ({ ...prev, [s.id]: 'Kelmapdi' }))}
                                                            className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer ${status === 'Kelmapdi' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-rose-500'}`}
                                                        >
                                                            Yo'q
                                                        </button>
                                                        <button 
                                                            onClick={() => setBatchAttendance(prev => ({ ...prev, [s.id]: 'Sababli' }))}
                                                            className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer ${status === 'Sababli' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-sky-500'}`}
                                                        >
                                                            Sababli
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {groupStudents.length === 0 && (
                                            <p className="py-12 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">Bu kursda o'quvchilar yo'q</p>
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
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pb-1 border-b border-gray-50 dark:border-gray-700">Davomat Matritsasi</span>
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
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">To'lovlar holati</h3>
                                    {monthIsClosed && (
                                        <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 bg-violet-50 text-violet-600 border border-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/40 rounded-md">
                                            Yopilgan
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="month"
                                        value={paymentMonth}
                                        onChange={e => setPaymentMonth(e.target.value)}
                                        className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                                    />
                                    {price > 0 && (
                                    <button
                                        onClick={openCloseModal}
                                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                                    >
                                        <ReceiptText size={14} />
                                        Oyni yopish
                                    </button>
                                    )}
                                </div>
                            </div>
                            {/* Summary stats */}
                            {price > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-4 space-y-1">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Kurs narxi</span>
                                    <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{price.toLocaleString()}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">UZS / oy</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-4 space-y-1">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Bu oy tushum</span>
                                    <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{totalIncoming.toLocaleString()}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">/ {totalExpected.toLocaleString()} UZS</p>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 space-y-1">
                                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">To'liq</span>
                                    <p className="text-sm font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{fullPaid}</p>
                                    <p className="text-[9px] font-bold text-emerald-600/70 uppercase">ta o'quvchi</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl p-4 space-y-1">
                                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Qisman</span>
                                    <p className="text-sm font-black text-amber-700 dark:text-amber-300 tabular-nums">{partial}</p>
                                    <p className="text-[9px] font-bold text-amber-600/70 uppercase">ta o'quvchi</p>
                                </div>
                                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-4 space-y-1">
                                    <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">Qarzdor</span>
                                    <p className="text-sm font-black text-rose-700 dark:text-rose-300 tabular-nums">{debtors}</p>
                                    <p className="text-[9px] font-bold text-rose-600/70 uppercase">ta o'quvchi</p>
                                </div>
                            </div>
                            )}

                            {/* Student payment table */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[600px]">
                                        <thead>
                                            <tr className="bg-gray-55 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700/50">
                                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">O'quvchi</th>
                                                {price > 0 && <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Kurs narxi</th>}
                                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Bu oy to'lov</th>
                                                {price > 0 && <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Farq</th>}
                                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
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
                                                            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 flex items-center justify-center text-[#1b6b6b] font-bold text-xs shrink-0">
                                                                {s.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-[#1b6b6b] transition-colors">{s.name}</p>
                                                                <p className="text-[9px] font-bold text-gray-400 mt-0.5">{s.phone}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {price > 0 && (
                                                        <td className="p-4 text-right">
                                                            <span className="text-[10px] font-black text-gray-600 dark:text-gray-300 tabular-nums">
                                                                {finalPrice.toLocaleString()} UZS
                                                                {studentCustomPrice !== undefined && (
                                                                    <span className="block text-[8px] text-[#1b6b6b] font-bold lowercase tracking-tight">(maxsus)</span>
                                                                )}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="p-4 text-right">
                                                        <span className={`text-[10px] font-black tabular-nums ${monthlyIncoming > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                                                            {monthlyIncoming.toLocaleString()} UZS
                                                        </span>
                                                    </td>
                                                    {price > 0 && (
                                                        <td className="p-4 text-right">
                                                            <span className={`text-[10px] font-black tabular-nums ${diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                {diff >= 0 ? '+' : ''}{diff.toLocaleString()} UZS
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="p-4 text-center">
                                                        <span className={`text-[8px] font-black px-2.5 py-1 rounded-md border uppercase tracking-wider ${
                                                            payStatus === 'full' || payStatus === 'prepaid'
                                                                ? 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40' :
                                                            payStatus === 'partial'
                                                                ? 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40' :
                                                            payStatus === 'debt'
                                                                ? 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40' :
                                                                'text-gray-400 bg-gray-50 border-gray-100 dark:bg-gray-900 dark:border-gray-700'
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
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bu kursda o'quvchilar yo'q</p>
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

                    {activeTab === 'mavzular' && (
                        <div className="space-y-6 animate-in duration-300">
                            {/* Topics Header / Progress */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-gray-55 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-2xl">
                                <div className="space-y-1">
                                    <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">Kurs o'quv dasturi (Syllabus)</h3>
                                    <p className="text-[10px] font-bold text-gray-450 uppercase tracking-widest">
                                        Jami mavzular: {courseTopics.length} ta
                                    </p>
                                </div>
                                
                                {/* Covered progress bar */}
                                {courseTopics.length > 0 && (() => {
                                    const coveredTopicIds = new Set(attendances.filter(a => a.groupId === group.id && a.topicId).map(a => a.topicId));
                                    const progressPercent = Math.round((coveredTopicIds.size / courseTopics.length) * 100);
                                    return (
                                        <div className="flex items-center gap-4 w-full md:w-80 shrink-0">
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">
                                                    <span>Darslar progressi</span>
                                                    <span>{coveredTopicIds.size}/{courseTopics.length} ({progressPercent}%)</span>
                                                </div>
                                                <div className="w-full h-2 bg-gray-200 dark:bg-gray-750 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-[#1b6b6b] to-[#2e9c9c] transition-all duration-500"
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <button 
                                    onClick={() => {
                                        setEditingTopic(null);
                                        setTopicForm({ title: '', description: '', order: courseTopics.length + 1 });
                                        setIsTopicModalOpen(true);
                                    }}
                                    className="px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all flex items-center gap-1.5 group cursor-pointer"
                                >
                                    <Plus size={14} />
                                    Mavzu qo'shish
                                </button>
                            </div>

                            {/* Topics List */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left border-separate border-spacing-0">
                                        <thead>
                                            <tr className="bg-gray-55 dark:bg-gray-900/50">
                                                <th className="p-4 pl-6 text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 w-16">Tartib</th>
                                                <th className="p-4 text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">Mavzu nomi</th>
                                                <th className="p-4 text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">Tavsif</th>
                                                <th className="p-4 text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 w-32 text-center">Holat</th>
                                                <th className="p-4 pr-6 text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800 w-24 text-right">Amallar</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                            {courseTopics.map(t => {
                                                const covered = attendances.some(a => a.groupId === group.id && a.topicId === t.id);
                                                return (
                                                    <tr key={t.id} className="hover:bg-gray-55/30 dark:hover:bg-gray-900/30 transition-colors">
                                                        <td className="p-4 pl-6 text-xs font-black text-gray-450 tabular-nums">#{t.order}</td>
                                                        <td className="p-4 text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{t.title}</td>
                                                        <td className="p-4 text-xs text-gray-400 dark:text-gray-500 font-bold">{t.description || '-'}</td>
                                                        <td className="p-4 text-center">
                                                            {covered ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 text-[9px] font-black uppercase tracking-wider">
                                                                    <CheckCircle size={10} /> O'tildi
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 text-gray-400 border border-gray-100 dark:bg-gray-900 dark:text-gray-500 dark:border-gray-800 text-[9px] font-black uppercase tracking-wider">
                                                                    O'tilmagan
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 pr-6 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <button 
                                                                    onClick={() => handleEditTopic(t)}
                                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#1b6b6b] hover:bg-gray-50 dark:hover:bg-gray-900 transition-all cursor-pointer"
                                                                >
                                                                    <Pencil size={13} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteTopic(t.id)}
                                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {courseTopics.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="py-16 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">
                                                        Ushbu kurs uchun hali mavzular kiritilmagan
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Score Modal */}


            {/* Add Student Modal */}
            {isAddStudentModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsAddStudentModalOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-sm p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">O'quvchi qo'shish</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">Kursga biriktirish</p>
                            </div>
                            <button onClick={() => setIsAddStudentModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" placeholder="Ism bo'yicha qidirish..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b]" />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {availableStudents.map(s => (
                                    <button key={s.id} onClick={() => handleAddStudent(s.id)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-teal-50/10 border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all group cursor-pointer text-left">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-teal-50 dark:bg-teal-950/20 rounded-lg flex items-center justify-center text-[#1b6b6b] font-bold text-xs">
                                                {s.name.charAt(0)}
                                            </div>
                                            <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-[#1b6b6b] transition-colors uppercase tracking-tight">{s.name}</span>
                                        </div>
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-[#1b6b6b]">
                                            <Plus size={16} />
                                        </div>
                                    </button>
                                ))}
                                {availableStudents.length === 0 && (
                                    <p className="py-12 text-center text-[9px] text-gray-450 font-bold uppercase tracking-widest">O'quvchi topilmadi</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsPaymentModalOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-sm p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">To'lov qabul qilish</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">
                                    {students.find(s => s.id === selectedStudentForPayment)?.name}
                                </p>
                            </div>
                            <button onClick={() => setIsPaymentModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                        </div>
                        {course?.price && (
                            <div className="mb-4 p-3 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-between">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Kurs narxi</span>
                                <span className="text-sm font-black text-[#1b6b6b]">{course.price.toLocaleString()} UZS</span>
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
                                            className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 hover:bg-teal-50 hover:text-[#1b6b6b] transition-all cursor-pointer">
                                            To'liq ({course.price.toLocaleString()})
                                        </button>
                                        <button type="button" onClick={() => setPaymentAmount(String(Math.round(course.price / 2)))}
                                            className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 hover:bg-amber-50 hover:text-amber-600 transition-all cursor-pointer">
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
                                            className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer ${paymentType === type ? 'bg-[#1b6b6b] text-white border-[#1b6b6b]' : 'bg-gray-55 dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700 hover:border-[#1b6b6b]'}`}>
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
                                className="w-full py-3 bg-[#1b6b6b] hover:bg-[#155252] disabled:opacity-50 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer flex items-center justify-center gap-1.5">
                                <Check size={14} />
                                To'lovni tasdiqlash
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Topic Modal */}
            {isTopicModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => { setIsTopicModalOpen(false); setEditingTopic(null); }} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-sm p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                    {editingTopic ? "Mavzuni tahrirlash" : "Mavzu qo'shish"}
                                </h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">Kurs dasturi</p>
                            </div>
                            <button onClick={() => { setIsTopicModalOpen(false); setEditingTopic(null); }} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer">
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
                            <button type="submit" className="w-full py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer flex items-center justify-center gap-1.5">
                                <Check size={14} />
                                Saqlash
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Close Month Modal */}
            {isCloseMonthOpen && course?.price && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => !isProcessing && setIsCloseMonthOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                        {/* Header */}
                        <div className="bg-violet-600 p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                                    <ReceiptText size={18} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-white">Oyni yopish</h3>
                                    <p className="text-violet-200 text-xs">Kurs to'lovini barcha o'quvchilardan chiqarish</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Month selector */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1.5">Oy tanlang</label>
                                <input
                                    type="month"
                                    value={closeMonthValue}
                                    onChange={e => setCloseMonthValue(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>

                            {/* Info banner */}
                            <div className="flex items-center gap-3 bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 rounded-2xl p-3">
                                <AlertTriangle size={15} className="text-violet-600 shrink-0" />
                                <p className="text-xs text-violet-700 dark:text-violet-300">
                                    Har bir o'quvchidan ularning <span className="font-black">kurs narxi</span> miqdorida ayiriladi (maxsus narxlar hisobga olinadi)
                                </p>
                            </div>

                            {/* Student preview table */}
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50">
                                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700/50">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{groupStudents.length} ta o'quvchi</p>
                                </div>
                                <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
                                    {groupStudents.map(st => {
                                        const stCustomPrice = st.customPrices && typeof st.customPrices === 'object'
                                            ? (st.customPrices as Record<string, number>)[group.id]
                                            : undefined;
                                        const stPrice = stCustomPrice !== undefined ? stCustomPrice : course.price;
                                        const newBalance = st.balance - stPrice;
                                        const willDebt = newBalance < 0;
                                        return (
                                            <div key={st.id} className="flex items-center justify-between px-4 py-2.5">
                                                <div>
                                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{st.name}</span>
                                                    {stCustomPrice !== undefined && (
                                                        <span className="ml-2 text-[9px] font-bold text-[#1b6b6b]">({stPrice.toLocaleString()} UZS)</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] tabular-nums">
                                                    <span className="text-gray-400">{st.balance.toLocaleString()}</span>
                                                    <span className="text-gray-300">→</span>
                                                    <span className={`font-bold ${willDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                        {newBalance.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsCloseMonthOpen(false)}
                                    disabled={isProcessing}
                                    className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                                >
                                    Bekor qilish
                                </button>
                                <button
                                    onClick={handleCloseMonth}
                                    disabled={isProcessing}
                                    className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-violet-500/25 disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Jarayonda...
                                        </>
                                    ) : (
                                        <>
                                            <ReceiptText size={14} />
                                            Tasdiqlash
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCardV3({ label, value, subValue, icon, color }: any) {
    const colorClasses = {
        emerald: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40',
        rose: 'bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40',
        teal: 'bg-teal-50 border-teal-100 dark:bg-teal-950/20 dark:border-teal-900/40',
        amber: 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40'
    }[color] || 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700/50';

    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm transition-all hover:-translate-y-0.5">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
                    <h5 className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-none tabular-nums" title={value}>{value}</h5>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorClasses}`}>
                    {icon}
                </div>
            </div>
            <div className="pt-3 mt-3 border-t border-dashed border-gray-100 dark:border-gray-700/50">
                <span className="text-[9px] font-bold text-gray-400 flex items-center gap-1 uppercase tracking-widest leading-none">
                    <TrendingUp size={12} className="text-[#1b6b6b]" />
                    {subValue}
                </span>
            </div>
        </div>
    );
}

function TabButton({ label, icon, active, onClick }: any) {
    return (
        <button onClick={onClick} className={`px-6 py-4 text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 transition-all relative shrink-0 cursor-pointer ${active ? 'text-[#1b6b6b] bg-white dark:bg-gray-800' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
            {icon}
            {label}
            {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1b6b6b] rounded-t-full" />}
        </button>
    );
}

function InfoItem({ icon, label, value }: any) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-center text-[#1b6b6b]">
                {icon}
            </div>
            <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none block">{label}</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight mt-0.5 block">{value}</span>
            </div>
        </div>
    );
}
