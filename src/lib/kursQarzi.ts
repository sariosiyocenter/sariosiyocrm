import { useMemo } from 'react';
import { useHisobKitob } from './hisobKitob';

/**
 * Kurs bo'yicha qarz: Map<studentId, Map<groupId | null, qarz>>.
 *
 * Egasi (2026-09-29): "o'quvchilarga kirganda qarzdorligi kurs bo'yicha
 * ko'rinsin". Umumiy balans bir nechta kursdagi o'quvchida qaysi kurs
 * qarzligini aytmaydi. Hisob serverdagi bilan bir xil funksiyada
 * (lib/allocation.js, src/lib/hisobKitob.ts), yozuvlar /api/init bilan
 * kelgan — qo'shimcha so'rov yo'q. `null` kalit — hech bir kursga
 * bog'lanmagan (eski) qarz.
 */
export function useKursQarzlari(
    students: { id: number; balance?: number; payShare?: any }[],
    payments: any[],
): Map<number, Map<number | null, number>> {
    const hisob = useHisobKitob(students, payments);
    return useMemo(() => {
        const out = new Map<number, Map<number | null, number>>();
        for (const [sid, h] of hisob) out.set(sid, h.kurslar);
        return out;
    }, [hisob]);
}

/** Qisqa ko'rinish: 500 000 → "500 000". */
export const somQisqa = (n: number) => Math.round(n).toLocaleString('ru-RU');
