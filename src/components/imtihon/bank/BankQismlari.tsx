import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

// Savollar banki ekranining qismlari: chap paneldagi qator (shu joyida nomi o'zgaradi,
// o'chadi, ustiga savol yoki mavzu sudrab tashlanadi), bir qatorli yozish maydoni,
// ochiladigan menyu va pastdagi xabar («Bekor qilish» bilan).

/** Sudralayotgan narsa: savol(lar) yoki mavzu. dataTransfer `dragover` da o'qilmaydi — shu yerda turadi. */
export type Sudralgan = { tur: 'savol'; ids: number[] } | { tur: 'mavzu'; id: number };
let sudralgan: Sudralgan | null = null;
export const sudrashniBoshla = (s: Sudralgan | null) => { sudralgan = s; };
export const sudralayotgan = () => sudralgan;

const IKT = 'inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0 cursor-pointer text-matn-sokin hover:bg-sirt hover:text-matn disabled:opacity-40';

/**
 * Bir qatorli maydon: Enter — saqlaydi, Esc — yopadi. `ochiqQolsin` — saqlangach bo'shab,
 * ochiq qoladi (ketma-ket yozish uchun). `onYubor` false qaytarsa — maydon yopilmaydi.
 */
export function QatorForma({ boshi = '', joy, onYubor, onYop, ochiqQolsin, belgi = 'ha', tugma, className = '' }: {
  boshi?: string; joy: string; onYubor: (nom: string) => Promise<boolean | void> | boolean | void; onYop: () => void;
  ochiqQolsin?: boolean; belgi?: 'ha' | 'plus';
  /** Yozuvli tugma (masalan «Fan qo'shish») — sahifadagi yagona maydon uchun; yopish tugmasi chiqmaydi. */
  tugma?: string; className?: string;
}) {
  const [nom, setNom] = useState(boshi);
  const [band, setBand] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); if (boshi) ref.current?.select(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const yubor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (band) return;
    const n = nom.replace(/\s+/g, ' ').trim();
    if (!n) { if (tugma) ref.current?.focus(); else onYop(); return; }
    setBand(true);
    const ok = await onYubor(n);
    setBand(false);
    if (ok === false) { ref.current?.focus(); return; }
    if (ochiqQolsin) { setNom(''); ref.current?.focus(); } else onYop();
  };
  return (
    <form onSubmit={yubor} className={`flex items-center gap-1 ${className}`}>
      <input ref={ref} value={nom} onChange={e => setNom(e.target.value)} placeholder={joy} aria-label={joy} disabled={band} maxLength={120}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onYop(); } }}
        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-brand bg-sirt text-[13px] text-matn placeholder:text-matn-xira" style={{ outline: 'none' }} />
      {tugma ? (
        <button type="submit" disabled={band} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0 bg-brand text-brand-ust text-[13px] font-semibold cursor-pointer disabled:opacity-60">
          {band ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} strokeWidth={2.6} />}{tugma}
        </button>
      ) : (
        <>
          <button type="submit" disabled={band} aria-label={boshi ? 'Saqlash' : "Qo'shish"}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-brand text-brand-ust cursor-pointer disabled:opacity-60">
            {band ? <Loader2 size={14} className="animate-spin" /> : belgi === 'plus' ? <Plus size={15} strokeWidth={2.6} /> : <Check size={15} strokeWidth={2.6} />}
          </button>
          <button type="button" onClick={onYop} aria-label="Yopish" className={`${IKT} w-7 h-7`}><X size={14} /></button>
        </>
      )}
    </form>
  );
}

