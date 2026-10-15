import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Check, Loader2, AlertTriangle, SlidersHorizontal, Shuffle } from 'lucide-react';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, Tanlov, INPUT, SELECT, Yuklanmoqda } from '../ui';
import { SavolKartasi, SavolOynasi } from './SavolKartasi';
import { QIYINLIK, useQiyinlik } from './qiyinlik';
import { bolimlarga } from './useBankDaraxt';
import BoshqaFiltrlar, { boshqaFiltrSoni } from './BoshqaFiltrlar';
import { BOSH_SARALASH, saralashdanSorov, TABLETKA, type BankQatori, type Saralash } from './bankTurlari';
import { TUR_NOMI } from '../../../lib/savolTuri';
import { SAVOL_TURLARI } from '../../../../lib/imtihon.js';
import type { BankDaraxt, BankFan, BankFiltrMalumoti, Question, SavolTuri } from '../../../types';

// Bankdan aniq savollarni tanlash: fan → mavzu, qiyinlik va bank ro'yxatidagi HAMMA filtrlar
// (BoshqaFiltrlar paneli; «Holati» yo'q — bu yerda faqat faol savollar) hamda qidiruv bo'yicha.
// Ro'yxat bank ekrani bilan bir xil (GET bank/royxat, saralashdanSorov), filtrlar serverda —
// fanda minglab savol bo'lsa ham. «Tasodifiy tanlash» — joriy filtrga mos HAMMA savoldan
// (yuklanganlaridan emas) N tasini serverda tanlaydi. Ikki joyda ishlatiladi:
//  • imtihon bloki («Aniq savollarni tanlash») — tanlov to'liq ro'yxat bo'lib qaytadi;
//  • andoza («Savol qo'shish», `qoshish`) — andozadagi savollar belgilangan turadi, faqat
//    yangilari qaytadi; sig'masa tugma savollar sonini bir bosishda oshiradi.
// Bitta matnga bog'langan savollar va guruhli savol (MS-33-35, MS-36-45) birga tanlanadi.

/** Tanlangan savolning guruhi: umumiy shart (matn) id si va javobi son ekani (qismli savolda skaner tekshira oladi). */
export type TanlovGuruhi = { pa: number | null; son: boolean };

/** Andozaga qo'shish rejimi. */
export interface AndozagaTanlash {
  /** Andoza nomi (sarlavhada). */
  nom: string;
  /** Andozadagi savollar — belgilangan ko'rinadi, qayta tanlanmaydi. */
  bor: number[];
  /** Andozaga nechta savol kerak va hozir nechta bor (imtihon sanaganidek). */
  soni: number;
  joriy: number;
}

/** Server tasodifiy tanlagan savol: turi, guruhi va mavzusi (tanlov ro'yxati shundan to'ldiriladi). */
interface TasodifiyQator { id: number; type: SavolTuri; passageId: number | null; hasAnswers: boolean; bankTopicId: number | null }

const SAHIFA = 60;
/** Tasodifiy tanlashda bir martada eng ko'pi (server ham shuncha bilan cheklaydi) va boshlang'ich son. */
const TASODIFIY_MAX = 200;
const TASODIFIY_BOSH = 5;
/** Tasodifiy tanlashda serverga yuboriladigan «olinmasin» ro'yxatining chegarasi (URL uzunligi uchun). */
const ISTISNO_MAX = 1500;
const GURUHLI: SavolTuri[] = ['juft', 'qismli'];
const guruhlimi = (q: Question) => GURUHLI.includes(q.type);

