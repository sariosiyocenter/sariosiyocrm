/**
 * Bir nechta kursda o'qiydigan o'quvchining puli kurslarga qanday bo'linishi.
 *
 * Qoida ikki joyda turadi: markazniki (Sozlamalar → Avtomatlashtirish,
 * Setting.multiCoursePay) va o'quvchiniki (kartochkadagi "To'lov taqsimoti",
 * Student.payShare). O'quvchida belgilangan bo'lsa — o'sha ustun.
 * Hisobning o'zi lib/allocation.js da (shareOpts), bu yerda faqat matn.
 */

export type TaqsimQoida = 'eski' | 'teng' | 'qarz' | 'foiz';
export type PayShare = { rule: TaqsimQoida; weights?: Record<string, number> } | null | undefined;

export const QOIDA_NOMI: Record<TaqsimQoida, string> = {
    eski: 'eng eski qarzdan',
    teng: 'kurslarga teng',
    qarz: 'qarzga qarab',
    foiz: 'foizda',
};

/** Amaldagi qoida: o'quvchiniki bo'lsa — o'sha, aks holda markazniki. */
export function amaldagiQoida(payShare: PayShare, markaz?: string): { rule: TaqsimQoida; weights?: Record<string, number>; oziniki: boolean } {
    if (payShare && payShare.rule && QOIDA_NOMI[payShare.rule]) {
        return { rule: payShare.rule, weights: payShare.weights, oziniki: true };
    }
    const m = (markaz && markaz !== 'foiz' && (QOIDA_NOMI as any)[markaz]) ? markaz as TaqsimQoida : 'eski';
    return { rule: m, oziniki: false };
}

/** "Matematika-5 70% · Fizika-2 30%" yoki "kurslarga teng". */
export function qoidaMatni(q: { rule: TaqsimQoida; weights?: Record<string, number> }, kursNomi: (id: number) => string): string {
    if (q.rule !== 'foiz') return QOIDA_NOMI[q.rule];
    const w = q.weights || {};
    const qismlar = Object.entries(w).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${kursNomi(Number(k))} ${v}%`);
    return qismlar.length ? qismlar.join(' · ') : 'foizda';
}
