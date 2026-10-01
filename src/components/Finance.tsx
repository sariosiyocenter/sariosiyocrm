import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, Wallet,
    Plus, X, Trash2, Search, ChevronRight, BarChart2,
    AlertCircle, CreditCard, ArrowUpRight, Calendar,
    RefreshCw, CheckCircle2, MessageSquare, ChevronLeft, Users, Banknote, Pencil, Lock, FileSpreadsheet
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import StatTile from './ui/StatTile';
import { displayName } from '../lib/displayName';
import { useConfirm } from './ConfirmDialog';
import { useLang } from '../context/LanguageContext';
import { Payment, Expense } from '../types';
import { StatCard, BarChart, DonutChart, LineChart } from './reports/shared';
import { printReceipt } from '../lib/receipt';
import { activeCourses } from '../lib/activeCourses';
import { isCashIncome, newestFirst } from '../lib/money';
import KassaPanel from './KassaPanel';
import MoliyaVaraqlari from './MoliyaVaraqlari';
import PaymeLinkModal from './PaymeLinkModal';
import PaymentEditModal, { canEditPayment } from './PaymentEditModal';
import { TolovXabarQatori } from './TolovXabari';
import { QarzdorlarModal } from './QarzXabari';
import { KlikChekMaydonlari, klikniYuborish, yuborishNatijasi, TASDIQ_TURLARI, isAdminRole, chekVaqti } from './KlikChek';
import TolovTasdiqPanel, { TASDIQ_HODISASI } from './TolovTasdiqPanel';
import { amaldagiQoida, qoidaMatni } from '../lib/taqsimot';
import { ochirishQoldi, XARAJAT_OCHIRISH_DAQIQA } from '../../lib/xarajat.js';
import MoliyaKorsatkichlari from './MoliyaKorsatkichlari';
import { davrOraligi, davrNomi, type Davr } from '../lib/davr';

const inp = "w-full px-4 py-3 bg-slate-50 dark:bg-[#1a2232] border border-chiziq rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all";
const lbl = "block text-[11px] font-extrabold   text-matn-xira mb-2";

const MONTHS = ['Yan','Fev','Mar','Apr','May','Iyun','Iyul','Avg','Sen','Okt','Noy','Dek'];
const OY_TOLIQ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

/** To'lov usullari — bazadagi tur va ko'rinadigan nom (Payme bazada "Peyme"). */
const TOLOV_USULLARI = [
    { tur: 'Naqd', nom: 'Naqd' },
    { tur: 'Karta', nom: 'Karta' },
    { tur: "O'tkazma", nom: "O'tkazma" },
    { tur: 'Klik', nom: 'Klik' },
    { tur: 'Peyme', nom: 'Payme' },
];
const usulNomi = (tur: string) => TOLOV_USULLARI.find(u => u.tur === tur)?.nom || tur;
const PRESET_CATS = ['Ish haqi', 'Ijara', 'Kommunal', 'Marketing', 'Boshqa'];

