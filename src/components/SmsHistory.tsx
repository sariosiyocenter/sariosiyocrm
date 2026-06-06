import React, { useState, useEffect } from 'react';
import { Search, Mail, Clock, CheckCircle, XCircle, Filter, RefreshCw, Zap } from 'lucide-react';

interface SmsLog {
    id: number;
    toPhone: string;
    message: string;
    status: 'SENT' | 'FAILED' | 'PENDING';
    type: string;
    errorMsg?: string | null;
    sentAt: string;
}

export default function SmsHistory() {
    const [logs, setLogs] = useState<SmsLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');

    const handleTestConnection = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await fetch('/api/sms/test-connection', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                alert("Eskiz API muvaffaqiyatli bog'landi! Token: " + data.token.substring(0, 10) + "...");
            } else {
                alert("Xatolik: " + data.error);
            }
        } catch (err) {
            alert("Ulanishda xatolik yuz berdi");
        } finally {
            setLoading(false);
            fetchLogs();
        }
    };

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await fetch('/api/sms/logs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setLogs(data);
        } catch (err) {
            console.error("Fetch logs failed", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckStatus = async (id: number) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/sms/check-status/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const updatedLog = await res.json();
            
            setLogs(prev => prev.map(log => log.id === id ? updatedLog : log));
            
            if (updatedLog.status === 'SENT') {
                alert("Xabar muvaffaqiyatli yetkazildi!");
            } else {
                try {
                    const err = JSON.parse(updatedLog.errorMsg || '{}');
                    alert("Status: " + (err.data?.status || err.message || updatedLog.status));
                } catch (e) {
                    alert("Status: " + updatedLog.status);
                }
            }
        } catch (err) {
            alert("Statusni tekshirishda xatolik yuz berdi");
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.toPhone.includes(search) || log.message.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === 'all' || log.status.toLowerCase() === filter.toLowerCase();
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
                <div>
                    <h1 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">SMS Tarixi</h1>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Yuborilgan barcha xabarlar monitoringi</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleTestConnection}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        disabled={loading}
                    >
                        <Zap size={14} />
                        Ulanishni tekshirish
                    </button>
                    <button 
                        onClick={fetchLogs}
                        className="p-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-xl text-gray-400 hover:text-[#1b6b6b] transition-all shadow-sm cursor-pointer"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="p-5 flex flex-col md:flex-row gap-4 justify-between items-center border-b border-dashed border-gray-100 dark:border-gray-700/50">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Qidirish (telefon yoki xabar)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-55 dark:bg-gray-905 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Filter size={16} className="text-gray-400" />
                        <select 
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="px-3 py-2 bg-gray-55 dark:bg-gray-905 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none focus:border-[#1b6b6b] text-gray-900 dark:text-white cursor-pointer"
                        >
                            <option value="all">Barchasi</option>
                            <option value="sent">Yuborilgan</option>
                            <option value="failed">Xatolik</option>
                            <option value="pending">Kutilmoqda</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-55 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700/50">
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Sana</th>
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Qabul qiluvchi</th>
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Xabar</th>
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Tur</th>
                                <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Holat</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {filteredLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-teal-950/20 transition-all">
                                    <td className="p-4">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-bold text-gray-900 dark:text-white tabular-nums">
                                                {new Date(log.sentAt).toLocaleDateString()}
                                            </span>
                                            <span className="text-[9px] font-bold text-gray-400 tabular-nums">
                                                {new Date(log.sentAt).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-[10px] font-bold text-gray-900 dark:text-white tabular-nums bg-gray-55 dark:bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-700">
                                            {log.toPhone}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <p className="text-xs text-gray-600 dark:text-gray-400 max-w-md line-clamp-2 leading-relaxed">
                                            {log.message}
                                        </p>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                            {log.type}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {log.status === 'SENT' ? (
                                                <div className="inline-flex items-center gap-1.5 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                                                    <CheckCircle size={12} />
                                                    <span className="text-[8px] font-black uppercase tracking-widest">Yuborildi</span>
                                                </div>
                                            ) : log.status === 'FAILED' ? (
                                                <div 
                                                    className="inline-flex items-center gap-1.5 text-rose-500 bg-rose-50 dark:bg-rose-955/20 px-2.5 py-1 rounded-lg border border-rose-100 dark:border-rose-900/40 cursor-help" 
                                                    title={(() => {
                                                        try {
                                                            const err = JSON.parse(log.errorMsg || '{}');
                                                            return err.message || log.errorMsg || 'Xatolik';
                                                        } catch (e) {
                                                            return log.errorMsg || 'Xatolik';
                                                        }
                                                    })()}
                                                >
                                                    <XCircle size={12} />
                                                    <span className="text-[8px] font-black uppercase tracking-widest">Xato</span>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 text-amber-500 bg-amber-50 dark:bg-amber-955/20 px-2.5 py-1 rounded-lg border border-amber-100 dark:border-amber-900/40">
                                                    <Clock size={12} />
                                                    <span className="text-[8px] font-black uppercase tracking-widest">Kutilmoqda</span>
                                                </div>
                                            )}

                                            <button 
                                                onClick={() => handleCheckStatus(log.id)}
                                                className="p-1 text-gray-400 hover:text-[#1b6b6b] hover:bg-gray-50 rounded transition-all cursor-pointer"
                                                title="Statusni yangilash"
                                            >
                                                <RefreshCw size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="p-16 text-center">
                                        <Mail className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hech qanday log topilmadi</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
