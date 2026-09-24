import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, Phone, Calendar, MapPin, BookOpen, CreditCard, ReceiptText,
    Clock, CheckCircle, XCircle, Plus, Award, ClipboardCheck, Users, Layers, ChevronRight, Save, Edit, Bus, Sparkles, Image as ImageIcon, Camera, X, Send, Trash2, Star, ScanFace, Maximize2, Target, Compass, GraduationCap, ToggleLeft, ToggleRight
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { displayName } from '../lib/displayName';
import Avatar from './ui/Avatar';
import { useConfirm } from './ConfirmDialog';
import { useParams, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import MapPicker from './MapPicker';
import StudentLocationMap from './StudentLocationMap';
import PhotoCapture from './PhotoCapture';
import { uploadProfilePhoto, removeBackgroundHQ } from '../lib/image';
import { toDateStr } from '../../lib/lessons.js';
import { printReceipt } from '../lib/receipt';
import { activeCourses } from '../lib/activeCourses';
import PhotoViewer, { photoActionCls } from './PhotoViewer';
import StudentMoveModal from './StudentMoveModal';
import PaymentEditModal, { canEditPayment } from './PaymentEditModal';
import KursHisobModal from './KursHisobModal';
import BirinchiOyInput from './BirinchiOyInput';
import PaymeLinkModal from './PaymeLinkModal';
import { STUDY_GOALS, UZB_REGIONS, ORG_TYPES, gradeOptions, gradeLabel, keepGrade } from '../lib/studentFields';
import StudentLedger, { kirishMuddati, type Ledger } from './StudentLedger';
import { loadFaceModels, descriptorFromPhoto, saveFaceProfiles, faceFailText, faceFailedBefore, rememberFaceTry, forgetFaceTry } from '../lib/faceDescriptor';
import type { FaceFail } from '../lib/faceDescriptor';
import type { Payment } from '../types';
import { amaldagiQoida, qoidaMatni, kelganSana } from '../lib/taqsimot';

/**
 * Face ID holati. Alohida "rasmga tushish" ham, tugma ham yo'q: belgi profil
 * rasmidan o'zi olinadi, bu yer faqat natijani aytadi.
 */
type FaceState = 'tekshirilmoqda' | 'tayyor' | 'yuzYoq' | 'rasmYoq';


export default function StudentDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useLang();
    const { students, groups, teachers, courses, payments, attendances, scores, transports, routes, directions, settings, addPayment,addAttendance, addScore, updateStudent, addStudentToGroup, deleteStudent, setStudentStatus, topics, updateAttendance, showNotification, loadAttendanceFor, retryLoad, user: currentUser } = useCRM();

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
    /** Bu o'quvchi Face ID ga qo'shilganmi (alohida jadvaldan tekshiriladi). */
    const [faceState, setFaceState] = useState<FaceState>('tekshirilmoqda');
    /** Nega olinmadi. Ilgari har qanday xato "rasmda yuz aniqlanmadi" deb
     *  ko'rsatilardi — rasm umuman ochilmagan holat ham shunday chiqib,
     *  xodim aybsiz rasmni almashtirib yurardi. */
    const [faceFail, setFaceFail] = useState<FaceFail>('topilmadi');
    // Payme havolasi / QR — ota-ona o'zi to'laydi, pul avtomatik tushadi.
    const [showPaymeModal, setShowPaymeModal] = useState(false);
    // Guruhlar orasida ko'chirish / o'qishni to'xtatib pulni qayta hisoblash.
    // Faqat kursni almashtirish uchun: "Chiqish / qaytarish" tugmasi
    // egasining so'roviga ko'ra olib tashlandi (2026-09-22).
    const [moveMode, setMoveMode] = useState<'transfer' | null>(null);
    const [moveFrom, setMoveFrom] = useState<number | undefined>(undefined);
    const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
    const [showSmsModal, setShowSmsModal] = useState(false);
    const [smsData, setSmsData] = useState({ phone: '', type: '' });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [attendanceGroupFilter, setAttendanceGroupFilter] = useState<number | null>(null);
    // "Kursga kelgan sana": o'quvchi ro'yxatga oy boshida olinib, darsga oy
    // o'rtasidan kelishi mumkin — hisob o'sha kundan yuritiladi.
    const [editingStart, setEditingStart] = useState<{ groupId: number, name: string, current: string } | null>(null);
    // To'lovni tahrirlash (resepshn — 10 daqiqa, admin — doim).
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    // Kartochkadagi ha/yo'q belgilari saqlanayotgan payt (transport | imtihon).
    const [belgiSaqlanmoqda, setBelgiSaqlanmoqda] = useState<'transport' | 'imtihon' | null>(null);
    // "Balans taqsimoti" oynasi: bir nechta kursdagi o'quvchining balansi har
    // oy kurslarga qanday yechiladi — teng (standart) yoki foizda (egasi, 2026-09-23).
    const [taqsimOyna, setTaqsimOyna] = useState(false);
    const [taqsimQoidaVal, setTaqsimQoidaVal] = useState<'teng' | 'foiz'>('teng');
    const [taqsimFoiz, setTaqsimFoiz] = useState<Record<string, string>>({});
    const [taqsimSaqlanmoqda, setTaqsimSaqlanmoqda] = useState(false);
    // Profil izohi (Student.comment) — bazada bor edi, lekin interfeysda ko'rinmasdi.
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [noteDraft, setNoteDraft] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);

    /**
     * Kartochkadagi ha/yo'q belgisini almashtirish: transportda qatnaydimi,
     * imtihonga keladimi. Formani ochmasdan, bir bosishda.
     */
    const belgiOzgartir = async (belgi: 'transport' | 'imtihon', qiymat: boolean) => {
        if (!student || belgiSaqlanmoqda) return;
        setBelgiSaqlanmoqda(belgi);
        try {
            await updateStudent(student.id, belgi === 'transport'
                ? { needsTransport: qiymat }
                : { attendsExam: qiymat } as any);
        } finally {
            setBelgiSaqlanmoqda(null);
        }
    };

    /** Shu kursga kelgan sana — hisob yuritiladigan kun (lib/taqsimot.ts → kelganSana). */
    const kursSanasi = (groupId: number) => student ? kelganSana(student, groupId, payments) : null;



    const handleConfirmDelete = async () => {
        const id = student!.id;
        try {
            const res = await deleteStudent(id);
            if (res.ok) { navigate('/students'); return; }
            if (!res.needsChoice) return;
            // To'lovi yoki davomati bor o'quvchi: o'chirish butun tarixini
            // olib ketadi, shuning uchun avval arxiv taklif qilinadi.
            const javob = await confirm({
                title: "O'quvchini o'chirish",
                message: res.error || '',
                confirmLabel: 'Arxivga olish',
                altLabel: "Butunlay o'chirish",
                cancelLabel: 'Bekor qilish',
            });
            if (javob === 'alt') {
                if (!await confirm({
                    title: 'Yana bir bor tasdiqlang',
                    message: "O'quvchi va uning to'lovlari, davomati, baholari butunlay o'chadi. Moliyadagi o'tgan oylar tushumi ham shunga mos kamayadi. Bu amalni ortga qaytarib bo'lmaydi.",
                    confirmLabel: "Ha, butunlay o'chir",
                })) return;
                const majburiy = await deleteStudent(id, true);
                if (majburiy.ok) navigate('/students');
            } else if (javob === true) {
                await setStudentStatus(id, 'Arxiv');
                showNotification("O'quvchi arxivga olindi", 'success');
                navigate('/students');
            }
        } catch (err) {
            console.error("Delete failed", err);
            showNotification(t('error_occurred'), 'error');
        }
    };

    /**
     * Face ID belgisini PROFIL RASMIDAN oladi.
     *
     * Alohida "Face ID uchun suratga tushish" yo'q va tugma ham yo'q: rasm
     * qo'yilishi bilan belgi o'zi olinadi. Manba bitta — profil rasmi.
     *
     * `warn` — rasm qo'lda almashtirilganda muammo haqida xabar beriladi;
     * sahifa ochilganda esa jimgina bajariladi.
     */
    const syncFaceFromPhoto = async (photoUrl?: string, warn = false) => {
        const src = photoUrl || student?.photo;
        if (!student || !src) { setFaceState('rasmYoq'); return; }
        setFaceState('tekshirilmoqda');
        try {
            await loadFaceModels();
            const res = await descriptorFromPhoto(src);
            if (!res.descriptor) {
                rememberFaceTry(student.id, src, false);
                setFaceFail(res.reason || 'rasm');
                setFaceState('yuzYoq');
                if (warn) showNotification(`Face ID olinmadi — ${faceFailText(res.reason || 'rasm')}. Aniqroq rasm qo'ying.`, 'error');
                return;
            }
            await saveFaceProfiles(student.schoolId, [{ studentId: student.id, descriptor: res.descriptor }]);
            rememberFaceTry(student.id, src, true);
            setFaceState('tayyor');
        } catch (err: any) {
            rememberFaceTry(student.id, src, false);
            setFaceFail('rasm');
            setFaceState('yuzYoq');
            if (warn) showNotification(err?.message || 'Face ID olinmadi', 'error');
        }
    };

    /** "Qayta urinish": seans keshini tozalab, belgini yangidan hisoblaydi. */
    const retryFace = () => {
        if (!student?.photo) return;
        forgetFaceTry(student.id, student.photo);
        syncFaceFromPhoto(student.photo, true);
    };

    const handlePhotoCapture = async (base64: string) => {
        const url = await uploadProfilePhoto(base64, `student-${student!.id}.jpg`);
        await updateStudent(student!.id, { photo: url });
        // Yangi rasm — Face ID belgisi ham shu rasmdan qayta olinadi.
        syncFaceFromPhoto(url, true);
    };


    const [isMapOpen, setIsMapOpen] = useState(false);
    const [isLocationViewOpen, setIsLocationViewOpen] = useState(false);
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
        routeIds: [] as number[],
        needsTransport: false,
        studentSchool: '',
        privilegeType: 'None',
        certCategory: '',
        certSubject: '',
        certType: '',
        certScore: '',
        orgType: '',
        grade: '',
        region: '',
        district: '',
        studyGoal: '',
        directionId: '' as string | number,
        telegramId: '',
        fatherTelegramId: '',
        motherTelegramId: '',
        certificates: [] as Array<{ category: 'Milliy' | 'Xalqaro'; subject?: string; type?: string; score?: string }>
    });

    const student = students.find(s => s.id === Number(id));
    const studentDirection = (directions || []).find(d => d.id === student?.directionId) || null;


    // Ismni oddiy yozuvga keltirish — umumiy yordamchi (src/lib/displayName).

    // Startup only carries recent attendance, so pull this student's full history —
    // the profile shows every lesson they have attended, not just the last few weeks.
    React.useEffect(() => {
        if (student?.id) loadAttendanceFor({ studentId: student.id });
    }, [student?.id]);

    // Face ID: belgi bormi, bo'lmasa — profil rasmidan jimgina olinadi.
    // Belgi alohida jadvalda, shuning uchun holat alohida so'raladi (yengil
    // javob: faqat ID lar).
    React.useEffect(() => {
        if (!student?.id || !student?.schoolId) return;
        if (!student.photo) { setFaceState('rasmYoq'); return; }
        if (faceFailedBefore(student.id, student.photo)) { setFaceState('yuzYoq'); return; }

        let off = false;
        (async () => {
            try {
                const r = await fetch(`/api/face-profiles?schoolId=${student.schoolId}&studentId=${student.id}&ids=1`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                });
                const j = await r.json();
                if (off) return;
                if (r.ok && (j.profiles || []).length > 0) { setFaceState('tayyor'); return; }
                if (r.ok) await syncFaceFromPhoto(student.photo);
            } catch { /* holat noma'lum qoladi */ }
        })();
        return () => { off = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [student?.id, student?.schoolId, student?.photo]);

    // O'quvchi hisobi (/ledger) — yuqoridagi ko'rsatkichlar, kurs kartochkalari
    // va oylar jadvali shu bitta so'rovdan. To'lov yoki hisob o'zgarsa qayta.
    const [ledger, setLedger] = useState<Ledger | null>(null);
    const hisobKaliti = payments.filter(p => p.studentId === Number(id)).map(p => p.id + ':' + p.amount).join(',') + '|' + (student?.balance ?? '') + '|' + (student?.groups || []).join(',');
    useEffect(() => {
        if (!student?.id) return;
        let off = false;
        (async () => {
            try {
                const r = await fetch(`/api/students/${student.id}/ledger`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                const j = await r.json();
                if (!off && r.ok) setLedger(j);
            } catch { /* ko'rsatkichlar "…" bo'lib turadi */ }
        })();
        return () => { off = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [student?.id, hisobKaliti]);

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

    // Xarita CRM ichida ochiladi: o'quvchi portreti va markaz logosi bilan.
    // Google Maps'ga o'tish shu oynadagi tugmada qoldi.
    const handleOpenMap = () => {
        if (!student.location) return;
        setIsLocationViewOpen(true);
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
            routeIds: student.routeIds || [],
            needsTransport: !!student.needsTransport,
            studentSchool: student.studentSchool || '',
            privilegeType: student.privilegeType || 'None',
            certCategory: student.certCategory || '',
            certSubject: student.certSubject || '',
            certType: student.certType || '',
            certScore: student.certScore || '',
            orgType: student.orgType || '',
            grade: student.grade || '',
            region: student.region || '',
            district: student.district || '',
            studyGoal: student.studyGoal || '',
            directionId: student.directionId ?? '',
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

            // Telegram ID lar formaga sahifa ochilganda yozilgan. Agar o'quvchi
            // shundan keyin botga ulangan bo'lsa, o'zgarmagan bo'sh maydonni
            // yuborish yangi ulanishni o'chirib yuborardi — shuning uchun
            // tegilmagan maydonlar umuman yuborilmaydi.
            const payload: Record<string, any> = {
                ...editForm,
                routeIds: editForm.routeIds,
                studyGoal: editForm.studyGoal || null,
                grade: editForm.grade || null,
                directionId: editForm.directionId ? Number(editForm.directionId) : null
            };
            const telegramFields = ['telegramId', 'fatherTelegramId', 'motherTelegramId'] as const;
            for (const key of telegramFields) {
                const typed = (editForm[key] || '').trim();
                const loaded = (student[key] || '').trim();
                if (typed === loaded) {
                    delete payload[key];
                } else {
                    payload[key] = typed || null;
                }
            }

            await updateStudent(student.id, payload);
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
            // Sifat saqlanadi: modeldan faqat niqob olinadi (lib/image.ts).
            const image = await removeBackgroundHQ(student.photo);
            await updateStudent(student.id, { photo: image });
            // Fon o'zgargani belgiga ham ta'sir qiladi — qayta hisoblanadi.
            syncFaceFromPhoto(image, true);
            showNotification(t('bg_cleared_success'), 'info');
        } catch (err: any) {
            console.error("BG Removal failed", err);
            showNotification(t('error_occurred') + (err?.message ? ": " + err.message : ''), 'error');
        } finally {
            setIsRemovingBg(false);
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const url = await uploadProfilePhoto(reader.result as string, file.name);
                await updateStudent(student.id, { photo: url });
                syncFaceFromPhoto(url, true);
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
            sub: (p.description || '').replace(/^\[[^\]]+\]\s*/, '') || (p.amount < 0 ? 'Avtomatik hisoblash' : p.type),
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                {/* Ism kartochkasi — pul bloki bilan bir qatorda (ilgari alohida qatorda
                    turib, o'ng tomoni bo'm-bo'sh qolardi). */}
                <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1 bg-sirt rounded-2xl border border-chiziq p-5 flex flex-col gap-4 min-w-0">
                <div className="flex items-center gap-3.5 min-w-0">
                    {/* Avatarni bosish suratni katta oynada ochadi — u yerda yuklash,
                        kamera va fonni tozalash tugmalari doim ko'rinadi. Ilgari bu
                        tugmalar avatar ustida faqat sichqoncha kelganda chiqardi:
                        telefonda hover yo'q, 84px ga to'rtta tugma sig'masdi ham —
                        telefondan fonni tozalab bo'lmasdi. */}
                    <div role="button" tabIndex={0} title="Suratni ochish"
                        onClick={() => setIsPhotoViewerOpen(true)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsPhotoViewerOpen(true); } }}
                        className="relative shrink-0 rounded-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand">
                        <Avatar name={student.name} photo={student.photo} size={84} fontSize={28} className="group/avatar">
                            <div className="absolute inset-0 bg-gray-950/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                                <Maximize2 size={18} />
                            </div>
                        </Avatar>
                        {/* Telefonda ham ko'rinadigan belgi: rasm bilan ishlash shu yerda. */}
                        <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-brand text-white border-2 border-sirt flex items-center justify-center shadow-sm pointer-events-none">
                            <Camera size={13} />
                        </span>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-start gap-2">
                            <h1 className="text-[19px] font-semibold text-matn tracking-tight leading-tight break-words">{displayName(student.name)}</h1>
                            <button onClick={handleStartEdit} title={t('edit')} className="text-matn-xira hover:text-brand cursor-pointer shrink-0">
                                <Edit size={13} />
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
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
                            {[student.studentSchool, student.orgType, student.grade].filter(Boolean).length > 0 && (
                                <>
                                    <span className="basis-full text-[12px] text-matn-sokin truncate">
                                        {[student.studentSchool, student.orgType, student.grade].filter(Boolean).join(' \u00b7 ')}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Aloqa: qo'ng'iroq va SMS. To'lov tugmalari — pul blokida,
                    kursni almashtirish — kurs kartochkasida. */}
                    {/* Pul — ism kartochkasining o'zida (alohida qator va katta blok
                        egasiga yoqmadi): kim va qancha qarzi bor — bitta joyda. */}
                    {(() => {
                        const bal = student.balance || 0;
                        const sinov = student.status === 'Sinov';
                        const kurslarHolati = (ledger?.courses || []).filter(c => c.isMember !== false && studentGroups.some(g => g.id === c.groupId));
                        const engKurs = kurslarHolati.find(c => kirishMuddati(c).ton === 'xato')
                            || kurslarHolati.filter(c => c.paidUntil && !c.accessUnknown).sort((a, b) => a.paidUntil!.localeCompare(b.paidUntil!))[0]
                            || kurslarHolati[0];
                        const eng = engKurs ? kirishMuddati(engKurs) : null;
                        const TON = { yaxshi: 'text-yaxshi', ogoh: 'text-ogoh', xato: 'text-xato', xira: 'text-matn-xira' } as const;
                        const ton = sinov ? 'text-ogoh' : bal < 0 ? 'text-xato' : bal > 0 ? 'text-yaxshi' : 'text-matn';
                        const oylikJami = studentGroups.reduce((s, g) => {
                            const cp = student.customPrices && typeof student.customPrices === 'object' ? (student.customPrices as Record<string, number>)[g.id] : undefined;
                            return s + (cp !== undefined ? Number(cp) : (g.coursePrice || 0));
                        }, 0);
                        const paymeOn = (settings.paymeMode === 'live' || settings.paymeMode === 'test') && ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'SUPERADMIN'].includes(currentUser?.role || '');
                        return (
                            <div className="pt-4 border-t border-chiziq-mayin space-y-3">
                                <div className="flex items-end justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[12px] text-matn-sokin">
                                            {sinov ? 'Sinov darsida' : bal < 0 ? 'Qarz' : bal > 0 ? 'Avans' : 'Balans'}
                                            {!sinov && bal < 0 && debtDays !== null && <span className="text-matn-xira"> · {debtDays} kundan beri</span>}
                                        </p>
                                        <p className={`raqam text-[22px] font-semibold leading-tight mt-0.5 ${ton}`}>
                                            {Math.abs(bal).toLocaleString('ru-RU')} <span className="text-[12px] text-matn-xira font-normal">so'm</span>
                                        </p>
                                    </div>
                                    <p className="text-right text-[11px] text-matn-xira leading-snug shrink-0">
                                        oyiga<br /><span className="raqam text-[13px] text-matn-2">{oylikJami.toLocaleString('ru-RU')}</span>
                                    </p>
                                </div>
                                <p className="text-[12px] text-matn-sokin">
                                    Darsga kirish:{' '}
                                    <span className={`font-semibold ${sinov ? 'text-ogoh' : eng ? TON[eng.ton] : 'text-matn-xira'}`}>
                                        {sinov ? 'hisob yozilmaydi' : !ledger ? '…' : eng ? eng.matn : '—'}
                                    </span>
                                    {!sinov && (eng?.izoh || (kurslarHolati.length > 1 && engKurs)) && (
                                        <span className="text-matn-xira"> · {[kurslarHolati.length > 1 ? engKurs?.groupName : '', eng?.izoh].filter(Boolean).join(' · ')}</span>
                                    )}
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowPaymentModal(true)}
                                        className="flex-1 h-10 px-4 bg-brand hover:bg-brand-dark text-white rounded-xl text-[13px] font-semibold transition-colors cursor-pointer">
                                        To'lov qabul qilish
                                    </button>
                                    {paymeOn && (
                                        <button onClick={() => setShowPaymeModal(true)}
                                            title="Payme orqali to'lash uchun havola yoki QR"
                                            className="h-10 px-4 border border-chiziq-kuchli text-brand hover:bg-brand hover:text-white rounded-xl text-[13px] font-semibold transition-colors cursor-pointer">
                                            Payme
                                        </button>
                                    )}
                                </div>

                                {/* Izoh — yozilgan bo'lsa yoki yozilayotganda. */}
                                {(isEditingNote || student.comment) && (
                                    isEditingNote ? (
                                        <div className="space-y-2">
                                            <textarea rows={3} autoFocus value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                                                placeholder="Ota-ona bilan suhbat, kelishuvlar (masalan: 25-sentabrgacha to'laydi)..."
                                                className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[12px] text-matn leading-relaxed focus:border-brand outline-none transition-colors resize-none" />
                                            <div className="flex gap-2">
                                                <button onClick={handleSaveNote} disabled={isSavingNote}
                                                    className="px-4 py-1.5 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg text-[12px] font-semibold cursor-pointer">
                                                    {t('save')}
                                                </button>
                                                <button onClick={() => setIsEditingNote(false)}
                                                    className="px-4 py-1.5 text-matn-xira hover:text-matn rounded-lg text-[12px] font-semibold cursor-pointer">
                                                    {t('cancel')}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start justify-between gap-2 px-3 py-2 bg-ichki/60 rounded-xl">
                                            <p className="text-[12px] text-matn-2 leading-relaxed whitespace-pre-wrap min-w-0">
                                                <span className="text-matn-xira">Izoh: </span>{student.comment}
                                            </p>
                                            <button onClick={() => { setNoteDraft(student.comment || ''); setIsEditingNote(true); }}
                                                title="Izohni tahrirlash"
                                                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-matn-xira hover:text-brand hover:bg-brand/10 cursor-pointer">
                                                <Edit size={12} />
                                            </button>
                                        </div>
                                    )
                                )}
                            </div>
                        );
                    })()}

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-chiziq-mayin">
                    <a href={student.phone ? `tel:${student.phone.replace(/\s/g, '')}` : undefined}
                        aria-disabled={!student.phone}
                        title={student.phone || t('phone_not_found')}
                        className={`h-9 px-3 flex items-center justify-center gap-1.5 rounded-lg border text-[12px] font-semibold transition-colors ${student.phone
                            ? 'border-chiziq-kuchli text-brand hover:bg-brand hover:text-white cursor-pointer'
                            : 'border-chiziq text-matn-xira pointer-events-none'}`}>
                        <Phone size={14} />
                        Qo'ng'iroq
                    </a>
                    <button onClick={() => handleSendSms(student.phone, 'manual')} title="SMS yuborish"
                        className="h-9 px-3 flex items-center justify-center gap-1.5 rounded-lg border border-chiziq-kuchli text-brand hover:bg-brand hover:text-white text-[12px] font-semibold transition-colors cursor-pointer">
                        <Send size={14} />
                        SMS
                    </button>
                    {!student.comment && !isEditingNote && (
                        <button onClick={() => { setNoteDraft(''); setIsEditingNote(true); }} title="Izoh qo'shish"
                            className="h-9 px-3 flex items-center justify-center rounded-lg border border-chiziq text-matn-sokin hover:text-brand hover:border-brand text-[12px] font-semibold transition-colors cursor-pointer">
                            + Izoh
                        </button>
                    )}
                </div>
                </div>

                {/* Left Profile Card */}
                <div className="lg:col-start-1 lg:row-start-2 space-y-4 order-3 lg:order-none">
                    <div className={isEditing
                        ? "fixed inset-0 z-[200] overflow-y-auto bg-gray-900/60 backdrop-blur-sm p-4 flex items-start justify-center"
                        : "bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden"}>
                    <div className={isEditing ? "relative bg-sirt w-full max-w-3xl my-6 rounded-[2rem] border border-chiziq shadow-2xl" : ""}>
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
                        <div className={isEditing ? "px-6 pt-6 pb-2" : "hidden"}>
                            {isEditing ? (
                                <>
                                <div className="flex items-center justify-between mb-5 pb-4 border-b border-chiziq-mayin">
                                    <h3 className="text-[15px] font-semibold text-matn">Ma'lumotlarni tahrirlash</h3>
                                    <button onClick={() => setIsEditing(false)} aria-label="Yopish" className="w-8 h-8 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer"><X size={18} /></button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
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
                                    <div className="sm:col-span-2">
                                        <label className={labelCls}>Transport</label>
                                        <button type="button"
                                            onClick={() => setEditForm({ ...editForm, needsTransport: !editForm.needsTransport })}
                                            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${editForm.needsTransport
                                                ? 'bg-teal-50 dark:bg-teal-950/20 text-brand border-teal-100 dark:border-teal-900/40'
                                                : 'bg-ichki text-matn-xira border-chiziq'}`}>
                                            <span>🚌 Transportda qatnaydi</span>
                                            <span>{editForm.needsTransport ? '✓' : '+'}</span>
                                        </button>
                                        {/* Qaysi mashinaga tushishini tizim har kuni o'zi hal
                                            qiladi: davomat, haydovchi javobi va sig'imga qarab. */}
                                        <p className="text-[10px] font-bold text-matn-xira mt-1.5">
                                            Mashina har kuni davomatga qarab avtomatik taqsimlanadi
                                        </p>
                                    </div>
                                </div>
                                </>
                            ) : null}
                        </div>

                        {/* Rasm oynalari (balans endi yuqoridagi ko'rsatkichlar qatorida). */}
                        <div className="contents">
                            {/* Photo Capture Modal */}
                            {isPhotoModalOpen && (
                                <PhotoCapture
                                    onCapture={base64 => {
                                        handlePhotoCapture(base64);
                                        // Yangi rasm katta oynada — darrov fonini tozalash mumkin.
                                        setIsPhotoViewerOpen(true);
                                    }}
                                    onClose={() => setIsPhotoModalOpen(false)}
                                />
                            )}

                            {isPhotoViewerOpen && (
                                <PhotoViewer
                                    src={student.photo}
                                    name={displayName(student.name)}
                                    onClose={() => setIsPhotoViewerOpen(false)}
                                    actions={<>
                                        <label className={photoActionCls}>
                                            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                            <ImageIcon size={20} />
                                            {t('upload')}
                                        </label>
                                        <button type="button" className={photoActionCls}
                                            onClick={() => { setIsPhotoViewerOpen(false); setIsPhotoModalOpen(true); }}>
                                            <Camera size={20} />
                                            {t('take_photo')}
                                        </button>
                                        <button type="button" className={photoActionCls}
                                            onClick={handleRemoveBg} disabled={!student.photo || isRemovingBg}>
                                            <Sparkles size={20} className={isRemovingBg ? 'animate-spin' : ''} />
                                            {isRemovingBg ? t('clearing_bg') : t('clear_bg_btn')}
                                        </button>
                                    </>}
                                />
                            )}

                        </div>

                        <div className={isEditing ? "px-6 pb-6 pt-1" : "px-6 pb-5 space-y-1 border-t border-chiziq pt-3"}>
                            {isEditing ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                                    <div className="sm:col-span-2 grid grid-cols-2 gap-2">
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
                                    <div className="sm:col-span-2">
                                        <label className={labelCls}>{t('address')}</label>
                                        <input type="text" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className={inputCls} />
                                    </div>
                                    <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                                        <div>
                                            <label className={labelCls}>Maqsad</label>
                                            <select
                                                value={editForm.studyGoal}
                                                onChange={e => setEditForm({...editForm, studyGoal: e.target.value})}
                                                className={inputCls}
                                            >
                                                <option value="">Tanlang...</option>
                                                {STUDY_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Yo'nalish</label>
                                            <select
                                                value={editForm.directionId}
                                                onChange={e => setEditForm({...editForm, directionId: e.target.value})}
                                                className={inputCls}
                                            >
                                                <option value="">Tanlang...</option>
                                                {(directions || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Ta'lim muassasasi turi</label>
                                        <select
                                            value={editForm.orgType}
                                            onChange={e => setEditForm({...editForm, orgType: e.target.value, grade: keepGrade(editForm.grade, e.target.value)})}
                                            className={inputCls}
                                        >
                                            <option value="">Tanlang...</option>
                                            {ORG_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    {/* Bog'cha va boshqa turlarda chiqmaydi; eski (Excel'dan kelgan)
                                        qiymat bo'lsa, o'chirib qo'yish uchun ko'rinib turadi. */}
                                    {(gradeOptions(editForm.orgType).length > 0 || !!editForm.grade) && (
                                        <div>
                                            <label className={labelCls}>{gradeLabel(editForm.orgType)}</label>
                                            <select
                                                value={editForm.grade}
                                                onChange={e => setEditForm({...editForm, grade: e.target.value})}
                                                className={inputCls}
                                            >
                                                <option value="">Tanlang...</option>
                                                {editForm.grade && !gradeOptions(editForm.orgType).includes(editForm.grade) && (
                                                    <option value={editForm.grade}>{editForm.grade}</option>
                                                )}
                                                {gradeOptions(editForm.orgType).map(g => <option key={g} value={g}>{g}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div className="sm:col-span-2">
                                        <label className={labelCls}>Muassasa nomi</label>
                                        <input type="text" value={editForm.studentSchool} onChange={e => setEditForm({...editForm, studentSchool: e.target.value})} className={inputCls} placeholder="45-maktab" />
                                    </div>
                                    <div className="sm:col-span-2 grid grid-cols-2 gap-2">
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
                                    <div className="sm:col-span-2 grid grid-cols-3 gap-2">
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
                                    <div className="sm:col-span-2 grid grid-cols-3 gap-2">
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
                                    <div className="sm:col-span-2">
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
                                    <div className="sm:col-span-2 space-y-3 pt-2">
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
                                    <div className="sm:col-span-2 pt-2 flex gap-2">
                                        <button
                                            onClick={handleSaveEdit}
                                            disabled={isSaving}
                                            className="flex-1 py-3 bg-brand hover:bg-brand-dark text-white rounded-xl text-[11px] font-extrabold shadow-sm shadow-[#1b6b6b]/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {t('save')}
                                        </button>
                                        <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-ichki border border-chiziq text-matn-sokin hover:text-matn rounded-xl text-[11px] font-extrabold transition-all cursor-pointer">
                                            {t('cancel')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Avval bu yerda "Lid ma'lumotlari" deb turardi —
                                        o'quvchi profilida noto'g'ri sarlavha. */}
                                    <h3 className="text-[11px] font-semibold text-matn-sokin pb-1">Aloqa</h3>
                                    {/* O'quvchi, ota, ona — bir xil qator: chapda kim, o'ngda telefon
                                        va ostida Telegram holati. Ilgari har biri boshqacha
                                        joylashgan edi (egasi, 2026-09-23: "tartibsiz"). */}
                                    <KontaktQator
                                        icon={<Phone className="w-3.5 h-3.5" />}
                                        label="O'quvchi"
                                        phone={student.phone}
                                        tgId={student.telegramId}
                                        onSms={student.phone ? () => handleSendSms(student.phone, 'manual') : undefined}
                                        onUzish={() => handleDisconnectTelegram('student')}
                                    />
                                    <KontaktQator
                                        icon={<Users className="w-3.5 h-3.5" />}
                                        label={t('father')}
                                        name={student.fatherName}
                                        phone={student.fatherPhone}
                                        tgId={student.fatherTelegramId}
                                        onSms={student.fatherPhone ? () => handleSendSms(student.fatherPhone!, 'manual') : undefined}
                                        onUzish={() => handleDisconnectTelegram('father')}
                                    />
                                    <KontaktQator
                                        icon={<Users className="w-3.5 h-3.5" />}
                                        label={t('mother')}
                                        name={student.motherName}
                                        phone={student.motherPhone}
                                        tgId={student.motherTelegramId}
                                        onSms={student.motherPhone ? () => handleSendSms(student.motherPhone!, 'manual') : undefined}
                                        onUzish={() => handleDisconnectTelegram('mother')}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                    </div>
                </div>

                {/* Right Tab Content */}
                <div className="lg:col-start-2 lg:col-span-3 lg:row-start-1 lg:row-span-2 space-y-4 order-2 lg:order-none min-w-0">
                    <div className="bg-sirt rounded-2xl border border-chiziq shadow-sm overflow-hidden">
                        <div className="flex px-2 py-2 bg-ichki border-b border-chiziq gap-1 overflow-x-auto scrollbar-hide items-center justify-start rounded-t-3xl">
                            <TabButton label={t('general')} icon={<Users size={14} />} active={activeTab === 'umumiy'} onClick={() => setActiveTab('umumiy')} />
                            <TabButton label="Kurslar" icon={<Layers size={14} />} active={activeTab === 'kurslar'} onClick={() => setActiveTab('kurslar')} />
                            <TabButton label="Balans" icon={<CreditCard size={14} />} active={activeTab === 'tolovlar'} onClick={() => setActiveTab('tolovlar')} />
                            <TabButton label={t('attendance')} icon={<ClipboardCheck size={14} />} active={activeTab === 'yoqlama'} onClick={() => setActiveTab('yoqlama')} />
                            <TabButton label="Ballar" icon={<Star size={14} />} active={activeTab === 'ballar'} onClick={() => setActiveTab('ballar')} />
                        </div>

                        <div className="p-4">
                            {activeTab === 'kurslar' && (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between gap-3 pb-2 border-b border-chiziq-mayin">
                                                <span className="text-[12px] font-semibold text-matn"><span className="raqam">{studentGroups.length}</span> ta kurs</span>
                                                <button onClick={() => setShowGroupModal(true)}
                                                    className="text-[11px] font-bold text-brand hover:underline cursor-pointer">
                                                    + Kursga qo'shish
                                                </button>
                                            </div>
                                            {/* Balans taqsimoti — pul faqat balansga tushadi, har oy kurslarga
                                                balansdan yechiladi. Standart teng; shu o'quvchi uchun foizda (50/50, 70/30). */}
                                            {studentGroups.length > 1 && (() => {
                                                const q = amaldagiQoida(student.payShare);
                                                const kursNomi = (id: number) => groups.find(g => g.id === id)?.name || ('#' + id);
                                                return (
                                                    <div className="flex items-center justify-between gap-3 p-3 bg-ichki/40 border border-chiziq rounded-2xl">
                                                        <div className="min-w-0">
                                                            <p className="text-[11px] font-bold text-matn-xira">Balans taqsimoti</p>
                                                            <p className="text-[12px] font-black text-matn mt-0.5 truncate">{qoidaMatni(q, kursNomi)}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const ps = student.payShare;
                                                                setTaqsimQoidaVal(ps?.rule === 'foiz' ? 'foiz' : 'teng');
                                                                const f: Record<string, string> = {};
                                                                let qolgan = 100;
                                                                studentGroups.forEach((g, i) => {
                                                                    const w = ps?.rule === 'foiz' ? ps.weights?.[String(g.id)] : undefined;
                                                                    const v = w !== undefined ? Number(w) : (i === studentGroups.length - 1 ? qolgan : Math.round(100 / studentGroups.length));
                                                                    f[String(g.id)] = String(v); qolgan -= v;
                                                                });
                                                                setTaqsimFoiz(f);
                                                                setTaqsimOyna(true);
                                                            }}
                                                            className="shrink-0 px-3 py-2 text-[11px] font-bold border border-chiziq rounded-xl text-brand hover:border-brand hover:bg-brand/10 transition-colors cursor-pointer"
                                                        >
                                                            O'zgartirish
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                            <div className="space-y-3">
                                                {studentGroups.length === 0 ? (
                                                    <p className="text-center py-8 text-[11px] text-matn-xira font-bold">{t('no_groups_found')}</p>
                                                ) : (
                                                    studentGroups.map(group => {
                                                        const studentCustomPrice = student.customPrices && typeof student.customPrices === 'object'
                                                            ? (student.customPrices as Record<string, number>)[group.id]
                                                            : undefined;
                                                        const kelgan = kursSanasi(group.id) || '';
                                                        const oylik = studentCustomPrice !== undefined ? studentCustomPrice : (group.coursePrice || 0);
                                                        const holat = ledger?.courses?.find(c => c.groupId === group.id);
                                                        const kDavomat = studentAttendances.filter(a => a.groupId === group.id);
                                                        const kFoiz = kDavomat.length ? Math.round(kDavomat.filter(a => a.status === 'Keldi').length / kDavomat.length * 100) : null;
                                                        const kQoldirgan = kDavomat.filter(a => a.status === 'Kelmapdi' || a.status === 'Sababli').length;
                                                        const muddat = holat ? kirishMuddati(holat) : null;
                                                        return (
                                                            <div key={group.id}
                                                                className="group bg-ichki/30 p-4 rounded-2xl border border-chiziq hover:border-brand/40 transition-colors">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => navigate(`/courses/${group.id}`)}>
                                                                        <div className="w-10 h-10 bg-sirt border border-chiziq rounded-xl flex items-center justify-center text-brand shrink-0">
                                                                            <BookOpen size={18} />
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <h5 className="text-[13px] font-bold text-matn group-hover:text-brand tracking-tight truncate">{group.name}</h5>
                                                                            <p className="text-[11px] text-matn-xira mt-0.5 truncate">{group.courseName ? `${group.courseName} · ` : ''}{group.teacherName}</p>
                                                                        </div>
                                                                    </div>
                                                                    {/* Shu kurs bo'yicha qarz yoki avans */}
                                                                    {holat && student.status !== 'Sinov' && (
                                                                        <div className="text-right shrink-0">
                                                                            <p className={`raqam text-[14px] font-semibold leading-tight ${holat.debt > 0 ? 'text-xato' : holat.advance > 0 ? 'text-yaxshi' : 'text-matn-xira'}`}>
                                                                                {holat.debt > 0 ? '−' + holat.debt.toLocaleString('ru-RU') : holat.advance > 0 ? '+' + holat.advance.toLocaleString('ru-RU') : '0'}
                                                                            </p>
                                                                            <p className="text-[10px] text-matn-xira">{holat.debt > 0 ? 'qarz' : holat.advance > 0 ? 'avans' : "qarz yo'q"}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="mt-3 pt-3 border-t border-dashed border-chiziq/70 flex flex-wrap items-center justify-between gap-2">
                                                                    <div className="num text-[11px] text-matn-sokin space-y-0.5 min-w-0">
                                                                        <p>
                                                                            <span className="text-matn-xira">Kelgan</span> {kelgan ? `${kelgan.slice(8, 10)}.${kelgan.slice(5, 7)}.${kelgan.slice(0, 4)}` : '—'}
                                                                            <span className="text-matn-xira"> · Oylik</span>{' '}
                                                                            <span className={studentCustomPrice !== undefined ? 'text-brand' : ''}>{oylik.toLocaleString('ru-RU')}</span>
                                                                            {studentCustomPrice !== undefined && <span className="text-[10px] text-brand/70"> (shu o'quvchiga)</span>}
                                                                        </p>
                                                                        {muddat && student.status !== 'Sinov' && (
                                                                            <p className={({ yaxshi: 'text-yaxshi', ogoh: 'text-ogoh', xato: 'text-xato', xira: 'text-matn-xira' } as const)[muddat.ton]}>
                                                                                <span className="text-matn-xira">Darsga kirish</span> {muddat.matn}
                                                                                {muddat.izoh && <span className="text-matn-xira"> · {muddat.izoh}</span>}
                                                                            </p>
                                                                        )}
                                                                        <p>
                                                                            <span className="text-matn-xira">Davomat</span>{' '}
                                                                            {kFoiz === null ? <span className="text-matn-xira">hali yo'qlama yo'q</span> : (
                                                                                <>
                                                                                    <span className={kFoiz >= 80 ? 'text-yaxshi' : kFoiz >= 60 ? 'text-ogoh' : 'text-xato'}>{kFoiz}%</span>
                                                                                    <span className="text-matn-xira"> · {kQoldirgan ? `${kQoldirgan} dars qoldirgan` : 'qoldirmagan'}</span>
                                                                                </>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex gap-2 shrink-0">
                                                                        {/* Kurs hisobi — kelgan sana, oylik narx, birinchi oy summasi: bitta oynada. */}
                                                                        <button
                                                                            onClick={() => setEditingStart({ groupId: group.id, name: group.name, current: kelgan || toDateStr() })}
                                                                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-sirt border border-chiziq hover:border-brand rounded-xl text-[11px] font-bold text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                                                                            title="Kelgan sana, oylik narx va birinchi oy summasi"
                                                                        >
                                                                            <Edit size={12} />
                                                                            Kurs hisobi
                                                                        </button>
                                                                        {/* Boshqa kursga ko'chirish — pulga tegilmaydi. */}
                                                                        <button
                                                                            onClick={() => { setMoveFrom(group.id); setMoveMode('transfer'); }}
                                                                            className="inline-flex items-center px-3 py-2 bg-sirt border border-chiziq hover:border-brand rounded-xl text-[11px] font-bold text-matn-sokin hover:text-brand transition-colors cursor-pointer"
                                                                            title="Boshqa kursga ko'chirish — to'lovlarga tegilmaydi"
                                                                        >
                                                                            Almashtirish
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="pb-2 border-b border-chiziq-mayin">
                                                <span className="text-[12px] font-semibold text-matn">Oxirgi harakatlar</span>
                                            </div>
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
                                                                    {item.date.split('-').reverse().join('.')}{item.sub ? ' · ' + item.sub : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            )}

                            {activeTab === 'tolovlar' && (() => {
                                // Balans tarixi — hamma narsa bitta joyda (egasi, 2026-09-23):
                                // kelgan pul (+) va kurslarning oylik hisobi (−), har qatordan
                                // keyingi balans bilan. To'lov — tahrirlanadi (resepshn 10 daqiqa,
                                // admin doim); kurs hisobi — "Kurs hisobi" oynasida.
                                const tartib = [...studentPayments].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
                                const jamiYozuv = tartib.reduce((s, p) => s + p.amount, 0);
                                let qoldiq = Math.round((student.balance || 0) - jamiYozuv);   // yozuvlardan oldingi boshlang'ich qoldiq
                                const qatorlar = tartib.map(p => { qoldiq += p.amount; return { p, keyin: qoldiq }; }).reverse();
                                const jamiHisob = tartib.reduce((s, p) => s + (p.amount < 0 ? -p.amount : 0), 0);
                                const kursNomi = (gid?: number | null) => gid ? (groups.find(g => g.id === gid)?.name || '') : '';
                                const matn = (p: Payment) => (p.description || '').replace(/^\[[^\]]+\]\s*/, '');
                                const usul = (p: Payment) => p.type === 'Naqd' ? t('type_cash')
                                    : p.type === 'Karta' ? t('type_card')
                                    : p.type === 'Peyme' ? 'Payme'
                                    : p.type === 'Klik' ? t('type_click')
                                    : p.type;
                                return (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    {/* Balans va to'lov tugmasi — tepadagi pul blokida. Bu yerda faqat jami. */}
                                    <p className="num text-[12px] text-matn-sokin">
                                        Jami kelgan pul <span className="text-yaxshi font-semibold">{totalPaid.toLocaleString('ru-RU')}</span>
                                        {' · '}kurslar hisobi <span className="text-xato font-semibold">{jamiHisob.toLocaleString('ru-RU')}</span> so'm
                                    </p>
                                    <div className="space-y-2">
                                        <p className="text-[12px] font-semibold text-matn">Oylar bo'yicha hisob</p>
                                        <StudentLedger studentId={student.id} trial={student.status === 'Sinov'} data={ledger} compact />
                                    </div>
                                    <p className="text-[12px] font-semibold text-matn pt-2">Barcha yozuvlar</p>
                                    {qatorlar.length === 0 ? (
                                        <p className="text-center py-12 text-[11px] text-matn-xira font-bold">{t('no_payments_found')}</p>
                                    ) : (
                                        <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden shadow-sm divide-y divide-chiziq-mayin dark:divide-gray-700/50">
                                            {qatorlar.map(({ p, keyin }) => {
                                                const hisob = p.amount < 0 || p.type === 'Oylik';
                                                const kurs = kursNomi(p.groupId);
                                                const kursBor = !!p.groupId && studentGroups.some(g => g.id === p.groupId);
                                                const tahrir = hisob
                                                    ? (kursBor ? () => setEditingStart({ groupId: p.groupId!, name: kurs, current: kursSanasi(p.groupId!) || toDateStr() }) : null)
                                                    : (canEditPayment(p, currentUser?.role) ? () => setEditingPayment(p) : null);
                                                return (
                                                    <div key={p.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 hover:bg-ichki/50 transition-colors">
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${hisob
                                                            ? 'bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40'
                                                            : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
                                                        }`}>
                                                            {hisob ? <ReceiptText size={15} /> : <CreditCard size={15} />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[13px] font-bold text-matn truncate">
                                                                {hisob
                                                                    ? (matn(p) || `${kurs} — oylik hisob`)
                                                                    : `To'lov · ${usul(p)}`}
                                                            </p>
                                                            <p className="num text-[11px] font-semibold text-matn-xira truncate mt-0.5">
                                                                {p.date.split('-').reverse().join('.')}
                                                                {hisob ? ' · balansdan yechildi' : (p.description ? ` · ${p.description}` : ' · balansga tushdi')}
                                                                {p.editedAt && <span className="text-ogoh"> · tahrirlangan</span>}
                                                            </p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className={`num text-[13px] font-bold ${p.amount < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                {p.amount > 0 ? '+' : p.amount < 0 ? '−' : ''}{Math.abs(p.amount).toLocaleString('ru-RU')}
                                                            </p>
                                                            <p className={`num text-[10px] font-bold mt-0.5 ${keyin < 0 ? 'text-xato' : 'text-matn-xira'}`} title="Shu yozuvdan keyingi balans">
                                                                balans {keyin.toLocaleString('ru-RU')}
                                                            </p>
                                                        </div>
                                                        {tahrir ? (
                                                            <button onClick={tahrir}
                                                                title={hisob ? 'Kurs hisobi' : "To'lovni tahrirlash"}
                                                                className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-matn-xira hover:text-brand hover:bg-brand/10 transition-colors cursor-pointer">
                                                                <Edit size={13} />
                                                            </button>
                                                        ) : <span className="w-7 shrink-0" />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                );
                            })()}

                            {activeTab === 'yoqlama' && (
                                <div className="animate-in fade-in duration-300 space-y-6">
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

                            {/* Umumiy — belgilar, o'qish, shaxsiy (ilgari chap ustunda
                                ustma-ust turib, sahifani juda uzaytirardi). */}
                            {activeTab === 'umumiy' && (
                                <div className="animate-in fade-in duration-300 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6">
                                        <div className="min-w-0">
                                    <h3 className="text-[12px] font-semibold text-matn pb-2 mb-1 border-b border-chiziq-mayin">Belgilar</h3>
                    {/* Face ID. Alohida rasm ham, tugma ham yo'q: belgi profil
                                        rasmidan o'zi olinadi. Bu qator faqat natijani aytadi. */}
                                    <div className="flex items-center justify-between gap-3 py-1.5"
                                        title={faceState === 'yuzYoq'
                                            ? "Face ID belgisi profil rasmidan olinmadi — " + faceFailText(faceFail)
                                            : "Yuz belgisi profil rasmidan avtomatik olinadi"}>
                                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-matn-xira shrink-0">
                                            <ScanFace className="w-3.5 h-3.5" />
                                            Face ID
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className={"text-[12px] font-semibold " + (
                                                faceState === 'tayyor' ? 'text-emerald-600 dark:text-emerald-400'
                                                    : faceState === 'yuzYoq' ? 'text-amber-500'
                                                        : 'text-matn-xira')}>
                                                {faceState === 'tayyor' ? 'Tayyor'
                                                    : faceState === 'yuzYoq'
                                                        ? (faceFail === 'rasm' ? "Rasm ochilmadi"
                                                            : faceFail === 'kop' ? "Rasmda bir nechta yuz bor"
                                                                : "Rasmda yuz aniqlanmadi")
                                                        : faceState === 'rasmYoq' ? "Rasm yo'q"
                                                            : 'Tekshirilmoqda…'}
                                            </span>
                                            {faceState === 'yuzYoq' && (
                                                <button onClick={retryFace} title="Belgini qaytadan hisoblash"
                                                    className="text-[11px] font-bold text-brand hover:underline cursor-pointer">
                                                    Qayta urinish
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {/* Transport va imtihon belgilari — shu yerning o'zida
                                        almashtiriladi (egasi, 2026-09-22), formani ochish
                                        shart emas. Doimiy marshrutlar yo'q: reja har kuni
                                        Logistikada tuziladi, shuning uchun pastda bugungi
                                        reja ham ko'rsatiladi. */}
                                    <SwitchRow
                                        icon={<Bus className="w-3.5 h-3.5" />}
                                        label={t('transport')}
                                        on={!!student.needsTransport}
                                        onLabel="Kerak"
                                        offLabel="Kerak emas"
                                        busy={belgiSaqlanmoqda === 'transport'}
                                        onToggle={v => belgiOzgartir('transport', v)}
                                    />
                                    {(() => {
                                        const bugun = toDateStr();
                                        const oqMarshrutlari = (routes || []).filter(r => r.date === bugun && (r.studentIds || []).includes(student.id));
                                        if (oqMarshrutlari.length === 0) {
                                            return student.needsTransport
                                                ? <p className="text-[10px] font-bold text-matn-xira text-right -mt-1 mb-1.5">bugun rejada yo'q</p>
                                                : null;
                                        }
                                        return (
                                            <div className="text-right -mt-1 mb-1.5 space-y-0.5">
                                                {oqMarshrutlari.map(r => (
                                                    <span key={r.id} className="block text-[10px] font-bold text-matn-2">
                                                        Bugun: {r.name}
                                                        <span className="text-matn-xira font-bold">
                                                            {r.transport?.number ? ` · ${r.transport.number}` : ''}
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                    <SwitchRow
                                        icon={<GraduationCap className="w-3.5 h-3.5" />}
                                        label="Imtihon"
                                        on={student.attendsExam !== false}
                                        onLabel="Keladi"
                                        offLabel="Kelmaydi"
                                        busy={belgiSaqlanmoqda === 'imtihon'}
                                        onToggle={v => belgiOzgartir('imtihon', v)}
                                    />
                                        </div>
                                        <div className="min-w-0">
                                    <h3 className="text-[12px] font-semibold text-matn pb-2 mb-1 border-b border-chiziq-mayin">O'qish</h3>
                                    {student.studyGoal && (
                                        <InfoRow icon={<Target className="w-3.5 h-3.5" />} label="Maqsad" value={student.studyGoal} />
                                    )}
                                    {studentDirection && (
                                        <InfoRow icon={<Compass className="w-3.5 h-3.5" />} label="Yo'nalish"
                                            value={studentDirection.name + (studentDirection.subjects ? ` (${studentDirection.subjects})` : '')} />
                                    )}
                                    {student.orgType && (
                                        <InfoRow icon={<BookOpen className="w-3.5 h-3.5" />} label="Muassasa turi" value={student.orgType} />
                                    )}
                                    {student.grade && (
                                        <InfoRow icon={<GraduationCap className="w-3.5 h-3.5" />} label={gradeLabel(student.orgType)} value={student.grade} />
                                    )}
                                    <InfoRow icon={<BookOpen className="w-3.5 h-3.5" />} label="Muassasa nomi" value={student.studentSchool || "-"} />
                                    <InfoRow icon={<Clock className="w-3.5 h-3.5" />} label={t('registered_at')} value={student.joinedDate} />

                                        </div>
                                        <div className="min-w-0">
                                    <h3 className="text-[12px] font-semibold text-matn pb-2 mb-1 border-b border-chiziq-mayin">Shaxsiy</h3>
                                    <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label={t('birth_date')} value={student.birthDate} />
                                    <InfoRow icon={<Users className="w-3.5 h-3.5" />} label="Jins" value={student.gender === 'Ayol' ? '♀ Ayol' : '♂ Erkak'} />
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
                                        </div>
                                    </div>
                                    <div className="space-y-3 max-w-xl">
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
                                        className="w-full mt-4 pt-3 border-t border-chiziq-mayin flex items-center justify-center gap-1.5 py-2 text-matn-xira hover:text-xato text-[11px] font-semibold transition-colors cursor-pointer"
                                    >
                                        <XCircle size={13} />
                                        {t('delete_student')}
                                    </button>
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
            {showPaymeModal && (
                <PaymeLinkModal studentId={student.id} onClose={() => setShowPaymeModal(false)} />
            )}
            {moveMode && (
                <StudentMoveModal studentId={student.id} mode={moveMode} fromGroup={moveFrom} onClose={() => { setMoveMode(null); setMoveFrom(undefined); }} />
            )}
            {showScoreModal && (
                <div className="fixed inset-0 z-[200] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
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
                <GroupAddModal studentId={student.id} schoolId={student.schoolId} trial={student.status === 'Sinov'} currentGroups={student.groups || []} availableGroups={groups}
                    onClose={() => setShowGroupModal(false)}
                    onAdd={async (groupId: number, sana: string, summa?: number) => {
                        await addStudentToGroup(groupId, student.id, sana, summa);
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

            {isLocationViewOpen && student.location && (
                <StudentLocationMap
                    studentName={student.name}
                    studentPhoto={student.photo}
                    location={student.location}
                    centerLocation={settings?.centerLocation}
                    orgName={settings?.orgName}
                    logo={settings?.logo}
                    onClose={() => setIsLocationViewOpen(false)}
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
                <div className="fixed inset-0 z-[250] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
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

            {/* Balans taqsimoti — shu o'quvchi uchun: teng (standart) yoki foizda. */}
            {taqsimOyna && (() => {
                const kurslar = studentGroups;
                const jami = kurslar.reduce((s, g) => s + (Number(taqsimFoiz[String(g.id)]) || 0), 0);
                const variantlar: { v: 'teng' | 'foiz'; label: string; izoh: string }[] = [
                    { v: 'teng', label: 'Teng — avtomatik', izoh: "Balansdagi pul kurslarga teng bo'linadi. Yetmasa har kursda teng qarz qoladi" },
                    { v: 'foiz', label: "Foizda — o'zim belgilayman", izoh: 'Masalan 50% / 50% yoki 70% / 30%' },
                ];
                const saqlash = async () => {
                    if (taqsimQoidaVal === 'foiz' && Math.abs(jami - 100) > 0.01) {
                        showNotification("Foizlar yig'indisi 100 bo'lishi kerak", 'error');
                        return;
                    }
                    const payShare = taqsimQoidaVal === 'foiz'
                        ? { rule: 'foiz' as const, weights: Object.fromEntries(kurslar.map(g => [String(g.id), Number(taqsimFoiz[String(g.id)]) || 0])) }
                        : null;
                    setTaqsimSaqlanmoqda(true);
                    try {
                        await updateStudent(student.id, { payShare } as any);
                        setTaqsimOyna(false);
                    } finally {
                        setTaqsimSaqlanmoqda(false);
                    }
                };
                return (
                    <div className="fixed inset-0 z-[250] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
                        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setTaqsimOyna(false)} />
                        <div className="relative bg-sirt w-full max-w-md rounded-[2rem] p-8 shadow-2xl border border-chiziq">
                            <div className="flex items-center justify-between mb-5 pb-4 border-b border-chiziq-mayin/50">
                                <div>
                                    <h3 className="text-sm font-black text-matn tracking-tight">Balans taqsimoti</h3>
                                    <p className="text-[11px] font-bold text-brand mt-0.5">{displayName(student.name)} · {kurslar.length} ta kurs</p>
                                </div>
                                <button aria-label="Yopish" onClick={() => setTaqsimOyna(false)} className="w-8 h-8 flex items-center justify-center text-matn-xira hover:bg-ichki rounded-xl cursor-pointer"><X size={18} /></button>
                            </div>
                            <p className="text-[11px] font-bold text-matn-xira leading-relaxed mb-4">
                                Pul doim balansga tushadi. Har oy kurslarning hisobi balansdan shu
                                taqsimot bo'yicha yechiladi — avval qarz yopiladi, qolgani balansda turadi.
                            </p>
                            <div className="space-y-2">
                                {variantlar.map(o => (
                                    <button key={o.v} type="button" onClick={() => setTaqsimQoidaVal(o.v)}
                                        className={`w-full text-left px-4 py-3 rounded-2xl border transition-all cursor-pointer ${
                                            taqsimQoidaVal === o.v ? 'bg-brand/10 border-brand text-brand' : 'bg-ichki border-chiziq text-matn-xira hover:border-brand/40'
                                        }`}>
                                        <span className="block text-xs font-black">{taqsimQoidaVal === o.v ? '✓ ' : ''}{o.label}</span>
                                        <span className="block text-[10px] font-bold opacity-70 mt-0.5">{o.izoh}</span>
                                    </button>
                                ))}
                            </div>

                            {taqsimQoidaVal === 'foiz' && (
                                <div className="mt-4 space-y-2">
                                    {kurslar.map(g => (
                                        <div key={g.id} className="flex items-center justify-between gap-3 p-3 bg-ichki rounded-2xl border border-chiziq/80">
                                            <span className="text-[12px] font-bold text-matn truncate">{g.name}</span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <input type="number" min={0} max={100}
                                                    value={taqsimFoiz[String(g.id)] ?? ''}
                                                    onChange={e => setTaqsimFoiz(prev => ({ ...prev, [String(g.id)]: e.target.value }))}
                                                    className="w-20 px-3 py-2 bg-sirt border border-chiziq rounded-xl text-xs font-bold text-matn text-right tabular-nums outline-none focus:border-brand" />
                                                <span className="text-[11px] font-bold text-matn-xira">%</span>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between pt-1">
                                        <button type="button"
                                            onClick={() => {
                                                const f: Record<string, string> = {};
                                                let qolgan = 100;
                                                kurslar.forEach((g, i) => {
                                                    const v = i === kurslar.length - 1 ? qolgan : Math.round(100 / kurslar.length);
                                                    f[String(g.id)] = String(v); qolgan -= v;
                                                });
                                                setTaqsimFoiz(f);
                                            }}
                                            className="px-2.5 py-1.5 text-[10px] font-bold border border-chiziq text-matn-sokin rounded-lg hover:border-brand hover:text-brand transition-colors cursor-pointer">
                                            Teng qilish
                                        </button>
                                        <span className={`num text-[12px] font-black ${Math.abs(jami - 100) <= 0.01 ? 'text-yaxshi' : 'text-xato'}`}>
                                            Jami: {jami}%
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 pt-5">
                                <button type="button" onClick={() => setTaqsimOyna(false)}
                                    className="flex-1 py-3 bg-ichki hover:bg-gray-100 dark:hover:bg-gray-800 text-matn-xira rounded-xl text-[11px] font-bold transition-all cursor-pointer">
                                    Bekor
                                </button>
                                <button type="button" onClick={saqlash}
                                    disabled={taqsimSaqlanmoqda || (taqsimQoidaVal === 'foiz' && Math.abs(jami - 100) > 0.01)}
                                    className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer">
                                    {taqsimSaqlanmoqda ? 'Saqlanmoqda…' : 'Saqlash'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {editingStart && student && (
                <KursHisobModal
                    studentId={student.id}
                    schoolId={student.schoolId}
                    groupId={editingStart.groupId}
                    groupName={editingStart.name}
                    current={editingStart.current}
                    onClose={() => setEditingStart(null)}
                />
            )}

            {/* To'lovni tahrirlash: resepshn 10 daqiqa ichida, admin doim. */}
            {editingPayment && (
                <PaymentEditModal
                    payment={editingPayment}
                    onClose={() => setEditingPayment(null)}
                    onSaved={() => retryLoad()}
                />
            )}

        </div>
    );
}


function PaymentAddModal({ studentId, onClose, onAdd }: { studentId: number; onClose: () => void; onAdd: (data: any) => void }) {
    const { students, groups, courses, payments, settings, showNotification, user: crmUser } = useCRM();
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('Naqd');
    // Payme orqali: havola/QR — pul Payme'dan webhook bilan o'zi tushadi, qo'lda yozilmaydi.
    const [showPayme, setShowPayme] = useState(false);
    const paymeOn = (settings.paymeMode === 'live' || settings.paymeMode === 'test') && ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'SUPERADMIN'].includes(crmUser?.role || '');
    const [createdPaymentForReceipt, setCreatedPaymentForReceipt] = useState<any>(null);

    const student = students.find(s => s.id === studentId);

    /** O'quvchining kurslari — pul qaysi kurslarga yechilishini ko'rsatish uchun. */
    const studentCourses = groups.filter(g => (g.studentIds || []).includes(studentId));
    const kopKurs = studentCourses.length > 1;
    const qoidaYozuvi = qoidaMatni(amaldagiQoida(student?.payShare), id => groups.find(g => g.id === id)?.name || ('#' + id));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const sana = new Date().toISOString().split('T')[0];
        // Pul faqat balansga (egasi, 2026-09-23): kursga bog'lanmaydi, kurslarning
        // hisobi balansdan o'quvchining taqsimoti bo'yicha yopiladi.
        const created = await onAdd({
            studentId, amount: Number(amount), type,
            groupId: null, courseId: null,
            date: sana, description: '',
        });
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
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-chiziq" onClick={e => e.stopPropagation()}>

                {createdPaymentForReceipt ? (
                    <div className="p-8 space-y-6">
                        <div className="text-center space-y-1">
                            {settings?.logo && (
                                <img src={settings.logo} alt="" className="w-14 h-14 object-contain mx-auto mb-2" />
                            )}
                            <h3 className="text-sm font-black text-brand">{settings?.orgName || "O'QUV MARKAZI"}</h3>
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
                                {createdPaymentForReceipt.courseId && (
                                    <div className="flex justify-between text-[13px]">
                                        <span className="font-bold">Kurs uchun:</span>
                                        <span className="font-black text-right">
                                            {courses.find(c => c.id === createdPaymentForReceipt.courseId)?.name || ''}
                                        </span>
                                    </div>
                                )}
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

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => printReceipt({
                                    payment: createdPaymentForReceipt,
                                    student,
                                    orgName: settings?.orgName,
                                    logo: settings?.logo,
                                    address: settings?.address,
                                    adminPhone: settings?.adminPhone,
                                    courseName: createdPaymentForReceipt.courseId
                                        ? (courses.find(c => c.id === createdPaymentForReceipt.courseId)?.name || null)
                                        : null,
                                    groupLines: groups
                                        .filter(g => (g.studentIds || []).includes(studentId))
                                        .map(g => {
                                            const cn = courses.find(c => c.id === g.courseId)?.name || '';
                                            return g.name + (cn ? ' (' + cn + ')' : '');
                                        })
                                })}
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

                            {/* Pul doim balansga tushadi: avval qarz yopiladi, qolgani balansda. */}
                            <p className="text-[11px] font-bold text-matn-xira leading-relaxed bg-ichki/50 border border-chiziq rounded-2xl px-4 py-3">
                                Pul <span className="text-matn">balansga</span> tushadi — avval qarz yopiladi, qolgani balansda turadi.
                                {kopKurs && <> Kurslarga: <span className="text-brand">{qoidaYozuvi}</span>.</>}
                            </p>

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
                                {paymeOn && (
                                    <button type="button" onClick={() => setShowPayme(true)}
                                        className="mt-2 w-full py-2.5 rounded-xl text-xs font-bold border border-dashed border-brand/60 text-brand hover:bg-brand hover:text-white transition-all cursor-pointer">
                                        💳 Payme — havola / QR (to'lov Payme'dan o'zi tushadi)
                                    </button>
                                )}
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
            {showPayme && <PaymeLinkModal studentId={studentId} onClose={() => setShowPayme(false)} />}
        </div>
    );
}

function GroupAddModal({ studentId, schoolId, trial, currentGroups, availableGroups, onClose, onAdd }: any) {
    const options = availableGroups.filter((g: any) => !currentGroups.includes(g.id));
    // 1-qadam: kurs tanlanadi; 2-qadam: kelgan sana va birinchi oy summasi
    // (tizim hisoblaydi, xodim o'zgartirishi mumkin).
    const [tanlangan, setTanlangan] = useState<any>(null);
    const [sana, setSana] = useState(toDateStr());
    const [summa, setSumma] = useState<number | undefined>(undefined);
    const [saqlanmoqda, setSaqlanmoqda] = useState(false);
    return (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-sirt w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-chiziq" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex items-center justify-between border-b border-chiziq bg-ichki">
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-matn tracking-tight">Kursga Qo'shish</h3>
                        <p className="text-[11px] font-bold text-matn-xira mt-0.5 truncate">{tanlangan ? tanlangan.name : 'Yangi kurs tanlash'}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-matn-xira hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer"><XCircle size={18} /></button>
                </div>
                {tanlangan ? (
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold text-matn-xira mb-2">Kursga kelgan sana</label>
                            <input type="date" value={sana} onChange={e => { setSana(e.target.value); setSumma(undefined); }}
                                className="w-full px-4 py-3 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-matn focus:border-brand outline-none transition-all" />
                        </div>
                        <div className="p-3 bg-ichki/50 border border-chiziq rounded-2xl">
                            <BirinchiOyInput groupId={tanlangan.id} schoolId={schoolId} startDate={sana} studentId={studentId}
                                value={summa} onChange={setSumma} trial={trial} />
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setTanlangan(null)}
                                className="flex-1 py-3 bg-ichki hover:bg-gray-100 dark:hover:bg-gray-800 text-matn-xira rounded-xl text-[11px] font-bold transition-all cursor-pointer">
                                Orqaga
                            </button>
                            <button type="button" disabled={saqlanmoqda || !sana}
                                onClick={async () => {
                                    setSaqlanmoqda(true);
                                    try { await onAdd(tanlangan.id, sana, summa); onClose(); } finally { setSaqlanmoqda(false); }
                                }}
                                className="flex-1 py-3 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer">
                                {saqlanmoqda ? 'Qo\'shilmoqda…' : 'Qo\'shish'}
                            </button>
                        </div>
                    </div>
                ) : (
                <div className="p-4 max-h-[350px] overflow-y-auto space-y-2 custom-scrollbar">
                    {options.length === 0 ? (
                        <p className="text-center py-8 text-[11px] text-matn-xira font-bold">Barcha kurslarga a'zo</p>
                    ) : (
                        options.map((g: any) => (
                            <button key={g.id} onClick={() => { setTanlangan(g); setSumma(undefined); }}
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
                )}
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
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
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
        <div className="fixed inset-0 z-[110] flex items-start sm:items-center-safe justify-center overflow-y-auto p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
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
/**
 * Ha/yo'q belgisi — kartochkaning o'zida almashtiriladi (transport kerakmi,
 * imtihonga keladimi). Saqlanayotganda tugma o'chiriladi: ketma-ket bosilsa
 * ikki so'rov bir-birini bosib ketardi.
 */
function SwitchRow({ icon, label, on, onLabel, offLabel, busy, onToggle }: {
    icon?: React.ReactNode;
    label: string;
    on: boolean;
    onLabel: string;
    offLabel: string;
    busy?: boolean;
    onToggle: (value: boolean) => void;
}) {
    // Server javobi bir necha soniya kelishi mumkin. Shu vaqtda tugma yangi
    // holatini ko'rsatib turadi (va bosilmaydi) — aks holda xodim "bosilmadi"
    // deb ikkinchi marta bosardi va belgi o'z holiga qaytib qolardi.
    const [kutilmoqda, setKutilmoqda] = useState<boolean | null>(null);
    useEffect(() => { if (!busy) setKutilmoqda(null); }, [busy]);
    const korinish = kutilmoqda ?? on;

    return (
        <div className="flex items-center justify-between gap-3 py-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-matn-xira shrink-0">
                {icon && <span className="text-matn-xira shrink-0">{icon}</span>}
                {label}
            </span>
            <button
                type="button"
                disabled={busy}
                onClick={() => { setKutilmoqda(!korinish); onToggle(!korinish); }}
                title={`${label}: ${korinish ? onLabel : offLabel} — o'zgartirish uchun bosing`}
                className={`flex items-center gap-1.5 text-[12px] font-semibold transition-colors cursor-pointer disabled:cursor-wait ${
                    busy ? 'opacity-60' : ''
                } ${korinish ? 'text-brand hover:text-brand-dark' : 'text-matn-xira hover:text-matn-2'}`}
            >
                <span>{korinish ? onLabel : offLabel}</span>
                {korinish ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
            </button>
        </div>
    );
}

/** +998870765800 → +998 87 076 58 00 (boshqa ko'rinishdagi raqam o'zgarmaydi). */
function telKorsat(tel: string) {
    const d = tel.replace(/[^0-9]/g, '');
    if (d.length === 12 && d.startsWith('998')) {
        return '+998 ' + d.slice(3, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8, 10) + ' ' + d.slice(10);
    }
    return tel;
}

/** Aloqa bo'limidagi bitta odam: kim · ismi | telefon · Telegram holati. */
function KontaktQator({ icon, label, name, phone, tgId, onSms, onUzish }: {
    icon: React.ReactNode;
    label: string;
    name?: string | null;
    phone?: string | null;
    tgId?: string | null;
    onSms?: () => void;
    onUzish: () => void;
}) {
    return (
        <div className="flex items-start justify-between gap-3 py-1.5">
            <div className="flex items-start gap-1.5 min-w-0">
                <span className="text-matn-xira shrink-0 mt-px">{icon}</span>
                {/* Ism telefon bilan bir qatorda, "Ota/Ona" esa ostida — TG holati
                    bilan bir qatorda (kontaktlar ro'yxatidagi kabi). */}
                <div className="min-w-0">
                    <p className="text-[12px] font-medium text-matn truncate" title={name || label}>{name || label}</p>
                    {name && <p className="text-[10px] font-bold text-matn-xira">{label}</p>}
                </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className="flex items-center gap-1">
                    <span className="text-[12px] font-medium text-matn tabular-nums">{phone ? telKorsat(phone) : '—'}</span>
                    {onSms && (
                        <button onClick={onSms} title="SMS yuborish" className="p-0.5 text-brand hover:bg-brand/10 rounded transition-colors cursor-pointer">
                            <Sparkles size={11} />
                        </button>
                    )}
                </span>
                {tgId ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold">
                        <span className="text-emerald-600 dark:text-emerald-400" title={'Telegram ID: ' + tgId}>● TG ulangan</span>
                        <button onClick={onUzish} title="Telegramni uzish" className="text-matn-xira hover:text-rose-500 transition-colors cursor-pointer">uzish</button>
                    </span>
                ) : (
                    <span className="text-[10px] font-bold text-matn-xira">○ TG ulanmagan</span>
                )}
            </div>
        </div>
    );
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-3 py-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-matn-xira shrink-0">
                {icon && <span className="text-matn-xira shrink-0">{icon}</span>}
                {label}
            </span>
            <span className="text-[12px] font-medium text-matn text-right tabular-nums line-clamp-2 break-words min-w-0" title={value}>
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
