import React, { useState, useRef } from 'react';
import {
    Building2, Plus, ChevronDown, ChevronRight, ShieldCheck, Trash2, Save, X,
    Layout, MapPin, Bus, BookOpen, DoorOpen, Globe, Phone, Clock, Camera,
    Instagram, Send, Shield, ToggleLeft, ToggleRight, Pencil
} from 'lucide-react';
import { useCRM, THEMES } from '../context/CRMContext';

type SectionId = 'profil' | 'ijtimoiy' | 'kurslar' | 'xonalar' | 'transport' | 'filiallar' | 'ruxsatlar' | 'dizayn';

const MODULES = [
    { key: 'dashboard',     label: 'Dashboard' },
    { key: 'students',      label: "O'quvchilar" },
    { key: 'teachers',      label: "O'qituvchilar" },
    { key: 'groups',        label: 'Guruhlar' },
    { key: 'finance',       label: 'Moliya' },
    { key: 'exams',         label: 'Imtihonlar' },
    { key: 'leads',         label: 'Lidlar' },
    { key: 'hr',            label: 'HR Menejment' },
    { key: 'reports',       label: 'Hisobotlar' },
    { key: 'settings',      label: 'Sozlamalar' },
];

const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
    ADMIN:        { dashboard: true,  students: true,  teachers: true,  groups: true,  finance: true,  exams: true,  leads: true,  hr: true,  reports: true,  settings: true  },
    MANAGER:      { dashboard: true,  students: true,  teachers: true,  groups: true,  finance: true,  exams: true,  leads: true,  hr: true,  reports: false, settings: false },
    TEACHER:      { dashboard: true,  students: true,  teachers: false, groups: true,  finance: false, exams: true,  leads: false, hr: false, reports: false, settings: false },
    RECEPTIONIST: { dashboard: true,  students: true,  teachers: false, groups: true,  finance: false, exams: false, leads: true,  hr: false, reports: false, settings: false },
    DRIVER:       { dashboard: false, students: false, teachers: false, groups: false, finance: false, exams: false, leads: false, hr: false, reports: false, settings: false },
};

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin', MANAGER: 'Menejer', TEACHER: "O'qituvchi", RECEPTIONIST: 'Receptionist', DRIVER: 'Haydovchi'
};

const inp = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

