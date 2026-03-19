import React, { useState } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, Wallet,
    ArrowUpRight, Download, Plus, X, ListChecks
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { Payment } from '../types';

export default function Finance() {
    const { students, payments, addPayment } = useCRM();
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [newPayment, setNewPayment] = useState<Omit<Payment, 'id'>>({ studentId: 0, amount: 0, type: 'Naqd', description: '', date: new Date().toISOString().split('T')[0] });

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalExpenditure = 0; // Will be implemented with a separate 'Expenses' model if needed
    const profit = totalRevenue - totalExpenditure;
    const activeDebt = students.filter(s => s.balance < 0).reduce((sum, s) => sum + Math.abs(s.balance), 0);
    const activeBalance = students.filter(s => s.balance > 0).reduce((sum, s) => sum + s.balance, 0);

    const stats = [
        { label: 'Tushumlar', value: totalRevenue, icon: <DollarSign size={20} />, color: 'emerald', trend: '+12.5%' },
        { label: 'Chiqimlar', value: totalExpenditure, icon: <TrendingDown size={20} />, color: 'rose', trend: '0%' },
        { label: 'Foyda', value: profit, icon: <TrendingUp size={20} />, color: 'sky', trend: '+8.2%' },
        { label: "O'quvchilar balansi", value: activeBalance, icon: <Wallet size={20} />, color: 'amber', trend: '+1.4%' },
    ];

    const reports = [
        "To'lovlar hisoboti",
        "O'quvchilar to'lovi",
        "Ketgan o'quvchilar hisoboti",
        "Xodimlar Davomati Hisoboti",
        "O'quvchilar Bonuslari",
        "Lidlar Hisoboti",
        "O'quvchilar Hisoboti",
        "Bitiruvchilar",
        "Markaz Faoliyati Statistikasi"
    ];

    const handleAddPayment = (e: React.FormEvent) => {
        e.preventDefault();
        addPayment(newPayment);
        setIsPaymentModalOpen(false);
        setNewPayment({ studentId: 0, amount: 0, type: 'Naqd', description: '', date: new Date().toISOString().split('T')[0] });
    };

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Moliya</h1>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Kirim-chiqimlar va moliyaviy hisobotlar</p>
                </div>
            </div>

            {/* Header Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-sky-500/5 transition-all">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsPaymentModalOpen(true)} 
                        className="px-8 py-3.5 bg-sky-600 dark:bg-sky-500 text-white rounded-[1.25rem] text-[10px] font-bold uppercase tracking-widest hover:bg-sky-500 dark:hover:bg-sky-400 active:scale-[0.98] transition-all shadow-xl shadow-sky-500/20 flex items-center gap-3 group"
                    >
                        <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                        To'lov Qilish
                    </button>
                    <button className="flex items-center gap-3 px-6 py-3.5 bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 rounded-[1.25rem] text-[10px] font-bold uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700 transition-all group">
                        <Download size={18} className="group-hover:text-sky-500 transition-colors" />
                        Eksport
                    </button>
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
                    const variant = colorVariants[stat.color] || colorVariants['sky'];

                    return (
                        <div key={idx} 
                            className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/20 dark:shadow-none hover:shadow-2xl transition-all group relative overflow-hidden animate-in zoom-in-95 duration-500"
                            style={{ animationDelay: `${idx * 50}ms` }}
                        >
                            <div className="relative z-10 flex items-start justify-between">
                                <div>
                                    <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">{stat.label}</p>
                                    <h4 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight tabular-nums">{stat.value.toLocaleString()}</h4>
                                    <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest opacity-60">O'zbek so'mi</p>
                                </div>
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border bg-gradient-to-br ring-4 transition-transform group-hover:scale-110 duration-500 ${variant}`}>
                                    {stat.icon}
                                </div>
                            </div>
                            <div className="mt-8 flex items-center gap-3 relative z-10">
                                <span className={`text-[10px] font-extrabold px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-inner ${stat.trend.startsWith('+') ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40' : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900'}`}>
                                    {stat.trend}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">Nisbatida</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Dashboard Section */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Big Overview Box */}
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/10 dark:shadow-none relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/[0.02] rounded-full -mr-32 -mt-32" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-8 uppercase tracking-tight flex items-center gap-3">
                            <TrendingUp className="text-sky-500" />
                            Moliyaviy Ko'rsatkichlar
                        </h3>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-[2rem] p-8 border border-gray-100 dark:border-gray-800 mb-8 flex flex-col items-center sm:items-start text-center sm:text-left shadow-inner">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 w-full">
                                <div className="flex-1">
                                    <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Jami Tushum</p>
                                    <p className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight tabular-nums">{totalRevenue.toLocaleString()} <span className="text-xs text-gray-400 dark:text-gray-500 font-bold ml-1 uppercase">UZS</span></p>
                                </div>
                                <div className="hidden md:block h-16 w-px bg-gray-200 dark:bg-gray-700 shrink-0 opacity-50"></div>
                                <div className="flex-1 text-right">
                                    <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Faol Qarzdorlik</p>
                                    <p className="text-4xl font-extrabold text-rose-500 dark:text-rose-400 tracking-tight tabular-nums">{activeDebt.toLocaleString()} <span className="text-xs text-rose-300 dark:text-rose-600 font-bold ml-1 uppercase">UZS</span></p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <MiniStat label="Jami tushum" value={totalRevenue.toLocaleString()} color="text-gray-900 dark:text-white" icon={<DollarSign size={16} />} />
                            <MiniStat label="Qarzdorlik" value={activeDebt.toLocaleString()} color="text-rose-600 dark:text-rose-400" icon={<TrendingDown size={16} />} />
                            <MiniStat label="Balans" value={activeBalance.toLocaleString()} color="text-emerald-600 dark:text-emerald-400" icon={<Wallet size={16} />} />
                            <MiniStat label="Chiqimlar" value="0" color="text-gray-400 dark:text-gray-500" icon={<TrendingDown size={16} />} />
                        </div>
                    </div>

                    {/* Recent Payments List */}
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/10 dark:shadow-none min-h-[450px]">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-8 uppercase tracking-tight flex items-center gap-3">
                            <ListChecks className="text-sky-500" />
                            Oxirgi To'lovlar
                        </h3>
                        {payments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-[2rem] bg-gray-50/50 dark:bg-gray-900/30">
                                <Wallet className="w-16 h-16 text-gray-200 dark:text-gray-700 mx-auto mb-4 opacity-50" />
                                <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Hozircha to'lovlar kiritilmagan</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {payments.slice(-8).reverse().map((payment, pIdx) => {
                                    const student = students.find(s => s.id === payment.studentId);
                                    return (
                                        <div key={payment.id} 
                                            className="flex items-center justify-between p-5 rounded-[1.75rem] bg-gray-50/30 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-800 transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-700 hover:shadow-xl hover:shadow-sky-500/5 group animate-in slide-in-from-left-2 duration-300"
                                            style={{ animationDelay: `${pIdx * 40}ms` }}
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm shadow-inner shrink-0 group-hover:scale-110 transition-transform">
                                                    {student?.name.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="min-w-0 space-y-1">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate uppercase tracking-tight group-hover:text-sky-600 transition-colors">{student?.name || 'Noma\'lum o\'quvchi'}</p>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest tabular-nums">{payment.date}</span>
                                                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700 px-0.5"></span>
                                                        <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 uppercase tracking-widest">{payment.type}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800/50 tabular-nums shadow-sm group-hover:shadow-lg transition-all group-hover:-translate-y-0.5">+{payment.amount.toLocaleString()} UZS</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Reports Sidebar */}
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/10 dark:shadow-none h-fit sticky top-24 overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                        <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-3 uppercase tracking-widest">
                            <ListChecks size={20} className="text-sky-500" />
                            Hisobotlar
                        </h3>
                    </div>
                    <div className="flex flex-col py-4">
                        {reports.map((report, idx) => (
                            <button
                                key={idx}
                                className="px-8 py-4 text-left text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-sky-600 dark:hover:text-white hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all flex items-center justify-between group uppercase tracking-widest"
                            >
                                {report}
                                <ArrowUpRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-sky-500 dark:group-hover:text-sky-400 transition-all transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsPaymentModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="px-10 py-8 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">To'lov Qabul Qilish</h2>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-widest">O'quvchidan to'lov kiritish</p>
                            </div>
                            <button onClick={() => setIsPaymentModalOpen(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddPayment} className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">O'quvchi <span className="text-rose-500">*</span></label>
                                <div className="relative">
                                    <select required className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none appearance-none transition-all cursor-pointer text-gray-900 dark:text-white shadow-inner"
                                        value={newPayment.studentId} onChange={e => setNewPayment({ ...newPayment, studentId: Number(e.target.value) })}>
                                        <option value="" disabled>Ro'yxatdan tanlang...</option>
                                        {students.map(s => <option key={s.id} value={s.id}>{s.name} (Balans: {s.balance.toLocaleString()} UZS)</option>)}
                                    </select>
                                    <ArrowUpRight size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Summa (UZS) <span className="text-rose-500">*</span></label>
                                    <input required type="number" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={newPayment.amount || ''} onChange={e => setNewPayment({ ...newPayment, amount: Number(e.target.value) })} placeholder="0" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">To'lov Turi <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <select required className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none appearance-none transition-all cursor-pointer text-gray-900 dark:text-white shadow-inner"
                                            value={newPayment.type} onChange={e => setNewPayment({ ...newPayment, type: e.target.value as any })}>
                                            {['Naqd', 'Plastik', 'Click', 'Payme'].map(method => (
                                                <option key={method} value={method}>{method}</option>
                                            ))}
                                        </select>
                                        <ArrowUpRight size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none rotate-90" />
                                    </div>
                                </div>
                            </div>
                            <div className="pt-10 flex items-center justify-end gap-5 mt-6 border-t border-dashed border-gray-100 dark:border-gray-700">
                                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                                    Bekor Qilish
                                </button>
                                <button type="submit" className="px-10 py-4 bg-sky-600 dark:bg-sky-500 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-sky-500 dark:hover:bg-sky-400 active:scale-[0.98] transition-all shadow-xl shadow-sky-500/20">
                                    Saqlash
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function MiniStat({ label, value, color, icon }: { label: string, value: string, color: string, icon: React.ReactNode }) {
    return (
        <div className="p-5 rounded-2xl border border-gray-50 dark:border-gray-800 bg-white dark:bg-gray-900/40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex flex-col gap-3 shadow-sm hover:shadow-lg group/mini">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 group-hover/mini:scale-110 transition-transform ${color}`}>
                    {icon}
                </div>
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{label}</span>
            </div>
            <div className="space-y-1">
                <p className={`text-sm font-extrabold tabular-nums tracking-tight ${color}`}>{value}</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 font-extrabold uppercase tracking-widest opacity-60">UZS</p>
            </div>
        </div>
    );
}
