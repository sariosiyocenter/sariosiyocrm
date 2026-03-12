import React, { useState } from 'react';
import {
    Users, BookOpen, Star, Clock, MapPin, Calendar,
    User, Building2, CreditCard,
    Edit2, Trash2, MessageSquare, Monitor, QrCode, UserPlus, LogOut,
    FileSpreadsheet, Lock, ArrowLeft, X, Check, Search
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useParams, useNavigate } from 'react-router-dom';

export default function GroupDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { 
        groups, teachers, students, courses, attendances, 
        addAttendance, updateGroup, deleteGroup 
    } = useCRM();
    
    const [activeTab, setActiveTab] = useState<'DAVOMAT' | 'O\'QUVCHILAR' | 'IMTIHON'>('DAVOMAT');
    const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
    const [searchStudent, setSearchStudent] = useState('');

    const group = groups.find(g => g.id === Number(id));
    const teacher = teachers.find(t => t?.id === group?.teacherId);
    const course = courses.find(c => c.id === group?.courseId);
    const groupStudents = students.filter(s => s.groups.includes(Number(id)));
    
    const dates = ['03', '05', '07', '10', '12', '14', '17', '19', '21', '24'];

    if (!group) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
                <p className="text-slate-400 font-bold italic">Guruh topilmadi</p>
                <button onClick={() => navigate('/groups')} className="mt-4 text-indigo-500 font-bold hover:underline">Orqaga qaytish</button>
            </div>
        );
    }

    const handleDelete = async () => {
        if (window.confirm("Haqiqatan ham ushbu guruhni o'chirib tashlamoqchimisiz?")) {
            await deleteGroup(group.id);
            navigate('/groups');
        }
    };

    const toggleAttendance = async (studentId: number, date: string) => {
        const existing = attendances.find(a => 
            a.studentId === studentId && 
            a.groupId === group.id && 
            a.date === `2024-03-${date}`
        );

        if (existing) {
            // In a real app we might update or delete, for now let's just log
            console.log("Attendance already exists");
        } else {
            await addAttendance({
                studentId,
                groupId: group.id,
                date: `2024-03-${date}`,
                status: 'Keldi'
            });
        }
    };

    const handleAddStudentToGroup = async (studentId: number) => {
        const student = students.find(s => s.id === studentId);
        if (student && !student.groups.includes(group.id)) {
            const updatedGroups = [...student.groups, group.id];
            // We need updateStudent in context, but let's check if we can use updateGroup
            // Actually, students are connected to groups. Let's use updateGroup to connect.
            await updateGroup(group.id, {
                studentIds: [...group.studentIds, studentId]
            });
        }
    };

    const availableStudents = students.filter(s => 
        !s.groups.includes(group.id) && 
        (s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.phone.includes(searchStudent))
    );

    return (
        <div className="max-w-[1600px] mx-auto pb-10 px-4">
            {/* Title block */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-[#5C67F2] transition-all active:scale-95 shadow-sm">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#5C67F2] text-white flex items-center justify-center shadow-xl shadow-indigo-100 ring-4 ring-indigo-50">
                        <BookOpen className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">{group.name}</h1>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">ID: #{group.id}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                {/* Left Sidebar */}
                <div className="xl:col-span-1">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/40 sticky top-8">
                        <div className="space-y-6">
                            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Guruh ma'lumotlari</h2>

                            <InfoRow label="O'quvchilar soni" value={`${groupStudents.length} ta`} icon={<Users className="w-5 h-5 text-indigo-400" />} />
                            <InfoRow label="Kurs" value={course?.name || 'Topilmadi'} icon={<BookOpen className="w-5 h-5 text-indigo-400" />} />
                            <InfoRow label="Dars vaqti" value={group.schedule} icon={<Clock className="w-5 h-5 text-indigo-400" />} />
                            <InfoRow label="Dars kunlari" value={group.days} icon={<Calendar className="w-5 h-5 text-indigo-400" />} />
                            <InfoRow label="O'qituvchi" value={teacher?.name || 'Noma\'ulum'} icon={<User className="w-5 h-5 text-indigo-400" />} color="text-[#5C67F2]" />

                            <div className="pt-6 border-t border-slate-50">
                                <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl shadow-slate-300">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kurs narxi</p>
                                    <div className="flex items-baseline gap-2">
                                        <h4 className="text-2xl font-black tabular-nums">{(course?.price || 0).toLocaleString()}</h4>
                                        <span className="text-xs font-bold text-slate-400">UZS</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="grid grid-cols-4 gap-2 mt-8 pt-8 border-t border-slate-50">
                            {[
                                { icon: <Edit2 />, color: "amber", title: "Tahrirlash", onClick: () => {} },
                                { icon: <Trash2 />, color: "rose", title: "O'chirish", onClick: handleDelete },
                                { icon: <MessageSquare />, color: "emerald", title: "Xabar", onClick: () => {} },
                                { icon: <UserPlus />, color: "indigo", title: "Qo'shish", onClick: () => setIsAddStudentModalOpen(true) }
                            ].map((btn, i) => (
                                <button 
                                    key={i}
                                    onClick={btn.onClick}
                                    className={`flex items-center justify-center aspect-square bg-${btn.color}-50 text-${btn.color}-500 rounded-2xl border border-transparent hover:border-${btn.color}-200 transition-all active:scale-95 group relative`}
                                    title={btn.title}
                                >
                                    {React.cloneElement(btn.icon as React.ReactElement, { className: "w-5 h-5 group-hover:scale-110 transition-transform" })}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Content */}
                <div className="xl:col-span-3 space-y-8">
                    {/* Nav Tabs */}
                    <div className="bg-white rounded-[2rem] p-2 border border-slate-100 shadow-sm flex items-center gap-2">
                        {[
                            { id: 'DAVOMAT', label: 'DAVOMAT', icon: <Calendar className="w-4 h-4" /> },
                            { id: 'O\'QUVCHILAR', label: 'O\'QUVCHILAR', icon: <Users className="w-4 h-4" /> },
                            { id: 'IMTIHON', label: 'IMTIHON', icon: <Star className="w-4 h-4" /> }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-xs font-black transition-all tracking-widest ${activeTab === tab.id ? 'bg-[#5C67F2] text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                        {activeTab === 'DAVOMAT' && (
                            <>
                                <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Oylik Davomat</h2>
                                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Mart oyi uchun hisobot</p>
                                    </div>
                                    <button className="flex items-center gap-2 px-8 py-3 bg-emerald-500 text-white rounded-2xl text-[10px] font-black hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100 uppercase tracking-widest">
                                        <FileSpreadsheet className="w-4 h-4" />
                                        EXCELGA YUKLASH
                                    </button>
                                </div>

                                <div className="px-8 flex items-center gap-8 border-b border-slate-50 overflow-x-auto bg-white">
                                    {['Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avg'].map(month => (
                                        <button key={month} className={`px-2 py-6 text-[10px] font-black transition-all whitespace-nowrap tracking-widest relative ${month === 'Mart' ? 'text-[#5C67F2]' : 'text-slate-400 hover:text-slate-800'}`}>
                                            {month.toUpperCase()}
                                            {month === 'Mart' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#5C67F2] rounded-t-full"></div>}
                                        </button>
                                    ))}
                                </div>

                                <div className="p-8 overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-max rounded-3xl overflow-hidden border border-slate-50">
                                        <thead>
                                            <tr className="bg-slate-50/50">
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 text-center">№</th>
                                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[250px]">O'quvchi</th>
                                                {dates.map((date, i) => (
                                                    <th key={i} className="p-4 text-[11px] font-black text-[#5C67F2] text-center w-16 border-l border-slate-100">
                                                        {date}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {groupStudents.length === 0 ? (
                                                <tr>
                                                    <td colSpan={dates.length + 2} className="py-24 text-center ">
                                                        <div className="flex flex-col items-center opacity-30">
                                                            <Users className="w-12 h-12 mb-4" />
                                                            <p className="italic font-bold">Bu guruhda hali o'quvchilar yo'q</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                groupStudents.map((student, idx) => (
                                                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-6 text-xs font-bold text-slate-400 text-center">{idx + 1}</td>
                                                        <td className="p-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-[#5C67F2] text-[10px] font-black">
                                                                    {student.name.charAt(0)}
                                                                </div>
                                                                <span className="text-sm font-black text-slate-700">{student.name}</span>
                                                            </div>
                                                        </td>
                                                        {dates.map((date, i) => {
                                                            const isAttended = attendances.some(a => a.studentId === student.id && a.groupId === group.id && a.date === `2024-03-${date}`);
                                                            return (
                                                                <td key={i} className="p-4 border-l border-slate-50">
                                                                    <button 
                                                                        onClick={() => toggleAttendance(student.id, date)}
                                                                        className={`w-8 h-8 mx-auto rounded-xl transition-all flex items-center justify-center group ${isAttended ? 'bg-indigo-50 text-[#5C67F2]' : 'bg-slate-50 text-slate-200 hover:bg-indigo-50/50 hover:text-indigo-300'}`}
                                                                    >
                                                                        {isAttended ? <Check className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                                                                    </button>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {activeTab === 'O\'QUVCHILAR' && (
                            <div className="p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Guruh O'quvchilari</h2>
                                    <button 
                                        onClick={() => setIsAddStudentModalOpen(true)}
                                        className="flex items-center gap-2 px-6 py-3 bg-[#5C67F2] text-white rounded-2xl text-xs font-black shadow-xl shadow-indigo-100 hover:bg-indigo-600 transition-all uppercase tracking-widest"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        O'quvchi qo'shish
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {groupStudents.map(student => (
                                        <div key={student.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-[#5C67F2]/30 transition-all group flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#5C67F2] font-black border border-slate-100 shadow-sm">
                                                    {student.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-800">{student.name}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400">{student.phone}</p>
                                                </div>
                                            </div>
                                            <button className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                                <LogOut className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'IMTIHON' && (
                            <div className="p-20 text-center opacity-30">
                                <Star className="w-16 h-16 mx-auto mb-6" />
                                <h3 className="text-2xl font-black uppercase tracking-[0.2em]">Tez kunda</h3>
                                <p className="font-bold italic mt-2">Imtihonlarni boshqarish tizimi ishlab chiqilmoqda</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Student Modal */}
            {isAddStudentModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">O'quvchi biriktirish</h2>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Guruhga yangi a'zo qo'shish</p>
                            </div>
                            <button onClick={() => setIsAddStudentModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 transition-all hover:bg-rose-50 hover:border-rose-100 shadow-sm">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-10 space-y-8">
                            <div className="relative">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input 
                                    type="text" 
                                    placeholder="O'quvchini ismi yoki telefon raqami bo'yicha qidirish..."
                                    className="w-full pl-16 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] outline-none focus:ring-4 focus:ring-indigo-50 focus:border-[#5C67F2] transition-all text-sm font-bold"
                                    value={searchStudent}
                                    onChange={e => setSearchStudent(e.target.value)}
                                />
                            </div>

                            <div className="max-h-[400px] overflow-y-auto pr-4 space-y-3 custom-scrollbar">
                                {availableStudents.length === 0 ? (
                                    <div className="py-20 text-center opacity-30">
                                        <Search className="w-12 h-12 mx-auto mb-4" />
                                        <p className="font-bold italic">O'quvchi topilmadi</p>
                                    </div>
                                ) : (
                                    availableStudents.map(student => (
                                        <div key={student.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-[#5C67F2] font-black shadow-sm group-hover:scale-110 transition-transform">
                                                    {student.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-800">{student.name}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{student.phone}</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleAddStudentToGroup(student.id)}
                                                className="w-10 h-10 flex items-center justify-center bg-white text-indigo-500 rounded-xl shadow-sm border border-indigo-50 hover:bg-[#5C67F2] hover:text-white transition-all active:scale-95"
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex justify-end">
                            <button 
                                onClick={() => setIsAddStudentModalOpen(false)}
                                className="px-10 py-4 bg-slate-800 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-black transition-all"
                            >
                                Yopish
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function InfoRow({ label, value, icon, color = "text-slate-800" }: { label: string, value: string, icon: React.ReactNode, color?: string }) {
    return (
        <div className="flex items-center justify-between text-slate-600 border-b border-slate-50 pb-5">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-white transition-colors">
                    {icon}
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">{label}:</span>
            </div>
            <strong className={`${color} text-sm font-black tracking-tight`}>{value}</strong>
        </div>
    );
}

function Plus({ className }: { className: string }) {
    return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}
