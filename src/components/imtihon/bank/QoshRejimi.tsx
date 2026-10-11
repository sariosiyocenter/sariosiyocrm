import React from 'react';

/**
 * «Savol qo'shish» oynasining yo'llari (egasi, 2026-10-10): fayldan (fayl turi tanlanadi: 4 variantli,
 * MS-33-35, MS-36-45, yozma) yoki AI tuzadi (mavzu bo'yicha; namuna berilsa — shunga o'xshatib).
 * Qo'lda kiritish yo'li yo'q.
 */
export type QoshRejim = 'fayl' | 'ai';

const YOLLAR: { v: QoshRejim; nom: string }[] = [
  { v: 'fayl', nom: 'Fayldan' },
  { v: 'ai', nom: 'AI tuzadi' },
];

interface QoshRejimiProps {
  rejim: QoshRejim;
  onRejim: (rejim: QoshRejim) => void;
  band?: boolean;
}

/** Oyna sarlavhasidagi almashtirgich — ikkala oynada bir xil ko'rinadi. */
export default function QoshRejimi({ rejim, onRejim, band }: QoshRejimiProps) {
  return (
    <div className="mt-2 inline-flex flex-wrap rounded-xl border border-chiziq bg-ichki p-0.5 gap-0.5" role="tablist" aria-label="Savol qo'shish usuli">
      {YOLLAR.map(y => (
        <button key={y.v} type="button" role="tab" aria-selected={y.v === rejim} disabled={band} onClick={() => onRejim(y.v)}
          className={`px-3 py-1 rounded-[10px] text-[12px] font-bold cursor-pointer transition-colors disabled:opacity-50 ${y.v === rejim ? 'bg-brand text-brand-ust shadow-sm' : 'text-matn-sokin hover:text-matn'}`}>{y.nom}</button>
      ))}
    </div>
  );
}
