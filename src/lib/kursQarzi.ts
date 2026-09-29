import { useMemo } from 'react';
import { allocate, groupRows, withOpening, shareOpts } from '../../lib/allocation.js';

/**
 * Kurs bo'yicha qarz: Map<studentId, Map<groupId | null, qarz>>.
 *
 * Egasi (2026-09-29): "o'quvchilarga kirganda qarzdorligi kurs bo'yicha
 * ko'rinsin". Umumiy balans bir nechta kursdagi o'quvchida qaysi kurs
 * qarzligini aytmaydi. Hisob serverdagi bilan bir xil funksiyada
 * (lib/allocation.js), yozuvlar /api/init bilan kelgan — qo'shimcha so'rov
 * yo'q. `null` kalit — hech bir kursga bog'lanmagan (eski) qarz.
 * Messaging va Kunlik ro'yxat ham aynan shunday hisoblaydi.
 */
export function useKursQarzlari(
    students: { id: number; balance?: number; payShare?: any }[],
    payments: any[],
): Map<number, Map<number | null, number>> {
    return useMemo(() => {
        const out = new Map<number, Map<number | null, number>>();
        const rows = groupRows((payments || []) as any[]);
        for (const st of students || []) {
            if (st.balance === undefined) continue;
            const res = allocate(withOpening(rows.get(st.id) || [], st.balance || 0), shareOpts((st as any).payShare));
            const m = new Map<number | null, number>();
            for (const x of res.debtByGroup) if (x.amount > 0) m.set(x.groupId ?? null, x.amount);
            out.set(st.id, m);
        }
        return out;
    }, [students, payments]);
}

/** Qisqa ko'rinish: 500 000 → "500 000". */
export const somQisqa = (n: number) => Math.round(n).toLocaleString('ru-RU');
