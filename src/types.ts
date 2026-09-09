export type UserRole = 'ADMIN' | 'MANAGER' | 'TEACHER' | 'RECEPTIONIST' | 'DRIVER' | 'SUPERADMIN' | 'SELLER';

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
    studentSchool?: string;
    privilegeType?: string;
    certCategory?: string;
    certSubject?: string;
    certType?: string;
    certScore?: string;
    customPrices?: any;
    certificates?: any;
    orgType?: string;
    region?: string;
    district?: string;
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
        address?: string;
        /** Markaz binosi: "kenglik,uzunlik". Sozlamalarda xaritadan belgilanadi. */
        centerLocation?: string;
        /** Haydovchi belgilaganda ota-onaga xabar ketsinmi. */
        transportNotify?: boolean;
        /** TELEGRAM | SMS | BOTH. */
        transportChannel?: string;
        telegram?: string;
        instagram?: string;
        workingHours?: string;
        eskizEmail?: string;
        eskizPassword?: string;
        eskizFrom?: string;
    };
    questions: Question[];
    exams: Exam[];
    examResults: ExamResult[];
    topics: Topic[];
}

export interface Question {
    id: number;
    text: string;
    imageUrl?: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    difficulty: number;
    subject: string;
    topic: string;
    schoolId: number;
}

export interface TopicRule {
    topic: string;
    count: number;
}

export interface ExamBlock {
    id: string;
    subject: string;
    topicRules: TopicRule[];
    pointsPerQuestion: number;
}

export interface Variant {
    id: string;
    variantCode: string;
    questions: {
        questionId: number;
        order: number;
        shuffledOptions: {
            A: string;
            B: string;
            C: string;
            D: string;
        };
        correctOption: 'A' | 'B' | 'C' | 'D';
    }[];
}

export interface Exam {
    id: number;
    name: string;
    date: string;
    duration: number;
    schoolId: number;
    status: 'Yaqinlashmoqda' | 'Tugallangan' | 'Qoralama';
    blocks: ExamBlock[];
    totalQuestions: number;
    maxScore: number;
    variants?: Variant[];
}

export interface ExamResult {
    id: number;
    studentId: number;
    examId: number;
    variantCode?: string;
    answers?: Record<number, 'A' | 'B' | 'C' | 'D' | null>;
    score: number;
    percentage: number;
    blockScores?: { subject: string; earned: number; max: number }[];
    scannedAt: string;
    schoolId: number;
}
