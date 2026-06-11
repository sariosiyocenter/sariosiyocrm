import React, { useState, useEffect, useRef } from 'react';
import {
    Users2, Plus, X, Trash2, Pencil,
    Phone, Mail, DollarSign,
    GraduationCap, ExternalLink, Camera, Wrench, Eye, Sparkles
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';
import { compressImage } from '../lib/image';
import PhotoCapture from './PhotoCapture';


const ROLE_LABELS: Record<string, string> = {
    ADMIN:           'Admin',
    MANAGER:         'Menejer',
    TEACHER:         "O'qituvchi",
    SUPPORT_TEACHER: 'Yord. O\'qituvchi',
    RECEPTIONIST:    'Receptionist',
    DRIVER:          'Haydovchi',
    TECH_STAFF:      'Tex. Xodim',
};

const ROLE_COLORS: Record<string, string> = {
    ADMIN:           'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/40',
    MANAGER:         'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/40',
    TEACHER:         'bg-teal-50 text-[#1b6b6b] border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40',
    SUPPORT_TEACHER: 'bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/40',
    RECEPTIONIST:    'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-900/50 dark:text-gray-400 dark:border-gray-700/40',
    DRIVER:          'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40',
    TECH_STAFF:      'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/40',
};

const ROLE_AVATAR_COLORS: Record<string, string> = {
    ADMIN:           'from-purple-500 to-purple-700',
    MANAGER:         'from-sky-500 to-sky-700',
    TEACHER:         'from-teal-500 to-teal-700',
    SUPPORT_TEACHER: 'from-cyan-500 to-cyan-700',
    RECEPTIONIST:    'from-gray-400 to-gray-600',
    DRIVER:          'from-amber-500 to-amber-700',
    TECH_STAFF:      'from-orange-500 to-orange-700',
};


const inp = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

export default function HRManagement() {
    const { teachers, selectedSchoolId, user: currentUser, token } = useCRM();
    const navigate = useNavigate();

    const [users, setUsers]               = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);

    const [isAddOpen, setIsAddOpen]       = useState(false);
    const [isEditOpen, setIsEditOpen]     = useState(false);
    const [newUser, setNewUser]           = useState<any>({ role: 'RECEPTIONIST' });
    const [editingUser, setEditingUser]   = useState<any>(null);

    const isAdmin           = currentUser?.role === 'ADMIN';
    const isAdminOrManager  = isAdmin || currentUser?.role === 'MANAGER';

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setUsers(await res.json());
        } catch (err) { console.error('Failed to fetch users', err); }
        finally { setLoadingUsers(false); }
    };

    useEffect(() => { fetchUsers(); }, [token]);


    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    ...newUser,
                    role:     newUser.role || 'RECEPTIONIST',
                    password: newUser.password || (newUser.role === 'TECH_STAFF' ? undefined : 'admin123'),
                    schoolId: currentUser?.role === 'MANAGER' ? currentUser.schoolId : selectedSchoolId
                })
            });
            if (res.ok) { setIsAddOpen(false); setNewUser({ role: 'RECEPTIONIST' }); fetchUsers(); }
            else { const d = await res.json(); alert(d.error || "Xatolik yuz berdi"); }
        } catch (err) { console.error('Add user failed', err); }
    };

    const handleEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUser._source === 'teacher') {
                // Legacy Teacher model
                const res = await fetch(`/api/teachers/${editingUser._tid}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        name:   editingUser.name,
                        phone:  editingUser.phone,
                        photo:  editingUser.photo,
                        salary: editingUser.salary,
                    }),
                });
                if (res.ok) { setIsEditOpen(false); setEditingUser(null); window.location.reload(); }
                else { const d = await res.json(); alert(d.error || "Xatolik yuz berdi"); }
            } else {
                const body: any = {
                    name:       editingUser.name,
                    role:       editingUser.role,
                    phone:      editingUser.phone,
                    email:      editingUser.email,
                    photo:      editingUser.photo,
                    position:   editingUser.position,
                    salary:     editingUser.salary,
                    kpiPercent: editingUser.kpiPercent ?? 0,
                };
                if (editingUser.password) body.password = editingUser.password;
                const res = await fetch(`/api/users/${editingUser.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(body)
                });
                if (res.ok) { setIsEditOpen(false); setEditingUser(null); fetchUsers(); }
                else { const d = await res.json(); alert(d.error || "Xatolik yuz berdi"); }
            }
        } catch (err) { console.error('Edit user failed', err); }
    };

    const handleDeleteUser = async (id: number) => {
        if (!window.confirm("Xodimni o'chirmoqchimisiz?")) return;
        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) fetchUsers();
        } catch (err) { console.error('Delete user failed', err); }
    };

    const handleDeleteTeacher = async (tid: number) => {
        if (!window.confirm("O'qituvchini o'chirmoqchimisiz?")) return;
        try {
            await fetch(`/api/teachers/${tid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            // CRMContext teachers refresh is not available here, so force page reload
            window.location.reload();
        } catch (err) { console.error('Delete teacher failed', err); }
    };

    // Merge User records + Teacher model records from context
    // Exclude teachers whose name already matches a User record (no duplicates)
    const userNames = new Set(users.map(u => u.name.toLowerCase().trim()));
    const uniqueTeacherRows = (teachers || [])
        .filter(t => t.status !== 'Arxiv' && !userNames.has(t.name.toLowerCase().trim()))
        .map(t => ({
            _source:  'teacher',
            _tid:     t.id,
            id:       `t_${t.id}`,
            name:     t.name,
            phone:    t.phone,
            photo:    t.photo || null,
            salary:   t.salary || 0,
            role:     'TEACHER',
            email:    null,
            position: null,
        }));
    const allStaff = [...users, ...uniqueTeacherRows];

    // Filtered by selected role
    const filteredUsers = selectedRole ? allStaff.filter(u => u.role === selectedRole) : allStaff;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-lg shadow-[#1b6b6b]/20">
                            <Users2 size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">HR Menejment</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                Xodimlar hisobi va boshqaruvi
                            </p>
                        </div>
                    </div>
                    {isAdminOrManager && (
                        <button onClick={() => { setNewUser({ role: 'RECEPTIONIST' }); setIsAddOpen(true); }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                            <Plus size={14} /> Yangi Xodim
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                    {/* Clickable role counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        {Object.entries(ROLE_LABELS).map(([role, label]) => {
                            const count    = allStaff.filter(u => u.role === role).length;
                            const isActive = selectedRole === role;
                            return (
                                <button
                                    key={role}
                                    onClick={() => setSelectedRole(prev => prev === role ? null : role)}
                                    className={`bg-white dark:bg-gray-800 border rounded-2xl p-4 flex items-center justify-between transition-all cursor-pointer hover:shadow-md text-left w-full ${
                                        isActive
                                            ? 'border-[#1b6b6b] ring-2 ring-[#1b6b6b]/20 shadow-md'
                                            : 'border-gray-100 dark:border-gray-700/50 hover:border-[#1b6b6b]/30'
                                    }`}
                                >
                                    <div>
                                        <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1 leading-tight">{label}</span>
                                        <h4 className="text-lg font-black text-gray-900 dark:text-white tabular-nums">{count}</h4>
                                    </div>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border text-xs font-extrabold transition-all ${
                                        isActive ? 'bg-[#1b6b6b] text-white border-[#1b6b6b]' : (ROLE_COLORS[role] || '')
                                    }`}>
                                        {label.charAt(0)}
                                    </div>
                                </button>
                            );
                        })}
                        {selectedRole && (
                            <button
                                onClick={() => setSelectedRole(null)}
                                className="bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex items-center justify-center transition-all cursor-pointer hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/10 text-gray-400 hover:text-rose-500 gap-1"
                            >
                                <X size={12} />
                                <span className="text-[9px] font-extrabold uppercase tracking-widest">Filtr</span>
                            </button>
                        )}
                    </div>

                    {/* Role filter indicator */}
                    {selectedRole && (
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-extrabold border uppercase tracking-widest ${ROLE_COLORS[selectedRole] || ''}`}>
                                {ROLE_LABELS[selectedRole]} — {filteredUsers.length} ta
                            </span>
                        </div>
                    )}

                    {loadingUsers ? (
                        <div className="py-20 text-center text-[#1b6b6b] text-xs font-bold uppercase tracking-widest">Xodimlar yuklanmoqda...</div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="py-20 text-center bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hech qanday xodim topilmadi</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredUsers.map((u) => {
                                const isLegacy = u._source === 'teacher';
                                const profilePath = isLegacy ? `/teachers/${u._tid}` : `/hr/${u.id}`;
                                return (
                                    <div key={u.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 hover:shadow-md transition-all group relative flex flex-col justify-between min-h-[180px]">
                                        <div>
                                            <div className="flex items-start justify-between mb-4">
                                                {/* Avatar / Photo */}
                                                <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0">
                                                    {u.photo ? (
                                                        <img src={u.photo} alt={u.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className={`w-full h-full bg-gradient-to-br ${ROLE_AVATAR_COLORS[u.role] || 'from-gray-400 to-gray-600'} flex items-center justify-center text-white font-black text-sm`}>
                                                            {u.name?.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                {isAdminOrManager && (
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => { setEditingUser({ ...u, password: '' }); setIsEditOpen(true); }}
                                                            className="w-7 h-7 rounded-lg text-gray-400 hover:text-[#1b6b6b] hover:bg-gray-50 dark:hover:bg-gray-900 flex items-center justify-center transition-colors cursor-pointer">
                                                            <Pencil size={13} />
                                                        </button>
                                                        {isAdmin && (
                                                            <button
                                                                onClick={() => isLegacy ? handleDeleteTeacher(u._tid) : handleDeleteUser(u.id)}
                                                                className="w-7 h-7 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center justify-center transition-colors cursor-pointer">
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">{u.name}</h4>
                                                {u.position && (
                                                    <p className="text-[9px] font-bold text-gray-400 mt-0.5">{u.position}</p>
                                                )}
                                                <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wider ${ROLE_COLORS[u.role] || 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                                    {ROLE_LABELS[u.role] || u.role}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-dashed border-gray-100 dark:border-gray-700/50 space-y-1">
                                            {u.phone && (
                                                <div className="flex items-center gap-2 text-gray-400">
                                                    <Phone size={11} />
                                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{u.phone}</span>
                                                </div>
                                            )}
                                            {!isLegacy && u.role !== 'TECH_STAFF' && u.email && (
                                                <div className="flex items-center gap-2 text-gray-400">
                                                    <Mail size={11} />
                                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 truncate max-w-[160px]">{u.email}</span>
                                                </div>
                                            )}
                                            {u.salary > 0 && (
                                                <div className="flex items-center gap-2 text-gray-400">
                                                    <DollarSign size={11} />
                                                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{u.salary.toLocaleString()} UZS</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Profile link */}
                                        <button
                                            onClick={() => navigate(profilePath)}
                                            className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-[#1b6b6b]/5 border border-[#1b6b6b]/15 text-[#1b6b6b] dark:text-teal-400 rounded-xl text-[9px] font-extrabold uppercase tracking-widest hover:bg-[#1b6b6b] hover:text-white hover:border-[#1b6b6b] transition-all cursor-pointer">
                                            <Eye size={11} />
                                            Profilni Ko'rish
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            {/* Add Modal */}
            {isAddOpen && (
                <UserModal
                    title="Yangi Xodim" subtitle="Tizimga yangi xodim qo'shish"
                    user={newUser} onChange={setNewUser}
                    onClose={() => setIsAddOpen(false)}
                    onSubmit={handleAddUser}
                    currentUserRole={currentUser?.role}
                    showPassword
                />
            )}

            {/* Edit Modal */}
            {isEditOpen && editingUser && (
                <UserModal
                    title="Xodimni Tahrirlash" subtitle="Ma'lumotlarni yangilash"
                    user={editingUser} onChange={setEditingUser}
                    onClose={() => { setIsEditOpen(false); setEditingUser(null); }}
                    onSubmit={handleEditUser}
                    currentUserRole={currentUser?.role}
                    showPassword={false}
                />
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center py-2.5 border-b border-gray-50 dark:border-gray-700/50">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
            <span className="text-xs font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">{value}</span>
        </div>
    );
}

function UserModal({
    title, subtitle, user, onChange, onClose, onSubmit, currentUserRole, showPassword
}: {
    title: string; subtitle: string; user: any; onChange: (v: any) => void;
    onClose: () => void; onSubmit: (e: React.FormEvent) => void;
    currentUserRole?: string; showPassword: boolean;
}) {
    const fileRef     = useRef<HTMLInputElement>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isRemovingBg, setIsRemovingBg] = useState(false);
    const isTechStaff = user.role === 'TECH_STAFF';

    const handleRemoveBg = async () => {
        if (!user.photo) return;
        try {
            setIsRemovingBg(true);
            const token = localStorage.getItem('token');
            const res = await fetch('/api/utils/remove-bg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ image: user.photo }),
            });
            const data = await res.json();
            if (data.success) {
                onChange({ ...user, photo: data.image });
            } else {
                alert('Xatolik: ' + (data.error || 'Noma\'lum xatolik'));
            }
        } catch {
            alert('Xatolik yuz berdi');
        } finally {
            setIsRemovingBg(false);
        }
    };

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const compressed = await compressImage(ev.target?.result as string);
            onChange({ ...user, photo: compressed });
        };
        reader.readAsDataURL(file);
    };

    const handleCapture = async (base64: string) => {
        const compressed = await compressImage(base64);
        onChange({ ...user, photo: compressed });
        setIsCameraOpen(false);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{title}</h3>
                        <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">{subtitle}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    {/* Photo */}
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-900 shrink-0">
                            {user.photo
                                ? <img src={user.photo} alt="preview" className="w-full h-full object-cover" />
                                : <Camera size={20} className="text-gray-300" />}
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setIsCameraOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-[#1b6b6b]/10 hover:bg-[#1b6b6b] text-[#1b6b6b] hover:text-white border border-[#1b6b6b]/20 rounded-xl text-[9px] font-extrabold uppercase tracking-widest cursor-pointer transition-all">
                                    <Camera size={11} /> Kamera
                                </button>
                                <button type="button" onClick={() => fileRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl text-[9px] font-extrabold uppercase tracking-widest cursor-pointer transition-all">
                                    Fayldan yuklash
                                </button>
                            </div>
                            {user.photo && (
                                <div className="flex flex-col gap-1.5">
                                    <button type="button" onClick={handleRemoveBg} disabled={isRemovingBg}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30 rounded-xl text-[9px] font-extrabold uppercase tracking-widest hover:bg-violet-600 hover:text-white transition-all disabled:opacity-50 cursor-pointer">
                                        <Sparkles size={11} className={isRemovingBg ? 'animate-spin' : ''} />
                                        {isRemovingBg ? 'Tozalanmoqda...' : 'Fonni tozalash'}
                                    </button>
                                    <button type="button" onClick={() => onChange({ ...user, photo: '' })}
                                        className="text-[9px] font-bold text-rose-500 uppercase tracking-widest cursor-pointer hover:underline text-left">
                                        Rasmni o'chirish
                                    </button>
                                </div>
                            )}
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                    </div>
                    {isCameraOpen && (
                        <PhotoCapture onCapture={handleCapture} onClose={() => setIsCameraOpen(false)} />
                    )}

                    <div>
                        <label className={lbl}>Ism Familiya *</label>
                        <input required type="text" className={inp} value={user.name || ''} onChange={e => onChange({ ...user, name: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={lbl}>Lavozim *</label>
                            <select required className={inp} value={user.role || 'RECEPTIONIST'} onChange={e => onChange({ ...user, role: e.target.value })}>
                                <option value="RECEPTIONIST">Receptionist</option>
                                <option value="TEACHER">O'qituvchi</option>
                                <option value="SUPPORT_TEACHER">Yord. O'qituvchi</option>
                                <option value="TECH_STAFF">Tex. Xodim</option>
                                <option value="DRIVER">Haydovchi</option>
                                {(currentUserRole === 'ADMIN' || currentUserRole === 'MANAGER') && <option value="MANAGER">Menejer</option>}
                                {currentUserRole === 'ADMIN' && <option value="ADMIN">Administrator</option>}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Telefon</label>
                            <input type="text" placeholder="+998" className={inp} value={user.phone || ''} onChange={e => onChange({ ...user, phone: e.target.value })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={lbl}>Vazifa / Mutaxassislik</label>
                            <input type="text" placeholder="Masalan: Matematika o'qituvchisi" className={inp} value={user.position || ''} onChange={e => onChange({ ...user, position: e.target.value })} />
                        </div>
                        <div>
                            <label className={lbl}>Asosiy Maosh (UZS)</label>
                            <input type="number" placeholder="0" className={inp} value={user.salary || ''} onChange={e => onChange({ ...user, salary: e.target.value })} />
                        </div>
                    </div>

                    <div>
                        <label className={lbl}>KPI Foiz (%)</label>
                        <input type="number" min="0" max="100" placeholder="0" className={inp} value={user.kpiPercent ?? ''} onChange={e => onChange({ ...user, kpiPercent: Number(e.target.value) })} />
                    </div>

                    {/* Email/password — hidden for TECH_STAFF */}
                    {!isTechStaff && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={lbl}>Email *</label>
                                <input required={!isTechStaff} type="email" className={inp} value={user.email || ''} onChange={e => onChange({ ...user, email: e.target.value })} />
                            </div>
                            <div>
                                <label className={lbl}>{showPassword ? 'Parol *' : 'Yangi Parol'}</label>
                                <input type="password" required={showPassword && !isTechStaff} placeholder={showPassword ? 'Kamida 6 belgi' : "O'zgartirish uchun"} className={inp}
                                    value={user.password || ''} onChange={e => onChange({ ...user, password: e.target.value })} />
                            </div>
                        </div>
                    )}

                    {isTechStaff && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-2xl">
                            <Wrench size={14} className="text-orange-500 shrink-0" />
                            <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                                Tex. xodimlar tizimga kirish huquqiga ega emas — login ma'lumotlari avtomatik yaratiladi.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-dashed border-gray-100 dark:border-gray-700/50">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                            Bekor
                        </button>
                        <button type="submit"
                            className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                            Saqlash
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
