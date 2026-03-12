import React, { useMemo } from 'react';
import { 
    Calendar, Phone, MapPin, Layers, Users, BookOpen, ArrowLeft, 
    TrendingUp, TrendingDown, DollarSign, Award, AlertCircle, CheckCircle2, XCircle
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useParams, useNavigate } from 'react-router-dom';

export default function TeacherDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { teachers, groups, students, payments, attendances, scores } = useCRM();

    const teacher = teachers.find(t => t.id === Number(id));

    const stats = useMemo(() => {
        if (!teacher) return null;

        const teacherGroups = groups.filter(g => g.teacherId === teacher.id);
        const teacherGroupIds = teacherGroups.map(g => g.id);
        
        // Find students in these groups
        const groupStudents = students.filter(s => 
            s.groups.some(gid => teacherGroupIds.includes(gid))
        );
        const studentIds = groupStudents.map(s => s.id);

        // Financials
        const relevantPayments = payments.filter(p => studentIds.includes(p.studentId));
        const totalRevenue = relevantPayments.reduce((sum, p) => sum + p.amount, 0);
        const calculatedBonus = (totalRevenue * (teacher.sharePercentage || 0)) / 100;
        const totalSalary = (teacher.salary || 0) + calculatedBonus;

        // Attendance
        const relevantAttendances = attendances.filter(a => teacherGroupIds.includes(a.groupId));
        const totalAttendanceCount = relevantAttendances.length;
        const presentCount = relevantAttendances.filter(a => a.status === 'Keldi').length;
        const absentCount = relevantAttendances.filter(a => a.status === 'Kelmapdi').length;
        const attendanceRate = totalAttendanceCount > 0 ? Math.round((presentCount / totalAttendanceCount) * 100) : 0;

        // Scores
        const relevantScores = scores.filter(s => teacherGroupIds.includes(s.groupId));
        const avgScore = relevantScores.length > 0 
            ? Math.round((relevantScores.reduce((sum, s) => sum + s.value, 0) / relevantScores.length) * 10) / 10
            : 0;

        return {
            teacherGroups,
            studentIds,
            totalRevenue,
            totalSalary,
            attendanceRate,
            absentCount,
            avgScore,
            totalAttendanceCount
        };
    }, [teacher, groups, students, payments, attendances, scores]);

    if (!teacher || !stats) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-slate-400 font-bold italic text-lg">O'qituvchi topilmadi</p>
                <button 
                    onClick={() => navigate('/teachers')} 
                    className="mt-6 px-8 py-3 bg-[#5C67F2] text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-600 transition-all"
                >
                    Ro'yxatga qaytish
                </button>
            </div>
        );
    }

    const { teacherGroups, totalSalary, attendanceRate, absentCount, avgScore, totalRevenue } = stats;

    return (
        <div className="max-w-[1600px] mx-auto pb-20 px-4 md:px-6">
            {/* Header section */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="w-12 h-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-[#5C67F2] hover:border-indigo-100 transition-all shadow-sm active:scale-95"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">{teacher.name}</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="bg-indigo-50 text-[#5C67F2] px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">O'qituvchi</span>
                            <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">ID: #{teacher.id}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Profile Information */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 -mr-10 -mt-10 rounded-full group-hover:scale-110 transition-transform duration-700"></div>
                        
                        <div className="flex flex-col items-center text-center relative z-10">
                            <div className="w-28 h-28 bg-gradient-to-br from-[#5C67F2] to-indigo-600 text-white rounded-[2rem] flex items-center justify-center text-4xl font-black mb-6 shadow-2xl shadow-indigo-200 ring-4 ring-indigo-50">
                                {teacher.name.charAt(0)}
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">{teacher.name}</h3>
                            <div className="bg-slate-50 px-4 py-2 rounded-xl text-slate-600 font-bold text-xs border border-slate-100">
                                {teacher.phone}
                            </div>
                        </div>

                        <div className="mt-10 space-y-5 border-t border-slate-50 pt-8 relative z-10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-slate-500 font-bold text-xs uppercase tracking-widest">
                                    <Calendar className="w-4 h-4 text-indigo-400" />
                                    Ishga kirgan
                                </div>
                                <span className="text-slate-800 font-black text-sm">{teacher.hiredDate}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-slate-500 font-bold text-xs uppercase tracking-widest">
                                    <BookOpen className="w-4 h-4 text-indigo-400" />
                                    Ulush %
                                </div>
                                <span className="text-slate-800 font-black text-sm">{teacher.sharePercentage}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-slate-500 font-bold text-xs uppercase tracking-widest">
                                    <Layers className="w-4 h-4 text-indigo-400" />
                                    Guruhlar
                                </div>
                                <span className="text-slate-800 font-black text-sm">{teacherGroups.length}</span>
                            </div>
                        </div>

                        <div className="mt-10 pt-8 border-t border-slate-50 relative z-10">
                            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl shadow-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Umumiy Oylik</p>
                                <div className="flex items-baseline gap-2">
                                    <h4 className="text-2xl font-black tabular-nums">{totalSalary.toLocaleString()}</h4>
                                    <span className="text-xs font-bold text-slate-400">UZS</span>
                                </div>
                                <div className="mt-4 flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[10px] font-bold text-slate-300">
                                        Bonus: {((totalSalary - (teacher.salary || 0))).toLocaleString()} UZS
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Stats and Groups */}
                <div className="lg:col-span-9 space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard 
                            icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />} 
                            label="Davomat" 
                            value={`${attendanceRate}%`} 
                            color="emerald" 
                            trend={attendanceRate > 90 ? "Zo'r" : "O'rta"}
                        />
                        <StatCard 
                            icon={<XCircle className="w-6 h-6 text-rose-500" />} 
                            label="Kelmaganlar" 
                            value={absentCount} 
                            color="rose" 
                            trend="Dars soni"
                        />
                        <StatCard 
                            icon={<DollarSign className="w-6 h-6 text-amber-500" />} 
                            label="Guruh Tushumi" 
                            value={`${totalRevenue.toLocaleString()} UZS`} 
                            color="amber" 
                            trend="To'lovlar"
                        />
                        <StatCard 
                            icon={<Award className="w-6 h-6 text-indigo-500" />} 
                            label="O'rta Ball" 
                            value={avgScore} 
                            color="indigo" 
                            trend="Baholash"
                        />
                    </div>

                    {/* Groups List */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/40">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Guruhlar ro'yxati</h2>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">O'qituvchi biriktirilgan darslar</p>
                            </div>
                        </div>

                        {teacherGroups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                                <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6">
                                    <Layers className="w-12 h-12 text-slate-300" />
                                </div>
                                <h4 className="text-xl font-bold text-slate-800 mb-2">Guruhlar topilmadi</h4>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {teacherGroups.map(group => {
                                    const groupStudents = students.filter(s => s.groups.includes(group.id));
                                    const groupAttendances = attendances.filter(a => a.groupId === group.id);
                                    const groupPresent = groupAttendances.filter(a => a.status === 'Keldi').length;
                                    const groupRate = groupAttendances.length > 0 ? Math.round((groupPresent / groupAttendances.length) * 100) : 0;
                                    
                                    return (
                                        <div 
                                            key={group.id} 
                                            onClick={() => navigate(`/groups/${group.id}`)} 
                                            className="group border border-slate-100 bg-white rounded-3xl p-8 hover:border-[#5C67F2] transition-all cursor-pointer relative overflow-hidden flex flex-col h-full hover:shadow-2xl hover:shadow-indigo-100/50 active:scale-[0.98]"
                                        >
                                            <div className="flex items-start justify-between mb-8">
                                                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-[#5C67F2] group-hover:bg-[#5C67F2] group-hover:text-white transition-all duration-500 shadow-sm">
                                                    <BookOpen className="w-7 h-7" />
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest mb-2 border border-emerald-100">Faol</span>
                                                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest tracking-tighter truncate max-w-[120px]">{group.schedule}</span>
                                                </div>
                                            </div>

                                            <h3 className="text-2xl font-black text-slate-800 mb-4 group-hover:text-[#5C67F2] transition-colors tracking-tight">{group.name}</h3>
                                            
                                            <div className="grid grid-cols-2 gap-4 mt-auto">
                                                <div className="bg-slate-50 group-hover:bg-indigo-50/50 p-4 rounded-2xl transition-all">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">O'quvchilar</p>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Users className="w-4 h-4 text-indigo-400" />
                                                        <span className="text-slate-800 font-black text-lg">{groupStudents.length}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 group-hover:bg-indigo-50/50 p-4 rounded-2xl transition-all">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Davomat</p>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                                                        <span className="text-slate-800 font-black text-lg">{groupRate}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color, trend }: { icon: React.ReactNode, label: string, value: string | number, color: string, trend: string }) {
    const colorClasses = {
        emerald: "bg-emerald-50 border-emerald-100",
        rose: "bg-rose-50 border-rose-100",
        amber: "bg-amber-50 border-amber-100",
        indigo: "bg-indigo-50 border-indigo-100",
    }[color as 'emerald' | 'rose' | 'amber' | 'indigo'];

    return (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-lg shadow-slate-200/40 relative overflow-hidden flex flex-col gap-4 group">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClasses.split(' ')[0]} transition-all group-hover:scale-110 duration-500`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <h4 className="text-xl font-black text-slate-800 tabular-nums tracking-tight truncate">{value}</h4>
                <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-slate-300" />
                    {trend}
                </div>
            </div>
        </div>
    );
}

function Clock({ className }: { className: string }) {
    return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
