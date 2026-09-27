import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search } from 'lucide-react';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, Tanlov, INPUT, SELECT, Yuklanmoqda } from '../ui';
import { oddiyMatn } from '../../../lib/matn';
import { SavolKartasi, SavolOynasi } from './SavolKartasi';
import { QIYINLIK, qiyinlikDaraja } from './qiyinlik';
import { bolimlarga } from './useBankDaraxt';
import type { BankDaraxt, BankFan, Question, SavolTuri } from '../../../types';

// Imtihonga aniq savollarni tanlash: fan → mavzu → qiyinlik bo'yicha. Tanlangan
// savollar har variantga tushadi. Bitta matnga bog'langan savollar birga tanlanadi.

export default function SavolTanlash({ fan, daraxt, tanlangan: bosh, onTanla, onYop }: {
  fan: BankFan; daraxt: BankDaraxt; tanlangan: number[]; onTanla: (ids: number[], turlar: Record<number, SavolTuri>) => void; onYop: () => void;
}) {
  const { soro } = useImtihonApi();
  const [mavzuId, setMavzuId] = useState<number | null>(() => fan.mavzular.find(m => m.faol > 0)?.id ?? fan.mavzular[0]?.id ?? null);
  const [savollar, setSavollar] = useState<Question[] | null>(null);
  const [d, setD] = useState<0 | 1 | 2 | 3>(0);
  const [qidiruv, setQidiruv] = useState('');
  const [tanlangan, setTanlangan] = useState<Set<number>>(() => new Set(bosh));
  const [mavzuBoyicha, setMavzuBoyicha] = useState<Map<number, number>>(new Map());
  const [korish, setKorish] = useState<Question | null>(null);
  // Yuklangan savollarning turi — tanlanganlar imtihonda turi bo'yicha qatorlarga bo'linadi.
  const turlar = useRef<Record<number, SavolTuri>>({});

  useEffect(() => {
    if (!mavzuId) { setSavollar([]); return; }
    setSavollar(null);
    soro<{ items: Question[] }>('GET', `questions?mavzuId=${mavzuId}&holat=faol&soni=200`)
      .then(r => { r.items.forEach(q => { turlar.current[q.id] = q.type; }); setSavollar(r.items); })
      .catch(() => setSavollar([]));
  }, [mavzuId, soro]);

  // Mavzular ro'yxatidagi "N ta tanlandi" — ochilgan mavzularning savollari bo'yicha.
  useEffect(() => {
    if (!savollar || !mavzuId) return;
    setMavzuBoyicha(m => new Map(m).set(mavzuId, savollar.filter(q => tanlangan.has(q.id)).length));
  }, [savollar, tanlangan, mavzuId]);

  const yaroqli = useMemo(() => (savollar || []).filter(q => !q.xato), [savollar]);
  const chala = (savollar?.length || 0) - yaroqli.length;
  const korinadi = useMemo(() => {
    const k = qidiruv.trim().toLowerCase();
    return yaroqli.filter(q => (!d || qiyinlikDaraja(q.difficulty).d === d) && (!k || oddiyMatn(q.text).toLowerCase().includes(k)));
  }, [yaroqli, d, qidiruv]);

  const almashtir = (q: Question) => setTanlangan(s => {
    const n = new Set(s);
    const guruh = q.passageId ? yaroqli.filter(x => x.passageId === q.passageId) : [q];
    const olib = n.has(q.id);
    guruh.forEach(x => (olib ? n.delete(x.id) : n.add(x.id)));
    return n;
  });

  const soniD = (k: number) => yaroqli.filter(q => qiyinlikDaraja(q.difficulty).d === k).length;

  return (
    <div className="fixed inset-0 z-[260] flex items-stretch sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Savollarni tanlash">
      <div className="fixed inset-0 bg-black/50" onClick={onYop} />
      <div className="relative bg-sirt sm:rounded-2xl shadow-2xl w-full max-w-5xl border border-chiziq flex flex-col h-full sm:h-[86vh]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-chiziq shrink-0">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn">Savollarni tanlash — {fan.name}</h3>
            <p className="text-[12px] text-matn-xira">Tanlangan savollar har variantga tushadi (tartibi aralashadi)</p>
          </div>
          <button aria-label="Yopish" onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Mavzular */}
          <div className="md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-chiziq md:overflow-y-auto">
            <div className="md:hidden p-3">
              <select aria-label="Mavzu" className={SELECT} value={mavzuId ?? ''} onChange={e => setMavzuId(Number(e.target.value) || null)}>
                {fan.mavzular.map(m => <option key={m.id} value={m.id}>{m.name} ({m.faol})</option>)}
              </select>
            </div>
            <ul className="hidden md:block py-2">
              {bolimlarga(fan.mavzular).map(g => (
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

          {/* Savollar */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-chiziq shrink-0">
              <Tanlov kichik qiymat={d} onChange={setD} variantlar={[
                { v: 0, nom: `Hammasi ${yaroqli.length}` },
                ...QIYINLIK.map(q => ({ v: q.d, nom: <span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${q.nuqta}`} />{q.nom} <span className="raqam text-matn-xira">{soniD(q.d)}</span></span> })),
              ]} />
              <div className="relative flex-1 min-w-40">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
                <input className={`${INPUT} pl-8 py-1.5`} placeholder="Qidirish" aria-label="Savol qidirish" value={qidiruv} onChange={e => setQidiruv(e.target.value)} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!savollar ? <Yuklanmoqda /> : !korinadi.length ? (
                <p className="text-center text-[12.5px] text-matn-xira py-10">{yaroqli.length ? 'Filtrga mos savol yo\'q' : "Bu mavzuda imtihonga tayyor (faol) savol yo'q"}</p>
              ) : korinadi.map(q => (
                <div key={q.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0"><SavolKartasi q={q} onOch={() => setKorish(q)} tanlash tanlangan={tanlangan.has(q.id)} onTanla={() => almashtir(q)} /></div>
                  <button onClick={() => setKorish(q)} className="mt-2 text-[11.5px] text-matn-xira hover:text-brand cursor-pointer shrink-0">Ko'rish</button>
                </div>
              ))}
              {chala > 0 && <p className="text-[11.5px] text-matn-xira text-center">{chala} ta chala savol ko'rsatilmadi (bankda to'ldirilgach tanlash mumkin)</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-chiziq shrink-0">
          <span className="text-[13px] text-matn"><b className="raqam">{tanlangan.size}</b> ta savol tanlandi</span>
          <div className="flex gap-2">
            <Tugma onClick={onYop}>Bekor</Tugma>
            <Tugma turi="asosiy" onClick={() => onTanla([...tanlangan], turlar.current)}>Tanlash</Tugma>
          </div>
        </div>
      </div>
      {korish && <SavolOynasi q={korish} daraxt={daraxt} onYop={() => setKorish(null)} onOzgardi={() => {}} />}
    </div>
  );
}
