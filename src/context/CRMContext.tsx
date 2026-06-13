import React, { createContext, useContext, useState, useEffect } from 'react';
import { Student, Teacher, Group, Lead, Payment, CRMState, Course, Room, School, UserRole, Attendance, Score, TeacherAttendance, Expense, Transport, DeliveryLog, Route, Question, Exam, ExamResult, Variant, Topic } from '../types';
import { generateVariants } from '../lib/shuffler';

export const THEMES = [
    { id: 'zumrad', name: "Sokin Zumrad", primary: '#1b6b6b', hover: '#155252', light: '#f0f8f8', gradientStart: '#1b6b6b', gradientEnd: '#2e9c9c' },
    { id: 'indigo', name: "Kosmik Indigo", primary: '#6366f1', hover: '#4f46e5', light: '#eef2ff', gradientStart: '#6366f1', gradientEnd: '#4f46e5' },
    { id: 'yoqut', name: "Qirollik Yoquti", primary: '#dc2626', hover: '#b91c1c', light: '#fef2f2', gradientStart: '#dc2626', gradientEnd: '#ef4444' },
    { id: 'oltin', name: "Zafaron Oltin", primary: '#d97706', hover: '#b45309', light: '#fffbeb', gradientStart: '#d97706', gradientEnd: '#f59e0b' },
    { id: 'okean', name: "Klassik Okean", primary: '#0284c7', hover: '#0369a1', light: '#f0f9ff', gradientStart: '#0284c7', gradientEnd: '#38bdf8' },
    { id: 'yalpiz', name: "Yalpiz Tarovati", primary: '#059669', hover: '#047857', light: '#ecfdf5', gradientStart: '#059669', gradientEnd: '#10b981' },
    { id: 'binafsha', name: "Tungi Binafsha", primary: '#7c3aed', hover: '#6d28d9', light: '#f5f3ff', gradientStart: '#7c3aed', gradientEnd: '#8b5cf6' },
    { id: 'burgundiya', name: "Burgundiya Iffati", primary: '#db2777', hover: '#be185d', light: '#fdf2f8', gradientStart: '#db2777', gradientEnd: '#ec4899' },
    { id: 'bronza', name: "Kuzgi Bronza", primary: '#854d0e', hover: '#713f12', light: '#fefce8', gradientStart: '#854d0e', gradientEnd: '#a16207' },
    { id: 'shifer', name: "Tungi Shifer", primary: '#475569', hover: '#334155', light: '#f8fafc', gradientStart: '#475569', gradientEnd: '#64748b' }
];

interface AuthenticatedUser {
    id: number;
    email: string;
    name: string;
    role: UserRole;
    schoolId: number | null;
}

