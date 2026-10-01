import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Eye, Tags, Trash2, RotateCcw, Eraser, ChevronLeft, ChevronRight, Loader2, Search, X, ArrowUpDown, CheckSquare } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, INPUT, Yuklanmoqda, BoshHolat } from '../ui';
import { formulaliHtml, SAVOL_MATNI } from '../../../lib/matn';
import FiltrUstuni, { type FiltrQiymati } from './FiltrUstuni';
import { FiltrSozlash, BelgilashOynasi, type BelgilashBoshi } from './BankOynalari';
import { SavolOynasi } from './SavolKartasi';
import { QIYINLIK, qiyinlikDaraja } from './qiyinlik';
import type { BankDaraxt, BankFiltrMalumoti, BelgiGuruhi, Question } from '../../../types';

// Savollar banki — Addmen "QUESTION BANK" ekrani tartibida (markaz shunga
// o'rgangan): chapda filtr ustunlari (bo'lim, mavzu, foydalanuvchi filtrlari,
// manba, qiyinlik), o'rtada savollar ro'yxati (QID, savol, to'plam, sana), o'ngda
// amallar paneli (QID oralig'i, hisoblagichlar, belgilash, o'chirish...).

const SAHIFA = 100;
type Holat = '' | 'faol' | 'qoralama' | 'arxiv';
interface Tanlov {
  bolimlar: string[]; mavzular: number[]; qiyinlik: number[]; manbalar: string[];
  belgilar: Record<number, number[]>; toplam: string | null; holat: Holat; tur: string; qidiruv: string;
}
const BOSH: Tanlov = { bolimlar: [], mavzular: [], qiyinlik: [], manbalar: [], belgilar: {}, toplam: null, holat: '', tur: '', qidiruv: '' };
const sana = (s?: string) => (s ? new Date(s).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '.') : '');

