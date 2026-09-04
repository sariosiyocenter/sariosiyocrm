/**
 * Ismlar bazada ko'pincha butunlay bosh harflarda saqlangan
 * ("ABDUHAYEVA SHAHNOZA ERKIN QIZI") — bunday yozuvni o'qish qiyin.
 * Ko'rsatishda oddiy yozuvga keltiriladi; bazadagi ma'lumot o'zgarmaydi.
 * Aralash yozuvdagi ism (masalan "McKenzie") tegilmaydi.
 */
export function displayName(raw: string | null | undefined): string {
    if (!raw) return '';
    if (raw !== raw.toUpperCase()) return raw;
    return raw
        .toLowerCase()
        .replace(/(^|[\s\-])([a-zà-ÿ‘’'])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}
