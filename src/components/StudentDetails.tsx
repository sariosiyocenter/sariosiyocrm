import React, { useState } from 'react';
import {
    ArrowLeft, Phone, Calendar, MapPin, BookOpen, CreditCard,
    Clock, CheckCircle, XCircle, Plus, Award, ClipboardCheck, Users, Layers, ChevronRight, TrendingUp, Save, Edit, Bus, Sparkles, Image as ImageIcon, Camera, X, Send
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useParams, useNavigate } from 'react-router-dom';
import MapPicker from './MapPicker';
import PhotoCapture from './PhotoCapture';
import { compressImage } from '../lib/image';

export default function StudentDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { students, groups, teachers, courses, payments, attendances, scores, transports, addPayment, addAttendance, addScore, updateStudent, addStudentToGroup, deleteStudent } = useCRM();
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
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const handleConfirmDelete = async () => {
        try {
            await deleteStudent(student!.id);
            navigate('/students');
        } catch (err) {
            console.error("Delete failed", err);
            alert("O'quvchini o'chirishda xatolik yuz berdi");
        }
    };

    const handlePhotoCapture = async (base64: string) => {
        const compressed = await compressImage(base64);
        updateStudent(student!.id, { photo: compressed });
    };
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        status: 'Faol' as 'Faol' | 'Arxiv' | 'Sinov' | 'Bitiruvchi',
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
            <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm transition-colors">
                <div className="w-20 h-20 bg-gray-55 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-gray-650">
                    <Users className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                </div>
                <p className="text-gray-405 dark:text-gray-500 font-bold uppercase tracking-widest text-xs">O'quvchi topilmadi</p>
                <button onClick={() => navigate('/students')} className="mt-6 text-[#1b6b6b] font-bold uppercase tracking-widest text-[10px] hover:underline px-6 py-2 bg-teal-50 dark:bg-teal-900/30 rounded-xl transition-all">Orqaga qaytish</button>
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
            reader.onloadend = async () => {
                const compressed = await compressImage(reader.result as string);
                updateStudent(student.id, { photo: compressed });
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

    const avgScore = studentScores.length ? (studentScores.reduce((a, b) => a + b.value, 0) / studentScores.length).toFixed(1) : '0';
    const attendanceRate = studentAttendances.length ? ((studentAttendances.filter(a => a.status === 'Keldi').length / studentAttendances.length) * 100).toFixed(0) : '0';

    const labelCls = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";
    const inputCls = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Back Button */}
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-[#1b6b6b] transition-all text-[10px] font-extrabold uppercase tracking-widest group cursor-pointer">
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                Orqaga
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* Left Profile Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
                        <div className="h-28 bg-[#1b6b6b] relative">
                            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 rounded-2xl bg-white dark:bg-gray-800 p-1 shadow-md">
                                <div className="w-20 h-20 rounded-xl bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700/50 flex items-center justify-center text-[#1b6b6b] font-bold text-2xl">
                                    {student.photo ? (
                                        <img src={student.photo} alt={student.name} className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                        student.name.charAt(0).toUpperCase()
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="pt-14 pb-6 px-6 text-center">
                            {isEditing ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className={labelCls}>Ism Familiya</label>
                                        <input 
                                            value={editForm.name}
                                            onChange={e => setEditForm({...editForm, name: e.target.value})}
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Holati</label>
                                        <select 
                                            value={editForm.status}
                                            onChange={e => setEditForm({...editForm, status: e.target.value as any})}
                                            className={inputCls}
                                        >
                                            <option value="Faol">Faol</option>
                                            <option value="Sinov">Sinov</option>
                                            <option value="Arxiv">Arxiv</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Transport</label>
                                        <select 
                                            value={editForm.transportId}
                                            onChange={e => setEditForm({...editForm, transportId: e.target.value})}
                                            className={inputCls}
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
                                    <div className="flex items-center justify-center gap-1.5">
                                        <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{student.name}</h2>
                                        <button onClick={handleStartEdit} className="text-gray-300 hover:text-[#1b6b6b] cursor-pointer">
                                            <Edit size={12} />
                                        </button>
                                    </div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">ID: #{student.id}</p>
                                    <div className="mt-4 flex justify-center">
                                        <span className={`px-2.5 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wider ${student.status === 'Faol' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-gray-55 text-gray-400 border-gray-100 dark:bg-gray-900/50'}`}>
                                            {student.status}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="px-6 pb-6 space-y-4 border-t border-dashed border-gray-100 dark:border-gray-700/50 pt-4">
                            <div className={`p-4 rounded-2xl border ${student.balance >= 0 ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-emerald-600' : 'bg-rose-50/50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40 text-rose-600'} flex flex-col items-center`}>
                                <span className="text-[8px] font-black text-gray-405 uppercase tracking-widest mb-1">Balans</span>
                                <span className="text-lg font-black tracking-tight tabular-nums">{student.balance.toLocaleString()} <span className="text-[9px] font-extrabold opacity-60">UZS</span></span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <label className="relative flex items-center justify-center gap-1.5 py-2.5 bg-gray-55 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-white transition-all group">
                                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                    <ImageIcon size={14} className="text-gray-400 group-hover:text-[#1b6b6b]" />
                                    <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">Yuklash</span>
                                </label>
                                
                                <button 
                                    onClick={() => setIsPhotoModalOpen(true)}
                                    className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-55 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:bg-white transition-all cursor-pointer"
                                >
                                    <Camera size={14} className="text-gray-400" />
                                    <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">Rasmga olish</span>
                                </button>
                            </div>
                            
                            {student.photo && (
                                <button 
                                    onClick={handleRemoveBg}
                                    disabled={isRemovingBg}
                                    className="w-full flex items-center justify-center gap-1.5 py-3 bg-violet-50 text-violet-600 border border-violet-100 dark:bg-violet-950/20 dark:text-violet-400 rounded-xl text-[9px] font-extrabold uppercase tracking-widest hover:bg-violet-600 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    <Sparkles size={12} className={isRemovingBg ? 'animate-spin' : ''} />
                                    {isRemovingBg ? 'Tozalanmoqda...' : 'Fonni tozalash'}
                                </button>
                            )}

                            {/* Photo Capture Modal */}
                            {isPhotoModalOpen && (
                                <PhotoCapture
                                    onCapture={handlePhotoCapture}
                                    onClose={() => setIsPhotoModalOpen(false)}
                                />
                            )}
                        </div>

                        <div className="px-6 pb-6 space-y-3 border-t border-dashed border-gray-100 dark:border-gray-700/50 pt-4">
                            {isEditing ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className={labelCls}>Telefon</label>
                                        <input type="tel" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Tug'ilgan kun</label>
                                        <input type="date" value={editForm.birthDate} onChange={e => setEditForm({...editForm, birthDate: e.target.value})} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Manzil</label>
                                        <input type="text" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Maktab</label>
                                        <input type="text" value={editForm.studentSchool} onChange={e => setEditForm({...editForm, studentSchool: e.target.value})} className={inputCls} placeholder="45-maktab" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className={labelCls}>Otasi ismi</label>
                                            <input type="text" value={editForm.fatherName} onChange={e => setEditForm({...editForm, fatherName: e.target.value})} className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Otasi tel</label>
                                            <input type="tel" value={editForm.fatherPhone} onChange={e => setEditForm({...editForm, fatherPhone: e.target.value})} className={inputCls} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className={labelCls}>Onasi ismi</label>
                                            <input type="text" value={editForm.motherName} onChange={e => setEditForm({...editForm, motherName: e.target.value})} className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Onasi tel</label>
                                            <input type="tel" value={editForm.motherPhone} onChange={e => setEditForm({...editForm, motherPhone: e.target.value})} className={inputCls} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Lokatsiya</label>
                                        <button 
                                            onClick={() => setIsMapOpen(true)}
                                            className={`w-full py-2.5 border rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-extrabold uppercase transition-all cursor-pointer ${editForm.location ? 'bg-teal-50 text-[#1b6b6b] border-teal-100' : 'bg-gray-55 text-gray-400 border-gray-100'}`}
                                        >
                                            <MapPin size={12} />
                                            {editForm.location ? "O'zgartirish" : "Kartadan belgilash"}
                                        </button>
                                    </div>
                                    <div className="pt-2 flex gap-2">
                                        <button 
                                            onClick={handleSaveEdit} 
                                            disabled={isSaving}
                                            className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[9px] font-extrabold uppercase shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            Saqlash
                                        </button>
                                        <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-white border border-gray-100 text-gray-405 rounded-xl text-[9px] font-extrabold uppercase transition-all cursor-pointer">
                                            Bekor
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 mb-2 px-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#1b6b6b]" />
                                        <h3 className="text-[9px] font-black text-[#1b6b6b] uppercase tracking-widest">Ma'lumotlar</h3>
                                    </div>
                                    <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Telefon" value={student.phone} />
                                    <InfoRow 
                                        icon={<Bus className="w-3.5 h-3.5" />} 
                                        label="Transport" 
                                        value={transports.find(t => t.id === student.transportId)?.name || "Transport yo'q"} 
                                    />
                                    <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Tug'ilgan kun" value={student.birthDate} />
                                    <div className="space-y-2">
                                        <InfoRow icon={<Users className="w-3.5 h-3.5" />} label="Otasi" value={student.fatherName || "-"} />
                                        {student.fatherPhone && (
                                            <div className="flex items-center gap-1.5 pl-12 -mt-1">
                                                <span className="text-[10px] font-bold text-gray-500 tabular-nums">{student.fatherPhone}</span>
                                                <button onClick={() => handleSendSms(student.fatherPhone!, 'manual')} className="p-1 text-[#1b6b6b] hover:bg-teal-50 rounded transition-all cursor-pointer">
                                                    <Sparkles size={11} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <InfoRow icon={<Users className="w-3.5 h-3.5" />} label="Onasi" value={student.motherName || "-"} />
                                        {student.motherPhone && (
                                            <div className="flex items-center gap-1.5 pl-12 -mt-1">
                                                <span className="text-[10px] font-bold text-gray-500 tabular-nums">{student.motherPhone}</span>
                                                <button onClick={() => handleSendSms(student.motherPhone!, 'manual')} className="p-1 text-[#1b6b6b] hover:bg-teal-50 rounded transition-all cursor-pointer">
                                                    <Sparkles size={11} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <InfoRow icon={<BookOpen className="w-3.5 h-3.5" />} label="Maktab" value={student.studentSchool || "-"} />
                                    <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Manzil" value={student.address} />
                                    {student.location && (
                                        <button 
                                            onClick={handleOpenMap}
                                            className="w-full mt-2 flex items-center justify-center gap-1.5 px-4 py-3 bg-teal-50 dark:bg-teal-950/20 text-[#1b6b6b] border border-teal-100 dark:border-teal-900/40 text-[9px] font-black uppercase tracking-[0.1em] rounded-xl hover:bg-[#1b6b6b] hover:text-white transition-all cursor-pointer"
                                        >
                                            <MapPin size={13} />
                                            Kartada ko'rish
                                        </button>
                                    )}
                                    <InfoRow icon={<Clock className="w-3.5 h-3.5" />} label="A'zo bo'ldi" value={student.joinedDate} />
                                    
                                    <button 
                                        onClick={() => setShowDeleteModal(true)}
                                        className="w-full mt-4 flex items-center justify-center gap-1.5 px-4 py-3 bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40 text-[9px] font-black uppercase tracking-[0.1em] rounded-xl hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                                    >
                                        <XCircle size={13} />
                                        O'quvchini O'chirish
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Tab Content */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCardV3 
                            label="O'rtacha Ball" 
                            value={avgScore}
                            subValue="Akademik natija"
                            icon={<Award className="text-amber-500" size={16} />} 
                            color="amber"
                        />
                        <StatCardV3 
                            label="Davomat" 
                            value={`${attendanceRate}%`}
                            subValue="Darslarga qatnash"
                            icon={<ClipboardCheck className="text-emerald-500" size={16} />} 
                            color="emerald"
                        />
                        <StatCardV3 
                            label="Guruhlar" 
                            value={studentGroups.length}
                            subValue="Faol kurslar"
                            icon={<Users className="text-[#1b6b6b]" size={16} />} 
                            color="teal"
                        />
                        <StatCardV3 
                            label="To'lovlar" 
                            value={studentPayments.length}
                            subValue="Jami tranzaksiyalar"
                            icon={<CreditCard className="text-rose-500" size={16} />} 
                            color="rose"
                        />
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden min-h-[500px]">
                        <div className="flex px-4 bg-gray-55 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/50 gap-2 overflow-x-auto scrollbar-hide">
                            <TabButton label="Umumiy" icon={<Layers className="w-3.5 h-3.5" />} active={activeTab === 'umumiy'} onClick={() => setActiveTab('umumiy')} />
                            <TabButton label="Guruhlar" icon={<Users className="w-3.5 h-3.5" />} active={activeTab === 'guruhlar'} onClick={() => setActiveTab('guruhlar')} />
                            <TabButton label="To'lovlar" icon={<CreditCard className="w-3.5 h-3.5" />} active={activeTab === 'tolovlar'} onClick={() => setActiveTab('tolovlar')} />
                            <TabButton label="Yo'qlama" icon={<ClipboardCheck className="w-3.5 h-3.5" />} active={activeTab === 'yoqlama'} onClick={() => setActiveTab('yoqlama')} />
                            <TabButton label="Ballar" icon={<Award className="w-3.5 h-3.5" />} active={activeTab === 'ballar'} onClick={() => setActiveTab('ballar')} />
                        </div>

                        <div className="p-6">
                            {activeTab === 'umumiy' && (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block pb-2 border-b border-gray-55 dark:border-gray-700/50">Faol Guruhlar</span>
                                            <div className="space-y-3">
                                                {studentGroups.length === 0 ? (
                                                    <p className="text-center py-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Guruhlarga biriktirilmagan</p>
                                                ) : (
                                                    studentGroups.map(group => (
                                                        <div key={group.id} onClick={() => navigate(`/groups/${group.id}`)} 
                                                            className="group bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all cursor-pointer flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-705 rounded-xl flex items-center justify-center text-[#1b6b6b] shrink-0">
                                                                    <BookOpen size={18} />
                                                                </div>
                                                                <div>
                                                                    <h5 className="text-xs font-black text-gray-900 dark:text-white group-hover:text-[#1b6b6b] uppercase tracking-tight">{group.name}</h5>
                                                                    <p className="text-[9px] font-bold text-gray-400 mt-0.5">{group.courseName} &bull; {group.teacherName}</p>
                                                                </div>
                                                            </div>
                                                            <ChevronRight size={16} className="text-gray-300 group-hover:text-[#1b6b6b] transition-colors" />
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block pb-2 border-b border-gray-55 dark:border-gray-700/50">Oxirgi To'lovlar</span>
                                            <div className="space-y-3">
                                                {studentPayments.slice(0, 4).map(p => (
                                                    <div key={p.id} className="flex items-center justify-between p-4 bg-gray-55 dark:bg-gray-900/30 rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 flex items-center justify-center shrink-0">
                                                                <CreditCard size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-gray-900 dark:text-white">+{p.amount.toLocaleString()} <span className="text-[9px] opacity-60">UZS</span></p>
                                                                <p className="text-[9px] font-bold text-gray-400 mt-0.5">{p.date}</p>
                                                            </div>
                                                        </div>
                                                        <span className="text-[9px] font-black text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-100 dark:border-gray-700 uppercase tracking-wider">{p.type}</span>
                                                    </div>
                                                ))}
                                                {studentPayments.length === 0 && (
                                                    <p className="text-center py-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest">To'lovlar tarixi yo'q</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'tolovlar' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-55 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-2xl">
                                        <div>
                                            <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">Tranzaksiyalar Tarixi</h4>
                                        </div>
                                        <button onClick={() => setShowPaymentModal(true)}
                                            className="px-6 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all text-center cursor-pointer">
                                            To'lov Qo'shish
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {studentPayments.map(p => (
                                            <div key={p.id} className="flex items-center justify-between p-4 bg-gray-55 dark:bg-gray-900/30 rounded-2xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 flex items-center justify-center shrink-0">
                                                        <CreditCard size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-gray-900 dark:text-white">{p.amount.toLocaleString()} <span className="text-[9px] opacity-60">UZS</span></p>
                                                        <p className="text-[9px] font-bold text-gray-400 mt-0.5">{p.date}</p>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-black text-gray-650 dark:text-gray-400 bg-white dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-100 dark:border-gray-700 uppercase tracking-wider">{p.type}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {studentPayments.length === 0 && (
                                        <p className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">To'lovlar topilmadi</p>
                                    )}
                                </div>
                            )}

                            {activeTab === 'guruhlar' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-55 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-2xl">
                                        <div>
                                            <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">O'quvchi Guruhlari</h4>
                                        </div>
                                        <button onClick={() => setShowGroupModal(true)}
                                            className="px-6 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all text-center cursor-pointer">
                                            Guruhga Qo'shish
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {studentGroups.map(group => (
                                            <div key={group.id} onClick={() => navigate(`/groups/${group.id}`)} 
                                                className="group bg-gray-55 dark:bg-gray-900/30 p-5 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all cursor-pointer flex flex-col justify-between">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div>
                                                        <h5 className="text-xs font-black text-gray-900 dark:text-white group-hover:text-[#1b6b6b] transition-colors uppercase tracking-tight">{group.name}</h5>
                                                        <p className="text-[9px] font-bold text-gray-400 mt-0.5">{group.courseName}</p>
                                                    </div>
                                                    <div className="w-9 h-9 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-[#1b6b6b] shrink-0 shadow-sm border border-gray-100 dark:border-gray-700/50">
                                                        <BookOpen size={16} />
                                                    </div>
                                                </div>
                                                <div className="space-y-2 pt-3 border-t border-dashed border-gray-100 dark:border-gray-750">
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                                                        <Users size={14} className="text-gray-400" />
                                                        {group.teacherName}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                                                        <Calendar size={14} className="text-gray-400" />
                                                        <span className="uppercase">{group.days === 'TOQ' ? 'Toq kunlar' : group.days === 'JUFT' ? 'Juft kunlar' : 'Har kuni'}</span> &bull; {group.schedule}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {studentGroups.length === 0 && (
                                        <p className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Guruhlar topilmadi</p>
                                    )}
                                </div>
                            )}

                            {activeTab === 'yoqlama' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-55 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-2xl">
                                        <div>
                                            <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">Davomat Kalendari</h4>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Keldi</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 rounded-full bg-rose-500" />
                                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Kelmapdi</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Belgilanmagan</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-3xl p-6 shadow-sm">
                                        <div className="grid grid-cols-7 gap-2">
                                            {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map(day => (
                                                <div key={day} className="text-center text-[9px] font-black text-gray-400 uppercase tracking-widest pb-2">{day}</div>
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
                                                    
                                                    const isLessonDay = studentGroups.some(g => {
                                                        const date = new Date(year, month, d);
                                                        const dw = date.getDay();
                                                        if (g.days === 'TOQ') return [1, 3, 5].includes(dw);
                                                        if (g.days === 'JUFT') return [2, 4, 6].includes(dw);
                                                        return dw !== 0;
                                                    });

                                                    let bgColor = 'bg-gray-55 dark:bg-gray-900/50';
                                                    let textColor = 'text-gray-400';
                                                    
                                                    if (att) {
                                                        if (att.status === 'Keldi') bgColor = 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20';
                                                        else if (att.status === 'Kelmapdi') bgColor = 'bg-rose-500 text-white shadow-sm shadow-rose-500/20';
                                                        else if (att.status === 'Sababli') bgColor = 'bg-sky-500 text-white shadow-sm shadow-sky-500/20';
                                                        textColor = 'text-white';
                                                    } else if (isLessonDay) {
                                                        const todayStr = new Date().toISOString().split('T')[0];
                                                        if (dateStr < todayStr) {
                                                            bgColor = 'bg-amber-400 text-white';
                                                            textColor = 'text-white';
                                                        }
                                                    }

                                                    cells.push(
                                                        <div key={d} className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all ${bgColor} ${textColor}`}>
                                                            <span className="text-[9px] font-bold">{d}</span>
                                                        </div>
                                                    );
                                                }
                                                return cells;
                                            })()}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block pb-2 border-b border-gray-55 dark:border-gray-700/50">Batafsil Tarix</span>
                                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-55 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700/50">
                                                        <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Sana & Guruh</th>
                                                        <th className="p-4 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">Holati</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                    {studentAttendances.map(a => (
                                                        <tr key={a.id} className="hover:bg-gray-50/30 transition-colors">
                                                            <td className="p-4">
                                                                <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">{a.date}</p>
                                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{groups.find(g => g.id === a.groupId)?.name || '-'}</p>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex justify-center">
                                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wider ${a.status === 'Keldi' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400'}`}>
                                                                        {a.status}
                                                                    </span>
                                                                </div>
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
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-55 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-2xl">
                                        <div>
                                            <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">Reyting va Natijalar</h4>
                                        </div>
                                        <button onClick={() => setShowScoreModal(true)}
                                            className="px-6 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all text-center cursor-pointer">
                                            Ball Qo'shish
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {studentScores.map(s => (
                                            <div key={s.id} className="bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl flex items-start gap-3 border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all">
                                                <div className="w-10 h-10 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-center text-[#1b6b6b] font-bold text-xs shrink-0">
                                                    {s.value}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{groups.find(g => g.id === s.groupId)?.name || '-'}</p>
                                                    <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight mt-0.5">{s.value} BALL</p>
                                                    {s.comment && (
                                                        <p className="text-[9px] text-gray-405 italic mt-1">"{s.comment}"</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {studentScores.length === 0 && (
                                        <p className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Natijalar topilmadi</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals Cleanup */}
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

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
                    <div className="relative bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50 text-center">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40">
                            <X size={24} />
                        </div>
                        <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">O'quvchini o'chirish</h3>
                        <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-widest leading-relaxed">
                            Haqiqatdan ham <span className="text-gray-900 dark:text-white font-black">{student.name}</span>ni o'chirmoqchimisiz? Ushbu amalni ortga qaytarib bo'lmaydi!
                        </p>
                        <div className="mt-6 flex gap-3">
                            <button 
                                onClick={handleConfirmDelete}
                                className="flex-1 py-3 bg-rose-650 hover:bg-rose-600 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-500/20 cursor-pointer"
                            >
                                O'chirish
                            </button>
                            <button 
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 py-3 bg-gray-55 dark:bg-gray-900 text-gray-405 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                            >
                                Bekor qilish
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
    }[color] || 'bg-gray-55 dark:bg-gray-900 border-gray-100 dark:border-gray-700/50';

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

function PaymentAddModal({ studentId, onClose, onAdd }: { studentId: number; onClose: () => void; onAdd: (data: any) => void }) {
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('Naqd');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const paymentData = { studentId, amount: Number(amount), type, date: new Date().toISOString().split('T')[0], description: '' };
        await onAdd(paymentData);
        
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
                        phone: 'AUTO_RESOLVE',
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

    const labelCls = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";
    const inputCls = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 bg-gray-55 dark:bg-gray-900/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">To'lov Qo'shish</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Yangi tranzaksiya kiritish</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className={labelCls}>SUMMA (UZS)</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="500,000" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>TO'LOV USULI</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['Naqd', 'Karta', 'Payme', 'Klik'].map(t => (
                                <button key={t} type="button" onClick={() => setType(t)}
                                    className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border cursor-pointer ${type === t ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white shadow-lg shadow-[#1b6b6b]/20 scale-105' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="pt-4 border-t border-dashed border-gray-100 dark:border-gray-700/50">
                        <button type="submit" className="w-full py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-[#1b6b6b]/20 cursor-pointer">
                            <Save size={14} />
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 bg-gray-55 dark:bg-gray-900/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Guruhga Qo'shish</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Yangi kurs tanlash</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                </div>
                <div className="p-4 max-h-[350px] overflow-y-auto space-y-2 custom-scrollbar">
                    {options.length === 0 ? (
                        <p className="text-center py-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Barcha guruhlarga a'zo</p>
                    ) : (
                        options.map((g: any) => (
                            <button key={g.id} onClick={() => { onAdd(g.id); onClose(); }}
                                className="w-full flex items-center justify-between p-3.5 bg-white dark:bg-gray-905 border border-gray-100 dark:border-gray-750 hover:border-teal-300 rounded-2xl transition-all group cursor-pointer text-left">
                                <div>
                                    <p className="text-xs font-black text-gray-900 dark:text-white group-hover:text-[#1b6b6b] transition-colors uppercase tracking-tight">{g.name}</p>
                                    <p className="text-[9px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest">{g.days} • {g.startTime}</p>
                                </div>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-55 dark:bg-gray-800 text-gray-405 group-hover:text-white group-hover:bg-[#1b6b6b] transition-all">
                                    <Plus size={16} />
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

    const labelCls = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";
    const inputCls = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 bg-gray-55 dark:bg-gray-900/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Yo'qlama</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Davomat qilish</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className={labelCls}>GURUHNI TANLANG</label>
                        <select value={groupId} onChange={e => setGroupId(e.target.value)} required className={inputCls}>
                            <option value="" disabled>Tanlang...</option>
                            {studentGroups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>HOLATI</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Keldi', 'Kelmapdi', 'Sababli'].map(s => (
                                <button key={s} type="button" onClick={() => setStatus(s)}
                                    className={`py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border cursor-pointer ${status === s ? 'bg-[#1b6b6b] border-[#1b6b6b] text-white shadow-lg shadow-[#1b6b6b]/20 scale-105' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50'}`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="pt-4 border-t border-dashed border-gray-100 dark:border-gray-700/50">
                        <button type="submit" className="w-full py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-[#1b6b6b]/20 cursor-pointer">
                            <Save size={14} />
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

    const labelCls = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";
    const inputCls = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 bg-gray-55 dark:bg-gray-900/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Ball Qo'shish</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Natijani kiritish</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className={labelCls}>GURUHNI TANLANG</label>
                        <select value={groupId} onChange={e => setGroupId(e.target.value)} required className={inputCls}>
                            <option value="" disabled>Tanlang...</option>
                            {studentGroups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>BALL (0-100)</label>
                        <input type="number" value={value} onChange={e => setValue(e.target.value)} required placeholder="85" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>IZOH (IXTIYORIY)</label>
                        <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="Imtihon..." className={inputCls} />
                    </div>
                    <div className="pt-4 border-t border-dashed border-gray-100 dark:border-gray-700/50">
                        <button type="submit" className="w-full py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-[#1b6b6b]/20 cursor-pointer">
                            <Save size={14} />
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

    const labelCls = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";
    const inputCls = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 bg-gray-55 dark:bg-gray-900/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight text-[#1b6b6b]">SMS Yuborish</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Qabul qiluvchi: {phone}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-gray-405 hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className={labelCls}>TAYYOR SHABLONLAR</label>
                        <div className="flex flex-wrap gap-2">
                            {templates.map((tpl, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setMessage(tpl.text)}
                                    className="px-2.5 py-1 text-[9px] font-black text-[#1b6b6b] bg-teal-50 border border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40 rounded-lg hover:bg-[#1b6b6b] hover:text-white transition-colors uppercase tracking-wider cursor-pointer"
                                >
                                    {tpl.label}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setMessage(defaultPrefix)}
                                className="px-2.5 py-1 text-[9px] font-black text-gray-400 bg-gray-55 border border-gray-100 dark:bg-gray-900/50 dark:border-gray-700 rounded-lg hover:bg-gray-200 transition-colors uppercase tracking-wider cursor-pointer"
                            >
                                Tozalash
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>XABAR MATNI</label>
                        <textarea 
                            value={message} 
                            onChange={e => setMessage(e.target.value)} 
                            required 
                            rows={4}
                            className={inputCls + " resize-none leading-relaxed"} 
                        />
                    </div>
                    <div className="pt-4 border-t border-dashed border-gray-100 dark:border-gray-700/50">
                        <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer">
                            <Send size={14} />
                            Jo'natish
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-xl flex items-center justify-center text-[#1b6b6b] shrink-0">
                {icon}
            </div>
            <div className="min-w-0">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block leading-none">{label}</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight mt-1 block truncate">{value || "-"}</span>
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
