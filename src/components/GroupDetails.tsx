import React from 'react';
import {
    Users, BookOpen, Star, Clock, MapPin, Calendar,
    User, Building2, CreditCard,
    Edit2, Trash2, MessageSquare, Monitor, QrCode, UserPlus, LogOut,
    FileSpreadsheet, Lock, ArrowLeft
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useParams, useNavigate } from 'react-router-dom';

export default function GroupDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { groups, teachers, students } = useCRM();
    const dates = ['03', '05', '07', '10', '12', '14', '17', '19', '21', '24'];

    const group = groups.find(g => g.id === Number(id));
    const teacher = teachers.find(t => t?.id === group?.teacherId);
    const groupStudents = students.filter(s => s.groups.includes(Number(id)));

    if (!group) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
                <p className="text-slate-400 font-bold italic">Guruh topilmadi</p>
                <button onClick={() => navigate('/groups')} className="mt-4 text-indigo-500 font-bold hover:underline">Orqaga qaytish</button>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto pb-10">
            {/* Title block */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#5C67F2] text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">{group.name}</h1>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Left Sidebar */}
                <div className="xl:col-span-1">
                    <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col h-full">
                        <div className="space-y-5 flex-1">
                            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Guruh ma'lumotlari</h2>

                            <InfoRow label="O'quvchilar soni" value={`${groupStudents.length} ta`} icon={<Users className="w-5 h-5 text-indigo-400" />} />
                            <InfoRow label="Kurs" value={group.courseId} icon={<BookOpen className="w-5 h-5 text-indigo-400" />} />
                            <InfoRow label="Dars vaqti" value={group.schedule} icon={<Clock className="w-5 h-5 text-indigo-400" />} />
                            <InfoRow label="Dars kunlari" value={group.days} icon={<Calendar className="w-5 h-5 text-indigo-400" />} />
                            <InfoRow label="O'qituvchi" value={teacher?.name || 'Noma\'ulum'} icon={<User className="w-5 h-5 text-indigo-400" />} color="text-[#5C67F2]" />

                            <div className="flex items-center justify-between text-slate-600 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-3">
                                    <CreditCard className="w-5 h-5 text-slate-400" />
                                    <span className="text-sm font-medium">Kurs narxi:</span>
                                </div>
                                <strong className="text-slate-800">800.000 So'm</strong>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-8 mt-6 flex justify-between items-center px-1 border-t border-slate-100">
                            <button className="text-amber-500 hover:bg-amber-50 p-2.5 rounded-xl border border-transparent hover:border-amber-100 transition-colors" title="Tahrirlash"><Edit2 className="w-5 h-5" /></button>
                            <button className="text-red-500 hover:bg-red-50 p-2.5 rounded-xl border border-transparent hover:border-red-100 transition-colors" title="O'chirish"><Trash2 className="w-5 h-5" /></button>
                            <button className="text-green-500 hover:bg-green-50 p-2.5 rounded-xl border border-transparent hover:border-green-100 transition-colors" title="Xabar"><MessageSquare className="w-5 h-5" /></button>
                            <button className="text-[#5C67F2] hover:bg-indigo-50 p-2.5 rounded-xl border border-transparent hover:border-indigo-100 transition-colors" title="Qo'shish"><UserPlus className="w-5 h-5" /></button>
                        </div>
                    </div>
                </div>

                {/* Right Content */}
                <div className="xl:col-span-3 flex flex-col h-full">
                    {/* Nav Tabs */}
                    <div className="flex items-center gap-8 border-b border-slate-100 mb-6 overflow-x-auto px-4">
                        <TabButton label="DAVOMAT" active={true} icon={<Calendar className="w-4 h-4" />} />
                        <TabButton label="O'QUVCHILAR" active={false} icon={<Users className="w-4 h-4" />} />
                        <TabButton label="IMTIHON" active={false} icon={<Star className="w-4 h-4" />} />
                    </div>

                    {/* Content Area */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Oylik Davomat</h2>
                            <button className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100">
                                <FileSpreadsheet className="w-4 h-4" />
                                EXCELGA YUKLASH
                            </button>
                        </div>

                        <div className="px-6 flex items-center gap-8 border-b border-slate-100 overflow-x-auto bg-white sticky top-0 z-10">
                            {['Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avg'].map(month => (
                                <button key={month} className={`px-2 py-4 text-xs font-black transition-all whitespace-nowrap tracking-widest ${month === 'Mart' ? 'text-[#5C67F2] border-b-4 border-[#5C67F2]' : 'text-slate-400 hover:text-slate-800'}`}>
                                    {month.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        <div className="p-6 overflow-x-auto w-full flex-1">
                            <table className="w-full text-left border-collapse min-w-max border border-slate-100 rounded-2xl overflow-hidden">
                                <thead>
                                    <tr className="bg-slate-50/50">
                                        <th className="p-4 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-tighter w-12 text-center">№</th>
                                        <th className="p-4 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">O'quvchi</th>
                                        {dates.map((date, i) => (
                                            <th key={i} className="p-2 border-b border-slate-100 border-l border-slate-50 text-[11px] font-black text-[#5C67F2] text-center w-12 bg-white/50">
                                                {date}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupStudents.length === 0 ? (
                                        <tr>
                                            <td colSpan={dates.length + 2} className="py-20 text-center text-slate-400 italic font-medium">Bu guruhda hali o'quvchilar yo'q</td>
                                        </tr>
                                    ) : (
                                        groupStudents.map((student, idx) => (
                                            <tr key={student.id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="p-4 border-b border-slate-50 text-xs font-bold text-slate-400 text-center">{idx + 1}</td>
                                                <td className="p-4 border-b border-slate-50 text-sm font-bold text-slate-700">{student.name}</td>
                                                {dates.map((_, i) => (
                                                    <td key={i} className="p-2 border-b border-slate-50 border-l border-slate-50 text-center">
                                                        <div className="w-6 h-6 mx-auto border-2 border-slate-200 rounded-lg cursor-pointer hover:border-[#5C67F2] hover:bg-indigo-50 transition-all flex items-center justify-center group-hover:bg-white">
                                                            <div className="w-2 h-2 rounded-full bg-slate-100"></div>
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value, icon, color = "text-slate-800" }: { label: string, value: string, icon: React.ReactNode, color?: string }) {
    return (
        <div className="flex items-center justify-between text-slate-600 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
                {icon}
                <span className="text-sm font-medium">{label}:</span>
            </div>
            <strong className={`${color} tracking-tight`}>{value}</strong>
        </div>
    );
}

function TabButton({ label, active, icon }: { label: string, active: boolean, icon: React.ReactNode }) {
    return (
        <button className={`flex items-center gap-2 px-1 py-5 text-[11px] font-black transition-all border-b-4 tracking-widest ${active ? 'text-[#5C67F2] border-[#5C67F2]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
            {icon}
            {label}
        </button>
    );
}
