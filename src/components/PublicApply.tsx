import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, Phone, CheckCircle2, ChevronRight, User, BookOpen, Clock, MessageSquare, Calendar, MapPin, GraduationCap, Image as ImageIcon, Plus, Trash2, Target, Compass, Bus, Award } from 'lucide-react';
import PhotoCapture from './PhotoCapture';
import { compressImage } from '../lib/image';
import { STUDY_GOALS, UZB_REGIONS, ORG_TYPES, PRIVILEGES } from '../lib/studentFields';

interface Course {
    id: number;
    name: string;
}

interface PublicGroup {
    id: number;
    name: string;
    schedule: string;
    days: string;
    courseId: number;
    courseName: string;
    price: number | null;
    teacherName: string;
    studentCount: number;
    capacity: number | null;
}

const DAY_LABELS: Record<string, string> = {
    TOQ: 'Toq kunlar',
    JUFT: 'Juft kunlar',
    HAR_KUNI: 'Har kuni',
};

interface SchoolInfo {
    id: number;
    name: string;
    orgName: string;
    logo: string | null;
}

interface Certificate {
    category: 'Milliy' | 'Xalqaro';
    subject?: string;
    type?: string;
    score?: string;
}

interface PublicDirection {
    id: number;
    name: string;
    subjects?: string | null;
}

interface PublicTransport {
    id: number;
    name: string;
}

