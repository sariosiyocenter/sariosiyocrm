import React, { useEffect, useState } from 'react';
import { X, Plus, LayoutList, AlertTriangle, Info } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi, ApiXato } from '../useImtihonApi';
import { Tugma, Yuklanmoqda } from '../ui';
import { AndozaMaydonlari, AndozaToliqligi } from './AndozaQismlari';
import { andozaQoidali, sonniOqi } from './andoza';
import type { Andoza } from '../../../types';

// Bank ro'yxatida belgilangan savollarni andozaga qo'shish: bor andoza tanlanadi yoki shu
// yerning o'zida yangisi yaratiladi (nomi + savollar soni). Guruhli savol butunligicha
// qo'shiladi, faol bo'lmagan va chala savollar qo'shilmaydi (server hal qiladi). Sig'masa —
// savollar soni bir bosishda oshiriladi. O'zi mustaqil oyna: faqat `ids` beriladi.

type Javob = Andoza & { qoshildi: number; borEdi: number; yaroqsiz: number };
type Sigmadi = { bosh: number; kerak: number; yangiSoni: number };

export default function AndozagaQoshish({ ids, onYop, onQoshildi }: { ids: number[]; onYop: () => void; onQoshildi?: () => void }) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [royxat, setRoyxat] = useState<Andoza[] | null>(null);
  const [tanlangan, setTanlangan] = useState<number | 'yangi' | null>(null);
  const [nom, setNom] = useState('');
  const [soni, setSoni] = useState(String(Math.max(ids.length, 30)));
  const [band, setBand] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [sigmadi, setSigmadi] = useState<Sigmadi | null>(null);

  useEffect(() => {
    soro<Andoza[]>('GET', 'bank/andozalar')
      .then(r => { setRoyxat(r); setTanlangan(x => x ?? (r.length ? null : 'yangi')); })
      .catch(e => { setRoyxat([]); setTanlangan('yangi'); setXato(e.message); });
  }, [soro]);

  const tanla = (v: number | 'yangi') => { setTanlangan(v); setSigmadi(null); setXato(null); };
  const andoza = typeof tanlangan === 'number' ? royxat?.find(a => a.id === tanlangan) || null : null;
  const yangiTayyor = !!nom.trim() && sonniOqi(soni) > 0;
  const tayyor = tanlangan === 'yangi' ? yangiTayyor : !!andoza;

  const qosh = async (kengaytir: boolean) => {
    if (!tayyor || band) return;
    setBand(true);
    setXato(null);
    try {
      // Yangi andoza: avval o'zi yaratiladi (savollar qo'shilmasa ham ro'yxatda qoladi — qayta bosilsa shunga qo'shiladi).
      let nishon = andoza;
      if (!nishon) {
        nishon = await soro<Andoza>('POST', 'bank/andozalar', { name: nom.trim(), soni: sonniOqi(soni) });
        setRoyxat(l => [nishon as Andoza, ...(l || [])]);
        setTanlangan(nishon.id);
      }
      const r = await soro<Javob>('POST', `bank/andozalar/${nishon.id}/savollar`, { ids, kengaytir });
      showNotification(`${r.qoshildi} ta savol «${r.name}» andozasiga qo'shildi (${r.savolSoni} / ${r.soni})${r.yaroqsiz ? ` · ${r.yaroqsiz} tasi qo'shilmadi (faol emas yoki chala)` : ''}`, 'success');
      onQoshildi?.();
      onYop();
    } catch (e: any) {
      if (e instanceof ApiXato && e.malumot?.sigmadi) setSigmadi({ bosh: e.malumot.bosh, kerak: e.malumot.kerak, yangiSoni: e.malumot.yangiSoni });
      else setXato(e.message);
    } finally {
      setBand(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Andozaga qo'shish">
      <div className="fixed inset-0 bg-black/50" onClick={() => !band && onYop()} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-lg border border-chiziq my-2">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-chiziq">
          <div>
            <h3 className="text-[14px] font-bold text-matn flex items-center gap-1.5"><LayoutList size={15} className="text-brand" /> Andozaga qo'shish</h3>
            <p className="text-[12px] text-matn-xira"><span className="raqam">{ids.length}</span> ta savol belgilangan — qaysi andozaga qo'shilsin?</p>
          </div>
          <button aria-label="Yopish" disabled={band} onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>

        <div className="p-3 space-y-2">
          {!royxat ? <Yuklanmoqda /> : (
            <>
              <div className={`rounded-xl border ${tanlangan === 'yangi' ? 'border-brand bg-brand-fon/40 dark:bg-brand/10' : 'border-chiziq'}`}>
                <button type="button" onClick={() => tanla('yangi')} aria-pressed={tanlangan === 'yangi'}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-matn cursor-pointer">
                  <Plus size={15} className="text-brand" /> Yangi andoza
                </button>
                {tanlangan === 'yangi' && (
                  <div className="px-3 pb-3">
                    <AndozaMaydonlari nom={nom} soni={soni} onNom={setNom} onSoni={setSoni} onEnter={() => qosh(false)} disabled={band} autoFocus />
                  </div>
                )}
              </div>
              {royxat.length > 0 && (
                <ul className="rounded-xl border border-chiziq divide-y divide-chiziq max-h-[42vh] overflow-y-auto" aria-label="Andozalar">
                  {royxat.map(a => {
                    const bosh = Math.max(0, a.soni - a.savolSoni);
                    return (
                      <li key={a.id}>
                        <button type="button" onClick={() => tanla(a.id)} aria-pressed={tanlangan === a.id}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer ${tanlangan === a.id ? 'bg-brand-fon dark:bg-brand/15' : 'hover:bg-ichki'}`}>
                          <span className={`w-4 h-4 shrink-0 rounded-full border-2 ${tanlangan === a.id ? 'border-brand bg-brand shadow-[inset_0_0_0_3px_var(--color-sirt)]' : 'border-chiziq-kuchli'}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold text-matn truncate">{a.name}</span>
                            <AndozaToliqligi a={a} className="mt-0.5" />
                          </span>
                          {!andozaQoidali(a) && <span className={`shrink-0 text-[11.5px] ${bosh ? 'text-matn-xira' : 'text-ogoh font-semibold'}`}>{bosh ? <>bo'sh: <span className="raqam">{bosh}</span></> : "to'lgan"}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {andoza && andozaQoidali(andoza) && !sigmadi && (
                <p className="flex items-start gap-2 rounded-xl bg-ichki px-3 py-2 text-[12px] text-matn-sokin">
                  <Info size={14} className="mt-0.5 shrink-0 text-brand" />
                  Bu andoza hozir qoidalar bilan ishlaydi (savollar bankdan tasodifiy olinadi). Savol qo'shilgach, qog'ozga faqat qo'shilgan savollar tushadi.
                </p>
              )}
              {sigmadi && (
                <p className="flex items-start gap-2 rounded-xl bg-ogoh-fon px-3 py-2 text-[12px] font-semibold text-ogoh">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  Andozada {sigmadi.bosh} ta bo'sh o'rin bor, qo'shilayotgan savollar — {sigmadi.kerak} ta. Savollar sonini {sigmadi.yangiSoni} ga oshirsangiz, hammasi sig'adi.
                </p>
              )}
              {xato && <p className="rounded-xl bg-xato-fon px-3 py-2 text-[12px] font-semibold text-xato">{xato}</p>}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 border-t border-chiziq">
          <Tugma onClick={onYop} disabled={band}>Bekor</Tugma>
          {sigmadi
            ? <Tugma turi="asosiy" yuklanmoqda={band} onClick={() => qosh(true)}>Sonni {sigmadi.yangiSoni} ga oshirib, qo'shish</Tugma>
            : <Tugma turi="asosiy" ikonka={<Plus size={14} />} yuklanmoqda={band} disabled={!tayyor} onClick={() => qosh(false)}>{tanlangan === 'yangi' ? "Yaratib, qo'shish" : "Qo'shish"}</Tugma>}
        </div>
      </div>
    </div>
  );
}
