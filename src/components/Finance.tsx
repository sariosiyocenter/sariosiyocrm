import React, { useState } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, Wallet,
    ArrowUpRight, Download, Plus, X, ListChecks, Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { Payment, Expense } from '../types';

export default function Finance() {
    const { students, payments, expenses, addPayment, addExpense, deleteExpense } = useCRM();
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

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalExpenditure = expenses.reduce((sum, e) => sum + e.amount, 0);
    const profit = totalRevenue - totalExpenditure;
    const activeBalance = students.filter(s => s.balance > 0).reduce((sum, s) => sum + s.balance, 0);

    const stats = [
        { label: 'Tushumlar', value: totalRevenue, icon: <DollarSign size={20} />, color: 'emerald', trend: '+12.5%' },
        { label: 'Chiqimlar', value: totalExpenditure, icon: <TrendingDown size={20} />, color: 'rose', trend: '0%' },
        { label: 'Sof Foyda', value: profit, icon: <TrendingUp size={20} />, color: 'sky', trend: '+8.2%' },
        { label: "O'quvchilar balansi", value: activeBalance, icon: <Wallet size={20} />, color: 'amber', trend: '+1.4%' },
    ];

    const reports = [
        { id: 'payments', label: "To'lovlar hisoboti" },
        { id: 'students_payment', label: "O'quvchilar to'lovi" },
        { id: 'left_students', label: "Ketgan o'quvchilar hisoboti" },
        { id: 'staff_attendance', label: "Xodimlar Davomati Hisoboti" },
        { id: 'bonuses', label: "O'quvchilar Bonuslari" },
        { id: 'leads', label: "Lidlar Hisoboti" },
        { id: 'students_general', label: "O'quvchilar Hisoboti" },
        { id: 'graduates', label: "Bitiruvchilar" },
        { id: 'stats', label: "Markaz Faoliyati Statistikasi" }
    ];

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Moliya</h1>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Kirim-chiqimlar va moliyaviy hisobotlar</p>
                </div>
            </div>

            {/* Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                {stats.map((stat, idx) => {
                    const colorVariants: Record<string, string> = {
                        emerald: 'from-emerald-500/20 to-emerald-600/5 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50 ring-emerald-500/10 shadow-emerald-500/5',
                        rose: 'from-rose-500/20 to-rose-600/5 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/50 ring-rose-500/10 shadow-rose-500/5',
                        sky: 'from-sky-500/20 to-sky-600/5 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-800/50 ring-sky-500/10 shadow-sky-500/5',
                        amber: 'from-amber-500/20 to-amber-600/5 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/50 ring-amber-500/10 shadow-amber-500/5'
                    };
                    return (
                        <div key={idx} className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl transition-all group relative overflow-hidden animate-in zoom-in-95 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                            <div className="relative z-10 flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">{stat.label}</p>
                                    <h4 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight tabular-nums">{stat.value.toLocaleString()}</h4>
                                    <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest opacity-60">UZS</p>
                                </div>
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border bg-gradient-to-br ring-4 transition-transform group-hover:scale-110 duration-500 ${colorVariants[stat.color]}`}>
                                    {stat.icon}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Simplified Tabs */}
                    <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-2 rounded-2xl border border-gray-100 dark:border-gray-700 w-fit">
                        <button onClick={() => setActiveTab('payments')} className={`px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'payments' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>To'lovlar</button>
                        <button onClick={() => setActiveTab('expenses')} className={`px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'expenses' ? 'bg-rose-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>Xarajatlar</button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl min-h-[500px]">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                                {activeTab === 'payments' ? <Wallet className="text-sky-500" /> : <TrendingDown className="text-rose-500" />}
                                {activeTab === 'payments' ? 'Tahrirlangan To\'lovlar' : 'Amalga oshirilgan Xarajatlar'}
                            </h3>
                            <button onClick={() => activeTab === 'payments' ? setIsPaymentModalOpen(true) : setIsExpenseModalOpen(true)} className={`px-6 py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-widest text-white shadow-xl transition-all active:scale-95 ${activeTab === 'payments' ? 'bg-sky-600 shadow-sky-500/20' : 'bg-rose-600 shadow-rose-500/20'}`}>
                                <Plus size={16} className="inline mr-2" /> {activeTab === 'payments' ? 'To\'lov' : 'Xarajat'} Qo'shish
                            </button>
                        </div>

                        {activeTab === 'payments' ? (
                            <div className="space-y-4">
                                {payments.length === 0 ? <p className="text-center py-20 text-gray-400 text-xs font-bold uppercase tracking-widest">To'lovlar mavjud emas</p> : 
                                payments.slice(-10).reverse().map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-5 rounded-2xl bg-gray-50/50 dark:bg-gray-900/40 border border-transparent hover:border-sky-100 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-xs">{students.find(s => s.id === p.studentId)?.name.charAt(0) || '?'}</div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white uppercase">{students.find(s => s.id === p.studentId)?.name || 'Noma\'lum'}</p>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{p.date} • {p.type}</p>
                                            </div>
                                        </div>
                                        <p className="text-sm font-extrabold text-emerald-600">+{p.amount.toLocaleString()} UZS</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {expenses.length === 0 ? <p className="text-center py-20 text-gray-400 text-xs font-bold uppercase tracking-widest">Xarajatlar mavjud emas</p> : 
                                expenses.slice(-10).reverse().map(e => (
                                    <div key={e.id} className="flex items-center justify-between p-5 rounded-2xl bg-gray-50/50 dark:bg-gray-900/40 border border-transparent hover:border-rose-100 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs"><TrendingDown size={18}/></div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white uppercase">{e.category}</p>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{e.date} • {e.description || 'Izohsiz'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className="text-sm font-extrabold text-rose-600">-{e.amount.toLocaleString()} UZS</p>
                                            <button onClick={() => deleteExpense(e.id)} className="p-2 text-rose-300 hover:text-rose-600 transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden h-fit">
                    <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50">
                        <h3 className="text-[10px] font-extrabold text-gray-900 dark:text-white uppercase tracking-widest">Hisobotlar</h3>
                    </div>
                    <div className="flex flex-col py-4">
                        {reports.map((r, i) => (
                            <button 
                                key={i} 
                                onClick={() => navigate('/reports', { state: { activeReport: r.id } })}
                                className="px-8 py-4 text-left text-[10px] font-bold text-gray-500 hover:text-sky-600 hover:bg-sky-50 transition-all flex items-center justify-between group uppercase tracking-widest"
                            >
                                {r.label} <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-all"/>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal Components Reuse existing styles */}
            {(isPaymentModalOpen || isExpenseModalOpen) && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 p-10">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-bold uppercase tracking-tight">{isPaymentModalOpen ? 'To\'lov' : 'Xarajat'} Qo'shish</h2>
                            <button onClick={() => { setIsPaymentModalOpen(false); setIsExpenseModalOpen(false); }} className="text-gray-400"><X size={24}/></button>
                        </div>
                        {isPaymentModalOpen ? (
                            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); addPayment(newPayment); setIsPaymentModalOpen(false); }}>
                                <select required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] uppercase font-bold tracking-widest" value={newPayment.studentId} onChange={(e) => setNewPayment({...newPayment, studentId: Number(e.target.value)})}>
                                    <option value={0} disabled>O'quvchini tanlang</option>
                                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <input type="number" required placeholder="Summa (UZS)" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] uppercase font-bold tracking-widest" value={newPayment.amount || ''} onChange={(e) => setNewPayment({...newPayment, amount: Number(e.target.value)})}/>
                                <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] uppercase font-bold tracking-widest" value={newPayment.type} onChange={(e) => setNewPayment({...newPayment, type: e.target.value as any})}>
                                    <option value="Naqd">Naqd</option>
                                    <option value="Karta">Karta</option>
                                </select>
                                <button type="submit" className="w-full py-4 bg-sky-600 text-white rounded-2xl text-[10px] uppercase font-extrabold tracking-widest shadow-xl shadow-sky-500/20">Saqlash</button>
                            </form>
                        ) : (
                            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); addExpense(newExpense); setIsExpenseModalOpen(false); }}>
                                <select required className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] uppercase font-bold tracking-widest" value={newExpense.category} onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}>
                                    <option value="Ish haqi">Ish haqi</option>
                                    <option value="Ijara">Ijara</option>
                                    <option value="Kommunal">Kommunal</option>
                                    <option value="Marketing">Marketing</option>
                                    <option value="Boshqa">Boshqa</option>
                                </select>
                                <input type="number" required placeholder="Summa (UZS)" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] uppercase font-bold tracking-widest" value={newExpense.amount || ''} onChange={(e) => setNewExpense({...newExpense, amount: Number(e.target.value)})}/>
                                <input type="text" placeholder="Izoh (Description)" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] uppercase font-bold tracking-widest" value={newExpense.description} onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}/>
                                <button type="submit" className="w-full py-4 bg-rose-600 text-white rounded-2xl text-[10px] uppercase font-extrabold tracking-widest shadow-xl shadow-rose-500/20">Saqlash</button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
