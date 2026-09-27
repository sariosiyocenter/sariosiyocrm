import React, { useEffect, useRef, useState } from 'react';
import { Plus, ChevronRight, Pencil, Trash2, ListOrdered, ArrowUp, ArrowDown, BookMarked, AlertTriangle, TrendingUp, Check, X } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Karta, Tugma, INPUT } from '../ui';
import { QiyinlikChizigi, QiyinlikYorligi, QIYINLIK } from './qiyinlik';
import { bolimlarga } from './useBankDaraxt';
import type { BankFan, BankMavzu } from '../../../types';

// Bankning ikkinchi qavati — fan: mavzular ro'yxati (bo'limlar bo'yicha),
// har mavzuda oson / o'rta / qiyin savollar soni. Mavzular o'quv rejadan
// bir bosishda olinadi.

export default function FanKorinishi({ fan, onMavzu, onOrqaga, yangila, onYangiSavol }: {
  fan: BankFan; onMavzu: (id: number) => void; onOrqaga: () => void; yangila: () => Promise<any>; onYangiSavol: () => void;
}) {
  const { ozgartira, showNotification, syllabuses } = useCRM();
  const tahrir = ozgartira('imtihonlar.savollar');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const [nomTahrir, setNomTahrir] = useState<string | null>(null);
  const [yangiMavzu, setYangiMavzu] = useState<{ name: string; section: string } | null>(null);
  const [tartibRejimi, setTartibRejimi] = useState(false);
  const [tartib, setTartib] = useState<BankMavzu[]>(fan.mavzular);
  const [rejaMenyu, setRejaMenyu] = useState(false);
  const [band, setBand] = useState<string | null>(null);
  const menyuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTartib(fan.mavzular); }, [fan.mavzular]);
  useEffect(() => {
    if (!rejaMenyu) return;
    const yop = (e: MouseEvent) => { if (!menyuRef.current?.contains(e.target as Node)) setRejaMenyu(false); };
    document.addEventListener('mousedown', yop);
    return () => document.removeEventListener('mousedown', yop);
  }, [rejaMenyu]);

  const ish = async (nom: string, f: () => Promise<void>) => {
    setBand(nom);
    try { await f(); } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(null); }
  };

  const nomSaqla = () => ish('nom', async () => {
    if (!nomTahrir?.trim() || nomTahrir.trim() === fan.name) { setNomTahrir(null); return; }
    await soro('PUT', `bank/fanlar/${fan.id}`, { name: nomTahrir });
    setNomTahrir(null);
    await yangila();
    showNotification("Fan nomi o'zgardi — savollarda va tuzilayotgan imtihonlarda ham", 'success');
  });

  const fanOchir = async () => {
    if (!(await confirm(`«${fan.name}» fani o'chirilsinmi? Uning ${fan.mavzular.length} ta mavzusi ham o'chadi.`))) return;
    await ish('ochir', async () => {
      await soro('DELETE', `bank/fanlar/${fan.id}`);
      showNotification("Fan o'chirildi", 'info');
      await yangila();
      onOrqaga();
    });
  };

  const mavzuQosh = () => ish('mavzu', async () => {
    if (!yangiMavzu?.name.trim()) return;
    await soro('POST', 'bank/mavzular', { subjectId: fan.id, name: yangiMavzu.name, section: yangiMavzu.section });
    setYangiMavzu({ name: '', section: yangiMavzu.section });
    await yangila();
  });

  const rejadan = (syllabusId: number) => ish('reja', async () => {
    setRejaMenyu(false);
    const r = await soro<{ qoshildi: number; bor: number; reja: string }>('POST', 'bank/mavzular/oquv-reja', { subjectId: fan.id, syllabusId });
    await yangila();
    showNotification(r.qoshildi ? `«${r.reja}» dan ${r.qoshildi} ta mavzu qo'shildi${r.bor ? ` (${r.bor} tasi bor edi)` : ''}` : "Bu o'quv rejaning hamma mavzusi fanda bor", r.qoshildi ? 'success' : 'info');
  });

  const surish = (i: number, qadam: -1 | 1) => {
    const j = i + qadam;
    if (j < 0 || j >= tartib.length) return;
    const yangi = [...tartib];
    [yangi[i], yangi[j]] = [yangi[j], yangi[i]];
    setTartib(yangi);
  };
  const tartibSaqla = () => ish('tartib', async () => {
    await soro('POST', 'bank/mavzular/tartib', { ids: tartib.map(m => m.id) });
    setTartibRejimi(false);
    await yangila();
  });

  const rejalar = (syllabuses || []).filter(s => (s.topics?.length || 0) > 0);
  const bolimlar = [...new Set(fan.mavzular.map(m => (m.section || '').trim()).filter(Boolean))];
  const royxat = tartibRejimi ? tartib : fan.mavzular;

  return (
    <div className="space-y-4">
      <Karta>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {nomTahrir === null ? (
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-bold text-matn truncate">{fan.name}</h2>
                {tahrir && <button aria-label="Fan nomini o'zgartirish" onClick={() => setNomTahrir(fan.name)} className="p-1.5 rounded-lg text-matn-xira hover:text-brand hover:bg-ichki cursor-pointer"><Pencil size={14} /></button>}
              </div>
            ) : (
              <div className="flex items-center gap-2 max-w-md">
                <input autoFocus className={`${INPUT} py-1.5`} value={nomTahrir} aria-label="Fan nomi" onChange={e => setNomTahrir(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') nomSaqla(); if (e.key === 'Escape') setNomTahrir(null); }} />
                <Tugma kichik turi="asosiy" ikonka={<Check size={13} />} yuklanmoqda={band === 'nom'} onClick={nomSaqla} aria-label="Saqlash" />
                <Tugma kichik turi="oddiy" ikonka={<X size={13} />} onClick={() => setNomTahrir(null)} aria-label="Bekor" />
              </div>
            )}
            <p className="text-[12.5px] text-matn-xira mt-1">
              {fan.jami - fan.arxiv} ta savol · {fan.mavzular.length} ta mavzu{fan.natija !== null ? ` · o'rtacha natija ${fan.natija}%` : ''}{fan.arxiv ? ` · arxivda ${fan.arxiv}` : ''}
            </p>
            <div className="mt-3 max-w-xl space-y-2">
              <QiyinlikChizigi soni={fan.qiyinlik} className="h-2" />
              <div className="flex flex-wrap gap-1.5">{fan.qiyinlik.map((n, i) => <QiyinlikYorligi key={i} d={i + 1} soni={n} xira={!n} />)}</div>
            </div>
          </div>
          {tahrir && (
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Tugma kichik turi="asosiy" ikonka={<Plus size={14} />} onClick={onYangiSavol}>Savol</Tugma>
              <Tugma kichik ikonka={<Plus size={14} />} onClick={() => setYangiMavzu({ name: '', section: '' })}>Mavzu</Tugma>
              {rejalar.length > 0 && (
                <div className="relative" ref={menyuRef}>
                  <Tugma kichik ikonka={<BookMarked size={14} />} yuklanmoqda={band === 'reja'} onClick={() => setRejaMenyu(v => !v)} aria-expanded={rejaMenyu}>O'quv rejadan</Tugma>
                  {rejaMenyu && (
                    <div className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-chiziq bg-sirt shadow-lg p-1">
                      <p className="px-3 py-2 text-[11.5px] text-matn-xira">Mavzular (bo'limlari bilan) shu fanga qo'shiladi. Borlari takrorlanmaydi.</p>
                      {rejalar.map(s => (
                        <button key={s.id} onClick={() => rejadan(s.id)} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-[13px] text-matn hover:bg-ichki cursor-pointer">
                          <span className="truncate">{s.name}</span><span className="text-[11.5px] text-matn-xira shrink-0">{s.topics?.length} ta mavzu</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {fan.mavzular.length > 1 && !tartibRejimi && <Tugma kichik turi="oddiy" ikonka={<ListOrdered size={14} />} onClick={() => setTartibRejimi(true)}>Tartib</Tugma>}
              {fan.jami === 0 && <Tugma kichik turi="xavfli" ikonka={<Trash2 size={14} />} yuklanmoqda={band === 'ochir'} onClick={fanOchir} aria-label="Fanni o'chirish" />}
            </div>
          )}
        </div>
      </Karta>

      <Karta ichki="p-0" sarlavha="Mavzular" izoh={fan.mavzular.length ? 'Mavzuni oching — savollar qiyinlik bo\'yicha uch ustunda' : undefined}
        amallar={tartibRejimi && (
          <>
            <Tugma kichik turi="oddiy" onClick={() => { setTartib(fan.mavzular); setTartibRejimi(false); }}>Bekor</Tugma>
            <Tugma kichik turi="asosiy" yuklanmoqda={band === 'tartib'} onClick={tartibSaqla}>Tartibni saqlash</Tugma>
          </>
        )}>
        {!fan.mavzular.length && !yangiMavzu ? (
          <div className="px-4 pb-6 pt-2 text-center">
            <p className="text-[13px] font-semibold text-matn">Bu fanda hali mavzu yo'q</p>
            <p className="text-[12px] text-matn-xira mt-1 max-w-md mx-auto">Mavzularni o'quv rejadan oling (tepadagi «O'quv rejadan») yoki qo'lda qo'shing. Savol qo'shganda ham yangi mavzu yaratish mumkin.</p>
            {tahrir && <div className="mt-3 flex justify-center"><Tugma kichik ikonka={<Plus size={13} />} onClick={() => setYangiMavzu({ name: '', section: '' })}>Mavzu qo'shish</Tugma></div>}
          </div>
        ) : (
          <div className="mt-3">
            <div className="hidden md:grid grid-cols-[1fr_repeat(3,72px)_64px_72px_24px] gap-2 px-4 py-2 bg-ichki text-[11.5px] font-semibold text-matn-sokin">
              <span>Mavzu</span>
              {QIYINLIK.map(q => <span key={q.d} className={`text-center ${q.matn}`}>{q.nom}</span>)}
              <span className="text-center">Jami</span><span className="text-center">Natija</span><span />
            </div>
            <ul className="divide-y divide-chiziq">
              {bolimlarga(royxat).map(g => (
                <React.Fragment key={`${g.bolim}-${g.mavzular[0].id}`}>
                  {g.bolim && <li className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-matn-xira">{g.bolim}</li>}
                  {g.mavzular.map(m => {
                    const i = royxat.indexOf(m);
                    return (
                      <li key={m.id} className="flex items-center gap-1">
                        {tartibRejimi && (
                          <span className="flex flex-col pl-2">
                            <button aria-label="Yuqoriga" disabled={i === 0} onClick={() => surish(i, -1)} className="p-0.5 rounded text-matn-xira hover:text-brand disabled:opacity-30 cursor-pointer"><ArrowUp size={14} /></button>
                            <button aria-label="Pastga" disabled={i === royxat.length - 1} onClick={() => surish(i, 1)} className="p-0.5 rounded text-matn-xira hover:text-brand disabled:opacity-30 cursor-pointer"><ArrowDown size={14} /></button>
                          </span>
                        )}
                        <button type="button" disabled={tartibRejimi} onClick={() => onMavzu(m.id)}
                          className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1fr_repeat(3,72px)_64px_72px_24px] gap-2 items-center px-4 py-2.5 text-left hover:bg-ichki/60 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default">
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-semibold text-matn truncate">{m.name}</span>
                            <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                              {m.qoralama > 0 && <span className="text-ogoh">{m.qoralama} ta qoralama</span>}
                              {m.xatoli > 0 && <span className="text-xato inline-flex items-center gap-0.5"><AlertTriangle size={10} />{m.xatoli} ta chala</span>}
                              {m.moslash > 0 && <span className="text-ogoh inline-flex items-center gap-0.5"><TrendingUp size={10} />{m.moslash} ta qiyinlik natijaga mos emas</span>}
                            </span>
                            <span className="md:hidden flex flex-wrap gap-1 mt-1.5">{m.qiyinlik.map((n, k) => <QiyinlikYorligi key={k} d={k + 1} soni={n} xira={!n} />)}</span>
                          </span>
                          {m.qiyinlik.map((n, k) => (
                            <span key={k} className={`hidden md:block text-center text-[13px] font-semibold raqam ${n ? QIYINLIK[k].matn : 'text-matn-xira/60'}`}>{n || '—'}</span>
                          ))}
                          <span className="hidden md:block text-center text-[13px] font-bold text-matn raqam">{m.jami - m.arxiv}</span>
                          <span className="hidden md:block text-center text-[12.5px] text-matn-sokin raqam">{m.natija !== null ? `${m.natija}%` : '—'}</span>
                          <ChevronRight size={16} className="hidden md:block text-matn-xira" />
                        </button>
                      </li>
                    );
                  })}
                </React.Fragment>
              ))}
            </ul>
          </div>
        )}
        {yangiMavzu && (
          <div className="flex flex-col sm:flex-row gap-2 px-4 py-3 border-t border-chiziq bg-ichki/40">
            <input autoFocus className={`${INPUT} py-2 flex-1`} value={yangiMavzu.name} placeholder="Yangi mavzu nomi" aria-label="Mavzu nomi"
              onChange={e => setYangiMavzu({ ...yangiMavzu, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') mavzuQosh(); if (e.key === 'Escape') setYangiMavzu(null); }} />
            <input className={`${INPUT} py-2 sm:w-48`} list={`bolimlar-${fan.id}`} value={yangiMavzu.section} placeholder="Bo'lim (ixtiyoriy)" aria-label="Bo'lim"
              onChange={e => setYangiMavzu({ ...yangiMavzu, section: e.target.value })} />
            <datalist id={`bolimlar-${fan.id}`}>{bolimlar.map(b => <option key={b} value={b} />)}</datalist>
            <div className="flex gap-2">
              <Tugma kichik turi="asosiy" yuklanmoqda={band === 'mavzu'} disabled={!yangiMavzu.name.trim()} onClick={mavzuQosh}>Qo'shish</Tugma>
              <Tugma kichik turi="oddiy" onClick={() => setYangiMavzu(null)}>Yopish</Tugma>
            </div>
          </div>
        )}
      </Karta>
    </div>
  );
}
