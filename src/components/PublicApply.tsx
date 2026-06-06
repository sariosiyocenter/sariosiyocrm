import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, Phone, CheckCircle2, ChevronRight, User, BookOpen, Clock, MessageSquare } from 'lucide-react';

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
        course: '',
        preferredTime: 'Ertalab',
        notes: ''
    });

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
                    name: form.name,
                    phone: form.phone,
                    course: form.course || 'Kurs tanlanmagan',
                    source: `Bir martalik QR Havola - Vaqt: ${form.preferredTime}${form.notes ? ` / Izoh: ${form.notes}` : ''}`,
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

    const inp = "w-full pl-10 pr-4 py-3.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-900 dark:text-white focus:border-[var(--brand-color,#1b6b6b)] focus:ring-4 focus:ring-[var(--brand-color,#1b6b6b)]/10 outline-none transition-all";
    const lbl = "block text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2";

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
                        <div>
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
                        <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in duration-500">
                            {/* Name */}
                            <div>
                                <label className={lbl}>Ism-sharifingiz *</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                        <User size={15} />
                                    </div>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Toshmatov Toshmat"
                                        className={inp}
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Phone */}
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

                            {/* Course */}
                            <div>
                                <label className={lbl}>Qaysi kursda o'qimoqchisiz?</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                        <BookOpen size={15} />
                                    </div>
                                    <select
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

                            {/* Preferred Time */}
                            <div>
                                <label className={lbl}>Sizga qaysi vaqt qulay?</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                        <Clock size={15} />
                                    </div>
                                    <select
                                        className={`${inp} appearance-none cursor-pointer`}
                                        value={form.preferredTime}
                                        onChange={e => setForm({ ...form, preferredTime: e.target.value })}
                                    >
                                        <option value="Ertalab">Ertalab (09:00 - 13:00)</option>
                                        <option value="Tushdan keyin">Tushdan keyin (14:00 - 18:00)</option>
                                        <option value="Kechki payt">Kechki payt (18:00 - 21:00)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Notes */}
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
                                className="w-full mt-2 py-4 bg-gradient-to-tr from-[var(--brand-color,#1b6b6b)] to-[var(--brand-color,#1b6b6b)]/95 hover:shadow-lg hover:shadow-[var(--brand-color,#1b6b6b)]/20 active:scale-[0.98] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? "Yuborilmoqda..." : "Ro'yxatdan o'tish"}
                                <ChevronRight size={14} />
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
