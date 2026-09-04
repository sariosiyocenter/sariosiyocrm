import React, { useState } from 'react';
import {
    ArrowLeft, Phone, Calendar, MapPin, BookOpen, CreditCard, ReceiptText,
    Clock, CheckCircle, XCircle, Plus, Award, ClipboardCheck, Users, Layers, ChevronRight, Save, Edit, Bus, Sparkles, Image as ImageIcon, Camera, X, Send, Trash2, Star
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import StatTile from './ui/StatTile';
import { displayName } from '../lib/displayName';
import { useConfirm } from './ConfirmDialog';
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
    const { students, groups, teachers, courses, payments, attendances, scores, transports, addPayment, addAttendance, addScore, updateStudent, addStudentToGroup, deleteStudent, topics, updateAttendance, showNotification, loadAttendanceFor } = useCRM();
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState('umumiy');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const [showScoreModal, setShowScoreModal] = useState(false);
    const [isSavingScore, setIsSavingScore] = useState(false);
    const [newScore, setNewScore] = useState({ value: 5, comment: '', groupId: 0, date: new Date().toISOString().split('T')[0] });
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
    // Profil izohi (Student.comment) — bazada bor edi, lekin interfeysda ko'rinmasdi.
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [noteDraft, setNoteDraft] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);

    const handleConfirmDelete = async () => {
        try {
            await deleteStudent(student!.id);
            navigate('/students');
        } catch (err) {
            console.error("Delete failed", err);
            showNotification(t('error_occurred'), 'error');
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
        gender: 'Erkak' as 'Erkak' | 'Ayol',
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
        certScore: '',
        orgType: '',
        region: '',
        district: '',
        telegramId: '',
        fatherTelegramId: '',
        motherTelegramId: '',
        certificates: [] as Array<{ category: 'Milliy' | 'Xalqaro'; subject?: string; type?: string; score?: string }>
    });

    const student = students.find(s => s.id === Number(id));

    // Ismni oddiy yozuvga keltirish — umumiy yordamchi (src/lib/displayName).

    // Startup only carries recent attendance, so pull this student's full history —
    // the profile shows every lesson they have attended, not just the last few weeks.
    React.useEffect(() => {
        if (student?.id) loadAttendanceFor({ studentId: student.id });
    }, [student?.id]);

    if (!student) {
        return (
            <div className="flex flex-col items-center justify-center py-24 bg-sirt rounded-2xl border border-chiziq shadow-sm transition-colors">
                <div className="w-20 h-20 bg-gray-55 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-gray-650">
                    <Users className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                </div>
                <p className="text-gray-405 dark:text-gray-500 font-bold text-xs">{t('student_not_found')}</p>
                <button onClick={() => navigate('/students')} className="mt-6 text-brand font-bold text-[11px] hover:underline px-6 py-2 bg-teal-50 dark:bg-teal-900/30 rounded-xl transition-all">{t('back_to_list')}</button>
            </div>
        );
    }

    const studentGroups = groups.filter(g => (student.groups || []).includes(g.id)).map(g => {
        const teacher = teachers.find(t => t.id === g.teacherId);
        const course = courses.find(c => c.id === g.courseId);
        return { ...g, teacherName: teacher?.name || t('unknown_teacher'), courseName: (course?.name && course.name !== 'birinchi') ? course.name : '', coursePrice: course?.price || 0 };
    });

    const studentPayments = payments.filter(p => p.studentId === Number(id)).reverse();
    const studentScores = (scores || []).filter(sc => sc.studentId === Number(id));
    const studentAttendances = (attendances || [])
        .filter(a => a.studentId === Number(id))
        .sort((a, b) => b.date.localeCompare(a.date));

    const handleOpenMap = () => {
        if (!student.location) return;
        const [lat, lng] = student.location.split(',');
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    };

    const handleStartEdit = () => {
        let parsedCerts = [];
        try {
            if (Array.isArray(student.certificates)) {
                parsedCerts = student.certificates;
            } else if (student.certificates && typeof student.certificates === 'string') {
                parsedCerts = JSON.parse(student.certificates);
            }
        } catch (e) {
            console.error("Error parsing certificates:", e);
        }

        setEditForm({
            name: student.name,
            status: student.status,
            phone: student.phone,
            birthDate: student.birthDate,
            gender: (student.gender as 'Erkak' | 'Ayol') || 'Erkak',
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
            certScore: student.certScore || '',
            orgType: student.orgType || '',
            region: student.region || '',
            district: student.district || '',
            telegramId: student.telegramId || '',
            fatherTelegramId: student.fatherTelegramId || '',
            motherTelegramId: student.motherTelegramId || '',
            certificates: parsedCerts || []
        });
        setIsEditing(true);
    };

    const addEditCertificate = () => {
        setEditForm(prev => ({
            ...prev,
            certificates: [
                ...prev.certificates,
                { category: 'Milliy', subject: 'Matematika', score: '' }
            ]
        }));
    };

    const removeEditCertificate = (index: number) => {
        setEditForm(prev => ({
            ...prev,
            certificates: prev.certificates.filter((_, i) => i !== index)
        }));
    };

    const updateEditCertificate = (index: number, key: string, value: string) => {
        setEditForm(prev => ({
            ...prev,
            certificates: prev.certificates.map((c, i) => {
                if (i !== index) return c;
                const updated = { ...c, [key]: value };
                if (key === 'category') {
                    if (value === 'Milliy') {
                        delete updated.type;
                        updated.subject = 'Matematika';
                    } else {
                        delete updated.subject;
                        updated.type = 'IELTS';
                    }
                }
                return updated;
            })
        }));
    };

    const handleDisconnectTelegram = async (role: 'student' | 'father' | 'mother') => {
        if (!await confirm("Rostdan ham Telegram ulanishini o'chirmoqchimisiz?")) return;
        try {
            const data: any = {};
            if (role === 'student') data.telegramId = null;
            if (role === 'father') data.fatherTelegramId = null;
            if (role === 'mother') data.motherTelegramId = null;
            await updateStudent(student!.id, data);
        } catch (err) {
            console.error("Disconnect Telegram failed", err);
        }
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
                showNotification(t('bg_cleared_success'), 'info');
            } else {
                showNotification(t('error_occurred') + ": " + data.error, 'error');
            }
        } catch (err) {
            console.error("BG Removal failed", err);
            showNotification(t('error_occurred'), 'error');
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
    const handleSaveNote = async () => {
        try {
            setIsSavingNote(true);
            await updateStudent(student.id, { comment: noteDraft.trim() });
            setIsEditingNote(false);
        } catch (err) {
            console.error("Note save failed", err);
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleSendSms = (phone: string, type: string) => {
        if (!phone) {
            showNotification(t('phone_not_found'), 'info');
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
                showNotification(t('sms_sent_success') || "SMS muvaffaqiyatli yuborildi", 'success');
            } else {
                showNotification(t('error_occurred') + ": " + (data.error || data.message || "Noma'lum xatolik"), 'error');
            }
        } catch (err: any) {
            console.error("SMS xatoligi:", err);
            showNotification(t('error_occurred') + ": " + err.message, 'error');
        }
    };

    const attendanceRate = studentAttendances.length ? ((studentAttendances.filter(a => a.status === 'Keldi').length / studentAttendances.length) * 100).toFixed(0) : '0';
    const missedLessonsCount = studentAttendances.filter(a => a.status === 'Kelmapdi' || a.status === 'Sababli').length;
    const missedTopicsCount = studentAttendances.filter(a => (a.status === 'Kelmapdi' || a.status === 'Sababli') && !a.caughtUp).length;
    const caughtUpTopicsCount = studentAttendances.filter(a => (a.status === 'Kelmapdi' || a.status === 'Sababli') && a.caughtUp).length;

    // Davomat sanoqlari va seriyalar. studentAttendances yangi sanadan eskisiga
    // qarab saralangan, shuning uchun joriy seriya boshidan sanaladi.
    const attendanceCounts = {
        keldi: studentAttendances.filter(a => a.status === 'Keldi').length,
        kechikdi: studentAttendances.filter(a => a.status === 'Kechikdi').length,
        kelmadi: studentAttendances.filter(a => a.status === 'Kelmapdi').length,
        sababli: studentAttendances.filter(a => a.status === 'Sababli').length,
    };
    const currentStreak = (() => {
        let n = 0;
        for (const a of studentAttendances) {
            if (a.status === 'Keldi') n++; else break;
        }
        return n;
    })();
    const longestStreak = (() => {
        let best = 0, run = 0;
        for (const a of studentAttendances) {
            if (a.status === 'Keldi') { run++; if (run > best) best = run; } else run = 0;
        }
        return best;
    })();

    // To'lovlar yig'indisi (faqat kirimlar; manfiy yozuvlar — oylik hisoblash).
    const totalPaid = studentPayments.reduce((sum, p) => sum + (p.amount > 0 ? p.amount : 0), 0);

    // Qarz qachondan boshlangani. Balansni oxirgi to'lovlardan orqaga qarab
    // "yechib" borib, u manfiyga o'tgan operatsiya sanasini topamiz.
    const debtDays = (() => {
        if (student.balance >= 0) return null;
        const chron = [...studentPayments].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        let running = student.balance;
        let since: string | null = null;
        for (let i = chron.length - 1; i >= 0; i--) {
            const before = running - chron[i].amount;
            if (before >= 0) { since = chron[i].date; break; }
            running = before;
        }
        if (!since) return null;
        const d = new Date(since);
        if (isNaN(d.getTime())) return null;
        const days = Math.floor((Date.now() - d.getTime()) / 86400000);
        return days > 0 ? days : null;
    })();

    // "Oxirgi harakatlar" tasmasi — alohida jadval emas, mavjud to'lov, davomat
    // va ball yozuvlaridan yig'iladi.
    const recentActivity = (() => {
        type Item = { key: string; date: string; title: string; sub: string; tone: string; icon: React.ReactNode };
        const items: Item[] = [];
        studentPayments.slice(0, 6).forEach(p => items.push({
            key: `p${p.id}`,
            date: p.date,
            title: p.amount < 0
                ? `Oylik hisoblandi — ${Math.abs(p.amount).toLocaleString()} so'm`
                : `To'lov qabul qilindi — ${p.amount.toLocaleString()} so'm`,
            sub: p.description || (p.amount < 0 ? 'Avtomatik hisoblash' : p.type),
            tone: p.amount < 0 ? 'rose' : 'emerald',
            icon: p.amount < 0 ? <ReceiptText size={12} /> : <CreditCard size={12} />,
        }));
        studentAttendances.filter(a => a.status !== 'Keldi').slice(0, 5).forEach(a => {
            const g = groups.find(gr => gr.id === a.groupId);
            items.push({
                key: `a${a.id}`,
                date: a.date,
                title: a.status === 'Kelmapdi' ? 'Darsni qoldirdi — sababsiz'
                    : a.status === 'Sababli' ? 'Darsni qoldirdi — sababli'
                    : a.status === 'Kechikdi' ? 'Darsga kechikdi' : 'Darsdan erta ketdi',
                sub: g?.name || '—',
                tone: a.status === 'Kelmapdi' ? 'rose' : 'amber',
                icon: <XCircle size={12} />,
            });
        });
        [...studentScores].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5).forEach(sc => items.push({
            key: `s${sc.id}`,
            date: sc.date,
            title: `Ball berildi — +${sc.value}`,
            sub: sc.comment || groups.find(g => g.id === sc.groupId)?.name || '—',
            tone: 'teal',
            icon: <Star size={12} />,
        }));
        items.push({
            key: 'joined',
            date: student.joinedDate,
            title: "O'quv markaziga qo'shildi",
            sub: student.status,
            tone: 'gray',
            icon: <Plus size={12} />,
        });
        return items
            .filter(i => i.date)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .slice(0, 8);
    })();

    const labelCls = "block text-[11px] font-extrabold   text-matn-xira mb-2";
    const inputCls = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Back Button */}
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-matn-xira hover:text-brand transition-colors text-[12px] font-semibold group cursor-pointer">
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                {t('back')}
            </button>

            {/* Sahifa sarlavhasi. Ilgari bu ma'lumot chap ustundagi baland
                kartochkada turardi va o'ngdagi ko'rsatkichlar bilan bir xil
                savolga javob berardi. Endi bitta qator. */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3.5 min-w-0">
                    <div className="group/avatar relative w-12 h-12 rounded-full bg-brand/12 flex items-center justify-center text-brand font-semibold text-[15px] overflow-hidden shrink-0">
                        {displayName(student.name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                        {student.photo && (
                            <img src={student.photo} alt="" onError={e => { e.currentTarget.style.display = 'none'; }}
                                className="absolute inset-0 w-full h-full object-cover object-top" />
                        )}
                        {/* Rasm amallari avatarning ustida — alohida tugmalar
                            uyumi yasalmasin. */}
                        <div className="absolute inset-0 bg-gray-950/70 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            <label className="w-6 h-6 rounded-md bg-white/15 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors" title={t('upload')}>
                                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                <ImageIcon size={11} />
                            </label>
                            <button onClick={() => setIsPhotoModalOpen(true)} title={t('take_photo')}
                                className="w-6 h-6 rounded-md bg-white/15 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors">
                                <Camera size={11} />
                            </button>
                        </div>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-[22px] font-semibold text-matn tracking-tight leading-tight truncate">{displayName(student.name)}</h1>
                            <button onClick={handleStartEdit} title={t('edit')} className="text-matn-xira hover:text-brand cursor-pointer shrink-0">
                                <Edit size={13} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="num text-[12px] text-matn-xira">&#8470;{student.id}</span>
                            <span className="w-1 h-1 rounded-full bg-matn-xira" />
                            <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                                student.status === 'Faol' ? 'bg-yaxshi-fon text-yaxshi' :
                                student.status === 'Sinov' ? 'bg-ogoh-fon text-ogoh' :
                                student.status === 'Passiv' ? 'bg-xato-fon text-xato' :
                                student.status === 'Muzlatilgan' ? 'bg-brand/12 text-brand' :
                                'bg-ichki text-matn-sokin'
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
                            {[student.studentSchool, student.orgType].filter(Boolean).length > 0 && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-matn-xira" />
                                    <span className="text-[12px] text-matn-sokin truncate">
                                        {[student.studentSchool, student.orgType].filter(Boolean).join(' \u00b7 ')}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Eng ko'p ishlatiladigan uchta amal */}
                <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setShowPaymentModal(true)}
                        className="h-9 px-4 bg-brand hover:bg-brand-dark text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer">
                        {t('add_payment')}
                    </button>
                    <a href={student.phone ? `tel:${student.phone.replace(/\s/g, '')}` : undefined}
                        aria-disabled={!student.phone}
                        title={student.phone || t('phone_not_found')}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${student.phone
                            ? 'border-chiziq-kuchli text-brand hover:bg-brand hover:text-white cursor-pointer'
                            : 'border-chiziq text-matn-xira pointer-events-none'}`}>
                        <Phone size={15} />
                    </a>
                    <button onClick={() => handleSendSms(student.phone, 'manual')} title="SMS yuborish"
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-chiziq-kuchli text-brand hover:bg-brand hover:text-white transition-colors cursor-pointer">
                        <Send size={15} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                {/* Left Profile Card */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                        {/* Muqova. Avval butun kartochka enini egallagan to'q brend
                            slabi edi — qorong'u rejimda juda qichqirib turardi.
                            Endi past va yumshoq gradient. */}
                        {/* overflow-hidden bo'lmasligi kerak: avatar muqovadan pastga chiqib turadi
                            va u yerda qirqilib qolardi. Burchaklarni tashqi kartochka
                            allaqachon kesib turibdi. */}
                        {/* Muqova. Avval to'la to'yingan brend gradienti edi va
                            kartochkaning eng baland ovozli qismiga aylanib qolgandi —
                            asosiy narsa esa ism va balans. Endi u past va shaffof
                            qatlam: brend rangi sezilib turadi, lekin qichqirmaydi. */}
                        <div className={isEditing ? "px-5 py-4" : "hidden"}>
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
                            ) : null}
                        </div>

                        <div className="px-6 pb-5 space-y-3 border-t border-chiziq pt-4">
                            <div className={`px-4 py-3.5 rounded-xl border ${student.balance >= 0
                                ? 'bg-yaxshi-fon border-yaxshi/25 text-yaxshi'
                                : 'bg-xato-fon border-xato-chiziq text-xato'}`}>
                                <span className="text-[12px] text-matn-sokin block">{t('filter_balance')}</span>
                                <div className="flex items-baseline mt-1">
                                    <span className="raqam text-[24px] font-semibold leading-none">{student.balance.toLocaleString('ru-RU')}</span>
                                    <span className="text-[12px] text-matn-xira ml-1.5">so'm</span>
                                </div>
                                {debtDays !== null && (
                                    <span className="text-[11px] text-xato-mayin block mt-1.5">
                                        <span className="raqam">{debtDays}</span> kundan beri muddati o'tgan
                                    </span>
                                )}
                            </div>

                            {student.photo && (
                                <button
                                    onClick={handleRemoveBg}
                                    disabled={isRemovingBg}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 text-matn-xira hover:text-brand text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
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

                        <div className="px-6 pb-5 space-y-1 border-t border-chiziq pt-3">
                            {isEditing ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className={labelCls}>{t('student_phone')}</label>
                                            <input type="tel" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Telegram ID</label>
                                            <input type="text" value={editForm.telegramId} onChange={e => setEditForm({...editForm, telegramId: e.target.value})} className={inputCls} placeholder="ID (masalan: 12345678)" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelCls}>{t('birth_date')}</label>
                                        <input type="date" value={editForm.birthDate} onChange={e => setEditForm({...editForm, birthDate: e.target.value})} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Jins</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['Erkak', 'Ayol'] as const).map(g => (
                                                <button key={g} type="button"
                                                    onClick={() => setEditForm({...editForm, gender: g})}
                                                    className={`py-2 rounded-xl text-[11px] font-extrabold transition-all border cursor-pointer ${editForm.gender === g ? 'bg-brand border-brand text-white shadow' : 'bg-ichki/30 border-chiziq text-matn-xira hover:text-gray-600'}`}>
                                                    {g === 'Erkak' ? '♂ Erkak' : '♀ Ayol'}
                                                </button>
                                            ))}
                                        </div>
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
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className={labelCls}>{t('father_name')}</label>
                                            <input type="text" value={editForm.fatherName} onChange={e => setEditForm({...editForm, fatherName: e.target.value})} className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>{t('father_phone')}</label>
                                            <input type="tel" value={editForm.fatherPhone} onChange={e => setEditForm({...editForm, fatherPhone: e.target.value})} className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Otasi TG ID</label>
                                            <input type="text" value={editForm.fatherTelegramId} onChange={e => setEditForm({...editForm, fatherTelegramId: e.target.value})} className={inputCls} placeholder="ID" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className={labelCls}>{t('mother_name')}</label>
                                            <input type="text" value={editForm.motherName} onChange={e => setEditForm({...editForm, motherName: e.target.value})} className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>{t('mother_phone')}</label>
                                            <input type="tel" value={editForm.motherPhone} onChange={e => setEditForm({...editForm, motherPhone: e.target.value})} className={inputCls} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Onasi TG ID</label>
                                            <input type="text" value={editForm.motherTelegramId} onChange={e => setEditForm({...editForm, motherTelegramId: e.target.value})} className={inputCls} placeholder="ID" />
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
                                        <div className="space-y-3 p-3 bg-ichki rounded-2xl border border-chiziq">
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
                                            <div>
                                                <label className={labelCls}>Ball / Foiz</label>
                                                <input
                                                    type="text"
                                                    value={editForm.certScore}
                                                    onChange={e => setEditForm({...editForm, certScore: e.target.value})}
                                                    placeholder={editForm.certCategory === 'Xalqaro' ? 'Misol: 7.5 yoki 1450' : 'Misol: 94.8%'}
                                                    className={inputCls}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* SECTION: MULTIPLE CERTIFICATES */}
                                    <div className="space-y-3 pt-2">
                                        <label className={labelCls}>Qo'shimcha Sertifikatlar</label>
                                        {editForm.certificates.map((cert, index) => (
                                            <div key={index} className="p-4 bg-ichki rounded-2xl border border-gray-100 dark:border-gray-850/50 space-y-3 relative animate-in fade-in slide-in-from-top-2 duration-250">
                                                <button
                                                    type="button"
                                                    onClick={() => removeEditCertificate(index)}
                                                    className="absolute top-3 right-3 text-matn-xira hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>

                                                <div>
                                                    <label className={labelCls}>Sertifikat toifasi</label>
                                                    <select
                                                        value={cert.category}
                                                        onChange={e => updateEditCertificate(index, 'category', e.target.value as any)}
                                                        className={inputCls}
                                                    >
                                                        <option value="Milliy">Milliy sertifikat</option>
                                                        <option value="Xalqaro">Xalqaro sertifikat</option>
                                                    </select>
                                                </div>

                                                {cert.category === 'Milliy' && (
                                                    <div>
                                                        <label className={labelCls}>Sertifikat fani</label>
                                                        <select
                                                            value={cert.subject || ''}
                                                            onChange={e => updateEditCertificate(index, 'subject', e.target.value)}
                                                            className={inputCls}
                                                        >
                                                            <option value="Matematika">Matematika</option>
                                                            <option value="Fizika">Fizika</option>
                                                            <option value="Kimyo">Kimyo</option>
                                                            <option value="Biologiya">Biologiya</option>
                                                            <option value="Tarix">Tarix</option>
                                                            <option value="Ingliz tili">Ingliz tili</option>
                                                            <option value="Nemis tili">Nemis tili</option>
                                                            <option value="Rus tili">Rus tili</option>
                                                            <option value="Ona tili">Ona tili</option>
                                                            <option value="Boshqa">Boshqa</option>
                                                        </select>
                                                    </div>
                                                )}

                                                {cert.category === 'Xalqaro' && (
                                                    <div>
                                                        <label className={labelCls}>Sertifikat turi</label>
                                                        <select
                                                            value={cert.type || ''}
                                                            onChange={e => updateEditCertificate(index, 'type', e.target.value)}
                                                            className={inputCls}
                                                        >
                                                            <option value="IELTS">IELTS</option>
                                                            <option value="SAT">SAT</option>
                                                            <option value="TOEFL">TOEFL</option>
                                                            <option value="CEFR">CEFR</option>
                                                            <option value="Boshqa">Boshqa</option>
                                                        </select>
                                                    </div>
                                                )}

                                                <div>
                                                    <label className={labelCls}>Ball / Foiz</label>
                                                    <input
                                                        type="text"
                                                        placeholder={cert.category === 'Xalqaro' ? 'Misol: 7.5 yoki 1450' : 'Misol: 94.8%'}
                                                        value={cert.score || ''}
                                                        onChange={e => updateEditCertificate(index, 'score', e.target.value)}
                                                        className={inputCls}
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={addEditCertificate}
                                            className="w-full py-3 bg-ichki border border-dashed border-chiziq rounded-2xl text-[11px] font-bold text-brand hover:bg-teal-50/10 dark:hover:bg-teal-900/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            <Plus size={14} />
                                            Sertifikat qo'shish
                                        </button>
                                    </div>

                                    <div>
                                        <label className={labelCls}>{t('location')}</label>
                                        <button
                                            onClick={() => setIsMapOpen(true)}
                                            className={`w-full py-2.5 border rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-extrabold transition-all cursor-pointer ${editForm.location ? 'bg-teal-50 text-brand border-teal-100' : 'bg-gray-55 text-matn-xira border-gray-100'}`}
                                        >
                                            <MapPin size={12} />
                                            {editForm.location ? t('edit') : t('select_from_map')}
                                        </button>
                                    </div>
                                    <div className="pt-2 flex gap-2">
                                        <button
                                            onClick={handleSaveEdit}
                                            disabled={isSaving}
                                            className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white rounded-xl text-[11px] font-extrabold shadow-sm shadow-[#1b6b6b]/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {t('save')}
                                        </button>
                                        <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-white border border-gray-100 text-gray-405 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer">
                                            {t('cancel')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Avval bu yerda "Lid ma'lumotlari" deb turardi —
                                        o'quvchi profilida noto'g'ri sarlavha. */}
                                    <h3 className="text-[10px] font-semibold text-matn-xira mb-1 px-0.5">
                                        Aloqa ma'lumotlari
                                    </h3>
                                    <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label={t('student_phone')} value={student.phone} />
                                    {student.telegramId ? (
                                        <div className="flex items-center justify-end gap-2 -mt-1 mb-1.5">
                                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40">
                                                TG ulangan: {student.telegramId}
                                            </span>
                                            <button onClick={() => handleDisconnectTelegram('student')} className="text-rose-500 hover:text-rose-600 text-[10px] font-bold cursor-pointer">
                                                [Uzish]
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end -mt-1 mb-1.5">
                                            <span className="text-[11px] font-bold text-matn-xira">
                                                TG ulangan emas
                                            </span>
                                        </div>
                                    )}
                                    <InfoRow
                                        icon={<Bus className="w-3.5 h-3.5" />}
                                        label={t('transport')}
                                        value={transports.find(t => t.id === student.transportId)?.name || t('transport_none')}
                                    />
                                    <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label={t('birth_date')} value={student.birthDate} />
                                    <InfoRow icon={<Users className="w-3.5 h-3.5" />} label="Jins" value={student.gender === 'Ayol' ? '♀ Ayol' : '♂ Erkak'} />
                                    <div className="space-y-2">
                                        <InfoRow icon={<Users className="w-3.5 h-3.5" />} label={t('father')} value={student.fatherName || "-"} />
                                        {student.fatherPhone && (
                                            <div className="flex items-center justify-between gap-2 -mt-1 mb-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[11px] font-bold text-gray-550 tabular-nums">{student.fatherPhone}</span>
                                                    <button onClick={() => handleSendSms(student.fatherPhone!, 'manual')} className="p-1 text-brand hover:bg-teal-50 rounded transition-all cursor-pointer">
                                                        <Sparkles size={11} />
                                                    </button>
                                                </div>
                                                {student.fatherTelegramId ? (
                                                    <div className="flex items-center gap-2 mr-2">
                                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40">
                                                            TG: {student.fatherTelegramId}
                                                        </span>
                                                        <button onClick={() => handleDisconnectTelegram('father')} className="text-rose-500 hover:text-rose-600 text-[10px] font-bold cursor-pointer">
                                                            Uzish
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-matn-xira italic mr-2">TG ulanmagan</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <InfoRow icon={<Users className="w-3.5 h-3.5" />} label={t('mother')} value={student.motherName || "-"} />
                                        {student.motherPhone && (
                                            <div className="flex items-center justify-between gap-2 -mt-1 mb-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[11px] font-bold text-gray-550 tabular-nums">{student.motherPhone}</span>
                                                    <button onClick={() => handleSendSms(student.motherPhone!, 'manual')} className="p-1 text-brand hover:bg-teal-50 rounded transition-all cursor-pointer">
                                                        <Sparkles size={11} />
                                                    </button>
                                                </div>
                                                {student.motherTelegramId ? (
                                                    <div className="flex items-center gap-2 mr-2">
                                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40">
                                                            TG: {student.motherTelegramId}
                                                        </span>
                                                        <button onClick={() => handleDisconnectTelegram('mother')} className="text-rose-500 hover:text-rose-600 text-[10px] font-bold cursor-pointer">
                                                            Uzish
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-matn-xira italic mr-2">TG ulanmagan</span>
                                                )}
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
                                            className="w-full mt-2 flex items-center justify-center gap-1.5 px-4 py-3 bg-teal-50 dark:bg-teal-950/20 text-brand border border-teal-100 dark:border-teal-900/40 text-[11px] font-bold tracking-[0.1em] rounded-xl hover:bg-brand hover:text-white transition-all cursor-pointer"
                                        >
                                            <MapPin size={13} />
                                            {t('view_on_map')}
                                        </button>
                                    )}
                                    <InfoRow icon={<Clock className="w-3.5 h-3.5" />} label={t('registered_at')} value={student.joinedDate} />

                                    {student.privilegeType && student.privilegeType !== 'None' && (
                                        <div className="flex items-start gap-2.5 p-3 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/30 rounded-2xl">
                                            <div className="w-7 h-7 rounded-lg bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center shrink-0 animate-pulse">
                                                <Sparkles size={14} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-matn tracking-tight">
                                                    Imtiyoz: {student.privilegeType === 'Sertifikat' ? `${student.certCategory} sertifikat` : student.privilegeType}
                                                </p>
                                                {student.privilegeType === 'Sertifikat' && (
                                                    <p className="text-[10px] font-bold text-matn-sokin mt-0.5">
                                                        {student.certCategory === 'Milliy' ? `Fan: ${student.certSubject || '-'}` : `Turi: ${student.certType || '-'}`}
                                                        {student.certScore ? ` · Ball: ${student.certScore}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {(() => {
                                        let parsedCerts = [];
                                        try {
                                            if (Array.isArray(student.certificates)) {
                                                parsedCerts = student.certificates;
                                            } else if (student.certificates && typeof student.certificates === 'string') {
                                                parsedCerts = JSON.parse(student.certificates);
                                            }
                                        } catch (e) {
                                            console.error("Error parsing certificates:", e);
                                        }
                                        if (parsedCerts.length === 0) return null;
                                        return (
                                            <div className="space-y-2.5 mt-2">
                                                <div className="flex items-center gap-2 mb-1 px-1">
                                                    <Award size={12} className="text-brand" />
                                                    <h4 className="text-[11px] font-bold text-brand">Sertifikatlar</h4>
                                                </div>
                                                {parsedCerts.map((cert: any, idx: number) => (
                                                    <div key={idx} className="flex items-start gap-2.5 p-3 bg-ichki border border-chiziq rounded-2xl">
                                                        <div className="w-7 h-7 rounded-lg bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center shrink-0">
                                                            <Award size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] font-bold text-matn tracking-tight">
                                                                {cert.category} sertifikat
                                                            </p>
                                                            <p className="text-[10px] font-bold text-matn-xira mt-0.5">
                                                                {cert.category === 'Milliy' ? `Fan: ${cert.subject || '-'}` : `Turi: ${cert.type || '-'}`}
                                                                {cert.score ? ` · Ball: ${cert.score}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    <button
                                        onClick={() => setShowDeleteModal(true)}
                                        className="w-full mt-4 flex items-center justify-center gap-1.5 px-4 py-3 bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40 text-[11px] font-bold tracking-[0.1em] rounded-xl hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
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
                        <StatTile
                            label={t('attendance')}
                            value={attendanceRate}
                            unit="%"
                            subValue={t('class_attendance')}
                        />
                        <StatTile
                            label={t('missed_lessons')}
                            value={missedLessonsCount}
                            tone={missedLessonsCount > 0 ? 'warn' : undefined}
                            subValue={t('missed_lessons_subtitle')}
                        />
                        <StatTile
                            label={t('missed_topics')}
                            value={missedTopicsCount}
                            tone={missedTopicsCount > 0 ? 'bad' : undefined}
                            subValue={t('missed_topics_subtitle')}
                        />
                        <StatTile
                            label={t('caught_up_topics')}
                            value={caughtUpTopicsCount}
                            tone={caughtUpTopicsCount > 0 ? 'good' : undefined}
                            subValue={t('caught_up_topics_subtitle')}
                        />
                    </div>

                    <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                        <div className="flex px-2 py-2 bg-ichki border-b border-chiziq gap-1 overflow-x-auto scrollbar-hide items-center justify-start rounded-t-3xl">
                            <TabButton label={t('general')} icon={<Layers size={14} />} active={activeTab === 'umumiy'} onClick={() => setActiveTab('umumiy')} />
                            <TabButton label={t('stat_groups')} icon={<Users size={14} />} active={activeTab === 'courses'} onClick={() => setActiveTab('courses')} />
                            <TabButton label={t('payments_tab')} icon={<CreditCard size={14} />} active={activeTab === 'tolovlar'} onClick={() => setActiveTab('tolovlar')} />
                            <TabButton label={t('attendance')} icon={<ClipboardCheck size={14} />} active={activeTab === 'yoqlama'} onClick={() => setActiveTab('yoqlama')} />
                            <TabButton label="Ballar" icon={<Star size={14} />} active={activeTab === 'ballar'} onClick={() => setActiveTab('ballar')} />
                        </div>

                        <div className="p-4">
                            {activeTab === 'umumiy' && (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="space-y-4">
                                            <span className="text-[11px] font-bold text-matn-xira block pb-2 border-b border-gray-55 dark:border-gray-800/50">{t('active_groups')}</span>
                                            <div className="space-y-3">
                                                {studentGroups.length === 0 ? (
                                                    <p className="text-center py-8 text-[11px] text-matn-xira font-bold">{t('no_groups_found')}</p>
                                                ) : (
                                                    studentGroups.map(group => {
                                                        const studentCustomPrice = student.customPrices && typeof student.customPrices === 'object'
                                                            ? (student.customPrices as Record<string, number>)[group.id]
                                                            : undefined;
                                                        return (
                                                            <div key={group.id}
                                                                className="group bg-ichki/30 p-4 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50 transition-all flex items-center justify-between">
                                                                <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/courses/${group.id}`)}>
                                                                    <div className="w-10 h-10 bg-sirt border border-gray-100 dark:border-gray-705 rounded-xl flex items-center justify-center text-brand shrink-0">
                                                                        <BookOpen size={18} />
                                                                    </div>
                                                                    <div>
                                                                        <h5 className="text-xs font-black text-matn group-hover:text-brand tracking-tight">{group.name}</h5>
                                                                        <p className="text-[11px] font-bold text-matn-xira mt-0.5">{group.courseName ? `${group.courseName} • ` : ''}{group.teacherName}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="text-right">
                                                                        {studentCustomPrice !== undefined ? (
                                                                            <>
                                                                                <span className="block text-xs font-black text-brand tabular-nums">{studentCustomPrice.toLocaleString()} UZS</span>
                                                                                <span className="block text-[10px] font-extrabold text-brand/60">Imtiyozli narx</span>
                                                                                {(() => {
                                                                                    const note = student.customPrices && typeof student.customPrices === 'object'
                                                                                        ? (student.customPrices as Record<string, any>)['note_' + group.id]
                                                                                        : null;
                                                                                    return note ? <span className="block text-[10px] text-matn-xira italic mt-0.5 max-w-[120px] truncate">{note}</span> : null;
                                                                                })()}
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <span className="block text-xs font-black text-matn-sokin tabular-nums">{(group.coursePrice || 0).toLocaleString()} UZS</span>
                                                                                <span className="block text-[10px] font-extrabold text-matn-xira">Standart narx</span>
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
                                                                        className="p-2 bg-sirt hover:bg-brand/10 dark:hover:bg-brand/10 border border-chiziq hover:border-brand rounded-xl text-matn-xira hover:text-brand transition-all cursor-pointer"
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
                                            <span className="text-[11px] font-bold text-matn-xira block pb-2 border-b border-gray-55 dark:border-gray-800/50">{t('latest_payments')}</span>
                                            <div className="space-y-3">
                                                {studentPayments.slice(0, 4).map(p => {
                                                    const isDed = p.amount < 0;
                                                    return (
                                                    <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl ${isDed ? 'bg-rose-50/60 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30' : 'bg-ichki/30'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDed ? 'bg-rose-50 text-rose-500 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40' : 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'}`}>
                                                                {isDed ? <ReceiptText size={18} /> : <CreditCard size={18} />}
                                                            </div>
                                                            <div>
                                                                <p className={`text-xs font-black ${isDed ? 'text-rose-600 dark:text-rose-400' : 'text-matn'}`}>
                                                                    {isDed ? '' : '+'}{p.amount.toLocaleString()} <span className="text-[11px] opacity-60">UZS</span>
                                                                </p>
                                                                <p className="text-[11px] font-bold text-matn-xira mt-0.5">{p.date}</p>
                                                            </div>
                                                        </div>
                                                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${isDed ? 'text-rose-500 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40' : 'text-matn-sokin bg-sirt border-chiziq'}`}>
                                                            {isDed ? 'Oylik' : p.type === 'Naqd' ? t('type_cash') : p.type === 'Karta' ? t('type_card') : p.type === 'Peyme' ? t('type_payme') : p.type === 'Klik' ? t('type_click') : p.type}
                                                        </span>
                                                    </div>
                                                    );
                                                })}
                                                {studentPayments.length === 0 && (
                                                    <p className="text-center py-8 text-[11px] text-matn-xira font-bold">{t('no_payment_history')}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Izohlar va oxirgi harakatlar */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-6 border-t border-dashed border-chiziq/50">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between pb-2 border-b border-gray-55 dark:border-gray-800/50">
                                                <span className="text-[11px] font-bold text-matn-xira">Izohlar</span>
                                                {!isEditingNote && (
                                                    <button
                                                        onClick={() => { setNoteDraft(student.comment || ''); setIsEditingNote(true); }}
                                                        className="text-[10px] font-extrabold text-brand hover:text-brand-dark flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Edit size={11} /> {student.comment ? t('edit') : t('add')}
                                                    </button>
                                                )}
                                            </div>

                                            {isEditingNote ? (
                                                <div className="space-y-3">
                                                    <textarea
                                                        rows={5}
                                                        autoFocus
                                                        value={noteDraft}
                                                        onChange={e => setNoteDraft(e.target.value)}
                                                        placeholder="Ota-ona bilan suhbat, o'quvchi haqidagi kuzatuvlar, kelishuvlar..."
                                                        className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-semibold text-matn leading-relaxed focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all resize-none"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={handleSaveNote}
                                                            disabled={isSavingNote}
                                                            className="px-5 py-2.5 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[11px] font-extrabold shadow-sm shadow-[#1b6b6b]/20 transition-all cursor-pointer"
                                                        >
                                                            {t('save')}
                                                        </button>
                                                        <button
                                                            onClick={() => setIsEditingNote(false)}
                                                            className="px-5 py-2.5 text-matn-xira hover:text-gray-700 dark:hover:text-white rounded-xl text-[11px] font-extrabold transition-colors cursor-pointer"
                                                        >
                                                            {t('cancel')}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : student.comment ? (
                                                <div className="p-4 bg-ichki/30 border border-chiziq rounded-2xl">
                                                    <p className="text-[12px] font-semibold text-matn-2 leading-relaxed whitespace-pre-wrap">{student.comment}</p>
                                                </div>
                                            ) : (
                                                <p className="text-center py-8 text-[11px] text-matn-xira font-bold">Izoh yozilmagan</p>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <span className="text-[11px] font-bold text-matn-xira block pb-2 border-b border-gray-55 dark:border-gray-800/50">Oxirgi harakatlar</span>
                                            {recentActivity.length === 0 ? (
                                                <p className="text-center py-8 text-[11px] text-matn-xira font-bold">Harakatlar yo'q</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {recentActivity.map(item => (
                                                        <div key={item.key} className="flex items-start gap-3">
                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                                                                item.tone === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40' :
                                                                item.tone === 'rose' ? 'bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40' :
                                                                item.tone === 'amber' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40' :
                                                                item.tone === 'teal' ? 'bg-teal-50 text-brand border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40' :
                                                                'bg-gray-55 text-matn-xira border-gray-100 dark:bg-gray-900/50 dark:border-gray-800/50'
                                                            }`}>
                                                                {item.icon}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[12px] font-bold text-matn leading-snug">{item.title}</p>
                                                                <p className="text-[10px] font-bold text-matn-xira mt-0.5 tabular-nums truncate">
                                                                    {item.date}{item.sub ? ' · ' + item.sub : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Qoldirilgan va yopilgan mavzular section */}
                                    <div className="space-y-4 pt-6 border-t border-dashed border-chiziq/50">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-matn-xira">{t('missed_and_closed_topics')}</span>
                                        </div>

                                        {studentAttendances.filter(a => a.status === 'Kelmapdi' || a.status === 'Sababli').length === 0 ? (
                                            <p className="text-center py-8 text-[11px] text-matn-xira font-bold">{t('no_missed_topics')}</p>
                                        ) : (
                                            <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden shadow-sm">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-ichki border-b border-chiziq">
                                                            <th className="p-3 text-[11px] font-bold text-matn-xira">{t('date_group')}</th>
                                                            <th className="p-3 text-[11px] font-bold text-matn-xira">{t('topic_label')}</th>
                                                            <th className="p-3 text-center text-[11px] font-bold text-matn-xira">{t('status')}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                        {studentAttendances.filter(a => a.status === 'Kelmapdi' || a.status === 'Sababli').map(a => {
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
                                                                const courseObj = (courses || []).find(c => c.id === groupObj.courseId);
                                                                 const syllabusId = courseObj?.syllabusId || groupObj.syllabusId;
                                                                 const courseTopics = syllabusId
                                                                     ? (topics || []).filter(t => t.syllabusId === syllabusId).sort((a, b) => a.order - b.order)
                                                                     : [];
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
                                                                        <p className="text-[12px] font-bold text-matn tracking-tight">{a.date}</p>
                                                                        <p className="text-[10px] font-bold text-matn-xira mt-0.5">{groupObj?.name || '-'}</p>
                                                                        {a.status === 'Sababli' && (
                                                                            <span className="inline-block mt-0.5 text-[7px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40">Sababli</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-3">
                                                                        {topicObj ? (
                                                                            <div className="space-y-1">
                                                                                <p className="text-[11px] font-bold text-brand">
                                                                                    {topicObj.order}. {topicObj.title}
                                                                                </p>
                                                                                {topicObj.description && (
                                                                                    <p className="text-[10px] font-medium text-matn-xira truncate max-w-[300px]" title={topicObj.description}>
                                                                                        {topicObj.description}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-[10px] font-bold text-gray-305 dark:text-gray-600 italic">-</p>
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
                                                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black transition-all border cursor-pointer ${
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
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-ichki/40 border border-chiziq rounded-2xl">
                                        <div>
                                            <h4 className="text-xs font-black text-matn tracking-tight">{t('transactions_history')}</h4>
                                            <p className="text-[11px] font-bold text-matn-xira mt-1 tabular-nums">
                                                Jami to'langan {totalPaid.toLocaleString()} so'm · {studentPayments.length} operatsiya
                                            </p>
                                        </div>
                                        <button onClick={() => setShowPaymentModal(true)}
                                            className="px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-[11px] font-extrabold shadow-sm shadow-[#1b6b6b]/20 active:scale-95 transition-all text-center cursor-pointer">
                                            {t('add_payment')}
                                        </button>
                                    </div>
                                    {studentPayments.length === 0 ? (
                                        <p className="text-center py-12 text-[11px] text-matn-xira font-bold">{t('no_payments_found')}</p>
                                    ) : (
                                        <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden shadow-sm divide-y divide-chiziq-mayin dark:divide-gray-700/50">
                                            {studentPayments.map(p => {
                                                const isDeduction = p.amount < 0;
                                                const method = isDeduction ? 'Hisob'
                                                    : p.type === 'Naqd' ? t('type_cash')
                                                    : p.type === 'Karta' ? t('type_card')
                                                    : p.type === 'Peyme' ? t('type_payme')
                                                    : p.type === 'Klik' ? t('type_click')
                                                    : p.type;
                                                return (
                                                    <div key={p.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-gray-55/50 dark:hover:bg-gray-900/30 transition-colors">
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${isDeduction
                                                            ? 'bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40'
                                                            : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
                                                        }`}>
                                                            {isDeduction ? <ReceiptText size={15} /> : <CreditCard size={15} />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[13px] font-bold text-matn truncate">
                                                                {p.description || (isDeduction ? 'Oylik hisoblandi' : "To'lov qabul qilindi")}
                                                            </p>
                                                            <p className="text-[11px] font-semibold text-matn-xira truncate mt-0.5">
                                                                {isDeduction ? 'Avtomatik hisoblash' : method + ' orqali'}
                                                            </p>
                                                        </div>
                                                        <span className={`num text-[13px] font-bold shrink-0 ${isDeduction ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                            {isDeduction ? '' : '+'}{p.amount.toLocaleString()}
                                                        </span>
                                                        <span className="num hidden md:block text-[11px] text-matn-xira w-24 text-right shrink-0">{p.date}</span>
                                                        <span className={`hidden sm:inline-block text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 ${isDeduction
                                                            ? 'text-rose-500 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40'
                                                            : 'text-gray-650 dark:text-gray-400 bg-ichki border-chiziq'
                                                        }`}>
                                                            {method}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'courses' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <h4 className="text-[15px] font-semibold text-matn">Guruhlar tarixi</h4>
                                            <p className="text-[12px] text-matn-xira mt-0.5">
                                                <span className="num">{studentGroups.length}</span> ta guruh
                                            </p>
                                        </div>
                                        <button onClick={() => setShowGroupModal(true)}
                                            className="px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-xl text-[13px] font-semibold transition-colors cursor-pointer shrink-0">
                                            + {t('add_to_group')}
                                        </button>
                                    </div>

                                    {/* Referensdagidek bitta ustunli ro'yxat: guruh nomi,
                                        ostida ustoz va jadval, o'ngda holat. Ikki ustunli
                                        kartochkalarda nom qisqarib, bir o'quvchining ikki
                                        guruhi ekranning ikki chekkasida turardi. */}
                                    {studentGroups.length === 0 ? (
                                        <p className="text-center py-12 text-[12px] text-matn-xira">{t('no_groups_found')}</p>
                                    ) : (
                                        <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden divide-y divide-chiziq-mayin dark:divide-gray-700/40">
                                            {studentGroups.map(group => (
                                                <div key={group.id} onClick={() => navigate(`/courses/${group.id}`)}
                                                    className="group flex items-center gap-3 px-4 py-3.5 hover:bg-ichki transition-colors cursor-pointer">
                                                    <div className="w-9 h-9 rounded-xl bg-brand/10 dark:bg-brand/20 flex items-center justify-center text-brand shrink-0">
                                                        <BookOpen size={16} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[13px] font-medium text-matn truncate group-hover:text-brand transition-colors">{group.name}</p>
                                                        <p className="text-[11px] text-matn-xira truncate">
                                                            {group.teacherName}
                                                            {group.schedule && <> · <span className="num">{group.schedule}</span></>}
                                                            {group.courseName && <> · {group.courseName}</>}
                                                        </p>
                                                    </div>
                                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 shrink-0">
                                                        {t('status_active')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'yoqlama' && (
                                <div className="animate-in fade-in duration-300">
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                                        {/* Left Column: Attendance Calendar */}
                                        <div className="lg:col-span-5 space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-ichki/40 border border-chiziq rounded-2xl">
                                                <div>
                                                    <h4 className="text-[11px] font-bold text-matn tracking-tight">{t('attendance_calendar')}</h4>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        <span className="text-[7px] font-black text-matn-xira tabular-nums">{t('present')} {attendanceCounts.keldi}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                        <span className="text-[7px] font-black text-matn-xira tabular-nums">{t('absent')} {attendanceCounts.kelmadi}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                                        <span className="text-[7px] font-black text-matn-xira tabular-nums">{t('late')} {attendanceCounts.kechikdi}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                                        <span className="text-[7px] font-black text-matn-xira">{t('early_leave')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                        <span className="text-[7px] font-black text-matn-xira">{t('not_marked')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-sirt border border-chiziq rounded-2xl p-4 shadow-sm">
                                                <div className="grid grid-cols-7 gap-1">
                                                    {[t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'), t('day_fri'), t('day_sat'), t('day_sun')].map(day => (
                                                        <div key={day} className="text-center text-[10px] font-bold text-matn-xira pb-1.5">{day}</div>
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

                                                            let bgColor = 'bg-ichki';
                                                            let textColor = 'text-matn-xira';

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
                                                                    <span className="text-[10px] font-bold">{d}</span>
                                                                </div>
                                                            );
                                                        }
                                                        return cells;
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Seriyalar: o'quvchi qanchalik barqaror kelayotganini
                                                bitta qatorda ko'rsatadi. */}
                                            {studentAttendances.length > 0 && (
                                                <p className="text-[11px] font-bold text-matn-xira tabular-nums px-1">
                                                    Ketma-ket {currentStreak} dars keldi · eng uzun seriya {longestStreak} dars
                                                    {attendanceCounts.sababli > 0 && <> · sababli {attendanceCounts.sababli}</>}
                                                </p>
                                            )}
                                        </div>

                                        {/* Right Column: Detailed History Table */}
                                        <div className="lg:col-span-7 space-y-4">
                                            <div className="flex items-center justify-between pb-1 border-b border-gray-55 dark:border-gray-800/50">
                                                <span className="text-[11px] font-bold text-matn-xira">{t('detailed_history')}</span>
                                                <select
                                                    value={attendanceGroupFilter || ''}
                                                    onChange={(e) => setAttendanceGroupFilter(e.target.value ? Number(e.target.value) : null)}
                                                    className="px-2.5 py-1 bg-ichki border border-chiziq rounded-lg text-[10px] font-bold cursor-pointer outline-none focus:ring-1 focus:ring-[#1b6b6b]/20 text-brand font-bold"
                                                >
                                                    <option value="" className="bg-sirt text-gray-600 font-bold">{t('all_groups')}</option>
                                                    {studentGroups.map(g => (
                                                        <option key={g.id} value={g.id} className="bg-sirt text-matn font-bold">{g.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden shadow-sm">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-ichki border-b border-chiziq">
                                                            <th className="p-3 text-[11px] font-bold text-matn-xira">{t('date_group')}</th>
                                                            <th className="p-3 text-[11px] font-bold text-matn-xira">{t('topic_label')}</th>
                                                            <th className="p-3 text-center text-[11px] font-bold text-matn-xira">{t('status')}</th>
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
                                                                 const syllabusId = courseObj?.syllabusId || groupObj.syllabusId;
                                                                 const courseTopics = syllabusId
                                                                     ? (topics || []).filter(t => t.syllabusId === syllabusId).sort((a, b) => a.order - b.order)
                                                                     : [];
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
                                                                        <p className="text-[12px] font-bold text-matn tracking-tight">{a.date}</p>
                                                                        <p className="text-[10px] font-bold text-matn-xira mt-0.5">{groupObj?.name || '-'}</p>
                                                                    </td>
                                                                    <td className="p-3">
                                                                        {topicObj ? (
                                                                            <div className="space-y-1">
                                                                                <p className="text-[11px] font-bold text-brand">
                                                                                    {topicObj.order}. {topicObj.title}
                                                                                </p>
                                                                                {topicObj.description && (
                                                                                    <p className="text-[10px] font-medium text-matn-xira truncate max-w-[200px]" title={topicObj.description}>
                                                                                        {topicObj.description}
                                                                                    </p>
                                                                                )}
                                                                                {(a.status === 'Kelmapdi' || a.status === 'Sababli') && (
                                                                                    <button
                                                                                        onClick={async () => {
                                                                                            try {
                                                                                                await updateAttendance(a.id, { caughtUp: !a.caughtUp });
                                                                                            } catch (err) {
                                                                                                console.error("Failed to update caughtUp status", err);
                                                                                            }
                                                                                        }}
                                                                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black transition-all border cursor-pointer mt-1 ${
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
                                                                                <p className="text-[10px] font-bold text-gray-305 dark:text-gray-600 italic">
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
                                                                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black transition-all border cursor-pointer mt-1 ${
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
                                                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border cursor-pointer outline-none transition-all ${
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
                                                                                <option value="Keldi" className="bg-sirt text-emerald-600 font-bold">{t('present')}</option>
                                                                                <option value="Kelmapdi" className="bg-sirt text-rose-600 font-bold">{t('absent')}</option>
                                                                                <option value="Sababli" className="bg-sirt text-amber-600 font-bold">{t('excused')}</option>
                                                                                <option value="Kechikdi" className="bg-sirt text-orange-600 font-bold">{t('late')}</option>
                                                                                <option value="ErtaKetdi" className="bg-sirt text-purple-600 font-bold">{t('early_leave')}</option>
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

                            {/* Bonus points. The Score table and the bonus report were already
                                built, but nothing in the app could actually award a point. */}
                            {activeTab === 'ballar' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-ichki/40 border border-chiziq rounded-2xl">
                                        <div>
                                            <h4 className="text-xs font-black text-matn tracking-tight">Bonus ballar</h4>
                                            <p className="text-[11px] font-bold text-matn-xira mt-1 tabular-nums">
                                                Jami {studentScores.reduce((s, x) => s + (x.value || 0), 0)} ball · {studentScores.length} ta yozuv
                                            </p>
                                        </div>
                                        <button onClick={() => setShowScoreModal(true)}
                                            disabled={studentGroups.length === 0}
                                            className="px-6 py-2.5 bg-brand hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-[11px] font-extrabold shadow-sm shadow-[#1b6b6b]/20 active:scale-95 transition-all cursor-pointer">
                                            Ball qo'shish
                                        </button>
                                    </div>

                                    {studentGroups.length === 0 && (
                                        <p className="text-[12px] font-bold text-amber-600 dark:text-amber-400">
                                            Ball berish uchun o'quvchi kamida bitta guruhda bo'lishi kerak.
                                        </p>
                                    )}

                                    {studentScores.length === 0 ? (
                                        <div className="py-14 text-center">
                                            <Star size={28} className="mx-auto text-gray-200 dark:text-gray-700 mb-3" />
                                            <p className="text-sm font-bold text-matn-2">Hali ball berilmagan</p>
                                            <p className="text-xs text-matn-xira mt-1">Berilgan ballar hisobotlardagi reytingga qo'shiladi.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden shadow-sm divide-y divide-chiziq-mayin dark:divide-gray-700/50">
                                            {(() => {
                                                // Ballar shkalasi kursdan kursga farq qiladi, shuning uchun
                                                // ustunlar eng yuqori berilgan ballga nisbatan chiziladi.
                                                const maxScore = Math.max(5, ...studentScores.map(sc => sc.value || 0));
                                                return [...studentScores]
                                                    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                                                    .map(sc => {
                                                        const pct = Math.min(100, Math.round(((sc.value || 0) / maxScore) * 100));
                                                        return (
                                                            <div key={sc.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-gray-55/50 dark:hover:bg-gray-900/30 transition-colors">
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-[13px] font-bold text-matn truncate">{sc.comment || 'Bonus ball'}</p>
                                                                    <p className="text-[11px] font-semibold text-matn-xira truncate mt-0.5">
                                                                        {groups.find(g => g.id === sc.groupId)?.name || '—'}
                                                                    </p>
                                                                </div>
                                                                <div className="hidden sm:block w-28 lg:w-36 h-1.5 rounded-full bg-chiziq overflow-hidden shrink-0">
                                                                    <div
                                                                        className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                                                        style={{ width: pct + '%' }}
                                                                    />
                                                                </div>
                                                                <span className={`num text-[13px] font-bold w-12 text-right shrink-0 ${pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500'}`}>
                                                                    +{sc.value}
                                                                </span>
                                                                <span className="num hidden md:block text-[11px] text-matn-xira w-24 text-right shrink-0">{sc.date}</span>
                                                            </div>
                                                        );
                                                    });
                                            })()}
                                        </div>
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
            {showScoreModal && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowScoreModal(false)} />
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            if (isSavingScore) return;
                            const groupId = newScore.groupId || studentGroups[0]?.id;
                            if (!groupId) return;
                            setIsSavingScore(true);
                            try {
                                await addScore({
                                    studentId: student.id,
                                    groupId,
                                    date: newScore.date,
                                    value: Number(newScore.value) || 0,
                                    comment: newScore.comment,
                                });
                                showNotification("Ball qo'shildi", 'success');
                                setShowScoreModal(false);
                                setNewScore({ value: 5, comment: '', groupId: 0, date: new Date().toISOString().split('T')[0] });
                            } catch (err: any) {
                                showNotification("Ball qo'shib bo'lmadi: " + (err?.message || "xatolik"), 'error');
                            } finally {
                                setIsSavingScore(false);
                            }
                        }}
                        className="relative bg-sirt rounded-[2rem] border border-chiziq shadow-2xl w-full max-w-md p-8 space-y-4 my-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-chiziq-mayin/50">
                            <div>
                                <h3 className="text-lg font-black text-matn tracking-tight">Ball qo'shish</h3>
                                <p className="text-[11px] font-bold text-brand mt-0.5">{student.name}</p>
                            </div>
                            <button type="button" aria-label="Yopish" onClick={() => setShowScoreModal(false)}
                                className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>

                        <div>
                            <label className="block text-[11px] font-extrabold text-matn-xira mb-2">Ball *</label>
                            <input type="number" inputMode="numeric" min={1} max={100} required
                                value={newScore.value}
                                onChange={e => setNewScore(p => ({ ...p, value: Number(e.target.value) }))}
                                className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn outline-none focus:border-brand transition-all" />
                        </div>

                        <div>
                            <label className="block text-[11px] font-extrabold text-matn-xira mb-2">Guruh</label>
                            <select value={newScore.groupId || studentGroups[0]?.id || 0}
                                onChange={e => setNewScore(p => ({ ...p, groupId: Number(e.target.value) }))}
                                className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn outline-none focus:border-brand transition-all cursor-pointer">
                                {studentGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-extrabold text-matn-xira mb-2">Sana</label>
                            <input type="date" value={newScore.date}
                                onChange={e => setNewScore(p => ({ ...p, date: e.target.value }))}
                                className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn outline-none focus:border-brand transition-all" />
                        </div>

                        <div>
                            <label className="block text-[11px] font-extrabold text-matn-xira mb-2">Izoh</label>
                            <input type="text" placeholder="Nima uchun berilyapti?"
                                value={newScore.comment}
                                onChange={e => setNewScore(p => ({ ...p, comment: e.target.value }))}
                                className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn outline-none focus:border-brand transition-all" />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setShowScoreModal(false)}
                                className="flex-1 py-3 bg-chiziq text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                                {t('cancel')}
                            </button>
                            <button type="submit" disabled={isSavingScore}
                                className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold rounded-2xl shadow-sm shadow-[#1b6b6b]/20 cursor-pointer transition-all">
                                {isSavingScore ? 'Saqlanmoqda…' : t('save')}
                            </button>
                        </div>
                    </form>
                </div>
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
                <div className="fixed inset-0 z-[250] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
                    <div className="relative bg-sirt w-full max-w-sm rounded-[2rem] p-8 shadow-2xl overflow-hidden border border-chiziq text-center">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40">
                            <X size={24} />
                        </div>
                        <h3 className="text-base font-black text-matn tracking-tight">{t('delete_student')}</h3>
                        <p className="text-[11px] font-bold text-matn-xira mt-2 leading-relaxed">
                            {t('delete_student_confirm').replace('{name}', student.name)}
                        </p>
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={handleConfirmDelete}
                                className="flex-1 py-3 bg-rose-650 hover:bg-rose-600 text-white rounded-xl text-[11px] font-extrabold transition-all active:scale-95 shadow-lg shadow-rose-500/20 cursor-pointer"
                            >
                                {t('delete')}
                            </button>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 py-3 bg-ichki text-gray-405 rounded-xl text-[11px] font-extrabold transition-all active:scale-95 cursor-pointer"
                            >
                                {t('cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingGroupPrice && (
                <div className="fixed inset-0 z-[250] flex items-start sm:items-center justify-center overflow-y-auto p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEditingGroupPrice(null)} />
                    <div className="relative bg-sirt w-full max-w-sm rounded-[2rem] p-8 shadow-2xl overflow-hidden border border-chiziq">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-chiziq-mayin/50">
                            <div>
                                <h3 className="text-sm font-black text-matn tracking-tight">Maxsus narx</h3>
                                <p className="text-[11px] font-bold text-brand mt-0.5">{editingGroupPrice.name}</p>
                            </div>
                            <button aria-label="Yopish" onClick={() => setEditingGroupPrice(null)} className="w-8 h-8 flex items-center justify-center text-matn-xira hover:bg-gray-50 dark:hover:bg-gray-750 rounded-xl cursor-pointer"><X size={18} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-matn-xira mb-2">Oylik to'lov miqdori (UZS)</label>
                                <input
                                    type="number"
                                    placeholder={String(editingGroupPrice.coursePrice)}
                                    className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
                                    value={customPriceVal}
                                    onChange={e => setCustomPriceVal(e.target.value)}
                                />
                                <span className="block text-[10px] text-matn-xira font-medium mt-1">Standart narx: {editingGroupPrice.coursePrice.toLocaleString()} UZS</span>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-matn-xira mb-2">Izoh (chegirma sababi)</label>
                                <input
                                    type="text"
                                    placeholder="Masalan: Aka-ukasi bor, Stipendiyachi..."
                                    className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-medium text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all"
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
                                    className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                                >
                                    O'chirish
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const val = Number(customPriceVal);
                                        if (isNaN(val) || val < 0) {
                                            showNotification("Noto'g'ri qiymat kiritildi", 'error');
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
                                    className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer"
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


function PaymentAddModal({ studentId, onClose, onAdd }: { studentId: number; onClose: () => void; onAdd: (data: any) => void }) {
    const { students, groups, courses, payments } = useCRM();
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('Naqd');
    const [createdPaymentForReceipt, setCreatedPaymentForReceipt] = useState<any>(null);

    const student = students.find(s => s.id === studentId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const paymentData = { studentId, amount: Number(amount), type, date: new Date().toISOString().split('T')[0], description: '' };
        const created = await onAdd(paymentData);
        setCreatedPaymentForReceipt(created);

        setTimeout(async () => {
            if (await confirm("To'lov haqida ota-onaga SMS xabarnoma yuborilsinmi?")) {
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
        }, 300);
    };

    const labelCls = "block text-[11px] font-extrabold   text-matn-xira mb-2";
    const inputCls = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-chiziq" onClick={e => e.stopPropagation()}>

                {createdPaymentForReceipt ? (
                    <div className="p-8 space-y-6" id="print-receipt-container">
                        <style dangerouslySetInnerHTML={{ __html: `
                            @media print {
                                body > * {
                                    display: none !important;
                                }
                                #print-receipt-container, #print-receipt-container * {
                                    display: block !important;
                                    visibility: visible !important;
                                }
                                #print-receipt-container {
                                    position: absolute !important;
                                    left: 0 !important;
                                    top: 0 !important;
                                    width: 100% !important;
                                    margin: 0 !important;
                                    padding: 20px !important;
                                    background: white !important;
                                    color: black !important;
                                    box-shadow: none !important;
                                    border: none !important;
                                }
                                .no-print {
                                    display: none !important;
                                }
                            }
                        `}} />
                        <div className="text-center space-y-1">
                            <h3 className="text-sm font-black text-brand">SARIOSIYO CENTER</h3>
                            <p className="text-[11px] font-bold text-matn-xira">TO'LOV CHEKI (RECEIPT)</p>
                        </div>

                        <div className="bg-ichki/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-750 font-mono text-xs text-gray-800 dark:text-gray-300 space-y-4 shadow-inner">
                            <div className="border-b border-dashed border-gray-300 dark:border-gray-800 pb-3 space-y-1">
                                <div className="flex justify-between">
                                    <span>Chek #</span>
                                    <span className="font-black">#{createdPaymentForReceipt.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Sana:</span>
                                    <span className="font-semibold">{createdPaymentForReceipt.date}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div>
                                    <span className="text-[11px] text-matn-sokin block">O'quvchi:</span>
                                    <span className="font-black text-matn text-[13px]">{student?.name}</span>
                                </div>
                                {student?.phone && (
                                    <div>
                                        <span className="text-[11px] text-matn-sokin block">Telefon:</span>
                                        <span>{student.phone}</span>
                                    </div>
                                )}
                                {(() => {
                                    const sg = groups.filter(g => g.studentIds.includes(studentId));
                                    if (sg.length === 0) return null;
                                    return (
                                        <div>
                                            <span className="text-[11px] text-matn-sokin block">Kurslar:</span>
                                            <div className="font-semibold">
                                                {sg.map(g => {
                                                    const courseName = courses.find(c => c.id === g.courseId)?.name || '';
                                                    return <div key={g.id}>- {g.name} {courseName && `(${courseName})`}</div>;
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="border-t border-dashed border-gray-300 dark:border-gray-800 pt-3 space-y-1.5">
                                <div className="flex justify-between text-[13px]">
                                    <span className="font-bold">To'lov turi:</span>
                                    <span className="font-black">{createdPaymentForReceipt.type}</span>
                                </div>
                                <div className="flex justify-between text-base">
                                    <span className="font-bold text-brand">To'landi:</span>
                                    <span className="font-black text-emerald-600 tabular-nums">+{createdPaymentForReceipt.amount.toLocaleString()} UZS</span>
                                </div>
                                <div className="flex justify-between text-[13px]">
                                    <span className="font-bold">Joriy balans:</span>
                                    <span className={`font-black tabular-nums ${student && student.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {(student?.balance || 0).toLocaleString()} UZS
                                    </span>
                                </div>
                            </div>

                            <div className="border-t border-dashed border-gray-300 dark:border-gray-800 pt-3 text-center text-[11px] text-matn-xira font-bold">
                                To'lovingiz uchun rahmat!
                            </div>
                        </div>

                        <div className="flex gap-3 no-print">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer shadow-sm shadow-[#1b6b6b]/20 text-center"
                            >
                                Chop etish (Print)
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 bg-gray-150 dark:bg-gray-700 text-gray-700 dark:text-white text-xs font-extrabold rounded-2xl transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-650"
                            >
                                Yopish (Close)
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="p-4 flex items-center justify-between border-b border-chiziq bg-ichki">
                            <div>
                                <h3 className="text-lg font-bold text-matn tracking-tight">To'lov Qo'shish</h3>
                                <p className="text-[11px] font-bold text-matn-xira mt-0.5">Yangi tranzaksiya kiritish</p>
                            </div>
                            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-6">

                            {student && (
                                <div className="p-4 bg-ichki rounded-2xl border border-chiziq/80 space-y-3">
                                    <div>
                                        <span className="text-[10px] font-bold text-brand block">O'quvchi</span>
                                        <h4 className="text-xs font-bold text-matn mt-0.5">{student.name}</h4>
                                        {student.phone && <p className="text-[11px] text-matn-xira font-bold mt-0.5">{student.phone}</p>}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed border-chiziq/50">
                                        <div>
                                            <span className="text-[10px] font-bold text-matn-xira block">Joriy Balans</span>
                                            <span className={`text-[12px] font-bold block mt-0.5 tabular-nums ${student.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {student.balance.toLocaleString()} UZS
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-matn-xira block">Oxirgi to'lov</span>
                                            {(() => {
                                                const sp = payments.filter(p => p.studentId === student.id && p.amount > 0);
                                                const lp = sp.length > 0 ? sp[sp.length - 1] : null;
                                                return lp ? (
                                                    <span className="text-[11px] font-bold text-matn-2 block mt-0.5 tabular-nums">
                                                        {lp.amount.toLocaleString()} UZS ({lp.date})
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-matn-xira italic block mt-0.5">Mavjud emas</span>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-dashed border-chiziq/50">
                                        <span className="text-[10px] font-bold text-matn-xira block">Kurslar</span>
                                        {(() => {
                                            const sg = groups.filter(g => g.studentIds.includes(student.id));
                                            return sg.length > 0 ? (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {sg.map(g => {
                                                        const courseName = courses.find(c => c.id === g.courseId)?.name || '';
                                                        return (
                                                            <span key={g.id} className="px-2 py-0.5 bg-sirt text-[10px] font-bold text-brand border border-teal-100/50 dark:border-teal-900/40 rounded-md">
                                                                {g.name} {courseName && `(${courseName})`}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-matn-xira italic block mt-0.5">Kurslarga a'zo emas</span>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className={labelCls}>SUMMA (UZS)</label>
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="500,000" className={inputCls} />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {[300000, 400000, 500000, 600000, 800000].map(amt => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => setAmount(String(amt))}
                                            className={`px-3 py-1.5 text-[11px] font-black border rounded-xl transition-all cursor-pointer ${
                                                Number(amount) === amt
                                                    ? 'bg-brand border-brand text-white shadow-sm'
                                                    : 'bg-ichki/30 dark:border-gray-800 hover:bg-gray-100 text-gray-550 dark:text-gray-400'
                                            }`}
                                        >
                                            {amt.toLocaleString()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className={labelCls}>TO'LOV USULI</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Naqd', 'Karta', "O'tkazma"].map(t => (
                                        <button key={t} type="button" onClick={() => setType(t)}
                                            className={`py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${type === t ? 'bg-brand border-brand text-white shadow-sm shadow-[#1b6b6b]/20 scale-102' : 'bg-sirt border-chiziq text-matn-xira hover:bg-gray-50'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-dashed border-chiziq">
                                <button type="submit" className="w-full py-3 bg-brand hover:bg-brand-dark text-white rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-[#1b6b6b]/20 cursor-pointer">
                                    <Save size={14} />
                                    Saqlash va Chek chiqarish
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

function GroupAddModal({ studentId, currentGroups, availableGroups, onClose, onAdd }: any) {
    const options = availableGroups.filter((g: any) => !currentGroups.includes(g.id));
    return (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-chiziq" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex items-center justify-between border-b border-chiziq bg-ichki">
                    <div>
                        <h3 className="text-lg font-bold text-matn tracking-tight">Kursga Qo'shish</h3>
                        <p className="text-[11px] font-bold text-matn-xira mt-0.5">Yangi kurs tanlash</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                </div>
                <div className="p-4 max-h-[350px] overflow-y-auto space-y-2 custom-scrollbar">
                    {options.length === 0 ? (
                        <p className="text-center py-8 text-[11px] text-matn-xira font-bold">Barcha kurslarga a'zo</p>
                    ) : (
                        options.map((g: any) => (
                            <button key={g.id} onClick={() => { onAdd(g.id); onClose(); }}
                                className="w-full flex items-center justify-between p-3.5 bg-white dark:bg-gray-905 border border-gray-100 dark:border-gray-750 hover:border-teal-300 rounded-2xl transition-all group cursor-pointer text-left">
                                <div>
                                    <p className="text-xs font-black text-matn group-hover:text-brand transition-colors tracking-tight">{g.name}</p>
                                    <p className="text-[11px] font-bold text-matn-xira mt-0.5">{g.days} • {g.startTime}</p>
                                </div>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-ichki text-gray-405 group-hover:text-white group-hover:bg-brand transition-all">
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

    const labelCls = "block text-[11px] font-extrabold   text-matn-xira mb-2";
    const inputCls = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-chiziq" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex items-center justify-between border-b border-chiziq bg-ichki">
                    <div>
                        <h3 className="text-lg font-bold text-matn tracking-tight">Yo'qlama</h3>
                        <p className="text-[11px] font-bold text-matn-xira mt-0.5">Davomat qilish</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-6">
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
                                    className={`py-2.5 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${status === s ? 'bg-brand border-brand text-white shadow-sm shadow-[#1b6b6b]/20 scale-105' : 'bg-sirt border-chiziq text-matn-xira hover:bg-gray-50'}`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="pt-4 border-t border-dashed border-chiziq">
                        <button type="submit" className="w-full py-3 bg-brand hover:bg-brand-dark text-white rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-[#1b6b6b]/20 cursor-pointer">
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

    const labelCls = "block text-[11px] font-extrabold   text-matn-xira mb-2";
    const inputCls = "w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand focus:ring-4 focus:ring-[#1b6b6b]/10 outline-none transition-all";

    return (
        <div className="fixed inset-0 z-[110] flex items-start sm:items-center justify-center overflow-y-auto p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-chiziq" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex items-center justify-between border-b border-chiziq bg-ichki">
                    <div>
                        <h3 className="text-lg font-bold text-matn tracking-tight text-brand">SMS Yuborish</h3>
                        <p className="text-[11px] font-bold text-matn-xira mt-0.5">Qabul qiluvchi: {phone}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-gray-405 hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className={labelCls}>TAYYOR SHABLONLAR</label>
                        <div className="flex flex-wrap gap-2">
                            {templates.map((tpl, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setMessage(tpl.text)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-brand bg-teal-50 border border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40 rounded-lg hover:bg-brand hover:text-white transition-colors cursor-pointer"
                                >
                                    {tpl.label}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setMessage(defaultPrefix)}
                                className="px-2.5 py-1 text-[11px] font-bold text-matn-xira bg-gray-55 border border-gray-100 dark:bg-gray-900/50 dark:border-gray-800 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
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
                    <div className="pt-4 border-t border-dashed border-chiziq">
                        <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer">
                            <Send size={14} />
                            Jo'natish
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/** Chap kartochkadagi ma'lumot qatori: chapda nomi, o'ngda qiymati.
    Avvalgi ikonka-kvadratli ko'rinish qator boshiga bir xil balandlik qo'shib,
    kartochkani ekranga sig'maydigan qilib yuborardi. */
function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-matn-xira shrink-0">
                {icon && <span className="text-matn-xira shrink-0">{icon}</span>}
                {label}
            </span>
            <span className="num text-[12px] font-medium text-matn text-right truncate min-w-0" title={value}>
                {value || "—"}
            </span>
        </div>
    );
}

function TabButton({ label, icon, active, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2 shrink-0 cursor-pointer ${active
                ? 'bg-brand text-brand-ust font-semibold'
                : 'text-matn-xira hover:text-gray-700 dark:hover:text-gray-200'
                }`}
        >
            {label}
        </button>
    );
}