type Qator = Pick<Question, 'id' | 'text' | 'type' | 'difficulty' | 'status' | 'toplam' | 'source' | 'tagIds' | 'topic' | 'bankTopicId' | 'usedCount' | 'createdAt' | 'imageUrl'>;

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
  const [t, setT] = useState<Tanlov>(BOSH);
  const [qid, setQid] = useState({ dan: '', gacha: '' });
  // Addmen: ALL — ustun filtrlarisiz (faqat fan va QID oralig'i), FILTERED — filtr bo'yicha.
  const [rejim, setRejim] = useState<'hammasi' | 'filtr'>('filtr');
  const [tartib, setTartib] = useState<'asc' | 'desc'>('asc');
  const [sahifa, setSahifa] = useState(1);
  const [royxat, setRoyxat] = useState<{ items: Qator[]; total: number } | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [tanlangan, setTanlangan] = useState<Set<number>>(new Set());
  const [qayta, setQayta] = useState(0);
  const [sozlash, setSozlash] = useState<BelgiGuruhi | 'yangi' | null>(null);
  const [belgilash, setBelgilash] = useState(false);
  const [ochiq, setOchiq] = useState<Question | null>(null);
  const [band, setBand] = useState<string | null>(null);

  // Fan almashsa — filtr va tanlov boshidan.
  useEffect(() => { setT(BOSH); setTanlangan(new Set()); setSahifa(1); setQid({ dan: '', gacha: '' }); }, [fan?.id]);

  const filtrniYukla = useCallback(async () => {
    if (!fan) return;
    try { setFiltr(await soro<BankFiltrMalumoti>('GET', `bank/filtr?fanId=${fan.id}`)); } catch (e: any) { showNotification(e.message, 'error'); }
  }, [fan?.id, soro]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { filtrniYukla(); }, [filtrniYukla, qayta]);

  const sorov = useMemo(() => {
    const f: Record<string, unknown> = { fanId: fan?.id, qidDan: qid.dan || undefined, qidGacha: qid.gacha || undefined, holat: t.holat || undefined };
    if (rejim === 'filtr') {
      Object.assign(f, {
        bolimlar: t.bolimlar, mavzular: t.mavzular, qiyinlik: t.qiyinlik, manbalar: t.manbalar, belgilar: t.belgilar,
        toplam: t.toplam ?? undefined, tur: t.tur || undefined, qidiruv: t.qidiruv.trim() || undefined,
      });
    }
    return encodeURIComponent(JSON.stringify(f));
  }, [fan?.id, t, qid, rejim]);

  useEffect(() => { setSahifa(1); }, [sorov, tartib]);
  useEffect(() => {
    if (!fan) return;
    let bekor = false;
    setYuklanmoqda(true);
    const kut = setTimeout(() => {
      soro<{ items: Qator[]; total: number }>('GET', `bank/royxat?f=${sorov}&sahifa=${sahifa}&soni=${SAHIFA}&tartib=${tartib}`)
        .then(r => { if (!bekor) setRoyxat(r); })
        .catch(e => { if (!bekor) showNotification(e.message, 'error'); })
        .finally(() => { if (!bekor) setYuklanmoqda(false); });
    }, 250);
    return () => { bekor = true; clearTimeout(kut); };
  }, [sorov, sahifa, tartib, qayta, fan?.id, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  const ozgardi = () => { setQayta(n => n + 1); yangilaDaraxt(); };

  // --- Filtr ustunlari ------------------------------------------------------
  const ustunlar = useMemo(() => {
    if (!filtr) return null;
    const bolimlar: FiltrQiymati<string>[] = filtr.bolimlar.map(b => ({ k: b.nom, nom: b.nom || <i className="text-matn-xira">Bo'limsiz</i>, soni: b.soni }));
    const mavzular: FiltrQiymati<number>[] = filtr.mavzular
      .filter(m => !t.bolimlar.length || t.bolimlar.includes(m.bolim))
      .map(m => ({ k: m.id, nom: m.nom, soni: m.soni, izoh: m.bolim || undefined }));
    const manbalar: FiltrQiymati<string>[] = filtr.manbalar.map(m => ({ k: m.nom, nom: m.nom || <i className="text-matn-xira">Manbasiz</i>, soni: m.soni }));
    const qiyinlik: FiltrQiymati<number>[] = QIYINLIK.map((q, i) => ({
      k: q.d, soni: filtr.qiyinlik[i], nom: <span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${q.nuqta}`} />{q.nom}</span>,
    }));
    const guruh = (g: BelgiGuruhi): FiltrQiymati<number>[] => g.tags.map(x => ({ k: x.id, nom: x.name, soni: filtr.belgilar[x.id] || 0 }));
    return { bolimlar, mavzular, manbalar, qiyinlik, guruh };
  }, [filtr, t.bolimlar]);

  const belgiUstuni = (g: BelgiGuruhi) => ustunlar && (
    <FiltrUstuni key={`g${g.id}`} sarlavha={g.name} qiymatlar={ustunlar.guruh(g)} tanlangan={t.belgilar[g.id] || []} bosh="Qiymat yo'q — ⚙ orqali qo'shing"
      onChange={v => setT(x => ({ ...x, belgilar: { ...x.belgilar, [g.id]: v } }))} onSozla={savolTahrir ? () => setSozlash(g) : undefined} />
  );

  // --- Tanlash ---------------------------------------------------------------
  const sahifadagi = royxat?.items.map(q => q.id) || [];
  const sahifaTanlangan = sahifadagi.length > 0 && sahifadagi.every(id => tanlangan.has(id));
  const almashtir = (id: number) => setTanlangan(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
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

  const korish = (id?: number) => ish('korish', async () => {
    const q = id ?? ids[0];
    if (!q) throw new Error("Ko'rish uchun savolni belgilang");
    setOchiq(await soro<Question>('GET', `questions/${q}`));
  });

  // Belgilash oynasi — ustunlarda bittadan tanlangan qiymat oldindan qo'yiladi (Addmen SAVE).
  const belgilashBoshi = (): BelgilashBoshi => {
    const b: BelgilashBoshi = { guruhlar: {} };
    if (t.mavzular.length === 1) b.mavzuId = t.mavzular[0];
    if (t.qiyinlik.length === 1) b.qiyinlik = t.qiyinlik[0];
    if (t.manbalar.length === 1) b.manba = t.manbalar[0];
    for (const [g, v] of Object.entries(t.belgilar)) if (v.length) b.guruhlar![Number(g)] = v;
    return b;
  };

  // Addmen REMOVE FILTER: ustunlarda belgilangan qiymatlar tanlangan savollardan olinadi.
  const belgiOl = () => ish('ol', async () => {
    const tagOl = Object.values(t.belgilar).flat();
    if (!ids.length) throw new Error('Savollarni belgilang');
    if (!tagOl.length) throw new Error("Olib tashlanadigan qiymatni filtr ustunida belgilang");
    const nomlar = (filtr?.guruhlar || []).flatMap(g => g.tags).filter(x => tagOl.includes(x.id)).map(x => x.name);
    if (!(await confirm({ message: `${ids.length} ta savoldan «${nomlar.join('», «')}» olib tashlansinmi?`, danger: false }))) return;
    await soro('PUT', 'questions/bulk', { ids, tagOl });
    showNotification('Belgilar olib tashlandi', 'success');
    ozgardi();
  });

  const ishlatilishNol = () => ish('nol', async () => {
    if (!ids.length) throw new Error('Savollarni belgilang');
    if (!(await confirm({ message: `${ids.length} ta savolning «necha marta ishlatilgan» hisobi nolga tushirilsinmi? Imtihon tuzishda ular yana birinchi navbatda olinadi.`, danger: false }))) return;
    await soro('PUT', 'questions/bulk', { ids, ishlatilishNol: true });
    showNotification('Ishlatilish hisobi nolga tushirildi', 'success');
    ozgardi();
  });

  const ochir = () => ish('ochir', async () => {
    if (!ids.length) throw new Error('Savollarni belgilang');
    if (!(await confirm(`${ids.length} ta savol o'chirilsinmi? Imtihonda ishlatilganlari o'chirilmaydi — arxivga (yashirin) o'tadi.`))) return;
    const r = await soro<{ ochirildi: number; arxivlandi: number }>('POST', 'questions/bulk-ochir', { ids });
    showNotification(`${r.ochirildi} ta o'chirildi${r.arxivlandi ? `, ${r.arxivlandi} tasi arxivga o'tdi` : ''}`, 'info');
    setTanlangan(new Set());
    ozgardi();
  });

  const filtrBor = t !== BOSH && JSON.stringify(t) !== JSON.stringify(BOSH);

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

  const jamiSahifa = royxat ? Math.max(1, Math.ceil(royxat.total / SAHIFA)) : 1;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_200px] gap-3 items-start">
        {/* Filtr ustunlari — Addmen'dagidek 3 ustunli to'r */}
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-matn-sokin">
              Fan
              <select className="px-2.5 py-1.5 bg-sirt border border-chiziq rounded-lg text-[13px] font-bold text-matn outline-none focus:border-brand cursor-pointer" value={fan.id} onChange={e => onFan(Number(e.target.value))} aria-label="Fan">
                {daraxt.fanlar.map(f => <option key={f.id} value={f.id}>{f.name} ({f.jami - f.arxiv})</option>)}
              </select>
            </label>
            {filtrBor && <Tugma kichik turi="oddiy" ikonka={<Eraser size={13} />} onClick={() => setT(BOSH)}>Filtrni tozalash</Tugma>}
            {rejim === 'hammasi' && <span className="text-[11.5px] font-semibold text-ogoh">«Hammasi» rejimi — ustun filtrlari hisobga olinmaydi</span>}
          </div>
          {!ustunlar ? <Yuklanmoqda /> : (
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 gap-2.5 ${rejim === 'hammasi' ? 'opacity-50' : ''}`}>
              <FiltrUstuni sarlavha="Bo'limlar" qiymatlar={ustunlar.bolimlar} tanlangan={t.bolimlar}
                onChange={v => setT(x => ({ ...x, bolimlar: v, mavzular: x.mavzular.filter(id => !v.length || v.includes(filtr!.mavzular.find(m => m.id === id)?.bolim ?? '')) }))}
                onSozla={savolTahrir ? onTuzilma : undefined} />
              <FiltrUstuni sarlavha="Bo'limlarning mavzulari" qiymatlar={ustunlar.mavzular} tanlangan={t.mavzular} bosh="Mavzu yo'q"
                onChange={v => setT(x => ({ ...x, mavzular: v }))} onSozla={savolTahrir ? onTuzilma : undefined} />
              {filtr!.guruhlar[0] && belgiUstuni(filtr!.guruhlar[0])}
              <FiltrUstuni sarlavha="Manbasi" qiymatlar={ustunlar.manbalar} tanlangan={t.manbalar} onChange={v => setT(x => ({ ...x, manbalar: v }))} />
              <FiltrUstuni sarlavha="Qiyinlik" qiymatlar={ustunlar.qiyinlik} tanlangan={t.qiyinlik} balandlik="h-auto" onChange={v => setT(x => ({ ...x, qiyinlik: v }))} />
              {filtr!.guruhlar.slice(1).map(belgiUstuni)}
              {savolTahrir && (
                <button type="button" onClick={() => setSozlash('yangi')}
                  className="rounded-xl border-2 border-dashed border-chiziq-kuchli min-h-24 flex flex-col items-center justify-center gap-1 text-[12px] font-semibold text-matn-sokin hover:text-brand hover:border-brand cursor-pointer">
                  <Plus size={16} /> Filtr qo'shish
                  <span className="text-[11px] font-normal text-matn-xira px-3 text-center">Masalan: «Milliy sertifikat savollari», «Test turi»</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Savollar ro'yxati */}
        <section className="bg-sirt border border-chiziq rounded-xl min-w-0 flex flex-col" aria-label="Savollar">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-chiziq">
            <div className="relative flex-1 min-w-40">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-matn-xira" />
              <input className={`${INPUT} py-1.5 pl-8 text-[12.5px]`} placeholder="Savol matnidan qidirish" aria-label="Savol matnidan qidirish" value={t.qidiruv} onChange={e => setT(x => ({ ...x, qidiruv: e.target.value }))} />
              {t.qidiruv && <button aria-label="Tozalash" onClick={() => setT(x => ({ ...x, qidiruv: '' }))} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-matn-xira hover:text-matn cursor-pointer"><X size={13} /></button>}
            </div>
            <select className="px-2 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12px] text-matn outline-none cursor-pointer max-w-44" value={t.toplam ?? '__hammasi'} aria-label="To'plam (fayl)"
              onChange={e => setT(x => ({ ...x, toplam: e.target.value === '__hammasi' ? null : e.target.value }))}>
              <option value="__hammasi">Hamma to'plamlar</option>
              {(filtr?.toplamlar || []).map(x => <option key={x.nom || '_'} value={x.nom}>{x.nom || "To'plamsiz"} ({x.soni})</option>)}
            </select>
            <select className="px-2 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12px] text-matn outline-none cursor-pointer" value={t.holat} aria-label="Holati"
              onChange={e => setT(x => ({ ...x, holat: e.target.value as Holat }))}>
              <option value="">Faol va qoralama</option>
              <option value="faol">Faol ({filtr?.holat.faol ?? 0})</option>
              <option value="qoralama">Qoralama ({filtr?.holat.qoralama ?? 0})</option>
              <option value="arxiv">Yashirin — arxiv ({filtr?.holat.arxiv ?? 0})</option>
            </select>
            <select className="px-2 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12px] text-matn outline-none cursor-pointer" value={t.tur} aria-label="Savol turi"
              onChange={e => setT(x => ({ ...x, tur: e.target.value }))}>
              <option value="">Hamma turlar</option>
              <option value="yopiq">Variantli</option>
              <option value="raqamli">Raqamli javob</option>
              <option value="yozma">Yozma</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-ichki text-matn-sokin text-[11.5px]">
                <tr>
                  <th className="w-8 px-2 py-2"><input type="checkbox" aria-label="Sahifadagi hammasini tanlash" className="w-3.5 h-3.5 accent-[var(--color-brand)] cursor-pointer" checked={sahifaTanlangan} onChange={sahifaniTanla} /></th>
                  <th className="px-1 py-2 text-left font-semibold w-16">
                    <button className="inline-flex items-center gap-1 cursor-pointer hover:text-matn" onClick={() => setTartib(x => (x === 'asc' ? 'desc' : 'asc'))} title="Tartib">QID <ArrowUpDown size={11} /></button>
                  </th>
                  <th className="px-2 py-2 text-left font-semibold">Savol</th>
                  <th className="px-2 py-2 text-left font-semibold hidden md:table-cell">To'plam</th>
                  <th className="px-2 py-2 text-left font-semibold w-[68px]">Sana</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-chiziq">
                {royxat?.items.map(q => <SavolQatori key={q.id} q={q} tanlangan={tanlangan.has(q.id)} onTanla={almashtir} onKor={korish} />)}
              </tbody>
            </table>
            {royxat && !royxat.items.length && !yuklanmoqda && (
              <p className="px-4 py-10 text-center text-[12.5px] text-matn-xira">
                {filtrBor ? 'Filtrga mos savol yo\'q' : 'Bu fanda hali savol yo\'q'}
              </p>
            )}
            {!royxat && <Yuklanmoqda />}
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-chiziq text-[12px] text-matn-sokin mt-auto">
            <span className="inline-flex items-center gap-1.5">
              {yuklanmoqda && <Loader2 size={12} className="animate-spin" />}
              {royxat ? <>{royxat.total ? `${(sahifa - 1) * SAHIFA + 1}–${Math.min(sahifa * SAHIFA, royxat.total)}` : 0} / <b className="text-matn raqam">{royxat.total}</b></> : '…'}
            </span>
            <span className="inline-flex items-center gap-1">
              <button aria-label="Oldingi sahifa" disabled={sahifa <= 1} onClick={() => setSahifa(s => s - 1)} className="p-1 rounded-lg hover:bg-ichki disabled:opacity-30 cursor-pointer"><ChevronLeft size={15} /></button>
              <span className="raqam">{sahifa} / {jamiSahifa}</span>
              <button aria-label="Keyingi sahifa" disabled={sahifa >= jamiSahifa} onClick={() => setSahifa(s => s + 1)} className="p-1 rounded-lg hover:bg-ichki disabled:opacity-30 cursor-pointer"><ChevronRight size={15} /></button>
            </span>
          </div>
        </section>

        {/* Amallar paneli — Addmen'ning o'ng ustuni */}
        <aside className="bg-sirt border border-chiziq rounded-xl p-3 space-y-3 xl:sticky xl:top-3" aria-label="Amallar">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[11px] font-semibold text-matn-sokin mb-1">QID dan</span>
              <input className={`${INPUT} py-1.5 text-[12.5px] raqam`} inputMode="numeric" value={qid.dan} onChange={e => setQid(x => ({ ...x, dan: e.target.value.replace(/\D/g, '') }))} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-matn-sokin mb-1">QID gacha</span>
              <input className={`${INPUT} py-1.5 text-[12.5px] raqam`} inputMode="numeric" value={qid.gacha} onChange={e => setQid(x => ({ ...x, gacha: e.target.value.replace(/\D/g, '') }))} />
            </label>
          </div>
          <div className="flex gap-3 text-[12px] text-matn" role="radiogroup" aria-label="Ro'yxat rejimi">
            {([['hammasi', 'Hammasi'], ['filtr', 'Filtr bo\'yicha']] as const).map(([v, nom]) => (
              <label key={v} className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="bank-rejim" className="accent-[var(--color-brand)]" checked={rejim === v} onChange={() => setRejim(v)} />{nom}
              </label>
            ))}
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-[12px] rounded-lg bg-ichki px-2.5 py-2">
            <dt className="text-matn-sokin">Jami</dt><dd className="font-bold text-matn raqam">{filtr?.jami ?? '…'}</dd>
            <dt className="text-matn-sokin">Yashirin (arxiv)</dt><dd className="font-semibold text-matn-sokin raqam">{filtr?.yashirin ?? '…'}</dd>
            <dt className="text-matn-sokin">Ro'yxatda</dt><dd className="font-bold text-brand raqam">{royxat?.total ?? '…'}</dd>
            <dt className="text-matn-sokin">Tanlangan</dt><dd className="font-bold text-matn raqam">{tanlangan.size}</dd>
          </dl>
          <div className="grid grid-cols-2 xl:grid-cols-1 gap-1.5">
            <Tugma kichik ikonka={<CheckSquare size={13} />} yuklanmoqda={band === 'tanla'} disabled={!royxat?.total} onClick={hammasiniTanla}>Hammasini tanlash</Tugma>
            {tanlangan.size > 0 && <Tugma kichik turi="oddiy" ikonka={<X size={13} />} onClick={() => setTanlangan(new Set())}>Tanlovni bekor qilish</Tugma>}
            <Tugma kichik ikonka={<Eye size={13} />} yuklanmoqda={band === 'korish'} disabled={!tanlangan.size} onClick={() => korish()}>Savolni ko'rish</Tugma>
            {savolTahrir && <>
              <Tugma kichik turi="asosiy" ikonka={<Tags size={13} />} disabled={!tanlangan.size || !filtr} onClick={() => setBelgilash(true)}>Belgilash…</Tugma>
              <Tugma kichik ikonka={<Eraser size={13} />} yuklanmoqda={band === 'ol'} disabled={!tanlangan.size} onClick={belgiOl}
                title="Filtr ustunlarida belgilangan qiymatlar tanlangan savollardan olib tashlanadi">Belgini olib tashlash</Tugma>
              <Tugma kichik ikonka={<RotateCcw size={13} />} yuklanmoqda={band === 'nol'} disabled={!tanlangan.size} onClick={ishlatilishNol}
                title="Imtihonlarda necha marta ishlatilgani nolga tushadi">Ishlatilishini nolga</Tugma>
            </>}
            {ochiradi && <Tugma kichik turi="xavfli" ikonka={<Trash2 size={13} />} yuklanmoqda={band === 'ochir'} disabled={!tanlangan.size} onClick={ochir}>O'chirish</Tugma>}
          </div>
          {onQosh && (
            <div className="pt-2 border-t border-chiziq">
              <Tugma kichik turi="asosiy" className="w-full" ikonka={<Plus size={13} />} onClick={onQosh}>Savol qo'shish</Tugma>
              <p className="mt-1.5 text-[11px] text-matn-xira">Word (Addmen QR jadvali), Excel, PDF, rasm yoki matn</p>
            </div>
          )}
        </aside>
      </div>

      {sozlash && <FiltrSozlash guruh={sozlash === 'yangi' ? null : sozlash} onYop={() => setSozlash(null)} onOzgardi={() => setQayta(n => n + 1)} />}
      {belgilash && filtr && <BelgilashOynasi ids={ids} filtr={filtr} boshi={belgilashBoshi()} onYop={() => setBelgilash(false)} onSaqlandi={ozgardi} />}
      {ochiq && <SavolOynasi q={ochiq} daraxt={daraxt} onYop={() => setOchiq(null)} onOzgardi={ozgardi} />}
    </div>
  );
}

const SavolQatori = memo(function SavolQatori({ q, tanlangan, onTanla, onKor }: { q: Qator; tanlangan: boolean; onTanla: (id: number) => void; onKor: (id: number) => void }) {
  const d = qiyinlikDaraja(q.difficulty);
  const html = useMemo(() => formulaliHtml(q.text || ''), [q.text]);
  return (
    <tr className={`cursor-pointer ${tanlangan ? 'bg-brand-fon/70 dark:bg-brand/10' : 'hover:bg-ichki/70'} ${q.status === 'arxiv' ? 'opacity-60' : ''}`}
      onClick={() => onTanla(q.id)} onDoubleClick={() => onKor(q.id)}>
      <td className="px-2 py-1.5 text-center" onClick={e => e.stopPropagation()}>
        <input type="checkbox" aria-label={`#${q.id} savolni tanlash`} className="w-3.5 h-3.5 accent-[var(--color-brand)] cursor-pointer" checked={tanlangan} onChange={() => onTanla(q.id)} />
      </td>
      <td className="px-1 py-1.5 raqam text-matn-sokin whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.nuqta}`} title={d.nom} />{q.id}</span>
      </td>
      <td className="px-2 py-1.5 max-w-0 w-full">
        <div className="flex items-center gap-1.5 min-w-0">
          {q.status === 'qoralama' && <span className="shrink-0 rounded px-1 text-[10px] font-semibold bg-ogoh-fon text-ogoh">qoralama</span>}
          {q.imageUrl && <span className="shrink-0 text-[10px] text-matn-xira">[rasm]</span>}
          <span className={`${SAVOL_MATNI} min-w-0 truncate text-matn [&_p]:inline [&_p]:my-0 [&_br]:hidden`} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </td>
      <td className="px-2 py-1.5 text-matn-xira truncate max-w-40 hidden md:table-cell" title={q.toplam || ''}>{q.toplam || '—'}</td>
      <td className="px-2 py-1.5 text-matn-xira raqam whitespace-nowrap">{sana(q.createdAt)}</td>
      <td className="pr-2 py-1.5" onClick={e => e.stopPropagation()}>
        <button aria-label={`#${q.id} savolni ko'rish`} onClick={() => onKor(q.id)} className="p-1 rounded text-matn-xira hover:text-brand cursor-pointer"><Eye size={13} /></button>
      </td>
    </tr>
  );
});
