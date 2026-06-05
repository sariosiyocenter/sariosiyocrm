import React, { useState, useEffect } from 'react';
import {
    Users2, Plus, X, Save, Trash2, Pencil, ChevronDown,
    User, Phone, Mail, Shield, Calendar, DollarSign, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';

type HRTab = 'xodimlar' | 'jadval' | 'maosh';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin', MANAGER: 'Menejer', TEACHER: "O'qituvchi",
    RECEPTIONIST: 'Receptionist', DRIVER: 'Haydovchi'
};
const ROLE_COLORS: Record<string, string> = {
    ADMIN: 'bg-violet-900/30 text-violet-400 border-violet-800/50',
    MANAGER: 'bg-sky-900/30 text-sky-400 border-sky-800/50',
    TEACHER: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50',
    RECEPTIONIST: 'bg-gray-800/50 text-gray-400 border-gray-700/50',
    DRIVER: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
};

const inputCls = "w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-[1.25rem] text-xs font-bold tracking-wide focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all text-white placeholder:text-[#4a5568] shadow-inner";
const labelCls = "text-[10px] font-bold text-[#4a5568] uppercase tracking-widest ml-1";
const selectCls = inputCls + " appearance-none cursor-pointer";

const MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
const ATTENDANCE_STATUS = ['Keldi', 'Kelmadi', 'Sababli'] as const;
const STATUS_ICONS: Record<string, React.ReactNode> = {
    'Keldi':   <CheckCircle2 size={16} className="text-emerald-400" />,
    'Kelmadi': <XCircle size={16} className="text-rose-400" />,
    'Sababli': <Clock size={16} className="text-amber-400" />,
    '':        <div className="w-4 h-4 rounded-full border border-white/10 bg-white/5" />,
};

