/**
 * O'quvchilar ro'yxatini saralash — O'quvchilar sahifasida ham, kurs
 * sahifasida ham bir xil ishlasin deb bitta joyda.
 *
 * "Davomat" saralashi foizga emas, kelmagan darslar SONIga qaraydi: bitta
 * yozuvi bor va o'sha kuni kelmagan bola 0% bo'lib, 20 darsdan 10 tasini
 * qoldirgan boladan oldinga chiqib qolardi. Egasi so'ragani ham aynan
 * "eng ko'p kelmaydigan".
 */

export type StudentSort = 'default' | 'alifbo' | 'qarz' | 'davomat';

/**
 * Standart tartib — alifbo bo'yicha (egasi, 2026-09-22: "kurslarda tartib
 * standart alifbo bo'yicha"). Ilgari standart tartib bazadan kelgan tartib
 * edi, ya'ni ro'yxat qo'shilgan vaqti bo'yicha aralash chiqardi.
 */
export const STUDENT_SORTS: { key: StudentSort; label: string }[] = [
    { key: 'default', label: "Alifbo bo'yicha (A–Z)" },
    { key: 'qarz', label: "Qarzdorlar (eng ko'p qarz)" },
    { key: 'davomat', label: "Davomat (eng ko'p kelmagan)" },
];

/** Darsga kelmagan deb hisoblanadigan holatlar ("Kelmadi" — eski yozuvlar). */
const KELMAGAN = new Set(['Kelmapdi', 'Kelmadi']);

interface AttRow { studentId: number; groupId?: number | null; status: string }

/** Har o'quvchi necha marta kelmagan. `groupId` berilsa — faqat shu kursda. */
export function absenceCounts(attendances: AttRow[] | undefined, groupId?: number): Map<number, number> {
    const out = new Map<number, number>();
    for (const a of attendances || []) {
        if (groupId !== undefined && a.groupId !== groupId) continue;
        if (!KELMAGAN.has(a.status)) continue;
        out.set(a.studentId, (out.get(a.studentId) || 0) + 1);
    }
    return out;
}

interface Sortable { id: number; name: string; balance?: number | null }

/**
 * Yangi massiv qaytaradi (asl ro'yxat o'zgarmaydi). Teng qiymatlilar
 * alifbo bo'yicha turadi — aks holda har yangilanishda tartib sakrardi.
 */
export function sortStudents<T extends Sortable>(
    list: T[],
    sort: StudentSort,
    opts: { absences?: Map<number, number>; attRate?: Map<number, number> } = {},
): T[] {
    // Ismning boshida/oxirida tasodifiy bo'sh joy bo'lishi mumkin (bazada
    // 12 ta shunday yozuv bor edi) — bo'sh joy bilan boshlangan ism alifboda
    // hammasidan oldinga chiqib ketardi.
    const ism = (a: T, b: T) => (a.name || '').trim().localeCompare((b.name || '').trim(), 'uz');
    const arr = [...list];
    // 'alifbo' — eski nom, saqlangan tanlovlar uchun qoldirildi.
    if (sort === 'default' || sort === 'alifbo') return arr.sort(ism);
    if (sort === 'qarz') {
        // Eng katta qarz (eng manfiy balans) tepada, qarzsizlar oxirida.
        return arr.sort((a, b) => (a.balance || 0) - (b.balance || 0) || ism(a, b));
    }
    // davomat
    const kel = opts.absences || new Map<number, number>();
    const foiz = opts.attRate || new Map<number, number>();
    return arr.sort((a, b) =>
        (kel.get(b.id) || 0) - (kel.get(a.id) || 0)
        || (foiz.get(a.id) ?? 101) - (foiz.get(b.id) ?? 101)
        || ism(a, b));
}
