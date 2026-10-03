import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Eye, Tags, Trash2, RotateCcw, Eraser, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Loader2, Search, X, Check, SlidersHorizontal, LayoutList, Rows3, Pencil, Globe, HelpCircle, Columns3, MousePointerClick } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, Yorliq, Tanlov, Yuklanmoqda, BoshHolat } from '../ui';
import { formulaliHtml, oddiyMatn, SAVOL_MATNI } from '../../../lib/matn';
import { HARFLAR } from '../../../../lib/imtihon.js';
import { BelgilashOynasi, type BelgilashBoshi } from './BankOynalari';
import { SavolOynasi } from './SavolKartasi';
import MoslashJadvali from './MoslashJadvali';
import { QIYINLIK, RANG_NOMLARI, QiyinlikYorligi, qiyinlikniSozla, qiyinlikSozlamasi, useQiyinlik } from './qiyinlik';
import { Ustun, UstunlarGuruhi, Qator, QoshQator, UstunBosh, UstunGuruh, SarlavhaTugma, Yoriqnoma, KutishQatori, sudrashniBoshla, sudralayotgan, type Biriktirish, type Sudralgan } from './BankUstunlari';
import type { BankDaraxt, BankFan, BankFiltrMalumoti, BelgiGuruhi, Question, SavolTuri } from '../../../types';

// Savollar banki. Tepada yonma-yon ustunlar: Fan → Bo'lim → Mavzu → Qiyinlik →
// foydalanuvchi filtrlari. Hammasi shu joyning o'zida qo'shiladi, nomi o'zgartiriladi,
// o'chiriladi (egasi, 2026-10-03: "kirib-chiqish qiyin — hammasi birinchi panelda
// bo'lsin, o'zim qo'shay"). Savollar belgilansa — ustun qatorlarida "shu yerga"
// tugmalari chiqadi (mavzuga o'tkazish, darajani qo'yish, filtrga biriktirish /
// ajratish); savolni qatorga sudrab tashlasa ham bo'ladi. Pastda — savollar
// kartochka bo'lib: matn, variantlar va to'g'ri javob ochmasdan ko'rinadi.
//
// Ustunlardagi amallar ekranda darhol ko'rinadi (mahalliy holat), serverga esa fonda,
// navbat bilan yoziladi — baza uzoqda bo'lsa ham kutib o'tirilmaydi. Navbat bo'shagach
// ro'yxat va sonlar jimgina serverdan qayta olinadi; xato bo'lsa xabar chiqadi va
// ekran serverdagi holatga qaytadi.

type Korinish = 'karta' | 'ixcham';
const SAHIFA: Record<Korinish, number> = { karta: 40, ixcham: 100 };
type Holat = '' | 'faol' | 'qoralama' | 'arxiv';
interface FiltrTanlovi {
  bolimlar: string[]; mavzular: number[]; qiyinlik: number[]; darajalar: number[]; manbalar: string[]; belgilar: Record<number, number[]>;
  toplam: string | null; holat: Holat; tur: '' | SavolTuri; qidiruv: string; qidDan: string; qidGacha: string;
  /** Addmen REMARK, PASSAGE, DISPLAY CHOICES. */
  izohlar: string[]; matnli: '' | 'bor' | 'yoq'; joylashuv: number[];
}
const BOSH: FiltrTanlovi = { bolimlar: [], mavzular: [], qiyinlik: [], darajalar: [], manbalar: [], belgilar: {}, toplam: null, holat: '', tur: '', qidiruv: '', qidDan: '', qidGacha: '', izohlar: [], matnli: '', joylashuv: [] };
const JOYLASHUV_NOMI: Record<number, string> = { 0: 'Avtomatik', 1: '1 ustun', 2: '2 ustun', 4: '4 ustun' };
const TUR_NOMI: Record<SavolTuri, string> = { yopiq: 'Variantli', raqamli: 'Raqamli javob', moslash: 'Moslashtirish', yozma: 'Yozma' };
const HOLAT_NOMI: Record<Exclude<Holat, ''>, string> = { faol: 'Faol', qoralama: 'Qoralama', arxiv: 'Arxiv' };
const sana = (s?: string) => (s ? new Date(s).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '.') : '');
const almashtirRoyxat = <K,>(l: K[], k: K) => (l.includes(k) ? l.filter(x => x !== k) : [...l, k]);
const TABLETKA = (faol: boolean) => `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer transition-colors ${faol ? 'bg-brand text-brand-ust border-brand' : 'bg-sirt border-chiziq text-matn-sokin hover:text-matn hover:border-chiziq-kuchli'}`;
const eslab = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* eslab qolinmaydi */ } };
const eslangan = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

type Qator_ = Pick<Question, 'id' | 'text' | 'type' | 'difficulty' | 'status' | 'toplam' | 'source' | 'tagIds' | 'topic' | 'bankTopicId' | 'usedCount' | 'createdAt' | 'imageUrl' | 'options' | 'correctAnswer' | 'answers' | 'points' | 'remark' | 'passageId' | 'joylashuv'>;
/** Tanlangan savollar qayerda: har mavzu / belgi / qiyinlikda nechtasi. */
interface TanlovHolati { jami: number; mavzular: Record<number, number>; belgilar: Record<number, number>; qiyinlik: number[] }
const daraja3 = (d: number) => Math.min(3, Math.max(1, Number(d) || 1));
const birXil = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Savollar to'plamining taqsimoti (qaysi mavzu / daraja / belgida nechtasi). */
function taqsimot(savollar: Pick<Qator_, 'bankTopicId' | 'difficulty' | 'tagIds'>[]): TanlovHolati {
  const h: TanlovHolati = { jami: savollar.length, mavzular: {}, belgilar: {}, qiyinlik: [0, 0, 0] };
  for (const q of savollar) {
    if (q.bankTopicId) h.mavzular[q.bankTopicId] = (h.mavzular[q.bankTopicId] || 0) + 1;
    h.qiyinlik[daraja3(q.difficulty) - 1]++;
    for (const t of q.tagIds || []) h.belgilar[t] = (h.belgilar[t] || 0) + 1;
  }
  return h;
}

/** Bo'limlar ro'yxati mavzulardan qayta sanaladi: `nomlar` tartibida, bo'limsiz mavzular bo'lsa oxirida ''. */
function bolimlarniSana(x: BankFiltrMalumoti, nomlar: string[]): BankFiltrMalumoti {
  const l = [...nomlar.filter(Boolean), ...(x.mavzular.some(m => !m.bolim) ? [''] : [])];
  return { ...x, bolimlar: l.map(nom => { const m = x.mavzular.filter(y => y.bolim === nom); return { nom, soni: m.reduce((a, y) => a + y.soni, 0), mavzular: m.length }; }) };
}