const downloadCSV = (filename: string, rows: Record<string, any>[]) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]).join(',');
    const lines = rows.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob(['﻿' + [headers, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
};

/**
 * Xarajatni o'chirish tugmasi: kiritilganidan keyin 15 daqiqa ko'rinadi va
 * qolgan daqiqani ko'rsatadi, keyin qulf (egasi, 2026-09-29 — lib/xarajat.js).
 */
function XarajatOchirishTugmasi({ createdAt, onDelete }: { createdAt?: string; onDelete: () => void }) {
    const [, yangila] = useState(0);
    const qoldi = ochirishQoldi(createdAt);
    useEffect(() => {
        if (qoldi <= 0) return;
        const t = setInterval(() => yangila(x => x + 1), 15000);
        return () => clearInterval(t);
    }, [qoldi > 0]);
    if (qoldi <= 0) {
        return (
            <span title={`Xarajat ${XARAJAT_OCHIRISH_DAQIQA} daqiqadan keyin o'chirilmaydi`}
                className="w-7 h-7 rounded-lg text-matn-xira/60 flex items-center justify-center">
                <Lock size={12} />
            </span>
        );
    }
    return (
        <button onClick={onDelete} title={`O'chirish — yana ${Math.ceil(qoldi / 60000)} daqiqa mumkin`}
            className="h-7 px-2 rounded-lg text-matn-xira hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-1 transition-colors cursor-pointer">
            <Trash2 size={13} />
            <span className="raqam text-[11px]">{Math.ceil(qoldi / 60000)} daq</span>
        </button>
    );
}

export default function Finance() {
    const { students, payments, expenses, addPayment, addExpense, deleteExpense, groups, courses, token, selectedSchoolId, teachers, settings, showNotification, retryLoad, user, kora, ozgartira } = useCRM();
    // Tablar va tugmalar lavozim ruxsatiga qarab (Sozlamalar → Ruxsatlar).
    const TAB_RUXSATI = { reports: 'moliya.hisobot', billing: 'moliya.oylik', payments: 'moliya.tolovlar', expenses: 'moliya.xarajat', kassa: 'moliya.kassa' } as const;
    const confirm = useConfirm();

    // HR users (staff list for salary expense) — faqat tanlangan filial xodimlari.
    const [hrUsers, setHrUsers] = useState<any[]>([]);
    useEffect(() => {
        if (!token) return;
        const branch = selectedSchoolId === null || selectedSchoolId === undefined ? '' : `?schoolId=${selectedSchoolId}`;
        fetch(`/api/users${branch}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).then(d => setHrUsers(Array.isArray(d) ? d : [])).catch(() => {});
    }, [token, selectedSchoolId]);
    const { t } = useLang();
    const navigate = useNavigate();

    // Summalarni millionda ko'rsatadi: "500 001 UZS" o'rniga "0,5".
    // Bir qarashda o'qish uchun aniq so'm kerak emas, kattalik kerak.
    const mln = (n: number) => (n / 1000000).toFixed(1).replace('.', ',');
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'reports' | 'billing' | 'payments' | 'expenses' | 'kassa' | 'varaq'>(
        () => (Object.keys(TAB_RUXSATI) as (keyof typeof TAB_RUXSATI)[]).find(k => kora(TAB_RUXSATI[k])) || 'reports'
    );

    // Auto-open expense modal when navigated from HR with ?openExpense=1
    useEffect(() => {
        if (searchParams.get('openExpense') === '1') {
            const staffId = searchParams.get('staffId');
            const staffName = searchParams.get('staffName');
            setNewExpense(prev => ({
                ...prev,
                category: 'Ish haqi',
                staffId: staffId ? Number(staffId) : null,
                staffName: staffName ? decodeURIComponent(staffName) : null,
            }));
            setActiveTab('expenses');
            setIsExpenseModalOpen(true);
            // Clean URL
            navigate('/finance', { replace: true });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Billing state
    const [billingMonth, setBillingMonth] = useState(() => {
        const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    // birinchiOy..joriyOy — ko'rish mumkin bo'lgan oylar (server aytadi): o'tgan
    // oyni ochish hech narsa yozmaydi, kelajak oy esa hali hisoblanmagan.
    const [billingData, setBillingData] = useState<{ billingDone: boolean; billingDay?: number; students: any[]; groups: any[]; birinchiOy?: string; joriyOy?: string } | null>(null);
    const [billingLoading, setBillingLoading] = useState(false);
    const [billingProcessing, setBillingProcessing] = useState(false);
    const [billingFilter, setBillingFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
    // Oylik nazorat: qidiruv, tanlangan kurs va sahifa.
    const [nazoratQidiruv, setNazoratQidiruv] = useState('');
    const [nazoratKurs, setNazoratKurs] = useState<number | null>(null);
    const [nazoratSahifa, setNazoratSahifa] = useState(0);

    const [showDebtNotifyModal, setShowDebtNotifyModal] = useState(false);
    const loadBillingStatus = useCallback(async () => {
        if (!selectedSchoolId || !token) return;
        setBillingLoading(true);
        try {
            const res = await fetch(`/api/billing/status?schoolId=${selectedSchoolId}&month=${billingMonth}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setBillingData(await res.json());
        } catch { /* ignore */ } finally { setBillingLoading(false); }
    }, [selectedSchoolId, token, billingMonth]);

    useEffect(() => {
        if (activeTab === 'billing') loadBillingStatus();
    }, [activeTab, billingMonth, loadBillingStatus]);

    const handleBillingProcess = async (recalculate = false) => {
        if (!selectedSchoolId || !token || billingProcessing) return;
        setBillingProcessing(true);
        try {
            const endpoint = recalculate ? '/api/billing/recalculate-month' : '/api/billing/process-month';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ schoolId: selectedSchoolId, month: billingMonth })
            });
            const data = await res.json();
            if (res.ok) await loadBillingStatus();
            else showNotification(data.error || 'Xatolik yuz berdi', 'error');
        } catch { showNotification('Server bilan aloqa yo\'q', 'error'); } finally { setBillingProcessing(false); }
    };

    const billingMonthLabel = (m: string) => {
        const [y, mo] = m.split('-').map(Number);
        return `${OY_TOLIQ[mo - 1]} ${y}`;
    };
    const prevBillingMonth = () => {
        const [y, mo] = billingMonth.split('-').map(Number);
        const d = new Date(y, mo - 2, 1);
        setBillingMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };
    const nextBillingMonth = () => {
        const [y, mo] = billingMonth.split('-').map(Number);
        const d = new Date(y, mo, 1);
        setBillingMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    // To'lovni tahrirlash oynasi (resepshn 10 daqiqa, admin doim).
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [isSavingPayment, setIsSavingPayment] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseCustomCat, setExpenseCustomCat] = useState('');


    // Davr (Kun / Hafta / Shu oy …) — Toshkent vaqti bo'yicha (src/lib/davr.ts).
    // "Kun" va "Hafta" kassani kun oxirida yopayotgan xodimga eng kerakli kesim.
    const [selectedPreset, setSelectedPreset] = useState<Davr>('this_month');
    const [startDate, setStartDate] = useState(() => davrOraligi('this_month').start);
    const [endDate, setEndDate] = useState(() => davrOraligi('this_month').end);

    const handlePreset = (type: Exclude<Davr, 'custom'>) => {
        setSelectedPreset(type);
        const { start, end } = davrOraligi(type);
        setStartDate(start);
        setEndDate(end);
    };

    // List filters
    const [listSearch, setListSearch] = useState('');
    // To'lov usuli filtri (Payme bazada "Peyme" deb saqlangan) va ro'yxat uzunligi.
    const [usulFiltr, setUsulFiltr] = useState<string>('all');
    const [listLimit, setListLimit] = useState(100);

    // Payment modal state
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    // Payme havola/QR — tanlangan o'quvchi uchun (pul webhook orqali o'zi tushadi).
    const [paymeFor, setPaymeFor] = useState<number | null>(null);
    const paymeOn = settings.paymeMode === 'live' || settings.paymeMode === 'test';
    const [createdPaymentForReceipt, setCreatedPaymentForReceipt] = useState<any>(null);
    // Klik: chekdagi vaqt va chek rasmi — administrator tasdig'i uchun (KlikChek.tsx).
    const [klikVaqt, setKlikVaqt] = useState('');
    const [klikChek, setKlikChek] = useState<string | null>(null);
    /** Qabul qilinadigan summa (pul balansga tushadi). */
    const [payAmount, setPayAmount] = useState<string>('');
    /** Tanlangan o'quvchining kurs kesimidagi holati (/api/students/:id/ledger). */
    const [payLedger, setPayLedger] = useState<any>(null);
    const [payLedgerLoading, setPayLedgerLoading] = useState(false);
    const [newPayment, setNewPayment] = useState<Omit<Payment, 'id' | 'schoolId'>>({
        studentId: 0, amount: 0, type: 'Naqd', description: '', courseId: null, groupId: null, date: new Date().toISOString().split('T')[0]
    });
    const [newExpense, setNewExpense] = useState<Omit<Expense, 'id' | 'schoolId'>>({
        amount: 0, category: 'Boshqa', description: '', date: new Date().toISOString().split('T')[0],
        staffId: null, staffName: null
    });

    // All staff for salary expense selector (users + legacy teachers)
    const userNames = new Set(hrUsers.map(u => u.name.toLowerCase().trim()));
    const allStaffList = [
        ...hrUsers.map(u => ({ id: u.id, name: u.name, role: u.role, isUser: true })),
        ...(teachers || []).filter(t => t.status !== 'Arxiv' && !userNames.has(t.name.toLowerCase().trim()))
            .map(t => ({ id: t.id, name: t.name, role: 'TEACHER', isUser: false }))
    ];

    const handlePrintReceipt = (payment: any, student: any) => {
        const studentGroups = groups.filter(g => (g.studentIds || []).includes(student?.id));
        printReceipt({
            payment,
            student,
            orgName: settings?.orgName,
            logo: settings?.logo,
            address: settings?.address,
            adminPhone: settings?.adminPhone,
            adminPhone2: settings?.adminPhone2,
            courseName: payment?.courseId
                ? (courses.find(c => c.id === payment.courseId)?.name || null)
                : null,
            groupLines: studentGroups.map(g => {
                const courseName = courses.find(c => c.id === g.courseId)?.name || '';
                return g.name + (courseName ? ' (' + courseName + ')' : '');
            })
        });
    };

    // O'quvchi tanlangach uning kurslar bo'yicha qarzi ko'rsatiladi.
    useEffect(() => {
        if (!selectedStudent) { setPayLedger(null); return; }
        let off = false;
        setPayLedgerLoading(true);
        (async () => {
            try {
                const r = await fetch(`/api/students/${selectedStudent.id}/ledger`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                });
                const j = await r.json();
                if (off) return;
                setPayLedger(r.ok ? j : null);
            } catch {
                if (!off) setPayLedger(null);
            } finally {
                if (!off) setPayLedgerLoading(false);
            }
        })();
        return () => { off = true; };
    }, [selectedStudent?.id]);

    /** To'lov oynasidagi qatorlar: o'quvchining kurslari + eski qoldiq. */
    const payRows = useMemo(() => {
        if (!selectedStudent) return [];
        const rows = (payLedger?.courses || []).map((c: any) => ({
            key: String(c.groupId),
            groupId: c.groupId as number,
            courseId: c.courseId as number | null,
            title: c.groupName,
            subtitle: c.courseName,
            debt: c.debt as number,
            advance: c.advance as number,
            paidUntil: c.paidUntil as string | null,
            monthlyPrice: c.monthlyPrice as number,
        }));
        // Ledger hali kelmagan bo'lsa — hech bo'lmasa guruhlar ro'yxati.
        if (!payLedger) {
            for (const g of groups.filter(g => (g.studentIds || []).includes(selectedStudent.id))) {
                rows.push({
                    key: String(g.id), groupId: g.id, courseId: g.courseId,
                    title: g.name, subtitle: courses.find(c => c.id === g.courseId)?.name || '',
                    debt: 0, advance: 0, paidUntil: null,
                    monthlyPrice: courses.find(c => c.id === g.courseId)?.price || 0,
                });
            }
        }
        const legacyDebt = (payLedger?.buckets || [])
            .filter((b: any) => !b.groupId)
            .reduce((sum: number, b: any) => sum + (b.remaining || 0), 0);
        if (legacyDebt > 0) {
            rows.push({
                key: 'umumiy', groupId: null, courseId: null,
                title: 'Eski qoldiq', subtitle: 'Kursga bog\'lanmagan qarz',
                debt: legacyDebt, advance: 0, paidUntil: null, monthlyPrice: 0,
            });
        }
        // Kursi ham, eski qarzi ham yo'q o'quvchidan pul olishning iloji
        // qolmasin: bunday holatda kursga bog'lanmagan bitta qator beriladi.
        // Pul keyin qaysi kursga kerak bo'lsa, o'sha kursning hisobini yopadi.
        if (rows.length === 0) {
            rows.push({
                key: 'umumiy', groupId: null, courseId: null,
                title: 'Umumiy hisob', subtitle: "Kursga bog'lanmagan — o'quvchi hali kursga yozilmagan",
                debt: 0, advance: payLedger?.generalWallet || 0, paidUntil: null, monthlyPrice: 0,
            });
        }
        return rows;
    }, [selectedStudent, payLedger, groups, courses]);

    const payTotal = Math.round(Number(payAmount) || 0);

    /** O'quvchining barcha kurslari bo'yicha jami qarzi. */
    const payJamiQarz = payRows.reduce((sum, r) => sum + Math.max(0, Number(r.debt) || 0), 0);

    /** Kurslar (eski qoldiq qatori bunga kirmaydi). */
    const payKursRows = payRows.filter(r => r.groupId);
    /** Taqsimot yozuvi faqat bir nechta kursda ko'rsatiladi. */
    const kopKurs = payKursRows.length > 1;
    /** Kurslarga taqsimot: o'quvchida foiz belgilangan bo'lsa — o'sha, aks holda teng. */
    const qoidaYozuvi = qoidaMatni(amaldagiQoida((selectedStudent as any)?.payShare), id => groups.find(g => g.id === id)?.name || ('#' + id));


    const closePaymentModal = () => {
        setIsPaymentModalOpen(false);
        setCreatedPaymentForReceipt(null);
        setSelectedStudent(null);
        setPayAmount('');
        setStudentSearch('');
        setPayLedger(null);
        setKlikVaqt('');
        setKlikChek(null);
        setNewPayment({ studentId: 0, amount: 0, type: 'Naqd', description: '', courseId: null, groupId: null, date: new Date().toISOString().split('T')[0] });
    };

    // ─── Date helpers ─────────────────────────────────────────────
    const now = new Date();
    const dateLabel = davrNomi(selectedPreset, startDate, endDate);

    // ─── Core metrics ─────────────────────────────────────────────
    // Ko'rsatkichlar (tushum, qarz, avans, qarz yoshi, kurslar) —
    // MoliyaKorsatkichlari.tsx da; bu yerda faqat trend va xarajat turlari.
    const metrics = useMemo(() => {
        const posPayments = payments.filter(isCashIncome);

        // Expense category breakdown (this period)
        const catMap: Record<string, number> = {};
        expenses.filter(e => e.date >= startDate && e.date <= endDate).forEach(e => {
            catMap[e.category] = (catMap[e.category] || 0) + e.amount;
        });
        const catBars = Object.entries(catMap)
            .sort(([, a], [, b]) => b - a)
            .map(([label, value]) => ({ label, value, color: 'linear-gradient(90deg,#1b6b6b,#2e9c9c)' }));

        // Monthly trend last 6 months
        const monthMap: Record<string, { rev: number; exp: number }> = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthMap[key] = { rev: 0, exp: 0 };
        }
        posPayments.forEach(p => { const k = p.date.slice(0, 7); if (monthMap[k]) monthMap[k].rev += p.amount; });
        expenses.forEach(e => { const k = e.date.slice(0, 7); if (monthMap[k]) monthMap[k].exp += e.amount; });
        const trendBars = Object.entries(monthMap).map(([key, val]) => ({
            label: MONTHS[parseInt(key.slice(5, 7)) - 1],
            value: val.rev,
            color: 'linear-gradient(180deg,#1b6b6b,#2e9c9c)'
        }));
        const trendLine = Object.entries(monthMap).map(([key, val]) => ({
            label: MONTHS[parseInt(key.slice(5, 7)) - 1],
            value: val.rev
        }));

        return { catBars, trendBars, trendLine };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payments, expenses, startDate, endDate]);

    // ─── List filters ─────────────────────────────────────────────
    const filteredPayments = useMemo(() => {
        return payments
            .filter(isCashIncome)
            .filter(p => {
                return p.date >= startDate && p.date <= endDate;
            })
            .filter(p => usulFiltr === 'all' || p.type === usulFiltr)
            .filter(p => {
                if (!listSearch.trim()) return true;
                const student = students.find(s => s.id === p.studentId);
                const q = listSearch.toLowerCase().trim();
                const raqam = q.replace(/\D/g, '');
                return (
                    !!student?.name.toLowerCase().includes(q) ||
                    (raqam.length >= 4 && [student?.phone, student?.fatherPhone, student?.motherPhone].some(t => (t || '').replace(/\D/g, '').includes(raqam))) ||
                    (!!student?.kod && /^\d{3,5}$/.test(q) && String(student.kod).startsWith(q)) ||
                    usulNomi(p.type).toLowerCase().includes(q) ||
                    (p.description || '').toLowerCase().includes(q)
                );
            })
            .sort(newestFirst);
    }, [payments, startDate, endDate, listSearch, students, usulFiltr]);

    // Usul bo'yicha soni va summasi — filtr tugmalarida.
    const usulSanoq = useMemo(() => {
        const m = new Map<string, { soni: number; summa: number }>();
        for (const p of payments) {
            if (!isCashIncome(p) || p.date < startDate || p.date > endDate) continue;
            const x = m.get(p.type) || { soni: 0, summa: 0 };
            x.soni++; x.summa += p.amount;
            m.set(p.type, x);
        }
        return m;
    }, [payments, startDate, endDate]);

    const filteredExpenses = useMemo(() => {
        return expenses
            .filter(e => {
                return e.date >= startDate && e.date <= endDate;
            })
            .filter(e => {
                if (!listSearch.trim()) return true;
                const q = listSearch.toLowerCase();
                return e.category.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q);
            })
            .sort(newestFirst);
    }, [expenses, startDate, endDate, listSearch]);

    const filteredRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const filteredExpenditure = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-[26px] font-bold text-matn tracking-tight leading-tight">{t('finance_title')}</h1>
                            <p className="text-[13px] text-matn-sokin mt-1">
                                {t('stat_revenue')} & {t('stat_expenses')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {ozgartira('oquvchilar.tolov') && (
                        <button
                            onClick={() => setIsPaymentModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-extrabold shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> {t('add_payment')}
                        </button>
                        )}
                        {ozgartira('moliya.xarajat') && (
                        <button
                            onClick={() => setIsExpenseModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> {t('add_expense')}
                        </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Klik to'lovlari — administrator tasdig'ini kutayotganlar (egasi, 2026-09-24). */}
            <TolovTasdiqPanel />

            {/* Main Card with Tabs */}
            <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm">
                {/* Tab Bar */}
                <div className="px-6 pt-5 pb-4 border-b border-chiziq-mayin/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-gray-950/40 p-1 rounded-xl border border-gray-200/40 dark:border-gray-800/40 w-full xl:w-auto max-w-full overflow-x-auto no-scrollbar flex-nowrap">
                        {kora('moliya.hisobot') && (
                        <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-black transition-all duration-200 cursor-pointer whitespace-nowrap transform active:scale-95 ${
                            activeTab === 'reports'
                                ? 'bg-sirt text-brand dark:text-emerald-400 shadow-sm border border-gray-200/50 dark:border-gray-800/50 scale-[1.01]'
                                : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-300'
                        }`}>
                            <BarChart2 size={12} className="shrink-0" />
                            <span>Hisobotlar</span>
                        </button>
                        )}
                        {kora('moliya.oylik') && (
                        <button onClick={() => setActiveTab('billing')} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-black transition-all duration-200 cursor-pointer whitespace-nowrap transform active:scale-95 ${
                            activeTab === 'billing'
                                ? 'bg-sirt text-violet-600 dark:text-violet-400 shadow-sm border border-gray-200/50 dark:border-gray-800/50 scale-[1.01]'
                                : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-300'
                        }`}>
                            <Calendar size={12} className="shrink-0" />
                            <span>Oylik nazorat</span>
                        </button>
                        )}
                        {kora('moliya.tolovlar') && (
                        <button onClick={() => { setActiveTab('payments'); setListSearch(''); }} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-black transition-all duration-200 cursor-pointer whitespace-nowrap transform active:scale-95 ${
                            activeTab === 'payments'
                                ? 'bg-sirt text-brand dark:text-emerald-400 shadow-sm border border-gray-200/50 dark:border-gray-800/50 scale-[1.01]'
                                : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-300'
                        }`}>
                            <CreditCard size={12} className="shrink-0" />
                            <span>{t('payments_tab')}</span>
                        </button>
                        )}
                        {kora('moliya.xarajat') && (
                        <button onClick={() => { setActiveTab('expenses'); setListSearch(''); }} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-black transition-all duration-200 cursor-pointer whitespace-nowrap transform active:scale-95 ${
                            activeTab === 'expenses'
                                ? 'bg-sirt text-brand dark:text-emerald-400 shadow-sm border border-gray-200/50 dark:border-gray-800/50 scale-[1.01]'
                                : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-300'
                        }`}>
                            <TrendingDown size={12} className="shrink-0" />
                            <span>{t('expenses_tab')}</span>
                        </button>
                        )}
                        {kora('moliya.kassa') && (
                        <button onClick={() => setActiveTab('kassa')} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-black transition-all duration-200 cursor-pointer whitespace-nowrap transform active:scale-95 ${
                            activeTab === 'kassa'
                                ? 'bg-sirt text-brand dark:text-emerald-400 shadow-sm border border-gray-200/50 dark:border-gray-800/50 scale-[1.01]'
                                : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-300'
                        }`}>
                            <Banknote size={12} className="shrink-0" />
                            <span>Kassa</span>
                        </button>
                        )}
                        {(kora('moliya.kassa') || kora('moliya.hisobot') || kora('xodimlar.maosh')) && (
                        <button onClick={() => setActiveTab('varaq')} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-black transition-all duration-200 cursor-pointer whitespace-nowrap transform active:scale-95 ${
                            activeTab === 'varaq'
                                ? 'bg-sirt text-brand dark:text-emerald-400 shadow-sm border border-gray-200/50 dark:border-gray-800/50 scale-[1.01]'
                                : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-300'
                        }`}>
                            <FileSpreadsheet size={12} className="shrink-0" />
                            <span>Hisobot varag'i</span>
                        </button>
                        )}
                    </div>

                    {activeTab !== 'billing' && activeTab !== 'kassa' && activeTab !== 'varaq' && (
                        <div className="flex flex-wrap items-center gap-3 min-w-0 max-w-full">
                            {/* Presets. Telefonda qator sig'maydi — sahifa yon tomonga
                                toshmasin, tugmalar o'zi suriladi. */}
                            <div className="flex items-center gap-1 bg-ichki p-1 rounded-xl border border-chiziq max-w-full overflow-x-auto no-scrollbar">
                                {['today', 'this_week', 'this_month', 'last_30', 'this_year', 'all', 'custom'].map((type) => {
                                    const label = type === 'today' ? 'Kun'
                                        : type === 'this_week' ? 'Hafta'
                                        : type === 'this_month' ? t('preset_this_month')
                                        : type === 'last_30' ? t('preset_30_days')
                                        : type === 'this_year' ? t('preset_this_year')
                                        : type === 'all' ? t('preset_all')
                                        : 'Boshqa muddat';
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => type === 'custom' ? setSelectedPreset('custom') : handlePreset(type as any)}
                                            className={`px-3 py-1.5 rounded-lg text-[12px] whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                                                selectedPreset === type
                                                    ? 'bg-brand text-brand-ust font-semibold'
                                                    : 'text-matn-sokin hover:text-matn'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Sana maydonlari faqat kerak bo'lganda ochiladi —
                                bosh sahifadagi kabi. */}
                            {selectedPreset === 'custom' && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => { setStartDate(e.target.value); setSelectedPreset('custom'); }}
                                        className="num bg-ichki px-2.5 h-[30px] rounded-lg border border-chiziq-kuchli text-[12px] text-matn-2 outline-none focus:border-brand cursor-pointer"
                                    />
                                    <span className="text-matn-xira text-[12px]">{t('date_to')}</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => { setEndDate(e.target.value); setSelectedPreset('custom'); }}
                                        className="num bg-ichki px-2.5 h-[30px] rounded-lg border border-chiziq-kuchli text-[12px] text-matn-2 outline-none focus:border-brand cursor-pointer"
                                    />
                                </div>
                            )}

                            {/* Search box if activeTab is payments or expenses */}
                            {(activeTab === 'payments' || activeTab === 'expenses') && (
                                <div className="relative">
                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
                                    <input
                                        type="text"
                                        placeholder={activeTab === 'payments' ? "O'quvchi ismi..." : "Kategoriya..."}
                                        value={listSearch}
                                        onChange={e => setListSearch(e.target.value)}
                                        className="pl-8 pr-4 py-2 bg-ichki border border-chiziq rounded-xl text-[11px] font-bold text-matn outline-none focus:border-brand w-40 transition-all"
                                    />
                                    {listSearch && (
                                        <button aria-label="Yopish" onClick={() => setListSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 cursor-pointer">
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ─── HISOBOTLAR TAB ──────────────────────────────────────── */}
                {activeTab === 'reports' && kora('moliya.hisobot') && (
                    <div className="p-4 space-y-8">
                        {/* Ko'rsatkichlar: tushum usullar bo'yicha (Payme ham), hisob va natija,
                            o'quvchilar harakati, kurslar bo'yicha qarz (egasi, 2026-09-29). */}
                        <MoliyaKorsatkichlari startDate={startDate} endDate={endDate} dateLabel={dateLabel} />

                        {/* Tushum trendi va xarajat turlari. Qarz yoshi, eng katta
                            qarzdorlar — tepadagi ko'rsatkichlarda (MoliyaKorsatkichlari).
                            Ilgari bu yerda to'lovlar ro'yxati va 441 o'quvchining
                            balansi ham turardi — ular "To'lovlar" bo'limi va
                            O'quvchilar sahifasida bor, bu yerda takror edi. */}
                        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
                            <div className="xl:col-span-3 bg-sirt rounded-xl border border-chiziq p-5">
                                <p className="text-[14px] font-semibold text-matn mb-4">Oylik tushum <span className="text-[12px] font-normal text-matn-sokin">· so'nggi 6 oy</span></p>
                                <LineChart data={metrics.trendLine} color="var(--color-brand)" height={168} />
                            </div>
                            <div className="xl:col-span-2 bg-sirt rounded-xl border border-chiziq p-5">
                                <p className="text-[14px] font-semibold text-matn mb-4">Xarajat turlari <span className="text-[12px] font-normal text-matn-sokin">· {dateLabel}</span></p>
                                {metrics.catBars.length > 0
                                    ? <BarChart data={metrics.catBars} horizontal />
                                    : <p className="text-[12px] text-matn-xira text-center py-6">Bu davrda xarajat yo'q</p>
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── OYLIK NAZORAT TAB ──────────────────────────────────── */}
                {/* Oy hisobi: kurslar jadvali (kim qancha, qancha yopildi), bosilsa —
                    o'sha kursning o'quvchilari; o'quvchilar qidiruv va sahifa bilan.
                    Ilgari hamma o'quvchi bitta lenta bo'lib chiqardi (sahifa 27 000 px). */}
                {activeTab === 'billing' && kora('moliya.oylik') && (() => {
                    const bd = billingData;
                    const qidiruvKichik = nazoratQidiruv.trim().toLowerCase();
                    const qidiruvRaqam = qidiruvKichik.replace(/\D/g, '');
                    const hisobli = bd ? bd.students.filter((st: any) => st.status !== 'none') : [];
                    const jamiHisob = hisobli.reduce((s2: number, st: any) => s2 + st.expected, 0);
                    const jamiYopilgan = hisobli.reduce((s2: number, st: any) => s2 + st.paid, 0);
                    const tolagan = hisobli.filter((st: any) => st.status === 'paid').length;
                    const yopildiFoiz = jamiHisob > 0 ? Math.round((jamiYopilgan / jamiHisob) * 100) : null;
                    const royxat = hisobli
                        .filter((st: any) => billingFilter === 'all' || st.status === billingFilter)
                        .filter((st: any) => !nazoratKurs || st.groups.some((g: any) => g.groupId === nazoratKurs))
                        .filter((st: any) => !qidiruvKichik
                            || (st.name || '').toLowerCase().includes(qidiruvKichik)
                            || (!!st.kod && String(st.kod).startsWith(qidiruvKichik))
                            || (qidiruvRaqam.length >= 4 && (st.phone || '').replace(/\D/g, '').includes(qidiruvRaqam)))
                        .sort((a: any, b: any) => (b.expected - b.paid) - (a.expected - a.paid) || String(a.name).localeCompare(String(b.name)));
                    const SAHIFA = 25;
                    const sahifalar = Math.max(1, Math.ceil(royxat.length / SAHIFA));
                    const sahifa = Math.min(nazoratSahifa, sahifalar - 1);
                    const korinadi = royxat.slice(sahifa * SAHIFA, (sahifa + 1) * SAHIFA);
                    const kurslar = bd ? bd.groups.filter((g: any) => g.expected > 0 || g.totalStudents > 0)
                        .sort((a: any, b: any) => (b.expected - b.actual) - (a.expected - a.actual)) : [];
                    const tanlanganKurs = nazoratKurs ? kurslar.find((g: any) => g.groupId === nazoratKurs) : null;
                    const holatNomi: Record<string, string> = { paid: "To'lagan", partial: 'Qisman', unpaid: "To'lamagan" };
                    return (
                    <div className="p-4 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-[15px] font-semibold text-matn">{billingMonthLabel(billingMonth)} hisobi</h3>
                                <p className="text-[12px] text-matn-sokin mt-0.5">
                                    {!bd ? '…' : bd.billingDone
                                        ? "Oylik hisob yozilgan — kim qancha to'lagani pastda"
                                        : "Hali yozilmagan" + (bd.billingDay ? " — har oyning " + bd.billingDay + "-kunida o'zi yoziladi" : '')}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 bg-ichki p-1 rounded-xl border border-chiziq">
                                <button onClick={() => { prevBillingMonth(); setNazoratSahifa(0); }} aria-label="Oldingi oy"
                                    disabled={!!bd?.birinchiOy && billingMonth <= bd.birinchiOy}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-sirt transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default">
                                    <ChevronLeft size={14} className="text-matn-sokin" />
                                </button>
                                <span className="text-[12px] font-semibold text-matn min-w-[110px] text-center">{billingMonthLabel(billingMonth)}</span>
                                <button onClick={() => { nextBillingMonth(); setNazoratSahifa(0); }} aria-label="Keyingi oy"
                                    disabled={!!bd?.joriyOy && billingMonth >= bd.joriyOy}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-sirt transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default">
                                    <ChevronRight size={14} className="text-matn-sokin" />
                                </button>
                            </div>
                        </div>

                        {billingLoading && !bd && (
                            <div className="py-16 text-center">
                                <RefreshCw size={24} className="animate-spin text-brand mx-auto mb-2" />
                                <p className="text-[12px] text-matn-xira">Yuklanmoqda…</p>
                            </div>
                        )}

                        {bd && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {[
                                    { nom: 'Hisoblangan', qiymat: jamiHisob.toLocaleString('ru-RU'), izoh: hisobli.length + " ta o'quvchi", ton: 'text-matn' },
                                    { nom: 'Yopilgan', qiymat: jamiYopilgan.toLocaleString('ru-RU'), izoh: yopildiFoiz !== null ? yopildiFoiz + "% — to'lov yoki avansdan" : '—', ton: 'text-yaxshi' },
                                    { nom: 'Qoldi', qiymat: (jamiHisob - jamiYopilgan).toLocaleString('ru-RU'), izoh: (hisobli.length - tolagan) + " ta to'liq to'lamagan", ton: jamiHisob - jamiYopilgan > 0 ? 'text-xato' : 'text-matn' },
                                    { nom: "To'lagan", qiymat: tolagan + ' / ' + hisobli.length, izoh: "hisobini to'liq yopgan", ton: 'text-matn' },
                                ].map(k => (
                                    <div key={k.nom} className="rounded-xl border border-chiziq bg-sirt px-3.5 py-3 min-w-0">
                                        <span className="text-[12px] text-matn-sokin block">{k.nom}</span>
                                        <span className={"raqam text-[20px] font-semibold leading-tight block mt-1 truncate " + k.ton}>{k.qiymat}</span>
                                        <span className="text-[11px] text-matn-xira block mt-1.5 truncate">{k.izoh}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {bd && kurslar.length > 0 && (
                            <div className="bg-sirt rounded-xl border border-chiziq overflow-hidden">
                                <p className="px-4 pt-3.5 pb-2.5 text-[14px] font-semibold text-matn">Kurslar bo'yicha <span className="text-[12px] font-normal text-matn-sokin">· bosing — o'sha kurs o'quvchilari</span></p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-y border-chiziq-mayin">
                                                <th className="px-4 py-2 text-[12px] font-normal text-matn-sokin">Kurs</th>
                                                <th className="hidden sm:table-cell px-3 py-2 text-[12px] font-normal text-matn-sokin text-right">Hisoblangan</th>
                                                <th className="hidden sm:table-cell px-3 py-2 text-[12px] font-normal text-matn-sokin text-right">Yopilgan</th>
                                                <th className="px-3 py-2 text-[12px] font-normal text-matn-sokin text-right">Qoldi</th>
                                                <th className="px-4 py-2 text-[12px] font-normal text-matn-sokin text-right">To'lamagan</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-chiziq-mayin">
                                            {kurslar.map((g: any) => {
                                                const qoldi = g.expected - g.actual;
                                                const tanlangan = nazoratKurs === g.groupId;
                                                return (
                                                    <tr key={g.groupId} onClick={() => { setNazoratKurs(tanlangan ? null : g.groupId); setNazoratSahifa(0); }}
                                                        className={"cursor-pointer transition-colors " + (tanlangan ? 'bg-brand/10' : 'hover:bg-ichki')}>
                                                        <td className="px-4 py-2.5">
                                                            {/* Telefonda "Matematika-1" chiziqchada bo'linmasin. */}
                                                            <p className="text-[13px] text-matn">{String(g.groupName).replace(/-/g, '‑')}</p>
                                                            <p className="text-[11px] text-matn-xira">{g.totalStudents} o'quvchi</p>
                                                        </td>
                                                        <td className="hidden sm:table-cell px-3 py-2.5 raqam text-[13px] text-matn-2 text-right">{g.expected ? g.expected.toLocaleString('ru-RU') : '—'}</td>
                                                        <td className="hidden sm:table-cell px-3 py-2.5 raqam text-[13px] text-yaxshi text-right">{g.actual ? g.actual.toLocaleString('ru-RU') : '—'}</td>
                                                        <td className={"px-3 py-2.5 raqam text-[13px] text-right " + (qoldi > 0 ? 'text-xato' : 'text-matn-xira')}>{qoldi > 0 ? qoldi.toLocaleString('ru-RU') : '0'}</td>
                                                        <td className={"px-4 py-2.5 raqam text-[13px] text-right " + (g.unpaidCount > 0 ? 'text-xato' : 'text-matn-xira')}>{g.unpaidCount}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {bd && (
                            <div className="bg-sirt rounded-xl border border-chiziq overflow-hidden">
                                <div className="px-4 pt-3.5 pb-3 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-[14px] font-semibold text-matn">
                                            O'quvchilar <span className="text-[12px] font-normal text-matn-sokin">· {royxat.length} ta</span>
                                        </p>
                                        {tanlanganKurs && (
                                            <button onClick={() => { setNazoratKurs(null); setNazoratSahifa(0); }}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand/10 text-brand text-[12px] cursor-pointer">
                                                {tanlanganKurs.groupName} <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="relative flex-1">
                                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
                                            <input value={nazoratQidiruv} onChange={e => { setNazoratQidiruv(e.target.value); setNazoratSahifa(0); }}
                                                placeholder="Ism, ID yoki telefon…"
                                                className="w-full pl-8 pr-3 py-2 bg-ichki border border-chiziq rounded-lg text-[12px] text-matn outline-none focus:border-brand" />
                                        </div>
                                        <div className="flex items-center gap-1 bg-ichki p-1 rounded-lg border border-chiziq overflow-x-auto no-scrollbar">
                                            {(['all', 'unpaid', 'partial', 'paid'] as const).map(f => (
                                                <button key={f} onClick={() => { setBillingFilter(f); setNazoratSahifa(0); }}
                                                    className={"px-2.5 py-1 rounded-md text-[12px] whitespace-nowrap transition-colors cursor-pointer " + (billingFilter === f ? 'bg-brand text-brand-ust font-semibold' : 'text-matn-sokin hover:text-matn')}>
                                                    {f === 'all' ? 'Hammasi' : holatNomi[f]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-y border-chiziq-mayin">
                                                <th className="px-4 py-2 text-[12px] font-normal text-matn-sokin">O'quvchi</th>
                                                <th className="hidden md:table-cell px-3 py-2 text-[12px] font-normal text-matn-sokin">Kurslar</th>
                                                <th className="hidden sm:table-cell px-3 py-2 text-[12px] font-normal text-matn-sokin text-right">Hisoblangan</th>
                                                <th className="hidden sm:table-cell px-3 py-2 text-[12px] font-normal text-matn-sokin text-right">Yopilgan</th>
                                                <th className="px-4 py-2 text-[12px] font-normal text-matn-sokin text-right">Qoldi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-chiziq-mayin">
                                            {korinadi.length === 0 ? (
                                                <tr><td colSpan={5} className="py-10 text-center text-[12px] text-matn-xira">Hech kim topilmadi</td></tr>
                                            ) : korinadi.map((st: any) => {
                                                const qoldi = st.expected - st.paid;
                                                return (
                                                    <tr key={st.studentId} onClick={() => navigate('/students/' + st.studentId)}
                                                        className="hover:bg-ichki cursor-pointer transition-colors">
                                                        <td className="px-4 py-2.5">
                                                            <p className="text-[13px] text-matn">{displayName(st.name)}</p>
                                                            <p className="raqam text-[11px] text-matn-xira">{[st.kod ? 'ID ' + st.kod : null, st.phone].filter(Boolean).join(' · ')}</p>
                                                        </td>
                                                        <td className="hidden md:table-cell px-3 py-2.5 text-[12px] text-matn-sokin">{st.groups.map((g: any) => g.groupName).join(', ')}</td>
                                                        <td className="hidden sm:table-cell px-3 py-2.5 raqam text-[13px] text-matn-2 text-right">{st.expected.toLocaleString('ru-RU')}</td>
                                                        <td className="hidden sm:table-cell px-3 py-2.5 raqam text-[13px] text-yaxshi text-right">{st.paid.toLocaleString('ru-RU')}</td>
                                                        <td className="px-4 py-2.5 text-right">
                                                            <span className={"raqam text-[13px] " + (qoldi > 0 ? 'text-xato' : 'text-matn-xira')}>{qoldi > 0 ? qoldi.toLocaleString('ru-RU') : '0'}</span>
                                                            <span className={"block text-[10px] " + (st.status === 'paid' ? 'text-yaxshi' : st.status === 'partial' ? 'text-ogoh' : 'text-xato')}>{holatNomi[st.status]}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {sahifalar > 1 && (
                                    <div className="flex items-center justify-between px-4 py-3 border-t border-chiziq-mayin">
                                        <span className="raqam text-[12px] text-matn-xira">{sahifa * SAHIFA + 1}–{Math.min(royxat.length, (sahifa + 1) * SAHIFA)} / {royxat.length}</span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setNazoratSahifa(sahifa - 1)} disabled={sahifa === 0}
                                                className="px-3 py-1 text-[12px] border border-chiziq rounded-lg disabled:opacity-30 hover:bg-ichki cursor-pointer">Oldingi</button>
                                            <button onClick={() => setNazoratSahifa(sahifa + 1)} disabled={sahifa >= sahifalar - 1}
                                                className="px-3 py-1 text-[12px] border border-chiziq rounded-lg disabled:opacity-30 hover:bg-ichki cursor-pointer">Keyingi</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {ozgartira('moliya.oylik') && bd && hisobli.some((st: any) => st.status !== 'paid') && (
                            <div className="flex justify-end">
                                <button onClick={() => setShowDebtNotifyModal(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-[12px] font-semibold transition-colors cursor-pointer">
                                    <MessageSquare size={14} />
                                    Qarzdorlarga eslatma yuborish
                                </button>
                            </div>
                        )}

                        {!bd && !billingLoading && (
                            <div className="py-16 text-center">
                                <Calendar size={32} className="text-matn-xira mx-auto mb-3" />
                                <p className="text-[12px] text-matn-xira">Ma'lumot yuklanmadi</p>
                                <button onClick={loadBillingStatus} className="mt-3 text-[12px] text-brand hover:underline cursor-pointer">Qayta urinish</button>
                            </div>
                        )}
                    </div>
                    );
                })()}

                {activeTab === 'kassa' && kora('moliya.kassa') && <KassaPanel />}
                {activeTab === 'varaq' && <MoliyaVaraqlari />}

                {/* Usul tugmalari (Naqd, Karta, Klik, Payme …) — soni bilan. */}
                {activeTab === 'payments' && (
                    <div className="px-6 pt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {[{ tur: 'all', nom: 'Hammasi' }, ...TOLOV_USULLARI].map(u => {
                            const x = u.tur === 'all' ? null : usulSanoq.get(u.tur);
                            if (u.tur !== 'all' && !x) return null;
                            return (
                                <button key={u.tur} onClick={() => { setUsulFiltr(u.tur); setListLimit(100); }}
                                    className={`px-3 py-1.5 rounded-lg text-[12px] whitespace-nowrap border transition-colors cursor-pointer ${usulFiltr === u.tur ? 'bg-brand text-brand-ust border-brand font-semibold' : 'bg-sirt border-chiziq text-matn-sokin hover:text-matn'}`}>
                                    {u.nom}{x && <span className="raqam opacity-70"> · {x.soni}</span>}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Summary row — only for payments/expenses */}
                {(activeTab === 'payments' || activeTab === 'expenses') && (
                    <div className="px-6 py-3 border-b border-chiziq-mayin/30 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-[12px] text-matn-sokin">{dateLabel}</span>
                        {activeTab === 'payments' ? (
                            <>
                                <span className="text-[12px] text-matn-sokin">{filteredPayments.length} ta to'lov</span>
                                <span className="raqam text-[13px] font-semibold text-yaxshi ml-auto">+{filteredRevenue.toLocaleString('ru-RU')}</span>
                            </>
                        ) : (
                            <>
                                <span className="text-[12px] text-matn-sokin">{filteredExpenses.length} ta xarajat</span>
                                <span className="raqam text-[13px] font-semibold text-xato ml-auto">−{filteredExpenditure.toLocaleString('ru-RU')}</span>
                            </>
                        )}
                        <button
                            onClick={() => activeTab === 'payments'
                                ? downloadCSV(`tolovlar_${startDate}_${endDate}.csv`, filteredPayments.map(p => {
                                    const st = students.find(x => x.id === p.studentId);
                                    return { "O'quvchi": st?.name || '', 'ID': st?.kod || '', 'Summa': p.amount, 'Usul': usulNomi(p.type), 'Sana': p.date, 'Izoh': p.description || '' };
                                }))
                                : downloadCSV(`xarajatlar_${startDate}_${endDate}.csv`, filteredExpenses.map(e => ({
                                    'Turi': e.category, 'Summa': e.amount, 'Usul': e.method || 'Naqd', 'Sana': e.date, 'Izoh': e.description || '',
                                })))}
                            disabled={activeTab === 'payments' ? !filteredPayments.length : !filteredExpenses.length}
                            className="flex items-center gap-1 px-2.5 py-1 border border-chiziq rounded-lg text-[12px] text-matn-sokin hover:text-brand hover:border-brand disabled:opacity-40 cursor-pointer transition-colors">
                            <ArrowUpRight size={12} /> Excel (CSV)
                        </button>
                    </div>
                )}

                {/* List */}
                {(activeTab === 'payments' || activeTab === 'expenses') && (
                    <div className="divide-y divide-chiziq-mayin">
                        {activeTab === 'payments' ? (
                            filteredPayments.length === 0 ? (
                                <p className="text-center py-12 text-[12px] text-matn-xira">To'lovlar topilmadi</p>
                            ) : filteredPayments.slice(0, listLimit).map(p => {
                                const student = students.find(s => s.id === p.studentId);
                                return (
                                    <div key={p.id}
                                        onClick={() => student && navigate(`/students/${student.id}`)}
                                        className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50/70 dark:hover:bg-gray-900/40 transition-all cursor-pointer group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center shrink-0">
                                                <DollarSign size={14} className="text-emerald-600 dark:text-emerald-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[13px] text-matn truncate">
                                                    {student ? displayName(student.name) : "Noma'lum"}
                                                    {student?.kod && <span className="raqam text-[11px] text-matn-xira"> · ID {student.kod}</span>}
                                                </p>
                                                <span className="text-[11px] text-matn-xira block mt-0.5 truncate">
                                                    <span className="raqam">{p.date.split('-').reverse().join('.')}</span> · {usulNomi(p.type)}{p.description ? ` · ${p.description}` : ''}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="raqam text-[13px] font-semibold text-yaxshi">+{p.amount.toLocaleString('ru-RU')}</span>
                                            {/* Tahrirlash: resepshn — kiritgandan keyin 10 daqiqa,
                                                administrator — har doim (egasi, 2026-09-22). */}
                                            {canEditPayment(p, user?.role, ozgartira('oquvchilar.tolovTuzatish')) && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); setEditingPayment(p); }}
                                                    title="To'lovni tahrirlash"
                                                    className="w-7 h-7 rounded-lg text-gray-300 hover:text-brand hover:bg-brand/10 flex items-center justify-center transition-colors cursor-pointer"
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                            )}
                                            <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            filteredExpenses.length === 0 ? (
                                <p className="text-center py-12 text-[11px] text-matn-xira font-bold">Xarajatlar topilmadi</p>
                            ) : filteredExpenses.map(e => (
                                <div key={e.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50/70 dark:hover:bg-gray-900/40 transition-all">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 flex items-center justify-center shrink-0">
                                            <TrendingDown size={14} className="text-rose-500 dark:text-rose-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-matn truncate">
                                                {e.category}
                                                {e.category === 'Ish haqi' && (e as any).staffName && (
                                                    <span className="ml-1.5 text-[11px] font-bold text-rose-500 normal-case tracking-normal">
                                                        — {(e as any).staffName}
                                                    </span>
                                                )}
                                            </p>
                                            <span className="text-[11px] text-matn-xira block mt-0.5 truncate">
                                                <span className="raqam">{e.date.split('-').reverse().join('.')}</span> · {e.method === 'Karta' || e.method === "O'tkazma" ? `${e.method} (bankdan)` : 'Naqd (kassadan)'}{e.description ? ` · ${e.description}` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="raqam text-[13px] font-semibold text-xato">−{e.amount.toLocaleString('ru-RU')}</span>
                                        {ozgartira('moliya.xarajat') && (
                                            <XarajatOchirishTugmasi createdAt={e.createdAt}
                                                onDelete={async () => { if (await confirm(`Xarajat o'chirilsinmi?

${e.description || e.category} — ${Number(e.amount).toLocaleString()} so'm`)) deleteExpense(e.id); }} />
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        {activeTab === 'payments' && filteredPayments.length > listLimit && (
                            <div className="px-6 py-3 text-center">
                                <button onClick={() => setListLimit(n => n + 100)}
                                    className="px-4 py-2 border border-chiziq rounded-lg text-[12px] text-matn-sokin hover:text-brand hover:border-brand cursor-pointer transition-colors">
                                    Yana ko'rsatish · <span className="raqam">{filteredPayments.length - listLimit}</span> ta qoldi
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {editingPayment && (
                <PaymentEditModal
                    payment={editingPayment}
                    onClose={() => setEditingPayment(null)}
                    onSaved={() => retryLoad()}
                />
            )}

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={closePaymentModal} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-md p-8 overflow-hidden">

                        {createdPaymentForReceipt ? (
                            <div className="space-y-6">
                                <div className="text-center space-y-1">
                                    {settings?.logo && (
                                        <img src={settings.logo} alt="" className="w-14 h-14 object-contain mx-auto mb-2" />
                                    )}
                                    <h3 className="text-sm font-black text-brand">{settings?.orgName || "O'QUV MARKAZI"}</h3>
                                    <p className="text-[11px] font-bold text-matn-xira">TO'LOV CHEKI (RECEIPT)</p>
                                </div>
                                <div className="bg-ichki/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750 font-mono text-xs text-gray-800 dark:text-gray-300 space-y-4 shadow-inner">
                                    <div className="border-b border-dashed border-gray-300 dark:border-gray-800 pb-3 space-y-1">
                                        <div className="flex justify-between"><span>Chek #</span><span className="font-black">#{createdPaymentForReceipt.id}</span></div>
                                        <div className="flex justify-between"><span>Sana:</span><span className="font-semibold">{createdPaymentForReceipt.date}</span></div>
                                    </div>
                                    <div className="space-y-2">
                                        <div>
                                            <span className="text-[11px] text-matn-xira block">O'quvchi:</span>
                                            <span className="font-black text-matn text-[13px]">{selectedStudent?.name}</span>
                                        </div>
                                        {selectedStudent?.phone && (
                                            <div><span className="text-[11px] text-matn-xira block">Telefon:</span><span>{selectedStudent.phone}</span></div>
                                        )}
                                        {(() => {
                                            const sg = groups.filter(g => (g.studentIds || []).includes(selectedStudent?.id));
                                            if (!sg.length) return null;
                                            return (
                                                <div>
                                                    <span className="text-[11px] text-matn-xira block">Kurslar:</span>
                                                    <div className="font-semibold">{sg.map(g => {
                                                        const cn = courses.find(c => c.id === g.courseId)?.name || '';
                                                        return <div key={g.id}>- {g.name}{cn && ` (${cn})`}</div>;
                                                    })}</div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="border-t border-dashed border-gray-300 dark:border-gray-800 pt-3 space-y-1.5">
                                        {createdPaymentForReceipt.courseId && (
                                            <div className="flex justify-between text-[13px]">
                                                <span className="font-bold">Kurs uchun:</span>
                                                <span className="font-black text-right">
                                                    {courses.find(c => c.id === createdPaymentForReceipt.courseId)?.name || ''}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-[13px]">
                                            <span className="font-bold">To'lov turi:</span>
                                            <span className="font-black">{createdPaymentForReceipt.type}</span>
                                        </div>
                                        <div className="flex justify-between text-base">
                                            <span className="font-bold text-brand">To'landi:</span>
                                            <span className="font-black text-emerald-600 tabular-nums">+{createdPaymentForReceipt.amount.toLocaleString()} UZS</span>
                                        </div>
                                        <div className="flex justify-between text-[13px]">
                                            <span className="font-bold">Joriy balans:</span>
                                            <span className={`font-black tabular-nums ${(selectedStudent?.balance || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {(selectedStudent?.balance || 0).toLocaleString()} UZS
                                            </span>
                                        </div>
                                    </div>
                                    <div className="border-t border-dashed border-gray-300 dark:border-gray-800 pt-3 text-center text-[11px] text-matn-xira font-bold">
                                        To'lovingiz uchun rahmat!
                                    </div>
                                </div>
                                {/* Ota-onaga SMS ketdimi — kassir darhol ko'radi. */}
                                <TolovXabarQatori xabar={createdPaymentForReceipt.xabar} />
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => handlePrintReceipt(createdPaymentForReceipt, selectedStudent)}
                                        className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer shadow-sm shadow-[#1b6b6b]/20 text-center">
                                        Chop etish (Print)
                                    </button>
                                    <button type="button" onClick={closePaymentModal}
                                        className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer hover:bg-gray-200">
                                        Yopish
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq-mayin/50">
                                    <div>
                                        <h3 className="text-lg font-black text-matn tracking-tight">Yangi Kirim</h3>
                                        <p className="text-[11px] font-bold text-brand mt-0.5">To'lov qabul qilish</p>
                                    </div>
                                    <button onClick={closePaymentModal} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer" aria-label="Yopish"><X size={18} /></button>
                                </div>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    // Guard against a second submit: on a slow phone the first tap can
                                    // still be in flight, and two taps used to mean two payments.
                                    if (!selectedStudent || isSavingPayment) return;
                                    // Pul faqat balansga: bitta yozuv, kursga bog'lanmaydi.
                                    const summa = Math.round(Number(payAmount) || 0);
                                    if (summa <= 0) { showNotification('Summani kiriting', 'error'); return; }
                                    const klik = TASDIQ_TURLARI.includes(newPayment.type);
                                    const admin = isAdminRole(user?.role);
                                    if (klik && !admin && !klikVaqt) { showNotification("Chekdagi kun va soatni kiriting (masalan 2206 → 22:06)", 'error'); return; }
                                    setIsSavingPayment(true);
                                    try {
                                        // Klik — administrator tasdig'iga (balansga hali tushmaydi).
                                        if (klik && !admin) {
                                            const yuborildi = await klikniYuborish({
                                                schoolId: selectedSchoolId, studentId: selectedStudent.id, amount: summa,
                                                type: newPayment.type, paidAt: klikVaqt, receipt: klikChek, note: newPayment.description || '',
                                            });
                                            window.dispatchEvent(new Event(TASDIQ_HODISASI));
                                            const n = yuborishNatijasi(newPayment.type, yuborildi);
                                            showNotification(n.matn, n.tur);
                                            closePaymentModal();
                                            return;
                                        }
                                        const saved: any = await addPayment({
                                            studentId: selectedStudent.id,
                                            amount: summa,
                                            type: newPayment.type,
                                            description: [klik && klikVaqt ? `Chek: ${chekVaqti(klikVaqt)}` : '', newPayment.description || ''].filter(Boolean).join(' · '),
                                            groupId: null,
                                            courseId: null,
                                            date: klik && klikVaqt ? klikVaqt.slice(0, 10) : newPayment.date,
                                            // Administrator kiritgan Klik cheki ham takror tekshiruviga yoziladi.
                                            ...(klik && klikVaqt ? { chekVaqti: klikVaqt } : {}),
                                        } as any);
                                        if (saved?.takror?.length) showNotification(`Diqqat — takror chek: ${saved.takror[0]}`, 'error');
                                        setCreatedPaymentForReceipt(saved);
                                    } catch (err: any) {
                                        showNotification("To'lovni saqlab bo'lmadi: " + (err?.message || "noma'lum xatolik"), 'error');
                                    } finally {
                                        setIsSavingPayment(false);
                                    }
                                }} className="space-y-4">
                                    {!selectedStudent ? (
                                        <div className="relative">
                                            <label className={lbl}>O'quvchini qidirish *</label>
                                            <input type="text" placeholder="Ism yoki telefon raqami..." className={inp}
                                                value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
                                            {studentSearch.trim() !== '' && (
                                                <div className="absolute z-[210] left-0 right-0 mt-1 bg-sirt border border-chiziq rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-750">
                                                    {students.filter(s =>
                                                        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                                        (s.phone && s.phone.includes(studentSearch)) ||
                                                        (!!s.kod && /^\d{3,5}$/.test(studentSearch.trim()) && String(s.kod).startsWith(studentSearch.trim()))
                                                    ).slice(0, 6).map(s => (
                                                        <button key={s.id} type="button"
                                                            onClick={() => { setSelectedStudent(s); setStudentSearch(''); }}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-xs font-bold text-matn flex flex-col cursor-pointer transition-colors">
                                                            <span>{s.name}</span>
                                                            {s.phone && <span className="text-[11px] text-matn-xira font-bold mt-0.5">{s.phone}</span>}
                                                        </button>
                                                    ))}
                                                    {students.filter(s =>
                                                        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                                        (s.phone && s.phone.includes(studentSearch)) ||
                                                        (!!s.kod && /^\d{3,5}$/.test(studentSearch.trim()) && String(s.kod).startsWith(studentSearch.trim()))
                                                    ).length === 0 && (
                                                        <div className="px-4 py-4 text-center text-[11px] text-matn-xira font-bold">O'quvchi topilmadi</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-ichki rounded-2xl border border-chiziq/80 relative space-y-3">
                                            <button type="button"
                                                onClick={() => { setSelectedStudent(null); setNewPayment({ ...newPayment, studentId: 0, courseId: null }); }}
                                                className="absolute top-3.5 right-3.5 text-[11px] text-rose-500 font-bold hover:underline cursor-pointer bg-sirt px-2.5 py-1 rounded-lg border border-chiziq">
                                                O'zgartirish
                                            </button>
                                            <div>
                                                <span className="text-[10px] font-bold text-brand block">Tanlangan o'quvchi</span>
                                                <h4 className="text-xs font-bold text-matn mt-0.5">{selectedStudent.name}</h4>
                                                {selectedStudent.phone && <p className="text-[11px] text-matn-xira font-bold mt-0.5">{selectedStudent.phone}</p>}
                                                {/* Ota-ona raqami: to'lovni so'rash/tasdiqlash uchun qo'ng'iroq qilinadi. */}
                                                {([['Otasi', selectedStudent.fatherName, selectedStudent.fatherPhone], ['Onasi', selectedStudent.motherName, selectedStudent.motherPhone]] as const)
                                                    .filter(([, , tel]) => !!tel)
                                                    .map(([kim, ism, tel]) => (
                                                        <p key={kim} className="text-[11px] text-matn-xira mt-0.5">
                                                            <span className="font-bold">{kim}:</span> <span className="font-bold tabular-nums">{tel}</span>{ism ? ` · ${ism}` : ''}
                                                        </p>
                                                    ))}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed border-chiziq/50">
                                                <div>
                                                    <span className="text-[10px] font-bold text-matn-xira block">Joriy Balans</span>
                                                    <span className={`text-[12px] font-bold block mt-0.5 tabular-nums ${selectedStudent.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {selectedStudent.balance.toLocaleString()} UZS
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-matn-xira block">Oxirgi to'lov</span>
                                                    {(() => {
                                                        const sp = payments.filter(p => p.studentId === selectedStudent.id && isCashIncome(p));
                                                        const lp = sp.length > 0 ? sp[sp.length - 1] : null;
                                                        return lp
                                                            ? <span className="text-[11px] font-bold text-matn-2 block mt-0.5 tabular-nums">{lp.amount.toLocaleString()} UZS ({lp.date})</span>
                                                            : <span className="text-[11px] text-matn-xira italic block mt-0.5">Mavjud emas</span>;
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-dashed border-chiziq/50">
                                                <span className="text-[10px] font-bold text-matn-xira block">Kurslar</span>
                                                {(() => {
                                                    const sg = groups.filter(g => (g.studentIds || []).includes(selectedStudent.id));
                                                    return sg.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {sg.map(g => {
                                                                const cn = courses.find(c => c.id === g.courseId)?.name || '';
                                                                return (
                                                                    <span key={g.id} className="px-2 py-0.5 bg-sirt text-[10px] font-bold text-brand border border-teal-100/50 dark:border-teal-900/40 rounded-md">
                                                                        {g.name}{cn && ` (${cn})`}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : <span className="text-[11px] text-matn-xira italic block mt-0.5">Kurslarga a'zo emas</span>;
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    {/* Pul faqat balansga (egasi, 2026-09-23): bitta summa, kurs
                                        so'ralmaydi. Avval qarz yopiladi — kurslarga o'quvchining
                                        "Balans taqsimoti" bo'yicha (standart teng), qolgani balansda. */}
                                    {selectedStudent && (
                                        <div>
                                            <label className={lbl}>Summa *</label>
                                            <input type="number" min={0} placeholder="500 000" className={inp}
                                                value={payAmount}
                                                onChange={e => setPayAmount(e.target.value)} />
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {payJamiQarz > 0 && (
                                                    <button type="button"
                                                        onClick={() => setPayAmount(String(payJamiQarz))}
                                                        className="px-2.5 py-1 text-[10px] font-bold border border-rose-200 dark:border-rose-900/50 text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer">
                                                        Jami qarzni yopish · {payJamiQarz.toLocaleString()}
                                                    </button>
                                                )}
                                                {[300000, 500000, 700000, 1000000].map(amt => (
                                                    <button key={amt} type="button"
                                                        onClick={() => setPayAmount(String(amt))}
                                                        className="px-2.5 py-1 text-[10px] font-bold border border-chiziq text-matn-sokin rounded-lg hover:border-brand hover:text-brand transition-colors cursor-pointer">
                                                        {amt.toLocaleString()}
                                                    </button>
                                                ))}
                                            </div>
                                            {payLedgerLoading && (
                                                <p className="text-[11px] text-matn-xira font-bold pt-3">Hisob yuklanmoqda…</p>
                                            )}
                                            {payKursRows.length > 0 && (
                                                <div className="mt-3 p-3 bg-ichki/50 border border-chiziq rounded-2xl space-y-1.5">
                                                    {payKursRows.map(row => (
                                                        <div key={row.key} className="flex items-center justify-between gap-3">
                                                            <span className="text-[11px] font-bold text-matn truncate">{row.title}</span>
                                                            <span className="num text-[11px] font-black shrink-0">
                                                                {row.debt > 0
                                                                    ? <span className="text-rose-500">qarz {row.debt.toLocaleString()}</span>
                                                                    : <span className="text-emerald-600">qarz yo'q{row.paidUntil ? ` · ${row.paidUntil} gacha` : ''}</span>}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <p className="text-[10px] font-bold text-matn-xira mt-2 leading-relaxed">
                                                Pul <span className="text-matn">balansga</span> tushadi — avval qarz yopiladi, qolgani balansda turadi.
                                                {kopKurs && <> Kurslarga: <span className="text-brand">{qoidaYozuvi}</span> (o'quvchi kartochkasida o'zgartiriladi).</>}
                                            </p>
                                        </div>
                                    )}

                                    <div>
                                        <label className={lbl}>To'lov usuli *</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {['Naqd', 'Karta', "O'tkazma", 'Klik'].map(tType => (
                                                <button key={tType} type="button"
                                                    onClick={() => {
                                                        setNewPayment({ ...newPayment, type: tType as any });
                                                    }}
                                                    className={`py-2.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${newPayment.type === tType ? 'bg-brand border-brand text-white shadow-sm shadow-[#1b6b6b]/20' : 'bg-sirt border-chiziq text-matn-xira hover:bg-gray-50'}`}>
                                                    {tType}
                                                </button>
                                            ))}
                                        </div>
                                        {TASDIQ_TURLARI.includes(newPayment.type) && (
                                            <div className="mt-3">
                                                <KlikChekMaydonlari paidAt={klikVaqt} setPaidAt={setKlikVaqt} receipt={klikChek} setReceipt={setKlikChek}
                                                    admin={isAdminRole(user?.role)} labelCls={lbl} inputCls={inp}
                                                    schoolId={selectedStudent?.schoolId ?? selectedSchoolId} studentId={selectedStudent?.id} amount={Math.round(Number(payAmount) || 0)} />
                                            </div>
                                        )}
                                        {paymeOn && (
                                            <button type="button" disabled={!selectedStudent}
                                                onClick={() => selectedStudent && setPaymeFor(selectedStudent.id)}
                                                title={selectedStudent ? "Payme havola yoki QR yaratish" : "Avval o'quvchini tanlang"}
                                                className="mt-2 w-full py-2.5 rounded-xl text-xs font-extrabold border border-dashed border-brand/60 text-brand hover:bg-brand hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-brand transition-all cursor-pointer">
                                                💳 Payme — havola / QR (to'lov Payme'dan o'zi tushadi)
                                            </button>
                                        )}
                                    </div>

                                    <div>
                                        <label className={lbl}>Izoh (ixtiyoriy)</label>
                                        <input type="text" placeholder="Qo'shimcha izoh..." className={inp}
                                            value={newPayment.description}
                                            onChange={e => setNewPayment({ ...newPayment, description: e.target.value })} />
                                    </div>

                                    <div className="flex gap-3 pt-4 border-t border-chiziq-mayin/50">
                                        <button type="button" onClick={closePaymentModal}
                                            className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                            {t('cancel')}
                                        </button>
                                        <button type="submit" disabled={!selectedStudent || isSavingPayment || payTotal <= 0}
                                            className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold rounded-2xl shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                                            {isSavingPayment ? 'Saqlanmoqda…' : (TASDIQ_TURLARI.includes(newPayment.type) && !isAdminRole(user?.role) ? 'Tasdiqqa yuborish' : t('save'))}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                    {paymeFor && <PaymeLinkModal studentId={paymeFor} onClose={() => setPaymeFor(null)} />}
                </div>
            )}

            {/* Expense Modal */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsExpenseModalOpen(false)} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-md p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq-mayin/50">
                            <div>
                                <h3 className="text-lg font-black text-matn tracking-tight">Yangi Chiqim</h3>
                                <p className="text-[11px] font-bold text-rose-600 mt-0.5">Xarajat kiritish</p>
                            </div>
                            <button aria-label="Yopish" onClick={() => setIsExpenseModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            addExpense(newExpense);
                            setIsExpenseModalOpen(false);
                            setExpenseCustomCat('');
                            setNewExpense({ amount: 0, category: 'Boshqa', description: '', date: new Date().toISOString().split('T')[0], staffId: null, staffName: null });
                        }} className="space-y-4">
                            <div>
                                <label className={lbl}>Kategoriya *</label>
                                <select
                                    className={inp}
                                    value={PRESET_CATS.includes(newExpense.category) ? newExpense.category : '__custom__'}
                                    onChange={e => {
                                        if (e.target.value === '__custom__') {
                                            setNewExpense({ ...newExpense, category: expenseCustomCat });
                                        } else {
                                            setExpenseCustomCat('');
                                            setNewExpense({ ...newExpense, category: e.target.value });
                                        }
                                    }}
                                >
                                    {PRESET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option value="__custom__">O'zim yozaman...</option>
                                </select>
                                {!PRESET_CATS.includes(newExpense.category) && (
                                    <input
                                        type="text"
                                        required
                                        placeholder="Kategoriya nomini kiriting..."
                                        className={`${inp} mt-2`}
                                        value={expenseCustomCat}
                                        onChange={e => {
                                            setExpenseCustomCat(e.target.value);
                                            setNewExpense({ ...newExpense, category: e.target.value });
                                        }}
                                    />
                                )}
                            </div>

                            {/* Ish haqi uchun xodim tanlash */}
                            {newExpense.category === 'Ish haqi' && (
                                <div>
                                    <label className={lbl}>Xodim (kim uchun) *</label>
                                    <select
                                        required
                                        className={inp}
                                        value={newExpense.staffId ?? ''}
                                        onChange={e => {
                                            const selected = allStaffList.find(s => String(s.id) === e.target.value);
                                            setNewExpense({ ...newExpense, staffId: selected ? selected.id : null, staffName: selected ? selected.name : null });
                                        }}
                                    >
                                        <option value="">— Xodimni tanlang —</option>
                                        {allStaffList.map(s => (
                                            <option key={`${s.isUser ? 'u' : 't'}_${s.id}`} value={s.id}>
                                                {s.name} ({s.role === 'TEACHER' ? "O'qituvchi" : s.role === 'ADMIN' ? 'Admin' : s.role === 'MANAGER' ? 'Menejer' : s.role === 'DRIVER' ? 'Haydovchi' : s.role === 'TECH_STAFF' ? 'Tex. Xodim' : s.role})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className={lbl}>Summa (UZS) *</label>
                                <input type="number" required placeholder="Masalan: 100 000" className={inp}
                                    value={newExpense.amount || ''}
                                    onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })} />
                            </div>
                            {/* Naqd chiqim kassadan ketadi, karta/o'tkazma — bankdan.
                                Kassadagi naqd qoldiq shunga qarab hisoblanadi. */}
                            <div>
                                <label className={lbl}>Qayerdan to'landi *</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['Naqd', 'Karta', "O'tkazma"] as const).map(m => (
                                        <button key={m} type="button"
                                            onClick={() => setNewExpense({ ...newExpense, method: m })}
                                            className={`py-2.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${(newExpense.method || 'Naqd') === m ? 'bg-rose-500 border-rose-500 text-white shadow-sm' : 'bg-sirt border-chiziq text-matn-xira hover:bg-gray-50'}`}>
                                            {m === 'Naqd' ? 'Naqd (kassadan)' : m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>Sana *</label>
                                <input type="date" required className={inp}
                                    value={newExpense.date}
                                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })} />
                            </div>
                            <div>
                                <label className={lbl}>Izoh / Tafsilotlar</label>
                                <input type="text" placeholder="Batafsil izoh kiritish..." className={inp}
                                    value={newExpense.description}
                                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsExpenseModalOpen(false)}
                                    className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                    {t('cancel')}
                                </button>
                                <button type="submit"
                                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-2xl shadow-lg shadow-rose-600/20 transition-all cursor-pointer">
                                    {t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Qarzdorlarga eslatma: kurslar bo'yicha qarz, oxirgi to'lov, tekshirib
                yuborish (QarzXabari.tsx). Eski oynaning SMS i Eskizdan o'tmasdi. */}
            {showDebtNotifyModal && (
                <QarzdorlarModal schoolId={selectedSchoolId || 0} onClose={() => setShowDebtNotifyModal(false)} />
            )}
        </div>
    );
}
