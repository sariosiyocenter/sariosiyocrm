import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, Phone, Mail, Layers, Wallet,
    Plus, X, Save, Target, Star, AlertCircle, GraduationCap, Pencil, Camera, Sparkles,
    CheckCircle2, XCircle, ChevronLeft, ChevronRight, CalendarDays,
    Banknote, Clock, Trash2, Maximize2
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import { useParams, useNavigate } from 'react-router-dom';
import { uploadProfilePhoto } from '../lib/image';
import PhotoViewer from './PhotoViewer';
import Avatar from './ui/Avatar';
import { displayName } from '../lib/displayName';
import PhotoCapture from './PhotoCapture';
import { useLang } from '../context/LanguageContext';

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
    TEACHER:         'bg-teal-50 text-brand border-teal-100 dark:bg-teal-950/20 dark:text-teal-400',
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

const inp = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[11px] font-extrabold   text-matn-xira mb-2";

export default function StaffDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { teachers, groups, attendances, token, user: currentUser, showNotification, retryLoad } = useCRM();
    const confirm = useConfirm();
    const { t } = useLang();

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'ADMIN': return t('role_admin');
            case 'MANAGER': return t('role_manager');
            case 'TEACHER': return t('role_teacher');
            case 'SUPPORT_TEACHER': return t('role_support_teacher');
            case 'RECEPTIONIST': return t('role_receptionist');
            case 'DRIVER': return t('role_driver');
            case 'TECH_STAFF': return t('role_tech_staff');
            default: return role;
        }
    };

    const getMonthName = (idx: number) => {
        switch (idx) {
            case 0: return t('month_0');
            case 1: return t('month_1');
            case 2: return t('month_2');
            case 3: return t('month_3');
            case 4: return t('month_4');
            case 5: return t('month_5');
            case 6: return t('month_6');
            case 7: return t('month_7');
            case 8: return t('month_8');
            case 9: return t('month_9');
            case 10: return t('month_10');
            case 11: return t('month_11');
            default: return '';
        }
    };

    const getWeekDayShort = (day: string) => {
        switch (day) {
            case 'Du': return t('day_mon_short');
            case 'Se': return t('day_tue_short');
            case 'Ch': return t('day_wed_short');
            case 'Pa': return t('day_thu_short');
            case 'Ju': return t('day_fri_short');
            case 'Sh': return t('day_sat_short');
            case 'Ya': return t('day_sun_short');
            default: return day;
        }
    };

    const getWeekDayFull = (day: string) => {
        switch (day) {
            case 'Dushanba': return t('day_mon_full');
            case 'Seshanba': return t('day_tue_full');
            case 'Chorshanba': return t('day_wed_full');
            case 'Payshanba': return t('day_thu_full');
            case 'Juma': return t('day_fri_full');
            case 'Shanba': return t('day_sat_full');
            case 'Yakshanba': return t('day_sun_full');
            default: return day;
        }
    };

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

    // Berilgan oylikni tuzatish oynasi.
    const [editingPayment, setEditingPayment] = useState<any>(null);
    const [editPayAmount, setEditPayAmount] = useState('');
    const [editPayNote, setEditPayNote] = useState('');
    const [savingPayEdit, setSavingPayEdit] = useState(false);


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
    const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
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
        .then(async r => {
            if (!r.ok) {
                const d = await r.json().catch(() => ({}));
                throw new Error(d.error || ('Server ' + r.status));
            }
            return r.json();
        })
        .then(data => setSalaryPayments(Array.isArray(data) ? data : []))
        .catch((err) => {
            setSalaryPayments([]);
            showNotification("Oylik tarixini yuklab bo'lmadi: " + (err?.message || 'aloqa xatosi'), 'error');
        });
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

    // KPI hisobi sahifa ochilishi bilan yuklanadi: "Umumiy" tabidagi oylik
    // hisob-kitobi kartasi ham shu ma'lumotga tayanadi.
    useEffect(() => {
        if (!staffUser || !token) return;
        const month = `${payYear}-${String(payMonth + 1).padStart(2, '0')}`;
        setKpiLoading(true);
        fetch(`/api/kpi-calculation?userId=${staffUser.id}&month=${month}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(r => r.json())
        .then(data => setKpiData(data))
        .catch(() => setKpiData(null))
        .finally(() => setKpiLoading(false));
    }, [staffUser?.id, token, payMonth, payYear]);

    if (loading) {
        return <div className="py-20 text-center text-brand text-xs font-bold">{t('loading')}</div>;
    }
    if (!staffUser) {
        return (
            <div className="p-12 text-center text-matn-sokin font-bold text-sm bg-sirt rounded-2xl border border-chiziq shadow-sm">
                {t('staff_not_found')}
            </div>
        );
    }

    const linkedTeacher = (staffUser.role === 'TEACHER' || staffUser.role === 'SUPPORT_TEACHER')
        ? teachers.find(t => t.name.toLowerCase().trim() === staffUser.name.toLowerCase().trim())
        : null;

    // Ustoz yuritayotgan guruhlar va ular bo'yicha ko'rsatkichlar.
    // Hammasi mavjud yozuvlardan; reyting kabi bazada yo'q qiymat ko'rsatilmaydi.
    const myGroups = linkedTeacher ? (groups || []).filter(g => g.teacherId === linkedTeacher.id) : [];
    const myStudentCount = myGroups.reduce((n, g) => n + ((g.studentIds || []).length), 0);
    // Toq/juft kunlar — haftada 3 dars, har kuni — 6.
    const weeklyLessons = myGroups.reduce((n, g) => n + (g.days === 'TOQ' || g.days === 'JUFT' ? 3 : 6), 0);
    const groupAttRate = (gid: number) => {
        const rows = (attendances || []).filter(a => a.groupId === gid);
        return rows.length ? Math.round((rows.filter(a => a.status === 'Keldi').length / rows.length) * 100) : null;
    };
    const groupMonthIncome = (gid: number) => (kpiData?.groups || []).find((g: any) => g.id === gid)?.total ?? null;

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
            const url = await uploadProfilePhoto(ev.target?.result as string, file.name);
            setEditData((p: any) => ({ ...p, photo: url }));
        };
        reader.readAsDataURL(file);
    };

    const handlePhotoCapture = async (base64: string) => {
        const compressed = await uploadProfilePhoto(base64, `staff-${staffUser.id}.jpg`);
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
                showNotification('Xatolik: ' + (data.error || 'Noma\'lum xatolik'), 'error');
            }
        } catch {
            showNotification('Xatolik yuz berdi', 'error');
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
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || ('Server ' + res.status));
            }
            const payment = await res.json();
            setSalaryPayments(prev => [...prev.filter(p => p.month !== payMonthStr), payment]);
            setBonuses([]);
            setFines([]);
            setPayConfirm(false);
            showNotification("Oylik berildi va Moliyaga xarajat sifatida yozildi", 'success');
            // Moliyadagi xarajatlar ro'yxati faqat /api/init dan keladi, shuning
            // uchun yangi xarajat ko'rinishi uchun ma'lumotni yangilaymiz.
            retryLoad();
        } catch (err: any) {
            showNotification("Oylikni saqlab bo'lmadi: " + (err?.message || 'aloqa xatosi'), 'error');
        }
        setPaying(false);
    };

    /** Berilgan oylikni tuzatish. Ilgari buning yo'li yo'q edi — faqat
     *  o'chirib, qaytadan berish mumkin edi. */
    const saveSalaryEdit = async () => {
        if (!editingPayment || savingPayEdit) return;
        const val = parseInt(editPayAmount);
        if (!Number.isFinite(val)) { showNotification("Summa noto'g'ri", 'error'); return; }
        setSavingPayEdit(true);
        try {
            const res = await fetch(`/api/salary-payments/${editingPayment.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ amount: val, note: editPayNote })
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || ('Server ' + res.status));
            }
            const updated = await res.json();
            setSalaryPayments(prev => prev.map(p => p.id === updated.id ? updated : p));
            setEditingPayment(null);
            showNotification("Oylik yangilandi", 'success');
            retryLoad();
        } catch (err: any) {
            showNotification("O'zgartirib bo'lmadi: " + (err?.message || 'aloqa xatosi'), 'error');
        } finally {
            setSavingPayEdit(false);
        }
    };

    const deleteSalaryPayment = async (pid: number) => {
        // A salary record used to vanish on a single click, and the row was dropped from
        // the table whether or not the server accepted the delete — it came back on the
        // next refresh, which reads as the app losing data.
        const record = salaryPayments.find(p => p.id === pid);
        const label = record ? `${record.month} — ${Number(record.amount).toLocaleString()} so'm` : 'ushbu yozuv';
        if (!await confirm(`Oylik to'lov yozuvi o'chirilsinmi?\n\n${label}\n\nBu amalni orqaga qaytarib bo'lmaydi.`)) return;

        try {
            const res = await fetch(`/api/salary-payments/${pid}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Server ${res.status}`);
            setSalaryPayments(prev => prev.filter(p => p.id !== pid));
            showNotification("Oylik to'lov yozuvi o'chirildi", 'success');
        } catch (err: any) {
            showNotification("O'chirib bo'lmadi: " + (err?.message || "aloqa xatosi"), 'error');
        }
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
        { id: 'umumiy', label: t('general'),     icon: <Layers size={14} /> },
        { id: 'maosh',  label: t('salary_info'),   icon: <Wallet size={14} /> },
        { id: 'jadval', label: t('work_schedule'), icon: <CalendarDays size={14} /> },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Orqaga. Xodim profili endi o'quvchi profili bilan bir xil
                tuzilishda: yuqorida bitta qatorli sarlavha, pastda chapda
                ma'lumotlar, o'ngda bo'limlar. */}
            <button onClick={() => navigate('/hr')}
                className="flex items-center gap-2 text-matn-xira hover:text-brand transition-colors text-[12px] font-semibold group cursor-pointer">
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                {t('staff_list')}
            </button>

            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3.5 min-w-0">
                    <Avatar name={staffUser.name} photo={staffUser.photo} size={120} fontSize={38} className="group/avatar">
                        <div className="absolute inset-0 bg-gray-950/70 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            {staffUser.photo && (
                                <button onClick={() => setIsPhotoViewerOpen(true)} title="Kattalashtirib ko'rish"
                                    className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors">
                                    <Maximize2 size={16} />
                                </button>
                            )}
                            {isAdminOrManager && (
                                <button onClick={() => setIsPhotoModalOpen(true)} title={t('camera')}
                                    className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors">
                                    <Camera size={16} />
                                </button>
                            )}
                        </div>
                    </Avatar>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-[22px] font-semibold text-matn tracking-tight leading-tight truncate">{displayName(staffUser.name)}</h1>
                            {isAdminOrManager && (
                                <button
                                    onClick={() => { setEditData({ ...staffUser, password: '' }); setIsEditOpen(true); }}
                                    title={t('edit')}
                                    className="text-matn-xira hover:text-brand cursor-pointer shrink-0">
                                    <Pencil size={13} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="num text-[12px] text-matn-xira">&#8470;{staffUser.id}</span>
                            <span className="w-1 h-1 rounded-full bg-matn-xira" />
                            <span className={`px-2 py-0.5 rounded-md text-[11px] border ${ROLE_COLORS[staffUser.role] || ''}`}>
                                {getRoleLabel(staffUser.role)}
                            </span>
                            {staffUser.position && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-matn-xira" />
                                    <span className="text-[12px] text-matn-sokin truncate">{staffUser.position}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Eng ko'p ishlatiladigan amallar */}
                <div className="flex items-center gap-2 shrink-0">
                    <a href={staffUser.phone ? `tel:${String(staffUser.phone).replace(/\s/g, '')}` : undefined}
                        aria-disabled={!staffUser.phone}
                        title={staffUser.phone || t('phone_not_found')}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${staffUser.phone
                            ? 'border-chiziq-kuchli text-brand hover:bg-brand hover:text-white cursor-pointer'
                            : 'border-chiziq text-matn-xira pointer-events-none'}`}>
                        <Phone size={15} />
                    </a>
                    <a href={staffUser.email ? `mailto:${staffUser.email}` : undefined}
                        aria-disabled={!staffUser.email}
                        title={staffUser.email || 'Email kiritilmagan'}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${staffUser.email
                            ? 'border-chiziq-kuchli text-brand hover:bg-brand hover:text-white cursor-pointer'
                            : 'border-chiziq text-matn-xira pointer-events-none'}`}>
                        <Mail size={15} />
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                {/* Chap ustun — o'quvchi profilidagi kabi: yirik son, so'ng
                    aloqa ma'lumotlari. */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                        <div className="px-6 py-5 space-y-3">
                            <div className="px-4 py-3.5 rounded-xl border bg-brand/8 border-brand/20">
                                <span className="text-[12px] text-matn-sokin block">{t('base_salary_short')}</span>
                                <div className="flex items-baseline mt-1">
                                    <span className="raqam text-[24px] font-semibold leading-none text-matn">{baseSalary.toLocaleString('ru-RU')}</span>
                                    <span className="text-[12px] text-matn-xira ml-1.5">so'm</span>
                                </div>
                                <div className="mt-2.5 pt-2.5 border-t border-chiziq-mayin flex items-center justify-between">
                                    <span className="text-[12px] text-matn-sokin">{t('with_kpi')}</span>
                                    <span className="num text-[14px] text-brand">{totalSalary.toLocaleString('ru-RU')}</span>
                                </div>
                            </div>

                            {isAdminOrManager && staffUser.photo && (
                                <button
                                    onClick={handleRemoveBg}
                                    disabled={isRemovingBg}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 text-matn-xira hover:text-brand text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    <Sparkles size={12} className={isRemovingBg ? 'animate-spin' : ''} />
                                    {isRemovingBg ? t('clearing_bg') : t('clear_bg_btn')}
                                </button>
                            )}
                        </div>

                        <div className="px-6 pb-6 space-y-1 border-t border-chiziq pt-4">
                            <h3 className="text-[10px] font-semibold text-matn-xira mb-1 px-0.5">
                                Aloqa ma'lumotlari
                            </h3>
                            <DetailRow icon={<Phone className="w-3.5 h-3.5" />} label={t('phone')} value={staffUser.phone || ''} />
                            {staffUser.role !== 'TECH_STAFF' && (
                                <DetailRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={staffUser.email || ''} />
                            )}
                            <DetailRow icon={<Layers className="w-3.5 h-3.5" />} label="Lavozim" value={staffUser.position || ''} />
                            <DetailRow
                                icon={<CalendarDays className="w-3.5 h-3.5" />}
                                label={t('work_schedule')}
                                value={workDays.length ? workDays.length + ' kun' : ''}
                            />
                            {kpiPercent > 0 && (
                                <DetailRow icon={<Target className="w-3.5 h-3.5" />} label="KPI" value={kpiPercent + '%'} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Right tabs */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                        <div className="flex px-4 bg-ichki border-b border-chiziq gap-2">
                            {tabs.map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                    className={`px-5 py-4 text-[11px] font-extrabold flex items-center gap-2 transition-all relative shrink-0 cursor-pointer ${activeTab === tab.id ? 'text-brand bg-sirt' : 'text-matn-xira hover:text-gray-900 dark:hover:text-white'}`}>
                                    {tab.icon}{tab.label}
                                    {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full" />}
                                </button>
                            ))}
                        </div>

                        <div className="p-4">
                            {/* ── UMUMIY ── */}
                            {activeTab === 'umumiy' && (
                                <div className="space-y-5 animate-in fade-in duration-300">
                                    {/* Asosiy ko'rsatkichlar bitta qatorda. Reyting bazada yo'q —
                                        o'ylab yozilmaydi. */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        {linkedTeacher && (
                                            <>
                                                <StatCard label="Guruhlar" value={myGroups.length} sub={`${myStudentCount} o'quvchi`} color="" />
                                                <StatCard label="Haftalik dars" value={weeklyLessons} sub="guruh jadvalidan" color="" />
                                            </>
                                        )}
                                        <StatCard label={`${getMonthName(payMonth)} oyligi`} value={totalSalary >= 1000000 ? `${(totalSalary / 1000000).toFixed(1)} mln` : totalSalary.toLocaleString()} sub={kpiPercent ? `asosiy + ${kpiPercent}% ulush` : 'asosiy oylik'} color="emerald" />
                                        <StatCard label={t('attendance')} value={`${presentDays} kun`} sub={absentDays > 0 ? `${absentDays} kun kelmagan` : t('present_this_month_sub')} color={absentDays > 0 ? 'amber' : ''} />
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
                                        <div className="xl:col-span-2 space-y-5">
                                            {/* Yuritayotgan guruhlar */}
                                            {linkedTeacher && (
                                                <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden">
                                                    <div className="px-5 py-4 border-b border-chiziq">
                                                        <h3 className="text-[14px] font-semibold text-matn">Yuritayotgan guruhlar</h3>
                                                    </div>
                                                    {myGroups.length === 0 ? (
                                                        <p className="px-5 py-8 text-center text-[12px] text-matn-xira">Guruh biriktirilmagan</p>
                                                    ) : (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full border-collapse text-left min-w-[560px]">
                                                                <thead>
                                                                    <tr className="border-b border-chiziq">
                                                                        <th className="px-5 py-2.5 text-[11px] font-medium text-matn-xira">Guruh</th>
                                                                        <th className="px-3 py-2.5 text-[11px] font-medium text-matn-xira">Vaqt</th>
                                                                        <th className="px-3 py-2.5 text-[11px] font-medium text-matn-xira text-right">O'quvchi</th>
                                                                        <th className="px-3 py-2.5 text-[11px] font-medium text-matn-xira text-right">Davomat</th>
                                                                        <th className="px-5 py-2.5 text-[11px] font-medium text-matn-xira text-right">{getMonthName(payMonth)} tushumi</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-chiziq-mayin dark:divide-gray-700/40">
                                                                    {myGroups.map(g => {
                                                                        const att = groupAttRate(g.id);
                                                                        const inc = groupMonthIncome(g.id);
                                                                        return (
                                                                            <tr key={g.id} onClick={() => navigate(`/courses/${g.id}`)}
                                                                                className="group hover:bg-ichki transition-colors cursor-pointer">
                                                                                <td className="px-5 py-3 text-[13px] font-medium text-matn group-hover:text-brand transition-colors">
                                                                                    <span className="inline-block w-0.5 h-4 rounded-full bg-brand mr-3 align-middle" />{g.name}
                                                                                </td>
                                                                                <td className="px-3 py-3 text-[12px] text-matn-sokin">
                                                                                    {g.days === 'TOQ' ? 'Toq' : g.days === 'JUFT' ? 'Juft' : 'Har kuni'}{g.schedule ? <> · <span className="num">{g.schedule.split(' - ')[0]}</span></> : null}
                                                                                </td>
                                                                                <td className="num px-3 py-3 text-[13px] text-right text-matn-2">{(g.studentIds || []).length}</td>
                                                                                <td className={`num px-3 py-3 text-[13px] text-right ${att === null ? 'text-matn-xira' : att >= 85 ? 'text-emerald-500' : att >= 70 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                                                    {att === null ? '—' : `${att}%`}
                                                                                </td>
                                                                                <td className="num px-5 py-3 text-[13px] text-right text-matn-2">
                                                                                    {inc === null ? '—' : inc >= 1000000 ? `${(inc / 1000000).toFixed(1)} mln` : inc.toLocaleString()}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="bg-sirt border border-chiziq rounded-2xl p-5">
                                                <h3 className="text-[14px] font-semibold text-matn mb-3">{t('staff_info')}</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <InfoBox label="ID"           value={`#${staffUser.id}`} />
                                                    <InfoBox label="Lavozim"      value={getRoleLabel(staffUser.role)} />
                                                    {staffUser.position && <InfoBox label="Vazifa" value={staffUser.position} />}
                                                    {staffUser.phone && <InfoBox label={t('phone')} value={staffUser.phone} />}
                                                    {linkedTeacher && (
                                                        <button onClick={() => navigate(`/teachers/${linkedTeacher.id}`)}
                                                            className="sm:col-span-2 flex items-center justify-between px-4 py-3 rounded-xl border border-chiziq text-[13px] text-brand hover:bg-brand/5 transition-colors cursor-pointer">
                                                            <span className="flex items-center gap-2"><GraduationCap size={15} /> {t('view_teacher_profile')}</span>
                                                            <ChevronRight size={15} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            {/* Oylik hisob-kitobi — Maosh tabidagi hisobning qisqa ko'rinishi. */}
                                            <div className="bg-sirt border border-chiziq rounded-2xl p-5">
                                                <div className="flex items-baseline justify-between mb-3">
                                                    <h3 className="text-[14px] font-semibold text-matn">Oylik hisob-kitobi</h3>
                                                    <span className="text-[12px] text-matn-xira">{getMonthName(payMonth)}</span>
                                                </div>
                                                <div className="space-y-2 text-[13px]">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-matn-sokin">Asosiy</span>
                                                        <span className="num text-matn">{baseSalary.toLocaleString()}</span>
                                                    </div>
                                                    {kpiPercent > 0 && (
                                                        <>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-matn-sokin">Guruhlardan tushum</span>
                                                                <span className="num text-matn">{kpiLoading ? '…' : (kpiData?.totalPayments || 0).toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-matn-sokin">Ulush ({kpiPercent}%)</span>
                                                                <span className="num text-brand">{kpiLoading ? '…' : `+${kpiAmount.toLocaleString()}`}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                    {totalBonus > 0 && (
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="text-matn-sokin">Bonus</span>
                                                            <span className="num text-emerald-500">+{totalBonus.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    {totalFine > 0 && (
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="text-matn-sokin">Ushlanma</span>
                                                            <span className="num text-rose-500">-{totalFine.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-chiziq">
                                                        <span className="font-semibold text-matn">To'lanadi</span>
                                                        <span className="num font-semibold text-brand">{totalSalary.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => setActiveTab('maosh')}
                                                    className="mt-4 w-full py-2 rounded-xl text-[12px] text-brand border border-chiziq hover:bg-brand/5 transition-colors cursor-pointer">
                                                    Batafsil →
                                                </button>
                                            </div>

                                            {/* Intizom — shu oy davomati */}
                                            <div className="bg-sirt border border-chiziq rounded-2xl p-5">
                                                <h3 className="text-[14px] font-semibold text-matn mb-3">Intizom · {getMonthName(selMonth)}</h3>
                                                <div className="space-y-2 text-[13px]">
                                                    <div className="flex items-center justify-between"><span className="text-matn-sokin">{t('attendance')}</span><span className="num text-emerald-500">{presentDays} kun</span></div>
                                                    <div className="flex items-center justify-between"><span className="text-matn-sokin">{t('absent')}</span><span className={`num ${absentDays > 0 ? 'text-rose-500' : 'text-matn-xira'}`}>{absentDays} kun</span></div>
                                                    <div className="flex items-center justify-between"><span className="text-matn-sokin">{t('excused')}</span><span className={`num ${excusedDays > 0 ? 'text-amber-500' : 'text-matn-xira'}`}>{excusedDays} kun</span></div>
                                                </div>
                                                <button onClick={() => setActiveTab('jadval')}
                                                    className="mt-4 w-full py-2 rounded-xl text-[12px] text-brand border border-chiziq hover:bg-brand/5 transition-colors cursor-pointer">
                                                    Ish grafigi →
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── ISH HAQI ── */}
                            {activeTab === 'maosh' && (
                                <div className="space-y-6 animate-in fade-in duration-300">

                                    {/* Inline base salary editor */}
                                    <div className="flex items-center gap-4 p-4 bg-brand/5 border border-brand/15 rounded-2xl">
                                        <div className="flex-1 min-w-0">
                                            <span className={lbl}>{t('base_salary')}</span>
                                            {editingSalary ? (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <input
                                                        type="number" autoFocus
                                                        className={inp + " py-2 text-sm"}
                                                        value={salaryDraft}
                                                        onChange={e => setSalaryDraft(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') saveSalaryInline(); if (e.key === 'Escape') setEditingSalary(false); }}
                                                    />
                                                    <button onClick={saveSalaryInline} className="px-4 py-2 bg-brand hover:bg-brand-dark text-white text-[11px] font-extrabold rounded-xl cursor-pointer transition-all whitespace-nowrap">{t('save')}</button>
                                                    <button onClick={() => setEditingSalary(false)} className="px-3 py-2 bg-chiziq text-gray-600 dark:text-white text-[11px] font-extrabold rounded-xl cursor-pointer hover:bg-gray-200 transition-all">{t('cancel')}</button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-2xl font-black text-matn tabular-nums">{baseSalary.toLocaleString()}</span>
                                                    <span className="text-[11px] font-bold text-matn-xira">UZS</span>
                                                    {isAdminOrManager && (
                                                        <button
                                                            onClick={() => { setSalaryDraft(String(baseSalary)); setEditingSalary(true); }}
                                                            className="ml-1 text-matn-xira hover:text-brand transition-colors cursor-pointer">
                                                            <Pencil size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <span className={lbl}>{t('kpi_percent')}</span>
                                            {editingKpi ? (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <input
                                                        type="number" autoFocus min={0} max={100}
                                                        className={inp + " py-2 text-sm w-20"}
                                                        value={kpiDraft}
                                                        onChange={e => setKpiDraft(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') saveKpiInline(); if (e.key === 'Escape') setEditingKpi(false); }}
                                                    />
                                                    <button onClick={saveKpiInline} className="px-3 py-2 bg-brand hover:bg-brand-dark text-white text-[11px] font-extrabold rounded-xl cursor-pointer transition-all">✓</button>
                                                    <button onClick={() => setEditingKpi(false)} className="px-3 py-2 bg-chiziq text-gray-600 dark:text-white text-[11px] font-extrabold rounded-xl cursor-pointer hover:bg-gray-200 transition-all">✕</button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2 mt-1">
                                                    <span className="text-2xl font-black text-brand tabular-nums">{kpiPercent}</span>
                                                    <span className="text-[11px] font-bold text-matn-xira">%</span>
                                                    {isAdminOrManager && (
                                                        <button
                                                            onClick={() => { setKpiDraft(String(kpiPercent)); setEditingKpi(true); }}
                                                            className="ml-1 text-matn-xira hover:text-brand transition-colors cursor-pointer">
                                                            <Pencil size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Month selector */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-extrabold text-matn-xira flex items-center gap-1.5">
                                            <Banknote size={11} /> {t('salary_calculation')}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={prevPayMonth} className="w-8 h-8 flex items-center justify-center rounded-xl bg-ichki border border-chiziq text-matn-sokin hover:border-brand hover:text-brand transition-all cursor-pointer">
                                                <ChevronLeft size={14} />
                                            </button>
                                            <span className="text-xs font-black text-matn min-w-[120px] text-center">{getMonthName(payMonth)} {payYear}</span>
                                            <button onClick={nextPayMonth} className="w-8 h-8 flex items-center justify-center rounded-xl bg-ichki border border-chiziq text-matn-sokin hover:border-brand hover:text-brand transition-all cursor-pointer">
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
                                                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 tracking-wide">
                                                        {getMonthName(payMonth)} {payYear} — {t('salary_paid')} ✓
                                                    </p>
                                                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-500 mt-0.5">
                                                        {currentPayment.amount.toLocaleString()} UZS · {new Date(currentPayment.paidAt).toLocaleDateString('uz-UZ')}
                                                    </p>
                                                </div>
                                            </div>
                                            {isAdminOrManager && (
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button onClick={() => {
                                                        setEditingPayment(currentPayment);
                                                        setEditPayAmount(String(currentPayment.amount));
                                                        setEditPayNote(currentPayment.note || '');
                                                    }}
                                                        title="Tahrirlash"
                                                        className="text-matn-xira hover:text-brand transition-colors cursor-pointer p-2 rounded-xl hover:bg-brand/10">
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button onClick={() => deleteSalaryPayment(currentPayment.id)}
                                                        title="O'chirish"
                                                        className="text-matn-xira hover:text-rose-500 transition-colors cursor-pointer p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl">
                                            <div className="w-10 h-10 bg-rose-100 dark:bg-rose-950/40 rounded-xl flex items-center justify-center shrink-0">
                                                <Clock size={18} className="text-rose-500" />
                                            </div>
                                            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                                {getMonthName(payMonth)} {payYear} — {t('salary_not_paid')}
                                            </p>
                                        </div>
                                    )}

                                    {/* KPI + adjustments + summary (only if not paid yet) */}
                                    {!currentPayment && (
                                        <div className="space-y-6">
                                            {/* KPI group breakdown — teachers only */}
                                            {(staffUser.role === 'TEACHER' || staffUser.role === 'SUPPORT_TEACHER') && (
                                                <div className="space-y-3">
                                                    <p className="text-[11px] font-extrabold text-matn-xira flex items-center gap-1.5">
                                                        <Target size={11} /> {t('kpi_calculation')} — {getMonthName(payMonth)} {payYear}
                                                    </p>
                                                    {kpiLoading ? (
                                                        <div className="py-8 text-center text-[11px] text-matn-xira font-bold">{t('loading')}</div>
                                                    ) : kpiPercent === 0 ? (
                                                        <div className="p-4 bg-ichki border border-dashed border-chiziq rounded-2xl text-center">
                                                            <p className="text-[11px] text-matn-xira font-bold">{t('kpi_percent_not_set')}</p>
                                                        </div>
                                                    ) : kpiData?.groups?.length > 0 ? (
                                                        <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden">
                                                            <table className="w-full text-left">
                                                                <thead>
                                                                    <tr className="bg-ichki/80 border-b border-chiziq">
                                                                        <th className="p-3 text-[11px] font-bold text-matn-xira">{t('group')}</th>
                                                                        <th className="p-3 text-[11px] font-bold text-matn-xira">{t('students')}</th>
                                                                        <th className="p-3 text-[11px] font-bold text-matn-xira text-right">{t('payments')}</th>
                                                                        <th className="p-3 text-[11px] font-bold text-matn-xira text-right">KPI ({kpiPercent}%)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                                                    {kpiData.groups.map((g: any) => (
                                                                        <tr key={g.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                                                            <td className="p-3 text-[11px] font-bold text-matn">{g.name}</td>
                                                                            <td className="p-3 text-[11px] font-bold text-matn-sokin">{g.studentCount}</td>
                                                                            <td className="p-3 text-[11px] font-bold text-matn-2 text-right">{g.total.toLocaleString()}</td>
                                                                            <td className="p-3 text-[11px] font-bold text-brand text-right">+{Math.round(g.total * kpiPercent / 100).toLocaleString()}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                                <tfoot>
                                                                    <tr className="border-t border-chiziq bg-brand/5">
                                                                        <td colSpan={2} className="p-3 text-[11px] font-extrabold text-brand">{t('total_kpi')}</td>
                                                                        <td className="p-3 text-[11px] font-bold text-matn-2 text-right">{kpiData.totalPayments?.toLocaleString()}</td>
                                                                        <td className="p-3 text-[12px] font-bold text-brand text-right">+{kpiAmount.toLocaleString()} UZS</td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 bg-ichki border border-dashed border-chiziq rounded-2xl text-center">
                                                            <p className="text-[11px] text-matn-xira font-bold">{t('no_group_payments_found')}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Manual adjustments + summary */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                <div className="space-y-4">
                                                    {/* Manual bonus */}
                                                    <div className="space-y-2">
                                                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1"><Star size={10} /> {t('additional_bonus')}</span>
                                                        {bonuses.map((b, i) => (
                                                            <div key={i} className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-3 py-2 rounded-xl">
                                                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{b.label}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">+{b.amount.toLocaleString()}</span>
                                                                    <button aria-label="Yopish" onClick={() => setBonuses(bs => bs.filter((_,j) => j!==i))} className="text-matn-xira hover:text-rose-500 cursor-pointer"><X size={18} /></button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div className="flex gap-2">
                                                            <input type="text"   placeholder={t('reason_input_placeholder')} className={inp + " py-2 text-[11px]"} value={bonusInput.label}  onChange={e => setBonusInput(p=>({...p,label:e.target.value}))} />
                                                            <input type="number" placeholder={t('amount')} className={inp + " w-24 py-2 text-[11px]"} value={bonusInput.amount} onChange={e => setBonusInput(p=>({...p,amount:e.target.value}))} />
                                                            <button onClick={() => { if (bonusInput.label&&bonusInput.amount) { setBonuses(b=>[...b,{label:bonusInput.label,amount:Number(bonusInput.amount)}]); setBonusInput({label:'',amount:''}); } }} className="w-9 h-9 shrink-0 bg-brand hover:bg-brand-dark rounded-xl flex items-center justify-center text-white transition-all cursor-pointer"><Plus size={13} /></button>
                                                        </div>
                                                    </div>

                                                    {/* Manual fine */}
                                                    <div className="space-y-2">
                                                        <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1"><AlertCircle size={10} /> {t('fine')}</span>
                                                        {fines.map((f, i) => (
                                                            <div key={i} className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 px-3 py-2 rounded-xl">
                                                                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">{f.label}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">-{f.amount.toLocaleString()}</span>
                                                                    <button aria-label="Yopish" onClick={() => setFines(fs => fs.filter((_,j) => j!==i))} className="text-matn-xira hover:text-rose-500 cursor-pointer"><X size={18} /></button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div className="flex gap-2">
                                                            <input type="text"   placeholder={t('reason_input_placeholder')} className={inp + " py-2 text-[11px]"} value={fineInput.label}  onChange={e => setFineInput(p=>({...p,label:e.target.value}))} />
                                                            <input type="number" placeholder={t('amount')} className={inp + " w-24 py-2 text-[11px]"} value={fineInput.amount} onChange={e => setFineInput(p=>({...p,amount:e.target.value}))} />
                                                            <button onClick={() => { if (fineInput.label&&fineInput.amount) { setFines(f=>[...f,{label:fineInput.label,amount:Number(fineInput.amount)}]); setFineInput({label:'',amount:''}); } }} className="w-9 h-9 shrink-0 bg-rose-600 hover:bg-rose-500 rounded-xl flex items-center justify-center text-white transition-all cursor-pointer"><Plus size={13} /></button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Summary + pay button */}
                                                <div className="bg-sirt border border-chiziq rounded-2xl p-4 flex flex-col justify-between">
                                                    <div>
                                                        <h3 className="text-xs font-black text-brand mb-5">
                                                            {getMonthName(payMonth)} {payYear} — {t('bill')}
                                                        </h3>
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between">
                                                                <span className="text-[11px] font-bold text-matn-xira">{t('base_salary_short')}</span>
                                                                <span className="text-xs font-extrabold text-matn">{baseSalary.toLocaleString()} UZS</span>
                                                            </div>
                                                            {kpiAmount > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-[11px] font-bold text-brand">KPI ({kpiPercent}%)</span>
                                                                    <span className="text-xs font-extrabold text-brand">+{kpiAmount.toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between">
                                                                <span className="text-[11px] font-bold text-emerald-600">{t('additional_bonus')} ({bonuses.length})</span>
                                                                <span className="text-xs font-extrabold text-emerald-600">+{totalBonus.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-[11px] font-bold text-rose-600">{t('fine')} ({fines.length})</span>
                                                                <span className="text-xs font-extrabold text-rose-600">-{totalFine.toLocaleString()}</span>
                                                            </div>
                                                            <div className="pt-4 border-t border-dashed border-chiziq flex justify-between items-center">
                                                                <span className="text-[11px] font-extrabold text-brand">{t('to_be_paid')}</span>
                                                                <span className="text-2xl font-black text-brand tabular-nums">{totalSalary.toLocaleString()}</span>
                                                            </div>
                                                            <p className="text-[11px] text-right text-matn-xira font-bold">UZS</p>
                                                        </div>
                                                    </div>

                                                    {!payConfirm ? (
                                                        <button
                                                            onClick={() => setPayConfirm(true)}
                                                            className="mt-6 w-full py-3 bg-brand hover:bg-brand-dark text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                                                            <Banknote size={14} /> {t('pay_salary_btn')}
                                                        </button>
                                                    ) : (
                                                        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-3">
                                                            <p className="text-[11px] font-extrabold text-amber-700 dark:text-amber-400 text-center">
                                                                {t('confirm_pay_salary').replace('{name}', staffUser.name).replace('{amount}', totalSalary.toLocaleString())}
                                                            </p>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => setPayConfirm(false)} className="flex-1 py-2 bg-chiziq text-gray-600 dark:text-white text-[11px] font-extrabold rounded-xl cursor-pointer hover:bg-gray-200 transition-all">
                                                                    {t('cancel')}
                                                                </button>
                                                                <button onClick={paySalary} disabled={paying}
                                                                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold rounded-xl cursor-pointer transition-all disabled:opacity-60 flex items-center justify-center gap-1.5">
                                                                    {paying ? t('saving') : <><CheckCircle2 size={12} /> {t('yes_paid')}</>}
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
                                            <span className="text-[11px] font-extrabold text-matn-xira flex items-center gap-1.5 border-t border-dashed border-chiziq pt-4">
                                                <Clock size={10} /> {t('payments_history')}
                                            </span>
                                            <div className="bg-sirt rounded-2xl overflow-hidden border border-chiziq">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-ichki border-b border-chiziq">
                                                            <th className="p-3 text-[11px] font-bold text-matn-xira">{t('month')}</th>
                                                            <th className="p-3 text-[11px] font-bold text-matn-xira">{t('base_short')}</th>
                                                            <th className="p-3 text-[11px] font-bold text-matn-xira">+Bonus</th>
                                                            <th className="p-3 text-[11px] font-bold text-matn-xira">−Jarima</th>
                                                            <th className="p-3 text-[11px] font-bold text-matn-xira">{t('total_short')}</th>
                                                            <th className="p-3 text-[11px] font-bold text-matn-xira">{t('date_short')}</th>
                                                            <th className="p-3" />
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                                        {salaryPayments.map(p => {
                                                            const [yr, mo] = p.month.split('-');
                                                            return (
                                                                <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                                                                    <td className="p-3 text-[11px] font-bold text-matn">
                                                                        {getMonthName(parseInt(mo)-1)} {yr}
                                                                    </td>
                                                                    <td className="p-3 text-[11px] font-bold text-matn-2">{p.baseSalary.toLocaleString()}</td>
                                                                    <td className="p-3 text-[11px] font-bold text-emerald-600">{p.bonuses > 0 ? `+${p.bonuses.toLocaleString()}` : '—'}</td>
                                                                    <td className="p-3 text-[11px] font-bold text-rose-600">{p.fines > 0 ? `-${p.fines.toLocaleString()}` : '—'}</td>
                                                                    <td className="p-3 text-[11px] font-bold text-brand">{p.amount.toLocaleString()}</td>
                                                                    <td className="p-3 text-[11px] font-bold text-matn-xira">{new Date(p.paidAt).toLocaleDateString('uz-UZ')}</td>
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
                                            <span className="text-[11px] font-extrabold text-matn-xira flex items-center gap-1.5">
                                                <CalendarDays size={11} /> {t('weekly_work_days')}
                                            </span>
                                            {workDaysChanged && (
                                                <button onClick={saveWorkDays} disabled={savingWD}
                                                    className="px-4 py-2 bg-brand hover:bg-brand-dark text-white text-[11px] font-bold rounded-xl cursor-pointer transition-all disabled:opacity-60 shadow-sm shadow-[#1b6b6b]/20">
                                                    {savingWD ? t('saving') : t('save')}
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
                                                                ? 'bg-brand border-brand text-white shadow-md shadow-[#1b6b6b]/25'
                                                                : 'bg-sirt border-chiziq text-matn-xira hover:border-brand/40 hover:text-gray-700'
                                                        }`}>
                                                        <span className="text-[12px] font-bold">{getWeekDayShort(day)}</span>
                                                        <span className="text-[10px] font-bold mt-0.5 opacity-70">{getWeekDayFull(WEEK_DAYS_FULL[i]).slice(0,3)}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {workDays.length === 0 && !workDaysChanged && (
                                            <p className="text-[11px] font-bold text-amber-500 text-center py-1">
                                                {t('work_schedule_not_set')}
                                            </p>
                                        )}
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-dashed border-chiziq" />

                                    {/* Attendance calendar */}
                                    <div className="space-y-4">
                                        {/* Month selector */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-extrabold text-matn-xira">{t('attendance')}</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-xl bg-ichki border border-chiziq text-matn-sokin hover:border-brand hover:text-brand transition-all cursor-pointer">
                                                    <ChevronLeft size={14} />
                                                </button>
                                                <span className="text-xs font-black text-matn min-w-[120px] text-center">
                                                    {getMonthName(selMonth)} {selYear}
                                                </span>
                                                <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-xl bg-ichki border border-chiziq text-matn-sokin hover:border-brand hover:text-brand transition-all cursor-pointer">
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Summary badges */}
                                        {workDays.length > 0 && (
                                            <div className="grid grid-cols-3 gap-3">
                                                {[
                                                    { label:t('present'),   count: presentDays, cls:'border-emerald-100 dark:border-emerald-950/20 text-emerald-600 dark:text-emerald-400' },
                                                    { label:t('absent'), count: absentDays,  cls:'border-rose-100 dark:border-rose-950/20 text-rose-600 dark:text-rose-400' },
                                                    { label:t('excused'), count: excusedDays, cls:'border-amber-100 dark:border-amber-950/20 text-amber-600 dark:text-amber-400' },
                                                ].map(({ label, count, cls }) => (
                                                    <div key={label} className={`bg-sirt border rounded-2xl p-3 text-center ${cls}`}>
                                                        <span className="text-[11px] font-extrabold block mb-1 opacity-70">{label}</span>
                                                        <p className="text-2xl font-black tabular-nums">{count}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {workDays.length === 0 ? (
                                            <div className="py-10 text-center bg-ichki/40 rounded-2xl border border-dashed border-chiziq">
                                                <CalendarDays size={28} className="mx-auto text-gray-300 mb-2" />
                                                <p className="text-[11px] font-bold text-matn-xira">
                                                    {t('attendance_setup_warning')}
                                                </p>
                                            </div>
                                        ) : attLoading ? (
                                            <div className="py-8 text-center text-[11px] text-matn-xira font-bold">{t('loading')}</div>
                                        ) : (
                                            <>
                                                {/* Day-of-week headers */}
                                                <div className="grid grid-cols-7 gap-1">
                                                    {WEEK_DAYS.map(d => (
                                                        <div key={d} className={`text-center text-[11px] font-bold py-1.5 rounded-lg ${workDays.includes(d) ? 'text-brand bg-brand/5' : 'text-gray-300'}`}>{d}</div>
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

                                                        let cls = 'aspect-square rounded-xl border-2 flex flex-col items-center justify-center text-[11px] font-black transition-all ';
                                                        if (!isWork) {
                                                            cls += 'bg-transparent border-transparent text-gray-200 dark:text-gray-700 cursor-default';
                                                        } else if (status === 'Keldi') {
                                                            cls += 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 cursor-pointer hover:opacity-80';
                                                        } else if (status === 'Kelmadi') {
                                                            cls += 'bg-rose-100 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 cursor-pointer hover:opacity-80';
                                                        } else if (status === 'Sababli') {
                                                            cls += 'bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 cursor-pointer hover:opacity-80';
                                                        } else {
                                                            cls += `bg-sirt border-brand/20 text-matn-2 cursor-pointer hover:border-brand hover:bg-brand/5 ${isToday ? 'ring-2 ring-[#1b6b6b] ring-offset-1' : ''}`;
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
                                                <p className="text-[11px] text-center text-matn-xira font-bold">
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
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setAttPicker(null)} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-xs p-4">
                        <div className="flex items-center justify-between mb-5 pb-3 border-b border-chiziq-mayin/50">
                            <div>
                                <h3 className="text-sm font-black text-matn tracking-tight">{attPicker}</h3>
                                <p className="text-[11px] font-bold text-matn-xira mt-0.5">Davomat holati</p>
                            </div>
                            <button aria-label="Yopish" onClick={() => setAttPicker(null)} className="w-8 h-8 flex items-center justify-center text-matn-xira hover:bg-chiziq rounded-xl cursor-pointer">
                                <X size={18} />
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
                                    <span className={`text-[10px] font-bold ${color==='emerald'?'text-emerald-600':color==='rose'?'text-rose-600':'text-amber-600'} group-hover:text-white transition-colors`}>{label}</span>
                                </button>
                            ))}
                        </div>
                        {staffAtt.find(a => a.date === attPicker) && (
                            <button onClick={() => markAttendance(attPicker, 'delete')}
                                className="mt-3 w-full py-2 text-[11px] font-bold text-matn-xira hover:text-rose-500 cursor-pointer transition-colors text-center">
                                O'chirish
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Edit modal */}
            {isEditOpen && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsEditOpen(false)} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq-mayin/50">
                            <div>
                                <h3 className="text-lg font-black text-matn tracking-tight">Tahrirlash</h3>
                                <p className="text-[11px] font-bold text-brand mt-0.5">Ma'lumotlarni yangilash</p>
                            </div>
                            <button aria-label="Yopish" onClick={() => setIsEditOpen(false)} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-chiziq rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div onClick={() => fileRef.current?.click()} className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-gray-600 cursor-pointer hover:border-brand transition-colors flex items-center justify-center bg-ichki shrink-0">
                                    {editData.photo ? <img src={editData.photo} alt="preview" className="w-full h-full object-cover" /> : <Camera size={20} className="text-gray-300" />}
                                </div>
                                <div>
                                    <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] font-extrabold text-brand cursor-pointer hover:underline">Rasm yuklash</button>
                                    {editData.photo && <button type="button" onClick={() => setEditData((p:any) => ({...p,photo:''}))} className="ml-3 text-[11px] font-extrabold text-rose-500 cursor-pointer hover:underline">O'chirish</button>}
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
                            <div className="flex gap-3 pt-4 border-t border-dashed border-chiziq">
                                <button type="button" onClick={() => setIsEditOpen(false)} className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl cursor-pointer hover:bg-gray-200">Bekor</button>
                                <button type="submit" className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white text-xs font-extrabold rounded-2xl shadow-sm shadow-[#1b6b6b]/20 cursor-pointer">Saqlash</button>
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

            {isPhotoViewerOpen && staffUser.photo && (
                <PhotoViewer
                    src={staffUser.photo}
                    name={staffUser.name}
                    onClose={() => setIsPhotoViewerOpen(false)}
                />
            )}

            {editingPayment && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEditingPayment(null)} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-md p-8 space-y-4">
                        <div className="flex items-center justify-between pb-4 border-b border-chiziq-mayin/50">
                            <div>
                                <h3 className="text-lg font-black text-matn tracking-tight">Oylikni tahrirlash</h3>
                                <p className="text-[11px] font-bold text-brand mt-0.5">{editingPayment.month} — {staffUser.name}</p>
                            </div>
                            <button aria-label="Yopish" onClick={() => setEditingPayment(null)}
                                className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>
                        <div>
                            <label className="block text-[11px] font-extrabold text-matn-xira mb-2">Summa (UZS)</label>
                            <input type="number" value={editPayAmount} onChange={e => setEditPayAmount(e.target.value)}
                                className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn outline-none focus:border-brand transition-all" />
                            <p className="text-[10px] text-matn-xira mt-1">Moliyadagi xarajat ham shu summaga o'zgaradi.</p>
                        </div>
                        <div>
                            <label className="block text-[11px] font-extrabold text-matn-xira mb-2">Izoh</label>
                            <input type="text" value={editPayNote} onChange={e => setEditPayNote(e.target.value)}
                                placeholder="Masalan: summa xato kiritilgan edi"
                                className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn outline-none focus:border-brand transition-all" />
                        </div>
                        <div className="flex gap-3 pt-4 border-t border-dashed border-chiziq/50">
                            <button type="button" onClick={() => setEditingPayment(null)}
                                className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                                Bekor
                            </button>
                            <button type="button" onClick={saveSalaryEdit} disabled={savingPayEdit}
                                className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-xs font-extrabold rounded-2xl cursor-pointer transition-all">
                                {savingPayEdit ? 'Saqlanmoqda…' : 'Saqlash'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
    const cls = { emerald:'border-emerald-100 dark:border-emerald-950/30 text-emerald-600 dark:text-emerald-400', rose:'border-rose-100 dark:border-rose-950/30 text-rose-600 dark:text-rose-400', amber:'border-amber-100 dark:border-amber-950/30 text-amber-600 dark:text-amber-400' }[color] || 'border-gray-100 text-gray-600';
    return (
        <div className="bg-sirt border border-chiziq rounded-2xl px-5 py-4">
            <span className="text-[12px] text-matn-sokin block">{label}</span>
            <p className={`num text-[26px] font-bold leading-none mt-1.5 ${cls.split(' ').filter(c => c.startsWith('text-')).join(' ') || 'text-matn'}`}>{value}</p>
            <p className="text-[11px] text-matn-xira mt-2">{sub}</p>
        </div>
    );
}

function InfoBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-ichki/40 rounded-xl px-4 py-3 border border-chiziq">
            <span className="text-[11px] text-matn-xira block mb-0.5">{label}</span>
            <span className="text-[13px] font-medium text-matn">{value}</span>
        </div>
    );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="flex items-center gap-2 text-[11px] text-matn-xira shrink-0">
                <span className="text-matn-xira shrink-0">{icon}</span>
                {label}
            </span>
            <span className="text-[12px] font-medium text-matn text-right truncate min-w-0" title={value}>{value || '—'}</span>
        </div>
    );
}
