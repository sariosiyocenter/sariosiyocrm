import React, { useState } from 'react';
import {
    ArrowLeft, Phone, Calendar, MapPin, BookOpen, CreditCard, ReceiptText,
    Clock, CheckCircle, XCircle, Plus, Award, ClipboardCheck, Users, Layers, ChevronRight, TrendingUp, Save, Edit, Bus, Sparkles, Image as ImageIcon, Camera, X, Send
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useParams, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import MapPicker from './MapPicker';
import PhotoCapture from './PhotoCapture';
import { compressImage } from '../lib/image';

const UZB_REGIONS: Record<string, string[]> = {
  "Surxondaryo": [
    "Sariosiyo", "Denov", "Uzun", "Sho'rchi", "Termiz", "Qumqo'rg'on", 
    "Jarqo'rg'on", "Sherobod", "Boysun", "Muzrabot", "Angor", "Qiziriq", 
    "Oltinsoy", "Bandixon"
  ],
  "Toshkent shahri": [
    "Yunusobod", "Chilonzor", "Mirzo Ulug'bek", "Yashnobod", "Mirobod", 
    "Uchtepa", "Shayxontohur", "Olmazor", "Sergeli", "Yakkasaroy", 
    "Bektemir", "Yangihayot"
  ],
  "Toshkent viloyati": [
    "Chirchiq", "Angren", "Olmaliq", "Bekobod", "Keles", "Zangiota", 
    "Qibray", "Bo'stonliq", "Parkent", "Piskent", "O'rtachirchiq", 
    "Yuqorichirchiq", "Quyichirchiq", "Oqqo'rg'on", "Bo'ka", "Yangiyo'l"
  ],
  "Samarqand": [
    "Samarqand shahri", "Bulung'ur", "Ishtixon", "Jomboy", "Kattaqo'rg'on", 
    "Narpay", "Nurobod", "Oqdaryo", "Payariq", "Pastdarg'om", "Paxtachi", 
    "Toyloq", "Qo'shrabot", "Urgut"
  ],
  "Farg'ona": [
    "Farg'ona shahri", "Marg'ilon", "Qo'qon", "Bog'dod", "Beshariq", 
    "Buvayda", "Dang'ara", "Quva", "Rishton", "Toshloq", "Uchko'prik", 
    "O'zbekiston", "Yozyovon", "So'x"
  ],
  "Andijon": [
    "Andijon shahri", "Asaka", "Baliqchi", "Buloqboshi", "Bo'ston", 
    "Jalaquduq", "Izboskan", "Marhamat", "Oltinko'l", "Paxtaobod", 
    "Ulug'nor", "Xo'jaobod", "Shahrixon", "Qo'rg'ontepa"
  ],
  "Namangan": [
    "Namangan shahri", "Kosonsoy", "Mingbuloq", "Pop", "To'raqo'rg'on", 
    "Uychi", "Uchqo'rg'on", "Chortoq", "Chust", "Yangiqo'rg'on", "Davlatobod"
  ],
  "Qashqadaryo": [
    "Karshi shahri", "Dehqonobod", "Kamashi", "Kasbi", "Kitob", 
    "Koson", "Ko'kdala", "Mirishkor", "Muborak", "Nishon", 
    "Chiroqchi", "Shahrisabz", "Yakkabog'"
  ],
  "Buxoro": [
    "Buxoro shahri", "Gijduvon", "Jondor", "Kogon", "Kofirnihon", 
    "Qorako'l", "Qoravulbozor", "Olot", "Peshku", "Romitan", 
    "Shofirkon", "Vobkent"
  ],
  "Xorazm": [
    "Urganch shahri", "Xiva", "Bog'ot", "Gurlan", "Qo'shko'pir", 
    "Shovot", "Toza bozor", "Xonqa", "Hazorasp", "Yangiariq", "Yangibozor"
  ],
  "Navoiy": [
    "Navoiy shahri", "Karmana", "Konimex", "Nurota", "Qiziltepa", 
    "Tomdi", "Uchquduq", "Xatirchi"
  ],
  "Jizzax": [
    "Jizzax shahri", "Arnasoy", "Baxmal", "Do'stlik", "Forish", 
    "G'allaorol", "Sharof Rashidov", "Mirzacho'l", "Paxtakor", "Yangiobod"
  ],
  "Sirdaryo": [
    "Guliston shahri", "Shirin", "Yangiyer", "Boyovut", "Oqoltin", 
    "Sardoba", "Sayxunobod", "Sirdaryo tumani", "Xovost"
  ],
  "Qoraqalpog'iston": [
    "Nukus shahri", "Amudaryo", "Beruniy", "Chimboy", "Ellikqala", 
    "Kegeyli", "Mo'ynoq", "Qonliko'l", "Qo'ng'irot", "Shumanay", 
    "Taxtako'pir", "To'rtko'l", "Xo'jayli"
  ]
};

export default function StudentDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useLang();
    const { students, groups, teachers, courses, payments, attendances, transports, addPayment, addAttendance, updateStudent, addStudentToGroup, deleteStudent, topics, updateAttendance } = useCRM();
    const [activeTab, setActiveTab] = useState('umumiy');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isRemovingBg, setIsRemovingBg] = useState(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [showSmsModal, setShowSmsModal] = useState(false);
    const [smsData, setSmsData] = useState({ phone: '', type: '' });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [attendanceGroupFilter, setAttendanceGroupFilter] = useState<number | null>(null);
    const [editingGroupPrice, setEditingGroupPrice] = useState<{ groupId: number, name: string, coursePrice: number } | null>(null);
    const [customPriceVal, setCustomPriceVal] = useState('');
    const [customNoteVal, setCustomNoteVal] = useState('');

    const handleConfirmDelete = async () => {
        try {
            await deleteStudent(student!.id);
            navigate('/students');
        } catch (err) {
            console.error("Delete failed", err);
            alert(t('error_occurred'));
        }
    };

    const handlePhotoCapture = async (base64: string) => {
        const compressed = await compressImage(base64);
        updateStudent(student!.id, { photo: compressed });
    };
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        status: 'Faol' as 'Faol' | 'Arxiv' | 'Sinov' | 'Bitiruvchi' | 'Passiv' | 'Muzlatilgan' | 'Sertifikatli',
        phone: '',
        birthDate: '',
        address: '',
        location: '',
        fatherName: '',
        fatherPhone: '',
        motherName: '',
        motherPhone: '',
        transportId: '' as string | number,
        studentSchool: '',
        privilegeType: 'None',
        certCategory: '',
        certSubject: '',
        certType: '',
        orgType: '',
        region: '',
        district: ''
    });

    const student = students.find(s => s.id === Number(id));

    if (!student) {
        return (
            <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm transition-colors">
                <div className="w-20 h-20 bg-gray-55 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-gray-650">
                    <Users className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                </div>
                <p className="text-gray-405 dark:text-gray-500 font-bold uppercase tracking-widest text-xs">{t('student_not_found')}</p>
                <button onClick={() => navigate('/students')} className="mt-6 text-[#1b6b6b] font-bold uppercase tracking-widest text-[10px] hover:underline px-6 py-2 bg-teal-50 dark:bg-teal-900/30 rounded-xl transition-all">{t('back_to_list')}</button>
            </div>
        );
    }

    const studentGroups = groups.filter(g => (student.groups || []).includes(g.id)).map(g => {
        const teacher = teachers.find(t => t.id === g.teacherId);
        const course = courses.find(c => c.id === g.courseId);
        return { ...g, teacherName: teacher?.name || t('unknown_teacher'), courseName: course?.name || '-', coursePrice: course?.price || 0 };
    });

    const studentPayments = payments.filter(p => p.studentId === Number(id)).reverse();
    const studentAttendances = (attendances || [])
        .filter(a => a.studentId === Number(id))
        .sort((a, b) => b.date.localeCompare(a.date));

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
            studentSchool: student.studentSchool || '',
            privilegeType: student.privilegeType || 'None',
            certCategory: student.certCategory || '',
            certSubject: student.certSubject || '',
            certType: student.certType || '',
            orgType: student.orgType || '',
            region: student.region || '',
            district: student.district || ''
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
                alert(t('bg_cleared_success'));
            } else {
                alert(t('error_occurred') + ": " + data.error);
            }
        } catch (err) {
            console.error("BG Removal failed", err);
            alert(t('error_occurred'));
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
            alert(t('phone_not_found'));
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
                alert(t('sms_sent_success') || "SMS muvaffaqiyatli yuborildi");
            } else {
                alert(t('error_occurred') + ": " + (data.error || data.message || "Noma'lum xatolik"));
            }
        } catch (err: any) {
            console.error("SMS xatoligi:", err);
            alert(t('error_occurred') + ": " + err.message);
        }
    };

    const attendanceRate = studentAttendances.length ? ((studentAttendances.filter(a => a.status === 'Keldi').length / studentAttendances.length) * 100).toFixed(0) : '0';
    const missedLessonsCount = studentAttendances.filter(a => a.status === 'Kelmapdi').length;
    const missedTopicsCount = studentAttendances.filter(a => a.status === 'Kelmapdi' && !a.caughtUp).length;
    const caughtUpTopicsCount = studentAttendances.filter(a => a.status === 'Kelmapdi' && a.caughtUp).length;

    const labelCls = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";
    const inputCls = "w-full px-4 py-3 bg-gray-55 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Back Button */}
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-[#1b6b6b] transition-all text-[10px] font-extrabold uppercase tracking-widest group cursor-pointer">
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                {t('back')}
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
                                        <label className={labelCls}>{t('student_name')}</label>
                                        <input 
                                            value={editForm.name}
                                            onChange={e => setEditForm({...editForm, name: e.target.value})}
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>{t('status')}</label>
                                        <select 
                                            value={editForm.status}
                                            onChange={e => setEditForm({...editForm, status: e.target.value as any})}
                                            className={inputCls}
                                        >
                                            <option value="Faol">{t('status_active')}</option>
                                            <option value="Sinov">{t('status_test')}</option>
                                            <option value="Arxiv">{t('status_archive')}</option>
                                            <option value="Bitiruvchi">{t('status_graduated')}</option>
                                            <option value="Passiv">{t('status_passive')}</option>
                                            <option value="Muzlatilgan">{t('status_frozen')}</option>
                                            <option value="Sertifikatli">{t('status_certified')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>{t('transport')}</label>
                                        <select 
                                            value={editForm.transportId}
                                            onChange={e => setEditForm({...editForm, transportId: e.target.value})}
                                            className={inputCls}
                                        >
                                            <option value="">{t('transport_none')}</option>
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
                                        <span className={`px-2.5 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wider ${
                                            student.status === 'Faol' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                            student.status === 'Sinov' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400' :
                                            student.status === 'Muzlatilgan' ? 'bg-sky-50 text-sky-650 border-sky-100 dark:bg-sky-950/20 dark:text-sky-455' :
                                            student.status === 'Passiv' ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400' :
                                            student.status === 'Bitiruvchi' ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400' :
                                            student.status === 'Sertifikatli' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400' :
                                            'bg-gray-55 text-gray-400 border-gray-100 dark:bg-gray-900/50'
                                        }`}>
                                            {student.status === 'Faol' ? t('status_active') : 
                                             student.status === 'Arxiv' ? t('status_archive') : 
                                             student.status === 'Sinov' ? t('status_test') : 
                                             student.status === 'Muzlatilgan' ? t('status_frozen') :
                                             student.status === 'Passiv' ? t('status_passive') :
                                             student.status === 'Bitiruvchi' ? t('status_graduated') :
                                             student.status === 'Sertifikatli' ? t('status_certified') :
                                             student.status}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="px-6 pb-6 space-y-4 border-t border-dashed border-gray-100 dark:border-gray-700/50 pt-4">
                            <div className={`p-4 rounded-2xl border ${student.balance >= 0 ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-emerald-600' : 'bg-rose-50/50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40 text-rose-600'} flex flex-col items-center`}>
                                <span className="text-[8px] font-black text-gray-405 uppercase tracking-widest mb-1">{t('filter_balance')}</span>
                                <span className="text-lg font-black tracking-tight tabular-nums">{student.balance.toLocaleString()} <span className="text-[9px] font-extrabold opacity-60">UZS</span></span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <label className="relative flex items-center justify-center gap-1.5 py-2.5 bg-gray-55 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-white transition-all group">
                                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                    <ImageIcon size={14} className="text-gray-400 group-hover:text-[#1b6b6b]" />
                                    <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">{t('upload')}</span>
                                </label>
                                
                                <button 
                                    onClick={() => setIsPhotoModalOpen(true)}
                                    className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-55 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:bg-white transition-all cursor-pointer"
                                >
                                    <Camera size={14} className="text-gray-400" />
                                    <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">{t('take_photo')}</span>
                                </button>
                            </div>
                            
                            {student.photo && (
                                <button 
                                    onClick={handleRemoveBg}
                                    disabled={isRemovingBg}
                                    className="w-full flex items-center justify-center gap-1.5 py-3 bg-violet-50 text-violet-600 border border-violet-100 dark:bg-violet-950/20 dark:text-violet-400 rounded-xl text-[9px] font-extrabold uppercase tracking-widest hover:bg-violet-600 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    <Sparkles size={12} className={isRemovingBg ? 'animate-spin' : ''} />
                                    {isRemovingBg ? t('clearing') : t('clear_bg_btn')}
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
                                        <label className={labelCls}>{t('student_phone')}</label>
                                        <input type="tel" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>{t('birth_date')}</label>
                                        <input type="date" value={editForm.birthDate} onChange={e => setEditForm({...editForm, birthDate: e.target.value})} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>{t('address')}</label>
                                        <input type="text" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Ta'lim muassasasi turi</label>
                                        <select 
                                            value={editForm.orgType} 
                                            onChange={e => setEditForm({...editForm, orgType: e.target.value})} 
                                            className={inputCls}
                                        >
                                            <option value="">Tanlang...</option>
                                            <option value="Maktab">Maktab</option>
                                            <option value="Bog'cha">Bog'cha</option>
                                            <option value="Oliy o'quv yurti">Oliy o'quv yurti</option>
                                            <option value="Kollej / Litsey">Kollej / Litsey</option>
                                            <option value="Boshqa">Boshqa</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Muassasa nomi</label>
                                        <input type="text" value={editForm.studentSchool} onChange={e => setEditForm({...editForm, studentSchool: e.target.value})} className={inputCls} placeholder="45-maktab" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className={labelCls}>Viloyat</label>
                                            <select 
                                                value={editForm.region} 
                                                onChange={e => setEditForm({...editForm, region: e.target.value, district: ''})} 
                                                className={inputCls}
                                            >
                                                <option value="">Tanlang...</option>
                                                {Object.keys(UZB_REGIONS).map(r => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Tuman</label>
                                            <select 
                                                value={editForm.district} 
                                                onChange={e => setEditForm({...editForm, district: e.target.value})} 
                                                className={inputCls}
                                                disabled={!editForm.region}
                                            >
                                                <option value="">Tanlang...</option>
                                                {editForm.region && UZB_REGIONS[editForm.region]?.map(d => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className={labelCls}>{t('father_name')}</label>
                                            <input type="text" value={editForm.fatherName} onChange={e => setEditForm({...editForm, fatherName: e.target.value})} className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>{t('father_phone')}</label>
                                            <input type="tel" value={editForm.fatherPhone} onChange={e => setEditForm({...editForm, fatherPhone: e.target.value})} className={inputCls} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className={labelCls}>{t('mother_name')}</label>
                                            <input type="text" value={editForm.motherName} onChange={e => setEditForm({...editForm, motherName: e.target.value})} className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>{t('mother_phone')}</label>
                                            <input type="tel" value={editForm.motherPhone} onChange={e => setEditForm({...editForm, motherPhone: e.target.value})} className={inputCls} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Imtiyoz turi</label>
                                        <select 
                                            value={editForm.privilegeType} 
                                            onChange={e => setEditForm({
                                                ...editForm, 
                                                privilegeType: e.target.value,
                                                certCategory: e.target.value === 'Sertifikat' ? editForm.certCategory || 'Milliy' : '',
                                                certSubject: e.target.value === 'Sertifikat' ? editForm.certSubject : '',
                                                certType: e.target.value === 'Sertifikat' ? editForm.certType : ''
                                            })} 
                                            className={inputCls}
                                        >
                                            <option value="None">Mavjud emas</option>
                                            <option value="Nogironligi bor">Nogironligi bor</option>
                                            <option value="Harbiy oila">Harbiy oila</option>
                                            <option value="Xotin-qizlar daftari">Xotin-qizlar daftari</option>
                                            <option value="Sertifikat">Sertifikat</option>
                                        </select>
                                    </div>

                                    {editForm.privilegeType === 'Sertifikat' && (
                                        <div className="space-y-3 p-3 bg-gray-55 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                                            <div>
                                                <label className={labelCls}>Sertifikat toifasi</label>
                                                <select 
                                                    value={editForm.certCategory} 
                                                    onChange={e => setEditForm({
                                                        ...editForm, 
                                                        certCategory: e.target.value,
                                                        certSubject: e.target.value === 'Milliy' ? editForm.certSubject || 'Matematika' : '',
                                                        certType: e.target.value === 'Xalqaro' ? editForm.certType || 'IELTS' : ''
                                                    })} 
                                                    className={inputCls}
                                                >
                                                    <option value="Milliy">Milliy sertifikat</option>
                                                    <option value="Xalqaro">Xalqaro sertifikat</option>
                                                </select>
                                            </div>

                                            {editForm.certCategory === 'Milliy' && (
                                                <div>
                                                    <label className={labelCls}>Sertifikat fani</label>
                                                    <select 
                                                        value={editForm.certSubject} 
                                                        onChange={e => setEditForm({...editForm, certSubject: e.target.value})} 
                                                        className={inputCls}
                                                    >
                                                        <option value="">Tanlang...</option>
                                                        <option value="Matematika">Matematika</option>
                                                        <option value="Fizika">Fizika</option>
                                                        <option value="Kimyo">Kimyo</option>
                                                        <option value="Biologiya">Biologiya</option>
                                                        <option value="Tarix">Tarix</option>
                                                        <option value="Ingliz tili">Ingliz tili</option>
                                                        <option value="Nemis tili">Nemis tili</option>
                                                        <option value="Rus tili">Rus tili</option>
                                                        <option value="Ona tili">Ona tili</option>
                                                    </select>
                                                </div>
                                            )}

                                            {editForm.certCategory === 'Xalqaro' && (
                                                <div>
                                                    <label className={labelCls}>Sertifikat turi</label>
                                                    <select 
                                                        value={editForm.certType} 
                                                        onChange={e => setEditForm({...editForm, certType: e.target.value})} 
                                                        className={inputCls}
                                                    >
                                                        <option value="">Tanlang...</option>
                                                        <option value="IELTS">IELTS</option>
                                                        <option value="SAT">SAT</option>
                                                        <option value="TOEFL">TOEFL</option>
                                                        <option value="CEFR">CEFR</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div>
                                        <label className={labelCls}>{t('location')}</label>
                                        <button 
                                            onClick={() => setIsMapOpen(true)}
                                            className={`w-full py-2.5 border rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-extrabold uppercase transition-all cursor-pointer ${editForm.location ? 'bg-teal-50 text-[#1b6b6b] border-teal-100' : 'bg-gray-55 text-gray-400 border-gray-100'}`}
                                        >
                                            <MapPin size={12} />
                                            {editForm.location ? t('edit') : t('select_from_map')}
                                        </button>
                                    </div>
                                    <div className="pt-2 flex gap-2">
                                        <button 
                                            onClick={handleSaveEdit} 
                                            disabled={isSaving}
                                            className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[9px] font-extrabold uppercase shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {t('save')}
                                        </button>
                                        <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-white border border-gray-100 text-gray-405 rounded-xl text-[9px] font-extrabold uppercase transition-all cursor-pointer">
                                            {t('cancel')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 mb-2 px-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#1b6b6b]" />
                                        <h3 className="text-[9px] font-black text-[#1b6b6b] uppercase tracking-widest">{t('lead_details_title')}</h3>
                                    </div>
                                    <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label={t('student_phone')} value={student.phone} />
                                    <InfoRow 
                                        icon={<Bus className="w-3.5 h-3.5" />} 
                                        label={t('transport')} 
                                        value={transports.find(t => t.id === student.transportId)?.name || t('transport_none')} 
                                    />
                                    <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label={t('birth_date')} value={student.birthDate} />
                                    <div className="space-y-2">
                                        <InfoRow icon={<Users className="w-3.5 h-3.5" />} label={t('father')} value={student.fatherName || "-"} />
                                        {student.fatherPhone && (
                                            <div className="flex items-center gap-1.5 pl-12 -mt-1">
                                                <span className="text-[10px] font-bold text-gray-550 tabular-nums">{student.fatherPhone}</span>
                                                <button onClick={() => handleSendSms(student.fatherPhone!, 'manual')} className="p-1 text-[#1b6b6b] hover:bg-teal-50 rounded transition-all cursor-pointer">
                                                    <Sparkles size={11} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <InfoRow icon={<Users className="w-3.5 h-3.5" />} label={t('mother')} value={student.motherName || "-"} />
                                        {student.motherPhone && (
                                            <div className="flex items-center gap-1.5 pl-12 -mt-1">
                                                <span className="text-[10px] font-bold text-gray-550 tabular-nums">{student.motherPhone}</span>
                                                <button onClick={() => handleSendSms(student.motherPhone!, 'manual')} className="p-1 text-[#1b6b6b] hover:bg-teal-50 rounded transition-all cursor-pointer">
                                                    <Sparkles size={11} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {student.orgType && (
                                        <InfoRow icon={<BookOpen className="w-3.5 h-3.5" />} label="Muassasa turi" value={student.orgType} />
                                    )}
                                    <InfoRow icon={<BookOpen className="w-3.5 h-3.5" />} label="Muassasa nomi" value={student.studentSchool || "-"} />
                                    {(student.region || student.district) && (
                                        <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Viloyat / Tuman" value={[student.region, student.district].filter(Boolean).join(', ')} />
                                    )}
                                    <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label={t('address')} value={student.address} />
                                    {student.location && (
                                        <button 
                                            onClick={handleOpenMap}
                                            className="w-full mt-2 flex items-center justify-center gap-1.5 px-4 py-3 bg-teal-50 dark:bg-teal-950/20 text-[#1b6b6b] border border-teal-100 dark:border-teal-900/40 text-[9px] font-black uppercase tracking-[0.1em] rounded-xl hover:bg-[#1b6b6b] hover:text-white transition-all cursor-pointer"
                                        >
                                            <MapPin size={13} />
                                            {t('view_on_map')}
                                        </button>
                                    )}
                                    <InfoRow icon={<Clock className="w-3.5 h-3.5" />} label={t('registered_at')} value={student.joinedDate} />

                                    {student.privilegeType && student.privilegeType !== 'None' && (
                                        <div className="flex items-start gap-2.5 p-3 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/30 rounded-2xl">
                                            <div className="w-7 h-7 rounded-lg bg-[#1b6b6b]/10 dark:bg-[#1b6b6b]/20 text-[#1b6b6b] flex items-center justify-center shrink-0 animate-pulse">
                                                <Sparkles size={14} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                                    Imtiyoz: {student.privilegeType === 'Sertifikat' ? `${student.certCategory} sertifikat` : student.privilegeType}
                                                </p>
                                                {student.privilegeType === 'Sertifikat' && (
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                                        {student.certCategory === 'Milliy' ? `Fan: ${student.certSubject || '-'}` : `Turi: ${student.certType || '-'}`}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <button 
                                        onClick={() => setShowDeleteModal(true)}
                                        className="w-full mt-4 flex items-center justify-center gap-1.5 px-4 py-3 bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40 text-[9px] font-black uppercase tracking-[0.1em] rounded-xl hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                                    >
                                        <XCircle size={13} />
                                        {t('delete_student')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Tab Content */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <StatCardV3 
                            label={t('attendance')} 
                            value={`${attendanceRate}%`}
                            subValue={t('class_attendance')}
                            icon={<ClipboardCheck className="text-emerald-500" size={16} />} 
                            color="emerald"
                        />
                        <StatCardV3 
                            label={t('missed_lessons')} 
                            value={missedLessonsCount}
                            subValue={t('missed_lessons_subtitle')}
                            icon={<XCircle className="text-rose-500" size={16} />} 
                            color="rose"
                        />
                        <StatCardV3 
                            label={t('missed_topics')} 
                            value={missedTopicsCount}
                            subValue={t('missed_topics_subtitle')}
                            icon={<BookOpen className="text-violet-500" size={16} />} 
                            color="violet"
                        />
                        <StatCardV3 
                            label={t('caught_up_topics')} 
                            value={caughtUpTopicsCount}
                            subValue={t('caught_up_topics_subtitle')}
                            icon={<CheckCircle className="text-teal-500" size={16} />} 
                            color="teal"
                        />
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden min-h-[500px]">
                        <div className="flex px-4 bg-gray-55 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/50 gap-2 overflow-x-auto scrollbar-hide">
                            <TabButton label={t('general')} icon={<Layers className="w-3.5 h-3.5" />} active={activeTab === 'umumiy'} onClick={() => setActiveTab('umumiy')} />
                            <TabButton label={t('stat_groups')} icon={<Users className="w-3.5 h-3.5" />} active={activeTab === 'courses'} onClick={() => setActiveTab('courses')} />
                            <TabButton label={t('payments_tab')} icon={<CreditCard className="w-3.5 h-3.5" />} active={activeTab === 'tolovlar'} onClick={() => setActiveTab('tolovlar')} />
                            <TabButton label={t('attendance')} icon={<ClipboardCheck className="w-3.5 h-3.5" />} active={activeTab === 'yoqlama'} onClick={() => setActiveTab('yoqlama')} />
                        </div>

                        <div className="p-6">
                            {activeTab === 'umumiy' && (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block pb-2 border-b border-gray-55 dark:border-gray-700/50">{t('active_groups')}</span>
                                            <div className="space-y-3">
                                                {studentGroups.length === 0 ? (
                                                    <p className="text-center py-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('no_groups_found')}</p>
                                                ) : (
                                                    studentGroups.map(group => {
                                                        const studentCustomPrice = student.customPrices && typeof student.customPrices === 'object'
                                                            ? (student.customPrices as Record<string, number>)[group.id]
                                                            : undefined;
                                                        return (
                                                            <div key={group.id} 
                                                                className="group bg-gray-55 dark:bg-gray-900/30 p-4 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all flex items-center justify-between">
                                                                <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/courses/${group.id}`)}>
                                                                    <div className="w-10 h-10 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-705 rounded-xl flex items-center justify-center text-[#1b6b6b] shrink-0">
                                                                        <BookOpen size={18} />
                                                                    </div>
                                                                    <div>
                                                                        <h5 className="text-xs font-black text-gray-900 dark:text-white group-hover:text-[#1b6b6b] uppercase tracking-tight">{group.name}</h5>
                                                                        <p className="text-[9px] font-bold text-gray-400 mt-0.5">{group.courseName} &bull; {group.teacherName}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="text-right">
                                                                        {studentCustomPrice !== undefined ? (
                                                                            <>
                                                                                <span className="block text-xs font-black text-[#1b6b6b] tabular-nums">{studentCustomPrice.toLocaleString()} UZS</span>
                                                                                <span className="block text-[8px] font-extrabold uppercase text-[#1b6b6b]/60 tracking-wider">Imtiyozli narx</span>
                                                                                {(() => {
                                                                                    const note = student.customPrices && typeof student.customPrices === 'object'
                                                                                        ? (student.customPrices as Record<string, any>)['note_' + group.id]
                                                                                        : null;
                                                                                    return note ? <span className="block text-[8px] text-gray-400 italic mt-0.5 max-w-[120px] truncate">{note}</span> : null;
                                                                                })()}
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <span className="block text-xs font-black text-gray-500 dark:text-gray-400 tabular-nums">{(group.coursePrice || 0).toLocaleString()} UZS</span>
                                                                                <span className="block text-[8px] font-extrabold uppercase text-gray-400 tracking-wider">Standart narx</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    <button 
                                                                        onClick={() => {
                                                                            setEditingGroupPrice({ groupId: group.id, name: group.name, coursePrice: group.coursePrice || 0 });
                                                                            setCustomPriceVal(studentCustomPrice !== undefined ? String(studentCustomPrice) : '');
                                                                            const existingNote = student.customPrices && typeof student.customPrices === 'object' ? (student.customPrices as Record<string, any>)['note_' + group.id] || '' : '';
                                                                            setCustomNoteVal(existingNote);
                                                                        }}
                                                                        className="p-2 bg-white dark:bg-gray-800 hover:bg-[#1b6b6b]/10 dark:hover:bg-[#1b6b6b]/10 border border-gray-100 dark:border-gray-700 hover:border-[#1b6b6b] rounded-xl text-gray-400 hover:text-[#1b6b6b] transition-all cursor-pointer"
                                                                        title="Maxsus narx belgilash"
                                                                    >
                                                                        <Edit size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block pb-2 border-b border-gray-55 dark:border-gray-700/50">{t('latest_payments')}</span>
                                            <div className="space-y-3">
                                                {studentPayments.slice(0, 4).map(p => {
                                                    const isDed = p.amount < 0;
                                                    return (
                                                    <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl ${isDed ? 'bg-rose-50/60 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30' : 'bg-gray-55 dark:bg-gray-900/30'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDed ? 'bg-rose-50 text-rose-500 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40' : 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'}`}>
                                                                {isDed ? <ReceiptText size={18} /> : <CreditCard size={18} />}
                                                            </div>
                                                            <div>
                                                                <p className={`text-xs font-black ${isDed ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
                                                                    {isDed ? '' : '+'}{p.amount.toLocaleString()} <span className="text-[9px] opacity-60">UZS</span>
                                                                </p>
                                                                <p className="text-[9px] font-bold text-gray-400 mt-0.5">{p.date}</p>
                                                            </div>
                                                        </div>
                                                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-md border uppercase tracking-wider ${isDed ? 'text-rose-500 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40' : 'text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                                                            {isDed ? 'Oylik' : p.type === 'Naqd' ? t('type_cash') : p.type === 'Karta' ? t('type_card') : p.type === 'Peyme' ? t('type_payme') : p.type === 'Klik' ? t('type_click') : p.type}
                                                        </span>
                                                    </div>
                                                    );
                                                })}
                                                {studentPayments.length === 0 && (
                                                    <p className="text-center py-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('no_payment_history')}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Qoldirilgan va yopilgan mavzular section */}
                                    <div className="space-y-4 pt-6 border-t border-dashed border-gray-150 dark:border-gray-700/50">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('missed_and_closed_topics')}</span>
                                        </div>
                                        
                                        {studentAttendances.filter(a => a.status === 'Kelmapdi').length === 0 ? (
                                            <p className="text-center py-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('no_missed_topics')}</p>
                                        ) : (
                                            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl overflow-hidden shadow-sm">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-55 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700/50">
                                                            <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('date_group')}</th>
                                                            <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('topic_label')}</th>
                                                            <th className="p-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('status')}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                        {studentAttendances.filter(a => a.status === 'Kelmapdi').map(a => {
                                                            const groupObj = groups.find(g => g.id === a.groupId);
                                                            
                                                            // Resolve Topic using our 3-tier lookup
                                                            let topicObj = a.topicId ? (topics || []).find(t => t.id === a.topicId) : null;
                                                            if (!topicObj && groupObj) {
                                                                const siblingAttendance = (attendances || []).find(att => 
                                                                    att.groupId === a.groupId && 
                                                                    att.date === a.date && 
                                                                    att.topicId
                                                                );
                                                                if (siblingAttendance) {
                                                                    topicObj = (topics || []).find(t => t.id === siblingAttendance.topicId) || null;
                                                                }
                                                            }
                                                            if (!topicObj && groupObj) {
                                                                const courseTopics = (topics || []).filter(t => t.courseId === groupObj.courseId).sort((a, b) => a.order - b.order);
                                                                const groupDates = Array.from(new Set(
                                                                    (attendances || [])
                                                                        .filter(att => att.groupId === a.groupId)
                                                                        .map(att => att.date)
                                                                )).sort();
                                                                const dateIdx = groupDates.indexOf(a.date);
                                                                if (dateIdx !== -1 && dateIdx < courseTopics.length) {
                                                                    topicObj = courseTopics[dateIdx];
                                                                }
                                                            }

                                                            return (
                                                                <tr key={a.id} className="hover:bg-gray-55/30 transition-colors">
                                                                    <td className="p-3">
                                                                        <p className="text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-tight">{a.date}</p>
                                                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{groupObj?.name || '-'}</p>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        {topicObj ? (
                                                                            <div className="space-y-1">
                                                                                <p className="text-[9px] font-black text-[#1b6b6b] dark:text-teal-400 uppercase tracking-wider">
                                                                                    {topicObj.order}. {topicObj.title}
                                                                                </p>
                                                                                {topicObj.description && (
                                                                                    <p className="text-[8px] font-medium text-gray-400 dark:text-gray-500 uppercase truncate max-w-[300px]" title={topicObj.description}>
                                                                                        {topicObj.description}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-[8px] font-bold text-gray-305 dark:text-gray-600 uppercase tracking-wider italic">-</p>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <div className="flex justify-center">
                                                                            <button
                                                                                onClick={async () => {
                                                                                    try {
                                                                                        await updateAttendance(a.id, { caughtUp: !a.caughtUp });
                                                                                    } catch (err) {
                                                                                        console.error("Failed to update caughtUp status", err);
                                                                                    }
                                                                                }}
                                                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                                                                                    a.caughtUp
                                                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
                                                                                        : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/40'
                                                                                }`}
                                                                            >
                                                                                {a.caughtUp ? t('topic_caught_up') : t('topic_not_caught_up')}
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'tolovlar' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-55 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-2xl">
                                        <div>
                                            <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('transactions_history')}</h4>
                                        </div>
                                        <button onClick={() => setShowPaymentModal(true)}
                                            className="px-6 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all text-center cursor-pointer">
                                            {t('add_payment')}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {studentPayments.map(p => {
                                            const isDeduction = p.amount < 0;
                                            return (
                                            <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl ${isDeduction ? 'bg-rose-50/60 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30' : 'bg-gray-55 dark:bg-gray-900/30'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDeduction
                                                        ? 'bg-rose-50 text-rose-500 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40'
                                                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
                                                    }`}>
                                                        {isDeduction ? <ReceiptText size={16} /> : <CreditCard size={16} />}
                                                    </div>
                                                    <div>
                                                        <p className={`text-xs font-black ${isDeduction ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
                                                            {isDeduction ? '' : '+'}{p.amount.toLocaleString()} <span className="text-[9px] opacity-60">UZS</span>
                                                        </p>
                                                        <p className="text-[9px] font-bold text-gray-400 mt-0.5">{p.date}</p>
                                                        {p.description && <p className="text-[9px] text-gray-400 mt-0.5 truncate max-w-[140px]">{p.description}</p>}
                                                    </div>
                                                </div>
                                                <span className={`text-[9px] font-black px-2.5 py-1 rounded-md border uppercase tracking-wider ${isDeduction
                                                    ? 'text-rose-500 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40'
                                                    : 'text-gray-650 dark:text-gray-400 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                                                }`}>
                                                    {isDeduction ? 'Oylik' : p.type === 'Naqd' ? t('type_cash') : p.type === 'Karta' ? t('type_card') : p.type === 'Peyme' ? t('type_payme') : p.type === 'Klik' ? t('type_click') : p.type}
                                                </span>
                                            </div>
                                            );
                                        })}
                                    </div>
                                    {studentPayments.length === 0 && (
                                        <p className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('no_payments_found')}</p>
                                    )}
                                </div>
                            )}

                            {activeTab === 'courses' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gray-55 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-2xl">
                                        <div>
                                            <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('student_groups')}</h4>
                                        </div>
                                        <button onClick={() => setShowGroupModal(true)}
                                            className="px-6 py-2.5 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest shadow-lg shadow-[#1b6b6b]/20 active:scale-95 transition-all text-center cursor-pointer">
                                            {t('add_to_group')}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {studentGroups.map(group => (
                                            <div key={group.id} onClick={() => navigate(`/courses/${group.id}`)} 
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
                                                        <span className="uppercase">{group.days === 'TOQ' ? t('odd_days') : group.days === 'JUFT' ? t('even_days') : t('every_day')}</span> &bull; {group.schedule}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {studentGroups.length === 0 && (
                                        <p className="text-center py-12 text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('no_groups_found')}</p>
                                    )}
                                </div>
                            )}

                            {activeTab === 'yoqlama' && (
                                <div className="animate-in fade-in duration-300">
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                                        {/* Left Column: Attendance Calendar */}
                                        <div className="lg:col-span-5 space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-55 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-2xl">
                                                <div>
                                                    <h4 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('attendance_calendar')}</h4>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">{t('present')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                        <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">{t('absent')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                                        <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">{t('late')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                                        <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">{t('early_leave')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                        <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">{t('not_marked')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl p-4 shadow-sm">
                                                <div className="grid grid-cols-7 gap-1">
                                                    {[t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'), t('day_fri'), t('day_sat'), t('day_sun')].map(day => (
                                                        <div key={day} className="text-center text-[8px] font-black text-gray-400 uppercase tracking-widest pb-1.5">{day}</div>
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
                                                                else if (att.status === 'Kechikdi') bgColor = 'bg-orange-400 text-white shadow-sm shadow-orange-400/20';
                                                                else if (att.status === 'ErtaKetdi') bgColor = 'bg-purple-500 text-white shadow-sm shadow-purple-500/20';
                                                                textColor = 'text-white';
                                                            } else if (isLessonDay) {
                                                                const todayStr = new Date().toISOString().split('T')[0];
                                                                if (dateStr < todayStr) {
                                                                    bgColor = 'bg-amber-400 text-white';
                                                                    textColor = 'text-white';
                                                                }
                                                            }

                                                            cells.push(
                                                                <div key={d} className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all ${bgColor} ${textColor}`}>
                                                                    <span className="text-[8px] font-bold">{d}</span>
                                                                </div>
                                                            );
                                                        }
                                                        return cells;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Column: Detailed History Table */}
                                        <div className="lg:col-span-7 space-y-4">
                                            <div className="flex items-center justify-between pb-1 border-b border-gray-55 dark:border-gray-700/50">
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('detailed_history')}</span>
                                                <select
                                                    value={attendanceGroupFilter || ''}
                                                    onChange={(e) => setAttendanceGroupFilter(e.target.value ? Number(e.target.value) : null)}
                                                    className="px-2.5 py-1 bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700/50 rounded-lg text-[8px] font-black uppercase tracking-wider cursor-pointer outline-none focus:ring-1 focus:ring-[#1b6b6b]/20 text-[#1b6b6b] dark:text-teal-400 font-bold"
                                                >
                                                    <option value="" className="bg-white dark:bg-gray-850 text-gray-600 font-bold">{t('all_groups')}</option>
                                                    {studentGroups.map(g => (
                                                        <option key={g.id} value={g.id} className="bg-white dark:bg-gray-850 text-gray-900 dark:text-white font-bold">{g.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-2xl overflow-hidden shadow-sm">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-55 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700/50">
                                                            <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('date_group')}</th>
                                                            <th className="p-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('topic_label')}</th>
                                                            <th className="p-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('status')}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                        {studentAttendances.filter(a => attendanceGroupFilter === null || a.groupId === attendanceGroupFilter).map(a => {
                                                            const groupObj = groups.find(g => g.id === a.groupId);
                                                            const courseObj = courses.find(c => c.id === groupObj?.courseId);

                                                            // 1. Direct topicId
                                                            let topicObj = a.topicId ? (topics || []).find(t => t.id === a.topicId) : null;

                                                            // 2. Sibling fallback
                                                            if (!topicObj && groupObj) {
                                                                const siblingAttendance = (attendances || []).find(att => 
                                                                    att.groupId === a.groupId && 
                                                                    att.date === a.date && 
                                                                    att.topicId
                                                                );
                                                                if (siblingAttendance) {
                                                                    topicObj = (topics || []).find(t => t.id === siblingAttendance.topicId) || null;
                                                                }
                                                            }

                                                            // 3. Chronological fallback
                                                            if (!topicObj && groupObj) {
                                                                const courseTopics = (topics || []).filter(t => t.courseId === groupObj.courseId).sort((a, b) => a.order - b.order);
                                                                const groupDates = Array.from(new Set(
                                                                    (attendances || [])
                                                                        .filter(att => att.groupId === a.groupId)
                                                                        .map(att => att.date)
                                                                )).sort();
                                                                const dateIdx = groupDates.indexOf(a.date);
                                                                if (dateIdx !== -1 && dateIdx < courseTopics.length) {
                                                                    topicObj = courseTopics[dateIdx];
                                                                }
                                                            }

                                                            return (
                                                                <tr key={a.id} className="hover:bg-gray-55/30 transition-colors">
                                                                    <td className="p-3">
                                                                        <p className="text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-tight">{a.date}</p>
                                                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{groupObj?.name || '-'}</p>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        {topicObj ? (
                                                                            <div className="space-y-1">
                                                                                <p className="text-[9px] font-black text-[#1b6b6b] dark:text-teal-400 uppercase tracking-wider">
                                                                                    {topicObj.order}. {topicObj.title}
                                                                                </p>
                                                                                {topicObj.description && (
                                                                                    <p className="text-[8px] font-medium text-gray-400 dark:text-gray-500 uppercase truncate max-w-[200px]" title={topicObj.description}>
                                                                                        {topicObj.description}
                                                                                    </p>
                                                                                )}
                                                                                {a.status === 'Kelmapdi' && (
                                                                                    <button
                                                                                        onClick={async () => {
                                                                                            try {
                                                                                                await updateAttendance(a.id, { caughtUp: !a.caughtUp });
                                                                                            } catch (err) {
                                                                                                console.error("Failed to update caughtUp status", err);
                                                                                            }
                                                                                        }}
                                                                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all border cursor-pointer mt-1 ${
                                                                                            a.caughtUp
                                                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
                                                                                                : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/40'
                                                                                        }`}
                                                                                    >
                                                                                        {a.caughtUp ? t('topic_caught_up') : t('topic_not_caught_up')}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="space-y-1">
                                                                                <p className="text-[8px] font-bold text-gray-305 dark:text-gray-600 uppercase tracking-wider italic">
                                                                                    -
                                                                                </p>
                                                                                {a.status === 'Kelmapdi' && (
                                                                                    <button
                                                                                        onClick={async () => {
                                                                                            try {
                                                                                                                            await updateAttendance(a.id, { caughtUp: !a.caughtUp });
                                                                                            } catch (err) {
                                                                                                console.error("Failed to update caughtUp status", err);
                                                                                            }
                                                                                        }}
                                                                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all border cursor-pointer mt-1 ${
                                                                                            a.caughtUp
                                                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
                                                                                                : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/40'
                                                                                        }`}
                                                                                    >
                                                                                        {a.caughtUp ? t('topic_caught_up') : t('topic_not_caught_up')}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <div className="flex justify-center">
                                                                            <select
                                                                                value={a.status}
                                                                                onChange={async (e) => {
                                                                                    try {
                                                                                        await updateAttendance(a.id, { status: e.target.value as any });
                                                                                    } catch (err) {
                                                                                        console.error("Failed to update attendance status", err);
                                                                                    }
                                                                                }}
                                                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black border uppercase tracking-wider cursor-pointer outline-none transition-all ${
                                                                                    a.status === 'Keldi' 
                                                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                                                                        : a.status === 'Kelmapdi'
                                                                                            ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400'
                                                                                            : a.status === 'Kechikdi'
                                                                                                ? 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/20 dark:text-orange-400'
                                                                                                : a.status === 'ErtaKetdi'
                                                                                                    ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400'
                                                                                                    : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400'
                                                                                }`}
                                                                            >
                                                                                {a.status !== 'Keldi' && a.status !== 'Kelmapdi' && a.status !== 'Sababli' && a.status !== 'Kechikdi' && a.status !== 'ErtaKetdi' && (
                                                                                    <option value={a.status} disabled hidden>
                                                                                        {(a.status as any) === "O'tildi" ? t('not_marked') : a.status}
                                                                                    </option>
                                                                                )}
                                                                                <option value="Keldi" className="bg-white dark:bg-gray-800 text-emerald-600 font-bold">{t('present')}</option>
                                                                                <option value="Kelmapdi" className="bg-white dark:bg-gray-800 text-rose-600 font-bold">{t('absent')}</option>
                                                                                <option value="Sababli" className="bg-white dark:bg-gray-800 text-amber-600 font-bold">{t('excused')}</option>
                                                                                <option value="Kechikdi" className="bg-white dark:bg-gray-800 text-orange-600 font-bold">{t('late')}</option>
                                                                                <option value="ErtaKetdi" className="bg-white dark:bg-gray-800 text-purple-600 font-bold">{t('early_leave')}</option>
                                                                            </select>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
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
                        <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('delete_student')}</h3>
                        <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-widest leading-relaxed">
                            {t('delete_student_confirm').replace('{name}', student.name)}
                        </p>
                        <div className="mt-6 flex gap-3">
                            <button 
                                onClick={handleConfirmDelete}
                                className="flex-1 py-3 bg-rose-650 hover:bg-rose-600 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-500/20 cursor-pointer"
                            >
                                {t('delete')}
                            </button>
                            <button 
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 py-3 bg-gray-55 dark:bg-gray-900 text-gray-405 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                            >
                                {t('cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingGroupPrice && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEditingGroupPrice(null)} />
                    <div className="relative bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700/50">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50 dark:border-gray-700/50">
                            <div>
                                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Maxsus narx</h3>
                                <p className="text-[9px] font-bold text-[#1b6b6b] uppercase tracking-widest mt-0.5">{editingGroupPrice.name}</p>
                            </div>
                            <button onClick={() => setEditingGroupPrice(null)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750 rounded-xl cursor-pointer"><X size={16} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-black uppercase text-gray-400 tracking-wider mb-2">Oylik to'lov miqdori (UZS)</label>
                                <input
                                    type="number"
                                    placeholder={String(editingGroupPrice.coursePrice)}
                                    className="w-full px-4 py-3 bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                                    value={customPriceVal}
                                    onChange={e => setCustomPriceVal(e.target.value)}
                                />
                                <span className="block text-[8px] text-gray-400 font-medium mt-1">Standart narx: {editingGroupPrice.coursePrice.toLocaleString()} UZS</span>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black uppercase text-gray-400 tracking-wider mb-2">Izoh (chegirma sababi)</label>
                                <input
                                    type="text"
                                    placeholder="Masalan: Aka-ukasi bor, Stipendiyachi..."
                                    className="w-full px-4 py-3 bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-medium text-gray-900 dark:text-white focus:border-[#1b6b6b] focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                                    value={customNoteVal}
                                    onChange={e => setCustomNoteVal(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const cp = { ...(student.customPrices || {}) };
                                        delete cp[editingGroupPrice.groupId];
                                        delete cp['note_' + editingGroupPrice.groupId];
                                        await updateStudent(student.id, { customPrices: cp });
                                        setEditingGroupPrice(null);
                                    }}
                                    className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                >
                                    O'chirish
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const val = Number(customPriceVal);
                                        if (isNaN(val) || val < 0) {
                                            alert("Noto'g'ri qiymat kiritildi");
                                            return;
                                        }
                                        const cp: Record<string, any> = { ...(student.customPrices || {}), [editingGroupPrice.groupId]: val };
                                        if (customNoteVal.trim()) {
                                            cp['note_' + editingGroupPrice.groupId] = customNoteVal.trim();
                                        } else {
                                            delete cp['note_' + editingGroupPrice.groupId];
                                        }
                                        await updateStudent(student.id, { customPrices: cp });
                                        setEditingGroupPrice(null);
                                    }}
                                    className="flex-1 py-3 bg-[#1b6b6b] hover:bg-[#155252] text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                >
                                    Saqlash
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
        emerald: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40',
        rose: 'bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40',
        teal: 'bg-teal-50 border-teal-100 dark:bg-teal-950/20 dark:border-teal-900/40',
        amber: 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40',
        violet: 'bg-violet-50 border-violet-100 dark:bg-violet-950/20 dark:border-violet-900/40',
        blue: 'bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/40'
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
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Kursga Qo'shish</h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Yangi kurs tanlash</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                </div>
                <div className="p-4 max-h-[350px] overflow-y-auto space-y-2 custom-scrollbar">
                    {options.length === 0 ? (
                        <p className="text-center py-8 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Barcha kurslarga a'zo</p>
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
                        <label className={labelCls}>KURSNI TANLANG</label>
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

function SmsSendModal({ phone, studentName, onClose, onConfirm }: { phone: string; studentName?: string; onClose: () => void; onConfirm: (msg: string) => void }) {
    const defaultPrefix = `Sariosiyo o'quv markazi: `;
    const [message, setMessage] = useState(defaultPrefix);

    const templates = [
        {
            label: "Kursga qabul",
            text: `${studentName || '@name'} siz SARIOSIYO O'QUV MARKAZI ning MATEMATIKA o'quv kursiga 4-kurs sifatida qabul qilindingiz. Sizning darsingiz DUSHANBA, CHORSHANBA va JUMA kunlari 14:00 da bo'lib o'tadi!`
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
