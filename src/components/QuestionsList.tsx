import React, { useEffect, useState } from 'react';
import { Search, Plus, X, ChevronRight, Copy, ArrowLeft, FolderTree } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { useImtihonApi } from './imtihon/useImtihonApi';
import { Tugma, INPUT, Yuklanmoqda, BoshHolat, Karta } from './imtihon/ui';
import { useBankDaraxt, fanniTop, mavzuniTop, BANK_YANGILANDI } from './imtihon/bank/useBankDaraxt';
import FanlarKorinishi from './imtihon/bank/FanlarKorinishi';
import FanKorinishi from './imtihon/bank/FanKorinishi';
import MavzuKorinishi from './imtihon/bank/MavzuKorinishi';
import OxshashSavollar from './imtihon/bank/OxshashSavollar';
import SavolYuklash from './imtihon/bank/SavolYuklash';
import BankJadvali from './imtihon/bank/BankJadvali';
import Andozalar from './imtihon/bank/Andozalar';
import { SavolKartasi, SavolOynasi } from './imtihon/bank/SavolKartasi';
import type { Question } from '../types';

// Savollar banki — butun o'quv markaziga umumiy. Markaz Addmen OMR dasturiga
// o'rgangan (egasi, 2026-10-01: "ko'p joyi o'xshasin"), shuning uchun tepada
// Addmen'dagidek ikki bo'lim: "Savollar banki" (filtr ustunlari + ro'yxat +
// amallar paneli) va "Andoza" (Blueprint). Fan → mavzu tuzilmasi (mavzular,
// o'quv rejadan import, qiyinlik ustunlari) — "Tuzilma" ko'rinishida (?kor=tuzilma).
// Savol qo'lda yozilmaydi: "Savol qo'shish" — Word, Excel, PDF, rasm yoki matn.

