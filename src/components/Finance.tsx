import { useState, useMemo } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, Wallet,
    Plus, X, Trash2, Search, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';
import { Payment, Expense } from '../types';

const inp = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

const MONTHS = ['Yan','Fev','Mar','Apr','May','Iyun','Iyul','Avg','Sen','Okt','Noy','Dek'];

export default function Finance() {
    const { students, payments, expenses, addPayment, addExpense, deleteExpense, groups, courses } = useCRM();
    const { t } = useLang();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'payments' | 'expenses'>('payments');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

    // List filters
    const [listSearch, setListSearch] = useState('');
    const [dateFilter, setDateFilter] = useState<'all' | 'thisMonth' | 'lastMonth'>('thisMonth');

    // Payment modal state
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [createdPaymentForReceipt, setCreatedPaymentForReceipt] = useState<any>(null);
    const [newPayment, setNewPayment] = useState<Omit<Payment, 'id' | 'schoolId'>>({
        studentId: 0, amount: 0, type: 'Naqd', description: '', date: new Date().toISOString().split('T')[0]
    });
    const [newExpense, setNewExpense] = useState<Omit<Expense, 'id' | 'schoolId'>>({
        amount: 0, category: 'Boshqa', description: '', date: new Date().toISOString().split('T')[0]
    });

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
  <div style="margin-bottom:10px">
    <span class="label">O'quvchi:</span>
    <div class="big">${student?.name || ''}</div>
  </div>
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

    // Stats
    const totalRevenue = payments.filter(p => p.amount > 0).reduce((sum, p) => sum + p.amount, 0);
    const totalExpenditure = expenses.reduce((sum, e) => sum + e.amount, 0);
    const profit = totalRevenue - totalExpenditure;
    const activeBalance = students.filter(s => s.balance > 0).reduce((sum, s) => sum + s.balance, 0);

    const now = new Date();
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const dateLabel = dateFilter === 'thisMonth'
        ? `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
        : dateFilter === 'lastMonth'
            ? `${MONTHS[lastMonthDate.getMonth()]} ${lastMonthDate.getFullYear()}`
            : 'Barchasi';

    const filteredPayments = useMemo(() => {
        return payments
            .filter(p => p.amount > 0)
            .filter(p => {
                if (dateFilter === 'thisMonth') return p.date.startsWith(thisMonthPrefix);
                if (dateFilter === 'lastMonth') return p.date.startsWith(lastMonthPrefix);
                return true;
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
            .slice()
            .reverse();
    }, [payments, dateFilter, listSearch, students, thisMonthPrefix, lastMonthPrefix]);

    const filteredExpenses = useMemo(() => {
        return expenses
            .filter(e => {
                if (dateFilter === 'thisMonth') return e.date.startsWith(thisMonthPrefix);
                if (dateFilter === 'lastMonth') return e.date.startsWith(lastMonthPrefix);
                return true;
            })
            .filter(e => {
                if (!listSearch.trim()) return true;
                const q = listSearch.toLowerCase();
                return (
                    e.category.toLowerCase().includes(q) ||
                    (e.description || '').toLowerCase().includes(q)
                );
            })
            .slice()
            .reverse();
    }, [expenses, dateFilter, listSearch, thisMonthPrefix, lastMonthPrefix]);

    const filteredRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const filteredExpenditure = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    const stats = [
        { label: t('stat_revenue'), value: totalRevenue, icon: <DollarSign size={20} />, color: 'emerald' },
        { label: t('stat_expenses'), value: totalExpenditure, icon: <TrendingDown size={20} />, color: 'rose' },
        { label: t('stat_profit'), value: profit, icon: <TrendingUp size={20} />, color: 'teal' },
        { label: t('stat_balance'), value: activeBalance, icon: <Wallet size={20} />, color: 'amber' },
    ];

    const colorVariants: Record<string, string> = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40',
        rose: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40',
        teal: 'bg-teal-50 text-[#1b6b6b] border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40',
        amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40'
    };

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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm flex items-center justify-between group">
                        <div>
                            <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1">{stat.label}</span>
                            <h4 className="text-xl font-black text-gray-900 dark:text-white tracking-tight tabular-nums">{stat.value.toLocaleString()} UZS</h4>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-105 ${colorVariants[stat.color]}`}>
                            {stat.icon}
                        </div>
                    </div>
                ))}
            </div>

            {/* Main List */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
                {/* Tabs + Filters */}
                <div className="px-6 pt-5 pb-4 border-b border-gray-50 dark:border-gray-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700/50 w-fit">
                        <button onClick={() => { setActiveTab('payments'); setListSearch(''); }} className={`px-5 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'payments' ? 'bg-[#1b6b6b] text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>{t('payments_tab')}</button>
                        <button onClick={() => { setActiveTab('expenses'); setListSearch(''); }} className={`px-5 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'expenses' ? 'bg-[#1b6b6b] text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>{t('expenses_tab')}</button>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Date filter */}
                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-700/50">
                            {(['thisMonth', 'lastMonth', 'all'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setDateFilter(f)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${dateFilter === f ? 'bg-[#1b6b6b] text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {f === 'thisMonth' ? 'Bu oy' : f === 'lastMonth' ? "O'tgan oy" : 'Barchasi'}
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder={activeTab === 'payments' ? "O'quvchi ismi..." : "Kategoriya..."}
                                value={listSearch}
                                onChange={e => setListSearch(e.target.value)}
                                className="pl-8 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] w-40 transition-all"
                            />
                            {listSearch && (
                                <button onClick={() => setListSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 cursor-pointer">
                                    <X size={11} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Summary row */}
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

                {/* List */}
                <div className="divide-y divide-gray-50 dark:divide-gray-700/30 max-h-[520px] overflow-y-auto">
                    {activeTab === 'payments' ? (
                        filteredPayments.length === 0 ? (
                            <p className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">To'lovlar topilmadi</p>
                        ) : filteredPayments.map(p => {
                            const student = students.find(s => s.id === p.studentId);
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => student && navigate(`/students/${student.id}`)}
                                    className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50/70 dark:hover:bg-gray-900/40 transition-all cursor-pointer group"
                                >
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
                                        <p className="text-xs font-bold text-gray-900 dark:text-white uppercase truncate">{e.category}</p>
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
                                            <span className="text-[9px] text-gray-450 uppercase block">O'quvchi:</span>
                                            <span className="font-black text-gray-900 dark:text-white text-[13px]">{selectedStudent?.name}</span>
                                        </div>
                                        {selectedStudent?.phone && (
                                            <div><span className="text-[9px] text-gray-450 uppercase block">Telefon:</span><span>{selectedStudent.phone}</span></div>
                                        )}
                                        {(() => {
                                            const sg = groups.filter(g => (g.studentIds || []).includes(selectedStudent?.id));
                                            if (!sg.length) return null;
                                            return (
                                                <div>
                                                    <span className="text-[9px] text-gray-450 uppercase block">Kurslar:</span>
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
                                    <button
                                        type="button"
                                        onClick={() => handlePrintReceipt(createdPaymentForReceipt, selectedStudent)}
                                        className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer shadow-lg shadow-[#1b6b6b]/20 text-center"
                                    >
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
                                            <input
                                                type="text"
                                                placeholder="Ism yoki telefon raqami..."
                                                className={inp}
                                                value={studentSearch}
                                                onChange={(e) => setStudentSearch(e.target.value)}
                                            />
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
                            setNewExpense({ amount: 0, category: 'Boshqa', description: '', date: new Date().toISOString().split('T')[0] });
                        }} className="space-y-4">
                            <div>
                                <label className={lbl}>Kategoriya *</label>
                                <select required className={inp} value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}>
                                    <option value="Ish haqi">Ish haqi</option>
                                    <option value="Ijara">Ijara</option>
                                    <option value="Kommunal">Kommunal</option>
                                    <option value="Marketing">Marketing</option>
                                    <option value="Boshqa">Boshqa</option>
                                </select>
                            </div>
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
