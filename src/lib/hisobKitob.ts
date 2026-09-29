import { useMemo } from 'react';
import { allocate, withOpening, shareOpts } from '../../lib/allocation.js';

/**
 * Har bir o'quvchining pul holati — serverdagi bilan bir xil funksiya
 * (lib/allocation.js): qancha qarz, qancha avans, qaysi kursda, qarz necha
 * oylik. Moliya, Bosh sahifa, O'quvchilar va Kurslar shu bitta hisobdan
 * oladi — "qarzdor" hamma joyda bir xil ma'noda.
 *
 * Ilgari har sahifa o'zicha sanardi: kimdir `balance < 0`, kimdir kurs
 * bo'yicha, "qarz yoshi" esa oxirgi to'lovdan beri o'tgan kun edi — 28.09
 * dan oldingi tarix o'chirilgani uchun deyarli hamma "60+ kun" chiqardi.
 */
export interface Chelak {
    groupId: number | null;
    /** "YYYY-MM"; kursga bog'lanmagan eski qoldiq — 'eski'. */
    month: string;
    due: number;
    covered: number;
    remaining: number;
}

export interface OquvchiHisobi {
    /** Yopilmagan hisoblar — hamma kurs va eski qoldiq. */
    qarz: number;
    /** Hech qaysi hisobga ketmagan pul. */
    avans: number;
    /** Kurs → qarz (null — kursga bog'lanmagan eski qoldiq). */
    kurslar: Map<number | null, number>;
    /** Eng eski qarzli oy ("YYYY-MM"); faqat eski qoldiq bo'lsa 'eski'; qarz yo'q — null. */
    engEskiOy: string | null;
    chelaklar: Chelak[];
}

const BOSH: OquvchiHisobi = { qarz: 0, avans: 0, kurslar: new Map(), engEskiOy: null, chelaklar: [] };

/** Bitta o'quvchi: yozuvlari, balansi va taqsimot qoidasi bo'yicha. */
export function oquvchiHisobi(rows: any[], balance: number, payShare?: any): OquvchiHisobi {
    // Server yozuvlarni sana va id bo'yicha tartiblaydi (services/ledger.js) —
    // bir kundagi to'lovlar taqsimoti bir xil chiqsin.
    const tartib = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id || 0) - (b.id || 0)));
    const r = allocate(withOpening(tartib, balance || 0), shareOpts(payShare));
    const kurslar = new Map<number | null, number>();
    for (const x of r.debtByGroup) if (x.amount > 0) kurslar.set(x.groupId ?? null, x.amount);
    const ochiq = r.buckets.filter((b: Chelak) => b.remaining > 0);
    const oylar = ochiq.map((b: Chelak) => b.month).filter((m: string) => m !== 'eski').sort();
    return {
        qarz: r.debt,
        avans: r.wallet,
        kurslar,
        engEskiOy: oylar[0] || (ochiq.length ? 'eski' : null),
        chelaklar: r.buckets,
    };
}

/** Hamma o'quvchi — Map<studentId, OquvchiHisobi>. Yozuvlar /api/init bilan kelgan. */
export function useHisobKitob(
    students: { id: number; balance?: number; payShare?: any }[],
    payments: any[],
): Map<number, OquvchiHisobi> {
    return useMemo(() => {
        const bySt = new Map<number, any[]>();
        for (const p of payments || []) {
            if (!bySt.has(p.studentId)) bySt.set(p.studentId, []);
            bySt.get(p.studentId)!.push(p);
        }
        const out = new Map<number, OquvchiHisobi>();
        for (const st of students || []) {
            // Balans ko'rsatilmaydigan lavozim (balans maydoni kelmagan) — hisob yo'q.
            if (st.balance === undefined) continue;
            const rows = bySt.get(st.id) || [];
            out.set(st.id, rows.length || st.balance ? oquvchiHisobi(rows, st.balance || 0, st.payShare) : BOSH);
        }
        return out;
    }, [students, payments]);
}

/** Qarz yoshi (oyda): shu oy — 0, o'tgan oy — 1, …; eski qoldiq — Infinity. */
export function qarzOylari(engEskiOy: string | null, joriyOy: string): number | null {
    if (!engEskiOy) return null;
    if (engEskiOy === 'eski') return Infinity;
    const [y1, m1] = engEskiOy.split('-').map(Number);
    const [y2, m2] = joriyOy.split('-').map(Number);
    return Math.max(0, (y2 - y1) * 12 + (m2 - m1));
}
