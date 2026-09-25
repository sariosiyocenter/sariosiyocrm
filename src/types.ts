export type UserRole = 'ADMIN' | 'MANAGER' | 'TEACHER' | 'SUPPORT_TEACHER' | 'RECEPTIONIST' | 'DRIVER' | 'TECH_STAFF' | 'SUPERADMIN' | 'SELLER';

export interface Student {
    id: number;
    name: string;
    phone: string;
    birthDate: string;
    address: string;
    location?: string;
    status: 'Faol' | 'Passiv' | 'Muzlatilgan' | 'Sertifikatli' | 'Sinov' | 'Bitiruvchi' | 'Arxiv';
    joinedDate: string;
    balance: number;
    photo?: string;
    groups: number[]; // Array of Group IDs
    gender?: 'Erkak' | 'Ayol';
    comment?: string;
    rating?: number;
    fatherName?: string;
    fatherPhone?: string;
    motherName?: string;
    motherPhone?: string;
    telegramId?: string;
    fatherTelegramId?: string;
    motherTelegramId?: string;
    schoolId: number;
    statusChangedAt?: string;
    leaveReason?: string;
    /** @deprecated Logistika endi marshrutdan oladi — `routeIds`. */
    transportId?: number | null;
    /** Qaysi marshrutlarning bekati (ertalabki va/yoki kechqurungi). */
    routeIds?: number[];
    /** Transportda qatnaydimi — avtomatik rejalashtirish shunga qaraydi. */
    needsTransport?: boolean;
    /** Imtihonlarga keladimi. Kelmaydiganga imtihon varaqasi chiqarilmaydi. */
    attendsExam?: boolean;
    /**
     * Bir nechta kursda o'qisa — puli kurslarga qanday bo'linadi (kartochkada
     * qo'lda). null — markaz qoidasi. { rule: 'foiz', weights: { "62": 70 } }.
     */
    payShare?: { rule: 'eski' | 'teng' | 'qarz' | 'foiz'; weights?: Record<string, number> } | null;
    studentSchool?: string;
    privilegeType?: string;
    certCategory?: string;
    certSubject?: string;
    certType?: string;
    certScore?: string;
    customPrices?: any;
    /** Qaysi kursga qaysi kundan kelib boshlagani: { "<kurs id>": "2026-09-15" }. */
    courseStart?: Record<string, string> | null;
    certificates?: any;
    orgType?: string;
    region?: string;
    district?: string;
    /** Sinf / bosqich: "7-sinf" … "11-sinf", "1-kurs" | "2-kurs", "Bitirgan". */
    grade?: string | null;
    /** Nima maqsadda o'qiyapti: "Asosiy fan" | "Majburiy fan" | "Mustaqil". */
    studyGoal?: string;
    /** Qaysi yo'nalishga tayyorlanmoqda (Direction.id). */
    directionId?: number | null;
}

/**
 * Kirish yo'nalishi: "Iqtisodiyot (Matematika + Ingliz tili)".
 * Ro'yxatni admin Sozlamalardan boshqaradi.
 */
export interface Direction {
    id: number;
    name: string;
    /** Yo'nalish fanlari, ko'rsatish uchun matn: "Matematika + Ingliz tili". */
    subjects?: string | null;
    schoolId: number;
}

export interface User {
    id: number;
    email: string;
    name: string;
    phone?: string;
    role: UserRole;
    schoolId: number | null;
    /** Qo'shimcha filiallar (ikki filialda ishlaydigan xodim). Asosiysi — schoolId. */
    branchIds?: number[];
    createdAt: string;
    driverRoutes?: Route[];
}

export interface Teacher {
    id: number;
    name: string;
    phone: string;
    salary: number;
    sharePercentage: number;
    lessonFee: number;
    salaryType: 'FIXED' | 'KPI' | 'FIXED_KPI';
    birthDate: string;
    hiredDate: string;
    photo?: string;
    // Passiv — vaqtincha ishlamayotgan ustoz: ro'yxatda qoladi, lekin
    // "Faol" hisoblanmaydi. Arxiv — butunlay ishdan chiqqan.
    status: 'Faol' | 'Passiv' | 'Arxiv';
    schoolId: number;
    // Shu ustozning xodim yozuvi. Profil, oylik, davomat va Telegram — hammasi
    // o'sha yozuvga bog'langan, shuning uchun ustoz sahifasi ham o'shanga
    // yo'naltiriladi. Server bo'sh qolmasligini o'zi ta'minlaydi.
    userId?: number | null;
}

