import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Eye, Tags, Trash2, RotateCcw, Eraser, ChevronLeft, ChevronRight, ChevronDown, Loader2, Search, X, Check, SlidersHorizontal, Settings2, LayoutList, Rows3 } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, Yorliq, Tanlov, Yuklanmoqda, BoshHolat } from '../ui';
import { formulaliHtml, oddiyMatn, SAVOL_MATNI } from '../../../lib/matn';
import { HARFLAR } from '../../../../lib/imtihon.js';
import { FiltrSozlash, BelgilashOynasi, type BelgilashBoshi } from './BankOynalari';
import { SavolOynasi } from './SavolKartasi';
import MoslashJadvali from './MoslashJadvali';
import { QIYINLIK, QiyinlikYorligi } from './qiyinlik';
import type { BankDaraxt, BankFiltrMalumoti, BelgiGuruhi, Question, SavolTuri } from '../../../types';

// Savollar banki. Chapda filtr paneli (Addmen filtr ustunlari: mavzu bo'limlari
// bilan, qiyinlik, tur, manba, foydalanuvchi filtrlari, to'plam, holat, QID
// oralig'i), o'ngda savollar kartochka bo'lib — matn, variantlar va to'g'ri
// javob ochmasdan ko'rinadi. Belgilansa pastda amallar paneli chiqadi.

type Korinish = 'karta' | 'ixcham';
const SAHIFA: Record<Korinish, number> = { karta: 40, ixcham: 100 };
type Holat = '' | 'faol' | 'qoralama' | 'arxiv';
interface FiltrTanlovi {
  mavzular: number[]; qiyinlik: number[]; manbalar: string[]; belgilar: Record<number, number[]>;
  toplam: string | null; holat: Holat; tur: '' | SavolTuri; qidiruv: string; qidDan: string; qidGacha: string;
  /** Addmen REMARK, PASSAGE, DISPLAY CHOICES. */
  izohlar: string[]; matnli: '' | 'bor' | 'yoq'; joylashuv: number[];
}
const BOSH: FiltrTanlovi = { mavzular: [], qiyinlik: [], manbalar: [], belgilar: {}, toplam: null, holat: '', tur: '', qidiruv: '', qidDan: '', qidGacha: '', izohlar: [], matnli: '', joylashuv: [] };
const JOYLASHUV_NOMI: Record<number, string> = { 0: 'Avtomatik', 1: '1 ustun', 2: '2 ustun', 4: '4 ustun' };
const TUR_NOMI: Record<SavolTuri, string> = { yopiq: 'Variantli', raqamli: 'Raqamli javob', moslash: 'Moslashtirish', yozma: 'Yozma' };
const HOLAT_NOMI: Record<Exclude<Holat, ''>, string> = { faol: 'Faol', qoralama: 'Qoralama', arxiv: 'Arxiv' };
const sana = (s?: string) => (s ? new Date(s).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '.') : '');
const almashtirRoyxat = <K,>(l: K[], k: K) => (l.includes(k) ? l.filter(x => x !== k) : [...l, k]);
const TABLETKA = (faol: boolean) => `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer transition-colors ${faol ? 'bg-brand text-brand-ust border-brand' : 'bg-sirt border-chiziq text-matn-sokin hover:text-matn hover:border-chiziq-kuchli'}`;

type Qator = Pick<Question, 'id' | 'text' | 'type' | 'difficulty' | 'status' | 'toplam' | 'source' | 'tagIds' | 'topic' | 'bankTopicId' | 'usedCount' | 'createdAt' | 'imageUrl' | 'options' | 'correctAnswer' | 'answers' | 'points' | 'remark' | 'passageId' | 'joylashuv'>;