interface CRMContextType extends CRMState {
    loading: boolean;
    error: string | null;
    user: AuthenticatedUser | null;
    token: string | null;
    darkMode: boolean;
    toggleDarkMode: () => void;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
    setSelectedSchoolId: (id: number) => void;
    addStudent: (student: Omit<Student, 'id' | 'schoolId'>) => Promise<void>;
    updateStudent: (id: number, student: Partial<Student>) => Promise<void>;
    deleteStudent: (id: number) => Promise<void>;
    importStudents: (students: any[]) => Promise<void>;
    addStudentToGroup: (groupId: number, studentId: number) => Promise<void>;
    removeStudentFromGroup: (groupId: number, studentId: number) => Promise<void>;
    addTeacher: (teacher: Omit<Teacher, 'id' | 'schoolId'>) => Promise<void>;
    updateTeacher: (id: number, teacher: Partial<Teacher>) => Promise<void>;
    deleteTeacher: (id: number) => Promise<void>;
    addGroup: (group: Omit<Group, 'id' | 'schoolId'>) => Promise<void>;
    updateGroup: (id: number, group: Partial<Group>) => Promise<void>;
    deleteGroup: (id: number) => Promise<void>;
    addLead: (lead: Omit<Lead, 'id' | 'schoolId'>) => Promise<void>;
    updateLead: (id: number, status: Lead['status']) => Promise<void>;
    deleteLead: (id: number) => Promise<void>;
    addPayment: (payment: Omit<Payment, 'id' | 'schoolId'>) => Promise<void>;
    updateSettings: (settings: Partial<CRMState['settings']>) => Promise<void>;
    addCourse: (course: Omit<Course, 'id' | 'schoolId'>) => Promise<void>;
    deleteCourse: (id: number) => Promise<void>;
    addRoom: (room: Omit<Room, 'id' | 'schoolId'>) => Promise<void>;
    deleteRoom: (id: number) => Promise<void>;
    addSchool: (school: Omit<School, 'id'>) => Promise<void>;
    deleteSchool: (id: number) => Promise<void>;
    addAttendance: (attendance: Omit<Attendance, 'id' | 'schoolId'>) => Promise<void>;
    updateAttendance: (id: number, updates: Partial<Attendance>) => Promise<void>;
    addBatchAttendance: (groupId: number, date: string, records: { studentId: number; status: string }[], topicId?: number) => Promise<void>;
    deleteBatchAttendance: (groupId: number, date: string) => Promise<void>;
    addTopic: (topic: Omit<Topic, 'id' | 'schoolId'>) => Promise<void>;
    updateTopic: (id: number, topic: Partial<Topic>) => Promise<void>;
    deleteTopic: (id: number) => Promise<void>;
    addScore: (score: Omit<Score, 'id' | 'schoolId'>) => Promise<void>;
    addTeacherAttendance: (attendance: Omit<TeacherAttendance, 'id' | 'schoolId'>) => Promise<void>;
    addExpense: (expense: Omit<Expense, 'id' | 'schoolId'>) => Promise<void>;
    deleteExpense: (id: number) => Promise<void>;
    addTransport: (transport: Omit<Transport, 'id' | 'schoolId'>) => Promise<void>;
    updateTransport: (id: number, transport: Partial<Transport>) => Promise<void>;
    deleteTransport: (id: number) => Promise<void>;
    addRoute: (route: Omit<Route, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateRoute: (id: number, route: Partial<Route>) => Promise<void>;
    deleteRoute: (id: number) => Promise<void>;
    addExam: (exam: Omit<Exam, 'id' | 'schoolId'>) => Promise<void>;
    updateExam: (id: number, exam: Partial<Exam>) => Promise<void>;
    deleteExam: (id: number) => Promise<void>;
    generateExamVariants: (examId: number, count: number) => Promise<void>;
    addQuestion: (question: Omit<Question, 'id' | 'schoolId'>) => Promise<void>;
    updateQuestion: (id: number, question: Partial<Question>) => Promise<void>;
    deleteQuestion: (id: number) => Promise<void>;
    addExamResult: (result: Omit<ExamResult, 'id' | 'schoolId'>) => Promise<ExamResult>;
    addDeliveryLog: (log: Omit<DeliveryLog, 'id' | 'schoolId'>) => Promise<void>;
    fetchDeliveryLogs: (date: string) => Promise<DeliveryLog[]>;
    notification: { message: string, type: 'success' | 'error' | 'info' } | null;
    showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
    themeColor: string;
    setThemeColor: (themeId: string) => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

const API_BASE = '/api';

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<CRMState>({
        students: [], teachers: [], groups: [], leads: [], payments: [], courses: [], rooms: [], schools: [],
        attendances: [], scores: [], teacherAttendances: [], expenses: [],
        transports: [], deliveryLogs: [], routes: [], users: [],
        questions: [], exams: [], examResults: [],
        topics: [],
        selectedSchoolId: null,
        settings: {
            id: 0,
            schoolId: 0,
            orgName: "QUANTUM EDU",
            adminPhone: "",
            address: "",
            telegram: "",
            instagram: "",
            workingHours: ""
        }
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<AuthenticatedUser | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [darkMode, setDarkMode] = useState<boolean>(() => {
        const saved = localStorage.getItem('darkMode');
        return saved ? JSON.parse(saved) : false;
    });
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

    const [themeColor, setThemeColorState] = useState<string>(() => {
        return localStorage.getItem('crm_theme') || 'zumrad';
    });

    const setThemeColor = (themeId: string) => {
        setThemeColorState(themeId);
        localStorage.setItem('crm_theme', themeId);
    };

    useEffect(() => {
        const theme = THEMES.find(t => t.id === themeColor) || THEMES[0];
        let styleEl = document.getElementById('crm-dynamic-theme');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'crm-dynamic-theme';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = `
            :root {
                --color-brand: ${theme.primary};
                --color-brand-dark: ${theme.hover};
                --color-brand-light: ${theme.light};
                --brand-color: ${theme.primary};
                --brand-hover: ${theme.hover};
                --brand-light: ${theme.light};
                --brand-gradient: linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd});
            }

            .bg-\\[\\#1b6b6b\\] {
                background-color: ${theme.primary} !important;
            }
            .text-\\[\\#1b6b6b\\] {
                color: ${theme.primary} !important;
            }
            .border-\\[\\#1b6b6b\\] {
                border-color: ${theme.primary} !important;
            }
            .hover\\:bg-\\[\\#155252\\]:hover {
                background-color: ${theme.hover} !important;
            }
            .hover\\:text-\\[\\#155252\\]:hover {
                color: ${theme.hover} !important;
            }
            .focus\\:border-\\[\\#1b6b6b\\]:focus {
                border-color: ${theme.primary} !important;
            }
            .focus\\:ring-\\[\\#1b6b6b\\]\\/10:focus {
                --tw-ring-color: ${theme.primary}1a !important;
            }
            .from-\\[\\#1b6b6b\\] {
                --tw-gradient-from: ${theme.primary} !important;
                --tw-gradient-to: ${theme.primary}00 !important;
                --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;
            }
            .to-\\[\\#2e9c9c\\] {
                --tw-gradient-to: ${theme.gradientEnd} !important;
            }
            .text-teal-650, .text-teal-600 {
                color: ${theme.primary} !important;
            }
            .bg-teal-50 {
                background-color: ${theme.light} !important;
            }
            .border-teal-100 {
                border-color: ${theme.light} !important;
            }
            .dark\\:bg-teal-950\\/20:is(.dark, .dark *) {
                background-color: ${theme.primary}15 !important;
            }
            .dark\\:text-teal-400:is(.dark, .dark *) {
                color: ${theme.gradientEnd} !important;
            }
            .dark\\:border-teal-900\\/40:is(.dark, .dark *) {
                border-color: ${theme.primary}30 !important;
            }
            .shadow-\\[\\#1b6b6b\\]\\/20 {
                --tw-shadow-color: ${theme.primary}33 !important;
            }
            
            .text-teal-500 {
                color: ${theme.gradientEnd} !important;
            }
            .bg-teal-500 {
                background-color: ${theme.gradientEnd} !important;
            }
            .border-teal-500 {
                border-color: ${theme.gradientEnd} !important;
            }
        `;
    }, [themeColor]);

    const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('darkMode', JSON.stringify(darkMode));
    }, [darkMode]);

    const toggleDarkMode = () => setDarkMode(prev => !prev);

    const setSelectedSchoolId = (id: number) => {
        setState(prev => ({ ...prev, selectedSchoolId: id }));
    };

    const fetchData = async (overrideToken?: string, overrideSchoolId?: number, roleOverride?: UserRole) => {
        const currentToken = overrideToken || token;
        const currentSchoolId = overrideSchoolId !== undefined ? overrideSchoolId : state.selectedSchoolId;
        const activeRole = roleOverride || user?.role;

        if (!currentToken) return;

        try {
            setLoading(true);

            // SUPERADMIN — data organizations sahifasida o'zi yuklanadi
            if (activeRole === 'SUPERADMIN') {
                setError(null);
                setLoading(false);
                return;
            }

            // Maktab ID ni aniqlash
            let schoolIdToUse = currentSchoolId;
            if (schoolIdToUse === null) {
                schoolIdToUse = overrideSchoolId ?? null;
            }
            if (schoolIdToUse === null) {
                // Birinchi urinishda schoolId topish uchun schools ro'yxatini olamiz
                const schoolsRes = await fetch(`${API_BASE}/schools`, {
                    headers: { 'Authorization': `Bearer ${currentToken}` }
                });
                if (schoolsRes.status === 401 || schoolsRes.status === 403) { logout(); return; }
                let schools: School[] = await schoolsRes.json();
                if (activeRole === 'MANAGER') {
                    schools = schools.filter(s => s.id === (overrideSchoolId ?? state.selectedSchoolId));
                }
                schoolIdToUse = schools[0]?.id ?? null;
                if (schoolIdToUse) setSelectedSchoolId(schoolIdToUse);
            }

            if (schoolIdToUse === null) {
                setLoading(false);
                return;
            }

            // 19 request → 1 request: /api/init
            const res = await fetch(`${API_BASE}/init?schoolId=${schoolIdToUse}`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            if (res.status === 401 || res.status === 403) { logout(); return; }
            if (!res.ok) throw new Error(`Init fetch error: ${res.statusText}`);

            const data = await res.json();

            setState(prev => ({
                ...prev,
                schools:            data.schools        || [],
                students:           data.students       || [],
                teachers:           data.teachers       || [],
                groups:             data.groups         || [],
                leads:              data.leads          || [],
                payments:           data.payments       || [],
                courses:            data.courses        || [],
                rooms:              data.rooms          || [],
                settings:           data.settings       || prev.settings,
                attendances:        data.attendances    || [],
                scores:             data.scores         || [],
                teacherAttendances: data.teacherAttendances || [],
                expenses:           data.expenses       || [],
                transports:         data.transports     || [],
                routes:             data.routes         || [],
                users:              data.users          || [],
                questions:          data.questions      || [],
                exams:              data.exams          || [],
                examResults:        data.examResults    || [],
                topics:             data.topics         || [],
                deliveryLogs:       [],
                selectedSchoolId:   schoolIdToUse
            }));

            setError(null);
        } catch (err: any) {
            console.error("Failed to load CRM data", err);
            setError(err.message || "Xatolik yuz berdi");
        } finally {
            setLoading(false);
        }
    };

    // JWT payload ni client-da decode qilish (verification emas, optimizatsiya uchun)
    const decodeToken = (t: string): { role?: string; schoolId?: number } | null => {
        try {
            if (t.startsWith('mock_token_')) return null;
            const decoded = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return decoded || null;
        } catch {
            return null;
        }
    };

    const checkAuth = async () => {
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);

            // JWT dan rolni oldindan o'qib, parallel optimizatsiya
            const decoded = decodeToken(token);
            const predictedRole = decoded?.role;
            const predictedSchoolId = decoded?.schoolId;
            const headers = { 'Authorization': `Bearer ${token}` };

            const authPromise = fetch(`${API_BASE}/auth/me`, { headers });

            // SUPERADMIN emas + schoolId JWT da bor → /api/init ni parallel boshlash
            const initPromise = (predictedRole && predictedRole !== 'SUPERADMIN' && predictedSchoolId)
                ? fetch(`${API_BASE}/init?schoolId=${predictedSchoolId}`, { headers })
                : null;

            const res = await authPromise;
            if (res.ok) {
                const userData = await res.json();
                setUser(userData);

                if (userData.role === 'SUPERADMIN') {
                    // SUPERADMIN — data organizations sahifasida yuklanadi, bu yerda hech narsa kerak emas
                    setLoading(false);
                    return;
                } else if (initPromise) {
                    // Init response allaqachon yuborilgan, faqat kutamiz
                    const initRes = await initPromise;
                    if (initRes.status === 401 || initRes.status === 403) { logout(); return; }
                    if (initRes.ok) {
                        const data = await initRes.json();
                        setState(prev => ({
                            ...prev,
                            schools:            data.schools        || [],
                            students:           data.students       || [],
                            teachers:           data.teachers       || [],
                            groups:             data.groups         || [],
                            leads:              data.leads          || [],
                            payments:           data.payments       || [],
                            courses:            data.courses        || [],
                            rooms:              data.rooms          || [],
                            settings:           data.settings       || prev.settings,
                            attendances:        data.attendances    || [],
                            scores:             data.scores         || [],
                            teacherAttendances: data.teacherAttendances || [],
                            expenses:           data.expenses       || [],
                            transports:         data.transports     || [],
                            routes:             data.routes         || [],
                            users:              data.users          || [],
                            questions:          data.questions      || [],
                            exams:              data.exams          || [],
                            examResults:        data.examResults    || [],
                            topics:             data.topics         || [],
                            deliveryLogs:       [],
                            selectedSchoolId:   userData.schoolId
                        }));
                    } else {
                        await fetchData(token, userData.schoolId || undefined, userData.role);
                    }
                } else {
                    await fetchData(token, userData.schoolId || undefined, userData.role);
                }
            } else {
                if (token.startsWith('mock_token_')) {
                    setUser({ id: 1, name: "Admin (Mock)", email: "admin@sariosiyo.uz", role: "ADMIN", schoolId: 1 });
                    return;
                }
                logout();
            }
        } catch (err) {
            console.error("Auth check failed", err);
            if (token.startsWith('mock_token_')) {
                setUser({ id: 1, name: "Admin (Mock)", email: "admin@sariosiyo.uz", role: "ADMIN", schoolId: 1 });
            } else {
                logout();
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (state.selectedSchoolId !== null && user) {
            fetchData(undefined, undefined, user.role);
        }
    }, [state.selectedSchoolId]);

    const login = async (email: string, password: string) => {
        try {
            setError(null);
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Login xatosi");

            setToken(data.token);
            setUser(data.user);
            localStorage.setItem('token', data.token);
            await fetchData(data.token, data.user.schoolId || undefined, data.user.role);
        } catch (err: any) {
            if (err.message.includes('Unexpected end of JSON input') || err.message.includes('Failed to fetch')) {
                const mockToken = "mock_token_" + Date.now();
                const mockUser = {
                    id: 1,
                    name: "Admin (Mock)",
                    email: email,
                    role: "ADMIN" as any,
                    schoolId: 1
                };
                setToken(mockToken);
                setUser(mockUser);
                localStorage.setItem('token', mockToken);
                setError(null);
                return;
            }
            setError(err.message);
            throw err;
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        setState({
            students: [], teachers: [], groups: [], leads: [], payments: [], courses: [], rooms: [], schools: [],
            attendances: [], scores: [], teacherAttendances: [], expenses: [],
            transports: [], deliveryLogs: [], routes: [], users: [],
            questions: [], exams: [], examResults: [],
            topics: [],
            selectedSchoolId: null,
            settings: {
                id: 0,
                schoolId: 0,
                orgName: "QUANTUM EDU",
                adminPhone: "",
                address: "",
                telegram: "",
                instagram: "",
                workingHours: ""
            }
        });
    };

    const apiCall = async (endpoint: string, method: string, data?: any) => {
        if (!token) throw new Error("Avtorizatsiya kerak");

        const dataWithSchoolId = (data && !endpoint.startsWith('schools')) ? {
            schoolId: (!state.selectedSchoolId || state.selectedSchoolId === 0) ? user?.schoolId : state.selectedSchoolId,
            ...data
        } : data;

        const res = await fetch(`${API_BASE}/${endpoint}`, {
            method,
            headers: {
                ...(dataWithSchoolId ? { 'Content-Type': 'application/json' } : {}),
                'Authorization': `Bearer ${token}`
            },
            body: dataWithSchoolId ? JSON.stringify(dataWithSchoolId) : undefined,
        });
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        return method !== 'DELETE' ? await res.json() : null;
    };

    const addStudent = async (student: Omit<Student, 'id' | 'schoolId'>) => {
        try {
            const newStudent = await apiCall('students', 'POST', student);
            setState(prev => ({ ...prev, students: [...prev.students, newStudent] }));
            showNotification("Yangi o'quvchi muvaffaqiyatli qo'shildi", "success");
        } catch (err: any) {
            showNotification("O'quvchini qo'shishda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const updateStudent = async (id: number, student: Partial<Student>) => {
        try {
            const updated = await apiCall(`students/${id}`, 'PUT', student);
            setState(prev => ({ ...prev, students: prev.students.map(s => s.id === id ? updated : s) }));
            showNotification("O'quvchi ma'lumotlari yangilandi", "success");
        } catch (err: any) {
            showNotification("O'quvchini yangilashda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const deleteStudent = async (id: number) => {
        try {
            await apiCall(`students/${id}`, 'DELETE');
            setState(prev => ({ 
                ...prev, 
                students: prev.students.filter(s => s.id !== id),
                groups: prev.groups.map(g => ({
                    ...g,
                    studentIds: (g.studentIds || []).filter(sid => sid !== id)
                }))
            }));
            showNotification("O'quvchi o'chirildi", "success");
        } catch (err: any) {
            showNotification("O'quvchini o'chirishda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const importStudents = async (importedStudents: any[]) => {
        try {
            const res = await apiCall('students/import', 'POST', { students: importedStudents });
            if (res.success) {
                setState(prev => ({ ...prev, students: [...prev.students, ...res.students] }));
                showNotification(`${res.count} ta o'quvchi muvaffaqiyatli import qilindi, ${res.skippedCount} ta o'tkazib yuborildi`, "success");
            } else {
                throw new Error(res.error || "Noma'lum xatolik");
            }
        } catch (err: any) {
            showNotification("O'quvchilarni import qilishda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const addStudentToGroup = async (groupId: number, studentId: number) => {
        try {
            const group = state.groups.find(g => g.id === groupId);
            const student = state.students.find(s => s.id === studentId);
            
            if (!group || !student) return;
            if ((group.studentIds || []).includes(studentId)) {
                showNotification("O'quvchi allaqachon kursda", "info");
                return;
            }

            // Use the atomic connect endpoint — avoids 'set' overwrite risk
            const groupRes = await apiCall(`groups/${groupId}/students`, 'POST', { studentId });

            setState(prev => ({
                ...prev,
                groups: prev.groups.map(g => g.id === groupId ? groupRes : g),
                students: prev.students.map(s => s.id === studentId ? { ...s, groups: [...(s.groups || []), groupId] } : s)
            }));
            
            showNotification("O'quvchi kursga biriktirildi", "success");
        } catch (err: any) {
            showNotification("Xatolik: " + err.message, "error");
        }
    };

    const removeStudentFromGroup = async (groupId: number, studentId: number) => {
        try {
            const groupRes = await apiCall(`groups/${groupId}/students/${studentId}`, 'DELETE');

            setState(prev => ({
                ...prev,
                groups: prev.groups.map(g => g.id === groupId ? groupRes : g),
                students: prev.students.map(s => s.id === studentId
                    ? { ...s, groups: (s.groups || []).filter(gid => gid !== groupId) }
                    : s
                )
            }));

            showNotification("O'quvchi kursdan chiqarildi", "success");
        } catch (err: any) {
            showNotification("Xatolik: " + err.message, "error");
        }
    };

    const addTeacher = async (teacher: Omit<Teacher, 'id' | 'schoolId'>) => {
        const newTeacher = await apiCall('teachers', 'POST', teacher);
        setState(prev => ({ ...prev, teachers: [...prev.teachers, newTeacher] }));
    };

    const updateTeacher = async (id: number, teacher: Partial<Teacher>) => {
        const updated = await apiCall(`teachers/${id}`, 'PUT', teacher);
        setState(prev => ({ ...prev, teachers: prev.teachers.map(t => t.id === id ? updated : t) }));
    };

    const deleteTeacher = async (id: number) => {
        await apiCall(`teachers/${id}`, 'DELETE');
        setState(prev => ({ ...prev, teachers: prev.teachers.filter(t => t.id !== id) }));
    }

    const addGroup = async (group: Omit<Group, 'id' | 'schoolId'>) => {
        try {
            const newGroup = await apiCall('groups', 'POST', group);
            setState(prev => ({ ...prev, groups: [...prev.groups, newGroup] }));
            showNotification("Yangi kurs muvaffaqiyatli ochildi", "success");
        } catch (err: any) {
            showNotification("Kurs ochishda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const updateGroup = async (id: number, group: Partial<Group>) => {
        try {
            const updated = await apiCall(`groups/${id}`, 'PUT', group);
            setState(prev => ({ ...prev, groups: prev.groups.map(g => g.id === id ? updated : g) }));
            showNotification("Kurs ma'lumotlari yangilandi", "success");
        } catch (err: any) {
            showNotification("Kursni yangilashda xatolik: " + err.message, "error");
            throw err;
        }
    }

    const deleteGroup = async (id: number) => {
        await apiCall(`groups/${id}`, 'DELETE');
        setState(prev => ({ 
            ...prev, 
            groups: prev.groups.filter(g => g.id !== id),
            students: prev.students.map(s => ({
                ...s,
                groups: (s.groups || []).filter(gid => gid !== id)
            }))
        }));
    };

    const addLead = async (lead: Omit<Lead, 'id' | 'schoolId'>) => {
        const newLead = await apiCall('leads', 'POST', lead);
        setState(prev => ({ ...prev, leads: [...prev.leads, newLead] }));
    };

    const updateLead = async (id: number, status: Lead['status']) => {
        const updated = await apiCall(`leads/${id}`, 'PUT', { status });
        setState(prev => ({ ...prev, leads: prev.leads.map(l => l.id === id ? updated : l) }));
    };

    const deleteLead = async (id: number) => {
        await apiCall(`leads/${id}`, 'DELETE');
        setState(prev => ({ ...prev, leads: prev.leads.filter(l => l.id !== id) }));
        showNotification("Lid muvaffaqiyatli o'chirildi", "success");
    };

    const addPayment = async (payment: Omit<Payment, 'id' | 'schoolId'>) => {
        const newPayment = await apiCall('payments', 'POST', payment);
        setState(prev => {
            const updatedStudents = prev.students.map(s =>
                s.id === payment.studentId ? { ...s, balance: (s.balance || 0) + payment.amount } : s
            );
            return { ...prev, payments: [...prev.payments, newPayment], students: updatedStudents };
        });
    };

    const updateSettings = async (newSettings: Partial<CRMState['settings']>) => {
        const updated = await apiCall('settings', 'PUT', newSettings);
        setState(prev => ({ ...prev, settings: updated }));
    };

    const addCourse = async (course: Omit<Course, 'id' | 'schoolId'>) => {
        const newCourse = await apiCall('courses', 'POST', course);
        setState(prev => ({ ...prev, courses: [...prev.courses, newCourse] }));
    };

    const deleteCourse = async (id: number) => {
        await apiCall(`courses/${id}`, 'DELETE');
        setState(prev => ({ ...prev, courses: prev.courses.filter(c => c.id !== id) }));
    };

    const addRoom = async (room: Omit<Room, 'id' | 'schoolId'>) => {
        const newRoom = await apiCall('rooms', 'POST', room);
        setState(prev => ({ ...prev, rooms: [...prev.rooms, newRoom] }));
    };

    const deleteRoom = async (id: number) => {
        await apiCall(`rooms/${id}`, 'DELETE');
        setState(prev => ({ ...prev, rooms: prev.rooms.filter(r => r.id !== id) }));
    };

    const addSchool = async (school: Omit<School, 'id'>) => {
        const newSchool = await apiCall('schools', 'POST', school);
        setState(prev => ({ ...prev, schools: [...prev.schools, newSchool] }));
    };

    const deleteSchool = async (id: number) => {
        await apiCall(`schools/${id}`, 'DELETE');
        setState(prev => ({ ...prev, schools: prev.schools.filter(s => s.id !== id) }));
    };

    const addAttendance = async (attendance: Omit<Attendance, 'id' | 'schoolId'>) => {
        // Optimistic update
        const tempId = -Math.floor(Math.random() * 1000000);
        const optimisticAttendance = { ...attendance, id: tempId, schoolId: state.selectedSchoolId || 0 } as Attendance;
        
        setState(prev => {
            const filtered = prev.attendances.filter(a => !(a.studentId === attendance.studentId && a.date === attendance.date && a.groupId === attendance.groupId));
            return { ...prev, attendances: [...filtered, optimisticAttendance] };
        });

        try {
            const newAttendance = await apiCall('attendances', 'POST', attendance);
            setState(prev => {
                const filtered = prev.attendances.filter(a => 
                    a.id !== tempId && 
                    !(a.studentId === newAttendance.studentId && a.date === newAttendance.date && a.groupId === newAttendance.groupId)
                );
                return { ...prev, attendances: [...filtered, newAttendance] };
            });
        } catch (err) {
            // Rollback on error
            setState(prev => ({ ...prev, attendances: prev.attendances.filter(a => a.id !== tempId) }));
            showNotification("Davomatni saqlashda xatolik yuz berdi", "error");
        }
    };

    const addBatchAttendance = async (groupId: number, date: string, records: { studentId: number; status: string }[], topicId?: number) => {
        // Optimistic update
        const tempIds = records.map(() => -Math.floor(Math.random() * 1000000));
        const optimisticRecords = records.map((r, i) => ({ 
            ...r, 
            id: tempIds[i], 
            groupId, 
            date, 
            schoolId: state.selectedSchoolId || 0,
            topicId: topicId || null,
            caughtUp: false
        } as Attendance));

        setState(prev => {
            const studentIds = new Set(records.map(r => r.studentId));
            const filtered = prev.attendances.filter(a => !(a.date === date && a.groupId === groupId && studentIds.has(a.studentId)));
            return { ...prev, attendances: [...filtered, ...optimisticRecords] };
        });

        try {
            const results = await apiCall('attendances/batch', 'POST', { groupId, date, records, topicId });
            setState(prev => {
                const tempIdSet = new Set(tempIds);
                const resultStudentIds = new Set(results.map((r: any) => r.studentId));
                // Remove optimistic ones AND any existing records for these students on this date
                const filtered = prev.attendances.filter(a => 
                    !tempIdSet.has(a.id) && 
                    !(a.date === date && a.groupId === groupId && resultStudentIds.has(a.studentId))
                );
                return { ...prev, attendances: [...filtered, ...results] };
            });
        } catch (err) {
            // Rollback
            setState(prev => {
                const tempIdSet = new Set(tempIds);
                return { ...prev, attendances: prev.attendances.filter(a => !tempIdSet.has(a.id)) };
            });
            showNotification("Kurs davomatini saqlashda xatolik yuz berdi", "error");
        }
    };

    const updateAttendance = async (id: number, updates: Partial<Attendance>) => {
        try {
            const updated = await apiCall(`attendances/${id}`, 'PUT', updates);
            setState(prev => ({
                ...prev,
                attendances: prev.attendances.map(a => a.id === id ? updated : a)
            }));
            showNotification("Davomat muvaffaqiyatli yangilandi", "success");
        } catch (err: any) {
            showNotification("Davomatni yangilashda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const addTopic = async (topic: Omit<Topic, 'id' | 'schoolId'>) => {
        try {
            const newTopic = await apiCall('topics', 'POST', topic);
            setState(prev => ({ ...prev, topics: [...prev.topics, newTopic] }));
            showNotification("Yangi mavzu muvaffaqiyatli qo'shildi", "success");
        } catch (err: any) {
            showNotification("Mavzu qo'shishda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const updateTopic = async (id: number, topic: Partial<Topic>) => {
        try {
            const updated = await apiCall(`topics/${id}`, 'PUT', topic);
            setState(prev => ({ ...prev, topics: prev.topics.map(t => t.id === id ? updated : t) }));
            showNotification("Mavzu muvaffaqiyatli yangilandi", "success");
        } catch (err: any) {
            showNotification("Mavzuni yangilashda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const deleteTopic = async (id: number) => {
        try {
            await apiCall(`topics/${id}`, 'DELETE');
            setState(prev => ({ ...prev, topics: prev.topics.filter(t => t.id !== id) }));
            showNotification("Mavzu muvaffaqiyatli o'chirildi", "success");
        } catch (err: any) {
            showNotification("Mavzuni o'chirishda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const deleteBatchAttendance = async (groupId: number, date: string) => {
        // Optimistic update
        const studentIds = new Set(state.students.filter(s => (s.groups || []).includes(groupId)).map(s => s.id));
        const deletedRecords = state.attendances.filter(a => a.date === date && a.groupId === groupId);

        setState(prev => ({
            ...prev,
            attendances: prev.attendances.filter(a => !(a.date === date && a.groupId === groupId))
        }));

        try {
            await apiCall(`attendances/batch?groupId=${groupId}&date=${date}`, 'DELETE');
            showNotification("Davomat tozalandi", "info");
        } catch (err) {
            // Rollback
            setState(prev => ({ ...prev, attendances: [...prev.attendances, ...deletedRecords] }));
            showNotification("Xatolik: Davomatni tozalab bo'lmadi", "error");
        }
    };

    const addScore = async (score: Omit<Score, 'id' | 'schoolId'>) => {
        const newScore = await apiCall('scores', 'POST', score);
        setState(prev => ({ ...prev, scores: [...prev.scores, newScore] }));
    };

    const addTeacherAttendance = async (attendance: Omit<TeacherAttendance, 'id' | 'schoolId'>) => {
        const result = await apiCall('teacher-attendances', 'POST', attendance);
        setState(prev => {
            const filtered = prev.teacherAttendances.filter(a => a.id !== result.id);
            return { ...prev, teacherAttendances: [...filtered, result] };
        });
    };

    const addExpense = async (expense: Omit<Expense, 'id' | 'schoolId'>) => {
        const result = await apiCall('expenses', 'POST', expense);
        setState(prev => ({ ...prev, expenses: [...prev.expenses, result] }));
        showNotification("Xarajat saqlandi", "success");
    };

    const deleteExpense = async (id: number) => {
        await apiCall(`expenses/${id}`, 'DELETE');
        setState(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
        showNotification("Xarajat o'chirildi", "info");
    };
    
    const addTransport = async (transport: Omit<Transport, 'id' | 'schoolId'>) => {
        const trans = await apiCall('transports', 'POST', transport);
        setState(prev => ({ ...prev, transports: [...prev.transports, trans] }));
        showNotification("Transport qo'shildi", "success");
    };

    const updateTransport = async (id: number, transport: Partial<Transport>) => {
        const updated = await apiCall(`transports/${id}`, 'PUT', transport);
        setState(prev => ({ ...prev, transports: prev.transports.map(t => t.id === id ? updated : t) }));
        showNotification("Transport yangilandi", "success");
    };

    const deleteTransport = async (id: number) => {
        await apiCall(`transports/${id}`, 'DELETE');
        setState(prev => ({ ...prev, transports: prev.transports.filter(t => t.id !== id) }));
        showNotification("Transport o'chirildi", "info");
    };

    const addDeliveryLog = async (log: Omit<DeliveryLog, 'id' | 'schoolId'>) => {
        const result = await apiCall('delivery-logs', 'POST', log);
        setState(prev => {
            const filtered = prev.deliveryLogs.filter(l => !(l.studentId === result.studentId && l.date === result.date));
            return { ...prev, deliveryLogs: [...filtered, result] };
        });
    };

    const fetchDeliveryLogs = async (date: string) => {
        if (!token || !state.selectedSchoolId) return [];
        const logs = await fetch(`${API_BASE}/delivery-logs?schoolId=${state.selectedSchoolId}&date=${date}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json());
        setState(prev => ({ ...prev, deliveryLogs: logs }));
        return logs;
    };

    const addRoute = async (route: Omit<Route, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>) => {
        const newRoute = await apiCall('routes', 'POST', route);
        setState(prev => ({ ...prev, routes: [...prev.routes, newRoute] }));
        showNotification("Yangi marshrut qo'shildi", "success");
    };

    const updateRoute = async (id: number, route: Partial<Route>) => {
        const updated = await apiCall(`routes/${id}`, 'PUT', route);
        setState(prev => ({ ...prev, routes: prev.routes.map(r => r.id === id ? updated : r) }));
        showNotification("Marshrut yangilandi", "success");
    };

    const deleteRoute = async (id: number) => {
        await apiCall(`routes/${id}`, 'DELETE');
        setState(prev => ({ ...prev, routes: prev.routes.filter(r => r.id !== id) }));
        showNotification("Marshrut o'chirildi", "info");
    };

    const addExam = async (exam: Omit<Exam, 'id' | 'schoolId'>) => {
        try {
            const newExam = await apiCall('exams', 'POST', exam);
            setState(prev => ({ ...prev, exams: [...prev.exams, newExam] }));
            showNotification("Yangi imtihon qo'shildi", "success");
        } catch (err: any) {
            showNotification("Imtihon qo'shishda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const updateExam = async (id: number, exam: Partial<Exam>) => {
        try {
            const updated = await apiCall(`exams/${id}`, 'PUT', exam);
            setState(prev => ({ ...prev, exams: prev.exams.map(e => e.id === id ? updated : e) }));
            showNotification("Imtihon yangilandi", "success");
        } catch (err: any) {
            showNotification("Imtihon yangilashda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const deleteExam = async (id: number) => {
        try {
            await apiCall(`exams/${id}`, 'DELETE');
            setState(prev => ({ ...prev, exams: prev.exams.filter(e => e.id !== id) }));
            showNotification("Imtihon o'chirildi", "info");
        } catch (err: any) {
            showNotification("Imtihon o'chirishda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const generateExamVariants = async (examId: number, count: number) => {
        const exam = state.exams.find(e => e.id === examId);
        if (!exam) return;

        try {
            const variants = generateVariants(exam, state.questions, count);
            // Save variants to backend so they persist
            const updated = await apiCall(`exams/${examId}`, 'PUT', { variants });
            setState(prev => ({
                ...prev,
                exams: prev.exams.map(e => e.id === examId ? updated : e)
            }));
            showNotification(`${count} ta variant muvaffaqiyatli yaratildi`, "success");
        } catch (err) {
            console.error("Variant generation failed", err);
            showNotification("Variantlar yaratishda xatolik", "error");
        }
    };

    const addQuestion = async (question: Omit<Question, 'id' | 'schoolId'>) => {
        try {
            const newQuestion = await apiCall('questions', 'POST', question);
            setState(prev => ({ ...prev, questions: [...prev.questions, newQuestion] }));
            showNotification("Yangi savol qo'shildi", "success");
        } catch (err: any) {
            showNotification("Savol qo'shishda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const updateQuestion = async (id: number, question: Partial<Question>) => {
        try {
            const updated = await apiCall(`questions/${id}`, 'PUT', question);
            setState(prev => ({ ...prev, questions: prev.questions.map(q => q.id === id ? updated : q) }));
            showNotification("Savol yangilandi", "success");
        } catch (err: any) {
            showNotification("Savol yangilashda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const deleteQuestion = async (id: number) => {
        try {
            await apiCall(`questions/${id}`, 'DELETE');
            setState(prev => ({ ...prev, questions: prev.questions.filter(q => q.id !== id) }));
            showNotification("Savol o'chirildi", "info");
        } catch (err: any) {
            showNotification("Savol o'chirishda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const addExamResult = async (result: Omit<ExamResult, 'id' | 'schoolId'>) => {
        try {
            const saved = await apiCall('exam-results', 'POST', result);
            setState(prev => ({
                ...prev,
                examResults: prev.examResults.some(r => r.studentId === saved.studentId && r.examId === saved.examId)
                    ? prev.examResults.map(r => r.studentId === saved.studentId && r.examId === saved.examId ? saved : r)
                    : [...prev.examResults, saved]
            }));
            showNotification("Natija saqlandi", "success");
            return saved;
        } catch (err: any) {
            showNotification("Natija saqlashda xatolik: " + err.message, "error");
            throw err;
        }
    };

    return (
        <CRMContext.Provider value={{
            ...state,
            loading, error, user, token,
            login, logout, checkAuth, setSelectedSchoolId,
            addStudent, updateStudent, deleteStudent, importStudents, addStudentToGroup, removeStudentFromGroup,
            addTeacher, updateTeacher, deleteTeacher,
            addGroup, updateGroup, deleteGroup,
            updateLead, addLead, deleteLead,
            addPayment,
            updateSettings,
            addCourse, deleteCourse,
            addRoom, deleteRoom,
            addSchool, deleteSchool,
            addAttendance, updateAttendance, addBatchAttendance, deleteBatchAttendance, addScore,
            addTopic, updateTopic, deleteTopic,
            addTeacherAttendance,
            addExpense, deleteExpense,
            addTransport, updateTransport, deleteTransport,
            addRoute, updateRoute, deleteRoute,
            addExam, updateExam, deleteExam, generateExamVariants,
            addQuestion, updateQuestion, deleteQuestion,
            addExamResult,
            addDeliveryLog, fetchDeliveryLogs,
            darkMode, toggleDarkMode,
            notification, showNotification,
            themeColor, setThemeColor
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
