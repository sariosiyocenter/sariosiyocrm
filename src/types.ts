export interface Student {
    id: number;
    name: string;
    phone: string;
    birthDate: string;
    address: string;
    status: 'Faol' | 'Arxiv' | 'Sinov';
    joinedDate: string;
    balance: number;
    photo?: string;
    groups: number[]; // Array of Group IDs
    comment?: string;
    rating?: number;
}

export interface Teacher {
    id: number;
    name: string;
    phone: string;
    salary: number;
    sharePercentage: number;
    lessonFee: number;
    birthDate: string;
    hiredDate: string;
    photo?: string;
    status: 'Faol' | 'Arxiv';
}

export interface Group {
    id: number;
    name: string;
    teacherId: number;
    courseId: string;
    schedule: string; // e.g., "19:00 - 20:00"
    days: string; // e.g., "Juft kunlar"
    studentIds: number[];
    room?: string;
}

export interface Lead {
    id: number;
    name: string;
    phone: string;
    course: string;
    source: string;
    status: 'Yangi' | 'Bog\'lanilmadi' | 'O\'ylayapti' | 'Kelishdi' | 'To\'lov qildi';
    createdAt: string;
}

export interface Payment {
    id: number;
    studentId: number;
    amount: number;
    type: 'Naqd' | 'Karta' | 'Peyme' | 'Klik';
    date: string;
    description: string;
}

export interface Course {
    id: string;
    name: string;
    price: number;
}

export interface Room {
    id: string;
    name: string;
    capacity: number;
}

export interface School {
    id: string;
    name: string;
    address: string;
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
    settings: {
        orgName: string;
        logo?: string;
        paymentMethods: string[];
        isCheckEnabled: boolean;
        isCommentRequired: boolean;
        isTeacherSalaryHidden: boolean;
        isSplitPaymentDisabled: boolean;
        isTeacherAttendanceSalaryEnabled: boolean;
        isTeacherAddingStudentsDisabled: boolean;
        calendarInterval: number;
    };
}
