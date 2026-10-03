import React, { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, ArrowRight, Minus, MousePointerClick, FolderPlus, Tags, Loader2 } from 'lucide-react';

// Savollar bankining ustunlari (Fan → Bo'lim → Mavzu → Qiyinlik → filtrlar): har ustunda
// qiymatlar shu joyning o'zida qo'shiladi, nomi o'zgartiriladi, o'chiriladi. Savollar
// tanlansa — qator yonida "shu yerga" tugmasi chiqadi (ko'chirish / biriktirish / ajratish);
// savol kartochkasini qatorga sudrab tashlasa ham bo'ladi.

/** Sudralayotgan narsa. dataTransfer dragover paytida o'qilmaydi — shuning uchun modul darajasida. */
export type Sudralgan = { tur: 'savol'; ids: number[] } | { tur: 'mavzu'; id: number };
let sudralgan: Sudralgan | null = null;
export const sudrashniBoshla = (s: Sudralgan | null) => { sudralgan = s; };
export const sudralayotgan = () => sudralgan;

const KICHIK_TUGMA = 'p-1 rounded-md cursor-pointer disabled:opacity-40 disabled:cursor-default';
const INPUT = 'w-full min-w-0 px-2 py-1 rounded-md border border-brand bg-sirt text-[12.5px] text-matn placeholder:text-matn-xira';

export function Ustun({ nom, izoh, tanlangan = 0, amallar, children, past, kenglik = 'w-[212px]', boshNom }: {
  nom: React.ReactNode; izoh?: React.ReactNode; tanlangan?: number; amallar?: React.ReactNode; children: React.ReactNode; past?: React.ReactNode; kenglik?: string;
  /** aria-label uchun matn (nom JSX bo'lsa). */
  boshNom?: string;
}) {
  return (
    <section aria-label={boshNom || (typeof nom === 'string' ? nom : undefined)}
      className={`shrink-0 snap-start ${kenglik} h-[236px] flex flex-col rounded-xl border border-chiziq bg-sirt overflow-hidden`}>
      <div className="flex items-center gap-1 pl-2.5 pr-1.5 h-9 shrink-0 border-b border-chiziq bg-ichki/60">
        <div className="flex-1 min-w-0">
          <div className="truncate text-[12px] font-bold text-matn leading-tight">{nom}</div>
          {izoh && <div className="truncate text-[10px] text-matn-xira leading-tight">{izoh}</div>}
        </div>
        {tanlangan > 0 && <span className="raqam text-[10.5px] font-bold min-w-4 text-center px-1 rounded bg-brand text-brand-ust">{tanlangan}</span>}
        {amallar}
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto p-1 space-y-px">{children}</ul>
      {past}
    </section>
  );
}

/** Ustun sarlavhasidagi kichik tugma (nomini o'zgartirish, o'chirish...). */
export function SarlavhaTugma({ ikonka, nom, onClick, faol, xavfli }: { ikonka: React.ReactNode; nom: string; onClick: () => void; faol?: boolean; xavfli?: boolean }) {
  return (
    <button type="button" aria-label={nom} title={nom} onClick={onClick}
      className={`${KICHIK_TUGMA} ${faol ? 'text-brand bg-brand-fon' : `text-matn-xira ${xavfli ? 'hover:text-xato' : 'hover:text-brand'} hover:bg-sirt`}`}>{ikonka}</button>
  );
}

export function UstunBosh({ children }: { children: React.ReactNode }) {
  return <li className="px-2 py-3 text-[11.5px] text-matn-xira leading-snug">{children}</li>;
}

/** Hali serverga yozilayotgan yangi qator (nomi darhol ko'rinadi). */
export function KutishQatori({ nom }: { nom: string }) {
  return (
    <li className="flex items-center gap-2 rounded-lg pl-1.5 pr-1 min-h-7 text-[12.5px] text-matn-xira" aria-busy="true">
      <Loader2 size={13} className="shrink-0 animate-spin" /><span className="truncate">{nom}</span>
    </li>
  );
}

