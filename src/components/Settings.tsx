import React, { useState } from 'react';
import {
    Building2, Image as ImageIcon, Plus,
    ChevronRight, MessageSquare,
    CreditCard, Layout, User, ShieldCheck, Clock, Edit2, Settings as SettingsIcon,
    Trash2, Save, X
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';

export default function Settings() {
    const { settings, updateSettings, courses, rooms, schools, addCourse, deleteCourse, addRoom, deleteRoom, addSchool, deleteSchool } = useCRM();
    const [activeTab, setActiveTab] = useState('ofis');
    const [activeSubTab, setActiveSubTab] = useState('Kurslar');
    const [settingsForm, setSettingsForm] = useState(settings);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newItem, setNewItem] = useState<any>({});
    const [users, setUsers] = useState<any[]>([]);
    const { user: currentUser, token } = useCRM();

    React.useEffect(() => {
        setSettingsForm(settings);
    }, [settings]);

    const menuItems = [
        { id: 'ofis', label: 'Ofis', icon: <Building2 className="w-4 h-4" />, hasSub: true, subItems: ['Kurslar', 'Xonalar', 'Filiallar'] },
        ...(currentUser?.role === 'ADMIN' ? [{ id: 'ceo', label: 'CEO', icon: <User className="w-4 h-4" />, hasSub: true, subItems: ['Umumiy sozlamalar', 'Xodimlar'] }] : []),
    ];

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setUsers(await res.json());
        } catch (err) {
            console.error("Failed to fetch users", err);
        }
    };

    React.useEffect(() => {
        if (activeSubTab === 'Xodimlar' && currentUser?.role === 'ADMIN') {
            fetchUsers();
        }
    }, [activeSubTab, currentUser]);

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateSettings(settingsForm);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (activeSubTab === 'Kurslar') {
            const id = newItem.name.toLowerCase().replace(/\s+/g, '-');
            addCourse({ ...newItem, id, price: Number(newItem.price) });
        } else if (activeSubTab === 'Xonalar') {
            const id = newItem.name.toLowerCase().replace(/\s+/g, '-');
            addRoom({ ...newItem, id, capacity: Number(newItem.capacity) });
        } else if (activeSubTab === 'Filiallar') {
            const id = newItem.name.toLowerCase().replace(/\s+/g, '-');
            addSchool({ ...newItem, id });
        } else if (activeSubTab === 'Xodimlar') {
            try {
                const res = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(newItem)
                });
                if (res.ok) fetchUsers();
            } catch (err) {
                console.error("Failed to add user", err);
            }
        }
        setIsAddModalOpen(false);
        setNewItem({});
    };

    const renderList = () => {
        let items: any[] = [];
        if (activeSubTab === 'Kurslar') items = courses || [];
        else if (activeSubTab === 'Xonalar') items = rooms || [];
        else if (activeSubTab === 'Filiallar') items = schools || [];
        else if (activeSubTab === 'Xodimlar') items = users || [];

        if (items.length === 0) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                    <div className="w-32 h-32 bg-indigo-50 rounded-[3rem] flex items-center justify-center mb-8 animate-pulse">
                        <Building2 className="w-12 h-12 text-indigo-400" />
                    </div>
                    <h4 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Ma'lumotlar topilmadi</h4>
                    <p className="text-slate-500 max-w-md font-medium leading-relaxed">
                        Ushbu bo'lim hozircha bo'sh. "Yangi qo'shish" tugmasi orqali ma'lumotlarni kiritishingiz mumkin.
                    </p>
                </div>
            );
        }

        return (
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {items.map(item => (
                    <div key={item.id} className="bg-slate-50 border border-slate-100 p-6 rounded-[2rem] flex flex-col gap-4 group hover:bg-white hover:border-indigo-200 transition-all hover:shadow-lg">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm">
                                {activeSubTab === 'Kurslar' ? <Layout className="w-6 h-6" /> : activeSubTab === 'Xodimlar' ? <User className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                            </div>
                            {activeSubTab !== 'Xodimlar' && (
                                <button
                                    onClick={() => {
                                        if (activeSubTab === 'Kurslar') deleteCourse(item.id);
                                        if (activeSubTab === 'Xonalar') deleteRoom(item.id);
                                        if (activeSubTab === 'Filiallar') deleteSchool(item.id);
                                    }}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">{item.name}</h4>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                {activeSubTab === 'Kurslar' ? `${item.price.toLocaleString()} UZS` :
                                    activeSubTab === 'Xonalar' ? `${item.capacity} kishilik` :
                                        activeSubTab === 'Xodimlar' ? `${item.role} | ${item.email}` :
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

        if (activeTab === 'ofis' || activeTab === 'ceo') {
            if (activeSubTab === 'Umumiy sozlamalar') {
                return (
                    <form onSubmit={handleSaveSettings} className="flex flex-col gap-6">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40">
                            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-8">Asosiy Tashkilot Ma'lumotlari</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Tashkilot Nomi</label>
                                    <input required type="text" className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#5C67F2] focus:bg-white transition-all font-bold text-slate-700"
                                        value={settingsForm.orgName} onChange={e => setSettingsForm({ ...settingsForm, orgName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Asosiy Manzil</label>
                                    <input type="text" placeholder="Shahar, Ko'cha, Uy" className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#5C67F2] focus:bg-white transition-all font-bold text-slate-700"
                                        value={settingsForm.address || ''} onChange={e => setSettingsForm({ ...settingsForm, address: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Sms va Ogohlantirishlar uchun: Admin Telefon Raqami</label>
                                    <input required type="text" placeholder="+998 90 123 45 67" className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#5C67F2] focus:bg-white transition-all font-bold text-slate-700"
                                        value={settingsForm.adminPhone || ''} onChange={e => setSettingsForm({ ...settingsForm, adminPhone: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Ish Vaqti</label>
                                    <input type="text" placeholder="Du-Shanba 09:00 - 18:00" className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#5C67F2] focus:bg-white transition-all font-bold text-slate-700"
                                        value={settingsForm.workingHours || ''} onChange={e => setSettingsForm({ ...settingsForm, workingHours: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Telegram Manzili</label>
                                    <input type="text" placeholder="https://t.me/username" className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#5C67F2] focus:bg-white transition-all font-bold text-slate-700"
                                        value={settingsForm.telegram || ''} onChange={e => setSettingsForm({ ...settingsForm, telegram: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Instagram Manzili</label>
                                    <input type="text" placeholder="https://instagram.com/username" className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#5C67F2] focus:bg-white transition-all font-bold text-slate-700"
                                        value={settingsForm.instagram || ''} onChange={e => setSettingsForm({ ...settingsForm, instagram: e.target.value })} />
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end">
                                <button type="submit" disabled={isSaving} className="bg-[#5C67F2] hover:bg-indigo-600 disabled:opacity-70 text-white px-8 py-3.5 rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all uppercase tracking-widest text-sm flex items-center gap-3">
                                    {isSaving ? 'SAQLANMOQDA...' : 'SAQLASH'}
                                    <Save className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </form>
                );
            }

            return (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                    <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{activeSubTab}</h3>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{activeTab} bo'limi</p>
                        </div>
                        <button onClick={() => {
                            setNewItem({});
                            setIsAddModalOpen(true);
                        }} className="flex items-center gap-2 bg-[#5C67F2] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-600 transition-all active:scale-95">
                            <Plus className="w-4 h-4" />
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
        <div className="flex flex-col gap-6 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <SettingsIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Tizim Sozlamalari</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Markazni boshqarish va xususiylashtirish</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Sidebar Menu */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 p-4 h-fit sticky top-24">
                        <div className="flex flex-col gap-1.5">
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
                                        className={`flex items-center justify-between px-5 py-4 rounded-2xl font-bold transition-all group ${activeTab === item.id
                                            ? 'bg-[#5C67F2] text-white shadow-lg shadow-indigo-200'
                                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`${activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'} transition-colors`}>
                                                {item.icon}
                                            </div>
                                            <span className="text-[14px]">{item.label}</span>
                                        </div>
                                        {item.hasSub && <ChevronRight className={`w-4 h-4 transition-transform ${activeTab === item.id ? 'rotate-90' : ''}`} />}
                                    </button>

                                    {item.hasSub && activeTab === item.id && (
                                        <div className="flex flex-col ml-12 mt-2 mb-3 space-y-1">
                                            {item.subItems?.map(subItem => (
                                                <button
                                                    key={subItem}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveSubTab(subItem);
                                                    }}
                                                    className={`py-2 text-left text-[13px] font-bold transition-colors ${activeSubTab === subItem ? 'text-[#5C67F2]' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {subItem}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-9">
                    {renderContent()}
                </div>
            </div>

            {/* Global Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                                    Yangi {activeSubTab === 'Xodimlar' ? 'Xodim' : activeSubTab === 'Filiallar' ? 'Filial' : activeSubTab.slice(0, -2)} qo'shish
                                </h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{activeTab} bo'limi</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleAdd} className="p-8 space-y-6">
                            {activeSubTab !== 'Xodimlar' && (
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Nomi</label>
                                    <input required type="text" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700"
                                        value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                                </div>
                            )}

                            {activeSubTab === 'Kurslar' && (
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Narxi (UZS)</label>
                                    <input required type="number" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700"
                                        value={newItem.price || ''} onChange={e => setNewItem({ ...newItem, price: e.target.value })} />
                                </div>
                            )}

                            {activeSubTab === 'Xonalar' && (
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Sig'imi (Kishi)</label>
                                    <input required type="number" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700"
                                        value={newItem.capacity || ''} onChange={e => setNewItem({ ...newItem, capacity: e.target.value })} />
                                </div>
                            )}

                            {activeSubTab === 'Filiallar' && (
                                <div>
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Filial Manzili</label>
                                    <input required type="text" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700"
                                        value={newItem.address || ''} onChange={e => setNewItem({ ...newItem, address: e.target.value })} />
                                </div>
                            )}

                            {activeSubTab === 'Xodimlar' && (
                                <>
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Ismi (F.I.SH)</label>
                                        <input required type="text" placeholder="Ism Familiya" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700"
                                            value={newItem.name || ''} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Vazifasi</label>
                                        <select required className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700"
                                            value={newItem.role || 'RECEPTIONIST'} onChange={e => setNewItem({ ...newItem, role: e.target.value })}>
                                            <option value="RECEPTIONIST">Receptionist</option>
                                            <option value="TEACHER">O'qituvchi</option>
                                            <option value="ADMIN">Administrator</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Login</label>
                                        <input required type="text" placeholder="pochta@misol.uz yoki login" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700"
                                            value={newItem.email || ''} onChange={e => setNewItem({ ...newItem, email: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Paroli</label>
                                        <input required type="password" placeholder="Kamida 6 belgi" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700"
                                            value={newItem.password || ''} onChange={e => setNewItem({ ...newItem, password: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Telefon raqami</label>
                                        <input type="text" placeholder="+998 90 123 45 67" className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-slate-700"
                                            value={newItem.phone || ''} onChange={e => setNewItem({ ...newItem, phone: e.target.value })} />
                                    </div>
                                </>
                            )}

                            <button type="submit" className="w-full py-5 bg-[#5C67F2] text-white rounded-[1.5rem] font-black shadow-xl shadow-indigo-100 hover:bg-indigo-600 transition-all mt-4 uppercase tracking-widest text-sm flex items-center justify-center gap-3">
                                <Plus className="w-5 h-5" />
                                SAQLASH
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

