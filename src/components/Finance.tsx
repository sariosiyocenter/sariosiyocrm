import React, { useState } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, Wallet,
    ArrowUpRight, Plus, X, Trash2, SlidersHorizontal, ListChecks,
    CreditCard, UserMinus, ClipboardList, Award, Target, BarChart3, GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';
import { Payment, Expense } from '../types';

const inp = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

export default function Finance() {
    const { students, payments, expenses, addPayment, addExpense, deleteExpense } = useCRM();
    const { t } = useLang();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'payments' | 'expenses'>('payments');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    
    const [newPayment, setNewPayment] = useState<Omit<Payment, 'id' | 'schoolId'>>({ 
        studentId: 0, amount: 0, type: 'Naqd', description: '', date: new Date().toISOString().split('T')[0] 
    });
    const [newExpense, setNewExpense] = useState<Omit<Expense, 'id' | 'schoolId'>>({ 
        amount: 0, category: 'Boshqa', description: '', date: new Date().toISOString().split('T')[0] 
    });

    // Only count real cash income (positive payments); negative "oyni yopish" entries are internal accounting
    const totalRevenue = payments.filter(p => p.amount > 0).reduce((sum, p) => sum + p.amount, 0);
    const totalExpenditure = expenses.reduce((sum, e) => sum + e.amount, 0);
    const profit = totalRevenue - totalExpenditure;
    const activeBalance = students.filter(s => s.balance > 0).reduce((sum, s) => sum + s.balance, 0);

    const stats = [
        { label: t('stat_revenue'), value: totalRevenue, icon: <DollarSign size={20} />, color: 'emerald' },
        { label: t('stat_expenses'), value: totalExpenditure, icon: <TrendingDown size={20} />, color: 'rose' },
        { label: t('stat_profit'), value: profit, icon: <TrendingUp size={20} />, color: 'teal' },
        { label: t('stat_balance'), value: activeBalance, icon: <Wallet size={20} />, color: 'amber' },
    ];

    const reports = [
        { id: 'payments', label: t('rep_payments'), icon: <DollarSign size={14} className="text-emerald-500" /> },
        { id: 'students_payment', label: t('rep_students_payment'), icon: <CreditCard size={14} className="text-blue-500" /> },
        { id: 'left_students', label: t('rep_left_students'), icon: <UserMinus size={14} className="text-rose-500" /> },
        { id: 'staff_attendance', label: t('rep_staff_attendance'), icon: <ClipboardList size={14} className="text-teal-500" /> },
        { id: 'bonuses', label: t('rep_bonuses'), icon: <Award size={14} className="text-amber-500" /> },
        { id: 'leads', label: t('rep_leads'), icon: <Target size={14} className="text-indigo-500" /> },
        { id: 'students_general', label: t('rep_students_general'), icon: <BarChart3 size={14} className="text-violet-500" /> },
        { id: 'graduates', label: t('rep_graduates'), icon: <GraduationCap size={14} className="text-pink-500" /> },
        { id: 'stats', label: t('rep_stats'), icon: <TrendingUp size={14} className="text-cyan-500" /> }
    ];

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

            {/* Stats Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => {
                    const colorVariants: Record<string, string> = {
                        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40',
                        rose: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40',
                        teal: 'bg-teal-50 text-[#1b6b6b] border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40',
                        amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40'
                    };
                    return (
                        <div key={idx} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm flex items-center justify-between group">
                            <div>
                                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1">{stat.label}</span>
                                <h4 className="text-xl font-black text-gray-900 dark:text-white tracking-tight tabular-nums">{stat.value.toLocaleString()} UZS</h4>
                            </div>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-105 ${colorVariants[stat.color]}`}>
                                {stat.icon}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Tab Navigation */}
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700/50 w-fit">
                        <button onClick={() => setActiveTab('payments')} className={`px-5 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'payments' ? 'bg-[#1b6b6b] text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>{t('payments_tab')}</button>
                        <button onClick={() => setActiveTab('expenses')} className={`px-5 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'expenses' ? 'bg-[#1b6b6b] text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>{t('expenses_tab')}</button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm p-6">
                        <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                            {activeTab === 'payments' ? t('latest_payments') : t('latest_expenses')}
                        </h3>
                        {activeTab === 'payments' ? (
                            <div className="space-y-2">
                                {payments.length === 0 ? (
                                    <p className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">To'lovlar mavjud emas</p>
                                ) : (
                                    payments.filter(p => p.amount > 0).slice(-10).reverse().map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-gray-900/40 border border-transparent hover:border-gray-100 transition-all">
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white uppercase">{students.find(s => s.id === p.studentId)?.name || 'Noma\'lum'}</p>
                                                <span className="text-[9px] text-gray-400 font-bold block mt-0.5 uppercase tracking-wide">{p.date} • {p.type}</span>
                                            </div>
                                            <span className="text-xs font-black text-emerald-600">+{p.amount.toLocaleString()} UZS</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {expenses.length === 0 ? (
                                    <p className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Xarajatlar mavjud emas</p>
                                ) : (
                                    expenses.slice(-10).reverse().map(e => (
                                        <div key={e.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-gray-900/40 border border-transparent hover:border-gray-100 transition-all">
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white uppercase">{e.category}</p>
                                                <span className="text-[9px] text-gray-400 font-bold block mt-0.5 uppercase tracking-wide">{e.date} • {e.description || 'Izohsiz'}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-black text-rose-600">-{e.amount.toLocaleString()} UZS</span>
                                                <button onClick={() => deleteExpense(e.id)} className="w-8 h-8 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center justify-center transition-colors cursor-pointer">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Reports links */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden h-fit transition-all hover:shadow-md">
                    <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-[#1b6b6b]">
                                <ListChecks size={15} />
                            </div>
                            <span className="text-xs font-black uppercase text-gray-800 dark:text-gray-250 tracking-wider">Tizim hisobotlari</span>
                        </div>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-750">
                        {reports.map((r) => (
                            <button
                                key={r.id}
                                onClick={() => navigate('/reports', { state: { activeReport: r.id } })}
                                className="w-full px-6 py-3.5 text-left text-[11px] font-bold text-gray-600 dark:text-gray-400 hover:text-[#1b6b6b] dark:hover:text-white hover:bg-gray-50/50 dark:hover:bg-gray-750/30 transition-all flex items-center justify-between uppercase tracking-wider cursor-pointer group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-lg bg-gray-50/80 dark:bg-gray-900 group-hover:bg-white dark:group-hover:bg-gray-800 transition-colors">
                                        {r.icon}
                                    </div>
                                    <span>{r.label}</span>
                                </div>
                                <ArrowUpRight size={14} className="text-gray-400 dark:text-gray-600 group-hover:text-[#1b6b6b] dark:group-hover:text-white transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsPaymentModalOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Yangi Kirim</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">To'lov qabul qilish</p>
                            </div>
                            <button onClick={() => setIsPaymentModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); addPayment(newPayment); setIsPaymentModalOpen(false); }} className="space-y-4">
                            <div>
                                <label className={lbl}>O'quvchi *</label>
                                <select required className={inp} value={newPayment.studentId} onChange={(e) => setNewPayment({...newPayment, studentId: Number(e.target.value)})}>
                                    <option value={0} disabled>Tanlang...</option>
                                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Summa (UZS) *</label>
                                <input type="number" required placeholder="Masalan: 500 000" className={inp} value={newPayment.amount || ''} onChange={(e) => setNewPayment({...newPayment, amount: Number(e.target.value)})}/>
                            </div>
                            <div>
                                <label className={lbl}>Turi *</label>
                                <select className={inp} value={newPayment.type} onChange={(e) => setNewPayment({...newPayment, type: e.target.value as any})}>
                                    <option value="Naqd">Naqd</option>
                                    <option value="Karta">Karta</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsPaymentModalOpen(false)}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                    {t('cancel')}
                                </button>
                                <button type="submit"
                                    className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                                    {t('save')}
                                </button>
                            </div>
                        </form>
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
                        <form onSubmit={(e) => { e.preventDefault(); addExpense(newExpense); setIsExpenseModalOpen(false); }} className="space-y-4">
                            <div>
                                <label className={lbl}>Kategoriya *</label>
                                <select required className={inp} value={newExpense.category} onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}>
                                    <option value="Ish haqi">Ish haqi</option>
                                    <option value="Ijara">Ijara</option>
                                    <option value="Kommunal">Kommunal</option>
                                    <option value="Marketing">Marketing</option>
                                    <option value="Boshqa">Boshqa</option>
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Summa (UZS) *</label>
                                <input type="number" required placeholder="Masalan: 100 000" className={inp} value={newExpense.amount || ''} onChange={(e) => setNewExpense({...newExpense, amount: Number(e.target.value)})}/>
                            </div>
                            <div>
                                <label className={lbl}>Izoh / Tafsilotlar</label>
                                <input type="text" placeholder="Batafsil izoh kiritish..." className={inp} value={newExpense.description} onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}/>
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
