import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { isCashIncome } from '../lib/money';
import { useKursQarzlari } from '../lib/kursQarzi';
import { kursdaOqiydi } from '../../lib/oquvchiHolati.js';

/**
 * Moliya → Hisobotlar tepasidagi ko'rsatkichlar.
 *
 * Egasi (2026-09-29): "moliyada ko'rsatkichlar yo'q, misol payme va ko'p
 * narsa o'zi qilsa bo'ladida". Ilgari to'rtta katta raqam millionda edi
 * ("0,0 mln" — Payme'dan kelgan 5 000 so'm umuman ko'rinmasdi) va to'lov
 * usullari faqat kichik doira ichida edi. Endi:
 *   1. Tushum — har bir usul alohida: Naqd, Karta, Klik, Payme, O'tkazma.
 *   2. Hisob — shu davrda hisoblangan oylik, qanchasi yig'ildi, qarz, xarajat, foyda.
 *   3. O'quvchilar — faol, yangi, ketgan, to'lamagan.
 *   4. Kurslar bo'yicha — qaysi kursda qancha qarz.
 * Hammasi tanlangan davr (Kun / Hafta / Shu oy …) bo'yicha; "hozir" deb
 * yozilganlari — davrdan qat'iy nazar bugungi holat.
 */

// Bazadagi to'lov turlari. Payme yozuvlari tarixan "Peyme" deb saqlangan.
const USULLAR: { tur: string; nom: string; rang: string }[] = [
    { tur: 'Naqd', nom: 'Naqd', rang: 'bg-emerald-500' },
    { tur: 'Karta', nom: 'Karta', rang: 'bg-sky-500' },
    { tur: 'Klik', nom: 'Klik', rang: 'bg-blue-600' },
    { tur: 'Peyme', nom: 'Payme', rang: 'bg-teal-400' },
    { tur: "O'tkazma", nom: "O'tkazma", rang: 'bg-violet-500' },
];

const som = (n: number) => Math.round(n).toLocaleString('ru-RU');

function Korsatkich({ nom, qiymat, izoh, ton, ulush, ulushRang, onClick }: {
    nom: string;
    qiymat: string;
    izoh?: React.ReactNode;
    ton?: 'yaxshi' | 'xato' | 'brand';
    /** 0–100: tushumdagi ulushi kabi. */
    ulush?: number | null;
    ulushRang?: string;
    onClick?: () => void;
}) {
    const rang = ton === 'yaxshi' ? 'text-yaxshi' : ton === 'xato' ? 'text-xato' : ton === 'brand' ? 'text-brand' : 'text-matn';
    return (
        <div onClick={onClick}
            className={`rounded-xl border border-chiziq bg-sirt px-3.5 py-3 min-w-0 ${onClick ? 'cursor-pointer hover:border-chiziq-kuchli' : ''}`}>
            <span className="text-[12px] text-matn-sokin block truncate">{nom}</span>
            <span className={`raqam text-[20px] font-semibold leading-tight block mt-1 truncate ${rang}`} title={qiymat}>{qiymat}</span>
            {ulush != null && (
                <div className="mt-2 h-1 rounded-full bg-chiziq overflow-hidden">
                    <div className={`h-full rounded-full ${ulushRang || 'bg-brand'}`} style={{ width: `${Math.max(0, Math.min(100, ulush))}%` }} />
                </div>
            )}
            {izoh && <span className="text-[11px] text-matn-xira block mt-1.5 truncate">{izoh}</span>}
        </div>
    );
}

function Sarlavha({ children, izoh }: { children: React.ReactNode; izoh?: React.ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3 mb-2.5">
            <p className="text-[14px] font-semibold text-matn">{children}</p>
            {izoh && <span className="text-[12px] text-matn-xira truncate">{izoh}</span>}
        </div>
    );
}

