import React from 'react';
import { Settings2 } from 'lucide-react';

// Addmen'dagi filtr ustuni: sarlavhada "hammasi" belgisi va nomi, ostida
// qiymatlar ro'yxati (har birida nechta savol). Bir ustun ichida tanlanganlar —
// "yoki", ustunlar orasida — "va".

export interface FiltrQiymati<K extends string | number> { k: K; nom: React.ReactNode; soni?: number; izoh?: string }

export default function FiltrUstuni<K extends string | number>({ sarlavha, qiymatlar, tanlangan, onChange, onSozla, bosh = "Qiymat yo'q", balandlik = 'max-h-44' }: {
  sarlavha: string;
  qiymatlar: FiltrQiymati<K>[];
  tanlangan: K[];
  onChange: (v: K[]) => void;
  /** Ustun qiymatlarini boshqarish (qo'shish, nomini o'zgartirish). */
  onSozla?: () => void;
  bosh?: string;
  balandlik?: string;
}) {
  const hammasi = qiymatlar.length > 0 && qiymatlar.every(q => tanlangan.includes(q.k));
  const qisman = !hammasi && tanlangan.length > 0;
  const almashtir = (k: K) => onChange(tanlangan.includes(k) ? tanlangan.filter(x => x !== k) : [...tanlangan, k]);

  return (
    <section className="rounded-xl border border-chiziq bg-sirt flex flex-col min-w-0" aria-label={sarlavha}>
      <header className="flex items-center gap-2 px-2.5 py-2 border-b border-chiziq bg-ichki/60 rounded-t-xl">
        <input
          type="checkbox" aria-label={`${sarlavha}: hammasini tanlash`} className="w-3.5 h-3.5 shrink-0 accent-[var(--color-brand)] cursor-pointer"
          checked={hammasi} ref={el => { if (el) el.indeterminate = qisman; }} disabled={!qiymatlar.length}
          onChange={() => onChange(hammasi || qisman ? [] : qiymatlar.map(q => q.k))}
        />
        <h4 className="flex-1 min-w-0 truncate text-[12px] font-bold text-matn" title={sarlavha}>{sarlavha}</h4>
        {tanlangan.length > 0 && <span className="text-[11px] font-semibold text-brand raqam">{tanlangan.length}</span>}
        {onSozla && (
          <button type="button" onClick={onSozla} aria-label={`${sarlavha} — sozlash`} title="Qiymatlarni qo'shish, nomini o'zgartirish"
            className="p-1 -m-1 rounded-md text-matn-xira hover:text-brand hover:bg-sirt cursor-pointer"><Settings2 size={13} /></button>
        )}
      </header>
      <ul className={`${balandlik} overflow-y-auto py-1`}>
        {!qiymatlar.length && <li className="px-3 py-2 text-[11.5px] text-matn-xira">{bosh}</li>}
        {qiymatlar.map(q => {
          const belgi = tanlangan.includes(q.k);
          return (
            <li key={String(q.k)}>
              <label className={`flex items-center gap-2 px-2.5 py-[3px] text-[12px] cursor-pointer select-none hover:bg-ichki ${belgi ? 'bg-brand-fon/60 dark:bg-brand/10' : ''}`} title={q.izoh}>
                <input type="checkbox" className="w-3.5 h-3.5 shrink-0 accent-[var(--color-brand)] cursor-pointer" checked={belgi} onChange={() => almashtir(q.k)} />
                <span className={`flex-1 min-w-0 truncate ${belgi ? 'text-matn font-semibold' : 'text-matn'}`}>{q.nom}</span>
                {q.soni !== undefined && <span className={`shrink-0 raqam text-[11px] ${q.soni ? 'text-matn-xira' : 'text-matn-xira/50'}`}>{q.soni}</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
