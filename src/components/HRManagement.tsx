import React, { useState, useEffect, useRef } from 'react';
import {
    Users2, Plus, X, Trash2, Pencil,
    Banknote,
    GraduationCap, ExternalLink, Camera, Wrench, Eye, Sparkles
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import StatTile from './ui/StatTile';
import { displayName } from '../lib/displayName';
import { useConfirm } from './ConfirmDialog';
import { useLang } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { compressImage, compressAndUpload } from '../lib/image';
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
    TEACHER:         'bg-teal-50 text-brand border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40',
    SUPPORT_TEACHER: 'bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/40',
    RECEPTIONIST:    'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-900/50 dark:text-gray-400 dark:border-gray-800/40',
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


const inp = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[11px] font-extrabold   text-matn-xira mb-2";

export default function HRManagement() {
    const { teachers, groups, selectedSchoolId, user: currentUser, token, showNotification } = useCRM();
    const confirm = useConfirm();
    const { t } = useLang();
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

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'ADMIN': return t('role_admin');
            case 'MANAGER': return t('role_manager');
            case 'TEACHER': return t('role_teacher');
            case 'SUPPORT_TEACHER': return t('role_support_teacher');
            case 'RECEPTIONIST': return t('role_receptionist');
            case 'DRIVER': return t('role_driver');
            case 'TECH_STAFF': return t('role_tech_staff');
            default: return role;
        }
    };

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
            else { const d = await res.json(); showNotification(d.error || "Xatolik yuz berdi", 'error'); }
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
                else { const d = await res.json(); showNotification(d.error || "Xatolik yuz berdi", 'error'); }
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
                else { const d = await res.json(); showNotification(d.error || "Xatolik yuz berdi", 'error'); }
            }
        } catch (err) { console.error('Edit user failed', err); }
    };

    const handleDeleteUser = async (id: number) => {
        if (!await confirm("Xodimni o'chirmoqchimisiz?")) return;
        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) fetchUsers();
        } catch (err) { console.error('Delete user failed', err); }
    };

    const handleDeleteTeacher = async (tid: number) => {
        if (!await confirm("O'qituvchini o'chirmoqchimisiz?")) return;
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

    // ---- Ko'rsatkichlar. Hammasi mavjud yozuvlardan; hisoblab bo'lmasa
    // kartochka son o'rniga nima yetishmayotganini aytadi.
    const staffGroups = (u: any) =>
        (groups || []).filter(g => g.teacherId === (u._source === 'teacher' ? u._tid : u.teacherId));
    // Haftalik dars soni: toq/juft kunlar haftada 3 marta, har kuni — 6.
    // To'liq stavka 24 dars deb olingan.
    const TOLIQ_STAVKA = 24;
    const weekLoad = (u: any) =>
        staffGroups(u).reduce((n, g) => n + (g.days === 'TOQ' || g.days === 'JUFT' ? 3 : 6), 0);

    const teacherCount = allStaff.filter(u => u.role === 'TEACHER' || u.role === 'SUPPORT_TEACHER').length;
    const withLoad = allStaff.filter(u => weekLoad(u) > 0);
    const avgLoadPct = withLoad.length
        ? Math.round(withLoad.reduce((n, u) => n + Math.min(100, (weekLoad(u) / TOLIQ_STAVKA) * 100), 0) / withLoad.length)
        : null;
    const salaryFund = allStaff.reduce((n, u) => n + (Number(u.salary) || 0), 0);
    const salaryMissing = allStaff.filter(u => !(Number(u.salary) > 0)).length;
    const overloaded = allStaff.filter(u => weekLoad(u) > TOLIQ_STAVKA);
    const staffTeacherIds = new Set(allStaff.map(u => (u._source === 'teacher' ? u._tid : u.teacherId)).filter(Boolean));
    const orphanGroups = (groups || []).filter(g => !g.teacherId || !staffTeacherIds.has(g.teacherId));

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-[26px] font-bold text-matn tracking-tight leading-tight">{t('hr_title')}</h1>
                            <p className="text-[13px] text-matn-sokin mt-1">
                                {t('hr_subtitle')}
                            </p>
                        </div>
                    </div>
                    {isAdminOrManager && (
                        <button onClick={() => { setNewUser({ role: 'RECEPTIONIST' }); setIsAddOpen(true); }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-extrabold shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                            <Plus size={14} /> {t('new_staff')}
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                    {/* To'rtta ko'rsatkich */}
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                        <StatTile
                            label="Jami xodim"
                            value={allStaff.length}
                            subValue={<><span className="raqam">{teacherCount}</span> ustoz, <span className="raqam">{allStaff.length - teacherCount}</span> boshqa lavozim</>}
                        />
                        <StatTile
                            label="Guruh yuritayotgan"
                            value={withLoad.length}
                            subValue={orphanGroups.length > 0
                                ? <><span className="raqam">{orphanGroups.length}</span> ta guruhga ustoz biriktirilmagan</>
                                : 'Barcha guruhda ustoz bor'}
                            subTone={orphanGroups.length > 0 ? 'warn' : 'good'}
                        />
                        <StatTile
                            label="O'rtacha yuklama"
                            value={avgLoadPct === null ? '—' : avgLoadPct}
                            unit={avgLoadPct === null ? undefined : '%'}
                            bar={avgLoadPct}
                            barCaption={<>to'liq stavka <span className="raqam">{TOLIQ_STAVKA}</span> dars/hafta deb olingan</>}
                            subValue={avgLoadPct === null ? 'Guruhlarga kun kiritilmagan' : undefined}
                        />
                        <StatTile
                            label="Oylik fond"
                            value={salaryFund > 0 ? (salaryFund / 1000000).toFixed(1).replace('.', ',') : '—'}
                            unit={salaryFund > 0 ? 'mln' : undefined}
                            subValue={salaryMissing > 0
                                ? <><span className="raqam">{salaryMissing}</span> ta xodimning oyligi kiritilmagan</>
                                : 'Barcha oylik kiritilgan'}
                            subTone={salaryMissing > 0 ? 'warn' : 'good'}
                        />
                    </div>

                    {/* Lavozim bo'yicha filtr. Ilgari bular ettita katta kartochka
                        edi va beshtasida nol turardi — ekranning uchdan biri
                        bo'sh sonlarga ketardi. Endi nol bo'lgan lavozim
                        umuman ko'rsatilmaydi. */}
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelectedRole(null)}
                            className={`px-3 py-1.5 rounded-lg text-[12px] border transition-colors cursor-pointer ${
                                selectedRole === null ? 'bg-brand text-brand-ust border-brand font-semibold' : 'border-chiziq-kuchli text-matn-sokin hover:text-matn'
                            }`}>
                            Barchasi <span className="raqam opacity-65">{allStaff.length}</span>
                        </button>
                        {Object.keys(ROLE_LABELS).map((role) => {
                            const count = allStaff.filter(u => u.role === role).length;
                            if (!count) return null;
                            const isActive = selectedRole === role;
                            return (
                                <button key={role}
                                    onClick={() => setSelectedRole(prev => prev === role ? null : role)}
                                    className={`px-3 py-1.5 rounded-lg text-[12px] border transition-colors cursor-pointer ${
                                        isActive ? 'bg-brand text-brand-ust border-brand font-semibold' : 'border-chiziq-kuchli text-matn-sokin hover:text-matn'
                                    }`}>
                                    {getRoleLabel(role)} <span className="raqam opacity-65">{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    {loadingUsers ? (
                        <div className="py-20 text-center text-brand text-xs font-bold">{t('loading')}</div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="py-20 text-center bg-sirt rounded-2xl border border-chiziq">
                            <p className="text-[11px] font-bold text-matn-xira">{t('no_staff_found')}</p>
                        </div>
                    ) : (
                        // Kartochka o'rniga jadval: xodimlar ro'yxatida ismlarni va
                        // oyliklarni yonma-yon solishtirish kerak bo'ladi, kartochkalarda
                        // esa har biri alohida qutida turib, ekranga ikki barobar kam
                        // qator sig'ardi.
                        <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left min-w-[720px]">
                                    <thead>
                                        <tr className="border-b border-chiziq">
                                            <th className="px-5 py-3 text-[11px] font-medium text-matn-xira">Xodim</th>
                                            <th className="px-3 py-3 text-[11px] font-medium text-matn-xira">Lavozim</th>
                                            <th className="px-3 py-3 text-[11px] font-medium text-matn-xira">Rol</th>
                                            <th className="px-3 py-3 text-[11px] font-medium text-matn-xira text-right">Guruh</th>
                                            <th className="px-3 py-3 text-[11px] font-medium text-matn-xira">Haftalik yuklama</th>
                                            <th className="px-3 py-3 text-[11px] font-medium text-matn-xira text-right">Oylik</th>
                                            <th className="px-5 py-3 w-28" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-chiziq-mayin dark:divide-gray-700/40">
                                        {filteredUsers.map((u) => {
                                            const isLegacy = u._source === 'teacher';
                                            const profilePath = isLegacy ? `/teachers/${u._tid}` : `/hr/${u.id}`;
                                            const myGroups = (groups || []).filter(g => g.teacherId === (isLegacy ? u._tid : u.teacherId));
                                            const groupCount = myGroups.length;
                                            // Haftalik dars soni: toq/juft kunlar haftada 3 marta,
                                            // har kuni — 6 marta. Boshqa maydon bazada yo'q.
                                            const weeklyLessons = myGroups.reduce((n, g) => n + (g.days === 'TOQ' || g.days === 'JUFT' ? 3 : 6), 0);
                                            const loadPct = Math.min(100, Math.round((weeklyLessons / 24) * 100));
                                            return (
                                                <tr key={u.id} className="group hover:bg-gray-55/70 dark:hover:bg-gray-900/30 transition-colors">
                                                    <td className="px-5 py-3 align-middle">
                                                        <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => navigate(profilePath)}>
                                                            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                                                                {u.photo ? (
                                                                    <img src={u.photo} alt={u.name} className="w-full h-full object-cover object-top" />
                                                                ) : (
                                                                    <div className="w-full h-full bg-brand/12 flex items-center justify-center text-brand font-semibold text-[11px]">
                                                                        {displayName(u.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[13px] font-medium text-matn truncate group-hover:text-brand transition-colors">{displayName(u.name)}</p>
                                                                {u.phone && <p className="num text-[11px] text-matn-xira truncate">{u.phone}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-[12px] text-matn-sokin align-middle">{u.position || '—'}</td>
                                                    <td className="px-3 py-3 align-middle">
                                                        {/* Rang endi ma'no bermaydi: yetti xil rangli
                                                            belgi ro'yxatni bezakka aylantirardi. */}
                                                        <span className="text-[11px] px-2 py-0.5 rounded-md border border-chiziq text-matn-2 whitespace-nowrap">
                                                            {getRoleLabel(u.role)}
                                                        </span>
                                                    </td>
                                                    <td className="num px-3 py-3 text-[13px] text-right text-gray-700 dark:text-gray-200 align-middle">
                                                        {groupCount || '—'}
                                                    </td>
                                                    <td className="px-3 py-3 align-middle">
                                                        {weeklyLessons > 0 ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-20 h-1.5 rounded-full bg-chiziq overflow-hidden shrink-0">
                                                                    <div className={`h-full rounded-full ${loadPct >= 85 ? 'bg-rose-500' : loadPct >= 60 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                                                        style={{ width: `${loadPct}%` }} />
                                                                </div>
                                                                <span className="num text-[12px] text-matn-sokin shrink-0">{weeklyLessons} dars</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[12px] text-matn-xira">—</span>
                                                        )}
                                                    </td>
                                                    <td className="num px-3 py-3 text-[13px] text-right text-gray-700 dark:text-gray-200 align-middle">
                                                        {u.salary > 0 ? u.salary.toLocaleString() : '—'}
                                                    </td>
                                                    <td className="px-5 py-3 align-middle">
                                                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {isAdminOrManager && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); navigate(`/finance?openExpense=1&staffId=${isLegacy ? u._tid : u.id}&staffName=${encodeURIComponent(u.name)}`); }}
                                                                    title="Ish haqqi berish"
                                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-matn-xira hover:text-white hover:bg-rose-500 transition-colors cursor-pointer"
                                                                >
                                                                    <Banknote size={13} />
                                                                </button>
                                                            )}
                                                            {isAdminOrManager && (
                                                                <button onClick={() => { setEditingUser({ ...u, password: '' }); setIsEditOpen(true); }}
                                                                    title="Tahrirlash"
                                                                    className="w-7 h-7 rounded-lg text-matn-xira hover:text-brand hover:bg-gray-100 dark:hover:bg-gray-900 flex items-center justify-center transition-colors cursor-pointer">
                                                                    <Pencil size={13} />
                                                                </button>
                                                            )}
                                                            <button onClick={() => navigate(profilePath)}
                                                                title={t('view_profile')}
                                                                className="w-7 h-7 rounded-lg text-matn-xira hover:text-brand hover:bg-gray-100 dark:hover:bg-gray-900 flex items-center justify-center transition-colors cursor-pointer">
                                                                <Eye size={13} />
                                                            </button>
                                                            {isAdmin && (
                                                                <button
                                                                    onClick={() => isLegacy ? handleDeleteTeacher(u._tid) : handleDeleteUser(u.id)}
                                                                    title="O'chirish"
                                                                    className="w-7 h-7 rounded-lg text-matn-xira hover:text-white hover:bg-rose-500 flex items-center justify-center transition-colors cursor-pointer">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Ro'yxatdan chiqadigan xulosalar. Hech narsa bo'lmasa
                        blok umuman ko'rsatilmaydi — bo'sh kartochka
                        "hammasi joyida" degan xabardan ko'ra ko'proq
                        chalg'itadi. */}
                    {(overloaded.length > 0 || orphanGroups.length > 0 || salaryMissing > 0) && (
                        <div className="bg-sirt rounded-xl border border-chiziq p-4">
                            <p className="text-[14px] font-semibold text-matn mb-3">E'tibor talab qiladi</p>
                            <div className="space-y-2.5">
                                {overloaded.map(u => (
                                    <div key={`load-${u.id}`} className="flex items-center gap-2.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-xato shrink-0" />
                                        <span className="text-[13px] text-matn">
                                            {displayName(u.name)} haftasiga <span className="raqam">{weekLoad(u)}</span> dars —
                                            to'liq stavkadan (<span className="raqam">{TOLIQ_STAVKA}</span>) yuqori
                                        </span>
                                    </div>
                                ))}
                                {orphanGroups.length > 0 && (
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-ogoh shrink-0" />
                                        <span className="text-[13px] text-matn">
                                            <span className="raqam">{orphanGroups.length}</span> ta guruhga ustoz biriktirilmagan:{' '}
                                            <span className="text-matn-sokin">{orphanGroups.slice(0, 3).map(g => g.name).join(', ')}</span>
                                            {orphanGroups.length > 3 && <span className="text-matn-xira"> va yana {orphanGroups.length - 3} ta</span>}
                                        </span>
                                    </div>
                                )}
                                {salaryMissing > 0 && (
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-ogoh shrink-0" />
                                        <span className="text-[13px] text-matn">
                                            <span className="raqam">{salaryMissing}</span> ta xodimning oyligi kiritilmagan —
                                            oylik fond to'liq hisoblanmayapti
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

            {/* Add Modal */}
            {isAddOpen && (
                <UserModal
                    title={t('new_staff')} subtitle={t('add_staff_subtitle')}
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
                    title={t('edit_staff')} subtitle={t('edit_staff_subtitle')}
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
        <div className="flex justify-between items-center py-2.5 border-b border-chiziq-mayin/50">
            <span className="text-[11px] font-bold text-matn-xira">{label}</span>
            <span className="text-xs font-extrabold text-matn tracking-tight">{value}</span>
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
    const { t } = useLang();
    const { showNotification } = useCRM();
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
                showNotification('Xatolik: ' + (data.error || 'Noma\'lum xatolik'), 'error');
            }
        } catch {
            showNotification('Xatolik yuz berdi', 'error');
        } finally {
            setIsRemovingBg(false);
        }
    };

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const url = await compressAndUpload(ev.target?.result as string, file.name);
            onChange({ ...user, photo: url });
        };
        reader.readAsDataURL(file);
    };

    const handleCapture = async (base64: string) => {
        const url = await compressAndUpload(base64, 'camera.jpg');
        onChange({ ...user, photo: url });
        setIsCameraOpen(false);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq-mayin/50">
                    <div>
                        <h3 className="text-lg font-black text-matn tracking-tight">{title}</h3>
                        <p className="text-[11px] font-bold text-brand mt-0.5">{subtitle}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl cursor-pointer" aria-label="Yopish"><X size={18} /></button>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    {/* Photo */}
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center bg-ichki shrink-0">
                            {user.photo
                                ? <img src={user.photo} alt="preview" className="w-full h-full object-cover" />
                                : <Camera size={20} className="text-gray-300" />}
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setIsCameraOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-brand/10 hover:bg-brand text-brand hover:text-white border border-brand/20 rounded-xl text-[11px] font-extrabold cursor-pointer transition-all">
                                    <Camera size={11} /> {t('camera')}
                                </button>
                                <button type="button" onClick={() => fileRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-chiziq hover:bg-gray-200 dark:hover:bg-gray-600 text-matn-2 border border-gray-200 dark:border-gray-600 rounded-xl text-[11px] font-extrabold cursor-pointer transition-all">
                                    {t('upload_from_file')}
                                </button>
                            </div>
                            {user.photo && (
                                <div className="flex flex-col gap-1.5">
                                    <button type="button" onClick={handleRemoveBg} disabled={isRemovingBg}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30 rounded-xl text-[11px] font-extrabold hover:bg-violet-600 hover:text-white transition-all disabled:opacity-50 cursor-pointer">
                                        <Sparkles size={11} className={isRemovingBg ? 'animate-spin' : ''} />
                                        {isRemovingBg ? t('clearing_bg') : t('clear_bg')}
                                    </button>
                                    <button type="button" onClick={() => onChange({ ...user, photo: '' })}
                                        className="text-[11px] font-bold text-rose-500 cursor-pointer hover:underline text-left">
                                        {t('delete_photo')}
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
                        <label className={lbl}>{t('full_name')} *</label>
                        <input required type="text" className={inp} value={user.name || ''} onChange={e => onChange({ ...user, name: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={lbl}>{t('staff_role')} *</label>
                            <select required className={inp} value={user.role || 'RECEPTIONIST'} onChange={e => onChange({ ...user, role: e.target.value })}>
                                <option value="RECEPTIONIST">{t('role_receptionist')}</option>
                                <option value="TEACHER">{t('role_teacher')}</option>
                                <option value="SUPPORT_TEACHER">{t('role_support_teacher')}</option>
                                <option value="TECH_STAFF">{t('role_tech_staff')}</option>
                                <option value="DRIVER">{t('role_driver')}</option>
                                {(currentUserRole === 'ADMIN' || currentUserRole === 'MANAGER') && <option value="MANAGER">{t('role_manager')}</option>}
                                {currentUserRole === 'ADMIN' && <option value="ADMIN">{t('role_admin')}</option>}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>{t('student_phone')}</label>
                            <input type="text" placeholder="+998" className={inp} value={user.phone || ''} onChange={e => onChange({ ...user, phone: e.target.value })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={lbl}>{t('position_specialty')}</label>
                            <input type="text" placeholder={t('position_placeholder')} className={inp} value={user.position || ''} onChange={e => onChange({ ...user, position: e.target.value })} />
                        </div>
                        <div>
                            <label className={lbl}>{t('base_salary')}</label>
                            <input type="number" placeholder="0" className={inp} value={user.salary || ''} onChange={e => onChange({ ...user, salary: e.target.value })} />
                        </div>
                    </div>

                    <div>
                        <label className={lbl}>{t('kpi_percent')}</label>
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
                                <label className={lbl}>{showPassword ? `${t('password')} *` : t('new_password')}</label>
                                <input type="password" required={showPassword && !isTechStaff} placeholder={showPassword ? t('min_password_length') : t('leave_blank_to_keep')} className={inp}
                                    value={user.password || ''} onChange={e => onChange({ ...user, password: e.target.value })} />
                            </div>
                        </div>
                    )}

                    {isTechStaff && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-2xl">
                            <Wrench size={14} className="text-orange-500 shrink-0" />
                            <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                                {t('tech_staff_no_login_warning')}
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-dashed border-chiziq">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                            {t('cancel')}
                        </button>
                        <button type="submit"
                            className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white text-xs font-extrabold rounded-2xl shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                            {t('save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
