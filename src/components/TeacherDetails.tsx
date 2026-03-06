import React from 'react';
import { Calendar, Phone, MapPin, Layers, Users, BookOpen, ArrowLeft } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useParams, useNavigate } from 'react-router-dom';

export default function TeacherDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { teachers, groups, students } = useCRM();

    const teacher = teachers.find(t => t.id === Number(id));

    if (!teacher) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
                <p className="text-slate-400 font-bold italic">O'qituvchi topilmadi</p>
                <button onClick={() => navigate('/teachers')} className="mt-4 text-indigo-500 font-bold hover:underline">Orqaga qaytish</button>
            </div>
        );
    }

    const teacherGroups = groups.filter(g => g.teacherId === id);
    const totalStudents = students.filter(s => g => teacherGroups.some(tg => tg.id === g)).length; // Simplified for now
    // A better way to count unique students in teacher's groups:
    const teacherStudentIds = new Set();
    teacherGroups.forEach(g => {
        students.forEach(s => {
            if (s.groups.includes(g.id)) teacherStudentIds.add(s.id);
        });
    });

    return (
        <div className="max-w-[1600px] mx-auto">
            {/* Back button and title */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-slate-800">{teacher.name}</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Profile Card */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm overflow-hidden">
                        <h2 className="text-lg font-bold text-slate-800 mb-6 uppercase tracking-widest text-xs opacity-50">O'qituvchi profili</h2>

                        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100 mb-6">
                            <div className="w-24 h-24 bg-[#5C67F2] text-white rounded-2xl flex items-center justify-center text-4xl font-black mb-4 shadow-xl shadow-indigo-100">
                                {teacher.name.charAt(0)}
                            </div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">{teacher.name}</h3>
                            <p className="text-sm text-indigo-500 font-bold mt-1 uppercase tracking-tighter">O'qituvchi</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-slate-600">
                                <Calendar className="w-5 h-5 text-slate-400" />
                                <span className="text-sm font-medium">Ishga kirgan: <strong className="text-slate-800 ml-1">{teacher.hiredDate}</strong></span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <BookOpen className="w-5 h-5 text-slate-400" />
                                <span className="text-sm font-medium">Ish haqi (ulush): <strong className="text-slate-800 ml-1">{teacher.sharePercentage}%</strong></span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <Layers className="w-5 h-5 text-slate-400" />
                                <span className="text-sm font-medium">Faol guruhlar: <strong className="text-slate-800 ml-1">{teacherGroups.length}</strong></span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <Users className="w-5 h-5 text-slate-400" />
                                <span className="text-sm font-medium">O'quvchilar soni: <strong className="text-slate-800 ml-1">{teacherStudentIds.size}</strong></span>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <h4 className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest">Kontakt</h4>
                            <div className="flex items-center gap-3 text-slate-800 font-bold">
                                <Phone className="w-5 h-5 text-[#5C67F2]" />
                                <span>{teacher.phone}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Groups Card */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-lg font-bold text-slate-800 uppercase tracking-widest text-xs opacity-50">Guruhlar ro'yxati</h2>
                        </div>

                        {teacherGroups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                                <Layers className="w-16 h-16 mb-4" />
                                <p className="font-bold italic">Hozircha guruhlar yo'q</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {teacherGroups.map(group => {
                                    const groupStudents = students.filter(s => s.groups.includes(group.id));
                                    return (
                                        <div key={group.id} onClick={() => navigate(`/groups/${group.id}`)} className="border border-slate-100 bg-slate-50/50 rounded-2xl p-6 hover:border-[#5C67F2] hover:bg-white hover:shadow-xl hover:shadow-indigo-50 transition-all cursor-pointer group relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 -mr-8 -mt-8 rounded-full"></div>
                                            <div className="flex items-start justify-between mb-4 relative z-10">
                                                <h3 className="text-xl font-black text-slate-800 group-hover:text-[#5C67F2] transition-colors tracking-tight">{group.name}</h3>
                                                <span className="bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest">{group.courseId}</span>
                                            </div>

                                            <div className="space-y-3 mb-6 relative z-10">
                                                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                                                    <Clock className="w-4 h-4 text-indigo-400" />
                                                    <span>{group.schedule}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                                                    <Calendar className="w-4 h-4 text-indigo-400" />
                                                    <span>{group.days}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 relative z-10">
                                                <span className="px-3 py-1.5 rounded-xl border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-white shadow-sm">
                                                    <Users className="w-3.5 h-3.5" />
                                                    O'quvchilar: {groupStudents.length}
                                                </span>
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

function Clock({ className }: { className: string }) {
    return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