export interface Group {
    id: number;
    name: string;
    teacherId: number;
    courseId: number;
    schedule: string; // e.g., "19:00 - 20:00"
    days: string; // e.g., "Juft kunlar"
    studentIds: number[];
    room?: number;
    syllabusId?: number | null;
    // Ustozga shu guruh uchun to'lov: bo'sh — xodimning umumiy KPI foizi,
    // 'Belgilangan' — payValue summa, 'Foiz' — payValue foiz.
    payType?: 'Belgilangan' | 'Foiz' | null;
    payValue?: number;
    schoolId: number;
}

export interface Lead {
    id: number;
    name: string;
    phone: string;
    course: string;
    source: string;
    status: 'Yangi' | 'Bog\'lanilmadi' | 'O\'ylayapti' | 'Kelishdi' | 'To\'lov qildi';
    createdAt: string;
    schoolId: number;
    birthDate?: string;
    studentSchool?: string;
    fatherName?: string;
    fatherPhone?: string;
    motherName?: string;
    motherPhone?: string;
    address?: string;
    notes?: string;
    photo?: string;
    privilegeType?: string;
    certCategory?: string;
    certSubject?: string;
    certType?: string;
    certScore?: string;
    orgType?: string;
    region?: string;
    district?: string;
    studyGoal?: string;
    directionId?: number | null;
}

export interface Payment {
    id: number;
    studentId: number;
    amount: number;
    // 'Chegirma' — pul kirmagan qayta hisob (dars qoldirgani uchun).
    // 'Oylik' — billing yozadigan manfiy hisob.
    // 'Qaytarish' — o'quvchiga naqd qaytarilgan pul (manfiy).
    type: 'Naqd' | 'Karta' | 'Peyme' | 'Klik' | 'O\'tkazma' | 'Chegirma' | 'Oylik' | 'Qaytarish';
    date: string;
    description: string;
    /** Qaysi kurs uchun to'langani. Tanlanmagan bo'lsa null. */
    courseId?: number | null;
    /**
     * Qaysi guruhga tegishli. Markazda "kurs" deb aynan guruh tushuniladi,
     * shuning uchun to'lov shu maydon bilan bog'lanadi — ustoz ulushi
     * hisoblanganda pul qaysi guruhga tushgani shundan aniqlanadi.
     */
    groupId?: number | null;
    schoolId: number;
    /** Yozuv bazaga qachon tushgani — tahrirlash oynasi (10 daqiqa) shunga qaraydi. */
    createdAt?: string;
    /** Tahrirlangan bo'lsa: qachon va kim. */
    editedAt?: string | null;
    editedById?: number | null;
}

export interface Expense {
    id: number;
    amount: number;
    category: string; // Ish haqi, Ijara, Kommunal, Marketing, Boshqa
    date: string;
    description: string;
    /** Pul qayerdan chiqdi: Naqd — kassadan, qolganlari bankdan. */
    method?: 'Naqd' | 'Karta' | 'O\'tkazma';
    schoolId: number;
    staffId?: number | null;   // "Ish haqi" uchun xodim ID
    staffName?: string | null; // "Ish haqi" uchun xodim ismi
}
export interface Transport {
    id: number;
    name: string;
    model?: string;
    number?: string;
    capacity: number;
    driverName?: string;
    driverPhone?: string;
    status: 'Faol' | 'Ta\'mirda' | 'Arxiv';
    driverId?: number | null;
    driver?: User;
    schoolId: number;
}

export interface DeliveryLog {
    id: number;
    /** Mashina reysdan ham kelishi mumkin. */
    transportId?: number | null;
    studentId: number;
    date: string;
    status: 'Olib ketildi' | 'Uyiga yetkazildi' | 'Kelmadi';
    /** Qaysi reysga tegishli — ertalabki va kechqurungi yozuv shu bilan ajraladi. */
    runId?: number | null;
    run?: { routeId: number } | null;
    /** Yozuvni yuborishda: qaysi marshrut. Server shu kunning reysini topadi. */
    routeId?: number;
    markedById?: number | null;
    markedAt?: string;
    note?: string | null;
    schoolId: number;
}

