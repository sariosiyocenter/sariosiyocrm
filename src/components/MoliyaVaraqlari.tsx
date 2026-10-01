import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, Printer, RefreshCw, Search } from 'lucide-react';
import { useCRM } from '../context/CRMContext';

/**
 * Moliya → Hisobot varag'i: kunlik kassa, oylik moliya, qarzdorlik, ustoz oyliklari.
 *
 * Egasi (2026-10-01): "kassani ham rivojlantirish, hisobotlarni". Har varaq
 * server tomonda hisoblanadi (routes/hisobot.js) — raqamlar boshqa sahifalar bilan
 * bir xil ta'rifda; bu yerda faqat ko'rsatish, Excelga yuklash va chop etish.
 */

type Varaq = 'kunlik' | 'oylik' | 'qarz' | 'ustoz';

const som = (n: number) => Math.round(n).toLocaleString('ru-RU');
const dmy = (d: string) => { const [y, m, k] = d.split('-'); return `${k}.${m}.${y}`; };
const OYLAR = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const oyMatni = (oy: string) => { const [y, m] = oy.split('-').map(Number); return `${OYLAR[m - 1]} ${y}`; };
const bugun = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const kunQosh = (s: string, n: number) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const oyQosh = (oy: string, n: number) => { const [y, m] = oy.split('-').map(Number); const t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };

const CHOP_USLUBI = `@media print {
  body * { visibility: hidden !important; }
  #hisobot-chop, #hisobot-chop * { visibility: visible !important; }
  #hisobot-chop { position: absolute; left: 0; top: 0; width: 100%; padding: 12px; background: #fff; color: #000; }
  #hisobot-chop .chop-yoq { display: none !important; }
}`;

// --- Umumiy bo'laklar -------------------------------------------------------

function Karta({ nom, qiymat, izoh, ton }: { nom: string; qiymat: string; izoh?: ReactNode; ton?: 'yaxshi' | 'xato' | 'brand' }) {
    const rang = ton === 'yaxshi' ? 'text-yaxshi' : ton === 'xato' ? 'text-xato' : ton === 'brand' ? 'text-brand' : 'text-matn';
    return (
        <div className="rounded-xl border border-chiziq bg-sirt px-3.5 py-3 min-w-0">
            <span className="text-[12px] text-matn-sokin block truncate">{nom}</span>
            <span className={`raqam text-[20px] font-semibold leading-tight block mt-1 truncate ${rang}`} title={qiymat}>{qiymat}</span>
            {izoh && <span className="text-[11px] text-matn-xira block mt-1.5">{izoh}</span>}
        </div>
    );
}

function Blok({ sarlavha, izoh, children }: { sarlavha: string; izoh?: ReactNode; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-chiziq bg-sirt overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
                <h3 className="text-[14px] font-semibold text-matn">{sarlavha}</h3>
                {izoh && <span className="text-[12px] text-matn-xira truncate">{izoh}</span>}
            </div>
            {children}
        </section>
    );
}

const TH = 'px-4 py-2 text-[11px] font-semibold text-matn-sokin whitespace-nowrap';
const TD = 'px-4 py-2 text-[12.5px] text-matn-2';
const O = 'text-right raqam';

function Jadval({ bosh, children, bosh0 }: { bosh: [string, boolean?][]; children: ReactNode; bosh0?: string }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left" aria-label={bosh0}>
                <thead><tr className="border-y border-chiziq-mayin bg-ichki/50">{bosh.map(([n, o], i) => <th key={i} className={`${TH} ${o ? 'text-right' : ''}`}>{n}</th>)}</tr></thead>
                <tbody className="divide-y divide-chiziq-mayin">{children}</tbody>
            </table>
        </div>
    );
}

function Bosh({ children }: { children: ReactNode }) {
    return <p className="px-4 py-6 text-center text-[12.5px] text-matn-xira">{children}</p>;
}

/** Oldingi davrga nisbatan o'zgarish. `teskari` — kamayishi yaxshi (xarajat). */
function Farq({ joriy, oldingi, teskari }: { joriy: number; oldingi: number; teskari?: boolean }) {
    if (!oldingi) return <span className="text-matn-xira">oldingi davrda yo'q</span>;
    const f = Math.round(((joriy - oldingi) / Math.abs(oldingi)) * 100);
    const yaxshi = teskari ? f <= 0 : f >= 0;
    return <span className={yaxshi ? 'text-yaxshi' : 'text-xato'}>{f > 0 ? '+' : ''}{f}% <span className="text-matn-xira">oldingi davrga nisbatan</span></span>;
}

function Foiz({ p }: { p: number | null }) {
    if (p === null) return <span className="text-matn-xira">—</span>;
    const rang = p >= 80 ? 'bg-yaxshi' : p >= 50 ? 'bg-ogoh' : 'bg-xato';
    return (
        <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-14 rounded-full bg-chiziq overflow-hidden"><span className={`block h-full ${rang}`} style={{ width: `${Math.min(100, p)}%` }} /></span>
            <span className="raqam text-[12px] w-9 text-right">{p}%</span>
        </span>
    );
}

// --- Ma'lumot yuklash ---------------------------------------------------------

function useHisobot<T>(yol: string, params: Record<string, string>) {
    const { token, selectedSchoolId } = useCRM();
    const [data, setData] = useState<T | null>(null);
    const [yuklanmoqda, setYuklanmoqda] = useState(false);
    const [xato, setXato] = useState<string | null>(null);
    const [qayta, setQayta] = useState(0);
    const kalit = JSON.stringify(params);
    useEffect(() => {
        const ac = new AbortController();
        setYuklanmoqda(true);
        setXato(null);
        const q = new URLSearchParams({ schoolId: String(selectedSchoolId ?? 0), ...JSON.parse(kalit) });
        fetch(`/api/hisobot/${yol}?${q}`, { headers: { Authorization: `Bearer ${token}` }, signal: ac.signal })
            .then(async r => { const j = await r.json().catch(() => null); if (!r.ok) throw new Error(j?.error || `Xatolik (${r.status})`); return j; })
            .then(j => { setData(j); setYuklanmoqda(false); })
            .catch(e => { if (e?.name !== 'AbortError') { setXato(e?.message || 'Yuklab bo‘lmadi'); setYuklanmoqda(false); } });
        return () => ac.abort();
    }, [yol, kalit, token, selectedSchoolId, qayta]);
    return { data, yuklanmoqda, xato, yangila: useCallback(() => setQayta(n => n + 1), []) };
}

