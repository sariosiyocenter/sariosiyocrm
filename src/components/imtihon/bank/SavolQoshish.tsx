import React, { useState } from 'react';
import SavolYuklash from './SavolYuklash';
import AiTuzish from './AiTuzish';
import type { QoshRejim } from './QoshRejimi';
import type { BankDaraxt } from '../../../types';

// «Savol qo'shish» oynasi — ikki yo'l (egasi, 2026-10-10):
//   «Fayldan»   — rasm, PDF, Word yoki Excel; fayl turi har doim tanlanadi (4 variantli, MS-33-35,
//                 MS-36-45, yozma). Mavzu oldindan qo'yilmaydi: AI ajratadi yoki «Noma'lum»;
//   «AI tuzadi» — mavzu bo'yicha (bank ro'yxatida tanlangan mavzu oldindan qo'yiladi); namuna
//                 (masala matni yoki rasmi) berilsa — shunga o'xshatib.
// Savol qo'lda kiritilmaydi. Yo'l almashtirgichi shu yerda yashaydi — sahifa bitta komponentni ochadi.

interface SavolQoshishProps {
  daraxt: BankDaraxt;
  fanId?: number | null;
  /** Bank ro'yxatida tanlangan mavzu — faqat «AI tuzadi» yo'liga beriladi. */
  mavzuId?: number | null;
  /** `mavzuId` ning nomi — mavzu hozirgina yaratilgan bo'lib, daraxtda hali ko'rinmasa. */
  mavzuNomi?: string;
  /** Qaysi yo'l bilan ochilsin (standart — «Fayldan»). */
  boshRejim?: QoshRejim;
  onYop: () => void;
  /** Bankka qo'shilgan yangi savollar (ro'yxat ularni «yangi» qilib ko'rsatadi). */
  onSaqlandi: (ids: number[]) => void;
}

export default function SavolQoshish({ daraxt, fanId = null, mavzuId = null, mavzuNomi, boshRejim = 'fayl', onYop, onSaqlandi }: SavolQoshishProps) {
  const [rejim, setRejim] = useState<QoshRejim>(boshRejim);
  // Fan — bank ro'yxatidagisi; faqat mavzu ma'lum bo'lsa — o'sha mavzuning fani; hech biri bo'lmasa —
  // birinchi fan (bank ro'yxati ham fan tanlanmaganda birinchisini ko'rsatadi).
  const fan = fanId ?? daraxt.fanlar.find(f => f.mavzular.some(m => m.id === mavzuId))?.id ?? daraxt.fanlar[0]?.id ?? null;
  if (rejim === 'ai') {
    return <AiTuzish daraxt={daraxt} fanId={fan} mavzuId={mavzuId} mavzuNomi={mavzuNomi} onRejim={setRejim} onYop={onYop} onSaqlandi={onSaqlandi} />;
  }
  return <SavolYuklash daraxt={daraxt} fanId={fan} onRejim={setRejim} onYop={onYop} onSaqlandi={r => onSaqlandi(r?.ids || [])} />;
}
