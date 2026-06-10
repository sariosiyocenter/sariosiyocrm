import React, { useState } from 'react';
import {
    ArrowLeft, Phone, Calendar, UserCheck, GraduationCap,
    Presentation, Wallet, TrendingUp, Clock, CheckCircle, XCircle, Layers, ClipboardCheck, ChevronRight, Users
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useParams, useNavigate } from 'react-router-dom';

export default function TeacherDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { teachers, groups, students, payments, teacherAttendances, addTeacherAttendance } = useCRM();
    const [activeTab, setActiveTab] = useState('umumiy');
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);

    const teacher = teachers.find(t => t.id === Number(id));

    if (!teacher) {
        return (
            <div className="p-12 text-center text-gray-550 font-bold text-sm bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
                O'qituvchi topilmadi
            </div>
        );
    }

    const teacherGroups = groups.filter(g => g.teacherId === teacher.id);
    const totalStudents = teacherGroups.reduce((acc, g) => acc + g.studentIds.length, 0);

    // Calculate dynamic salary
    let calculatedSalary = 0;
    let kpiDetails = null;

    if (teacher.salaryType === 'FIXED') {
        calculatedSalary = teacher.salary;
    } else if (teacher.salaryType === 'KPI') {
        const groupRevenue = teacherGroups.reduce((total, group) => {
            const groupPayments = payments.filter(p => group.studentIds.includes(p.studentId));
            return total + groupPayments.reduce((sum, p) => sum + p.amount, 0);
        }, 0);
        calculatedSalary = (groupRevenue * teacher.sharePercentage) / 100;
        kpiDetails = { groupRevenue, percentage: teacher.sharePercentage };
    } else if (teacher.salaryType === 'FIXED_KPI') {
        const groupRevenue = teacherGroups.reduce((total, group) => {
            const groupPayments = payments.filter(p => group.studentIds.includes(p.studentId));
            return total + groupPayments.reduce((sum, p) => sum + p.amount, 0);
        }, 0);
        calculatedSalary = teacher.salary + (groupRevenue * teacher.sharePercentage) / 100;
        kpiDetails = { groupRevenue, percentage: teacher.sharePercentage, fixed: teacher.salary };
    }

    const currentMonthAttendances = teacherAttendances.filter(a =>
        a.teacherId === teacher.id &&
        a.date.startsWith(new Date().toISOString().slice(0, 7))
    );

    const presentDays = currentMonthAttendances.filter(a => a.status === 'Keldi').length;
    const absentDays = currentMonthAttendances.filter(a => a.status === 'Kelmapdi').length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Back Button */}
            <button onClick={() => navigate('/hr')} className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-[#1b6b6b] transition-all text-[10px] font-extrabold uppercase tracking-widest group cursor-pointer">
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                HR Menejment
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* Left Profile Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                        <div className="h-28 bg-[#1b6b6b] relative">
                            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 rounded-2xl bg-white dark:bg-gray-800 p-1 shadow-md">
                                <div className="w-20 h-20 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700/50 flex items-center justify-center text-[#1b6b6b] font-bold text-2xl">
                                    {teacher.photo ? (
                                        <img src={teacher.photo} alt={teacher.name} className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                        teacher.name.charAt(0).toUpperCase()
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="pt-14 pb-6 px-6 text-center">
                            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{teacher.name}</h2>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">ID: #{teacher.id}</p>
                            <div className="mt-4 flex justify-center">
                                <span className={`px-2.5 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wider ${teacher.status === 'Faol' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-gray-55 text-gray-400 border-gray-100 dark:bg-gray-900/50'}`}>
                                    {teacher.status}
                                </span>
                            </div>
                        </div>
                        <div className="px-6 pb-6 space-y-3 border-t border-dashed border-gray-100 dark:border-gray-700/50 pt-4">
                            <DetailRow icon={<Phone size={14} />} label="Telefon" value={teacher.phone} />
                            <DetailRow icon={<Calendar size={14} />} label="Tug'ilgan sana" value={teacher.birthDate} />
                            <DetailRow icon={<UserCheck size={14} />} label="Ish boshlagan" value={teacher.hiredDate} />
                        </div>
                    </div>

                    <div className="bg-[#1b6b6b] rounded-3xl p-6 text-white shadow-lg shadow-[#1b6b6b]/20 relative overflow-hidden">
                        <span className="text-[9px] font-black text-teal-100 uppercase tracking-widest block mb-4">Maosh Hisobi</span>
                        <div className="space-y-4">
                            <div>
                                <span className="text-[9px] text-teal-200 font-bold uppercase tracking-widest block">Joriy oylik</span>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-2xl font-black tracking-tight tabular-nums">{calculatedSalary.toLocaleString()}</span>
                                    <span className="text-[9px] font-extrabold text-teal-200 uppercase tracking-widest">UZS</span>
                                </div>
                            </div>
                            {kpiDetails && (
                                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                                    <span className="text-[9px] text-teal-200 font-bold uppercase tracking-widest">KPI ulushi</span>
                                    <span className="text-[9px] font-black bg-white/20 px-2 py-0.5 rounded text-white">{kpiDetails.percentage}%</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Tab Content */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden min-h-[500px]">
                        <div className="flex px-4 bg-gray-55 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/50 gap-2">
                            <TabButton label="Umumiy" icon={<Layers size={14} />} active={activeTab === 'umumiy'} onClick={() => setActiveTab('umumiy')} />
                            <TabButton label="Oylik hisobi" icon={<Wallet size={14} />} active={activeTab === 'oylik'} onClick={() => setActiveTab('oylik')} />
                            <TabButton label="Davomat" icon={<ClipboardCheck size={14} />} active={activeTab === 'davomat'} onClick={() => setActiveTab('davomat')} />
                        </div>

                        <div className="p-6">
                            {activeTab === 'umumiy' && (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                        <StatCardV3 
                                            label="Davomat" 
                                            value={`${Math.round((presentDays / (presentDays + absentDays || 1)) * 100)}%`}
                                            subValue="Ushbu oy"
                                            icon={<CheckCircle className="text-emerald-500" size={16} />} 
                                            color="emerald"
                                        />
                                        <StatCardV3 
                                            label="Kelmaganlar" 
                                            value={absentDays}
                                            subValue="Dars qoldirilgan"
                                            icon={<XCircle className="text-rose-500" size={16} />} 
                                            color="rose"
                                        />
                                        <StatCardV3 
                                            label="Guruh tushumi" 
                                            value={`${(kpiDetails?.groupRevenue || 0).toLocaleString()}`}
                                            subValue="UZS Miqdor"
                                            icon={<Wallet className="text-[#1b6b6b]" size={16} />} 
                                            color="teal"
                                        />
                                        <StatCardV3 
                                            label="O'quvchilar" 
                                            value={totalStudents}
                                            subValue="Jami faol"
                                            icon={<GraduationCap className="text-amber-500" size={16} />} 
                                            color="amber"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50 dark:border-gray-700/50">
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Biriktirilgan Guruhlar</span>
                                            <span className="text-[9px] font-extrabold text-[#1b6b6b] uppercase tracking-widest bg-[#1b6b6b]/5 px-2.5 py-0.5 rounded border border-[#1b6b6b]/10">Jami: {teacherGroups.length} ta</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {teacherGroups.map(group => (
                                                <div key={group.id} onClick={() => navigate(`/groups/${group.id}`)} 
                                                    className="group bg-gray-50/50 dark:bg-gray-900/40 p-5 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all cursor-pointer flex items-center justify-between">
                                                    <div className="space-y-4 w-full">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 flex items-center justify-center text-[#1b6b6b] group-hover:bg-[#1b6b6b] group-hover:text-white transition-all shadow-sm">
                                                                <Presentation size={18} />
                                                            </div>
                                                            <div>
                                                                <h5 className="text-xs font-black text-gray-900 dark:text-white group-hover:text-[#1b6b6b] transition-colors uppercase tracking-tight">{group.name}</h5>
                                                                <p className="text-[9px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest">{group.days}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 pt-3 border-t border-dashed border-gray-100 dark:border-gray-750">
                                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                                                                <Clock size={12} className="text-gray-400" />
                                                                {group.schedule}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                                                                <Users size={12} className="text-gray-400" />
                                                                {group.studentIds.length} o'quvchi
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={16} className="text-gray-300 group-hover:text-[#1b6b6b] transition-colors" />
                                                </div>
                                            ))}
                                            {teacherGroups.length === 0 && (
                                                <p className="col-span-2 text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Guruhlar mavjud emas</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'oylik' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="bg-gray-50/50 dark:bg-gray-900/40 p-4 border border-gray-100 dark:border-gray-700/50 rounded-2xl">
                                        <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">Oylik hisob-kitobi</h4>
                                    </div>
                                    
                                    <div className="border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 bg-white dark:bg-gray-800/50 shadow-sm">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="md:col-span-2 space-y-6">
                                                <div>
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">HISOBLASH TURI</span>
                                                    <span className="text-[9px] font-black text-[#1b6b6b] bg-[#1b6b6b]/5 border border-[#1b6b6b]/10 px-3 py-1.5 rounded-lg inline-block uppercase tracking-wider">
                                                        {teacher.salaryType === 'FIXED' ? 'Fiks oylik' : teacher.salaryType === 'KPI' ? 'KPI (Ulush)' : 'Fiks + KPI'}
                                                    </span>
                                                </div>
                                                {kpiDetails && (
                                                    <div className="space-y-3">
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">KPI TAFSILOTLARI</span>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                                                <span className="text-[8px] font-black text-gray-400 block mb-1 uppercase tracking-widest">Guruhlar tushumi</span>
                                                                <span className="text-sm font-black text-gray-900 dark:text-white tracking-tight tabular-nums">{kpiDetails.groupRevenue.toLocaleString()} UZS</span>
                                                            </div>
                                                            <div className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                                                <span className="text-[8px] font-black text-gray-400 block mb-1 uppercase tracking-widest">Ulush foizi</span>
                                                                <span className="text-sm font-black text-gray-900 dark:text-white tracking-tight tabular-nums">{kpiDetails.percentage}%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="bg-gradient-to-br from-[#1b6b6b] to-[#268c8c] p-6 rounded-2xl flex flex-col items-center justify-center text-white text-center">
                                                <span className="text-[9px] font-bold uppercase tracking-widest mb-1.5 text-teal-100">UMUMIY MIQDOR</span>
                                                <span className="text-2xl font-black tracking-tight tabular-nums">{calculatedSalary.toLocaleString()}</span>
                                                <span className="text-[8px] font-black mt-3 text-teal-200 uppercase tracking-widest border border-white/20 px-3 py-1 rounded-full">UZS</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'davomat' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-55 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-2xl">
                                        <div>
                                            <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">Ishga kelishi</h3>
                                            <p className="text-[9px] font-bold text-gray-450 uppercase tracking-widest mt-1">{new Date().toLocaleDateString('uz-UZ', { month: 'long' })} oyi</p>
                                        </div>
                                        <button onClick={() => setShowAttendanceModal(true)} 
                                            className="px-4 py-2 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-[#1b6b6b]/20">
                                            Davomat belgilash
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm group hover:border-emerald-300">
                                            <span className="text-[9px] font-bold text-gray-400 mb-2 uppercase tracking-widest block group-hover:text-emerald-500 transition-colors">KELDI</span>
                                            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">{presentDays} <span className="text-[9px] opacity-70">KUN</span></span>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm group hover:border-rose-300">
                                            <span className="text-[9px] font-bold text-gray-400 mb-2 uppercase tracking-widest block group-hover:text-rose-500 transition-colors">KELMADI</span>
                                            <span className="text-xl font-black text-rose-600 dark:text-rose-400 tracking-tight tabular-nums">{absentDays} <span className="text-[9px] opacity-70">KUN</span></span>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-705">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-55 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                                                    <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Sana</th>
                                                    <th className="p-4 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">Holati</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {currentMonthAttendances.map(a => (
                                                    <tr key={a.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/30 transition-colors">
                                                        <td className="p-4 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">{a.date}</td>
                                                        <td className="p-4">
                                                            <div className="flex justify-center">
                                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wider ${a.status === 'Keldi' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400'}`}>
                                                                    {a.status === 'Keldi' ? 'Keldi' : 'Kelmadi'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {currentMonthAttendances.length === 0 && (
                                                    <tr><td colSpan={2} className="p-10 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest">Shu oy bo'yicha ma'lumot yo'q</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Attendance Modal */}
            {showAttendanceModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowAttendanceModal(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-2xl w-full max-w-sm p-8">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Davomat</h3>
                                <p className="text-[10px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">Bugungi sana uchun</p>
                            </div>
                            <button onClick={() => setShowAttendanceModal(false)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => {
                                    addTeacherAttendance({
                                        teacherId: teacher.id,
                                        date: new Date().toISOString().split('T')[0],
                                        status: 'Keldi'
                                    });
                                    setShowAttendanceModal(false);
                                }}
                                className="flex flex-col items-center gap-3 p-6 border border-emerald-100 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-900/20 hover:bg-[#1b6b6b] hover:text-white hover:border-[#1b6b6b] group rounded-2xl transition-all cursor-pointer text-center shadow-sm"
                            >
                                <CheckCircle size={24} className="text-emerald-500 group-hover:text-white transition-colors" />
                                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 group-hover:text-white uppercase tracking-widest">KELDI</span>
                            </button>
                            <button
                                onClick={() => {
                                    addTeacherAttendance({
                                        teacherId: teacher.id,
                                        date: new Date().toISOString().split('T')[0],
                                        status: 'Kelmapdi'
                                    });
                                    setShowAttendanceModal(false);
                                }}
                                className="flex flex-col items-center gap-3 p-6 border border-rose-100 dark:border-rose-800/50 bg-rose-50/30 dark:bg-rose-900/20 hover:bg-rose-500 hover:text-white hover:border-rose-500 group rounded-2xl transition-all cursor-pointer text-center shadow-sm"
                            >
                                <XCircle size={24} className="text-rose-500 group-hover:text-white transition-colors" />
                                <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 group-hover:text-white uppercase tracking-widest">KELMADI</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCardV3({ label, value, subValue, icon, color }: any) {
    const colorClasses = {
        emerald: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40',
        rose: 'bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40',
        teal: 'bg-teal-50 border-teal-100 dark:bg-teal-950/20 dark:border-teal-900/40',
        amber: 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40'
    }[color] || 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700/50';

    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm transition-all hover:-translate-y-0.5">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
                    <h5 className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-none tabular-nums" title={value}>{value}</h5>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorClasses}`}>
                    {icon}
                </div>
            </div>
            <div className="pt-3 mt-3 border-t border-dashed border-gray-100 dark:border-gray-700/50">
                <span className="text-[9px] font-bold text-gray-400 flex items-center gap-1 uppercase tracking-widest leading-none">
                    <TrendingUp size={12} className="text-[#1b6b6b]" />
                    {subValue}
                </span>
            </div>
        </div>
    );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-center text-[#1b6b6b]">
                {icon}
            </div>
            <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none block">{label}</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight mt-0.5 block">{value}</span>
            </div>
        </div>
    );
}

function TabButton({ label, icon, active, onClick }: any) {
    return (
        <button onClick={onClick} className={`px-6 py-4 text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 transition-all relative shrink-0 cursor-pointer ${active ? 'text-[#1b6b6b] bg-white dark:bg-gray-800' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
            {icon}
            {label}
            {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1b6b6b] rounded-t-full" />}
        </button>
    );
}
