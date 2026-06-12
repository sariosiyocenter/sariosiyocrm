import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { useLang } from '../context/LanguageContext';
import { 
    Bus, Plus, Search, User, Phone, Trash2, Edit2, 
    AlertCircle, Users, X, UserMinus, Truck, Calendar, ChevronLeft, ChevronRight, 
    Home, XCircle, MapPin, Navigation, ArrowUp, ArrowDown,
    Clock, ChevronDown
} from 'lucide-react';
import { Transport, DeliveryLog, Route } from '../types';

type TabType = 'flot' | 'marshrutlar' | 'yetkazish';

const inp = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";
const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

export default function LogisticsHub() {
    const { t } = useLang();
    const {
        transports, students, users, routes, deliveryLogs,
        addTransport, updateTransport, deleteTransport,
        addRoute, updateRoute, deleteRoute,
        addDeliveryLog, fetchDeliveryLogs
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

    const getDeliveryStatus = (studentId: number) => {
        return deliveryLogs.find(l => l.studentId === studentId && l.date === selectedDate)?.status;
    };

    const isRouteActiveOnDate = (route: Route, dateStr: string) => {
        if (route.days === 'HAR_KUNI') return true;
        const date = new Date(dateStr);
        const day = date.getDay(); 
        if (route.days === 'TOQ') return [1, 3, 5].includes(day);
        if (route.days === 'JUFT') return [2, 4, 6].includes(day);
        return false;
    };

    const handleDeliveryUpdate = async (studentId: number, status: DeliveryLog['status']) => {
        if (!selectedTransportId) return;
        await addDeliveryLog({ studentId, transportId: selectedTransportId, date: selectedDate, status });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1b6b6b] to-[#2e9c9c] flex items-center justify-center shadow-lg shadow-[#1b6b6b]/20">
                            <Navigation size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('logistics_title')}</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                {t('logistics_subtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-700/50 w-fit">
                        {[
                            { id: 'marshrutlar', label: t('tab_routes') },
                            { id: 'yetkazish', label: t('tab_daily_status') },
                            { id: 'flot', label: t('tab_fleet') },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`px-5 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer ${
                                    activeTab === tab.id 
                                    ? 'bg-[#1b6b6b] text-white shadow' 
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Switcher */}
            {activeTab === 'flot' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50 flex flex-wrap items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input 
                                type="text" 
                                placeholder={t('search')} 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                            />
                        </div>
                        <button 
                            onClick={() => { resetTransportForm(); setIsTransportModalOpen(true); }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                        >
                            <Plus size={14} /> {t('add')}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {transports.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm hover:shadow-md transition-all group relative flex flex-col justify-between min-h-[200px]">
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-[#1b6b6b]">
                                            <Bus size={18} />
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingTransport(item); setTransportFormData(item); setIsTransportModalOpen(true); }} className="w-7 h-7 rounded-lg text-gray-400 hover:text-[#1b6b6b] hover:bg-gray-50 dark:hover:bg-gray-950 flex items-center justify-center transition-colors cursor-pointer"><Edit2 size={13} /></button>
                                            <button onClick={() => deleteTransport(item.id)} className="w-7 h-7 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center justify-center transition-colors cursor-pointer"><Trash2 size={13} /></button>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">{item.name}</h3>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{item.model} • {item.number}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-dashed border-gray-100 dark:border-gray-700/50 grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">{t('driver')}</span>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight">{item.driverName || t('unknown_teacher')}</span>
                                    </div>
                                    <div>
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">{t('capacity')}</span>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 tabular-nums">{t('capacity_unit').replace('{count}', String(item.capacity))}</span>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between">
                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wider ${
                                        item.status === 'Faol' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-gray-50 text-gray-400 border-gray-100 dark:bg-gray-900/50'
                                    }`}>
                                        {item.status === 'Faol' ? t('status_active') : item.status === 'Ta\'mirda' ? t('status_repair') : item.status === 'Arxiv' ? t('status_archive') : item.status}
                                    </span>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 tabular-nums">
                                        <Phone size={10} className="text-[#1b6b6b]" /> {item.driverPhone}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}            {activeTab === 'marshrutlar' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: Route list */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">{t('routes')}</span>
                                <button 
                                    onClick={() => { resetRouteForm(); setIsRouteModalOpen(true); }}
                                    className="w-8 h-8 rounded-lg bg-[#1b6b6b] text-white flex items-center justify-center shadow transition-all cursor-pointer"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                            
                            <div className="space-y-2">
                                {routes.map(route => (
                                    <div 
                                        key={route.id}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
                                            editingRoute?.id === route.id 
                                            ? 'bg-[#1b6b6b]/10 border-[#1b6b6b]' 
                                            : 'bg-gray-50/50 dark:bg-gray-900/40 border-transparent hover:border-gray-100'
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
                                                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                                    {route.name}
                                                </h3>
                                                <span className="text-[9px] text-gray-400 font-bold block mt-0.5 uppercase tracking-wide">
                                                    {route.days === 'HAR_KUNI' ? t('every_day') : route.days === 'TOQ' ? t('odd_days') : route.days === 'JUFT' ? t('even_days') : route.days} • {route.startTime || '--:--'} • {route.studentIds.length} {t('student').toLowerCase()}
                                                </span>
                                            </div>
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-[#1b6b6b]">
                                                <Navigation size={14} />
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between pt-2 border-t border-dashed border-gray-100 dark:border-gray-700/50">
                                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">
                                                🚌 {route.transport?.name || t('not_marked')}
                                            </span>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); deleteRoute(route.id); if(editingRoute?.id === route.id) resetRouteForm(); }}
                                                className="w-6 h-6 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {routes.length === 0 && (
                                    <p className="text-center py-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('no_routes_found')}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Route stops detail */}
                    <div className="lg:col-span-8">
                        {editingRoute ? (
                            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-6 shadow-sm animate-in fade-in duration-300">
                                <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                                    <div>
                                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                            {editingRoute.name}
                                        </h3>
                                        <span className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">{t('start_time')}: {editingRoute.startTime || t('not_marked')}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setIsRouteModalOpen(true)}
                                            className="px-3.5 py-2 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 border border-gray-100 dark:border-gray-750 text-gray-700 dark:text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer"
                                        >
                                            {t('edit')}
                                        </button>
                                        <button 
                                            onClick={() => setIsStudentSelectorOpen(true)}
                                            className="px-3.5 py-2 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                                        >
                                            {t('add_student')}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {editingRoute.studentIds.map((sid, index) => {
                                        const student = students.find(s => s.id === sid);
                                        if (!student) return null;
                                        return (
                                            <div key={sid} className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-900/40 rounded-2xl hover:border-gray-100 border border-transparent transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center font-black text-xs text-[#1b6b6b]">
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{student.name}</h4>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wide flex items-center gap-0.5"><MapPin size={9} /> {student.address || '—'}</span>
                                                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wide flex items-center gap-0.5"><Phone size={9} /> {student.phone}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => moveStudentInRoute(editingRoute, sid, 'up')}
                                                        disabled={index === 0}
                                                        className="w-7 h-7 rounded-lg text-gray-400 hover:text-[#1b6b6b] hover:bg-gray-50 dark:hover:bg-gray-950 flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
                                                    >
                                                        <ArrowUp size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => moveStudentInRoute(editingRoute, sid, 'down')}
                                                        disabled={index === editingRoute.studentIds.length - 1}
                                                        className="w-7 h-7 rounded-lg text-gray-400 hover:text-[#1b6b6b] hover:bg-gray-50 dark:hover:bg-gray-950 flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
                                                    >
                                                        <ArrowDown size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={async () => {
                                                            const studentIds = editingRoute.studentIds.filter(id => id !== sid);
                                                            await updateRoute(editingRoute.id, { studentIds });
                                                        }}
                                                        className="w-7 h-7 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center justify-center transition-all cursor-pointer"
                                                    >
                                                        <UserMinus size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {editingRoute.studentIds.length === 0 && (
                                        <p className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('no_students_in_route')}</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-12 text-center shadow-sm">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('select_route_prompt')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'yetkazish' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Select Transport & Date */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 p-5 shadow-sm">
                            <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-4">{t('transport_selection')}</span>
                            <div className="space-y-2">
                                {transports.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedTransportId(t.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer ${
                                            selectedTransportId === t.id
                                            ? 'bg-[#1b6b6b]/10 border border-[#1b6b6b] text-[#1b6b6b]'
                                            : 'bg-gray-55 dark:bg-gray-900 border border-transparent text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        <Bus size={16} />
                                        <span className="text-xs font-black uppercase tracking-tight truncate">{t.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-3 shadow-sm">
                            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split('T')[0]); }} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors cursor-pointer"><ChevronLeft size={16} /></button>
                            <span className="text-[10px] font-extrabold uppercase text-gray-700 dark:text-gray-200 tracking-widest">{selectedDate}</span>
                            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split('T')[0]); }} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors cursor-pointer"><ChevronRight size={16} /></button>
                        </div>
                    </div>

                    {/* Delivery updates accordion */}
                    <div className="lg:col-span-3 space-y-4">
                        {routes
                            .filter(r => r.transportId === selectedTransportId && isRouteActiveOnDate(r, selectedDate))
                            .map(route => (
                                <div key={route.id} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 overflow-hidden shadow-sm">
                                    <button 
                                        onClick={() => setExpandedRouteId(expandedRouteId === route.id ? null : route.id)}
                                        className="w-full flex items-center justify-between p-5 hover:bg-gray-55 dark:hover:bg-gray-750 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[#1b6b6b]/10 text-[#1b6b6b] flex items-center justify-center">
                                                <Navigation size={16} />
                                            </div>
                                            <div className="text-left">
                                                <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">{route.name}</h4>
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mt-0.5">{route.studentIds.length} {t('student').toLowerCase()}</span>
                                            </div>
                                        </div>
                                        <ChevronDown size={16} className={`text-gray-400 transition-transform ${expandedRouteId === route.id ? 'rotate-180' : ''}`} />
                                    </button>

                                    {expandedRouteId === route.id && (
                                        <div className="p-4 pt-0 border-t border-gray-50 dark:border-gray-700/50 space-y-2">
                                            {route.studentIds.map(sid => {
                                                const student = students.find(s => s.id === sid);
                                                if (!student) return null;
                                                const status = getDeliveryStatus(student.id);
                                                return (
                                                    <div key={student.id} className="p-3 bg-gray-55/50 dark:bg-gray-900/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                        <div>
                                                            <h5 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{student.name}</h5>
                                                            <span className="text-[9px] text-gray-400 font-bold block mt-0.5 uppercase tracking-wide">{student.address || t('no_address')}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                                                            {[
                                                                { label: t('status_picked_up'), status: 'Olib ketildi', color: 'sky' },
                                                                { label: t('status_delivered'), status: 'Uyiga yetkazildi', color: 'emerald' },
                                                                { label: t('status_not_come'), status: 'Kelmadi', color: 'rose' }
                                                            ].map(opt => (
                                                                <button 
                                                                    key={opt.status}
                                                                    onClick={() => handleDeliveryUpdate(student.id, opt.status as any)}
                                                                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                                                                        status === opt.status 
                                                                        ? 'bg-[#1b6b6b] text-white' 
                                                                        : 'bg-white dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700'
                                                                    }`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Transport Modal */}
            {isTransportModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsTransportModalOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{editingTransport ? t('edit_transport') : t('new_transport')}</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">{t('fleet_subtitle')}</p>
                            </div>
                            <button onClick={() => setIsTransportModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleTransportSubmit} className="space-y-4">
                            <div>
                                <label className={lbl}>{t('transport_name')} *</label>
                                <input required type="text" className={inp} placeholder="Sariq avtobus" value={transportFormData.name} onChange={e => setTransportFormData({...transportFormData, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>{t('model')}</label>
                                    <input type="text" className={inp} placeholder="Daewoo" value={transportFormData.model} onChange={e => setTransportFormData({...transportFormData, model: e.target.value})} />
                                </div>
                                <div>
                                    <label className={lbl}>{t('plate_number')}</label>
                                    <input type="text" className={inp} placeholder="70 A 777 AA" value={transportFormData.number} onChange={e => setTransportFormData({...transportFormData, number: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>{t('capacity')} ({t('capacity_unit').replace('{count}', '')})</label>
                                    <input type="number" className={inp} value={transportFormData.capacity} onChange={e => setTransportFormData({...transportFormData, capacity: parseInt(e.target.value)})} />
                                </div>
                                <div>
                                    <label className={lbl}>{t('status')}</label>
                                    <select className={inp} value={transportFormData.status} onChange={e => setTransportFormData({...transportFormData, status: e.target.value as any})}>
                                        <option value="Faol">{t('status_active')}</option>
                                        <option value="Ta'mirda">{t('status_repair')}</option>
                                        <option value="Arxiv">{t('status_archive')}</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>{t('driver')}</label>
                                <select className={inp} value={transportFormData.driverId || ''} onChange={e => {
                                    const did = e.target.value ? parseInt(e.target.value) : null;
                                    const u = users.find(u => u.id === did);
                                    setTransportFormData({...transportFormData, driverId: did, driverName: u?.name || '', driverPhone: u?.phone || ''});
                                }}>
                                    <option value="">{t('select_placeholder')}</option>
                                    {users.filter(u => u.role === 'DRIVER').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                                <button type="button" onClick={() => setIsTransportModalOpen(false)}
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

            {isRouteModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsRouteModalOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{editingRoute ? t('edit_route') : t('new_route')}</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">{t('route_subtitle')}</p>
                            </div>
                            <button onClick={() => setIsRouteModalOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleRouteSubmit} className="space-y-4">
                            <div>
                                <label className={lbl}>{t('route_name')} *</label>
                                <input required type="text" className={inp} placeholder="Sariosiyo yo'nalishi" value={routeFormData.name} onChange={e => setRouteFormData({...routeFormData, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>{t('start_time')}</label>
                                    <input type="time" className={inp} value={routeFormData.startTime || ''} onChange={e => setRouteFormData({...routeFormData, startTime: e.target.value})} />
                                </div>
                                <div>
                                    <label className={lbl}>{t('days')}</label>
                                    <select className={inp} value={routeFormData.days} onChange={e => setRouteFormData({...routeFormData, days: e.target.value as any})}>
                                        <option value="HAR_KUNI">{t('every_day')}</option>
                                        <option value="TOQ">{t('odd_days')}</option>
                                        <option value="JUFT">{t('even_days')}</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>{t('transport')}</label>
                                    <select className={inp} value={routeFormData.transportId || ''} onChange={e => setRouteFormData({...routeFormData, transportId: e.target.value ? parseInt(e.target.value) : null})}>
                                        <option value="">{t('select_placeholder')}</option>
                                        {transports.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>{t('driver')}</label>
                                    <select className={inp} value={routeFormData.driverId || ''} onChange={e => setRouteFormData({...routeFormData, driverId: e.target.value ? parseInt(e.target.value) : null})}>
                                        <option value="">{t('select_placeholder')}</option>
                                        {users.filter(u => u.role === 'DRIVER').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                                <button type="button" onClick={() => setIsRouteModalOpen(false)}
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

            {isStudentSelectorOpen && editingRoute && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsStudentSelectorOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-md p-8 max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50 shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('add_student')}</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">{t('assign_to_route')}</p>
                            </div>
                            <button onClick={() => setIsStudentSelectorOpen(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <div className="relative mb-4 shrink-0">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input 
                                type="text"
                                placeholder={t('search')}
                                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-[#1b6b6b] transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
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
                                        className="w-full flex items-center justify-between p-3 bg-gray-50/50 dark:bg-gray-900/40 hover:bg-[#1b6b6b]/5 border border-transparent hover:border-gray-100 rounded-2xl transition-all cursor-pointer text-left"
                                    >
                                        <div>
                                            <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{student.name}</p>
                                            <span className="text-[9px] text-gray-400 font-bold block mt-0.5 uppercase tracking-wide">{student.phone}</span>
                                        </div>
                                        <Plus size={16} className="text-gray-400" />
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