export default function HRManagement() {
    const { teachers, teacherAttendances, selectedSchoolId } = useCRM();
    const { user: currentUser, token } = useCRM();

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
                else if (s === 'Kelmadi') acc.kelmadi++;
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
        { id: 'xodimlar', label: 'Xodimlar', icon: <Users2 size={16} /> },
        { id: 'jadval',   label: 'Ish Jadvali', icon: <Calendar size={16} /> },
        { id: 'maosh',    label: 'Ish Haqi',    icon: <DollarSign size={16} /> },
    ];

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-700">
            <div>
                <h1 className="text-3xl font-extrabold text-white uppercase tracking-tight">HR Menejment</h1>
                <p className="text-[10px] font-bold text-[#4a5568] mt-2 uppercase tracking-widest">Xodimlar, ish jadvali va ish haqi boshqaruvi</p>
            </div>

            {/* Tabs */}
            <div className="bg-[#141c27] rounded-[2rem] border border-white/5 p-2 flex gap-1 w-fit">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-teal-600/20 text-teal-400 border border-teal-600/30' : 'text-[#4a5568] hover:text-white'}`}>
                        {tab.icon}{tab.label}
                    </button>
                ))}
            </div>

            {/* ===== XODIMLAR ===== */}
            {activeTab === 'xodimlar' && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {Object.entries(ROLE_LABELS).map(([role, label]) => {
                            const count = users.filter(u => u.role === role).length;
                            return (
                                <div key={role} className="bg-[#141c27] border border-white/5 rounded-[2rem] p-5">
                                    <p className={`text-[9px] font-extrabold uppercase tracking-widest mb-2 ${ROLE_COLORS[role]?.split(' ')[1] || 'text-[#4a5568]'}`}>{label}</p>
                                    <p className="text-2xl font-black text-white">{count}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Header */}
                    <div className="bg-[#141c27] border border-white/5 rounded-[2.5rem] p-6 flex items-center justify-between">
                        <p className="text-sm font-extrabold text-white uppercase tracking-tight">Jami: {users.length} xodim</p>
                        {isAdminOrManager && (
                            <button onClick={() => { setNewUser({}); setIsAddOpen(true); }}
                                className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-teal-500/20 active:scale-95 transition-all group">
                                <Plus size={16} className="group-hover:rotate-90 transition-transform" />Yangi Xodim
                            </button>
                        )}
                    </div>

                    {/* Cards */}
                    {loadingUsers ? (
                        <div className="py-20 text-center text-[#4a5568] text-[10px] font-bold uppercase tracking-widest">Yuklanmoqda...</div>
                    ) : users.length === 0 ? (
                        <div className="py-20 flex flex-col items-center">
                            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4 text-[#1e2d3d]"><Users2 size={28} /></div>
                            <p className="text-[10px] font-bold text-[#4a5568] uppercase tracking-widest">Xodimlar topilmadi</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                            {users.map((u, idx) => (
                                <div key={u.id} className="bg-[#141c27] border border-white/5 rounded-[2rem] p-6 flex flex-col gap-4 group hover:border-teal-500/30 transition-all animate-in zoom-in-95 duration-300"
                                    style={{ animationDelay: `${idx * 30}ms` }}>
                                    <div className="flex items-start justify-between">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#4a5568] group-hover:text-teal-400 transition-colors">
                                            <User size={20} />
                                        </div>
                                        {isAdminOrManager && (
                                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setEditingUser({ ...u, password: '' }); setIsEditOpen(true); }}
                                                    className="w-8 h-8 flex items-center justify-center rounded-xl text-[#4a5568] hover:text-sky-400 hover:bg-sky-900/20 transition-all">
                                                    <Pencil size={14} />
                                                </button>
                                                {isAdmin && (
                                                    <button onClick={() => handleDeleteUser(u.id)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-xl text-[#4a5568] hover:text-rose-400 hover:bg-rose-900/20 transition-all">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-extrabold text-white uppercase tracking-tight">{u.name}</p>
                                        <span className={`inline-block mt-1.5 px-2.5 py-1 rounded-xl text-[9px] font-extrabold border uppercase tracking-widest ${ROLE_COLORS[u.role] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                                            {ROLE_LABELS[u.role] || u.role}
                                        </span>
                                    </div>
                                    <div className="space-y-1.5 pt-3 border-t border-white/5">
                                        {u.phone && (
                                            <div className="flex items-center gap-2 text-[#4a5568]">
                                                <Phone size={12} /><span className="text-[10px] font-bold">{u.phone}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-[#4a5568]">
                                            <Mail size={12} /><span className="text-[10px] font-bold truncate">{u.email}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ===== ISH JADVALI ===== */}
            {activeTab === 'jadval' && (
                <div className="space-y-6">
                    <div className="bg-[#141c27] border border-white/5 rounded-[2.5rem] p-6 flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[200px] space-y-1.5">
                            <label className={labelCls}>O'qituvchi tanlang</label>
                            <div className="relative">
                                <select className={selectCls} value={selectedTeacherId ?? ''} onChange={e => setSelectedTeacherId(Number(e.target.value) || null)}>
                                    <option value="">— Tanlang —</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4a5568] pointer-events-none" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="space-y-1.5">
                                <label className={labelCls}>Oy</label>
                                <div className="relative">
                                    <select className={selectCls + " w-[130px]"} value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4a5568] pointer-events-none" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelCls}>Yil</label>
                                <input type="number" className={inputCls + " w-[90px]"} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
                            </div>
                        </div>
                    </div>

                    {selectedTeacherId && (
                        <>
                            {/* Summary */}
                            {(() => { const s = attendanceSummary(); return (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-[#141c27] border border-emerald-800/30 rounded-[2rem] p-5 text-center">
                                        <p className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-widest mb-1">Keldi</p>
                                        <p className="text-2xl font-black text-emerald-400">{s.keldi}</p>
                                    </div>
                                    <div className="bg-[#141c27] border border-rose-800/30 rounded-[2rem] p-5 text-center">
                                        <p className="text-[9px] font-extrabold text-rose-400 uppercase tracking-widest mb-1">Kelmadi</p>
                                        <p className="text-2xl font-black text-rose-400">{s.kelmadi}</p>
                                    </div>
                                    <div className="bg-[#141c27] border border-amber-800/30 rounded-[2rem] p-5 text-center">
                                        <p className="text-[9px] font-extrabold text-amber-400 uppercase tracking-widest mb-1">Sababli</p>
                                        <p className="text-2xl font-black text-amber-400">{s.sababli}</p>
                                    </div>
                                </div>
                            ); })()}

                            {/* Calendar grid */}
                            <div className="bg-[#141c27] border border-white/5 rounded-[2.5rem] p-6">
                                <p className="text-[10px] font-extrabold text-white uppercase tracking-widest mb-5">
                                    {selectedTeacher?.name} — {MONTHS[selectedMonth]} {selectedYear}
                                </p>
                                <div className="grid grid-cols-7 gap-2">
                                    {Array.from({ length: daysInMonth }, (_, i) => {
                                        const day = i + 1;
                                        const status = getAttendance(day);
                                        return (
                                            <div key={day} className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-2">
                                                <span className="text-[9px] font-extrabold text-[#4a5568]">{day}</span>
                                                <div title={status || "Belgilanmagan"}>{STATUS_ICONS[status] || STATUS_ICONS['']}</div>
                                                <span className="text-[7px] font-bold text-[#4a5568] uppercase truncate w-full text-center leading-tight">
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
                        <div className="py-20 flex flex-col items-center">
                            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4 text-[#1e2d3d]"><Calendar size={28} /></div>
                            <p className="text-[10px] font-bold text-[#4a5568] uppercase tracking-widest">O'qituvchi tanlang</p>
                        </div>
                    )}
                </div>
            )}

            {/* ===== MAOSH ===== */}
            {activeTab === 'maosh' && (
                <div className="space-y-6">
                    <div className="bg-[#141c27] border border-white/5 rounded-[2.5rem] p-6">
                        <div className="space-y-1.5">
                            <label className={labelCls}>O'qituvchi tanlang</label>
                            <div className="relative max-w-xs">
                                <select className={selectCls} value={salaryTeacherId ?? ''} onChange={e => { setSalaryTeacherId(Number(e.target.value) || null); setBonuses([]); setFines([]); }}>
                                    <option value="">— Tanlang —</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4a5568] pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {salaryTeacherId && selectedSalaryTeacher && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Base info */}
                            <div className="bg-[#141c27] border border-white/5 rounded-[2.5rem] p-6 space-y-4">
                                <p className="text-[10px] font-extrabold text-white uppercase tracking-widest">Asosiy Ma'lumot</p>
                                <div className="space-y-3">
                                    <InfoRow label="Ism" value={selectedSalaryTeacher.name} />
                                    <InfoRow label="Asosiy Maosh" value={`${(selectedSalaryTeacher.salary || 0).toLocaleString()} UZS`} />
                                    <InfoRow label="Ulush %" value={`${selectedSalaryTeacher.sharePercentage || 0}%`} />
                                    <InfoRow label="Dars haqi" value={`${(selectedSalaryTeacher.lessonFee || 0).toLocaleString()} UZS`} />
                                    <InfoRow label="Tur" value={selectedSalaryTeacher.salaryType || 'FIXED'} />
                                </div>
                            </div>

                            {/* Bonus & Fine */}
                            <div className="bg-[#141c27] border border-white/5 rounded-[2.5rem] p-6 space-y-6">
                                {/* Bonus */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">Bonuslar</p>
                                    {bonuses.map((b, i) => (
                                        <div key={i} className="flex items-center justify-between bg-emerald-900/20 border border-emerald-800/30 px-4 py-2.5 rounded-2xl">
                                            <span className="text-[10px] font-bold text-emerald-400">{b.label}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-extrabold text-emerald-400">+{b.amount.toLocaleString()}</span>
                                                <button onClick={() => setBonuses(bs => bs.filter((_, j) => j !== i))} className="text-[#4a5568] hover:text-rose-400 transition-colors"><X size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Sabab" className={inputCls + " flex-1 py-2.5 text-[10px]"} value={bonusInput.label} onChange={e => setBonusInput(p => ({ ...p, label: e.target.value }))} />
                                        <input type="number" placeholder="Summa" className={inputCls + " w-24 py-2.5 text-[10px]"} value={bonusInput.amount} onChange={e => setBonusInput(p => ({ ...p, amount: e.target.value }))} />
                                        <button onClick={() => { if (bonusInput.label && bonusInput.amount) { setBonuses(b => [...b, { label: bonusInput.label, amount: Number(bonusInput.amount) }]); setBonusInput({ label: '', amount: '' }); } }}
                                            className="w-10 h-10 flex-shrink-0 bg-emerald-600 hover:bg-emerald-500 rounded-2xl flex items-center justify-center text-white transition-all">
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Fine */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-extrabold text-rose-400 uppercase tracking-widest">Jarimalar</p>
                                    {fines.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between bg-rose-900/20 border border-rose-800/30 px-4 py-2.5 rounded-2xl">
                                            <span className="text-[10px] font-bold text-rose-400">{f.label}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-extrabold text-rose-400">-{f.amount.toLocaleString()}</span>
                                                <button onClick={() => setFines(fs => fs.filter((_, j) => j !== i))} className="text-[#4a5568] hover:text-rose-400 transition-colors"><X size={12} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Sabab" className={inputCls + " flex-1 py-2.5 text-[10px]"} value={fineInput.label} onChange={e => setFineInput(p => ({ ...p, label: e.target.value }))} />
                                        <input type="number" placeholder="Summa" className={inputCls + " w-24 py-2.5 text-[10px]"} value={fineInput.amount} onChange={e => setFineInput(p => ({ ...p, amount: e.target.value }))} />
                                        <button onClick={() => { if (fineInput.label && fineInput.amount) { setFines(f => [...f, { label: fineInput.label, amount: Number(fineInput.amount) }]); setFineInput({ label: '', amount: '' }); } }}
                                            className="w-10 h-10 flex-shrink-0 bg-rose-600 hover:bg-rose-500 rounded-2xl flex items-center justify-center text-white transition-all">
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Total */}
                            <div className="bg-[#141c27] border border-teal-800/30 rounded-[2.5rem] p-6 flex flex-col justify-between">
                                <p className="text-[10px] font-extrabold text-teal-400 uppercase tracking-widest">Jami Hisob</p>
                                <div className="space-y-3 mt-4">
                                    <div className="flex justify-between">
                                        <span className="text-[10px] font-bold text-[#4a5568] uppercase tracking-widest">Asosiy Maosh</span>
                                        <span className="text-xs font-extrabold text-white">{baseSalary.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Bonuslar</span>
                                        <span className="text-xs font-extrabold text-emerald-400">+{totalBonus.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Jarimalar</span>
                                        <span className="text-xs font-extrabold text-rose-400">-{totalFine.toLocaleString()}</span>
                                    </div>
                                    <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                                        <span className="text-[10px] font-extrabold text-teal-400 uppercase tracking-widest">To'lov</span>
                                        <span className="text-xl font-black text-teal-400">{totalSalary.toLocaleString()} UZS</span>
                                    </div>
                                </div>
                                <button className="mt-6 w-full py-3.5 bg-teal-600 hover:bg-teal-500 text-white rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 transition-all">
                                    <Save size={16} />Tasdiqlayman
                                </button>
                            </div>
                        </div>
                    )}

                    {!salaryTeacherId && (
                        <div className="py-20 flex flex-col items-center">
                            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4 text-[#1e2d3d]"><DollarSign size={28} /></div>
                            <p className="text-[10px] font-bold text-[#4a5568] uppercase tracking-widest">O'qituvchi tanlang</p>
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
        <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-[10px] font-bold text-[#4a5568] uppercase tracking-widest">{label}</span>
            <span className="text-[10px] font-extrabold text-white">{value}</span>
        </div>
    );
}

function UserModal({ title, subtitle, user, onChange, onClose, onSubmit, currentUserRole, showPassword }: {
    title: string; subtitle: string; user: any; onChange: (v: any) => void;
    onClose: () => void; onSubmit: (e: React.FormEvent) => void;
    currentUserRole?: string; showPassword: boolean;
}) {
    const labelCls = "text-[10px] font-bold text-[#4a5568] uppercase tracking-widest ml-1";
    const inputCls = "w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-[1.25rem] text-xs font-bold tracking-wide focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all text-white placeholder:text-[#4a5568] shadow-inner";
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={onClose}>
            <div className="bg-[#1a2332] w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}>
                <div className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-white/5 shrink-0">
                    <div>
                        <h2 className="text-lg font-extrabold text-white uppercase tracking-tight">{title}</h2>
                        <p className={labelCls + " mt-1"}>{subtitle}</p>
                    </div>
                    <button onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-2xl text-[#4a5568] hover:text-white hover:bg-white/5 transition-all">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-2">
                        <label className={labelCls}>Ism Familiya <span className="text-rose-500">*</span></label>
                        <input required type="text" className={inputCls} value={user.name || ''} onChange={e => onChange({ ...user, name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className={labelCls}>Lavozim <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <select required className={inputCls + " appearance-none cursor-pointer"} value={user.role || 'RECEPTIONIST'} onChange={e => onChange({ ...user, role: e.target.value })}>
                                    <option value="RECEPTIONIST">Receptionist</option>
                                    <option value="TEACHER">O'qituvchi</option>
                                    <option value="DRIVER">Haydovchi</option>
                                    {(currentUserRole === 'ADMIN' || currentUserRole === 'MANAGER') && <option value="MANAGER">Menejer</option>}
                                    {currentUserRole === 'ADMIN' && <option value="ADMIN">Administrator</option>}
                                </select>
                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4a5568] pointer-events-none" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className={labelCls}>Telefon</label>
                            <input type="text" placeholder="+998 90 000 00 00" className={inputCls} value={user.phone || ''} onChange={e => onChange({ ...user, phone: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className={labelCls}>Email <span className="text-rose-500">*</span></label>
                            <input required type="text" className={inputCls} value={user.email || ''} onChange={e => onChange({ ...user, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className={labelCls}>{showPassword ? 'Parol *' : 'Yangi Parol (ixtiyoriy)'}</label>
                            <input type="password" required={showPassword} placeholder={showPassword ? 'Kamida 6 belgi' : "O'zgartirish uchun"} className={inputCls}
                                value={user.password || ''} onChange={e => onChange({ ...user, password: e.target.value })} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                        <button type="button" onClick={onClose}
                            className="px-6 py-3 bg-white/5 border border-white/10 text-[#8b9ab2] rounded-2xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-white/10 transition-all">
                            Bekor
                        </button>
                        <button type="submit"
                            className="px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 transition-all">
                            <Save size={16} />Saqlash
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
