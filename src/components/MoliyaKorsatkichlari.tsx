import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { isCashIncome } from '../lib/money';
import { useHisobKitob, qarzOylari } from '../lib/hisobKitob';
import { davrOylari, oldingiDavr } from '../lib/davr';
import { displayName } from '../lib/displayName';
import { kursdaOqiydi } from '../../lib/oquvchiHolati.js';
import { toDateStr } from '../../lib/lessons.js';

/**
 * Moliya → Hisobotlar: ko'rsatkichlar.
 *
 * Egasi (2026-09-29): "moliyada ko'rsatkichlar yo'q, misol payme va ko'p
 * narsa o'zi qilsa bo'ladida". Tartib:
 *   1. Tushum — har bir usul alohida: Naqd, Karta, Klik, Payme, O'tkazma.
 *   2. Hisob — davr oylari uchun hisoblangan va qanchasi yopilgan, qarz,
 *      avans, xarajat, foyda.
 *   3. O'quvchilar — faol, yangi, ketgan, hisobi yopilmagan.
 *   4. Kurslar bo'yicha — hisoblangan, yopilgan %, qarz.
 *   5. Qarz — necha oylik va eng kattalari.
 * Qarz, avans va qarz yoshi — src/lib/hisobKitob.ts (server bilan bir xil
 * taqsimot); "hozir" deb yozilganlari — davrdan qat'iy nazar bugungi holat.
 */

// Bazadagi to'lov turlari. Payme yozuvlari tarixan "Peyme" deb saqlangan.
const USULLAR: { tur: string; nom: string; rang: string }[] = [
    { tur: 'Naqd', nom: 'Naqd', rang: 'bg-emerald-500' },
    { tur: 'Karta', nom: 'Karta', rang: 'bg-sky-500' },
    { tur: 'Klik', nom: 'Klik', rang: 'bg-blue-600' },
    { tur: 'Peyme', nom: 'Payme', rang: 'bg-teal-400' },
    { tur: "O'tkazma", nom: "O'tkazma", rang: 'bg-violet-500' },
];

const OYLAR = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

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

