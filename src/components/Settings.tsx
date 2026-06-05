import React, { useState, useRef } from 'react';
import {
    Building2, Plus, ChevronDown, ChevronRight, ShieldCheck, Trash2, Save, X,
    Layout, MapPin, Bus, BookOpen, DoorOpen, Globe, Phone, Clock, Camera,
    Instagram, Send, Shield, ToggleLeft, ToggleRight, Pencil
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';

type SectionId = 'profil' | 'ijtimoiy' | 'kurslar' | 'xonalar' | 'transport' | 'filiallar' | 'ruxsatlar';

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

const inputCls = "w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-[1.25rem] text-xs font-bold tracking-wide focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all text-white placeholder:text-[#4a5568] shadow-inner";
const labelCls = "text-[10px] font-bold text-[#4a5568] uppercase tracking-widest ml-1";

export default function Settings() {
    const { settings, updateSettings, courses, rooms, schools, transports,
        addCourse, deleteCourse, addRoom, deleteRoom, addSchool, deleteSchool,
        addTransport, updateTransport, deleteTransport, selectedSchoolId } = useCRM();
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
        ...(isAdmin ? [{
            id: 'ceo', label: 'CEO', icon: <ShieldCheck size={16} />,
            items: [
                { id: 'filiallar' as SectionId, label: 'Filiallar', icon: <Building2 size={14} />, count: schools?.length },
                { id: 'ruxsatlar' as SectionId, label: 'Ruxsatlar', icon: <Shield size={14} /> },
            ]
        }] : []),
    ];

    const renderContent = () => {
        // PROFIL
        if (activeSection === 'profil') return (
            <form onSubmit={handleSaveProfile} className="space-y-8">
                <div>
                    <h2 className="text-xl font-extrabold text-white uppercase tracking-tight">Tashkilot Profili</h2>
                    <p className={labelCls + " mt-1"}>Markaz haqida asosiy ma'lumotlar</p>
                </div>
                <div className="flex items-center gap-8">
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-3xl bg-white/5 border-2 border-white/10 overflow-hidden flex items-center justify-center">
                            {profileForm?.logo
                                ? <img src={profileForm.logo} className="w-full h-full object-cover" alt="logo" />
                                : <Building2 size={32} className="text-[#4a5568]" />
                            }
                        </div>
                        <button type="button" onClick={() => logoInputRef.current?.click()}
                            className="absolute -bottom-2 -right-2 w-8 h-8 bg-teal-600 hover:bg-teal-500 rounded-xl flex items-center justify-center transition-all shadow-lg">
                            <Camera size={14} className="text-white" />
                        </button>
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                    </div>
                    <div>
                        <p className="text-sm font-extrabold text-white">{profileForm?.orgName || 'Markaz nomi'}</p>
                        <p className={labelCls + " mt-1"}>Logo yuklash uchun kameraga bosing</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className={labelCls}>Markaz Nomi <span className="text-rose-500">*</span></label>
                        <input type="text" className={inputCls} value={profileForm?.orgName || ''} onChange={e => setProfileForm(p => ({ ...p, orgName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <label className={labelCls}><Phone size={10} className="inline mr-1" />Telefon</label>
                        <input type="text" placeholder="+998 90 000 00 00" className={inputCls} value={profileForm?.adminPhone || ''} onChange={e => setProfileForm(p => ({ ...p, adminPhone: e.target.value }))} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <label className={labelCls}><MapPin size={10} className="inline mr-1" />Manzil</label>
                        <input type="text" className={inputCls} value={profileForm?.address || ''} onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <label className={labelCls}><Clock size={10} className="inline mr-1" />Ish Soatlari</label>
                        <input type="text" placeholder="09:00 - 21:00" className={inputCls} value={profileForm?.workingHours || ''} onChange={e => setProfileForm(p => ({ ...p, workingHours: e.target.value }))} />
                    </div>
                </div>
                <div className="flex justify-end pt-2">
                    <button type="submit" disabled={isSaving}
                        className="px-8 py-3.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-95">
                        <Save size={16} />{isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
                    </button>
                </div>
            </form>
        );

        // IJTIMOIY
        if (activeSection === 'ijtimoiy') return (
            <form onSubmit={handleSaveProfile} className="space-y-8">
                <div>
                    <h2 className="text-xl font-extrabold text-white uppercase tracking-tight">Ijtimoiy Tarmoqlar</h2>
                    <p className={labelCls + " mt-1"}>Markaz sahifalariga havolalar</p>
                </div>
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className={labelCls}><Send size={10} className="inline mr-1" />Telegram</label>
                        <input type="text" placeholder="@markaz_nomi" className={inputCls} value={profileForm?.telegram || ''} onChange={e => setProfileForm(p => ({ ...p, telegram: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                        <label className={labelCls}><Instagram size={10} className="inline mr-1" />Instagram</label>
                        <input type="text" placeholder="@markaz_nomi" className={inputCls} value={profileForm?.instagram || ''} onChange={e => setProfileForm(p => ({ ...p, instagram: e.target.value }))} />
                    </div>
                </div>
                <div className="flex justify-end pt-2">
                    <button type="submit" disabled={isSaving}
                        className="px-8 py-3.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-95">
                        <Save size={16} />{isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
                    </button>
                </div>
            </form>
        );

        // KURSLAR
        if (activeSection === 'kurslar') return (
            <ListSection
                title="Kurslar" subtitle="O'quv markazidagi barcha kurslar"
                icon={<BookOpen size={18} />} onAdd={() => { setNewItem({}); setIsAddModalOpen(true); }}
                items={courses || []} emptyText="Hech qanday kurs topilmadi"
                renderItem={(item: any) => (
                    <ItemCard key={item.id} icon={<Layout size={18} />} iconBg="bg-sky-900/30 border-sky-800/50 text-sky-400"
                        title={item.name} subtitle={`${(item.price || 0).toLocaleString()} UZS`}
                        onDelete={() => deleteCourse(item.id)} />
                )}
            />
        );

        // XONALAR
        if (activeSection === 'xonalar') return (
            <ListSection
                title="Dars Xonalari" subtitle="Markazdagi barcha xonalar"
                icon={<DoorOpen size={18} />} onAdd={() => { setNewItem({}); setIsAddModalOpen(true); }}
                items={rooms || []} emptyText="Hech qanday xona topilmadi"
                renderItem={(item: any) => (
                    <ItemCard key={item.id} icon={<DoorOpen size={18} />} iconBg="bg-violet-900/30 border-violet-800/50 text-violet-400"
                        title={item.name} subtitle={`${item.capacity} kishilik`}
                        onDelete={() => deleteRoom(item.id)} />
                )}
            />
        );

        // TRANSPORT
        if (activeSection === 'transport') return (
            <ListSection
                title="Transport" subtitle="Logistika uchun transport vositalari"
                icon={<Bus size={18} />} onAdd={() => { setNewItem({}); setIsAddModalOpen(true); }}
                items={transports || []} emptyText="Transport vositalari topilmadi"
                renderItem={(item: any) => {
                    const statusCls = item.status === 'Faol'
                        ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50'
                        : item.status === "Ta'mirda"
                        ? 'bg-amber-900/30 text-amber-400 border-amber-800/50'
                        : 'bg-gray-800/50 text-gray-400 border-gray-700/50';
                    return (
                        <div key={item.id} className="bg-[#141c27] border border-white/5 rounded-[2rem] p-6 flex flex-col gap-4 group hover:border-sky-500/30 transition-all animate-in zoom-in-95 duration-300">
                            <div className="flex items-start justify-between">
                                <div className="w-12 h-12 rounded-2xl bg-sky-900/30 border border-sky-800/50 flex items-center justify-center text-sky-400">
                                    <Bus size={20} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2.5 py-1 rounded-xl text-[9px] font-extrabold border uppercase tracking-widest ${statusCls}`}>
                                        {item.status}
                                    </span>
                                    <button onClick={() => { setEditingTransport({ ...item }); setIsEditTransportOpen(true); }}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl text-[#4a5568] hover:text-sky-400 hover:bg-sky-900/20 transition-all border border-transparent hover:border-sky-800/50">
                                        <Pencil size={14} />
                                    </button>
                                    <button onClick={() => deleteTransport(item.id)}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl text-[#4a5568] hover:text-rose-400 hover:bg-rose-900/20 transition-all border border-transparent hover:border-rose-800/50">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-extrabold text-white uppercase tracking-tight">{item.name}</p>
                                <p className="text-[10px] font-bold text-[#4a5568] uppercase tracking-widest mt-1">{item.model} {item.number ? `· ${item.number}` : ''}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                                <div>
                                    <p className={labelCls}>Sig'imi</p>
                                    <p className="text-xs font-extrabold text-white mt-0.5">{item.capacity} kishi</p>
                                </div>
                                <div>
                                    <p className={labelCls}>Haydovchi</p>
                                    <p className="text-xs font-extrabold text-white mt-0.5 truncate">{item.driverName || '—'}</p>
                                </div>
                            </div>
                        </div>
                    );
                }}
            />
        );

        // FILIALLAR
        if (activeSection === 'filiallar') return (
            <ListSection
                title="Filiallar" subtitle="O'quv markazi filiallari"
                icon={<Building2 size={18} />} onAdd={() => { setNewItem({}); setIsAddModalOpen(true); }}
                items={schools || []} emptyText="Hech qanday filial topilmadi"
                renderItem={(item: any) => (
                    <ItemCard key={item.id} icon={<Building2 size={18} />} iconBg="bg-teal-900/30 border-teal-800/50 text-teal-400"
                        title={item.name} subtitle={item.address || 'Manzil kiritilmagan'}
                        onDelete={() => deleteSchool(item.id)} />
                )}
            />
        );

        // RUXSATLAR
        if (activeSection === 'ruxsatlar') return (
            <div className="space-y-8">
                <div>
                    <h2 className="text-xl font-extrabold text-white uppercase tracking-tight">Foydalanuvchi Ruxsatlari</h2>
                    <p className={labelCls + " mt-1"}>Har bir lavozim uchun modul ruxsatlarini boshqaring</p>
                </div>
                <div className="bg-[#0f1923] rounded-[2rem] border border-white/5 overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full min-w-[600px]">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="p-5 text-left text-[10px] font-bold text-[#4a5568] uppercase tracking-widest min-w-[150px]">Modul</th>
                                    {Object.keys(permissions).map(role => (
                                        <th key={role} className="p-5 text-center text-[10px] font-bold text-[#4a5568] uppercase tracking-widest">
                                            {ROLE_LABELS[role] || role}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {MODULES.map(mod => (
                                    <tr key={mod.key} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-5 text-xs font-extrabold text-white uppercase tracking-wide">{mod.label}</td>
                                        {Object.keys(permissions).map(role => {
                                            const on = permissions[role]?.[mod.key] ?? false;
                                            const isLocked = role === 'ADMIN';
                                            return (
                                                <td key={role} className="p-5 text-center">
                                                    <button
                                                        disabled={isLocked}
                                                        onClick={() => setPermissions(p => ({
                                                            ...p,
                                                            [role]: { ...p[role], [mod.key]: !on }
                                                        }))}
                                                        className={`inline-flex items-center justify-center transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                                                    >
                                                        {on
                                                            ? <ToggleRight size={28} className="text-teal-400" />
                                                            : <ToggleLeft size={28} className="text-[#4a5568]" />
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
                <div className="flex justify-end">
                    <button onClick={handleSavePermissions}
                        className={`px-8 py-3.5 rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 ${permSaved ? 'bg-emerald-600 text-white' : 'bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20'}`}>
                        <Save size={16} />{permSaved ? 'Saqlandi!' : 'Saqlash'}
                    </button>
                </div>
            </div>
        );

        return null;
    };

    const addModalTitle = activeSection === 'kurslar' ? 'Yangi Kurs' : activeSection === 'xonalar' ? 'Yangi Xona' : activeSection === 'filiallar' ? 'Yangi Filial' : 'Yangi Transport';

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-700">
            <div>
                <h1 className="text-3xl font-extrabold text-white uppercase tracking-tight">Tizim Sozlamalari</h1>
                <p className="text-[10px] font-bold text-[#4a5568] mt-2 uppercase tracking-widest">Markaz profili, ofis resurslari va ruxsatlar</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                {/* Sidebar */}
                <div className="lg:col-span-1 bg-[#141c27] rounded-[2.5rem] border border-white/5 overflow-hidden">
                    <div className="p-3 space-y-1">
                        {menuGroups.map(group => (
                            <div key={group.id}>
                                <button onClick={() => toggle(group.id)}
                                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-[#4a5568] hover:text-white hover:bg-white/5 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[#4a5568] group-hover:text-teal-400 transition-colors">{group.icon}</span>
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest">{group.label}</span>
                                    </div>
                                    {openGroups[group.id]
                                        ? <ChevronDown size={14} className="text-[#4a5568]" />
                                        : <ChevronRight size={14} className="text-[#4a5568]" />
                                    }
                                </button>
                                {openGroups[group.id] && (
                                    <div className="ml-3 pl-4 border-l border-white/5 space-y-0.5 mt-1 mb-2">
                                        {group.items.map(item => (
                                            <button key={item.id} onClick={() => setActiveSection(item.id)}
                                                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all text-left ${activeSection === item.id ? 'bg-teal-600/20 text-teal-400 border border-teal-600/30' : 'text-[#8b9ab2] hover:text-white hover:bg-white/5'}`}>
                                                <div className="flex items-center gap-2.5">
                                                    {item.icon}
                                                    <span className="text-[10px] font-extrabold uppercase tracking-widest">{item.label}</span>
                                                </div>
                                                {'count' in item && item.count !== undefined && (
                                                    <span className="text-[9px] font-extrabold bg-white/10 px-2 py-0.5 rounded-lg">{item.count}</span>
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
                <div className="lg:col-span-3 bg-[#141c27] rounded-[2.5rem] border border-white/5 p-8 min-h-[500px]">
                    {renderContent()}
                </div>
            </div>

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-[#1a2332] w-full max-w-md rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}>
                        <div className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                            <div>
                                <h2 className="text-lg font-extrabold text-white uppercase tracking-tight">{addModalTitle}</h2>
                                <p className={labelCls + " mt-1"}>Yangi ma'lumot kiritish</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-2xl text-[#4a5568] hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/10">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddItem} className="p-8 space-y-5">
                            {activeSection !== 'transport' && (
                                <div className="space-y-2">
                                    <label className={labelCls}>Nomi <span className="text-rose-500">*</span></label>
                                    <input required type="text" className={inputCls} value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                                </div>
                            )}
                            {activeSection === 'kurslar' && (
                                <div className="space-y-2">
                                    <label className={labelCls}>Narxi (UZS) <span className="text-rose-500">*</span></label>
                                    <input required type="number" className={inputCls} value={newItem.price || ''} onChange={e => setNewItem({ ...newItem, price: e.target.value })} />
                                </div>
                            )}
                            {activeSection === 'xonalar' && (
                                <div className="space-y-2">
                                    <label className={labelCls}>Sig'imi (kishi) <span className="text-rose-500">*</span></label>
                                    <input required type="number" className={inputCls} value={newItem.capacity || ''} onChange={e => setNewItem({ ...newItem, capacity: e.target.value })} />
                                </div>
                            )}
                            {activeSection === 'filiallar' && (
                                <div className="space-y-2">
                                    <label className={labelCls}>Manzil</label>
                                    <input type="text" className={inputCls} value={newItem.address || ''} onChange={e => setNewItem({ ...newItem, address: e.target.value })} />
                                </div>
                            )}
                            {activeSection === 'transport' && (
                                <TransportForm item={newItem} onChange={setNewItem} />
                            )}
                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setIsAddModalOpen(false)}
                                    className="px-6 py-3 bg-white/5 border border-white/10 text-[#8b9ab2] rounded-2xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-white/10 transition-all">
                                    Bekor
                                </button>
                                <button type="submit"
                                    className="px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 transition-all">
                                    <Save size={16} />Saqlash
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Transport Modal */}
            {isEditTransportOpen && editingTransport && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setIsEditTransportOpen(false)}>
                    <div className="bg-[#1a2332] w-full max-w-md rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}>
                        <div className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                            <div>
                                <h2 className="text-lg font-extrabold text-white uppercase tracking-tight">Transportni Tahrirlash</h2>
                                <p className={labelCls + " mt-1"}>Ma'lumotlarni yangilash</p>
                            </div>
                            <button onClick={() => setIsEditTransportOpen(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-2xl text-[#4a5568] hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/10">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveTransport} className="p-8 space-y-5">
                            <TransportForm item={editingTransport} onChange={setEditingTransport} />
                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setIsEditTransportOpen(false)}
                                    className="px-6 py-3 bg-white/5 border border-white/10 text-[#8b9ab2] rounded-2xl text-[10px] font-extrabold uppercase tracking-widest hover:bg-white/10 transition-all">
                                    Bekor
                                </button>
                                <button type="submit"
                                    className="px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 transition-all">
                                    <Save size={16} />Saqlash
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
    const labelCls = "text-[10px] font-bold text-[#4a5568] uppercase tracking-widest ml-1";
    const inputCls = "w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-[1.25rem] text-xs font-bold tracking-wide focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all text-white placeholder:text-[#4a5568] shadow-inner";
    return (
        <>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className={labelCls}>Nomi <span className="text-rose-500">*</span></label>
                    <input required type="text" placeholder="Avtobus #1" className={inputCls} value={item.name || ''} onChange={e => onChange({ ...item, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                    <label className={labelCls}>Davlat raqami</label>
                    <input type="text" placeholder="01 A 123 BC" className={inputCls} value={item.number || ''} onChange={e => onChange({ ...item, number: e.target.value })} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className={labelCls}>Modeli</label>
                    <input type="text" placeholder="Mercedes Sprinter" className={inputCls} value={item.model || ''} onChange={e => onChange({ ...item, model: e.target.value })} />
                </div>
                <div className="space-y-2">
                    <label className={labelCls}>Sig'imi (kishi)</label>
                    <input type="number" placeholder="15" className={inputCls} value={item.capacity || ''} onChange={e => onChange({ ...item, capacity: e.target.value })} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className={labelCls}>Haydovchi ismi</label>
                    <input type="text" className={inputCls} value={item.driverName || ''} onChange={e => onChange({ ...item, driverName: e.target.value })} />
                </div>
                <div className="space-y-2">
                    <label className={labelCls}>Haydovchi teli</label>
                    <input type="text" placeholder="+998 90 000 00 00" className={inputCls} value={item.driverPhone || ''} onChange={e => onChange({ ...item, driverPhone: e.target.value })} />
                </div>
            </div>
            <div className="space-y-2">
                <label className={labelCls}>Holati</label>
                <select className={inputCls + " appearance-none cursor-pointer"} value={item.status || 'Faol'} onChange={e => onChange({ ...item, status: e.target.value })}>
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
                    <h2 className="text-xl font-extrabold text-white uppercase tracking-tight">{title}</h2>
                    <p className="text-[10px] font-bold text-[#4a5568] uppercase tracking-widest mt-1">{subtitle}</p>
                </div>
                <button onClick={onAdd}
                    className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-[1.25rem] text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-teal-500/20 active:scale-95 transition-all group">
                    <Plus size={16} className="group-hover:rotate-90 transition-transform" />Qo'shish
                </button>
            </div>
            {items.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4 text-[#1e2d3d]">{icon}</div>
                    <p className="text-[10px] font-bold text-[#4a5568] uppercase tracking-widest">{emptyText}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {items.map((item, idx) => (
                        <div key={item.id} style={{ animationDelay: `${idx * 40}ms` }} className="animate-in zoom-in-95 duration-300">
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
        <div className="bg-[#141c27] border border-white/5 rounded-[2rem] p-6 flex flex-col gap-4 group hover:border-sky-500/30 transition-all">
            <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${iconBg}`}>{icon}</div>
                <button onClick={onDelete}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-[#4a5568] hover:text-rose-400 hover:bg-rose-900/20 transition-all border border-transparent hover:border-rose-800/50 opacity-0 group-hover:opacity-100">
                    <Trash2 size={14} />
                </button>
            </div>
            <div>
                <p className="text-sm font-extrabold text-white uppercase tracking-tight group-hover:text-sky-400 transition-colors">{title}</p>
                <p className="text-[10px] font-bold text-[#4a5568] uppercase tracking-widest mt-1">{subtitle}</p>
            </div>
        </div>
    );
}
