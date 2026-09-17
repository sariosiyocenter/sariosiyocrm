/**
 * O'quvchi maydonlarining umumiy ro'yxatlari.
 *
 * Bir xil ro'yxat uch joyda kerak: CRM dagi "o'quvchi qo'shish" oynasi,
 * o'quvchi profilidagi tahrirlash formasi va ochiq ariza formasi
 * (`PublicApply`). Ilgari har biri o'z nusxasini saqlardi va ular bir-biridan
 * uzoqlashib ketgan edi — ariza formasida viloyat ham, muassasa turi ham
 * umuman yo'q edi. Endi manba bitta.
 *
 * `PublicApply` autentifikatsiyasiz sahifa, shuning uchun ro'yxatlar
 * komponentda emas, shu yerda turadi: ochiq sahifa CRM konteksti bilan
 * bog'lanmaydi.
 */

/**
 * Nima maqsadda o'qiyapti.
 *
 * "Asosiy fan" — tanlagan yo'nalishining asosiy fani; "Majburiy fan" — blok
 * imtihonining majburiy fani; "Mustaqil" — kirish imtihoniga bog'liq emas,
 * o'zi uchun o'qiyapti.
 */
export const STUDY_GOALS = ['Asosiy fan', 'Majburiy fan', 'Mustaqil'] as const;

/**
 * Ta'lim muassasasi turi.
 *
 * Ro'yxat ikki formada bir-biridan farq qilardi (birida "Prezident maktabi",
 * ikkinchisida "Bog'cha"), shuning uchun profildan saqlangan qiymat qo'shish
 * oynasida bo'sh ko'rinardi. Bu — ikkalasining birlashmasi.
 */
export const ORG_TYPES = [
    'Maktab',
    'Prezident maktabi',
    "Bog'cha",
    'Kollej / Litsey',
    "Oliy o'quv yurti",
    'Boshqa',
] as const;

/**
 * Sinf / kurs. Egasi (2026-09-17): maktabda 7–11-sinf, kollejda 1–2-kurs,
 * oliy o'quv yurtida 1–4-kurs, o'qishni tugatgan bo'lsa "Bitirgan". Bog'cha,
 * "Boshqa" yoki tur tanlanmagan bo'lsa bu maydon umuman chiqmaydi. Server
 * (ochiq ariza) ham shu ro'yxatni qabul qiladi.
 */
export const SCHOOL_GRADES = ['7-sinf', '8-sinf', '9-sinf', '10-sinf', '11-sinf'] as const;
export const COLLEGE_GRADES = ['1-kurs', '2-kurs'] as const;
export const UNIVERSITY_GRADES = ['1-kurs', '2-kurs', '3-kurs', '4-kurs'] as const;
export const GRADUATED = 'Bitirgan';
export const ALL_GRADES: string[] = [...SCHOOL_GRADES, ...UNIVERSITY_GRADES, GRADUATED];

/** Muassasa turiga mos variantlar. Bo'sh ro'yxat — maydon ko'rsatilmaydi. */
export function gradeOptions(orgType?: string | null): string[] {
    if (orgType === 'Maktab' || orgType === 'Prezident maktabi') return [...SCHOOL_GRADES, GRADUATED];
    if (orgType === 'Kollej / Litsey') return [...COLLEGE_GRADES, GRADUATED];
    if (orgType === "Oliy o'quv yurti") return [...UNIVERSITY_GRADES, GRADUATED];
    return [];
}

/** Maydon yorlig'i: maktabda "Sinf", kollej va oliy o'quv yurtida "Kurs". */
export function gradeLabel(orgType?: string | null): string {
    return orgType === 'Kollej / Litsey' || orgType === "Oliy o'quv yurti" ? 'Kurs' : 'Sinf';
}

/** Muassasa turi o'zgarganda: tanlangan sinf yangi ro'yxatda bo'lmasa tozalanadi. */
export function keepGrade(grade: string | null | undefined, orgType?: string | null): string {
    return grade && gradeOptions(orgType).includes(grade) ? grade : '';
}

/** Imtiyoz turlari. Server ham aynan shu ro'yxatni qabul qiladi. */
export const PRIVILEGES = [
    'Nogironligi bor',
    'Harbiy oila',
    "Xotin-qizlar daftari",
    'Sertifikat',
] as const;

/** Milliy sertifikat fanlari. */
export const CERT_SUBJECTS = [
    'Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Tarix',
    'Ingliz tili', 'Nemis tili', 'Rus tili', 'Ona tili', 'Boshqa',
] as const;

