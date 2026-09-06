import { Teacher } from '../types';

/**
 * Guruhda haqiqiy, ishlayotgan ustoz bormi.
 *
 * Guruhning puli ustozga `Group.teacherId` orqali biriktiriladi. Agar o'sha
 * ustoz arxivga olingan bo'lsa yoki umuman o'rniga "Belgilanmagan" degan
 * vaqtinchalik yozuv turgan bo'lsa, guruhga tushgan pul hech kimga
 * hisoblanmaydi — oylik hisobida nol chiqadi.
 *
 * Ilgari "ustozsiz guruh" faqat ustoz yozuvi butunlay yo'q bo'lgandagina
 * aniqlanardi, shuning uchun arxivdagi ustozga biriktirilgan guruhlar
 * ro'yxatda soz ko'rinardi.
 */

/** Markazda o'rin to'ldirish uchun ishlatiladigan nomlar. */
const PLACEHOLDER_NAMES = ['belgilanmagan', '-', '—'];

export function isPlaceholderTeacher(teacher?: Teacher | null): boolean {
    if (!teacher) return false;
    return PLACEHOLDER_NAMES.includes((teacher.name || '').trim().toLowerCase());
}

/** Ustoz haqiqiy va faolmi (arxivda emas, o'rin to'ldiruvchi emas). */
export function isActiveTeacher(teacher?: Teacher | null): boolean {
    if (!teacher) return false;
    if (teacher.status === 'Arxiv') return false;
    return !isPlaceholderTeacher(teacher);
}

/** Guruhga pul hisoblanadigan ustoz biriktirilganmi. */
export function groupHasTeacher(group: { teacherId?: number }, teachers: Teacher[]): boolean {
    const t = teachers.find(x => x.id === group.teacherId);
    return isActiveTeacher(t);
}

/** Nega ustoz hisoblanmasligining sababi (ekranga chiqarish uchun). */
export function teacherProblem(group: { teacherId?: number }, teachers: Teacher[]): string | null {
    const t = teachers.find(x => x.id === group.teacherId);
    if (!t) return 'Ustoz biriktirilmagan';
    if (isPlaceholderTeacher(t)) return 'Ustoz biriktirilmagan';
    if (t.status === 'Arxiv') return `${t.name} arxivda — guruh puli hech kimga hisoblanmaydi`;
    return null;
}