async function excelgaYukla(fayl: string, varaqlar: { nom: string; qatorlar: (string | number | null)[][] }[]) {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    for (const v of varaqlar) {
        const ws = XLSX.utils.aoa_to_sheet(v.qatorlar);
        ws['!cols'] = v.qatorlar[0]?.map((_, i) => ({ wch: Math.min(40, Math.max(10, ...v.qatorlar.map(q => String(q[i] ?? '').length + 2))) }));
        XLSX.utils.book_append_sheet(wb, ws, v.nom.slice(0, 31));
    }
    XLSX.writeFile(wb, `${fayl}.xlsx`);
}

function Asboblar({ children, onExcel, onYangila, yuklanmoqda }: { children: ReactNode; onExcel?: () => void; onYangila: () => void; yuklanmoqda: boolean }) {
    const tugma = 'inline-flex items-center gap-1.5 rounded-lg border border-chiziq bg-sirt px-3 py-2 text-[12px] font-medium text-matn-2 hover:bg-ichki transition-colors cursor-pointer disabled:opacity-50';
    return (
        <div className="chop-yoq flex flex-wrap items-center gap-2">
            {children}
            <span className="flex-1" />
            <button className={tugma} onClick={onYangila} disabled={yuklanmoqda} aria-label="Yangilash"><RefreshCw size={13} className={yuklanmoqda ? 'animate-spin' : ''} /></button>
            {onExcel && <button className={tugma} onClick={onExcel}><Download size={13} /> Excel</button>}
            <button className={tugma} onClick={() => window.print()}><Printer size={13} /> Chop etish</button>
        </div>
    );
}

function Holat({ yuklanmoqda, xato, bor, onQayta }: { yuklanmoqda: boolean; xato: string | null; bor: boolean; onQayta: () => void }) {
    if (xato) return (
        <div className="rounded-xl border border-xato-chiziq bg-xato-fon px-4 py-3 text-[12.5px] text-xato flex items-center justify-between gap-3">
            <span>{xato}</span><button onClick={onQayta} className="font-semibold underline cursor-pointer">Qayta urinish</button>
        </div>
    );
    if (!bor && yuklanmoqda) return <div className="py-16 flex justify-center text-matn-xira"><Loader2 className="animate-spin" size={20} /></div>;
    return null;
}

// --- 1. Kunlik kassa ------------------------------------------------------------

interface Kunlik {
    sana: string;
    kirim: { jami: number; soni: number; usullar: { tur: string; nom: string; summa: number; soni: number }[]; royxat: { id: number; vaqt: string; oquvchi: string; tur: string; summa: number; izoh: string }[] };
    chiqim: { jami: number; soni: number; usullar: { tur: string; summa: number; soni: number }[]; royxat: { id: number; kategoriya: string; usul: string; summa: number; izoh: string }[] };
    inkassatsiyalar: { id: number; summa: number; kimga: string; izoh: string }[];
    kassa: { boshlangich: number; naqdKirim: number; naqdChiqim: number; inkassatsiya: number; kutilgan: number; sanalgan: number | null; farq: number | null; yopilgan: boolean; yopishIzohi: string };
}

