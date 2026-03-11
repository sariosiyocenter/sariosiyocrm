import React, { createContext, useContext, useState, useEffect } from 'react';
import { Student, Teacher, Group, Lead, Payment, CRMState, Course, Room, School, UserRole } from '../types';

interface AuthenticatedUser {
    id: number;
    email: string;
    name: string;
    role: UserRole;
}

interface CRMContextType extends CRMState {
    loading: boolean;
    error: string | null;
    user: AuthenticatedUser | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
    addStudent: (student: Omit<Student, 'id'>) => Promise<void>;
    updateStudent: (id: number, student: Partial<Student>) => Promise<void>;
    deleteStudent: (id: number) => Promise<void>;
    addTeacher: (teacher: Omit<Teacher, 'id'>) => Promise<void>;
    updateTeacher: (id: number, teacher: Partial<Teacher>) => Promise<void>;
    deleteTeacher: (id: number) => Promise<void>;
    addGroup: (group: Omit<Group, 'id'>) => Promise<void>;
    updateGroup: (id: number, group: Partial<Group>) => Promise<void>;
    addLead: (lead: Omit<Lead, 'id'>) => Promise<void>;
    updateLead: (id: number, status: Lead['status']) => Promise<void>;
    addPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
    updateSettings: (settings: Partial<CRMState['settings']>) => Promise<void>;
    addCourse: (course: Course) => Promise<void>;
    deleteCourse: (id: string) => Promise<void>;
    addRoom: (room: Room) => Promise<void>;
    deleteRoom: (id: string) => Promise<void>;
    addSchool: (school: School) => Promise<void>;
    deleteSchool: (id: string) => Promise<void>;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

const API_BASE = '/api';

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<CRMState>({
        students: [], teachers: [], groups: [], leads: [], payments: [], courses: [], rooms: [], schools: [],
        settings: {
            orgName: "SARIOSIYO", paymentMethods: ["Naqd", "Karta"], isCheckEnabled: true,
            isCommentRequired: false, isTeacherSalaryHidden: false, isSplitPaymentDisabled: false,
            isTeacherAttendanceSalaryEnabled: true, isTeacherAddingStudentsDisabled: false, calendarInterval: 30
        }
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<AuthenticatedUser | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

    const fetchData = async (authToken?: string) => {
        const currentToken = authToken || token;
        if (!currentToken) return;

        try {
            setLoading(true);
            const endpoints = ['students', 'teachers', 'groups', 'leads', 'payments', 'courses', 'rooms', 'schools', 'settings'];
            const responses = await Promise.all(endpoints.map(ep =>
                fetch(`${API_BASE}/${ep}`, {
                    headers: { 'Authorization': `Bearer ${currentToken}` }
                }).then(res => {
                    if (res.status === 401 || res.status === 403) {
                        logout();
                        throw new Error("Sessiya muddati tugadi");
                    }
                    return res.json();
                })
            ));

            setState({
                students: responses[0],
                teachers: responses[1],
                groups: responses[2],
                leads: responses[3],
                payments: responses[4],
                courses: responses[5],
                rooms: responses[6],
                schools: responses[7],
                settings: responses[8]
            });
            setError(null);
        } catch (err: any) {
            console.error("Failed to load CRM data", err);
            setError(err.message || "Xatolik yuz berdi");
        } finally {
            setLoading(false);
        }
    };

    const checkAuth = async () => {
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
                await fetchData(token);
            } else {
                logout();
            }
        } catch (err) {
            console.error("Auth check failed", err);
            logout();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

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
            await fetchData(data.token);
        } catch (err: any) {
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
            settings: {
                orgName: "SARIOSIYO", paymentMethods: ["Naqd", "Karta"], isCheckEnabled: true,
                isCommentRequired: false, isTeacherSalaryHidden: false, isSplitPaymentDisabled: false,
                isTeacherAttendanceSalaryEnabled: true, isTeacherAddingStudentsDisabled: false, calendarInterval: 30
            }
        });
    };

    // Helper for POST/PUT requests
    const apiCall = async (endpoint: string, method: string, data?: any) => {
        if (!token) throw new Error("Avtorizatsiya kerak");
        const res = await fetch(`${API_BASE}/${endpoint}`, {
            method,
            headers: {
                ...(data ? { 'Content-Type': 'application/json' } : {}),
                'Authorization': `Bearer ${token}`
            },
            body: data ? JSON.stringify(data) : undefined,
        });
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        return method !== 'DELETE' ? await res.json() : null;
    };

    const addStudent = async (student: Omit<Student, 'id'>) => {
        const newStudent = await apiCall('students', 'POST', student);
        setState(prev => ({ ...prev, students: [...prev.students, newStudent] }));
    };

    const updateStudent = async (id: number, student: Partial<Student>) => {
        const updated = await apiCall(`students/${id}`, 'PUT', student);
        setState(prev => ({ ...prev, students: prev.students.map(s => s.id === id ? updated : s) }));
    };

    const deleteStudent = async (id: number) => {
        await apiCall(`students/${id}`, 'DELETE');
        setState(prev => ({ ...prev, students: prev.students.filter(s => s.id !== id) }));
    };

    const addTeacher = async (teacher: Omit<Teacher, 'id'>) => {
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

    const addGroup = async (group: Omit<Group, 'id'>) => {
        const newGroup = await apiCall('groups', 'POST', group);
        setState(prev => ({ ...prev, groups: [...prev.groups, newGroup] }));
    };

    const updateGroup = async (id: number, group: Partial<Group>) => {
        const updated = await apiCall(`groups/${id}`, 'PUT', group);
        setState(prev => ({ ...prev, groups: prev.groups.map(g => g.id === id ? updated : g) }));
    }

    const addLead = async (lead: Omit<Lead, 'id'>) => {
        const newLead = await apiCall('leads', 'POST', lead);
        setState(prev => ({ ...prev, leads: [...prev.leads, newLead] }));
    };

    const updateLead = async (id: number, status: Lead['status']) => {
        // Only update status
        const updated = await apiCall(`leads/${id}`, 'PUT', { status });
        setState(prev => ({ ...prev, leads: prev.leads.map(l => l.id === id ? updated : l) }));
    };

    const addPayment = async (payment: Omit<Payment, 'id'>) => {
        const newPayment = await apiCall('payments', 'POST', payment);
        // Payment endpoint also updates student balance, let's refresh students or just update locally
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

    const addCourse = async (course: Course) => {
        const newCourse = await apiCall('courses', 'POST', course);
        setState(prev => ({ ...prev, courses: [...prev.courses, newCourse] }));
    };

    const deleteCourse = async (id: string) => {
        await apiCall(`courses/${id}`, 'DELETE');
        setState(prev => ({ ...prev, courses: prev.courses.filter(c => c.id !== id) }));
    };

    const addRoom = async (room: Room) => {
        const newRoom = await apiCall('rooms', 'POST', room);
        setState(prev => ({ ...prev, rooms: [...prev.rooms, newRoom] }));
    };

    const deleteRoom = async (id: string) => {
        await apiCall(`rooms/${id}`, 'DELETE');
        setState(prev => ({ ...prev, rooms: prev.rooms.filter(r => r.id !== id) }));
    };

    const addSchool = async (school: School) => {
        const newSchool = await apiCall('schools', 'POST', school);
        setState(prev => ({ ...prev, schools: [...prev.schools, newSchool] }));
    };

    const deleteSchool = async (id: string) => {
        await apiCall(`schools/${id}`, 'DELETE');
        setState(prev => ({ ...prev, schools: prev.schools.filter(s => s.id !== id) }));
    };

    return (
        <CRMContext.Provider value={{
            ...state,
            loading, error, user, token,
            login, logout, checkAuth,
            addStudent, updateStudent, deleteStudent,
            addTeacher, updateTeacher, deleteTeacher,
            addGroup, updateGroup,
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