export default function BankJadvali({ daraxt, fanId, onFan, yangilaDaraxt, onQosh, onTuzilma, savolTahrir }: {
  daraxt: BankDaraxt; fanId: number | null; onFan: (id: number) => void; yangilaDaraxt: () => Promise<unknown> | void;
  onQosh?: () => void; onTuzilma: () => void; savolTahrir: boolean;
}) {
  const { ozgartira, showNotification } = useCRM();
  const ochiradi = ozgartira('imtihonlar.ochirish');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const fan = daraxt.fanlar.find(f => f.id === fanId) || daraxt.fanlar[0] || null;
  useQiyinlik();   // darajalar nomi yoki soni o'zgarsa — qayta chiziladi

  const [filtr, setFiltr] = useState<BankFiltrMalumoti | null>(null);
  const [t, setT] = useState<FiltrTanlovi>(BOSH);
  const [tartib, setTartib] = useState<'asc' | 'desc'>('asc');
  const [korinish, setKorinishHolat] = useState<Korinish>(() => (eslangan('bank_korinish') === 'ixcham' ? 'ixcham' : 'karta'));
  const setKorinish = (k: Korinish) => { setKorinishHolat(k); eslab('bank_korinish', k); };
  const [sahifa, setSahifa] = useState(1);
  const [royxat, setRoyxat] = useState<{ items: Qator_[]; total: number } | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [tanlangan, setTanlangan] = useState<Set<number>>(new Set());
  const [qayta, setQayta] = useState(0);
  const [belgilash, setBelgilash] = useState(false);
  const [ochiq, setOchiq] = useState<Question | null>(null);
  const [band, setBand] = useState<string | null>(null);
  const [serverHolat, setServerHolat] = useState<TanlovHolati | null>(null);
  // Serverga yozilayotgan yangi qatorlar (nomi ustunda darhol ko'rinadi).
  const [kutilmoqda, setKutilmoqda] = useState<{ ustun: string; nom: string }[]>([]);
  const navbat = useRef<Promise<unknown>>(Promise.resolve());
  const navbatSoni = useRef(0);
  const versiya = useRef(0);
  const jim = useRef(false);
  // Ustunlar: yig'ilgan/ochiq, yo'riqnoma, "boshqa filtrlar", sudrash va chaqnash.
  const [yigiq, setYigiqHolat] = useState(() => eslangan('bank_ustun_yigiq') === '1');
  const setYigiq = (v: boolean) => { setYigiqHolat(v); eslab('bank_ustun_yigiq', v ? '1' : '0'); };
  const [yoriqnoma, setYoriqnomaHolat] = useState(() => eslangan('bank_yoriqnoma') !== '0');
  const setYoriqnoma = (v: boolean) => { setYoriqnomaHolat(v); eslab('bank_yoriqnoma', v ? '1' : '0'); };
  const [boshqa, setBoshqa] = useState(false);
  const [sudrash, setSudrash] = useState<'savol' | 'mavzu' | null>(null);
  const [chaqnash, setChaqnash] = useState<string | null>(null);
  const [mavzuQidiruv, setMavzuQidiruv] = useState('');
  const [filtrNomi, setFiltrNomi] = useState<{ id: number; nom: string } | null>(null);
  const [yangiFiltr, setYangiFiltr] = useState<number | null>(null);
  const ustunlarRef = useRef<HTMLElement>(null);
  const soni = SAHIFA[korinish];

  // Fan almashsa — filtr va tanlov boshidan.
  useEffect(() => { setT(BOSH); setTanlangan(new Set()); setSahifa(1); setFiltr(null); setMavzuQidiruv(''); }, [fan?.id]);

  const fanIdRef = useRef(fan?.id);
  fanIdRef.current = fan?.id;
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

  const sorov = useMemo(() => encodeURIComponent(JSON.stringify({
    fanId: fan?.id, qidDan: t.qidDan || undefined, qidGacha: t.qidGacha || undefined, holat: t.holat || undefined,
    bolimlar: t.bolimlar.length ? t.bolimlar : undefined, mavzular: t.mavzular, qiyinlik: t.qiyinlik, darajalar: t.darajalar, manbalar: t.manbalar, belgilar: t.belgilar,
    toplam: t.toplam ?? undefined, tur: t.tur || undefined, qidiruv: t.qidiruv.trim() || undefined,
    izohlar: t.izohlar, matnli: t.matnli || undefined, joylashuv: t.joylashuv,
  })), [fan?.id, t]);

  useEffect(() => { setSahifa(1); }, [sorov, tartib, korinish]);
  useEffect(() => {
    if (!fan) { setRoyxat(null); return; }
    let bekor = false;
    // Fondagi sinxronlash jim o'tadi (ro'yxat xiralashmaydi).
    const jimmi = jim.current;
    jim.current = false;
    if (!jimmi) setYuklanmoqda(true);
    const kut = setTimeout(() => {
      const v = versiya.current;
      soro<{ items: Qator_[]; total: number }>('GET', `bank/royxat?f=${sorov}&sahifa=${sahifa}&soni=${soni}&tartib=${tartib}`)
        .then(r => { if (!bekor && versiya.current === v) setRoyxat(r); })
        .catch(e => { if (!bekor) showNotification(e.message, 'error'); })
        .finally(() => { if (!bekor) setYuklanmoqda(false); });
    }, jimmi ? 0 : 250);
    return () => { bekor = true; clearTimeout(kut); };
  }, [sorov, sahifa, soni, tartib, qayta, fan?.id, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tanlangan savollar qayerga biriktirilgani — qator yonidagi tugma holati uchun. Hammasi
  // ekrandagi sahifada bo'lsa — shu yerning o'zida sanaladi, aks holda serverdan so'raladi.
  const mahalliyHolat = useMemo(() => {
    if (!tanlangan.size || !royxat) return null;
    const m = new Map(royxat.items.map(q => [q.id, q]));
    const l: Qator_[] = [];
    for (const id of tanlangan) { const q = m.get(id); if (!q) return null; l.push(q); }
    return taqsimot(l);
  }, [tanlangan, royxat]);
  const serverdan = tanlangan.size > 0 && !mahalliyHolat;
  useEffect(() => {
    if (!serverdan) { setServerHolat(null); return; }
    let bekor = false;
    const kut = setTimeout(() => {
      const v = versiya.current;
      soro<TanlovHolati>('POST', 'bank/tanlov-holati', { ids: [...tanlangan] }).then(r => { if (!bekor && versiya.current === v) setServerHolat(r); }).catch(() => { /* tugmalar holatsiz ham ishlaydi */ });
    }, 120);
    return () => { bekor = true; clearTimeout(kut); };
  }, [tanlangan, serverdan, qayta, soro]);
  const holat = mahalliyHolat || serverHolat;

  // Sudrash boshlanganda ustun qatorlari "shu yerga tashlang" ko'rinishini oladi.
  useEffect(() => {
    const boshla = () => setSudrash(sudralayotgan()?.tur || null);
    const tugat = () => { sudrashniBoshla(null); setSudrash(null); };
    document.addEventListener('dragstart', boshla);
    document.addEventListener('dragend', tugat);
    document.addEventListener('drop', tugat);
    return () => { document.removeEventListener('dragstart', boshla); document.removeEventListener('dragend', tugat); document.removeEventListener('drop', tugat); };
  }, []);

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
  const kutishQosh = (ustun: string, nom: string) => setKutilmoqda(l => [...l, { ustun, nom }]);
  const kutishOl = (ustun: string, nom: string) => setKutilmoqda(l => { const i = l.findIndex(x => x.ustun === ustun && x.nom === nom); return i < 0 ? l : l.filter((_, j) => j !== i); });
  const kutayotganlar = (ustun: string) => kutilmoqda.filter(x => x.ustun === ustun).map((x, i) => <KutishQatori key={`k${i}`} nom={x.nom} />);

  const mavzuNomi = useMemo(() => new Map((filtr?.mavzular || []).map(m => [m.id, m.nom])), [filtr]);
  const belgiNomi = useMemo(() => new Map((filtr?.guruhlar || []).flatMap(g => g.tags.map(x => [x.id, x.name] as const))), [filtr]);
  const darajalar = filtr?.darajalar || [];
  const darajaMap = useMemo(() => new Map(darajalar.map(d => [d.id, d])), [filtr]); // eslint-disable-line react-hooks/exhaustive-deps

  // Faol filtrlar — ro'yxat ustida olib tashlanadigan yorliqlar.
  const yorliqlar = useMemo(() => {
    const l: { k: string; nom: string; ol: () => void }[] = [];
    for (const b of t.bolimlar) l.push({ k: `bo${b}`, nom: b || "Bo'limsiz", ol: () => setT(x => ({ ...x, bolimlar: x.bolimlar.filter(y => y !== b) })) });
    for (const id of t.mavzular) l.push({ k: `m${id}`, nom: mavzuNomi.get(id) || `#${id}`, ol: () => setT(x => ({ ...x, mavzular: x.mavzular.filter(y => y !== id) })) });
    for (const d of t.qiyinlik) l.push({ k: `q${d}`, nom: QIYINLIK[d - 1]?.nom || String(d), ol: () => setT(x => ({ ...x, qiyinlik: x.qiyinlik.filter(y => y !== d) })) });
    for (const d of t.darajalar) l.push({ k: `d${d}`, nom: darajaMap.get(d)?.name || `#${d}`, ol: () => setT(x => ({ ...x, darajalar: x.darajalar.filter(y => y !== d) })) });
    if (t.tur) l.push({ k: 'tur', nom: TUR_NOMI[t.tur], ol: () => setT(x => ({ ...x, tur: '' })) });
    for (const m of t.manbalar) l.push({ k: `s${m}`, nom: m || 'Manbasiz', ol: () => setT(x => ({ ...x, manbalar: x.manbalar.filter(y => y !== m) })) });
    for (const [g, ids] of Object.entries(t.belgilar)) for (const id of ids) {
      l.push({ k: `b${id}`, nom: belgiNomi.get(id) || `#${id}`, ol: () => setT(x => ({ ...x, belgilar: { ...x.belgilar, [g]: (x.belgilar[Number(g)] || []).filter(y => y !== id) } })) });
    }
    if (t.toplam !== null) l.push({ k: 'toplam', nom: `Fayl: ${t.toplam || "to'plamsiz"}`, ol: () => setT(x => ({ ...x, toplam: null })) });
    if (t.holat) l.push({ k: 'holat', nom: HOLAT_NOMI[t.holat], ol: () => setT(x => ({ ...x, holat: '' })) });
    for (const z of t.izohlar) l.push({ k: `z${z}`, nom: `Izoh: ${z || "yo'q"}`, ol: () => setT(x => ({ ...x, izohlar: x.izohlar.filter(y => y !== z) })) });
    if (t.matnli) l.push({ k: 'matnli', nom: t.matnli === 'bor' ? 'Matnli savollar' : 'Matnsiz savollar', ol: () => setT(x => ({ ...x, matnli: '' })) });
    for (const j of t.joylashuv) l.push({ k: `j${j}`, nom: `Variantlar: ${JOYLASHUV_NOMI[j]}`, ol: () => setT(x => ({ ...x, joylashuv: x.joylashuv.filter(y => y !== j) })) });
    if (t.qidDan || t.qidGacha) l.push({ k: 'qid', nom: `QID ${t.qidDan || '…'}–${t.qidGacha || '…'}`, ol: () => setT(x => ({ ...x, qidDan: '', qidGacha: '' })) });
    return l;
  }, [t, mavzuNomi, belgiNomi, darajaMap]);
  const tozala = () => setT(x => ({ ...BOSH, qidiruv: x.qidiruv }));
  const boshqaSoni = (t.tur ? 1 : 0) + (t.holat ? 1 : 0) + t.manbalar.length + (t.toplam !== null ? 1 : 0) + t.izohlar.length + (t.matnli ? 1 : 0) + t.joylashuv.length + (t.qidDan || t.qidGacha ? 1 : 0);

  // --- Tanlash ---------------------------------------------------------------
  const sahifadagi = royxat?.items.map(q => q.id) || [];
  const sahifaTanlangan = sahifadagi.length > 0 && sahifadagi.every(id => tanlangan.has(id));
  const almashtir = useCallback((id: number) => setTanlangan(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const sahifaniTanla = () => setTanlangan(s => {
    const n = new Set(s);
    if (sahifaTanlangan) sahifadagi.forEach(id => n.delete(id)); else sahifadagi.forEach(id => n.add(id));
    return n;
  });
  const hammasiniTanla = async () => {
    setBand('tanla');
    try {
      const r = await soro<{ ids: number[] }>('GET', `bank/royxat?f=${sorov}&idlar=1&tartib=${tartib}`);
      setTanlangan(new Set(r.ids));
    } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(null); }
  };
  const ids = [...tanlangan];
  const N = holat?.jami ?? tanlangan.size;

  const ish = async (nom: string, f: () => Promise<void>) => {
    setBand(nom);
    try { await f(); } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(null); }
  };
  /** Ustundagi amal: xato bo'lsa xabar chiqadi va `false` qaytadi (maydon yopilmaydi). */
  const amal = async (f: () => Promise<void>): Promise<boolean> => {
    try { await f(); return true; } catch (e: any) { showNotification(e.message, 'error'); return false; }
  };

  const korish = useCallback((id: number) => {
    setBand('korish');
    soro<Question>('GET', `questions/${id}`).then(setOchiq).catch(e => showNotification(e.message, 'error')).finally(() => setBand(null));
  }, [soro]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Biriktirish: tanlangan (yoki sudrab tashlangan) savollarni ustun qatoriga --------
  const chaqna = (kalit: string) => { setChaqnash(kalit); setTimeout(() => setChaqnash(k => (k === kalit ? null : k)), 1100); };
  /** Taqsimotga amal qo'llanganidan keyingi holat (hamma savol bir xil qiymat oladi). */
  const holatdaQolla = (h: TanlovHolati, body: Record<string, any>): TanlovHolati => {
    const y: TanlovHolati = { jami: h.jami, mavzular: { ...h.mavzular }, belgilar: { ...h.belgilar }, qiyinlik: [...h.qiyinlik] };
    if (body.bankTopicId) y.mavzular = { [body.bankTopicId]: h.jami };
    if (body.difficulty || body.darajaId) {
      const d = body.darajaId ? darajaMap.get(body.darajaId)?.asos || 2 : daraja3(body.difficulty);
      y.qiyinlik = [0, 0, 0];
      y.qiyinlik[d - 1] = h.jami;
      for (const x of darajalar) delete y.belgilar[x.id];
      if (body.darajaId) y.belgilar[body.darajaId] = h.jami;
    }
    for (const x of body.tagQosh || []) y.belgilar[x] = h.jami;
    for (const x of body.tagOl || []) delete y.belgilar[x];
    return y;
  };
  const biriktir = (idlar: number[], body: Record<string, any>, _xabar: string, kalit: string) => {
    if (!idlar.length || !savolTahrir) return;
    const set = new Set(idlar);
    const darajaIdlar = new Set(darajalar.map(d => d.id));
    // Oldingi taqsimot: ekrandagi savollardan; tanlov sahifadan katta bo'lsa — serverdan olingani.
    const ekranda = (royxat?.items || []).filter(q => set.has(q.id));
    const oldin = ekranda.length === idlar.length ? taqsimot(ekranda) : (idlar.length === tanlangan.size && holat ? holat : null);
    setRoyxat(r => r && ({
      ...r, items: r.items.map(q => {
        if (!set.has(q.id)) return q;
        const y = { ...q };
        let teglar = q.tagIds || [];
        if (body.bankTopicId) { y.bankTopicId = body.bankTopicId; y.topic = mavzuNomi.get(body.bankTopicId) || q.topic; }
        if (body.difficulty) { y.difficulty = body.difficulty; teglar = teglar.filter(x => !darajaIdlar.has(x)); }
        if (body.darajaId) { y.difficulty = darajaMap.get(body.darajaId)?.asos || q.difficulty; teglar = [...teglar.filter(x => !darajaIdlar.has(x)), body.darajaId]; }
        if (body.tagQosh) teglar = [...new Set([...teglar, ...body.tagQosh])];
        if (body.tagOl) teglar = teglar.filter(x => !body.tagOl.includes(x));
        y.tagIds = teglar;
        return y;
      }),
    }));
    if (oldin) {
      const keyin = holatdaQolla(oldin, body);
      if (!mahalliyHolat && idlar.length === tanlangan.size) setServerHolat(keyin);
      // Ustunlardagi sonlar: eskisi ayiriladi, yangisi qo'shiladi.
      filtrda(x => {
        const farq = (a: Record<number, number>, b: Record<number, number>, k: number) => (b[k] || 0) - (a[k] || 0);
        const belgilar = { ...x.belgilar };
        for (const k of new Set([...Object.keys(oldin.belgilar), ...Object.keys(keyin.belgilar)].map(Number))) belgilar[k] = Math.max(0, (belgilar[k] || 0) + farq(oldin.belgilar, keyin.belgilar, k));
        const y = {
          ...x, belgilar,
          mavzular: x.mavzular.map(m => ({ ...m, soni: Math.max(0, m.soni + farq(oldin.mavzular, keyin.mavzular, m.id)) })),
          qiyinlik: x.qiyinlik.map((n, i) => Math.max(0, n + keyin.qiyinlik[i] - oldin.qiyinlik[i])) as BankFiltrMalumoti['qiyinlik'],
          darajalar: x.darajalar.map(d => ({ ...d, soni: belgilar[d.id] || 0 })),
        };
        return bolimlarniSana(y, x.bolimlar.map(b => b.nom));
      });
    }
    // Natija ustunning o'zida ko'rinadi (qator chaqnaydi, sonlar va tugma o'zgaradi) — xabar faqat xatoda.
    chaqna(kalit);
    fonda(() => soro('PUT', 'questions/bulk', { ids: idlar, ...body }));
  };
  const birik = (tur: Biriktirish['tur'], shuYerda: number, onBos: () => void): Biriktirish | null =>
    (savolTahrir && tanlangan.size > 0 ? { tur, soni: shuYerda, jami: N, holat: holat && shuYerda >= N ? 'hammasi' : shuYerda > 0 ? 'qisman' : 'yoq', onBos } : null);
  const tashlandi = (s: Sudralgan, body: Record<string, unknown>, nom: string, kalit: string, fel: string) => {
    if (s.tur === 'savol') biriktir(s.ids, body, `${s.ids.length} ta savol «${nom}» ${fel}`, kalit);
  };

  // Kartochka sudralganda: tanlanganlar ichida bo'lsa — hammasi, bo'lmasa o'zi.
  const tanlanganRef = useRef(tanlangan);
  tanlanganRef.current = tanlangan;
  const sudra = useCallback((id: number, e: React.DragEvent) => {
    const s = tanlanganRef.current;
    const idlar = s.has(id) ? [...s] : [id];
    sudrashniBoshla({ tur: 'savol', ids: idlar });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idlar.map(x => `#${x}`).join(' '));
    const rasm = document.createElement('div');
    rasm.textContent = `${idlar.length} ta savol`;
    rasm.style.cssText = 'position:fixed;top:-200px;left:-200px;padding:7px 14px;border-radius:999px;background:var(--color-brand);color:var(--color-brand-ust,#fff);font:700 13px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.25)';
    document.body.appendChild(rasm);
    e.dataTransfer.setDragImage(rasm, 12, 14);
    setTimeout(() => rasm.remove(), 0);
  }, []);
  const biriktirRef = useRef(biriktir);
  biriktirRef.current = biriktir;
  const belgiOl = useCallback((qid: number, tagId: number, nom: string) => {
    biriktirRef.current([qid], { tagOl: [tagId] }, `#${qid} dan «${nom}» ajratildi`, `t${tagId}`);
  }, []);

  // --- Fan, bo'lim, mavzu, daraja va filtrlar: shu joyning o'zida ------------------------
  const bor = (nom: string) => { showNotification(`«${nom}» allaqachon bor`, 'error'); return false; };
  const bolimNomlariHozir = () => (filtr?.bolimlar || []).map(b => b.nom).filter(Boolean);

  // Fan — ro'yxati yuqoridan (daraxt) keladi, shuning uchun server javobi kutiladi.
  const fanQosh = async (nom: string) => {
    if (daraxt.fanlar.some(f => birXil(f.name, nom))) return bor(nom);
    kutishQosh('fan', nom);
    fonda(async () => {
      try {
        const f = await soro<{ id: number; name: string }>('POST', 'bank/fanlar', { name: nom });
        await yangilaDaraxt();
        onFan(f.id);
        showNotification(`«${f.name}» fani qo'shildi — endi bo'lim va mavzularini yozing`, 'success');
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
    if (!(await confirm({ title: `«${f.name}» fani o'chirilsinmi?`, message: "Fanning bo'lim, mavzu va o'z filtrlari ham o'chadi. Savoli bor fan o'chirilmaydi.", confirmLabel: "O'chirish", danger: true }))) return;
    await amal(async () => {
      await soro('DELETE', `bank/fanlar/${f.id}`);
      if (f.id === fan?.id) onFan(0);
      await yangilaDaraxt();
    });
  };

  const bolimQosh = async (nom: string) => {
    if (bolimNomlariHozir().some(b => birXil(b, nom))) return bor(nom);
    filtrda(x => bolimlarniSana(x, [...x.bolimlar.map(b => b.nom), nom]));
    chaqna(`b${nom}`);
    fonda(() => soro('POST', 'bank/bolimlar', { subjectId: fan!.id, name: nom }));
    return true;
  };
  const bolimNomi = async (eski: string, yangi: string) => {
    if (eski === yangi) return true;
    if (bolimNomlariHozir().some(b => b !== eski && birXil(b, yangi))) return bor(yangi);
    filtrda(x => bolimlarniSana({ ...x, mavzular: x.mavzular.map(m => (m.bolim === eski ? { ...m, bolim: yangi } : m)) }, x.bolimlar.map(b => (b.nom === eski ? yangi : b.nom))));
    setT(x => ({ ...x, bolimlar: x.bolimlar.map(b => (b === eski ? yangi : b)) }));
    fonda(() => soro('PUT', 'bank/bolimlar', { subjectId: fan!.id, eski, yangi }));
    return true;
  };
  const bolimOchir = async (b: { nom: string; mavzular?: number }) => {
    if (!(await confirm({ title: `«${b.nom}» bo'limi o'chirilsinmi?`, message: b.mavzular ? `${b.mavzular} ta mavzusi o'chmaydi — «Bo'limsiz» bo'lib qoladi.` : "Bo'lim bo'sh.", confirmLabel: "O'chirish", danger: true }))) return;
    filtrda(x => bolimlarniSana({ ...x, mavzular: x.mavzular.map(m => (m.bolim === b.nom ? { ...m, bolim: '' } : m)) }, x.bolimlar.map(y => y.nom).filter(y => y !== b.nom)));
    setT(x => ({ ...x, bolimlar: x.bolimlar.filter(y => y !== b.nom) }));
    fonda(() => soro('DELETE', `bank/bolimlar?subjectId=${fan!.id}&name=${encodeURIComponent(b.nom)}`));
  };

  const maqsadBolim = t.bolimlar.length === 1 ? t.bolimlar[0] : '';
  const mavzuQosh = async (nom: string) => {
    if ((filtr?.mavzular || []).some(m => birXil(m.nom, nom)) || kutilmoqda.some(k => k.ustun === 'mavzu' && birXil(k.nom, nom))) return bor(nom);
    const bolim = maqsadBolim;
    kutishQosh('mavzu', nom);
    fonda(async () => {
      try {
        const m = await soro<{ id: number; name: string; section: string | null }>('POST', 'bank/mavzular', { subjectId: fan!.id, name: nom, section: bolim || null });
        filtrda(x => bolimlarniSana({ ...x, mavzular: [...x.mavzular, { id: m.id, nom: m.name, bolim: m.section || '', soni: 0 }] }, x.bolimlar.map(b => b.nom)));
        chaqna(`m${m.id}`);
      } finally { kutishOl('mavzu', nom); }
    });
    return true;
  };
  const mavzuSaqla = async (m: { id: number; nom: string; bolim: string }, nom: string, bolim: string) => {
    if (nom === m.nom && bolim === m.bolim) return true;
    if ((filtr?.mavzular || []).some(x => x.id !== m.id && birXil(x.nom, nom))) return bor(nom);
    filtrda(x => bolimlarniSana({ ...x, mavzular: x.mavzular.map(y => (y.id === m.id ? { ...y, nom, bolim } : y)) }, x.bolimlar.map(b => b.nom)));
    fonda(() => soro('PUT', `bank/mavzular/${m.id}`, { name: nom, ...(bolim !== m.bolim ? { section: bolim || null } : {}) }));
    return true;
  };
  const mavzuBolimga = (id: number, bolim: string) => {
    const m = filtr?.mavzular.find(x => x.id === id);
    if (!m || m.bolim === bolim) return;
    filtrda(x => bolimlarniSana({ ...x, mavzular: x.mavzular.map(y => (y.id === id ? { ...y, bolim } : y)) }, x.bolimlar.map(b => b.nom)));
    chaqna(`b${bolim}`);
    fonda(() => soro('PUT', `bank/mavzular/${id}`, { section: bolim || null }));
  };
  const mavzuOchir = async (m: { id: number; nom: string; soni: number }) => {
    if (m.soni > 0) return showNotification(`«${m.nom}» mavzusida ${m.soni} ta savol bor — avval ularni belgilab, boshqa mavzu yonidagi → bilan o'tkazing`, 'error');
    if (!(await confirm({ title: `«${m.nom}» mavzusi o'chirilsinmi?`, message: 'Mavzuda savol yo\'q.', confirmLabel: "O'chirish", danger: true }))) return;
    filtrda(x => bolimlarniSana({ ...x, mavzular: x.mavzular.filter(y => y.id !== m.id) }, x.bolimlar.map(b => b.nom)));
    setT(x => ({ ...x, mavzular: x.mavzular.filter(y => y !== m.id) }));
    fonda(() => soro('DELETE', `bank/mavzular/${m.id}`));
  };

  // Asosiy daraja (yashil / sariq / qizil o'rin): nomini o'zgartirish va olib tashlash. Savoli bor daraja
  // olinmaydi; oxirgisi ham. Olib tashlangan o'rin «Daraja qo'shish» da shu rang tanlansa qaytadi.
  const asosiyNomi = async (d: number, nom: string) => {
    if (QIYINLIK[d - 1].nom === nom) return true;
    if (QIYINLIK.some(q => q.d !== d && !q.yashirin && birXil(q.nom, nom)) || darajalar.some(x => birXil(x.name, nom))) return bor(nom);
    qiyinlikniSozla(qiyinlikSozlamasi().map(q => (q.d === d ? { ...q, nom } : q)), { mahalliy: true });
    fonda(() => soro('PUT', `bank/darajalar/asosiy/${d}`, { name: nom }));
    return true;
  };
  const asosiyOchir = async (d: number) => {
    const q = QIYINLIK[d - 1];
    if (QIYINLIK.filter(x => !x.yashirin).length <= 1) return showNotification('Kamida bitta daraja qolishi kerak', 'error');
    const n = filtr?.qiyinlik[d - 1] || 0;
    if (n > 0) return showNotification(`«${q.nom}» darajasida ${n} ta savol bor — avval ularni belgilab, boshqa daraja yonidagi → bilan o'tkazing`, 'error');
    if (!(await confirm({ title: `«${q.nom}» darajasi olib tashlansinmi?`, message: "Qolgan darajalar bilan ishlaysiz. Keyin «Daraja qo'shish» orqali qaytarsa bo'ladi.", confirmLabel: 'Olib tashlash', danger: true }))) return;
    qiyinlikniSozla(qiyinlikSozlamasi().map(x => (x.d === d ? { ...x, yashirin: true } : x)), { mahalliy: true });
    setT(x => ({ ...x, qiyinlik: x.qiyinlik.filter(y => y !== d) }));
    fonda(() => soro('PUT', `bank/darajalar/asosiy/${d}`, { yashirin: true }));
  };
  const darajaQosh = async (nom: string, asos: string) => {
    if (QIYINLIK.some(q => !q.yashirin && birXil(q.nom, nom)) || darajalar.some(d => birXil(d.name, nom)) || kutilmoqda.some(k => k.ustun === 'daraja' && birXil(k.nom, nom))) return bor(nom);
    const o = Math.min(3, Math.max(1, Number(asos) || 1));
    // Shu rangdagi o'rin bo'sh bo'lsa — yangi daraja uning o'zi bo'ladi.
    if (QIYINLIK[o - 1].yashirin) {
      qiyinlikniSozla(qiyinlikSozlamasi().map(x => (x.d === o ? { ...x, nom, yashirin: false } : x)), { mahalliy: true });
      chaqna(`q${o}`);
      fonda(() => soro('PUT', `bank/darajalar/asosiy/${o}`, { name: nom, yashirin: false }));
      return true;
    }
    kutishQosh('daraja', nom);
    fonda(async () => {
      try {
        const d = await soro<{ id: number; name: string; asos: number }>('POST', 'bank/darajalar', { name: nom, asos: Number(asos) || 2 });
        filtrda(x => ({ ...x, darajalar: [...x.darajalar, { id: d.id, name: d.name, asos: daraja3(d.asos), soni: 0 }] }));
        chaqna(`t${d.id}`);
      } finally { kutishOl('daraja', nom); }
    });
    return true;
  };
  /** Daraja yoki filtr qiymati: nomi (darajada — guruhi ham). */
  const belgiSaqla = async (id: number, body: { name: string; asos?: number }) => {
    const qardoshlar = darajaMap.has(id) ? darajalar : (filtr?.guruhlar.find(g => g.tags.some(x => x.id === id))?.tags || []);
    if (qardoshlar.some(x => x.id !== id && birXil(x.name, body.name))) return bor(body.name);
    filtrda(x => ({
      ...x,
      darajalar: x.darajalar.map(d => (d.id === id ? { ...d, name: body.name, asos: body.asos || d.asos } : d)),
      guruhlar: x.guruhlar.map(g => ({ ...g, tags: g.tags.map(y => (y.id === id ? { ...y, name: body.name } : y)) })),
    }));
    fonda(() => soro('PUT', `bank/belgilar/${id}`, body));
    return true;
  };
  const belgiOchir = async (b: { id: number; name: string }, guruh: string, soni: number) => {
    if (!(await confirm({ title: `«${b.name}» o'chirilsinmi?`, message: soni ? `${guruh}: ${soni} ta savoldan olinadi (savollarning o'zi qoladi).` : `${guruh} ro'yxatidan o'chadi.`, confirmLabel: "O'chirish", danger: true }))) return;
    filtrda(x => ({ ...x, darajalar: x.darajalar.filter(d => d.id !== b.id), guruhlar: x.guruhlar.map(g => ({ ...g, tags: g.tags.filter(y => y.id !== b.id) })) }));
    setRoyxat(r => r && ({ ...r, items: r.items.map(q => ((q.tagIds || []).includes(b.id) ? { ...q, tagIds: (q.tagIds || []).filter(y => y !== b.id) } : q)) }));
    setT(y => ({ ...y, darajalar: y.darajalar.filter(i => i !== b.id), belgilar: Object.fromEntries(Object.entries(y.belgilar).map(([k, v]) => [k, v.filter(i => i !== b.id)])) }));
    fonda(() => soro('DELETE', `bank/belgilar/${b.id}`));
  };

  const filtrQosh = async (nom: string) => {
    if ((filtr?.guruhlar || []).some(g => birXil(g.name, nom)) || kutilmoqda.some(k => k.ustun === 'filtr' && birXil(k.nom, nom))) return bor(nom);
    kutishQosh('filtr', nom);
    fonda(async () => {
      try {
        const g = await soro<BelgiGuruhi>('POST', 'bank/belgi-guruhlari', { name: nom, subjectId: fan!.id });
        filtrda(x => ({ ...x, guruhlar: [...x.guruhlar, { ...g, tags: g.tags || [] }] }));
        setYangiFiltr(g.id);
      } finally { kutishOl('filtr', nom); }
    });
    return true;
  };
  const filtrSaqla = (g: BelgiGuruhi, body: { name?: string; subjectId?: number | null }) => {
    setFiltrNomi(null);
    if (body.name !== undefined && (body.name === g.name || (filtr?.guruhlar || []).some(x => x.id !== g.id && birXil(x.name, body.name!)))) { if (body.name !== g.name) bor(body.name); return; }
    filtrda(x => ({ ...x, guruhlar: x.guruhlar.map(y => (y.id === g.id ? { ...y, ...body } : y)) }));
    fonda(() => soro('PUT', `bank/belgi-guruhlari/${g.id}`, body));
  };
  const filtrOchir = async (g: BelgiGuruhi) => {
    if (!(await confirm({ title: `«${g.name}» filtri o'chirilsinmi?`, message: `${g.tags.length} ta qiymati savollardan olinadi (savollarning o'zi qoladi).`, confirmLabel: "O'chirish", danger: true }))) return;
    const idlar = new Set(g.tags.map(x => x.id));
    filtrda(x => ({ ...x, guruhlar: x.guruhlar.filter(y => y.id !== g.id) }));
    setRoyxat(r => r && ({ ...r, items: r.items.map(q => ((q.tagIds || []).some(y => idlar.has(y)) ? { ...q, tagIds: (q.tagIds || []).filter(y => !idlar.has(y)) } : q)) }));
    setT(x => { const b = { ...x.belgilar }; delete b[g.id]; return { ...x, belgilar: b }; });
    fonda(() => soro('DELETE', `bank/belgi-guruhlari/${g.id}`));
  };
  const qiymatQosh = async (g: BelgiGuruhi, nom: string) => {
    const k = `g${g.id}`;
    if (g.tags.some(x => birXil(x.name, nom)) || kutilmoqda.some(x => x.ustun === k && birXil(x.nom, nom))) return bor(nom);
    kutishQosh(k, nom);
    fonda(async () => {
      try {
        const b = await soro<{ id: number; name: string; order: number }>('POST', 'bank/belgilar', { groupId: g.id, name: nom });
        filtrda(x => ({ ...x, guruhlar: x.guruhlar.map(y => (y.id === g.id ? { ...y, tags: [...y.tags, { id: b.id, name: b.name, order: b.order }] } : y)) }));
        chaqna(`t${b.id}`);
      } finally { kutishOl(k, nom); }
    });
    return true;
  };

  // O'zgartirish oynasi — filtrda bittadan tanlangan qiymat oldindan qo'yiladi (Addmen SAVE).
  const belgilashBoshi = (): BelgilashBoshi => {
    const b: BelgilashBoshi = { guruhlar: {} };
    if (t.mavzular.length === 1) b.mavzuId = t.mavzular[0];
    if (t.qiyinlik.length === 1) b.qiyinlik = t.qiyinlik[0];
    if (t.manbalar.length === 1) b.manba = t.manbalar[0];
    if (t.izohlar.length === 1) b.izoh = t.izohlar[0];
    for (const [g, v] of Object.entries(t.belgilar)) if (v.length) b.guruhlar![Number(g)] = v;
    return b;
  };

  const ishlatilishNol = () => ish('nol', async () => {
    if (!(await confirm({ message: `${ids.length} ta savolning «necha marta ishlatilgan» hisobi nolga tushirilsinmi? Imtihon tuzishda ular yana birinchi navbatda olinadi.`, danger: false }))) return;
    await soro('PUT', 'questions/bulk', { ids, ishlatilishNol: true });
    showNotification('Ishlatilish hisobi nolga tushirildi', 'success');
    ozgardi();
  });

  const ochir = () => ish('ochir', async () => {
    if (!(await confirm(`${ids.length} ta savol o'chirilsinmi? Imtihonda ishlatilganlari o'chirilmaydi — arxivga (yashirin) o'tadi.`))) return;
    const r = await soro<{ ochirildi: number; arxivlandi: number }>('POST', 'questions/bulk-ochir', { ids });
    showNotification(`${r.ochirildi} ta o'chirildi${r.arxivlandi ? `, ${r.arxivlandi} tasi arxivga o'tdi` : ''}`, 'info');
    setTanlangan(new Set());
    ozgardi();
  });

  const jamiSahifa = royxat ? Math.max(1, Math.ceil(royxat.total / soni)) : 1;
  const sahifalash = royxat && royxat.total > soni && (
    <span className="inline-flex items-center gap-1 text-[12px] text-matn-sokin">
      <button aria-label="Oldingi sahifa" disabled={sahifa <= 1} onClick={() => setSahifa(s => s - 1)} className="p-1 rounded-lg hover:bg-ichki disabled:opacity-30 cursor-pointer"><ChevronLeft size={15} /></button>
      <span className="raqam">{sahifa} / {jamiSahifa}</span>
      <button aria-label="Keyingi sahifa" disabled={sahifa >= jamiSahifa} onClick={() => setSahifa(s => s + 1)} className="p-1 rounded-lg hover:bg-ichki disabled:opacity-30 cursor-pointer"><ChevronRight size={15} /></button>
    </span>
  );

  // Mavzular ustuni: tanlangan bo'lim(lar)niki; bo'limlar bo'lsa — sarlavhalari bilan.
  const bolimNomlari = (filtr?.bolimlar || []).map(b => b.nom).filter(Boolean);
  const mavzular = (filtr?.mavzular || []).filter(m => (!t.bolimlar.length || t.bolimlar.includes(m.bolim)) && (!mavzuQidiruv.trim() || m.nom.toLowerCase().includes(mavzuQidiruv.trim().toLowerCase())));
  const mavzuGuruhlari = useMemo(() => {
    const tartibi = (filtr?.bolimlar || []).map(b => b.nom);
    const m = new Map<string, typeof mavzular>();
    for (const x of mavzular) { if (!m.has(x.bolim)) m.set(x.bolim, []); m.get(x.bolim)!.push(x); }
    return [...m.entries()].sort((a, b) => tartibi.indexOf(a[0]) - tartibi.indexOf(b[0]));
  }, [mavzular, filtr]); // eslint-disable-line react-hooks/exhaustive-deps
  const sarlavhali = bolimNomlari.length > 0 && mavzuGuruhlari.length > 1;

  const mavzuQatori = (m: (typeof mavzular)[number]) => (
    <Qator key={m.id} nom={m.nom} soni={m.soni} faol={t.mavzular.includes(m.id)} onBos={() => setT(x => ({ ...x, mavzular: almashtirRoyxat(x.mavzular, m.id) }))}
      onSaqla={savolTahrir ? (nom, bolim) => mavzuSaqla(m, nom, bolim) : undefined} onOchir={savolTahrir ? () => mavzuOchir(m) : undefined}
      tahrirQosh={{ nom: "Bo'limi", qiymat: m.bolim, korinish: 'tanlov', variantlar: [{ v: '', nom: "Bo'limsiz" }, ...bolimNomlari.map(b => ({ v: b, nom: b }))] }}
      biriktir={birik('kochir', holat?.mavzular[m.id] || 0, () => biriktir(ids, { bankTopicId: m.id }, `${N} ta savol «${m.nom}» mavzusiga o'tkazildi`, `m${m.id}`))}
      qabul="savol" onTashla={s => tashlandi(s, { bankTopicId: m.id }, m.nom, `m${m.id}`, "mavzusiga o'tkazildi")}
      sudraladi={savolTahrir ? { tur: 'mavzu', id: m.id } : undefined} chaqnash={chaqnash === `m${m.id}`} sudrashda={sudrash} />
  );

  return (
    <div className="space-y-3">
      {yoriqnoma && savolTahrir && <Yoriqnoma onYop={() => setYoriqnoma(false)} />}

      {/* ---------------- Ustunlar: tuzilma va filtrlar ---------------- */}
      {/* Savol tanlanganda yoki sudralayotganda — tepada yopishib turadi ("shu yerga" tugmalari ko'z oldida). */}
      <section aria-label="Tuzilma va filtrlar" ref={ustunlarRef}
        className={`scroll-mt-[64px] bg-sirt border rounded-2xl overflow-hidden transition-shadow ${(tanlangan.size > 0 || sudrash === 'savol') && savolTahrir ? 'lg:sticky lg:top-[60px] z-30 border-brand/50 lg:shadow-xl' : 'border-chiziq'}`}>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-chiziq">
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-matn"><Columns3 size={15} className="text-brand" /> Tuzilma va filtrlar</h3>
          {tanlangan.size > 0 && savolTahrir ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand text-brand-ust px-2.5 py-1 text-[12px] font-semibold">
              <MousePointerClick size={13} className="shrink-0" /> <span><span className="raqam">{tanlangan.size}</span> ta savol tanlandi<span className="hidden sm:inline"> — qator yonidagi → yoki + ni bosing (− ajratadi)</span></span>
            </span>
          ) : (
            <span className="text-[11.5px] text-matn-xira hidden sm:inline">Qatorni bosing — savollar saralanadi. Hammasi shu yerda qo'shiladi: ustun pastidagi «+».</span>
          )}
          <span className="ml-auto flex items-center gap-1">
            {yorliqlar.length > 0 && <button onClick={tozala} className="text-[12px] font-semibold text-brand hover:underline cursor-pointer mr-1">Tozalash</button>}
            {savolTahrir && <SarlavhaTugma ikonka={<HelpCircle size={15} />} nom="Qanday ishlaydi" faol={yoriqnoma} onClick={() => setYoriqnoma(!yoriqnoma)} />}
            <button type="button" onClick={() => setYigiq(!yigiq)} aria-expanded={!yigiq}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-semibold text-matn-sokin hover:bg-ichki cursor-pointer">
              {yigiq ? <ChevronDown size={14} /> : <ChevronUp size={14} />}{yigiq ? 'Ochish' : "Yig'ish"}
            </button>
          </span>
        </div>

        {!yigiq && (
          <div className="flex gap-4 overflow-x-auto px-2.5 pt-2 pb-2.5 snap-x">
            {/* Tuzilma: fan → bo'lim → mavzu (har biri chapdagisiga tegishli) */}
            <UstunlarGuruhi nom="Tuzilma" izoh="fan → bo'lim → mavzu">
            <Ustun nom="Fan" kenglik="w-[196px]" past={savolTahrir && <QoshQator joy="Fan qo'shish" onQosh={fanQosh} ochiqBoshlansin={!daraxt.fanlar.length} />}>
              {!daraxt.fanlar.length && <UstunBosh>Bank bo'sh. Birinchi fanni qo'shing — masalan «Matematika».</UstunBosh>}
              {daraxt.fanlar.map(f => (
                <Qator key={f.id} nom={f.name} belgi="bitta" soni={f.jami - f.arxiv} faol={f.id === fan?.id} onBos={() => onFan(f.id)}
                  onSaqla={savolTahrir ? nom => fanNomi(f, nom) : undefined} onOchir={savolTahrir ? () => fanOchir(f) : undefined} />
              ))}
              {kutayotganlar('fan')}
            </Ustun>


            {!fan ? (
              <div className="w-[420px] h-[236px] rounded-xl border border-dashed border-chiziq flex items-center justify-center p-6 text-center text-[12.5px] text-matn-sokin">
                Avval chapdagi ustunda fan qo'shing — keyin shu yerda uning bo'limlari, mavzulari va filtrlari chiqadi.
              </div>
            ) : !filtr ? (
              <div className="w-[420px] h-[236px] flex items-center justify-center"><Yuklanmoqda /></div>
            ) : (
              <>
                <ChevronRight size={16} className="self-center shrink-0 -mx-1.5 text-matn-xira" aria-hidden />
                <Ustun nom="Bo'lim" izoh={`${fan.name} fani`} tanlangan={t.bolimlar.length} past={savolTahrir && <QoshQator joy="Bo'lim qo'shish" onQosh={bolimQosh} />}>
                  {!filtr.bolimlar.length && <UstunBosh>Bo'lim yo'q. Masalan: Algebra, Geometriya. Shart emas — mavzularni bo'limsiz ham qo'shsa bo'ladi.</UstunBosh>}
                  {filtr.bolimlar.map(b => (
                    <Qator key={b.nom || '_'} nom={b.nom || "Bo'limsiz"} korinish={b.nom ? undefined : <i className="text-matn-sokin">Bo'limsiz</i>} soni={b.soni}
                      faol={t.bolimlar.includes(b.nom)} onBos={() => setT(x => ({ ...x, bolimlar: almashtirRoyxat(x.bolimlar, b.nom), mavzular: [] }))}
                      onSaqla={b.nom && savolTahrir ? nom => bolimNomi(b.nom, nom) : undefined} onOchir={b.nom && savolTahrir ? () => bolimOchir(b) : undefined}
                      qabul="mavzu" onTashla={s => { if (s.tur === 'mavzu') mavzuBolimga(s.id, b.nom); }} chaqnash={chaqnash === `b${b.nom}`} sudrashda={sudrash} />
                  ))}
                </Ustun>

                <ChevronRight size={16} className="self-center shrink-0 -mx-1.5 text-matn-xira" aria-hidden />
                <Ustun nom="Mavzu" kenglik="w-[244px]" tanlangan={t.mavzular.length} izoh={maqsadBolim ? `${maqsadBolim} bo'limi` : `${fan.name} fani — hamma bo'lim`}
                  past={savolTahrir && <QoshQator joy={maqsadBolim ? `Mavzu qo'shish — ${maqsadBolim}` : "Mavzu qo'shish"} onQosh={mavzuQosh} />}>
                  {filtr.mavzular.length > 10 && (
                    <li className="sticky top-0 z-10 bg-sirt pb-1">
                      <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-matn-xira" />
                        <input className="w-full pl-6 pr-2 py-1 bg-ichki border border-chiziq rounded-md text-[12px] text-matn placeholder:text-matn-xira" style={{ outline: 'none' }}
                          placeholder="Mavzu qidirish" aria-label="Mavzu qidirish" value={mavzuQidiruv} onChange={e => setMavzuQidiruv(e.target.value)} />
                      </div>
                    </li>
                  )}
                  {!filtr.mavzular.length && !kutilmoqda.some(k => k.ustun === 'mavzu') && <UstunBosh>Mavzu yo'q. Pastdagi «+» bilan qo'shing — savollar mavzuga biriktiriladi.</UstunBosh>}
                  {filtr.mavzular.length > 0 && !mavzular.length && !kutilmoqda.some(k => k.ustun === 'mavzu') && <UstunBosh>{mavzuQidiruv ? 'Topilmadi' : "Bu bo'limda mavzu yo'q — pastdan qo'shing."}</UstunBosh>}
                  {sarlavhali ? mavzuGuruhlari.map(([b, l]) => <React.Fragment key={b || '_'}><UstunGuruh>{b || "Bo'limsiz"}</UstunGuruh>{l.map(mavzuQatori)}</React.Fragment>) : mavzular.map(mavzuQatori)}
                  {kutayotganlar('mavzu')}
                </Ustun>

              </>
            )}
            </UstunlarGuruhi>

            {fan && filtr && (
              <>
                <UstunlarGuruhi nom="Qiyinlik" izoh="darajalarni o'zingiz belgilaysiz">
                {/* Qiyinlik: darajalar ro'yxati to'liq foydalanuvchiniki — nomini o'zgartiradi, olib tashlaydi, qo'shadi */}
                <Ustun nom="Qiyinlik" izoh="hamma fanlarda" kenglik="w-[204px]" tanlangan={t.qiyinlik.length + t.darajalar.length}
                  past={savolTahrir && <QoshQator joy="Daraja qo'shish" onQosh={darajaQosh}
                    qosh={{ nom: 'Rangi', boshi: String(QIYINLIK.find(q => q.yashirin)?.d || 1), variantlar: QIYINLIK.map((q, i) => ({ v: String(q.d), nom: q.yashirin ? `${RANG_NOMLARI[i]} — bo'sh o'rin` : `${q.nom} ichida`, nuqta: q.nuqta })) }} />}>
                  {QIYINLIK.map((q, i) => {
                    const ozlari = darajalar.filter(d => d.asos === q.d);
                    const sof = Math.max(0, (holat?.qiyinlik[i] || 0) - ozlari.reduce((a, d) => a + (holat?.belgilar[d.id] || 0), 0));
                    const korinadi = !q.yashirin || filtr.qiyinlik[i] > 0;
                    return (
                      <React.Fragment key={q.d}>
                        {korinadi && (
                          <Qator nom={q.nom} nuqta={q.nuqta} soni={filtr.qiyinlik[i]} faol={t.qiyinlik.includes(q.d)} onBos={() => setT(x => ({ ...x, qiyinlik: almashtirRoyxat(x.qiyinlik, q.d) }))}
                            onSaqla={savolTahrir ? nom => asosiyNomi(q.d, nom) : undefined} onOchir={savolTahrir ? () => asosiyOchir(q.d) : undefined}
                            biriktir={birik('kochir', sof, () => biriktir(ids, { difficulty: q.d }, `${N} ta savol — «${q.nom}»`, `q${q.d}`))}
                            qabul="savol" onTashla={s => tashlandi(s, { difficulty: q.d }, q.nom, `q${q.d}`, 'darajasiga qo\'yildi')} chaqnash={chaqnash === `q${q.d}`} sudrashda={sudrash} />
                        )}
                        {ozlari.map(d => (
                          <Qator key={d.id} nom={d.name} korinish={<span className={korinadi ? 'pl-3' : ''}>{d.name}</span>} nuqta={q.nuqta} soni={d.soni} faol={t.darajalar.includes(d.id)}
                            onBos={() => setT(x => ({ ...x, darajalar: almashtirRoyxat(x.darajalar, d.id) }))}
                            onSaqla={savolTahrir ? (nom, asos) => belgiSaqla(d.id, { name: nom, asos: Number(asos) || d.asos }) : undefined}
                            onOchir={savolTahrir ? () => belgiOchir(d, 'Qiyinlik', d.soni) : undefined}
                            tahrirQosh={{ nom: 'Rangi', qiymat: String(d.asos), korinish: 'nuqtalar', variantlar: QIYINLIK.map((z, k) => ({ v: String(z.d), nom: z.yashirin ? RANG_NOMLARI[k] : `${z.nom} ichida`, nuqta: z.nuqta })) }}
                            biriktir={birik('kochir', holat?.belgilar[d.id] || 0, () => biriktir(ids, { darajaId: d.id }, `${N} ta savol — «${d.name}»`, `t${d.id}`))}
                            qabul="savol" onTashla={s => tashlandi(s, { darajaId: d.id }, d.name, `t${d.id}`, 'darajasiga qo\'yildi')} chaqnash={chaqnash === `t${d.id}`} sudrashda={sudrash} />
                        ))}
                      </React.Fragment>
                    );
                  })}
                  {kutayotganlar('daraja')}
                </Ustun>
                </UstunlarGuruhi>

                {/* Foydalanuvchi filtrlari — tuzilmadan alohida (masalan «Manba», «Test turi») */}
                <UstunlarGuruhi nom="O'z filtrlaringiz" izoh="siz ochgan ustunlar — xohlagancha">
                {filtr.guruhlar.map(g => (
                  <Ustun key={g.id} boshNom={g.name} tanlangan={(t.belgilar[g.id] || []).length} izoh={g.subjectId ? `faqat ${fan.name}` : 'hamma fanlarda'}
                    nom={filtrNomi?.id === g.id ? (
                      <form onSubmit={e => { e.preventDefault(); if (filtrNomi.nom.trim()) filtrSaqla(g, { name: filtrNomi.nom.trim() }); }}>
                        <input autoFocus className="w-full px-1.5 py-0.5 rounded border border-brand bg-sirt text-[12px] font-bold text-matn" style={{ outline: 'none' }} aria-label="Filtr nomi" value={filtrNomi.nom}
                          onChange={e => setFiltrNomi({ id: g.id, nom: e.target.value })} onKeyDown={e => { if (e.key === 'Escape') setFiltrNomi(null); }} onBlur={() => setFiltrNomi(null)} />
                      </form>
                    ) : g.name}
                    amallar={savolTahrir && filtrNomi?.id !== g.id && (
                      <>
                        <SarlavhaTugma ikonka={<Pencil size={12} />} nom={`${g.name} — nomini o'zgartirish`} onClick={() => setFiltrNomi({ id: g.id, nom: g.name })} />
                        <SarlavhaTugma ikonka={<Globe size={12} />} faol={!g.subjectId} nom={g.subjectId ? `${g.name} — hamma fanlarda ko'rinsin` : `${g.name} — faqat «${fan.name}» fanida qolsin`}
                          onClick={() => filtrSaqla(g, { subjectId: g.subjectId ? null : fan.id })} />
                        <SarlavhaTugma ikonka={<Trash2 size={12} />} xavfli nom={`${g.name} — filtrni o'chirish`} onClick={() => filtrOchir(g)} />
                      </>
                    )}
                    past={savolTahrir && <QoshQator joy="Qiymat qo'shish" onQosh={nom => qiymatQosh(g, nom)} ochiqBoshlansin={yangiFiltr === g.id} />}>
                    {!g.tags.length && !kutilmoqda.some(k => k.ustun === `g${g.id}`) && <UstunBosh>Qiymat yo'q — pastdan yozing. Masalan: «DTM 2025», «Milliy sertifikat».</UstunBosh>}
                    {g.tags.map(x => {
                      const k = holat?.belgilar[x.id] || 0;
                      const hammasi = !!holat && N > 0 && k >= N;
                      return (
                        <Qator key={x.id} nom={x.name} soni={filtr.belgilar[x.id] || 0} faol={(t.belgilar[g.id] || []).includes(x.id)}
                          onBos={() => setT(y => ({ ...y, belgilar: { ...y.belgilar, [g.id]: almashtirRoyxat(y.belgilar[g.id] || [], x.id) } }))}
                          onSaqla={savolTahrir ? nom => belgiSaqla(x.id, { name: nom }) : undefined} onOchir={savolTahrir ? () => belgiOchir(x, g.name, filtr.belgilar[x.id] || 0) : undefined}
                          biriktir={birik('belgi', k, () => (hammasi
                            ? biriktir(ids, { tagOl: [x.id] }, `${N} ta savoldan «${x.name}» ajratildi`, `t${x.id}`)
                            : biriktir(ids, { tagQosh: [x.id] }, `${N} ta savolga «${x.name}» biriktirildi`, `t${x.id}`)))}
                          qabul="savol" onTashla={s => tashlandi(s, { tagQosh: [x.id] }, x.name, `t${x.id}`, 'ga biriktirildi')} chaqnash={chaqnash === `t${x.id}`} sudrashda={sudrash} />
                      );
                    })}
                    {kutayotganlar(`g${g.id}`)}
                  </Ustun>
                ))}
                {kutilmoqda.filter(k => k.ustun === 'filtr').map((k, i) => (
                  <Ustun key={`kf${i}`} nom={k.nom} izoh="saqlanmoqda…"><KutishQatori nom="Ustun tayyorlanmoqda" /></Ustun>
                ))}

                {savolTahrir && <YangiFiltr fan={fan.name} onQosh={filtrQosh} />}
                </UstunlarGuruhi>
              </>
            )}
          </div>
        )}
      </section>

      {fan && (
        <>
          {/* ---------------- Qidiruv va ko'rinish ---------------- */}
          <div className="bg-sirt border border-chiziq rounded-2xl p-2.5 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
              <input className="w-full pl-9 pr-8 py-2 bg-ichki border border-chiziq rounded-xl text-[13px] text-matn outline-none focus:border-brand placeholder:text-matn-xira"
                placeholder="Savol matnidan qidirish" aria-label="Savol matnidan qidirish" value={t.qidiruv} onChange={e => setT(x => ({ ...x, qidiruv: e.target.value }))} />
              {t.qidiruv && <button aria-label="Qidiruvni tozalash" onClick={() => setT(x => ({ ...x, qidiruv: '' }))} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-matn-xira hover:text-matn cursor-pointer"><X size={14} /></button>}
            </div>
            <button type="button" onClick={() => setBoshqa(o => !o)} aria-expanded={boshqa} className={`${TABLETKA(boshqa || boshqaSoni > 0)} py-2`}>
              <SlidersHorizontal size={14} /> Boshqa filtrlar{boshqaSoni > 0 && <span className="raqam">({boshqaSoni})</span>}
            </button>
            <select className="px-2.5 py-2 bg-ichki border border-chiziq rounded-xl text-[12.5px] text-matn outline-none cursor-pointer" value={tartib} onChange={e => setTartib(e.target.value as 'asc' | 'desc')} aria-label="Tartib">
              <option value="asc">QID bo'yicha</option>
              <option value="desc">Yangilari avval</option>
            </select>
            <Tanlov kichik qiymat={korinish} onChange={setKorinish} variantlar={[
              { v: 'karta', nom: <span className="inline-flex items-center gap-1.5" title="Savol, variantlar va javob"><LayoutList size={14} /> To'liq</span> },
              { v: 'ixcham', nom: <span className="inline-flex items-center gap-1.5" title="Bir qatordan"><Rows3 size={14} /> Ixcham</span> },
            ]} />
          </div>

          {/* Kam ishlatiladigan filtrlar: turi, holati, manba, fayl, izoh, matn, joylashuv, QID. */}
          {boshqa && filtr && (
            <section aria-label="Boshqa filtrlar" className="bg-sirt border border-chiziq rounded-2xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 [&>section]:border-b [&>section]:border-chiziq">
              <Bolim nom="Savol turi" tanlangan={t.tur ? 1 : 0}>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(TUR_NOMI) as SavolTuri[]).filter(k => filtr.turlar[k] || t.tur === k).map(k => (
                    <button key={k} type="button" aria-pressed={t.tur === k} onClick={() => setT(x => ({ ...x, tur: x.tur === k ? '' : k }))} className={TABLETKA(t.tur === k)}>
                      {TUR_NOMI[k]}<span className="raqam text-[11px] opacity-70">{filtr.turlar[k]}</span>
                    </button>
                  ))}
                </div>
              </Bolim>
              <Bolim nom="Holati" tanlangan={t.holat ? 1 : 0}>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(HOLAT_NOMI) as Exclude<Holat, ''>[]).map(k => (
                    <button key={k} type="button" aria-pressed={t.holat === k} onClick={() => setT(x => ({ ...x, holat: x.holat === k ? '' : k }))} className={TABLETKA(t.holat === k)}>
                      {HOLAT_NOMI[k]}<span className="raqam text-[11px] opacity-70">{filtr.holat[k]}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-matn-xira">Tanlanmasa — faol va qoralama (arxiv yashirin)</p>
              </Bolim>
              {filtr.manbalar.length > 0 && (
                <Bolim nom="Manba" tanlangan={t.manbalar.length}>
                  <Belgilar qiymatlar={filtr.manbalar.map(m => ({ k: m.nom, nom: m.nom || <i className="text-matn-xira">Manbasiz</i>, soni: m.soni }))}
                    tanlangan={t.manbalar} onChange={v => setT(x => ({ ...x, manbalar: v }))} />
                </Bolim>
              )}
              {filtr.toplamlar.length > 0 && (
                <Bolim nom="To'plam (fayl)" tanlangan={t.toplam !== null ? 1 : 0}>
                  <Belgilar qiymatlar={filtr.toplamlar.map(x => ({ k: x.nom, nom: x.nom || <i className="text-matn-xira">To'plamsiz</i>, soni: x.soni }))}
                    tanlangan={t.toplam !== null ? [t.toplam] : []} onChange={v => setT(x => ({ ...x, toplam: v.length ? v[v.length - 1] : null }))} />
                </Bolim>
              )}
              {filtr.izohlar.some(x => x.nom) && (
                <Bolim nom="Izoh (remark)" tanlangan={t.izohlar.length}>
                  <Belgilar qiymatlar={filtr.izohlar.map(x => ({ k: x.nom, nom: x.nom || <i className="text-matn-xira">Izohsiz</i>, soni: x.soni }))}
                    tanlangan={t.izohlar} onChange={v => setT(x => ({ ...x, izohlar: v }))} />
                </Bolim>
              )}
              {filtr.matnli.bor > 0 && (
                <Bolim nom="Matnli savollar (passage)" tanlangan={t.matnli ? 1 : 0}>
                  <div className="flex flex-wrap gap-1.5">
                    {(['bor', 'yoq'] as const).map(k => (
                      <button key={k} type="button" aria-pressed={t.matnli === k} onClick={() => setT(x => ({ ...x, matnli: x.matnli === k ? '' : k }))} className={TABLETKA(t.matnli === k)}>
                        {k === 'bor' ? 'Matnga bog\'langan' : 'Matnsiz'}<span className="raqam text-[11px] opacity-70">{filtr.matnli[k]}</span>
                      </button>
                    ))}
                  </div>
                </Bolim>
              )}
              {(filtr.joylashuv['1'] + filtr.joylashuv['2'] + filtr.joylashuv['4']) > 0 && (
                <Bolim nom="Variantlar joylashuvi" tanlangan={t.joylashuv.length}>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1, 2, 4].filter(j => filtr.joylashuv[String(j) as '0'] || t.joylashuv.includes(j)).map(j => (
                      <button key={j} type="button" aria-pressed={t.joylashuv.includes(j)} onClick={() => setT(x => ({ ...x, joylashuv: almashtirRoyxat(x.joylashuv, j) }))} className={TABLETKA(t.joylashuv.includes(j))}>
                        {JOYLASHUV_NOMI[j]}<span className="raqam text-[11px] opacity-70">{filtr.joylashuv[String(j) as '0']}</span>
                      </button>
                    ))}
                  </div>
                </Bolim>
              )}
              <Bolim nom="QID oralig'i" tanlangan={t.qidDan || t.qidGacha ? 1 : 0}>
                <div className="flex items-center gap-2">
                  <input className="w-full min-w-0 px-2.5 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12.5px] raqam outline-none focus:border-brand" inputMode="numeric" placeholder="dan" aria-label="QID dan"
                    value={t.qidDan} onChange={e => setT(x => ({ ...x, qidDan: e.target.value.replace(/\D/g, '') }))} />
                  <span className="text-matn-xira">–</span>
                  <input className="w-full min-w-0 px-2.5 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12.5px] raqam outline-none focus:border-brand" inputMode="numeric" placeholder="gacha" aria-label="QID gacha"
                    value={t.qidGacha} onChange={e => setT(x => ({ ...x, qidGacha: e.target.value.replace(/\D/g, '') }))} />
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
            {yorliqlar.length > 1 && <button onClick={tozala} className="text-[12px] font-semibold text-matn-xira hover:text-brand cursor-pointer ml-1">hammasini tozalash</button>}
          </div>

          <section className="bg-sirt border border-chiziq rounded-2xl overflow-hidden" aria-label="Savollar">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 border-b border-chiziq bg-ichki/50">
              <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-matn-sokin cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[var(--color-brand)] cursor-pointer" checked={sahifaTanlangan} onChange={sahifaniTanla} disabled={!sahifadagi.length} />
                Sahifadagi hammasi
              </label>
              {!!royxat?.total && royxat.total > sahifadagi.length && (
                <button onClick={hammasiniTanla} disabled={band === 'tanla'} className="text-[12px] font-semibold text-brand hover:underline cursor-pointer disabled:opacity-50">
                  {band === 'tanla' ? <Loader2 size={12} className="inline animate-spin" /> : null} Filtrdagi {royxat.total} tasini tanlash
                </button>
              )}
              <span className="ml-auto">{sahifalash}</span>
            </div>

            {!royxat ? <Yuklanmoqda /> : !royxat.items.length ? (
              <BoshHolat ikonka={<Search size={20} />} sarlavha={yorliqlar.length || t.qidiruv ? "Filtrga mos savol yo'q" : "Bu fanda hali savol yo'q"}
                izoh={yorliqlar.length || t.qidiruv ? "Filtrni yumshating yoki qidiruvni o'zgartiring" : "Savol qo'shish — Word (Addmen QR jadvali), Excel, PDF, rasm yoki matndan"}>
                {(yorliqlar.length > 0 || !!t.qidiruv) && <Tugma kichik ikonka={<Eraser size={13} />} onClick={() => setT(BOSH)}>Filtrni tozalash</Tugma>}
                {!yorliqlar.length && !t.qidiruv && onQosh && <Tugma kichik turi="asosiy" ikonka={<Plus size={13} />} onClick={onQosh}>Savol qo'shish</Tugma>}
              </BoshHolat>
            ) : (
              <ul className={`divide-y divide-chiziq transition-opacity ${yuklanmoqda ? 'opacity-60' : ''}`}>
                {royxat.items.map(q => {
                  const d = (q.tagIds || []).map(id => darajaMap.get(id)).find(x => x && x.asos === Math.min(3, Math.max(1, q.difficulty)));
                  return (
                    <SavolKartochka key={q.id} q={q} ixcham={korinish === 'ixcham'} tanlangan={tanlangan.has(q.id)} onTanla={almashtir} onKor={korish}
                      mavzu={(q.bankTopicId != null && mavzuNomi.get(q.bankTopicId)) || q.topic || ''} daraja={d?.name}
                      belgilar={(q.tagIds || []).filter(id => belgiNomi.has(id)).map(id => ({ id, nom: belgiNomi.get(id)! }))}
                      onSudra={savolTahrir ? sudra : undefined} onBelgiOl={savolTahrir ? belgiOl : undefined} />
                  );
                })}
              </ul>
            )}
            {sahifalash && <div className="flex justify-end px-4 py-2 border-t border-chiziq">{sahifalash}</div>}
          </section>

          {/* Belgilanganlar bilan amallar — faqat tanlanganda chiqadi. */}
          {tanlangan.size > 0 && (
            <div className="sticky bottom-3 z-20 flex justify-center pointer-events-none">
              <div role="toolbar" aria-label="Tanlanganlar bilan amallar"
                className="pointer-events-auto flex flex-wrap items-center gap-0.5 rounded-2xl bg-matn text-sirt shadow-2xl px-2 py-1.5 max-w-full">
                <span className="px-2.5 text-[12.5px] font-bold whitespace-nowrap"><span className="raqam">{tanlangan.size}</span> ta tanlandi</span>
                <span className="w-px h-5 bg-sirt/20 mx-1" />
                {tanlangan.size === 1 && <AmalTugma ikonka={<Eye size={14} />} band={band === 'korish'} onClick={() => korish(ids[0])}>Ko'rish</AmalTugma>}
                {/* Telefonda ustunlar yopishmaydi — shu tugma ularga olib chiqadi. */}
                {savolTahrir && <AmalTugma ikonka={<Columns3 size={14} />} className={yigiq ? '' : 'lg:hidden'} onClick={() => { setYigiq(false); ustunlarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} title="Ustunlarda mavzu yoki filtrga biriktirish">Biriktirish</AmalTugma>}
                {savolTahrir && <AmalTugma ikonka={<Tags size={14} />} onClick={() => setBelgilash(true)} title="Manba, izoh, holat va boshqa maydonlarni hammasiga birdan berish">O'zgartirish</AmalTugma>}
                {savolTahrir && <AmalTugma ikonka={<RotateCcw size={14} />} band={band === 'nol'} onClick={ishlatilishNol} title="Imtihonlarda necha marta ishlatilgani nolga tushadi — yana birinchi navbatda tanlanadi">Ishlatilishini nolga</AmalTugma>}
                {ochiradi && <AmalTugma ikonka={<Trash2 size={14} />} band={band === 'ochir'} onClick={ochir} xavfli>O'chirish</AmalTugma>}
                <button aria-label="Tanlovni bekor qilish" title="Tanlovni bekor qilish" onClick={() => setTanlangan(new Set())} className="ml-1 p-1.5 rounded-lg hover:bg-sirt/15 cursor-pointer"><X size={15} /></button>
              </div>
            </div>
          )}
        </>
      )}

      {belgilash && filtr && <BelgilashOynasi ids={ids} filtr={filtr} boshi={belgilashBoshi()} onYop={() => setBelgilash(false)} onSaqlandi={ozgardi} />}
      {ochiq && <SavolOynasi q={ochiq} daraxt={daraxt} onYop={() => setOchiq(null)} onOzgardi={ozgardi} />}
      {!fan && !savolTahrir && (
        <div className="bg-sirt border border-chiziq rounded-2xl">
          <BoshHolat sarlavha="Bankda hali fan yo'q" izoh="Savollar bankini to'ldirish huquqi bor xodim fan va savollarni qo'shadi.">
            <Tugma onClick={onTuzilma}>Statistika</Tugma>
          </BoshHolat>
        </div>
      )}
    </div>
  );
}

/** Oxirgi ustun: yangi filtr (shu fanga tegishli bo'lib ochiladi). */
function YangiFiltr({ fan, onQosh }: { fan: string; onQosh: (nom: string) => Promise<boolean> }) {
  const [nom, setNom] = useState('');
  const [band, setBand] = useState(false);
  const yubor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || band) return;
    setBand(true);
    const ok = await onQosh(nom.trim());
    setBand(false);
    if (ok) setNom('');
  };
  return (
    <section aria-label="Yangi filtr" className="shrink-0 snap-start w-[212px] h-[236px] rounded-xl border border-dashed border-chiziq-kuchli flex flex-col items-center justify-center gap-2 p-3 text-center">
      <span className="w-10 h-10 rounded-xl bg-brand-fon text-brand flex items-center justify-center dark:bg-brand/15"><Tags size={18} /></span>
      <p className="text-[12.5px] font-bold text-matn">O'z filtringiz</p>
      <p className="text-[11.5px] text-matn-xira leading-snug">«{fan}» uchun yangi ustun. Masalan: Manba, Test turi, Sinf.</p>
      <form onSubmit={yubor} className="w-full flex items-center gap-1">
        <input className="w-full min-w-0 px-2 py-1.5 rounded-lg border border-chiziq bg-ichki text-[12.5px] text-matn placeholder:text-matn-xira focus:border-brand" style={{ outline: 'none' }}
          placeholder="Filtr nomi" aria-label="Yangi filtr nomi" value={nom} onChange={e => setNom(e.target.value)} disabled={band} />
        <button type="submit" aria-label="Filtr qo'shish" disabled={band || !nom.trim()} className="shrink-0 p-2 rounded-lg bg-brand text-brand-ust cursor-pointer disabled:opacity-40 disabled:cursor-default"><Plus size={14} strokeWidth={3} /></button>
      </form>
    </section>
  );
}

function AmalTugma({ ikonka, band, xavfli, children, className = '', ...qolgan }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ikonka: React.ReactNode; band?: boolean; xavfli?: boolean }) {
  return (
    <button type="button" {...qolgan} disabled={band || qolgan.disabled}
      className={`${className} inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap cursor-pointer hover:bg-sirt/15 disabled:opacity-60 ${xavfli ? 'text-red-300 dark:text-xato' : ''}`}>
      {band ? <Loader2 size={14} className="animate-spin" /> : ikonka}{children}
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
  qiymatlar: { k: K; nom: React.ReactNode; soni?: number; izoh?: string }[]; tanlangan: K[]; onChange: (v: K[]) => void;
}) {
  return (
    <ul className="max-h-44 overflow-y-auto -mx-1.5">
      {qiymatlar.map(q => {
        const b = tanlangan.includes(q.k);
        return (
          <li key={String(q.k)}>
            <label className={`flex items-center gap-2 px-1.5 py-1 rounded-lg text-[12.5px] cursor-pointer select-none ${b ? 'bg-brand-fon/70 dark:bg-brand/10' : 'hover:bg-ichki'}`} title={q.izoh}>
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

/** Savol kartochkasi: matn formulalar bilan, variantlar va to'g'ri javob ochmasdan ko'rinadi. Sudrab ustun qatoriga tashlanadi. */
const SavolKartochka = memo(function SavolKartochka({ q, ixcham, tanlangan, mavzu, daraja, belgilar, onTanla, onKor, onSudra, onBelgiOl }: {
  q: Qator_; ixcham: boolean; tanlangan: boolean; mavzu: string; daraja?: string; belgilar: { id: number; nom: string }[];
  onTanla: (id: number) => void; onKor: (id: number) => void; onSudra?: (id: number, e: React.DragEvent) => void; onBelgiOl?: (qid: number, tagId: number, nom: string) => void;
}) {
  const html = useMemo(() => formulaliHtml(q.text || ''), [q.text]);
  const variantlar = useMemo(() => (ixcham ? [] : (q.options || []).map(o => formulaliHtml(o))), [q.options, ixcham]);
  const qisqa = useMemo(() => (q.options || []).every(o => oddiyMatn(o).length <= 22 && !/<img/i.test(o)), [q.options]);
  const togri = HARFLAR.indexOf(String(q.correctAnswer || '').toUpperCase());
  const raqamliJavob = q.type === 'raqamli' ? [...new Set([q.correctAnswer, ...(q.answers || [])].filter(Boolean))].join(' · ') : '';
  const javobQisqa = q.type === 'yopiq' ? (togri >= 0 ? HARFLAR[togri] : '') : q.type === 'moslash' ? String(q.correctAnswer || '') : raqamliJavob;
  const qd = QIYINLIK[Math.min(3, Math.max(1, q.difficulty)) - 1];

  return (
    <li draggable={!!onSudra} onDragStart={onSudra ? e => onSudra(q.id, e) : undefined}
      className={`flex gap-3 px-4 ${ixcham ? 'py-2' : 'py-3.5'} cursor-pointer transition-colors ${tanlangan ? 'bg-brand-fon/60 dark:bg-brand/10' : 'hover:bg-ichki/60'} ${q.status === 'arxiv' ? 'opacity-60' : ''}`}
      onClick={() => onTanla(q.id)} onDoubleClick={() => onKor(q.id)}>
      <input type="checkbox" aria-label={`#${q.id} savolni tanlash`} className={`${ixcham ? 'mt-0.5' : 'mt-1'} w-4 h-4 shrink-0 accent-[var(--color-brand)] cursor-pointer`}
        checked={tanlangan} onChange={() => onTanla(q.id)} onClick={e => e.stopPropagation()} />
      <div className="min-w-0 flex-1">
        {ixcham ? (
          <div className="flex items-center gap-2 min-w-0 text-[12.5px]">
            <span className="raqam text-[11.5px] font-bold text-matn-xira w-12 shrink-0">#{q.id}</span>
            <span className={`w-2 h-2 rounded-full shrink-0 ${qd.nuqta}`} title={daraja || qd.nom} />
            {q.status === 'qoralama' && <Yorliq rang="ogoh">Qoralama</Yorliq>}
            <span className={`${SAVOL_MATNI} flex-1 min-w-0 truncate text-matn [&_p]:inline [&_p]:my-0 [&_br]:hidden [&_img]:hidden`} dangerouslySetInnerHTML={{ __html: html }} />
            <span className="hidden md:block shrink-0 max-w-40 truncate text-[11.5px] text-matn-xira">{mavzu}</span>
            {javobQisqa && <span className="shrink-0 raqam text-[11.5px] font-bold text-yaxshi max-w-24 truncate" title="To'g'ri javob">✓ {javobQisqa}</span>}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5 text-[11.5px]">
              <span className="raqam font-bold text-matn-xira">#{q.id}</span>
              {mavzu && <span className="font-semibold text-matn-sokin truncate max-w-64">{mavzu}</span>}
              <QiyinlikYorligi d={q.difficulty} nom={daraja} />
              {q.type !== 'yopiq' && <Yorliq rang="brand">{TUR_NOMI[q.type]}</Yorliq>}
              {q.status === 'qoralama' && <Yorliq rang="ogoh">Qoralama</Yorliq>}
              {q.status === 'arxiv' && <Yorliq>Arxiv</Yorliq>}
              {q.passageId && <Yorliq>matnli</Yorliq>}
              {belgilar.map(b => (
                <span key={b.id} className="inline-flex items-center rounded-md border border-chiziq bg-ichki text-matn-sokin text-[11px] font-semibold whitespace-nowrap">
                  <span className="pl-1.5 pr-1 py-0.5">{b.nom}</span>
                  {onBelgiOl && <button type="button" aria-label={`#${q.id}: «${b.nom}» ni ajratish`} title="Ajratish" onClick={e => { e.stopPropagation(); onBelgiOl(q.id, b.id, b.nom); }}
                    className="pr-1 py-0.5 text-matn-xira hover:text-xato cursor-pointer"><X size={11} /></button>}
                </span>
              ))}
              <span className="ml-auto flex items-center gap-2.5 text-matn-xira">
                {!!q.usedCount && <span>{q.usedCount} marta ishlatilgan</span>}
                <span className="raqam">{sana(q.createdAt)}</span>
              </span>
            </div>
            <div className={`${SAVOL_MATNI} text-[13.5px] text-matn [&_p]:my-0.5`} dangerouslySetInnerHTML={{ __html: html || '<p>—</p>' }} />
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
            {(q.source || q.toplam || q.remark || q.joylashuv) && <p className="mt-1.5 text-[11px] text-matn-xira">{[q.source, q.toplam && `fayl: ${q.toplam}`, q.remark && `izoh: ${q.remark}`, q.joylashuv && `variantlar ${q.joylashuv} ustunda`].filter(Boolean).join(' · ')}</p>}
          </>
        )}
      </div>
      <button type="button" aria-label={`#${q.id} savolni ochish`} title="Ochish va tahrirlash" onClick={e => { e.stopPropagation(); onKor(q.id); }}
        className="self-start shrink-0 p-1.5 -mr-1.5 rounded-lg text-matn-xira hover:text-brand hover:bg-sirt cursor-pointer"><Eye size={15} /></button>
    </li>
  );
});
