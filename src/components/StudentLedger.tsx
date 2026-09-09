import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Wallet, AlertCircle, CheckCircle2, CalendarCheck2, BookOpen } from 'lucide-react';

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

/** Bitta kurs bo'yicha holat. Pul kursga biriktirilgani uchun har biri mustaqil. */
interface CourseStanding {
    groupId: number;
    groupName: string;
    courseName: string;
    teacher: string | null;
    monthlyPrice: number;
    debt: number;
    advance: number;
    balance: number;
    /** Shu sanagacha (shu kun ham) darsga kiradi. */
    paidUntil: string | null;
    /** Guruh jadvali to'ldirilmagan — sanani hisoblab bo'lmaydi. */
    accessUnknown: boolean;
    /** Bu kursda hali umuman oylik hisob yozilmagan. */
    noCharge?: boolean;
    /** O'quvchi hozir shu guruhda turibdimi. */
    isMember?: boolean;
    openDebt: boolean;
}

interface Ledger {
    balance: number;
    wallet: number;
    debt: number;
    buckets: Bucket[];
    courses?: CourseStanding[];
    generalWallet?: number;
}

const money = (n: number) => Math.round(n).toLocaleString('ru-RU');

/** "2026-10-30" → "30.10.2026". */
const sana = (d: string) => {
    const [y, m, dd] = d.split('-');
    return dd && m && y ? `${dd}.${m}.${y}` : d;
};

/** Muddat tugashiga necha kun qoldi (o'tib ketgan bo'lsa manfiy). */
const kunQoldi = (d: string) => {
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    const [y, m, dd] = d.split('-').map(Number);
    const oxir = new Date(y, (m || 1) - 1, dd || 1);
    return Math.round((oxir.getTime() - bugun.getTime()) / 86400000);
};

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const monthLabel = (m: string) => {
    if (m === 'eski') return 'Eski qoldiq';
    const [y, mm] = m.split('-').map(Number);
    if (!y || !mm) return m;
    return `${MONTHS[mm - 1]} ${y}`;
};

export default function StudentLedger({ studentId, refreshKey, trial }: { studentId: number; refreshKey?: any; trial?: boolean }) {
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
            {trial && (
                <p className="px-4 py-3 rounded-xl bg-ogoh-fon border border-ogoh/30 text-[11px] font-bold text-ogoh">
                    Sinov davri — hisob yozilmaydi. Holati "Faol" qilinganda o'sha kundan oy oxirigacha bo'lgan darslar uchun hisob yoziladi.
                </p>
            )}
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

            {/* Kurslar bo'yicha. Pul qaysi kursga to'langan bo'lsa o'sha kursda
                qoladi, shuning uchun har bir kursning qarzi, avansi va darsga
                kirish muddati alohida ko'rsatiladi. */}
            {(data.courses || []).length > 0 && (
                <div className="space-y-2">
                    <p className="text-[11px] text-matn-sokin flex items-center gap-1.5 pt-1">
                        <BookOpen size={12} /> Kurslar bo'yicha
                    </p>
                    {(data.courses || []).map(c => {
                        const qoldi = c.paidUntil ? kunQoldi(c.paidUntil) : null;
                        return (
                            <div key={c.groupId} className="px-4 py-3 rounded-xl border border-chiziq bg-ichki/40">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-bold text-matn truncate">
                                            {c.groupName}
                                            {c.isMember === false && (
                                                <span className="ml-1.5 text-[10px] font-bold text-matn-xira">· guruhdan chiqqan</span>
                                            )}
                                        </p>
                                        <p className="text-[10px] text-matn-xira mt-0.5 truncate">
                                            {[c.courseName, c.teacher, c.monthlyPrice > 0 ? money(c.monthlyPrice) + " so'm/oy" : ''].filter(Boolean).join(' · ')}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`raqam text-[14px] font-semibold leading-tight ${c.debt > 0 ? 'text-xato' : c.advance > 0 ? 'text-yaxshi' : 'text-matn-xira'}`}>
                                            {c.debt > 0 ? '−' + money(c.debt) : c.advance > 0 ? '+' + money(c.advance) : '0'}
                                        </p>
                                        <p className="text-[10px] text-matn-xira">
                                            {c.debt > 0 ? 'qarz' : c.advance > 0 ? 'avans' : "qarz yo'q"}
                                        </p>
                                    </div>
                                </div>
                                {/* Darsga kirish muddati — "1 000 000 to'ladi, qachongacha
                                    dostupi bor" degan savolning javobi. */}
                                <div className="mt-2 pt-2 border-t border-dashed border-chiziq/60 flex items-center gap-1.5">
                                    <CalendarCheck2 size={12} className={
                                        c.isMember === false || c.accessUnknown || (!c.paidUntil && c.noCharge) ? 'text-matn-xira'
                                            : !c.paidUntil ? 'text-xato'
                                                : qoldi !== null && qoldi < 0 ? 'text-xato'
                                                    : qoldi !== null && qoldi <= 5 ? 'text-ogoh' : 'text-yaxshi'} />
                                    {c.isMember === false ? (
                                        <span className="text-[11px] font-bold text-matn-xira">
                                            Guruhdan chiqqan — faqat pul hisobi qoldi
                                        </span>
                                    ) : c.accessUnknown ? (
                                        <span className="text-[11px] font-bold text-matn-xira">
                                            Guruh jadvali belgilanmagan — muddatni hisoblab bo'lmaydi
                                        </span>
                                    ) : !c.paidUntil && c.noCharge ? (
                                        /* Bu kursda hali oylik hisob yozilmagan — "to'lamagan" deyish
                                           noto'g'ri bo'lardi. */
                                        <span className="text-[11px] font-bold text-matn-xira">
                                            Hali hisob yozilmagan
                                        </span>
                                    ) : !c.paidUntil ? (
                                        <span className="text-[11px] font-bold text-xato">To'lanmagan — darsga kirish muddati yo'q</span>
                                    ) : (
                                        <span className={`text-[11px] font-bold ${qoldi !== null && qoldi < 0 ? 'text-xato' : qoldi !== null && qoldi <= 5 ? 'text-ogoh' : 'text-matn-2'}`}>
                                            {sana(c.paidUntil)} gacha
                                            {qoldi !== null && (
                                                <span className="font-normal text-matn-xira">
                                                    {qoldi < 0 ? ` · ${-qoldi} kun oldin tugagan`
                                                        : qoldi === 0 ? ' · bugun oxirgi kun'
                                                            : ` · ${qoldi} kun qoldi`}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

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
                To'lov qaysi kursga qilingan bo'lsa, o'sha kursda qoladi — boshqa kursning qarzini yopmaydi.
                Ortgan pul o'sha kursning keyingi oylariga o'tadi. Hisob har oyning 1-sanasida (yoki guruhga
                qo'shilgan kuni) yoziladi. Balans = avans − yopilmagan hisob.
                {loading && ' (yangilanmoqda…)'}
            </p>
        </div>
    );
}