export default function Settings() {
    const { settings, updateSettings, courses, rooms, schools, transports,
        addCourse, deleteCourse, addRoom, deleteRoom, addSchool, deleteSchool,
        addTransport, updateTransport, deleteTransport, selectedSchoolId,
        themeColor, setThemeColor } = useCRM();
    const { user: currentUser, token } = useCRM();

    const [activeSection, setActiveSection] = useState<SectionId>('profil');
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ tashkilot: true, ofis: false, ceo: false });

    const [profileForm, setProfileForm] = useState({ ...settings });
    const [isSaving, setIsSaving] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditTransportOpen, setIsEditTransportOpen] = useState(false);
    const [newItem, setNewItem] = useState<any>({});
    const [editingTransport, setEditingTransport] = useState<any>(null);

    const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>(() => {
        try {
            const saved = localStorage.getItem('crm_permissions');
            return saved ? JSON.parse(saved) : DEFAULT_PERMISSIONS;
        } catch { return DEFAULT_PERMISSIONS; }
    });
    const [permSaved, setPermSaved] = useState(false);
    const [copied, setCopied] = useState(false);

    React.useEffect(() => { setProfileForm({ ...settings }); }, [settings]);

    const toggle = (group: string) => setOpenGroups(p => ({ ...p, [group]: !p[group] }));

    const isAdmin = currentUser?.role === 'ADMIN';
    const isAdminOrManager = isAdmin || currentUser?.role === 'MANAGER';

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => setProfileForm(p => ({ ...p, logo: ev.target?.result as string }));
        reader.readAsDataURL(file);
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try { await updateSettings(profileForm); } finally { setIsSaving(false); }
    };

    const handleSavePermissions = () => {
        localStorage.setItem('crm_permissions', JSON.stringify(permissions));
        setPermSaved(true);
        setTimeout(() => setPermSaved(false), 2000);
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (activeSection === 'kurslar') {
                await addCourse({ ...newItem, price: Number(newItem.price) });
            } else if (activeSection === 'xonalar') {
                await addRoom({ ...newItem, capacity: Number(newItem.capacity) });
            } else if (activeSection === 'filiallar') {
                await addSchool(newItem);
            } else if (activeSection === 'transport') {
                await addTransport({ ...newItem, capacity: Number(newItem.capacity || 0), schoolId: selectedSchoolId });
            }
            setIsAddModalOpen(false);
            setNewItem({});
        } catch (err: any) {
            console.error('Add failed', err);
        }
    };

    const handleSaveTransport = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateTransport(editingTransport.id, editingTransport);
            setIsEditTransportOpen(false);
            setEditingTransport(null);
        } catch (err) { console.error('Update transport failed', err); }
    };

    const menuGroups = [
        {
            id: 'tashkilot', label: 'Tashkilot', icon: <Building2 size={16} />,
            items: [
                { id: 'profil' as SectionId, label: 'Profil', icon: <Globe size={14} /> },
                { id: 'ijtimoiy' as SectionId, label: 'Ijtimoiy', icon: <Instagram size={14} /> },
                { id: 'dizayn' as SectionId, label: 'Palitralar', icon: <Layout size={14} /> },
            ]
        },
        {
            id: 'ofis', label: 'Ofis', icon: <DoorOpen size={16} />,
            items: [
                { id: 'kurslar' as SectionId, label: 'Kurslar', icon: <BookOpen size={14} />, count: courses?.length },
                { id: 'xonalar' as SectionId, label: 'Xonalar', icon: <DoorOpen size={14} />, count: rooms?.length },
                { id: 'transport' as SectionId, label: 'Transport', icon: <Bus size={14} />, count: transports?.length },
            ]
        },
        ...(isAdminOrManager ? [{
            id: 'ceo', label: 'Boshqaruv', icon: <ShieldCheck size={16} />,
            items: [
                { id: 'filiallar' as SectionId, label: 'Filiallar', icon: <Building2 size={14} />, count: schools?.length },
                ...(isAdmin ? [{ id: 'ruxsatlar' as SectionId, label: 'Ruxsatlar', icon: <Shield size={14} /> }] : []),
            ]
        }] : []),
    ];

    const applyUrl = `${window.location.origin}/apply/${selectedSchoolId}`;

    const renderContent = () => {
        if (activeSection === 'profil') return (
            <div className="space-y-8">
                <form onSubmit={handleSaveProfile} className="space-y-6">
                <div>
                    <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Tashkilot Profili</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Markaz haqida asosiy ma'lumotlar</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <div className="w-20 h-20 rounded-3xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700/50 overflow-hidden flex items-center justify-center">
                            {profileForm?.logo
                                ? <img src={profileForm.logo} className="w-full h-full object-cover" alt="logo" />
                                : <Building2 size={24} className="text-[#1b6b6b]" />
                            }
                        </div>
                        <button type="button" onClick={() => logoInputRef.current?.click()}
                            className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#1b6b6b] hover:bg-[#155252] rounded-xl flex items-center justify-center transition-all shadow-lg cursor-pointer">
                            <Camera size={13} className="text-white" />
                        </button>
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                    </div>
                    <div>
                        <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">{profileForm?.orgName || 'Markaz nomi'}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Logo yuklash uchun kameraga bosing</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={lbl}>Markaz Nomi *</label>
                        <input type="text" className={inp} value={profileForm?.orgName || ''} onChange={e => setProfileForm(p => ({ ...p, orgName: e.target.value }))} />
                    </div>
                    <div>
                        <label className={lbl}>Telefon</label>
                        <input type="text" placeholder="+998" className={inp} value={profileForm?.adminPhone || ''} onChange={e => setProfileForm(p => ({ ...p, adminPhone: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2">
                        <label className={lbl}>Manzil</label>
                        <input type="text" className={inp} value={profileForm?.address || ''} onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))} />
                    </div>
                    <div>
                        <label className={lbl}>Ish Soatlari</label>
                        <input type="text" placeholder="09:00 - 21:00" className={inp} value={profileForm?.workingHours || ''} onChange={e => setProfileForm(p => ({ ...p, workingHours: e.target.value }))} />
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                    <button type="submit" disabled={isSaving}
                        className="px-6 py-3 bg-[#1b6b6b] hover:bg-[#155252] disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                        <Save size={14} />{isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
                    </button>
                </div>
            </form>

            {/* QR Link Section */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-3xl space-y-4">
                <div>
                    <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">O'quvchilar uchun QR Havola</h3>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                        Yangi kelgan o'quvchilar o'zlari ro'yxatdan o'tishi uchun umumiy havola
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text"
                        readOnly
                        className="bg-white dark:bg-gray-800 px-4 py-3 border border-gray-100 dark:border-gray-700/50 outline-none text-[11px] font-mono text-gray-500 dark:text-gray-400 flex-1 rounded-2xl select-all"
                        value={applyUrl}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            navigator.clipboard.writeText(applyUrl);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                        }}
                        className="px-6 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap"
                    >
                        {copied ? 'Nusxalandi!' : 'Nusxalash'}
                    </button>
                </div>
                <p className="text-[9px] font-bold text-gray-400 leading-relaxed">
                    * Tavsiya: Ushbu havolani QR kod generatori orqali QR kod ko'rinishida chop etib, reception stoliga qo'ying. Kelgan o'quvchilar telefon orqali skanerlab, o'zlarini tezda ro'yxatdan o'tkazishlari mumkin.
                </p>
            </div>
        </div>
    );

        if (activeSection === 'ijtimoiy') return (
            <form onSubmit={handleSaveProfile} className="space-y-6">
                <div>
                    <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Ijtimoiy Tarmoqlar</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Markaz sahifalariga havolalar</p>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className={lbl}>Telegram</label>
                        <input type="text" placeholder="@markaz_nomi" className={inp} value={profileForm?.telegram || ''} onChange={e => setProfileForm(p => ({ ...p, telegram: e.target.value }))} />
                    </div>
                    <div>
                        <label className={lbl}>Instagram</label>
                        <input type="text" placeholder="@markaz_nomi" className={inp} value={profileForm?.instagram || ''} onChange={e => setProfileForm(p => ({ ...p, instagram: e.target.value }))} />
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                    <button type="submit" disabled={isSaving}
                        className="px-6 py-3 bg-[#1b6b6b] hover:bg-[#155252] disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                        <Save size={14} />{isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
                    </button>
                </div>
            </form>
        );

        if (activeSection === 'kurslar') return (
            <ListSection
                title="Kurslar" subtitle="O'quv markazidagi barcha kurslar"
                icon={<BookOpen size={16} />} onAdd={() => { setNewItem({}); setIsAddModalOpen(true); }}
                items={courses || []} emptyText="Hech qanday kurs topilmadi"
                renderItem={(item: any) => (
                    <ItemCard key={item.id} icon={<Layout size={16} />} iconBg="bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/40"
                        title={item.name} subtitle={`${(item.price || 0).toLocaleString()} UZS`}
                        onDelete={() => deleteCourse(item.id)} />
                )}
            />
        );

        if (activeSection === 'xonalar') return (
            <ListSection
                title="Dars Xonalari" subtitle="Markazdagi barcha xonalar"
                icon={<DoorOpen size={16} />} onAdd={() => { setNewItem({}); setIsAddModalOpen(true); }}
                items={rooms || []} emptyText="Hech qanday xona topilmadi"
                renderItem={(item: any) => (
                    <ItemCard key={item.id} icon={<DoorOpen size={16} />} iconBg="bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/40"
                        title={item.name} subtitle={`${item.capacity} kishilik`}
                        onDelete={() => deleteRoom(item.id)} />
                )}
            />
        );

        if (activeSection === 'transport') return (
            <ListSection
                title="Transport" subtitle="Logistika uchun transport vositalari"
                icon={<Bus size={16} />} onAdd={() => { setNewItem({}); setIsAddModalOpen(true); }}
                items={transports || []} emptyText="Transport vositalari topilmadi"
                renderItem={(item: any) => {
                    const statusCls = item.status === 'Faol'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
                        : item.status === "Ta'mirda"
                        ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40'
                        : 'bg-gray-50 text-gray-400 border-gray-100 dark:bg-gray-900/50 dark:text-gray-500';
                    return (
                        <div key={item.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 flex flex-col gap-4 group hover:shadow-md transition-all">
                            <div className="flex items-start justify-between">
                                <div className="w-10 h-10 rounded-xl bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700/50 flex items-center justify-center text-[#1b6b6b]">
                                    <Bus size={18} />
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wider ${statusCls}`}>
                                        {item.status}
                                    </span>
                                    <button onClick={() => { setEditingTransport({ ...item }); setIsEditTransportOpen(true); }}
                                        className="w-7 h-7 rounded-lg text-gray-400 hover:text-[#1b6b6b] hover:bg-gray-50 dark:hover:bg-gray-950 flex items-center justify-center transition-colors cursor-pointer">
                                        <Pencil size={13} />
                                    </button>
                                    <button onClick={() => deleteTransport(item.id)}
                                        className="w-7 h-7 rounded-lg text-rose-400 hover:text-rose-650 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center justify-center transition-colors cursor-pointer">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">{item.name}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{item.model} {item.number ? `· ${item.number}` : ''}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-dashed border-gray-100 dark:border-gray-700/50">
                                <div>
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Sig'imi</p>
                                    <p className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">{item.capacity} kishi</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Haydovchi</p>
                                    <p className="text-xs font-bold text-gray-900 dark:text-white mt-0.5 truncate">{item.driverName || '—'}</p>
                                </div>
                            </div>
                        </div>
                    );
                }}
            />
        );

        if (activeSection === 'filiallar') return (
            <ListSection
                title="Filiallar" subtitle="O'quv markazi filiallari"
                icon={<Building2 size={16} />} onAdd={() => { setNewItem({}); setIsAddModalOpen(true); }}
                items={schools || []} emptyText="Hech qanday filial topilmadi"
                renderItem={(item: any) => (
                    <ItemCard key={item.id} icon={<Building2 size={16} />} iconBg="bg-teal-50 text-[#1b6b6b] border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40"
                        title={item.name} subtitle={item.address || 'Manzil kiritilmagan'}
                        onDelete={() => deleteSchool(item.id)} />
                )}
            />
        );

        if (activeSection === 'ruxsatlar') return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Foydalanuvchi Ruxsatlari</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Har bir lavozim uchun modul ruxsatlarini boshqaring</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full min-w-[600px] border-collapse text-left">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/20">
                                    <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest min-w-[150px]">Modul</th>
                                    {Object.keys(permissions).map(role => (
                                        <th key={role} className="p-4 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                            {ROLE_LABELS[role] || role}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                {MODULES.map(mod => (
                                    <tr key={mod.key} className="hover:bg-gray-50/40 dark:hover:bg-gray-700/10 transition-colors">
                                        <td className="p-4 text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">{mod.label}</td>
                                        {Object.keys(permissions).map(role => {
                                            const on = permissions[role]?.[mod.key] ?? false;
                                            const isLocked = role === 'ADMIN';
                                            return (
                                                <td key={role} className="p-4 text-center">
                                                    <button
                                                        disabled={isLocked}
                                                        onClick={() => setPermissions(p => ({
                                                            ...p,
                                                            [role]: { ...p[role], [mod.key]: !on }
                                                        }))}
                                                        className={`inline-flex items-center justify-center transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                                                    >
                                                        {on
                                                            ? <ToggleRight size={26} className="text-[#1b6b6b]" />
                                                            : <ToggleLeft size={26} className="text-gray-300 dark:text-gray-700" />
                                                        }
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                    <button onClick={handleSavePermissions}
                        className={`px-6 py-3 rounded-2xl text-xs font-extrabold uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer ${permSaved ? 'bg-emerald-600 text-white' : 'bg-[#1b6b6b] hover:bg-[#155252] text-white shadow-lg shadow-[#1b6b6b]/20'}`}>
                        <Save size={14} />{permSaved ? 'Saqlandi!' : 'Saqlash'}
                    </button>
                </div>
            </div>
        );

        if (activeSection === 'dizayn') return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                    <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Interfeys Palitrasi</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Tizimning asosiy ranglar palitrasini tanlang</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {THEMES.map(theme => {
                        const isActive = themeColor === theme.id;
                        return (
                            <button
                                key={theme.id}
                                onClick={() => {
                                    setThemeColor(theme.id);
                                }}
                                className={`w-full flex items-center justify-between p-5 rounded-3xl border transition-all text-left group cursor-pointer ${
                                    isActive
                                        ? 'border-[var(--brand-color)] bg-[var(--brand-light)] dark:bg-gray-700/20'
                                        : 'border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                            >
                                <div className="space-y-2">
                                    <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide group-hover:text-[var(--brand-color)] transition-colors">
                                        {theme.name}
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: theme.primary }} title="Asosiy rang" />
                                        <div className="w-5 h-5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: theme.gradientEnd }} title="Accent rang" />
                                        <div className="w-5 h-5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: theme.light }} title="Orqa fon rangi" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div 
                                        className="px-3 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm transition-all"
                                        style={{ background: `linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd})` }}
                                    >
                                        Palitra
                                    </div>
                                    {isActive && (
                                        <div className="w-5 h-5 rounded-full bg-[var(--brand-color)] flex items-center justify-center text-white">
                                            <ShieldCheck size={12} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );

        return null;
    };

    const addModalTitle = activeSection === 'kurslar' ? 'Yangi Kurs' : activeSection === 'xonalar' ? 'Yangi Xona' : activeSection === 'filiallar' ? 'Yangi Filial' : 'Yangi Transport';

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-lg shadow-[#1b6b6b]/20">
                            <Building2 size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Tizim Sozlamalari</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                Markaz profili, filiallar, resurslar va ruxsatlar sozlamalari
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* Sidebar */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-3 shadow-sm">
                    <div className="space-y-1">
                        {menuGroups.map(group => (
                            <div key={group.id} className="space-y-0.5">
                                <button onClick={() => toggle(group.id)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-250 transition-all cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[#1b6b6b]">{group.icon}</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{group.label}</span>
                                    </div>
                                    {openGroups[group.id]
                                        ? <ChevronDown size={12} />
                                        : <ChevronRight size={12} />
                                    }
                                </button>
                                {openGroups[group.id] && (
                                    <div className="ml-3 pl-3 border-l border-gray-100 dark:border-gray-700/50 space-y-0.5 mt-0.5 mb-1.5">
                                        {group.items.map(item => (
                                            <button key={item.id} onClick={() => setActiveSection(item.id)}
                                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left cursor-pointer ${activeSection === item.id ? 'bg-[#1b6b6b]/5 text-[#1b6b6b] border border-[#1b6b6b]/10' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
                                                <div className="flex items-center gap-2">
                                                    {item.icon}
                                                    <span className="text-[9px] font-extrabold uppercase tracking-widest">{item.label}</span>
                                                </div>
                                                {'count' in item && item.count !== undefined && (
                                                    <span className="text-[8px] font-black bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded-lg text-gray-500">{item.count}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6 min-h-[400px] shadow-sm">
                    {renderContent()}
                </div>
            </div>

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{addModalTitle}</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">Yangi ma'lumot qo'shish</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleAddItem} className="space-y-4">
                            {activeSection !== 'transport' && (
                                <div>
                                    <label className={lbl}>Nomi *</label>
                                    <input required type="text" className={inp} value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                                </div>
                            )}
                            {activeSection === 'kurslar' && (
                                <div>
                                    <label className={lbl}>Narxi (UZS) *</label>
                                    <input required type="number" className={inp} value={newItem.price || ''} onChange={e => setNewItem({ ...newItem, price: e.target.value })} />
                                </div>
                            )}
                            {activeSection === 'xonalar' && (
                                <div>
                                    <label className={lbl}>Sig'imi (kishi) *</label>
                                    <input required type="number" className={inp} value={newItem.capacity || ''} onChange={e => setNewItem({ ...newItem, capacity: e.target.value })} />
                                </div>
                            )}
                            {activeSection === 'filiallar' && (
                                <div>
                                    <label className={lbl}>Manzil</label>
                                    <input type="text" className={inp} value={newItem.address || ''} onChange={e => setNewItem({ ...newItem, address: e.target.value })} />
                                </div>
                            )}
                            {activeSection === 'transport' && (
                                <TransportForm item={newItem} onChange={setNewItem} />
                            )}
                            <div className="flex gap-3 pt-4 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                                <button type="button" onClick={() => setIsAddModalOpen(false)}
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
            )}

            {/* Edit Transport Modal */}
            {isEditTransportOpen && editingTransport && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsEditTransportOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Transport Tahriri</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">Avtopark tarkibini yangilash</p>
                            </div>
                            <button onClick={() => setIsEditTransportOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSaveTransport} className="space-y-4">
                            <TransportForm item={editingTransport} onChange={setEditingTransport} />
                            <div className="flex gap-3 pt-4 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                                <button type="button" onClick={() => setIsEditTransportOpen(false)}
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
            )}
        </div>
    );
}

function TransportForm({ item, onChange }: { item: any; onChange: (v: any) => void }) {
    return (
        <>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={lbl}>Nomi *</label>
                    <input required type="text" placeholder="Avtobus #1" className={inp} value={item.name || ''} onChange={e => onChange({ ...item, name: e.target.value })} />
                </div>
                <div>
                    <label className={lbl}>Davlat raqami</label>
                    <input type="text" placeholder="01 A 123 BC" className={inp} value={item.number || ''} onChange={e => onChange({ ...item, number: e.target.value })} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={lbl}>Modeli</label>
                    <input type="text" placeholder="Mercedes Sprinter" className={inp} value={item.model || ''} onChange={e => onChange({ ...item, model: e.target.value })} />
                </div>
                <div>
                    <label className={lbl}>Sig'imi (kishi)</label>
                    <input type="number" placeholder="15" className={inp} value={item.capacity || ''} onChange={e => onChange({ ...item, capacity: e.target.value })} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={lbl}>Haydovchi ismi</label>
                    <input type="text" className={inp} value={item.driverName || ''} onChange={e => onChange({ ...item, driverName: e.target.value })} />
                </div>
                <div>
                    <label className={lbl}>Haydovchi teli</label>
                    <input type="text" placeholder="+998" className={inp} value={item.driverPhone || ''} onChange={e => onChange({ ...item, driverPhone: e.target.value })} />
                </div>
            </div>
            <div>
                <label className={lbl}>Holati</label>
                <select className={inp} value={item.status || 'Faol'} onChange={e => onChange({ ...item, status: e.target.value })}>
                    <option value="Faol">Faol</option>
                    <option value="Ta'mirda">Ta'mirda</option>
                    <option value="Arxiv">Arxiv</option>
                </select>
            </div>
        </>
    );
}

function ListSection({ title, subtitle, icon, onAdd, items, emptyText, renderItem }: {
    title: string; subtitle: string; icon: React.ReactNode; onAdd: () => void;
    items: any[]; emptyText: string; renderItem: (item: any) => React.ReactNode;
}) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">{title}</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{subtitle}</p>
                </div>
                <button onClick={onAdd}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                    <Plus size={14} />Qo'shish
                </button>
            </div>
            {items.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700/50 rounded-2xl flex items-center justify-center mb-3 text-gray-400">{icon}</div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{emptyText}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {items.map((item, idx) => (
                        <div key={item.id} className="animate-in fade-in duration-300">
                            {renderItem(item)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ItemCard({ icon, iconBg, title, subtitle, onDelete }: {
    icon: React.ReactNode; iconBg: string; title: string; subtitle: string; onDelete: () => void;
}) {
    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 flex flex-col gap-4 group hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${iconBg}`}>{icon}</div>
                <button onClick={onDelete}
                    className="w-7 h-7 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center justify-center transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                    <Trash2 size={13} />
                </button>
            </div>
            <div>
                <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">{title}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{subtitle}</p>
            </div>
        </div>
    );
}
