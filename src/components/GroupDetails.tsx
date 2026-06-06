import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import {
    Users, Calendar, Clock, BookOpen, Plus, TrendingUp,
    CheckCircle, XCircle, ArrowLeft, Search, ClipboardCheck, ChevronRight, Presentation, Award, Check, Sparkles
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

    const availableStudents = students.filter(s => !group.studentIds.includes(s.id) && s.name.toLowerCase().includes(studentSearch.toLowerCase()));

    const labelCls = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";
    const inputCls = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Back Button */}
            <button onClick={() => navigate('/groups')} className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-[#1b6b6b] transition-all text-[10px] font-extrabold uppercase tracking-widest group cursor-pointer">
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                Orqaga
            </button>

            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="bg-teal-50/20 dark:bg-teal-950/10 p-6 md:p-8 border-b border-gray-100 dark:border-gray-700/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 text-[8px] font-black uppercase tracking-wider">Guruh faol</span>
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
                    <TabButton label="Ballar" icon={<Award size={14} />} active={activeTab === 'ballar'} onClick={() => setActiveTab('ballar')} />
                </div>

                <div className="p-6">
                    {activeTab === 'umumiy' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                    label="O'rtacha Ball" 
                                    value="86"
                                    subValue="Guruh natijasi"
                                    icon={<Award className="text-amber-500" size={16} />} 
                                    color="amber"
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
                                        {groupStudents.map(s => (
                                            <div key={s.id} onClick={() => navigate(`/students/${s.id}`)} 
                                                className="group bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all cursor-pointer flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-xl flex items-center justify-center text-[#1b6b6b] font-bold text-sm">
                                                        {s.name.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-black text-gray-900 dark:text-white truncate uppercase tracking-tight group-hover:text-[#1b6b6b] transition-colors">{s.name}</p>
                                                        <p className="text-[9px] font-bold text-gray-405 mt-0.5">{s.phone}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-[9px] font-black px-2.5 py-1 rounded-md border ${s.balance >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' : 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400'}`}>
                                                    {s.balance.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                        {groupStudents.length === 0 && (
                                            <p className="col-span-full py-12 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">Bu guruhda o'quvchilar yo'q</p>
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
                                            </>
                                        ) : (
                                            <>
                                                <InfoItem icon={<Calendar size={16} />} label="Kunlar" value={group.days === 'TOQ' ? 'Toq kunlar' : group.days === 'JUFT' ? 'Juft kunlar' : 'Har kuni'} />
                                                <InfoItem icon={<Clock size={16} />} label="Vaqt" value={group.schedule} />
                                                <InfoItem icon={<Presentation size={16} />} label="Xona" value={rooms.find(r => r.id === group.room)?.name || `#${group.room || '-'}`} />
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
                                            Bugun guruh kuni emas ({group.days})
                                        </p>
                                    ) : (
                                        <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest flex items-center gap-1">
                                            <Calendar size={12} className="text-[#1b6b6b]" />
                                            {getDayName(selectedDate)}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
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

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                <div className="xl:col-span-1 xl:border-r border-dashed border-gray-100 dark:border-gray-700/50 xl:pr-6">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-4">Oylik Grafik</span>
                                    <GroupAttendanceCalendar 
                                        group={group} 
                                        attendances={attendances} 
                                        selectedDate={selectedDate}
                                        onSelectDate={setSelectedDate}
                                        students={groupStudents}
                                    />
                                </div>
                                <div className="xl:col-span-2 space-y-4">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Davomat Matritsasi</span>
                                    <AttendanceMatrix group={group} students={groupStudents} attendances={attendances} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ballar' && (
                        <div className="space-y-6 animate-in duration-305">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pb-2 border-b border-gray-55 dark:border-gray-700/50">O'quvchilar Natijalari</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {groupStudents.map(s => {
                                    const studentScores = groupScores.filter(sc => sc.studentId === s.id);
                                    const avgScore = studentScores.length ? (studentScores.reduce((a, b) => a + b.value, 0) / studentScores.length).toFixed(1) : '-';
                                    return (
                                        <div key={s.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 p-5 rounded-3xl hover:shadow-md transition-all group">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex-1 pr-2 truncate">
                                                    <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-[#1b6b6b] transition-colors">{s.name}</h4>
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedStudentForScore(s.id);
                                                            setIsScoreModalOpen(true);
                                                        }}
                                                        className="mt-2.5 flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 dark:bg-teal-950/20 text-[9px] font-black text-[#1b6b6b] uppercase tracking-wider hover:bg-[#1b6b6b] hover:text-white rounded-lg transition-all border border-teal-100 dark:border-teal-900/40 cursor-pointer"
                                                    >
                                                        <Plus size={12} />
                                                        Ball qo'shish
                                                    </button>
                                                </div>
                                                <div className="w-10 h-10 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-center text-[#1b6b6b] font-bold text-xs shrink-0">
                                                    {avgScore}
                                                </div>
                                            </div>
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                                {studentScores.map(sc => (
                                                    <div key={sc.id} className="flex items-center justify-between py-2 border-b border-dashed border-gray-55 dark:border-gray-700 last:border-0">
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{sc.date}</span>
                                                        <span className="text-[9px] font-black text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-750 tabular-nums">{sc.value} B</span>
                                                    </div>
                                                ))}
                                                {studentScores.length === 0 && (
                                                    <p className="py-6 text-center text-[9px] text-gray-400 font-bold uppercase tracking-widest italic">Ballar kiritilmagan</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {groupStudents.length === 0 && (
                                    <p className="col-span-full py-12 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">Bu guruhda o'quvchilar yo'q</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Score Modal */}
            {isScoreModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsScoreModalOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-sm p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Ball qo'shish</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">{students.find(s => s.id === selectedStudentForScore)?.name}</p>
                            </div>
                            <button onClick={() => setIsScoreModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className={labelCls}>Ball miqdori</label>
                                <input type="number" placeholder="Masalan: 85" value={newScoreValue} onChange={e => setNewScoreValue(e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Sana</label>
                                <input type="date" value={newScoreDate} onChange={e => setNewScoreDate(e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Izoh (ixtiyoriy)</label>
                                <textarea placeholder="Darsdagi faollik..." value={newScoreComment} onChange={e => setNewScoreComment(e.target.value)} className={inputCls + " min-h-[80px] resize-none"} />
                            </div>
                            <button onClick={handleAddScore} className="w-full py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer flex items-center justify-center gap-1.5">
                                <Check size={14} />
                                Saqlash
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Student Modal */}
            {isAddStudentModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsAddStudentModalOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-sm p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">O'quvchi qo'shish</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">Guruhga biriktirish</p>
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
