import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, Phone, CheckCircle2, ChevronRight, User, BookOpen, Clock, MessageSquare, Calendar, MapPin, GraduationCap, Image as ImageIcon } from 'lucide-react';
import PhotoCapture from './PhotoCapture';
import { compressImage } from '../lib/image';

interface Course {
    id: number;
    name: string;
}

interface SchoolInfo {
    id: number;
    name: string;
    orgName: string;
    logo: string | null;
}

export default function PublicApply() {
    const { schoolId } = useParams<{ schoolId: string }>();
    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: '',
        phone: '',
        birthDate: '',
        studentSchool: '',
        fatherName: '',
        fatherPhone: '',
        motherName: '',
        motherPhone: '',
        address: '',
        course: '',
        notes: '',
        photo: ''
    });

    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');

    useEffect(() => {
        if (!schoolId) return;

        // If they already submitted successfully in this session/browser, bypass API checks
        if (token && localStorage.getItem(`submitted_apply_success_${token}`)) {
            setSubmitted(true);
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);

                if (!token) {
                    throw new Error('Ro\'yxatdan o\'tish havolasi eskirgan yoki muddati tugagan.');
                }

                // Verify the single-use token
                const tokenRes = await fetch(`/api/public/tokens/${token}`);
                const tokenData = await tokenRes.json();
                if (!tokenData.valid || tokenData.schoolId !== parseInt(schoolId)) {
                    throw new Error('Ro\'yxatdan o\'tish havolasi eskirgan yoki noto\'g\'ri.');
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
                    source: `Bir martalik QR Havola`,
                    token: token
                })
            });
            if (res.ok) {
                setSubmitted(true);
                if (token) {
                    localStorage.setItem(`submitted_apply_success_${token}`, 'true');
                }
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
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ma'lumotlar yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    if (error || !schoolInfo) {
        return (
            <div className="min-h-screen bg-gradient-to-tr from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 p-8 text-center shadow-lg">
                    <div className="w-14 h-14 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100 dark:border-red-900/40">
                        <Building2 size={24} />
                    </div>
                    <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Xatolik</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">{error || 'Filial topilmadi'}</p>
                </div>
            </div>
        );
    }

    const inp = "w-full pl-10 pr-4 py-3.5 bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700/50 rounded-2xl text-xs font-bold text-gray-950 dark:text-white focus:border-[var(--brand-color,#1b6b6b)] focus:ring-4 focus:ring-[var(--brand-color,#1b6b6b)]/10 outline-none transition-all";
    const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";
    const secTitle = "block text-[10px] font-black uppercase text-[#1b6b6b] tracking-widest border-b border-dashed border-gray-150 dark:border-gray-750 pb-2 mb-4 mt-6 first:mt-0";

    return (
        <div className="min-h-screen bg-gradient-to-tr from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-4 py-12">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700/50 shadow-xl overflow-hidden transition-all">
                {/* School Header */}
                <div className="bg-gradient-to-tr from-[var(--brand-color,#1b6b6b)] to-[var(--brand-color,#1b6b6b)]/80 p-8 text-white relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                            {schoolInfo.logo ? (
                                <img src={schoolInfo.logo} alt="logo" className="w-full h-full object-cover rounded-2xl" />
                            ) : (
                                <Building2 size={22} />
                            )}
                        </div>
                        <div className="text-left">
                            <h1 className="text-md font-black uppercase tracking-tight leading-tight">{schoolInfo.orgName}</h1>
                            <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-1">Online ariza topshirish</p>
                        </div>
                    </div>
                </div>

                {/* Form or Success Screen */}
                <div className="p-8">
                    {submitted ? (
                        <div className="text-center py-8 animate-in fade-in zoom-in duration-500">
                            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
                                <CheckCircle2 size={40} className="animate-bounce" />
                            </div>
                            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-2">Arizangiz qabul qilindi!</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                                Tez orada administratorlarimiz siz bilan bog'lanishadi va guruhga qo'shishadi.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-500 text-left">
                            
                            {/* SECTION 1: STUDENT */}
                            <span className={secTitle}>O'quvchi ma'lumotlari</span>
                            
                            <div>
                                <label className={lbl}>Ism-sharifingiz *</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
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
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
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
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
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
                            </div>

                            <div>
                                <label className={lbl}>Maktab / Bog'cha</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
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

                            <div>
                                <label className={lbl}>O'quvchi rasmi</label>
                                <div className="flex items-center gap-4 mt-2">
                                    <div className="w-20 h-20 rounded-2xl bg-gray-55 dark:bg-gray-900 border border-gray-100 dark:border-gray-700/55 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                        {form.photo ? <img src={form.photo} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-gray-300" />}
                                    </div>
                                    <div className="flex-1 space-y-2 text-left">
                                        <div className="flex gap-2">
                                            <label className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-150 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 text-[10px] font-bold uppercase tracking-wider text-gray-500">
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
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-150 dark:border-gray-700 rounded-xl hover:bg-gray-55 dark:hover:bg-gray-900 text-[10px] font-bold uppercase tracking-wider text-gray-500 cursor-pointer">
                                                Kamera
                                            </button>
                                        </div>
                                        {form.photo && (
                                            <button type="button" onClick={() => setForm({ ...form, photo: '' })}
                                                className="w-full py-1.5 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/40 text-[9px] font-black uppercase tracking-wider cursor-pointer">
                                                Rasmni o'chirish
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: PARENTS */}
                            <span className={secTitle}>Ota-ona ma'lumotlari</span>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>Otasining ismi</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
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
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
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
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
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
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
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
                                <label className={lbl}>Qaysi kursda o'qimoqchisiz? *</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                        <BookOpen size={15} />
                                    </div>
                                    <select
                                        required
                                        className={`${inp} appearance-none cursor-pointer`}
                                        value={form.course}
                                        onChange={e => setForm({ ...form, course: e.target.value })}
                                    >
                                        <option value="">Kursni tanlang</option>
                                        {courses.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={lbl}>Yashash manzilingiz</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
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

                            <div>
                                <label className={lbl}>Savollaringiz yoki qo'shimcha izohlar</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 pt-3.5 flex items-start pointer-events-none text-gray-400">
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
                                className="w-full mt-4 py-4 bg-gradient-to-tr from-[var(--brand-color,#1b6b6b)] to-[var(--brand-color,#1b6b6b)]/95 hover:shadow-lg hover:shadow-[var(--brand-color,#1b6b6b)]/20 active:scale-[0.98] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
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