export default function MoliyaKorsatkichlari({ startDate, endDate, dateLabel }: {
    startDate: string;
    endDate: string;
    dateLabel: string;
}) {
    const { payments, expenses, students, groups, courses, selectedSchoolId, token, kora } = useCRM();
    const navigate = useNavigate();

    // Kassadagi naqd — hozirgi holat (Kassa bo'limini ko'radiganga).
    const [kassa, setKassa] = useState<number | null>(null);
    const kassaKorinadi = kora('moliya.kassa');
    useEffect(() => {
        if (!kassaKorinadi || !token || selectedSchoolId === null || selectedSchoolId === undefined) { setKassa(null); return; }
        let bekor = false;
        fetch(`/api/kassa?schoolId=${selectedSchoolId}&days=7`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (!bekor) setKassa(d && typeof d.cashOnHand === 'number' ? d.cashOnHand : null); })
            .catch(() => { if (!bekor) setKassa(null); });
        return () => { bekor = true; };
    }, [kassaKorinadi, token, selectedSchoolId, payments.length, expenses.length]);

    const kursQarzlari = useKursQarzlari(students, payments);

    const m = useMemo(() => {
        const davrda = (d?: string) => !!d && d >= startDate && d <= endDate;

        // Oldingi teng davr — tushum o'zgarishini ko'rsatish uchun.
        const bosh = new Date(startDate), oxir = new Date(endDate);
        const kunlar = Math.round((oxir.getTime() - bosh.getTime()) / 86400000) + 1;
        const oldBosh = new Date(bosh.getTime() - kunlar * 86400000).toISOString().slice(0, 10);
        const oldOxir = new Date(bosh.getTime() - 86400000).toISOString().slice(0, 10);

        const kirimlar = payments.filter(isCashIncome);
        const davrKirim = kirimlar.filter(p => davrda(p.date));
        const jami = davrKirim.reduce((s, p) => s + p.amount, 0);
        const oldingi = kirimlar.filter(p => p.date >= oldBosh && p.date <= oldOxir).reduce((s, p) => s + p.amount, 0);
        const usullar = USULLAR.map(u => {
            const q = davrKirim.filter(p => p.type === u.tur);
            return { ...u, summa: q.reduce((s, p) => s + p.amount, 0), soni: q.length };
        });
        // Ro'yxatda yo'q tur (masalan eski "Online") bo'lsa ham jamiga kiradi.
        const boshqa = jami - usullar.reduce((s, u) => s + u.summa, 0);

        // Shu davrda hisoblangan oylik: "Oylik" yozuvlari (manfiy — hisob, musbat —
        // tuzatish) va chegirmalar. Yig'im — shu davrda kelgan pulning hisobga nisbati.
        const hisob = payments.filter(p => davrda(p.date) && (p.type === 'Oylik' || p.type === 'Chegirma'))
            .reduce((s, p) => s - p.amount, 0);

        const xarajat = expenses.filter(e => davrda(e.date)).reduce((s, e) => s + e.amount, 0);

        // Hozirgi holat.
        const qarzdorlar = students.filter(s => (s.balance || 0) < 0);
        const qarz = qarzdorlar.reduce((s, st) => s - (st.balance || 0), 0);
        const avans = students.reduce((s, st) => s + Math.max(0, st.balance || 0), 0);

        // O'quvchilar harakati.
        const faol = students.filter(s => s.status === 'Faol');
        const yangi = students.filter(s => davrda(s.joinedDate)).length;
        const ketgan = students.filter(s => !kursdaOqiydi(s.status) && davrda((s.statusChangedAt || '').slice(0, 10))).length;
        const tolaganlar = new Set(davrKirim.map(p => p.studentId));
        const kursdagilar = new Set(groups.flatMap(g => g.studentIds || []));
        const tolamagan = faol.filter(s => kursdagilar.has(s.id) && !tolaganlar.has(s.id)).length;

        // Kurslar bo'yicha: o'quvchi soni, shu davrda hisoblangan, hozirgi qarz.
        const kurslar = groups.map(g => {
            const ids = g.studentIds || [];
            const qarzi = ids.reduce((s, sid) => s + (kursQarzlari.get(sid)?.get(g.id) || 0), 0);
            const qarzdor = ids.filter(sid => (kursQarzlari.get(sid)?.get(g.id) || 0) > 0).length;
            const hisobi = payments.filter(p => p.groupId === g.id && davrda(p.date) && (p.type === 'Oylik' || p.type === 'Chegirma'))
                .reduce((s, p) => s - p.amount, 0);
            const narx = courses.find(c => c.id === g.courseId)?.price || 0;
            return { id: g.id, nom: g.name, oquvchi: ids.length, narx, hisobi, qarzi, qarzdor };
        }).sort((a, b) => b.qarzi - a.qarzi || a.nom.localeCompare(b.nom));
        // Jadvaldagi kurslarga tushmagan qarz: eski (kursga bog'lanmagan) qoldiq va
        // o'quvchi chiqib ketgan kurslardagi qarz (masalan Passiv qilinganlar).
        const hammaQarz = [...kursQarzlari.values()].reduce((s, mm) => s + [...mm.values()].reduce((a, b) => a + b, 0), 0);
        const kurssizQarz = Math.max(0, hammaQarz - kurslar.reduce((s, k) => s + k.qarzi, 0));

        return {
            jami, oldingi, davrSoni: davrKirim.length, usullar, boshqa,
            hisob, xarajat, foyda: jami - xarajat,
            qarz, qarzdorSoni: qarzdorlar.length, avans,
            faol: faol.length, sinov: students.filter(s => s.status === 'Sinov').length, yangi, ketgan, tolamagan,
            kurslar, kurssizQarz,
        };
    }, [payments, expenses, students, groups, courses, startDate, endDate, kursQarzlari]);

    const ozgarish = m.oldingi > 0 ? Math.round(((m.jami - m.oldingi) / m.oldingi) * 100) : null;
    const yigim = m.hisob > 0 ? Math.round((m.jami / m.hisob) * 100) : null;

    return (
        <div className="space-y-6">
            {/* 1. Tushum — usullar bo'yicha */}
            <section>
                <Sarlavha izoh={dateLabel}>Tushum</Sarlavha>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    <Korsatkich nom="Jami tushum" qiymat={som(m.jami)} ton="brand"
                        izoh={<>{m.davrSoni} ta to'lov{ozgarish !== null && <> · <span className={ozgarish >= 0 ? 'text-yaxshi' : 'text-xato'}>{ozgarish >= 0 ? '+' : ''}{ozgarish}%</span> oldingi davrga</>}</>} />
                    {m.usullar.map(u => (
                        <Korsatkich key={u.tur} nom={u.nom} qiymat={som(u.summa)}
                            ulush={m.jami > 0 ? Math.round((u.summa / m.jami) * 100) : 0} ulushRang={u.rang}
                            izoh={u.tur === 'Naqd' && kassa !== null
                                ? <>{u.soni} ta · kassada <span className="raqam text-matn-2">{som(kassa)}</span></>
                                : <>{u.soni} ta{m.jami > 0 && u.summa > 0 ? ` · ${Math.round((u.summa / m.jami) * 100)}%` : ''}</>} />
                    ))}
                </div>
                {m.boshqa > 0 && (
                    <p className="text-[11px] text-matn-xira mt-2">Boshqa turdagi to'lovlar: <span className="raqam">{som(m.boshqa)}</span></p>
                )}
            </section>

            {/* 2. Hisob va natija */}
            <section>
                <Sarlavha izoh={dateLabel}>Hisob va natija</Sarlavha>
                <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
                    <Korsatkich nom="Hisoblangan oylik" qiymat={som(m.hisob)}
                        ulush={yigim} ulushRang={yigim !== null && yigim >= 80 ? 'bg-yaxshi' : yigim !== null && yigim >= 50 ? 'bg-ogoh' : 'bg-xato'}
                        izoh={yigim !== null ? <>yig'ildi <span className="raqam text-matn-2">{yigim}%</span></> : 'shu davrda hisob yo\'q'} />
                    <Korsatkich nom="Qarzdorlik (hozir)" qiymat={som(m.qarz)} ton={m.qarz > 0 ? 'xato' : undefined}
                        izoh={`${m.qarzdorSoni} ta o'quvchi`} onClick={() => navigate('/students?filter=debt')} />
                    <Korsatkich nom="Avans (hozir)" qiymat={som(m.avans)} ton={m.avans > 0 ? 'yaxshi' : undefined}
                        izoh="oldindan to'langan" />
                    <Korsatkich nom="Xarajat" qiymat={som(m.xarajat)}
                        izoh={m.jami > 0 ? `tushumning ${Math.round((m.xarajat / m.jami) * 100)}%` : 'tanlangan davr'} />
                    <Korsatkich nom="Sof foyda" qiymat={som(m.foyda)} ton={m.foyda >= 0 ? 'yaxshi' : 'xato'}
                        izoh="tushum − xarajat" />
                </div>
            </section>

            {/* 3. O'quvchilar */}
            <section>
                <Sarlavha izoh={dateLabel}>O'quvchilar</Sarlavha>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    <Korsatkich nom="Faol (hozir)" qiymat={String(m.faol)} izoh={m.sinov ? `+ ${m.sinov} ta sinovda` : undefined} />
                    <Korsatkich nom="Yangi qo'shilgan" qiymat={String(m.yangi)} ton={m.yangi > 0 ? 'yaxshi' : undefined} izoh="ro'yxatga olingan" />
                    <Korsatkich nom="Ketgan" qiymat={String(m.ketgan)} ton={m.ketgan > 0 ? 'xato' : undefined} izoh="Passiv / Arxiv / Muzlatilgan" />
                    <Korsatkich nom="To'lamagan" qiymat={String(m.tolamagan)} ton={m.tolamagan > 0 ? 'xato' : undefined} izoh="kursdagi faol, shu davrda to'lovsiz" />
                </div>
            </section>

            {/* 4. Kurslar bo'yicha */}
            {m.kurslar.length > 0 && (
                <section className="bg-sirt rounded-xl border border-chiziq overflow-hidden">
                    <div className="px-4 pt-3.5 pb-2.5">
                        <Sarlavha izoh={<>qarz — hozir, hisob — {dateLabel}</>}>Kurslar bo'yicha</Sarlavha>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-y border-chiziq-mayin">
                                    <th className="px-4 py-2 text-[12px] font-normal text-matn-sokin">Kurs</th>
                                    <th className="hidden sm:table-cell px-3 py-2 text-[12px] font-normal text-matn-sokin text-right">O'quvchi</th>
                                    <th className="hidden sm:table-cell px-3 py-2 text-[12px] font-normal text-matn-sokin text-right">Oylik narx</th>
                                    <th className="hidden sm:table-cell px-3 py-2 text-[12px] font-normal text-matn-sokin text-right">Hisoblangan</th>
                                    <th className="px-4 py-2 text-[12px] font-normal text-matn-sokin text-right">Qarz</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-chiziq-mayin">
                                {m.kurslar.map(k => (
                                    <tr key={k.id} onClick={() => navigate(`/courses/${k.id}`)} className="hover:bg-ichki cursor-pointer transition-colors">
                                        <td className="px-4 py-2.5 text-[13px] text-matn">
                                            {k.nom}
                                            {/* Telefonda ustunlar sig'maydi — o'quvchi soni nom ostida. */}
                                            <span className="sm:hidden block text-[11px] text-matn-xira">{k.oquvchi} o'quvchi</span>
                                        </td>
                                        <td className="hidden sm:table-cell px-3 py-2.5 raqam text-[13px] text-matn-2 text-right">{k.oquvchi}</td>
                                        <td className="hidden sm:table-cell px-3 py-2.5 raqam text-[13px] text-matn-sokin text-right">{k.narx ? som(k.narx) : '—'}</td>
                                        <td className="hidden sm:table-cell px-3 py-2.5 raqam text-[13px] text-matn-2 text-right">{k.hisobi ? som(k.hisobi) : '—'}</td>
                                        <td className="px-4 py-2.5 text-right">
                                            <span className={`raqam text-[13px] ${k.qarzi > 0 ? 'text-xato' : 'text-matn-xira'}`}>{k.qarzi > 0 ? som(k.qarzi) : '0'}</span>
                                            {k.qarzdor > 0 && <span className="block text-[10px] text-matn-xira">{k.qarzdor} ta qarzdor</span>}
                                        </td>
                                    </tr>
                                ))}
                                {m.kurssizQarz > 0 && (
                                    <tr>
                                        <td className="px-4 py-2.5 text-[13px] text-matn-sokin">Kursga bog'lanmagan qarz (eski qoldiq, kursdan chiqqanlar)</td>
                                        <td className="hidden sm:table-cell" colSpan={3} />
                                        <td className="px-4 py-2.5 text-right raqam text-[13px] text-xato">{som(m.kurssizQarz)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}
