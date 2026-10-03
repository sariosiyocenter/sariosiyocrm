import React from 'react';
import type { Qiyinlik, QiyinlikSoni } from '../../../types';

// Qiyinlik uch darajada va hamma joyda bir xil rangda: oson — yashil,
// o'rta — sariq, qiyin — qizil (bank, savol muharriri, imtihon tuzish).

export const QIYINLIK: { d: Qiyinlik; nom: string; matn: string; fon: string; chiziq: string; nuqta: string }[] = [
  { d: 1, nom: 'Oson', matn: 'text-yaxshi', fon: 'bg-yaxshi-fon', chiziq: 'border-yaxshi/30', nuqta: 'bg-yaxshi' },
  { d: 2, nom: "O'rta", matn: 'text-ogoh', fon: 'bg-ogoh-fon', chiziq: 'border-ogoh/30', nuqta: 'bg-ogoh' },
  { d: 3, nom: 'Qiyin', matn: 'text-xato', fon: 'bg-xato-fon', chiziq: 'border-xato-chiziq', nuqta: 'bg-xato' },
];

export const qiyinlikDaraja = (d: number | null | undefined) => QIYINLIK[Math.min(3, Math.max(1, Number(d) || 1)) - 1];

/** "● Oson 5" — qiyinlik va (ixtiyoriy) soni. */
export function QiyinlikYorligi({ d, soni, xira, nom }: { d: number; soni?: number; xira?: boolean; /** Foydalanuvchi darajasi nomi ("Juda oson") — rangi asosiy guruhniki. */ nom?: string }) {
  const q = qiyinlikDaraja(d);
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${xira ? 'border-chiziq bg-ichki text-matn-xira' : `${q.fon} ${q.matn} ${q.chiziq}`}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${xira ? 'bg-matn-xira/50' : q.nuqta}`} />
      {nom || q.nom}{soni !== undefined && <span className="raqam">{soni}</span>}
    </span>
  );
}

/** Oson / o'rta / qiyin ulushi bitta chiziqda. */
export function QiyinlikChizigi({ soni, className = 'h-1.5' }: { soni: QiyinlikSoni; className?: string }) {
  const jami = soni[0] + soni[1] + soni[2];
  return (
    <div className={`flex rounded-full overflow-hidden bg-ichki ${className}`} role="img" aria-label={`Oson ${soni[0]}, o'rta ${soni[1]}, qiyin ${soni[2]}`}>
      {jami > 0 && soni.map((n, i) => n > 0 && <div key={i} className={QIYINLIK[i].nuqta} style={{ width: `${(n / jami) * 100}%` }} />)}
    </div>
  );
}

/** Qiyinlikni tanlash — uchta rangli tugma. */
export function QiyinlikTanlov({ qiymat, onChange, kichik }: { qiymat: number; onChange: (d: Qiyinlik) => void; kichik?: boolean }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-chiziq bg-ichki p-0.5 gap-0.5" role="radiogroup" aria-label="Qiyinlik">
      {QIYINLIK.map(q => {
        const tanlangan = qiymat === q.d;
        return (
          <button key={q.d} type="button" role="radio" aria-checked={tanlangan} onClick={() => onChange(q.d)}
            className={`inline-flex items-center gap-1.5 rounded-[10px] border font-semibold cursor-pointer transition-colors ${kichik ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[12.5px]'} ${tanlangan ? `${q.fon} ${q.matn} ${q.chiziq} shadow-sm` : 'border-transparent text-matn-sokin hover:text-matn'}`}>
            <span className={`w-2 h-2 rounded-full ${q.nuqta}`} />{q.nom}
          </button>
        );
      })}
    </div>
  );
}
