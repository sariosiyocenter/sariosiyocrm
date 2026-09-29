import { useEffect, useState } from 'react';
import { useCRM } from '../context/CRMContext';

/**
 * Davr bo'yicha davomat foizi — o'quvchi va kurs kesimida, serverda
 * sanaladi (GET /api/attendances/foiz). Brauzerdagi davomat faqat oxirgi
 * 14 kun (+ ochilgan kurslar tarixi) — undan hisoblangan foiz qaysi sahifa
 * ochilganiga qarab o'zgarardi.
 *
 * `yangilash` o'zgarsa qayta so'raladi (masalan yangi davomat kiritilganda).
 * Yuklanguncha yoki "hamma filial" rejimida — null (chaqiruvchi o'zi hisoblaydi).
 */
export interface DavomatFoizi {
    oquvchilar: Map<number, number>;
    kurslar: Map<number, number>;
}

export function useDavomatFoizi(from: string, to: string, yangilash: unknown = 0): DavomatFoizi | null {
    const { selectedSchoolId, token } = useCRM();
    const [natija, setNatija] = useState<DavomatFoizi | null>(null);
    useEffect(() => {
        if (!selectedSchoolId || !token) { setNatija(null); return; }
        let tirik = true;
        fetch(`/api/attendances/foiz?schoolId=${selectedSchoolId}&from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                if (!tirik || !d) return;
                const foiz = (o: Record<string, { keldi: number; jami: number }>) => new Map(
                    Object.entries(o || {}).filter(([, v]) => v.jami > 0).map(([k, v]) => [Number(k), Math.round((v.keldi / v.jami) * 100)]),
                );
                setNatija({ oquvchilar: foiz(d.oquvchilar), kurslar: foiz(d.kurslar) });
            })
            .catch(() => {});
        return () => { tirik = false; };
    }, [selectedSchoolId, token, from, to, yangilash]);
    return natija;
}
