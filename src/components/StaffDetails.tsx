import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, Phone, Mail, Layers, Wallet,
    Plus, X, Save, Target, Star, AlertCircle, GraduationCap, Pencil, Camera, Sparkles,
    CheckCircle2, XCircle, ChevronLeft, ChevronRight, CalendarDays,
    Banknote, Clock, Trash2
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useParams, useNavigate } from 'react-router-dom';
import { compressImage } from '../lib/image';
import PhotoCapture from './PhotoCapture';

const ROLE_LABELS: Record<string, string> = {
    ADMIN:           'Admin',
    MANAGER:         'Menejer',
    TEACHER:         "O'qituvchi",
    SUPPORT_TEACHER: "Yord. O'qituvchi",
    RECEPTIONIST:    'Receptionist',
    DRIVER:          'Haydovchi',
    TECH_STAFF:      'Tex. Xodim',
};

const ROLE_COLORS: Record<string, string> = {
    ADMIN:           'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400',
    MANAGER:         'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400',
    TEACHER:         'bg-teal-50 text-[#1b6b6b] border-teal-100 dark:bg-teal-950/20 dark:text-teal-400',
    SUPPORT_TEACHER: 'bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-950/20 dark:text-cyan-400',
    RECEPTIONIST:    'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-900/50 dark:text-gray-400',
    DRIVER:          'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400',
    TECH_STAFF:      'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/20 dark:text-orange-400',
};

const ROLE_GRADIENT: Record<string, string> = {
    ADMIN:           'from-purple-500 to-purple-700',
    MANAGER:         'from-sky-500 to-sky-700',
    TEACHER:         'from-teal-500 to-[#1b6b6b]',
    SUPPORT_TEACHER: 'from-cyan-500 to-cyan-700',
    RECEPTIONIST:    'from-gray-400 to-gray-600',
    DRIVER:          'from-amber-500 to-amber-700',
    TECH_STAFF:      'from-orange-500 to-orange-700',
};


const MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
const WEEK_DAYS      = ['Du','Se','Ch','Pa','Ju','Sh','Ya'];
const WEEK_DAYS_FULL = ['Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba','Yakshanba'];
// JS getDay(): 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
const DAY_JS: Record<string,number> = { Du:1, Se:2, Ch:3, Pa:4, Ju:5, Sh:6, Ya:0 };

const inp = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