/** Bir kunning bir reysi. */
export interface RouteRun {
    id: number;
    routeId: number;
    date: string;
    driverId?: number | null;
    transportId?: number | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    driver?: { id: number; name: string; phone?: string } | null;
    transport?: { id: number; name: string } | null;
    schoolId: number;
}

/** Bir kunning bir reysi. */
export interface RouteRun {
    id: number;
    routeId: number;
    date: string;
    driverId?: number | null;
    transportId?: number | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    driver?: { id: number; name: string; phone?: string } | null;
    transport?: { id: number; name: string } | null;
    schoolId: number;
}

/** Marshrutdagi bitta bekat. */
export interface RouteStop {
    id: number;
    routeId: number;
    studentId: number;
    tartib: number;
    student?: Student;
}

export interface Route {
    id: number;
    name: string;
    startTime?: string;
    transportId?: number | null;
    transport?: Transport;
    driverId?: number | null;
    driver?: User;
    days: 'TOQ' | 'JUFT' | 'HAR_KUNI';
    /** KETISH — uydan markazga, QAYTISH — darsdan keyin uyga. */
    direction?: 'KETISH' | 'QAYTISH';
    /** Tartibni tizim o'zi quradimi (qo'lda surilsa false). */
    autoOrder?: boolean;
    /** Avtomatik rejalashtirish yaratganmi. */
    autoPlanned?: boolean;
    /** Shu mashinaning nechanchi reysi. */
    navbat?: number;
    /**
     * Kunlik reja marshruti aynan shu kunga tegishli ("YYYY-MM-DD").
     * null — takrorlanuvchi marshrut, `days` bo'yicha ishlaydi.
     */
    date?: string | null;
    /** Qaysi dars tugash to'lqiniga tegishli ("21:00"). */
    tolqin?: string | null;
    /** Bekatlar tartibi bilan. `studentIds` shundan hisoblanadi. */
    stops?: RouteStop[];
    studentIds: number[];
    schoolId: number;
    createdAt: string;
    updatedAt: string;
}

export interface Course {
    id: number;
    name: string;
    price: number;
    syllabusId?: number | null;
    schoolId: number;
}

export interface Room {
    id: number;
    name: string;
    capacity: number;
    schoolId: number;
    /** Imtihon sxemasi: qatorlar va har qatordagi o'rinlar; `blocked` — ["2-3", ...]. */
    rows?: number | null;
    cols?: number | null;
    blocked?: string[] | null;
}

export interface Organization {
    id: number;
    name: string;
    address?: string;
    phone?: string;
    createdAt: string;
    schoolCount?: number;
    studentCount?: number;
    teacherCount?: number;
    revenue?: number;
    userCount?: number;
    status?: string;
    expiresAt?: string | null;
    maxSchools?: number;
}

export interface School {
    id: number;
    name: string;
    address: string;
    organizationId?: number | null;
}

export interface Attendance {
    id: number;
    studentId: number;
    groupId: number;
    date: string;
    status: 'Keldi' | 'Kelmapdi' | 'Sababli' | 'Dars bo\'lmadi' | 'Kechikdi' | 'ErtaKetdi';
    topicId?: number | null;
    caughtUp?: boolean;
    schoolId: number;
}

export type TopicStatus = 'Rejada' | 'Jarayonda' | 'Tugallangan';

export interface Topic {
    id: number;
    title: string;
    description?: string | null;
    order: number;
    /** Modul nomi. Bo'sh bo'lsa mavzu "Boshqa mavzular" guruhida ko'rinadi. */
    moduleName?: string | null;
    /** Akademik soat. */
    hours?: number | null;
    /** "PDF,Video,Test" ko'rinishidagi belgilar. */
    materials?: string | null;
    status?: TopicStatus | string | null;
    syllabusId?: number | null;
    schoolId: number;
}

