// Kursning ustozlari. Kursda asosiy ustoz (Group.teacherId) va ixtiyoriy
// ikkinchi ustoz (Group.teacher2Id) bo'ladi — egasi, 2026-09-29: "bitta
// kursga ikkita o'qituvchi". Ikkalasi ham kursni ko'radi, davomat qiladi,
// botda kurs ikkalasiga chiqadi. Server tomonidagi hamma so'rov shu yerdan
// oladi — biror joyda faqat teacherId qolib ketmasin.

/** Prisma `include`/`select` uchun: ikkala ustozning ismi. */
export const USTOZ_NOMLARI = {
  teacher: { select: { name: true } },
  teacher2: { select: { name: true } },
};

/** "Ali Valiyev, Hasan Hasanov" — xabar matnlari va ko'rinish uchun. */
export function ustozNomlari(g) {
  return [g?.teacher?.name, g?.teacher2?.name].filter(Boolean).join(', ');
}

/** Shu ustoz dars beradigan kurslar (asosiy yoki ikkinchi ustoz sifatida). */
export function ustozKurslari(teacherId) {
  return { OR: [{ teacherId }, { teacher2Id: teacherId }] };
}

/** Xodim hisobiga bog'langan ustozning kurslari (Teacher.userId orqali). */
export function xodimKurslari(userId) {
  return { OR: [{ teacher: { userId } }, { teacher2: { userId } }] };
}
