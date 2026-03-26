import React, { createContext, useContext, useState, useEffect } from 'react';
import { Student, Teacher, Group, Lead, Payment, CRMState, Course, Room, School, UserRole, Attendance, Score, TeacherAttendance, Expense, Transport, DeliveryLog, Route } from '../types';

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
    addStudentToGroup: (groupId: number, studentId: number) => Promise<void>;
    addTeacher: (teacher: Omit<Teacher, 'id' | 'schoolId'>) => Promise<void>;
    updateTeacher: (id: number, teacher: Partial<Teacher>) => Promise<void>;
    deleteTeacher: (id: number) => Promise<void>;
    addGroup: (group: Omit<Group, 'id' | 'schoolId'>) => Promise<void>;
    updateGroup: (id: number, group: Partial<Group>) => Promise<void>;
    deleteGroup: (id: number) => Promise<void>;
    addLead: (lead: Omit<Lead, 'id' | 'schoolId'>) => Promise<void>;
    updateLead: (id: number, status: Lead['status']) => Promise<void>;
    addPayment: (payment: Omit<Payment, 'id' | 'schoolId'>) => Promise<void>;
    updateSettings: (settings: Partial<CRMState['settings']>) => Promise<void>;
    addCourse: (course: Omit<Course, 'id' | 'schoolId'>) => Promise<void>;
    deleteCourse: (id: number) => Promise<void>;
    addRoom: (room: Omit<Room, 'id' | 'schoolId'>) => Promise<void>;
    deleteRoom: (id: number) => Promise<void>;
    addSchool: (school: Omit<School, 'id'>) => Promise<void>;
    deleteSchool: (id: number) => Promise<void>;
    addAttendance: (attendance: Omit<Attendance, 'id' | 'schoolId'>) => Promise<void>;
    addBatchAttendance: (groupId: number, date: string, records: { studentId: number; status: string }[]) => Promise<void>;
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
    notification: { message: string, type: 'success' | 'error' | 'info' } | null;
    showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