export default function StaffDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { teachers, token, user: currentUser } = useCRM();

    const [activeTab, setActiveTab] = useState('umumiy');
    const [staffUser, setStaffUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Salary
    const [bonuses, setBonuses] = useState<{ label: string; amount: number }[]>([]);
    const [fines,   setFines]   = useState<{ label: string; amount: number }[]>([]);
    const [bonusInput, setBonusInput] = useState({ label: '', amount: '' });
    const [fineInput,  setFineInput]  = useState({ label: '', amount: '' });

    // Month / year
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const [selMonth, setSelMonth] = useState(today.getMonth());
    const [selYear,  setSelYear]  = useState(today.getFullYear());

    // Work days
    const [workDays,     setWorkDays]     = useState<string[]>([]);
    const [editWorkDays, setEditWorkDays] = useState<string[]>([]);
    const [savingWD,     setSavingWD]     = useState(false);

    // Staff attendance
    const [staffAtt,    setStaffAtt]    = useState<any[]>([]);
    const [attLoading,  setAttLoading]  = useState(false);
    const [attPicker,   setAttPicker]   = useState<string | null>(null);

    // Salary payments
    const [salaryPayments, setSalaryPayments] = useState<any[]>([]);
    const [payMonth, setPayMonth] = useState(today.getMonth());
    const [payYear,  setPayYear]  = useState(today.getFullYear());
    const [payConfirm, setPayConfirm] = useState(false);
    const [paying,     setPaying]     = useState(false);

    // Inline salary / kpi edit
    const [editingSalary,  setEditingSalary]  = useState(false);
    const [salaryDraft,    setSalaryDraft]    = useState('');
    const [editingKpi,     setEditingKpi]     = useState(false);
    const [kpiDraft,       setKpiDraft]       = useState('');

    // KPI calculation from groups
    const [kpiData,    setKpiData]    = useState<any>(null);
    const [kpiLoading, setKpiLoading] = useState(false);

    // Edit modal
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editData,   setEditData]   = useState<any>({});
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [isRemovingBg, setIsRemovingBg] = useState(false);
    const fileRef = React.useRef<HTMLInputElement>(null);

    const isAdminOrManager = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

    // Load user
    useEffect(() => {
        if (!id || !token) return;
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(users => {
                const found = users.find((u: any) => u.id === Number(id));
                setStaffUser(found || null);
                if (found?.workDays) {
                    try {
                        const p = JSON.parse(found.workDays);
                        setWorkDays(Array.isArray(p) ? p : []);
                        setEditWorkDays(Array.isArray(p) ? p : []);
                    } catch { /* keep empty */ }
                }
            })
            .catch(() => setStaffUser(null))
            .finally(() => setLoading(false));
    }, [id, token]);

    // Fetch salary payment history
    useEffect(() => {
        if (!staffUser || !token) return;
        fetch(`/api/salary-payments?userId=${staffUser.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(r => r.json())
        .then(data => setSalaryPayments(Array.isArray(data) ? data : []))
        .catch(() => setSalaryPayments([]));
    }, [staffUser?.id, token]);

    // Fetch attendance whenever user/month changes
    useEffect(() => {
        if (!staffUser || !token) return;
        const month = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`;
        setAttLoading(true);
        fetch(`/api/staff-attendance?userId=${staffUser.id}&month=${month}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(r => r.json())
        .then(data => setStaffAtt(Array.isArray(data) ? data : []))
        .catch(() => setStaffAtt([]))
        .finally(() => setAttLoading(false));
    }, [staffUser?.id, token, selMonth, selYear]);

    // Fetch KPI calculation when in maosh tab and month changes
    useEffect(() => {
        if (activeTab !== 'maosh' || !staffUser || !token) return;
        const month = `${payYear}-${String(payMonth + 1).padStart(2, '0')}`;
        setKpiLoading(true);
        fetch(`/api/kpi-calculation?userId=${staffUser.id}&month=${month}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(r => r.json())
        .then(data => setKpiData(data))
        .catch(() => setKpiData(null))
        .finally(() => setKpiLoading(false));
    }, [activeTab, staffUser?.id, token, payMonth, payYear]);

    if (loading) {
        return <div className="py-20 text-center text-[#1b6b6b] text-xs font-bold uppercase tracking-widest">Yuklanmoqda...</div>;
    }
    if (!staffUser) {
        return (
            <div className="p-12 text-center text-gray-500 font-bold text-sm bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
                Xodim topilmadi
            </div>
        );
    }

    const linkedTeacher = (staffUser.role === 'TEACHER' || staffUser.role === 'SUPPORT_TEACHER')
        ? teachers.find(t => t.name.toLowerCase().trim() === staffUser.name.toLowerCase().trim())
        : null;

    // Salary
    const baseSalary  = staffUser.salary || 0;
    const kpiPercent  = staffUser.kpiPercent || 0;
    const kpiAmount   = kpiData?.kpiAmount || 0;
    const totalBonus  = bonuses.reduce((s, b) => s + b.amount, 0);
    const totalFine   = fines.reduce((s, f) => s + f.amount, 0);
    const totalSalary = baseSalary + kpiAmount + totalBonus - totalFine;

    // Attendance summary for current month
    const presentDays = staffAtt.filter(a => a.status === 'Keldi').length;
    const absentDays  = staffAtt.filter(a => a.status === 'Kelmadi').length;
    const excusedDays = staffAtt.filter(a => a.status === 'Sababli').length;

    // Calendar cells for selected month
    const daysInMonth  = new Date(selYear, selMonth + 1, 0).getDate();
    const firstDayJS   = new Date(selYear, selMonth, 1).getDay();
    const firstDayMon  = firstDayJS === 0 ? 6 : firstDayJS - 1; // Monday-first
    const calCells: (number | null)[] = [
        ...Array(firstDayMon).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (calCells.length % 7 !== 0) calCells.push(null);

    const isWorkDay = (dayNum: number) => {
        if (workDays.length === 0) return false;
        const jsDay = new Date(selYear, selMonth, dayNum).getDay();
        const key   = WEEK_DAYS.find(d => DAY_JS[d] === jsDay);
        return key ? workDays.includes(key) : false;
    };
    const getAttStatus = (dayNum: number) => {
        const ds = `${selYear}-${String(selMonth + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
        return staffAtt.find(a => a.date === ds)?.status ?? null;
    };
    const toDateStr = (dayNum: number) =>
        `${selYear}-${String(selMonth + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;

    // Mark attendance
    const markAttendance = async (date: string, status: string) => {
        try {
            if (status === 'delete') {
                await fetch(`/api/staff-attendance?userId=${staffUser.id}&date=${date}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });
                setStaffAtt(prev => prev.filter(a => a.date !== date));
            } else {
                const res = await fetch('/api/staff-attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ userId: staffUser.id, date, status }),
                });
                if (res.ok) {
                    const updated = await res.json();
                    setStaffAtt(prev => [...prev.filter(a => a.date !== date), updated]);
                }
            }
        } catch { /* ignore */ }
        setAttPicker(null);
    };

    // Save work schedule
    const saveWorkDays = async () => {
        setSavingWD(true);
        try {
            const res = await fetch(`/api/users/${staffUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ workDays: JSON.stringify(editWorkDays) }),
            });
            if (res.ok) {
                setWorkDays(editWorkDays);
                setStaffUser((p: any) => ({ ...p, workDays: JSON.stringify(editWorkDays) }));
            }
        } catch { /* ignore */ }
        setSavingWD(false);
    };

    const workDaysChanged =
        JSON.stringify([...editWorkDays].sort()) !== JSON.stringify([...workDays].sort());

    // Save user edit
    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        const body: any = {
            name: editData.name, phone: editData.phone,
            photo: editData.photo, position: editData.position, salary: editData.salary,
        };
        if (editData.password) body.password = editData.password;
        try {
            const res = await fetch(`/api/users/${staffUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            if (res.ok) { setStaffUser(await res.json()); setIsEditOpen(false); }
        } catch { /* ignore */ }
    };

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async ev => {
            const c = await compressImage(ev.target?.result as string);
            setEditData((p: any) => ({ ...p, photo: c }));
        };
        reader.readAsDataURL(file);
    };

    const handlePhotoCapture = async (base64: string) => {
        const compressed = await compressImage(base64);
        try {
            const res = await fetch(`/api/users/${staffUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ photo: compressed }),
            });
            if (res.ok) setStaffUser((p: any) => ({ ...p, photo: compressed }));
        } catch { /* ignore */ }
        setIsPhotoModalOpen(false);
    };

    const handleRemoveBg = async () => {
        if (!staffUser?.photo) return;
        try {
            setIsRemovingBg(true);
            const res = await fetch('/api/utils/remove-bg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ image: staffUser.photo }),
            });
            const data = await res.json();
            if (data.success) {
                await fetch(`/api/users/${staffUser.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ photo: data.image }),
                });
                setStaffUser((p: any) => ({ ...p, photo: data.image }));
            } else {
                alert('Xatolik: ' + (data.error || 'Noma\'lum xatolik'));
            }
        } catch {
            alert('Xatolik yuz berdi');
        } finally {
            setIsRemovingBg(false);
        }
    };

    // Salary payment helpers
    const payMonthStr = `${payYear}-${String(payMonth + 1).padStart(2, '0')}`;
    const currentPayment = salaryPayments.find(p => p.month === payMonthStr) || null;
    const prevPayMonth = () => { if (payMonth === 0) { setPayMonth(11); setPayYear(y => y-1); } else setPayMonth(m => m-1); };
    const nextPayMonth = () => { if (payMonth === 11) { setPayMonth(0); setPayYear(y => y+1); } else setPayMonth(m => m+1); };

    const paySalary = async () => {
        setPaying(true);
        try {
            const res = await fetch('/api/salary-payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    userId: staffUser.id,
                    month: payMonthStr,
                    amount: totalSalary,
                    baseSalary,
                    bonuses: totalBonus,
                    fines: totalFine,
                }),
            });
            if (res.ok) {
                const payment = await res.json();
                setSalaryPayments(prev => [...prev.filter(p => p.month !== payMonthStr), payment]);
                setBonuses([]);
                setFines([]);
                setPayConfirm(false);
            }
        } catch { /* ignore */ }
        setPaying(false);
    };

    const deleteSalaryPayment = async (pid: number) => {
        try {
            await fetch(`/api/salary-payments/${pid}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            setSalaryPayments(prev => prev.filter(p => p.id !== pid));
        } catch { /* ignore */ }
    };

    const saveSalaryInline = async () => {
        const val = parseInt(salaryDraft) || 0;
        try {
            const res = await fetch(`/api/users/${staffUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ salary: val }),
            });
            if (res.ok) setStaffUser((p: any) => ({ ...p, salary: val }));
        } catch { /* ignore */ }
        setEditingSalary(false);
    };

    const saveKpiInline = async () => {
        const val = Math.min(100, Math.max(0, parseInt(kpiDraft) || 0));
        try {
            const res = await fetch(`/api/users/${staffUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ kpiPercent: val }),
            });
            if (res.ok) {
                setStaffUser((p: any) => ({ ...p, kpiPercent: val }));
                // Re-fetch KPI calculation with new percent
                const month = `${payYear}-${String(payMonth + 1).padStart(2, '0')}`;
                fetch(`/api/kpi-calculation?userId=${staffUser.id}&month=${month}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }).then(r => r.json()).then(setKpiData).catch(() => {});
            }
        } catch { /* ignore */ }
        setEditingKpi(false);
    };

    const prevMonth = () => { if (selMonth === 0) { setSelMonth(11); setSelYear(y => y-1); } else setSelMonth(m => m-1); };
    const nextMonth = () => { if (selMonth === 11) { setSelMonth(0); setSelYear(y => y+1); } else setSelMonth(m => m+1); };

    const tabs = [
        { id: 'umumiy', label: 'Umumiy',     icon: <Layers size={14} /> },
        { id: 'maosh',  label: 'Ish Haqi',   icon: <Wallet size={14} /> },
        { id: 'jadval', label: 'Ish Jadvali', icon: <CalendarDays size={14} /> },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Back */}
            <button onClick={() => navigate('/hr')}
                className="flex items-center gap-2 text-gray-400 hover:text-[#1b6b6b] transition-all text-[10px] font-extrabold uppercase tracking-widest group cursor-pointer">
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                Xodimlar ro'yxati
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* Left profile card */}
                <div className="lg:col-span-1 space-y-5">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                        {/* Banner */}
                        <div className={`h-48 bg-gradient-to-br ${ROLE_GRADIENT[staffUser.role] || 'from-gray-400 to-gray-600'} relative`}>
                            {isAdminOrManager && (
                                <button
                                    onClick={() => { setEditData({ ...staffUser, password: '' }); setIsEditOpen(true); }}
                                    className="absolute top-3 right-3 w-8 h-8 bg-white/20 hover:bg-white/40 rounded-xl flex items-center justify-center text-white transition-all cursor-pointer">
                                    <Pencil size={13} />
                                </button>
                            )}
                            {/* Avatar — centred, extends below banner */}
                            <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 rounded-2xl bg-white dark:bg-gray-800 p-2 shadow-xl group/avatar">
                                <div className="w-40 h-40 rounded-xl overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700/50 relative">
                                    {staffUser.photo ? (
                                        <img src={staffUser.photo} alt={staffUser.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-5xl font-black text-[#1b6b6b]">
                                            {staffUser.name?.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                    {isAdminOrManager && (
                                        <button
                                            onClick={() => setIsPhotoModalOpen(true)}
                                            className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer">
                                            <Camera size={24} className="text-white" />
                                            <span className="text-[9px] font-extrabold text-white uppercase tracking-widest">Rasm</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Name / role */}
                        <div className="pt-24 pb-6 px-6 text-center">
                            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{staffUser.name}</h2>
                            {staffUser.position && (
                                <p className="text-[9px] font-bold text-gray-400 mt-1">{staffUser.position}</p>
                            )}
                            <div className="mt-3 flex justify-center">
                                <span className={`px-2.5 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wider ${ROLE_COLORS[staffUser.role] || ''}`}>
                                    {ROLE_LABELS[staffUser.role] || staffUser.role}
                                </span>
                            </div>
                            {isAdminOrManager && staffUser.photo && (
                                <button
                                    onClick={handleRemoveBg}
                                    disabled={isRemovingBg}
                                    className="mt-3 flex items-center gap-1.5 px-4 py-2 mx-auto bg-violet-50 text-violet-600 border border-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/30 rounded-xl text-[9px] font-extrabold uppercase tracking-widest hover:bg-violet-600 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    <Sparkles size={11} className={isRemovingBg ? 'animate-spin' : ''} />
                                    {isRemovingBg ? 'Tozalanmoqda...' : 'Fonni tozalash'}
                                </button>
                            )}
                        </div>

                        <div className="px-6 pb-6 space-y-3 border-t border-dashed border-gray-100 dark:border-gray-700/50 pt-4">
                            {staffUser.phone && <DetailRow icon={<Phone size={14} />} label="Telefon" value={staffUser.phone} />}
                            {staffUser.role !== 'TECH_STAFF' && staffUser.email && (
                                <DetailRow icon={<Mail size={14} />} label="Email" value={staffUser.email} />
                            )}
                        </div>
                    </div>

                    {/* Salary card */}
                    <div className="bg-[#1b6b6b] rounded-3xl p-6 text-white shadow-lg shadow-[#1b6b6b]/20 relative overflow-hidden">
                        <span className="text-[9px] font-black text-teal-100 uppercase tracking-widest block mb-3">Asosiy Oylik</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black tracking-tight tabular-nums">{baseSalary.toLocaleString()}</span>
                            <span className="text-[9px] font-extrabold text-teal-200 uppercase tracking-widest">UZS</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                            <span className="text-[9px] text-teal-200 font-bold uppercase tracking-widest">KPI qo'shilganda</span>
                            <span className="text-sm font-black">{totalSalary.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Right tabs */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden min-h-[500px]">
                        <div className="flex px-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/50 gap-2">
                            {tabs.map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                    className={`px-5 py-4 text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 transition-all relative shrink-0 cursor-pointer ${activeTab === tab.id ? 'text-[#1b6b6b] bg-white dark:bg-gray-800' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                                    {tab.icon}{tab.label}
                                    {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1b6b6b] rounded-t-full" />}
                                </button>
                            ))}
                        </div>

                        <div className="p-6">
                            {/* ── UMUMIY ── */}
                            {activeTab === 'umumiy' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        <StatCard label="Davomat" value={`${presentDays} kun`} sub="Bu oy keldi" color="emerald" />
                                        <StatCard label="Sababsiz" value={`${absentDays} kun`} sub="Bu oy kelmadi" color="rose" />
                                        <StatCard label="Sababli"  value={`${excusedDays} kun`} sub="Bu oy" color="amber" />
                                    </div>

                                    <div className="space-y-3">
                                        <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block border-b border-gray-50 dark:border-gray-700/50 pb-2">
                                            Xodim ma'lumotlari
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <InfoBox label="ID"           value={`#${staffUser.id}`} />
                                            <InfoBox label="Lavozim"      value={ROLE_LABELS[staffUser.role] || staffUser.role} />
                                            {staffUser.position && <InfoBox label="Vazifa" value={staffUser.position} />}
                                            <InfoBox label="Asosiy maosh" value={`${baseSalary.toLocaleString()} UZS`} />
                                            {staffUser.phone && <InfoBox label="Telefon" value={staffUser.phone} />}
                                        </div>
                                    </div>

                                    {linkedTeacher && (
                                        <div>
                                            <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block border-b border-gray-50 dark:border-gray-700/50 pb-2 mb-3">
                                                Biriktirilgan o'qituvchi profili
                                            </span>
                                            <button onClick={() => navigate(`/teachers/${linkedTeacher.id}`)}
                                                className="flex items-center gap-3 p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-2xl hover:bg-[#1b6b6b] hover:text-white group transition-all cursor-pointer w-full text-left">
                                                <div className="w-10 h-10 rounded-xl bg-[#1b6b6b]/10 group-hover:bg-white/20 flex items-center justify-center text-[#1b6b6b] group-hover:text-white transition-all">
                                                    <GraduationCap size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-[#1b6b6b] group-hover:text-white uppercase tracking-wide transition-all">{linkedTeacher.name}</p>
                                                    <p className="text-[9px] font-bold text-teal-600 dark:text-teal-400 group-hover:text-teal-100 mt-0.5 uppercase tracking-widest">O'qituvchi profilini ko'rish →</p>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── ISH HAQI ── */}
                            {activeTab === 'maosh' && (
                                <div className="space-y-6 animate-in fade-in duration-300">

                                    {/* Inline base salary editor */}
                                    <div className="flex items-center gap-4 p-4 bg-[#1b6b6b]/5 border border-[#1b6b6b]/15 rounded-2xl">
                                        <div className="flex-1 min-w-0">
                                            <span className={lbl}>Asosiy Maosh (UZS)</span>
                                            {editingSalary ? (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <input
                                                        type="number" autoFocus
                                                        className={inp + " py-2 text-sm"}
                                                        value={salaryDraft}
                                                        onChange={e => setSalaryDraft(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') saveSalaryInline(); if (e.key === 'Escape') setEditingSalary(false); }}
                                                    />
                                                    <button onClick={saveSalaryInline} className="px-4 py-2 bg-[#1b6b6b] hover:bg-[#155252] text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl cursor-pointer transition-all whitespace-nowrap">Saqlash</button>
                                                    <button onClick={() => setEditingSalary(false)} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl cursor-pointer hover:bg-gray-200 transition-all">Bekor</button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{baseSalary.toLocaleString()}</span>
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">UZS</span>
                                                    {isAdminOrManager && (
                                                        <button
                                                            onClick={() => { setSalaryDraft(String(baseSalary)); setEditingSalary(true); }}
                                                            className="ml-1 text-gray-400 hover:text-[#1b6b6b] transition-colors cursor-pointer">
                                                            <Pencil size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <span className={lbl}>KPI Foizi (%)</span>
                                            {editingKpi ? (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <input
                                                        type="number" autoFocus min={0} max={100}
                                                        className={inp + " py-2 text-sm w-20"}
                                                        value={kpiDraft}
                                                        onChange={e => setKpiDraft(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') saveKpiInline(); if (e.key === 'Escape') setEditingKpi(false); }}
                                                    />
                                                    <button onClick={saveKpiInline} className="px-3 py-2 bg-[#1b6b6b] hover:bg-[#155252] text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl cursor-pointer transition-all">✓</button>
                                                    <button onClick={() => setEditingKpi(false)} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl cursor-pointer hover:bg-gray-200 transition-all">✕</button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2 mt-1">
                                                    <span className="text-2xl font-black text-[#1b6b6b] tabular-nums">{kpiPercent}</span>
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">%</span>
                                                    {isAdminOrManager && (
                                                        <button
                                                            onClick={() => { setKpiDraft(String(kpiPercent)); setEditingKpi(true); }}
                                                            className="ml-1 text-gray-400 hover:text-[#1b6b6b] transition-colors cursor-pointer">
                                                            <Pencil size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Month selector */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Banknote size={11} /> Oylik hisoblash
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={prevPayMonth} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-500 hover:border-[#1b6b6b] hover:text-[#1b6b6b] transition-all cursor-pointer">
                                                <ChevronLeft size={14} />
                                            </button>
                                            <span className="text-xs font-black text-gray-900 dark:text-white min-w-[120px] text-center">{MONTHS[payMonth]} {payYear}</span>
                                            <button onClick={nextPayMonth} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-500 hover:border-[#1b6b6b] hover:text-[#1b6b6b] transition-all cursor-pointer">
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Payment status banner */}
                                    {currentPayment ? (
                                        <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                                                    <CheckCircle2 size={20} className="text-white" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                                                        {MONTHS[payMonth]} {payYear} — Oylik berildi ✓
                                                    </p>
                                                    <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500 mt-0.5 uppercase tracking-widest">
                                                        {currentPayment.amount.toLocaleString()} UZS · {new Date(currentPayment.paidAt).toLocaleDateString('uz-UZ')}
                                                    </p>
                                                </div>
                                            </div>
                                            {isAdminOrManager && (
                                                <button onClick={() => deleteSalaryPayment(currentPayment.id)}
                                                    className="text-gray-400 hover:text-rose-500 transition-colors cursor-pointer p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl">
                                            <div className="w-10 h-10 bg-rose-100 dark:bg-rose-950/40 rounded-xl flex items-center justify-center shrink-0">
                                                <Clock size={18} className="text-rose-500" />
                                            </div>
                                            <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                                                {MONTHS[payMonth]} {payYear} — Oylik hali berilmagan
                                            </p>
                                        </div>
                                    )}

                                    {/* KPI + adjustments + summary (only if not paid yet) */}
                                    {!currentPayment && (
                                        <div className="space-y-6">
                                            {/* KPI group breakdown — teachers only */}
                                            {(staffUser.role === 'TEACHER' || staffUser.role === 'SUPPORT_TEACHER') && (
                                                <div className="space-y-3">
                                                    <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <Target size={11} /> KPI hisoblash — {MONTHS[payMonth]} {payYear}
                                                    </p>
                                                    {kpiLoading ? (
                                                        <div className="py-8 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">Hisoblanmoqda...</div>
                                                    ) : kpiPercent === 0 ? (
                                                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-center">
                                                            <p className="text-[10px] text-gray-400 font-bold">KPI foizi belgilanmagan. Yuqorida % kiriting.</p>
                                                        </div>
                                                    ) : kpiData?.groups?.length > 0 ? (
                                                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700/50 rounded-2xl overflow-hidden">
                                                            <table className="w-full text-left">
                                                                <thead>
                                                                    <tr className="bg-gray-50 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-800">
                                                                        <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Guruh</th>
                                                                        <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">O'quvchilar</th>
                                                                        <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">To'lovlar</th>
                                                                        <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">KPI ({kpiPercent}%)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                                                    {kpiData.groups.map((g: any) => (
                                                                        <tr key={g.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                                                            <td className="p-3 text-[10px] font-black text-gray-900 dark:text-white">{g.name}</td>
                                                                            <td className="p-3 text-[10px] font-bold text-gray-500">{g.studentCount} ta</td>
                                                                            <td className="p-3 text-[10px] font-bold text-gray-700 dark:text-gray-300 text-right">{g.total.toLocaleString()}</td>
                                                                            <td className="p-3 text-[10px] font-black text-[#1b6b6b] text-right">+{Math.round(g.total * kpiPercent / 100).toLocaleString()}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                                <tfoot>
                                                                    <tr className="border-t border-gray-100 dark:border-gray-700 bg-[#1b6b6b]/5">
                                                                        <td colSpan={2} className="p-3 text-[9px] font-extrabold text-[#1b6b6b] uppercase tracking-widest">Jami KPI</td>
                                                                        <td className="p-3 text-[10px] font-bold text-gray-600 dark:text-gray-300 text-right">{kpiData.totalPayments?.toLocaleString()}</td>
                                                                        <td className="p-3 text-[11px] font-black text-[#1b6b6b] text-right">+{kpiAmount.toLocaleString()} UZS</td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-center">
                                                            <p className="text-[10px] text-gray-400 font-bold">Bu oyda guruh to'lovlari topilmadi.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Manual adjustments + summary */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                <div className="space-y-4">
                                                    {/* Manual bonus */}
                                                    <div className="space-y-2">
                                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1"><Star size={10} /> Qo'shimcha bonus</span>
                                                        {bonuses.map((b, i) => (
                                                            <div key={i} className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-3 py-2 rounded-xl">
                                                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">{b.label}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400">+{b.amount.toLocaleString()}</span>
                                                                    <button onClick={() => setBonuses(bs => bs.filter((_,j) => j!==i))} className="text-gray-400 hover:text-rose-500 cursor-pointer"><X size={11} /></button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div className="flex gap-2">
                                                            <input type="text"   placeholder="Sabab" className={inp + " py-2 text-[10px]"} value={bonusInput.label}  onChange={e => setBonusInput(p=>({...p,label:e.target.value}))} />
                                                            <input type="number" placeholder="Summa" className={inp + " w-24 py-2 text-[10px]"} value={bonusInput.amount} onChange={e => setBonusInput(p=>({...p,amount:e.target.value}))} />
                                                            <button onClick={() => { if (bonusInput.label&&bonusInput.amount) { setBonuses(b=>[...b,{label:bonusInput.label,amount:Number(bonusInput.amount)}]); setBonusInput({label:'',amount:''}); } }} className="w-9 h-9 shrink-0 bg-[#1b6b6b] hover:bg-[#155252] rounded-xl flex items-center justify-center text-white transition-all cursor-pointer"><Plus size={13} /></button>
                                                        </div>
                                                    </div>

                                                    {/* Manual fine */}
                                                    <div className="space-y-2">
                                                        <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1"><AlertCircle size={10} /> Jarima</span>
                                                        {fines.map((f, i) => (
                                                            <div key={i} className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 px-3 py-2 rounded-xl">
                                                                <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400">{f.label}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] font-black text-rose-600 dark:text-rose-400">-{f.amount.toLocaleString()}</span>
                                                                    <button onClick={() => setFines(fs => fs.filter((_,j) => j!==i))} className="text-gray-400 hover:text-rose-500 cursor-pointer"><X size={11} /></button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div className="flex gap-2">
                                                            <input type="text"   placeholder="Sabab" className={inp + " py-2 text-[10px]"} value={fineInput.label}  onChange={e => setFineInput(p=>({...p,label:e.target.value}))} />
                                                            <input type="number" placeholder="Summa" className={inp + " w-24 py-2 text-[10px]"} value={fineInput.amount} onChange={e => setFineInput(p=>({...p,amount:e.target.value}))} />
                                                            <button onClick={() => { if (fineInput.label&&fineInput.amount) { setFines(f=>[...f,{label:fineInput.label,amount:Number(fineInput.amount)}]); setFineInput({label:'',amount:''}); } }} className="w-9 h-9 shrink-0 bg-rose-600 hover:bg-rose-500 rounded-xl flex items-center justify-center text-white transition-all cursor-pointer"><Plus size={13} /></button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Summary + pay button */}
                                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 flex flex-col justify-between">
                                                    <div>
                                                        <h3 className="text-xs font-black text-[#1b6b6b] uppercase tracking-wider mb-5">
                                                            {MONTHS[payMonth]} {payYear} — Hisob
                                                        </h3>
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Asosiy Maosh</span>
                                                                <span className="text-xs font-extrabold text-gray-900 dark:text-white">{baseSalary.toLocaleString()} UZS</span>
                                                            </div>
                                                            {kpiAmount > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest">KPI ({kpiPercent}%)</span>
                                                                    <span className="text-xs font-extrabold text-[#1b6b6b]">+{kpiAmount.toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between">
                                                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Bonuslar ({bonuses.length})</span>
                                                                <span className="text-xs font-extrabold text-emerald-600">+{totalBonus.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Jarimalar ({fines.length})</span>
                                                                <span className="text-xs font-extrabold text-rose-600">-{totalFine.toLocaleString()}</span>
                                                            </div>
                                                            <div className="pt-4 border-t border-dashed border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                                <span className="text-[10px] font-extrabold text-[#1b6b6b] uppercase tracking-widest">To'lanadi</span>
                                                                <span className="text-2xl font-black text-[#1b6b6b] tabular-nums">{totalSalary.toLocaleString()}</span>
                                                            </div>
                                                            <p className="text-[9px] text-right text-gray-400 font-bold uppercase tracking-widest">UZS</p>
                                                        </div>
                                                    </div>

                                                    {!payConfirm ? (
                                                        <button
                                                            onClick={() => setPayConfirm(true)}
                                                            className="mt-6 w-full py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-2xl text-xs font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                                                            <Banknote size={14} /> Oylik berish
                                                        </button>
                                                    ) : (
                                                        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-3">
                                                            <p className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-widest text-center">
                                                                {staffUser.name}ga {totalSalary.toLocaleString()} UZS to'lansinmi?
                                                            </p>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => setPayConfirm(false)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl cursor-pointer hover:bg-gray-200 transition-all">
                                                                    Bekor
                                                                </button>
                                                                <button onClick={paySalary} disabled={paying}
                                                                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-xl cursor-pointer transition-all disabled:opacity-60 flex items-center justify-center gap-1.5">
                                                                    {paying ? 'Saqlanmoqda...' : <><CheckCircle2 size={12} /> Ha, berildi</>}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Payment history */}
                                    {salaryPayments.length > 0 && (
                                        <div className="space-y-3">
                                            <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-t border-dashed border-gray-100 dark:border-gray-700/50 pt-4">
                                                <Clock size={10} /> To'lovlar tarixi
                                            </span>
                                            <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                                                            <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Oy</th>
                                                            <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Asosiy</th>
                                                            <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">+Bonus</th>
                                                            <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">−Jarima</th>
                                                            <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Jami</th>
                                                            <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Sana</th>
                                                            <th className="p-3" />
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                                        {salaryPayments.map(p => {
                                                            const [yr, mo] = p.month.split('-');
                                                            return (
                                                                <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                                                                    <td className="p-3 text-[10px] font-black text-gray-900 dark:text-white uppercase">
                                                                        {MONTHS[parseInt(mo)-1]} {yr}
                                                                    </td>
                                                                    <td className="p-3 text-[10px] font-bold text-gray-600 dark:text-gray-300">{p.baseSalary.toLocaleString()}</td>
                                                                    <td className="p-3 text-[10px] font-bold text-emerald-600">{p.bonuses > 0 ? `+${p.bonuses.toLocaleString()}` : '—'}</td>
                                                                    <td className="p-3 text-[10px] font-bold text-rose-600">{p.fines > 0 ? `-${p.fines.toLocaleString()}` : '—'}</td>
                                                                    <td className="p-3 text-[10px] font-black text-[#1b6b6b]">{p.amount.toLocaleString()}</td>
                                                                    <td className="p-3 text-[9px] font-bold text-gray-400">{new Date(p.paidAt).toLocaleDateString('uz-UZ')}</td>
                                                                    <td className="p-3">
                                                                        {isAdminOrManager && (
                                                                            <button onClick={() => deleteSalaryPayment(p.id)}
                                                                                className="text-gray-300 hover:text-rose-500 transition-colors cursor-pointer">
                                                                                <Trash2 size={13} />
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── ISH JADVALI ── */}
                            {activeTab === 'jadval' && (
                                <div className="space-y-8 animate-in fade-in duration-300">

                                    {/* Work schedule */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <CalendarDays size={11} /> Haftalik ish kunlari
                                            </span>
                                            {workDaysChanged && (
                                                <button onClick={saveWorkDays} disabled={savingWD}
                                                    className="px-4 py-2 bg-[#1b6b6b] hover:bg-[#155252] text-white text-[10px] font-black uppercase tracking-widest rounded-xl cursor-pointer transition-all disabled:opacity-60 shadow-sm shadow-[#1b6b6b]/20">
                                                    {savingWD ? 'Saqlanmoqda...' : 'Saqlash'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-7 gap-2">
                                            {WEEK_DAYS.map((day, i) => {
                                                const sel = editWorkDays.includes(day);
                                                return (
                                                    <button key={day}
                                                        onClick={() => setEditWorkDays(prev =>
                                                            sel ? prev.filter(d => d !== day) : [...prev, day]
                                                        )}
                                                        className={`flex flex-col items-center py-3 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                                                            sel
                                                                ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white shadow-md shadow-[#1b6b6b]/25'
                                                                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 hover:border-[#1b6b6b]/40 hover:text-gray-700'
                                                        }`}>
                                                        <span className="text-[11px] font-black">{day}</span>
                                                        <span className="text-[8px] font-bold mt-0.5 opacity-70">{WEEK_DAYS_FULL[i].slice(0,3)}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {workDays.length === 0 && !workDaysChanged && (
                                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest text-center py-1">
                                                Jadval belgilanmagan — kunlarni tanlang va saqlang
                                            </p>
                                        )}
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-dashed border-gray-100 dark:border-gray-700/50" />

                                    {/* Attendance calendar */}
                                    <div className="space-y-4">
                                        {/* Month selector */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">Davomat</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-500 hover:border-[#1b6b6b] hover:text-[#1b6b6b] transition-all cursor-pointer">
                                                    <ChevronLeft size={14} />
                                                </button>
                                                <span className="text-xs font-black text-gray-900 dark:text-white min-w-[120px] text-center">
                                                    {MONTHS[selMonth]} {selYear}
                                                </span>
                                                <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-500 hover:border-[#1b6b6b] hover:text-[#1b6b6b] transition-all cursor-pointer">
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Summary badges */}
                                        {workDays.length > 0 && (
                                            <div className="grid grid-cols-3 gap-3">
                                                {[
                                                    { label:'Keldi',   count: presentDays, cls:'border-emerald-100 dark:border-emerald-950/20 text-emerald-600 dark:text-emerald-400' },
                                                    { label:'Kelmadi', count: absentDays,  cls:'border-rose-100 dark:border-rose-950/20 text-rose-600 dark:text-rose-400' },
                                                    { label:'Sababli', count: excusedDays, cls:'border-amber-100 dark:border-amber-950/20 text-amber-600 dark:text-amber-400' },
                                                ].map(({ label, count, cls }) => (
                                                    <div key={label} className={`bg-white dark:bg-gray-800 border rounded-2xl p-3 text-center ${cls}`}>
                                                        <span className="text-[9px] font-extrabold uppercase tracking-widest block mb-1 opacity-70">{label}</span>
                                                        <p className="text-2xl font-black tabular-nums">{count}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {workDays.length === 0 ? (
                                            <div className="py-10 text-center bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                                                <CalendarDays size={28} className="mx-auto text-gray-300 mb-2" />
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                    Davomat belgilash uchun avval<br/>ish jadvalini sozlang
                                                </p>
                                            </div>
                                        ) : attLoading ? (
                                            <div className="py-8 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">Yuklanmoqda...</div>
                                        ) : (
                                            <>
                                                {/* Day-of-week headers */}
                                                <div className="grid grid-cols-7 gap-1">
                                                    {WEEK_DAYS.map(d => (
                                                        <div key={d} className={`text-center text-[9px] font-black uppercase tracking-widest py-1.5 rounded-lg ${workDays.includes(d) ? 'text-[#1b6b6b] bg-[#1b6b6b]/5' : 'text-gray-300'}`}>{d}</div>
                                                    ))}
                                                </div>
                                                {/* Day cells */}
                                                <div className="grid grid-cols-7 gap-1">
                                                    {calCells.map((dayNum, idx) => {
                                                        if (!dayNum) return <div key={idx} className="aspect-square" />;
                                                        const ds      = toDateStr(dayNum);
                                                        const jsDay   = new Date(selYear, selMonth, dayNum).getDay();
                                                        const dayKey  = WEEK_DAYS.find(d => DAY_JS[d] === jsDay);
                                                        const isWork  = dayKey ? workDays.includes(dayKey) : false;
                                                        const status  = getAttStatus(dayNum);
                                                        const isToday = ds === todayStr;

                                                        let cls = 'aspect-square rounded-xl border-2 flex flex-col items-center justify-center text-[10px] font-black transition-all ';
                                                        if (!isWork) {
                                                            cls += 'bg-transparent border-transparent text-gray-200 dark:text-gray-700 cursor-default';
                                                        } else if (status === 'Keldi') {
                                                            cls += 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 cursor-pointer hover:opacity-80';
                                                        } else if (status === 'Kelmadi') {
                                                            cls += 'bg-rose-100 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 cursor-pointer hover:opacity-80';
                                                        } else if (status === 'Sababli') {
                                                            cls += 'bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 cursor-pointer hover:opacity-80';
                                                        } else {
                                                            cls += `bg-white dark:bg-gray-800 border-[#1b6b6b]/20 text-gray-700 dark:text-gray-200 cursor-pointer hover:border-[#1b6b6b] hover:bg-[#1b6b6b]/5 ${isToday ? 'ring-2 ring-[#1b6b6b] ring-offset-1' : ''}`;
                                                        }

                                                        return (
                                                            <div key={idx}
                                                                onClick={() => isWork && isAdminOrManager && setAttPicker(ds)}
                                                                className={cls}>
                                                                <span>{dayNum}</span>
                                                                {status === 'Keldi'   && <span className="text-[7px] leading-none">✓</span>}
                                                                {status === 'Kelmadi' && <span className="text-[7px] leading-none">✗</span>}
                                                                {status === 'Sababli' && <span className="text-[7px] leading-none">!</span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-widest">
                                                    Ish kuniga bosing → davomat belgilang
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Attendance day picker modal */}
            {attPicker && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setAttPicker(null)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-xs p-6">
                        <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{attPicker}</h3>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Davomat holati</p>
                            </div>
                            <button onClick={() => setAttPicker(null)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label:'Keldi',   color:'emerald', icon:<CheckCircle2 size={22} /> },
                                { label:'Kelmadi', color:'rose',    icon:<XCircle      size={22} /> },
                                { label:'Sababli', color:'amber',   icon:<AlertCircle  size={22} /> },
                            ].map(({ label, color, icon }) => (
                                <button key={label}
                                    onClick={() => markAttendance(attPicker, label)}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer group ${
                                        color === 'emerald' ? 'border-emerald-100 bg-emerald-50/50 hover:bg-emerald-500 hover:border-emerald-500' :
                                        color === 'rose'    ? 'border-rose-100 bg-rose-50/50 hover:bg-rose-500 hover:border-rose-500' :
                                                              'border-amber-100 bg-amber-50/50 hover:bg-amber-500 hover:border-amber-500'
                                    }`}>
                                    <span className={`${color==='emerald'?'text-emerald-500':color==='rose'?'text-rose-500':'text-amber-500'} group-hover:text-white transition-colors`}>{icon}</span>
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${color==='emerald'?'text-emerald-600':color==='rose'?'text-rose-600':'text-amber-600'} group-hover:text-white transition-colors`}>{label}</span>
                                </button>
                            ))}
                        </div>
                        {staffAtt.find(a => a.date === attPicker) && (
                            <button onClick={() => markAttendance(attPicker, 'delete')}
                                className="mt-3 w-full py-2 text-[9px] font-black text-gray-400 hover:text-rose-500 uppercase tracking-widest cursor-pointer transition-colors text-center">
                                O'chirish
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Edit modal */}
            {isEditOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsEditOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Tahrirlash</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">Ma'lumotlarni yangilash</p>
                            </div>
                            <button onClick={() => setIsEditOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div onClick={() => fileRef.current?.click()} className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-gray-600 cursor-pointer hover:border-[#1b6b6b] transition-colors flex items-center justify-center bg-gray-50 dark:bg-gray-900 shrink-0">
                                    {editData.photo ? <img src={editData.photo} alt="preview" className="w-full h-full object-cover" /> : <Camera size={20} className="text-gray-300" />}
                                </div>
                                <div>
                                    <button type="button" onClick={() => fileRef.current?.click()} className="text-[10px] font-extrabold text-[#1b6b6b] uppercase tracking-widest cursor-pointer hover:underline">Rasm yuklash</button>
                                    {editData.photo && <button type="button" onClick={() => setEditData((p:any) => ({...p,photo:''}))} className="ml-3 text-[10px] font-extrabold text-rose-500 uppercase tracking-widest cursor-pointer hover:underline">O'chirish</button>}
                                </div>
                                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                            </div>
                            <div><label className={lbl}>Ism Familiya</label><input type="text" className={inp} value={editData.name||''} onChange={e => setEditData((p:any)=>({...p,name:e.target.value}))} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={lbl}>Telefon</label><input type="text" className={inp} value={editData.phone||''} onChange={e => setEditData((p:any)=>({...p,phone:e.target.value}))} /></div>
                                <div><label className={lbl}>Asosiy Maosh</label><input type="number" className={inp} value={editData.salary||''} onChange={e => setEditData((p:any)=>({...p,salary:e.target.value}))} /></div>
                            </div>
                            <div><label className={lbl}>Vazifa / Mutaxassislik</label><input type="text" className={inp} value={editData.position||''} onChange={e => setEditData((p:any)=>({...p,position:e.target.value}))} /></div>
                            <div><label className={lbl}>Yangi Parol (ixtiyoriy)</label><input type="password" placeholder="O'zgartirish uchun to'ldiring" className={inp} value={editData.password||''} onChange={e => setEditData((p:any)=>({...p,password:e.target.value}))} /></div>
                            <div className="flex gap-3 pt-4 border-t border-dashed border-gray-100 dark:border-gray-700/50">
                                <button type="button" onClick={() => setIsEditOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl cursor-pointer hover:bg-gray-200">Bekor</button>
                                <button type="submit" className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 cursor-pointer">Saqlash</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Photo capture modal */}
            {isPhotoModalOpen && (
                <PhotoCapture
                    onCapture={handlePhotoCapture}
                    onClose={() => setIsPhotoModalOpen(false)}
                />
            )}
        </div>
    );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
    const cls = { emerald:'border-emerald-100 dark:border-emerald-950/30 text-emerald-600 dark:text-emerald-400', rose:'border-rose-100 dark:border-rose-950/30 text-rose-600 dark:text-rose-400', amber:'border-amber-100 dark:border-amber-950/30 text-amber-600 dark:text-amber-400' }[color] || 'border-gray-100 text-gray-600';
    return (
        <div className={`bg-white dark:bg-gray-800 border rounded-2xl p-4 ${cls}`}>
            <span className="text-[9px] font-extrabold uppercase tracking-widest block mb-1 opacity-70">{label}</span>
            <p className="text-2xl font-black tabular-nums">{value}</p>
            <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">{sub}</p>
        </div>
    );
}

function InfoBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-700/50">
            <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block mb-0.5">{label}</span>
            <span className="text-xs font-black text-gray-900 dark:text-white">{value}</span>
        </div>
    );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-center text-[#1b6b6b]">
                {icon}
            </div>
            <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none block">{label}</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white tracking-tight mt-0.5 block truncate max-w-[150px]">{value}</span>
            </div>
        </div>
    );
}
