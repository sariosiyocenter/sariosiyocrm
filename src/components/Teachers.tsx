import React, { useState } from 'react';
import { MessageSquare, Plus, Search, MoreVertical, X } from 'lucide-react';
import { useCRM } from '../context/CRMContext';

export default function Teachers({ onNavigate }: { onNavigate: (page: string, id: number | null) => void }) {
    const { teachers, addTeacher } = useCRM();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTeacher, setNewTeacher] = useState({ name: '', phone: '', salary: 0, sharePercentage: 0, birthDate: '', hiredDate: '' });

    const handleAddTeacher = (e: React.FormEvent) => {
        e.preventDefault();
        addTeacher({
            ...newTeacher,
            lessonFee: 0,
            status: 'Faol'
        });
        setIsModalOpen(false);
        setNewTeacher({ name: '', phone: '', salary: 0, sharePercentage: 0, birthDate: '', hiredDate: '' });
    };

    return (
        <div className="max-w-[1600px] mx-auto">
            {/* Header Info */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Mentorlar</h1>
                    <div className="w-8 h-8 rounded-full border border-indigo-100 flex items-center justify-center text-indigo-500 font-medium text-sm">
                        {teachers.length}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-[#5C67F2] text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors shadow-sm" onClick={() => setIsModalOpen(true)}>
                        <Plus className="w-4 h-4" />
                        YANGI QO'SHISH
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 mb-6">
                <button className="px-6 py-3 text-sm font-semibold text-[#5C67F2] border-b-2 border-[#5C67F2] uppercase tracking-wider">
                    O'QITUVCHILAR
                </button>
            </div>

            {/* Table */}
            <div className="bg-[#F8FAFC] rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600 w-16">ID</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">Rasm Ism familiya</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">Telefon raqam</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">Doimiy oylik</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">Foiz ulush (%)</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">Ishga olingan sana</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600 w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {teachers.map((teacher, idx) => (
                            <tr key={teacher.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => onNavigate("O'qituvchilar", teacher.id)}>
                                <td className="p-4 border-b border-slate-100 text-sm text-slate-600 font-medium">{idx + 1}.</td>
                                <td className="p-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 overflow-hidden text-indigo-500 font-bold text-xs uppercase">
                                            {teacher.name.charAt(0)}
                                        </div>
                                        <span className="text-sm font-medium text-slate-700">{teacher.name}</span>
                                    </div>
                                </td>
                                <td className="p-4 border-b border-slate-100 text-sm text-slate-600 font-medium">{teacher.phone}</td>
                                <td className="p-4 border-b border-slate-100 text-sm text-slate-600 font-medium">{teacher.salary.toLocaleString()} UZS</td>
                                <td className="p-4 border-b border-slate-100 text-sm text-slate-600 font-medium">{teacher.sharePercentage} %</td>
                                <td className="p-4 border-b border-slate-100 text-sm text-slate-600 font-medium">{teacher.hiredDate}</td>
                                <td className="p-4 border-b border-slate-100 text-sm text-slate-400">
                                    <button className="p-1 hover:bg-slate-200 rounded text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add Teacher Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800">Yangi o'qituvchi qo'shish</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleAddTeacher} className="p-8 grid grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">Ism familiya</label>
                                <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newTeacher.name} onChange={e => setNewTeacher({ ...newTeacher, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">Telefon</label>
                                <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newTeacher.phone} onChange={e => setNewTeacher({ ...newTeacher, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">Doimiy oylik</label>
                                <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newTeacher.salary} onChange={e => setNewTeacher({ ...newTeacher, salary: Number(e.target.value) })} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">Ishga olingan sana</label>
                                <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newTeacher.hiredDate} onChange={e => setNewTeacher({ ...newTeacher, hiredDate: e.target.value })} />
                            </div>
                            <button type="submit" className="col-span-2 py-4 bg-[#5C67F2] text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-600 transition-all mt-4 uppercase tracking-widest text-sm">
                                SAQLASH
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
