import React, { useState } from 'react';
import { Search, Plus, FileSpreadsheet, Monitor, MoreVertical, X } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useNavigate } from 'react-router-dom';

const timeSlots = ["08:00 - 09:30", "09:30 - 11:00", "11:00 - 12:30", "14:00 - 15:30", "15:30 - 17:00", "17:00 - 18:30", "19:00 - 20:30"];

export default function Groups() {
    const { groups, teachers, courses, rooms, addGroup } = useCRM();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newGroup, setNewGroup] = useState({
        name: '',
        teacherId: 0,
        courseId: '',
        schedule: timeSlots[0],
        days: 'Juft kunlar',
        room: ''
    });

    const handleAddGroup = (e: React.FormEvent) => {
        e.preventDefault();
        addGroup({
            ...newGroup,
            studentIds: []
        });
        setIsModalOpen(false);
        setNewGroup({ name: '', teacherId: 0, courseId: '', schedule: '', days: 'Juft kunlar' });
    };

    const getTeacherName = (id: number) => teachers.find(t => t.id === id)?.name || 'Noma\'ulum';

    return (
        <div className="max-w-[1600px] mx-auto">
            {/* Header Info */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Guruhlar</h1>
                    <div className="w-8 h-8 rounded-full border border-indigo-100 flex items-center justify-center text-indigo-500 font-medium text-sm bg-white shadow-sm">
                        {groups.length}
                    </div>
                </div>

                <button className="flex items-center gap-2 px-6 py-2.5 bg-[#5C67F2] text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors shadow-sm" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4" />
                    YANGI QO'SHISH
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="relative flex-1 min-w-[200px]">
                    <input type="text" placeholder="Qidirish" className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                    <Search className="absolute right-3 top-2.5 text-slate-400 w-5 h-5" />
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-600 border border-green-200 rounded-lg text-sm font-semibold hover:bg-green-100 transition-colors">
                    <FileSpreadsheet className="w-4 h-4" />
                    EXCEL
                </button>
            </div>

            {/* Table */}
            <div className="bg-[#F8FAFC] rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600 w-16">ID</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">Guruh nomi</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">Kurs</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">O'qituvchi</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">Dars Kunlari</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">Dars vaqti</th>
                            <th className="p-4 border-b border-slate-200 text-xs font-semibold text-slate-600">O'quvchilar soni</th>
                            <th className="p-4 border-b border-slate-200 text-xs w-12 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {groups.map((group, idx) => (
                            <tr key={group.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => navigate(`/groups/${group.id}`)}>
                                <td className="p-4 border-b border-slate-100 text-sm font-medium text-slate-600">{idx + 1}.</td>
                                <td className="p-4 border-b border-slate-100 text-sm font-bold text-slate-800">{group.name}</td>
                                <td className="p-4 border-b border-slate-100 text-sm font-bold text-slate-800 uppercase">{group.courseId}</td>
                                <td className="p-4 border-b border-slate-100 text-sm font-bold text-slate-800">{getTeacherName(group.teacherId)}</td>
                                <td className="p-4 border-b border-slate-100 text-sm font-bold text-slate-700">{group.days}</td>
                                <td className="p-4 border-b border-slate-100 text-sm font-bold text-slate-700">{group.schedule}</td>
                                <td className="p-4 border-b border-slate-100 text-sm font-medium text-slate-600 text-center">{group.studentIds.length}</td>
                                <td className="p-4 border-b border-slate-100 text-center">
                                    <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded opacity-0 group-hover:opacity-100 transition-all">
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add Group Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800">Yangi guruh ochish</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleAddGroup} className="p-8 space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">Guruh nomi</label>
                                <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">O'qituvchi</label>
                                <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newGroup.teacherId} onChange={e => setNewGroup({ ...newGroup, teacherId: Number(e.target.value) })}>
                                    <option value="">Tanlang</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">Kurs</label>
                                    <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={newGroup.courseId} onChange={e => setNewGroup({ ...newGroup, courseId: e.target.value })}>
                                        <option value="">Tanlang</option>
                                        {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">Kunlar</label>
                                    <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={newGroup.days} onChange={e => setNewGroup({ ...newGroup, days: e.target.value })}>
                                        <option>Juft kunlar</option>
                                        <option>Toq kunlar</option>
                                        <option>Har kuni</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">Dars vaqti</label>
                                    <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={newGroup.schedule} onChange={e => setNewGroup({ ...newGroup, schedule: e.target.value })}>
                                        {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">Xona</label>
                                    <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={newGroup.room} onChange={e => setNewGroup({ ...newGroup, room: e.target.value })}>
                                        <option value="">Tanlang</option>
                                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="w-full py-4 bg-[#5C67F2] text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-600 transition-all mt-4 uppercase tracking-widest text-sm">
                                SAQLASH
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