/** "+ Bo'lim" kabi havola-tugma. */
export function QoshHavola({ children, onClick, className = '' }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 px-1 py-1 rounded-md text-[12.5px] font-semibold text-brand hover:underline cursor-pointer ${className}`}>
      <Plus size={13} strokeWidth={2.6} />{children}
    </button>
  );
}

/** Filtr qatoridagi belgilash katagi (ko'rinishi; bosiladigani — qatorning o'zi). */
export function Katak({ faol }: { faol: boolean }) {
  return (
    <span aria-hidden className={`inline-flex items-center justify-center w-[15px] h-[15px] mx-[3px] rounded shrink-0 border-[1.5px] ${faol ? 'bg-brand border-brand text-brand-ust' : 'bg-sirt border-chiziq-kuchli'}`}>
      {faol && <Check size={10} strokeWidth={4} />}
    </span>
  );
}

/**
 * Chap paneldagi qator. Bosilsa — tanlanadi; ustiga kursor kelsa (telefonda doim) qalam va
 * savat chiqadi; `qabul` — ustiga nima tashlasa bo'ladi (sudrash paytida punktir chiziq).
 */
export function YonQator({ nom, korinish, soni, faol, bosilgan, onBos, chap, nuqta, qalin, onSaqla, onOchir, onQosh, qoshNomi, qabul, onTashla, sudrashda, sudraladi, chaqnash }: {
  nom: string; korinish?: React.ReactNode; soni?: number; faol?: boolean;
  /** Filtr qatori: bosilgan / bosilmagan (aria-pressed). */
  bosilgan?: boolean;
  onBos: () => void; chap?: React.ReactNode; nuqta?: string; qalin?: boolean;
  onSaqla?: (nom: string) => Promise<boolean | void> | boolean | void; onOchir?: () => void;
  onQosh?: () => void; qoshNomi?: string;
  qabul?: Sudralgan['tur']; onTashla?: (s: Sudralgan) => void; sudrashda?: Sudralgan['tur'] | null;
  sudraladi?: Sudralgan; chaqnash?: boolean;
}) {
  const [tahrir, setTahrir] = useState(false);
  const [ustida, setUstida] = useState(false);
  const nishon = !!qabul && sudrashda === qabul;
  useEffect(() => { if (!nishon) setUstida(false); }, [nishon]);
  if (tahrir && onSaqla) {
    return <li><QatorForma boshi={nom} joy="Yangi nom" onYubor={n => (n === nom ? true : onSaqla(n))} onYop={() => setTahrir(false)} className="px-1 py-0.5" /></li>;
  }
  return (
    <li>
      <div
        draggable={!!sudraladi}
        onDragStart={sudraladi ? e => { sudrashniBoshla(sudraladi); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', nom); } : undefined}
        onDragOver={nishon ? e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!ustida) setUstida(true); } : undefined}
        onDragLeave={nishon ? e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setUstida(false); } : undefined}
        onDrop={nishon ? e => { e.preventDefault(); setUstida(false); const s = sudralayotgan(); if (s && onTashla) onTashla(s); } : undefined}
        className={`group flex items-center gap-1 min-h-8 pl-1 pr-1.5 rounded-lg text-[13px] transition-colors
          ${ustida ? 'bg-brand text-brand-ust' : faol ? 'bg-brand-fon text-brand-dark dark:bg-brand/20 dark:text-brand-accent' : 'text-matn hover:bg-ichki'}
          ${nishon && !ustida ? 'outline-dashed outline-1 -outline-offset-1 outline-brand/60' : ''} ${chaqnash ? 'bank-chaqnash' : ''}`}>
        {chap ?? <span className="w-5 shrink-0" />}
        {nuqta && <span className={`w-2 h-2 rounded-full shrink-0 ${nuqta}`} />}
        <button type="button" onClick={onBos} aria-pressed={bosilgan} aria-current={bosilgan === undefined && faol ? 'true' : undefined}
          className={`flex-1 min-w-0 text-left truncate py-1.5 px-1 rounded-md cursor-pointer ${qalin || faol ? 'font-semibold' : ''}`}>{korinish ?? nom}</button>
        {(onQosh || onSaqla || onOchir) && !ustida && (
          <span className="hidden group-hover:inline-flex group-focus-within:inline-flex [@media(hover:none)]:inline-flex items-center">
            {onQosh && <button type="button" className={IKT} onClick={onQosh} title={qoshNomi} aria-label={`${nom} — ${qoshNomi}`}><Plus size={13} /></button>}
            {onSaqla && <button type="button" className={IKT} onClick={() => setTahrir(true)} title="Nomini o'zgartirish" aria-label={`${nom} — nomini o'zgartirish`}><Pencil size={12} /></button>}
            {onOchir && <button type="button" className={`${IKT} hover:text-xato`} onClick={onOchir} title="O'chirish" aria-label={`${nom} — o'chirish`}><Trash2 size={12} /></button>}
          </span>
        )}
        {soni !== undefined && <span className={`raqam text-[12px] shrink-0 ${ustida ? '' : faol ? 'font-semibold' : soni ? 'text-matn-xira' : 'text-matn-xira/60'}`}>{soni}</span>}
      </div>
    </li>
  );
}

