import React, { useState, useEffect } from 'react';
import {
    Users2, Plus, X, Save, Trash2, Pencil, ChevronDown,
    User, Phone, Mail, Calendar, DollarSign, CheckCircle2, XCircle, Clock,
    GraduationCap, ExternalLink
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';

type HRTab = 'xodimlar' | 'jadval' | 'maosh';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin', MANAGER: 'Menejer', TEACHER: "O'qituvchi",
    RECEPTIONIST: 'Receptionist', DRIVER: 'Haydovchi'
};
const ROLE_COLORS: Record<string, string> = {
    ADMIN: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/40',
    MANAGER: 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/40',
    TEACHER: 'bg-teal-50 text-[#1b6b6b] border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40',
    RECEPTIONIST: 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-900/50 dark:text-gray-400 dark:border-gray-700/40',
    DRIVER: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40',
};

const inp = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

const MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
const STATUS_ICONS: Record<string, React.ReactNode> = {
    'Keldi':   <CheckCircle2 size={16} className="text-emerald-500" />,
    'Kelmadi': <XCircle size={16} className="text-rose-500" />,
    'Sababli': <Clock size={16} className="text-amber-500" />,
    '':        <div className="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" />,
};

export default function HRManagement() {
    const { teachers, teacherAttendances, selectedSchoolId, user: currentUser, token } = useCRM();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<HRTab>('xodimlar');
    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [newUser, setNewUser] = useState<any>({});
    const [editingUser, setEditingUser] = useState<any>(null);

    // Jadval tab state
    const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    // Maosh tab state
    const [salaryTeacherId, setSalaryTeacherId] = useState<number | null>(null);
    const [bonuses, setBonuses] = useState<{ label: string; amount: number }[]>([]);
    const [fines, setFines] = useState<{ label: string; amount: number }[]>([]);
    const [bonusInput, setBonusInput] = useState({ label: '', amount: '' });
    const [fineInput, setFineInput] = useState({ label: '', amount: '' });

    const isAdmin = currentUser?.role === 'ADMIN';
    const isAdminOrManager = isAdmin || currentUser?.role === 'MANAGER';

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setUsers(await res.json());
        } catch (err) { console.error('Failed to fetch users', err); }
        finally { setLoadingUsers(false); }
    };

    useEffect(() => { fetchUsers(); }, [token]);

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    ...newUser,
                    role: newUser.role || 'RECEPTIONIST',
                    password: newUser.password || 'admin123',
                    schoolId: currentUser?.role === 'MANAGER' ? currentUser.schoolId : selectedSchoolId
                })
            });
            if (res.ok) { setIsAddOpen(false); setNewUser({}); fetchUsers(); }
            else { const d = await res.json(); alert(d.error || "Xatolik yuz berdi"); }
        } catch (err) { console.error('Add user failed', err); }
    };

    const handleEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const body: any = { name: editingUser.name, role: editingUser.role, phone: editingUser.phone, email: editingUser.email };
            if (editingUser.password) body.password = editingUser.password;
            const res = await fetch(`/api/users/${editingUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            if (res.ok) { setIsEditOpen(false); setEditingUser(null); fetchUsers(); }
            else { const d = await res.json(); alert(d.error || "Xatolik yuz berdi"); }
        } catch (err) { console.error('Edit user failed', err); }
    };

    const handleDeleteUser = async (id: number) => {
        if (!window.confirm("Xodimni o'chirmoqchimisiz?")) return;
        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) fetchUsers();
        } catch (err) { console.error('Delete user failed', err); }
    };

    // Jadval helpers
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
    const getAttendance = (day: number) => {
        if (!selectedTeacherId) return '';
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return teacherAttendances.find(a => a.teacherId === selectedTeacherId && a.date === dateStr)?.status || '';
    };
    const attendanceSummary = () => {
        if (!selectedTeacherId) return { keldi: 0, kelmadi: 0, sababli: 0 };
        return Array.from({ length: daysInMonth }, (_, i) => getAttendance(i + 1)).reduce(
            (acc, s) => {
                if (s === 'Keldi') acc.keldi++;
                else if (s === 'Kelmapdi') acc.kelmadi++;
                else if (s === 'Sababli') acc.sababli++;
                return acc;
            }, { keldi: 0, kelmadi: 0, sababli: 0 }
        );
    };

    // Maosh helpers
    const selectedSalaryTeacher = teachers.find(t => t.id === salaryTeacherId);
    const totalBonus = bonuses.reduce((s, b) => s + b.amount, 0);
    const totalFine = fines.reduce((s, f) => s + f.amount, 0);
    const baseSalary = selectedSalaryTeacher?.salary || 0;
    const totalSalary = baseSalary + totalBonus - totalFine;

    const tabs: { id: HRTab; label: string; icon: React.ReactNode }[] = [
        { id: 'xodimlar', label: 'Xodimlar', icon: <Users2 size={15} /> },
        { id: 'jadval',   label: 'Ish Jadvali', icon: <Calendar size={15} /> },
        { id: 'maosh',    label: 'Ish Haqi',    icon: <DollarSign size={15} /> },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-lg shadow-[#1b6b6b]/20">
                            <Users2 size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">HR Menejment</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                Xodimlar hisobi, davomat va ish haqi boshqaruvi
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="bg-gray-50 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700/50 w-fit flex gap-1">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${activeTab === tab.id ? 'bg-[#1b6b6b] text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>
                            {tab.icon}{tab.label}
                        </button>
                    ))}
                </div>
                {activeTab === 'xodimlar' && isAdminOrManager && (
                    <button onClick={() => { setNewUser({}); setIsAddOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                        <Plus size={14} /> Yangi Xodim
                    </button>
                )}
            </div>

            {/* ===== TAB CONTENT ===== */}
            {activeTab === 'xodimlar' && (
                <div className="space-y-6">
                    {/* Role counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {Object.entries(ROLE_LABELS).map(([role, label]) => {
                            const count = users.filter(u => u.role === role).length;
                            return (
                                <div key={role} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-4 flex items-center justify-between">
                                    <div>
                                        <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1">{label}</span>
                                        <h4 className="text-lg font-black text-gray-900 dark:text-white tabular-nums">{count}</h4>
                                    </div>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border text-xs font-extrabold ${ROLE_COLORS[role] || ''}`}>
                                        {label.charAt(0)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {loadingUsers ? (
                        <div className="py-20 text-center text-[#1b6b6b] text-xs font-bold uppercase tracking-widest">Xodimlar yuklanmoqda...</div>
                    ) : users.length === 0 ? (
                        <div className="py-20 text-center bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hech qanday xodim topilmadi</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {users.map((u) => {
                                // Match teacher profile by name for TEACHER role users
                                const linkedTeacher = u.role === 'TEACHER'
                                    ? teachers.find(t => t.name.toLowerCase().trim() === u.name.toLowerCase().trim())
                                    : null;
                                return (
                                    <div key={u.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 hover:shadow-md transition-all group relative flex flex-col justify-between min-h-[180px]">
                                        <div>
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-[#1b6b6b] font-bold text-sm">
                                                    {u.role === 'TEACHER'
                                                        ? <GraduationCap size={16} className="text-teal-600 dark:text-teal-400" />
                                                        : <User size={16} />}
                                                </div>
                                                {isAdminOrManager && (
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => { setEditingUser({ ...u, password: '' }); setIsEditOpen(true); }}
                                                            className="w-7 h-7 rounded-lg text-gray-400 hover:text-[#1b6b6b] hover:bg-gray-55 dark:hover:bg-gray-900 flex items-center justify-center transition-colors cursor-pointer">
                                                            <Pencil size={13} />
                                                        </button>
                                                        {isAdmin && (
                                                            <button onClick={() => handleDeleteUser(u.id)}
                                                                className="w-7 h-7 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center justify-center transition-colors cursor-pointer">
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">{u.name}</h4>
                                                <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wider ${ROLE_COLORS[u.role] || 'bg-gray-55 text-gray-400 border-gray-100'}`}>
                                                    {ROLE_LABELS[u.role] || u.role}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-dashed border-gray-100 dark:border-gray-700/50 space-y-1">
                                            {u.phone && (
                                                <div className="flex items-center gap-2 text-gray-400">
                                                    <Phone size={11} />
                                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{u.phone}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 text-gray-400">
                                                <Mail size={11} />
                                                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 truncate max-w-[160px]">{u.email}</span>
                                            </div>
                                        </div>
                                        {/* Profile link — only shown for TEACHER role when a matching teacher record exists */}
                                        {u.role === 'TEACHER' && linkedTeacher && (
                                            <button
                                                onClick={() => navigate(`/teachers/${linkedTeacher.id}`)}
                                                className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 text-[#1b6b6b] dark:text-teal-400 rounded-xl text-[9px] font-extrabold uppercase tracking-widest hover:bg-[#1b6b6b] hover:text-white hover:border-[#1b6b6b] transition-all cursor-pointer"
                                            >
                                                <ExternalLink size={11} />
                                                Ustoz Profilini Ko'rish
                                            </button>
                                        )}
                                        {u.role === 'TEACHER' && !linkedTeacher && (
                                            <div className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-gray-50 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-[9px] font-extrabold uppercase tracking-widest text-gray-400">
                                                <GraduationCap size={11} />
                                                Profil biriktirilmagan
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ===== ISH JADVALI ===== */}
            {activeTab === 'jadval' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6 flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className={lbl}>O'qituvchi</label>
                            <select className={inp} value={selectedTeacherId ?? ''} onChange={e => setSelectedTeacherId(Number(e.target.value) || null)}>
                                <option value="">Tanlang...</option>
                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Oy</label>
                            <select className={inp + " w-36"} value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Yil</label>
                            <input type="number" className={inp + " w-24"} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
                        </div>
                    </div>

                    {selectedTeacherId && (
                        <>
                            {(() => { const s = attendanceSummary(); return (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-white dark:bg-gray-800 border border-emerald-100 dark:border-emerald-950/20 rounded-2xl p-4 text-center">
                                        <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1">Keldi</span>
                                        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{s.keldi}</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 border border-rose-100 dark:border-rose-950/20 rounded-2xl p-4 text-center">
                                        <span className="text-[9px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-widest block mb-1">Kelmadi</span>
                                        <p className="text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">{s.kelmadi}</p>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-950/20 rounded-2xl p-4 text-center">
                                        <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-1">Sababli</span>
                                        <p className="text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{s.sababli}</p>
                                    </div>
                                </div>
                            ); })()}

                            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6">
                                <h3 className="text-xs font-black text-[#1b6b6b] uppercase tracking-wider mb-5">
                                    {selectedTeacher?.name} — {MONTHS[selectedMonth]} {selectedYear}
                                </h3>
                                <div className="grid grid-cols-7 gap-2">
                                    {Array.from({ length: daysInMonth }, (_, i) => {
                                        const day = i + 1;
                                        const status = getAttendance(day);
                                        return (
                                            <div key={day} className="bg-gray-50/50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-xl p-3 flex flex-col items-center gap-2">
                                                <span className="text-[9px] font-black text-gray-400">{day}</span>
                                                <div title={status || "Belgilanmagan"}>{STATUS_ICONS[status] || STATUS_ICONS['']}</div>
                                                <span className="text-[8px] font-black text-gray-500 uppercase truncate w-full text-center">
                                                    {status || '—'}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                    {!selectedTeacherId && (
                        <div className="py-20 text-center bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">O'qituvchini tanlang</p>
                        </div>
                    )}
                </div>
            )}

            {/* ===== MAOSH ===== */}
            {activeTab === 'maosh' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6">
                        <label className={lbl}>O'qituvchi</label>
                        <select className={inp + " max-w-xs"} value={salaryTeacherId ?? ''} onChange={e => { setSalaryTeacherId(Number(e.target.value) || null); setBonuses([]); setFines([]); }}>
                            <option value="">Tanlang...</option>
                            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    {salaryTeacherId && selectedSalaryTeacher && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Base Salary Details */}
                            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 space-y-4">
                                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Asosiy ma'lumotlar</h3>
                                <div className="space-y-2">
                                    <InfoRow label="Ism" value={selectedSalaryTeacher.name} />
                                    <InfoRow label="Asosiy Maosh" value={`${(selectedSalaryTeacher.salary || 0).toLocaleString()} UZS`} />
                                    <InfoRow label="Ulush %" value={`${selectedSalaryTeacher.sharePercentage || 0}%`} />
                                    <InfoRow label="Dars haqi" value={`${(selectedSalaryTeacher.lessonFee || 0).toLocaleString()} UZS`} />
                                    <InfoRow label="Turi" value={selectedSalaryTeacher.salaryType || 'FIXED'} />
                                </div>
                            </div>

                            {/* Bonus / Fine inputs */}
                            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 space-y-6">
                                <div className="space-y-3">
                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Bonus qo'shish</span>
                                    {bonuses.map((b, i) => (
                                        <div key={i} className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-3 py-2 rounded-xl">
                                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">{b.label}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">+{b.amount.toLocaleString()}</span>
                                                <button onClick={() => setBonuses(bs => bs.filter((_, j) => j !== i))} className="text-gray-400 hover:text-rose-500 cursor-pointer"><X size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Sabab" className={inp + " py-2 text-[10px]"} value={bonusInput.label} onChange={e => setBonusInput(p => ({ ...p, label: e.target.value }))} />
                                        <input type="number" placeholder="Summa" className={inp + " w-24 py-2 text-[10px]"} value={bonusInput.amount} onChange={e => setBonusInput(p => ({ ...p, amount: e.target.value }))} />
                                        <button onClick={() => { if (bonusInput.label && bonusInput.amount) { setBonuses(b => [...b, { label: bonusInput.label, amount: Number(bonusInput.amount) }]); setBonusInput({ label: '', amount: '' }); } }}
                                            className="w-9 h-9 shrink-0 bg-[#1b6b6b] hover:bg-[#155252] rounded-xl flex items-center justify-center text-white transition-all cursor-pointer">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block">Jarima qo'shish</span>
                                    {fines.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 px-3 py-2 rounded-xl">
                                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400">{f.label}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-rose-600 dark:text-rose-400">-{f.amount.toLocaleString()}</span>
                                                <button onClick={() => setFines(fs => fs.filter((_, j) => j !== i))} className="text-gray-400 hover:text-rose-500 cursor-pointer"><X size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Sabab" className={inp + " py-2 text-[10px]"} value={fineInput.label} onChange={e => setFineInput(p => ({ ...p, label: e.target.value }))} />
                                        <input type="number" placeholder="Summa" className={inp + " w-24 py-2 text-[10px]"} value={fineInput.amount} onChange={e => setFineInput(p => ({ ...p, amount: e.target.value }))} />
                                        <button onClick={() => { if (fineInput.label && fineInput.amount) { setFines(f => [...f, { label: fineInput.label, amount: Number(fineInput.amount) }]); setFineInput({ label: '', amount: '' }); } }}
                                            className="w-9 h-9 shrink-0 bg-rose-600 hover:bg-rose-500 rounded-xl flex items-center justify-center text-white transition-all cursor-pointer">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Calculation Summary */}
                            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xs font-black text-[#1b6b6b] uppercase tracking-wider mb-4">Yakuniy hisob</h3>
                                    <div className="space-y-2.5">
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Asosiy Maosh</span>
                                            <span className="text-xs font-extrabold text-gray-900 dark:text-white">{baseSalary.toLocaleString()} UZS</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Bonuslar</span>
                                            <span className="text-xs font-extrabold text-emerald-600">+{totalBonus.toLocaleString()} UZS</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Jarimalar</span>
                                            <span className="text-xs font-extrabold text-rose-600">-{totalFine.toLocaleString()} UZS</span>
                                        </div>
                                        <div className="pt-3 border-t border-dashed border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                            <span className="text-[10px] font-extrabold text-[#1b6b6b] uppercase tracking-widest">To'lanadi</span>
                                            <span className="text-lg font-black text-[#1b6b6b]">{totalSalary.toLocaleString()} UZS</span>
                                        </div>
                                    </div>
                                </div>
                                <button className="mt-6 w-full py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-2xl text-xs font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                                    <Save size={14} /> Tasdiqlayman
                                </button>
                            </div>
                        </div>
                    )}

                    {!salaryTeacherId && (
                        <div className="py-20 text-center bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">O'qituvchini tanlang</p>
                        </div>
                    )}
                </div>
            )}

            {/* Add User Modal */}
            {isAddOpen && (
                <UserModal
                    title="Yangi Xodim" subtitle="Tizimga yangi xodim qo'shish"
                    user={newUser} onChange={setNewUser} onClose={() => setIsAddOpen(false)}
                    onSubmit={handleAddUser} currentUserRole={currentUser?.role} showPassword
                />
            )}

            {/* Edit User Modal */}
            {isEditOpen && editingUser && (
                <UserModal
                    title="Xodimni Tahrirlash" subtitle="Ma'lumotlarni yangilash"
                    user={editingUser} onChange={setEditingUser} onClose={() => setIsEditOpen(false)}
                    onSubmit={handleEditUser} currentUserRole={currentUser?.role} showPassword={false}
                />
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center py-2.5 border-b border-gray-50 dark:border-gray-700/50">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
            <span className="text-xs font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">{value}</span>
        </div>
    );
}

function UserModal({ title, subtitle, user, onChange, onClose, onSubmit, currentUserRole, showPassword }: {
    title: string; subtitle: string; user: any; onChange: (v: any) => void;
    onClose: () => void; onSubmit: (e: React.FormEvent) => void;
    currentUserRole?: string; showPassword: boolean;
}) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{title}</h3>
                        <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">{subtitle}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                </div>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className={lbl}>Ism Familiya *</label>
                        <input required type="text" className={inp} value={user.name || ''} onChange={e => onChange({ ...user, name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={lbl}>Lavozim *</label>
                            <select required className={inp} value={user.role || 'RECEPTIONIST'} onChange={e => onChange({ ...user, role: e.target.value })}>
                                <option value="RECEPTIONIST">Receptionist</option>
                                <option value="TEACHER">O'qituvchi</option>
                                <option value="DRIVER">Haydovchi</option>
                                {(currentUserRole === 'ADMIN' || currentUserRole === 'MANAGER') && <option value="MANAGER">Menejer</option>}
                                {currentUserRole === 'ADMIN' && <option value="ADMIN">Administrator</option>}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Telefon</label>
                            <input type="text" placeholder="+998" className={inp} value={user.phone || ''} onChange={e => onChange({ ...user, phone: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={lbl}>Email *</label>
                            <input required type="email" className={inp} value={user.email || ''} onChange={e => onChange({ ...user, email: e.target.value })} />
                        </div>
                        <div>
                            <label className={lbl}>{showPassword ? 'Parol *' : 'Yangi Parol'}</label>
                            <input type="password" required={showPassword} placeholder={showPassword ? 'Kamida 6 belgi' : "O'zgartirish uchun"} className={inp}
                                value={user.password || ''} onChange={e => onChange({ ...user, password: e.target.value })} />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                            Bekor
                        </button>
                        <button type="submit"
                            className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                            Saqlash
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
