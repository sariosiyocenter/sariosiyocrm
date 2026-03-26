export type UserRole = 'ADMIN' | 'MANAGER' | 'TEACHER' | 'RECEPTIONIST' | 'DRIVER';

export interface Student {
    id: number;
    name: string;
    phone: string;
    birthDate: string;
    address: string;
    location?: string;
    status: 'Faol' | 'Arxiv' | 'Sinov' | 'Bitiruvchi';
    joinedDate: string;
    balance: number;
    photo?: string;
    groups: number[]; // Array of Group IDs
    comment?: string;
    rating?: number;
    fatherName?: string;
    fatherPhone?: string;
    motherName?: string;
    motherPhone?: string;
    schoolId: number;
    statusChangedAt?: string;
    leaveReason?: string;
    transportId?: number | null;
    studentSchool?: string;
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
    status: 'Faol' | 'Arxiv';
    schoolId: number;
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
}

export interface Payment {
    id: number;
    studentId: number;
    amount: number;
    type: 'Naqd' | 'Karta' | 'Peyme' | 'Klik';
    date: string;
    description: string;
    schoolId: number;
}

export interface Expense {
    id: number;
    amount: number;
    category: string; // Ish haqi, Ijara, Kommunal, Marketing, Boshqa
    date: string;
    description: string;
    schoolId: number;
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
    transportId: number;
    studentId: number;
    date: string;
    status: 'Olib ketildi' | 'Uyiga yetkazildi' | 'Kelmadi';
    schoolId: number;
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
    studentIds: number[];
    schoolId: number;
    createdAt: string;
    updatedAt: string;
}

export interface Course {
    id: number;
    name: string;
    price: number;
    schoolId: number;
}

export interface Room {
    id: number;
    name: string;
    capacity: number;
    schoolId: number;
}

export interface School {
    id: number;
    name: string;
    address: string;
}

export interface Attendance {
    id: number;
    studentId: number;
    groupId: number;
    date: string;
    status: 'Keldi' | 'Kelmapdi' | 'Sababli' | 'Dars bo\'lmadi';
    schoolId: number;
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
    expenses: Expense[];
    transports: Transport[];
    deliveryLogs: DeliveryLog[];
    routes: Route[];
    users: User[];
    selectedSchoolId: number | null;
    settings: {
        id: number;
        schoolId: number;
        orgName: string;
        logo?: string;
        adminPhone?: string;
        address?: string;
        telegram?: string;
        instagram?: string;
        workingHours?: string;
    };
}