/** Ustun ichidagi kichik sarlavha (mavzular ustunida — bo'lim nomi). */
export function UstunGuruh({ children }: { children: React.ReactNode }) {
  return <li className="px-1.5 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-matn-xira truncate">{children}</li>;
}

export interface Biriktirish {
  /** Tanlangan savollarning hammasi / bir qismi / hech biri shu qiymatda. */
  holat: 'hammasi' | 'qisman' | 'yoq';
  /** 'kochir' — bitta qiymatli (mavzu, qiyinlik); 'belgi' — biriktirish / ajratish. */
  tur: 'kochir' | 'belgi';
  soni: number;
  jami: number;
  onBos: () => void;
}

export interface TahrirQosh { nom: string; qiymat: string; variantlar: { v: string; nom: string; nuqta?: string }[]; korinish: 'tanlov' | 'nuqtalar' }

export function Qator({ nom, korinish, soni, faol, belgi = 'katak', nuqta, onBos, onSaqla, onOchir, tahrirQosh, biriktir, qabul, onTashla, sudraladi, chaqnash, sudrashda }: {
  nom: string;
  /** Ko'rinadigan nom (masalan kursiv "Bo'limsiz") — bo'lmasa `nom`. */
  korinish?: React.ReactNode;
  soni?: number;
  faol: boolean;
  belgi?: 'katak' | 'bitta';
  /** Rang nuqtasi (qiyinlik darajasi). */
  nuqta?: string;
  onBos: () => void;
  onSaqla?: (nom: string, qosh: string) => Promise<boolean | void>;
  onOchir?: () => void;
  tahrirQosh?: TahrirQosh;
  biriktir?: Biriktirish | null;
  /** Shu qatorga nima tashlasa bo'ladi. */
  qabul?: 'savol' | 'mavzu';
  onTashla?: (s: Sudralgan) => void;
  sudraladi?: Sudralgan;
  chaqnash?: boolean;
  /** Hozir shu turdagi narsa sudralyapti — qator "shu yerga tashlang" ko'rinishida. */
  sudrashda?: 'savol' | 'mavzu' | null;
}) {
  const [tahrir, setTahrir] = useState<{ nom: string; qosh: string } | null>(null);
  const [band, setBand] = useState(false);
  const [ustida, setUstida] = useState(false);

  const saqla = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!tahrir || !onSaqla) return;
    if (!tahrir.nom.trim()) return setTahrir(null);
    setBand(true);
    const ok = await onSaqla(tahrir.nom.trim(), tahrir.qosh);
    setBand(false);
    if (ok !== false) setTahrir(null);
  };

  const qabulQiladi = !!qabul && !!onTashla;
  const tashlash = qabulQiladi ? {
    onDragOver: (e: React.DragEvent) => { if (sudralayotgan()?.tur === qabul) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!ustida) setUstida(true); } },
    onDragLeave: () => setUstida(false),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setUstida(false); const s = sudralayotgan(); if (s && s.tur === qabul) onTashla!(s); },
  } : {};

  if (tahrir) {
    return (
      <li className="rounded-lg bg-brand-fon/50 dark:bg-brand/10 p-1">
        <form onSubmit={saqla} className="space-y-1">
          <input autoFocus className={INPUT} style={{ outline: 'none' }} value={tahrir.nom} aria-label={`${nom} — yangi nom`} disabled={band}
            onChange={e => setTahrir({ ...tahrir, nom: e.target.value })} onKeyDown={e => { if (e.key === 'Escape') setTahrir(null); }} />
          <div className="flex items-center gap-1">
            {tahrirQosh?.korinish === 'tanlov' && (
              <select className="flex-1 min-w-0 px-1.5 py-1 rounded-md border border-chiziq bg-sirt text-[12px] text-matn cursor-pointer" aria-label={tahrirQosh.nom}
                value={tahrir.qosh} onChange={e => setTahrir({ ...tahrir, qosh: e.target.value })}>
                {tahrirQosh.variantlar.map(v => <option key={v.v} value={v.v}>{v.nom}</option>)}
              </select>
            )}
            {tahrirQosh?.korinish === 'nuqtalar' && <NuqtaTanlov nom={tahrirQosh.nom} qiymat={tahrir.qosh} variantlar={tahrirQosh.variantlar} onChange={v => setTahrir({ ...tahrir, qosh: v })} />}
            <span className="flex-1" />
            <button type="submit" aria-label="Saqlash" disabled={band} className={`${KICHIK_TUGMA} text-yaxshi hover:bg-sirt`}><Check size={14} strokeWidth={3} /></button>
            <button type="button" aria-label="Bekor qilish" onClick={() => setTahrir(null)} className={`${KICHIK_TUGMA} text-matn-xira hover:bg-sirt`}><X size={14} /></button>
          </div>
        </form>
      </li>
    );
  }

  const nishon = qabulQiladi && sudrashda === qabul;
  return (
    <li draggable={!!sudraladi} {...tashlash}
      onDragStart={sudraladi ? e => { sudrashniBoshla(sudraladi); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', nom); } : undefined}
      onDragEnd={sudraladi ? () => sudrashniBoshla(null) : undefined}
      className={`group relative flex items-center gap-1 rounded-lg pl-1.5 pr-1 min-h-7 text-[12.5px] transition-colors
        ${ustida ? 'bg-brand text-brand-ust ring-2 ring-brand' : faol ? 'bg-brand-fon/80 dark:bg-brand/15' : 'hover:bg-ichki'}
        ${nishon && !ustida ? 'outline-dashed outline-1 outline-brand/50' : ''} ${chaqnash ? 'bank-chaqnash' : ''} ${sudraladi ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      <button type="button" role={belgi === 'katak' ? 'checkbox' : 'radio'} aria-checked={faol} aria-label={nom} onClick={onBos}
        className="flex-1 min-w-0 flex items-center gap-2 py-1 text-left cursor-pointer">
        {belgi === 'katak' ? (
          <span className={`w-3.5 h-3.5 shrink-0 rounded-[4px] border flex items-center justify-center ${faol ? 'bg-brand border-brand' : 'border-chiziq-kuchli bg-sirt'}`}>
            {faol && <Check size={10} strokeWidth={4} className="text-brand-ust" />}
          </span>
        ) : (
          <span className={`w-3.5 h-3.5 shrink-0 rounded-full border-2 ${faol ? 'border-brand bg-brand shadow-[inset_0_0_0_2px_var(--color-sirt)]' : 'border-chiziq-kuchli bg-sirt'}`} />
        )}
        {nuqta && <span className={`w-2 h-2 shrink-0 rounded-full ${nuqta}`} />}
        <span className={`truncate ${faol && !ustida ? 'font-semibold' : ''}`}>{korinish ?? nom}</span>
      </button>
      {biriktir ? (
        <BiriktirTugma b={biriktir} nom={nom} />
      ) : (
        <>
          {(onSaqla || onOchir) && (
            <span className="hidden group-hover:flex group-focus-within:flex [@media(hover:none)]:flex items-center">
              {onSaqla && <button type="button" aria-label={`${nom} — nomini o'zgartirish`} title="Nomini o'zgartirish" onClick={() => setTahrir({ nom, qosh: tahrirQosh?.qiymat ?? '' })}
                className={`${KICHIK_TUGMA} text-matn-xira hover:text-brand hover:bg-sirt`}><Pencil size={12} /></button>}
              {onOchir && <button type="button" aria-label={`${nom} — o'chirish`} title="O'chirish" onClick={onOchir}
                className={`${KICHIK_TUGMA} text-matn-xira hover:text-xato hover:bg-sirt`}><Trash2 size={12} /></button>}
            </span>
          )}
          {soni !== undefined && <span className={`shrink-0 raqam text-[11px] min-w-5 text-right pr-0.5 ${ustida ? '' : soni ? 'text-matn-xira' : 'text-matn-xira/50'}`}>{soni}</span>}
        </>
      )}
    </li>
  );
}

