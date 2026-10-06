import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Eye, Tags, Trash2, RotateCcw, Sparkles, Eraser, ChevronLeft, ChevronRight, ChevronDown, Loader2, Search, X, Check, SlidersHorizontal, Pencil, Folder, MoreHorizontal } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, Yorliq, Yuklanmoqda, BoshHolat } from '../ui';
import { formulaliHtml, oddiyMatn, SAVOL_MATNI } from '../../../lib/matn';
import { HARFLAR } from '../../../../lib/imtihon.js';
import { BelgilashOynasi, type BelgilashBoshi } from './BankOynalari';
import { SavolOynasi } from './SavolKartasi';
import MoslashJadvali from './MoslashJadvali';
import OxshashKop from './OxshashKop';
import FanKartalari from './FanKartalari';
import { QIYINLIK, qiyinlikniSozla, qiyinlikSozlamasi, useQiyinlik } from './qiyinlik';
import { YonQator, QatorForma, QoshHavola, Katak, KutishQatori, Menyu, MenyuSarlavha, MenyuBand, MenyuChiziq, Xabar, sudrashniBoshla, sudralayotgan } from './BankQismlari';
import type { BankDaraxt, BankFan, BankFiltrMalumoti, BelgiGuruhi, Question, SavolTuri } from '../../../types';

// Savollar banki (egasi bilan maketda kelishilgan ko'rinish, 2026-10-03).
// Fan — tepada yorliq; pastdagi hamma narsa shu fanniki. Chapda tuzilma (bo'lim → mavzu) va
// filtrlar (qiyinlik va foydalanuvchining o'z filtrlari) — hammasi shu joyning o'zida
// yoziladi. O'ngda savollar: har kartadagi yorliq (mavzu, qiyinlik, filtr) bosilsa — o'sha
// yerda o'zgaradi; bir nechtasi belgilansa — pastdagi panel; savolni chapdagi qatorga
// sudrab tashlasa ham bo'ladi.
//
// Amallar ekranda darhol ko'rinadi (mahalliy holat), serverga fonda, navbat bilan
// yoziladi; navbat bo'shagach ro'yxat va sonlar jimgina qayta olinadi. Xato bo'lsa —
// xabar chiqadi va ekran serverdagi holatga qaytadi.

const SAHIFA = 40;
type Holat = '' | 'faol' | 'qoralama' | 'arxiv';
/** Chapdagi tuzilmada nima tanlangan. */
type Tanlov = { tur: 'hamma' } | { tur: 'bolim'; nom: string } | { tur: 'mavzu'; id: number };
interface Saralash {
  qiyinlik: number[]; darajalar: number[]; belgilar: Record<number, number[]>; manbalar: string[];
  toplam: string | null; holat: Holat; tur: '' | SavolTuri; qidiruv: string; qidDan: string; qidGacha: string;
  izohlar: string[]; matnli: '' | 'bor' | 'yoq'; joylashuv: number[];
}
const BOSH: Saralash = { qiyinlik: [], darajalar: [], belgilar: {}, manbalar: [], toplam: null, holat: '', tur: '', qidiruv: '', qidDan: '', qidGacha: '', izohlar: [], matnli: '', joylashuv: [] };
const JOYLASHUV_NOMI: Record<number, string> = { 0: 'Avtomatik', 1: '1 ustun', 2: '2 ustun', 4: '4 ustun' };
const TUR_NOMI: Record<SavolTuri, string> = { yopiq: 'Variantli', raqamli: 'Raqamli javob', moslash: 'Moslashtirish', yozma: 'Yozma' };
const HOLAT_NOMI: Record<Exclude<Holat, ''>, string> = { faol: 'Faol', qoralama: 'Qoralama', arxiv: 'Arxiv' };
const almashtirRoyxat = <K,>(l: K[], k: K) => (l.includes(k) ? l.filter(x => x !== k) : [...l, k]);
const TABLETKA = (faol: boolean) => `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer transition-colors ${faol ? 'bg-brand text-brand-ust border-brand' : 'bg-sirt border-chiziq text-matn-sokin hover:text-matn hover:border-chiziq-kuchli'}`;
const CHIP = 'inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-md border text-[11.5px] font-semibold whitespace-nowrap';
const CHIP_BOR = `${CHIP} border-chiziq bg-ichki text-matn`;
const CHIP_BOSH = `${CHIP} border-dashed border-chiziq-kuchli text-matn-xira`;

type Qator_ = Pick<Question, 'id' | 'text' | 'type' | 'difficulty' | 'status' | 'toplam' | 'source' | 'tagIds' | 'topic' | 'bankTopicId' | 'usedCount' | 'createdAt' | 'imageUrl' | 'options' | 'correctAnswer' | 'answers' | 'points' | 'remark' | 'passageId' | 'joylashuv'>;
type Kesim = NonNullable<BankFiltrMalumoti['kesim']>;
/** Savol(lar)ga qo'yiladigan narsa: mavzu, asosiy daraja, foydalanuvchi darajasi yoki filtr qiymati (null — olib tashlash). */
type Amal = { mavzu: number } | { daraja: number } | { darajaId: number } | { guruh: number; tag: number | null };
type Qosh = { tur: 'fan' } | { tur: 'bolim' } | { tur: 'mavzu'; bolim: string } | { tur: 'daraja' } | { tur: 'filtr' } | { tur: 'qiymat'; guruh: number } | null;
type MenyuTuri = 'fan' | 'savol' | 'mavzu' | 'daraja' | 'guruh' | 'yana';
interface MenyuHolati { tur: MenyuTuri; rect: DOMRect; ids: number[]; guruh?: number }
interface Daraja { kalit: string; nom: string; nuqta: string; d: number; id?: number }

const daraja3 = (d: number) => Math.min(3, Math.max(1, Number(d) || 1));
const birXil = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Savolning mavzu kesimidagi sonlarga hissasi qo'shiladi (+1) yoki olinadi (−1). */
function hissa(kesim: Kesim, q: Pick<Qator_, 'bankTopicId' | 'difficulty' | 'tagIds' | 'status'>, ishora: 1 | -1, darajaIdlar: Set<number>, guruhlar: { id: number; idlar: Set<number> }[]) {
  if (!q.bankTopicId || q.status === 'arxiv') return;
  const k = (kesim[q.bankTopicId] ||= { j: 0, q: [0, 0, 0], b: {}, y: {} });
  const teglar = q.tagIds || [];
  k.j = Math.max(0, k.j + ishora);
  for (const t of teglar) k.b[t] = Math.max(0, (k.b[t] || 0) + ishora);
  if (!teglar.some(t => darajaIdlar.has(t))) { const i = daraja3(q.difficulty) - 1; k.q[i] = Math.max(0, k.q[i] + ishora); }
  for (const g of guruhlar) if (!teglar.some(t => g.idlar.has(t))) k.y[g.id] = Math.max(0, (k.y[g.id] || 0) + ishora);
}

