import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, Wallet,
    Plus, X, Trash2, Search, ChevronRight, BarChart2,
    AlertCircle, CreditCard, ArrowUpRight, Calendar,
    RefreshCw, CheckCircle2, MessageSquare, ChevronLeft, Users
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';
import { Payment, Expense } from '../types';
import { StatCard, BarChart, DonutChart, LineChart } from './reports/shared';

const inp = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

const MONTHS = ['Yan','Fev','Mar','Apr','May','Iyun','Iyul','Avg','Sen','Okt','Noy','Dek'];
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

export default function Finance() {
    const { students, payments, expenses, addPayment, addExpense, deleteExpense, groups, courses, token, selectedSchoolId, teachers } = useCRM();

    // HR users (staff list for salary expense)
    const [hrUsers, setHrUsers] = useState<any[]>([]);
    useEffect(() => {
        if (!token) return;
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).then(d => setHrUsers(Array.isArray(d) ? d : [])).catch(() => {});
    }, [token]);
    const { t } = useLang();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'reports' | 'billing' | 'payments' | 'expenses'>('reports');

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
    const [billingData, setBillingData] = useState<{ billingDone: boolean; students: any[]; groups: any[] } | null>(null);
    const [billingLoading, setBillingLoading] = useState(false);
    const [billingProcessing, setBillingProcessing] = useState(false);
    const [billingFilter, setBillingFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');

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
            else alert(data.error || 'Xatolik yuz berdi');
        } catch { alert('Server bilan aloqa yo\'q'); } finally { setBillingProcessing(false); }
    };

    const billingMonthLabel = (m: string) => {
        const [y, mo] = m.split('-').map(Number);
        return `${MONTHS[mo - 1]} ${y}`;
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
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseCustomCat, setExpenseCustomCat] = useState('');

    // Report table filters
    const [reportFilter, setReportFilter] = useState<'all' | 'thisMonth' | 'lastMonth'>('all');
    const [payPage, setPayPage] = useState(0);
    const [balPage, setBalPage] = useState(0);
    const PAGE_SIZE = 10;

    // Date preset states
    const [selectedPreset, setSelectedPreset] = useState<'this_month' | 'last_30' | 'this_year' | 'all' | 'custom'>('this_month');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const handlePreset = (type: 'this_month' | 'last_30' | 'this_year' | 'all') => {
        setSelectedPreset(type);
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        setEndDate(todayStr);

        if (type === 'this_month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            setStartDate(start.toISOString().split('T')[0]);
        } else if (type === 'last_30') {
            const start = new Date();
            start.setDate(today.getDate() - 30);
            setStartDate(start.toISOString().split('T')[0]);
        } else if (type === 'this_year') {
            const start = new Date(today.getFullYear(), 0, 1);
            setStartDate(start.toISOString().split('T')[0]);
        } else if (type === 'all') {
            setStartDate('2024-01-01');
        }
    };

    // List filters
    const [listSearch, setListSearch] = useState('');

    // Payment modal state
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [createdPaymentForReceipt, setCreatedPaymentForReceipt] = useState<any>(null);
    const [newPayment, setNewPayment] = useState<Omit<Payment, 'id' | 'schoolId'>>({
        studentId: 0, amount: 0, type: 'Naqd', description: '', date: new Date().toISOString().split('T')[0]
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
        const groupLines = studentGroups.map(g => {
            const courseName = courses.find(c => c.id === g.courseId)?.name || '';
            return `<div>- ${g.name}${courseName ? ` (${courseName})` : ''}</div>`;
        }).join('');
        const popup = window.open('', '_blank', 'width=420,height=640');
        if (!popup) return;
        popup.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Chek #${payment.id}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #111; background: #fff; padding: 24px 20px; }
  h2 { font-size: 15px; font-weight: 900; text-align: center; letter-spacing: 2px; text-transform: uppercase; color: #1b6b6b; margin-bottom: 4px; }
  .sub { text-align: center; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-bottom: 18px; }
  .box { border: 1px dashed #ccc; border-radius: 8px; padding: 16px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .row .val { font-weight: 900; }
  .divider { border-top: 1px dashed #ccc; margin: 12px 0; }
  .label { font-size: 9px; text-transform: uppercase; color: #888; display: block; margin-bottom: 2px; }
  .big { font-size: 14px; font-weight: 900; }
  .green { color: #059669; }
  .red { color: #e11d48; }
  .footer { margin-top: 14px; text-align: center; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #aaa; }
  @media print { body { padding: 10px; } }
</style></head><body>
<h2>SARIOSIYO CENTER</h2>
<div class="sub">To'lov cheki (Receipt)</div>
<div class="box">
  <div class="row"><span>Chek #</span><span class="val">#${payment.id}</span></div>
  <div class="row"><span>Sana:</span><span class="val">${payment.date}</span></div>
  <div class="divider"></div>
  <div style="margin-bottom:10px"><span class="label">O'quvchi:</span><div class="big">${student?.name || ''}</div></div>
  ${student?.phone ? `<div style="margin-bottom:10px"><span class="label">Telefon:</span><div>${student.phone}</div></div>` : ''}
  ${groupLines ? `<div style="margin-bottom:10px"><span class="label">Kurslar:</span>${groupLines}</div>` : ''}
  <div class="divider"></div>
  <div class="row"><span>To'lov turi:</span><span class="val">${payment.type}</span></div>
  <div class="row" style="font-size:15px">
    <span style="color:#1b6b6b;font-weight:700">To'landi:</span>
    <span class="val green">+${payment.amount.toLocaleString()} UZS</span>
  </div>
  <div class="row">
    <span>Joriy balans:</span>
    <span class="val ${(student?.balance || 0) >= 0 ? 'green' : 'red'}">${(student?.balance || 0).toLocaleString()} UZS</span>
  </div>
  <div class="divider"></div>
  <div class="footer">To'lovingiz uchun rahmat!</div>
</div>
</body></html>`);
        popup.document.close();
        popup.focus();
        setTimeout(() => { popup.print(); popup.close(); }, 400);
    };

    const closePaymentModal = () => {
        setIsPaymentModalOpen(false);
        setCreatedPaymentForReceipt(null);
        setSelectedStudent(null);
        setStudentSearch('');
        setNewPayment({ studentId: 0, amount: 0, type: 'Naqd', description: '', date: new Date().toISOString().split('T')[0] });
    };

    // ─── Date helpers ─────────────────────────────────────────────
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const dateLabel = selectedPreset === 'this_month'
        ? `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
        : `${startDate} gacha ${endDate}`;

    // ─── Core metrics ─────────────────────────────────────────────
    const metrics = useMemo(() => {
        const posPayments = payments.filter(p => p.amount > 0);

        // Previous period of equal length
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diff = end.getTime() - start.getTime();
        const prevStart = new Date(start.getTime() - diff - 86400000);
        const prevEnd = new Date(start.getTime() - 86400000);
        const prevStartStr = prevStart.toISOString().split('T')[0];
        const prevEndStr = prevEnd.toISOString().split('T')[0];

        const thisMonthRevenue = posPayments.filter(p => p.date >= startDate && p.date <= endDate).reduce((s, p) => s + p.amount, 0);
        const lastMonthRevenue = posPayments.filter(p => p.date >= prevStartStr && p.date <= prevEndStr).reduce((s, p) => s + p.amount, 0);
        const thisMonthExpenses = expenses.filter(e => e.date >= startDate && e.date <= endDate).reduce((s, e) => s + e.amount, 0);
        const lastMonthExpenses = expenses.filter(e => e.date >= prevStartStr && e.date <= prevEndStr).reduce((s, e) => s + e.amount, 0);
        const thisMonthProfit = thisMonthRevenue - thisMonthExpenses;
        const lastMonthProfit = lastMonthRevenue - lastMonthExpenses;
        const thisMonthCount = posPayments.filter(p => p.date >= startDate && p.date <= endDate).length;
        const todayRevenue = posPayments.filter(p => p.date === todayStr).reduce((s, p) => s + p.amount, 0);
        const allTimeRevenue = posPayments.reduce((s, p) => s + p.amount, 0);
        const allTimeExpenses = expenses.reduce((s, e) => s + e.amount, 0);
        const allTimeProfit = allTimeRevenue - allTimeExpenses;
        const avgPayment = posPayments.length ? Math.round(allTimeRevenue / posPayments.length) : 0;

        const revTrend = lastMonthRevenue ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0;
        const expTrend = lastMonthExpenses ? Math.round(((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100) : 0;
        const profTrend = lastMonthProfit ? Math.round(((thisMonthProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100) : 0;

        // Student balances
        const debtors = students.filter(s => s.balance < 0);
        const totalDebt = debtors.reduce((s, st) => s + Math.abs(st.balance), 0);
        const creditors = students.filter(s => s.balance > 0);
        const totalCredit = creditors.reduce((s, st) => s + st.balance, 0);

        // Students who haven't paid in this period (active students = in at least 1 group)
        const activeStudentIds = new Set(groups.flatMap(g => g.studentIds || []));
        const paidThisMonth = new Set(posPayments.filter(p => p.date >= startDate && p.date <= endDate).map(p => p.studentId));
        const unpaidCount = [...activeStudentIds].filter(id => !paidThisMonth.has(id)).length;

        // Payment type breakdown (this period)
        const typeMap: Record<string, number> = {};
        posPayments.filter(p => p.date >= startDate && p.date <= endDate).forEach(p => {
            typeMap[p.type] = (typeMap[p.type] || 0) + p.amount;
        });
        const typeColors: Record<string, string> = { Naqd: '#10b981', Karta: '#0ea5e9', "O'tkazma": '#8b5cf6', Online: '#f59e0b' };
        const typeSlices = Object.entries(typeMap).map(([label, value]) => ({
            label, value, color: typeColors[label] || '#6b7280'
        }));

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

        // Top 5 debtors
        const topDebtors = [...debtors].sort((a, b) => a.balance - b.balance).slice(0, 5);

        return {
            thisMonthRevenue, lastMonthRevenue, thisMonthExpenses, lastMonthExpenses,
            thisMonthProfit, thisMonthCount, todayRevenue, allTimeRevenue, allTimeExpenses,
            allTimeProfit, avgPayment, revTrend, expTrend, profTrend,
            debtors, totalDebt, creditors, totalCredit, unpaidCount,
            typeSlices, catBars, trendBars, trendLine, topDebtors
        };
    }, [payments, expenses, students, groups, startDate, endDate, todayStr]);

    // ─── List filters ─────────────────────────────────────────────
    const filteredPayments = useMemo(() => {
        return payments
            .filter(p => p.amount > 0)
            .filter(p => {
                return p.date >= startDate && p.date <= endDate;
            })
            .filter(p => {
                if (!listSearch.trim()) return true;
                const student = students.find(s => s.id === p.studentId);
                const q = listSearch.toLowerCase();
                return (
                    student?.name.toLowerCase().includes(q) ||
                    student?.phone?.includes(q) ||
                    p.type.toLowerCase().includes(q)
                );
            })
            .slice().reverse();
    }, [payments, startDate, endDate, listSearch, students]);

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
            .slice().reverse();
    }, [expenses, startDate, endDate, listSearch]);

    const filteredRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const filteredExpenditure = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-lg shadow-[#1b6b6b]/20">
                            <DollarSign size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('finance_title')}</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                {t('stat_revenue')} & {t('stat_expenses')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsPaymentModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> {t('add_payment')}
                        </button>
                        <button
                            onClick={() => setIsExpenseModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> {t('add_expense')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Card with Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
                {/* Tab Bar */}
                <div className="px-6 pt-5 pb-4 border-b border-gray-50 dark:border-gray-700/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2 bg-gray-55 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700/50 w-fit">
                        <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'reports' ? 'bg-[#1b6b6b] text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>
                            <BarChart2 size={12} /> Hisobotlar
                        </button>
                        <button onClick={() => setActiveTab('billing')} className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'billing' ? 'bg-violet-600 text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>
                            <Calendar size={12} /> Oylik nazorat
                        </button>
                        <button onClick={() => { setActiveTab('payments'); setListSearch(''); }} className={`px-5 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'payments' ? 'bg-[#1b6b6b] text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>{t('payments_tab')}</button>
                        <button onClick={() => { setActiveTab('expenses'); setListSearch(''); }} className={`px-5 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'expenses' ? 'bg-[#1b6b6b] text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>{t('expenses_tab')}</button>
                    </div>

                    {activeTab !== 'billing' && (
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Presets */}
                            <div className="flex items-center gap-1 bg-gray-55 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                {['this_month', 'last_30', 'this_year', 'all'].map((type) => {
                                    const label = type === 'this_month' ? t('preset_this_month') : type === 'last_30' ? t('preset_30_days') : type === 'this_year' ? t('preset_this_year') : t('preset_all');
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => handlePreset(type as any)}
                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                                                selectedPreset === type
                                                    ? 'bg-[#1b6b6b] text-white shadow'
                                                    : 'text-gray-400 hover:text-gray-600'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Custom inputs */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setSelectedPreset('custom'); }}
                                    className="bg-gray-55 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none focus:border-[#1b6b6b] w-32 cursor-pointer"
                                />
                                <span className="text-gray-400 dark:text-gray-500 font-extrabold text-[9px] uppercase tracking-wider">{t('date_to')}</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setSelectedPreset('custom'); }}
                                    className="bg-gray-55 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none focus:border-[#1b6b6b] w-32 cursor-pointer"
                                />
                            </div>

                            {/* Search box if activeTab is payments or expenses */}
                            {(activeTab === 'payments' || activeTab === 'expenses') && (
                                <div className="relative">
                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder={activeTab === 'payments' ? "O'quvchi ismi..." : "Kategoriya..."}
                                        value={listSearch}
                                        onChange={e => setListSearch(e.target.value)}
                                        className="pl-8 pr-4 py-2 bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] w-40 transition-all"
                                    />
                                    {listSearch && (
                                        <button onClick={() => setListSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 cursor-pointer">
                                            <X size={11} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ─── HISOBOTLAR TAB ──────────────────────────────────────── */}
                {activeTab === 'reports' && (
                    <div className="p-6 space-y-8">
                        {/* Bu oy asosiy 3 ta metrika */}
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">
                                Muddat: {dateLabel}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <StatCard
                                    label="Bu oylik tushum"
                                    value={metrics.thisMonthRevenue.toLocaleString() + ' UZS'}
                                    sub="kirim"
                                    trend={metrics.revTrend}
                                    icon={<TrendingUp size={18} />}
                                    color="emerald"
                                />
                                <StatCard
                                    label="Bu oylik xarajat"
                                    value={metrics.thisMonthExpenses.toLocaleString() + ' UZS'}
                                    sub="chiqim"
                                    trend={metrics.expTrend !== 0 ? -metrics.expTrend : undefined}
                                    icon={<TrendingDown size={18} />}
                                    color="rose"
                                />
                                <StatCard
                                    label="Bu oylik sof foyda"
                                    value={metrics.thisMonthProfit.toLocaleString() + ' UZS'}
                                    sub="foyda"
                                    trend={metrics.profTrend}
                                    icon={<Wallet size={18} />}
                                    color={metrics.thisMonthProfit >= 0 ? 'sky' : 'rose'}
                                />
                            </div>
                        </div>

                        {/* Ikkinchi qator — qo'shimcha metrikalar */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: "Bugungi tushum", value: metrics.todayRevenue.toLocaleString() + ' UZS', icon: <Calendar size={16} />, color: 'amber' as const },
                                { label: "Bu oylik to'lovlar", value: metrics.thisMonthCount + ' ta', icon: <CreditCard size={16} />, color: 'violet' as const },
                                { label: "O'rtacha to'lov", value: metrics.avgPayment.toLocaleString() + ' UZS', icon: <ArrowUpRight size={16} />, color: 'indigo' as const },
                                { label: "To'lamagan o'quvchilar", value: metrics.unpaidCount + ' ta', icon: <AlertCircle size={16} />, color: 'rose' as const },
                            ].map((m, i) => (
                                <div key={i} className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-4 flex flex-col gap-2">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{m.label}</span>
                                    <p className="text-base font-black text-gray-900 dark:text-white tabular-nums">{m.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Oylik tushum trendi */}
                        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Oylik tushum trendi (so'nggi 6 oy)</p>
                            {metrics.trendLine.length >= 2
                                ? <LineChart data={metrics.trendLine} color="#1b6b6b" height={160} />
                                : <BarChart data={metrics.trendBars} height={160} />
                            }
                        </div>

                        {/* To'lov usullari + Xarajat kategoriyalari */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Bu oy to'lov usullari</p>
                                {metrics.typeSlices.length > 0
                                    ? <DonutChart slices={metrics.typeSlices} size={140} />
                                    : <p className="text-[10px] text-gray-400 font-bold text-center py-8">Bu oy to'lovlar yo'q</p>
                                }
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Bu oy xarajat kategoriyalari</p>
                                {metrics.catBars.length > 0
                                    ? <BarChart data={metrics.catBars} horizontal />
                                    : <p className="text-[10px] text-gray-400 font-bold text-center py-8">Bu oy xarajatlar yo'q</p>
                                }
                            </div>
                        </div>

                        {/* Jami ko'rsatkichlar */}
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Jami (barcha vaqt)</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <StatCard label="Jami tushum" value={metrics.allTimeRevenue.toLocaleString() + ' UZS'} sub="barcha vaqt" icon={<DollarSign size={18} />} color="emerald" />
                                <StatCard label="Jami xarajat" value={metrics.allTimeExpenses.toLocaleString() + ' UZS'} sub="barcha vaqt" icon={<TrendingDown size={18} />} color="rose" />
                                <StatCard label="Jami sof foyda" value={metrics.allTimeProfit.toLocaleString() + ' UZS'} sub="barcha vaqt" icon={<TrendingUp size={18} />} color={metrics.allTimeProfit >= 0 ? 'sky' : 'rose'} />
                            </div>
                        </div>

                        {/* Asosiy 2 ta moliyaviy metrika */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <StatCard
                                label="Umumiy talabalar qarzdorligi"
                                value={metrics.totalDebt.toLocaleString() + ' UZS'}
                                sub={`${metrics.debtors.length} ta qarzdor o'quvchi`}
                                icon={<AlertCircle size={18} />}
                                color="rose"
                            />
                            <StatCard
                                label="Avans to'lovlar summasi"
                                value={metrics.totalCredit.toLocaleString() + ' UZS'}
                                sub={`${metrics.creditors.length} ta o'quvchi oldindan to'lagan`}
                                icon={<ArrowUpRight size={18} />}
                                color="emerald"
                            />
                        </div>

                        {/* O'quvchilar moliyaviy holati */}
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">O'quvchilar moliyaviy holati</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/40 p-4">
                                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest block mb-1">Qarzdorlar</span>
                                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{metrics.debtors.length} ta</p>
                                    <p className="text-[9px] font-bold text-rose-400 mt-1 tabular-nums">{metrics.totalDebt.toLocaleString()} UZS</p>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 p-4">
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest block mb-1">Musbat balans</span>
                                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.creditors.length} ta</p>
                                    <p className="text-[9px] font-bold text-emerald-400 mt-1 tabular-nums">{metrics.totalCredit.toLocaleString()} UZS</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-4">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nol balans</span>
                                    <p className="text-2xl font-black text-gray-600 dark:text-gray-300">{students.filter(s => s.balance === 0).length} ta</p>
                                    <p className="text-[9px] font-bold text-gray-400 mt-1">to'langan</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/40 p-4">
                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block mb-1">Bu oy to'lamagan</span>
                                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{metrics.unpaidCount} ta</p>
                                    <p className="text-[9px] font-bold text-amber-400 mt-1">faol o'quvchi</p>
                                </div>
                            </div>
                        </div>

                        {/* Top qarzdorlar */}
                        {metrics.topDebtors.length > 0 && (
                            <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Eng ko'p qarzdorlar (top 5)</p>
                                <div className="space-y-2">
                                    {metrics.topDebtors.map((st, i) => (
                                        <div
                                            key={st.id}
                                            onClick={() => navigate(`/students/${st.id}`)}
                                            className="flex items-center justify-between px-4 py-3 bg-rose-50/60 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-[9px] font-black text-rose-300 w-5">{i + 1}.</span>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900 dark:text-white uppercase">{st.name}</p>
                                                    {st.phone && <p className="text-[9px] text-gray-400 font-bold mt-0.5">{st.phone}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-rose-600 tabular-nums">{st.balance.toLocaleString()} UZS</span>
                                                <ChevronRight size={13} className="text-rose-300 group-hover:text-rose-400 transition-colors" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* O'tgan oy taqqoslash */}
                        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">
                                O'tgan oy taqqoslash — {MONTHS[lastMonthDate.getMonth()]} {lastMonthDate.getFullYear()}
                            </p>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: "Tushum", cur: metrics.thisMonthRevenue, prev: metrics.lastMonthRevenue, pos: true },
                                    { label: "Xarajat", cur: metrics.thisMonthExpenses, prev: metrics.lastMonthExpenses, pos: false },
                                    { label: "Foyda", cur: metrics.thisMonthProfit, prev: metrics.lastMonthRevenue - metrics.lastMonthExpenses, pos: true },
                                ].map((item, i) => {
                                    const diff = item.cur - item.prev;
                                    const isUp = diff > 0;
                                    return (
                                        <div key={i} className="text-center">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{item.label}</p>
                                            <p className="text-lg font-black text-gray-900 dark:text-white tabular-nums">{item.cur.toLocaleString()}</p>
                                            <p className="text-[9px] text-gray-400 tabular-nums mt-0.5">{item.prev.toLocaleString()} o'tgan oy</p>
                                            {diff !== 0 && (
                                                <span className={`inline-flex items-center gap-0.5 text-[9px] font-black mt-1 px-2 py-0.5 rounded-lg ${(item.pos ? isUp : !isUp) ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-rose-600 bg-rose-50 dark:bg-rose-950/30'}`}>
                                                    {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                                    {Math.abs(diff).toLocaleString()} UZS
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {/* ── Jadvallar ── */}
                        {(() => {
                            const prefix = reportFilter === 'thisMonth' ? thisMonthPrefix
                                : reportFilter === 'lastMonth' ? lastMonthPrefix : null;
                            const rPayments = payments
                                .filter(p => p.amount > 0)
                                .filter(p => !prefix || p.date.startsWith(prefix))
                                .slice().reverse();
                            const rPayTotal = rPayments.reduce((s, p) => s + p.amount, 0);

                            const allStudents = [...students].sort((a, b) => a.balance - b.balance);
                            const lastPayMap: Record<number, { date: string; amount: number }> = {};
                            payments.filter(p => p.amount > 0).forEach(p => {
                                const cur = lastPayMap[p.studentId];
                                if (!cur || p.date > cur.date) lastPayMap[p.studentId] = { date: p.date, amount: p.amount };
                            });

                            const pTotalPages = Math.ceil(rPayments.length / PAGE_SIZE);
                            const bTotalPages = Math.ceil(allStudents.length / PAGE_SIZE);
                            const pPage = Math.min(payPage, Math.max(0, pTotalPages - 1));
                            const bPage = Math.min(balPage, Math.max(0, bTotalPages - 1));
                            const pagePayments = rPayments.slice(pPage * PAGE_SIZE, (pPage + 1) * PAGE_SIZE);
                            const pageStudents = allStudents.slice(bPage * PAGE_SIZE, (bPage + 1) * PAGE_SIZE);

                            const filterLabel = reportFilter === 'thisMonth' ? `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
                                : reportFilter === 'lastMonth' ? `${MONTHS[lastMonthDate.getMonth()]} ${lastMonthDate.getFullYear()}`
                                : 'Barcha vaqt';

                            return (
                                <>
                                    {/* To'lovlar ro'yxati */}
                                    <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                                        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-gray-100 dark:border-gray-700/50">
                                            <div className="flex-1">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">To'lovlar ro'yxati</p>
                                                <p className="text-[10px] font-bold text-[#1b6b6b] mt-0.5">{filterLabel} — {rPayments.length} ta yozuv • Jami: {rPayTotal.toLocaleString()} UZS</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-100 dark:border-gray-700">
                                                    {(['thisMonth','lastMonth','all'] as const).map(f => (
                                                        <button key={f} onClick={() => { setReportFilter(f); setPayPage(0); setBalPage(0); }}
                                                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${reportFilter === f ? 'bg-[#1b6b6b] text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>
                                                            {f === 'thisMonth' ? 'Bu oy' : f === 'lastMonth' ? "O'tgan oy" : 'Hammasi'}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button onClick={() => downloadCSV(`tolOvlar_${filterLabel}.csv`, rPayments.map(p => {
                                                    const s = students.find(st => st.id === p.studentId);
                                                    return { "O'quvchi": s?.name || '', "Summa (UZS)": p.amount, "Turi": p.type, "Sana": p.date, "Izoh": p.description || '' };
                                                }))}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-[#1b6b6b] hover:bg-[#155252] text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer">
                                                    <ArrowUpRight size={11} /> CSV
                                                </button>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-gray-100 dark:border-gray-700/50">
                                                        {["O'QUVCHI", "SUMMA", "TURI", "SANA", "IZOH"].map(h => (
                                                            <th key={h} className="py-3 px-4 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/30">
                                                    {pagePayments.length === 0 ? (
                                                        <tr><td colSpan={5} className="py-10 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">To'lovlar topilmadi</td></tr>
                                                    ) : pagePayments.map(p => {
                                                        const s = students.find(st => st.id === p.studentId);
                                                        return (
                                                            <tr key={p.id} onClick={() => s && navigate(`/students/${s.id}`)}
                                                                className="hover:bg-white dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                                                                <td className="py-3 px-4 text-xs font-bold text-gray-900 dark:text-white">{s?.name || 'Noma\'lum'}</td>
                                                                <td className="py-3 px-4 text-xs font-black text-emerald-600 tabular-nums">+{p.amount.toLocaleString()} UZS</td>
                                                                <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-[9px] font-black uppercase tracking-wider rounded-lg text-gray-600 dark:text-gray-300">{p.type}</span></td>
                                                                <td className="py-3 px-4 text-[10px] font-bold text-gray-500 tabular-nums">{p.date}</td>
                                                                <td className="py-3 px-4 text-[10px] text-gray-400">{p.description || '—'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {pTotalPages > 1 && (
                                            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700/50">
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{rPayments.length} ta yozuv</span>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setPayPage(p => Math.max(0, p - 1))} disabled={pPage === 0}
                                                        className="px-3 py-1 text-[9px] font-black uppercase tracking-wider border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-all">Oldin</button>
                                                    <span className="text-[9px] font-black text-gray-600 dark:text-gray-300">{pPage + 1}/{pTotalPages}</span>
                                                    <button onClick={() => setPayPage(p => Math.min(pTotalPages - 1, p + 1))} disabled={pPage === pTotalPages - 1}
                                                        className="px-3 py-1 text-[9px] font-black uppercase tracking-wider border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-all">Keyin</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Barcha talabalar balansi */}
                                    <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                                        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50">
                                            <div>
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Barcha talabalar balansi</p>
                                                <p className="text-[10px] font-bold text-[#1b6b6b] mt-0.5">{allStudents.length} ta o'quvchi</p>
                                            </div>
                                            <button onClick={() => downloadCSV('talabalar_balansi.csv', allStudents.map(s => {
                                                const lp = lastPayMap[s.id];
                                                return { "Ism Familiya": s.name, "Status": s.status, "Balans (UZS)": s.balance, "So'nggi to'lov": lp?.date || '—', "Summa": lp ? lp.amount : 0 };
                                            }))}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-[#1b6b6b] hover:bg-[#155252] text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer">
                                                <ArrowUpRight size={11} /> CSV
                                            </button>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-gray-100 dark:border-gray-700/50">
                                                        {["ISM FAMILIYA", "STATUS", "BALANS (UZS)", "SO'NGGI TO'LOV", "SUMMA"].map(h => (
                                                            <th key={h} className="py-3 px-4 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/30">
                                                    {pageStudents.length === 0 ? (
                                                        <tr><td colSpan={5} className="py-10 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">O'quvchilar topilmadi</td></tr>
                                                    ) : pageStudents.map(s => {
                                                        const lp = lastPayMap[s.id];
                                                        return (
                                                            <tr key={s.id} onClick={() => navigate(`/students/${s.id}`)}
                                                                className="hover:bg-white dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                                                                <td className="py-3 px-4 text-xs font-bold text-gray-900 dark:text-white">{s.name}</td>
                                                                <td className="py-3 px-4"><span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-lg ${s.status === 'Faol' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{s.status}</span></td>
                                                                <td className={`py-3 px-4 text-xs font-black tabular-nums ${s.balance < 0 ? 'text-rose-600' : s.balance > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>{s.balance.toLocaleString()}</td>
                                                                <td className="py-3 px-4 text-[10px] font-bold text-gray-500 tabular-nums">{lp?.date || '—'}</td>
                                                                <td className="py-3 px-4 text-[10px] font-bold text-gray-600 dark:text-gray-300 tabular-nums">{lp ? lp.amount.toLocaleString() + ' UZS' : '—'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {bTotalPages > 1 && (
                                            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700/50">
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{allStudents.length} ta o'quvchi</span>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setBalPage(p => Math.max(0, p - 1))} disabled={bPage === 0}
                                                        className="px-3 py-1 text-[9px] font-black uppercase tracking-wider border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-all">Oldin</button>
                                                    <span className="text-[9px] font-black text-gray-600 dark:text-gray-300">{bPage + 1}/{bTotalPages}</span>
                                                    <button onClick={() => setBalPage(p => Math.min(bTotalPages - 1, p + 1))} disabled={bPage === bTotalPages - 1}
                                                        className="px-3 py-1 text-[9px] font-black uppercase tracking-wider border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-all">Keyin</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* ─── OYLIK NAZORAT TAB ──────────────────────────────────── */}
                {activeTab === 'billing' && (
                    <div className="p-6 space-y-6">
                        {/* Month selector + action button */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={prevBillingMonth} className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer">
                                    <ChevronLeft size={14} className="text-gray-500" />
                                </button>
                                <div className="text-center">
                                    <p className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">{billingMonthLabel(billingMonth)}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Oylik hisob-kitob</p>
                                </div>
                                <button onClick={nextBillingMonth} className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer">
                                    <ChevronRight size={14} className="text-gray-500" />
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={loadBillingStatus} disabled={billingLoading}
                                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer disabled:opacity-50">
                                    <RefreshCw size={12} className={billingLoading ? 'animate-spin' : ''} /> Yangilash
                                </button>
                                {billingData?.billingDone ? (
                                    <button onClick={() => handleBillingProcess(true)} disabled={billingProcessing}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-amber-500/20">
                                        <RefreshCw size={12} className={billingProcessing ? 'animate-spin' : ''} />
                                        {billingProcessing ? 'Hisoblanmoqda...' : 'Qayta hisoblash'}
                                    </button>
                                ) : (
                                    <button onClick={() => handleBillingProcess(false)} disabled={billingProcessing}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-violet-600/20">
                                        <Calendar size={12} className={billingProcessing ? 'animate-spin' : ''} />
                                        {billingProcessing ? 'Hisoblanmoqda...' : 'Hisoblash'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Billing status badge */}
                        {billingData && (
                            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${billingData.billingDone ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40 text-amber-700 dark:text-amber-400'}`}>
                                {billingData.billingDone
                                    ? <><CheckCircle2 size={14} /> {billingMonthLabel(billingMonth)} — oylik hisob-kitob o'tkazilgan</>
                                    : <><AlertCircle size={14} /> {billingMonthLabel(billingMonth)} — oylik hisob-kitob o'tkazilmagan. "Hisoblash" tugmasini bosing</>
                                }
                            </div>
                        )}

                        {/* 4 StatCards */}
                        {billingData && (() => {
                            const totalExpected = billingData.students.reduce((s, st) => s + st.expected, 0);
                            const totalPaid = billingData.students.reduce((s, st) => s + st.paid, 0);
                            const unpaidStudents = billingData.students.filter(st => st.status === 'unpaid').length;
                            const paidStudents = billingData.students.filter(st => st.status === 'paid').length;
                            return (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <StatCard label="Kutilgan tushum" value={totalExpected.toLocaleString() + ' UZS'} sub={`${billingData.students.length} ta o'quvchi`} icon={<DollarSign size={18} />} color="violet" />
                                    <StatCard label="Haqiqiy tushum" value={totalPaid.toLocaleString() + ' UZS'} sub="bu oy to'langan" icon={<TrendingUp size={18} />} color="emerald" />
                                    <StatCard label="To'lanmagan" value={(totalExpected - totalPaid).toLocaleString() + ' UZS'} sub={`${unpaidStudents} ta to'lamagan`} icon={<AlertCircle size={18} />} color="rose" />
                                    <StatCard label="To'lagan o'quvchi" value={`${paidStudents} / ${billingData.students.length}`} sub="to'liq to'lagan" icon={<Users size={18} />} color="sky" />
                                </div>
                            );
                        })()}

                        {billingLoading && !billingData && (
                            <div className="py-16 text-center">
                                <RefreshCw size={24} className="animate-spin text-violet-400 mx-auto mb-2" />
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ma'lumot yuklanmoqda...</p>
                            </div>
                        )}

                        {/* Students status table */}
                        {billingData && billingData.students.length > 0 && (
                            <div className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                                <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-gray-100 dark:border-gray-700/50">
                                    <div className="flex-1">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">O'quvchilar to'lov holati</p>
                                        <p className="text-[10px] font-bold text-violet-600 mt-0.5">{billingData.students.length} ta faol o'quvchi</p>
                                    </div>
                                    <div className="flex items-center gap-1 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-100 dark:border-gray-700">
                                        {(['all', 'paid', 'partial', 'unpaid'] as const).map(f => (
                                            <button key={f} onClick={() => setBillingFilter(f)}
                                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${billingFilter === f
                                                    ? f === 'paid' ? 'bg-emerald-500 text-white' : f === 'unpaid' ? 'bg-rose-500 text-white' : f === 'partial' ? 'bg-amber-500 text-white' : 'bg-violet-600 text-white shadow'
                                                    : 'text-gray-400 hover:text-gray-600'}`}>
                                                {f === 'all' ? 'Barchasi' : f === 'paid' ? 'To\'lagan' : f === 'partial' ? 'Qisman' : 'To\'lamagan'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-gray-100 dark:border-gray-700/50">
                                                {["O'QUVCHI", "GURUHLAR", "KUTILGAN", "TO'LANGAN", "BALANS", "HOLAT"].map(h => (
                                                    <th key={h} className="py-3 px-4 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/30">
                                            {billingData.students
                                                .filter(st => billingFilter === 'all' || st.status === billingFilter)
                                                .map(st => (
                                                    <tr key={st.studentId} onClick={() => navigate(`/students/${st.studentId}`)}
                                                        className="hover:bg-white dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                                                        <td className="py-3 px-4">
                                                            <p className="text-xs font-bold text-gray-900 dark:text-white">{st.name}</p>
                                                            {st.phone && <p className="text-[9px] text-gray-400 font-bold mt-0.5">{st.phone}</p>}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex flex-wrap gap-1">
                                                                {st.groups.map((g: any) => (
                                                                    <span key={g.groupId} className="px-1.5 py-0.5 bg-violet-50 dark:bg-violet-950/20 text-[8px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 rounded-md">
                                                                        {g.groupName}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-xs font-black text-gray-700 dark:text-gray-300 tabular-nums">{st.expected.toLocaleString()} UZS</td>
                                                        <td className="py-3 px-4 text-xs font-black text-emerald-600 tabular-nums">{st.paid.toLocaleString()} UZS</td>
                                                        <td className={`py-3 px-4 text-xs font-black tabular-nums ${st.balance < 0 ? 'text-rose-600' : st.balance > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                            {st.balance.toLocaleString()} UZS
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg ${st.status === 'paid' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : st.status === 'partial' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'}`}>
                                                                {st.status === 'paid' ? "To'lagan" : st.status === 'partial' ? 'Qisman' : "To'lamagan"}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Groups breakdown */}
                        {billingData && billingData.groups.length > 0 && (
                            <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Guruhlar bo'yicha breakdown</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {billingData.groups.filter(g => g.totalStudents > 0).map((g: any) => (
                                        <div key={g.groupId} className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <p className="text-xs font-black text-gray-900 dark:text-white">{g.groupName}</p>
                                                    <p className="text-[9px] text-gray-400 font-bold mt-0.5">{g.courseName}</p>
                                                </div>
                                                <span className="text-[9px] font-black text-violet-600 bg-violet-50 dark:bg-violet-950/20 px-2 py-0.5 rounded-lg">{g.totalStudents} o'quvchi</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-[9px]">
                                                <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl px-3 py-2">
                                                    <span className="font-black text-emerald-600 block text-xs">{g.paidCount}</span>
                                                    <span className="text-emerald-500 uppercase tracking-wider font-bold">To'lagan</span>
                                                </div>
                                                <div className="bg-rose-50 dark:bg-rose-950/20 rounded-xl px-3 py-2">
                                                    <span className="font-black text-rose-600 block text-xs">{g.unpaidCount}</span>
                                                    <span className="text-rose-500 uppercase tracking-wider font-bold">To'lamagan</span>
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex justify-between text-[9px] font-bold text-gray-500">
                                                <span>Kutilgan: <span className="text-gray-700 dark:text-gray-300 font-black">{g.expected.toLocaleString()}</span></span>
                                                <span>Tushgan: <span className="text-emerald-600 font-black">{g.actual.toLocaleString()}</span></span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* SMS button */}
                        {billingData && billingData.students.filter((st: any) => st.status !== 'paid').length > 0 && (
                            <div className="flex justify-end">
                                <button
                                    className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-blue-600/20"
                                    onClick={() => alert('SMS yuborish funksiyasi tez kunda!')}
                                >
                                    <MessageSquare size={14} />
                                    To'lamaganlar uchun SMS yuborish ({billingData.students.filter((st: any) => st.status !== 'paid').length} ta)
                                </button>
                            </div>
                        )}

                        {!billingData && !billingLoading && (
                            <div className="py-16 text-center">
                                <Calendar size={32} className="text-gray-300 mx-auto mb-3" />
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ma'lumot yuklanmadi</p>
                                <button onClick={loadBillingStatus} className="mt-3 text-[10px] font-black text-violet-600 hover:underline cursor-pointer uppercase tracking-widest">Qayta urinish</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Summary row — only for payments/expenses */}
                {(activeTab === 'payments' || activeTab === 'expenses') && (
                    <div className="px-6 py-3 border-b border-gray-50 dark:border-gray-700/30 flex items-center gap-4">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{dateLabel}</span>
                        {activeTab === 'payments' ? (
                            <>
                                <span className="text-[9px] font-black text-gray-400">{filteredPayments.length} ta to'lov</span>
                                <span className="text-[10px] font-black text-emerald-600 tabular-nums ml-auto">+{filteredRevenue.toLocaleString()} UZS</span>
                            </>
                        ) : (
                            <>
                                <span className="text-[9px] font-black text-gray-400">{filteredExpenses.length} ta xarajat</span>
                                <span className="text-[10px] font-black text-rose-600 tabular-nums ml-auto">-{filteredExpenditure.toLocaleString()} UZS</span>
                            </>
                        )}
                    </div>
                )}

                {/* List */}
                {(activeTab === 'payments' || activeTab === 'expenses') && (
                    <div className="divide-y divide-gray-50 dark:divide-gray-700/30 max-h-[520px] overflow-y-auto">
                        {activeTab === 'payments' ? (
                            filteredPayments.length === 0 ? (
                                <p className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">To'lovlar topilmadi</p>
                            ) : filteredPayments.map(p => {
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
                                                <p className="text-xs font-bold text-gray-900 dark:text-white uppercase truncate">{student?.name || "Noma'lum"}</p>
                                                <span className="text-[9px] text-gray-400 font-bold block mt-0.5 uppercase tracking-wide">{p.date} • {p.type}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs font-black text-emerald-600 tabular-nums">+{p.amount.toLocaleString()} UZS</span>
                                            <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            filteredExpenses.length === 0 ? (
                                <p className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Xarajatlar topilmadi</p>
                            ) : filteredExpenses.map(e => (
                                <div key={e.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50/70 dark:hover:bg-gray-900/40 transition-all">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 flex items-center justify-center shrink-0">
                                            <TrendingDown size={14} className="text-rose-500 dark:text-rose-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-white uppercase truncate">
                                                {e.category}
                                                {e.category === 'Ish haqi' && (e as any).staffName && (
                                                    <span className="ml-1.5 text-[9px] font-black text-rose-500 normal-case tracking-normal">
                                                        — {(e as any).staffName}
                                                    </span>
                                                )}
                                            </p>
                                            <span className="text-[9px] text-gray-400 font-bold block mt-0.5 uppercase tracking-wide">{e.date}{e.description ? ` • ${e.description}` : ''}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-xs font-black text-rose-600 tabular-nums">-{e.amount.toLocaleString()} UZS</span>
                                        <button onClick={() => deleteExpense(e.id)} className="w-7 h-7 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center justify-center transition-colors cursor-pointer">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={closePaymentModal} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8 overflow-hidden">

                        {createdPaymentForReceipt ? (
                            <div className="space-y-6">
                                <div className="text-center space-y-1">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-[#1b6b6b] dark:text-teal-400">SARIOSIYO CENTER</h3>
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">TO'LOV CHEKI (RECEIPT)</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900/30 p-6 rounded-3xl border border-gray-100 dark:border-gray-750 font-mono text-xs text-gray-800 dark:text-gray-300 space-y-4 shadow-inner">
                                    <div className="border-b border-dashed border-gray-300 dark:border-gray-700 pb-3 space-y-1">
                                        <div className="flex justify-between"><span>Chek #</span><span className="font-black">#{createdPaymentForReceipt.id}</span></div>
                                        <div className="flex justify-between"><span>Sana:</span><span className="font-semibold">{createdPaymentForReceipt.date}</span></div>
                                    </div>
                                    <div className="space-y-2">
                                        <div>
                                            <span className="text-[9px] text-gray-400 uppercase block">O'quvchi:</span>
                                            <span className="font-black text-gray-900 dark:text-white text-[13px]">{selectedStudent?.name}</span>
                                        </div>
                                        {selectedStudent?.phone && (
                                            <div><span className="text-[9px] text-gray-400 uppercase block">Telefon:</span><span>{selectedStudent.phone}</span></div>
                                        )}
                                        {(() => {
                                            const sg = groups.filter(g => (g.studentIds || []).includes(selectedStudent?.id));
                                            if (!sg.length) return null;
                                            return (
                                                <div>
                                                    <span className="text-[9px] text-gray-400 uppercase block">Kurslar:</span>
                                                    <div className="font-semibold">{sg.map(g => {
                                                        const cn = courses.find(c => c.id === g.courseId)?.name || '';
                                                        return <div key={g.id}>- {g.name}{cn && ` (${cn})`}</div>;
                                                    })}</div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-3 space-y-1.5">
                                        <div className="flex justify-between text-[13px]">
                                            <span className="font-bold">To'lov turi:</span>
                                            <span className="font-black uppercase">{createdPaymentForReceipt.type}</span>
                                        </div>
                                        <div className="flex justify-between text-base">
                                            <span className="font-bold text-[#1b6b6b]">To'landi:</span>
                                            <span className="font-black text-emerald-600 tabular-nums">+{createdPaymentForReceipt.amount.toLocaleString()} UZS</span>
                                        </div>
                                        <div className="flex justify-between text-[13px]">
                                            <span className="font-bold">Joriy balans:</span>
                                            <span className={`font-black tabular-nums ${(selectedStudent?.balance || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {(selectedStudent?.balance || 0).toLocaleString()} UZS
                                            </span>
                                        </div>
                                    </div>
                                    <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-3 text-center text-[9px] text-gray-400 uppercase tracking-widest font-bold">
                                        To'lovingiz uchun rahmat!
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => handlePrintReceipt(createdPaymentForReceipt, selectedStudent)}
                                        className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer shadow-lg shadow-[#1b6b6b]/20 text-center">
                                        Chop etish (Print)
                                    </button>
                                    <button type="button" onClick={closePaymentModal}
                                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200">
                                        Yopish
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Yangi Kirim</h3>
                                        <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">To'lov qabul qilish</p>
                                    </div>
                                    <button onClick={closePaymentModal} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                                </div>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (!selectedStudent) return;
                                    const created = await addPayment({
                                        studentId: selectedStudent.id,
                                        amount: newPayment.amount,
                                        type: newPayment.type,
                                        description: newPayment.description || '',
                                        date: newPayment.date
                                    });
                                    setCreatedPaymentForReceipt(created);
                                }} className="space-y-4">
                                    {!selectedStudent ? (
                                        <div className="relative">
                                            <label className={lbl}>O'quvchini qidirish *</label>
                                            <input type="text" placeholder="Ism yoki telefon raqami..." className={inp}
                                                value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
                                            {studentSearch.trim() !== '' && (
                                                <div className="absolute z-[210] left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-750">
                                                    {students.filter(s =>
                                                        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                                        (s.phone && s.phone.includes(studentSearch))
                                                    ).slice(0, 6).map(s => (
                                                        <button key={s.id} type="button"
                                                            onClick={() => { setSelectedStudent(s); setStudentSearch(''); }}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-xs font-bold text-gray-900 dark:text-white flex flex-col cursor-pointer transition-colors">
                                                            <span>{s.name}</span>
                                                            {s.phone && <span className="text-[9px] text-gray-400 font-bold mt-0.5">{s.phone}</span>}
                                                        </button>
                                                    ))}
                                                    {students.filter(s =>
                                                        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                                        (s.phone && s.phone.includes(studentSearch))
                                                    ).length === 0 && (
                                                        <div className="px-4 py-4 text-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">O'quvchi topilmadi</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800/80 relative space-y-3">
                                            <button type="button"
                                                onClick={() => { setSelectedStudent(null); setNewPayment({ ...newPayment, studentId: 0 }); }}
                                                className="absolute top-3.5 right-3.5 text-[9px] text-rose-500 font-black uppercase tracking-wider hover:underline cursor-pointer bg-white dark:bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-700">
                                                O'zgartirish
                                            </button>
                                            <div>
                                                <span className="text-[8px] font-black text-[#1b6b6b] uppercase tracking-widest block">Tanlangan o'quvchi</span>
                                                <h4 className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">{selectedStudent.name}</h4>
                                                {selectedStudent.phone && <p className="text-[9px] text-gray-400 font-bold mt-0.5">{selectedStudent.phone}</p>}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700/50">
                                                <div>
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Joriy Balans</span>
                                                    <span className={`text-[11px] font-black block mt-0.5 tabular-nums ${selectedStudent.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {selectedStudent.balance.toLocaleString()} UZS
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Oxirgi to'lov</span>
                                                    {(() => {
                                                        const sp = payments.filter(p => p.studentId === selectedStudent.id && p.amount > 0);
                                                        const lp = sp.length > 0 ? sp[sp.length - 1] : null;
                                                        return lp
                                                            ? <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 block mt-0.5 tabular-nums">{lp.amount.toLocaleString()} UZS ({lp.date})</span>
                                                            : <span className="text-[10px] text-gray-400 italic block mt-0.5">Mavjud emas</span>;
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700/50">
                                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Kurslar</span>
                                                {(() => {
                                                    const sg = groups.filter(g => (g.studentIds || []).includes(selectedStudent.id));
                                                    return sg.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {sg.map(g => {
                                                                const cn = courses.find(c => c.id === g.courseId)?.name || '';
                                                                return (
                                                                    <span key={g.id} className="px-2 py-0.5 bg-white dark:bg-gray-800 text-[8px] font-black uppercase tracking-wider text-[#1b6b6b] border border-teal-100/50 dark:border-teal-900/40 rounded-md">
                                                                        {g.name}{cn && ` (${cn})`}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : <span className="text-[9px] text-gray-400 italic block mt-0.5">Kurslarga a'zo emas</span>;
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className={lbl}>Summa (UZS) *</label>
                                        <input type="number" required placeholder="Masalan: 500 000" className={inp}
                                            value={newPayment.amount || ''}
                                            onChange={(e) => setNewPayment({ ...newPayment, amount: Number(e.target.value) })} />
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {[300000, 400000, 500000, 600000, 800000].map(amt => (
                                                <button key={amt} type="button"
                                                    onClick={() => setNewPayment({ ...newPayment, amount: amt })}
                                                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider border rounded-xl transition-all cursor-pointer ${newPayment.amount === amt ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white shadow-sm' : 'bg-gray-50 dark:bg-gray-900/30 dark:border-gray-800 hover:bg-gray-100 text-gray-500 dark:text-gray-400'}`}>
                                                    {amt.toLocaleString()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className={lbl}>To'lov usuli *</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['Naqd', 'Karta', "O'tkazma"].map(tType => (
                                                <button key={tType} type="button"
                                                    onClick={() => setNewPayment({ ...newPayment, type: tType as any })}
                                                    className={`py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-widest transition-all border cursor-pointer ${newPayment.type === tType ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white shadow-lg shadow-[#1b6b6b]/20' : 'bg-white dark:bg-gray-850 border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50'}`}>
                                                    {tType}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className={lbl}>Izoh (ixtiyoriy)</label>
                                        <input type="text" placeholder="Qo'shimcha izoh..." className={inp}
                                            value={newPayment.description}
                                            onChange={e => setNewPayment({ ...newPayment, description: e.target.value })} />
                                    </div>

                                    <div className="flex gap-3 pt-4 border-t border-gray-50 dark:border-gray-700/50">
                                        <button type="button" onClick={closePaymentModal}
                                            className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                            {t('cancel')}
                                        </button>
                                        <button type="submit" disabled={!selectedStudent}
                                            className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] disabled:opacity-50 text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                                            {t('save')}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Expense Modal */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsExpenseModalOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Yangi Chiqim</h3>
                                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">Xarajat kiritish</p>
                            </div>
                            <button onClick={() => setIsExpenseModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
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
                                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                    {t('cancel')}
                                </button>
                                <button type="submit"
                                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-rose-600/20 transition-all cursor-pointer">
                                    {t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
