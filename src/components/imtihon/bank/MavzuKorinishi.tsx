import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Search, TrendingUp, CheckSquare, X, Trash2 } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Karta, Tugma, Tanlov, INPUT, SELECT, Yuklanmoqda, Maydon } from '../ui';
import { oddiyMatn } from '../../../lib/matn';
import { SavolKartasi, SavolOynasi } from './SavolKartasi';
import { QIYINLIK, QiyinlikTanlov, qiyinlikDaraja, useQiyinlik } from './qiyinlik';
import type { BankDaraxt, BankFan, BankMavzu, Question, SavolTuri } from '../../../types';

// Bankning uchinchi qavati — mavzu: savollar qiyinlik bo'yicha uch ustunda
// (telefonda — uch tab). Kompyuterda kartani boshqa ustunga sudrab qiyinlikni
// o'zgartirish mumkin; ko'p savolni birdan — "Belgilash" bilan.

type TurFiltr = 'hammasi' | SavolTuri;

export default function MavzuKorinishi({ fan, mavzu, daraxt, yangila, onFan, onQosh }: {
  fan: BankFan; mavzu: BankMavzu; daraxt: BankDaraxt; yangila: () => Promise<any>;
  onFan: () => void; onQosh: () => void;
}) {
  const { ozgartira, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.savollar');
  const { soro } = useImtihonApi();
  const [savollar, setSavollar] = useState<Question[] | null>(null);
  const [tur, setTur] = useState<TurFiltr>('hammasi');
  const [qidiruv, setQidiruv] = useState('');
  const [arxiv, setArxiv] = useState(false);
  const [mobilD, setMobilD] = useState<1 | 2 | 3>(1);
  const [belgilash, setBelgilash] = useState(false);
  const [tanlangan, setTanlangan] = useState<Set<number>>(new Set());
  const [ochiq, setOchiq] = useState<Question | null>(null);
  const [tahrirOyna, setTahrirOyna] = useState(false);
  const [ustida, setUstida] = useState<number | null>(null);
  const [band, setBand] = useState(false);

  const yukla = useCallback(() => soro<{ items: Question[] }>('GET', `questions?mavzuId=${mavzu.id}&soni=200`)
    .then(r => setSavollar(r.items)).catch(e => showNotification(e.message, 'error')), [mavzu.id, soro, showNotification]);
  useEffect(() => { setSavollar(null); setTanlangan(new Set()); setBelgilash(false); yukla(); }, [yukla]);
  const ozgardi = () => { yukla(); yangila(); };

  const turlar = useMemo(() => [...new Set((savollar || []).map(q => q.type))], [savollar]);
  const korinadi = useMemo(() => {
    const k = qidiruv.trim().toLowerCase();
    return (savollar || []).filter(q =>
      (arxiv || q.status !== 'arxiv') && (tur === 'hammasi' || q.type === tur) &&
      (!k || oddiyMatn(q.text).toLowerCase().includes(k) || String(q.id) === k));
  }, [savollar, arxiv, tur, qidiruv]);
  const ustun = (d: number) => korinadi.filter(q => qiyinlikDaraja(q.difficulty).d === d);
  // Olib tashlangan daraja faqat unda savol qolgan bo'lsa ko'rinadi.
  useQiyinlik();
  const darajalar = QIYINLIK.filter(q => !q.yashirin || ustun(q.d).length > 0);
  const arxivSoni = (savollar || []).filter(q => q.status === 'arxiv').length;

  const ommaviy = async (ids: number[], patch: { difficulty?: number; status?: string; bankTopicId?: number }, xabar: string) => {
    if (!ids.length) return;
    setBand(true);
    try {
      const r = await soro<{ yangilandi: number; chala: number }>('PUT', 'questions/bulk', { ids, ...patch });
      showNotification(r.chala ? `${xabar} · ${r.chala} tasi chala — faol qilinmadi` : xabar, r.chala ? 'info' : 'success');
      setTanlangan(new Set());
      ozgardi();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const tushirish = (d: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setUstida(null);
    const id = Number(e.dataTransfer.getData('text/savol'));
    const q = savollar?.find(x => x.id === id);
    if (!q || qiyinlikDaraja(q.difficulty).d === d) return;
    setSavollar(l => (l || []).map(x => (x.id === id ? { ...x, difficulty: d } : x)));
    ommaviy([id], { difficulty: d }, `#${id} — ${qiyinlikDaraja(d).nom.toLowerCase()}`);
  };

  const moslash = async () => {
    setBand(true);
    try {
      const r = await soro<{ ozgardi: number }>('POST', 'bank/kalibrla', { topicId: mavzu.id });
      showNotification(`${r.ozgardi} ta savolning qiyinligi imtihon natijasiga moslandi`, 'success');
      ozgardi();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const belgi = (id: number) => setTanlangan(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const kartalar = (royxat: Question[]) => royxat.map(q => (
    <SavolKartasi key={q.id} q={q} onOch={() => setOchiq(q)} sudrash={tahrir} tanlash={belgilash} tanlangan={tanlangan.has(q.id)} onTanla={() => belgi(q.id)} />
  ));

  return (
    <div className="space-y-4 pb-16">
      <Karta>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-matn truncate">{mavzu.name}</h2>
              {tahrir && <button aria-label="Mavzuni tahrirlash" onClick={() => setTahrirOyna(true)} className="p-1.5 rounded-lg text-matn-xira hover:text-brand hover:bg-ichki cursor-pointer"><Pencil size={14} /></button>}
            </div>
            <p className="text-[12.5px] text-matn-xira mt-1">
              <button onClick={onFan} className="hover:text-brand cursor-pointer">{fan.name}</button>
              {mavzu.section ? ` · ${mavzu.section}` : ''} · {mavzu.jami - mavzu.arxiv} ta savol
              {mavzu.natija !== null ? ` · o'rtacha natija ${mavzu.natija}%` : ''}
            </p>
            {tahrir && mavzu.moslash > 0 && (
              <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 rounded-xl bg-ogoh-fon border border-ogoh/25 px-3 py-2 text-[12.5px] text-matn">
                <TrendingUp size={14} className="text-ogoh" />
                {mavzu.moslash} ta savolning qiyinligi imtihon natijasiga mos emas
                <Tugma kichik yuklanmoqda={band} onClick={moslash}>Natijaga moslash</Tugma>
              </div>
            )}
          </div>
          {tahrir && (
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {!!savollar?.length && <Tugma kichik turi={belgilash ? 'ikkinchi' : 'oddiy'} ikonka={belgilash ? <X size={14} /> : <CheckSquare size={14} />}
                onClick={() => { setBelgilash(v => !v); setTanlangan(new Set()); }}>{belgilash ? 'Belgilashni tugatish' : 'Belgilash'}</Tugma>}
            </div>
          )}
        </div>
      </Karta>

      {!!savollar?.length && (
        <div className="flex flex-wrap items-center gap-2">
          {turlar.length > 1 && (
            <Tanlov kichik qiymat={tur} onChange={setTur} variantlar={[
              { v: 'hammasi', nom: 'Hammasi' },
              ...(['yopiq', 'raqamli', 'moslash', 'yozma'] as SavolTuri[]).filter(t => turlar.includes(t)).map(t => ({ v: t, nom: { yopiq: 'Yopiq', raqamli: 'Raqamli', moslash: 'Moslash', yozma: 'Yozma' }[t] })),
            ]} />
          )}
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
            <input className={`${INPUT} pl-8 py-2`} placeholder="Shu mavzudan qidirish" aria-label="Mavzudan qidirish" value={qidiruv} onChange={e => setQidiruv(e.target.value)} />
          </div>
          {arxivSoni > 0 && (
            <label className="inline-flex items-center gap-2 text-[12.5px] text-matn-sokin cursor-pointer">
              <input type="checkbox" checked={arxiv} onChange={e => setArxiv(e.target.checked)} className="accent-[var(--color-brand)]" /> Arxivdagilar ({arxivSoni})
            </label>
          )}
        </div>
      )}

      {!savollar ? <Yuklanmoqda /> : (
        <>
          {/* Telefonda: bitta ustun, qiyinlik — tab. */}
          <div className="md:hidden space-y-3">
            <Tanlov qiymat={mobilD} onChange={setMobilD} variantlar={darajalar.map(q => ({
              v: q.d, nom: <span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${q.nuqta}`} />{q.nom} <span className="raqam text-matn-xira">{ustun(q.d).length}</span></span>,
            }))} />
            <div className="space-y-2">
              {kartalar(ustun(mobilD))}
              {!ustun(mobilD).length && <BoshUstun d={mobilD} />}
            </div>
          </div>
          {/* Kompyuterda: uch ustun, karta boshqa ustunga sudraladi. */}
          <div className="hidden md:grid gap-3 items-start" style={{ gridTemplateColumns: `repeat(${darajalar.length}, minmax(0, 1fr))` }}>
            {darajalar.map(q => {
              const royxat = ustun(q.d);
              return (
                <section key={q.d} aria-label={`${q.nom} savollar`}
                  onDragOver={e => { if (tahrir) { e.preventDefault(); setUstida(q.d); } }} onDragLeave={() => setUstida(v => (v === q.d ? null : v))} onDrop={tushirish(q.d)}
                  className={`rounded-2xl border bg-ichki/50 p-2 space-y-2 min-h-[160px] transition-colors ${ustida === q.d ? `${q.chiziq} ${q.fon}` : 'border-chiziq'}`}>
                  <div className="flex items-center justify-between gap-2 px-1.5 pt-1">
                    <span className={`inline-flex items-center gap-1.5 text-[13px] font-bold ${q.matn}`}><span className={`w-2.5 h-2.5 rounded-full ${q.nuqta}`} />{q.nom}<span className="raqam text-matn-xira font-semibold">{royxat.length}</span></span>
                  </div>
                  {kartalar(royxat)}
                  {!royxat.length && <BoshUstun d={q.d} />}
                </section>
              );
            })}
          </div>
          {tahrir && !savollar.length && (
            <div className="text-center space-y-2 py-2">
              <p className="text-[12.5px] text-matn-xira">Kitob yoki test sahifasini suratga oling yoki PDF, Excel yuklang — AI savollarni o'qib, qiyinlikka ajratadi va shu mavzuga qo'shadi.</p>
              <Tugma turi="asosiy" ikonka={<Plus size={14} />} onClick={onQosh}>Savol qo'shish</Tugma>
            </div>
          )}
        </>
      )}

      {belgilash && tanlangan.size > 0 && (
        <div className="fixed bottom-4 inset-x-3 z-40 mx-auto max-w-3xl rounded-2xl border border-chiziq bg-sirt shadow-2xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-matn mr-1">{tanlangan.size} ta savol:</span>
          <QiyinlikTanlov kichik qiymat={0} onChange={d => ommaviy([...tanlangan], { difficulty: d }, `${tanlangan.size} ta savol — ${qiyinlikDaraja(d).nom.toLowerCase()}`)} />
          <select aria-label="Mavzuga ko'chirish" className={`${SELECT} py-1.5 w-auto text-[12.5px]`} value="" disabled={band}
            onChange={e => e.target.value && ommaviy([...tanlangan], { bankTopicId: Number(e.target.value) }, `${tanlangan.size} ta savol ko'chirildi`)}>
            <option value="">Mavzuga ko'chirish…</option>
            {daraxt.fanlar.map(f => <optgroup key={f.id} label={f.name}>{f.mavzular.filter(m => m.id !== mavzu.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>)}
          </select>
          <select aria-label="Holatini o'zgartirish" className={`${SELECT} py-1.5 w-auto text-[12.5px]`} value="" disabled={band}
            onChange={e => e.target.value && ommaviy([...tanlangan], { status: e.target.value }, `${tanlangan.size} ta savolning holati o'zgardi`)}>
            <option value="">Holati…</option><option value="faol">Faol</option><option value="qoralama">Qoralama</option><option value="arxiv">Arxiv</option>
          </select>
          <Tugma kichik turi="oddiy" className="ml-auto" onClick={() => setTanlangan(new Set())}>Tozalash</Tugma>
        </div>
      )}

      {ochiq && <SavolOynasi q={ochiq} daraxt={daraxt} onYop={() => setOchiq(null)} onOzgardi={ozgardi} />}
      {tahrirOyna && <MavzuTahriri fan={fan} mavzu={mavzu} daraxt={daraxt} onYop={() => setTahrirOyna(false)} onSaqlandi={async (ochdi) => { setTahrirOyna(false); await yangila(); if (ochdi) onFan(); }} />}
    </div>
  );
}

function BoshUstun({ d }: { d: number }) {
  return (
    <div className="rounded-xl border border-dashed border-chiziq px-3 py-6 text-center text-[12px] text-matn-xira">
      {qiyinlikDaraja(d).nom} savol yo'q
    </div>
  );
}

/** Mavzuni tahrirlash: nomi, bo'limi, fani; o'chirish (savollari boshqa mavzuga ko'chadi). */
function MavzuTahriri({ fan, mavzu, daraxt, onYop, onSaqlandi }: {
  fan: BankFan; mavzu: BankMavzu; daraxt: BankDaraxt; onYop: () => void; onSaqlandi: (ochirildi: boolean) => void;
}) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const [nom, setNom] = useState(mavzu.name);
  const [bolim, setBolim] = useState(mavzu.section || '');
  const [fanId, setFanId] = useState(fan.id);
  const [kochir, setKochir] = useState<number | ''>('');
  const [band, setBand] = useState(false);
  const bolimlar = [...new Set(fan.mavzular.map(m => (m.section || '').trim()).filter(Boolean))];
  const savolSoni = mavzu.jami;

  const saqla = async () => {
    setBand(true);
    try {
      await soro('PUT', `bank/mavzular/${mavzu.id}`, { name: nom, section: bolim, subjectId: fanId });
      showNotification('Mavzu saqlandi', 'success');
      onSaqlandi(false);
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };
  const ochir = async () => {
    if (savolSoni && !kochir) return showNotification("Savollar qaysi mavzuga ko'chishini tanlang", 'error');
    if (!(await confirm(savolSoni ? `«${mavzu.name}» o'chiriladi, ${savolSoni} ta savoli tanlangan mavzuga ko'chadi. Davom etilsinmi?` : `«${mavzu.name}» o'chirilsinmi?`))) return;
    setBand(true);
    try {
      await soro('DELETE', `bank/mavzular/${mavzu.id}${savolSoni ? `?kochir=${kochir}` : ''}`);
      showNotification("Mavzu o'chirildi", 'info');
      onSaqlandi(true);
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-start sm:items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label="Mavzuni tahrirlash">
      <div className="fixed inset-0 bg-black/50" onClick={onYop} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-md border border-chiziq">
        <div className="flex items-center justify-between px-5 py-4 border-b border-chiziq">
          <h3 className="text-[14px] font-bold text-matn">Mavzu</h3>
          <button aria-label="Yopish" onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <Maydon nom="Nomi"><input className={INPUT} value={nom} onChange={e => setNom(e.target.value)} /></Maydon>
          <Maydon nom="Bo'lim" izoh="Mavzular ro'yxatida guruh sarlavhasi (masalan: Algebra)">
            <input className={INPUT} list="mavzu-bolimlar" value={bolim} onChange={e => setBolim(e.target.value)} placeholder="—" />
            <datalist id="mavzu-bolimlar">{bolimlar.map(b => <option key={b} value={b} />)}</datalist>
          </Maydon>
          <Maydon nom="Fan">
            <select className={SELECT} value={fanId} onChange={e => setFanId(Number(e.target.value))}>
              {daraxt.fanlar.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Maydon>
          <div className="rounded-xl border border-xato-chiziq p-3 space-y-2">
            <p className="text-[12.5px] font-semibold text-xato">Mavzuni o'chirish</p>
            {savolSoni > 0 && (
              <select aria-label="Savollar qaysi mavzuga ko'chadi" className={SELECT} value={kochir} onChange={e => setKochir(e.target.value ? Number(e.target.value) : '')}>
                <option value="">{savolSoni} ta savol qaysi mavzuga ko'chsin?</option>
                {daraxt.fanlar.map(f => <optgroup key={f.id} label={f.name}>{f.mavzular.filter(m => m.id !== mavzu.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>)}
              </select>
            )}
            <Tugma kichik turi="xavfli" ikonka={<Trash2 size={13} />} disabled={band} onClick={ochir}>O'chirish</Tugma>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-chiziq">
          <Tugma onClick={onYop}>Bekor</Tugma>
          <Tugma turi="asosiy" yuklanmoqda={band} disabled={!nom.trim()} onClick={saqla}>Saqlash</Tugma>
        </div>
      </div>
    </div>
  );
}
