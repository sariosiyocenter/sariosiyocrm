import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, Wallet,
    Plus, X, Trash2, Search, ChevronRight, BarChart2,
    AlertCircle, CreditCard, ArrowUpRight, Calendar,
    RefreshCw, CheckCircle2, MessageSquare, ChevronLeft, Users
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import StatTile from './ui/StatTile';
import { displayName } from '../lib/displayName';
import { useConfirm } from './ConfirmDialog';
import { useLang } from '../context/LanguageContext';
import { Payment, Expense } from '../types';
import { StatCard, BarChart, DonutChart, LineChart } from './reports/shared';

const inp = "w-full px-4 py-3 bg-slate-50 dark:bg-[#1a2232] border border-chiziq rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all";
const lbl = "block text-[11px] font-extrabold   text-matn-xira mb-2";

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
    const { students, payments, expenses, addPayment, addExpense, deleteExpense, groups, courses, token, selectedSchoolId, teachers, showNotification } = useCRM();
    const confirm = useConfirm();

    // HR users (staff list for salary expense)
    const [hrUsers, setHrUsers] = useState<any[]>([]);
    useEffect(() => {
        if (!token) return;
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).then(d => setHrUsers(Array.isArray(d) ? d : [])).catch(() => {});
    }, [token]);
    const { t } = useLang();
    const navigate = useNavigate();

    // Summalarni millionda ko'rsatadi: "500 001 UZS" o'rniga "0,5".
    // Bir qarashda o'qish uchun aniq so'm kerak emas, kattalik kerak.
    const mln = (n: number) => (n / 1000000).toFixed(1).replace('.', ',');
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

    const [showDebtNotifyModal, setShowDebtNotifyModal] = useState(false);
    const [debtNotifyTemplate, setDebtNotifyTemplate] = useState("Hurmatli {ism}, sizning {oylik} oyi uchun qarzingiz {qarz} UZS. Iltimos, to'lovni vaqtida amalga oshiring. Muassasa: {markaz}");
    const [debtNotifyChannel, setDebtNotifyChannel] = useState<'SMS' | 'TELEGRAM' | 'BOTH'>('BOTH');
    const [debtNotifyStatusFilter, setDebtNotifyStatusFilter] = useState<'active' | 'passive' | 'all'>('active');
    const [isSendingDebtNotify, setIsSendingDebtNotify] = useState(false);

    const handleSendDebtNotifications = async () => {
        if (!selectedSchoolId || !token || isSendingDebtNotify) return;
        setIsSendingDebtNotify(true);
        try {
            const res = await fetch('/api/billing/notify-debtors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    schoolId: selectedSchoolId,
                    month: billingMonth,
                    messageTemplate: debtNotifyTemplate,
                    channel: debtNotifyChannel,
                    statusFilter: debtNotifyStatusFilter
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showNotification(`${data.count} ta qarzdor o'quvchiga xabarlar muvaffaqiyatli yuborildi.`, 'success');
                setShowDebtNotifyModal(false);
            } else {
                showNotification(data.error || 'Xabar yuborishda xatolik yuz berdi.', 'error');
            }
        } catch (err) {
            showNotification('Server bilan ulanishda xatolik yuz berdi.', 'error');
        } finally {
            setIsSendingDebtNotify(false);
        }
    };

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
    const [isSavingPayment, setIsSavingPayment] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseCustomCat, setExpenseCustomCat] = useState('');

    // Report table filters
    const [reportFilter, setReportFilter] = useState<'all' | 'thisMonth' | 'lastMonth'>('all');
    const [payPage, setPayPage] = useState(0);
    const [balPage, setBalPage] = useState(0);
    const PAGE_SIZE = 10;

    // Date preset states
    const [selectedPreset, setSelectedPreset] = useState<'this_month' | 'last_30' | 'this_year' | 'all' | 'custom'>('this_month');
    const [studentStatus, setStudentStatus] = useState<'all' | 'active' | 'inactive'>('all');
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
  h2 { font-size: 15px; font-weight: 900; text-align: center; letter-spacing: 2px; text-transform: ; color: #1b6b6b; margin-bottom: 4px; }
  .sub { text-align: center; font-size: 9px; letter-spacing: 2px; text-transform: ; color: #888; margin-bottom: 18px; }
  .box { border: 1px dashed #ccc; border-radius: 8px; padding: 16px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .row .val { font-weight: 900; }
  .divider { border-top: 1px dashed #ccc; margin: 12px 0; }
  .label { font-size: 9px; text-transform: ; color: #888; display: block; margin-bottom: 2px; }
  .big { font-size: 14px; font-weight: 900; }
  .green { color: #059669; }
  .red { color: #e11d48; }
  .footer { margin-top: 14px; text-align: center; font-size: 9px; letter-spacing: 2px; text-transform: ; color: #aaa; }
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
        const filteredStudents = students.filter(s => {
            if (studentStatus === 'all') return true;
            if (studentStatus === 'active') return s.status === 'Faol';
            return s.status !== 'Faol';
        });

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
        const debtors = filteredStudents.filter(s => s.balance < 0);
        const totalDebt = debtors.reduce((s, st) => s + Math.abs(st.balance), 0);

        const creditors = filteredStudents.filter(s => s.balance > 0);
        const totalCredit = creditors.reduce((s, st) => s + st.balance, 0);
        const zeroBalanceCount = filteredStudents.filter(s => s.balance === 0).length;

        // Students who haven't paid in this period (active students = in at least 1 group)
        const filteredStudentIds = new Set(filteredStudents.map(s => s.id));
        const activeStudentIds = new Set(groups.flatMap(g => g.studentIds || []).filter(id => filteredStudentIds.has(id)));
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

        // Qarz yoshi. Qarzning aniq boshlanish sanasi saqlanmaydi, shuning uchun
        // o'quvchining oxirgi to'lovidan beri o'tgan kun olinadi — bu "qachondan
        // beri pul kelmayapti" degan savolga to'g'ri javob beradi.
        const lastPayDay = (studentId: number) => {
            const dates = posPayments.filter(p => p.studentId === studentId).map(p => p.date).sort();
            const last = dates[dates.length - 1];
            if (!last) return Infinity;
            const d = new Date(last);
            return isNaN(d.getTime()) ? Infinity : Math.floor((Date.now() - d.getTime()) / 86400000);
        };
        const AGE_BUCKETS = [
            { label: '1-15 kun', max: 15, color: 'bg-emerald-500' },
            { label: '16-30 kun', max: 30, color: 'bg-amber-400' },
            { label: '31-60 kun', max: 60, color: 'bg-orange-500' },
            { label: '60+ kun', max: Infinity, color: 'bg-rose-500' },
        ];
        const debtAge = AGE_BUCKETS.map(b => ({ ...b, sum: 0, count: 0 }));
        debtors.forEach(st => {
            const days = lastPayDay(st.id);
            const idx = debtAge.findIndex(b => days <= b.max);
            const bucket = debtAge[idx === -1 ? debtAge.length - 1 : idx];
            bucket.sum += Math.abs(st.balance);
            bucket.count += 1;
        });
        const debtAgeMax = Math.max(...debtAge.map(b => b.sum), 1);
        // 30 kundan oshgan qarzlar soni — ko'rsatkich kartochkasidagi izoh uchun.
        const staleDebtCount = debtors.filter(st => lastPayDay(st.id) > 30).length;

        // Top 5 debtors
        const topDebtors = [...debtors].sort((a, b) => a.balance - b.balance).slice(0, 5);

        return {
            thisMonthRevenue, lastMonthRevenue, thisMonthExpenses, lastMonthExpenses,
            thisMonthProfit, thisMonthCount, todayRevenue, allTimeRevenue, allTimeExpenses,
            allTimeProfit, avgPayment, revTrend, expTrend, profTrend,
            debtors, totalDebt, creditors, totalCredit, unpaidCount, staleDebtCount,
            typeSlices, catBars, trendBars, trendLine, topDebtors, debtAge, debtAgeMax,
            activeStudentCount: activeStudentIds.size,
            zeroBalanceCount
        };
    }, [payments, expenses, students, groups, startDate, endDate, todayStr, studentStatus]);

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
                        <button
                            onClick={() => setIsPaymentModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-extrabold shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> {t('add_payment')}
                        </button>
                        <button
                            onClick={() => setIsExpenseModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> {t('add_expense')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Card with Tabs */}
            <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm">
                {/* Tab Bar */}
                <div className="px-6 pt-5 pb-4 border-b border-chiziq-mayin/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-gray-950/40 p-1 rounded-xl border border-gray-200/40 dark:border-gray-800/40 w-full xl:w-auto max-w-full overflow-x-auto no-scrollbar flex-nowrap">
                        <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-black transition-all duration-200 cursor-pointer whitespace-nowrap transform active:scale-95 ${
                            activeTab === 'reports'
                                ? 'bg-sirt text-brand dark:text-emerald-400 shadow-sm border border-gray-200/50 dark:border-gray-800/50 scale-[1.01]'
                                : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-300'
                        }`}>
                            <BarChart2 size={12} className="shrink-0" />
                            <span>Hisobotlar</span>
                        </button>
                        <button onClick={() => setActiveTab('billing')} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-black transition-all duration-200 cursor-pointer whitespace-nowrap transform active:scale-95 ${
                            activeTab === 'billing'
                                ? 'bg-sirt text-violet-600 dark:text-violet-400 shadow-sm border border-gray-200/50 dark:border-gray-800/50 scale-[1.01]'
                                : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-300'
                        }`}>
                            <Calendar size={12} className="shrink-0" />
                            <span>Oylik nazorat</span>
                        </button>
                        <button onClick={() => { setActiveTab('payments'); setListSearch(''); }} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-black transition-all duration-200 cursor-pointer whitespace-nowrap transform active:scale-95 ${
                            activeTab === 'payments'
                                ? 'bg-sirt text-brand dark:text-emerald-400 shadow-sm border border-gray-200/50 dark:border-gray-800/50 scale-[1.01]'
                                : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-300'
                        }`}>
                            <CreditCard size={12} className="shrink-0" />
                            <span>{t('payments_tab')}</span>
                        </button>
                        <button onClick={() => { setActiveTab('expenses'); setListSearch(''); }} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-black transition-all duration-200 cursor-pointer whitespace-nowrap transform active:scale-95 ${
                            activeTab === 'expenses'
                                ? 'bg-sirt text-brand dark:text-emerald-400 shadow-sm border border-gray-200/50 dark:border-gray-800/50 scale-[1.01]'
                                : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-300'
                        }`}>
                            <TrendingDown size={12} className="shrink-0" />
                            <span>{t('expenses_tab')}</span>
                        </button>
                    </div>

                    {activeTab !== 'billing' && (
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Presets */}
                            <div className="flex items-center gap-1 bg-ichki p-1 rounded-xl border border-chiziq">
                                {['this_month', 'last_30', 'this_year', 'all', 'custom'].map((type) => {
                                    const label = type === 'this_month' ? t('preset_this_month')
                                        : type === 'last_30' ? t('preset_30_days')
                                        : type === 'this_year' ? t('preset_this_year')
                                        : type === 'all' ? t('preset_all')
                                        : 'Boshqa muddat';
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => type === 'custom' ? setSelectedPreset('custom') : handlePreset(type as any)}
                                            className={`px-3 py-1.5 rounded-lg text-[12px] transition-colors cursor-pointer ${
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
                {activeTab === 'reports' && (
                    <div className="p-4 space-y-8">
                        {/* To'rtta ko'rsatkich, bitta qatorda. Summalar millionda:
                            "500 001 UZS" o'rniga "0,5 mln" — raqamni bir qarashda
                            o'qish uchun aniq so'm kerak emas. */}
                        <div>
                            <p className="text-[12px] text-matn-sokin mb-3">Muddat: {dateLabel}</p>
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                                <StatTile
                                    label="Tushum"
                                    value={mln(metrics.thisMonthRevenue)}
                                    unit="mln"
                                    subValue={<>
                                        <span className="raqam">{metrics.thisMonthCount}</span> ta to'lov
                                        {metrics.avgPayment > 0 && <> · o'rtacha <span className="raqam">{mln(metrics.avgPayment)}</span> mln</>}
                                    </>}
                                />
                                <StatTile
                                    label="Xarajat"
                                    value={mln(metrics.thisMonthExpenses)}
                                    unit="mln"
                                    subValue={metrics.thisMonthRevenue > 0
                                        ? <>tushumning <span className="raqam">{Math.round((metrics.thisMonthExpenses / metrics.thisMonthRevenue) * 100)}%</span></>
                                        : 'tanlangan davr'}
                                />
                                <StatTile
                                    label="Sof foyda"
                                    value={mln(metrics.thisMonthProfit)}
                                    unit="mln"
                                    tone={metrics.thisMonthProfit >= 0 ? 'good' : 'bad'}
                                    bar={metrics.thisMonthRevenue > 0 ? Math.max(0, Math.round((metrics.thisMonthProfit / metrics.thisMonthRevenue) * 100)) : null}
                                    barTone={metrics.thisMonthProfit >= 0 ? 'good' : 'bad'}
                                    barCaption={<>tushumning <span className="raqam">{metrics.thisMonthRevenue > 0 ? Math.round((metrics.thisMonthProfit / metrics.thisMonthRevenue) * 100) : 0}%</span></>}
                                    subValue={metrics.thisMonthRevenue > 0 ? undefined : 'tanlangan davr'}
                                />
                                <StatTile
                                    label="Qarzdorlik"
                                    value={mln(metrics.totalDebt)}
                                    unit="mln"
                                    tone="bad"
                                    accent={metrics.totalDebt > 0}
                                    subValue={<>
                                        <span className="raqam">{metrics.debtors.length}</span> o'quvchi
                                        {metrics.staleDebtCount > 0 && <> · <span className="raqam">{metrics.staleDebtCount}</span> tasi 30 kundan oshgan</>}
                                    </>}
                                    subTone="bad"
                                />
                            </div>
                        </div>

                        {/* Trend va qarzdorlik yoshi yonma-yon. Moliyadagi asosiy
                            savol "qancha tushdi" emas, "qarz qancha eskirgan":
                            30 kunlik qarz qaytadi, 90 kunlik odatda qaytmaydi. */}
                        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
                            <div className="xl:col-span-3 bg-sirt rounded-xl border border-chiziq p-5">
                                <p className="text-[14px] font-semibold text-matn mb-4">Oylik tushum trendi <span className="text-[12px] font-normal text-matn-sokin">· so'nggi 6 oy</span></p>
                                {metrics.trendLine.length >= 2
                                    ? <LineChart data={metrics.trendLine} color="var(--color-brand)" height={168} />
                                    : <BarChart data={metrics.trendBars} height={168} />
                                }
                            </div>

                            <div className="xl:col-span-2 bg-sirt rounded-xl border border-chiziq p-5">
                                <p className="text-[14px] font-semibold text-matn">Qarzdorlik yoshi</p>
                                <p className="text-[12px] text-matn-sokin mt-0.5 mb-4">
                                    {metrics.staleDebtCount > 0
                                        ? <><span className="raqam">{metrics.staleDebtCount}</span> ta qarz 30 kundan oshgan</>
                                        : 'Barcha qarzlar yangi'}
                                </p>
                                {metrics.totalDebt === 0 ? (
                                    <p className="text-[13px] text-matn-sokin py-6 text-center">Qarzdor yo'q</p>
                                ) : (
                                    <div className="space-y-3">
                                        {metrics.debtAge.map(b => (
                                            <div key={b.label}>
                                                <div className="flex items-baseline justify-between mb-1.5">
                                                    <span className="text-[12px] text-matn-2">
                                                        {b.label} <span className="raqam text-matn-xira">· {b.count} ta</span>
                                                    </span>
                                                    <span className="num text-[12px] text-matn-2">{mln(b.sum)} mln</span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-chiziq overflow-hidden">
                                                    <div className={`h-full rounded-full ${b.color}`}
                                                        style={{ width: `${Math.round((b.sum / metrics.debtAgeMax) * 100)}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Eng katta qarzdorlar — kim bilan gaplashish kerakligi */}
                        {metrics.topDebtors.length > 0 && (
                            <div className="bg-sirt rounded-xl border border-chiziq overflow-hidden">
                                <div className="flex items-baseline justify-between px-4 pt-3.5 pb-3">
                                    <p className="text-[14px] font-semibold text-matn">Eng katta qarzdorlar</p>
                                    <span className="text-[12px] text-matn-sokin">jami <span className="raqam">{metrics.debtors.length}</span> ta</span>
                                </div>
                                {metrics.topDebtors.map(d => (
                                    <div key={d.id} onClick={() => navigate(`/students/${d.id}`)}
                                        className="flex items-center gap-3 px-4 py-2.5 border-t border-chiziq-mayin hover:bg-ichki transition-colors cursor-pointer">
                                        <span className="text-[13px] text-matn flex-1 min-w-0 truncate">{displayName(d.name)}</span>
                                        <span className="num text-[13px] text-xato w-36 text-right">{d.balance.toLocaleString('ru-RU')}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* To'lov usullari + Xarajat kategoriyalari */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-ichki/40 rounded-2xl border border-chiziq p-5">
                                <p className="text-[11px] font-bold text-matn-xira mb-4">Bu oy to'lov usullari</p>
                                {metrics.typeSlices.length > 0
                                    ? <DonutChart slices={metrics.typeSlices} size={140} />
                                    : <p className="text-[11px] text-matn-xira font-bold text-center py-8">Bu oy to'lovlar yo'q</p>
                                }
                            </div>
                            <div className="bg-ichki/40 rounded-2xl border border-chiziq p-5">
                                <p className="text-[11px] font-bold text-matn-xira mb-4">Bu oy xarajat kategoriyalari</p>
                                {metrics.catBars.length > 0
                                    ? <BarChart data={metrics.catBars} horizontal />
                                    : <p className="text-[11px] text-matn-xira font-bold text-center py-8">Bu oy xarajatlar yo'q</p>
                                }
                            </div>
                        </div>

                        {/* O'tgan oy taqqoslash */}
                        <div className="bg-ichki/40 rounded-2xl border border-chiziq p-5">
                            <p className="text-[11px] font-bold text-matn-xira mb-4">
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
                                            <p className="text-[11px] font-bold text-matn-xira mb-2">{item.label}</p>
                                            <p className="text-lg font-black text-matn tabular-nums">{item.cur.toLocaleString()}</p>
                                            <p className="text-[11px] text-matn-xira tabular-nums mt-0.5">{item.prev.toLocaleString()} o'tgan oy</p>
                                            {diff !== 0 && (
                                                <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold mt-1 px-2 py-0.5 rounded-lg ${(item.pos ? isUp : !isUp) ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-rose-600 bg-rose-50 dark:bg-rose-950/30'}`}>
                                                    {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                                    {Math.abs(diff).toLocaleString()} UZS
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* O'quvchilar balansi va qarzdorligi */}
                        <div className="border-t border-chiziq/80 pt-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                                <p className="text-[11px] font-bold text-matn-xira">
                                    O'quvchilar moliyaviy holati va qarzdorligi
                                </p>
                                <div className="flex items-center gap-1 bg-ichki p-1 rounded-xl border border-chiziq self-start sm:self-auto">
                                    {[
                                        { value: 'all', label: "Barcha o'quvchilar" },
                                        { value: 'active', label: "Faol o'quvchilar" },
                                        { value: 'inactive', label: "Ketgan / Nofaol" }
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setStudentStatus(opt.value as any)}
                                            className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                                                studentStatus === opt.value
                                                    ? 'bg-brand text-brand-ust shadow'
                                                    : 'text-matn-xira hover:text-gray-600'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Asosiy 2 ta moliyaviy metrika */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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

                            {/* O'quvchilar moliyaviy holati bloklari */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/40 p-4">
                                    <span className="text-[11px] font-bold text-rose-500 block mb-1">Qarzdorlar</span>
                                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{metrics.debtors.length} ta</p>
                                    <p className="text-[11px] font-bold text-rose-400 mt-1 tabular-nums">{metrics.totalDebt.toLocaleString()} UZS</p>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 p-4">
                                    <span className="text-[11px] font-bold text-emerald-500 block mb-1">Musbat balans</span>
                                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.creditors.length} ta</p>
                                    <p className="text-[11px] font-bold text-emerald-400 mt-1 tabular-nums">{metrics.totalCredit.toLocaleString()} UZS</p>
                                </div>
                                <div className="bg-ichki rounded-2xl border border-chiziq p-4">
                                    <span className="text-[11px] font-bold text-matn-xira block mb-1">Nol balans</span>
                                    <p className="text-2xl font-black text-matn-2">{metrics.zeroBalanceCount} ta</p>
                                    <p className="text-[11px] font-bold text-matn-xira mt-1">to'langan</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/40 p-4">
                                    <span className="text-[11px] font-bold text-amber-500 block mb-1">Bu oy to'lamagan</span>
                                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{metrics.unpaidCount} ta</p>
                                    <p className="text-[11px] font-bold text-amber-400 mt-1">faol o'quvchi</p>
                                </div>
                            </div>
                        </div>

                        {/* Qarz yoshi bo'yicha. Umumiy qarz raqami "qanchalik
                            jiddiy" ekanini ko'rsatmaydi — 15 kunlik qarz bilan
                            60 kunlikning farqi katta. */}
                        {metrics.debtors.length > 0 && (
                            <div>
                                <p className="text-[13px] font-semibold text-matn mb-3">Qarz yoshi bo'yicha</p>
                                <div className="space-y-2.5">
                                    {metrics.debtAge.map(b => (
                                        <div key={b.label}>
                                            <div className="flex items-center justify-between text-[12px]">
                                                <span className="text-matn-sokin">
                                                    {b.label}
                                                    {b.count > 0 && <span className="num text-matn-xira"> · {b.count}</span>}
                                                </span>
                                                <span className="num text-matn-2">
                                                    {(b.sum / 1000000).toFixed(1)} mln
                                                </span>
                                            </div>
                                            <div className="mt-1 h-1.5 rounded-full bg-chiziq overflow-hidden">
                                                <div className={`h-full rounded-full ${b.color}`}
                                                    style={{ width: `${Math.round((b.sum / metrics.debtAgeMax) * 100)}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Top qarzdorlar */}
                        {metrics.topDebtors.length > 0 && (
                            <div>
                                <p className="text-[11px] font-bold text-matn-xira mb-4">Eng ko'p qarzdorlar (top 5)</p>
                                <div className="space-y-2">
                                    {metrics.topDebtors.map((st, i) => (
                                        <div
                                            key={st.id}
                                            onClick={() => navigate(`/students/${st.id}`)}
                                            className="flex items-center justify-between px-4 py-3 bg-rose-50/60 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-[11px] font-bold text-rose-300 w-5">{i + 1}.</span>
                                                <div>
                                                    <p className="text-xs font-bold text-matn">{st.name}</p>
                                                    {st.phone && <p className="text-[11px] text-matn-xira font-bold mt-0.5">{st.phone}</p>}
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
                                    <div className="bg-ichki/40 rounded-2xl border border-chiziq overflow-hidden">
                                        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-chiziq">
                                            <div className="flex-1">
                                                <p className="text-[11px] font-bold text-matn-xira">To'lovlar ro'yxati</p>
                                                <p className="text-[11px] font-bold text-brand mt-0.5">{filterLabel} — {rPayments.length} ta yozuv • Jami: {rPayTotal.toLocaleString()} UZS</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 bg-sirt p-1 rounded-xl border border-chiziq">
                                                    {(['thisMonth','lastMonth','all'] as const).map(f => (
                                                        <button key={f} onClick={() => { setReportFilter(f); setPayPage(0); setBalPage(0); }}
                                                            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${reportFilter === f ? 'bg-brand text-brand-ust shadow' : 'text-matn-xira hover:text-gray-600'}`}>
                                                            {f === 'thisMonth' ? 'Bu oy' : f === 'lastMonth' ? "O'tgan oy" : 'Hammasi'}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button onClick={() => downloadCSV(`tolOvlar_${filterLabel}.csv`, rPayments.map(p => {
                                                    const s = students.find(st => st.id === p.studentId);
                                                    return { "O'quvchi": s?.name || '', "Summa (UZS)": p.amount, "Turi": p.type, "Sana": p.date, "Izoh": p.description || '' };
                                                }))}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-brand hover:bg-brand-dark text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer">
                                                    <ArrowUpRight size={11} /> CSV
                                                </button>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-chiziq">
                                                        {["O'QUVCHI", "SUMMA", "TURI", "SANA", "IZOH"].map(h => (
                                                            <th key={h} className="py-3 px-4 text-[11px] font-bold text-matn-xira whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/30">
                                                    {pagePayments.length === 0 ? (
                                                        <tr><td colSpan={5} className="py-10 text-center text-[11px] font-bold text-matn-xira">To'lovlar topilmadi</td></tr>
                                                    ) : pagePayments.map(p => {
                                                        const s = students.find(st => st.id === p.studentId);
                                                        return (
                                                            <tr key={p.id} onClick={() => s && navigate(`/students/${s.id}`)}
                                                                className="hover:bg-white dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                                                                <td className="py-3 px-4 text-xs font-bold text-matn">{s?.name || 'Noma\'lum'}</td>
                                                                <td className="py-3 px-4 text-xs font-black text-emerald-600 tabular-nums">+{p.amount.toLocaleString()} UZS</td>
                                                                <td className="py-3 px-4"><span className="px-2 py-0.5 bg-chiziq text-[11px] font-bold rounded-lg text-matn-2">{p.type}</span></td>
                                                                <td className="py-3 px-4 text-[11px] font-bold text-matn-sokin tabular-nums">{p.date}</td>
                                                                <td className="py-3 px-4 text-[11px] text-matn-xira">{p.description || '—'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {pTotalPages > 1 && (
                                            <div className="flex items-center justify-between px-5 py-3 border-t border-chiziq">
                                                <span className="text-[11px] font-bold text-matn-xira">{rPayments.length} ta yozuv</span>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setPayPage(p => Math.max(0, p - 1))} disabled={pPage === 0}
                                                        className="px-3 py-1 text-[11px] font-bold border border-chiziq rounded-lg disabled:opacity-30 hover:bg-chiziq cursor-pointer transition-all">Oldin</button>
                                                    <span className="text-[11px] font-bold text-matn-2">{pPage + 1}/{pTotalPages}</span>
                                                    <button onClick={() => setPayPage(p => Math.min(pTotalPages - 1, p + 1))} disabled={pPage === pTotalPages - 1}
                                                        className="px-3 py-1 text-[11px] font-bold border border-chiziq rounded-lg disabled:opacity-30 hover:bg-chiziq cursor-pointer transition-all">Keyin</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Barcha talabalar balansi */}
                                    <div className="bg-ichki/40 rounded-2xl border border-chiziq overflow-hidden">
                                        <div className="px-5 py-4 flex items-center justify-between border-b border-chiziq">
                                            <div>
                                                <p className="text-[11px] font-bold text-matn-xira">Barcha talabalar balansi</p>
                                                <p className="text-[11px] font-bold text-brand mt-0.5">{allStudents.length} ta o'quvchi</p>
                                            </div>
                                            <button onClick={() => downloadCSV('talabalar_balansi.csv', allStudents.map(s => {
                                                const lp = lastPayMap[s.id];
                                                return { "Ism Familiya": s.name, "Status": s.status, "Balans (UZS)": s.balance, "So'nggi to'lov": lp?.date || '—', "Summa": lp ? lp.amount : 0 };
                                            }))}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-brand hover:bg-brand-dark text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer">
                                                <ArrowUpRight size={11} /> CSV
                                            </button>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-chiziq">
                                                        {["ISM FAMILIYA", "STATUS", "BALANS (UZS)", "SO'NGGI TO'LOV", "SUMMA"].map(h => (
                                                            <th key={h} className="py-3 px-4 text-[11px] font-bold text-matn-xira whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/30">
                                                    {pageStudents.length === 0 ? (
                                                        <tr><td colSpan={5} className="py-10 text-center text-[11px] font-bold text-matn-xira">O'quvchilar topilmadi</td></tr>
                                                    ) : pageStudents.map(s => {
                                                        const lp = lastPayMap[s.id];
                                                        return (
                                                            <tr key={s.id} onClick={() => navigate(`/students/${s.id}`)}
                                                                className="hover:bg-white dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                                                                <td className="py-3 px-4 text-xs font-bold text-matn">{s.name}</td>
                                                                <td className="py-3 px-4"><span className={`px-2 py-0.5 text-[11px] font-bold rounded-lg ${s.status === 'Faol' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-gray-100 text-matn-sokin dark:bg-gray-700 dark:text-gray-400'}`}>{s.status}</span></td>
                                                                <td className={`py-3 px-4 text-xs font-black tabular-nums ${s.balance < 0 ? 'text-rose-600' : s.balance > 0 ? 'text-emerald-600' : 'text-matn-sokin'}`}>{s.balance.toLocaleString()}</td>
                                                                <td className="py-3 px-4 text-[11px] font-bold text-matn-sokin tabular-nums">{lp?.date || '—'}</td>
                                                                <td className="py-3 px-4 text-[11px] font-bold text-matn-2 tabular-nums">{lp ? lp.amount.toLocaleString() + ' UZS' : '—'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {bTotalPages > 1 && (
                                            <div className="flex items-center justify-between px-5 py-3 border-t border-chiziq">
                                                <span className="text-[11px] font-bold text-matn-xira">{allStudents.length} ta o'quvchi</span>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setBalPage(p => Math.max(0, p - 1))} disabled={bPage === 0}
                                                        className="px-3 py-1 text-[11px] font-bold border border-chiziq rounded-lg disabled:opacity-30 hover:bg-chiziq cursor-pointer transition-all">Oldin</button>
                                                    <span className="text-[11px] font-bold text-matn-2">{bPage + 1}/{bTotalPages}</span>
                                                    <button onClick={() => setBalPage(p => Math.min(bTotalPages - 1, p + 1))} disabled={bPage === bTotalPages - 1}
                                                        className="px-3 py-1 text-[11px] font-bold border border-chiziq rounded-lg disabled:opacity-30 hover:bg-chiziq cursor-pointer transition-all">Keyin</button>
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
                    <div className="p-4 space-y-6">
                        {/* Month selector header */}
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-black text-matn tracking-tight">Oylik hisob-kitob kitobi</h3>
                                <p className="text-[11px] font-bold text-matn-xira mt-0.5">Moliyaviy nazorat paneli</p>
                            </div>
                            <div className="flex items-center gap-2 bg-ichki/60 p-1.5 rounded-2xl border border-chiziq">
                                <button onClick={prevBillingMonth} className="w-8 h-8 flex items-center justify-center rounded-xl border border-chiziq hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer">
                                    <ChevronLeft size={14} className="text-matn-sokin" />
                                </button>
                                <div className="text-center min-w-[110px]">
                                    <p className="text-xs font-black text-matn">{billingMonthLabel(billingMonth)}</p>
                                </div>
                                <button onClick={nextBillingMonth} className="w-8 h-8 flex items-center justify-center rounded-xl border border-chiziq hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer">
                                    <ChevronRight size={14} className="text-matn-sokin" />
                                </button>
                            </div>
                        </div>

                        {/* Billing status badge */}
                        {billingData && (
                            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-[11px] font-bold ${billingData.billingDone ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-gray-50 dark:bg-gray-950/20 border-gray-100 dark:border-gray-900/40 text-matn-sokin'}`}>
                                {billingData.billingDone
                                    ? <><CheckCircle2 size={14} /> {billingMonthLabel(billingMonth)} — oylik hisob-kitob avtomatik o'tkazilgan</>
                                    : <><AlertCircle size={14} /> {billingMonthLabel(billingMonth)} — kelgusi oy uchun hisob-kitob hali boshlanmagan</>
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
                                <p className="text-[11px] font-bold text-matn-xira">Ma'lumot yuklanmoqda...</p>
                            </div>
                        )}

                        {/* Students status table */}
                        {billingData && billingData.students.length > 0 && (
                            <div className="bg-ichki/40 rounded-2xl border border-chiziq overflow-hidden">
                                <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-chiziq">
                                    <div className="flex-1">
                                        <p className="text-[11px] font-bold text-matn-xira">O'quvchilar to'lov holati</p>
                                        <p className="text-[11px] font-bold text-violet-600 mt-0.5">{billingData.students.length} ta faol o'quvchi</p>
                                    </div>
                                    <div className="flex items-center gap-1 bg-sirt p-1 rounded-xl border border-chiziq">
                                        {(['all', 'paid', 'partial', 'unpaid'] as const).map(f => (
                                            <button key={f} onClick={() => setBillingFilter(f)}
                                                className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${billingFilter === f
                                                    ? f === 'paid' ? 'bg-emerald-500 text-white' : f === 'unpaid' ? 'bg-rose-500 text-white' : f === 'partial' ? 'bg-amber-500 text-white' : 'bg-violet-600 text-white shadow'
                                                    : 'text-matn-xira hover:text-gray-600'}`}>
                                                {f === 'all' ? 'Barchasi' : f === 'paid' ? 'To\'lagan' : f === 'partial' ? 'Qisman' : 'To\'lamagan'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-chiziq">
                                                {["O'QUVCHI", "GURUHLAR", "KUTILGAN", "TO'LANGAN", "BALANS", "HOLAT"].map(h => (
                                                    <th key={h} className="py-3 px-4 text-[11px] font-bold text-matn-xira whitespace-nowrap">{h}</th>
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
                                                            <p className="text-xs font-bold text-matn">{st.name}</p>
                                                            {st.phone && <p className="text-[11px] text-matn-xira font-bold mt-0.5">{st.phone}</p>}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex flex-wrap gap-1">
                                                                {st.groups.map((g: any) => (
                                                                    <span key={g.groupId} className="px-1.5 py-0.5 bg-violet-50 dark:bg-violet-950/20 text-[10px] font-bold text-violet-600 dark:text-violet-400 rounded-md">
                                                                        {g.groupName}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-xs font-black text-matn-2 tabular-nums">{st.expected.toLocaleString()} UZS</td>
                                                        <td className="py-3 px-4 text-xs font-black text-emerald-600 tabular-nums">{st.paid.toLocaleString()} UZS</td>
                                                        <td className={`py-3 px-4 text-xs font-black tabular-nums ${st.balance < 0 ? 'text-rose-600' : st.balance > 0 ? 'text-emerald-600' : 'text-matn-xira'}`}>
                                                            {st.balance.toLocaleString()} UZS
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className={`px-2 py-1 text-[10px] font-bold rounded-lg ${st.status === 'paid' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : st.status === 'partial' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'}`}>
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
                                <p className="text-[11px] font-bold text-matn-xira mb-4">Guruhlar bo'yicha breakdown</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {billingData.groups.filter(g => g.totalStudents > 0).map((g: any) => (
                                        <div key={g.groupId} className="bg-ichki/40 rounded-2xl border border-chiziq p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <p className="text-xs font-black text-matn">{g.groupName}</p>
                                                    <p className="text-[11px] text-matn-xira font-bold mt-0.5">{g.courseName}</p>
                                                </div>
                                                <span className="text-[11px] font-bold text-violet-600 bg-violet-50 dark:bg-violet-950/20 px-2 py-0.5 rounded-lg">{g.totalStudents} o'quvchi</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl px-3 py-2">
                                                    <span className="font-black text-emerald-600 block text-xs">{g.paidCount}</span>
                                                    <span className="text-emerald-500 font-bold">To'lagan</span>
                                                </div>
                                                <div className="bg-rose-50 dark:bg-rose-950/20 rounded-xl px-3 py-2">
                                                    <span className="font-black text-rose-600 block text-xs">{g.unpaidCount}</span>
                                                    <span className="text-rose-500 font-bold">To'lamagan</span>
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-chiziq flex justify-between text-[11px] font-bold text-matn-sokin">
                                                <span>Kutilgan: <span className="text-matn-2 font-black">{g.expected.toLocaleString()}</span></span>
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
                                    className="flex items-center gap-2 px-5 py-3 bg-brand hover:bg-brand-dark text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer shadow-sm shadow-[#1b6b6b]/20"
                                    onClick={() => setShowDebtNotifyModal(true)}
                                >
                                    <MessageSquare size={14} />
                                    To'lamaganlar uchun xabar yuborish ({billingData.students.filter((st: any) => st.status !== 'paid').length} ta)
                                </button>
                            </div>
                        )}

                        {!billingData && !billingLoading && (
                            <div className="py-16 text-center">
                                <Calendar size={32} className="text-gray-300 mx-auto mb-3" />
                                <p className="text-[11px] font-bold text-matn-xira">Ma'lumot yuklanmadi</p>
                                <button onClick={loadBillingStatus} className="mt-3 text-[11px] font-bold text-violet-600 hover:underline cursor-pointer">Qayta urinish</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Summary row — only for payments/expenses */}
                {(activeTab === 'payments' || activeTab === 'expenses') && (
                    <div className="px-6 py-3 border-b border-chiziq-mayin/30 flex items-center gap-4">
                        <span className="text-[11px] font-bold text-matn-xira">{dateLabel}</span>
                        {activeTab === 'payments' ? (
                            <>
                                <span className="text-[11px] font-bold text-matn-xira">{filteredPayments.length} ta to'lov</span>
                                <span className="text-[11px] font-bold text-emerald-600 tabular-nums ml-auto">+{filteredRevenue.toLocaleString()} UZS</span>
                            </>
                        ) : (
                            <>
                                <span className="text-[11px] font-bold text-matn-xira">{filteredExpenses.length} ta xarajat</span>
                                <span className="text-[11px] font-bold text-rose-600 tabular-nums ml-auto">-{filteredExpenditure.toLocaleString()} UZS</span>
                            </>
                        )}
                    </div>
                )}

                {/* List */}
                {(activeTab === 'payments' || activeTab === 'expenses') && (
                    <div className="divide-y divide-gray-50 dark:divide-gray-700/30 max-h-[520px] overflow-y-auto">
                        {activeTab === 'payments' ? (
                            filteredPayments.length === 0 ? (
                                <p className="text-center py-12 text-[11px] text-matn-xira font-bold">To'lovlar topilmadi</p>
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
                                                <p className="text-xs font-bold text-matn truncate">{student?.name || "Noma'lum"}</p>
                                                <span className="text-[11px] text-matn-xira font-bold block mt-0.5">{p.date} • {p.type}</span>
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
                                            <span className="text-[11px] text-matn-xira font-bold block mt-0.5">{e.date}{e.description ? ` • ${e.description}` : ''}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-xs font-black text-rose-600 tabular-nums">-{e.amount.toLocaleString()} UZS</span>
                                        <button onClick={async () => { if (await confirm(`Harajat o'chirilsinmi?

${e.description || e.category} — ${Number(e.amount).toLocaleString()} so'm`)) deleteExpense(e.id); }} className="w-7 h-7 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center justify-center transition-colors cursor-pointer">
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
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={closePaymentModal} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-md p-8 overflow-hidden">

                        {createdPaymentForReceipt ? (
                            <div className="space-y-6">
                                <div className="text-center space-y-1">
                                    <h3 className="text-sm font-black text-brand">SARIOSIYO CENTER</h3>
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
                                    setIsSavingPayment(true);
                                    try {
                                        const created = await addPayment({
                                            studentId: selectedStudent.id,
                                            amount: newPayment.amount,
                                            type: newPayment.type,
                                            description: newPayment.description || '',
                                            date: newPayment.date
                                        });
                                        setCreatedPaymentForReceipt(created);
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
                                                        (s.phone && s.phone.includes(studentSearch))
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
                                                        (s.phone && s.phone.includes(studentSearch))
                                                    ).length === 0 && (
                                                        <div className="px-4 py-4 text-center text-[11px] text-matn-xira font-bold">O'quvchi topilmadi</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-ichki rounded-2xl border border-chiziq/80 relative space-y-3">
                                            <button type="button"
                                                onClick={() => { setSelectedStudent(null); setNewPayment({ ...newPayment, studentId: 0 }); }}
                                                className="absolute top-3.5 right-3.5 text-[11px] text-rose-500 font-bold hover:underline cursor-pointer bg-sirt px-2.5 py-1 rounded-lg border border-chiziq">
                                                O'zgartirish
                                            </button>
                                            <div>
                                                <span className="text-[10px] font-bold text-brand block">Tanlangan o'quvchi</span>
                                                <h4 className="text-xs font-bold text-matn mt-0.5">{selectedStudent.name}</h4>
                                                {selectedStudent.phone && <p className="text-[11px] text-matn-xira font-bold mt-0.5">{selectedStudent.phone}</p>}
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
                                                        const sp = payments.filter(p => p.studentId === selectedStudent.id && p.amount > 0);
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

                                    <div>
                                        <label className={lbl}>Summa (UZS) *</label>
                                        <input type="number" required placeholder="Masalan: 500 000" className={inp}
                                            value={newPayment.amount || ''}
                                            onChange={(e) => setNewPayment({ ...newPayment, amount: Number(e.target.value) })} />
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {[300000, 400000, 500000, 600000, 800000].map(amt => (
                                                <button key={amt} type="button"
                                                    onClick={() => setNewPayment({ ...newPayment, amount: amt })}
                                                    className={`px-3 py-1.5 text-[11px] font-bold border rounded-xl transition-all cursor-pointer ${newPayment.amount === amt ? 'bg-brand border-brand text-white shadow-sm' : 'bg-ichki/30 dark:border-gray-800 hover:bg-gray-100 text-matn-sokin'}`}>
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
                                                    className={`py-2.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${newPayment.type === tType ? 'bg-brand border-brand text-white shadow-sm shadow-[#1b6b6b]/20' : 'bg-sirt border-chiziq text-matn-xira hover:bg-gray-50'}`}>
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

                                    <div className="flex gap-3 pt-4 border-t border-chiziq-mayin/50">
                                        <button type="button" onClick={closePaymentModal}
                                            className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                            {t('cancel')}
                                        </button>
                                        <button type="submit" disabled={!selectedStudent || isSavingPayment}
                                            className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold rounded-2xl shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                                            {isSavingPayment ? 'Saqlanmoqda…' : t('save')}
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
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsExpenseModalOpen(false)} />
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

            {/* Debt Notify Modal */}
            {showDebtNotifyModal && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowDebtNotifyModal(false)} />
                    <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-lg p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq-mayin/50">
                            <div>
                                <h3 className="text-sm font-black text-matn tracking-tight text-brand">Qarzdorlarga Xabar Yuborish</h3>
                                <p className="text-[11px] font-bold text-matn-xira mt-0.5">Oylik hisob-kitob bo'yicha</p>
                            </div>
                            <button aria-label="Yopish" onClick={() => setShowDebtNotifyModal(false)} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className={lbl}>O'quvchilar Turi</label>
                                <div className="flex gap-2">
                                    {([
                                        { value: 'active', label: "Faol o'quvchilar" },
                                        { value: 'passive', label: "Ketgan o'quvchilar" },
                                        { value: 'all', label: 'Hammasi' },
                                    ] as const).map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setDebtNotifyStatusFilter(opt.value)}
                                            className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer ${
                                                debtNotifyStatusFilter === opt.value
                                                    ? 'bg-brand text-brand-ust border-brand'
                                                    : 'bg-gray-50 dark:bg-gray-700 text-matn-2 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>Xabar Yuborish Kanali</label>
                                <select className={inp} value={debtNotifyChannel} onChange={e => setDebtNotifyChannel(e.target.value as any)}>
                                    <option value="BOTH">Telegram Bot & SMS (Telegram yo'q bo'lsa SMS)</option>
                                    <option value="TELEGRAM">Faqat Telegram Bot</option>
                                    <option value="SMS">Faqat SMS</option>
                                </select>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className={lbl}>Xabar Shablon Matni</label>
                                    <span className="text-[11px] text-matn-xira font-bold">Placeholder: {"{ism}"}, {"{oylik}"}, {"{qarz}"}, {"{markaz}"}</span>
                                </div>
                                <textarea
                                    className={`${inp} min-h-[120px] py-3 text-xs leading-relaxed`}
                                    value={debtNotifyTemplate}
                                    onChange={e => setDebtNotifyTemplate(e.target.value)}
                                    placeholder="Masalan: Hurmatli {ism}, sizning {oylik} oyi uchun qarzingiz {qarz} UZS..."
                                />
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl p-4 text-[11px] text-amber-700 dark:text-amber-400 font-bold space-y-1">
                                <p>⚠️ DIQQAT: Xabar {debtNotifyStatusFilter === 'passive' ? "ketgan/passiv" : debtNotifyStatusFilter === 'all' ? "barcha" : "faol"} qarzdor o'quvchilarga yuboriladi.</p>
                                <p>SMS orqali yuborilsa, Eskiz SMS balansingizdan haq yechiladi.</p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowDebtNotifyModal(false)} disabled={isSendingDebtNotify}
                                    className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                    {t('cancel')}
                                </button>
                                <button type="button" onClick={handleSendDebtNotifications} disabled={isSendingDebtNotify}
                                    className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white text-xs font-extrabold rounded-2xl shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer flex items-center justify-center gap-2">
                                    {isSendingDebtNotify ? (
                                        <>
                                            <RefreshCw size={12} className="animate-spin" /> Yuborilmoqda...
                                        </>
                                    ) : (
                                        <>
                                            <MessageSquare size={12} /> Xabarlarni yuborish
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
