import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * O'quvchining hisobi — balans raqamining ochib berilgani.
 *
 * Balans bitta son: musbat bo'lsa avans, manfiy bo'lsa qarz. Lekin rahbarga
 * "bu pul qaysi oy, qaysi guruh uchun?" degan savol kerak. Server
 * (`/api/students/:id/ledger`) har (oy × guruh) uchun qancha hisoblangani va
 * shundan qanchasi yopilganini beradi; hamyonda qolgan avans alohida.
 */

interface Bucket {
    key: string;
    groupId: number | null;
    month: string;          // "2026-09" yoki "eski"
    groupName: string;
    courseName: string;
    teacher: string | null;
    due: number;
    covered: number;
    remaining: number;
    status: 'paid' | 'partial' | 'unpaid';
}

interface Ledger {
    balance: number;
    wallet: number;
    debt: number;
    buckets: Bucket[];
}

const money = (n: number) => Math.round(n).toLocaleString('ru-RU');

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const monthLabel = (m: string) => {
    if (m === 'eski') return 'Eski qoldiq';
    const [y, mm] = m.split('-').map(Number);
    if (!y || !mm) return m;
    return `${MONTHS[mm - 1]} ${y}`;
};

export default function StudentLedger({ studentId, refreshKey }: { studentId: number; refreshKey?: any }) {
    const [data, setData] = useState<Ledger | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const r = await fetch(`/api/students/${studentId}/ledger`, { headers: { Authorization: `Bearer ${token}` } });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Yuklab bo\'lmadi');
            setData(j);
        } catch (e: any) {
            setError(e.message || 'Xatolik');
        } finally {
            setLoading(false);
        }
    }, [studentId]);

    useEffect(() => { load(); }, [load, refreshKey]);

    if (error) {
        return (
            <div className="p-4 bg-xato-fon border border-xato-chiziq rounded-2xl text-[11px] text-xato font-bold flex items-center justify-between">
                <span>{error}</span>
                <button onClick={load} className="underline cursor-pointer">Qayta</button>
            </div>
        );
    }
    if (!data) {
        return (
            <div className="py-6 text-center text-[11px] text-matn-xira font-bold">
                <RefreshCw size={16} className="animate-spin mx-auto mb-1" /> Hisob yuklanmoqda…
            </div>
        );
    }

    // Faqat mazmunli qatorlar: hisobi bor oylar. Eng yangi oy tepada.
    const rows = data.buckets.filter(b => b.due > 0).slice().reverse();

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div className="px-4 py-3 rounded-xl border bg-yaxshi-fon border-yaxshi/25">
                    <span className="text-[11px] text-matn-sokin flex items-center gap-1"><Wallet size={12} /> Hisobdagi avans</span>
                    <p className="raqam text-[18px] font-semibold text-yaxshi leading-tight mt-1">{money(data.wallet)} <span className="text-[11px] text-matn-xira">so'm</span></p>
                    <p className="text-[10px] text-matn-xira mt-0.5">keyingi hisoblar shundan yopiladi</p>
                </div>
                <div className={`px-4 py-3 rounded-xl border ${data.debt > 0 ? 'bg-xato-fon border-xato-chiziq' : 'bg-ichki border-chiziq'}`}>
                    <span className="text-[11px] text-matn-sokin flex items-center gap-1"><AlertCircle size={12} /> Yopilmagan hisob</span>
                    <p className={`raqam text-[18px] font-semibold leading-tight mt-1 ${data.debt > 0 ? 'text-xato' : 'text-matn'}`}>{money(data.debt)} <span className="text-[11px] text-matn-xira">so'm</span></p>
                    <p className="text-[10px] text-matn-xira mt-0.5">to'lashi kerak bo'lgan qarz</p>
                </div>
            </div>

            {rows.length === 0 ? (
                <p className="text-center py-4 text-[11px] text-matn-xira font-bold">Hali hisob yozilmagan</p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-chiziq">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-ichki/60 border-b border-chiziq">
                                {['Oy', 'Guruh', 'Hisoblangan', 'Yopilgan', 'Qoldiq', ''].map((h, i) => (
                                    <th key={i} className="py-2 px-3 text-[10px] font-bold text-matn-xira whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-chiziq/60">
                            {rows.map(b => (
                                <tr key={b.key} className="text-[11px]">
                                    <td className="py-2 px-3 font-bold text-matn whitespace-nowrap">{monthLabel(b.month)}</td>
                                    <td className="py-2 px-3">
                                        <span className="font-bold text-matn-2">{b.groupName}</span>
                                        {b.teacher && <span className="block text-[10px] text-matn-xira">{b.teacher}</span>}
                                    </td>
                                    <td className="py-2 px-3 raqam text-matn-2 whitespace-nowrap">{money(b.due)}</td>
                                    <td className="py-2 px-3 raqam text-yaxshi whitespace-nowrap">{money(b.covered)}</td>
                                    <td className={`py-2 px-3 raqam whitespace-nowrap ${b.remaining > 0 ? 'text-xato font-bold' : 'text-matn-xira'}`}>{money(b.remaining)}</td>
                                    <td className="py-2 px-3">
                                        {b.status === 'paid'
                                            ? <span className="inline-flex items-center text-yaxshi" title="Yopilgan"><CheckCircle2 size={13} /></span>
                                            : b.status === 'partial'
                                                ? <span className="text-[10px] font-bold text-ogoh whitespace-nowrap">Qisman</span>
                                                : <span className="text-[10px] font-bold text-xato whitespace-nowrap">Ochiq</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="text-[10px] text-matn-xira">
                To'lov hisobga tushadi, hisob esa har oyning 1-sanasida (yoki guruhga qo'shilgan kuni) yoziladi va
                hisobdagi puldan yopiladi. Balans = avans − yopilmagan hisob.
                {loading && ' (yangilanmoqda…)'}
            </p>
        </div>
    );
}
