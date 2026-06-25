import React, { useState, useRef } from 'react';
import {
    Building2, Plus, ChevronDown, ChevronRight, ShieldCheck, Trash2, Save, X,
    Layout, MapPin, Bus, BookOpen, DoorOpen, Globe, Phone, Clock, Camera,
    Instagram, Send, Shield, ToggleLeft, ToggleRight, Pencil
} from 'lucide-react';
import { useCRM, THEMES } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';

type SectionId = 'profil' | 'xonalar' | 'filiallar' | 'ruxsatlar' | 'dizayn';

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
    const { settings, updateSettings, rooms, schools,
        addRoom, deleteRoom, addSchool, deleteSchool,
        themeColor, setThemeColor } = useCRM();
    const { user: currentUser, token } = useCRM();
    const { t } = useLang();

    const MODULES = [
        { key: 'dashboard', label: t('nav_dashboard') },
        { key: 'students',  label: t('nav_students') },
        { key: 'teachers',  label: t('teachers_title') },
        { key: 'groups',    label: t('nav_groups') },
        { key: 'finance',   label: t('nav_finance') },
        { key: 'exams',     label: t('nav_exams') },
        { key: 'leads',     label: t('nav_leads') },
        { key: 'hr',        label: t('nav_hr') },
        { key: 'reports',   label: t('nav_reports') },
        { key: 'settings',  label: t('nav_settings') },
    ];

    const [activeSection, setActiveSection] = useState<SectionId>('profil');
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ tashkilot: true, ofis: false, ceo: false });

    const [profileForm, setProfileForm] = useState({ ...settings });
    const [isSaving, setIsSaving] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newItem, setNewItem] = useState<any>({});

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
            if (activeSection === 'xonalar') {
                await addRoom({ ...newItem, capacity: Number(newItem.capacity) });
            } else if (activeSection === 'filiallar') {
                await addSchool(newItem);
            }
            setIsAddModalOpen(false);
            setNewItem({});
        } catch (err: any) {
            console.error('Add failed', err);
        }
    };

    const menuGroups = [
        {
            id: 'tashkilot', label: t('settings_section_org'), icon: <Building2 size={16} />,
            items: [
                { id: 'profil' as SectionId, label: t('settings_profile'), icon: <Globe size={14} /> },
                { id: 'dizayn' as SectionId, label: t('settings_design'), icon: <Layout size={14} /> },
            ]
        },
        {
            id: 'ofis', label: t('settings_section_office'), icon: <DoorOpen size={16} />,
            items: [
                { id: 'xonalar' as SectionId, label: t('settings_rooms'), icon: <DoorOpen size={14} />, count: rooms?.length },
            ]
        },
        ...(isAdminOrManager ? [{
            id: 'ceo', label: t('settings_section_admin'), icon: <ShieldCheck size={16} />,
            items: [
                { id: 'filiallar' as SectionId, label: t('settings_branches'), icon: <Building2 size={14} />, count: schools?.length },
                ...(isAdmin ? [{ id: 'ruxsatlar' as SectionId, label: t('settings_perms'), icon: <Shield size={14} /> }] : []),
            ]
        }] : []),
    ];

    const renderContent = () => {
        if (activeSection === 'profil') return (
            <div className="space-y-8">
                <form onSubmit={handleSaveProfile} className="space-y-6">
                <div>
                    <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">{t('org_profile_title')}</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{t('org_profile_subtitle')}</p>
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
                        <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">{profileForm?.orgName || t('org_name')}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{t('logo_upload_hint')}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={lbl}>{t('org_name_label')}</label>
                        <input type="text" className={inp} value={profileForm?.orgName || ''} onChange={e => setProfileForm(p => ({ ...p, orgName: e.target.value }))} />
                    </div>
                    <div>
                        <label className={lbl}>{t('phone')}</label>
                        <input type="text" placeholder="+998" className={inp} value={profileForm?.adminPhone || ''} onChange={e => setProfileForm(p => ({ ...p, adminPhone: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2">
                        <label className={lbl}>{t('address')}</label>
                        <input type="text" className={inp} value={profileForm?.address || ''} onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))} />
                    </div>
                    <div>
                        <label className={lbl}>{t('work_hours_label')}</label>
                        <input type="text" placeholder="09:00 - 21:00" className={inp} value={profileForm?.workingHours || ''} onChange={e => setProfileForm(p => ({ ...p, workingHours: e.target.value }))} />
                    </div>
                    <div>
                        <label className={lbl}>Telegram Bot Token</label>
                        <input type="text" placeholder="123456789:ABCdefGhI..." className={inp} value={profileForm?.telegram || ''} onChange={e => setProfileForm(p => ({ ...p, telegram: e.target.value }))} />
                    </div>
                    <div>
                        <label className={lbl}>Instagram Profil Linki</label>
                        <input type="text" placeholder="https://instagram.com/..." className={inp} value={profileForm?.instagram || ''} onChange={e => setProfileForm(p => ({ ...p, instagram: e.target.value }))} />
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                    <button type="submit" disabled={isSaving}
                        className="px-6 py-3 bg-[#1b6b6b] hover:bg-[#155252] disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                        <Save size={14} />{isSaving ? t('saving') : t('save')}
                    </button>
                </div>
            </form>

        </div>
    );


        if (activeSection === 'xonalar') return (
            <ListSection
                title={t('rooms_title')} subtitle={t('rooms_subtitle')}
                icon={<DoorOpen size={16} />} onAdd={() => { setNewItem({}); setIsAddModalOpen(true); }}
                items={rooms || []} emptyText={t('no_rooms_found')}
                renderItem={(item: any) => (
                    <ItemCard key={item.id} icon={<DoorOpen size={16} />} iconBg="bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/40"
                        title={item.name} subtitle={t('capacity_persons_unit').replace('{count}', item.capacity)}
                        onDelete={() => deleteRoom(item.id)} />
                )}
            />
        );


        if (activeSection === 'filiallar') return (
            <ListSection
                title={t('settings_branches')} subtitle={t('branches_subtitle')}
                icon={<Building2 size={16} />} onAdd={() => { setNewItem({}); setIsAddModalOpen(true); }}
                items={schools || []} emptyText={t('no_branches_found')}
                renderItem={(item: any) => (
                    <ItemCard key={item.id} icon={<Building2 size={16} />} iconBg="bg-teal-50 text-[#1b6b6b] border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40"
                        title={item.name} subtitle={item.address || t('no_address')}
                        onDelete={() => deleteSchool(item.id)} />
                )}
            />
        );

        if (activeSection === 'ruxsatlar') return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">{t('permissions_title')}</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{t('permissions_subtitle')}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full min-w-[600px] border-collapse text-left">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/20">
                                    <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest min-w-[150px]">{t('module_label')}</th>
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
                        <Save size={14} />{permSaved ? t('saved_success') : t('save')}
                    </button>
                </div>
            </div>
        );

        if (activeSection === 'dizayn') return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                    <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">{t('design_palette_title')}</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{t('design_palette_subtitle')}</p>
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

    const addModalTitle = activeSection === 'xonalar' ? t('add_room') : t('add_branch');

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
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('settings_title')}</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                {t('settings_subtitle')}
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
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">{t('add_data_subtitle')}</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleAddItem} className="space-y-4">
                            <div>
                                <label className={lbl}>{t('item_name_label')}</label>
                                <input required type="text" className={inp} value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                            </div>
                            {activeSection === 'xonalar' && (
                                <div>
                                    <label className={lbl}>{t('capacity_persons_label')}</label>
                                    <input required type="number" className={inp} value={newItem.capacity || ''} onChange={e => setNewItem({ ...newItem, capacity: e.target.value })} />
                                </div>
                            )}
                            {activeSection === 'filiallar' && (
                                <div>
                                    <label className={lbl}>{t('address')}</label>
                                    <input type="text" className={inp} value={newItem.address || ''} onChange={e => setNewItem({ ...newItem, address: e.target.value })} />
                                </div>
                            )}
                            <div className="flex gap-3 pt-4 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                                <button type="button" onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600">
                                    {t('cancel')}
                                </button>
                                <button type="submit"
                                    className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer">
                                    {t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
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
