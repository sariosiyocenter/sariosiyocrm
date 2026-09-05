import { Course, Group } from '../types';

/**
 * Tanlash ro'yxatlarida ko'rsatiladigan kurslar.
 *
 * Markazda vaqt o'tib "Svetozar", "birinchi", "Frontend" kabi bir marta
 * yaratilib tashlab ketilgan kurslar yig'ilib qoladi: ularda birorta guruh
 * yo'q, ya'ni ular aslida o'qitilmaydi. Shunga qaramay ular hamma tanlash
 * ro'yxatida — lid formasi, to'lov oynasi, ochiq ariza formasi — chiqib
 * turardi va foydalanuvchi mavjud bo'lmagan kursni tanlashi mumkin edi.
 *
 * Ilgari bu Dashboard'da nomlar ro'yxati bilan ("birinchi", "belgilanmagan")
 * to'silgan edi; nom o'zgarsa yoki yangi keraksiz kurs paydo bo'lsa u ishlamay
 * qolardi. Bu yerdagi qoida tuzilishga asoslangan: guruhi bo'lmagan kurs
 * tanlanmaydi.
 */
export function activeCourses(courses: Course[], groups: Group[]): Course[] {
    const used = new Set(groups.map(g => g.courseId));
    const withGroups = courses.filter(c => used.has(c.id));
    // Hech bir kursda guruh bo'lmasa (masalan markaz endi ochilgan) hammasini
    // ko'rsatamiz — aks holda ro'yxat butunlay bo'sh qolardi.
    return withGroups.length > 0 ? withGroups : courses;
}
