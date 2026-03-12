import React, { useState } from 'react';
import {
    ArrowLeft, User, Phone, Calendar,
    MapPin, BookOpen, CreditCard,
    Clock, CheckCircle, XCircle, MoreVertical,
    Plus, Edit2, MessageSquare, Trash2, Map, Award, ClipboardCheck
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useParams, useNavigate } from 'react-router-dom';

export default function StudentDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { students, groups, teachers, payments, attendances, scores, addPayment, addAttendance, addScore, updateStudent } = useCRM();
    const [activeTab, setActiveTab] = useState('umumiy');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const [showScoreModal, setShowScoreModal] = useState(false);

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

    const studentPayments = payments.filter(p => p.studentId === Number(id)).reverse();
    const studentAttendances = (attendances || []).filter(a => a.studentId === Number(id)).reverse();
    const studentScores = (scores || []).filter(s => s.studentId === Number(id)).reverse();

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
                                {student.photo ? (
                                    <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                                ) : (
                                    student.name.charAt(0)
                                )}
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
                            {student.location && <InfoRow icon={<Map className="w-4 h-4" />} label="Lokatsiya" value={student.location} />}
                            <InfoRow icon={<Clock className="w-4 h-4" />} label="A'zo bo'ldi" value={student.joinedDate} />
                        </div>
                    </div>
                </div>

                {/* Right Column: Details Tabs */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex border-b border-slate-100 px-6">
                            <TabButton label="Umumiy" active={activeTab === 'umumiy'} onClick={() => setActiveTab('umumiy')} />
                            <TabButton label="Guruhlar" active={activeTab === 'guruhlar'} onClick={() => setActiveTab('guruhlar')} />
                            <TabButton label="To'lovlar" active={activeTab === 'tolovlar'} onClick={() => setActiveTab('tolovlar')} />
                            <TabButton label="Yo'qlama" active={activeTab === 'yoqlama'} onClick={() => setActiveTab('yoqlama')} />
                            <TabButton label="Ballar" active={activeTab === 'ballar'} onClick={() => setActiveTab('ballar')} />
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
                                                    <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-100 px-2 py-1 rounded-md">{p.type}</span>
                                                </div>
                                            ))}
                                            {studentPayments.length === 0 && <p className="text-sm text-slate-400 italic">To'lovlar tarixi mavjud emas</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'tolovlar' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Barcha to'lovlar</h4>
                                        <button
                                            onClick={() => setShowPaymentModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-colors shadow-sm"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>TO'LOV QO'SHISH</span>
                                        </button>
                                    </div>
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
                                                            <CreditCard className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700">{p.amount.toLocaleString()} UZS</p>
                                                            <p className="text-xs text-slate-400 font-medium">{p.date}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[11px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider">{p.type}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'guruhlar' && (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">O'quvchi guruhlari</h4>
                                        <button
                                            onClick={() => setShowGroupModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-colors shadow-sm"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>GURUHGA QO'SHISH</span>
                                        </button>
                                    </div>
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
                                </div>
                            )}

                            {activeTab === 'yoqlama' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Yo'qlama tarixi</h4>
                                        <button
                                            onClick={() => setShowAttendanceModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-colors shadow-sm"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>YO'QLAMA QILISH</span>
                                        </button>
                                    </div>
                                    {studentAttendances.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 italic">
                                            <ClipboardCheck className="w-10 h-10 text-slate-200 mb-4" />
                                            <p>Yo'qlama ma'lumotlari mavjud emas</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {studentAttendances.map(a => (
                                                <div key={a.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.status === 'Keldi' ? 'bg-green-50 text-green-500' : a.status === 'Kelmapdi' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                                                            {a.status === 'Keldi' ? <CheckCircle className="w-5 h-5" /> : a.status === 'Kelmapdi' ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700">{a.status}</p>
                                                            <p className="text-xs text-slate-400">{a.date}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Guruh: {groups.find(g => g.id === a.groupId)?.name || 'Noma\'lum'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'ballar' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Ballar va natijalar</h4>
                                        <button
                                            onClick={() => setShowScoreModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-colors shadow-sm"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>BALL QO'SHISH</span>
                                        </button>
                                    </div>
                                    {studentScores.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 italic">
                                            <Award className="w-10 h-10 text-slate-200 mb-4" />
                                            <p>Ballar tarixi mavjud emas</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {studentScores.map(s => (
                                                <div key={s.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                                                            <Award className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-black text-slate-700">{s.value} ball</p>
                                                                {s.comment && <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md italic">{s.comment}</span>}
                                                            </div>
                                                            <p className="text-xs text-slate-400">{s.date}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Guruh: {groups.find(g => g.id === s.groupId)?.name || 'Noma\'lum'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals for Management */}
            {showPaymentModal && (
                <PaymentAddModal
                    studentId={student.id}
                    onClose={() => setShowPaymentModal(false)}
                    onAdd={(data) => addPayment(data)}
                />
            )}

            {showGroupModal && (
                <GroupAddModal
                    studentId={student.id}
                    currentGroups={student.groups || []}
                    availableGroups={groups}
                    onClose={() => setShowGroupModal(false)}
                    onAdd={async (groupId) => {
                        const newGroups = [...(student.groups || []), groupId];
                        await updateStudent(student.id, { groups: newGroups });
                    }}
                />
            )}

            {showAttendanceModal && (
                <AttendanceAddModal
                    studentId={student.id}
                    studentGroups={studentGroups}
                    onClose={() => setShowAttendanceModal(false)}
                    onAdd={(data) => addAttendance(data)}
                />
            )}

            {showScoreModal && (
                <ScoreAddModal
                    studentId={student.id}
                    studentGroups={studentGroups}
                    onClose={() => setShowScoreModal(false)}
                    onAdd={(data) => addScore(data)}
                />
            )}
        </div>
    );
}

function PaymentAddModal({ studentId, onClose, onAdd }: { studentId: number, onClose: () => void, onAdd: (data: any) => void }) {
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('Naqd');
    const [desc, setDesc] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd({
            studentId,
            amount: Number(amount),
            type,
            date: new Date().toISOString().split('T')[0],
            description: desc
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">To'lov qo'shish</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"><XCircle className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Summa (UZS)</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            placeholder="Masalan: 500000"
                            className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">To'lov turi</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        >
                            <option value="Naqd">Naqd</option>
                            <option value="Karta">Karta</option>
                            <option value="Peyme">Peyme</option>
                            <option value="Klik">Klik</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Izoh</label>
                        <textarea
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            rows={2}
                            className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
                        />
                    </div>
                    <button type="submit" className="w-full py-4 bg-[#5C67F2] text-white font-black rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:translate-y-[-2px] tracking-widest mt-4">SAQLASH</button>
                </form>
            </div>
        </div>
    );
}

function GroupAddModal({ studentId, currentGroups, availableGroups, onClose, onAdd }: { studentId: number, currentGroups: number[], availableGroups: any[], onClose: () => void, onAdd: (groupId: number) => void }) {
    const options = availableGroups.filter(g => !currentGroups.includes(g.id));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Guruhga qo'shish</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"><XCircle className="w-6 h-6" /></button>
                </div>
                <div className="p-6 max-h-[400px] overflow-y-auto space-y-2">
                    {options.length === 0 ? (
                        <p className="text-center text-slate-400 italic py-10">Barcha guruhlarga allaqachon a'zo</p>
                    ) : (
                        options.map(g => (
                            <button
                                key={g.id}
                                onClick={() => { onAdd(g.id); onClose(); }}
                                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-100 border border-transparent rounded-2xl transition-all group"
                            >
                                <div className="text-left">
                                    <p className="text-sm font-black text-slate-800 group-hover:text-indigo-600">{g.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{g.days} | {g.schedule}</p>
                                </div>
                                <Plus className="w-5 h-5 text-slate-300 group-hover:text-indigo-500" />
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function AttendanceAddModal({ studentId, studentGroups, onClose, onAdd }: { studentId: number, studentGroups: any[], onClose: () => void, onAdd: (data: any) => void }) {
    const [groupId, setGroupId] = useState(studentGroups[0]?.id || '');
    const [status, setStatus] = useState('Keldi');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupId) return;
        onAdd({
            studentId,
            groupId: Number(groupId),
            date: new Date().toISOString().split('T')[0],
            status
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Yo'qlama qilish</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"><XCircle className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Guruhni tanlang</label>
                        <select
                            value={groupId}
                            onChange={(e) => setGroupId(e.target.value)}
                            required
                            className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        >
                            <option value="">Tanlang...</option>
                            {studentGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Holati</label>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                            {['Keldi', 'Kelmapdi', 'Sababli'].map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setStatus(s)}
                                    className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${status === s
                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-600 shadow-sm'
                                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button type="submit" className="w-full py-4 bg-[#5C67F2] text-white font-black rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:translate-y-[-2px] tracking-widest mt-4">SAQLASH</button>
                </form>
            </div>
        </div>
    );
}

function ScoreAddModal({ studentId, studentGroups, onClose, onAdd }: { studentId: number, studentGroups: any[], onClose: () => void, onAdd: (data: any) => void }) {
    const [groupId, setGroupId] = useState(studentGroups[0]?.id || '');
    const [value, setValue] = useState('');
    const [comment, setComment] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupId) return;
        onAdd({
            studentId,
            groupId: Number(groupId),
            date: new Date().toISOString().split('T')[0],
            value: Number(value),
            comment
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Ball qo'shish</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"><XCircle className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Guruhni tanlang</label>
                        <select
                            value={groupId}
                            onChange={(e) => setGroupId(e.target.value)}
                            required
                            className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        >
                            <option value="">Tanlang...</option>
                            {studentGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ball qiymati</label>
                        <input
                            type="number"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            required
                            placeholder="Masalan: 85"
                            className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 shadow-inner"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Komentariya</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={2}
                            placeholder="Imtihon natijasi, darsdagi faollik..."
                            className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 shadow-inner"
                        />
                    </div>
                    <button type="submit" className="w-full py-4 bg-[#5C67F2] text-white font-black rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:translate-y-[-2px] tracking-widest mt-4">SAQLASH</button>
                </form>
            </div>
        </div>
    );
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