/** Serverga yozilayotgan yangi qator (nomi darhol ko'rinadi). */
export function KutishQatori({ nom }: { nom: string }) {
  return (
    <li className="flex items-center gap-1 min-h-8 pl-1 pr-1.5 rounded-lg text-[13px] text-matn-xira">
      <span className="w-5 shrink-0 inline-flex justify-center"><Loader2 size={12} className="animate-spin" /></span>
      <span className="flex-1 min-w-0 truncate px-1">{nom}</span>
    </li>
  );
}

/** Tugma yonida ochiladigan menyu: tashqarisi bosilsa, Esc yoki sahifa surilsa — yopiladi. */
export function Menyu({ rect, onYop, nom, children }: { rect: DOMRect; onYop: () => void; nom: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [joy, setJoy] = useState<{ left: number; top: number } | null>(null);
  // Ekrandan chiqib ketmasin: o'ngga sig'masa chapga, pastga sig'masa tugma ustiga.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - el.offsetWidth - 8));
    let top = rect.bottom + 6;
    if (top + el.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - el.offsetHeight - 6);
    setJoy(j => (j && j.left === left && j.top === top ? j : { left, top }));
  });
  useEffect(() => {
    const tugma = (e: KeyboardEvent) => { if (e.key === 'Escape') onYop(); };
    const surildi = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onYop(); };
    document.addEventListener('keydown', tugma);
    window.addEventListener('scroll', surildi, true);
    return () => { document.removeEventListener('keydown', tugma); window.removeEventListener('scroll', surildi, true); };
  }, [onYop]);
  return (
    <>
      <div className="fixed inset-0 z-[240]" onClick={onYop} />
      <div ref={ref} role="menu" aria-label={nom}
        className="fixed z-[241] w-64 max-w-[calc(100vw-16px)] max-h-[min(380px,calc(100vh-16px))] overflow-y-auto p-1.5 rounded-xl border border-chiziq-kuchli bg-sirt shadow-2xl"
        style={{ left: joy?.left ?? rect.left, top: joy?.top ?? rect.bottom + 6, visibility: joy ? 'visible' : 'hidden' }}>
        {children}
      </div>
    </>
  );
}

export function MenyuSarlavha({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pt-1.5 pb-1 text-[10.5px] font-bold tracking-wider uppercase text-matn-xira truncate">{children}</p>;
}

export function MenyuBand({ children, onClick, joriy, nuqta, ikonka, xavfli }: {
  children: React.ReactNode; onClick: () => void; joriy?: boolean; nuqta?: string; ikonka?: React.ReactNode; xavfli?: boolean;
}) {
  return (
    <button type="button" role="menuitem" onClick={onClick}
      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left text-[13px] cursor-pointer hover:bg-ichki ${xavfli ? 'text-xato' : joriy ? 'font-semibold text-brand' : 'text-matn'}`}>
      {ikonka}
      {nuqta && <span className={`w-2 h-2 rounded-full shrink-0 ${nuqta}`} />}
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {joriy && <Check size={14} strokeWidth={3} className="shrink-0" />}
    </button>
  );
}

export const MenyuChiziq = () => <hr className="my-1 border-0 border-t border-chiziq" />;

/** Pastdagi xabar: amal natijasi va (bo'lsa) «Bekor qilish». */
export function Xabar({ matn, onOrtga }: { matn: string; onOrtga?: () => void }) {
  return (
    <div role="status" className="pointer-events-auto flex items-center gap-3 max-w-full rounded-xl bg-matn text-sirt shadow-2xl pl-3.5 pr-3 py-2 text-[12.5px]">
      <span className="min-w-0">{matn}</span>
      {onOrtga && <button type="button" onClick={onOrtga} className="shrink-0 font-bold underline cursor-pointer whitespace-nowrap">Bekor qilish</button>}
    </div>
  );
}
