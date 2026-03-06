import React, { useState } from 'react';
import { Search, Plus, FileSpreadsheet, MessageSquare, MoreVertical, X } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';

export default function Students() {
    const { students, groups, teachers, addStudent } = useCRM();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: '', phone: '', address: '', birthDate: '' });

    const handleAddStudent = (e: React.FormEvent) => {
        e.preventDefault();
        addStudent({
            ...newStudent,
            status: 'Faol',
            joinedDate: new Date().toISOString().split('T')[0],
            balance: 0,
            groups: []
        });
        setIsModalOpen(false);
        setNewStudent({ name: '', phone: '', address: '', birthDate: '' });
    };

    const getStudentGroups = (studentGroupIds: number[]) => {
        return groups.filter(g => studentGroupIds.includes(g.id)).map(g => {
            const teacher = teachers.find(t => t.id === g.teacherId);
            return {
                ...g, teacherName: teacher?.name || "Noma'ulum"
            };
        });
    };

    return (
        <div className="max-w-[1600px] mx-auto">
            {/* Header Info */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">O'quvchilar</h1>
                    <div className="border border-indigo-100 px-4 py-1.5 rounded-full text-indigo-500 font-medium text-sm bg-white shadow-sm">
                        O'quvchilar soni: {students.length} ta
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white text-green-500 border border-green-200 rounded-lg text-sm font-semibold hover:bg-green-50 transition-colors">
                        <FileSpreadsheet className="w-4 h-4" />
                        EXCEL
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-[#5C67F2] text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-indigo-600 transition-colors" onClick={() => setIsModalOpen(true)}>
                        <Plus className="w-4 h-4" />
                        YANGI QO'SHISH
                    </button>
                </div>
            </div>

            {/* Filters row 2 */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="relative flex-1 min-w-[150px]">
                    <input type="text" placeholder="Qidirish" className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                    <Search className="absolute right-3 top-2.5 text-slate-400 w-4 h-4" />
                </div>
                <select className="w-40 appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-400 outline-none cursor-pointer">
                    <option>Kurslar</option>
                </select>
                <div className="relative w-40">
                    <label className="absolute -top-2 left-3 bg-[#F5F7FA] px-1 text-[11px] font-medium text-slate-400 z-10">Holati</label>
                    <select className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer relative z-0">
                        <option>Faol</option>
                        <option>Arxiv</option>
                        <option>Sinov</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#F8FAFC] rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                        <tr>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600 w-12">ID</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">Ism familiya</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">Telefon</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">A'zo bo'ldi</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">Guruhlar</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600 text-center">Balans</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600 text-center">Harakatlar</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {students.map((student, idx) => (
                            <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-4 border-b border-slate-100 text-sm font-medium text-slate-600">{idx + 1}</td>
                                <td className="p-4 border-b border-slate-100">
                                    <div
                                        className="flex items-center gap-3 cursor-pointer group/name"
                                        onClick={() => navigate(`/students/${student.id}`)}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 overflow-hidden text-indigo-500 group-hover/name:border-indigo-500 transition-all font-bold text-xs uppercase">
                                            {student.name.charAt(0)}
                                        </div>
                                        <span className="text-sm font-bold text-slate-700 group-hover/name:text-indigo-600 transition-colors">{student.name}</span>
                                    </div>
                                </td>
                                <td className="p-4 border-b border-slate-100 text-sm font-medium text-slate-600">{student.phone}</td>
                                <td className="p-4 border-b border-slate-100 text-sm font-medium text-slate-600">{student.joinedDate}</td>
                                <td className="p-4 border-b border-slate-100">
                                    <div className="flex flex-col gap-1">
                                        {getStudentGroups(student.groups).map(g => (
                                            <div key={g.id} className="text-[11px]">
                                                <span className="font-bold text-slate-700">{g.name}</span>
                                                <span className="text-slate-400 ml-1">({g.teacherName})</span>
                                            </div>
                                        ))}
                                        {student.groups.length === 0 && <span className="text-xs text-slate-300 italic">Hali yo'q</span>}
                                    </div>
                                </td>
                                <td className="p-4 border-b border-slate-100 text-center">
                                    <div className="flex flex-col items-center gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${student.status === 'Faol' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                            {student.status}
                                        </span>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${student.balance >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-500'}`}>
                                            {student.balance.toLocaleString()}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4 border-b border-slate-100 text-center">
                                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add Student Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800">Yangi o'quvchi qo'shish</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleAddStudent} className="p-8 grid grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ism familiya</label>
                                <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Telefon</label>
                                <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    placeholder="+998" value={newStudent.phone} onChange={e => setNewStudent({ ...newStudent, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tug'ilgan sana</label>
                                <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    value={newStudent.birthDate} onChange={e => setNewStudent({ ...newStudent, birthDate: e.target.value })} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Manzil</label>
                                <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    value={newStudent.address} onChange={e => setNewStudent({ ...newStudent, address: e.target.value })} />
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
