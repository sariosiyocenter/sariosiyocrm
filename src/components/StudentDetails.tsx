import React, { useState } from 'react';
import {
    ArrowLeft, User, Phone, Calendar,
    MapPin, BookOpen, CreditCard,
    Clock, CheckCircle, XCircle, MoreVertical,
    Plus, Edit2, MessageSquare, Trash2
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useParams, useNavigate } from 'react-router-dom';

export default function StudentDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { students, groups, teachers, payments } = useCRM();
    const [activeTab, setActiveTab] = useState('umumiy');

    const student = students.find(s => s.id === Number(id));

    if (!student) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
                <p className="text-slate-400 font-bold italic">O'quvchi topilmadi</p>
                <button onClick={() => navigate('/students')} className="mt-4 text-indigo-500 font-bold hover:underline">Orqaga qaytish</button>
            </div>
        );
    }

    const studentGroups = groups.filter(g => (student.groups || []).includes(g.id)).map(g => {
        const teacher = teachers.find(t => t.id === g.teacherId);
        return { ...g, teacherName: teacher?.name || 'Noma\'ulum' };
    });

    const studentPayments = payments.filter(p => p.studentId === id).reverse();

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-medium"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Ro'yxatga qaytish</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left Column: Student Profile Card */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-[#5C67F2] h-24 relative">
                            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 rounded-2xl border-4 border-white overflow-hidden shadow-lg bg-white flex items-center justify-center text-indigo-500 font-black text-2xl">
                                {student.name.charAt(0)}
                            </div>
                        </div>
                        <div className="pt-12 pb-6 px-6 text-center">
                            <h2 className="text-xl font-bold text-slate-800">{student.name}</h2>
                            <p className="text-sm text-slate-400 font-medium">Talaba ID: #{student.id}</p>
                            <div className="mt-4 flex flex-col items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${student.status === 'Faol' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600'}`}>
                                    {student.status}
                                </span>
                                <span className={`px-4 py-2 rounded-2xl text-md font-black tracking-tight ${student.balance >= 0 ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'bg-red-50 text-red-600 border border-red-100 shadow-sm'}`}>
                                    {student.balance.toLocaleString()} UZS
                                </span>
                            </div>
                        </div>
                        <div className="border-t border-slate-100 px-6 py-6 flex flex-col gap-4">
                            <InfoRow icon={<Phone className="w-4 h-4" />} label="Telefon" value={student.phone} />
                            <InfoRow icon={<Calendar className="w-4 h-4" />} label="Tug'ilgan kun" value={student.birthDate} />
                            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Manzil" value={student.address} />
                            <InfoRow icon={<Clock className="w-4 h-4" />} label="A'zo bo'ldi" value={student.joinedDate} />
                        </div>
                    </div>
                </div>

                {/* Right Column: Details Tabs */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex border-b border-slate-100 px-6">
                            <TabButton label="Umumiy ma'lumot" active={activeTab === 'umumiy'} onClick={() => setActiveTab('umumiy')} />
                            <TabButton label="Guruhlar" active={activeTab === 'guruhlar'} onClick={() => setActiveTab('guruhlar')} />
                            <TabButton label="To'lovlar" active={activeTab === 'tolovlar'} onClick={() => setActiveTab('tolovlar')} />
                        </div>

                        <div className="p-8">
                            {activeTab === 'umumiy' && (
                                <div className="flex flex-col gap-8">
                                    <div>
                                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Guruhlar</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {studentGroups.length === 0 ? (
                                                <p className="text-sm text-slate-400 italic">Hozircha guruhlarga qo'shilmagan</p>
                                            ) : (
                                                studentGroups.map(group => (
                                                    <div key={group.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-500">
                                                                <BookOpen className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <h5 className="font-bold text-slate-800 text-sm">{group.name}</h5>
                                                                <p className="text-xs text-slate-400">{group.teacherName}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs font-bold text-slate-600">{group.schedule}</p>
                                                            <p className="text-[10px] text-slate-400">{group.days}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Oxirgi to'lovlar</h4>
                                        <div className="space-y-3">
                                            {studentPayments.slice(0, 3).map(p => (
                                                <div key={p.id} className="flex items-center justify-between p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100/50">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                            <CreditCard className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700">+{p.amount.toLocaleString()} UZS</p>
                                                            <p className="text-[10px] text-slate-400 font-medium">{p.date}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-100 px-2 py-1 rounded-md">{p.method}</span>
                                                </div>
                                            ))}
                                            {studentPayments.length === 0 && <p className="text-sm text-slate-400 italic">To'lovlar tarixi mavjud emas</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'tolovlar' && (
                                <div className="space-y-4">
                                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Barcha to'lovlar</h4>
                                    {studentPayments.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center">
                                            <CreditCard className="w-10 h-10 text-slate-200 mb-4" />
                                            <p className="text-slate-400 italic">To'lovlar topilmadi</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {studentPayments.map(p => (
                                                <div key={p.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-indigo-100 transition-colors shadow-sm">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                                            <DollarSign className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700">{p.amount.toLocaleString()} UZS</p>
                                                            <p className="text-xs text-slate-400 font-medium">{p.date}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[11px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider">{p.method}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'guruhlar' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {studentGroups.map(group => (
                                        <div key={group.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                            <h5 className="font-black text-slate-800 text-lg mb-1">{group.name}</h5>
                                            <p className="text-sm text-indigo-500 font-bold mb-4 uppercase tracking-tighter">{group.courseId}</p>
                                            <div className="space-y-2 mb-6">
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <User className="w-4 h-4" />
                                                    <span className="text-xs font-medium">{group.teacherName}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <Clock className="w-4 h-4" />
                                                    <span className="text-xs font-medium">{group.days} | {group.schedule}</span>
                                                </div>
                                            </div>
                                            <button className="w-full py-2 bg-slate-50 text-slate-400 text-[10px] font-black uppercase rounded-xl tracking-widest hover:bg-slate-100 transition-colors border border-slate-100">
                                                GURUH TAFSILOTLARI
                                            </button>
                                        </div>
                                    ))}
                                    {studentGroups.length === 0 && <p className="col-span-2 text-center text-slate-400 italic py-20">Hali hech qanday guruhga a'zo emas</p>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DollarSign({ className }: { className: string }) {
    return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                {icon}
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">{label}</span>
                <span className="text-sm font-bold text-slate-700">{value}</span>
            </div>
        </div>
    );
}

function TabButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`px-6 py-4 text-sm font-bold transition-all relative ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
            {label}
            {active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 rounded-t-full"></div>}
        </button>
    );
}

function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
    return (
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
            <div className={`text-2xl font-black mt-1 ${color}`}>{value}</div>
        </div>
    );
}