/** Xalqaro sertifikat turlari. */
export const CERT_TYPES = ['IELTS', 'SAT', 'TOEFL', 'CEFR', 'Boshqa'] as const;

export const UZB_REGIONS: Record<string, string[]> = {
    "Surxondaryo": [
        "Sariosiyo", "Denov", "Uzun", "Sho'rchi", "Termiz", "Qumqo'rg'on",
        "Jarqo'rg'on", "Sherobod", "Boysun", "Muzrabot", "Angor", "Qiziriq",
        "Oltinsoy", "Bandixon"
    ],
    "Toshkent shahri": [
        "Yunusobod", "Chilonzor", "Mirzo Ulug'bek", "Yashnobod", "Mirobod",
        "Uchtepa", "Shayxontohur", "Olmazor", "Sergeli", "Yakkasaroy",
        "Bektemir", "Yangihayot"
    ],
    "Toshkent viloyati": [
        "Chirchiq", "Angren", "Olmaliq", "Bekobod", "Keles", "Zangiota",
        "Qibray", "Bo'stonliq", "Parkent", "Piskent", "O'rtachirchiq",
        "Yuqorichirchiq", "Quyichirchiq", "Oqqo'rg'on", "Bo'ka", "Yangiyo'l"
    ],
    "Samarqand": [
        "Samarqand shahri", "Bulung'ur", "Ishtixon", "Jomboy", "Kattaqo'rg'on",
        "Narpay", "Nurobod", "Oqdaryo", "Payariq", "Pastdarg'om", "Paxtachi",
        "Toyloq", "Qo'shrabot", "Urgut"
    ],
    "Farg'ona": [
        "Farg'ona shahri", "Marg'ilon", "Qo'qon", "Bog'dod", "Beshariq",
        "Buvayda", "Dang'ara", "Quva", "Rishton", "Toshloq", "Uchko'prik",
        "O'zbekiston", "Yozyovon", "So'x"
    ],
    "Andijon": [
        "Andijon shahri", "Asaka", "Baliqchi", "Buloqboshi", "Bo'ston",
        "Jalaquduq", "Izboskan", "Marhamat", "Oltinko'l", "Paxtaobod",
        "Ulug'nor", "Xo'jaobod", "Shahrixon", "Qo'rg'ontepa"
    ],
    "Namangan": [
        "Namangan shahri", "Kosonsoy", "Mingbuloq", "Pop", "To'raqo'rg'on",
        "Uychi", "Uchqo'rg'on", "Chortoq", "Chust", "Yangiqo'rg'on", "Davlatobod"
    ],
    "Qashqadaryo": [
        "Karshi shahri", "Dehqonobod", "Kamashi", "Kasbi", "Kitob",
        "Koson", "Ko'kdala", "Mirishkor", "Muborak", "Nishon",
        "Chiroqchi", "Shahrisabz", "Yakkabog'"
    ],
    "Buxoro": [
        "Buxoro shahri", "Gijduvon", "Jondor", "Kogon", "Kofirnihon",
        "Qorako'l", "Qoravulbozor", "Olot", "Peshku", "Romitan",
        "Shofirkon", "Vobkent"
    ],
    "Xorazm": [
        "Urganch shahri", "Xiva", "Bog'ot", "Gurlan", "Qo'shko'pir",
        "Shovot", "Toza bozor", "Xonqa", "Hazorasp", "Yangiariq", "Yangibozor"
    ],
    "Navoiy": [
        "Navoiy shahri", "Karmana", "Konimex", "Nurota", "Qiziltepa",
        "Tomdi", "Uchquduq", "Xatirchi"
    ],
    "Jizzax": [
        "Jizzax shahri", "Arnasoy", "Baxmal", "Do'stlik", "Forish",
        "G'allaorol", "Sharof Rashidov", "Mirzacho'l", "Paxtakor", "Yangiobod"
    ],
    "Sirdaryo": [
        "Guliston shahri", "Shirin", "Yangiyer", "Boyovut", "Oqoltin",
        "Sardoba", "Sayxunobod", "Sirdaryo tumani", "Xovost"
    ],
    "Qoraqalpog'iston": [
        "Nukus shahri", "Amudaryo", "Beruniy", "Chimboy", "Ellikqala",
        "Kegeyli", "Mo'ynoq", "Qonliko'l", "Qo'ng'irot", "Shumanay",
        "Taxtako'pir", "To'rtko'l", "Xo'jayli"
    ]
};