export default function SavolTanlash({ fan: boshFan, daraxt, tanlangan: bosh, onTanla, onYop, qoshish, band }: {
  fan: BankFan | null; daraxt: BankDaraxt; tanlangan: number[];
  /** `kengaytir` — andoza rejimida: tanlov sig'maydi, savollar soni oshirilsin. */
  onTanla: (ids: number[], turlar: Record<number, SavolTuri>, guruhlar: Record<number, TanlovGuruhi>, kengaytir?: boolean) => void;
  onYop: () => void; qoshish?: AndozagaTanlash; band?: boolean;
}) {
  const { soro } = useImtihonApi();
  useQiyinlik();
  const [fanId, setFanId] = useState<number | null>(() => boshFan?.id ?? daraxt.fanlar.find(f => f.faol > 0)?.id ?? daraxt.fanlar[0]?.id ?? null);
  const fan = daraxt.fanlar.find(f => f.id === fanId) || boshFan;
  const [mavzuId, setMavzuId] = useState<number | null>(null);
  // Saralash — bank ro'yxatidagi bilan bir xil (holat doim faol: saralashdanSorov ga majburlanadi).
  const [s, setS] = useState<Saralash>(BOSH_SARALASH);
  const [tartib, setTartib] = useState<'asc' | 'desc'>('desc');
  const [filtr, setFiltr] = useState<BankFiltrMalumoti | null>(null);
  const [filtrOchiq, setFiltrOchiq] = useState(false);
  const [qidiruv, setQidiruv] = useState('');
  const [izlash, setIzlash] = useState('');
  const [savollar, setSavollar] = useState<Question[] | null>(null);
  const [jami, setJami] = useState(0);
  const [sahifa, setSahifa] = useState(1);
  const [yanaYuklanmoqda, setYanaYuklanmoqda] = useState(false);
  const [tanlangan, setTanlangan] = useState<Set<number>>(() => new Set(bosh));
  const [korish, setKorish] = useState<Question | null>(null);
  const [korishYuklanmoqda, setKorishYuklanmoqda] = useState<number | null>(null);
  // Tasodifiy tanlash: nechta, qaysi savollar tasodifiy tanlangan (qayta bosilsa shular almashadi) va xabar.
  const [tasodifiySoni, setTasodifiySoni] = useState(String(TASODIFIY_BOSH));
  const [tasodifiy, setTasodifiy] = useState<Set<number>>(new Set());
  const [tasodifiyBand, setTasodifiyBand] = useState(false);
  const [tasodifiyXabar, setTasodifiyXabar] = useState<{ matn: string; xato?: boolean } | null>(null);
  // Guruhni tanlab bo'lmaslik sababi (umumiy shart id si bo'yicha) va tekshirilayotgan guruh.
  const [tosiq, setTosiq] = useState<Record<number, string>>({});
  const [kutilmoqda, setKutilmoqda] = useState<number | null>(null);
  // Ko'rilgan savollarning turi, guruhi va mavzusi — tanlanganlar imtihonda turi bo'yicha qatorlarga bo'linadi.
  const turlar = useRef<Record<number, SavolTuri>>({});
  const guruhlar = useRef<Record<number, TanlovGuruhi>>({});
  const mavzusi = useRef<Record<number, number>>({});
  const azolarKeshi = useRef(new Map<number, Promise<Question[]>>());
  const navbat = useRef(0);
  const borlar = useMemo(() => new Set(qoshish?.bor || []), [qoshish?.bor]);

  const eslab = useCallback((l: Question[]) => l.forEach(q => {
    turlar.current[q.id] = q.type;
    guruhlar.current[q.id] = { pa: q.passageId ?? null, son: Array.isArray(q.answers) && q.answers.length > 0 };
    if (q.bankTopicId) mavzusi.current[q.id] = q.bankTopicId;
  }), []);

  // Qidiruv — yozish to'xtagach.
  useEffect(() => {
    const t = setTimeout(() => setIzlash(qidiruv.trim()), 350);
    return () => clearTimeout(t);
  }, [qidiruv]);

  // Fan almashsa — uning filtrlari (sonlari, o'z filtrlari, darajalari) qayta olinadi.
  useEffect(() => {
    setFiltr(null);
    if (!fanId) return;
    let bekor = false;
    soro<BankFiltrMalumoti>('GET', `bank/filtr?fanId=${fanId}`).then(f => { if (!bekor) setFiltr(f); }).catch(() => { /* panel sonsiz qoladi */ });
    return () => { bekor = true; };
  }, [fanId, soro]);

  // Bank ro'yxati bilan bir xil filtr JSON (holat — faqat faol).
  const filtrSorovi = useMemo(
    () => saralashdanSorov({ ...s, qidiruv: izlash }, fanId ?? undefined, mavzuId ? { tur: 'mavzu', id: mavzuId } : { tur: 'hamma' }, 'faol'),
    [s, izlash, fanId, mavzuId],
  );
  const sorov = useCallback(
    (n: number) => soro<{ items: BankQatori[]; total: number }>('GET', `bank/royxat?f=${filtrSorovi}&sahifa=${n}&soni=${SAHIFA}&tartib=${tartib}`)
      // Ro'yxat qatori kartaga kerakli maydonlarni beradi (subject, schoolId kabi kerakmaslari yo'q).
      .then(r => ({ items: r.items as unknown as Question[], total: r.total })),
    [filtrSorovi, tartib, soro],
  );

  useEffect(() => {
    if (!fanId) { setSavollar([]); setJami(0); return; }
    const n = ++navbat.current;
    setSavollar(null);
    setSahifa(1);
    sorov(1).then(r => {
      if (n !== navbat.current) return;
      eslab(r.items);
      setSavollar(r.items);
      setJami(r.total);
    }).catch(() => { if (n === navbat.current) { setSavollar([]); setJami(0); } });
  }, [fanId, sorov, eslab]);

  const yana = async () => {
    const n = navbat.current;
    setYanaYuklanmoqda(true);
    try {
      const r = await sorov(sahifa + 1);
      if (n !== navbat.current) return;
      eslab(r.items);
      setSavollar(l => [...(l || []), ...r.items.filter(q => !(l || []).some(x => x.id === q.id))]);
      setSahifa(x => x + 1);
    } catch { /* ro'yxat o'zicha qoladi — tugma yana bosiladi */ } finally { setYanaYuklanmoqda(false); }
  };

  const yaroqli = useMemo(() => (savollar || []).filter(q => !q.xato), [savollar]);
  const chala = (savollar?.length || 0) - yaroqli.length;

  /** Umumiy shartga (matnga) bog'langan hamma savol — holatidan qat'i nazar. */
  const azolar = (pa: number) => {
    if (!azolarKeshi.current.has(pa)) {
      const p = soro<{ items: Question[] }>('GET', `questions?passageId=${pa}&soni=200`).then(r => { eslab(r.items); return r.items; });
      p.catch(() => azolarKeshi.current.delete(pa));
      azolarKeshi.current.set(pa, p);
    }
    return azolarKeshi.current.get(pa)!;
  };

  const almashtir = (ids: number[], qosh: boolean) => {
    setTanlangan(x => {
      const n = new Set(x);
      ids.forEach(id => (qosh ? n.add(id) : n.delete(id)));
      return n;
    });
    // Qo'lda bosilgan savol endi tasodifiy tanlovga kirmaydi (qayta tasodifiy tanlashda almashtirilmaydi).
    setTasodifiy(x => (ids.some(id => x.has(id)) ? new Set([...x].filter(id => !ids.includes(id))) : x));
  };

  const bos = async (q: Question) => {
    if (borlar.has(q.id) || kutilmoqda != null) return;
    const olib = tanlangan.has(q.id);
    if (!q.passageId) return almashtir([q.id], !olib);
    const pa = q.passageId;
    setKutilmoqda(pa);
    try {
      const hammasi = (await azolar(pa)).filter(x => guruhlimi(x) === guruhlimi(q));
      if (olib) return almashtir(hammasi.map(x => x.id), false);
      if (guruhlimi(q)) {
        // Guruhli savol butunligicha tanlanadi: bir bo'lagi faol bo'lmasa yoki chala bo'lsa — yo'q.
        const sabab = !hammasi.length || hammasi.some(x => x.status !== 'faol' || x.xato) ? "guruhning bir bo'lagi faol emas yoki chala — bankda to'ldiring"
          : q.type === 'qismli' && hammasi.length > 4 ? "4 tadan ko'p qism — imtihon varag'iga sig'maydi" : '';
        if (sabab) return setTosiq(t => ({ ...t, [pa]: sabab }));
        return almashtir(hammasi.map(x => x.id), true);
      }
      // Bitta matnning savollari birga tanlanadi (imtihonga tayyorlari).
      almashtir(hammasi.filter(x => x.status === 'faol' && !x.xato && !borlar.has(x.id)).map(x => x.id), true);
    } catch {
      setTosiq(t => ({ ...t, [pa]: "guruh savollari yuklanmadi — qayta urinib ko'ring" }));
    } finally {
      setKutilmoqda(null);
    }
  };

  /**
   * Tasodifiy tanlash: joriy filtrga mos HAMMA savoldan (server tanlaydi) N tasi. Oldingi tasodifiy
   * tanlov almashtiriladi; qo'lda tanlanganlar va andozadagilar qoladi (qayta olinmaydi).
   * Guruhli savol butunligicha olinadi; N — shu oynadagi hisobda (qismli savol = 1).
   */
  const tasodifiyTanla = async () => {
    const n = Math.min(TASODIFIY_MAX, Math.max(1, parseInt(tasodifiySoni) || 0));
    setTasodifiyBand(true);
    setTasodifiyXabar(null);
    const qolgan = [...tanlangan].filter(id => !tasodifiy.has(id));
    const istisno = [...new Set([...borlar, ...qolgan])].slice(0, ISTISNO_MAX);
    try {
      const r = await soro<{ items: TasodifiyQator[]; soni: number }>('GET', `bank/royxat?f=${filtrSorovi}&tasodifiy=${n}&istisno=${istisno.join(',')}`);
      r.items.forEach(q => {
        turlar.current[q.id] = q.type;
        guruhlar.current[q.id] = { pa: q.passageId ?? null, son: q.hasAnswers };
        if (q.bankTopicId) mavzusi.current[q.id] = q.bankTopicId;
      });
      setTasodifiy(new Set(r.items.map(q => q.id)));
      setTanlangan(new Set([...qolgan, ...r.items.map(q => q.id)]));
      setTasodifiyXabar(r.soni >= n ? { matn: `${r.soni} ta tasodifiy tanlandi` }
        : r.soni > 0 ? { matn: `Filtrga mos savol yetarli emas — ${r.soni} ta topildi` }
          : { matn: "Filtrga mos tayyor savol topilmadi (andozada borlari olinmaydi)", xato: true });
    } catch (e: any) {
      setTasodifiyXabar({ matn: e.message || "Tasodifiy tanlab bo'lmadi", xato: true });
    } finally {
      setTasodifiyBand(false);
    }
  };

  /** «Ko'rish»: to'liq savol (yechimi bilan) olinadi; ruxsat bo'lmasa — ro'yxatdagi ko'rinishi. */
  const korishOch = (q: Question) => {
    setKorishYuklanmoqda(q.id);
    soro<Question>('GET', `questions/${q.id}`).catch(() => q).then(setKorish).finally(() => setKorishYuklanmoqda(null));
  };

  // Mavzular ro'yxatidagi "N ta tanlandi" — mavzusi ma'lum (shu oynada ko'rilgan) savollar bo'yicha.
  const mavzuBoyicha = useMemo(() => {
    const m = new Map<number, number>();
    for (const id of tanlangan) { const k = mavzusi.current[id]; if (k) m.set(k, (m.get(k) || 0) + 1); }
    return m;
  }, [tanlangan, savollar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Imtihon sanaganidek: qismli savolning qismlari — bitta savol.
  const tanlanganSoni = useMemo(() => {
    const qismli = new Set<number>();
    let n = 0;
    for (const id of tanlangan) {
      const pa = guruhlar.current[id]?.pa;
      if (turlar.current[id] === 'qismli' && pa) qismli.add(pa); else n++;
    }
    return n + qismli.size;
  }, [tanlangan]);

  // Bankdagi tayyor savollar soni (daraxtdan): tanlangan mavzu va tur ichida, qiyinlik bo'yicha.
  const soniD = (k: number) => (fan?.mavzular || []).filter(m => !mavzuId || m.id === mavzuId)
    .reduce((a, m) => a + (s.tur ? [s.tur] : SAVOL_TURLARI as SavolTuri[]).reduce((b, t) => b + (m.bor[t]?.[k - 1] || 0), 0), 0);
  // Qiyinlik tablari bitta darajani tanlaydi (bank ro'yxatida — bir nechtasi ham mumkin).
  const d = s.qiyinlik.length === 1 ? s.qiyinlik[0] : 0;
  const filtrSoni = boshqaFiltrSoni(s, { holatsiz: true, ozFiltrlar: true });
  const saralangan = s.qiyinlik.length > 0 || filtrSoni > 0 || !!izlash;
  const tasodifiyMax = Math.max(1, Math.min(TASODIFIY_MAX, jami));

  const boshOrin = qoshish ? Math.max(0, qoshish.soni - qoshish.joriy) : 0;
  const sigmaydi = !!qoshish && tanlanganSoni > boshOrin;
  const fanAlmash = (id: number) => { setFanId(id); setMavzuId(null); setS(BOSH_SARALASH); setTasodifiyXabar(null); };

  return (
    <div className="fixed inset-0 z-[260] flex items-stretch sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={qoshish ? "Andozaga savol qo'shish" : 'Savollarni tanlash'}>
      <div className="fixed inset-0 bg-black/50" onClick={() => !band && onYop()} />
      <div className="relative bg-sirt sm:rounded-2xl shadow-2xl w-full max-w-5xl border border-chiziq flex flex-col h-full sm:h-[86vh]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-chiziq shrink-0">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn truncate">{qoshish ? `Savol qo'shish — ${qoshish.nom}` : `Savollarni tanlash — ${fan?.name || ''}`}</h3>
            <p className="text-[12px] text-matn-xira">{qoshish ? "Bankdan savollarni belgilang — andozaga shu tartibda qo'shiladi" : 'Tanlangan savollar har variantga tushadi (tartibi aralashadi)'}</p>
          </div>
          <button aria-label="Yopish" disabled={band} onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Fan va mavzular */}
          <div className="md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-chiziq md:overflow-y-auto">
            <div className="p-3 space-y-2">
              {qoshish && (
                <select aria-label="Fan" className={SELECT} value={fanId ?? ''} onChange={e => fanAlmash(Number(e.target.value))}>
                  {daraxt.fanlar.map(f => <option key={f.id} value={f.id}>{f.name} ({f.faol})</option>)}
                </select>
              )}
              <select aria-label="Mavzu" className={`${SELECT} md:hidden`} value={mavzuId ?? ''} onChange={e => setMavzuId(Number(e.target.value) || null)}>
                <option value="">Hamma mavzular ({fan?.faol ?? 0})</option>
                {(fan?.mavzular || []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.faol})</option>)}
              </select>
            </div>
            <ul className="hidden md:block pb-2">
              <li>
                <button onClick={() => setMavzuId(null)} aria-current={mavzuId === null ? 'true' : undefined}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-[13px] cursor-pointer ${mavzuId === null ? 'bg-brand-fon/60 dark:bg-brand/15 text-matn font-semibold' : 'text-matn-sokin hover:bg-ichki hover:text-matn'}`}>
                  <span className="truncate">Hamma mavzular</span>
                  <span className="raqam text-[11px] text-matn-xira">{fan?.faol ?? 0}</span>
                </button>
              </li>
              {bolimlarga(fan?.mavzular || []).map(g => (
                <React.Fragment key={`${g.bolim}-${g.mavzular[0].id}`}>
                  {g.bolim && <li className="px-4 pt-3 pb-1 text-[10.5px] font-bold uppercase tracking-wide text-matn-xira">{g.bolim}</li>}
                  {g.mavzular.map(m => {
                    const soni = mavzuBoyicha.get(m.id) || 0;
                    return (
                      <li key={m.id}>
                        <button onClick={() => setMavzuId(m.id)} aria-current={m.id === mavzuId ? 'true' : undefined}
                          className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-[13px] cursor-pointer ${m.id === mavzuId ? 'bg-brand-fon/60 dark:bg-brand/15 text-matn font-semibold' : 'text-matn-sokin hover:bg-ichki hover:text-matn'}`}>
                          <span className="truncate">{m.name}</span>
                          <span className="shrink-0 flex items-center gap-1.5">
                            {soni > 0 && <span className="raqam text-[11px] font-bold px-1.5 rounded-md bg-brand text-brand-ust">{soni}</span>}
                            <span className="raqam text-[11px] text-matn-xira">{m.faol}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </React.Fragment>
              ))}
            </ul>
          </div>

          {/* Savollar. min-h-0: telefonda (ustunlar ustma-ust) ro'yxat o'z ichida aylansin — aks holda pastdagi tugmalar ustiga chiqib ketadi. */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-chiziq shrink-0">
              <Tanlov kichik qiymat={d} onChange={v => setS(x => ({ ...x, qiyinlik: v ? [v] : [] }))} variantlar={[
                { v: 0, nom: 'Hammasi' },
                ...QIYINLIK.filter(q => !q.yashirin || soniD(q.d) > 0 || d === q.d).map(q => ({ v: q.d, nom: <span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${q.nuqta}`} />{q.nom} <span className="raqam text-matn-xira">{soniD(q.d)}</span></span> })),
              ]} />
              <button type="button" onClick={() => setFiltrOchiq(o => !o)} aria-expanded={filtrOchiq} className={`${TABLETKA(filtrOchiq || filtrSoni > 0)} py-1.5`}>
                <SlidersHorizontal size={13} /> Filtrlar{filtrSoni > 0 && <span className="raqam">({filtrSoni})</span>}
              </button>
              <div className="relative flex-1 min-w-40">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
                <input className={`${INPUT} pl-8 py-1.5`} placeholder="Savol matnidan qidirish" aria-label="Savol qidirish" value={qidiruv} onChange={e => setQidiruv(e.target.value)} />
              </div>
            </div>
            {/* Bank ro'yxatidagi bilan bir xil filtrlar (Holati yo'q — faqat faol). Panel o'z ichida aylanadi: ro'yxat ko'rinib turadi. */}
            {filtrOchiq && (
              <div className="shrink-0 max-h-[42vh] overflow-y-auto p-3 border-b border-chiziq bg-ichki/40">
                {filtr ? <BoshqaFiltrlar filtr={filtr} s={s} setS={setS} tartib={tartib} setTartib={setTartib} holatsiz ozFiltrlar /> : <Yuklanmoqda />}
                {filtrSoni > 0 && (
                  <button type="button" onClick={() => setS(x => ({ ...BOSH_SARALASH, qiyinlik: x.qiyinlik }))} className="mt-2 text-[12px] font-semibold text-brand hover:underline cursor-pointer">Filtrlarni tozalash</button>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!savollar ? <Yuklanmoqda /> : !yaroqli.length ? (
                <p className="text-center text-[12.5px] text-matn-xira py-10">{saralangan ? "Filtrga mos savol yo'q" : "Bu yerda imtihonga tayyor (faol) savol yo'q"}</p>
              ) : yaroqli.map(q => {
                const borEdi = borlar.has(q.id);
                const sabab = guruhlimi(q) && q.passageId ? tosiq[q.passageId] : '';
                return (
                  <div key={q.id} className={`flex items-start gap-2 ${borEdi ? 'opacity-60' : ''}`}>
                    <div className="flex-1 min-w-0">
                      {borEdi ? <p className="mb-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-yaxshi"><Check size={12} /> andozada bor</p>
                        : guruhlimi(q) && (sabab
                          ? <p className="mb-0.5 text-[11px] font-semibold text-xato">{TUR_NOMI[q.type]} — tanlab bo'lmaydi: {sabab}</p>
                          : <p className="mb-0.5 text-[11px] font-semibold text-brand-dark dark:text-brand-accent">{TUR_NOMI[q.type]} — bo'laklari birga tanlanadi</p>)}
                      <SavolKartasi q={q} onOch={() => korishOch(q)} tanlash tanlangan={borEdi || tanlangan.has(q.id)} onTanla={() => bos(q)} />
                    </div>
                    <span className="mt-2 w-12 shrink-0 text-right">
                      {(kutilmoqda != null && kutilmoqda === q.passageId) || korishYuklanmoqda === q.id ? <Loader2 size={13} className="inline animate-spin text-matn-xira" />
                        : <button onClick={() => korishOch(q)} className="text-[11.5px] text-matn-xira hover:text-brand cursor-pointer">Ko'rish</button>}
                    </span>
                  </div>
                );
              })}
              {savollar && savollar.length < jami && (
                <div className="flex justify-center pt-1">
                  <Tugma kichik yuklanmoqda={yanaYuklanmoqda} onClick={yana}>Yana ko'rsatish <span className="raqam text-matn-xira">({jami - savollar.length} ta qoldi)</span></Tugma>
                </div>
              )}
              {chala > 0 && <p className="text-[11.5px] text-matn-xira text-center">{chala} ta chala savol ko'rsatilmadi (bankda to'ldirilgach tanlash mumkin)</p>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 border-t border-chiziq shrink-0">
          {qoshish ? (
            <span className="text-[13px] text-matn">
              <b className="raqam">{tanlanganSoni}</b> ta tanlandi <span className="text-matn-xira">· andozada <span className="raqam">{qoshish.joriy} / {qoshish.soni}</span></span>
              {sigmaydi && <span className="ml-2 inline-flex items-center gap-1 text-[12px] font-semibold text-ogoh"><AlertTriangle size={13} /> {boshOrin} ta bo'sh o'rin bor</span>}
            </span>
          ) : <span className="text-[13px] text-matn"><b className="raqam">{tanlangan.size}</b> ta savol tanlandi</span>}
          {fanId != null && (
            <div className="flex flex-col gap-1 basis-full sm:basis-auto">
              <div className="flex flex-wrap items-center gap-2">
                <Shuffle size={14} className="text-matn-xira" aria-hidden />
                <label className="sr-only" htmlFor="tasodifiy-soni">Nechta savol tasodifiy tanlansin</label>
                <input id="tasodifiy-soni" type="number" inputMode="numeric" min={1} max={tasodifiyMax} value={tasodifiySoni}
                  onChange={e => setTasodifiySoni(e.target.value)}
                  onBlur={() => setTasodifiySoni(String(Math.min(tasodifiyMax, Math.max(1, parseInt(tasodifiySoni) || TASODIFIY_BOSH))))}
                  style={{ width: "4.5rem" }} className={`${INPUT} py-1.5 text-center raqam`} />
                <Tugma kichik yuklanmoqda={tasodifiyBand} disabled={band || jami === 0} onClick={tasodifiyTanla}
                  title="Joriy filtrga mos savollardan tasodifiy tanlaydi; qayta bosilsa tasodifiy tanlov almashadi">Tasodifiy tanlash</Tugma>
              </div>
              {tasodifiyXabar && <p role="status" className={`text-[11.5px] font-semibold ${tasodifiyXabar.xato ? 'text-ogoh' : 'text-yaxshi'}`}>{tasodifiyXabar.matn}</p>}
            </div>
          )}
          <div className="flex gap-2">
            <Tugma onClick={onYop} disabled={band}>Bekor</Tugma>
            {qoshish
              ? <Tugma turi="asosiy" yuklanmoqda={band} disabled={!tanlanganSoni} onClick={() => onTanla([...tanlangan], turlar.current, guruhlar.current, sigmaydi)}>
                {sigmaydi ? `Sonni ${qoshish.joriy + tanlanganSoni} ga oshirib, qo'shish` : `Qo'shish${tanlanganSoni ? ` (${tanlanganSoni})` : ''}`}
              </Tugma>
              : <Tugma turi="asosiy" onClick={() => onTanla([...tanlangan], turlar.current, guruhlar.current)}>Tanlash</Tugma>}
          </div>
        </div>
      </div>
      {korish && <SavolOynasi key={korish.id} q={korish} daraxt={daraxt} onYop={() => setKorish(null)} onOzgardi={() => {}} />}
    </div>
  );
}