export default function PublicApply() {
    const { schoolId } = useParams<{ schoolId: string }>();
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [groups, setGroups] = useState<PublicGroup[]>([]);
    const [directions, setDirections] = useState<PublicDirection[]>([]);
    const [transports, setTransports] = useState<PublicTransport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: '',
        phone: '',
        birthDate: '',
        gender: 'Erkak' as 'Erkak' | 'Ayol',
        studentSchool: '',
        fatherName: '',
        fatherPhone: '',
        motherName: '',
        motherPhone: '',
        address: '',
        course: '',
        groupId: '' as number | '',
        notes: '',
        photo: '',
        // CRM dagi "o'quvchi qo'shish" oynasidagi maydonlar. Ilgari ariza
        // formasi ulardan yarmini so'ramasdi va xodim har bir arizadan keyin
        // qolganini qo'lda to'ldirib chiqardi.
        orgType: '',
        region: '',
        district: '',
        studyGoal: '',
        directionId: '' as number | '',
        transportId: '' as number | '',
        privileges: [] as string[],
        certificates: [] as Certificate[]
    });

    const addCertificate = () => {
        setForm(prev => ({
            ...prev,
            certificates: [...prev.certificates, { category: 'Milliy', subject: 'Matematika', score: '' }]
        }));
    };

    const removeCertificate = (index: number) => {
        setForm(prev => ({
            ...prev,
            certificates: prev.certificates.filter((_, i) => i !== index)
        }));
    };

    const updateCertificate = (index: number, key: keyof Certificate, value: string) => {
        setForm(prev => {
            const updated = [...prev.certificates];
            updated[index] = {
                ...updated[index],
                [key]: value
            };
            if (key === 'category') {
                if (value === 'Milliy') {
                    updated[index].subject = 'Matematika';
                    delete updated[index].type;
                } else {
                    updated[index].type = 'IELTS';
                    delete updated[index].subject;
                }
            }
            return { ...prev, certificates: updated };
        });
    };

    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');
    // QR havolasidagi token 30 daqiqada eskiradi. Ilgari eskirgan token
    // sahifani butunlay to'sib qo'yardi va ota-ona faqat "havola eskirgan"
    // degan yozuvni ko'rardi. Tokensiz havola baribir ochiq, ya'ni to'siqning
    // himoya sifatida foydasi yo'q edi — endi eskirgan token shunchaki
    // e'tiborga olinmaydi va oddiy forma ochiladi.
    const [tokenAmal, setTokenAmal] = useState<string | null>(token);

    useEffect(() => {
        if (!schoolId) return;

        // Ilgari bu yerda localStorage tekshirilar va bir marta ariza bergan
        // qurilmada forma boshqa ochilmasdi. Ikki muammo bor edi: bitta oiladan
        // ikkinchi bolani yozdirib bo'lmasdi (yoki resepshndagi bitta planshetdan
        // umuman bir kishi), ustiga ma'lumot yuklanmagani uchun ekranda
        // "Arizangiz qabul qilindi" emas, "Xatolik — Filial topilmadi" chiqardi.
        // Takroriy arizadan server himoya qiladi: so'rov cheklovi va bir xil
        // ism-telefon uchun tekshiruv bor.
        const fetchData = async () => {
            try {
                setLoading(true);

                // Token is optional — permanent links work without token
                if (token) {
                    const tokenRes = await fetch(`/api/public/tokens/${token}`);
                    const tokenData = await tokenRes.json().catch(() => ({ valid: false }));
                    if (!tokenData.valid || tokenData.schoolId !== parseInt(schoolId)) {
                        setTokenAmal(null);
                    }
                }

                // Fetch School Info
                const infoRes = await fetch(`/api/public/schools/${schoolId}/info`);
                if (!infoRes.ok) throw new Error('Filial topilmadi yoki xato yuz berdi');
                const infoData = await infoRes.json();
                setSchoolInfo(infoData);

                // Fetch School Courses
                const coursesRes = await fetch(`/api/public/schools/${schoolId}/courses`);
                if (coursesRes.ok) {
                    const coursesData = await coursesRes.json();
                    setCourses(coursesData);
                }

                // Hozir ochiq guruhlar — ariza beruvchi jadvalga qarab tanlaydi.
                const groupsRes = await fetch(`/api/public/schools/${schoolId}/groups`);
                if (groupsRes.ok) {
                    setGroups(await groupsRes.json());
                }

                // Yo'nalish va transport ro'yxatlari markazda sozlanadi —
                // shuning uchun formaga qattiq yozilmaydi.
                const dirRes = await fetch(`/api/public/schools/${schoolId}/directions`);
                if (dirRes.ok) setDirections(await dirRes.json());
                const trRes = await fetch(`/api/public/schools/${schoolId}/transports`);
                if (trRes.ok) setTransports(await trRes.json());
            } catch (err: any) {
                setError(err.message || 'Xatolik yuz berdi');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [schoolId, token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.phone) return;
        
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/public/schools/${schoolId}/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    source: tokenAmal ? 'QR havola' : 'Onlayn havola',
                    token: tokenAmal
                })
            });
            if (res.ok) {
                setSubmitted(true);
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'Yuborishda xatolik yuz berdi. Iltimos qaytadan urining.');
            }
        } catch (err) {
            console.error(err);
            alert('Aloqa muammosi yuz berdi.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-tr from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-[3px] border-[var(--brand-color,#1b6b6b)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[11px] font-bold text-matn-xira uppercase tracking-wider">Ma'lumotlar yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    if (error || !schoolInfo) {
        return (
            <div className="min-h-screen bg-gradient-to-tr from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-sirt rounded-[2rem] border border-chiziq p-8 text-center shadow-lg">
                    <div className="w-14 h-14 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 dark:border-red-900/40">
                        <Building2 size={24} />
                    </div>
                    <h2 className="text-sm font-black text-matn">Xatolik</h2>
                    <p className="text-[11px] font-bold text-matn-xira uppercase tracking-wider mt-2">{error || 'Filial topilmadi'}</p>
                </div>
            </div>
        );
    }

    // Markazda "kurs" deb aynan guruh tushuniladi: CRM dagi "Kurslar" bo'limi
    // ham guruhlarni ko'rsatadi. Shuning uchun ariza beruvchiga ham o'sha
    // ro'yxatning o'zi beriladi — ilgari avval kurs turkumi (Matematika),
    // keyin alohida guruh so'ralardi va ro'yxat markazdagidan farq qilardi.
    const applyGroups = groups;
    const selectedGroup = applyGroups.find(g => g.id === form.groupId) || null;
    // Tanlash uchun birorta guruh yoki kurs bormi.
    const kursTanlovi = applyGroups.length > 0 || courses.length > 0;

    const inp = "w-full pl-10 pr-4 py-3.5 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-gray-950 dark:text-white focus:border-[var(--brand-color,#1b6b6b)] focus:ring-4 focus:ring-[var(--brand-color,#1b6b6b)]/10 outline-none transition-all";
    // Ikonkasiz maydonlar uchun - chapdagi bo'sh joy kerak emas.
    const sel = "w-full px-4 py-3.5 bg-ichki border border-chiziq rounded-2xl text-xs font-bold text-gray-950 dark:text-white focus:border-[var(--brand-color,#1b6b6b)] focus:ring-4 focus:ring-[var(--brand-color,#1b6b6b)]/10 outline-none transition-all cursor-pointer";
    const lbl = "block text-[11px] font-extrabold uppercase tracking-wider text-matn-xira mb-2";
    const secTitle = "block text-[11px] font-bold uppercase text-brand tracking-wider border-b border-dashed border-gray-150 dark:border-gray-750 pb-2 mb-4 mt-6 first:mt-0";

    return (
        <div className="min-h-screen bg-gradient-to-tr from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-4 py-12">
            <div className="max-w-md w-full bg-sirt rounded-[2.5rem] border border-chiziq shadow-xl overflow-hidden transition-all">
                {/* School Header */}
                <div className="bg-gradient-to-tr from-[var(--brand-color,#1b6b6b)] to-[var(--brand-color,#1b6b6b)]/80 p-8 text-white relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
                            schoolInfo.logo ? 'bg-white border-white/40' : 'bg-white/10 backdrop-blur-md border-white/20'
                        }`}>
                            {schoolInfo.logo ? (
                                <img src={schoolInfo.logo} alt="logo" className="w-full h-full object-contain p-1.5 rounded-2xl" />
                            ) : (
                                <Building2 size={22} />
                            )}
                        </div>
                        <div className="text-left">
                            <h1 className="text-md font-black uppercase tracking-tight leading-tight">{schoolInfo.orgName}</h1>
                            <p className="text-[11px] font-bold text-white/70 uppercase tracking-wider mt-1">Online ariza topshirish</p>
                        </div>
                    </div>
                </div>

                {/* Form or Success Screen */}
                <div className="p-8">
                    {submitted ? (
                        <div className="text-center py-8 animate-in fade-in zoom-in duration-500">
                            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
                                <CheckCircle2 size={40} className="animate-bounce" />
                            </div>
                            <h2 className="text-sm font-black text-matn mb-2">Arizangiz qabul qilindi!</h2>
                            <p className="text-[11px] font-bold text-matn-xira uppercase tracking-wider leading-relaxed">
                                Tez orada administratorlarimiz siz bilan bog'lanishadi va kursga qo'shishadi.
                            </p>
                            {/* Bir oilada ikki bola bo'lishi mumkin, resepshnda esa
                                bitta planshetdan ketma-ket ariza qabul qilinadi. */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSubmitted(false);
                                    setForm(prev => ({
                                        ...prev,
                                        name: '', phone: '', birthDate: '', studentSchool: '',
                                        address: '', notes: '', photo: '', certificates: [],
                                        studyGoal: '', directionId: '', privileges: [],
                                    }));
                                    window.scrollTo(0, 0);
                                }}
                                className="mt-6 text-[11px] font-black uppercase tracking-wider text-[var(--brand-color,#1b6b6b)] hover:underline cursor-pointer">
                                Yana ariza topshirish
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-500 text-left">
                            
                            {/* SECTION 1: STUDENT */}
                            <span className={secTitle}>O'quvchi ma'lumotlari</span>
                            
                            <div>
                                <label className={lbl}>Ism-sharifingiz *</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-matn-xira">
                                        <User size={15} />
                                    </div>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Jasur Alimov"
                                        className={inp}
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>Telefon raqamingiz *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-matn-xira">
                                            <Phone size={15} />
                                        </div>
                                        <input
                                            required
                                            type="text"
                                            placeholder="+998 (90) 123-45-67"
                                            className={inp}
                                            value={form.phone}
                                            onChange={e => setForm({ ...form, phone: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={lbl}>Tug'ilgan sana</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-matn-xira">
                                            <Calendar size={15} />
                                        </div>
                                        <input
                                            type="date"
                                            className={inp}
                                            value={form.birthDate}
                                            onChange={e => setForm({ ...form, birthDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={lbl}>Jins</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['Erkak', 'Ayol'] as const).map(g => (
                                            <button key={g} type="button"
                                                onClick={() => setForm({ ...form, gender: g })}
                                                className={`py-3 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${form.gender === g ? 'bg-brand border-brand text-white shadow' : 'bg-gray-50 border-gray-200 text-matn-xira hover:text-gray-600'}`}>
                                                {g === 'Erkak' ? '♂ Erkak' : '♀ Ayol'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>Ta'lim muassasasi turi</label>
                                    <select
                                        className={sel}
                                        value={form.orgType}
                                        onChange={e => setForm({ ...form, orgType: e.target.value })}
                                    >
                                        <option value="">Tanlang...</option>
                                        {ORG_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>Muassasa nomi</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-matn-xira">
                                            <GraduationCap size={15} />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="42-maktab"
                                            className={inp}
                                            value={form.studentSchool}
                                            onChange={e => setForm({ ...form, studentSchool: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Maqsad va yo'nalish - CRM dagi o'quvchi qo'shish oynasida
                                ham xuddi shu ikkita maydon bor. Yo'nalishlar ro'yxatini
                                markaz o'zi sozlaydi, shuning uchun bo'sh bo'lsa maydon
                                umuman ko'rsatilmaydi. */}
                            <div className={directions.length > 0 ? 'grid grid-cols-2 gap-4' : ''}>
                                <div>
                                    <label className={lbl}>Maqsadingiz</label>
                                    <select
                                        className={sel}
                                        value={form.studyGoal}
                                        onChange={e => setForm({ ...form, studyGoal: e.target.value })}
                                    >
                                        <option value="">Tanlang...</option>
                                        {STUDY_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                {directions.length > 0 && (
                                    <div>
                                        <label className={lbl}>Yo'nalish</label>
                                        <select
                                            className={sel}
                                            value={form.directionId}
                                            onChange={e => setForm({ ...form, directionId: e.target.value ? Number(e.target.value) : '' })}
                                        >
                                            <option value="">Tanlang...</option>
                                            {directions.map(d => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name}{d.subjects ? ' (' + d.subjects + ')' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>Viloyat</label>
                                    <select
                                        className={sel}
                                        value={form.region}
                                        onChange={e => setForm({ ...form, region: e.target.value, district: '' })}
                                    >
                                        <option value="">Tanlang...</option>
                                        {Object.keys(UZB_REGIONS).map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lbl}>Tuman</label>
                                    <select
                                        className={sel}
                                        disabled={!form.region}
                                        value={form.district}
                                        onChange={e => setForm({ ...form, district: e.target.value })}
                                    >
                                        <option value="">Tanlang...</option>
                                        {form.region && UZB_REGIONS[form.region]?.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Imtiyozlar. "Sertifikat" belgilansa pastdagi sertifikat
                                bo'limi allaqachon bor - server ham sertifikat qo'shilsa
                                imtiyozni o'zi qo'shadi. */}
                            <div>
                                <label className={lbl}>Imtiyozingiz bormi?</label>
                                <div className="flex flex-wrap gap-2">
                                    {PRIVILEGES.map(priv => {
                                        const checked = form.privileges.includes(priv);
                                        return (
                                            <button
                                                key={priv}
                                                type="button"
                                                onClick={() => setForm({
                                                    ...form,
                                                    privileges: checked
                                                        ? form.privileges.filter(p => p !== priv)
                                                        : [...form.privileges, priv],
                                                })}
                                                className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                                                    checked
                                                        ? 'bg-[var(--brand-color,#1b6b6b)] text-white border-[var(--brand-color,#1b6b6b)]'
                                                        : 'bg-transparent text-matn-xira border-chiziq hover:border-[var(--brand-color,#1b6b6b)]'
                                                }`}
                                            >
                                                {checked ? '\u2713 ' : ''}{priv}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className={lbl}>O'quvchi rasmi</label>
                                <div className="flex items-center gap-4 mt-2">
                                    <div className="w-20 h-20 rounded-2xl bg-ichki border border-chiziq/55 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                        {form.photo ? <img src={form.photo} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-gray-300" />}
                                    </div>
                                    <div className="flex-1 space-y-2 text-left">
                                        <div className="flex gap-2">
                                            <label className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-chiziq rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 text-[11px] font-bold uppercase tracking-wider text-matn-sokin">
                                                <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = async () => {
                                                            const compressed = await compressImage(reader.result as string);
                                                            setForm({ ...form, photo: compressed });
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} />
                                                Fayldan
                                            </label>
                                            <button type="button" onClick={() => setIsPhotoModalOpen(true)}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-chiziq rounded-xl hover:bg-gray-55 dark:hover:bg-gray-900 text-[11px] font-bold uppercase tracking-wider text-matn-sokin cursor-pointer">
                                                Kamera
                                            </button>
                                        </div>
                                        {form.photo && (
                                            <button type="button" onClick={() => setForm({ ...form, photo: '' })}
                                                className="w-full py-1.5 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/40 text-[11px] font-bold uppercase tracking-wider cursor-pointer">
                                                Rasmni o'chirish
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* SECTION: CERTIFICATES */}
                            <span className={secTitle}>Sertifikatlar</span>
                            
                            <div className="space-y-3">
                                {form.certificates.map((cert, index) => (
                                    <div key={index} className="p-4 bg-ichki rounded-2xl border border-gray-100 dark:border-gray-750/50 space-y-3 relative animate-in fade-in slide-in-from-top-2 duration-250">
                                        <button 
                                            type="button" 
                                            onClick={() => removeCertificate(index)}
                                            className="absolute top-3 right-3 text-matn-xira hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        
                                        <div>
                                            <label className={lbl}>Sertifikat toifasi</label>
                                            <select
                                                value={cert.category}
                                                onChange={e => updateCertificate(index, 'category', e.target.value as any)}
                                                className="w-full px-3 py-2 bg-sirt border border-gray-150 dark:border-gray-750 rounded-xl text-xs font-bold text-matn outline-none focus:border-[var(--brand-color,#1b6b6b)]"
                                            >
                                                <option value="Milliy">Milliy sertifikat</option>
                                                <option value="Xalqaro">Xalqaro sertifikat</option>
                                            </select>
                                        </div>

                                        {cert.category === 'Milliy' && (
                                            <div>
                                                <label className={lbl}>Sertifikat fani</label>
                                                <select
                                                    value={cert.subject || ''}
                                                    onChange={e => updateCertificate(index, 'subject', e.target.value)}
                                                    className="w-full px-3 py-2 bg-sirt border border-gray-150 dark:border-gray-750 rounded-xl text-xs font-bold text-matn outline-none focus:border-[var(--brand-color,#1b6b6b)]"
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
                                                <label className={lbl}>Sertifikat turi</label>
                                                <select
                                                    value={cert.type || ''}
                                                    onChange={e => updateCertificate(index, 'type', e.target.value)}
                                                    className="w-full px-3 py-2 bg-sirt border border-gray-150 dark:border-gray-750 rounded-xl text-xs font-bold text-matn outline-none focus:border-[var(--brand-color,#1b6b6b)]"
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
                                            <label className={lbl}>Ball / Foiz</label>
                                            <input
                                                type="text"
                                                placeholder={cert.category === 'Xalqaro' ? 'Misol: 7.5 yoki 1450' : 'Misol: 94.8%'}
                                                value={cert.score || ''}
                                                onChange={e => updateCertificate(index, 'score', e.target.value)}
                                                className="w-full px-3 py-2 bg-sirt border border-gray-150 dark:border-gray-750 rounded-xl text-xs font-bold text-matn outline-none focus:border-[var(--brand-color,#1b6b6b)]"
                                            />
                                        </div>
                                    </div>
                                ))}
                                
                                <button
                                    type="button"
                                    onClick={addCertificate}
                                    className="w-full py-3 bg-ichki border border-dashed border-gray-200 dark:border-gray-750 rounded-2xl text-[11px] font-bold uppercase tracking-wider text-brand hover:bg-teal-50/10 dark:hover:bg-teal-900/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <Plus size={14} />
                                    Sertifikat qo'shish
                                </button>
                            </div>

                            {/* SECTION 2: PARENTS */}
                            <span className={secTitle}>Ota-ona ma'lumotlari</span>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>Otasining ismi</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-matn-xira">
                                            <User size={15} />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="FISH"
                                            className={inp}
                                            value={form.fatherName}
                                            onChange={e => setForm({ ...form, fatherName: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={lbl}>Otasining telefoni</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-matn-xira">
                                            <Phone size={15} />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="+998"
                                            className={inp}
                                            value={form.fatherPhone}
                                            onChange={e => setForm({ ...form, fatherPhone: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>Onasining ismi</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-matn-xira">
                                            <User size={15} />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="FISH"
                                            className={inp}
                                            value={form.motherName}
                                            onChange={e => setForm({ ...form, motherName: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={lbl}>Onasining telefoni</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-matn-xira">
                                            <Phone size={15} />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="+998"
                                            className={inp}
                                            value={form.motherPhone}
                                            onChange={e => setForm({ ...form, motherPhone: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: OTHER INFO */}
                            <span className={secTitle}>Kurs va manzil</span>

                            <div>
                                <label className={lbl}>
                                    Qaysi kursda o'qimoqchisiz?{kursTanlovi ? ' *' : ''}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-matn-xira">
                                        <BookOpen size={15} />
                                    </div>
                                    {/* Yangi ochilgan filialda hali birorta guruh ham, kurs ham
                                        bo'lmasligi mumkin. O'shanda ro'yxat bo'sh, maydon esa
                                        majburiy bo'lib qolar va ariza umuman yuborilmasdi.
                                        Bunday holatda oddiy matn maydoni beriladi. */}
                                    {!kursTanlovi ? (
                                        <input
                                            type="text"
                                            className={inp}
                                            placeholder="Masalan: Ingliz tili"
                                            value={form.course}
                                            onChange={e => setForm({ ...form, course: e.target.value, groupId: '' })}
                                        />
                                    ) : (
                                    <select
                                        required
                                        className={`${inp} appearance-none cursor-pointer`}
                                        value={applyGroups.length ? form.groupId : form.course}
                                        onChange={e => {
                                            if (!applyGroups.length) {
                                                // Markazda hali birorta kurs ochilmagan bo'lsa ariza
                                                // berib bo'lmay qolmasin: turkum nomi bo'yicha olamiz.
                                                setForm({ ...form, course: e.target.value, groupId: '' });
                                                return;
                                            }
                                            const g = applyGroups.find(x => String(x.id) === e.target.value);
                                            setForm({ ...form, groupId: g ? g.id : '', course: g ? g.courseName : '' });
                                        }}
                                    >
                                        <option value="">Kursni tanlang</option>
                                        {applyGroups.length
                                            ? applyGroups.map(g => (
                                                <option key={g.id} value={g.id}>
                                                    {[g.name,
                                                      DAY_LABELS[g.days] || (g.days === 'Belgilanmagan' ? '' : g.days),
                                                      g.schedule && !String(g.schedule).includes('Belgilanmagan') ? g.schedule : '',
                                                      g.price ? g.price.toLocaleString('ru-RU') + " so'm/oy" : '',
                                                    ].filter(Boolean).join(' — ')}
                                                </option>
                                            ))
                                            : courses.map(c => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                    </select>
                                    )}
                                </div>
                                {!kursTanlovi && (
                                    <p className="text-[11px] font-bold text-matn-xira mt-2">
                                        Bu filialda hozircha guruhlar ochilmagan — qiziqqan yo'nalishingizni yozib qoldiring.
                                    </p>
                                )}
                                {selectedGroup && (
                                    <p className="text-[11px] font-bold text-matn-xira mt-2">
                                        {[selectedGroup.teacherName && 'Ustoz: ' + selectedGroup.teacherName,
                                          selectedGroup.capacity !== null
                                            ? (selectedGroup.studentCount >= selectedGroup.capacity
                                                ? "Guruh to'lgan"
                                                : (selectedGroup.capacity - selectedGroup.studentCount) + ' ta joy bor')
                                            : '',
                                        ].filter(Boolean).join(' · ')}
                                    </p>
                                )}
                            </div>


                            <div>
                                <label className={lbl}>Yashash manzilingiz</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-matn-xira">
                                        <MapPin size={15} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Sariosiyo"
                                        className={inp}
                                        value={form.address}
                                        onChange={e => setForm({ ...form, address: e.target.value })}
                                    />
                                </div>
                            </div>

                            {transports.length > 0 && (
                                <div>
                                    <label className={lbl}>Transport kerakmi?</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-matn-xira">
                                            <Bus size={15} />
                                        </div>
                                        <select
                                            className={`${inp} appearance-none cursor-pointer`}
                                            value={form.transportId}
                                            onChange={e => setForm({ ...form, transportId: e.target.value ? Number(e.target.value) : '' })}
                                        >
                                            <option value="">Kerak emas</option>
                                            {transports.map(tr => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className={lbl}>Savollaringiz yoki qo'shimcha izohlar</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 pt-3.5 flex items-start pointer-events-none text-matn-xira">
                                        <MessageSquare size={15} />
                                    </div>
                                    <textarea
                                        rows={3}
                                        placeholder="Markaz haqida qayerdan eshitdingiz yoki boshqa izohingiz..."
                                        className={`${inp} pl-10 pt-3 resize-none`}
                                        value={form.notes}
                                        onChange={e => setForm({ ...form, notes: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full mt-4 py-4 bg-gradient-to-tr from-[var(--brand-color,#1b6b6b)] to-[var(--brand-color,#1b6b6b)]/95 hover:shadow-lg hover:shadow-[var(--brand-color,#1b6b6b)]/20 active:scale-[0.98] text-white rounded-2xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? "Yuborilmoqda..." : "Ro'yxatdan o'tish"}
                                <ChevronRight size={14} />
                            </button>
                        </form>
                    )}
                </div>
            </div>
            {isPhotoModalOpen && (
                <PhotoCapture
                    onCapture={async (photo) => {
                        const compressed = await compressImage(photo);
                        setForm({ ...form, photo: compressed });
                    }}
                    onClose={() => setIsPhotoModalOpen(false)}
                />
            )}
        </div>
    );
}
