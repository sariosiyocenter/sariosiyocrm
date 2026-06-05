import React, { useState, useEffect } from 'react';
import { Search, Mail, Clock, CheckCircle, XCircle, ArrowLeft, Filter, RefreshCw, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    const navigate = useNavigate();
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
        <div className="space-y-8 pb-12 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">SMS Tarixi</h1>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Yuborilgan barcha xabarlar monitoringi</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={handleTestConnection}
                        className="flex items-center gap-2 px-6 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50"
                        disabled={loading}
                    >
                        <Zap size={16} />
                        Ulanishni tekshirish
                    </button>
                    <button 
                        onClick={fetchLogs}
                        className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-gray-400 hover:text-sky-500 transition-all shadow-sm"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden transition-all">
                <div className="p-8 flex flex-col md:flex-row gap-6 justify-between items-center border-b border-gray-50 dark:border-gray-700/50">
                    <div className="relative group w-full md:w-96">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-sky-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Qidirish (telefon yoki xabar)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest outline-none focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 transition-all shadow-inner dark:text-white"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <Filter size={18} className="text-gray-400" />
                        <select 
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="px-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest outline-none focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 transition-all cursor-pointer dark:text-white"
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
                            <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Sana</th>
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Qabul qiluvchi</th>
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Xabar</th>
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Tur</th>
                                <th className="p-6 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">Holat</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {filteredLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50/30 dark:hover:bg-sky-900/5 transition-all group">
                                    <td className="p-6">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">
                                                {new Date(log.sentAt).toLocaleDateString()}
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-400 tabular-nums">
                                                {new Date(log.sentAt).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums bg-gray-100 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                                            {log.toPhone}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <p className="text-xs text-gray-600 dark:text-gray-400 max-w-md line-clamp-2 leading-relaxed italic">
                                            "{log.message}"
                                        </p>
                                    </td>
                                    <td className="p-6">
                                        <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">
                                            {log.type}
                                        </span>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="flex items-center gap-2">
                                                {log.status === 'SENT' ? (
                                                    <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                                                        <CheckCircle size={14} />
                                                        <span className="text-[9px] font-black uppercase tracking-widest">Yuborildi</span>
                                                    </div>
                                                ) : log.status === 'FAILED' ? (
                                                    <div 
                                                        className="flex items-center gap-2 text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-800/50 cursor-help" 
                                                        title={(() => {
                                                            try {
                                                                const err = JSON.parse(log.errorMsg || '{}');
                                                                return err.message || log.errorMsg || 'Xatolik';
                                                            } catch (e) {
                                                                return log.errorMsg || 'Xatolik';
                                                            }
                                                        })()}
                                                    >
                                                        <XCircle size={14} />
                                                        <span className="text-[9px] font-black uppercase tracking-widest">Xato</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-xl border border-amber-100 dark:border-amber-800/50">
                                                        <Clock size={14} />
                                                        <span className="text-[9px] font-black uppercase tracking-widest">Kutilmoqda</span>
                                                    </div>
                                                )}

                                                <button 
                                                    onClick={() => handleCheckStatus(log.id)}
                                                    className="p-1.5 text-gray-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-all"
                                                    title="Statusni yangilash"
                                                >
                                                    <RefreshCw size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="p-24 text-center">
                                        <Mail className="w-16 h-16 text-gray-100 dark:text-gray-800 mx-auto mb-4" />
                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Hech qanday log topilmadi</p>
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