/** Tanlangan savollarni shu qatorga: ko'chirish (→), biriktirish (+) yoki ajratish (−). */
function BiriktirTugma({ b, nom }: { b: Biriktirish; nom: string }) {
  const shuYerda = b.tur === 'kochir' && b.holat === 'hammasi';
  const ajrat = b.tur === 'belgi' && b.holat === 'hammasi';
  const matn = shuYerda ? `Tanlangan savollar shu yerda` : ajrat ? `${b.jami} ta savoldan «${nom}» ni ajratish` : b.tur === 'kochir' ? `${b.jami} ta savolni «${nom}» ga o'tkazish` : `${b.jami} ta savolga «${nom}» ni biriktirish`;
  return (
    <span className="flex items-center gap-1 shrink-0">
      {b.soni > 0 && !shuYerda && <span className="raqam text-[10.5px] text-matn-xira" title={`Tanlanganlardan ${b.soni} tasi shu yerda`}>{b.soni}/{b.jami}</span>}
      <button type="button" disabled={shuYerda} onClick={b.onBos} aria-label={matn} title={matn}
        className={`w-6 h-6 rounded-md flex items-center justify-center cursor-pointer disabled:cursor-default transition-transform active:scale-90
          ${shuYerda ? 'text-yaxshi' : ajrat ? 'bg-xato-fon text-xato border border-xato-chiziq hover:bg-xato hover:text-white' : 'bg-brand text-brand-ust hover:opacity-85 shadow-sm'}`}>
        {shuYerda ? <Check size={14} strokeWidth={3} /> : ajrat ? <Minus size={14} strokeWidth={3} /> : b.tur === 'kochir' ? <ArrowRight size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={3} />}
      </button>
    </span>
  );
}

