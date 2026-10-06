import React, { useState } from 'react';
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { QatorForma, Menyu, MenyuBand } from './BankQismlari';
import { QiyinlikChizigi } from './qiyinlik';
import type { BankFan } from '../../../types';

// Fanlar — kartalar qatori (egasi, 2026-10-06: "fanlar tepada juda qo'pol turibdi, qo'shish ham
// noqulay — chiroyliroq, tuzilgan qilib ber"). Har fan — o'z rangidagi belgi, savol va mavzu soni,
// qiyinlik bo'yicha taqsimot chizig'i. Tanlangani ajralib turadi; oxirida — «Yangi fan» kartasi,
// nomi shu kartaning o'zida yoziladi.

/** Fan nomidan barqaror rang (0–359): bir fan har doim bir xil rangda. */
function fanRangi(nom: string): number {
  let h = 0;
  for (const c of nom.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
/** Belgi: ikki so'zli nomda bosh harflar ("Ona tili" → OT), aks holda birinchi ikki harf. */
function fanBelgisi(nom: string): string {
  const sozlar = nom.trim().split(/\s+/).filter(Boolean);
  const b = sozlar.length > 1 ? sozlar[0][0] + sozlar[1][0] : (sozlar[0] || '?').slice(0, 2);
  return b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
}

const KARTA = 'relative shrink-0 snap-start w-[216px] rounded-2xl border transition-all';

interface FanKartalariProps {
  fanlar: BankFan[];
  faolId: number;
  /** Tanlangan fanning hozirgi savollar soni (ekrandagi sonlar bilan bir xil bo'lsin). */
  faolSoni: number | null;
  /** Tahrir huquqi: qo'shish, nomini o'zgartirish, o'chirish. */
  tahrir: boolean;
  /** Serverga yozilayotgan yangi fanlar (nomi darhol ko'rinadi). */
  kutilmoqda: string[];
  onFan: (id: number) => void;
  onQosh: (nom: string) => boolean | Promise<boolean>;
  onNom: (fan: BankFan, nom: string) => boolean | Promise<boolean>;
  onOchir: (fan: BankFan) => void;
}

export default function FanKartalari({ fanlar, faolId, faolSoni, tahrir, kutilmoqda, onFan, onQosh, onNom, onOchir }: FanKartalariProps) {
  const [qoshmoqda, setQoshmoqda] = useState(false);
  const [nomTahriri, setNomTahriri] = useState<number | null>(null);
  const [menyu, setMenyu] = useState<{ fan: BankFan; rect: DOMRect } | null>(null);

  return (
    <div role="tablist" aria-label="Fanlar" className="flex gap-2.5 overflow-x-auto snap-x pb-1.5 -mx-1 px-1">
      {fanlar.map(f => {
        const faol = f.id === faolId;
        const h = fanRangi(f.name);
        const soni = faol && faolSoni !== null ? faolSoni : f.jami - f.arxiv;
        if (nomTahriri === f.id) {
          return (
            <div key={f.id} className={`${KARTA} border-brand bg-sirt p-3 flex items-center`}>
              <QatorForma boshi={f.name} joy="Fan nomi" onYubor={nom => (nom === f.name ? true : onNom(f, nom))} onYop={() => setNomTahriri(null)} className="w-full" />
            </div>
          );
        }
        return (
          <div key={f.id} className={`${KARTA} group ${faol ? 'border-brand bg-sirt shadow-md ring-1 ring-brand/30' : 'border-chiziq bg-sirt hover:border-chiziq-kuchli hover:shadow-sm'}`}>
            <button type="button" role="tab" aria-selected={faol} onClick={() => onFan(f.id)} className="block w-full text-left p-3 rounded-2xl cursor-pointer">
              <span className="flex items-center gap-2.5">
                <span aria-hidden className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-[15px] font-bold"
                  style={{ background: `color-mix(in srgb, hsl(${h} 70% 46%) ${faol ? 22 : 14}%, transparent)`, color: `hsl(${h} 62% 46%)` }}>{fanBelgisi(f.name)}</span>
                <span className="min-w-0 flex-1 pr-5">
                  <span className={`block truncate text-[14px] font-bold ${faol ? 'text-brand-dark dark:text-brand-accent' : 'text-matn'}`}>{f.name}</span>
                  <span className="block truncate text-[11.5px] text-matn-xira"><span className="raqam">{soni}</span> savol · <span className="raqam">{f.mavzular.length}</span> mavzu</span>
                </span>
              </span>
              <span className="mt-2.5 block"><QiyinlikChizigi soni={f.qiyinlik} className="h-1" /></span>
            </button>
            {tahrir && (
              <button type="button" aria-label={`${f.name} — nomini o'zgartirish yoki o'chirish`} title="Nomini o'zgartirish yoki o'chirish" aria-haspopup="menu"
                onClick={e => setMenyu({ fan: f, rect: e.currentTarget.getBoundingClientRect() })}
                className={`absolute top-2 right-2 p-1 rounded-lg text-matn-sokin hover:bg-ichki hover:text-matn cursor-pointer transition-opacity focus-visible:opacity-100 [@media(hover:none)]:opacity-100 ${faol ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <MoreHorizontal size={15} />
              </button>
            )}
          </div>
        );
      })}

      {kutilmoqda.map((nom, i) => (
        <div key={`k${i}`} className={`${KARTA} border-dashed border-chiziq-kuchli bg-sirt p-3 flex items-center gap-2.5 text-[13px] text-matn-xira`}>
          <Loader2 size={15} className="animate-spin shrink-0" /><span className="truncate">{nom}</span>
        </div>
      ))}

      {tahrir && (qoshmoqda ? (
        <div className={`${KARTA} border-brand bg-sirt p-3 flex flex-col justify-center gap-1.5`}>
          <span className="text-[11.5px] font-semibold text-matn-sokin">Yangi fan</span>
          <QatorForma joy="Nomi, masalan Kimyo" onYubor={onQosh} onYop={() => setQoshmoqda(false)} />
        </div>
      ) : (
        <button type="button" onClick={() => setQoshmoqda(true)}
          className={`${KARTA} border-dashed border-chiziq-kuchli p-3 flex items-center gap-2.5 text-left cursor-pointer text-matn-sokin hover:border-brand hover:text-brand hover:bg-brand-fon/40 dark:hover:bg-brand/10`}>
          <span aria-hidden className="w-10 h-10 shrink-0 rounded-xl border border-dashed border-current flex items-center justify-center"><Plus size={18} /></span>
          <span className="min-w-0">
            <span className="block text-[14px] font-bold">Yangi fan</span>
            <span className="block text-[11.5px] opacity-80">bo'lim va mavzulari bilan</span>
          </span>
        </button>
      ))}

      {menyu && (
        <Menyu rect={menyu.rect} onYop={() => setMenyu(null)} nom={`${menyu.fan.name} fani`}>
          <MenyuBand ikonka={<Pencil size={14} />} onClick={() => { setNomTahriri(menyu.fan.id); setMenyu(null); }}>Nomini o'zgartirish</MenyuBand>
          <MenyuBand ikonka={<Trash2 size={14} />} xavfli onClick={() => { const f = menyu.fan; setMenyu(null); onOchir(f); }}>
            Fanni o'chirish{menyu.fan.jami > 0 ? ` (${menyu.fan.jami} ta savol bor)` : ''}
          </MenyuBand>
        </Menyu>
      )}
    </div>
  );
}
