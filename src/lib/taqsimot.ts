/**
 * Bir nechta kursda o'qiydigan o'quvchining balansi har oy kurslarga qanday
 * yechilishi (egasi, 2026-09-23). Pul doim balansga tushadi; standart —
 * kurslarga TENG, kartochkadagi "Balans taqsimoti"da foizda qo'yish mumkin
 * (Student.payShare). Hisobning o'zi lib/allocation.js da (shareOpts),
 * bu yerda faqat matn.
 */

export type TaqsimQoida = 'eski' | 'teng' | 'qarz' | 'foiz';
export type PayShare = { rule: TaqsimQoida; weights?: Record<string, number> } | null | undefined;

/** Amaldagi qoida: o'quvchida foiz belgilangan bo'lsa — o'sha, aks holda teng. */
export function amaldagiQoida(payShare: PayShare): { rule: TaqsimQoida; weights?: Record<string, number>; oziniki: boolean } {
    if (payShare && payShare.rule === 'foiz') return { rule: 'foiz', weights: payShare.weights, oziniki: true };
    return { rule: 'teng', oziniki: false };
}

/** "Matematika-5 70% · Fizika-2 30%" yoki "Teng — avtomatik". */
export function qoidaMatni(q: { rule: TaqsimQoida; weights?: Record<string, number> }, kursNomi: (id: number) => string): string {
    if (q.rule !== 'foiz') return 'Teng — avtomatik';
    const w = q.weights || {};
    const qismlar = Object.entries(w).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${kursNomi(Number(k))} ${v}%`);
    return qismlar.length ? qismlar.join(' · ') : 'foizda';
}

/**
 * O'quvchining shu kursga kelgan sanasi: aniq belgilangan bo'lsa — o'sha
 * (Student.courseStart), bo'lmasa shu kurs bo'yicha birinchi oylik hisob
 * yozilgan kun, u ham bo'lmasa ro'yxatga olingan kun. "Kurs hisobi" oynasi
 * shu sana bilan ochiladi — noto'g'ri sana bilan ochilsa hisob o'zgarib ketardi.
 */
export function kelganSana(
    student: { id: number; courseStart?: unknown; joinedDate?: string | null },
    groupId: number,
    payments: { studentId: number; groupId?: number | null; type: string; amount: number; date: string }[],
): string | null {
    const cs = student.courseStart;
    const aniq = cs && typeof cs === 'object' ? (cs as Record<string, string>)[String(groupId)] : null;
    if (aniq) return aniq;
    let birinchi: string | null = null;
    for (const p of payments) {
        if (p.studentId === student.id && p.groupId === groupId && p.type === 'Oylik' && p.amount < 0 && (!birinchi || p.date < birinchi)) birinchi = p.date;
    }
    return birinchi || student.joinedDate || null;
}
