import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, CreditCard } from 'lucide-react';

/**
 * Payme'dan qaytish sahifasi (/pay/:orderId). Kirish talab qilmaydi.
 * Serverdan faqat holat va summa keladi — o'quvchi haqida hech narsa yo'q.
 * To'lov Payme tomonida o'tib, bizga hali yetib kelmagan bo'lishi mumkin,
 * shuning uchun bir necha soniya so'rab turadi.
 */

type Info = { id: string; amount: number; status: 'new' | 'paid' | 'refunded' | 'cancelled' | 'expired'; test: boolean; orgName: string };

const money = (n: number) => Number(n || 0).toLocaleString('ru-RU');

export default function PublicPay() {
    const { orderId } = useParams<{ orderId: string }>();
    const [info, setInfo] = useState<Info | null>(null);
    const [error, setError] = useState('');
    const [tries, setTries] = useState(0);

    useEffect(() => {
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const load = async (n: number) => {
            try {
                const r = await fetch(`/api/public/payme/orders/${orderId}`);
                if (!r.ok) throw new Error(r.status === 404 ? 'Buyurtma topilmadi' : 'Server javob bermadi');
                const j: Info = await r.json();
                if (!alive) return;
                setInfo(j);
                setTries(n);
                // Hali kutilmoqda — 3 soniyadan so'ng yana (2 daqiqagacha).
                if (j.status === 'new' && n < 40) timer = setTimeout(() => load(n + 1), 3000);
            } catch (e: any) {
                if (alive) setError(e.message);
            }
        };
        load(0);
        return () => { alive = false; if (timer) clearTimeout(timer); };
    }, [orderId]);

    const shell = (body: React.ReactNode) => (
        <div className="min-h-screen bg-gradient-to-tr from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-sirt rounded-[2rem] border border-chiziq p-8 text-center shadow-lg">{body}</div>
        </div>
    );

    if (error) return shell(
        <>
            <div className="w-14 h-14 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 dark:border-red-900/40"><XCircle size={24} /></div>
            <h2 className="text-sm font-black text-matn">{error}</h2>
        </>
    );

    if (!info) return shell(
        <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-[3px] border-[var(--brand-color,#1b6b6b)] border-t-transparent rounded-full animate-spin" />
            <p className="text-[11px] font-bold text-matn-xira uppercase tracking-wider">Tekshirilmoqda...</p>
        </div>
    );

    const view = {
        paid:      { icon: <CheckCircle2 size={28} />, cls: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-100 dark:border-emerald-900/40', title: "To'lov qabul qilindi", text: "Pul o'quvchining hisobiga tushdi. Rahmat!" },
        new:       { icon: <Clock size={28} />,        cls: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 border-amber-100 dark:border-amber-900/40',       title: tries >= 40 ? "Hali tasdiqlanmadi" : "To'lov kutilmoqda", text: tries >= 40 ? "Payme ilovasida to'lov holatini tekshiring. To'lov o'tgan bo'lsa u tez orada hisobga tushadi." : "Payme tasdig'i kutilmoqda — sahifa o'zi yangilanadi." },
        refunded:  { icon: <XCircle size={28} />,      cls: 'bg-rose-50 dark:bg-rose-950/20 text-rose-500 border-rose-100 dark:border-rose-900/40',             title: "To'lov qaytarilgan", text: "Bu to'lov Payme orqali bekor qilinib, pul qaytarilgan." },
        cancelled: { icon: <XCircle size={28} />,      cls: 'bg-gray-100 dark:bg-gray-900 text-matn-xira border-gray-200 dark:border-gray-800',                title: "Havola bekor qilingan", text: "Yangi havola uchun o'quv markaziga murojaat qiling." },
        expired:   { icon: <XCircle size={28} />,      cls: 'bg-gray-100 dark:bg-gray-900 text-matn-xira border-gray-200 dark:border-gray-800',                title: "Havola muddati o'tgan", text: "Yangi havola uchun o'quv markaziga murojaat qiling." },
    }[info.status] || { icon: <CreditCard size={28} />, cls: '', title: info.status, text: '' };

    return shell(
        <>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${view.cls}`}>{view.icon}</div>
            <p className="text-[11px] font-bold text-matn-xira uppercase tracking-wider">{info.orgName}</p>
            <h2 className="text-lg font-black text-matn mt-1">{view.title}</h2>
            <p className="text-3xl font-black text-matn mt-4">{money(info.amount)} <span className="text-sm text-matn-xira">so'm</span></p>
            {info.test && <p className="text-[11px] font-black text-amber-600 mt-2">TEST rejim — haqiqiy pul emas</p>}
            <p className="text-[12px] font-bold text-matn-xira mt-4">{view.text}</p>
            <p className="text-[10px] font-mono text-matn-xira mt-6">{info.id}</p>
        </>
    );
}
