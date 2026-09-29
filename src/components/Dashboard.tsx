import { useState, useMemo, useEffect } from 'react';
import { ArrowUpRight, ChevronRight, Truck, FileText } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { isCashIncome } from '../lib/money';
import { useLang } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { displayName } from '../lib/displayName';
import { isLessonDay, toDateStr, toTimeStr } from '../../lib/lessons.js';
import { jadvalVaqti, daqiqaga } from '../../lib/jadval.js';
import { kursUstozlari } from '../lib/teacherState';
import { useHisobKitob, qarzOylari } from '../lib/hisobKitob';
import { davrOraligi, davrNomi, davrOylari, type Davr } from '../lib/davr';

/**
 * Bosh sahifa — "bugun nima qilish kerak" va asosiy raqamlar (2026-09-30).
 *
 * Ilgari: "Tushum" hamma yozuvni qo'shib −69,6 mln ko'rsatardi, "Eng ko'p
 * tushum keltirgan kurslar" narx × o'quvchi edi, "30+ kun to'lov qilmagan"
 * 28.09 dan oldingi tarix o'chgani uchun deyarli hammani sanardi, pastda esa
 * Moliyani takrorlovchi "Hisobotlar Tizimi" (ROI, bo'sh doira) va xonalar
 * jadvali turardi. Endi:
 *   - to'rtta kartochka: o'quvchilar, tushum (usullar bo'yicha — Payme, Klik),
 *     oy hisobi qanchasi yopilgani, qarz (necha oylik);
 *   - "Bugun hal qilinsin" — bitta ro'yxat: Klik tasdig'i, "to'laganman"
 *     javoblari, o'tgan oydan qolgan qarz, davomat olinmagan darslar, lidlar;
 *   - bugungi darslar, logistika, so'nggi to'lovlar.
 * Hisobotlar — /reports sahifasida, xonalar jadvali — Kurslar → Xonalar.
 * Qarz va yopilgan hisob — src/lib/hisobKitob.ts (Moliya bilan bir xil).
 */

const USULLAR: { tur: string; nom: string; rang: string }[] = [
    { tur: 'Naqd', nom: 'Naqd', rang: 'bg-emerald-500' },
    { tur: 'Karta', nom: 'Karta', rang: 'bg-sky-500' },
    { tur: 'Klik', nom: 'Klik', rang: 'bg-blue-600' },
    { tur: 'Peyme', nom: 'Payme', rang: 'bg-teal-400' },
    { tur: "O'tkazma", nom: "O'tkazma", rang: 'bg-violet-500' },
];
const usulNomi = (tur: string) => USULLAR.find(u => u.tur === tur)?.nom || tur;

const OYLAR = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const OY_QISQA = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
const UZ_DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

const mln = (n: number) => (n / 1000000).toFixed(1).replace('.', ',');
const som = (n: number) => Math.round(n).toLocaleString('ru-RU');
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const DAVRLAR: { tur: Davr; nom: string }[] = [
    { tur: 'today', nom: 'Kun' },
    { tur: 'this_week', nom: 'Hafta' },
    { tur: 'this_month', nom: 'Shu oy' },
    { tur: 'last_30', nom: '30 kun' },
    { tur: 'this_year', nom: 'Shu yil' },
    { tur: 'all', nom: 'Barchasi' },
    { tur: 'custom', nom: 'Boshqa muddat' },
];