function NuqtaTanlov({ nom, qiymat, variantlar, onChange }: { nom: string; qiymat: string; variantlar: { v: string; nom: string; nuqta?: string }[]; onChange: (v: string) => void }) {
  return (
    <span className="inline-flex items-center gap-1" role="radiogroup" aria-label={nom}>
      {variantlar.map(v => (
        <button key={v.v} type="button" role="radio" aria-checked={qiymat === v.v} aria-label={v.nom} title={v.nom} onClick={() => onChange(v.v)}
          className={`w-5 h-5 rounded-full flex items-center justify-center cursor-pointer border ${qiymat === v.v ? 'border-matn' : 'border-transparent hover:border-chiziq-kuchli'}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${v.nuqta || 'bg-matn-xira'}`} />
        </button>
      ))}
    </span>
  );
}

/**
 * Ustun pastidagi "+ qo'shish": bosilsa — yozish maydoni. Enter qo'shadi va maydon ochiq
 * qoladi (ketma-ket bir nechtasini yozish uchun), Esc — yopadi.
 */
export function QoshQator({ joy, onQosh, qosh, ochiqBoshlansin }: {
  joy: string;
  onQosh: (nom: string, qosh: string) => Promise<boolean | void>;
  qosh?: { nom: string; boshi: string; variantlar: { v: string; nom: string; nuqta?: string }[] };
  ochiqBoshlansin?: boolean;
}) {
  const [ochiq, setOchiq] = useState(!!ochiqBoshlansin);
  const [nom, setNom] = useState('');
  const [q, setQ] = useState(qosh?.boshi ?? '');
  const [band, setBand] = useState(false);
  const maydon = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ochiqBoshlansin) setOchiq(true); }, [ochiqBoshlansin]);

  const yubor = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!nom.trim() || band) return;
    setBand(true);
    const ok = await onQosh(nom.trim(), q);
    setBand(false);
    if (ok !== false) { setNom(''); setTimeout(() => maydon.current?.focus(), 0); }
  };

  if (!ochiq) {
    return (
      <button type="button" onClick={() => setOchiq(true)}
        className="shrink-0 w-full flex items-center gap-1.5 px-2.5 h-8 border-t border-dashed border-chiziq text-[12px] font-semibold text-brand hover:bg-brand-fon/60 dark:hover:bg-brand/10 cursor-pointer">
        <Plus size={13} strokeWidth={2.5} /> <span className="truncate">{joy}</span>
      </button>
    );
  }
  return (
    <form onSubmit={yubor} className="shrink-0 border-t border-chiziq bg-brand-fon/40 dark:bg-brand/10 p-1.5 space-y-1">
      <div className="flex items-center gap-1">
        <input ref={maydon} autoFocus className={INPUT} style={{ outline: 'none' }} value={nom} placeholder={joy} aria-label={joy} disabled={band}
          onChange={e => setNom(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setOchiq(false); setNom(''); } }} />
        <button type="submit" aria-label="Qo'shish" disabled={band || !nom.trim()} className={`${KICHIK_TUGMA} bg-brand text-brand-ust`}><Check size={14} strokeWidth={3} /></button>
        <button type="button" aria-label="Yopish" onClick={() => { setOchiq(false); setNom(''); }} className={`${KICHIK_TUGMA} text-matn-xira hover:bg-sirt`}><X size={14} /></button>
      </div>
      {qosh && (
        <div className="flex items-center gap-1.5 px-0.5 text-[10.5px] text-matn-xira">
          {qosh.nom}: <NuqtaTanlov nom={qosh.nom} qiymat={q} variantlar={qosh.variantlar} onChange={setQ} />
          <span className="truncate">{qosh.variantlar.find(v => v.v === q)?.nom}</span>
        </div>
      )}
    </form>
  );
}