function KunlikVaraq() {
    const [sana, setSana] = useState(bugun());
    const { data: d, yuklanmoqda, xato, yangila } = useHisobot<Kunlik>('kunlik', { sana });
    const excel = d && (() => excelgaYukla(`Kunlik-kassa-${d.sana}`, [
        { nom: 'Kassa', qatorlar: [['Kunlik kassa hisoboti', dmy(d.sana)], [], ['Boshlang‘ich qoldiq (naqd)', d.kassa.boshlangich], ['+ Naqd kirim', d.kassa.naqdKirim], ['− Naqd chiqim', d.kassa.naqdChiqim], ['− Inkassatsiya', d.kassa.inkassatsiya], ['Kutilgan qoldiq', d.kassa.kutilgan], ['Sanalgan', d.kassa.sanalgan], ['Farq', d.kassa.farq]] },
        { nom: 'Kirim', qatorlar: [['Vaqt', 'O‘quvchi', 'Usul', 'Summa', 'Izoh'], ...d.kirim.royxat.map(t => [t.vaqt, t.oquvchi, t.tur, t.summa, t.izoh])] },
        { nom: 'Chiqim', qatorlar: [['Toifa', 'Usul', 'Summa', 'Izoh'], ...d.chiqim.royxat.map(x => [x.kategoriya, x.usul, x.summa, x.izoh])] },
        { nom: 'Inkassatsiya', qatorlar: [['Kimga', 'Summa', 'Izoh'], ...d.inkassatsiyalar.map(h => [h.kimga, h.summa, h.izoh])] },
    ]));
    return (
        <div className="space-y-4">
            <Asboblar onExcel={excel || undefined} onYangila={yangila} yuklanmoqda={yuklanmoqda}>
                <button className="p-2 rounded-lg border border-chiziq bg-sirt hover:bg-ichki cursor-pointer" aria-label="Oldingi kun" onClick={() => setSana(kunQosh(sana, -1))}><ChevronLeft size={14} /></button>
                <input type="date" value={sana} max={bugun()} onChange={e => e.target.value && setSana(e.target.value)} aria-label="Sana"
                    className="rounded-lg border border-chiziq bg-sirt px-3 py-2 text-[12.5px] text-matn" />
                <button className="p-2 rounded-lg border border-chiziq bg-sirt hover:bg-ichki cursor-pointer disabled:opacity-40" aria-label="Keyingi kun" disabled={sana >= bugun()} onClick={() => setSana(kunQosh(sana, 1))}><ChevronRight size={14} /></button>
                {sana !== bugun() && <button className="text-[12px] font-medium text-brand hover:underline cursor-pointer" onClick={() => setSana(bugun())}>Bugun</button>}
            </Asboblar>
            <Holat yuklanmoqda={yuklanmoqda} xato={xato} bor={!!d} onQayta={yangila} />
            {d && (
                <div id="hisobot-chop" className={`space-y-4 ${yuklanmoqda ? 'opacity-60' : ''}`}>
                    <h2 className="text-[16px] font-semibold text-matn">Kunlik kassa hisoboti — {dmy(d.sana)}</h2>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                        <Karta nom="Kirim (hamma usul)" qiymat={som(d.kirim.jami)} izoh={`${d.kirim.soni} ta to‘lov`} ton="yaxshi" />
                        <Karta nom="Chiqim" qiymat={som(d.chiqim.jami)} izoh={`${d.chiqim.soni} ta xarajat`} ton={d.chiqim.jami ? 'xato' : undefined} />
                        <Karta nom="Kassada naqd (kutilgan)" qiymat={som(d.kassa.kutilgan)} izoh={`kun boshida ${som(d.kassa.boshlangich)}`} />
                        <Karta nom="Kun holati" qiymat={d.kassa.yopilgan ? 'Yopilgan' : 'Ochiq'}
                            ton={d.kassa.yopilgan ? (d.kassa.farq ? 'xato' : 'yaxshi') : undefined}
                            izoh={d.kassa.yopilgan ? (d.kassa.farq ? `farq ${d.kassa.farq > 0 ? '+' : ''}${som(d.kassa.farq || 0)}` : 'pul to‘g‘ri chiqdi') : 'hali sanalmagan'} />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                        <Blok sarlavha="Naqd kassa hisobi">
                            <dl className="px-4 pb-4 space-y-1.5 text-[13px]">
                                {([
                                    ['Kun boshida qoldiq', d.kassa.boshlangich, ''],
                                    ['+ Naqd kirim', d.kassa.naqdKirim, 'text-yaxshi'],
                                    ['− Naqd chiqim', d.kassa.naqdChiqim, 'text-xato'],
                                    ['− Inkassatsiya (topshirilgan)', d.kassa.inkassatsiya, 'text-xato'],
                                ] as [string, number, string][]).map(([n, v, r]) => (
                                    <div key={n} className="flex justify-between gap-3"><dt className="text-matn-sokin">{n}</dt><dd className={`raqam font-medium ${r || 'text-matn'}`}>{som(v)}</dd></div>
                                ))}
                                <div className="flex justify-between gap-3 border-t border-chiziq pt-2 mt-1"><dt className="font-semibold text-matn">Kutilgan qoldiq</dt><dd className="raqam font-semibold text-matn">{som(d.kassa.kutilgan)}</dd></div>
                                {d.kassa.sanalgan !== null && (<>
                                    <div className="flex justify-between gap-3"><dt className="text-matn-sokin">Sanalgan</dt><dd className="raqam font-medium text-matn">{som(d.kassa.sanalgan)}</dd></div>
                                    <div className="flex justify-between gap-3"><dt className="text-matn-sokin">Farq</dt><dd className={`raqam font-semibold ${d.kassa.farq ? 'text-xato' : 'text-yaxshi'}`}>{d.kassa.farq ? `${d.kassa.farq > 0 ? '+' : ''}${som(d.kassa.farq)}` : '0'}</dd></div>
                                </>)}
                                {d.kassa.yopishIzohi && <p className="text-[12px] text-matn-xira pt-1">Izoh: {d.kassa.yopishIzohi}</p>}
                            </dl>
                        </Blok>
                        <Blok sarlavha="Kirim — usullar bo‘yicha" izoh={`jami ${som(d.kirim.jami)}`}>
                            <Jadval bosh={[['Usul'], ['Soni', true], ['Summa', true]]}>
                                {d.kirim.usullar.map(u => (
                                    <tr key={u.tur} className={u.soni ? '' : 'opacity-50'}><td className={TD}>{u.nom}</td><td className={`${TD} ${O}`}>{u.soni}</td><td className={`${TD} ${O} font-medium text-matn`}>{som(u.summa)}</td></tr>
                                ))}
                            </Jadval>
                        </Blok>
                    </div>

                    <Blok sarlavha="Kirim ro‘yxati" izoh={`${d.kirim.soni} ta`}>
                        {d.kirim.royxat.length ? (
                            <Jadval bosh={[['Vaqt'], ['O‘quvchi'], ['Usul'], ['Summa', true], ['Izoh']]}>
                                {d.kirim.royxat.map(t => (
                                    <tr key={t.id}><td className={`${TD} raqam`}>{t.vaqt}</td><td className={`${TD} text-matn`}>{t.oquvchi}</td><td className={TD}>{t.tur === 'Peyme' ? 'Payme' : t.tur}</td><td className={`${TD} ${O} font-medium text-matn`}>{som(t.summa)}</td><td className={`${TD} text-matn-xira`}>{t.izoh}</td></tr>
                                ))}
                            </Jadval>
                        ) : <Bosh>Bu kuni to‘lov bo‘lmagan</Bosh>}
                    </Blok>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                        <Blok sarlavha="Chiqim ro‘yxati" izoh={`jami ${som(d.chiqim.jami)}`}>
                            {d.chiqim.royxat.length ? (
                                <Jadval bosh={[['Toifa'], ['Usul'], ['Summa', true], ['Izoh']]}>
                                    {d.chiqim.royxat.map(x => (
                                        <tr key={x.id}><td className={`${TD} text-matn`}>{x.kategoriya}</td><td className={TD}>{x.usul}</td><td className={`${TD} ${O} font-medium text-matn`}>{som(x.summa)}</td><td className={`${TD} text-matn-xira`}>{x.izoh}</td></tr>
                                    ))}
                                </Jadval>
                            ) : <Bosh>Bu kuni xarajat bo‘lmagan</Bosh>}
                        </Blok>
                        <Blok sarlavha="Inkassatsiya" izoh="pul topshirilgan">
                            {d.inkassatsiyalar.length ? (
                                <Jadval bosh={[['Kimga'], ['Summa', true], ['Izoh']]}>
                                    {d.inkassatsiyalar.map(h => (
                                        <tr key={h.id}><td className={`${TD} text-matn`}>{h.kimga}</td><td className={`${TD} ${O} font-medium text-matn`}>{som(h.summa)}</td><td className={`${TD} text-matn-xira`}>{h.izoh}</td></tr>
                                    ))}
                                </Jadval>
                            ) : <Bosh>Bu kuni pul topshirilmagan</Bosh>}
                        </Blok>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- 2. Oylik moliya --------------------------------------------------------------

interface Oylik {
    oy: string; oldingiOy: string;
    tushum: { jami: number; oldingi: number; soni: number; usullar: { tur: string; nom: string; summa: number; oldingi: number; soni: number }[] };
    xarajat: { jami: number; oldingi: number; ishHaqi: number; naqd: number; kategoriyalar: { nom: string; summa: number; oldingi: number }[] };
    foyda: { jami: number; oldingi: number };
    hisob: { hisoblangan: number; yopilgan: number; qoldi: number; foiz: number | null };
    kunlar: { sana: string; summa: number }[];
    kurslar: { id: number; nom: string; fan: string; ustoz: string; oquvchi: number; qarzdor: number; hisoblangan: number; yopilgan: number; qoldi: number; foiz: number | null }[];
    fanlar: { nom: string; kurs: number; hisoblangan: number; yopilgan: number }[];
}

function OylikVaraq() {
    const [oy, setOy] = useState(bugun().slice(0, 7));
    const { data: d, yuklanmoqda, xato, yangila } = useHisobot<Oylik>('oylik', { oy });
    const eng = d ? Math.max(1, ...d.kunlar.map(k => k.summa)) : 1;
    const excel = d && (() => excelgaYukla(`Oylik-moliya-${d.oy}`, [
        { nom: 'Xulosa', qatorlar: [[`Oylik moliya hisoboti — ${oyMatni(d.oy)}`, 'Joriy oy', oyMatni(d.oldingiOy)], ['Tushum', d.tushum.jami, d.tushum.oldingi], ['Xarajat', d.xarajat.jami, d.xarajat.oldingi], ['Foyda', d.foyda.jami, d.foyda.oldingi], ['Hisoblangan', d.hisob.hisoblangan], ['Yopilgan', d.hisob.yopilgan], ['Qolgan', d.hisob.qoldi]] },
        { nom: 'Tushum usullari', qatorlar: [['Usul', 'Soni', 'Summa', 'Oldingi oy'], ...d.tushum.usullar.map(u => [u.nom, u.soni, u.summa, u.oldingi])] },
        { nom: 'Xarajatlar', qatorlar: [['Toifa', 'Summa', 'Oldingi oy'], ...d.xarajat.kategoriyalar.map(k => [k.nom, k.summa, k.oldingi])] },
        { nom: 'Kurslar', qatorlar: [['Kurs', 'Fan', 'Ustoz', 'O‘quvchi', 'Qarzdor', 'Hisoblangan', 'Yopilgan', 'Qolgan', '%'], ...d.kurslar.map(k => [k.nom, k.fan, k.ustoz, k.oquvchi, k.qarzdor, k.hisoblangan, k.yopilgan, k.qoldi, k.foiz])] },
        { nom: 'Fanlar', qatorlar: [['Fan', 'Kurslar', 'Hisoblangan', 'Yopilgan'], ...d.fanlar.map(f => [f.nom, f.kurs, f.hisoblangan, f.yopilgan])] },
        { nom: 'Kunlar', qatorlar: [['Sana', 'Tushum'], ...d.kunlar.map(k => [dmy(k.sana), k.summa])] },
    ]));
    return (
        <div className="space-y-4">
            <Asboblar onExcel={excel || undefined} onYangila={yangila} yuklanmoqda={yuklanmoqda}>
                <button className="p-2 rounded-lg border border-chiziq bg-sirt hover:bg-ichki cursor-pointer" aria-label="Oldingi oy" onClick={() => setOy(oyQosh(oy, -1))}><ChevronLeft size={14} /></button>
                <input type="month" value={oy} max={bugun().slice(0, 7)} onChange={e => e.target.value && setOy(e.target.value)} aria-label="Oy"
                    className="rounded-lg border border-chiziq bg-sirt px-3 py-2 text-[12.5px] text-matn" />
                <button className="p-2 rounded-lg border border-chiziq bg-sirt hover:bg-ichki cursor-pointer disabled:opacity-40" aria-label="Keyingi oy" disabled={oy >= bugun().slice(0, 7)} onClick={() => setOy(oyQosh(oy, 1))}><ChevronRight size={14} /></button>
            </Asboblar>
            <Holat yuklanmoqda={yuklanmoqda} xato={xato} bor={!!d} onQayta={yangila} />
            {d && (
                <div id="hisobot-chop" className={`space-y-4 ${yuklanmoqda ? 'opacity-60' : ''}`}>
                    <h2 className="text-[16px] font-semibold text-matn">Oylik moliya hisoboti — {oyMatni(d.oy)}</h2>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                        <Karta nom="Tushum" qiymat={som(d.tushum.jami)} ton="yaxshi" izoh={<Farq joriy={d.tushum.jami} oldingi={d.tushum.oldingi} />} />
                        <Karta nom="Xarajat" qiymat={som(d.xarajat.jami)} izoh={<><Farq joriy={d.xarajat.jami} oldingi={d.xarajat.oldingi} teskari /><br />shundan ish haqi {som(d.xarajat.ishHaqi)}</>} />
                        <Karta nom="Foyda (tushum − xarajat)" qiymat={som(d.foyda.jami)} ton={d.foyda.jami >= 0 ? 'brand' : 'xato'} izoh={<Farq joriy={d.foyda.jami} oldingi={d.foyda.oldingi} />} />
                        <Karta nom="Hisob yopilishi" qiymat={d.hisob.foiz === null ? '—' : `${d.hisob.foiz}%`} ton={d.hisob.foiz !== null && d.hisob.foiz < 50 ? 'xato' : undefined}
                            izoh={`hisoblangan ${som(d.hisob.hisoblangan)}, qolgan ${som(d.hisob.qoldi)}`} />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                        <Blok sarlavha="Tushum — usullar bo‘yicha" izoh={`${d.tushum.soni} ta to‘lov`}>
                            <Jadval bosh={[['Usul'], ['Soni', true], ['Summa', true], [oyMatni(d.oldingiOy), true]]}>
                                {d.tushum.usullar.map(u => (
                                    <tr key={u.tur} className={u.soni || u.oldingi ? '' : 'opacity-50'}><td className={TD}>{u.nom}</td><td className={`${TD} ${O}`}>{u.soni}</td><td className={`${TD} ${O} font-medium text-matn`}>{som(u.summa)}</td><td className={`${TD} ${O} text-matn-xira`}>{som(u.oldingi)}</td></tr>
                                ))}
                            </Jadval>
                        </Blok>
                        <Blok sarlavha="Xarajat — toifalar bo‘yicha" izoh={`naqd ${som(d.xarajat.naqd)}`}>
                            {d.xarajat.kategoriyalar.length ? (
                                <Jadval bosh={[['Toifa'], ['Summa', true], [oyMatni(d.oldingiOy), true]]}>
                                    {d.xarajat.kategoriyalar.map(k => (
                                        <tr key={k.nom}><td className={`${TD} text-matn`}>{k.nom}</td><td className={`${TD} ${O} font-medium text-matn`}>{som(k.summa)}</td><td className={`${TD} ${O} text-matn-xira`}>{som(k.oldingi)}</td></tr>
                                    ))}
                                </Jadval>
                            ) : <Bosh>Bu oyda xarajat yo‘q</Bosh>}
                        </Blok>
                    </div>

                    {d.kunlar.length > 0 && (
                        <Blok sarlavha="Kunlar bo‘yicha tushum">
                            <div className="px-4 pb-4 flex items-end gap-1 h-32 overflow-x-auto">
                                {d.kunlar.map(k => (
                                    <div key={k.sana} className="flex flex-col items-center justify-end gap-1 min-w-[26px] h-full" title={`${dmy(k.sana)} — ${som(k.summa)}`}>
                                        <div className="w-4 rounded-t bg-brand/80" style={{ height: `${Math.max(3, (k.summa / eng) * 80)}%` }} />
                                        <span className="text-[9.5px] text-matn-xira raqam">{k.sana.slice(8)}</span>
                                    </div>
                                ))}
                            </div>
                        </Blok>
                    )}

                    <Blok sarlavha="Kurslar bo‘yicha" izoh="hisoblangan va yopilgan pul">
                        {d.kurslar.length ? (
                            <Jadval bosh={[['Kurs'], ['Ustoz'], ['O‘quvchi', true], ['Qarzdor', true], ['Hisoblangan', true], ['Yopilgan', true], ['Qolgan', true], ['Yopilish']]}>
                                {d.kurslar.map(k => (
                                    <tr key={k.id}><td className={`${TD} text-matn font-medium`}>{k.nom}</td><td className={`${TD} text-matn-xira`}>{k.ustoz}</td><td className={`${TD} ${O}`}>{k.oquvchi}</td><td className={`${TD} ${O} ${k.qarzdor ? 'text-xato' : ''}`}>{k.qarzdor}</td>
                                        <td className={`${TD} ${O}`}>{som(k.hisoblangan)}</td><td className={`${TD} ${O} text-yaxshi`}>{som(k.yopilgan)}</td><td className={`${TD} ${O} ${k.qoldi > 0 ? 'text-xato' : ''}`}>{som(k.qoldi)}</td><td className={TD}><Foiz p={k.foiz} /></td></tr>
                                ))}
                            </Jadval>
                        ) : <Bosh>Bu oy uchun hisob yo‘q</Bosh>}
                    </Blok>

                    {d.fanlar.some(f => f.kurs > 1) && (
                        <Blok sarlavha="Fanlar bo‘yicha">
                            <Jadval bosh={[['Fan'], ['Kurslar', true], ['Hisoblangan', true], ['Yopilgan', true]]}>
                                {d.fanlar.map(f => (
                                    <tr key={f.nom}><td className={`${TD} text-matn`}>{f.nom}</td><td className={`${TD} ${O}`}>{f.kurs}</td><td className={`${TD} ${O}`}>{som(f.hisoblangan)}</td><td className={`${TD} ${O} text-yaxshi`}>{som(f.yopilgan)}</td></tr>
                                ))}
                            </Jadval>
                        </Blok>
                    )}
                </div>
            )}
        </div>
    );
}

// --- 3. Qarzdorlik -----------------------------------------------------------------

interface Qarz {
    jami: number; soni: number;
    yosh: { nom: string; summa: number; soni: number }[];
    kurslar: { id: number | null; nom: string; ustoz: string; soni: number; summa: number }[];
    royxat: { id: number; ism: string; kod: number | null; holat: string; telefon: string; otaOnaTel: string; qarz: number; eskiOy: string | null; oylar: number; oxirgiTolov: string | null; kurslar: { nom: string; summa: number }[] }[];
}

function QarzVaraq() {
    const { data: d, yuklanmoqda, xato, yangila } = useHisobot<Qarz>('qarz', {});
    const [q, setQ] = useState('');
    const [limit, setLimit] = useState(50);
    const royxat = useMemo(() => {
        if (!d) return [];
        const s = q.trim().toLowerCase();
        return s ? d.royxat.filter(x => x.ism.toLowerCase().includes(s) || x.kurslar.some(k => k.nom.toLowerCase().includes(s)) || String(x.kod || '').includes(s) || x.telefon.includes(s)) : d.royxat;
    }, [d, q]);
    const excel = d && (() => excelgaYukla(`Qarzdorlik-${bugun()}`, [
        { nom: 'Qarzdorlar', qatorlar: [['O‘quvchi', 'ID', 'Telefon', 'Ota-ona telefoni', 'Qarz', 'Qarz boshlangan oy', 'Necha oylik', 'Oxirgi to‘lov', 'Kurslar'], ...d.royxat.map(x => [x.ism, x.kod, x.telefon, x.otaOnaTel, x.qarz, x.eskiOy, x.oylar, x.oxirgiTolov ? dmy(x.oxirgiTolov) : '', x.kurslar.map(k => `${k.nom}: ${som(k.summa)}`).join('; ')])] },
        { nom: 'Kurslar', qatorlar: [['Kurs', 'Ustoz', 'Qarzdor', 'Qarz'], ...d.kurslar.map(k => [k.nom, k.ustoz, k.soni, k.summa])] },
        { nom: 'Qarz yoshi', qatorlar: [['Davr', 'Soni', 'Summa'], ...d.yosh.map(y => [y.nom, y.soni, y.summa])] },
    ]));
    return (
        <div className="space-y-4">
            <Asboblar onExcel={excel || undefined} onYangila={yangila} yuklanmoqda={yuklanmoqda}>
                <span className="text-[12.5px] text-matn-sokin">Bugungi holat bo‘yicha</span>
            </Asboblar>
            <Holat yuklanmoqda={yuklanmoqda} xato={xato} bor={!!d} onQayta={yangila} />
            {d && (
                <div id="hisobot-chop" className={`space-y-4 ${yuklanmoqda ? 'opacity-60' : ''}`}>
                    <h2 className="text-[16px] font-semibold text-matn">Qarzdorlik hisoboti — {dmy(bugun())}</h2>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                        <Karta nom="Jami qarz" qiymat={som(d.jami)} ton="xato" izoh={`${d.soni} ta o‘quvchi`} />
                        {d.yosh.slice(0, 3).map((y, i) => <Karta key={y.nom} nom={i === 2 ? `${y.nom}` : `Qarz: ${y.nom.toLowerCase()}`} qiymat={som(y.summa)} izoh={`${y.soni} ta o‘quvchi`} ton={i >= 1 && y.summa ? 'xato' : undefined} />)}
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                        <Blok sarlavha="Qarz yoshi" izoh="eng eski ochiq oy bo‘yicha">
                            <Jadval bosh={[['Davr'], ['O‘quvchi', true], ['Summa', true]]}>
                                {d.yosh.map(y => <tr key={y.nom} className={y.soni ? '' : 'opacity-50'}><td className={TD}>{y.nom}</td><td className={`${TD} ${O}`}>{y.soni}</td><td className={`${TD} ${O} font-medium text-matn`}>{som(y.summa)}</td></tr>)}
                            </Jadval>
                        </Blok>
                        <Blok sarlavha="Kurslar bo‘yicha qarz">
                            {d.kurslar.length ? (
                                <Jadval bosh={[['Kurs'], ['Ustoz'], ['Qarzdor', true], ['Qarz', true]]}>
                                    {d.kurslar.map(k => <tr key={k.id ?? 'eski'}><td className={`${TD} text-matn font-medium`}>{k.nom}</td><td className={`${TD} text-matn-xira`}>{k.ustoz}</td><td className={`${TD} ${O}`}>{k.soni}</td><td className={`${TD} ${O} font-medium text-xato`}>{som(k.summa)}</td></tr>)}
                                </Jadval>
                            ) : <Bosh>Qarz yo‘q</Bosh>}
                        </Blok>
                    </div>
                    <Blok sarlavha="Qarzdorlar ro‘yxati" izoh={`${royxat.length} ta`}>
                        <div className="chop-yoq px-4 pb-3">
                            <div className="relative max-w-sm">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
                                <input value={q} onChange={e => { setQ(e.target.value); setLimit(50); }} placeholder="Ism, ID, telefon yoki kurs…" aria-label="Qidirish"
                                    className="w-full rounded-lg border border-chiziq bg-ichki pl-8 pr-3 py-2 text-[12.5px] text-matn" />
                            </div>
                        </div>
                        {royxat.length ? (
                            <Jadval bosh={[['O‘quvchi'], ['Telefon'], ['Kurslar'], ['Qarz', true], ['Muddat'], ['Oxirgi to‘lov']]}>
                                {royxat.slice(0, limit).map(x => (
                                    <tr key={x.id}>
                                        <td className={`${TD} text-matn font-medium`}>{x.ism}{x.kod ? <span className="text-matn-xira font-normal raqam"> · {x.kod}</span> : null}</td>
                                        <td className={`${TD} raqam whitespace-nowrap`}>{x.telefon || x.otaOnaTel || '—'}</td>
                                        <td className={`${TD} text-matn-xira`}>{x.kurslar.map(k => `${k.nom} ${som(k.summa)}`).join(', ') || '—'}</td>
                                        <td className={`${TD} ${O} font-medium text-xato`}>{som(x.qarz)}</td>
                                        <td className={`${TD} whitespace-nowrap ${x.oylar >= 2 ? 'text-xato' : x.oylar === 1 ? 'text-ogoh' : 'text-matn-xira'}`}>{x.eskiOy ? (x.oylar ? `${x.oylar} oylik` : 'shu oy') : '—'}</td>
                                        <td className={`${TD} raqam text-matn-xira whitespace-nowrap`}>{x.oxirgiTolov ? dmy(x.oxirgiTolov) : 'yo‘q'}</td>
                                    </tr>
                                ))}
                            </Jadval>
                        ) : <Bosh>Hech narsa topilmadi</Bosh>}
                        {royxat.length > limit && (
                            <div className="chop-yoq px-4 py-3 border-t border-chiziq-mayin text-center">
                                <button className="text-[12.5px] font-medium text-brand hover:underline cursor-pointer" onClick={() => setLimit(l => l + 100)}>Yana ko‘rsatish ({royxat.length - limit} ta)</button>
                            </div>
                        )}
                    </Blok>
                </div>
            )}
        </div>
    );
}

// --- 4. Ustoz oyliklari ----------------------------------------------------------

interface UstozOylik {
    oy: string;
    jami: { asosiy: number; kpi: number; hisoblangan: number; tolangan: number; qoldi: number; berilgan: number; soni: number };
    ustozlar: { id: number; ism: string; lavozim: string; asosiy: number; kpi: number; bonus: number; jarima: number; hisoblangan: number; tolangan: number; qoldi: number; berilgan: boolean; sana: string | null; izoh: string; darslar: number;
        kurslar: { id: number; nom: string; oquvchi: number; darslar: number; tushgan: number; haq: number; shart: string; ikkinchi: boolean }[] }[];
}

function UstozVaraq() {
    const [oy, setOy] = useState(bugun().slice(0, 7));
    const { data: d, yuklanmoqda, xato, yangila } = useHisobot<UstozOylik>('ustoz-oylik', { oy });
    const [ochiq, setOchiq] = useState<Set<number>>(new Set());
    const almashtir = (id: number) => setOchiq(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const excel = d && (() => excelgaYukla(`Ustoz-oyliklari-${d.oy}`, [
        { nom: 'Ustozlar', qatorlar: [['Ustoz', 'Lavozim', 'Asosiy oylik', 'KPI (kurslardan)', 'Bonus', 'Jarima', 'Hisoblangan', 'To‘langan', 'Qolgan', 'Holat'], ...d.ustozlar.map(u => [u.ism, u.lavozim, u.asosiy, u.kpi, u.bonus, u.jarima, u.hisoblangan, u.tolangan, u.qoldi, u.berilgan ? 'Berilgan' : 'Berilmagan'])] },
        { nom: 'Kurslar', qatorlar: [['Ustoz', 'Kurs', 'O‘quvchi', 'Darslar', 'Tushgan pul', 'Ustoz haqi', 'Shart'], ...d.ustozlar.flatMap(u => u.kurslar.map(k => [u.ism, k.nom + (k.ikkinchi ? ' (2-ustoz)' : ''), k.oquvchi, k.darslar, k.tushgan, k.haq, k.shart]))] },
    ]));
    return (
        <div className="space-y-4">
            <Asboblar onExcel={excel || undefined} onYangila={yangila} yuklanmoqda={yuklanmoqda}>
                <button className="p-2 rounded-lg border border-chiziq bg-sirt hover:bg-ichki cursor-pointer" aria-label="Oldingi oy" onClick={() => setOy(oyQosh(oy, -1))}><ChevronLeft size={14} /></button>
                <input type="month" value={oy} max={bugun().slice(0, 7)} onChange={e => e.target.value && setOy(e.target.value)} aria-label="Oy"
                    className="rounded-lg border border-chiziq bg-sirt px-3 py-2 text-[12.5px] text-matn" />
                <button className="p-2 rounded-lg border border-chiziq bg-sirt hover:bg-ichki cursor-pointer disabled:opacity-40" aria-label="Keyingi oy" disabled={oy >= bugun().slice(0, 7)} onClick={() => setOy(oyQosh(oy, 1))}><ChevronRight size={14} /></button>
            </Asboblar>
            <Holat yuklanmoqda={yuklanmoqda} xato={xato} bor={!!d} onQayta={yangila} />
            {d && (
                <div id="hisobot-chop" className={`space-y-4 ${yuklanmoqda ? 'opacity-60' : ''}`}>
                    <h2 className="text-[16px] font-semibold text-matn">Ustoz oyliklari — {oyMatni(d.oy)}</h2>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                        <Karta nom="Hisoblangan oylik" qiymat={som(d.jami.hisoblangan)} izoh={`asosiy ${som(d.jami.asosiy)} + kurslardan ${som(d.jami.kpi)}`} />
                        <Karta nom="To‘langan" qiymat={som(d.jami.tolangan)} ton="yaxshi" izoh={`${d.jami.berilgan} / ${d.jami.soni} ustozga berilgan`} />
                        <Karta nom="Berilishi kerak" qiymat={som(d.jami.qoldi)} ton={d.jami.qoldi ? 'xato' : undefined} izoh={`${d.jami.soni - d.jami.berilgan} ta ustoz`} />
                        <Karta nom="Ustozlar" qiymat={String(d.jami.soni)} izoh="faol o‘qituvchi" />
                    </div>
                    <Blok sarlavha="Ustozlar bo‘yicha" izoh="kurs tafsiloti — qatorni bosing">
                        {d.ustozlar.length ? (
                            <Jadval bosh={[[''], ['Ustoz'], ['Asosiy', true], ['Kurslardan', true], ['Hisoblangan', true], ['To‘langan', true], ['Qolgan', true], ['Holat']]}>
                                {d.ustozlar.map(u => (
                                    <FragmentQator key={u.id} u={u} ochiq={ochiq.has(u.id)} onBos={() => almashtir(u.id)} />
                                ))}
                            </Jadval>
                        ) : <Bosh>Faol ustoz yo‘q</Bosh>}
                    </Blok>
                    <p className="chop-yoq text-[11.5px] text-matn-xira">Kurslardan — har kursga tushgan puldan ustoz ulushi (kursdagi shartga ko‘ra). Oylik berilgach to‘langan summa va bonus/jarima haqiqiy yozuvdan olinadi.</p>
                </div>
            )}
        </div>
    );
}

function FragmentQator({ u, ochiq, onBos }: { u: UstozOylik['ustozlar'][number]; ochiq: boolean; onBos: () => void }) {
    return (
        <>
            <tr className="cursor-pointer hover:bg-ichki/50" onClick={onBos}>
                <td className="pl-4 py-2 w-6"><ChevronDown size={14} className={`text-matn-xira transition-transform ${ochiq ? '' : '-rotate-90'}`} /></td>
                <td className={`${TD} text-matn font-medium`}>{u.ism}<span className="block text-[11px] text-matn-xira font-normal">{u.lavozim} · {u.darslar} dars</span></td>
                <td className={`${TD} ${O}`}>{som(u.asosiy)}</td>
                <td className={`${TD} ${O}`}>{som(u.kpi)}</td>
                <td className={`${TD} ${O} font-medium text-matn`}>{som(u.hisoblangan)}{(u.bonus || u.jarima) ? <span className="block text-[11px] text-matn-xira font-normal">{u.bonus ? `+${som(u.bonus)} bonus` : ''}{u.bonus && u.jarima ? ', ' : ''}{u.jarima ? `−${som(u.jarima)} jarima` : ''}</span> : null}</td>
                <td className={`${TD} ${O} text-yaxshi`}>{som(u.tolangan)}</td>
                <td className={`${TD} ${O} ${u.qoldi ? 'font-medium text-xato' : ''}`}>{som(u.qoldi)}</td>
                <td className={`${TD} whitespace-nowrap`}>{u.berilgan ? <span className="text-yaxshi">Berilgan</span> : <span className="text-ogoh">Berilmagan</span>}</td>
            </tr>
            {ochiq && (
                <tr className="bg-ichki/40">
                    <td />
                    <td colSpan={7} className="px-4 py-2">
                        {u.kurslar.length ? (
                            <table className="w-full text-left"><thead><tr>{['Kurs', 'O‘quvchi', 'Dars', 'Tushgan pul', 'Ustoz haqi', 'Shart'].map((n, i) => <th key={n} className={`py-1 pr-3 text-[10.5px] font-semibold text-matn-xira ${i > 0 && i < 5 ? 'text-right' : ''}`}>{n}</th>)}</tr></thead>
                                <tbody>{u.kurslar.map(k => (
                                    <tr key={k.id}><td className="py-1 pr-3 text-[12px] text-matn-2">{k.nom}{k.ikkinchi ? <span className="text-matn-xira"> · 2-ustoz</span> : null}</td><td className="py-1 pr-3 text-[12px] text-right raqam">{k.oquvchi}</td><td className="py-1 pr-3 text-[12px] text-right raqam">{k.darslar}</td><td className="py-1 pr-3 text-[12px] text-right raqam">{som(k.tushgan)}</td><td className="py-1 pr-3 text-[12px] text-right raqam font-medium">{som(k.haq)}</td><td className="py-1 pr-3 text-[12px] text-matn-xira">{k.shart}</td></tr>
                                ))}</tbody></table>
                        ) : <p className="text-[12px] text-matn-xira">Kursi yo‘q</p>}
                    </td>
                </tr>
            )}
        </>
    );
}

// --- Asosiy -----------------------------------------------------------------------

export default function MoliyaVaraqlari() {
    const { kora } = useCRM();
    const mavjud: { id: Varaq; nom: string }[] = [
        kora('moliya.kassa') && { id: 'kunlik' as const, nom: 'Kunlik kassa' },
        kora('moliya.hisobot') && { id: 'oylik' as const, nom: 'Oylik moliya' },
        kora('moliya.hisobot') && { id: 'qarz' as const, nom: 'Qarzdorlik' },
        kora('xodimlar.maosh') && { id: 'ustoz' as const, nom: 'Ustoz oyliklari' },
    ].filter(Boolean) as { id: Varaq; nom: string }[];
    const [varaq, setVaraq] = useState<Varaq | null>(null);
    const joriy = varaq && mavjud.some(m => m.id === varaq) ? varaq : mavjud[0]?.id;
    if (!joriy) return <p className="p-6 text-[13px] text-matn-xira">Hisobotlarni ko‘rishga ruxsatingiz yo‘q.</p>;
    return (
        <div className="p-4 space-y-4">
            <style>{CHOP_USLUBI}</style>
            <div className="chop-yoq flex gap-1 bg-ichki p-1 rounded-xl border border-chiziq w-full sm:w-fit max-w-full overflow-x-auto no-scrollbar" role="tablist">
                {mavjud.map(m => (
                    <button key={m.id} role="tab" aria-selected={joriy === m.id} onClick={() => setVaraq(m.id)}
                        className={`px-3.5 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${joriy === m.id ? 'bg-sirt text-brand shadow-sm border border-chiziq' : 'text-matn-sokin hover:text-matn'}`}>
                        {m.nom}
                    </button>
                ))}
            </div>
            {joriy === 'kunlik' && <KunlikVaraq />}
            {joriy === 'oylik' && <OylikVaraq />}
            {joriy === 'qarz' && <QarzVaraq />}
            {joriy === 'ustoz' && <UstozVaraq />}
        </div>
    );
}