export interface Syllabus {
    id: number;
    name: string;
    materials?: string | null;
    schoolId: number;
    topics?: Topic[];
}

export interface Score {
    id: number;
    studentId: number;
    groupId: number;
    date: string;
    value: number;
    comment: string;
    schoolId: number;
}

export interface TeacherAttendance {
    id: number;
    teacherId: number;
    date: string;
    status: 'Keldi' | 'Kelmapdi' | 'Sababli' | 'Dars bo\'lmadi';
    schoolId: number;
}

// Xodim davomati. Ustoz davomati ham shu yerda: profil bitta bo'lgani kabi
// jurnal ham bitta. Eski TeacherAttendance faqat tarix uchun qoldi.
export interface StaffAttendance {
    id: number;
    userId: number;
    date: string;
    status: 'Keldi' | 'Kelmadi' | 'Sababli';
    schoolId: number;
}

export interface CRMState {
    students: Student[];
    teachers: Teacher[];
    groups: Group[];
    leads: Lead[];
    payments: Payment[];
    courses: Course[];
    rooms: Room[];
    schools: School[];
    attendances: Attendance[];
    scores: Score[];
    teacherAttendances: TeacherAttendance[];
    // Xodim davomati — profildagi "Ish grafigi" kalendari yozadigan jadval.
    // Ustoz davomati ham shu yerda: ustoz ham xodim, profili bitta.
    staffAttendances: StaffAttendance[];
    expenses: Expense[];
    transports: Transport[];
    deliveryLogs: DeliveryLog[];
    routeRuns: RouteRun[];
    routes: Route[];
    users: User[];
    selectedSchoolId: number | null;
    syllabuses: Syllabus[];
    directions: Direction[];
    settings: {
        id: number;
        schoolId: number;
        orgName: string;
        logo?: string;
        adminPhone?: string;
        adminPhone2?: string;
        address?: string;
        /** Markaz binosi: "kenglik,uzunlik". Sozlamalarda xaritadan belgilanadi. */
        centerLocation?: string;
        /** Haydovchi belgilaganda ota-onaga xabar ketsinmi. */
        transportNotify?: boolean;
        /** TELEGRAM | SMS | BOTH. */
        transportChannel?: string;
        telegram?: string;
        /** Oylik hisob har oyning nechanchi kunida yoziladi (1-28, sukut 1). */
        billingDay?: number;
        /**
         * Bir nechta kursdagi o'quvchidan pul olinganda:
         * 'eski' — eng eski qarzdan yopiladi, 'teng' — kurslarga teng bo'linadi,
         * 'qarz' — qarz ulushiga qarab bo'linadi.
         */
        multiCoursePay?: 'eski' | 'teng' | 'qarz';
        instagram?: string;
        workingHours?: string;
        eskizEmail?: string;
        eskizPassword?: string;
        eskizFrom?: string;
        /** Payme. Kalitlarning o'zi serverdan qaytmaydi — faqat `...Set` belgilari. */
        paymeMerchantId?: string | null;
        paymeKey?: string;
        paymeTestKey?: string;
        paymeKeySet?: boolean;
        paymeTestKeySet?: boolean;
        /** Serverda SETTINGS_KEY bormi — bo'lmasa kalitlar saqlanmaydi. */
        settingsEncryption?: boolean;
        paymeMode?: 'off' | 'test' | 'live';
        /** Kassa hisob maydonlari: order_id yoki student_id + course_id. */
        paymeScheme?: 'order' | 'student' | 'student_only';
        paymeEndpointToken?: string | null;
        paymeAllowRefund?: boolean;
        paymeIpCheck?: boolean;
        paymeMxik?: string | null;
        paymePackageCode?: string | null;
        paymeVatPercent?: number;
    };
    questions: Question[];
    exams: Exam[];
    examResults: ExamResult[];
    topics: Topic[];
}

// --- Imtihon moduli (docs/IMTIHON_PLAN.md, mantiq — lib/imtihon.js) ---

export type SavolTuri = 'yopiq' | 'raqamli' | 'yozma';