/** Qisqa yo'riqnoma: uch qadam — nima qayerda qo'shiladi va savol qanday biriktiriladi. */
export function Yoriqnoma({ onYop }: { onYop: () => void }) {
  const qadamlar = [
    { ikonka: <FolderPlus size={18} />, nom: "Fan, bo'lim, mavzu", matn: "Har ustunning pastidagi «+» ga bosing, nomini yozing va Enter. Ketma-ket bir nechtasini yozsa bo'ladi." },
    { ikonka: <Tags size={18} />, nom: "O'z filtringiz", matn: "«+ Filtr» — masalan «Manba» yoki «Test turi». Qiyinlikka ham o'z darajangizni qo'shing: «Juda oson», «Biroz qiyin»." },
    { ikonka: <MousePointerClick size={18} />, nom: 'Savolni biriktirish', matn: "Savollarni belgilang — ustunlarda → va + tugmalari chiqadi: bosing, yoki savolni kerakli qatorga sudrab tashlang. − ajratadi." },
  ];
  return (
    <div className="relative rounded-2xl border border-brand/30 bg-brand-fon/50 dark:bg-brand/10 p-3 pr-10">
      <button type="button" aria-label="Yo'riqnomani yopish" onClick={onYop} className="absolute top-2 right-2 p-1.5 rounded-lg text-matn-sokin hover:bg-sirt cursor-pointer"><X size={15} /></button>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {qadamlar.map((q, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="relative shrink-0 w-9 h-9 rounded-xl bg-brand text-brand-ust flex items-center justify-center">
              {q.ikonka}
              <span className="absolute -top-1.5 -left-1.5 w-4.5 h-4.5 rounded-full bg-sirt border border-brand text-brand text-[10px] font-bold flex items-center justify-center raqam">{i + 1}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-bold text-matn">{q.nom}</span>
              <span className="block text-[11.5px] text-matn-sokin leading-snug">{q.matn}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
