import React, { useState } from 'react';
import {
    ArrowLeft, Phone, Calendar, MapPin, BookOpen, CreditCard,
    Clock, CheckCircle, XCircle, Plus, Award, ClipboardCheck, Users, Layers, ChevronRight, TrendingUp, Save, Edit, Bus, Sparkles, Image as ImageIcon, Camera, X, Send
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useParams, useNavigate } from 'react-router-dom';
import MapPicker from './MapPicker';
import PhotoCapture from './PhotoCapture';

export default function StudentDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { students, groups, teachers, courses, payments, attendances, scores, transports, addPayment, addAttendance, addScore, updateStudent, addStudentToGroup } = useCRM();
    const [activeTab, setActiveTab] = useState('umumiy');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const [showScoreModal, setShowScoreModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isRemovingBg, setIsRemovingBg] = useState(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [showSmsModal, setShowSmsModal] = useState(false);
    const [smsData, setSmsData] = useState({ phone: '', type: '' });

    const handlePhotoCapture = (base64: string) => {
        updateStudent(student!.id, { photo: base64 });
    };
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        status: 'Faol' as 'Faol' | 'Arxiv' | 'Sinov',
        phone: '',
        birthDate: '',
        address: '',
        location: '',
        fatherName: '',
        fatherPhone: '',
        motherName: '',
        motherPhone: '',
        transportId: '' as string | number,
        studentSchool: ''
    });

    const student = students.find(s => s.id === Number(id));

    if (!student) {
        return (
            <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                <div className="w-20 h-20 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-gray-600">
                    <Users className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                </div>
                <p className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-xs">O'quvchi topilmadi</p>
                <button onClick={() => navigate('/students')} className="mt-6 text-sky-600 dark:text-sky-400 font-bold uppercase tracking-widest text-[10px] hover:underline px-6 py-2 bg-sky-50 dark:bg-sky-900/30 rounded-xl transition-all">Orqaga qaytish</button>
            </div>
        );
    }

    const studentGroups = groups.filter(g => (student.groups || []).includes(g.id)).map(g => {
        const teacher = teachers.find(t => t.id === g.teacherId);
        const course = courses.find(c => c.id === g.courseId);
        return { ...g, teacherName: teacher?.name || "Noma'lum", courseName: course?.name || '-' };
    });

    const studentPayments = payments.filter(p => p.studentId === Number(id)).reverse();
    const studentAttendances = (attendances || []).filter(a => a.studentId === Number(id)).reverse();
    const studentScores = (scores || []).filter(s => s.studentId === Number(id)).reverse();

    const handleOpenMap = () => {
        if (!student.location) return;
        const [lat, lng] = student.location.split(',');
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    };

    const handleStartEdit = () => {
        setEditForm({
            name: student.name,
            status: student.status,
            phone: student.phone,
            birthDate: student.birthDate,
            address: student.address,
            location: student.location || '',
            fatherName: student.fatherName || '',
            fatherPhone: student.fatherPhone || '',
            motherName: student.motherName || '',
            motherPhone: student.motherPhone || '',
            transportId: student.transportId || '',
            studentSchool: student.studentSchool || ''
        });
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        try {
            setIsSaving(true);
            await updateStudent(student.id, {
                ...editForm,
                transportId: editForm.transportId ? Number(editForm.transportId) : null
            });
            setIsEditing(false);
        } catch (err) {
            console.error("Update failed", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveBg = async () => {
        if (!student.photo) return;
        try {
            setIsRemovingBg(true);
            const token = localStorage.getItem('token');
            const response = await fetch('/api/utils/remove-bg', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ image: student.photo })
            });
            
            const data = await response.json();
            if (data.success) {
                await updateStudent(student.id, { photo: data.image });
                alert("Orqa fon muvaffaqiyatli tozalandi!");
            } else {
                alert("Xatolik: " + data.error);
            }
        } catch (err) {
            console.error("BG Removal failed", err);
            alert("Xatolik yuz berdi");
        } finally {
            setIsRemovingBg(false);
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateStudent(student.id, { photo: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };
    const handleSendSms = (phone: string, type: string) => {
        if (!phone) {
            alert("Telefon raqami mavjud emas");
            return;
        }
        setSmsData({ phone, type });
        setShowSmsModal(true);
    };

    const confirmSendSms = async (message: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/sms/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    phone: smsData.phone, 
                    message, 
                    type: smsData.type, 
                    studentId: student.id 
                })
            });
            const data = await response.json();
            
            if (data.success) {
                alert("SMS muvaffaqiyatli yuborildi");
            } else {
                alert("Xatolik: " + (data.error || data.message || "Noma'lum xatolik"));
            }
        } catch (err: any) {
            console.error("SMS xatoligi:", err);
            alert("SMS yuborishda xatolik yuz berdi: " + err.message);
        }
    };

    // Stats calculations
    const avgScore = studentScores.length ? (studentScores.reduce((a, b) => a + b.value, 0) / studentScores.length).toFixed(1) : '0';
    const attendanceRate = studentAttendances.length ? ((studentAttendances.filter(a => a.status === 'Keldi').length / studentAttendances.length) * 100).toFixed(0) : '0';

    return (
        <div className="max-w-[1400px] mx-auto space-y-8">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors text-xs font-bold uppercase tracking-widest">
                <ArrowLeft className="w-4 h-4" />
                Orqaga
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Profile Card */}
                <div className="lg:col-span-1 border-r border-gray-100 dark:border-gray-800 pr-0 lg:pr-8">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
                        <div className="bg-gradient-to-br from-sky-500 to-sky-600 h-24 relative">
                            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-24 h-24 rounded-3xl border-4 border-white dark:border-gray-800 overflow-hidden shadow-xl bg-white dark:bg-gray-800 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-3xl transition-colors">
                                {student.photo ? (
                                    <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                                ) : (
                                    student.name.charAt(0)
                                )}
                            </div>
                        </div>
                        <div className="pt-16 pb-8 px-6 text-center">
                            {isEditing ? (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">Ism Familiya</label>
                                        <input 
                                            value={editForm.name}
                                            onChange={e => setEditForm({...editForm, name: e.target.value})}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold text-center outline-none focus:border-sky-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">Holati</label>
                                        <select 
                                            value={editForm.status}
                                            onChange={e => setEditForm({...editForm, status: e.target.value as any})}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:border-sky-500 text-center"
                                        >
                                            <option value="Faol">Faol</option>
                                            <option value="Sinov">Sinov</option>
                                            <option value="Arxiv">Arxiv</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-1">Transport</label>
                                        <select 
                                            value={editForm.transportId}
                                            onChange={e => setEditForm({...editForm, transportId: e.target.value})}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:border-sky-500 text-center transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">Transport yo'q</option>
                                            {transports.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} ({t.number})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-center gap-2">
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{student.name}</h2>
                                        <button onClick={handleStartEdit} className="p-1.5 text-gray-300 hover:text-sky-500 transition-colors">
                                            <Edit size={14} />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">ID: #{student.id}</p>
                                    <div className="mt-4 flex flex-col items-center gap-3">
                                        <span className={`px-4 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${student.status === 'Faol' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100/50 dark:border-rose-800/50'}`}>
                                            {student.status}
                                        </span>
                                    </div>
                                </>
                            )}
                            <div className="mt-4 flex flex-col items-center gap-3">
                                <div className={`px-5 py-3 rounded-2xl w-full flex flex-col items-center border border-transparent transition-colors ${student.balance >= 0 ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-100/50 dark:border-sky-800/30' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100/50 dark:border-rose-800/30'}`}>
                                   <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 leading-none">Balans</span>
                                   <span className="text-lg font-bold tabular-nums">
                                      {student.balance.toLocaleString()} 
                                      <span className="text-[10px] ml-1 uppercase opacity-60">UZS</span>
                                   </span>
                                </div>
                            </div>

                             <div className="mt-6 px-6 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="relative flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all group">
                                        <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                        <ImageIcon size={16} className="text-gray-400 group-hover:text-sky-500" />
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Yuklash</span>
                                    </label>
                                    
                                    <button 
                                        onClick={() => setIsPhotoModalOpen(true)}
                                        className="flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl hover:bg-white dark:hover:bg-gray-800 transition-all group"
                                    >
                                        <Camera size={16} className="text-gray-400 group-hover:text-emerald-500" />
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Rasmga olish</span>
                                    </button>
                                </div>
                                
                                {student.photo && (
                                    <button 
                                        onClick={handleRemoveBg}
                                        disabled={isRemovingBg}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/50 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-violet-600 hover:text-white transition-all disabled:opacity-50"
                                    >
                                        <Sparkles size={14} className={isRemovingBg ? 'animate-spin' : ''} />
                                        {isRemovingBg ? 'Tozalanmoqda...' : 'Fonni tozalash (AI)'}
                                    </button>
                                )}
                            </div>

                            {/* Photo Capture Modal */}
                            {isPhotoModalOpen && (
                                <PhotoCapture
                                    onCapture={handlePhotoCapture}
                                    onClose={() => setIsPhotoModalOpen(false)}
                                />
                            )}
                        </div>
                        <div className="border-t border-dashed border-gray-100 dark:border-gray-700 px-6 pt-8 pb-12 space-y-7 transition-colors">
                            {isEditing ? (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Telefon</label>
                                        <input 
                                            type="tel" 
                                            value={editForm.phone}
                                            onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:border-sky-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Tug'ilgan kun</label>
                                        <input 
                                            type="date" 
                                            value={editForm.birthDate}
                                            onChange={e => setEditForm({...editForm, birthDate: e.target.value})}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:border-sky-500 text-gray-600"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Manzil</label>
                                        <input 
                                            type="text" 
                                            value={editForm.address}
                                            onChange={e => setEditForm({...editForm, address: e.target.value})}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:border-sky-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Maktab</label>
                                        <input 
                                            type="text" 
                                            value={editForm.studentSchool}
                                            onChange={e => setEditForm({...editForm, studentSchool: e.target.value})}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:border-sky-500"
                                            placeholder="Masalan: 45-maktab"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Otasi ismi</label>
                                            <input 
                                                type="text" 
                                                value={editForm.fatherName}
                                                onChange={e => setEditForm({...editForm, fatherName: e.target.value})}
                                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:border-sky-500"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Otasi tel</label>
                                            <input 
                                                type="tel" 
                                                value={editForm.fatherPhone}
                                                onChange={e => setEditForm({...editForm, fatherPhone: e.target.value})}
                                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:border-sky-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Onasi ismi</label>
                                            <input 
                                                type="text" 
                                                value={editForm.motherName}
                                                onChange={e => setEditForm({...editForm, motherName: e.target.value})}
                                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:border-sky-500"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Onasi tel</label>
                                            <input 
                                                type="tel" 
                                                value={editForm.motherPhone}
                                                onChange={e => setEditForm({...editForm, motherPhone: e.target.value})}
                                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold outline-none focus:border-sky-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Lokatsiya</label>
                                        <button 
                                            onClick={() => setIsMapOpen(true)}
                                            className={`w-full py-3 border rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all ${editForm.location ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                                        >
                                            <MapPin size={14} />
                                            {editForm.location ? "O'zgartirish" : "Kartadan belgilash"}
                                        </button>
                                    </div>
                                    <div className="pt-4 flex gap-3">
                                        <button 
                                            onClick={handleSaveEdit} 
                                            disabled={isSaving}
                                            className="flex-1 py-3 bg-sky-600 text-white rounded-xl text-[10px] font-bold uppercase shadow-lg shadow-sky-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                                        >
                                            {isSaving ? "Saqlanmoqda..." : "Saqlash"}
                                        </button>
                                        <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-white border border-gray-100 text-gray-400 rounded-xl text-[10px] font-bold uppercase active:scale-95 transition-all">
                                            Bekor qilish
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 mb-4 px-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                        <h3 className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Ma'lumotlar</h3>
                                    </div>
                                    <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Telefon" value={student.phone} />
                                    <InfoRow 
                                        icon={<Bus className="w-3.5 h-3.5" />} 
                                        label="Transport" 
                                        value={transports.find(t => t.id === student.transportId)?.name || "Transport yo'q"} 
                                    />
                                    <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Tug'ilgan kun" value={student.birthDate} />
                                    <div className="space-y-3">
                                        <InfoRow icon={<Users className="w-3.5 h-3.5" />} label="Otasi" value={student.fatherName || "-"} />
                                        {student.fatherPhone && (
                                            <div className="flex items-center gap-2 pl-12 -mt-2">
                                                <span className="text-[10px] font-bold text-gray-500 tabular-nums">{student.fatherPhone}</span>
                                                <button onClick={() => handleSendSms(student.fatherPhone!, 'manual')} className="p-1 text-sky-500 hover:bg-sky-50 rounded-md transition-all">
                                                    <Sparkles size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <InfoRow icon={<Users className="w-3.5 h-3.5" />} label="Onasi" value={student.motherName || "-"} />
                                        {student.motherPhone && (
                                            <div className="flex items-center gap-2 pl-12 -mt-2">
                                                <span className="text-[10px] font-bold text-gray-500 tabular-nums">{student.motherPhone}</span>
                                                <button onClick={() => handleSendSms(student.motherPhone!, 'manual')} className="p-1 text-sky-500 hover:bg-sky-50 rounded-md transition-all">
                                                    <Sparkles size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <InfoRow icon={<BookOpen className="w-3.5 h-3.5" />} label="Maktab" value={student.studentSchool || "-"} />
                                    <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Manzil" value={student.address} />
                                    {student.location && (
                                        <button 
                                            onClick={handleOpenMap}
                                            className="w-full mt-4 flex items-center justify-center gap-3 px-4 py-4 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 text-[10px] font-black uppercase tracking-[0.1em] rounded-2xl hover:bg-sky-600 hover:text-white transition-all shadow-lg shadow-sky-500/10 active:scale-95"
                                        >
                                            <MapPin size={16} />
                                            Kartada ko'rish
                                        </button>
                                    )}
                                    <InfoRow icon={<Clock className="w-3.5 h-3.5" />} label="A'zo bo'ldi" value={student.joinedDate} />
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Content V2 */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Summary Stats V2 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        <StatCardV3 
                            label="O'rtacha Ball" 
                            value={avgScore}
                            subValue="Akademik natija"
                            icon={<Award className="text-amber-500" size={20} />} 
                        />
                        <StatCardV3 
                            label="Davomat" 
                            value={`${attendanceRate}%`}
                            subValue="Darslarga qatnash"
                            icon={<ClipboardCheck className="text-emerald-500" size={20} />} 
                        />
                        <StatCardV3 
                            label="Guruhlar" 
                            value={studentGroups.length}
                            subValue="Faol kurslar"
                            icon={<Users className="text-indigo-500" size={20} />} 
                        />
                         <StatCardV3 
                            label="To'lovlar" 
                            value={studentPayments.length}
                            subValue="Jami tranzaksiyalar"
                            icon={<CreditCard className="text-blue-500" size={20} />} 
                        />
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden min-h-[600px] transition-colors">
                        <div className="flex border-b border-gray-100 dark:border-gray-700 px-6 overflow-x-auto scrollbar-hide bg-gray-50/30 dark:bg-gray-900/30">
                            <TabButton label="Umumiy" icon={<Layers className="w-4 h-4" />} active={activeTab === 'umumiy'} onClick={() => setActiveTab('umumiy')} />
                            <TabButton label="Guruhlar" icon={<Users className="w-4 h-4" />} active={activeTab === 'guruhlar'} onClick={() => setActiveTab('guruhlar')} />
                            <TabButton label="To'lovlar" icon={<CreditCard className="w-4 h-4" />} active={activeTab === 'tolovlar'} onClick={() => setActiveTab('tolovlar')} />
                            <TabButton label="Yo'qlama" icon={<ClipboardCheck className="w-4 h-4" />} active={activeTab === 'yoqlama'} onClick={() => setActiveTab('yoqlama')} />
                            <TabButton label="Ballar" icon={<Award className="w-4 h-4" />} active={activeTab === 'ballar'} onClick={() => setActiveTab('ballar')} />
                        </div>

                        <div className="p-6 md:p-8">
                            {activeTab === 'umumiy' && (
                                <div className="space-y-10 animate-in fade-in duration-500">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="space-y-5">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Faol Guruhlar</h4>
                                            </div>
                                            <div className="space-y-3">
                                                {studentGroups.length === 0 ? (
                                                    <div className="py-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-900/20">
                                                        <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Guruhlarga biriktirilmagan</p>
                                                    </div>
                                                ) : (
                                                    studentGroups.map(group => (
                                                        <div key={group.id} onClick={() => navigate(`/groups/${group.id}`)} 
                                                            className="group bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-4 transition-all cursor-pointer hover:border-sky-300 dark:hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/5 hover:scale-[1.01] active:scale-[0.99]">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-11 h-11 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 rounded-xl flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 dark:group-hover:bg-sky-500 group-hover:text-white transition-all shrink-0 shadow-sm shadow-sky-500/10">
                                                                        <BookOpen size={20} />
                                                                    </div>
                                                                    <div>
                                                                        <h5 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors uppercase tracking-tight">{group.name}</h5>
                                                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{group.courseName} &bull; {group.teacherName}</p>
                                                                    </div>
                                                                </div>
                                                                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors" />
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                         <div className="space-y-5">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Oxirgi To'lovlar</h4>
                                            </div>
                                            <div className="space-y-3">
                                                {studentPayments.slice(0, 4).map(p => (
                                                    <div key={p.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-2xl hover:border-emerald-200 dark:hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-500/5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-sm shadow-emerald-500/10">
                                                                <CreditCard size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-900 dark:text-white">+{p.amount.toLocaleString()} <span className="text-[10px] text-gray-400 dark:text-gray-500">UZS</span></p>
                                                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{p.date}</p>
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 rounded-lg shrink-0 border border-gray-100 dark:border-gray-600 uppercase tracking-widest">{p.type}</span>
                                                    </div>
                                                ))}
                                                {studentPayments.length === 0 && (
                                                    <div className="py-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-900/20">
                                                        <CreditCard className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">To'lovlar tarixi yo'q</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'tolovlar' && (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl">
                                        <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Tranzaksiyalar Tarixi</h4>
                                        <button onClick={() => setShowPaymentModal(true)}
                                            className="px-6 py-2.5 bg-sky-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-sky-500 active:scale-95 transition-all shadow-lg shadow-sky-500/20 text-center">
                                            To'lov Qo'shish
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {studentPayments.map(p => (
                                            <div key={p.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-2xl hover:shadow-lg hover:shadow-emerald-500/5 hover:border-emerald-200 dark:hover:border-emerald-500/30 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-sm shadow-emerald-500/10">
                                                        <CreditCard size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{p.amount.toLocaleString()} <span className="text-[10px] text-gray-400 dark:text-gray-500">UZS</span></p>
                                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{p.date}</p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-600 uppercase tracking-widest">{p.type}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {studentPayments.length === 0 && (
                                        <div className="py-20 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-gray-50/50 dark:bg-gray-900/20">
                                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">To'lovlar topilmadi.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'guruhlar' && (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl">
                                        <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">O'quvchi Guruhlari</h4>
                                        <button onClick={() => setShowGroupModal(true)}
                                            className="px-6 py-2.5 bg-sky-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-sky-500 active:scale-95 transition-all shadow-lg shadow-sky-500/20 text-center">
                                            Guruhga Qo'shish
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {studentGroups.map(group => (
                                            <div key={group.id} onClick={() => navigate(`/groups/${group.id}`)} 
                                                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 rounded-3xl hover:border-sky-300 dark:hover:border-sky-500 transition-all cursor-pointer group shadow-sm hover:shadow-xl hover:shadow-sky-500/5 hover:scale-[1.02] active:scale-[0.98]">
                                                <div className="flex items-start justify-between mb-5">
                                                    <div>
                                                        <h5 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors uppercase tracking-tight">{group.name}</h5>
                                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{group.courseName}</p>
                                                    </div>
                                                    <div className="w-12 h-12 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800/50 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 group-hover:bg-sky-600 dark:group-hover:bg-sky-500 group-hover:text-white transition-all shadow-sm shadow-sky-500/10">
                                                        <BookOpen size={24} />
                                                    </div>
                                                </div>
                                                <div className="space-y-3 pt-5 border-t border-dashed border-gray-100 dark:border-gray-700">
                                                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 text-xs font-bold">
                                                        <Users size={16} className="text-gray-400 dark:text-gray-500" />
                                                        {group.teacherName}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 text-xs font-bold">
                                                        <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
                                                        <span className="uppercase tracking-widest">{group.days}</span> &bull; {group.startTime}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {studentGroups.length === 0 && (
                                        <div className="py-20 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-gray-50/50 dark:bg-gray-900/20">
                                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Guruh ma'lumotlari yo'q.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'yoqlama' && (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl">
                                        <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Davomat Kalendari</h4>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 mr-4">
                                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Keldi</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mr-4">
                                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Kelmapdi</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Belgilanmagan</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-[2.5rem] p-8 transition-colors shadow-sm">
                                        <div className="grid grid-cols-7 gap-3">
                                            {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map(day => (
                                                <div key={day} className="text-center text-[10px] font-extrabold text-gray-300 dark:text-gray-600 uppercase tracking-widest pb-4">{day}</div>
                                            ))}
                                            {(() => {
                                                const now = new Date();
                                                const year = now.getFullYear();
                                                const month = now.getMonth();
                                                const firstDay = new Date(year, month, 1).getDay();
                                                const daysInMonth = new Date(year, month + 1, 0).getDate();
                                                const blanks = firstDay === 0 ? 6 : firstDay - 1;

                                                const cells = [];
                                                for (let i = 0; i < blanks; i++) cells.push(<div key={`b-${i}`} />);
                                                for (let d = 1; d <= daysInMonth; d++) {
                                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                    const att = studentAttendances.find(a => a.date === dateStr);
                                                    
                                                    // Check if it was a lesson day
                                                    const isLessonDay = studentGroups.some(g => {
                                                        const date = new Date(year, month, d);
                                                        const dw = date.getDay();
                                                        if (g.days === 'TOQ') return [1, 3, 5].includes(dw);
                                                        if (g.days === 'JUFT') return [2, 4, 6].includes(dw);
                                                        return dw !== 0;
                                                    });

                                                    let bgColor = 'bg-gray-50 dark:bg-gray-800/50';
                                                    let textColor = 'text-gray-400 dark:text-gray-600';
                                                    
                                                    if (att) {
                                                        if (att.status === 'Keldi') bgColor = 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20';
                                                        else if (att.status === 'Kelmapdi') bgColor = 'bg-rose-500 text-white shadow-lg shadow-rose-500/20';
                                                        else if (att.status === 'Sababli') bgColor = 'bg-sky-500 text-white shadow-lg shadow-sky-500/20';
                                                        textColor = 'text-white';
                                                    } else if (isLessonDay) {
                                                        const todayStr = new Date().toISOString().split('T')[0];
                                                        if (dateStr < todayStr) {
                                                            bgColor = 'bg-amber-400 text-white shadow-lg shadow-amber-400/20';
                                                            textColor = 'text-white';
                                                        }
                                                    }

                                                    cells.push(
                                                        <div key={d} className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative group transition-all transform hover:scale-110 cursor-default ${bgColor} ${textColor}`}>
                                                            <span className="text-[10px] font-bold">{d}</span>
                                                            {isLessonDay && !att && (
                                                                <div className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-current opacity-40" />
                                                            )}
                                                        </div>
                                                    );
                                                }
                                                return cells;
                                            })()}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Batafsil Tarix</h4>
                                        <div className="bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                                        <th className="p-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Sana & Guruh</th>
                                                        <th className="p-5 text-center text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Holati</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                    {studentAttendances.map(a => (
                                                        <tr key={a.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/30 transition-colors">
                                                            <td className="p-5">
                                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{a.date}</p>
                                                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{groups.find(g => g.id === a.groupId)?.name || '-'}</p>
                                                            </td>
                                                            <td className="p-5 text-center">
                                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-colors ${a.status === 'Keldi' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50' : a.status === 'Kelmapdi' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/50' : 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-800/50'}`}>
                                                                    {a.status === 'Keldi' ? <CheckCircle size={14} /> : a.status === 'Kelmapdi' ? <XCircle size={14} /> : <Clock size={14} />}
                                                                    {a.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'ballar' && (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl">
                                        <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Reyting va Natijalar</h4>
                                        <button onClick={() => setShowScoreModal(true)}
                                            className="px-6 py-2.5 bg-sky-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-sky-500 active:scale-95 transition-all shadow-lg shadow-sky-500/20 text-center">
                                            Ball Qo'shish
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {studentScores.map(s => (
                                            <div key={s.id} className="bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 p-5 rounded-3xl hover:border-amber-300 dark:hover:border-amber-500 transition-all shadow-sm group hover:shadow-xl hover:shadow-amber-500/5 hover:scale-[1.02] active:scale-[0.98]">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800/50 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-lg shadow-sm shrink-0 group-hover:bg-amber-600 dark:group-hover:bg-amber-500 group-hover:text-white transition-all shadow-amber-500/10">
                                                        {s.value}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 leading-none">{groups.find(g => g.id === s.groupId)?.name || '-'}</p>
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">{s.value} BALL</p>
                                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-2">
                                                            <Calendar size={12} />
                                                            {s.date}
                                                        </p>
                                                        {s.comment && (
                                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-lg border border-gray-100 dark:border-gray-600/50 italic">"{s.comment}"</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {studentScores.length === 0 && (
                                        <div className="py-20 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-gray-50/50 dark:bg-gray-900/20">
                                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Ballar topilmadi.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals Cleanup V2 */}
            {showPaymentModal && (
                <PaymentAddModal studentId={student.id} onClose={() => setShowPaymentModal(false)} onAdd={addPayment} />
            )}
            {showGroupModal && (
                <GroupAddModal studentId={student.id} currentGroups={student.groups || []} availableGroups={groups}
                    onClose={() => setShowGroupModal(false)}
                    onAdd={async (groupId: number) => {
                        await addStudentToGroup(groupId, student.id);
                    }}
                />
            )}
            {showAttendanceModal && (
                <AttendanceAddModal studentId={student.id} studentGroups={studentGroups}
                    onClose={() => setShowAttendanceModal(false)} onAdd={addAttendance} />
            )}
            {showScoreModal && (
                <ScoreAddModal studentId={student.id} studentGroups={studentGroups}
                    onClose={() => setShowScoreModal(false)} onAdd={addScore} />
            )}
            {showSmsModal && (
                <SmsSendModal 
                    phone={smsData.phone} 
                    studentName={student.name}
                    onClose={() => setShowSmsModal(false)} 
                    onConfirm={confirmSendSms} 
                />
            )}

            {isMapOpen && (
                <MapPicker 
                    initialLocation={editForm.location}
                    onSelect={(loc) => setEditForm({...editForm, location: loc})}
                    onClose={() => setIsMapOpen(false)}
                />
            )}
        </div>
    );
}

function StatCardV3({ label, value, subValue, icon }: any) {
    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 rounded-3xl shadow-sm transition-colors hover:shadow-xl hover:shadow-gray-500/5 group">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 leading-none">{label}</p>
                    <h5 className="text-2xl font-bold dark:text-white tabular-nums tracking-tight">{value}</h5>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm border border-gray-100 dark:border-gray-600 shadow-gray-500/10">
                    {icon}
                </div>
            </div>
            <div className="pt-4 mt-5 border-t border-dashed border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1.5 uppercase tracking-widest">
                    <TrendingUp size={14} className="text-sky-500" />
                    {subValue}
                </p>
            </div>
        </div>
    );
}

function PaymentAddModal({ studentId, onClose, onAdd }: { studentId: number; onClose: () => void; onAdd: (data: any) => void }) {
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('Naqd');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const paymentData = { studentId, amount: Number(amount), type, date: new Date().toISOString().split('T')[0], description: '' };
        await onAdd(paymentData);
        
        // Trigger SMS
        if (window.confirm("To'lov haqida ota-onaga SMS xabarnoma yuborilsinmi?")) {
            try {
                const token = localStorage.getItem('token');
                await fetch('/api/sms/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        phone: 'AUTO_RESOLVE', // Server will resolve via studentId
                        studentId,
                        message: `Sariosiyo o'quv markazi: to'lov qabul qilindi: ${Number(amount).toLocaleString()} UZS.`,
                        type: 'PAYMENT'
                    })
                });
            } catch (err) {
                console.error("Payment SMS failed", err);
            }
        }
        
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">To'lov Qo'shish</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Yangi tranzaksiya kiritish</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-600"><XCircle size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">SUMMA (UZS)</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="500,000" 
                            className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-sm font-bold border border-gray-100 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 focus:border-sky-500 dark:focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600" />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">TO'LOV USULI</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['Naqd', 'Karta', 'Payme', 'Klik'].map(t => (
                                <button key={t} type="button" onClick={() => setType(t)}
                                    className={`py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all border ${type === t ? 'bg-sky-600 border-sky-600 text-white shadow-lg shadow-sky-500/20 scale-105' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="pt-2 border-t border-dashed border-gray-100 dark:border-gray-700">
                        <button type="submit" className="w-full py-4 bg-sky-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-sky-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-sky-500/20">
                            <Save size={18} />
                            Saqlash
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function GroupAddModal({ studentId, currentGroups, availableGroups, onClose, onAdd }: any) {
    const options = availableGroups.filter((g: any) => !currentGroups.includes(g.id));
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Guruhga Qo'shish</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Yangi kurs tanlash</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-600"><XCircle size={20} /></button>
                </div>
                <div className="p-4 max-h-[400px] overflow-y-auto space-y-3 custom-scrollbar">
                    {options.length === 0 ? (
                        <div className="py-12 text-center">
                            <Plus className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3 rotate-45" />
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Barcha guruhlarga a'zo</p>
                        </div>
                    ) : (
                        options.map((g: any) => (
                            <button key={g.id} onClick={() => { onAdd(g.id); onClose(); }}
                                className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-500/50 rounded-2xl transition-all group shadow-sm hover:shadow-xl hover:shadow-sky-500/5 hover:scale-[1.02]">
                                <div className="text-left">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors uppercase tracking-tight">{g.name}</p>
                                    <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest">{g.days} • {g.startTime}</p>
                                </div>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 group-hover:text-white group-hover:bg-sky-600 transition-all shadow-sm">
                                    <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function AttendanceAddModal({ studentId, studentGroups, onClose, onAdd }: any) {
    const [groupId, setGroupId] = useState(studentGroups[0]?.id || '');
    const [status, setStatus] = useState('Keldi');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupId) return;
        onAdd({ studentId, groupId: Number(groupId), date: new Date().toISOString().split('T')[0], status });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Yo'qlama</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Davomat qilish</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-600"><XCircle size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">GURUHNI TANLANG</label>
                        <select value={groupId} onChange={e => setGroupId(e.target.value)} required 
                            className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-sm font-bold border border-gray-100 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 focus:border-sky-500 dark:focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 transition-all outline-none text-gray-900 dark:text-white cursor-pointer hover:border-gray-300 dark:hover:border-gray-600">
                            <option value="" disabled className="dark:bg-gray-800">Tanlang...</option>
                            {studentGroups.map((g: any) => <option key={g.id} value={g.id} className="dark:bg-gray-800">{g.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">HOLATI</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Keldi', 'Kelmapdi', 'Sababli'].map(s => (
                                <button key={s} type="button" onClick={() => setStatus(s)}
                                    className={`py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all border ${status === s ? 'bg-sky-600 border-sky-600 text-white shadow-lg shadow-sky-500/20 scale-105' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="pt-2 border-t border-dashed border-gray-100 dark:border-gray-700">
                        <button type="submit" className="w-full py-4 bg-sky-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-sky-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-sky-500/20">
                            <Save size={18} />
                            Saqlash
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ScoreAddModal({ studentId, studentGroups, onClose, onAdd }: any) {
    const [groupId, setGroupId] = useState(studentGroups[0]?.id || '');
    const [value, setValue] = useState('');
    const [comment, setComment] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupId) return;
        onAdd({ studentId, groupId: Number(groupId), date: new Date().toISOString().split('T')[0], value: Number(value), comment });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Ball Qo'shish</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Natijani kiritish</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-600"><XCircle size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">GURUHNI TANLANG</label>
                        <select value={groupId} onChange={e => setGroupId(e.target.value)} required 
                            className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-sm font-bold border border-gray-100 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 focus:border-sky-500 dark:focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 transition-all outline-none text-gray-900 dark:text-white cursor-pointer select-none">
                            <option value="" disabled className="dark:bg-gray-800">Tanlang...</option>
                            {studentGroups.map((g: any) => <option key={g.id} value={g.id} className="dark:bg-gray-800">{g.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">BALL (0-100)</label>
                        <input type="number" value={value} onChange={e => setValue(e.target.value)} required placeholder="85" 
                             className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-sm font-bold border border-gray-100 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 focus:border-sky-500 dark:focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">IZOH (IXTIYORIY)</label>
                        <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="Imtihon natijasi..." 
                             className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-sm font-bold border border-gray-100 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 focus:border-sky-500 dark:focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600" />
                    </div>
                    <div className="pt-2 border-t border-dashed border-gray-100 dark:border-gray-700">
                        <button type="submit" className="w-full py-4 bg-sky-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-sky-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-sky-500/20">
                            <Save size={18} />
                            Saqlash
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function SmsSendModal({ phone, studentName, onClose, onConfirm }: { phone: string; studentName?: string; onClose: () => void; onConfirm: (msg: string) => void }) {
    const defaultPrefix = `Sariosiyo o'quv markazi: `;
    const [message, setMessage] = useState(defaultPrefix);

    const templates = [
        {
            label: "Guruhga qabul",
            text: `${studentName || '@name'} siz SARIOSIYO O'QUV MARKAZI ning MATEMATIKA o'quv kursiga 4-guruh sifatida qabul qilindingiz. Sizning darsingiz DUSHANBA, CHORSHANBA va JUMA kunlari 14:00 da bo'lib o'tadi!`
        },
        {
            label: "Qarzdorlik",
            text: `Farzandingiz ${studentName || '@name'} ning FIZIKA fanidan qarzdorligi @summa so'm katta miqdorni tashkil qilyapti. To'lovni o'z vaqtida to'lang!`
        }
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;
        onConfirm(message);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight text-sky-600">SMS Yuborish</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Qabul qiluvchi: {phone}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-600"><XCircle size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">TAYYOR SHABLONLAR (ESKIZ TASDIQLAGAN)</label>
                        <div className="flex flex-wrap gap-2">
                            {templates.map((tpl, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setMessage(tpl.text)}
                                    className="px-3 py-1.5 text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-900/30 border border-sky-100 dark:border-sky-800 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors uppercase tracking-widest"
                                >
                                    {tpl.label}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setMessage(defaultPrefix)}
                                className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors uppercase tracking-widest"
                            >
                                Tozalash
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">XABAR MATNI (O'ZGARUVCHILARNI TO'LDIRING)</label>
                        <textarea 
                            value={message} 
                            onChange={e => setMessage(e.target.value)} 
                            required 
                            rows={5}
                            autoFocus
                            className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-sm font-medium border border-gray-100 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 focus:border-sky-500 dark:focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 transition-all outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 resize-none leading-relaxed" 
                        />
                    </div>
                    <div className="pt-2 border-t border-dashed border-gray-100 dark:border-gray-700">
                        <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20">
                            <Send size={18} />
                            Jo'natish (Moderatsiyasiz)
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-4 group">
            <div className="w-11 h-11 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-2xl flex items-center justify-center text-gray-400 dark:text-gray-500 shrink-0 group-hover:bg-sky-50 dark:group-hover:bg-sky-900/30 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-all shadow-sm">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate uppercase tracking-tight">{value || "-"}</p>
            </div>
        </div>
    );
}

function TabButton({ label, icon, active, onClick }: any) {
    return (
        <button onClick={onClick} className={`px-6 py-5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2.5 transition-all relative whitespace-nowrap ${active ? 'text-sky-600 dark:text-sky-400 scale-105 bg-white dark:bg-gray-800 shadow-[0_-4px_20px_-10px_rgba(14,165,233,0.3)]' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'}`}>
            <span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
            {label}
            {active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-500 dark:bg-sky-400 rounded-t-full shadow-[0_-2px_8px_rgba(14,165,233,0.5)]" />}
        </button>
    );
}