export default function BankJadvali({ daraxt, fanId, onFan, yangilaDaraxt, onQosh, onTuzilma, savolTahrir }: {
  daraxt: BankDaraxt; fanId: number | null; onFan: (id: number) => void; yangilaDaraxt: () => void;
  onQosh?: () => void; onTuzilma: () => void; savolTahrir: boolean;
}) {
  const { ozgartira, showNotification } = useCRM();
  const ochiradi = ozgartira('imtihonlar.ochirish');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const fan = daraxt.fanlar.find(f => f.id === fanId) || daraxt.fanlar[0] || null;

  const [filtr, setFiltr] = useState<BankFiltrMalumoti | null>(null);
  const [t, setT] = useState<FiltrTanlovi>(BOSH);
  const [tartib, setTartib] = useState<'asc' | 'desc'>('asc');
  const [korinish, setKorinishHolat] = useState<Korinish>(() => { try { return localStorage.getItem('bank_korinish') === 'ixcham' ? 'ixcham' : 'karta'; } catch { return 'karta'; } });
  const setKorinish = (k: Korinish) => { setKorinishHolat(k); try { localStorage.setItem('bank_korinish', k); } catch { /* eslab qolinmaydi */ } };
  const [sahifa, setSahifa] = useState(1);
  const [royxat, setRoyxat] = useState<{ items: Qator[]; total: number } | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [tanlangan, setTanlangan] = useState<Set<number>>(new Set());
  const [qayta, setQayta] = useState(0);
  const [sozlash, setSozlash] = useState<BelgiGuruhi | 'yangi' | null>(null);
  const [belgilash, setBelgilash] = useState(false);
  const [ochiq, setOchiq] = useState<Question | null>(null);
  const [band, setBand] = useState<string | null>(null);
  // Telefonda filtr paneli tugma bilan ochiladi.
  const [filtrOchiq, setFiltrOchiq] = useState(false);
  const soni = SAHIFA[korinish];

  // Fan almashsa — filtr va tanlov boshidan.
  useEffect(() => { setT(BOSH); setTanlangan(new Set()); setSahifa(1); }, [fan?.id]);

  const filtrniYukla = useCallback(async () => {
    if (!fan) return;
    try { setFiltr(await soro<BankFiltrMalumoti>('GET', `bank/filtr?fanId=${fan.id}`)); } catch (e: any) { showNotification(e.message, 'error'); }
  }, [fan?.id, soro]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { filtrniYukla(); }, [filtrniYukla, qayta]);

  const sorov = useMemo(() => encodeURIComponent(JSON.stringify({
    fanId: fan?.id, qidDan: t.qidDan || undefined, qidGacha: t.qidGacha || undefined, holat: t.holat || undefined,
    mavzular: t.mavzular, qiyinlik: t.qiyinlik, manbalar: t.manbalar, belgilar: t.belgilar,
    toplam: t.toplam ?? undefined, tur: t.tur || undefined, qidiruv: t.qidiruv.trim() || undefined,
    izohlar: t.izohlar, matnli: t.matnli || undefined, joylashuv: t.joylashuv,
  })), [fan?.id, t]);

  useEffect(() => { setSahifa(1); }, [sorov, tartib, korinish]);
  useEffect(() => {
    if (!fan) return;
    let bekor = false;
    setYuklanmoqda(true);
    const kut = setTimeout(() => {
      soro<{ items: Qator[]; total: number }>('GET', `bank/royxat?f=${sorov}&sahifa=${sahifa}&soni=${soni}&tartib=${tartib}`)
        .then(r => { if (!bekor) setRoyxat(r); })
        .catch(e => { if (!bekor) showNotification(e.message, 'error'); })
        .finally(() => { if (!bekor) setYuklanmoqda(false); });
    }, 250);
    return () => { bekor = true; clearTimeout(kut); };
  }, [sorov, sahifa, soni, tartib, qayta, fan?.id, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  const ozgardi = () => { setQayta(n => n + 1); yangilaDaraxt(); };

  const mavzuNomi = useMemo(() => new Map((filtr?.mavzular || []).map(m => [m.id, m.nom])), [filtr]);
  const belgiNomi = useMemo(() => new Map((filtr?.guruhlar || []).flatMap(g => g.tags.map(x => [x.id, x.name] as const))), [filtr]);

  // Faol filtrlar — ro'yxat ustida olib tashlanadigan yorliqlar.
  const yorliqlar = useMemo(() => {
    const l: { k: string; nom: string; ol: () => void }[] = [];
    for (const id of t.mavzular) l.push({ k: `m${id}`, nom: mavzuNomi.get(id) || `#${id}`, ol: () => setT(x => ({ ...x, mavzular: x.mavzular.filter(y => y !== id) })) });
    for (const d of t.qiyinlik) l.push({ k: `q${d}`, nom: QIYINLIK[d - 1]?.nom || String(d), ol: () => setT(x => ({ ...x, qiyinlik: x.qiyinlik.filter(y => y !== d) })) });
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
  }, [t, mavzuNomi, belgiNomi]);
  const tozala = () => setT(x => ({ ...BOSH, qidiruv: x.qidiruv }));

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

  const ish = async (nom: string, f: () => Promise<void>) => {
    setBand(nom);
    try { await f(); } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(null); }
  };

  const korish = useCallback((id: number) => {
    setBand('korish');
    soro<Question>('GET', `questions/${id}`).then(setOchiq).catch(e => showNotification(e.message, 'error')).finally(() => setBand(null));
  }, [soro]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Addmen REMOVE FILTER: filtrda belgilangan qiymatlar tanlangan savollardan olinadi.
  const tagOl = Object.values(t.belgilar).flat();
  const belgiOl = () => ish('ol', async () => {
    const nomlar = tagOl.map(id => belgiNomi.get(id)).filter(Boolean);
    if (!(await confirm({ message: `${ids.length} ta savoldan «${nomlar.join('», «')}» olib tashlansinmi?`, danger: false }))) return;
    await soro('PUT', 'questions/bulk', { ids, tagOl });
    showNotification('Filtr qiymati olib tashlandi', 'success');
    ozgardi();
  });

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

  if (!fan) {
    return (
      <div className="bg-sirt border border-chiziq rounded-2xl">
        <BoshHolat sarlavha="Bankda hali fan yo'q" izoh="Savol qo'shganda fan o'zi yaratiladi yoki «Tuzilma» bo'limida fan qo'shing.">
          {onQosh && <Tugma turi="asosiy" ikonka={<Plus size={14} />} onClick={onQosh}>Savol qo'shish</Tugma>}
          <Tugma onClick={onTuzilma}>Tuzilma</Tugma>
        </BoshHolat>
      </div>
    );
  }

  const jamiSahifa = royxat ? Math.max(1, Math.ceil(royxat.total / soni)) : 1;
  const sahifalash = royxat && royxat.total > soni && (
    <span className="inline-flex items-center gap-1 text-[12px] text-matn-sokin">
      <button aria-label="Oldingi sahifa" disabled={sahifa <= 1} onClick={() => setSahifa(s => s - 1)} className="p-1 rounded-lg hover:bg-ichki disabled:opacity-30 cursor-pointer"><ChevronLeft size={15} /></button>
      <span className="raqam">{sahifa} / {jamiSahifa}</span>
      <button aria-label="Keyingi sahifa" disabled={sahifa >= jamiSahifa} onClick={() => setSahifa(s => s + 1)} className="p-1 rounded-lg hover:bg-ichki disabled:opacity-30 cursor-pointer"><ChevronRight size={15} /></button>
    </span>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[264px_minmax(0,1fr)] gap-4 items-start">
      {/* ---------------- Filtr paneli ---------------- */}
      <aside aria-label="Filtrlar"
        className={`${filtrOchiq ? 'block' : 'hidden'} lg:block lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto bg-sirt border border-chiziq rounded-2xl`}>
        <div className="p-3 space-y-2.5 border-b border-chiziq">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-matn"><SlidersHorizontal size={14} className="text-brand" /> Filtrlar</h3>
            {yorliqlar.length > 0 && <button onClick={tozala} className="text-[12px] font-semibold text-brand hover:underline cursor-pointer">Tozalash</button>}
          </div>
          <select className="w-full px-3 py-2 bg-ichki border border-chiziq rounded-xl text-[13px] font-semibold text-matn outline-none focus:border-brand cursor-pointer" value={fan.id} onChange={e => onFan(Number(e.target.value))} aria-label="Fan">
            {daraxt.fanlar.map(f => <option key={f.id} value={f.id}>{f.name} ({f.jami - f.arxiv})</option>)}
          </select>
        </div>
        {!filtr ? <Yuklanmoqda /> : (
          <>
            <Bolim nom="Mavzular" tanlangan={t.mavzular.length} boshOchiq onSozla={savolTahrir ? onTuzilma : undefined} sozlashIzoh="Bo'lim va mavzular — Tuzilma">
              <MavzuRoyxati filtr={filtr} tanlangan={t.mavzular} onChange={v => setT(x => ({ ...x, mavzular: v }))} />
            </Bolim>
            <Bolim nom="Qiyinlik" tanlangan={t.qiyinlik.length} boshOchiq>
              <div className="flex flex-wrap gap-1.5">
                {QIYINLIK.map((q, i) => {
                  const faol = t.qiyinlik.includes(q.d);
                  return (
                    <button key={q.d} type="button" aria-pressed={faol} onClick={() => setT(x => ({ ...x, qiyinlik: almashtirRoyxat(x.qiyinlik, q.d) }))}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer transition-colors ${faol ? `${q.fon} ${q.matn} ${q.chiziq}` : 'bg-sirt border-chiziq text-matn-sokin hover:text-matn'}`}>
                      <span className={`w-2 h-2 rounded-full ${q.nuqta}`} />{q.nom}<span className="raqam text-[11px] opacity-70">{filtr.qiyinlik[i]}</span>
                    </button>
                  );
                })}
              </div>
            </Bolim>
            <Bolim nom="Savol turi" tanlangan={t.tur ? 1 : 0} boshOchiq>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TUR_NOMI) as SavolTuri[]).filter(k => filtr.turlar[k] || t.tur === k).map(k => (
                  <button key={k} type="button" aria-pressed={t.tur === k} onClick={() => setT(x => ({ ...x, tur: x.tur === k ? '' : k }))} className={TABLETKA(t.tur === k)}>
                    {TUR_NOMI[k]}<span className="raqam text-[11px] opacity-70">{filtr.turlar[k]}</span>
                  </button>
                ))}
              </div>
            </Bolim>
            {filtr.manbalar.length > 0 && (
              <Bolim nom="Manba" tanlangan={t.manbalar.length} boshOchiq={filtr.manbalar.length > 1}>
                <Belgilar qiymatlar={filtr.manbalar.map(m => ({ k: m.nom, nom: m.nom || <i className="text-matn-xira">Manbasiz</i>, soni: m.soni }))}
                  tanlangan={t.manbalar} onChange={v => setT(x => ({ ...x, manbalar: v }))} />
              </Bolim>
            )}
            {filtr.guruhlar.map(g => (
              <Bolim key={g.id} nom={g.name} tanlangan={(t.belgilar[g.id] || []).length} boshOchiq onSozla={savolTahrir ? () => setSozlash(g) : undefined} sozlashIzoh="Qiymatlarni qo'shish, nomini o'zgartirish">
                {g.tags.length ? (
                  <Belgilar qiymatlar={g.tags.map(x => ({ k: x.id, nom: x.name, soni: filtr.belgilar[x.id] || 0 }))}
                    tanlangan={t.belgilar[g.id] || []} onChange={v => setT(x => ({ ...x, belgilar: { ...x.belgilar, [g.id]: v } }))} />
                ) : <p className="text-[12px] text-matn-xira">Qiymat yo'q — ⚙ orqali qo'shing</p>}
              </Bolim>
            ))}
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
            <Bolim nom="QID oralig'i" tanlangan={t.qidDan || t.qidGacha ? 1 : 0}>
              <div className="flex items-center gap-2">
                <input className="w-full min-w-0 px-2.5 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12.5px] raqam outline-none focus:border-brand" inputMode="numeric" placeholder="dan" aria-label="QID dan"
                  value={t.qidDan} onChange={e => setT(x => ({ ...x, qidDan: e.target.value.replace(/\D/g, '') }))} />
                <span className="text-matn-xira">–</span>
                <input className="w-full min-w-0 px-2.5 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12.5px] raqam outline-none focus:border-brand" inputMode="numeric" placeholder="gacha" aria-label="QID gacha"
                  value={t.qidGacha} onChange={e => setT(x => ({ ...x, qidGacha: e.target.value.replace(/\D/g, '') }))} />
              </div>
            </Bolim>
            {savolTahrir && (
              <div className="p-3">
                <button type="button" onClick={() => setSozlash('yangi')}
                  className="w-full rounded-xl border border-dashed border-chiziq-kuchli px-3 py-2.5 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-matn-sokin hover:text-brand hover:border-brand cursor-pointer"
                  title="Masalan: «Milliy sertifikat savollari», «Test turi»">
                  <Plus size={14} /> Filtr qo'shish
                </button>
              </div>
            )}
          </>
        )}
      </aside>

      {/* ---------------- Savollar ---------------- */}
      <div className="min-w-0 space-y-3">
        <div className="bg-sirt border border-chiziq rounded-2xl p-2.5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFiltrOchiq(o => !o)} aria-expanded={filtrOchiq}
            className={`lg:hidden ${TABLETKA(filtrOchiq)} py-2`}><SlidersHorizontal size={14} /> Filtrlar{yorliqlar.length > 0 && <span className="raqam">({yorliqlar.length})</span>}</button>
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
            <input className="w-full pl-9 pr-8 py-2 bg-ichki border border-chiziq rounded-xl text-[13px] text-matn outline-none focus:border-brand placeholder:text-matn-xira"
              placeholder="Savol matnidan qidirish" aria-label="Savol matnidan qidirish" value={t.qidiruv} onChange={e => setT(x => ({ ...x, qidiruv: e.target.value }))} />
            {t.qidiruv && <button aria-label="Qidiruvni tozalash" onClick={() => setT(x => ({ ...x, qidiruv: '' }))} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-matn-xira hover:text-matn cursor-pointer"><X size={14} /></button>}
          </div>
          <select className="px-2.5 py-2 bg-ichki border border-chiziq rounded-xl text-[12.5px] text-matn outline-none cursor-pointer" value={tartib} onChange={e => setTartib(e.target.value as 'asc' | 'desc')} aria-label="Tartib">
            <option value="asc">QID bo'yicha</option>
            <option value="desc">Yangilari avval</option>
          </select>
          <Tanlov kichik qiymat={korinish} onChange={setKorinish} variantlar={[
            { v: 'karta', nom: <span className="inline-flex items-center gap-1.5" title="Savol, variantlar va javob"><LayoutList size={14} /> To'liq</span> },
            { v: 'ixcham', nom: <span className="inline-flex items-center gap-1.5" title="Bir qatordan"><Rows3 size={14} /> Ixcham</span> },
          ]} />
        </div>

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
              {royxat.items.map(q => (
                <SavolKartochka key={q.id} q={q} ixcham={korinish === 'ixcham'} tanlangan={tanlangan.has(q.id)} onTanla={almashtir} onKor={korish}
                  mavzu={(q.bankTopicId != null && mavzuNomi.get(q.bankTopicId)) || q.topic || ''}
                  belgilar={(q.tagIds || []).map(id => belgiNomi.get(id)).filter(Boolean) as string[]} />
              ))}
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
              {savolTahrir && <AmalTugma ikonka={<Tags size={14} />} onClick={() => setBelgilash(true)} title="Mavzu, qiyinlik, manba va filtr qiymatlarini hammasiga birdan berish">O'zgartirish</AmalTugma>}
              {savolTahrir && tagOl.length > 0 && <AmalTugma ikonka={<Eraser size={14} />} band={band === 'ol'} onClick={belgiOl} title="Chapda belgilangan filtr qiymatlari tanlangan savollardan olib tashlanadi">Filtr qiymatini olish</AmalTugma>}
              {savolTahrir && <AmalTugma ikonka={<RotateCcw size={14} />} band={band === 'nol'} onClick={ishlatilishNol} title="Imtihonlarda necha marta ishlatilgani nolga tushadi — yana birinchi navbatda tanlanadi">Ishlatilishini nolga</AmalTugma>}
              {ochiradi && <AmalTugma ikonka={<Trash2 size={14} />} band={band === 'ochir'} onClick={ochir} xavfli>O'chirish</AmalTugma>}
              <button aria-label="Tanlovni bekor qilish" title="Tanlovni bekor qilish" onClick={() => setTanlangan(new Set())} className="ml-1 p-1.5 rounded-lg hover:bg-sirt/15 cursor-pointer"><X size={15} /></button>
            </div>
          </div>
        )}
      </div>

      {sozlash && <FiltrSozlash guruh={sozlash === 'yangi' ? null : sozlash} onYop={() => setSozlash(null)} onOzgardi={() => setQayta(n => n + 1)} />}
      {belgilash && filtr && <BelgilashOynasi ids={ids} filtr={filtr} boshi={belgilashBoshi()} onYop={() => setBelgilash(false)} onSaqlandi={ozgardi} />}
      {ochiq && <SavolOynasi q={ochiq} daraxt={daraxt} onYop={() => setOchiq(null)} onOzgardi={ozgardi} />}
    </div>
  );
}

function AmalTugma({ ikonka, band, xavfli, children, ...qolgan }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ikonka: React.ReactNode; band?: boolean; xavfli?: boolean }) {
  return (
    <button type="button" {...qolgan} disabled={band || qolgan.disabled}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap cursor-pointer hover:bg-sirt/15 disabled:opacity-60 ${xavfli ? 'text-red-300 dark:text-xato' : ''}`}>
      {band ? <Loader2 size={14} className="animate-spin" /> : ikonka}{children}
    </button>
  );
}

/** Filtr paneli bo'limi: sarlavha bosilsa yig'iladi; tanlanganlar soni va ⚙ sozlash. */
function Bolim({ nom, tanlangan = 0, boshOchiq = false, onSozla, sozlashIzoh, children }: {
  nom: string; tanlangan?: number; boshOchiq?: boolean; onSozla?: () => void; sozlashIzoh?: string; children: React.ReactNode;
}) {
  const [ochiq, setOchiq] = useState(boshOchiq || tanlangan > 0);
  return (
    <section className="border-b border-chiziq last:border-b-0">
      <div className="flex items-center gap-1 pl-3 pr-2">
        <button type="button" onClick={() => setOchiq(o => !o)} aria-expanded={ochiq} className="flex-1 min-w-0 flex items-center gap-2 py-2.5 text-left cursor-pointer">
          <ChevronDown size={14} className={`shrink-0 text-matn-xira transition-transform ${ochiq ? '' : '-rotate-90'}`} />
          <span className="flex-1 min-w-0 truncate text-[12.5px] font-semibold text-matn">{nom}</span>
          {tanlangan > 0 && <span className="raqam text-[11px] font-bold min-w-5 text-center px-1.5 rounded-md bg-brand text-brand-ust">{tanlangan}</span>}
        </button>
        {onSozla && (
          <button type="button" onClick={onSozla} aria-label={`${nom} — sozlash`} title={sozlashIzoh}
            className="p-1.5 rounded-md text-matn-xira hover:text-brand hover:bg-ichki cursor-pointer"><Settings2 size={13} /></button>
        )}
      </div>
      {ochiq && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

/** Belgilash ro'yxati: har qatorda qiymat va nechta savol. */
function Belgilar<K extends string | number>({ qiymatlar, tanlangan, onChange }: {
  qiymatlar: { k: K; nom: React.ReactNode; soni?: number; izoh?: string }[]; tanlangan: K[]; onChange: (v: K[]) => void;
}) {
  return (
    <ul className="max-h-60 overflow-y-auto -mx-1.5">
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

/** Mavzular bo'limlari bilan: bo'lim belgisi uning hamma mavzusini tanlaydi; ko'p bo'lsa qidiruv. */
function MavzuRoyxati({ filtr, tanlangan, onChange }: { filtr: BankFiltrMalumoti; tanlangan: number[]; onChange: (v: number[]) => void }) {
  const [q, setQ] = useState('');
  const mavzular = q.trim() ? filtr.mavzular.filter(m => m.nom.toLowerCase().includes(q.trim().toLowerCase())) : filtr.mavzular;
  const bolimli = filtr.mavzular.some(m => m.bolim);
  const guruhlar = useMemo(() => {
    const m = new Map<string, typeof mavzular>();
    for (const x of mavzular) { if (!m.has(x.bolim)) m.set(x.bolim, []); m.get(x.bolim)!.push(x); }
    return [...m.entries()];
  }, [mavzular]);
  if (!filtr.mavzular.length) return <p className="text-[12px] text-matn-xira">Mavzu yo'q — ⚙ Tuzilma orqali qo'shing</p>;
  const qator = (m: (typeof mavzular)[number], ichki: boolean) => {
    const b = tanlangan.includes(m.id);
    return (
      <li key={m.id}>
        <label className={`flex items-center gap-2 ${ichki ? 'pl-5' : 'pl-1.5'} pr-1.5 py-1 rounded-lg text-[12.5px] cursor-pointer select-none ${b ? 'bg-brand-fon/70 dark:bg-brand/10' : 'hover:bg-ichki'}`}>
          <input type="checkbox" className="w-3.5 h-3.5 shrink-0 accent-[var(--color-brand)] cursor-pointer" checked={b} onChange={() => onChange(almashtirRoyxat(tanlangan, m.id))} />
          <span className={`flex-1 min-w-0 truncate ${b ? 'font-semibold text-matn' : 'text-matn'}`}>{m.nom}</span>
          <span className={`shrink-0 raqam text-[11px] ${m.soni ? 'text-matn-xira' : 'text-matn-xira/50'}`}>{m.soni}</span>
        </label>
      </li>
    );
  };
  return (
    <>
      {filtr.mavzular.length > 8 && (
        <div className="relative mb-1.5">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-matn-xira" />
          <input className="w-full pl-7 pr-2 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12px] text-matn outline-none focus:border-brand placeholder:text-matn-xira"
            placeholder="Mavzu qidirish" aria-label="Mavzu qidirish" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      )}
      <ul className="max-h-72 overflow-y-auto -mx-1.5">
        {!bolimli ? mavzular.map(m => qator(m, false)) : guruhlar.map(([bolim, l]) => {
          const idlar = l.map(m => m.id);
          const hammasi = idlar.every(id => tanlangan.includes(id));
          const qisman = !hammasi && idlar.some(id => tanlangan.includes(id));
          return (
            <li key={bolim || '_'}>
              <label className="flex items-center gap-2 px-1.5 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-matn-xira cursor-pointer select-none">
                <input type="checkbox" className="w-3.5 h-3.5 shrink-0 accent-[var(--color-brand)] cursor-pointer" checked={hammasi} ref={el => { if (el) el.indeterminate = qisman; }}
                  onChange={() => onChange(hammasi || qisman ? tanlangan.filter(id => !idlar.includes(id)) : [...new Set([...tanlangan, ...idlar])])} />
                <span className="truncate">{bolim || "Bo'limsiz"}</span>
              </label>
              <ul>{l.map(m => qator(m, true))}</ul>
            </li>
          );
        })}
        {!mavzular.length && <li className="px-1.5 py-1 text-[12px] text-matn-xira">Topilmadi</li>}
      </ul>
    </>
  );
}

/** Savol kartochkasi: matn formulalar bilan, variantlar va to'g'ri javob ochmasdan ko'rinadi. */
const SavolKartochka = memo(function SavolKartochka({ q, ixcham, tanlangan, mavzu, belgilar, onTanla, onKor }: {
  q: Qator; ixcham: boolean; tanlangan: boolean; mavzu: string; belgilar: string[]; onTanla: (id: number) => void; onKor: (id: number) => void;
}) {
  const html = useMemo(() => formulaliHtml(q.text || ''), [q.text]);
  const variantlar = useMemo(() => (ixcham ? [] : (q.options || []).map(o => formulaliHtml(o))), [q.options, ixcham]);
  const qisqa = useMemo(() => (q.options || []).every(o => oddiyMatn(o).length <= 22 && !/<img/i.test(o)), [q.options]);
  const togri = HARFLAR.indexOf(String(q.correctAnswer || '').toUpperCase());
  const raqamliJavob = q.type === 'raqamli' ? [...new Set([q.correctAnswer, ...(q.answers || [])].filter(Boolean))].join(' · ') : '';
  const javobQisqa = q.type === 'yopiq' ? (togri >= 0 ? HARFLAR[togri] : '') : q.type === 'moslash' ? String(q.correctAnswer || '') : raqamliJavob;

  return (
    <li className={`flex gap-3 px-4 ${ixcham ? 'py-2' : 'py-3.5'} cursor-pointer transition-colors ${tanlangan ? 'bg-brand-fon/60 dark:bg-brand/10' : 'hover:bg-ichki/60'} ${q.status === 'arxiv' ? 'opacity-60' : ''}`}
      onClick={() => onTanla(q.id)} onDoubleClick={() => onKor(q.id)}>
      <input type="checkbox" aria-label={`#${q.id} savolni tanlash`} className={`${ixcham ? 'mt-0.5' : 'mt-1'} w-4 h-4 shrink-0 accent-[var(--color-brand)] cursor-pointer`}
        checked={tanlangan} onChange={() => onTanla(q.id)} onClick={e => e.stopPropagation()} />
      <div className="min-w-0 flex-1">
        {ixcham ? (
          <div className="flex items-center gap-2 min-w-0 text-[12.5px]">
            <span className="raqam text-[11.5px] font-bold text-matn-xira w-12 shrink-0">#{q.id}</span>
            <span className={`w-2 h-2 rounded-full shrink-0 ${QIYINLIK[Math.min(3, Math.max(1, q.difficulty)) - 1].nuqta}`} title={QIYINLIK[Math.min(3, Math.max(1, q.difficulty)) - 1].nom} />
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
              <QiyinlikYorligi d={q.difficulty} />
              {q.type !== 'yopiq' && <Yorliq rang="brand">{TUR_NOMI[q.type]}</Yorliq>}
              {q.status === 'qoralama' && <Yorliq rang="ogoh">Qoralama</Yorliq>}
              {q.status === 'arxiv' && <Yorliq>Arxiv</Yorliq>}
              {q.passageId && <Yorliq>matnli</Yorliq>}
              {belgilar.map(n => <Yorliq key={n}>{n}</Yorliq>)}
              <span className="ml-auto flex items-center gap-2.5 text-matn-xira">
                {!!q.usedCount && <span>{q.usedCount} marta ishlatilgan</span>}
                <span className="raqam">{sana(q.createdAt)}</span>
              </span>
            </div>
            <div className={`${SAVOL_MATNI} text-[13.5px] text-matn [&_p]:my-0.5`} dangerouslySetInnerHTML={{ __html: html || '<p>—</p>' }} />
            {q.imageUrl && <img src={q.imageUrl} alt="" loading="lazy" className="mt-2 max-h-40 rounded-lg border border-chiziq bg-white" />}
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
