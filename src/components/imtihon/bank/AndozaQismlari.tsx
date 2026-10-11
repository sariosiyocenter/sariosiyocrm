import React, { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { INPUT } from '../ui';
import { ANDOZA_MAX, andozaQoidali, qoidalarSoni, sonniOqi } from './andoza';
import type { Andoza } from '../../../types';

// Andoza ekranlarining umumiy bo'laklari: yaratish maydonlari (nomi + savollar soni),
// to'lganlik chizig'i va savollar sonini bir bosishda o'zgartirish.

/** Yangi andoza uchun ikki maydon: nomi va savollar soni. Enter — `onEnter`. */
export function AndozaMaydonlari({ nom, soni, onNom, onSoni, onEnter, disabled, autoFocus }: {
  nom: string; soni: string; onNom: (v: string) => void; onSoni: (v: string) => void; onEnter?: () => void; disabled?: boolean; autoFocus?: boolean;
}) {
  const enter = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem] gap-3">
      <label className="block">
        <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Andoza nomi</span>
        <input className={INPUT} autoFocus={autoFocus} disabled={disabled} maxLength={120} value={nom} placeholder="Masalan: Matematika — 30 talik" onChange={e => onNom(e.target.value)} onKeyDown={enter} />
      </label>
      <label className="block">
        <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Savollar soni</span>
        <input className={`${INPUT} raqam`} inputMode="numeric" disabled={disabled} value={soni} placeholder="30" aria-label="Savollar soni"
          onChange={e => onSoni(e.target.value.replace(/\D/g, '').slice(0, 3))} onKeyDown={enter} />
      </label>
    </div>
  );
}

/** "12 / 30" va ingichka chiziq; eski (qoidali) andozada — "qoidali · 30 savol". */
export function AndozaToliqligi({ a, className = '' }: { a: Andoza; className?: string }) {
  if (andozaQoidali(a)) return <span className={`block text-[11.5px] text-matn-xira ${className}`}>qoidali · <span className="raqam">{qoidalarSoni(a)}</span> savol</span>;
  const toldi = a.soni > 0 && a.savolSoni >= a.soni;
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span className={`raqam text-[11.5px] font-semibold whitespace-nowrap ${toldi ? 'text-yaxshi' : 'text-matn-sokin'}`}>{a.savolSoni} / {a.soni}</span>
      <span className="flex-1 h-1 rounded-full bg-ichki overflow-hidden" aria-hidden="true">
        <span className={`block h-full rounded-full ${toldi ? 'bg-yaxshi' : 'bg-brand'}`} style={{ width: `${a.soni ? Math.min(100, (a.savolSoni / a.soni) * 100) : 0}%` }} />
      </span>
    </span>
  );
}

/** Savollar soni: − / + bir bosishda, yoki yozib (Enter yoki maydondan chiqishda saqlanadi). `min` — andozadagi savollar. */
export function SonTanlagich({ qiymat, min, disabled, onSaqla }: { qiymat: number; min: number; disabled?: boolean; onSaqla: (n: number) => void }) {
  const [v, setV] = useState(String(qiymat));
  useEffect(() => { setV(String(qiymat)); }, [qiymat]);
  const past = Math.max(1, min);
  const qoy = (n: number) => {
    const x = Math.min(ANDOZA_MAX, Math.max(past, n));
    setV(String(x));
    if (x !== qiymat) onSaqla(x);
  };
  const TUGMA = 'w-9 h-9 flex items-center justify-center text-matn-sokin hover:text-matn hover:bg-sirt cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="inline-flex items-center rounded-xl border border-chiziq bg-ichki overflow-hidden" role="group" aria-label="Savollar soni">
      <button type="button" aria-label="Savollar sonini kamaytirish" className={TUGMA} disabled={disabled || qiymat <= past} onClick={() => qoy(qiymat - 1)}><Minus size={14} /></button>
      <input inputMode="numeric" aria-label="Savollar soni" disabled={disabled} value={v}
        className="w-12 h-9 bg-transparent text-center text-[14px] font-bold text-matn raqam outline-none"
        onChange={e => setV(e.target.value.replace(/\D/g, '').slice(0, 3))} onBlur={() => qoy(sonniOqi(v) || qiymat)}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      <button type="button" aria-label="Savollar sonini oshirish" className={TUGMA} disabled={disabled || qiymat >= ANDOZA_MAX} onClick={() => qoy(qiymat + 1)}><Plus size={14} /></button>
    </div>
  );
}