export default function Dashboard() {
    const { students, groups, teachers, leads, payments, rooms, attendances, user, kora, modulKorinadi, selectedSchoolId } = useCRM();
    // Lavozim ruxsati (Sozlamalar → Ruxsatlar): pul ko'rsatkichlari va hisobotlar alohida.
    const pulKorinadi = kora('bosh.pul');
    const hisobotKorinadi = kora('bosh.hisobot');
    const umumiyKorinadi = kora('bosh.korsatkich');
    const admin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
    const { t } = useLang();
    const navigate = useNavigate();

    // Hozirgi vaqt (O'zbekiston), daqiqada bir — "hozir ketyapti" belgisi uchun.
    const [nowTime, setNowTime] = useState(() => toTimeStr());
    useEffect(() => {
        const timer = setInterval(() => setNowTime(toTimeStr()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Davr — Toshkent vaqti bo'yicha (src/lib/davr.ts). Moliyadagi bilan bir xil.
    const [selectedPreset, setSelectedPreset] = useState<Davr>('this_month');
    const [startDate, setStartDate] = useState(() => davrOraligi('this_month').start);
    const [endDate, setEndDate] = useState(() => davrOraligi('this_month').end);
    const handlePreset = (tur: Davr) => {
        setSelectedPreset(tur);
        if (tur === 'custom') return;
        const { start, end } = davrOraligi(tur);
        setStartDate(start);
        setEndDate(end);
    };

    // ---- Serverdan: Klik tasdig'i, "to'laganman" javoblari, bugungi logistika.
    const [klik, setKlik] = useState<{ soni: number; jami: number; takror: number } | null>(null);
    const [javoblar, setJavoblar] = useState(0);
    const [logistika, setLogistika] = useState<any>(null);
    const javobKorinadi = kora('moliya.oylik') || kora('oquvchilar.tolov') || kora('xabarlar.avto');
    const logistikaKorinadi = modulKorinadi('logistika');
    useEffect(() => {
        if (!selectedSchoolId) return;
        let tirik = true;
        if (admin) {
            fetch(`/api/tolov-tasdiq?schoolId=${selectedSchoolId}&status=kutilmoqda`, { headers: auth() })
                .then(r => (r.ok ? r.json() : []))
                .then((rows: any[]) => {
                    if (!tirik || !Array.isArray(rows)) return;
                    setKlik({ soni: rows.length, jami: rows.reduce((s, q) => s + (q.amount || 0), 0), takror: rows.filter(q => q.takror?.length).length });
                }).catch(() => {});
        }
        if (javobKorinadi) {
            fetch(`/api/qarz-javob/soni?schoolId=${selectedSchoolId}`, { headers: auth() })
                .then(r => (r.ok ? r.json() : { ochiq: 0 }))
                .then(j => { if (tirik) setJavoblar(Number(j.ochiq) || 0); })
                .catch(() => {});
        }
        if (logistikaKorinadi) {
            fetch(`/api/logistics/day?schoolId=${selectedSchoolId}&date=${toDateStr()}`, { headers: auth() })
                .then(r => (r.ok ? r.json() : null))
                .then(d => { if (tirik) setLogistika(d); })
                .catch(() => {});
        }
        return () => { tirik = false; };
    }, [selectedSchoolId, admin, javobKorinadi, logistikaKorinadi]);

    // ---- Pul: tushum (usullar bo'yicha), davr oylari hisobi, qarz.
    const hisob = useHisobKitob(students, payments);
    const joriyOy = toDateStr().slice(0, 7);
    const pul = useMemo(() => {
        const davrda = (d?: string) => !!d && d >= startDate && d <= endDate;
        const kirim = payments.filter(p => isCashIncome(p) && davrda(p.date));
        const jami = kirim.reduce((s, p) => s + p.amount, 0);
        const usullar = USULLAR.map(u => ({ ...u, summa: kirim.filter(p => p.type === u.tur).reduce((s, p) => s + p.amount, 0) }));

        const oylar = davrOylari(startDate, endDate);
        const oySet = new Set(oylar);
        let hisoblangan = 0, yopilgan = 0;
        let qarz = 0, qarzdor = 0, eskirgan = 0, eskirganSumma = 0;
        for (const [, h] of hisob) {
            for (const b of h.chelaklar) {
                if (!oySet.has(b.month) || b.due <= 0) continue;
                hisoblangan += b.due;
                yopilgan += b.covered;
            }
            if (h.qarz > 0) {
                qarz += h.qarz;
                qarzdor++;
                const yosh = qarzOylari(h.engEskiOy, joriyOy) ?? 0;
                if (yosh >= 1) { eskirgan++; eskirganSumma += h.qarz; }
            }
        }
        return {
            jami, usullar, hisoblangan, yopilgan, qarz, qarzdor, eskirgan, eskirganSumma,
            hisobNomi: oylar.length === 1 ? `${OYLAR[Number(oylar[0].slice(5, 7)) - 1]} hisobi` : 'Davr oylari hisobi',
        };
    }, [payments, hisob, startDate, endDate, joriyOy]);
    const yopildi = pul.hisoblangan > 0 ? Math.round((pul.yopilgan / pul.hisoblangan) * 100) : null;

    // ---- O'quvchilar.
    const faolSoni = students.filter(s => s.status === 'Faol').length;
    const sinovSoni = students.filter(s => s.status === 'Sinov').length;
    const yangiSoni = students.filter(s => (s.joinedDate || '') >= startDate && (s.joinedDate || '') <= endDate).length;

    // ---- Oxirgi 6 oy tushumi (grafik).
    const oltiOy = useMemo(() => {
        const [y, m] = joriyOy.split('-').map(Number);
        return Array.from({ length: 6 }, (_, i) => {
            const d = new Date(Date.UTC(y, m - 1 - (5 - i), 1));
            const kalit = d.toISOString().slice(0, 7);
            const summa = payments.filter(p => isCashIncome(p) && (p.date || '').startsWith(kalit)).reduce((s, p) => s + p.amount, 0);
            return { kalit, nom: OY_QISQA[d.getUTCMonth()], summa };
        });
    }, [payments, joriyOy]);
    const oltiOyMax = Math.max(...oltiOy.map(o => o.summa), 1);

    // ---- Bugungi darslar (Toshkent sanasi). Jadvali kiritilmagan kurs
    // tushmaydi — dars bor deb taxmin qilinmaydi.
    const todayISO = toDateStr();
    const yesterdayISO = toDateStr(new Date(Date.now() - 86400000));
    const hozirDaq = daqiqaga(nowTime) ?? 0;
    const todayLessons = groups.filter(g => isLessonDay(g.days, todayISO)).map(g => {
        const sched = (g.schedule || '').trim();
        const room = rooms.find(r => r.id === g.room);
        const { boshi, oxiri } = jadvalVaqti(g.schedule);
        const boshDaq = daqiqaga(boshi);
        const oxirDaq = daqiqaga(oxiri);
        const holat = boshDaq === null || oxirDaq === null ? null
            : hozirDaq > oxirDaq ? 'tugadi'
            : hozirDaq >= boshDaq ? 'hozir' : 'keladi';
        return {
            id: g.id,
            name: g.name,
            time: sched && !sched.includes('Belgilanmagan') ? sched : null,
            teacher: teachers.find(tt => tt.id === g.teacherId) ? kursUstozlari(g, teachers, displayName) : null,
            room: room ? room.name : null,
            marked: (attendances || []).some(a => a.groupId === g.id && (a.date || '').slice(0, 10) === todayISO),
            holat,
            boshDaq,
            transport: (students || []).filter(st => (g.studentIds || []).includes(st.id) && st.needsTransport).length,
        };
    }).sort((a, b) => (a.boshDaq ?? 9999) - (b.boshDaq ?? 9999));
    const hozirKetayotgan = todayLessons.filter(l => l.holat === 'hozir').length;
    // Davomat kutilayotgan — boshlangan yoki tugagan, lekin belgilanmagan (hali
    // boshlanmagan dars "davomat yo'q" emas).
    const davomatsiz = todayLessons.filter(l => !l.marked && (l.holat === 'hozir' || l.holat === 'tugadi'));

    // ---- Lidlar: 2 kundan beri javobsiz.
    const openLeads = leads.filter(l => l.status !== "To'lov qildi" && l.status !== 'Kelishdi');
    const leadAge = (l: any) => {
        const d = new Date(l.createdAt);
        return isNaN(d.getTime()) ? null : Math.floor((Date.now() - d.getTime()) / 86400000);
    };
    const staleLeads = openLeads.filter(l => (leadAge(l) ?? 0) >= 2);
    const oldestLeadAge = staleLeads.reduce((m, l) => Math.max(m, leadAge(l) ?? 0), 0);

    // ---- Bugun hal qilinsin — bitta ro'yxat. Har qator o'sha ishni bajaradigan
    // sahifaga olib boradi; bo'sh bo'lsa blok chizilmaydi.
    const todoItems = [
        admin && klik && klik.soni > 0 && {
            key: 'klik', tone: 'bg-ogoh',
            title: `${klik.soni} ta Klik to'lovi tasdiqingizni kutmoqda`,
            sub: `Jami ${som(klik.jami)} so'm — tasdiqlanmaguncha balansga tushmaydi${klik.takror ? ` · ${klik.takror} tasida takror chek` : ''}`,
            path: '/finance',
        },
        javobKorinadi && javoblar > 0 && {
            key: 'javob', tone: 'bg-ogoh',
            title: `${javoblar} ta ota-ona «to'laganman» dedi`,
            sub: 'Qarz eslatmasiga javob — tekshirib, to\'lovni kiriting',
            path: modulKorinadi('xabarlar') ? '/messaging?tab=auto&qarzdorlar=1' : '/finance',
        },
        pulKorinadi && pul.eskirgan > 0 && {
            key: 'qarz', tone: 'bg-xato',
            title: `${pul.eskirgan} ta o'quvchining qarzi o'tgan oydan qolgan`,
            sub: `Jami ${mln(pul.eskirganSumma)} mln so'm`,
            path: '/students?filter=debt',
        },
        umumiyKorinadi && davomatsiz.length > 0 && {
            key: 'davomat', tone: 'bg-brand',
            title: `${davomatsiz.length} ta darsda davomat olinmagan`,
            sub: davomatsiz.slice(0, 3).map(l => l.name).join(', '),
            path: davomatsiz.length === 1 ? `/courses/${davomatsiz[0].id}` : '/daily',
        },
        kora('lidlar.royxat') && staleLeads.length > 0 && {
            key: 'leads', tone: 'bg-ogoh',
            title: `${staleLeads.length} ta lid javobsiz qolgan`,
            sub: `Eng qadimgisi — ${oldestLeadAge} kun oldin`,
            path: '/leads',
        },
    ].filter(Boolean) as { key: string; tone: string; title: string; sub: string; path: string }[];

    // ---- Logistika (bugun): reyslar va holati.
    const logistikaXulosa = useMemo(() => {
        const plans: any[] = logistika?.plans || [];
        if (!plans.length) return null;
        const bolalar = plans.reduce((s, p) => s + (p.stops?.length || 0), 0);
        const yolda = plans.filter(p => p.run?.startedAt && !p.run?.finishedAt).length;
        const tugadi = plans.filter(p => p.run?.finishedAt).length;
        return { reys: plans.length, bolalar, yolda, tugadi, kutmoqda: plans.length - yolda - tugadi };
    }, [logistika]);

    // ---- So'nggi to'lovlar (manfiy yozuvlar oylik hisob — to'lov emas).
    const uzDayLabel = (iso: string) => {
        const d = (iso || '').slice(0, 10);
        if (d === todayISO) return 'bugun';
        if (d === yesterdayISO) return 'kecha';
        return `${Number(d.slice(8, 10))}-${UZ_MONTHS[Number(d.slice(5, 7)) - 1] || ''}`;
    };
    const recentPayments = (payments || [])
        .filter(p => isCashIncome(p) && (p.date || '').slice(0, 10) <= todayISO)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id)
        .slice(0, 5)
        .map(p => {
            const st = students.find(x => x.id === p.studentId);
            return { id: p.id, studentId: p.studentId, name: st ? displayName(st.name) : "O'chirilgan o'quvchi", amount: p.amount, when: uzDayLabel(p.date), usul: usulNomi(p.type) };
        });

    const bugun = new Date(Date.parse(todayISO + 'T00:00:00Z'));
    const todayLabel = `${UZ_DAYS[bugun.getUTCDay()]}, ${bugun.getUTCDate()}-${UZ_MONTHS[bugun.getUTCMonth()]}`;
    const karta = 'bg-sirt rounded-xl border border-chiziq p-4 cursor-pointer hover:border-chiziq-kuchli transition-colors';

    // "Bugun hal qilinsin" — telefonda darslardan oldin (eng kerakli), katta ekranda o'ng ustunda.
    const todoBlok = todoItems.length > 0 ? (
        <div className="bg-sirt rounded-xl border border-chiziq overflow-hidden">
            <div className="px-4 pt-3.5 pb-3">
                <h3 className="text-[15px] font-semibold text-matn">Bugun hal qilinsin</h3>
            </div>
            {todoItems.map(item => (
                <button key={item.key} onClick={() => navigate(item.path)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-t border-chiziq-mayin hover:bg-ichki transition-colors cursor-pointer">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.tone}`} />
                    <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-matn truncate">{item.title}</p>
                        <p className="text-[11px] text-matn-xira truncate">{item.sub}</p>
                    </div>
                    <ChevronRight size={15} className="text-matn-xira shrink-0" />
                </button>
            ))}
        </div>
    ) : null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Sarlavha: salomlashuv, bugungi holat, davr almashtirgichi. */}
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div>
                    <h1 className="text-[26px] font-bold text-matn tracking-tight leading-tight">
                        Xush kelibsiz, {(user?.name || '').split(' ')[0] || t('dashboard_title')}
                    </h1>
                    <p className="text-[13px] text-matn-sokin mt-1">
                        {todayLabel}
                        {todoItems.length > 0 && <> · <span className="num">{todoItems.length}</span> ta ish e'tiboringizni kutmoqda</>}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 min-w-0 max-w-full">
                    <div className="flex items-center gap-1 bg-ichki p-1 rounded-xl border border-chiziq max-w-full overflow-x-auto no-scrollbar">
                        {DAVRLAR.map(d => (
                            <button key={d.tur} type="button" onClick={() => handlePreset(d.tur)}
                                className={`px-3 py-1.5 rounded-lg text-[12px] whitespace-nowrap shrink-0 transition-colors cursor-pointer ${selectedPreset === d.tur ? 'bg-brand text-brand-ust font-semibold' : 'text-matn-sokin hover:text-matn'}`}>
                                {d.nom}
                            </button>
                        ))}
                    </div>
                    {selectedPreset === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                className="num bg-ichki px-2.5 h-[30px] rounded-lg border border-chiziq-kuchli text-[12px] text-matn-2 outline-none focus:border-brand cursor-pointer" />
                            <span className="text-matn-xira text-[12px]">{t('date_to')}</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                className="num bg-ichki px-2.5 h-[30px] rounded-lg border border-chiziq-kuchli text-[12px] text-matn-2 outline-none focus:border-brand cursor-pointer" />
                        </div>
                    )}
                </div>
            </div>

            {/* To'rtta asosiy raqam. */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <div onClick={() => navigate('/students')} className={karta}>
                    <span className="text-[12px] text-matn-sokin">O'quvchilar</span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="raqam text-[27px] font-semibold leading-none text-matn">{faolSoni}</span>
                        <span className="text-[12px] text-matn-xira">faol</span>
                    </div>
                    <span className="text-[11px] text-matn-xira block mt-2.5">
                        {sinovSoni > 0 && <><span className="raqam text-ogoh">{sinovSoni}</span> sinovda · </>}
                        <span className="raqam text-yaxshi">+{yangiSoni}</span> yangi ({davrNomi(selectedPreset, startDate, endDate).toLowerCase()})
                    </span>
                </div>

                {pulKorinadi ? (
                    <>
                        <div onClick={() => navigate('/finance')} className={karta}>
                            <span className="text-[12px] text-matn-sokin">Tushum · {davrNomi(selectedPreset, startDate, endDate)}</span>
                            <div className="mt-1 flex items-baseline">
                                <span className="raqam text-[27px] font-semibold leading-none text-matn">{mln(pul.jami)}</span>
                                <span className="raqam text-[13px] text-matn-xira ml-1">mln</span>
                            </div>
                            {/* Usullar ulushi: naqd, karta, Klik, Payme … bitta chiziqda. */}
                            <div className="mt-2.5 h-1.5 rounded-full bg-chiziq overflow-hidden flex">
                                {pul.jami > 0 && pul.usullar.filter(u => u.summa > 0).map(u => (
                                    <div key={u.tur} className={`h-full ${u.rang}`} style={{ width: `${(u.summa / pul.jami) * 100}%` }} />
                                ))}
                            </div>
                            <span className="text-[11px] text-matn-xira block mt-1.5 truncate">
                                {pul.jami > 0
                                    ? pul.usullar.filter(u => u.summa > 0).map(u => `${u.nom} ${mln(u.summa)}`).join(' · ')
                                    : "bu davrda to'lov yo'q"}
                            </span>
                        </div>

                        <div onClick={() => navigate('/finance')} className={karta}>
                            <span className="text-[12px] text-matn-sokin">{pul.hisobNomi}</span>
                            <div className="mt-1 flex items-baseline">
                                <span className="raqam text-[27px] font-semibold leading-none text-matn">{yopildi ?? '—'}</span>
                                {yopildi !== null && <span className="raqam text-[13px] text-matn-xira ml-1">% yopildi</span>}
                            </div>
                            <div className="mt-2.5 h-1.5 rounded-full bg-chiziq overflow-hidden">
                                <div className={`h-full rounded-full ${yopildi !== null && yopildi >= 80 ? 'bg-yaxshi' : yopildi !== null && yopildi >= 50 ? 'bg-ogoh' : 'bg-xato'}`}
                                    style={{ width: `${yopildi ?? 0}%` }} />
                            </div>
                            <span className="text-[11px] text-matn-xira block mt-1.5 truncate">
                                {pul.hisoblangan > 0
                                    ? <>hisoblangan <span className="raqam">{mln(pul.hisoblangan)}</span> mln · qoldi <span className="raqam">{mln(pul.hisoblangan - pul.yopilgan)}</span></>
                                    : "bu oylarda hisob yo'q"}
                            </span>
                        </div>

                        <div onClick={() => navigate('/students?filter=debt')}
                            className="bg-xato-fon rounded-xl border border-xato-chiziq p-4 cursor-pointer hover:border-xato transition-colors">
                            <span className="text-[12px] text-matn-sokin">Qarzdorlik (hozir)</span>
                            <div className="mt-1 flex items-baseline">
                                <span className="raqam text-[27px] font-semibold leading-none text-xato">{mln(pul.qarz)}</span>
                                <span className="raqam text-[13px] text-matn-xira ml-1">mln</span>
                            </div>
                            <div className="mt-2.5 h-1.5 rounded-full bg-chiziq overflow-hidden flex">
                                {pul.qarzdor > 0 && (
                                    <>
                                        <div className="h-full bg-ogoh" style={{ width: `${((pul.qarzdor - pul.eskirgan) / pul.qarzdor) * 100}%` }} />
                                        <div className="h-full bg-xato" style={{ width: `${(pul.eskirgan / pul.qarzdor) * 100}%` }} />
                                    </>
                                )}
                            </div>
                            <span className="text-[11px] text-xato-mayin block mt-1.5 truncate">
                                <span className="raqam">{pul.qarzdor}</span> o'quvchi
                                {pul.eskirgan > 0 ? <> · <span className="raqam">{pul.eskirgan}</span> tasi o'tgan oydan</> : ' · hammasi shu oyniki'}
                            </span>
                        </div>
                    </>
                ) : (
                    <>
                        <div onClick={() => navigate('/daily')} className={karta}>
                            <span className="text-[12px] text-matn-sokin">Bugungi darslar</span>
                            <div className="mt-1 raqam text-[27px] font-semibold leading-none text-matn">{todayLessons.length}</div>
                            <span className="text-[11px] text-matn-xira block mt-2.5">
                                {hozirKetayotgan > 0 ? `${hozirKetayotgan} tasi hozir ketyapti` : 'bugungi jadval'}
                            </span>
                        </div>
                        <div onClick={() => navigate('/courses')} className={karta}>
                            <span className="text-[12px] text-matn-sokin">Kurslar</span>
                            <div className="mt-1 raqam text-[27px] font-semibold leading-none text-matn">{groups.length}</div>
                            <span className="text-[11px] text-matn-xira block mt-2.5">
                                <span className="raqam">{new Set(groups.flatMap(g => g.studentIds || [])).size}</span> ta o'quvchi o'qiydi
                            </span>
                        </div>
                    </>
                )}
            </div>

            <div className="xl:hidden">{todoBlok}</div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                {/* ---- CHAP USTUN ---- */}
                <div className="xl:col-span-2 space-y-4">
                    {umumiyKorinadi && (
                        <div className="bg-sirt rounded-xl border border-chiziq overflow-hidden">
                            <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-3">
                                <h3 className="text-[15px] font-semibold text-matn">Bugungi darslar</h3>
                                {todayLessons.length > 0 && (
                                    <span className="text-[12px] text-matn-sokin text-right">
                                        <span className="raqam">{todayLessons.length}</span> ta dars
                                        {hozirKetayotgan > 0 && <> · <span className="raqam text-yaxshi">{hozirKetayotgan}</span> tasi hozir</>}
                                        {davomatsiz.length > 0 && <> · <span className="raqam text-ogoh">{davomatsiz.length}</span> tasida davomat yo'q</>}
                                    </span>
                                )}
                            </div>
                            {todayLessons.length === 0 ? (
                                <div className="px-4 py-9 text-center border-t border-chiziq-mayin">
                                    <p className="text-[13px] text-matn-sokin">Bugunga dars belgilanmagan</p>
                                    <p className="text-[11px] text-matn-xira mt-1">Kursga kun va vaqt kiritilsa, bugungi darslar shu yerda chiqadi</p>
                                </div>
                            ) : todayLessons.map(l => {
                                const kutilmoqda = !l.marked && l.holat !== 'hozir' && l.holat !== 'tugadi';
                                return (
                                    <button key={l.id} onClick={() => navigate(`/courses/${l.id}`)}
                                        className="w-full flex items-center gap-3.5 px-4 py-3 text-left border-t border-chiziq-mayin hover:bg-ichki transition-colors cursor-pointer">
                                        <span className={`num text-[12px] w-[96px] shrink-0 ${l.time ? 'text-matn-2' : 'text-matn-xira'}`}>{l.time || 'vaqt yo’q'}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="text-[13px] text-matn block truncate">
                                                {l.name}
                                                {l.holat === 'hozir' && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yaxshi/15 text-yaxshi align-middle">hozir</span>}
                                                {l.holat === 'tugadi' && <span className="ml-2 text-[11px] text-matn-xira align-middle">tugadi</span>}
                                            </span>
                                            <span className="text-[11px] text-matn-xira block truncate">
                                                {[l.teacher, l.room].filter(Boolean).join(' · ') || 'ustoz va xona kiritilmagan'}
                                                {l.transport > 0 && <>{' · '}<span className="text-brand">{l.transport} bola transportda</span></>}
                                            </span>
                                        </span>
                                        <span className={`hidden sm:flex items-center gap-2 text-[12px] shrink-0 ${l.marked ? 'text-yaxshi' : kutilmoqda ? 'text-matn-xira' : 'text-ogoh'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${l.marked ? 'bg-yaxshi' : kutilmoqda ? 'bg-chiziq-kuchli' : 'bg-ogoh'}`} />
                                            {l.marked ? 'davomat olindi' : kutilmoqda ? 'hali boshlanmagan' : 'davomat olinmagan'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {pulKorinadi && (
                        <div className="bg-sirt rounded-xl border border-chiziq p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-[15px] font-semibold text-matn">Tushum</h3>
                                    <p className="text-[12px] text-matn-sokin mt-0.5">So'nggi 6 oy, mln so'm</p>
                                </div>
                                <button onClick={() => navigate('/finance')} className="flex items-center gap-1 text-[12px] text-brand hover:underline cursor-pointer shrink-0">
                                    Moliya <ArrowUpRight size={13} />
                                </button>
                            </div>
                            <div className="h-[140px] flex items-end gap-4">
                                {oltiOy.map(o => (
                                    <div key={o.kalit} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                                        <span className={`num text-[11px] ${o.kalit === joriyOy ? 'text-brand' : 'text-matn-xira'}`}>{mln(o.summa)}</span>
                                        <div className={`w-full rounded-t-md bg-brand min-h-[3px] ${o.kalit === joriyOy ? '' : 'opacity-40'}`}
                                            style={{ height: `${(o.summa / oltiOyMax) * 100}px` }} />
                                        <span className="text-[11px] text-matn-xira">{o.nom}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ---- O'NG USTUN ---- */}
                <div className="space-y-4">
                    <div className="hidden xl:block">{todoBlok}</div>

                    {logistikaKorinadi && logistikaXulosa && (
                        <button onClick={() => navigate('/logistics')}
                            className="w-full text-left bg-sirt rounded-xl border border-chiziq p-4 hover:border-chiziq-kuchli transition-colors cursor-pointer">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-[15px] font-semibold text-matn flex items-center gap-2"><Truck size={15} className="text-brand" /> Transport bugun</h3>
                                <ChevronRight size={15} className="text-matn-xira" />
                            </div>
                            <p className="text-[12px] text-matn-sokin mt-1.5">
                                <span className="raqam text-matn">{logistikaXulosa.reys}</span> reys · <span className="raqam text-matn">{logistikaXulosa.bolalar}</span> bola
                            </p>
                            <div className="grid grid-cols-3 gap-2 mt-3">
                                {[
                                    { nom: 'Kutmoqda', soni: logistikaXulosa.kutmoqda, rang: 'text-matn-2' },
                                    { nom: "Yo'lda", soni: logistikaXulosa.yolda, rang: 'text-ogoh' },
                                    { nom: 'Yetkazildi', soni: logistikaXulosa.tugadi, rang: 'text-yaxshi' },
                                ].map(x => (
                                    <div key={x.nom} className="rounded-lg bg-ichki px-2.5 py-2">
                                        <span className={`raqam text-[15px] font-semibold block ${x.rang}`}>{x.soni}</span>
                                        <span className="text-[10px] text-matn-xira">{x.nom}</span>
                                    </div>
                                ))}
                            </div>
                        </button>
                    )}

                    {pulKorinadi && (
                        <div className="bg-sirt rounded-xl border border-chiziq overflow-hidden">
                            <div className="flex items-baseline justify-between px-4 pt-3.5 pb-3">
                                <h3 className="text-[15px] font-semibold text-matn">So'nggi to'lovlar</h3>
                                <button onClick={() => navigate('/finance')} className="text-[12px] text-brand hover:underline cursor-pointer">Barchasi</button>
                            </div>
                            {recentPayments.length === 0 ? (
                                <div className="px-4 py-9 text-center border-t border-chiziq-mayin">
                                    <p className="text-[13px] text-matn-sokin">Hali to'lov qabul qilinmagan</p>
                                </div>
                            ) : recentPayments.map(p => (
                                <button key={p.id} onClick={() => navigate(`/students/${p.studentId}`)}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-t border-chiziq-mayin hover:bg-ichki transition-colors cursor-pointer">
                                    <span className="min-w-0 flex-1">
                                        <span className="text-[13px] text-matn block truncate">{p.name}</span>
                                        <span className="text-[11px] text-matn-xira block truncate">{p.when} · {p.usul}</span>
                                    </span>
                                    <span className="num text-[13px] text-yaxshi shrink-0">+{som(p.amount)}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {hisobotKorinadi && (
                        <button onClick={() => navigate('/reports')}
                            className="w-full flex items-center gap-3 bg-sirt rounded-xl border border-chiziq px-4 py-3.5 text-left hover:border-chiziq-kuchli transition-colors cursor-pointer">
                            <FileText size={16} className="text-brand shrink-0" />
                            <span className="min-w-0 flex-1">
                                <span className="text-[13px] text-matn block">Hisobotlar</span>
                                <span className="text-[11px] text-matn-xira block truncate">Lidlar · o'quvchilar · ketganlar · bitiruvchilar · xodimlar davomati</span>
                            </span>
                            <ChevronRight size={15} className="text-matn-xira shrink-0" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
