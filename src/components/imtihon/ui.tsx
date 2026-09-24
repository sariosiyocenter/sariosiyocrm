import React from 'react';
import { Loader2 } from 'lucide-react';

// Imtihon sahifalarining umumiy bo'laklari — ilova tokenlari bilan (bg-sirt,
// border-chiziq, text-matn...), yorug' va qorong'i rejimda bir xil ishlaydi.

export function Karta({ sarlavha, izoh, amallar, children, className = '', ichki = 'p-4' }: {
  sarlavha?: React.ReactNode; izoh?: React.ReactNode; amallar?: React.ReactNode; children?: React.ReactNode; className?: string; ichki?: string;
}) {
  return (
    <section className={`bg-sirt rounded-2xl border border-chiziq shadow-sm ${className}`}>
      {(sarlavha || amallar) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
          <div className="min-w-0">
            {sarlavha && <h3 className="text-[13px] font-bold text-matn">{sarlavha}</h3>}
            {izoh && <p className="text-[12px] text-matn-xira mt-0.5">{izoh}</p>}
          </div>
          {amallar && <div className="flex flex-wrap items-center gap-2">{amallar}</div>}
        </div>
      )}
      <div className={ichki}>{children}</div>
    </section>
  );
}

type TugmaTuri = 'asosiy' | 'ikkinchi' | 'xavfli' | 'oddiy';
const TUGMA: Record<TugmaTuri, string> = {
  // Matn rangi — brend ustidagi token (qorong'i mavzuda brend yorqin, matn qora).
  asosiy: 'bg-brand hover:opacity-90 text-brand-ust border-brand shadow-sm',
  ikkinchi: 'bg-sirt hover:bg-ichki text-matn border-chiziq',
  xavfli: 'bg-sirt hover:bg-xato-fon text-xato border-xato-chiziq',
  oddiy: 'bg-transparent hover:bg-ichki text-matn-sokin border-transparent',
};

export function Tugma({ turi = 'ikkinchi', kichik, yuklanmoqda, ikonka, children, className = '', ...qolgan }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  turi?: TugmaTuri; kichik?: boolean; yuklanmoqda?: boolean; ikonka?: React.ReactNode;
}) {
  return (
    <button
      {...qolgan}
      disabled={qolgan.disabled || yuklanmoqda}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${kichik ? 'px-2.5 py-1.5 text-[12px]' : 'px-4 py-2.5 text-[13px]'} ${TUGMA[turi]} ${className}`}
    >
      {yuklanmoqda ? <Loader2 size={kichik ? 13 : 15} className="animate-spin" /> : ikonka}
      {children}
    </button>
  );
}

type YorliqRangi = 'yaxshi' | 'ogoh' | 'xato' | 'brand' | 'kulrang';
const YORLIQ: Record<YorliqRangi, string> = {
  yaxshi: 'bg-yaxshi-fon text-yaxshi border-yaxshi/25',
  ogoh: 'bg-ogoh-fon text-ogoh border-ogoh/25',
  xato: 'bg-xato-fon text-xato border-xato-chiziq',
  brand: 'bg-brand-fon text-brand-dark border-brand/25 dark:bg-brand/20 dark:text-brand-accent',
  kulrang: 'bg-ichki text-matn-sokin border-chiziq',
};

export function Yorliq({ rang = 'kulrang', children, className = '' }: { rang?: YorliqRangi; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${YORLIQ[rang]} ${className}`}>{children}</span>;
}

export const HOLAT_RANGI: Record<string, YorliqRangi> = {
  Qoralama: 'kulrang',
  Tayyor: 'brand',
  Tekshirilmoqda: 'ogoh',
  "E'lon qilindi": 'yaxshi',
};

export function BoshHolat({ ikonka, sarlavha, izoh, children }: { ikonka?: React.ReactNode; sarlavha: string; izoh?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {ikonka && <div className="w-12 h-12 rounded-2xl bg-ichki flex items-center justify-center text-matn-xira mb-3">{ikonka}</div>}
      <p className="text-[13px] font-semibold text-matn">{sarlavha}</p>
      {izoh && <p className="text-[12px] text-matn-xira mt-1 max-w-md">{izoh}</p>}
      {children && <div className="mt-4 flex flex-wrap gap-2 justify-center">{children}</div>}
    </div>
  );
}

export function Maydon({ nom, izoh, children, className = '' }: { nom: React.ReactNode; izoh?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">{nom}</span>
      {children}
      {izoh && <span className="block text-[11px] text-matn-xira mt-1">{izoh}</span>}
    </label>
  );
}

export const INPUT = 'w-full px-3 py-2.5 bg-ichki border border-chiziq rounded-xl text-[13px] text-matn focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition-all placeholder:text-matn-xira';
export const SELECT = `${INPUT} cursor-pointer`;

export function Yuklanmoqda({ matn = 'Yuklanmoqda…' }: { matn?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-matn-xira">
      <Loader2 size={16} className="animate-spin" /> {matn}
    </div>
  );
}

/** Ikki holatli tanlov (tugmachalar qatori). */
export function Tanlov<T extends string | number>({ qiymat, variantlar, onChange, kichik }: {
  qiymat: T; variantlar: { v: NoInfer<T>; nom: React.ReactNode }[]; onChange: (v: NoInfer<T>) => void; kichik?: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-chiziq bg-ichki p-0.5 gap-0.5">
      {variantlar.map(o => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-[10px] font-semibold transition-colors cursor-pointer ${kichik ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[12.5px]'} ${o.v === qiymat ? 'bg-sirt text-matn shadow-sm border border-chiziq' : 'text-matn-sokin hover:text-matn border border-transparent'}`}
        >
          {o.nom}
        </button>
      ))}
    </div>
  );
}

export function Almashtirgich({ yoqilgan, onChange, nom, izoh }: { yoqilgan: boolean; onChange: (v: boolean) => void; nom: React.ReactNode; izoh?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!yoqilgan)} className="flex items-start gap-3 text-left w-full cursor-pointer group">
      <span className={`mt-0.5 shrink-0 w-9 h-5 rounded-full border transition-colors relative ${yoqilgan ? 'bg-brand border-brand' : 'bg-ichki border-chiziq-kuchli'}`}>
        <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${yoqilgan ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-matn">{nom}</span>
        {izoh && <span className="block text-[11.5px] text-matn-xira mt-0.5">{izoh}</span>}
      </span>
    </button>
  );
}