const API_BASE = '/api';

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<CRMState>({
        students: [], teachers: [], groups: [], leads: [], payments: [], courses: [], rooms: [], schools: [],
        attendances: [], scores: [], teacherAttendances: [], expenses: [],
        transports: [], deliveryLogs: [], routes: [], users: [],
        selectedSchoolId: null,
        settings: {
            id: 0,
            schoolId: 0,
            orgName: "SARIOSIYO",
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

    const fetchData = async (overrideToken?: string, overrideSchoolId?: number) => {
        const currentToken = overrideToken || token;
        const currentSchoolId = overrideSchoolId !== undefined ? overrideSchoolId : state.selectedSchoolId;

        if (!currentToken) return;

        try {
            setLoading(true);

            const schoolsRes = await fetch(`${API_BASE}/schools`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            let schools = await schoolsRes.json();

            if (user?.role === 'MANAGER' && user.schoolId) {
                schools = schools.filter((s: School) => s.id === user.schoolId);
            }

            let schoolIdToUse = currentSchoolId;
            if (schoolIdToUse === null && schools.length > 0) {
                schoolIdToUse = user?.role === 'MANAGER' ? user.schoolId : (user?.schoolId || schools[0].id);
                setSelectedSchoolId(schoolIdToUse as number);
            }

            if (schoolIdToUse !== null) {
                const endpoints = ['students', 'teachers', 'groups', 'leads', 'payments', 'courses', 'rooms', 'settings', 'attendances', 'scores', 'teacher-attendances', 'expenses', 'transports', 'routes', 'users'];
                const responses = await Promise.all(endpoints.map(ep =>
                    fetch(`${API_BASE}/${ep}?schoolId=${schoolIdToUse}`, {
                        headers: { 'Authorization': `Bearer ${currentToken}` }
                    }).then(res => {
                        if (res.status === 401 || res.status === 403) {
                            logout();
                            throw new Error("Sessiya muddati tugadi");
                        }
                        if (!res.ok) throw new Error(`Fetch error: ${res.statusText}`);
                        return res.json();
                    })
                ));

                setState(prev => ({
                    ...prev,
                    schools,
                    students: responses[0],
                    teachers: responses[1],
                    groups: responses[2],
                    leads: responses[3],
                    payments: responses[4],
                    courses: responses[5],
                    rooms: responses[6],
                    settings: responses[7],
                    attendances: responses[8],
                    scores: responses[9],
                    teacherAttendances: responses[10],
                    expenses: responses[11],
                    transports: responses[12],
                    routes: responses[13],
                    users: responses[14],
                    deliveryLogs: [], // Fetched per date in Delivery view
                    selectedSchoolId: schoolIdToUse
                }));
            } else {
                setState(prev => ({ ...prev, schools }));
            }

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
                await fetchData(token, userData.schoolId || undefined);
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

    useEffect(() => {
        if (state.selectedSchoolId !== null && user) {
            fetchData();
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
            await fetchData(data.token, data.user.schoolId || undefined);
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
            attendances: [], scores: [], teacherAttendances: [], expenses: [],
            transports: [], deliveryLogs: [], routes: [], users: [],
            selectedSchoolId: null,
            settings: {
                id: 0,
                schoolId: 0,
                orgName: "SARIOSIYO",
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
            schoolId: state.selectedSchoolId,
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
            setState(prev => ({ ...prev, students: prev.students.filter(s => s.id !== id) }));
            showNotification("O'quvchi o'chirildi", "success");
        } catch (err: any) {
            showNotification("O'quvchini o'chirishda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const addStudentToGroup = async (groupId: number, studentId: number) => {
        try {
            const group = state.groups.find(g => g.id === groupId);
            const student = state.students.find(s => s.id === studentId);
            
            if (!group || !student) return;
            if (group.studentIds.includes(studentId)) {
                showNotification("O'quvchi allaqachon guruhda", "info");
                return;
            }

            // Only send the necessary fields to update the many-to-many relationship
            // Sending the whole object might fail if it contains relational fields (like 'students' or 'groups')
            const [groupRes, studentRes] = await Promise.all([
                apiCall(`groups/${groupId}`, 'PUT', { studentIds: [...group.studentIds, studentId] }),
                apiCall(`students/${studentId}`, 'PUT', { groups: [...(student.groups || []), groupId] })
            ]);

            setState(prev => ({
                ...prev,
                groups: prev.groups.map(g => g.id === groupId ? groupRes : g),
                students: prev.students.map(s => s.id === studentId ? studentRes : s)
            }));
            
            showNotification("O'quvchi guruhga biriktirildi", "success");
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
            showNotification("Yangi guruh muvaffaqiyatli ochildi", "success");
        } catch (err: any) {
            showNotification("Guruh ochishda xatolik: " + err.message, "error");
            throw err;
        }
    };

    const updateGroup = async (id: number, group: Partial<Group>) => {
        try {
            const updated = await apiCall(`groups/${id}`, 'PUT', group);
            setState(prev => ({ ...prev, groups: prev.groups.map(g => g.id === id ? updated : g) }));
            showNotification("Guruh ma'lumotlari yangilandi", "success");
        } catch (err: any) {
            showNotification("Guruhni yangilashda xatolik: " + err.message, "error");
            throw err;
        }
    }

    const deleteGroup = async (id: number) => {
        await apiCall(`groups/${id}`, 'DELETE');
        setState(prev => ({ ...prev, groups: prev.groups.filter(g => g.id !== id) }));
    };

    const addLead = async (lead: Omit<Lead, 'id' | 'schoolId'>) => {
        const newLead = await apiCall('leads', 'POST', lead);
        setState(prev => ({ ...prev, leads: [...prev.leads, newLead] }));
    };

    const updateLead = async (id: number, status: Lead['status']) => {
        const updated = await apiCall(`leads/${id}`, 'PUT', { status });
        setState(prev => ({ ...prev, leads: prev.leads.map(l => l.id === id ? updated : l) }));
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
        const optimisticAttendance = { ...attendance, id: tempId, schoolId: state.schoolId || 0 } as Attendance;
        
        setState(prev => {
            const filtered = prev.attendances.filter(a => !(a.studentId === attendance.studentId && a.date === attendance.date && a.groupId === attendance.groupId));
            return { ...prev, attendances: [...filtered, optimisticAttendance] };
        });

        try {
            const newAttendance = await apiCall('attendances', 'POST', attendance);
            setState(prev => {
                const filtered = prev.attendances.filter(a => a.id !== tempId);
                return { ...prev, attendances: [...filtered, newAttendance] };
            });
        } catch (err) {
            // Rollback on error
            setState(prev => ({ ...prev, attendances: prev.attendances.filter(a => a.id !== tempId) }));
            showNotification("Davomatni saqlashda xatolik yuz berdi", "error");
        }
    };

    const addBatchAttendance = async (groupId: number, date: string, records: { studentId: number; status: string }[]) => {
        // Optimistic update
        const tempIds = records.map(() => -Math.floor(Math.random() * 1000000));
        const optimisticRecords = records.map((r, i) => ({ ...r, id: tempIds[i], groupId, date, schoolId: state.schoolId || 0 } as Attendance));

        setState(prev => {
            const studentIds = new Set(records.map(r => r.studentId));
            const filtered = prev.attendances.filter(a => !(a.date === date && a.groupId === groupId && studentIds.has(a.studentId)));
            return { ...prev, attendances: [...filtered, ...optimisticRecords] };
        });

        try {
            const results = await apiCall('attendances/batch', 'POST', { groupId, date, records });
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
            showNotification("Guruh davomatini saqlashda xatolik yuz berdi", "error");
        }
    };

    const deleteBatchAttendance = async (groupId: number, date: string) => {
        // Optimistic update
        const studentIds = new Set(state.students.filter(s => s.groupId === groupId).map(s => s.id));
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

    return (
        <CRMContext.Provider value={{
            ...state,
            loading, error, user, token,
            login, logout, checkAuth, setSelectedSchoolId,
            addStudent, updateStudent, deleteStudent, addStudentToGroup,
            addTeacher, updateTeacher, deleteTeacher,
            addGroup, updateGroup, deleteGroup,
            updateLead, addLead,
            addPayment,
            updateSettings,
            addCourse, deleteCourse,
            addRoom, deleteRoom,
            addSchool, deleteSchool,
            addAttendance, addBatchAttendance, deleteBatchAttendance, addScore,
            addTeacherAttendance,
            addExpense, deleteExpense,
            addTransport, updateTransport, deleteTransport,
            addRoute, updateRoute, deleteRoute,
            addDeliveryLog, fetchDeliveryLogs,
            darkMode, toggleDarkMode,
            notification, showNotification
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
