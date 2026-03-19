export type UserRole = 'ADMIN' | 'MANAGER' | 'TEACHER' | 'RECEPTIONIST';

export interface Student {
    id: number;
    name: string;
    phone: string;
    birthDate: string;
    address: string;
    location?: string;
    status: 'Faol' | 'Arxiv' | 'Sinov';
    joinedDate: string;
    balance: number;
    photo?: string;
    groups: number[]; // Array of Group IDs
    comment?: string;
    rating?: number;
    schoolId: number;
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
