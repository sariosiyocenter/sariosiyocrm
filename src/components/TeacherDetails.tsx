import React, { useState } from 'react';
import {
    ArrowLeft, Phone, Calendar, UserCheck, GraduationCap,
    Presentation, Wallet, TrendingUp, Clock, CheckCircle, XCircle, Plus, MoreVertical, Layers, ClipboardCheck, ChevronRight, Users
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
        return <div className="p-12 text-center text-gray-500 font-bold text-lg bg-white rounded-xl shadow-sm border border-gray-200">O'qituvchi topilmadi</div>;
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
        <div className="space-y-6 pb-12 animate-in fade-in duration-700">
            <button onClick={() => navigate('/teachers')} className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-sky-600 dark:hover:text-sky-400 transition-all text-[10px] font-bold uppercase tracking-widest group">
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Orqaga qaytish
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* Left Sidebar Profile */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
                        <div className="h-32 bg-gradient-to-br from-sky-500 to-sky-700 relative">
                            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 rounded-3xl bg-white dark:bg-gray-800 p-1.5 shadow-xl shadow-sky-500/10 transition-colors">
                                <div className="w-24 h-24 rounded-[1.25rem] bg-sky-50 dark:bg-sky-900/30 border-2 border-sky-100 dark:border-sky-800/50 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-4xl shadow-inner">
                                    {teacher.photo ? (
                                        <img src={teacher.photo} alt={teacher.name} className="w-full h-full object-cover rounded-[1.125rem]" />
                                    ) : (
                                        teacher.name.charAt(0).toUpperCase()
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="pt-16 pb-8 px-6 text-center">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">{teacher.name}</h2>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-widest leading-none">ID: #{teacher.id}</p>
                            <div className="mt-5 flex justify-center">
                                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${teacher.status === 'Faol' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'}`}>
                                    {teacher.status}
                                </span>
                            </div>
                        </div>
                        <div className="px-6 pb-8 space-y-4">
                            <div className="h-px bg-gray-50 dark:bg-gray-700 w-full mb-2 border-t border-dashed border-gray-100 dark:border-gray-600"></div>
                            <DetailRow icon={<Phone size={16} />} label="Telefon" value={teacher.phone} />
                            <DetailRow icon={<Calendar size={16} />} label="Sana" value={teacher.birthDate} />
                            <DetailRow icon={<UserCheck size={16} />} label="Ishga kirdi" value={teacher.hiredDate} />
                        </div>
                    </div>

                    <div className="bg-sky-600 dark:bg-sky-500 rounded-3xl p-7 shadow-xl shadow-sky-600/20 text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-10 translate-x-10 group-hover:bg-white/20 transition-all duration-700"></div>
                        <h4 className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-5">Moliyaviy hisobot</h4>
                        <div className="space-y-5 relative z-10">
                            <div>
                                <p className="text-[10px] text-white/80 font-bold uppercase tracking-widest mb-2 leading-none">Joriy oylik</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-white/80 tabular-nums">{calculatedSalary.toLocaleString()}</span>
                                    <span className="text-xs font-bold text-sky-100 uppercase tracking-widest opacity-80">UZS</span>
                                </div>
                            </div>
                            {kpiDetails && (
                                <div className="flex items-center justify-between pt-5 border-t border-white/10">
                                    <span className="text-[10px] text-sky-50 font-bold uppercase tracking-widest opacity-80">KPI ulush</span>
                                    <span className="text-[10px] font-bold text-sky-600 bg-white px-3 py-1 rounded-lg shadow-sm border border-white/20">{kpiDetails.percentage}%</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Main Content */}
                <div className="lg:col-span-3">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden min-h-[600px] transition-colors">
                        <div className="flex px-4 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 gap-2 overflow-x-auto custom-scrollbar">
                            <TabButton label="Umumiy" icon={<Layers size={16} />} active={activeTab === 'umumiy'} onClick={() => setActiveTab('umumiy')} />
                            <TabButton label="Oylik hisobi" icon={<Wallet size={16} />} active={activeTab === 'oylik'} onClick={() => setActiveTab('oylik')} />
                            <TabButton label="Davomat" icon={<ClipboardCheck size={16} />} active={activeTab === 'davomat'} onClick={() => setActiveTab('davomat')} />
                        </div>

                        <div className="p-8">
                            {activeTab === 'umumiy' && (
                                <div className="space-y-10 animate-in fade-in duration-500">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                                        <StatCardV3 
                                            label="Davomat" 
                                            value={`${Math.round((presentDays / (presentDays + absentDays || 1)) * 100)}%`}
                                            subValue="Ushbu oy"
                                            icon={<CheckCircle className="text-emerald-500" size={20} />} 
                                            color="emerald"
                                        />
                                        <StatCardV3 
                                            label="Kelmaganlar" 
                                            value={absentDays}
                                            subValue="Dars qoldirilgan"
                                            icon={<XCircle className="text-rose-500" size={20} />} 
                                            color="rose"
                                        />
                                        <StatCardV3 
                                            label="Guruh tushumi" 
                                            value={`${(kpiDetails?.groupRevenue || 0).toLocaleString()}`}
                                            subValue="UZS Miqdor"
                                            icon={<Wallet className="text-sky-600 dark:text-sky-400" size={20} />} 
                                            color="sky"
                                        />
                                        <StatCardV3 
                                            label="O'quvchilar" 
                                            value={totalStudents}
                                            subValue="Jami faol"
                                            icon={<GraduationCap className="text-amber-500" size={20} />} 
                                            color="amber"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-6">
                                            <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Biriktirilgan Guruhlar</h4>
                                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50 dark:bg-gray-700 px-3 py-1 rounded-lg border border-gray-100 dark:border-gray-600 items-center gap-2 flex">Jami: {teacherGroups.length} ta</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {teacherGroups.map(group => (
                                                <div key={group.id} onClick={() => navigate(`/groups/${group.id}`)} 
                                                    className="group bg-white dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-500 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:shadow-sky-500/5 hover:scale-[1.02] active:scale-[0.98]">
                                                    <div className="flex items-start justify-between">
                                                        <div className="space-y-5 w-full">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 dark:group-hover:bg-sky-500 group-hover:text-white transition-all shadow-sm shadow-sky-500/10">
                                                                    <Presentation size={28} />
                                                                </div>
                                                                <div>
                                                                    <h5 className="font-bold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors text-xl uppercase tracking-tight">{group.name}</h5>
                                                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest">{group.days}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-6 pt-5 border-t border-dashed border-gray-100 dark:border-gray-700">
                                                                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest">
                                                                    <Clock size={16} className="text-gray-400 dark:text-gray-500" />
                                                                    {group.startTime}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest">
                                                                    <Users size={16} className="text-gray-400 dark:text-gray-500" />
                                                                    {group.studentIds.length} o'quvchi
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={18} className="text-gray-300 dark:text-gray-600 group-hover:text-sky-500 transition-all translate-x-1 group-hover:translate-x-0" />
                                                    </div>
                                                </div>
                                            ))}
                                            {teacherGroups.length === 0 && (
                                                <div className="col-span-2 text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-gray-50/50 dark:bg-gray-900/20">
                                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Guruhlar mavjud emas</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'oylik' && (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <div className="p-6 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl">
                                        <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Oylik hisob-kitobi</h4>
                                    </div>
                                    
                                    <div className="border border-gray-100 dark:border-gray-700 rounded-3xl p-8 bg-white dark:bg-gray-800/50 shadow-sm transition-colors">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                            <div className="md:col-span-2 space-y-8">
                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">HISOBLASH TURI</p>
                                                    <span className="text-xs font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 px-5 py-2.5 rounded-xl inline-block shadow-sm uppercase tracking-widest">
                                                        {teacher.salaryType === 'FIXED' ? 'Fiks oylik' : teacher.salaryType === 'KPI' ? 'KPI (Ulush)' : 'Fiks + KPI'}
                                                    </span>
                                                </div>
                                                {kpiDetails && (
                                                    <div className="space-y-4">
                                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">KPI TAFSILOTLARI</p>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                            <div className="bg-gray-50/50 dark:bg-gray-900/30 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 block mb-2 uppercase tracking-widest">Guruhlar tushumi</span>
                                                                <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight tabular-nums">{kpiDetails.groupRevenue.toLocaleString()} <span className="text-[10px] text-gray-400">UZS</span></span>
                                                            </div>
                                                            <div className="bg-gray-50/50 dark:bg-gray-900/30 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 block mb-2 uppercase tracking-widest">Ulush foizi</span>
                                                                <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight tabular-nums">{kpiDetails.percentage}%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="bg-gradient-to-br from-sky-500 to-sky-700 p-10 rounded-3xl flex flex-col items-center justify-center text-white shadow-xl shadow-sky-500/20 text-center group transition-all hover:scale-[1.02]">
                                                <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-sky-100 opacity-80">UMUMIY MIQDOR</p>
                                                <p className="text-4xl font-extrabold tracking-tight tabular-nums leading-none group-hover:scale-110 transition-transform duration-500">{calculatedSalary.toLocaleString()}</p>
                                                <p className="text-[10px] font-bold mt-4 text-sky-200 uppercase tracking-widest opacity-80 border border-white/20 px-4 py-1.5 rounded-full">UZS</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'davomat' && (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 shadow-sm rounded-3xl transition-colors">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Ishga kelishi</h3>
                                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-widest">{new Date().toLocaleDateString('uz-UZ', { month: 'long' })} oyi</p>
                                        </div>
                                        <button onClick={() => setShowAttendanceModal(true)} 
                                            className="px-6 py-3 bg-sky-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-sky-500 active:scale-[0.98] transition-all shadow-lg shadow-sky-500/20">
                                            Davomat belgilash
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm transition-colors group hover:border-emerald-300 dark:hover:border-emerald-500/50">
                                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">KELDI</p>
                                            <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums leading-none">{presentDays} <span className="text-[10px] opacity-70">KUN</span></p>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm transition-colors group hover:border-rose-300 dark:hover:border-rose-500/50">
                                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-widest group-hover:text-rose-500 transition-colors">KELMADI</p>
                                            <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight tabular-nums leading-none">{absentDays} <span className="text-[10px] opacity-70">KUN</span></p>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-900/40 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                                    <th className="p-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Sana</th>
                                                    <th className="p-5 text-center text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Holati</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {currentMonthAttendances.map(a => (
                                                    <tr key={a.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/30 transition-colors">
                                                        <td className="p-5 text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">{a.date}</td>
                                                        <td className="p-5">
                                                            <div className="flex justify-center">
                                                                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${a.status === 'Keldi' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/50'}`}>
                                                                    {a.status === 'Keldi' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                                    {a.status}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {currentMonthAttendances.length === 0 && (
                                                    <tr><td colSpan={2} className="p-20 text-center text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest">Shu oy bo'yicha ma'lumot yo'q</td></tr>
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
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowAttendanceModal(false)}>
                    <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-8 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Davomat</h3>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-1.5 uppercase tracking-widest">Bugungi sana uchun</p>
                            </div>
                            <button onClick={() => setShowAttendanceModal(false)} className="w-10 h-10 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm">
                                <XCircle size={22} />
                            </button>
                        </div>
                        <div className="p-8">
                            <div className="grid grid-cols-2 gap-5">
                                <button
                                    onClick={() => {
                                        addTeacherAttendance({
                                            teacherId: teacher.id,
                                            date: new Date().toISOString().split('T')[0],
                                            status: 'Keldi',
                                            schoolId: teacher.schoolId
                                        });
                                        setShowAttendanceModal(false);
                                    }}
                                    className="flex flex-col items-center gap-5 p-10 border border-emerald-100 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-900/20 hover:bg-emerald-500 dark:hover:bg-emerald-600 hover:border-emerald-500 group rounded-[2rem] transition-all active:scale-95 text-center shadow-sm"
                                >
                                    <CheckCircle size={40} className="text-emerald-500 group-hover:text-white transition-colors" />
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:text-white uppercase tracking-widest">KELDI</span>
                                </button>
                                <button
                                    onClick={() => {
                                        addTeacherAttendance({
                                            teacherId: teacher.id,
                                            date: new Date().toISOString().split('T')[0],
                                            status: 'Kelmapdi',
                                            schoolId: teacher.schoolId
                                        });
                                        setShowAttendanceModal(false);
                                    }}
                                    className="flex flex-col items-center gap-5 p-10 border border-rose-100 dark:border-rose-800/50 bg-rose-50/30 dark:bg-rose-900/20 hover:bg-rose-500 dark:hover:bg-rose-600 hover:border-rose-500 group rounded-[2rem] transition-all active:scale-95 text-center shadow-sm"
                                >
                                    <XCircle size={40} className="text-rose-500 group-hover:text-white transition-colors" />
                                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 group-hover:text-white uppercase tracking-widest">KELMADI</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCardV3({ label, value, subValue, icon, color }: any) {
    const colorClasses = {
        emerald: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800/50',
        rose: 'bg-rose-50 dark:bg-rose-900/30 border-rose-100 dark:border-rose-800/50',
        sky: 'bg-sky-50 dark:bg-sky-900/30 border-sky-100 dark:border-sky-800/50',
        amber: 'bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800/50'
    }[color] || 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700';

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:shadow-sky-500/5 transition-all hover:-translate-y-1">
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{label}</p>
                    <h5 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none tabular-nums" title={value}>{value}</h5>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${colorClasses}`}>
                    {icon}
                </div>
            </div>
            <div className="pt-5 mt-5 border-t border-dashed border-gray-50 dark:border-gray-700">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 flex items-center gap-2 uppercase tracking-widest leading-none">
                    <TrendingUp size={14} className="text-sky-500" />
                    {subValue}
                </p>
            </div>
        </div>
    );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-4 group">
            <div className="w-12 h-12 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 rounded-2xl flex items-center justify-center text-sky-500 group-hover:bg-sky-600 dark:group-hover:bg-sky-500 group-hover:text-white group-hover:border-sky-600 dark:group-hover:border-sky-500 transition-all shadow-sm shadow-sky-500/5">
                {icon}
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">{label}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">{value}</p>
            </div>
        </div>
    );
}

function TabButton({ label, icon, active, onClick }: any) {
    return (
        <button onClick={onClick} className={`px-8 py-5 text-xs font-bold uppercase tracking-widest flex items-center gap-3 transition-all relative shrink-0 ${active ? 'text-sky-600 dark:text-sky-400 bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
            <span className={`${active ? 'scale-110' : 'opacity-60'} transition-transform`}>{icon}</span>
            {label}
            {active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-600 dark:bg-sky-500 rounded-t-full shadow-[0_-2px_8px_rgba(2,132,199,0.3)]" />}
        </button>
    );
}
