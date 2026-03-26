import React, { useState } from 'react';
import {
    Building2, Plus, ChevronDown, User, ShieldCheck, Trash2, Save, X, Layout, MapPin
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';

export default function Settings() {
    const { settings, updateSettings, courses, rooms, schools, addCourse, deleteCourse, addRoom, deleteRoom, addSchool, deleteSchool, selectedSchoolId } = useCRM();
    const [activeTab, setActiveTab] = useState('ofis');
    const [activeSubTab, setActiveSubTab] = useState('Kurslar');
    const [settingsForm, setSettingsForm] = useState(settings);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [newItem, setNewItem] = useState<any>({});
    const [editingItem, setEditingItem] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const { user: currentUser, token } = useCRM();

    const subTabLabels: Record<string, string> = {
        'Kurslar': 'Kurslar Ro\'yxati',
        'Xonalar': 'Dars Xonalari',
        'Umumiy sozlamalar': 'Tizim Ma\'lumotlari',
        'Filiallar': 'O\'quv Markazi Filiallari'
    };

    React.useEffect(() => {
        setSettingsForm(settings);
    }, [settings]);

    const menuItems = [
        { id: 'ofis', label: 'Ofis', icon: <Building2 className="w-4 h-4" />, hasSub: true, subItems: ['Kurslar', 'Xonalar'] },
        { id: 'staff', label: 'Xodimlar', icon: <User className="w-4 h-4" />, hasSub: false },
        ...(currentUser?.role === 'ADMIN' ? [{ id: 'ceo', label: 'CEO', icon: <ShieldCheck className="w-4 h-4" />, hasSub: true, subItems: ['Umumiy sozlamalar', 'Filiallar'] }] : []),
    ];

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setUsers(await res.json());
        } catch (err) {
            console.error("Failed to fetch users", err);
            alert("Xodimlarni yuklashda xatolik yuz berdi!"); // Added alert here
        }
    };

    React.useEffect(() => {
        if ((activeTab === 'staff' || activeSubTab === 'Xodimlar') && (currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER')) {
            fetchUsers();
        }
    }, [activeTab, activeSubTab, currentUser]);

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateSettings(settingsForm);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddItem = async () => {
        if (!newItem.name && activeTab !== 'staff' && activeSubTab !== 'Xodimlar') return;

        try {
            if (activeSubTab === 'Umumiy sozlamalar') {
                await updateSettings(newItem);
            } else if (activeSubTab === 'Kurslar') {
                await addCourse({ ...newItem, price: Number(newItem.price) });
            } else if (activeSubTab === 'Xonalar') {
                await addRoom({ ...newItem, capacity: Number(newItem.capacity) });
            } else if (activeSubTab === 'Filiallar') {
                await addSchool(newItem);
            } else if (activeTab === 'staff' || activeSubTab === 'Xodimlar') {
                const userToAdd = {
                    email: newItem.email,
                    password: newItem.password || 'admin123',
                    name: newItem.name,
                    phone: newItem.phone,
                    role: newItem.role || 'RECEPTIONIST',
                    schoolId: currentUser?.role === 'MANAGER' ? currentUser.schoolId : selectedSchoolId
                };
                const res = await fetch('/api/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(userToAdd)
                });
                if (res.ok) {
                    alert("Xodim muvaffaqiyatli qo'shildi!");
                    fetchUsers();
                } else {
                    const errData = await res.json();
                    alert(`Xatolik: ${errData.error || res.statusText}`);
                }
            }
            setIsAddModalOpen(false);
            setNewItem({});
        } catch (err: any) {
            console.error("Failed to add item", err);
            alert("Ma'lumot qo'shishda xatolik yuz berdi: " + err.message);
        }
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        handleAddItem();
    };

    const renderList = () => {
        let items: any[] = [];
        if (activeSubTab === 'Kurslar') items = courses || [];
        else if (activeSubTab === 'Xonalar') items = rooms || [];
        else if (activeSubTab === 'Filiallar') items = schools || [];
        else if (activeTab === 'staff') items = users || [];

        if (items.length === 0) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                        <Building2 className="w-10 h-10 text-gray-300" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">Ma'lumotlar topilmadi</h4>
                    <p className="text-sm font-medium text-gray-500 max-w-sm">
                        Ushbu bo'lim hozircha bo'sh. "Yangi qo'shish" tugmasi orqali ma'lumotlarni kiritishingiz mumkin.
                    </p>
                </div>
            );
        }

        return (
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {items.map((item, idx) => (
                    <div key={item.id} 
                        onClick={() => {
                            if (activeTab === 'staff') {
                                setEditingItem(item);
                                setIsEditModalOpen(true);
                            }
                        }}
                        className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 rounded-[2rem] flex flex-col gap-5 group hover:border-sky-300 dark:hover:border-sky-600 transition-all shadow-xl shadow-gray-200/10 dark:shadow-none hover:shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 ${activeTab === 'staff' ? 'cursor-pointer' : ''}`}
                        style={{ animationDelay: `${idx * 40}ms` }}
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/[0.03] rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 group-hover:text-white transition-all shadow-inner">
                                {activeSubTab === 'Kurslar' ? <Layout className="w-5 h-5" /> : (activeTab === 'staff' || activeSubTab === 'Xodimlar') ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                            </div>
                            {((activeTab !== 'staff' && activeSubTab !== 'Xodimlar') || (activeTab === 'staff' && currentUser?.role === 'ADMIN')) && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (activeSubTab === 'Kurslar') deleteCourse(item.id);
                                        else if (activeSubTab === 'Xonalar') deleteRoom(item.id);
                                        else if (activeSubTab === 'Filiallar') deleteSchool(item.id);
                                        else if (activeTab === 'staff') {
                                            if (window.confirm("Haqiqatan ham bu xodimni o'chirmoqchimisiz?")) {
                                                fetch(`/api/users/${item.id}`, {
                                                    method: 'DELETE',
                                                    headers: { 'Authorization': `Bearer ${token}` }
                                                }).then(res => { if (res.ok) fetchUsers(); });
                                            }
                                        }
                                    }}
                                    className="p-3 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-rose-100 dark:hover:border-rose-800/50 shadow-sm"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-base font-extrabold text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-sky-600 transition-colors">{item.name}</h4>
                            <p className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-loose">
                                {activeSubTab === 'Kurslar' ? `${item.price.toLocaleString()} UZS` :
                                    activeSubTab === 'Xonalar' ? `${item.capacity} kishilik` :
                                        (activeTab === 'staff' || activeSubTab === 'Xodimlar') ? `${item.role === 'ADMIN' ? 'Admin' : item.role === 'MANAGER' ? 'Menejer' : item.role === 'TEACHER' ? 'O\'qituvchi' : item.role === 'DRIVER' ? 'Haydovchi' : 'Receptionist'} • ${item.email}` :
                                            item.address}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderContent = () => {
        if (activeTab === 'ceo' && currentUser?.role !== 'ADMIN') return null;

        if (activeTab === 'ofis' || activeTab === 'ceo' || activeTab === 'staff') {
            if (activeSubTab === 'Umumiy sozlamalar') {
                return (
                    <form onSubmit={handleSaveSettings} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white dark:bg-gray-800 p-10 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/10 dark:shadow-none">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-8 uppercase tracking-tight flex items-center gap-3">
                                <Building2 className="text-sky-500" />
                                Asosiy Ma'lumotlar
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Tashkilot Nomi <span className="text-rose-500">*</span></label>
                                    <input required type="text" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={settingsForm.orgName} onChange={e => setSettingsForm({ ...settingsForm, orgName: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Asosiy Manzil</label>
                                    <input type="text" placeholder="Shahar, Ko'cha, Uy" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={settingsForm.address || ''} onChange={e => setSettingsForm({ ...settingsForm, address: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Admin Telefon Raqami <span className="text-rose-500">*</span></label>
                                    <input required type="text" placeholder="+998 90 123 45 67" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={settingsForm.adminPhone || ''} onChange={e => setSettingsForm({ ...settingsForm, adminPhone: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ish Vaqti</label>
                                    <input type="text" placeholder="Du-Shanba 09:00 - 18:00" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={settingsForm.workingHours || ''} onChange={e => setSettingsForm({ ...settingsForm, workingHours: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Telegram Manzili</label>
                                    <input type="text" placeholder="https://t.me/username" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={settingsForm.telegram || ''} onChange={e => setSettingsForm({ ...settingsForm, telegram: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Instagram Manzili</label>
                                    <input type="text" placeholder="https://instagram.com/username" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={settingsForm.instagram || ''} onChange={e => setSettingsForm({ ...settingsForm, instagram: e.target.value })} />
                                </div>
                            </div>
                            <div className="mt-12 flex justify-end">
                                <button type="submit" disabled={isSaving} className="bg-sky-600 dark:bg-sky-500 hover:bg-sky-500 dark:hover:bg-sky-400 disabled:opacity-70 text-white px-10 py-4 rounded-[1.25rem] font-bold uppercase tracking-widest shadow-xl shadow-sky-500/20 active:scale-95 transition-all text-[10px] flex items-center gap-3">
                                    {isSaving ? 'Saqlanmoqda...' : 'Saqlash'}
                                    <Save size={18} />
                                </button>
                            </div>
                        </div>
                    </form>
                );
            }

            return (
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl shadow-gray-200/10 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden min-h-[550px] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="px-10 py-8 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div>
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">{subTabLabels[activeSubTab] || (activeTab === 'staff' ? 'Xodimlar Boshqaruvi' : activeTab)}</h3>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Markazdagi barcha {activeSubTab || (activeTab === 'staff' ? 'xodimlar' : 'ma\'lumotlar')} ro'yxati</p>
                        </div>
                        <button onClick={() => {
                            setNewItem({});
                            setIsAddModalOpen(true);
                        }} className="flex items-center gap-3 bg-sky-600 dark:bg-sky-500 text-white px-8 py-3.5 rounded-[1.25rem] font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-sky-500/20 hover:bg-sky-500 transition-all active:scale-95 whitespace-nowrap">
                            <Plus size={18} />
                            Yangi qo'shish
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {renderList()}
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="space-y-8 py-4 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">Tizim Sozlamalari</h1>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest">Markaz qoidalari, filiallar va xodimlar ma'lumotlari</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                {/* Left Sidebar Menu */}
                <div className="lg:col-span-1 border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-[2.5rem] overflow-hidden shadow-xl shadow-gray-200/10 dark:shadow-none">
                    <div className="flex flex-col">
                        {menuItems.map(item => (
                            <div key={item.id} className="flex flex-col">
                                <button
                                    onClick={() => {
                                        setActiveTab(item.id);
                                        if (item.hasSub && item.subItems) {
                                            setActiveSubTab(item.subItems[0]);
                                        } else {
                                            setActiveSubTab('');
                                        }
                                    }}
                                    className={`flex items-center justify-between px-8 py-6 transition-all group border-l-4 ${activeTab === item.id
                                        ? 'bg-sky-50 dark:bg-sky-900/10 border-sky-600'
                                        : 'bg-white dark:bg-gray-800 border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`${activeTab === item.id ? 'text-sky-600' : 'text-gray-400 group-hover:text-sky-500'} transition-colors w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 shadow-sm group-hover:scale-110 duration-300`}>
                                            {item.icon}
                                        </div>
                                        <span className={`text-[11px] font-extrabold uppercase tracking-widest transition-colors ${activeTab === item.id ? 'text-sky-700 dark:text-sky-400' : 'text-gray-500 group-hover:text-gray-900 dark:group-hover:text-white'}`}>{item.label}</span>
                                    </div>
                                    {item.hasSub && <ChevronDown size={18} className={`transition-all duration-300 ${activeTab === item.id ? 'rotate-180 text-sky-600' : 'text-gray-300 group-hover:text-gray-500'}`} />}
                                </button>

                                {
                                    item.hasSub && activeTab === item.id && (
                                        <div className="flex flex-col pl-[72px] pb-5 pt-1 space-y-1 bg-sky-50/30 dark:bg-sky-900/5 border-b border-gray-50 dark:border-gray-700">
                                            {item.subItems?.map(subItem => (
                                                <button
                                                    key={subItem}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveSubTab(subItem);
                                                    }}
                                                    className={`py-3 text-left text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === subItem ? 'text-sky-700 dark:text-sky-400 border-l-2 border-sky-600 pl-4 -ml-2' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white pl-4'}`}
                                                >
                                                    {subItem}
                                                </button>
                                            ))}
                                        </div>
                                    )
                                }
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-3">
                    {renderContent()}
                </div>
            </div>

            {/* Global Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="px-10 py-8 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                                    Yangi {activeTab === 'staff' ? 'Xodim' : activeSubTab === 'Filiallar' ? 'Filial' : activeSubTab.length > 0 ? activeSubTab.slice(0, -2) : 'Ma\'lumot'} qo'shish
                                </h2>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-widest">Tizimga yangi ma'lumot kiritish</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAdd} className="p-10 space-y-8">
                            {activeTab !== 'staff' && (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Nomi <span className="text-rose-500">*</span></label>
                                    <input required type="text" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                                </div>
                            )}

                            {activeSubTab === 'Kurslar' && (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Narxi (UZS) <span className="text-rose-500">*</span></label>
                                    <input required type="number" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={newItem.price || ''} onChange={e => setNewItem({ ...newItem, price: e.target.value })} />
                                </div>
                            )}

                            {activeSubTab === 'Xonalar' && (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Sig'imi (Kishi) <span className="text-rose-500">*</span></label>
                                    <input required type="number" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={newItem.capacity || ''} onChange={e => setNewItem({ ...newItem, capacity: e.target.value })} />
                                </div>
                            )}

                            {activeSubTab === 'Filiallar' && (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Filial Manzili <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input required type="text" className="w-full pl-12 pr-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                            value={newItem.address || ''} onChange={e => setNewItem({ ...newItem, address: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'staff' && (
                                <>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ismi (F.I.SH) <span className="text-rose-500">*</span></label>
                                        <input required type="text" placeholder="Ism Familiya" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                            value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Vazifasi <span className="text-rose-500">*</span></label>
                                            <div className="relative">
                                                <select required className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none appearance-none cursor-pointer text-gray-900 dark:text-white shadow-inner"
                                                    value={newItem.role || 'RECEPTIONIST'} onChange={e => setNewItem({ ...newItem, role: e.target.value })}>
                                                    <option value="RECEPTIONIST">Receptionist</option>
                                                    <option value="TEACHER">O'qituvchi</option>
                                                    <option value="DRIVER">Haydovchi</option>
                                                    {currentUser?.role === 'ADMIN' && <option value="MANAGER">Menejer</option>}
                                                    {currentUser?.role === 'ADMIN' && <option value="ADMIN">Administrator</option>}
                                                </select>
                                                <ChevronDown size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Telefon raqami</label>
                                            <input type="text" placeholder="+998 90 123 45 67" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                                value={newItem.phone || ''} onChange={e => setNewItem({ ...newItem, phone: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Login <span className="text-rose-500">*</span></label>
                                            <input required type="text" placeholder="pochta@misol.uz" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white lowercase shadow-inner"
                                                value={newItem.email || ''} onChange={e => setNewItem({ ...newItem, email: e.target.value })} />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Parol <span className="text-rose-500">*</span></label>
                                            <input required type="password" placeholder="Kamida 6 belgi" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                                value={newItem.password || ''} onChange={e => setNewItem({ ...newItem, password: e.target.value })} />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="pt-10 mt-6 border-t border-dashed border-gray-100 dark:border-gray-700 flex justify-end gap-5">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                                    Bekor Qilish
                                </button>
                                <button type="submit" className="px-10 py-4 bg-sky-600 dark:bg-sky-500 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-sky-500 dark:hover:bg-sky-400 active:scale-[0.98] transition-all shadow-xl shadow-sky-500/20 flex flex-row items-center gap-3">
                                    Saqlash
                                    <Save size={18} />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Global Edit Modal (Staff Only for now) */}
            {isEditModalOpen && editingItem && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsEditModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="px-10 py-8 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Xodimni Tahrirlash</h2>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-widest">Ma'lumotlarni yangilash</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                const res = await fetch(`/api/users/${editingItem.id}`, {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify(editingItem)
                                });
                                if (res.ok) {
                                    alert("Muvaffaqiyatli saqlandi!");
                                    fetchUsers();
                                    setIsEditModalOpen(false);
                                } else {
                                    const errData = await res.json();
                                    alert(`Xatolik: ${errData.error || res.statusText}`);
                                }
                            } catch (err) {
                                console.error("Edit failed", err);
                                alert("Tahrirlashda xatolik yuz berdi!");
                            }
                        }} className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Ismi (F.I.SH) <span className="text-rose-500">*</span></label>
                                <input required type="text" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                    value={editingItem.name || ''} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Vazifasi <span className="text-rose-500">*</span></label>
                                    <div className="relative">
                                        <select required className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none appearance-none cursor-pointer text-gray-900 dark:text-white shadow-inner"
                                            value={editingItem.role || 'RECEPTIONIST'} onChange={e => setEditingItem({ ...editingItem, role: e.target.value })}>
                                            <option value="RECEPTIONIST">Receptionist</option>
                                            <option value="TEACHER">O'qituvchi</option>
                                            <option value="DRIVER">Haydovchi</option>
                                            <option value="MANAGER">Menejer</option>
                                            <option value="ADMIN">Administrator</option>
                                        </select>
                                        <ChevronDown size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Telefon raqami</label>
                                    <input type="text" placeholder="+998 90 123 45 67" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={editingItem.phone || ''} onChange={e => setEditingItem({ ...editingItem, phone: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Login <span className="text-rose-500">*</span></label>
                                    <input required type="text" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={editingItem.email || ''} onChange={e => setEditingItem({ ...editingItem, email: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Yangi Parol (Ixtiyoriy)</label>
                                    <input type="password" placeholder="O'zgartirish uchun yozing" className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[1.25rem] text-xs font-bold uppercase tracking-widest focus:bg-white dark:focus:bg-gray-800 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-gray-900 dark:text-white shadow-inner"
                                        value={editingItem.password || ''} onChange={e => setEditingItem({ ...editingItem, password: e.target.value })} />
                                </div>
                            </div>

                            <div className="pt-10 mt-6 border-t border-dashed border-gray-100 dark:border-gray-700 flex justify-end gap-5">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                                    Bekor Qilish
                                </button>
                                <button type="submit" className="px-10 py-4 bg-sky-600 dark:bg-sky-500 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-sky-500 dark:hover:bg-sky-400 active:scale-[0.98] transition-all shadow-xl shadow-sky-500/20 flex flex-row items-center gap-3">
                                    Saqlash
                                    <Save size={18} />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