const yigimRangi = (p: number | null) => p !== null && p >= 80 ? 'bg-yaxshi' : p !== null && p >= 50 ? 'bg-ogoh' : 'bg-xato';

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

    const hisob = useHisobKitob(students, payments);
    const joriyOy = toDateStr().slice(0, 7);

    const m = useMemo(() => {
        const davrda = (d?: string) => !!d && d >= startDate && d <= endDate;
        const old = oldingiDavr(startDate, endDate);

        const kirimlar = payments.filter(isCashIncome);
        const davrKirim = kirimlar.filter(p => davrda(p.date));
        const jami = davrKirim.reduce((s, p) => s + p.amount, 0);
        const oldingi = kirimlar.filter(p => p.date >= old.start && p.date <= old.end).reduce((s, p) => s + p.amount, 0);
        const usullar = USULLAR.map(u => {
            const q = davrKirim.filter(p => p.type === u.tur);
            return { ...u, summa: q.reduce((s, p) => s + p.amount, 0), soni: q.length };
        });
        // Ro'yxatda yo'q tur (masalan eski "Online") bo'lsa ham jamiga kiradi.
        const boshqa = jami - usullar.reduce((s, u) => s + u.summa, 0);

        // Davr oylarining hisobi: shu oylar uchun hisoblangan va qanchasi yopilgan
        // (qaysi pul bilan bo'lsa ham — oldindan to'langan avansdan ham).
        const oylar = davrOylari(startDate, endDate);
        const oySet = new Set(oylar);
        let hisoblangan = 0, yopilgan = 0;
        const yopilmagan = new Set<number>();
        const kursHisob = new Map<number, { due: number; covered: number }>();
        for (const [sid, h] of hisob) {
            for (const b of h.chelaklar) {
                if (!oySet.has(b.month) || b.due <= 0) continue;
                hisoblangan += b.due;
                yopilgan += b.covered;
                if (b.remaining > 0) yopilmagan.add(sid);
                if (b.groupId) {
                    const k = kursHisob.get(b.groupId) || { due: 0, covered: 0 };
                    k.due += b.due; k.covered += b.covered;
                    kursHisob.set(b.groupId, k);
                }
            }
        }

        const xarajat = expenses.filter(e => davrda(e.date)).reduce((s, e) => s + e.amount, 0);

        // Hozirgi holat: qarz, avans, qarz yoshi, eng katta qarzdorlar.
        let qarz = 0, avans = 0;
        const yosh = [
            { nom: 'Shu oy', izoh: 'shu oy hisobi', sum: 0, soni: 0, rang: 'bg-ogoh' },
            { nom: "O'tgan oydan", izoh: '1 oylik', sum: 0, soni: 0, rang: 'bg-orange-500' },
            { nom: '2 oy va undan eski', izoh: '', sum: 0, soni: 0, rang: 'bg-xato' },
            { nom: 'Eski qoldiq', izoh: "kursga bog'lanmagan", sum: 0, soni: 0, rang: 'bg-matn-xira' },
        ];
        const qarzdorlar: { id: number; nom: string; qarz: number; kurslar: string }[] = [];
        for (const st of students) {
            const h = hisob.get(st.id);
            if (!h) continue;
            avans += h.avans;
            if (h.qarz <= 0) continue;
            qarz += h.qarz;
            const oy = qarzOylari(h.engEskiOy, joriyOy) ?? 0;
            const i = oy === Infinity ? 3 : oy >= 2 ? 2 : oy;
            yosh[i].sum += h.qarz;
            yosh[i].soni++;
            qarzdorlar.push({
                id: st.id, nom: displayName(st.name), qarz: h.qarz,
                kurslar: [...h.kurslar.keys()].map(gid => gid ? groups.find(g => g.id === gid)?.name : 'eski qoldiq').filter(Boolean).join(', '),
            });
        }
        qarzdorlar.sort((a, b) => b.qarz - a.qarz);

        // O'quvchilar harakati.
        const holat = new Map(students.map(s => [s.id, s.status]));
        const faol = students.filter(s => s.status === 'Faol').length;
        const sinov = students.filter(s => s.status === 'Sinov').length;
        const yangi = students.filter(s => davrda(s.joinedDate)).length;
        const ketgan = students.filter(s => !kursdaOqiydi(s.status) && davrda((s.statusChangedAt || '').slice(0, 10))).length;

        // Kurslar bo'yicha: o'quvchi soni, davr oylari hisobi va yopilgani, hozirgi qarz.
        const kurslar = groups.map(g => {
            const ids = g.studentIds || [];
            const qarzi = ids.reduce((s, sid) => s + (hisob.get(sid)?.kurslar.get(g.id) || 0), 0);
            const qarzdor = ids.filter(sid => (hisob.get(sid)?.kurslar.get(g.id) || 0) > 0).length;
            const kh = kursHisob.get(g.id) || { due: 0, covered: 0 };
            const narx = courses.find(c => c.id === g.courseId)?.price || 0;
            return {
                id: g.id, nom: g.name, oquvchi: ids.length,
                sinovda: ids.filter(sid => holat.get(sid) === 'Sinov').length,
                narx, hisobi: kh.due,
                yopildi: kh.due > 0 ? Math.round((kh.covered / kh.due) * 100) : null,
                qarzi, qarzdor,
            };
        }).sort((a, b) => b.qarzi - a.qarzi || a.nom.localeCompare(b.nom));
        // Jadvaldagi kurslarga tushmagan qarz: eski (kursga bog'lanmagan) qoldiq va
        // o'quvchi chiqib ketgan kurslardagi qarz (masalan Passiv qilinganlar).
        const kurssizQarz = Math.max(0, qarz - kurslar.reduce((s, k) => s + k.qarzi, 0));

        const bittaOy = oylar.length === 1;
        return {
            jami, oldingi, davrSoni: davrKirim.length, usullar, boshqa,
            hisoblangan, yopilgan, yopilmaganSoni: yopilmagan.size,
            hisobNomi: bittaOy ? `${OYLAR[Number(oylar[0].slice(5, 7)) - 1]} hisobi` : 'Davr oylari hisobi',
            xarajat, foyda: jami - xarajat,
            qarz, qarzdorSoni: qarzdorlar.length, avans, yosh, qarzdorlar,
            faol, sinov, yangi, ketgan,
            kurslar, kurssizQarz,
        };
    }, [payments, expenses, students, groups, courses, startDate, endDate, hisob, joriyOy]);

    const ozgarish = m.oldingi > 0 ? Math.round(((m.jami - m.oldingi) / m.oldingi) * 100) : null;
    const yigim = m.hisoblangan > 0 ? Math.round((m.yopilgan / m.hisoblangan) * 100) : null;
    const yoshMax = Math.max(...m.yosh.map(y => y.sum), 1);
    const eskirgan = m.yosh[1].soni + m.yosh[2].soni;

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
                    <Korsatkich nom={m.hisobNomi} qiymat={som(m.hisoblangan)}
                        ulush={yigim} ulushRang={yigimRangi(yigim)}
                        izoh={yigim !== null
                            ? <>yopildi <span className="raqam text-matn-2">{yigim}%</span> · qoldi <span className="raqam">{som(m.hisoblangan - m.yopilgan)}</span></>
                            : "bu oylarda hisob yo'q"} />
                    <Korsatkich nom="Qarzdorlik (hozir)" qiymat={som(m.qarz)} ton={m.qarz > 0 ? 'xato' : undefined}
                        izoh={`${m.qarzdorSoni} ta o'quvchi`} onClick={() => navigate('/students?filter=debt')} />
                    <Korsatkich nom="Avans (hozir)" qiymat={som(m.avans)} ton={m.avans > 0 ? 'yaxshi' : undefined}
                        izoh="oldindan to'langan, hali hisobga ketmagan" />
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
                    <Korsatkich nom="Ketgan" qiymat={String(m.ketgan)} ton={m.ketgan > 0 ? 'xato' : undefined} izoh="o'qishni to'xtatgan (Passiv, Arxiv …)" />
                    <Korsatkich nom="Hisobi yopilmagan" qiymat={String(m.yopilmaganSoni)} ton={m.yopilmaganSoni > 0 ? 'xato' : undefined}
                        izoh="shu oylar hisobi to'liq to'lanmagan" />
                </div>
            </section>

            {/* 4. Kurslar bo'yicha */}
            {m.kurslar.length > 0 && (
                <section className="bg-sirt rounded-xl border border-chiziq overflow-hidden">
                    <div className="px-4 pt-3.5 pb-2.5">
                        <Sarlavha izoh={<>hisob — {dateLabel}, qarz — hozir</>}>Kurslar bo'yicha</Sarlavha>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-y border-chiziq-mayin">
                                    <th className="px-4 py-2 text-[12px] font-normal text-matn-sokin">Kurs</th>
                                    <th className="hidden sm:table-cell px-3 py-2 text-[12px] font-normal text-matn-sokin text-right">O'quvchi</th>
                                    <th className="hidden md:table-cell px-3 py-2 text-[12px] font-normal text-matn-sokin text-right">Oylik narx</th>
                                    <th className="hidden sm:table-cell px-3 py-2 text-[12px] font-normal text-matn-sokin text-right">Hisoblangan</th>
                                    <th className="hidden sm:table-cell px-3 py-2 text-[12px] font-normal text-matn-sokin text-right">Yopildi</th>
                                    <th className="px-4 py-2 text-[12px] font-normal text-matn-sokin text-right">Qarz</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-chiziq-mayin">
                                {m.kurslar.map(k => (
                                    <tr key={k.id} onClick={() => navigate(`/courses/${k.id}`)} className="hover:bg-ichki cursor-pointer transition-colors">
                                        <td className="px-4 py-2.5 text-[13px] text-matn">
                                            {k.nom}
                                            {/* Telefonda ustunlar sig'maydi — asosiysi nom ostida. */}
                                            <span className="sm:hidden block text-[11px] text-matn-xira">
                                                {k.oquvchi} o'quvchi{k.yopildi !== null ? ` · yopildi ${k.yopildi}%` : ''}
                                            </span>
                                        </td>
                                        <td className="hidden sm:table-cell px-3 py-2.5 raqam text-[13px] text-matn-2 text-right">
                                            {k.oquvchi}
                                            {k.sinovda > 0 && <span className="block text-[10px] text-matn-xira">{k.sinovda} sinovda</span>}
                                        </td>
                                        <td className="hidden md:table-cell px-3 py-2.5 raqam text-[13px] text-matn-sokin text-right">{k.narx ? som(k.narx) : '—'}</td>
                                        <td className="hidden sm:table-cell px-3 py-2.5 raqam text-[13px] text-matn-2 text-right">{k.hisobi ? som(k.hisobi) : '—'}</td>
                                        <td className="hidden sm:table-cell px-3 py-2.5 text-right">
                                            {k.yopildi === null ? <span className="text-[13px] text-matn-xira">—</span> : (
                                                <span className={`raqam text-[13px] ${k.yopildi >= 80 ? 'text-yaxshi' : k.yopildi >= 50 ? 'text-ogoh' : 'text-xato'}`}>{k.yopildi}%</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <span className={`raqam text-[13px] ${k.qarzi > 0 ? 'text-xato' : 'text-matn-xira'}`}>{k.qarzi > 0 ? som(k.qarzi) : '0'}</span>
                                            {k.qarzdor > 0 && <span className="block text-[10px] text-matn-xira">{k.qarzdor} ta qarzdor</span>}
                                        </td>
                                    </tr>
                                ))}
                                {m.kurssizQarz > 0 && (
                                    <tr>
                                        <td className="px-4 py-2.5 text-[13px] text-matn-sokin">Kursga bog'lanmagan qarz (eski qoldiq, kursdan chiqqanlar)</td>
                                        {/* Ustunlar soni ekran kengligiga qarab: md+ — 6, sm — 5, telefon — 2. */}
                                        <td className="hidden md:table-cell" colSpan={4} />
                                        <td className="hidden sm:table-cell md:hidden" colSpan={3} />
                                        <td className="px-4 py-2.5 text-right raqam text-[13px] text-xato">{som(m.kurssizQarz)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* 5. Qarz: necha oylik va eng kattalari. Yosh — eng eski yopilmagan
                oydan (ilgari "oxirgi to'lovdan beri kun" edi: 28.09 dan oldingi
                tarix o'chgani uchun deyarli hamma "60+ kun" chiqardi). */}
            {m.qarz > 0 && (
                <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                    <div className="bg-sirt rounded-xl border border-chiziq p-4">
                        <Sarlavha izoh={eskirgan > 0 ? `${eskirgan} ta o'quvchining qarzi o'tgan oydan` : 'hammasi shu oyniki'}>Qarz necha oylik</Sarlavha>
                        <div className="space-y-3">
                            {m.yosh.filter((y, i) => i < 3 || y.soni > 0).map(y => (
                                <div key={y.nom}>
                                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                                        <span className="text-[12px] text-matn-2 truncate">{y.nom} <span className="raqam text-matn-xira">· {y.soni} ta</span></span>
                                        <span className="raqam text-[12px] text-matn-2 shrink-0">{som(y.sum)}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-chiziq overflow-hidden">
                                        <div className={`h-full rounded-full ${y.rang}`} style={{ width: `${Math.round((y.sum / yoshMax) * 100)}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-sirt rounded-xl border border-chiziq overflow-hidden">
                        <div className="px-4 pt-3.5 pb-1">
                            <Sarlavha izoh={<button onClick={() => navigate('/students?filter=debt')} className="text-brand hover:underline cursor-pointer">hammasi — {m.qarzdorSoni} ta</button>}>
                                Eng katta qarzdorlar
                            </Sarlavha>
                        </div>
                        {m.qarzdorlar.slice(0, 6).map(d => (
                            <div key={d.id} onClick={() => navigate(`/students/${d.id}`)}
                                className="flex items-center gap-3 px-4 py-2.5 border-t border-chiziq-mayin hover:bg-ichki transition-colors cursor-pointer">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] text-matn truncate">{d.nom}</p>
                                    {d.kurslar && <p className="text-[11px] text-matn-xira truncate">{d.kurslar}</p>}
                                </div>
                                <span className="raqam text-[13px] text-xato shrink-0">−{som(d.qarz)}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