export interface Question {
    id: number;
    text: string;
    imageUrl?: string | null;
    type: SavolTuri;
    /** Yopiq savol variantlari (2–6 ta). */
    options: string[];
    /** Yopiq: 'A'..'F'; raqamli: asosiy javob. */
    correctAnswer: string;
    /** Raqamli: qo'shimcha qabul qilinadigan javoblar. */
    answers?: string[] | null;
    points?: number | null;
    lockOptions?: boolean;
    difficulty: number;
    subject: string;
    topic: string;
    section?: string | null;
    grade?: string | null;
    source?: string | null;
    language?: 'uz' | 'ru' | 'en';
    solution?: string | null;
    solutionStatus?: 'yoq' | 'qoralama' | 'tasdiqlangan';
    status?: 'qoralama' | 'faol' | 'arxiv';
    passageId?: number | null;
    passage?: { id: number; title?: string | null } | null;
    usedCount?: number;
    pCorrect?: number | null;
    discrimination?: number | null;
    /** Imtihonga yaramasa — sababi (server hisoblaydi). */
    xato?: string | null;
    schoolId: number;
}

export interface Passage {
    id: number;
    title?: string | null;
    text: string;
    imageUrl?: string | null;
    subject: string;
    schoolId: number;
    _count?: { questions: number };
}

export interface TopicRule {
    /** '' — fan ichidagi istalgan mavzu. */
    topic: string;
    count: number;
    type?: SavolTuri;
    difficulty?: number;
    /** Shu qoidadagi savol bali (bo'lmasa blok bali). */
    points?: number;
}

export interface ExamBlock {
    id: string;
    subject: string;
    topicRules: TopicRule[];
    pointsPerQuestion: number;
}

export interface ExamSettings {
    sessions: { id: number; name: string; time: string }[];
    sessionQuestions: 'bir' | 'alohida';
    variantCount: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    language: '' | 'uz' | 'ru' | 'en';
    seatMode: 'hammasi' | 'shaxmat';
    sessionFill: 'teng' | 'ketma' | 'kurs';
    roomIds: number[];
    variantBubble: boolean;
    cancelled: Record<string, 'hammaga' | 'chiqarish'>;
    keyFix: Record<string, string[]>;
    ranking: 'hammasi' | 'top' | 'yoq';
    topN: number;
    showQuestionsAfter: boolean;
    notify: { channel: 'BOTH' | 'TELEGRAM' | 'SMS' | 'NONE'; to: 'PARENT' | 'STUDENT' | 'ALL'; template: string };
    admit: { channel: 'BOTH' | 'TELEGRAM' | 'SMS' | 'NONE'; to: 'PARENT' | 'STUDENT' | 'ALL'; auto: boolean; template: string };
    rasch: { enabled: boolean; grades: { label: string; min: number }[] };
    /** 'bank' — variantlar savollar bankidan; 'kalit' — markazning o'z kitobchasi, faqat kalit kiritiladi. */
    source: 'bank' | 'kalit';
    /** "Faqat kalit" rejimi: {'smena|variant': [1-savol kaliti, ...]} (kalit ruxsatisiz bo'sh keladi). */
    keys: Record<string, string[]>;
    optionCount: number;
}

export type ExamStatus = 'Qoralama' | 'Tayyor' | 'Tekshirilmoqda' | "E'lon qilindi";

export interface Exam {
    id: number;
    name: string;
    date: string;
    duration: number;
    schoolId: number;
    status: ExamStatus;
    blocks: ExamBlock[];
    totalQuestions: number;
    maxScore: number;
    scoring: 'blok' | 'foiz';
    branchIds: number[];
    settings: ExamSettings;
    lockedAt?: string | null;
    publishedAt?: string | null;
    createdAt?: string;
    _count?: { results: number; seats: number; assignments?: number };
}

export interface ExamResult {
    id: number;
    studentId: number | null;
    examId: number;
    variantCode?: string | null;
    answers?: Record<string, any> | null;
    score: number;
    percentage: number;
    blockScores?: { subject: string; earned: number; max: number; togri?: number; xato?: number; bosh?: number }[] | null;
    scannedAt: string;
    schoolId: number;
    rank?: number | null;
    rankBranch?: number | null;
    rankGroup?: number | null;
    reviewStatus?: 'avto' | 'shubhali' | 'tekshirildi';
}
