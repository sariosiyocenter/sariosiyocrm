import React, { createContext, useContext, useState, useEffect } from 'react';
import { Student, Teacher, Group, Lead, Payment, CRMState, Course, Room, School } from '../types';

interface CRMContextType extends CRMState {
    addStudent: (student: Omit<Student, 'id'>) => void;
    updateStudent: (id: number, student: Partial<Student>) => void;
    deleteStudent: (id: number) => void;
    addTeacher: (teacher: Omit<Teacher, 'id'>) => void;
    updateTeacher: (id: number, teacher: Partial<Teacher>) => void;
    addGroup: (group: Omit<Group, 'id'>) => void;
    updateLead: (id: number, status: Lead['status']) => void;
    addPayment: (payment: Omit<Payment, 'id'>) => void;
    addLead: (lead: Omit<Lead, 'id'>) => void;
    updateSettings: (settings: Partial<CRMState['settings']>) => void;
    addCourse: (course: Course) => void;
    deleteCourse: (id: string) => void;
    addRoom: (room: Room) => void;
    deleteRoom: (id: string) => void;
    addSchool: (school: School) => void;
    deleteSchool: (id: string) => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

const INITIAL_DATA: CRMState = {
    students: [
        { id: 1, name: "Sarvarjon", phone: "+998770023656", birthDate: "2010-05-15", address: "Sariosiyo", status: 'Faol', joinedDate: "2024-01-10", balance: -400000, groups: [1], rating: 52.5 }
    ],
    teachers: [
        { id: 1, name: "Malika Tursunova", phone: "+998998557896", salary: 5600000, sharePercentage: 0, lessonFee: 0, birthDate: "1997-01-05", hiredDate: "2025-12-13", status: 'Faol' }
    ],
    groups: [
        { id: 1, name: "Kimyo A1", teacherId: 1, courseId: "kimyo", schedule: "19:00 - 20:00", days: "Juft kunlar", studentIds: [1], room: "1-xona" }
    ],
    leads: [
        { id: 1, name: "Davronbek", phone: "+998901234567", course: "Ingliz tili", source: "Telegram", status: 'Yangi', createdAt: new Date().toISOString() },
        { id: 2, name: "Zuhra", phone: "+998931112233", course: "Matematika", source: "Instagram", status: 'O\'ylayapti', createdAt: new Date().toISOString() }
    ],
    payments: [
        { id: 1, studentId: 1, amount: 200000, type: 'Naqd', date: "2024-03-01", description: "Fevral oyi uchun" }
    ],
    courses: [
        { id: 'kimyo', name: 'Kimyo', price: 400000 },
        { id: 'matematika', name: 'Matematika', price: 450000 }
    ],
    rooms: [
        { id: '1-xona', name: '1-xona', capacity: 15 },
        { id: '2-xona', name: '2-xona', capacity: 20 }
    ],
    schools: [
        { id: 'maktab-1', name: '1-maktab', address: 'Sariosiyo tumani' }
    ],
    settings: {
        orgName: "SARIOSIYO",
        paymentMethods: ["Naqd", "Karta", "Peyme", "Klik"],
        isCheckEnabled: true,
        isCommentRequired: false,
        isTeacherSalaryHidden: false,
        isSplitPaymentDisabled: false,
        isTeacherAttendanceSalaryEnabled: true,
        isTeacherAddingStudentsDisabled: false,
        calendarInterval: 30
    }
};

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<CRMState>(() => {
        const saved = localStorage.getItem('crm_data');
        if (saved) {
            const data = JSON.parse(saved);
            return {
                ...INITIAL_DATA,
                ...data,
                settings: { ...INITIAL_DATA.settings, ...data.settings }
            };
        }
        return INITIAL_DATA;
    });

    useEffect(() => {
        localStorage.setItem('crm_data', JSON.stringify(state));
    }, [state]);

    const addStudent = (student: Omit<Student, 'id'>) => {
        const newStudent = { ...student, id: Date.now() };
        setState(prev => ({ ...prev, students: [...prev.students, newStudent] }));
    };

    const updateStudent = (id: number, student: Partial<Student>) => {
        setState(prev => ({
            ...prev,
            students: prev.students.map(s => s.id === id ? { ...s, ...student } : s)
        }));
    };

    const deleteStudent = (id: number) => {
        setState(prev => ({
            ...prev,
            students: prev.students.filter(s => s.id !== id)
        }));
    };

    const addTeacher = (teacher: Omit<Teacher, 'id'>) => {
        const newTeacher = { ...teacher, id: Date.now() };
        setState(prev => ({ ...prev, teachers: [...prev.teachers, newTeacher] }));
    };

    const updateTeacher = (id: number, teacher: Partial<Teacher>) => {
        setState(prev => ({
            ...prev,
            teachers: prev.teachers.map(t => t.id === id ? { ...t, ...teacher } : t)
        }));
    };

    const addGroup = (group: Omit<Group, 'id'>) => {
        setState(prev => ({ ...prev, groups: [...prev.groups, { ...group, id: Date.now() }] }));
    };

    const updateLead = (id: number, status: Lead['status']) => {
        setState(prev => ({
            ...prev,
            leads: prev.leads.map(l => l.id === id ? { ...l, status } : l)
        }));
    };

    const addLead = (lead: Omit<Lead, 'id'>) => {
        const newLead = { ...lead, id: Date.now(), createdAt: new Date().toISOString() };
        setState(prev => ({ ...prev, leads: [...prev.leads, newLead] }));
    };

    const addPayment = (payment: Omit<Payment, 'id'>) => {
        const newPayment = { ...payment, id: Date.now() };
        setState(prev => {
            const updatedStudents = prev.students.map(s =>
                s.id === payment.studentId ? { ...s, balance: (s.balance || 0) + payment.amount } : s
            );
            return {
                ...prev,
                payments: [...prev.payments, newPayment],
                students: updatedStudents
            };
        });
    };

    const updateSettings = (newSettings: Partial<CRMState['settings']>) => {
        setState(prev => ({
            ...prev,
            settings: { ...prev.settings, ...newSettings }
        }));
    };

    const addCourse = (course: Course) => {
        setState(prev => ({ ...prev, courses: [...prev.courses, course] }));
    };

    const deleteCourse = (id: string) => {
        setState(prev => ({ ...prev, courses: prev.courses.filter(c => c.id !== id) }));
    };

    const addRoom = (room: Room) => {
        setState(prev => ({ ...prev, rooms: [...prev.rooms, room] }));
    };

    const deleteRoom = (id: string) => {
        setState(prev => ({ ...prev, rooms: prev.rooms.filter(r => r.id !== id) }));
    };

    const addSchool = (school: School) => {
        setState(prev => ({ ...prev, schools: [...prev.schools, school] }));
    };

    const deleteSchool = (id: string) => {
        setState(prev => ({ ...prev, schools: prev.schools.filter(s => s.id !== id) }));
    };

    return (
        <CRMContext.Provider value={{
            ...state,
            addStudent, updateStudent, deleteStudent,
            addTeacher, updateTeacher,
            addGroup,
            updateLead, addLead,
            addPayment,
            updateSettings,
            addCourse, deleteCourse,
            addRoom, deleteRoom,
            addSchool, deleteSchool
        }}>
            {children}
        </CRMContext.Provider>
    );
};

export const useCRM = () => {
    const context = useContext(CRMContext);
    if (context === undefined) {
        throw new Error('useCRM must be used within a CRMProvider');
    }
    return context;
};
