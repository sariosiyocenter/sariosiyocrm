import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import {
    Users, Calendar, Clock, BookOpen, Plus, TrendingUp,
    CheckCircle, XCircle, ArrowLeft, Save, Search, ClipboardCheck, ChevronRight, Presentation, Award, Check, Sparkles
} from 'lucide-react';
import AttendanceMatrix from './AttendanceMatrix';
import GroupAttendanceCalendar from './GroupAttendanceCalendar';

export default function GroupDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { groups, students, teachers, courses, rooms, attendances, scores, addBatchAttendance, addStudentToGroup, addScore, updateGroup, showNotification } = useCRM();
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editForm, setEditForm] = useState({
        teacherId: 0,
        days: '',
        startTime: '',
        endTime: '',
        room: 0
    });
    const [activeTab, setActiveTab] = useState('umumiy');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
    const [selectedStudentForScore, setSelectedStudentForScore] = useState<number | null>(null);
    const [newScoreValue, setNewScoreValue] = useState('');
    const [newScoreComment, setNewScoreComment] = useState('');
    const [newScoreDate, setNewScoreDate] = useState(new Date().toISOString().split('T')[0]);
    const [batchAttendance, setBatchAttendance] = useState<Record<number, string>>({});
    const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');

    const group = groups.find(g => g.id === Number(id));
    if (!group) return <div className="p-12 text-center text-gray-500 font-medium">Guruh topilmadi</div>;

    const teacher = teachers.find(t => t.id === group.teacherId);
    const course = courses.find(c => c.id === group.courseId);
    const groupStudents = students.filter(s => group.studentIds.includes(s.id));
    const groupScores = (scores || []).filter(s => s.groupId === group.id);

    const handleSaveAttendance = async () => {
        const records = Object.entries(batchAttendance).map(([studentId, status]) => ({
            studentId: Number(studentId),
            status
        }));
        if (records.length === 0) return;
        await addBatchAttendance(group.id, selectedDate, records);
        showNotification("Davomat saqlandi", "success");
        setBatchAttendance({});
    };

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

    const handleAddScore = async () => {
        if (!selectedStudentForScore || !newScoreValue) return;
        try {
            await addScore({
                studentId: selectedStudentForScore,
                groupId: group.id,
                date: newScoreDate,
                value: parseFloat(newScoreValue),
                comment: newScoreComment
            });
            setIsScoreModalOpen(false);
            setNewScoreValue('');
            setNewScoreComment('');
            showNotification("Ball muvaffaqiyatli qo'shildi", "success");
        } catch (err) {
            showNotification("Xatolik yuz berdi", "error");
        }
    };

    const handleAddStudent = async (studentId: number) => {
        console.log(`Adding student ${studentId} to group ${group.id}`);
        await addStudentToGroup(group.id, studentId);
        setIsAddStudentModalOpen(false);
        setStudentSearch('');
    };

    const handleStartEdit = () => {
        const [start, end] = group.schedule.split(' - ');
        setEditForm({
            teacherId: group.teacherId,
            days: group.days,
            startTime: start || '',
            endTime: end || '',
            room: group.room || 0
        });
        setIsEditingInfo(true);
    };

    const handleSaveInfo = async () => {
        try {
            await updateGroup(group.id, {
                teacherId: Number(editForm.teacherId),
                days: editForm.days,
                schedule: `${editForm.startTime} - ${editForm.endTime}`,
                room: Number(editForm.room)
            });
            setIsEditingInfo(false);
            showNotification("Guruh ma'lumotlari yangilandi", "success");
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
            // Find nearest
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

    // Auto-snap to valid date on load or pattern change
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

    const availableStudents = students.filter(s => !group.studentIds.includes(s.id) && s.name.toLowerCase().includes(studentSearch.toLowerCase()));

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-700">
            <button onClick={() => navigate('/groups')} className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-sky-600 dark:hover:text-sky-400 transition-all text-[10px] font-bold uppercase tracking-widest group">
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Orqaga qaytish
            </button>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
                <div className="bg-sky-50/50 dark:bg-sky-900/30 p-10 border-b border-sky-100 dark:border-sky-800/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div>
                            <div className="flex items-center gap-4 mb-4">
                                <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 rounded-xl text-[10px] font-bold uppercase tracking-widest">Guruh faol</span>
                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ID: #{group.id}</span>
                            </div>
                            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">{group.name}</h1>
                            <div className="flex items-center gap-5 mt-4 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                <span className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                    <BookOpen size={14} className="text-sky-500 dark:text-sky-400" />
                                    {course?.name || "Noma'lum kurs"}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-5 bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 shadow-xl shadow-sky-500/5 p-5 pr-8 rounded-[2rem] shrink-0 transition-all hover:scale-105 group relative">
                            {isEditingInfo ? (
                                <div className="flex flex-col gap-2 min-w-[200px]">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">O'qituvchi</label>
                                    <select 
                                        value={editForm.teacherId}
                                        onChange={e => setEditForm({ ...editForm, teacherId: Number(e.target.value) })}
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold focus:border-sky-500 outline-none"
                                    >
                                        {teachers.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-sky-50 dark:bg-sky-900/30 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800/50 shrink-0 group-hover:bg-sky-600 dark:group-hover:bg-sky-500 group-hover:text-white transition-all shadow-inner">
                                        <Presentation size={32} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-widest">O'qituvchi</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{teacher?.name}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex px-4 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 gap-2 overflow-x-auto custom-scrollbar">
                    <TabButton label="Umumiy" icon={<Users size={16} />} active={activeTab === 'umumiy'} onClick={() => setActiveTab('umumiy')} />
                    <TabButton label="Yo'qlama" icon={<ClipboardCheck size={16} />} active={activeTab === 'yoqlama'} onClick={() => setActiveTab('yoqlama')} />
                    <TabButton label="Ballar" icon={<Award size={16} />} active={activeTab === 'ballar'} onClick={() => setActiveTab('ballar')} />
                </div>

                <div className="p-8 md:p-10">
                    {activeTab === 'umumiy' && (
                        <div className="space-y-12 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StatCardV3 
                                    label="O'quvchilar" 
                                    value={groupStudents.length}
                                    subValue="Jami faol"
                                    icon={<Users className="text-sky-500" size={20} />} 
                                    color="sky"
                                />
                                <StatCardV3 
                                    label="Davomat" 
                                    value="94%"
                                    subValue="O'rtacha ko'rsatkich"
                                    icon={<ClipboardCheck className="text-emerald-500" size={20} />} 
                                    color="emerald"
                                />
                                <StatCardV3 
                                    label="O'rtacha Ball" 
                                    value="86"
                                    subValue="Guruh natijasi"
                                    icon={<Award className="text-amber-500" size={20} />} 
                                    color="amber"
                                />
                                <StatCardV3 
                                    label="Amaliy Darslar" 
                                    value="12"
                                    subValue="Ushbu oyda"
                                    icon={<Presentation className="text-rose-500" size={20} />} 
                                    color="rose"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                <div className="lg:col-span-2 space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">O'quvchilar</h3>
                                        <button onClick={() => setIsAddStudentModalOpen(true)} 
                                            className="px-6 py-3 bg-sky-600 dark:bg-sky-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-sky-500 dark:hover:bg-sky-400 active:scale-[0.98] transition-all shadow-lg shadow-sky-500/20 flex items-center gap-3 group">
                                            <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                                            Qo'shish
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        {groupStudents.map(s => (
                                            <div key={s.id} onClick={() => navigate(`/students/${s.id}`)} 
                                                className="group bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700 p-5 rounded-[2rem] transition-all cursor-pointer hover:border-sky-300 dark:hover:border-sky-500 hover:shadow-xl hover:shadow-sky-500/5 hover:-translate-y-1">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-14 h-14 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-xl group-hover:bg-sky-600 dark:group-hover:bg-sky-500 group-hover:text-white transition-all shadow-inner">
                                                            {s.name.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate uppercase tracking-tight">{s.name}</p>
                                                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest leading-none">{s.phone}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all border ${s.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800/50' : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border-rose-100 dark:border-rose-800/50'}`}>
                                                            {s.balance.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {groupStudents.length === 0 && (
                                            <div className="col-span-full py-24 text-center border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-[2.5rem] bg-gray-50/50 dark:bg-gray-900/20">
                                                <Users className="mx-auto h-16 w-16 text-gray-200 dark:text-gray-700 mb-5" />
                                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Bu guruhda o'quvchilar yo'q</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-8">
                                    <div className="flex items-center justify-between ml-1">
                                        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Ma'lumotlar</h3>
                                        {!isEditingInfo ? (
                                            <button 
                                                onClick={handleStartEdit}
                                                className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest hover:underline"
                                            >
                                                O'zgartirish
                                            </button>
                                        ) : (
                                            <div className="flex gap-3">
                                                <button 
                                                    onClick={handleSaveInfo}
                                                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest hover:underline"
                                                >
                                                    Saqlash
                                                </button>
                                                <button 
                                                    onClick={() => setIsEditingInfo(false)}
                                                    className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest hover:underline"
                                                >
                                                    Bekor qilish
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[2.5rem] p-6 space-y-6 shadow-sm transition-colors">
                                        {isEditingInfo ? (
                                            <>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Kunlar</label>
                                                    <select 
                                                        value={editForm.days}
                                                        onChange={e => setEditForm({ ...editForm, days: e.target.value })}
                                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none"
                                                    >
                                                        <option value="TOQ">Toq kunlar</option>
                                                        <option value="JUFT">Juft kunlar</option>
                                                        <option value="HAR_KUNI">Har kuni</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Vaqt</label>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="time" 
                                                            value={editForm.startTime}
                                                            onChange={e => setEditForm({ ...editForm, startTime: e.target.value })}
                                                            className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none"
                                                        />
                                                        <span className="text-gray-300">-</span>
                                                        <input 
                                                            type="time" 
                                                            value={editForm.endTime}
                                                            onChange={e => setEditForm({ ...editForm, endTime: e.target.value })}
                                                            className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Xona</label>
                                                    <select 
                                                        value={editForm.room}
                                                        onChange={e => setEditForm({ ...editForm, room: Number(e.target.value) })}
                                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none"
                                                    >
                                                        <option value="">Tanlang...</option>
                                                        {rooms.map(r => (
                                                            <option key={r.id} value={r.id}>{r.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <InfoItem icon={<Calendar size={20} />} label="Kunlar" value={group.days} />
                                                <InfoItem icon={<Clock size={20} />} label="Vaqt" value={group.schedule} />
                                                <InfoItem icon={<Presentation size={20} />} label="Xona" value={rooms.find(r => r.id === group.room)?.name || `#${group.room || '-'}`} />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'yoqlama' && (
                        <div className="space-y-8 animate-in duration-500 zoom-in-95">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 p-8 rounded-[2rem] transition-colors relative overflow-hidden">
                                {!isDayValid(group.days, selectedDate) && (
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500/50" />
                                )}
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Davomat belgilash</h3>
                                    {!isDayValid(group.days, selectedDate) ? (
                                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-2 uppercase tracking-widest flex items-center gap-2">
                                            <XCircle size={14} />
                                            Bugun guruh kuni emas ({group.days})
                                        </p>
                                    ) : (
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest flex items-center gap-2">
                                            <Calendar size={12} className="text-sky-500" />
                                            {getDayName(selectedDate)}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-[1.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <button 
                                            onClick={() => setSelectedDate(prev => getValidDate(prev, group.days, 'prev'))}
                                            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-400 hover:text-sky-600 transition-all"
                                            title="Oldingi dars"
                                        >
                                            <ArrowLeft size={18} />
                                        </button>
                                        
                                        <div className="relative group">
                                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                                                className={`px-4 py-2 bg-transparent text-xs font-bold uppercase tracking-widest outline-none border-none ${!isDayValid(group.days, selectedDate) ? 'text-amber-600' : 'text-gray-900 dark:text-white'} transition-all`} />
                                        </div>

                                        <button 
                                            onClick={() => setSelectedDate(prev => getValidDate(prev, group.days, 'next'))}
                                            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-400 hover:text-sky-600 transition-all"
                                            title="Keyingi dars"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <button 
                                            onClick={handleSendAttendanceSms}
                                            className="px-6 py-3.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50 rounded-[1.25rem] text-[10px] font-bold uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all flex items-center gap-2 group"
                                            title="Kelmaganlarga SMS yuborish"
                                        >
                                            <Sparkles size={16} className="group-hover:animate-pulse" />
                                            SMS
                                        </button>
                                        <button onClick={handleSaveAttendance} 
                                            className={`flex-1 sm:flex-none px-10 py-3.5 bg-sky-600 dark:bg-sky-500 text-white rounded-[1.25rem] text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-sky-500/20 hover:bg-sky-500 dark:hover:bg-sky-400 active:scale-95 transition-all ${!isDayValid(group.days, selectedDate) ? 'opacity-50' : ''}`}>
                                            Saqlash
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                <div className="xl:col-span-1 border-r-0 xl:border-r border-dashed border-gray-100 dark:border-gray-800 pr-0 xl:pr-8">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight mb-6">Oylik Grafik</h3>
                                    <GroupAttendanceCalendar 
                                        group={group} 
                                        attendances={attendances} 
                                        selectedDate={selectedDate}
                                        onSelectDate={setSelectedDate}
                                        students={groupStudents}
                                    />
                                </div>
                                <div className="xl:col-span-2 space-y-6">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Davomat Tarixi (Matritsa)</h3>
                                    <AttendanceMatrix group={group} students={groupStudents} attendances={attendances} />
                                </div>
                            </div>

                            {/* Legacy list - hidden by default since matrix is interactive now */}
                            {false && (
                                <div className="bg-white dark:bg-gray-900/40 rounded-[2.5rem] overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse min-w-[500px]">
                                        <thead>
                                            <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">O'quvchi</th>
                                                <th className="p-6 text-center text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest w-72">Holati</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                            {groupStudents.map(s => {
                                                const status = batchAttendance[s.id] || (attendances.find(a => a.studentId === s.id && a.date === selectedDate && a.groupId === group.id)?.status) || '';
                                                return (
                                                    <tr key={s.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/30 transition-colors group">
                                                        <td className="p-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm shadow-inner group-hover:bg-sky-600 group-hover:text-white transition-all">
                                                                    {s.name.charAt(0)}
                                                                </div>
                                                                <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">{s.name}</p>
                                                            </div>
                                                        </td>
                                                        <td className="p-6">
                                                            <div className="flex items-center justify-center gap-4">
                                                                <AttendanceToggle active={status === 'Keldi'} onClick={() => setBatchAttendance({ ...batchAttendance, [s.id]: 'Keldi' })} type="present" />
                                                                <AttendanceToggle active={status === 'Kelmapdi'} onClick={() => setBatchAttendance({ ...batchAttendance, [s.id]: 'Kelmapdi' })} type="absent" />
                                                                <AttendanceToggle active={status === 'Sababli'} onClick={() => setBatchAttendance({ ...batchAttendance, [s.id]: 'Sababli' })} type="excused" />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {groupStudents.length === 0 && (
                                                <tr>
                                                    <td colSpan={2} className="p-24 text-center text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest">Bu guruhda o'quvchilar yo'q</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                    {activeTab === 'ballar' && (
                        <div className="space-y-10 animate-in duration-500 zoom-in-95">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">O'quvchilar Natijalari</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {groupStudents.map(s => {
                                    const studentScores = groupScores.filter(sc => sc.studentId === s.id);
                                    const avgScore = studentScores.length ? (studentScores.reduce((a, b) => a + b.value, 0) / studentScores.length).toFixed(1) : '-';
                                    return (
                                        <div key={s.id} className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700 p-6 rounded-[2rem] hover:border-sky-300 dark:hover:border-sky-500 transition-all shadow-sm hover:shadow-xl hover:shadow-sky-500/5 group hover:-translate-y-1">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex-1 pr-3 truncate">
                                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{s.name}</h4>
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedStudentForScore(s.id);
                                                            setIsScoreModalOpen(true);
                                                        }}
                                                        className="mt-3 flex items-center gap-2 px-3 py-2 bg-sky-50 dark:bg-sky-900/30 text-[10px] font-extrabold text-sky-600 dark:text-sky-400 uppercase tracking-widest hover:bg-sky-600 hover:text-white dark:hover:bg-sky-500 rounded-xl transition-all shadow-sm border border-sky-100 dark:border-sky-800/50"
                                                    >
                                                        <Plus size={14} strokeWidth={4} />
                                                        Ball qo'shish
                                                    </button>
                                                </div>
                                                <div className="w-12 h-12 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm shadow-inner shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-all transform group-hover:scale-105">
                                                    {avgScore}
                                                </div>
                                            </div>
                                            <div className="space-y-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                                                {studentScores.map(sc => (
                                                    <div key={sc.id} className="flex items-center justify-between py-3 border-b border-dashed border-gray-50 dark:border-gray-700 last:border-0">
                                                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{sc.date}</span>
                                                        <span className="text-[10px] font-extrabold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900/50 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors tabular-nums">{sc.value} B</span>
                                                    </div>
                                                ))}
                                                {studentScores.length === 0 && (
                                                    <div className="py-10 text-center flex flex-col items-center gap-4 animate-in fade-in duration-700">
                                                        <div className="w-12 h-12 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex items-center justify-center text-gray-300 dark:text-gray-600">
                                                            <Award size={24} />
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest italic opacity-60">Natijalar mavjud emas</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {groupStudents.length === 0 && (
                                    <div className="col-span-full py-24 text-center border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-[2.5rem] bg-gray-50/50 dark:bg-gray-900/20">
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Bu guruhda o'quvchilar yo'q</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Score Modal */}
            {isScoreModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsScoreModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="px-8 py-6 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Ball qo'shish</h2>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-widest">{students.find(s => s.id === selectedStudentForScore)?.name}</p>
                            </div>
                            <button onClick={() => setIsScoreModalOpen(false)} className="w-10 h-10 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                                <XCircle size={22} />
                            </button>
                        </div>
                        <div className="p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ball miqdori</label>
                                <input type="number" placeholder="Masalan: 85" value={newScoreValue} onChange={e => setNewScoreValue(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-sm font-bold focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-400/60" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Sana</label>
                                <input type="date" value={newScoreDate} onChange={e => setNewScoreDate(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-sm font-bold focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 transition-all outline-none text-gray-900 dark:text-white" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Izoh (ixtiyoriy)</label>
                                <textarea placeholder="Darsdagi faollik..." value={newScoreComment} onChange={e => setNewScoreComment(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-sm font-bold focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-400/60 min-h-[80px] resize-none" />
                            </div>
                            <button onClick={handleAddScore} className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-[1.25rem] font-bold uppercase tracking-widest text-[11px] shadow-lg shadow-sky-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                <Check size={16} strokeWidth={3} />
                                Saqlash
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {isAddStudentModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsAddStudentModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="px-8 py-6 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">O'quvchi qo'shish</h2>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-widest">Guruhga biriktirish</p>
                            </div>
                            <button onClick={() => setIsAddStudentModalOpen(false)} className="w-10 h-10 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                                <XCircle size={22} />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-sky-500 transition-colors" />
                                <input type="text" placeholder="Ism bo'yicha qidirish..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                                    className="w-full pl-11 pr-5 py-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-400/60 shadow-inner" />
                            </div>
                            <div className="max-h-[350px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                {availableStudents.map(s => (
                                    <button key={s.id} onClick={() => handleAddStudent(s.id)}
                                        className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-sky-900/20 border border-transparent hover:border-gray-100 dark:hover:border-sky-800/50 transition-all group overflow-hidden relative">
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className="w-12 h-12 bg-sky-50 dark:bg-sky-900/40 rounded-xl flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm shadow-inner group-hover:bg-sky-600 group-hover:text-white transition-all">
                                                {s.name.charAt(0)}
                                            </div>
                                            <span className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors uppercase tracking-tight">{s.name}</span>
                                        </div>
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 dark:text-gray-600 group-hover:text-sky-600 dark:group-hover:text-sky-400 group-hover:bg-sky-100 dark:group-hover:bg-sky-900/50 transition-all relative z-10 border border-transparent group-hover:border-sky-200 dark:group-hover:border-sky-800">
                                            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                                        </div>
                                    </button>
                                ))}
                                {availableStudents.length === 0 && (
                                    <div className="py-16 text-center animate-in fade-in duration-500">
                                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-200 dark:border-gray-700">
                                            <Search size={24} className="text-gray-300" />
                                        </div>
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">O'quvchi topilmadi</p>
                                    </div>
                                )}
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
        emerald: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800/50 shadow-emerald-500/5',
        rose: 'bg-rose-50 dark:bg-rose-900/30 border-rose-100 dark:border-rose-800/50 shadow-rose-500/5',
        sky: 'bg-sky-50 dark:bg-sky-900/30 border-sky-100 dark:border-sky-800/50 shadow-sky-500/5',
        amber: 'bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800/50 shadow-amber-500/5'
    }[color] || 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700';

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:shadow-xl hover:shadow-sky-500/5 hover:-translate-y-1">
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{label}</p>
                    <h5 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none tabular-nums pt-1">{value}</h5>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner transition-transform hover:rotate-12 ${colorClasses}`}>
                    {icon}
                </div>
            </div>
            <div className="pt-5 mt-5 border-t border-dashed border-gray-50 dark:border-gray-700">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 flex items-center gap-2 uppercase tracking-widest leading-none">
                    <TrendingUp size={14} className="text-sky-500" />
                    {subValue}
                </p>
            </div>
        </div>
    );
}

function TabButton({ label, icon, active, onClick }: any) {
    return (
        <button onClick={onClick} className={`px-8 py-5 text-xs font-bold uppercase tracking-widest flex items-center gap-3 transition-all relative shrink-0 ${active ? 'text-sky-600 dark:text-sky-400 bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
            <span className={`${active ? 'scale-110' : 'opacity-60'} transition-transform`}>{icon}</span>
            {label}
            {active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-600 dark:bg-sky-500 rounded-t-full shadow-[0_-2px_8px_rgba(2,132,199,0.3)]" />}
        </button>
    );
}

function InfoItem({ icon, label, value }: any) {
    return (
        <div className="flex items-center gap-5 group">
            <div className="w-12 h-12 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 rounded-2xl flex items-center justify-center text-sky-500 group-hover:bg-sky-600 dark:group-hover:bg-sky-500 group-hover:text-white transition-all shadow-sm">
                {icon}
            </div>
            <div className="min-w-0 space-y-1">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">{label}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate uppercase tracking-tight">{value}</p>
            </div>
        </div>
    );
}

function AttendanceToggle({ active, onClick, type }: any) {
    const styles = {
        present: { 
            bg: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50', 
            active: 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 scale-110 border-emerald-600', 
            icon: <CheckCircle size={20} /> 
        },
        absent: { 
            bg: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/50', 
            active: 'bg-rose-600 text-white shadow-lg shadow-rose-500/20 scale-110 border-rose-600', 
            icon: <XCircle size={20} /> 
        },
        excused: { 
            bg: 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-800/50', 
            active: 'bg-sky-600 text-white shadow-lg shadow-sky-500/20 scale-110 border-sky-600', 
            icon: <Clock size={20} /> 
        }
    }[type as 'present' | 'absent' | 'excused'];

    return (
        <button onClick={onClick} className={`w-12 h-12 rounded-[1rem] flex items-center justify-center transition-all border ${active ? styles.active : `${styles.bg} hover:border-gray-200 dark:hover:border-gray-600 hover:scale-105 opacity-60 hover:opacity-100`}`}>
            {styles.icon}
        </button>
    );
}
