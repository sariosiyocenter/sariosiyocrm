import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import { 
    Bus, Plus, Search, MoreHorizontal, User, Phone, Settings, Trash2, Edit2, 
    AlertCircle, Users, X, UserMinus, Truck, Calendar, ChevronLeft, ChevronRight, 
    CheckCircle, Home, XCircle, MapPin, GripVertical, Navigation, ArrowUp, ArrowDown,
    Clock, ChevronDown
} from 'lucide-react';
import { Transport, Student, DeliveryLog, Route } from '../types';

type TabType = 'flot' | 'marshrutlar' | 'yetkazish';

export default function LogisticsHub() {
    const { 
        transports, students, users, routes, deliveryLogs, 
        addTransport, updateTransport, deleteTransport, 
        addRoute, updateRoute, deleteRoute,
        addDeliveryLog, fetchDeliveryLogs, updateStudent 
    } = useCRM();

    const [activeTab, setActiveTab] = useState<TabType>('marshrutlar');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTransportId, setSelectedTransportId] = useState<number | null>(null);
    const [expandedRouteId, setExpandedRouteId] = useState<number | null>(null);

    // Modal states
    const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
    const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
    const [isStudentSelectorOpen, setIsStudentSelectorOpen] = useState(false);
    const [editingTransport, setEditingTransport] = useState<Transport | null>(null);
    const [editingRoute, setEditingRoute] = useState<Route | null>(null);

    // Form states
    const [transportFormData, setTransportFormData] = useState<Omit<Transport, 'id' | 'schoolId'>>({
        name: '', model: '', number: '', capacity: 15, driverName: '', driverPhone: '', status: 'Faol', driverId: null
    });
    const [routeFormData, setRouteFormData] = useState<Omit<Route, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>>({
        name: '', transportId: null, driverId: null, days: 'HAR_KUNI', studentIds: [], startTime: ''
    });

    useEffect(() => {
        if (activeTab === 'yetkazish') {
            fetchDeliveryLogs(selectedDate);
        }
    }, [selectedDate, activeTab]);

    useEffect(() => {
        if (!selectedTransportId && transports.length > 0) {
            setSelectedTransportId(transports[0].id);
        }
    }, [transports]);

    // --- TRANSPORT LOGIC ---
    const resetTransportForm = () => {
        setTransportFormData({
            name: '', model: '', number: '', capacity: 15, driverName: '', driverPhone: '', status: 'Faol', driverId: null
        });
        setEditingTransport(null);
    };

    const handleTransportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingTransport) await updateTransport(editingTransport.id, transportFormData);
        else await addTransport(transportFormData);
        setIsTransportModalOpen(false);
        resetTransportForm();
    };

    // --- ROUTE LOGIC ---
    const resetRouteForm = () => {
        setRouteFormData({
            name: '', transportId: null, driverId: null, days: 'HAR_KUNI', studentIds: [], startTime: ''
        });
        setEditingRoute(null);
    };

    const handleRouteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Explicitly pick only the fields the backend expects
        const cleanData = {
            name: routeFormData.name,
            transportId: routeFormData.transportId,
            driverId: routeFormData.driverId,
            days: routeFormData.days,
            studentIds: routeFormData.studentIds,
            startTime: routeFormData.startTime
        };
        
        try {
            if (editingRoute) await updateRoute(editingRoute.id, cleanData);
            else await addRoute(cleanData as any);
            
            setIsRouteModalOpen(false);
            resetRouteForm();
        } catch (err) {
            console.error("Route Submission Error:", err);
        }
    };

    const moveStudentInRoute = async (route: Route, studentId: number, direction: 'up' | 'down') => {
        const studentIds = [...route.studentIds];
        const index = studentIds.indexOf(studentId);
        if (index === -1) return;
        
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= studentIds.length) return;

        // Swap
        const temp = studentIds[index];
        studentIds[index] = studentIds[newIndex];
        studentIds[newIndex] = temp;

        await updateRoute(route.id, { studentIds });
    };

    // --- RENDER HELPERS ---
    const getDeliveryStatus = (studentId: number) => {
        return deliveryLogs.find(l => l.studentId === studentId && l.date === selectedDate)?.status;
    };

    const isRouteActiveOnDate = (route: Route, dateStr: string) => {
        if (route.days === 'HAR_KUNI') return true;
        
        const date = new Date(dateStr);
        const day = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
        
        // TOQ: Mon(1), Wed(3), Fri(5)
        // JUFT: Tue(2), Thu(4), Sat(6)
        if (route.days === 'TOQ') return [1, 3, 5].includes(day);
        if (route.days === 'JUFT') return [2, 4, 6].includes(day);
        
        return false;
    };

    const handleDeliveryUpdate = async (studentId: number, status: DeliveryLog['status']) => {
        if (!selectedTransportId) return;
        await addDeliveryLog({ studentId, transportId: selectedTransportId, date: selectedDate, status });
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3 uppercase tracking-tighter">
                        <Navigation className="text-sky-500 w-8 h-8" /> Logistika Markazi
                    </h1>
                    <p className="text-sm text-gray-500 font-bold tracking-tight mt-1 opacity-80">Avtopark, Yo'nalishlar va Yetkazish nazorati</p>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-[22px] border border-gray-200 dark:border-gray-700/50 shadow-inner">
                    {[
                        { id: 'marshrutlar', label: 'Marshrutlar', icon: Navigation, color: 'text-sky-500' },
                        { id: 'yetkazish', label: 'Kunlik Holat', icon: Truck, color: 'text-emerald-500' },
                        { id: 'flot', label: 'Avtopark', icon: Bus, color: 'text-amber-500' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                                activeTab === tab.id 
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xl shadow-gray-200/50 dark:shadow-none' 
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                        >
                            <tab.icon size={16} className={activeTab === tab.id ? tab.color : 'text-gray-400'} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                {activeTab === 'flot' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-white dark:bg-gray-800/40 backdrop-blur-xl p-4 rounded-3xl border border-gray-100 dark:border-gray-700/50">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Avtomobil yoki haydovchini qidirish..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-900/50 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-amber-500 font-medium transition-all"
                                />
                            </div>
                            <button 
                                onClick={() => { resetTransportForm(); setIsTransportModalOpen(true); }}
                                className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-95 text-[10px] uppercase tracking-widest ml-4"
                            >
                                <Plus size={18} /> Qo'shish
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {transports.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map(t => (
                                <div key={t.id} className="group bg-white dark:bg-gray-800/50 rounded-[32px] border border-gray-100 dark:border-gray-700/50 p-6 hover:shadow-2xl transition-all duration-500 border-b-4 border-b-gray-200 dark:border-b-gray-700">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl text-amber-600 group-hover:rotate-12 transition-transform duration-500">
                                            <Bus size={32} />
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                            <button onClick={() => { setEditingTransport(t); setTransportFormData(t); setIsTransportModalOpen(true); }} className="p-2.5 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-amber-600 rounded-xl transition-colors"><Edit2 size={16} /></button>
                                            <button onClick={() => deleteTransport(t.id)} className="p-2.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-500 rounded-xl transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{t.name}</h3>
                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">{t.model} • {t.number}</p>
                                    </div>
                                    <div className="mt-6 pt-6 border-t border-gray-50 dark:border-gray-700/50 grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Haydovchi</p>
                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{t.driverName || 'Noma\'lum'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Sig'im</p>
                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{t.capacity} kishi</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                            t.status === 'Faol' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-gray-100 text-gray-400'
                                        }`}>
                                            {t.status}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                                            <Phone size={12} className="text-amber-500" /> {t.driverPhone}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'marshrutlar' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Route List */}
                        <div className="lg:col-span-4 space-y-4">
                            <div className="bg-white dark:bg-gray-800/40 backdrop-blur-xl p-5 rounded-[32px] border border-gray-100 dark:border-gray-700/50 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Yo'nalishlar Ro'yxati</h2>
                                    <button 
                                        onClick={() => { resetRouteForm(); setIsRouteModalOpen(true); }}
                                        className="p-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl transition-all shadow-lg shadow-sky-500/20"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                                
                                <div className="space-y-3">
                                    {routes.map(route => (
                                        <div 
                                            key={route.id}
                                            className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
                                                editingRoute?.id === route.id 
                                                ? 'bg-sky-500 border-sky-500 text-white shadow-xl shadow-sky-500/30 ring-4 ring-sky-500/10' 
                                                : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700/50 hover:border-sky-300'
                                            }`}
                                            onClick={() => { 
                                                setEditingRoute(route); 
                                                setRouteFormData({
                                                    name: route.name,
                                                    transportId: route.transportId,
                                                    driverId: route.driverId,
                                                    days: route.days,
                                                    studentIds: route.studentIds,
                                                    startTime: route.startTime || ''
                                                }); 
                                            }}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className={`font-black uppercase tracking-tight ${editingRoute?.id === route.id ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                                        {route.name}
                                                    </h3>
                                                    <p className={`text-[10px] font-bold mt-1 uppercase tracking-widest ${editingRoute?.id === route.id ? 'text-white/70' : 'text-gray-400'}`}>
                                                        {route.days} • {route.startTime || '--:--'} • {route.studentIds.length} o'quvchi
                                                    </p>
                                                </div>
                                                <div className={`p-2 rounded-xl scale-75 ${editingRoute?.id === route.id ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-800'}`}>
                                                    <Navigation size={20} />
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${editingRoute?.id === route.id ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-600'}`}>
                                                        {route.transport?.name?.[0] || 'A'}
                                                    </div>
                                                    <span className={`text-[10px] font-bold uppercase tracking-tight ${editingRoute?.id === route.id ? 'text-white/80' : 'text-gray-500'}`}>
                                                        {route.transport?.name || 'Transport yo\'q'}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); deleteRoute(route.id); if(editingRoute?.id === route.id) resetRouteForm(); }}
                                                    className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${editingRoute?.id === route.id ? 'hover:bg-white/10 text-white' : 'hover:bg-rose-50 text-rose-500'}`}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {routes.length === 0 && (
                                        <div className="py-10 text-center text-gray-400 bg-gray-50/50 dark:bg-gray-900/30 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                                            <p className="text-[10px] font-black uppercase tracking-widest">Hozircha marshrutlar yo'q</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Route Editor / Details */}
                        <div className="lg:col-span-8 space-y-6">
                            {editingRoute ? (
                                <div className="bg-white dark:bg-gray-800/40 backdrop-blur-xl p-8 rounded-[40px] border border-gray-100 dark:border-gray-700/50 shadow-sm animate-in fade-in slide-in-from-right-4">
                                    <div className="flex justify-between items-start mb-8">
                                        <div>
                                            <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                                                {editingRoute.name}
                                                <span className="ml-4 text-sky-500 text-xl font-black">{editingRoute.startTime || '08:00'}</span>
                                            </h2>
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">O'quvchilar ketma-ketligini boshqarish</p>
                                        </div>
                                        <button 
                                            onClick={() => setIsRouteModalOpen(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-sky-500 hover:text-white rounded-xl transition-all cursor-pointer text-[10px] font-black uppercase tracking-widest"
                                        >
                                            <Edit2 size={14} /> Tahrirlash
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Yo'nalish tartibi (Stoplar)</h3>
                                            <button 
                                                onClick={() => setIsStudentSelectorOpen(true)}
                                                className="text-[10px] font-black text-sky-500 hover:text-sky-600 uppercase tracking-widest flex items-center gap-1"
                                            >
                                                <Plus size={14} /> O'quvchi qo'shish
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                            {editingRoute.studentIds.map((sid, index) => {
                                                const student = students.find(s => s.id === sid);
                                                if (!student) return null;
                                                return (
                                                    <div key={sid} className="group flex items-center gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-3xl border border-transparent hover:border-sky-500/20 hover:shadow-xl transition-all duration-300">
                                                        <div className="w-10 h-10 flex flex-col items-center justify-center font-black text-lg bg-white dark:bg-gray-800 text-sky-500 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                                                            <span className="text-[10px] opacity-40 leading-none">STOP</span>
                                                            <span className="leading-tight">{index + 1}</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{student.name}</h4>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><MapPin size={10} className="text-emerald-500" /> {student.address || 'Noma\'lum'}</span>
                                                                <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Phone size={10} className="text-sky-500" /> {student.phone}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                            <button 
                                                                onClick={() => moveStudentInRoute(editingRoute, sid, 'up')}
                                                                disabled={index === 0}
                                                                className="p-2 hover:bg-white dark:hover:bg-gray-700 text-gray-400 hover:text-sky-500 rounded-xl disabled:opacity-30 disabled:hover:text-gray-400 transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-600"
                                                            >
                                                                <ArrowUp size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => moveStudentInRoute(editingRoute, sid, 'down')}
                                                                disabled={index === editingRoute.studentIds.length - 1}
                                                                className="p-2 hover:bg-white dark:hover:bg-gray-700 text-gray-400 hover:text-sky-500 rounded-xl disabled:opacity-30 disabled:hover:text-gray-400 transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-600"
                                                            >
                                                                <ArrowDown size={16} />
                                                            </button>
                                                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
                                                            <button 
                                                                onClick={async () => {
                                                                    const studentIds = editingRoute.studentIds.filter(id => id !== sid);
                                                                    await updateRoute(editingRoute.id, { studentIds });
                                                                }}
                                                                className="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-500 rounded-xl transition-all border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
                                                            >
                                                                <UserMinus size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {editingRoute.studentIds.length === 0 && (
                                                <div className="py-20 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 dark:bg-gray-900/30 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800">
                                                    <AlertCircle size={40} className="mb-3 opacity-30" />
                                                    <p className="text-xs font-black uppercase tracking-widest">Bu marshrutda o'quvchilar yo'q</p>
                                                    <p className="text-[10px] mt-1 font-bold">O'quvchilarni biriktirish uchun qidiruvdan foydalaning</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-32 bg-white dark:bg-gray-800/20 rounded-[48px] border-2 border-dashed border-gray-100 dark:border-gray-800">
                                    <div className="p-8 bg-gray-50 dark:bg-gray-900 rounded-[32px] mb-6 animate-pulse">
                                        <Navigation size={64} className="opacity-20" />
                                    </div>
                                    <h3 className="text-xl font-black text-gray-700 dark:text-gray-300 uppercase tracking-tight">Marshrutni tanlang</h3>
                                    <p className="text-sm font-bold text-gray-500 mt-2">Batafsil ma'lumot va tahrirlash uchun chapdan tanlang</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'yetkazish' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Transport List */}
                        <div className="lg:col-span-1 space-y-4">
                            <div className="bg-white dark:bg-gray-800/40 backdrop-blur-xl rounded-[32px] border border-gray-100 dark:border-gray-700/50 p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transport</h3>
                                    <div className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-[9px] font-black text-emerald-600 uppercase tracking-widest">Live</div>
                                </div>
                                
                                <div className="space-y-2">
                                    {transports.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setSelectedTransportId(t.id)}
                                            className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all duration-300 ${
                                                selectedTransportId === t.id
                                                ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-900/50 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            <div className={`p-2.5 rounded-xl ${selectedTransportId === t.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                                <Bus size={20} />
                                            </div>
                                            <div className="text-left flex-1 min-w-0">
                                                <p className="text-sm font-black truncate uppercase tracking-tight">{t.name}</p>
                                                <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${selectedTransportId === t.id ? 'text-white/70' : 'text-gray-400'}`}>
                                                    {t.number || 'Raqamsiz'}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-4 bg-white dark:bg-gray-800/40 p-3 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
                                <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split('T')[0]); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"><ChevronLeft size={20} /></button>
                                <div className="flex items-center gap-2 px-3 font-black text-[11px] uppercase tracking-widest text-gray-700 dark:text-gray-200">
                                    <Calendar size={16} className="text-emerald-500" /> {selectedDate === new Date().toISOString().split('T')[0] ? 'Bugun' : selectedDate}
                                </div>
                                <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split('T')[0]); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"><ChevronRight size={20} /></button>
                            </div>
                        </div>

                        {/* Student Delivery Status */}
                        <div className="lg:col-span-3 space-y-4">
                            <div className="bg-white dark:bg-gray-800/40 backdrop-blur-xl rounded-[32px] border border-gray-100 dark:border-gray-700/50 p-3 shadow-sm flex items-center justify-between gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input 
                                        type="text"
                                        placeholder="O'quvchini qidirish..."
                                        className="w-full bg-gray-50 dark:bg-gray-900/50 border-none rounded-2xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                {routes
                                    .filter(r => r.transportId === selectedTransportId && isRouteActiveOnDate(r, selectedDate))
                                    .map(route => (
                                        <div key={route.id} className="bg-white dark:bg-gray-800/40 backdrop-blur-xl rounded-[32px] border border-gray-100 dark:border-gray-700/50 overflow-hidden transition-all duration-500 shadow-sm hover:shadow-md">
                                            {/* Route Header / Accordion Toggle */}
                                            <button 
                                                onClick={() => setExpandedRouteId(expandedRouteId === route.id ? null : route.id)}
                                                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                        <Navigation size={24} />
                                                    </div>
                                                    <div className="text-left">
                                                        <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{route.name}</h4>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mt-0.5">
                                                            <Clock size={10} /> {route.startTime || 'Vaqt belgilanmagan'} • {route.studentIds.length} o'quvchi
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className={`p-2 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-400 transition-transform duration-300 ${expandedRouteId === route.id ? 'rotate-180' : ''}`}>
                                                    <ChevronDown size={20} />
                                                </div>
                                            </button>

                                            {/* Student List (Accordion Content) */}
                                            {expandedRouteId === route.id && (
                                                <div className="p-4 pt-0 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="h-px bg-gray-100 dark:bg-gray-700/50 mx-2 mb-4" />
                                                    {route.studentIds.map(sid => {
                                                        const student = students.find(s => s.id === sid);
                                                        if (!student) return null;
                                                        const status = getDeliveryStatus(student.id);
                                                        return (
                                                            <div key={student.id} className="bg-gray-50/50 dark:bg-gray-900/40 rounded-3xl p-4 border border-transparent hover:border-emerald-500/20 transition-all group/student">
                                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center font-black text-gray-400 shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                                                                            {student.photo ? <img src={student.photo} className="w-full h-full object-cover" /> : student.name[0]}
                                                                        </div>
                                                                        <div>
                                                                            <h5 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{student.name}</h5>
                                                                            <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1 mt-0.5">
                                                                                <MapPin size={10} className="text-emerald-500" /> {student.address || 'Manzil yo\'q'}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 w-full md:w-auto">
                                                                        {[
                                                                            { label: 'Olib ketildi', status: 'Olib ketildi', color: 'sky', icon: Truck },
                                                                            { label: 'Yetkazildi', status: 'Uyiga yetkazildi', color: 'emerald', icon: Home },
                                                                            { label: 'Kelmadi', status: 'Kelmadi', color: 'rose', icon: XCircle }
                                                                        ].map(opt => (
                                                                            <button 
                                                                                key={opt.status}
                                                                                onClick={() => handleDeliveryUpdate(student.id, opt.status as any)}
                                                                                className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                                                                                    status === opt.status 
                                                                                    ? `bg-${opt.color}-500 text-white shadow-lg shadow-${opt.color}-500/30 scale-105` 
                                                                                    : `bg-white dark:bg-gray-800 text-gray-400 hover:text-${opt.color}-500 border border-gray-100 dark:border-gray-700 hover:shadow-sm`
                                                                                }`}
                                                                            >
                                                                                <opt.icon size={14} /> <span className="hidden sm:inline">{opt.label}</span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {route.studentIds.length === 0 && (
                                                        <div className="py-12 text-center text-gray-400">
                                                            <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
                                                            <p className="text-[10px] font-black uppercase tracking-widest">Bu marshrutda o'quvchilar yo'q</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                {/* Unrouted Students Section */}
                                {students.filter(s => s.transportId === selectedTransportId && !routes.filter(r => isRouteActiveOnDate(r, selectedDate)).some(r => r.studentIds.includes(s.id))).length > 0 && (
                                    <div className="bg-gray-50/50 dark:bg-gray-900/20 rounded-[32px] border border-dashed border-gray-200 dark:border-gray-800 p-6 shadow-inner mt-8">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                                                <Users size={18} />
                                            </div>
                                            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Marshrutga biriktirilmagan o'quvchilar</h4>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            {students.filter(s => s.transportId === selectedTransportId && !routes.filter(r => isRouteActiveOnDate(r, selectedDate)).some(r => r.studentIds.includes(s.id))).map(student => {
                                                const status = getDeliveryStatus(student.id);
                                                return (
                                                    <div key={student.id} className="bg-white dark:bg-gray-800/60 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
                                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center font-black text-gray-300 overflow-hidden">
                                                                    {student.photo ? <img src={student.photo} className="w-full h-full object-cover" /> : student.name[0]}
                                                                </div>
                                                                <div>
                                                                    <h5 className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-tight">{student.name}</h5>
                                                                    <p className="text-[9px] font-bold text-gray-400 mt-0.5">{student.address || 'Manzil yo\'q'}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 w-full md:w-auto">
                                                                {[
                                                                    { label: 'Olib ketildi', status: 'Olib ketildi', color: 'sky', icon: Truck },
                                                                    { label: 'Yetkazildi', status: 'Uyiga yetkazildi', color: 'emerald', icon: Home },
                                                                    { label: 'Kelmadi', status: 'Kelmadi', color: 'rose', icon: XCircle }
                                                                ].map(opt => (
                                                                    <button 
                                                                        key={opt.status}
                                                                        onClick={() => handleDeliveryUpdate(student.id, opt.status as any)}
                                                                        className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                                                                            status === opt.status 
                                                                            ? `bg-${opt.color}-500 text-white shadow-lg shadow-${opt.color}-500/30` 
                                                                            : `bg-gray-50 dark:bg-gray-900/50 text-gray-400 hover:text-${opt.color}-500`
                                                                        }`}
                                                                    >
                                                                        <opt.icon size={13} /> <span className="hidden sm:inline">{opt.label}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {routes.filter(r => r.transportId === selectedTransportId && isRouteActiveOnDate(r, selectedDate)).length === 0 && 
                                 students.filter(s => s.transportId === selectedTransportId).length === 0 && (
                                    <div className="py-24 text-center bg-white dark:bg-gray-800/20 rounded-[48px] border-2 border-dashed border-gray-100 dark:border-gray-800 text-gray-400 shadow-sm animate-in fade-in zoom-in-95 duration-700">
                                        <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                                            <Bus size={40} className="opacity-10" />
                                        </div>
                                        <p className="text-sm font-black uppercase tracking-widest text-gray-600 dark:text-gray-400">Bugun uchun marshrutlar yo'q</p>
                                        <p className="text-[10px] font-bold mt-2 text-gray-400">Tanlangan {selectedDate} sanasi uchun {transports.find(t => t.id === selectedTransportId)?.name} transportiga marshrut biriktirilmagan</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals - Simplified for brevity in this turn, will expand in full implementation */}
            {isTransportModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm shadow-2xl overflow-y-auto">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-[40px] p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
                        <button onClick={() => setIsTransportModalOpen(false)} className="absolute right-6 top-6 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><X size={24} /></button>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                            <Bus className="text-amber-500" /> {editingTransport ? 'Tahrirlash' : 'Yangi Transport'}
                        </h2>
                        <form onSubmit={handleTransportSubmit} className="space-y-4">
                            <input 
                                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-amber-500"
                                placeholder="Transport Nomi"
                                value={transportFormData.name}
                                onChange={e => setTransportFormData({...transportFormData, name: e.target.value})}
                                required
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <input className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-amber-500" placeholder="Model" value={transportFormData.model} onChange={e => setTransportFormData({...transportFormData, model: e.target.value})} />
                                <input className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-amber-500" placeholder="Raqam" value={transportFormData.number} onChange={e => setTransportFormData({...transportFormData, number: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="number" className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-amber-500" placeholder="Syg'im" value={transportFormData.capacity} onChange={e => setTransportFormData({...transportFormData, capacity: parseInt(e.target.value)})} />
                                <select className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-amber-500 appearance-none" value={transportFormData.status} onChange={e => setTransportFormData({...transportFormData, status: e.target.value as any})}>
                                    <option value="Faol">Faol</option>
                                    <option value="Ta'mirda">Ta'mirda</option>
                                    <option value="Arxiv">Arxiv</option>
                                </select>
                            </div>
                            <select className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-amber-500 appearance-none" value={transportFormData.driverId || ''} onChange={e => {
                                const did = e.target.value ? parseInt(e.target.value) : null;
                                const u = users.find(u => u.id === did);
                                setTransportFormData({...transportFormData, driverId: did, driverName: u?.name || '', driverPhone: u?.phone || ''});
                            }}>
                                <option value="">Haydovchi tanlang</option>
                                {users.filter(u => u.role === 'DRIVER').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                            <button type="submit" className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-amber-500/20 active:scale-95 transition-all mt-6">
                                {editingTransport ? 'Yangilash' : 'Saqlash'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isRouteModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm shadow-2xl overflow-y-auto">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-[40px] p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
                        <button onClick={() => setIsRouteModalOpen(false)} className="absolute right-6 top-6 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><X size={24} /></button>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
                            <Navigation className="text-sky-500" /> {editingRoute ? 'Marshrutni tahrirlash' : 'Yangi Marshrut'}
                        </h2>
                        <form onSubmit={handleRouteSubmit} className="space-y-4">
                            <input 
                                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-sky-500"
                                placeholder="Marshrut Nomi"
                                value={routeFormData.name}
                                onChange={e => setRouteFormData({...routeFormData, name: e.target.value})}
                                required
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest ml-1">Boshlanish vaqti</p>
                                    <input 
                                        type="time"
                                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-sky-500"
                                        value={routeFormData.startTime || ''}
                                        onChange={e => setRouteFormData({...routeFormData, startTime: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest ml-1">Kunlar</p>
                                    <select className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-sky-500 appearance-none" value={routeFormData.days} onChange={e => setRouteFormData({...routeFormData, days: e.target.value as any})}>
                                        <option value="HAR_KUNI">Har kuni</option>
                                        <option value="TOQ">Toq kunlar</option>
                                        <option value="JUFT">Juft kunlar</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <select className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-sky-500 appearance-none" value={routeFormData.transportId || ''} onChange={e => setRouteFormData({...routeFormData, transportId: e.target.value ? parseInt(e.target.value) : null})}>
                                    <option value="">Transport tanlang</option>
                                    {transports.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <select className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-sky-500 appearance-none" value={routeFormData.driverId || ''} onChange={e => setRouteFormData({...routeFormData, driverId: e.target.value ? parseInt(e.target.value) : null})}>
                                    <option value="">Haydovchini tanlang</option>
                                    {users.filter(u => u.role === 'DRIVER').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>

                            <div className="p-4 bg-sky-50 dark:bg-sky-500/10 rounded-2xl border border-sky-100 dark:border-sky-500/20">
                                <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                    <AlertCircle size={10} /> Malumot
                                </p>
                                <p className="text-[10px] text-sky-800 dark:text-sky-300 font-bold leading-relaxed">
                                    Marshrut yaratilgandan so'ng, unga o'quvchilarni qo'shishingiz va ularning stop tartibini belgilashingiz mumkin bo'ladi.
                                </p>
                            </div>

                            <button type="submit" className="w-full py-5 bg-sky-500 hover:bg-sky-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-sky-500/20 active:scale-95 transition-all mt-6">
                                {editingRoute ? 'Sinxronizatsiya' : 'Yaratish'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isStudentSelectorOpen && editingRoute && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm shadow-2xl overflow-y-auto">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[40px] p-8 shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        <button onClick={() => setIsStudentSelectorOpen(false)} className="absolute right-6 top-6 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><X size={24} /></button>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-6">
                            O'quvchi Qo'shish
                        </h2>
                        
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text"
                                placeholder="O'quvchi ismini qidirish..."
                                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-sky-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-2">
                            {students
                                .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .filter(s => !editingRoute.studentIds.includes(s.id))
                                .map(student => (
                                    <button
                                        key={student.id}
                                        onClick={async () => {
                                            const studentIds = [...editingRoute.studentIds, student.id];
                                            await updateRoute(editingRoute.id, { studentIds });
                                        }}
                                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-sky-50 dark:hover:bg-sky-500/10 rounded-2xl border border-transparent hover:border-sky-200 dark:hover:border-sky-700/50 transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-700 flex items-center justify-center font-bold text-sky-500">
                                                {student.name[0]}
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{student.name}</p>
                                                <p className="text-[10px] font-bold text-gray-400">{student.phone}</p>
                                            </div>
                                        </div>
                                        <div className="p-2 bg-sky-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Plus size={16} />
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