export default function QuestionsList() {
  const { ozgartira } = useCRM();
  const savolTahrir = ozgartira('imtihonlar.savollar');
  const { soro } = useImtihonApi();
  const [params, setParams] = useSearchParams();
  const { daraxt, xato, yangila } = useBankDaraxt();

  const bolim = params.get('bolim') === 'andoza' ? 'andoza' : 'bank';
  const tuzilma = params.get('kor') === 'tuzilma';
  const fan = fanniTop(daraxt, Number(params.get('fan')) || null);
  const mavzu = mavzuniTop(fan, Number(params.get('mavzu')) || null);
  const ot = (patch: Record<string, number | string | null>) => setParams(p => {
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, String(v)); else p.delete(k); }
    return p;
  });

  const [qidiruv, setQidiruv] = useState('');
  const [natijalar, setNatijalar] = useState<Question[] | null>(null);
  const [qayta, setQayta] = useState(0);
  const [ochiq, setOchiq] = useState<Question | null>(null);
  const [oxshash, setOxshash] = useState(false);
  // "Savol qo'shish" oynasi: ?qosh=1 ham ochadi (eski /questions/new havolalari).
  const qosh = params.get('qosh') === '1';
  const qoshOch = () => ot({ qosh: '1' });

  // Butun bankdan qidirish (tuzilmaning birinchi qavatida): yozish to'xtagach.
  useEffect(() => {
    const k = qidiruv.trim();
    if (k.length < 2) { setNatijalar(null); return; }
    const t = setTimeout(() => {
      soro<{ items: Question[] }>('GET', `questions?qidiruv=${encodeURIComponent(k)}&soni=40`).then(r => setNatijalar(r.items)).catch(() => setNatijalar([]));
    }, 350);
    return () => clearTimeout(t);
  }, [qidiruv, qayta, soro]);

  const ozgardi = () => { yangila(); setQayta(n => n + 1); };

  // Zukko orqali bankka savol qo'shilsa — ochiq ro'yxat ham yangilanadi.
  useEffect(() => {
    const f = () => { yangila(); setQayta(n => n + 1); };
    window.addEventListener(BANK_YANGILANDI, f);
    return () => window.removeEventListener(BANK_YANGILANDI, f);
  }, [yangila]);

  if (xato) return <Karta><BoshHolat sarlavha="Bank ochilmadi" izoh={xato}><Tugma onClick={() => yangila()}>Qayta urinish</Tugma></BoshHolat></Karta>;
  if (!daraxt) return <Yuklanmoqda />;

  return (
    <div className="space-y-3">
      {/* Addmen'dagi ikki bo'lim: Savollar banki | Andoza (Blueprint) */}
      <div className="bg-sirt border border-chiziq rounded-2xl shadow-sm px-3 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="inline-flex rounded-xl border border-chiziq bg-ichki p-0.5 gap-0.5" role="tablist" aria-label="Savollar banki bo'limlari">
            {([['bank', 'Savollar banki'], ['andoza', 'Andoza (Blueprint)']] as const).map(([v, nom]) => (
              <button key={v} role="tab" aria-selected={bolim === v} onClick={() => ot({ bolim: v === 'andoza' ? 'andoza' : null, kor: null, mavzu: null })}
                className={`px-3.5 py-1.5 rounded-[10px] text-[12.5px] font-bold cursor-pointer transition-colors ${bolim === v ? 'bg-brand text-brand-ust shadow-sm' : 'text-matn-sokin hover:text-matn'}`}>{nom}</button>
            ))}
          </div>
          {bolim === 'bank' && tuzilma && (
            <nav aria-label="Tuzilma" className="flex flex-wrap items-center gap-1 text-[13px] min-w-0">
              <button onClick={() => ot({ kor: null, mavzu: null })} className="inline-flex items-center gap-1 font-semibold text-matn-sokin hover:text-brand cursor-pointer mr-1"><ArrowLeft size={14} /> Ro'yxat</button>
              <span className="text-matn-xira">|</span>
              <button onClick={() => ot({ fan: null, mavzu: null })} className={`font-bold cursor-pointer ${fan ? 'text-matn-sokin hover:text-brand' : 'text-matn'}`}>Tuzilma</button>
              {fan && <><ChevronRight size={14} className="text-matn-xira" /><button onClick={() => ot({ mavzu: null })} className={`font-bold truncate max-w-[30vw] cursor-pointer ${mavzu ? 'text-matn-sokin hover:text-brand' : 'text-matn'}`}>{fan.name}</button></>}
              {mavzu && <><ChevronRight size={14} className="text-matn-xira" /><span className="font-bold text-matn truncate max-w-[30vw]">{mavzu.name}</span></>}
            </nav>
          )}
        </div>
        {bolim === 'bank' && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {!tuzilma && <Tugma kichik turi="oddiy" ikonka={<FolderTree size={14} />} onClick={() => ot({ kor: 'tuzilma', mavzu: null })} title="Fanlar, bo'limlar va mavzular; o'quv rejadan import; qiyinlik ustunlari">Tuzilma</Tugma>}
            {savolTahrir && <Tugma kichik ikonka={<Copy size={14} />} onClick={() => setOxshash(true)} title="AI bitta masaladan sonlari va javobi boshqa masalalar tuzadi">O'xshash masala</Tugma>}
            {savolTahrir && <Tugma kichik turi="asosiy" ikonka={<Plus size={14} />} onClick={qoshOch}>Savol qo'shish</Tugma>}
          </div>
        )}
      </div>

      {bolim === 'andoza' ? (
        <Andozalar daraxt={daraxt} />
      ) : !tuzilma ? (
        <BankJadvali key={qayta} daraxt={daraxt} fanId={fan?.id ?? null} onFan={id => ot({ fan: id })} yangilaDaraxt={yangila}
          onQosh={savolTahrir ? qoshOch : undefined} onTuzilma={() => ot({ kor: 'tuzilma', mavzu: null })} savolTahrir={savolTahrir} />
      ) : (
        <>
          {!fan && (
            <div className="relative max-w-xl">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
              <input className={`${INPUT} pl-9`} placeholder="Butun bankdan qidirish (savol matni)" aria-label="Butun bankdan qidirish" value={qidiruv} onChange={e => setQidiruv(e.target.value)} />
              {qidiruv && <button aria-label="Tozalash" onClick={() => setQidiruv('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-matn-xira hover:text-matn cursor-pointer"><X size={14} /></button>}
            </div>
          )}
          {!fan && natijalar ? (
            <Karta sarlavha={`Qidiruv natijasi: ${natijalar.length}${natijalar.length === 40 ? '+' : ''}`}>
              {!natijalar.length ? <p className="text-[12.5px] text-matn-xira">Mos savol topilmadi</p> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {natijalar.map(q => (
                    <div key={q.id}>
                      <p className="text-[11px] text-matn-xira px-1 mb-0.5 truncate">{q.subject} › {q.topic}</p>
                      <SavolKartasi q={q} onOch={() => setOchiq(q)} />
                    </div>
                  ))}
                </div>
              )}
            </Karta>
          ) : !fan ? (
            <FanlarKorinishi daraxt={daraxt} onFan={id => ot({ fan: id, mavzu: null })} yangila={yangila} onQosh={savolTahrir ? qoshOch : undefined} />
          ) : !mavzu ? (
            <FanKorinishi fan={fan} onMavzu={id => ot({ mavzu: id })} onOrqaga={() => ot({ fan: null, mavzu: null })} yangila={yangila} onQosh={qoshOch} />
          ) : (
            <MavzuKorinishi key={`${mavzu.id}-${qayta}`} fan={fan} mavzu={mavzu} daraxt={daraxt} yangila={yangila} onFan={() => ot({ mavzu: null })} onQosh={qoshOch} />
          )}
        </>
      )}

      {ochiq && <SavolOynasi q={ochiq} daraxt={daraxt} onYop={() => setOchiq(null)} onOzgardi={ozgardi} />}
      {oxshash && <OxshashSavollar daraxt={daraxt} fanId={fan?.id ?? null} mavzuId={mavzu?.id ?? null} onYop={() => setOxshash(false)} onSaqlandi={ozgardi} />}
      {qosh && savolTahrir && <SavolYuklash daraxt={daraxt} fanId={fan?.id ?? null} mavzuId={mavzu?.id ?? null} onYop={() => ot({ qosh: null })} onSaqlandi={ozgardi} />}
    </div>
  );
}
