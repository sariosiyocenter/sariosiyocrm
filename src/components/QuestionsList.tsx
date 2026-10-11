import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { Tugma, Yuklanmoqda, BoshHolat, Karta } from './imtihon/ui';
import { useBankDaraxt, fanniTop, BANK_YANGILANDI } from './imtihon/bank/useBankDaraxt';
import type { QoshRejim } from './imtihon/bank/QoshRejimi';
import SavolQoshish from './imtihon/bank/SavolQoshish';
import BankJadvali from './imtihon/bank/BankJadvali';
import BankSozlamalari from './imtihon/bank/BankSozlamalari';
import Andozalar from './imtihon/bank/Andozalar';

// Savollar banki — butun o'quv markaziga umumiy. Tepada uch bo'lim:
//   «Savollar banki» — ro'yxat (fan → bo'lim → mavzu → qiyinlik → filtrlar; ostida savollar);
//   «Sozlamalar» (?bolim=sozlama) — bankka oid hamma sozlama shu yerda (egasi, 2026-10-10:
//     «savollar bankiga oid sozlamalarni o'ziga qo'shish, andoza chapiga»);
//   «Andoza» (?bolim=andoza).
// «Statistika» ko'rinishi (?kor=tuzilma) olib tashlangan (egasi: «savollar bankiga statistika
// kerak emas») — eski havola shunchaki ro'yxatni ochadi; undagi boshqa joyda yo'q amallar
// (o'quv rejadan mavzular, mavzular tartibi, qiyinlikni natijaga moslash) — «Sozlamalar»da.
// Savol qo'lda yozilmaydi: "Savol qo'shish" — Word, Excel, PDF, rasm yoki matn.

type Bolim = 'bank' | 'sozlama' | 'andoza';

export default function QuestionsList() {
  const { ozgartira } = useCRM();
  const savolTahrir = ozgartira('imtihonlar.savollar');
  const [params, setParams] = useSearchParams();
  const { daraxt, xato, yangila } = useBankDaraxt();

  const BOLIMLAR: { v: Bolim; nom: string }[] = [
    { v: 'bank', nom: 'Savollar banki' },
    // Sozlamalar — bankni to'ldiradigan xodimga (hammasi o'zgartiruvchi amal).
    ...(savolTahrir ? [{ v: 'sozlama' as const, nom: 'Sozlamalar' }] : []),
    { v: 'andoza', nom: 'Andoza' },
  ];
  const bolim: Bolim = BOLIMLAR.find(b => b.v === params.get('bolim'))?.v || 'bank';
  const fan = fanniTop(daraxt, Number(params.get('fan')) || null);
  const ot =(patch: Record<string, number | string | null>) => setParams(p => {
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, String(v)); else p.delete(k); }
    return p;
  });

  const [qayta, setQayta] = useState(0);
  // «Savol qo'shish» oynasining yo'li: fayldan yoki bitta masalaga o'xshashini tuzish (AI).
  const [qoshRejim, setQoshRejim] = useState<QoshRejim>('fayl');
  // "Savol qo'shish" oynasi: ?qosh=1 ham ochadi (eski /questions/new havolalari).
  const qosh = params.get('qosh') === '1';
  // Oyna ochilgan paytda ro'yxatda tanlangan mavzu (nomi bilan: hozirgina yaratilgan mavzu daraxtda
  // hali bo'lmasligi mumkin). Undan qanday foydalanishni oynaning o'zi hal qiladi (SavolQoshish).
  const [qoshMavzu, setQoshMavzu] = useState<{ id: number; nom: string } | null>(null);
  // Bank ro'yxatida chapda tanlangan mavzu — tepadagi «Savol qo'shish» ham shuni uzatadi
  // (tugmaning o'zida mavzu nomi yozilmaydi — egasi, 2026-10-10).
  const [tanlov, setTanlov] = useState<{ id: number; nom: string } | null>(null);
  const qoshOch = (m: { id: number; nom: string } | null) => {
    setQoshMavzu(m);
    setQoshRejim('fayl');
    // Hozirgina yaratilgan mavzu daraxtda hali yo'q bo'lsa — yangilab qo'yamiz (oyna nomi bilan ishlayveradi).
    if (m && !daraxt?.fanlar.some(f => f.mavzular.some(x => x.id === m.id))) yangila();
    ot({ qosh: '1' });
  };
  // Hozirgina qo'shilgan savollar — bank ro'yxati ularga o'tadi ("yangi" belgisi bilan).
  const [yangi, setYangi] = useState<{ ids: number[]; n: number } | null>(null);

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
      {/* Bank bo'limlari: Savollar banki | Sozlamalar | Andoza */}
      <div className="bg-sirt border border-chiziq rounded-2xl shadow-sm px-3 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap self-start rounded-xl border border-chiziq bg-ichki p-0.5 gap-0.5" role="tablist" aria-label="Savollar banki bo'limlari">
          {BOLIMLAR.map(b => (
            <button key={b.v} role="tab" aria-selected={bolim === b.v} onClick={() => ot({ bolim: b.v === 'bank' ? null : b.v, kor: null, mavzu: null })}
              className={`px-3.5 py-1.5 rounded-[10px] text-[12.5px] font-bold cursor-pointer transition-colors ${bolim === b.v ? 'bg-brand text-brand-ust shadow-sm' : 'text-matn-sokin hover:text-matn'}`}>{b.nom}</button>
          ))}
        </div>
        {bolim === 'bank' && savolTahrir && (
          <Tugma kichik turi="asosiy" ikonka={<Plus size={14} />} className="shrink-0 self-start md:self-auto" onClick={() => qoshOch(tanlov)}>Savol qo'shish</Tugma>
        )}
      </div>

      {bolim === 'andoza' ? (
        <Andozalar daraxt={daraxt} />
      ) : bolim === 'sozlama' ? (
        <BankSozlamalari daraxt={daraxt} fanId={fan?.id ?? null} yangila={yangila} onRoyxat={() => ot({ bolim: null })} />
      ) : (
        <BankJadvali daraxt={daraxt} fanId={fan?.id ?? null} onFan={id => ot({ fan: id })} yangilaDaraxt={yangila} yangilash={qayta} yangi={yangi}
          onYangi={ids => setYangi({ ids, n: Date.now() })} onTanlov={setTanlov}
          onQosh={savolTahrir ? qoshOch : undefined} savolTahrir={savolTahrir} />
      )}

      {/* «Savol qo'shish» — bitta oyna, ikki yo'l: «Fayldan» (mavzu oldindan qo'yilmaydi) va «AI tuzadi»
          (ro'yxatda tanlangan mavzuga). Yo'l almashtirgichi oynaning o'zida (SavolQoshish). */}
      {qosh && savolTahrir && (
        <SavolQoshish daraxt={daraxt} fanId={fan?.id ?? null} mavzuId={qoshMavzu?.id ?? null} mavzuNomi={qoshMavzu?.nom} boshRejim={qoshRejim}
          onYop={() => ot({ qosh: null })} onSaqlandi={ids => { ozgardi(); if (ids.length) setYangi({ ids, n: Date.now() }); }} />
      )}
    </div>
  );
}
