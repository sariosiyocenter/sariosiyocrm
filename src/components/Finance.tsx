import React, { useState } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, Wallet,
    BarChart3, PieChart, CreditCard, ArrowUpRight,
    ArrowDownRight, Calendar, ChevronDown, Download,
    Filter, FileText, Users, Target, Zap, Plus, X
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
        { label: 'Tushumlar', value: `${totalRevenue.toLocaleString()} UZS`, icon: <DollarSign className="w-5 h-5 text-amber-500" />, bgColor: 'bg-amber-50' },
        { label: 'Chiqimlar', value: `${totalExpenditure.toLocaleString()} UZS`, icon: <TrendingDown className="w-5 h-5 text-red-500" />, bgColor: 'bg-red-50' },
        { label: 'Foyda', value: `${profit.toLocaleString()} UZS`, icon: <TrendingUp className="w-5 h-5 text-green-500" />, bgColor: 'bg-green-50' },
        { label: 'O\'quvchilar balansi', value: `${activeBalance.toLocaleString()} UZS`, icon: <Wallet className="w-5 h-5 text-indigo-500" />, bgColor: 'bg-indigo-50' },
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
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Moliya boshqaruvi</h1>
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsPaymentModalOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-[#5C67F2] text-white rounded-lg text-sm font-bold hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-100 uppercase tracking-wider">
                        <Plus className="w-4 h-4" />
                        To'lov qabul qilish
                    </button>
                </div>
            </div>

            {/* Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                        <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-slate-400">{stat.label}</span>
                            <span className="text-xl font-bold text-slate-800 tracking-tight">{stat.value}</span>
                        </div>
                        <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                            {stat.icon}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Dashboard Section */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="font-bold text-slate-800 text-lg uppercase tracking-wider">Plan ko'rsatkichlari</h3>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1 text-slate-500 text-sm font-medium">
                                        <span>Erishilgan summa</span>
                                    </div>
                                    <span className="text-2xl font-black text-slate-800 tracking-tight">{totalRevenue.toLocaleString()} so'm</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-1 text-slate-500 text-sm font-medium">
                                        <span>Faol qarzdorlik</span>
                                    </div>
                                    <span className="text-2xl font-black text-amber-600 tracking-tight">{activeDebt.toLocaleString()} so'm</span>
                                </div>
                            </div>

                            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-6 flex">
                                <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: totalRevenue > 0 ? '100%' : '0%' }}></div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <PlanCard label="Jami tushum" value={`${totalRevenue.toLocaleString()} so'm`} color="bg-[#5C67F2]" icon={<DollarSign className="w-4 h-4" />} />
                                <PlanCard label="Qarzdorlik" value={`${activeDebt.toLocaleString()} so'm`} color="bg-[#F59E0B]" icon={<TrendingDown className="w-4 h-4" />} />
                                <PlanCard label="Balans" value={`${activeBalance.toLocaleString()} so'm`} color="bg-[#10B981]" icon={<Wallet className="w-4 h-4" />} />
                                <PlanCard label="Chiqimlar" value="0 so'm" color="bg-[#EF4444]" icon={<TrendingDown className="w-4 h-4" />} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[300px]">
                        <h3 className="font-bold text-slate-800 mb-6 uppercase tracking-widest text-sm flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-indigo-500" />
                            Oxirgi to'lovlar
                        </h3>
                        {payments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <img src="https://api.dicebear.com/7.x/shapes/svg?seed=empty-chart&backgroundColor=ffffff" alt="No data" className="w-32 h-32 opacity-30 mb-4" />
                                <p className="text-slate-400 font-medium italic">Hozircha to'lovlar yo'q</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {payments.slice(-5).reverse().map(payment => {
                                    const student = students.find(s => s.id === payment.studentId);
                                    return (
                                        <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-slate-200 text-indigo-500 font-bold">
                                                    {student?.name.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">{student?.name || 'Noma\'lum'}</p>
                                                    <p className="text-[11px] text-slate-400 font-medium">{payment.date}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-emerald-600">+{payment.amount.toLocaleString()} UZS</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{payment.type}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Reports Navigation Sidebar */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-fit sticky top-24">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            Moliya Hisobotlari
                        </h3>
                    </div>
                    <div className="flex flex-col py-2">
                        {reports.map((report, idx) => (
                            <button
                                key={idx}
                                className="px-6 py-3.5 text-left text-[14px] font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all border-l-4 border-transparent hover:border-indigo-500 flex items-center justify-between group"
                            >
                                {report}
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-400"></div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800">To'lov qabul qilish</h2>
                            <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleAddPayment} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">O'quvchini tanlang</label>
                                <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newPayment.studentId} onChange={e => setNewPayment({ ...newPayment, studentId: Number(e.target.value) })}>
                                    <option value="">Tanlang</option>
                                    {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.balance.toLocaleString()} UZS)</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">Summa</label>
                                <input required type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-600"
                                    value={newPayment.amount} onChange={e => setNewPayment({ ...newPayment, amount: Number(e.target.value) })} placeholder="0 UZS" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">To'lov turi</label>
                                <div className="flex gap-2">
                                    {['Naqd', 'Plastik', 'Click', 'Payme'].map(method => (
                                        <button key={method} type="button"
                                            onClick={() => setNewPayment({ ...newPayment, type: method as any })}
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${newPayment.type === method ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-indigo-200'}`}>
                                            {method}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button type="submit" className="w-full py-4 bg-[#5C67F2] text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-600 transition-all mt-4 uppercase tracking-widest text-sm">
                                TO'LOVNI TASDIQLASH
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function PlanCard({ label, value, color, icon }: { label: string, value: string, color: string, icon: React.ReactNode }) {
    return (
        <div className={`${color} p-4 rounded-xl text-white shadow-lg shadow-indigo-200/20 group hover:scale-[1.02] transition-transform cursor-pointer relative overflow-hidden`}>
            <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-150 transition-transform">
                {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-16 h-16' })}
            </div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
                {icon}
            </div>
            <div className="text-[15px] font-black tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">{value}</div>
        </div>
    );
}