export default function BankJadvali({ daraxt, fanId, onFan, yangilaDaraxt, onQosh, onTuzilma, savolTahrir, yangilash = 0, yangi, onYangi }: {
  daraxt: BankDaraxt; fanId: number | null; onFan: (id: number) => void; yangilaDaraxt: () => Promise<unknown> | void;
  /** «Savol qo'shish» — tanlangan mavzu oldindan qo'yiladi (nomi bilan: hozirgina yaratilgan mavzu daraxtda hali bo'lmasligi mumkin). */
  onQosh?: (mavzu: { id: number; nom: string } | null) => void; onTuzilma: () => void; savolTahrir: boolean;
  /** Tashqarida bank o'zgardi (savol qo'shildi) — ro'yxat jimgina qayta olinadi. */
  yangilash?: number;
  /** Hozirgina qo'shilgan savollar: ro'yxat ularga o'tadi, «yangi» belgisi bilan. */
  yangi?: { ids: number[]; n: number } | null;
  /** Shu ekranning o'zida savol qo'shildi (o'xshash masalalar) — `yangi` bo'lib qaytadi. */
  onYangi?: (ids: number[]) => void;
}) {
  const { ozgartira, showNotification } = useCRM();
  const ochiradi = ozgartira('imtihonlar.ochirish');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const fan = daraxt.fanlar.find(f => f.id === fanId) || daraxt.fanlar[0] || null;
  useQiyinlik();   // darajalar nomi yoki soni o'zgarsa — qayta chiziladi

  const [filtr, setFiltr] = useState<BankFiltrMalumoti | null>(null);
  const [tanlov, setTanlov] = useState<Tanlov>({ tur: 'hamma' });
  const [s, setS] = useState<Saralash>(BOSH);
  const [tartib, setTartib] = useState<'asc' | 'desc'>('asc');
  const [sahifa, setSahifa] = useState(1);
  const [royxat, setRoyxat] = useState<{ items: Qator_[]; total: number } | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [tanlangan, setTanlangan] = useState<Set<number>>(new Set());
  const [qayta, setQayta] = useState(0);
  const [belgilash, setBelgilash] = useState(false);
  // Bankdagi savol(lar)ga o'xshash masala tuzish oynasi — asl savollar id lari.
  const [oxshash, setOxshash] = useState<number[] | null>(null);
  const [ochiq, setOchiq] = useState<Question | null>(null);
  const [band, setBand] = useState<string | null>(null);
  // Serverga yozilayotgan yangi qatorlar (nomi darhol ko'rinadi).
  const [kutilmoqda, setKutilmoqda] = useState<{ joy: string; nom: string }[]>([]);
  const [qosh, setQosh] = useState<Qosh>(null);
  const [filtrTahrir, setFiltrTahrir] = useState<number | null>(null);
  const [menyu, setMenyu] = useState<MenyuHolati | null>(null);
  const [yopiq, setYopiq] = useState<Set<string>>(new Set());
  const [yonOchiq, setYonOchiq] = useState(false);
  const [boshqa, setBoshqa] = useState(false);
  const [sudrash, setSudrash] = useState<'savol' | 'mavzu' | null>(null);
  const [chaqnash, setChaqnash] = useState<string | null>(null);
  const [xabar, setXabar] = useState<{ matn: string; ortga?: () => void; n: number } | null>(null);
  const [yangiIdlar, setYangiIdlar] = useState<Set<number>>(new Set());
  const navbat = useRef<Promise<unknown>>(Promise.resolve());
  const navbatSoni = useRef(0);
  const versiya = useRef(0);
  const jim = useRef(false);
  // Fan almashganda qo'yiladigan tanlov (yangi savollar boshqa fanga tushgan bo'lsa).
  const kechikkan = useRef<{ tanlov: Tanlov; s: Saralash } | null>(null);

  // Fan almashsa — tanlov va saralash boshidan.
  useEffect(() => {
    const k = kechikkan.current;
    kechikkan.current = null;
    setTanlov(k?.tanlov || { tur: 'hamma' }); setS(k?.s || BOSH); if (k) setTartib('asc');
    setTanlangan(new Set()); setSahifa(1); setFiltr(null); setQosh(null); setMenyu(null); setFiltrTahrir(null); setYopiq(new Set());
  }, [fan?.id]);

  const fanIdRef = useRef(fan?.id);
  fanIdRef.current = fan?.id;
  const daraxtRef = useRef(daraxt);
  daraxtRef.current = daraxt;
  const filtrniYukla = useCallback(async () => {
    if (!fan) return;
    const v = versiya.current;
    try {
      const f = await soro<BankFiltrMalumoti>('GET', `bank/filtr?fanId=${fan.id}`);
      // Javob kelguncha yangi amal boshlangan bo'lsa — eskirgan, navbat bo'shagach qayta olinadi;
      // bu orada boshqa fan tanlangan bo'lsa — bu javob endi kerak emas.
      if (versiya.current === v && f.fan.id === fanIdRef.current) setFiltr(f);
    } catch (e: any) { showNotification(e.message, 'error'); }
  }, [fan?.id, soro]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { filtrniYukla(); }, [filtrniYukla, qayta]);

  useEffect(() => { if (yangilash) { jim.current = true; setQayta(n => n + 1); } }, [yangilash]);

  // Hozirgina qo'shilgan savollar: faqat o'shalar ko'rsatiladi, fayldagi tartibda (1 dan).
  // Hammasi bitta mavzuda bo'lsa — o'sha mavzu ochiladi, aks holda — butun fan.
  useEffect(() => {
    if (!yangi?.ids.length) return;
    let bekor = false;
    setYangiIdlar(new Set(yangi.ids));
    soro<{ mavzular: Record<number, number> }>('POST', 'bank/tanlov-holati', { ids: yangi.ids }).then(r => {
      if (bekor) return;
      const mavzuIdlar = Object.keys(r.mavzular).map(Number);
      if (!mavzuIdlar.length) return;
      const yangilari: Saralash = { ...BOSH, qidDan: String(Math.min(...yangi.ids)), qidGacha: String(Math.max(...yangi.ids)) };
      const holat = { tanlov: (mavzuIdlar.length === 1 ? { tur: 'mavzu', id: mavzuIdlar[0] } : { tur: 'hamma' }) as Tanlov, s: yangilari };
      const egasi = daraxtRef.current.fanlar.find(f => f.mavzular.some(m => m.id === mavzuIdlar[0]));
      if (egasi && egasi.id !== fanIdRef.current) { kechikkan.current = holat; onFan(egasi.id); return; }
      setTanlov(holat.tanlov); setS(holat.s); setTartib('asc'); setTanlangan(new Set());
    }).catch(() => { /* ro'yxat o'z joyida qoladi */ });
    return () => { bekor = true; };
  }, [yangi?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorov = useMemo(() => encodeURIComponent(JSON.stringify({
    fanId: fan?.id, qidDan: s.qidDan || undefined, qidGacha: s.qidGacha || undefined, holat: s.holat || undefined,
    bolimlar: tanlov.tur === 'bolim' ? [tanlov.nom] : undefined, mavzular: tanlov.tur === 'mavzu' ? [tanlov.id] : [],
    qiyinlik: s.qiyinlik, darajalar: s.darajalar, qiyinlikSof: true, manbalar: s.manbalar, belgilar: s.belgilar,
    toplam: s.toplam ?? undefined, tur: s.tur || undefined, qidiruv: s.qidiruv.trim() || undefined,
    izohlar: s.izohlar, matnli: s.matnli || undefined, joylashuv: s.joylashuv,
  })), [fan?.id, tanlov, s]);

  useEffect(() => { setSahifa(1); }, [sorov, tartib]);
  useEffect(() => {
    if (!fan) { setRoyxat(null); return; }
    let bekor = false;
    // Fondagi sinxronlash jim o'tadi (ro'yxat xiralashmaydi).
    const jimmi = jim.current;
    jim.current = false;
    if (!jimmi) setYuklanmoqda(true);
    const kut = setTimeout(() => {
      const v = versiya.current;
      soro<{ items: Qator_[]; total: number }>('GET', `bank/royxat?f=${sorov}&sahifa=${sahifa}&soni=${SAHIFA}&tartib=${tartib}`)
        .then(r => { if (!bekor && versiya.current === v) setRoyxat(r); })
        .catch(e => { if (!bekor) showNotification(e.message, 'error'); })
        .finally(() => { if (!bekor) setYuklanmoqda(false); });
    }, jimmi ? 0 : 250);
    return () => { bekor = true; clearTimeout(kut); };
  }, [sorov, sahifa, tartib, qayta, fan?.id, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sudrash boshlanganda chapdagi qatorlar "shu yerga tashlang" ko'rinishini oladi.
  useEffect(() => {
    const boshla = () => setSudrash(sudralayotgan()?.tur || null);
    const tugat = () => { sudrashniBoshla(null); setSudrash(null); };
    document.addEventListener('dragstart', boshla);
    document.addEventListener('dragend', tugat);
    document.addEventListener('drop', tugat);
    return () => { document.removeEventListener('dragstart', boshla); document.removeEventListener('dragend', tugat); document.removeEventListener('drop', tugat); };
  }, []);

  useEffect(() => {
    if (!xabar) return;
    const kut = setTimeout(() => setXabar(x => (x?.n === xabar.n ? null : x)), xabar.ortga ? 7000 : 3500);
    return () => clearTimeout(kut);
  }, [xabar]);
  const xabarBer = (matn: string, ortga?: () => void) => setXabar({ matn, ortga, n: Date.now() + Math.random() });

  const ozgardi = () => { setQayta(n => n + 1); yangilaDaraxt(); };
  /**
   * Fondagi amal: ekran allaqachon o'zgargan, serverga navbat bilan yoziladi (bo'limlar
   * ro'yxati kabi "o'qib-yozish" amallari bir-birini bosib ketmasin). Navbat bo'shagach —
   * jim sinxronlash; xato bo'lsa xabar va serverdagi holat qaytadi.
   */
  const fonda = (f: () => Promise<unknown>) => {
    navbatSoni.current++;
    versiya.current++;
    navbat.current = navbat.current.then(f).catch((e: any) => showNotification(e?.message || 'Xatolik', 'error')).finally(() => {
      navbatSoni.current--;
      if (!navbatSoni.current) { jim.current = true; setQayta(n => n + 1); yangilaDaraxt(); }
    });
  };
  const filtrda = (f: (x: BankFiltrMalumoti) => BankFiltrMalumoti) => setFiltr(x => (x ? f(x) : x));
  const kutishQosh = (joy: string, nom: string) => setKutilmoqda(l => [...l, { joy, nom }]);
  const kutishOl = (joy: string, nom: string) => setKutilmoqda(l => { const i = l.findIndex(x => x.joy === joy && x.nom === nom); return i < 0 ? l : l.filter((_, j) => j !== i); });
  const kutayotganlar = (joy: string) => kutilmoqda.filter(x => x.joy === joy).map((x, i) => <KutishQatori key={`k${i}`} nom={x.nom} />);
  const kutadi = (joy: string, nom: string) => kutilmoqda.some(k => k.joy === joy && birXil(k.nom, nom));
  const chaqna = (kalit: string) => { setChaqnash(kalit); setTimeout(() => setChaqnash(k => (k === kalit ? null : k)), 1100); };
  /** Server javobi kutiladigan amal: xato bo'lsa xabar chiqadi va `false` qaytadi (maydon yopilmaydi). */
  const amal = async (f: () => Promise<void>): Promise<boolean> => {
    try { await f(); return true; } catch (e: any) { showNotification(e.message, 'error'); return false; }
  };
  const bor = (nom: string) => { showNotification(`«${nom}» allaqachon bor`, 'error'); return false; };

  // --- Tuzilma va sonlar -------------------------------------------------------
  const mavzular = filtr?.mavzular || [];
  const bolimNomlari = useMemo(() => (filtr?.bolimlar || []).map(b => b.nom).filter(Boolean), [filtr]);
  const guruhlar = filtr?.guruhlar || [];
  const darajalar = filtr?.darajalar || [];
  const kesim: Kesim = filtr?.kesim || {};
  const mavzuNomi = useMemo(() => new Map((filtr?.mavzular || []).map(m => [m.id, m.nom])), [filtr]);
  const darajaIdlar = useMemo(() => new Set((filtr?.darajalar || []).map(d => d.id)), [filtr]);
  const guruhTeglari = useMemo(() => (filtr?.guruhlar || []).map(g => ({ id: g.id, idlar: new Set(g.tags.map(x => x.id)) })), [filtr]);
  const mavzuSoni = (id: number) => kesim[id]?.j || 0;
  const bolimMavzulari = (nom: string) => mavzular.filter(m => birXil(m.bolim, nom));
  const yakkaMavzular = mavzular.filter(m => !m.bolim || !bolimNomlari.some(b => birXil(b, m.bolim)));
  const fanJami = mavzular.reduce((a, m) => a + mavzuSoni(m.id), 0);
  const tanlanganMavzu = tanlov.tur === 'mavzu' ? mavzular.find(m => m.id === tanlov.id) || null : null;
  const qoshMavzu = tanlanganMavzu ? { id: tanlanganMavzu.id, nom: tanlanganMavzu.nom } : null;

  // Filtr sonlari — chapda tanlangan joy (fan, bo'lim yoki mavzu) ichida.
  const yig = useMemo(() => {
    const idlar = tanlov.tur === 'mavzu' ? [tanlov.id] : (filtr?.mavzular || []).filter(m => tanlov.tur === 'hamma' || birXil(m.bolim, tanlov.nom)).map(m => m.id);
    const y = { j: 0, q: [0, 0, 0], b: {} as Record<number, number>, y: {} as Record<number, number> };
    for (const id of idlar) {
      const k = filtr?.kesim?.[id];
      if (!k) continue;
      y.j += k.j;
      k.q.forEach((n, i) => { y.q[i] += n; });
      for (const [t, n] of Object.entries(k.b)) y.b[Number(t)] = (y.b[Number(t)] || 0) + n;
      for (const [g, n] of Object.entries(k.y)) y.y[Number(g)] = (y.y[Number(g)] || 0) + n;
    }
    return y;
  }, [tanlov, filtr]);
  const fanBelgiSoni = (id: number) => Object.values(kesim).reduce((a, k) => a + (k.b[id] || 0), 0);

  // Qiyinlik darajalari bitta ro'yxat bo'lib ko'rinadi: asosiy uchtasi (olib tashlanganlarisiz)
  // va foydalanuvchi qo'shganlari — osondan qiyinga.
  const darajaRoyxati: Daraja[] = QIYINLIK.flatMap(q => [
    ...(q.yashirin ? [] : [{ kalit: `q${q.d}`, nom: q.nom, nuqta: q.nuqta, d: q.d as number }]),
    ...darajalar.filter(x => daraja3(x.asos) === q.d).map(x => ({ kalit: `t${x.id}`, nom: x.name, nuqta: q.nuqta, d: q.d as number, id: x.id })),
  ]);
  const savolDarajasi = (q: Pick<Qator_, 'difficulty' | 'tagIds'>): Daraja => {
    const t = (q.tagIds || []).find(id => darajaIdlar.has(id));
    const oz = t ? darajalar.find(d => d.id === t) : null;
    const asos = QIYINLIK[daraja3(oz ? oz.asos : q.difficulty) - 1];
    return oz ? { kalit: `t${oz.id}`, nom: oz.name, nuqta: asos.nuqta, d: asos.d, id: oz.id } : { kalit: `q${asos.d}`, nom: asos.nom, nuqta: asos.nuqta, d: asos.d };
  };

  // --- Tanlash -------------------------------------------------------------------
  const sahifadagi = royxat?.items.map(q => q.id) || [];
  const sahifaTanlangan = sahifadagi.length > 0 && sahifadagi.every(id => tanlangan.has(id));
  const almashtir = useCallback((id: number) => setTanlangan(x => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  // «Hammasini tanlash» — ro'yxatdagi hamma savol (boshqa sahifadagilari ham); yana bosilsa — tanlov olinadi.
  const kopSahifa = !!royxat && royxat.total > sahifadagi.length;
  const hammasiTanlangan = sahifaTanlangan && (!kopSahifa || tanlangan.size >= (royxat?.total || 0));
  const hammasiniTanla = async () => {
    if (hammasiTanlangan) { setTanlangan(new Set()); return; }
    if (!kopSahifa) { setTanlangan(x => new Set([...x, ...sahifadagi])); return; }
    setBand('tanla');
    try {
      const r = await soro<{ ids: number[] }>('GET', `bank/royxat?f=${sorov}&idlar=1&tartib=${tartib}`);
      setTanlangan(new Set(r.ids));
    } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(null); }
  };
  const ids = [...tanlangan];

  const korish = useCallback((id: number) => {
    setBand('korish');
    soro<Question>('GET', `questions/${id}`).then(setOchiq).catch(e => showNotification(e.message, 'error')).finally(() => setBand(null));
  }, [soro]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Biriktirish: savol(lar)ga mavzu, daraja yoki filtr qiymatini qo'yish ------------
  const qolla = (q: Qator_, a: Amal): Qator_ => {
    if ('mavzu' in a) return { ...q, bankTopicId: a.mavzu, topic: mavzuNomi.get(a.mavzu) || q.topic };
    const teglar = q.tagIds || [];
    if ('daraja' in a) return { ...q, difficulty: a.daraja, tagIds: teglar.filter(x => !darajaIdlar.has(x)) };
    if ('darajaId' in a) return { ...q, difficulty: darajalar.find(d => d.id === a.darajaId)?.asos || q.difficulty, tagIds: [...teglar.filter(x => !darajaIdlar.has(x)), a.darajaId] };
    const g = guruhTeglari.find(x => x.id === a.guruh)?.idlar;
    return { ...q, tagIds: [...teglar.filter(x => !g?.has(x)), ...(a.tag ? [a.tag] : [])] };
  };
  /** Savolning shu amal o'zgartiradigan joyidagi hozirgi qiymati (bekor qilish uchun). */
  const eskiAmal = (q: Qator_, a: Amal): Amal => {
    if ('mavzu' in a) return { mavzu: q.bankTopicId || 0 };
    if ('daraja' in a || 'darajaId' in a) { const d = savolDarajasi(q); return d.id ? { darajaId: d.id } : { daraja: d.d }; }
    const g = guruhTeglari.find(x => x.id === a.guruh)?.idlar;
    return { guruh: a.guruh, tag: (q.tagIds || []).find(x => g?.has(x)) ?? null };
  };
  const amalKaliti = (a: Amal) => ('mavzu' in a ? `m${a.mavzu}` : 'daraja' in a ? `q${a.daraja}` : 'darajaId' in a ? `t${a.darajaId}` : `t${a.tag}`);
  const amalTanasi = (a: Amal) => ('mavzu' in a ? { bankTopicId: a.mavzu } : 'daraja' in a ? { difficulty: a.daraja } : 'darajaId' in a ? { darajaId: a.darajaId } : { guruhlar: [{ groupId: a.guruh, tagIds: a.tag ? [a.tag] : [] }] });
  const amalMatni = (n: number, a: Amal) => {
    if ('mavzu' in a) return `${n} ta savol «${mavzuNomi.get(a.mavzu) || 'mavzu'}» mavzusiga o'tkazildi`;
    if ('daraja' in a) return `${n} ta savol: qiyinlik — «${QIYINLIK[daraja3(a.daraja) - 1].nom}»`;
    if ('darajaId' in a) return `${n} ta savol: qiyinlik — «${darajalar.find(d => d.id === a.darajaId)?.name || 'daraja'}»`;
    const g = guruhlar.find(x => x.id === a.guruh);
    const t = g?.tags.find(x => x.id === a.tag);
    return `${n} ta savol: ${g?.name || 'filtr'} — ${t ? `«${t.name}»` : 'olib tashlandi'}`;
  };
  const royxatRef = useRef(royxat);
  royxatRef.current = royxat;
  const biriktir = (idlar: number[], a: Amal, tanlovi?: { ortgasiz?: boolean }) => {
    if (!idlar.length || !savolTahrir) return;
    setMenyu(null);
    if ('mavzu' in a && !a.mavzu) return;
    const set = new Set(idlar);
    const ekranda = (royxatRef.current?.items || []).filter(q => set.has(q.id));
    const yangilar = new Map(ekranda.map(q => [q.id, qolla(q, a)]));
    // Boshqa mavzuga o'tgan savol hozirgi ro'yxatdan chiqadi.
    const chiqadi = (q: Qator_) => 'mavzu' in a && tanlov.tur !== 'hamma' && set.has(q.id)
      && (tanlov.tur === 'mavzu' ? tanlov.id !== a.mavzu : !bolimMavzulari(tanlov.nom).some(m => m.id === a.mavzu));
    setRoyxat(r => {
      if (!r) return r;
      const qoladi = r.items.filter(q => !chiqadi(q));
      const chiqdi = r.items.length - qoladi.length;
      // Ekrandagilar chiqqan bo'lsa — tanlovning qolgani (boshqa sahifadagilari) ham shu ro'yxatdan chiqadi.
      return { items: qoladi.map(q => yangilar.get(q.id) || q), total: Math.max(qoladi.length, r.total - (chiqdi ? Math.max(chiqdi, idlar.length) : 0)) };
    });
    filtrda(x => {
      const k: Kesim = JSON.parse(JSON.stringify(x.kesim || {}));
      for (const q of ekranda) { hissa(k, q, -1, darajaIdlar, guruhTeglari); hissa(k, yangilar.get(q.id)!, 1, darajaIdlar, guruhTeglari); }
      return { ...x, kesim: k };
    });
    chaqna(amalKaliti(a));
    fonda(() => soro('PUT', 'questions/bulk', { ids: idlar, ...amalTanasi(a) }));
    if (tanlovi?.ortgasiz) return;
    // Bekor qilish: hamma savol ekranda bo'lsa (avvalgi qiymati ma'lum) — har biri o'z joyiga qaytadi.
    let ortga: (() => void) | undefined;
    if (ekranda.length === idlar.length) {
      const eski = new Map<string, { a: Amal; ids: number[] }>();
      for (const q of ekranda) {
        const e = eskiAmal(q, a), k = JSON.stringify(e);
        if (!eski.has(k)) eski.set(k, { a: e, ids: [] });
        eski.get(k)!.ids.push(q.id);
      }
      ortga = () => { for (const e of eski.values()) biriktirRef.current(e.ids, e.a, { ortgasiz: true }); xabarBer('Bekor qilindi'); };
    }
    xabarBer(amalMatni(idlar.length, a), ortga);
  };
  const biriktirRef = useRef(biriktir);
  biriktirRef.current = biriktir;

  // Kartochka sudralganda: tanlanganlar ichida bo'lsa — hammasi, bo'lmasa o'zi.
  const tanlanganRef = useRef(tanlangan);
  tanlanganRef.current = tanlangan;
  const sudra = useCallback((id: number, e: React.DragEvent) => {
    const x = tanlanganRef.current;
    const idlar = x.has(id) ? [...x] : [id];
    sudrashniBoshla({ tur: 'savol', ids: idlar });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idlar.map(y => `#${y}`).join(' '));
    const rasm = document.createElement('div');
    rasm.textContent = `${idlar.length} ta savol`;
    rasm.style.cssText = 'position:fixed;top:-200px;left:-200px;padding:7px 14px;border-radius:999px;background:var(--color-brand);color:var(--color-brand-ust,#fff);font:700 13px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.25)';
    document.body.appendChild(rasm);
    e.dataTransfer.setDragImage(rasm, 12, 14);
    setTimeout(() => rasm.remove(), 0);
  }, []);
  const kartaMenyu = useCallback((tur: MenyuTuri, el: HTMLElement, id: number, guruh?: number) => setMenyu({ tur, rect: el.getBoundingClientRect(), ids: [id], guruh }), []);
  const tanla = (t: Tanlov) => { setTanlov(t); setYonOchiq(false); };

  // --- Fan -------------------------------------------------------------------------
  const fanQosh = (nom: string) => {
    if (daraxt.fanlar.some(f => birXil(f.name, nom)) || kutadi('fan', nom)) return bor(nom);
    kutishQosh('fan', nom);
    fonda(async () => {
      try {
        const f = await soro<{ id: number; name: string }>('POST', 'bank/fanlar', { name: nom });
        await yangilaDaraxt();
        onFan(f.id);
        xabarBer(`«${f.name}» fani qo'shildi. Endi bo'lim va mavzularini yozing`);
      } finally { kutishOl('fan', nom); }
    });
    return true;
  };
  const fanNomi = (f: BankFan, nom: string) => amal(async () => {
    await soro('PUT', `bank/fanlar/${f.id}`, { name: nom });
    await yangilaDaraxt();
    setQayta(n => n + 1);
  });
  const fanOchir = async (f: BankFan) => {
    setMenyu(null);
    if (f.jami > 0) return showNotification(`«${f.name}» fanida ${f.jami} ta savol bor — avval ularni o'chiring yoki boshqa fanga o'tkazing`, 'error');
    if (!(await confirm({ title: `«${f.name}» fani o'chirilsinmi?`, message: "Fanning bo'lim, mavzu va o'z filtrlari ham o'chadi.", confirmLabel: "O'chirish", danger: true }))) return;
    await amal(async () => {
      await soro('DELETE', `bank/fanlar/${f.id}`);
      // O'chirish tugaguncha boshqa fan tanlangan bo'lsa — tanlovga tegilmaydi.
      if (fanIdRef.current === f.id) onFan(0);
      await yangilaDaraxt();
    });
  };

  // --- Bo'lim va mavzu ---------------------------------------------------------------
  const bolimlarni = (x: BankFiltrMalumoti, nomlar: string[]): BankFiltrMalumoti => ({ ...x, bolimlar: nomlar.filter(Boolean).map(nom => ({ nom, soni: 0 })) });
  const bolimQosh = (nom: string) => {
    if (bolimNomlari.some(b => birXil(b, nom))) return bor(nom);
    filtrda(x => bolimlarni(x, [...x.bolimlar.map(b => b.nom), nom]));
    chaqna(`b${nom}`);
    fonda(() => soro('POST', 'bank/bolimlar', { subjectId: fan!.id, name: nom }));
    return true;
  };
  const bolimNomi = (eski: string, yangiNom: string) => {
    if (bolimNomlari.some(b => b !== eski && birXil(b, yangiNom))) return bor(yangiNom);
    filtrda(x => bolimlarni({ ...x, mavzular: x.mavzular.map(m => (birXil(m.bolim, eski) ? { ...m, bolim: yangiNom } : m)) }, x.bolimlar.map(b => (b.nom === eski ? yangiNom : b.nom))));
    setTanlov(t => (t.tur === 'bolim' && t.nom === eski ? { tur: 'bolim', nom: yangiNom } : t));
    fonda(() => soro('PUT', 'bank/bolimlar', { subjectId: fan!.id, eski, yangi: yangiNom }));
    return true;
  };
  const bolimOchir = async (nom: string) => {
    const n = bolimMavzulari(nom).length;
    if (!(await confirm({ title: `«${nom}» bo'limi o'chirilsinmi?`, message: n ? `${n} ta mavzusi va ularning savollari o'chmaydi — mavzular bo'limsiz bo'lib qoladi.` : "Bo'lim bo'sh.", confirmLabel: "O'chirish", danger: true }))) return;
    filtrda(x => bolimlarni({ ...x, mavzular: x.mavzular.map(m => (birXil(m.bolim, nom) ? { ...m, bolim: '' } : m)) }, x.bolimlar.map(b => b.nom).filter(b => b !== nom)));
    setTanlov(t => (t.tur === 'bolim' && t.nom === nom ? { tur: 'hamma' } : t));
    fonda(() => soro('DELETE', `bank/bolimlar?subjectId=${fan!.id}&name=${encodeURIComponent(nom)}`));
  };
  /** Yangi mavzu: nomi darhol ko'rinadi, serverdan id kelgach haqiqiy qatorga aylanadi; `keyin` — id bilan. */
  const mavzuQosh = (nom: string, bolim: string, keyin?: (id: number) => void) => {
    const joy = `mavzu:${bolim}`;
    if (mavzular.some(m => birXil(m.nom, nom)) || kutilmoqda.some(k => k.joy.startsWith('mavzu:') && birXil(k.nom, nom))) return bor(nom);
    kutishQosh(joy, nom);
    fonda(async () => {
      try {
        const m = await soro<{ id: number; name: string; section: string | null }>('POST', 'bank/mavzular', { subjectId: fan!.id, name: nom, section: bolim || null });
        filtrda(x => ({ ...x, mavzular: [...x.mavzular, { id: m.id, nom: m.name, bolim: m.section || '', soni: 0 }] }));
        chaqna(`m${m.id}`);
        if (keyin) setTimeout(() => keyin(m.id), 0);
      } finally { kutishOl(joy, nom); }
    });
    return true;
  };
  const mavzuSaqla = (m: { id: number; nom: string }, nom: string) => {
    if (mavzular.some(x => x.id !== m.id && birXil(x.nom, nom))) return bor(nom);
    filtrda(x => ({ ...x, mavzular: x.mavzular.map(y => (y.id === m.id ? { ...y, nom } : y)) }));
    fonda(() => soro('PUT', `bank/mavzular/${m.id}`, { name: nom }));
    return true;
  };
  const mavzuBolimga = (id: number, bolim: string, ortgasiz?: boolean) => {
    const m = mavzular.find(x => x.id === id);
    if (!m || birXil(m.bolim, bolim)) return;
    const eski = m.bolim;
    filtrda(x => ({ ...x, mavzular: x.mavzular.map(y => (y.id === id ? { ...y, bolim } : y)) }));
    setYopiq(x => { if (!x.has(bolim)) return x; const n = new Set(x); n.delete(bolim); return n; });
    chaqna(bolim ? `b${bolim}` : `m${id}`);
    fonda(() => soro('PUT', `bank/mavzular/${id}`, { section: bolim || null }));
    if (!ortgasiz) xabarBer(`«${m.nom}» → ${bolim ? `«${bolim}» bo'limiga` : "bo'limsiz"}`, () => { mavzuBolimgaRef.current(id, eski, true); xabarBer('Bekor qilindi'); });
  };
  const mavzuBolimgaRef = useRef(mavzuBolimga);
  mavzuBolimgaRef.current = mavzuBolimga;
  const mavzuOchir = async (m: { id: number; nom: string }) => {
    const n = mavzuSoni(m.id);
    if (n > 0) return showNotification(`«${m.nom}» mavzusida ${n} ta savol bor — avval ularni boshqa mavzuga o'tkazing`, 'error');
    if (!(await confirm({ title: `«${m.nom}» mavzusi o'chirilsinmi?`, message: "Mavzuda savol yo'q.", confirmLabel: "O'chirish", danger: true }))) return;
    filtrda(x => ({ ...x, mavzular: x.mavzular.filter(y => y.id !== m.id) }));
    setTanlov(t => (t.tur === 'mavzu' && t.id === m.id ? { tur: 'hamma' } : t));
    fonda(() => soro('DELETE', `bank/mavzular/${m.id}`));
  };

  // --- Qiyinlik darajalari -------------------------------------------------------------
  const darajaBor = (nom: string, oziD?: number, oziId?: number) => QIYINLIK.some(q => q.d !== oziD && !q.yashirin && birXil(q.nom, nom)) || darajalar.some(d => d.id !== oziId && birXil(d.name, nom)) || kutadi('daraja', nom);
  const asosiyNomi = (d: number, nom: string) => {
    if (darajaBor(nom, d)) return bor(nom);
    qiyinlikniSozla(qiyinlikSozlamasi().map(q => (q.d === d ? { ...q, nom } : q)), { mahalliy: true });
    fonda(() => soro('PUT', `bank/darajalar/asosiy/${d}`, { name: nom }));
    return true;
  };
  const asosiyOchir = async (d: number) => {
    const q = QIYINLIK[d - 1];
    const qolgan = QIYINLIK.filter(x => !x.yashirin && x.d !== d);
    if (!qolgan.length && !darajalar.length) return showNotification('Kamida bitta daraja qolishi kerak', 'error');
    if (!qolgan.length) return showNotification(`«${q.nom}» — asosiy daraja. Avval o'zingiz qo'shgan darajalarni o'chiring yoki bu darajaning nomini o'zgartiring`, 'error');
    const yaqin = [...qolgan].sort((a, b) => Math.abs(a.d - d) - Math.abs(b.d - d) || a.d - b.d)[0];
    if (!(await confirm({ title: `«${q.nom}» darajasi o'chirilsinmi?`, message: `Bu darajadagi savollar (hamma fanlarda) «${yaqin.nom}» darajasiga o'tadi.`, confirmLabel: "O'chirish", danger: true }))) return;
    qiyinlikniSozla(qiyinlikSozlamasi().map(x => (x.d === d ? { ...x, yashirin: true } : x)), { mahalliy: true });
    setS(x => ({ ...x, qiyinlik: x.qiyinlik.filter(y => y !== d) }));
    setRoyxat(r => r && ({ ...r, items: r.items.map(x => (daraja3(x.difficulty) === d && !(x.tagIds || []).some(t => darajaIdlar.has(t)) ? { ...x, difficulty: yaqin.d } : x)) }));
    filtrda(x => {
      const k: Kesim = JSON.parse(JSON.stringify(x.kesim || {}));
      for (const m of Object.values(k)) { m.q[yaqin.d - 1] += m.q[d - 1]; m.q[d - 1] = 0; }
      return { ...x, kesim: k };
    });
    fonda(() => soro('PUT', `bank/darajalar/asosiy/${d}`, { yashirin: true, kochir: true }));
  };
  /** Yangi daraja ro'yxat oxiriga (eng qiyin tomonga) qo'shiladi; `keyin` — tayyor bo'lgach savollarga qo'yish uchun. */
  const darajaQosh = (nom: string, keyin?: (a: Amal) => void) => {
    if (darajaBor(nom)) return bor(nom);
    // Uchinchi (eng qiyin) o'rin bo'sh bo'lsa — yangi daraja shu o'rinni oladi.
    if (QIYINLIK[2].yashirin && !darajalar.some(d => daraja3(d.asos) === 3)) {
      qiyinlikniSozla(qiyinlikSozlamasi().map(x => (x.d === 3 ? { ...x, nom, yashirin: false } : x)), { mahalliy: true });
      chaqna('q3');
      fonda(() => soro('PUT', 'bank/darajalar/asosiy/3', { name: nom, yashirin: false }));
      if (keyin) setTimeout(() => keyin({ daraja: 3 }), 0);
      return true;
    }
    kutishQosh('daraja', nom);
    fonda(async () => {
      try {
        const d = await soro<{ id: number; name: string; asos: number }>('POST', 'bank/darajalar', { name: nom, asos: 3 });
        filtrda(x => ({ ...x, darajalar: [...x.darajalar, { id: d.id, name: d.name, asos: daraja3(d.asos), soni: 0 }] }));
        chaqna(`t${d.id}`);
        if (keyin) setTimeout(() => keyin({ darajaId: d.id }), 0);
      } finally { kutishOl('daraja', nom); }
    });
    return true;
  };

  // --- Foydalanuvchi filtrlari va qiymatlari ----------------------------------------------
  /** Daraja (foydalanuvchi qo'shgan) yoki filtr qiymatining nomi. */
  const belgiSaqla = (id: number, nom: string) => {
    if (darajaIdlar.has(id) ? darajaBor(nom, undefined, id) : (guruhlar.find(g => g.tags.some(x => x.id === id))?.tags || []).some(x => x.id !== id && birXil(x.name, nom))) return bor(nom);
    filtrda(x => ({
      ...x,
      darajalar: x.darajalar.map(d => (d.id === id ? { ...d, name: nom } : d)),
      guruhlar: x.guruhlar.map(g => ({ ...g, tags: g.tags.map(y => (y.id === id ? { ...y, name: nom } : y)) })),
    }));
    fonda(() => soro('PUT', `bank/belgilar/${id}`, { name: nom }));
    return true;
  };
  const belgiOchir = async (b: { id: number; name: string }, guruh: string) => {
    const n = fanBelgiSoni(b.id);
    const daraja = darajaIdlar.has(b.id);
    if (!(await confirm({
      title: `«${b.name}» o'chirilsinmi?`, confirmLabel: "O'chirish", danger: true,
      message: daraja ? "Bu darajadagi savollar o'zi kirgan asosiy darajada qoladi (savollar o'chmaydi)." : n ? `${guruh}: ${n} ta savoldan olinadi (savollarning o'zi qoladi).` : `${guruh} ro'yxatidan o'chadi.`,
    }))) return;
    filtrda(x => ({ ...x, darajalar: x.darajalar.filter(d => d.id !== b.id), guruhlar: x.guruhlar.map(g => ({ ...g, tags: g.tags.filter(y => y.id !== b.id) })) }));
    setS(y => ({ ...y, darajalar: y.darajalar.filter(i => i !== b.id), belgilar: Object.fromEntries(Object.entries(y.belgilar).map(([k, v]) => [k, v.filter(i => i !== b.id)])) }));
    fonda(() => soro('DELETE', `bank/belgilar/${b.id}`));
  };
  const filtrQosh = (nom: string) => {
    if (birXil(nom, 'Qiyinlik') || guruhlar.some(g => birXil(g.name, nom)) || kutadi('filtr', nom)) return bor(nom);
    kutishQosh('filtr', nom);
    fonda(async () => {
      try {
        const g = await soro<BelgiGuruhi>('POST', 'bank/belgi-guruhlari', { name: nom, subjectId: fan!.id });
        filtrda(x => ({ ...x, guruhlar: [...x.guruhlar, { ...g, tags: g.tags || [] }] }));
        setQosh({ tur: 'qiymat', guruh: g.id });   // darhol qiymatlarini yozish uchun
      } finally { kutishOl('filtr', nom); }
    });
    return true;
  };
  const filtrSaqla = (g: BelgiGuruhi, nom: string) => {
    if (birXil(nom, 'Qiyinlik') || guruhlar.some(x => x.id !== g.id && birXil(x.name, nom))) return bor(nom);
    filtrda(x => ({ ...x, guruhlar: x.guruhlar.map(y => (y.id === g.id ? { ...y, name: nom } : y)) }));
    fonda(() => soro('PUT', `bank/belgi-guruhlari/${g.id}`, { name: nom }));
    return true;
  };
  const filtrOchir = async (g: BelgiGuruhi) => {
    if (!(await confirm({ title: `«${g.name}» filtri o'chirilsinmi?`, message: g.tags.length ? `${g.tags.length} ta qiymati savollardan olinadi (savollarning o'zi qoladi).` : "Filtr bo'sh.", confirmLabel: "O'chirish", danger: true }))) return;
    filtrda(x => ({ ...x, guruhlar: x.guruhlar.filter(y => y.id !== g.id) }));
    setS(x => { const b = { ...x.belgilar }; delete b[g.id]; return { ...x, belgilar: b }; });
    fonda(() => soro('DELETE', `bank/belgi-guruhlari/${g.id}`));
  };
  const qiymatQosh = (g: BelgiGuruhi, nom: string, keyin?: (id: number) => void) => {
    const joy = `g${g.id}`;
    if (g.tags.some(x => birXil(x.name, nom)) || kutadi(joy, nom)) return bor(nom);
    kutishQosh(joy, nom);
    fonda(async () => {
      try {
        const b = await soro<{ id: number; name: string; order: number }>('POST', 'bank/belgilar', { groupId: g.id, name: nom });
        filtrda(x => ({ ...x, guruhlar: x.guruhlar.map(y => (y.id === g.id ? { ...y, tags: [...y.tags, { id: b.id, name: b.name, order: b.order }] } : y)) }));
        chaqna(`t${b.id}`);
        if (keyin) setTimeout(() => keyin(b.id), 0);
      } finally { kutishOl(joy, nom); }
    });
    return true;
  };

  // --- Tanlanganlar bilan boshqa amallar -------------------------------------------------
  const ish = async (nom: string, f: () => Promise<void>) => {
    setBand(nom);
    try { await f(); } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(null); }
  };
  const belgilashBoshi = (): BelgilashBoshi => {
    const b: BelgilashBoshi = { guruhlar: {} };
    if (tanlov.tur === 'mavzu') b.mavzuId = tanlov.id;
    if (s.manbalar.length === 1) b.manba = s.manbalar[0];
    if (s.izohlar.length === 1) b.izoh = s.izohlar[0];
    return b;
  };
  const ishlatilishNol = (idlar: number[]) => ish('nol', async () => {
    setMenyu(null);
    if (!(await confirm({ message: `${idlar.length} ta savolning «necha marta ishlatilgan» hisobi nolga tushirilsinmi? Imtihon tuzishda ular yana birinchi navbatda olinadi.`, danger: false }))) return;
    await soro('PUT', 'questions/bulk', { ids: idlar, ishlatilishNol: true });
    xabarBer('Ishlatilish hisobi nolga tushirildi');
    ozgardi();
  });
  const ochir = (idlar: number[]) => ish('ochir', async () => {
    setMenyu(null);
    if (!(await confirm({ title: `${idlar.length} ta savol o'chirilsinmi?`, message: "Imtihonda ishlatilganlari o'chirilmaydi — arxivga (yashirin) o'tadi.", confirmLabel: "O'chirish", danger: true }))) return;
    const r = await soro<{ ochirildi: number; arxivlandi: number }>('POST', 'questions/bulk-ochir', { ids: idlar });
    xabarBer(`${r.ochirildi} ta savol o'chirildi${r.arxivlandi ? `, ${r.arxivlandi} tasi arxivga o'tdi` : ''}`);
    setTanlangan(x => { const n = new Set(x); idlar.forEach(id => n.delete(id)); return n; });
    ozgardi();
  });

  // Faol saralashlar — ro'yxat ustida olib tashlanadigan yorliqlar.
  const yorliqlar = useMemo(() => {
    const l: { k: string; nom: string; ol: () => void }[] = [];
    for (const d of s.qiyinlik) l.push({ k: `q${d}`, nom: QIYINLIK[d - 1]?.nom || String(d), ol: () => setS(x => ({ ...x, qiyinlik: x.qiyinlik.filter(y => y !== d) })) });
    for (const d of s.darajalar) l.push({ k: `d${d}`, nom: (filtr?.darajalar || []).find(x => x.id === d)?.name || `#${d}`, ol: () => setS(x => ({ ...x, darajalar: x.darajalar.filter(y => y !== d) })) });
    for (const [g, idlar] of Object.entries(s.belgilar)) for (const id of idlar) {
      const guruh = (filtr?.guruhlar || []).find(x => x.id === Number(g));
      l.push({ k: `b${g}_${id}`, nom: id ? guruh?.tags.find(x => x.id === id)?.name || `#${id}` : `${guruh?.name || 'Filtr'}: qo'yilmagan`, ol: () => setS(x => ({ ...x, belgilar: { ...x.belgilar, [g]: (x.belgilar[Number(g)] || []).filter(y => y !== id) } })) });
    }
    if (s.tur) l.push({ k: 'tur', nom: TUR_NOMI[s.tur], ol: () => setS(x => ({ ...x, tur: '' })) });
    for (const m of s.manbalar) l.push({ k: `s${m}`, nom: m || 'Manbasiz', ol: () => setS(x => ({ ...x, manbalar: x.manbalar.filter(y => y !== m) })) });
    if (s.toplam !== null) l.push({ k: 'toplam', nom: `Fayl: ${s.toplam || "to'plamsiz"}`, ol: () => setS(x => ({ ...x, toplam: null })) });
    if (s.holat) l.push({ k: 'holat', nom: HOLAT_NOMI[s.holat], ol: () => setS(x => ({ ...x, holat: '' })) });
    for (const z of s.izohlar) l.push({ k: `z${z}`, nom: `Izoh: ${z || "yo'q"}`, ol: () => setS(x => ({ ...x, izohlar: x.izohlar.filter(y => y !== z) })) });
    if (s.matnli) l.push({ k: 'matnli', nom: s.matnli === 'bor' ? 'Matnli savollar' : 'Matnsiz savollar', ol: () => setS(x => ({ ...x, matnli: '' })) });
    for (const j of s.joylashuv) l.push({ k: `j${j}`, nom: `Variantlar: ${JOYLASHUV_NOMI[j]}`, ol: () => setS(x => ({ ...x, joylashuv: x.joylashuv.filter(y => y !== j) })) });
    if (s.qidDan || s.qidGacha) l.push({ k: 'qid', nom: yangiIdlar.size && s.qidDan && s.qidGacha ? 'Hozirgina qo\'shilganlar' : `QID ${s.qidDan || '…'}–${s.qidGacha || '…'}`, ol: () => setS(x => ({ ...x, qidDan: '', qidGacha: '' })) });
    return l;
  }, [s, filtr, yangiIdlar]);
  const boshqaSoni = (s.tur ? 1 : 0) + (s.holat ? 1 : 0) + s.manbalar.length + (s.toplam !== null ? 1 : 0) + s.izohlar.length + (s.matnli ? 1 : 0) + s.joylashuv.length + (s.qidDan || s.qidGacha ? 1 : 0);
  const saralangan = yorliqlar.length > 0 || !!s.qidiruv.trim();

  const jamiSahifa = royxat ? Math.max(1, Math.ceil(royxat.total / SAHIFA)) : 1;
  const sahifalash = royxat && royxat.total > SAHIFA && (
    <span className="inline-flex items-center gap-1 text-[12px] text-matn-sokin">
      <button aria-label="Oldingi sahifa" disabled={sahifa <= 1} onClick={() => setSahifa(x => x - 1)} className="p-1 rounded-lg hover:bg-ichki disabled:opacity-30 cursor-pointer"><ChevronLeft size={15} /></button>
      <span className="raqam">{sahifa} / {jamiSahifa}</span>
      <button aria-label="Keyingi sahifa" disabled={sahifa >= jamiSahifa} onClick={() => setSahifa(x => x + 1)} className="p-1 rounded-lg hover:bg-ichki disabled:opacity-30 cursor-pointer"><ChevronRight size={15} /></button>
    </span>
  );

  const sarlavha = tanlov.tur === 'mavzu'
    ? { yol: [fan?.name, tanlanganMavzu?.bolim].filter(Boolean).join(' › '), nom: tanlanganMavzu?.nom || fan?.mavzular.find(m => m.id === tanlov.id)?.name || 'Mavzu' }
    : tanlov.tur === 'bolim' ? { yol: fan?.name || '', nom: tanlov.nom } : { yol: 'Savollar banki', nom: fan?.name || '' };

  const mavzuQatori = (m: (typeof mavzular)[number]) => (
    <YonQator key={m.id} nom={m.nom} soni={mavzuSoni(m.id)} faol={tanlov.tur === 'mavzu' && tanlov.id === m.id} onBos={() => tanla({ tur: 'mavzu', id: m.id })}
      onSaqla={savolTahrir ? nom => mavzuSaqla(m, nom) : undefined} onOchir={savolTahrir ? () => mavzuOchir(m) : undefined}
      qabul="savol" onTashla={x => { if (x.tur === 'savol') biriktir(x.ids, { mavzu: m.id }); }}
      sudraladi={savolTahrir ? { tur: 'mavzu', id: m.id } : undefined} sudrashda={sudrash} chaqnash={chaqnash === `m${m.id}`} />
  );
  const menyuSavoli = menyu && menyu.ids.length === 1 ? royxat?.items.find(q => q.id === menyu.ids[0]) || null : null;
  const menyuGuruhi = menyu?.tur === 'guruh' ? guruhlar.find(g => g.id === menyu.guruh) || null : null;
  const nechta = menyu && menyu.ids.length > 1 ? `${menyu.ids.length} ta savol — ` : '';

  // ---------------------------------------------------------------------------------
  if (!fan) {
    return (
      <div className="bg-sirt border border-dashed border-chiziq-kuchli rounded-2xl">
        {savolTahrir ? (
          <BoshHolat sarlavha="Bank bo'sh" izoh="Birinchi fanni qo'shishdan boshlang. Keyin uning bo'lim va mavzularini, so'ng savollarini kiritasiz.">
            {kutilmoqda.some(k => k.joy === 'fan') ? <Yuklanmoqda matn="Fan qo'shilmoqda…" /> : (
              <QatorForma joy="Fan nomi, masalan Matematika" tugma="Fan qo'shish" onYubor={fanQosh} onYop={() => { /* yagona maydon — yopilmaydi */ }} ochiqQolsin className="w-[26rem] max-w-full" />
            )}
          </BoshHolat>
        ) : (
          <BoshHolat sarlavha="Bankda hali fan yo'q" izoh="Savollar bankini to'ldirish huquqi bor xodim fan va savollarni qo'shadi.">
            <Tugma onClick={onTuzilma}>Statistika</Tugma>
          </BoshHolat>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ---------------- Fanlar: kartalar qatori ---------------- */}
      <FanKartalari fanlar={daraxt.fanlar} faolId={fan.id} faolSoni={filtr ? fanJami : null} tahrir={savolTahrir}
        kutilmoqda={kutilmoqda.filter(k => k.joy === 'fan').map(k => k.nom)} onFan={onFan} onQosh={fanQosh} onNom={fanNomi} onOchir={fanOchir} />

      <div className="grid grid-cols-1 lg:grid-cols-[304px_minmax(0,1fr)] gap-3.5 items-start">
        {/* ---------------- Chap: tuzilma va filtrlar ---------------- */}
        <aside aria-label="Tuzilma va filtrlar" className="bg-sirt border border-chiziq rounded-2xl lg:sticky lg:top-[68px] lg:max-h-[calc(100vh-84px)] lg:overflow-y-auto">
          <button type="button" onClick={() => setYonOchiq(o => !o)} aria-expanded={yonOchiq}
            className={`lg:hidden flex items-center justify-between gap-2 w-full px-3.5 py-2.5 text-[13px] font-semibold text-matn cursor-pointer ${yonOchiq ? 'border-b border-chiziq' : ''}`}>
            <span>Tuzilma va filtrlar{tanlov.tur !== 'hamma' && <span className="font-normal text-matn-sokin"> · {sarlavha.nom}</span>}</span>
            <ChevronDown size={16} className={`transition-transform ${yonOchiq ? 'rotate-180' : ''}`} />
          </button>
          <div className={yonOchiq ? '' : 'hidden lg:block'}>
            {!filtr ? <Yuklanmoqda /> : (
              <>
                <section aria-label="Tuzilma" className="px-2.5 pt-3 pb-2.5">
                  <div className="flex items-baseline gap-2 px-1.5 pb-2">
                    <h3 className="text-[11.5px] font-bold tracking-wider uppercase text-matn-sokin">Tuzilma</h3>
                    <span className="text-[11.5px] text-matn-xira truncate">{fan.name}: bo'lim → mavzu</span>
                  </div>
                  <ul>
                    <YonQator nom="Hamma savollar" soni={fanJami} faol={tanlov.tur === 'hamma'} onBos={() => tanla({ tur: 'hamma' })} />
                    {bolimNomlari.map(b => {
                      const ms = bolimMavzulari(b);
                      const ochiqmi = !yopiq.has(b);
                      const joy = `mavzu:${b}`;
                      return (
                        <React.Fragment key={b}>
                          <YonQator nom={b} qalin soni={ms.reduce((a, m) => a + mavzuSoni(m.id), 0)} faol={tanlov.tur === 'bolim' && tanlov.nom === b} onBos={() => tanla({ tur: 'bolim', nom: b })}
                            chap={(
                              <button type="button" aria-expanded={ochiqmi} aria-label={`${b} — ${ochiqmi ? "yig'ish" : 'ochish'}`}
                                onClick={() => setYopiq(x => { const n = new Set(x); if (n.has(b)) n.delete(b); else n.add(b); return n; })}
                                className="w-5 h-7 inline-flex items-center justify-center shrink-0 rounded-md opacity-70 hover:opacity-100 cursor-pointer">
                                <ChevronRight size={14} className={`transition-transform ${ochiqmi ? 'rotate-90' : ''}`} />
                              </button>
                            )}
                            onQosh={savolTahrir ? () => { setQosh({ tur: 'mavzu', bolim: b }); setYopiq(x => { const n = new Set(x); n.delete(b); return n; }); } : undefined} qoshNomi="mavzu qo'shish"
                            onSaqla={savolTahrir ? nom => bolimNomi(b, nom) : undefined} onOchir={savolTahrir ? () => bolimOchir(b) : undefined}
                            qabul="mavzu" onTashla={x => { if (x.tur === 'mavzu') mavzuBolimga(x.id, b); }} sudrashda={sudrash} chaqnash={chaqnash === `b${b}`} />
                          {ochiqmi && (
                            <li>
                              <ul className="ml-3.5 pl-2 border-l border-chiziq">
                                {ms.map(mavzuQatori)}
                                {kutayotganlar(joy)}
                                {qosh?.tur === 'mavzu' && qosh.bolim === b
                                  ? <li><QatorForma joy={`«${b}» ga mavzu`} ochiqQolsin onYubor={nom => mavzuQosh(nom, b)} onYop={() => setQosh(null)} className="px-1 py-0.5" /></li>
                                  : !ms.length && !kutilmoqda.some(k => k.joy === joy) && savolTahrir && <li className="pl-5"><QoshHavola onClick={() => setQosh({ tur: 'mavzu', bolim: b })}>mavzu qo'shish</QoshHavola></li>}
                              </ul>
                            </li>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {bolimNomlari.length > 0 && (yakkaMavzular.length > 0 || kutilmoqda.some(k => k.joy === 'mavzu:') || (qosh?.tur === 'mavzu' && !qosh.bolim) || sudrash === 'mavzu') && (
                      <li onDragOver={sudrash === 'mavzu' ? e => e.preventDefault() : undefined}
                        onDrop={sudrash === 'mavzu' ? e => { e.preventDefault(); const x = sudralayotgan(); if (x?.tur === 'mavzu') mavzuBolimga(x.id, ''); } : undefined}
                        className={`mt-1 px-2 py-1.5 rounded-lg text-[11.5px] text-matn-xira ${sudrash === 'mavzu' ? 'outline-dashed outline-1 -outline-offset-1 outline-brand/60' : ''}`}>Bo'limsiz mavzular</li>
                    )}
                    {yakkaMavzular.map(mavzuQatori)}
                    {kutayotganlar('mavzu:')}
                    {qosh?.tur === 'mavzu' && !qosh.bolim && <li><QatorForma joy="Mavzu nomi" ochiqQolsin onYubor={nom => mavzuQosh(nom, '')} onYop={() => setQosh(null)} className="px-1 py-0.5" /></li>}
                    {qosh?.tur === 'bolim' && <li><QatorForma joy="Bo'lim nomi, masalan Algebra" ochiqQolsin onYubor={bolimQosh} onYop={() => setQosh(null)} className="px-1 py-0.5" /></li>}
                  </ul>
                  {savolTahrir && (
                    <div className="flex flex-wrap gap-x-3 px-1.5 pt-1.5">
                      <QoshHavola onClick={() => setQosh({ tur: 'bolim' })}>Bo'lim</QoshHavola>
                      <QoshHavola onClick={() => setQosh({ tur: 'mavzu', bolim: '' })}>Mavzu</QoshHavola>
                    </div>
                  )}
                </section>

                <section aria-label="Filtrlar" className="px-2.5 pt-3 pb-3 border-t border-chiziq">
                  <div className="flex items-baseline gap-2 px-1.5 pb-2">
                    <h3 className="text-[11.5px] font-bold tracking-wider uppercase text-matn-sokin">Filtrlar</h3>
                    <span className="text-[11.5px] text-matn-xira">o'zingiz tuzasiz</span>
                  </div>

                  {/* Qiyinlik — birinchi ro'yxat: darajalarni foydalanuvchi o'zi belgilaydi (2, 3, 5 ta...). */}
                  <div role="group" aria-label="Qiyinlik">
                    <div className="flex items-center gap-1.5 min-h-7 px-1.5">
                      <span className="flex-1 min-w-0 truncate text-[13px] font-semibold text-matn">Qiyinlik</span>
                      <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-ichki text-matn-sokin whitespace-nowrap" title="Darajalar hamma fanlar uchun bitta; imtihon tuzishda ham shular ishlatiladi">hamma fanlarda</span>
                    </div>
                    <ul>
                      {darajaRoyxati.map(d => {
                        const faol = d.id ? s.darajalar.includes(d.id) : s.qiyinlik.includes(d.d);
                        return (
                          <YonQator key={d.kalit} nom={d.nom} nuqta={d.nuqta} soni={d.id ? yig.b[d.id] || 0 : yig.q[d.d - 1]} faol={faol} bosilgan={faol} chap={<Katak faol={faol} />}
                            onBos={() => setS(x => (d.id ? { ...x, darajalar: almashtirRoyxat(x.darajalar, d.id) } : { ...x, qiyinlik: almashtirRoyxat(x.qiyinlik, d.d) }))}
                            onSaqla={savolTahrir ? nom => (d.id ? belgiSaqla(d.id, nom) : asosiyNomi(d.d, nom)) : undefined}
                            onOchir={savolTahrir ? () => (d.id ? belgiOchir({ id: d.id, name: d.nom }, 'Qiyinlik') : asosiyOchir(d.d)) : undefined}
                            qabul="savol" onTashla={x => { if (x.tur === 'savol') biriktir(x.ids, d.id ? { darajaId: d.id } : { daraja: d.d }); }} sudrashda={sudrash} chaqnash={chaqnash === d.kalit} />
                        );
                      })}
                      {kutayotganlar('daraja')}
                      {qosh?.tur === 'daraja' && <li><QatorForma joy="Daraja nomi, masalan Juda qiyin" ochiqQolsin onYubor={nom => darajaQosh(nom)} onYop={() => setQosh(null)} className="px-1 py-0.5" /></li>}
                    </ul>
                    {savolTahrir && qosh?.tur !== 'daraja' && <div className="px-1.5 pt-1"><QoshHavola onClick={() => setQosh({ tur: 'daraja' })}>daraja</QoshHavola></div>}
                  </div>

                  {guruhlar.map(g => {
                    const tanl = s.belgilar[g.id] || [];
                    const yoq = yig.y[g.id] || 0;
                    const joy = `g${g.id}`;
                    const belgi = (id: number) => setS(x => ({ ...x, belgilar: { ...x.belgilar, [g.id]: almashtirRoyxat(x.belgilar[g.id] || [], id) } }));
                    return (
                      <div key={g.id} role="group" aria-label={g.name} className="mt-3">
                        {filtrTahrir === g.id ? (
                          <QatorForma boshi={g.name} joy="Filtr nomi" onYubor={nom => (nom === g.name ? true : filtrSaqla(g, nom))} onYop={() => setFiltrTahrir(null)} className="px-1 py-0.5" />
                        ) : (
                          <div className="group flex items-center gap-1 min-h-7 px-1.5">
                            <span className="flex-1 min-w-0 truncate text-[13px] font-semibold text-matn">{g.name}</span>
                            {!g.subjectId && <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-ichki text-matn-sokin whitespace-nowrap">hamma fanlarda</span>}
                            {savolTahrir && (
                              <span className="hidden group-hover:inline-flex group-focus-within:inline-flex [@media(hover:none)]:inline-flex items-center">
                                <button type="button" onClick={() => setFiltrTahrir(g.id)} title="Nomini o'zgartirish" aria-label={`${g.name} — filtr nomini o'zgartirish`} className="inline-flex items-center justify-center w-6 h-6 rounded-md text-matn-sokin hover:bg-ichki hover:text-matn cursor-pointer"><Pencil size={12} /></button>
                                <button type="button" onClick={() => filtrOchir(g)} title="Filtrni o'chirish" aria-label={`${g.name} — filtrni o'chirish`} className="inline-flex items-center justify-center w-6 h-6 rounded-md text-matn-sokin hover:bg-ichki hover:text-xato cursor-pointer"><Trash2 size={12} /></button>
                              </span>
                            )}
                          </div>
                        )}
                        <ul>
                          {g.tags.map(x => {
                            const faol = tanl.includes(x.id);
                            return (
                              <YonQator key={x.id} nom={x.name} soni={yig.b[x.id] || 0} faol={faol} bosilgan={faol} chap={<Katak faol={faol} />} onBos={() => belgi(x.id)}
                                onSaqla={savolTahrir ? nom => belgiSaqla(x.id, nom) : undefined} onOchir={savolTahrir ? () => belgiOchir(x, g.name) : undefined}
                                qabul="savol" onTashla={y => { if (y.tur === 'savol') biriktir(y.ids, { guruh: g.id, tag: x.id }); }} sudrashda={sudrash} chaqnash={chaqnash === `t${x.id}`} />
                            );
                          })}
                          {g.tags.length > 0 && (yoq > 0 || tanl.includes(0)) && (
                            <YonQator nom="qo'yilmagan" korinish={<i>qo'yilmagan</i>} soni={yoq} faol={tanl.includes(0)} bosilgan={tanl.includes(0)} chap={<Katak faol={tanl.includes(0)} />} onBos={() => belgi(0)} />
                          )}
                          {kutayotganlar(joy)}
                          {qosh?.tur === 'qiymat' && qosh.guruh === g.id && <li><QatorForma joy={`«${g.name}» ga qiymat`} ochiqQolsin onYubor={nom => qiymatQosh(g, nom)} onYop={() => setQosh(null)} className="px-1 py-0.5" /></li>}
                        </ul>
                        {savolTahrir && !(qosh?.tur === 'qiymat' && qosh.guruh === g.id) && <div className="px-1.5 pt-1"><QoshHavola onClick={() => setQosh({ tur: 'qiymat', guruh: g.id })}>qiymat</QoshHavola></div>}
                      </div>
                    );
                  })}
                  {kutilmoqda.filter(k => k.joy === 'filtr').map((k, i) => (
                    <p key={`kfl${i}`} className="mt-3 px-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-matn-xira"><Loader2 size={12} className="animate-spin" />{k.nom}</p>
                  ))}
                  {savolTahrir && (qosh?.tur === 'filtr'
                    ? <QatorForma joy="Filtr nomi, masalan Manba" onYubor={filtrQosh} onYop={() => setQosh(null)} className="mt-3 px-1 py-0.5" />
                    : <div className="px-1.5 pt-3"><QoshHavola onClick={() => setQosh({ tur: 'filtr' })}>Yangi filtr</QoshHavola></div>)}
                </section>
              </>
            )}
          </div>
        </aside>

        {/* ---------------- O'ng: savollar ---------------- */}
        <div className="min-w-0 space-y-2.5">
          <div className="bg-sirt border border-chiziq rounded-2xl px-3.5 py-3 flex flex-wrap items-center gap-x-3.5 gap-y-2">
            <div className="flex-1 min-w-[200px]">
              <p className="text-[12px] text-matn-xira truncate">{sarlavha.yol}</p>
              <h2 className="text-[18px] leading-tight font-bold text-matn break-words">{sarlavha.nom}</h2>
            </div>
            {savolTahrir && onQosh && (
              <Tugma turi={filtr && !mavzular.length ? 'ikkinchi' : 'asosiy'} ikonka={<Plus size={15} />} onClick={() => onQosh(qoshMavzu)}>
                Savol qo'shish{tanlov.tur === 'mavzu' ? ` — ${sarlavha.nom}` : ''}
              </Tugma>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
              <input className="w-full pl-9 pr-8 py-2 bg-sirt border border-chiziq rounded-xl text-[13px] text-matn focus:border-brand placeholder:text-matn-xira" style={{ outline: 'none' }}
                placeholder="Savol matnidan qidirish" aria-label="Savol matnidan qidirish" value={s.qidiruv} onChange={e => setS(x => ({ ...x, qidiruv: e.target.value }))} />
              {s.qidiruv && <button aria-label="Qidiruvni tozalash" onClick={() => setS(x => ({ ...x, qidiruv: '' }))} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-matn-xira hover:text-matn cursor-pointer"><X size={14} /></button>}
            </div>
            <button type="button" onClick={() => setBoshqa(o => !o)} aria-expanded={boshqa} className={`${TABLETKA(boshqa || boshqaSoni > 0)} py-2`}>
              <SlidersHorizontal size={14} /> Boshqa filtrlar{boshqaSoni > 0 && <span className="raqam">({boshqaSoni})</span>}
            </button>
          </div>

          {/* Kam ishlatiladigan saralashlar: tartib, turi, holati, manba, fayl, izoh, matn, joylashuv, QID. */}
          {boshqa && filtr && (
            <section aria-label="Boshqa filtrlar" className="bg-sirt border border-chiziq rounded-2xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 [&>section]:border-b [&>section]:border-chiziq">
              <Bolim nom="Tartib">
                <div className="flex flex-wrap gap-1.5">
                  {([['asc', 'Raqami bo\'yicha'], ['desc', 'Yangilari avval']] as const).map(([v, nom]) => (
                    <button key={v} type="button" aria-pressed={tartib === v} onClick={() => setTartib(v)} className={TABLETKA(tartib === v)}>{nom}</button>
                  ))}
                </div>
              </Bolim>
              <Bolim nom="Savol turi" tanlangan={s.tur ? 1 : 0}>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(TUR_NOMI) as SavolTuri[]).filter(k => filtr.turlar[k] || s.tur === k).map(k => (
                    <button key={k} type="button" aria-pressed={s.tur === k} onClick={() => setS(x => ({ ...x, tur: x.tur === k ? '' : k }))} className={TABLETKA(s.tur === k)}>
                      {TUR_NOMI[k]}<span className="raqam text-[11px] opacity-70">{filtr.turlar[k]}</span>
                    </button>
                  ))}
                  {!(Object.keys(TUR_NOMI) as SavolTuri[]).some(k => filtr.turlar[k]) && <span className="text-[12px] text-matn-xira">Savol yo'q</span>}
                </div>
              </Bolim>
              <Bolim nom="Holati" tanlangan={s.holat ? 1 : 0}>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(HOLAT_NOMI) as Exclude<Holat, ''>[]).map(k => (
                    <button key={k} type="button" aria-pressed={s.holat === k} onClick={() => setS(x => ({ ...x, holat: x.holat === k ? '' : k }))} className={TABLETKA(s.holat === k)}>
                      {HOLAT_NOMI[k]}<span className="raqam text-[11px] opacity-70">{filtr.holat[k]}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-matn-xira">Tanlanmasa — faol va qoralama (arxiv yashirin)</p>
              </Bolim>
              {filtr.manbalar.some(m => m.nom) && (
                <Bolim nom="Manba" tanlangan={s.manbalar.length}>
                  <Belgilar qiymatlar={filtr.manbalar.map(m => ({ k: m.nom, nom: m.nom || <i className="text-matn-xira">Manbasiz</i>, soni: m.soni }))}
                    tanlangan={s.manbalar} onChange={v => setS(x => ({ ...x, manbalar: v }))} />
                </Bolim>
              )}
              {filtr.toplamlar.some(m => m.nom) && (
                <Bolim nom="To'plam (fayl)" tanlangan={s.toplam !== null ? 1 : 0}>
                  <Belgilar qiymatlar={filtr.toplamlar.map(x => ({ k: x.nom, nom: x.nom || <i className="text-matn-xira">To'plamsiz</i>, soni: x.soni }))}
                    tanlangan={s.toplam !== null ? [s.toplam] : []} onChange={v => setS(x => ({ ...x, toplam: v.length ? v[v.length - 1] : null }))} />
                </Bolim>
              )}
              {filtr.izohlar.some(x => x.nom) && (
                <Bolim nom="Izoh (remark)" tanlangan={s.izohlar.length}>
                  <Belgilar qiymatlar={filtr.izohlar.map(x => ({ k: x.nom, nom: x.nom || <i className="text-matn-xira">Izohsiz</i>, soni: x.soni }))}
                    tanlangan={s.izohlar} onChange={v => setS(x => ({ ...x, izohlar: v }))} />
                </Bolim>
              )}
              {filtr.matnli.bor > 0 && (
                <Bolim nom="Matnli savollar (passage)" tanlangan={s.matnli ? 1 : 0}>
                  <div className="flex flex-wrap gap-1.5">
                    {(['bor', 'yoq'] as const).map(k => (
                      <button key={k} type="button" aria-pressed={s.matnli === k} onClick={() => setS(x => ({ ...x, matnli: x.matnli === k ? '' : k }))} className={TABLETKA(s.matnli === k)}>
                        {k === 'bor' ? "Matnga bog'langan" : 'Matnsiz'}<span className="raqam text-[11px] opacity-70">{filtr.matnli[k]}</span>
                      </button>
                    ))}
                  </div>
                </Bolim>
              )}
              {(filtr.joylashuv['1'] + filtr.joylashuv['2'] + filtr.joylashuv['4']) > 0 && (
                <Bolim nom="Variantlar joylashuvi" tanlangan={s.joylashuv.length}>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1, 2, 4].filter(j => filtr.joylashuv[String(j) as '0'] || s.joylashuv.includes(j)).map(j => (
                      <button key={j} type="button" aria-pressed={s.joylashuv.includes(j)} onClick={() => setS(x => ({ ...x, joylashuv: almashtirRoyxat(x.joylashuv, j) }))} className={TABLETKA(s.joylashuv.includes(j))}>
                        {JOYLASHUV_NOMI[j]}<span className="raqam text-[11px] opacity-70">{filtr.joylashuv[String(j) as '0']}</span>
                      </button>
                    ))}
                  </div>
                </Bolim>
              )}
              <Bolim nom="Savol raqami (QID) oralig'i" tanlangan={s.qidDan || s.qidGacha ? 1 : 0}>
                <div className="flex items-center gap-2">
                  <input className="w-full min-w-0 px-2.5 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12.5px] raqam focus:border-brand" style={{ outline: 'none' }} inputMode="numeric" placeholder="dan" aria-label="QID dan"
                    value={s.qidDan} onChange={e => setS(x => ({ ...x, qidDan: e.target.value.replace(/\D/g, '') }))} />
                  <span className="text-matn-xira">–</span>
                  <input className="w-full min-w-0 px-2.5 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12.5px] raqam focus:border-brand" style={{ outline: 'none' }} inputMode="numeric" placeholder="gacha" aria-label="QID gacha"
                    value={s.qidGacha} onChange={e => setS(x => ({ ...x, qidGacha: e.target.value.replace(/\D/g, '') }))} />
                </div>
              </Bolim>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-1.5 px-1 min-h-7">
            <span className="text-[13px] text-matn-sokin mr-1">
              {royxat ? <><b className="text-matn raqam">{royxat.total}</b> ta savol</> : '…'}
              {yuklanmoqda && <Loader2 size={13} className="inline ml-1.5 animate-spin text-matn-xira" />}
            </span>
            {yorliqlar.map(y => (
              <button key={y.k} onClick={y.ol} title="Olib tashlash"
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-brand-fon text-brand-dark border border-brand/20 dark:bg-brand/20 dark:text-brand-accent text-[11.5px] font-semibold cursor-pointer hover:border-brand/50">
                {y.nom}<X size={12} />
              </button>
            ))}
            {saralangan && <button onClick={() => setS(BOSH)} className="text-[12px] font-semibold text-brand hover:underline cursor-pointer ml-1">tozalash</button>}
            <span className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
              {(savolTahrir || ochiradi) && sahifadagi.length > 1 && (
                <button onClick={hammasiniTanla} disabled={band === 'tanla'} className="text-[12px] font-semibold text-brand hover:underline cursor-pointer disabled:opacity-50">
                  {band === 'tanla' ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null}
                  {hammasiTanlangan ? 'Tanlovni olish' : kopSahifa ? `Hamma ${royxat!.total} tasini tanlash` : 'Hammasini tanlash'}
                </button>
              )}
              {sahifalash}
            </span>
          </div>

          {!royxat || !filtr ? <div className="bg-sirt border border-chiziq rounded-2xl"><Yuklanmoqda /></div> : !royxat.items.length ? (
            <div className="bg-sirt border border-dashed border-chiziq-kuchli rounded-2xl">
              {saralangan ? (
                <BoshHolat ikonka={<Search size={20} />} sarlavha="Bu saralashga mos savol yo'q" izoh="Filtr yoki qidiruvni o'zgartiring">
                  <Tugma kichik ikonka={<Eraser size={13} />} onClick={() => setS(BOSH)}>Filtrlarni tozalash</Tugma>
                </BoshHolat>
              ) : !mavzular.length && savolTahrir ? (
                <div className="flex flex-col items-center gap-3 px-5 py-9 text-center">
                  <h3 className="text-[16px] font-bold text-matn">«{fan.name}» fanida hali savol yo'q</h3>
                  <ol className="text-left text-[13px] text-matn-sokin space-y-1.5">
                    {["Chapda «Bo'lim» yoki «Mavzu» ni bosib, tuzilmani yozing. Bo'lim shart emas.", "Mavzuni tanlab, savol qo'shing (Word, Excel, PDF yoki rasmdan).", "Savollarga qiyinlik va o'z filtrlaringizni qo'ying."].map((m, i) => (
                      <li key={i} className="flex items-baseline gap-2"><span className="inline-flex items-center justify-center w-[18px] h-[18px] shrink-0 rounded-full bg-brand-fon text-brand-dark dark:bg-brand/20 dark:text-brand-accent text-[11px] font-bold raqam">{i + 1}</span><span>{m}</span></li>
                    ))}
                  </ol>
                  <Tugma turi="asosiy" ikonka={<Plus size={14} />} onClick={() => { setQosh({ tur: 'mavzu', bolim: '' }); setYonOchiq(true); }}>Birinchi mavzuni qo'shish</Tugma>
                </div>
              ) : (
                <BoshHolat sarlavha={`«${sarlavha.nom}» da hali savol yo'q`} izoh="Word, Excel, PDF yoki rasmdan savol qo'shing — ular shu yerga tushadi.">
                  {savolTahrir && onQosh && <Tugma kichik turi="asosiy" ikonka={<Plus size={13} />} onClick={() => onQosh(qoshMavzu)}>Savol qo'shish</Tugma>}
                </BoshHolat>
              )}
            </div>
          ) : (
            <ul aria-label="Savollar" className={`flex flex-col gap-2 transition-opacity ${yuklanmoqda ? 'opacity-60' : ''}`}>
              {royxat.items.map((q, i) => {
                const d = savolDarajasi(q);
                return (
                  <SavolKarta key={q.id} q={q} raqam={(sahifa - 1) * SAHIFA + i + 1} tanlangan={tanlangan.has(q.id)} yangi={yangiIdlar.has(q.id)} tanlanadi={savolTahrir || ochiradi} tahrir={savolTahrir}
                    mavzu={(q.bankTopicId != null && mavzuNomi.get(q.bankTopicId)) || q.topic || ''} darajaNom={d.nom} darajaNuqta={d.nuqta} guruhlar={guruhlar}
                    onTanla={almashtir} onKor={korish} onSudra={savolTahrir ? sudra : undefined} onMenyu={kartaMenyu} />
                );
              })}
            </ul>
          )}
          {sahifalash && <div className="flex justify-end px-1">{sahifalash}</div>}

          {/* Pastda: amal natijasi («Bekor qilish») va belgilangan savollar paneli. */}
          {(xabar || tanlangan.size > 0) && (
            <div className="sticky bottom-3 z-20 flex flex-col items-center gap-2 pointer-events-none">
              {xabar && <Xabar key={xabar.n} matn={xabar.matn} onOrtga={xabar.ortga ? () => { const f = xabar.ortga!; setXabar(null); f(); } : undefined} />}
              {tanlangan.size > 0 && (
                <div role="toolbar" aria-label="Tanlangan savollar"
                  className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-2xl bg-matn text-sirt shadow-2xl px-2 py-1.5 max-w-full">
                  <span className="px-2 text-[12.5px] font-bold whitespace-nowrap"><span className="raqam">{tanlangan.size}</span> ta tanlandi</span>
                  {savolTahrir && filtr && (
                    <>
                      <PanelTugma ikonka={<Folder size={14} />} onClick={e => setMenyu({ tur: 'mavzu', rect: e.currentTarget.getBoundingClientRect(), ids })}>Mavzuga</PanelTugma>
                      <PanelTugma onClick={e => setMenyu({ tur: 'daraja', rect: e.currentTarget.getBoundingClientRect(), ids })}>Qiyinlik</PanelTugma>
                      {guruhlar.map(g => (
                        <PanelTugma key={g.id} onClick={e => setMenyu({ tur: 'guruh', rect: e.currentTarget.getBoundingClientRect(), ids, guruh: g.id })}>{g.name}</PanelTugma>
                      ))}
                      <PanelTugma ikonka={<Sparkles size={14} />} title="AI shu savollarning har biriga o'xshash masalalar tuzadi" onClick={() => setOxshash(ids)}>O'xshashini tuzish</PanelTugma>
                      <PanelTugma ikonka={<MoreHorizontal size={14} />} aria-label="Boshqa amallar" title="Boshqa amallar" onClick={e => setMenyu({ tur: 'yana', rect: e.currentTarget.getBoundingClientRect(), ids })} />
                    </>
                  )}
                  {ochiradi && <PanelTugma ikonka={band === 'ochir' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} disabled={band === 'ochir'} onClick={() => ochir(ids)}>O'chirish</PanelTugma>}
                  <button aria-label="Tanlovni bekor qilish" title="Tanlovni bekor qilish" onClick={() => setTanlangan(new Set())} className="ml-0.5 p-1.5 rounded-lg hover:bg-sirt/15 cursor-pointer"><X size={15} /></button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Ochiladigan menyular ---------------- */}
      {menyu && menyu.tur === 'savol' && (
        <Menyu rect={menyu.rect} onYop={() => setMenyu(null)} nom={`#${menyu.ids[0]} savol`}>
          <MenyuBand ikonka={<Eye size={14} />} onClick={() => { korish(menyu.ids[0]); setMenyu(null); }}>{savolTahrir ? 'Ochish va tahrirlash' : "Ko'rish"}</MenyuBand>
          {savolTahrir && <MenyuBand ikonka={<Sparkles size={14} />} onClick={() => { setOxshash(menyu.ids); setMenyu(null); }}>O'xshashini tuzish (AI)</MenyuBand>}
          {ochiradi && <MenyuBand ikonka={<Trash2 size={14} />} xavfli onClick={() => ochir(menyu.ids)}>Savolni o'chirish</MenyuBand>}
        </Menyu>
      )}
      {menyu && menyu.tur === 'mavzu' && (
        <Menyu rect={menyu.rect} onYop={() => setMenyu(null)} nom="Mavzu">
          <MenyuSarlavha>{nechta}mavzusi</MenyuSarlavha>
          {bolimNomlari.map(b => {
            const ms = bolimMavzulari(b);
            return ms.length ? (
              <React.Fragment key={b}>
                <MenyuSarlavha>{b}</MenyuSarlavha>
                {ms.map(m => <MenyuBand key={m.id} joriy={menyuSavoli?.bankTopicId === m.id} onClick={() => biriktir(menyu.ids, { mavzu: m.id })}>{m.nom}</MenyuBand>)}
              </React.Fragment>
            ) : null;
          })}
          {yakkaMavzular.length > 0 && bolimNomlari.length > 0 && <MenyuSarlavha>Bo'limsiz</MenyuSarlavha>}
          {yakkaMavzular.map(m => <MenyuBand key={m.id} joriy={menyuSavoli?.bankTopicId === m.id} onClick={() => biriktir(menyu.ids, { mavzu: m.id })}>{m.nom}</MenyuBand>)}
          <MenyuChiziq />
          <QatorForma joy="Yangi mavzu" belgi="plus" className="px-0.5 pb-0.5" onYop={() => setMenyu(null)}
            onYubor={nom => {
              const borMavzu = mavzular.find(m => birXil(m.nom, nom));
              const idlar = menyu.ids;
              if (borMavzu) { biriktir(idlar, { mavzu: borMavzu.id }); return true; }
              return mavzuQosh(nom, tanlov.tur === 'bolim' ? tanlov.nom : tanlanganMavzu?.bolim || '', id => biriktirRef.current(idlar, { mavzu: id }));
            }} />
        </Menyu>
      )}
      {menyu && menyu.tur === 'daraja' && (
        <Menyu rect={menyu.rect} onYop={() => setMenyu(null)} nom="Qiyinlik">
          <MenyuSarlavha>{nechta}qiyinlik</MenyuSarlavha>
          {darajaRoyxati.map(d => (
            <MenyuBand key={d.kalit} nuqta={d.nuqta} joriy={!!menyuSavoli && savolDarajasi(menyuSavoli).kalit === d.kalit}
              onClick={() => biriktir(menyu.ids, d.id ? { darajaId: d.id } : { daraja: d.d })}>{d.nom}</MenyuBand>
          ))}
          <MenyuChiziq />
          <QatorForma joy="Yangi daraja" belgi="plus" className="px-0.5 pb-0.5" onYop={() => setMenyu(null)}
            onYubor={nom => {
              const idlar = menyu.ids;
              const borDaraja = darajaRoyxati.find(d => birXil(d.nom, nom));
              if (borDaraja) { biriktir(idlar, borDaraja.id ? { darajaId: borDaraja.id } : { daraja: borDaraja.d }); return true; }
              return darajaQosh(nom, a => biriktirRef.current(idlar, a));
            }} />
        </Menyu>
      )}
      {menyu && menyuGuruhi && (
        <Menyu rect={menyu.rect} onYop={() => setMenyu(null)} nom={menyuGuruhi.name}>
          <MenyuSarlavha>{nechta}{menyuGuruhi.name}</MenyuSarlavha>
          {menyuGuruhi.tags.map(x => (
            <MenyuBand key={x.id} joriy={!!menyuSavoli && (menyuSavoli.tagIds || []).includes(x.id)} onClick={() => biriktir(menyu.ids, { guruh: menyuGuruhi.id, tag: x.id })}>{x.name}</MenyuBand>
          ))}
          {!menyuGuruhi.tags.length && <p className="px-2 py-1 text-[12px] text-matn-xira">Qiymat yo'q — pastda yozing.</p>}
          {menyuGuruhi.tags.length > 0 && (!menyuSavoli || (menyuSavoli.tagIds || []).some(id => menyuGuruhi.tags.some(x => x.id === id))) && (
            <><MenyuChiziq /><MenyuBand ikonka={<X size={14} />} onClick={() => biriktir(menyu.ids, { guruh: menyuGuruhi.id, tag: null })}>Olib tashlash</MenyuBand></>
          )}
          <MenyuChiziq />
          <QatorForma joy="Yangi qiymat" belgi="plus" className="px-0.5 pb-0.5" onYop={() => setMenyu(null)}
            onYubor={nom => {
              const idlar = menyu.ids, gid = menyuGuruhi.id;
              const borQiymat = menyuGuruhi.tags.find(x => birXil(x.name, nom));
              if (borQiymat) { biriktir(idlar, { guruh: gid, tag: borQiymat.id }); return true; }
              const ok = qiymatQosh(menyuGuruhi, nom, id => biriktirRef.current(idlar, { guruh: gid, tag: id }));
              if (ok) setMenyu(null);
              return ok;
            }} />
        </Menyu>
      )}
      {menyu && menyu.tur === 'yana' && (
        <Menyu rect={menyu.rect} onYop={() => setMenyu(null)} nom="Boshqa amallar">
          {menyu.ids.length === 1 && <MenyuBand ikonka={<Eye size={14} />} onClick={() => { korish(menyu.ids[0]); setMenyu(null); }}>Ochish va tahrirlash</MenyuBand>}
          <MenyuBand ikonka={<Tags size={14} />} onClick={() => { setMenyu(null); setBelgilash(true); }}>Manba, izoh, holat…</MenyuBand>
          <MenyuBand ikonka={<RotateCcw size={14} />} onClick={() => ishlatilishNol(menyu.ids)}>Ishlatilishini nolga</MenyuBand>
        </Menyu>
      )}

      {belgilash && filtr && <BelgilashOynasi ids={ids} filtr={filtr} boshi={belgilashBoshi()} onYop={() => setBelgilash(false)} onSaqlandi={ozgardi} />}
      {ochiq && <SavolOynasi q={ochiq} daraxt={daraxt} onYop={() => setOchiq(null)} onOzgardi={ozgardi} />}
      {oxshash && (
        <OxshashKop ids={oxshash} onYop={() => setOxshash(null)}
          onSaqlandi={yangiIds => { setTanlangan(new Set()); ozgardi(); if (yangiIds.length) onYangi?.(yangiIds); }} />
      )}
    </div>
  );
}

function PanelTugma({ ikonka, children, className = '', ...qolgan }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ikonka?: React.ReactNode }) {
  return (
    <button type="button" {...qolgan}
      className={`${className} inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-sirt/25 text-[12.5px] font-semibold whitespace-nowrap cursor-pointer hover:bg-sirt/15 hover:border-sirt/50 disabled:opacity-60`}>
      {ikonka}{children}
    </button>
  );
}

/** "Boshqa filtrlar" bo'limi: sarlavha va ichidagi qiymatlar. */
function Bolim({ nom, tanlangan = 0, children }: { nom: string; tanlangan?: number; children: React.ReactNode }) {
  return (
    <section className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12.5px] font-semibold text-matn">{nom}</span>
        {tanlangan > 0 && <span className="raqam text-[11px] font-bold min-w-5 text-center px-1.5 rounded-md bg-brand text-brand-ust">{tanlangan}</span>}
      </div>
      {children}
    </section>
  );
}

/** Belgilash ro'yxati: har qatorda qiymat va nechta savol. */
function Belgilar<K extends string | number>({ qiymatlar, tanlangan, onChange }: {
  qiymatlar: { k: K; nom: React.ReactNode; soni?: number }[]; tanlangan: K[]; onChange: (v: K[]) => void;
}) {
  return (
    <ul className="max-h-44 overflow-y-auto -mx-1.5">
      {qiymatlar.map(q => {
        const b = tanlangan.includes(q.k);
        return (
          <li key={String(q.k)}>
            <label className={`flex items-center gap-2 px-1.5 py-1 rounded-lg text-[12.5px] cursor-pointer select-none ${b ? 'bg-brand-fon/70 dark:bg-brand/10' : 'hover:bg-ichki'}`}>
              <input type="checkbox" className="w-3.5 h-3.5 shrink-0 accent-[var(--color-brand)] cursor-pointer" checked={b} onChange={() => onChange(almashtirRoyxat(tanlangan, q.k))} />
              <span className={`flex-1 min-w-0 truncate ${b ? 'font-semibold text-matn' : 'text-matn'}`}>{q.nom}</span>
              {q.soni !== undefined && <span className={`shrink-0 raqam text-[11px] ${q.soni ? 'text-matn-xira' : 'text-matn-xira/50'}`}>{q.soni}</span>}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Savol kartasi: matn (formulalar bilan), variantlar va to'g'ri javob ochmasdan ko'rinadi.
 * Yorliqlar (mavzu, qiyinlik, filtrlar) bosilsa — shu yerning o'zida o'zgartiriladi; karta
 * chapdagi mavzu yoki filtr qatoriga sudrab tashlanadi.
 */
const SavolKarta = memo(function SavolKarta({ q, raqam, tanlangan, yangi, tanlanadi, tahrir, mavzu, darajaNom, darajaNuqta, guruhlar, onTanla, onKor, onSudra, onMenyu }: {
  q: Qator_;
  /** Ro'yxatdagi tartib raqami — har ko'rinishda (fan, bo'lim, mavzu, filtr) 1 dan boshlanadi. */
  raqam: number;
  tanlangan: boolean; yangi: boolean; tanlanadi: boolean; tahrir: boolean; mavzu: string; darajaNom: string; darajaNuqta: string; guruhlar: BelgiGuruhi[];
  onTanla: (id: number) => void; onKor: (id: number) => void; onSudra?: (id: number, e: React.DragEvent) => void;
  onMenyu: (tur: MenyuTuri, el: HTMLElement, id: number, guruh?: number) => void;
}) {
  const html = useMemo(() => formulaliHtml(q.text || ''), [q.text]);
  const variantlar = useMemo(() => (q.options || []).map(o => formulaliHtml(o)), [q.options]);
  const qisqa = useMemo(() => (q.options || []).every(o => oddiyMatn(o).length <= 22 && !/<img/i.test(o)), [q.options]);
  const togri = HARFLAR.indexOf(String(q.correctAnswer || '').toUpperCase());
  const raqamliJavob = q.type === 'raqamli' ? [...new Set([q.correctAnswer, ...(q.answers || [])].filter(Boolean))].join(' · ') : '';
  const teglar = q.tagIds || [];
  /** Yorliq: tahrir huquqi bo'lsa — tugma (menyu ochadi), bo'lmasa oddiy yozuv. */
  const yorliq = (tur: MenyuTuri, sinf: string, nom: string, ichi: React.ReactNode, guruh?: number) => (tahrir
    ? <button key={`${tur}${guruh || ''}`} type="button" title={nom} aria-label={`#${q.id}: ${nom}`} aria-haspopup="menu" className={`${sinf} cursor-pointer hover:border-brand`} onClick={e => onMenyu(tur, e.currentTarget, q.id, guruh)}>{ichi}</button>
    : <span key={`${tur}${guruh || ''}`} title={nom} className={sinf}>{ichi}</span>);

  return (
    <li draggable={!!onSudra} onDragStart={onSudra ? e => onSudra(q.id, e) : undefined} onDoubleClick={() => onKor(q.id)}
      className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 pl-2.5 pr-3 py-3 rounded-xl border transition-colors ${tanlangan ? 'border-brand bg-brand-fon/50 dark:bg-brand/10' : 'border-chiziq bg-sirt'} ${onSudra ? 'cursor-grab' : ''} ${q.status === 'arxiv' ? 'opacity-60' : ''}`}>
      <div className="pt-0.5">
        {tanlanadi ? <input type="checkbox" aria-label={`#${q.id} savolni tanlash`} className="w-[17px] h-[17px] accent-[var(--color-brand)] cursor-pointer" checked={tanlangan} onChange={() => onTanla(q.id)} /> : <span className="block w-1" />}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="raqam text-[13px] font-bold text-matn mr-0.5">{raqam}.</span>
          {yangi && <span className="px-1.5 py-0.5 rounded-md bg-yaxshi-fon text-yaxshi text-[10.5px] font-bold">yangi</span>}
          {yorliq('mavzu', mavzu ? CHIP_BOR : CHIP_BOSH, mavzu ? `mavzu — ${mavzu}` : 'mavzusi yo\'q', <><Folder size={12} className="shrink-0" /><span className="truncate max-w-56">{mavzu || 'mavzu?'}</span></>)}
          {yorliq('daraja', CHIP_BOR, `qiyinlik — ${darajaNom}`, <><span className={`w-2 h-2 rounded-full shrink-0 ${darajaNuqta}`} /><span className="truncate max-w-40">{darajaNom}</span></>)}
          {guruhlar.map(g => {
            const t = g.tags.find(x => teglar.includes(x.id));
            if (t) return yorliq('guruh', CHIP_BOR, `${g.name} — ${t.name}`, <span className="truncate max-w-40">{t.name}</span>, g.id);
            return g.tags.length && tahrir ? yorliq('guruh', CHIP_BOSH, `${g.name} qo'yilmagan`, <span className="truncate max-w-40">{g.name.toLowerCase()}?</span>, g.id) : null;
          })}
          {q.type !== 'yopiq' && <Yorliq rang="brand">{TUR_NOMI[q.type]}</Yorliq>}
          {q.status === 'qoralama' && <Yorliq rang="ogoh">Qoralama</Yorliq>}
          {q.status === 'arxiv' && <Yorliq>Arxiv</Yorliq>}
          {q.passageId && <Yorliq>matnli</Yorliq>}
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-matn-xira">
            {!!q.usedCount && <span>{q.usedCount} marta ishlatilgan</span>}
            <span className="raqam" title="Savolning bankdagi doimiy raqami (ID) — qaysi mavzuda turishidan qat'i nazar o'zgarmaydi">ID {q.id}</span>
            <button type="button" aria-label={`#${q.id} — amallar`} title="Ochish, o'chirish" aria-haspopup="menu" onClick={e => onMenyu('savol', e.currentTarget, q.id)}
              className="p-1 -mr-1 rounded-lg text-matn-sokin hover:bg-ichki hover:text-matn cursor-pointer"><MoreHorizontal size={16} /></button>
          </span>
        </div>
        <div className={`${SAVOL_MATNI} mt-1.5 text-[14px] text-matn [&_p]:my-0.5`} dangerouslySetInnerHTML={{ __html: html || '<p>—</p>' }} />
        {q.imageUrl && <img src={q.imageUrl} alt="" loading="lazy" draggable={false} className="mt-2 max-h-40 rounded-lg border border-chiziq bg-white" />}
        {q.type === 'yopiq' && variantlar.length > 0 && (
          <ol className={`mt-2 grid gap-1.5 ${q.joylashuv === 1 ? 'grid-cols-1' : q.joylashuv === 2 ? 'grid-cols-2' : q.joylashuv === 4 || qisqa ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {variantlar.map((h, i) => (
              <li key={i} className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] border ${i === togri ? 'bg-yaxshi-fon border-yaxshi/40 text-matn' : 'bg-ichki border-chiziq text-matn'}`}>
                <b className={`shrink-0 ${i === togri ? 'text-yaxshi' : 'text-matn-xira'}`}>{HARFLAR[i]})</b>
                <span className={`${SAVOL_MATNI} min-w-0 flex-1 [&_p]:my-0 [&_img]:max-h-24`} dangerouslySetInnerHTML={{ __html: h }} />
                {i === togri && <Check size={14} strokeWidth={3} className="shrink-0 mt-0.5 text-yaxshi" aria-label="to'g'ri javob" />}
              </li>
            ))}
          </ol>
        )}
        {q.type === 'yopiq' && togri < 0 && <p className="mt-1.5 text-[11.5px] font-semibold text-xato">To'g'ri javob belgilanmagan</p>}
        {q.type === 'raqamli' && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-yaxshi-fon ring-1 ring-yaxshi/35 px-2.5 py-1 text-[12.5px]">
            <span className="text-matn-sokin">Javob:</span><b className="text-yaxshi raqam">{raqamliJavob || '—'}</b>
          </p>
        )}
        {q.type === 'moslash' && <div className="mt-2"><MoslashJadvali ixcham chap={q.options || []} ong={q.answers || []} kalit={q.correctAnswer || ''} /></div>}
        {q.type === 'yozma' && <p className="mt-2 text-[12px] text-matn-xira">Yozma javob — ustoz baholaydi{q.points ? ` (${q.points} ball)` : ''}</p>}
        {(q.source || q.toplam || q.remark) && <p className="mt-1.5 text-[11px] text-matn-xira">{[q.source, q.toplam && `fayl: ${q.toplam}`, q.remark && `izoh: ${q.remark}`].filter(Boolean).join(' · ')}</p>}
      </div>
    </li>
  );
});
