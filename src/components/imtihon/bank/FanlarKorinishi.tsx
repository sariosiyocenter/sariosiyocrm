import React, { useState } from 'react';
import { Plus, ChevronRight, BookOpen, AlertTriangle, TrendingUp } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, BoshHolat, INPUT } from '../ui';
import { QiyinlikChizigi, QiyinlikYorligi } from './qiyinlik';
import type { BankDaraxt } from '../../../types';

// Bankning birinchi qavati — fanlar. Har kartada: savollar va mavzular soni,
// qiyinlik bo'yicha taqsimoti, e'tibor kerak bo'lganlar (qoralama, chala).

export default function FanlarKorinishi({ daraxt, onFan, yangila, onYangiSavol }: {
  daraxt: BankDaraxt; onFan: (id: number) => void; yangila: () => Promise<any>; onYangiSavol?: () => void;
}) {
  const { ozgartira, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.savollar');
  const { soro } = useImtihonApi();
  const [yangiFan, setYangiFan] = useState<string | null>(null);
  const [band, setBand] = useState(false);

  const fanQosh = async () => {
    if (!yangiFan?.trim()) return;
    setBand(true);
    try {
      const f = await soro<{ id: number; name: string }>('POST', 'bank/fanlar', { name: yangiFan });
      setYangiFan(null);
      await yangila();
      showNotification(`«${f.name}» fani qo'shildi — endi mavzularini kiriting`, 'success');
      onFan(f.id);
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const mavzuSoni = daraxt.fanlar.reduce((a, f) => a + f.mavzular.length, 0);
  const jamiQiyinlik = daraxt.fanlar.reduce((a, f) => [a[0] + f.qiyinlik[0], a[1] + f.qiyinlik[1], a[2] + f.qiyinlik[2]] as [number, number, number], [0, 0, 0] as [number, number, number]);

  if (!daraxt.fanlar.length && yangiFan === null) {
    return (
      <div className="bg-sirt border border-chiziq rounded-2xl shadow-sm">
        <BoshHolat ikonka={<BookOpen size={22} />} sarlavha="Bank hali bo'sh"
          izoh="Tuzilma: fan → mavzu → qiyinlik (oson, o'rta, qiyin). Avval fanni qo'shing, mavzularini o'quv rejadan bir bosishda oling, keyin har mavzuga savollar kiriting — qo'lda, Excel yoki AI bilan.">
          {tahrir && <Tugma turi="asosiy" ikonka={<Plus size={14} />} onClick={() => setYangiFan('')}>Fan qo'shish</Tugma>}
          {tahrir && onYangiSavol && <Tugma ikonka={<Plus size={14} />} onClick={onYangiSavol}>Savol qo'shish</Tugma>}
        </BoshHolat>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[12.5px] text-matn-sokin">
        <span><b className="text-matn raqam">{daraxt.jami}</b> ta savol</span>
        <span><b className="text-matn raqam">{daraxt.fanlar.length}</b> ta fan</span>
        <span><b className="text-matn raqam">{mavzuSoni}</b> ta mavzu</span>
        <span className="flex flex-wrap gap-1.5">{jamiQiyinlik.map((n, i) => <QiyinlikYorligi key={i} d={i + 1} soni={n} xira={!n} />)}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {daraxt.fanlar.map(f => (
          <button key={f.id} type="button" onClick={() => onFan(f.id)}
            className="text-left bg-sirt border border-chiziq rounded-2xl shadow-sm p-4 hover:border-brand/40 hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[14.5px] font-bold text-matn truncate">{f.name}</p>
                <p className="text-[12px] text-matn-xira mt-0.5">{f.jami - f.arxiv} ta savol · {f.mavzular.length} ta mavzu</p>
              </div>
              <ChevronRight size={18} className="text-matn-xira group-hover:text-brand shrink-0 mt-0.5" />
            </div>
            <QiyinlikChizigi soni={f.qiyinlik} className="h-2 mt-3" />
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {f.qiyinlik.map((n, i) => <QiyinlikYorligi key={i} d={i + 1} soni={n} xira={!n} />)}
            </div>
            {(f.qoralama > 0 || f.xatoli > 0 || f.natija !== null || f.moslash > 0) && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[11.5px]">
                {f.natija !== null && <span className="text-matn-sokin">o'rtacha natija <b className="raqam">{f.natija}%</b></span>}
                {f.qoralama > 0 && <span className="text-ogoh">{f.qoralama} ta qoralama</span>}
                {f.xatoli > 0 && <span className="text-xato inline-flex items-center gap-1"><AlertTriangle size={11} />{f.xatoli} ta chala</span>}
                {f.moslash > 0 && <span className="text-ogoh inline-flex items-center gap-1"><TrendingUp size={11} />{f.moslash} tasining qiyinligi natijaga mos emas</span>}
              </div>
            )}
          </button>
        ))}
        {tahrir && (yangiFan === null ? (
          <button type="button" onClick={() => setYangiFan('')}
            className="rounded-2xl border-2 border-dashed border-chiziq hover:border-brand hover:bg-brand-fon/30 text-matn-sokin hover:text-brand p-4 min-h-[128px] flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors">
            <Plus size={20} /><span className="text-[13px] font-semibold">Fan qo'shish</span>
          </button>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-brand bg-sirt p-4 space-y-2">
            <p className="text-[12.5px] font-semibold text-matn">Yangi fan</p>
            <input autoFocus className={INPUT} value={yangiFan} placeholder="Masalan: Matematika" aria-label="Fan nomi"
              onChange={e => setYangiFan(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') fanQosh(); if (e.key === 'Escape') setYangiFan(null); }} />
            <div className="flex justify-end gap-2">
              <Tugma kichik turi="oddiy" onClick={() => setYangiFan(null)}>Bekor</Tugma>
              <Tugma kichik turi="asosiy" yuklanmoqda={band} disabled={!yangiFan.trim()} onClick={fanQosh}>Qo'shish</Tugma>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
