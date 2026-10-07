import React, { useState } from 'react';
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { QatorForma, Menyu, MenyuBand } from './BankQismlari';
import { QIYINLIK, useQiyinlik } from './qiyinlik';
import type { BankFan } from '../../../types';

// Fanlar — kartalar qatori (egasi, 2026-10-06: "fanlar tepada juda qo'pol turibdi, qo'shish ham
// noqulay — chiroyliroq qilib ber"; 10-07: "yana chiroyliroq"). Har fan — o'z rangidagi belgi,
// savol va mavzu soni, qiyinlik bo'yicha taqsimot chizig'i. Tanlangan karta o'z rangida
// yorishadi; oxirida — «Yangi fan» kartasi, nomi shu kartaning o'zida yoziladi.

/** Bir-biridan aniq ajraladigan ranglar (HSL tusi) — qo'shni fanlar bir xil rangda chiqmaydi. */
const RANGLAR = [172, 262, 28, 338, 208, 96, 46, 300] as const;
/** Belgi: ikki so'zli nomda bosh harflar ("Ona tili" → Ot), aks holda birinchi ikki harf. */
function fanBelgisi(nom: string): string {
  const sozlar = nom.trim().split(/\s+/).filter(Boolean);
  const b = sozlar.length > 1 ? sozlar[0][0] + sozlar[1][0] : (sozlar[0] || '?').slice(0, 2);
  return b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
}

const KARTA = 'relative shrink-0 snap-start w-[228px] rounded-2xl border transition-all duration-200';

/** Qiyinlik taqsimoti: ingichka bo'lakli chiziq (savol yo'q bo'lsa — bo'sh iz). */
function Taqsimot({ soni }: { soni: number[] }) {
  const jami = soni.reduce((a, n) => a + n, 0);
  return (
    <span className="flex gap-[3px] h-[3px]" role="img" aria-label={QIYINLIK.map((q, i) => `${q.nom} ${soni[i] || 0}`).join(', ')}>
      {jami > 0
        ? QIYINLIK.map((q, i) => (soni[i] > 0 ? <span key={q.d} className={`rounded-full ${q.nuqta}`} style={{ flexGrow: soni[i], flexBasis: 6 }} /> : null))
        : <span className="flex-1 rounded-full bg-chiziq" />}
    </span>
  );
}

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
  useQiyinlik();
  const [qoshmoqda, setQoshmoqda] = useState(false);
  const [nomTahriri, setNomTahriri] = useState<number | null>(null);
  const [menyu, setMenyu] = useState<{ fan: BankFan; rect: DOMRect } | null>(null);

  return (
    <div role="tablist" aria-label="Fanlar" className="flex gap-3 overflow-x-auto snap-x pt-1 pb-2 -mx-1 px-1">
      {fanlar.map((f, i) => {
        const faol = f.id === faolId;
        const h = RANGLAR[i % RANGLAR.length];
        const soni = faol && faolSoni !== null ? faolSoni : f.jami - f.arxiv;
        if (nomTahriri === f.id) {
          return (
            <div key={f.id} className={`${KARTA} border-brand bg-sirt p-3.5 flex items-center`}>
              <QatorForma boshi={f.name} joy="Fan nomi" onYubor={nom => (nom === f.name ? true : onNom(f, nom))} onYop={() => setNomTahriri(null)} className="w-full" />
            </div>
          );
        }
        return (
          <div key={f.id}
            className={`${KARTA} group ${faol ? '' : 'border-chiziq bg-sirt hover:border-chiziq-kuchli hover:-translate-y-0.5 hover:shadow-md'}`}
            style={faol ? {
              borderColor: `hsl(${h} 62% 50%)`,
              background: `color-mix(in srgb, hsl(${h} 75% 50%) 10%, var(--color-sirt))`,
              boxShadow: `0 10px 26px -12px hsl(${h} 70% 45% / .6)`,
            } : undefined}>
            <button type="button" role="tab" aria-selected={faol} onClick={() => onFan(f.id)} className="block w-full text-left p-3.5 rounded-2xl cursor-pointer">
              <span className="flex items-center gap-3">
                <span aria-hidden className="w-11 h-11 shrink-0 rounded-[14px] flex items-center justify-center text-[15px] font-bold text-white transition-transform duration-200 group-hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, hsl(${h} 74% 54%), hsl(${h + 26} 70% 40%))`,
                    boxShadow: `inset 0 1px 0 hsl(0 0% 100% / .28), 0 4px 10px -4px hsl(${h} 70% 40% / .7)`,
                    opacity: faol ? 1 : 0.9,
                  }}>{fanBelgisi(f.name)}</span>
                <span className="min-w-0 flex-1 pr-5">
                  <span className="block truncate text-[14.5px] font-bold text-matn">{f.name}</span>
                  <span className="block truncate text-[11.5px] text-matn-sokin"><b className="raqam font-semibold text-matn">{soni}</b> savol · <b className="raqam font-semibold text-matn">{f.mavzular.length}</b> mavzu</span>
                </span>
              </span>
              <span className="mt-3 block"><Taqsimot soni={f.qiyinlik} /></span>
            </button>
            {tahrir && (
              <button type="button" aria-label={`${f.name} — nomini o'zgartirish yoki o'chirish`} title="Nomini o'zgartirish yoki o'chirish" aria-haspopup="menu"
                onClick={e => setMenyu({ fan: f, rect: e.currentTarget.getBoundingClientRect() })}
                className={`absolute top-2 right-2 p-1 rounded-lg text-matn-sokin hover:bg-ichki hover:text-matn cursor-pointer transition-opacity focus-visible:opacity-100 [@media(hover:none)]:opacity-100 ${faol ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <MoreHorizontal size={15} />
              </button>
            )}
          </div>
        );
      })}

      {kutilmoqda.map((nom, i) => (
        <div key={`k${i}`} className={`${KARTA} border-dashed border-chiziq-kuchli bg-sirt p-3.5 flex items-center gap-3 text-[13px] text-matn-xira`}>
          <Loader2 size={15} className="animate-spin shrink-0" /><span className="truncate">{nom}</span>
        </div>
      ))}

      {tahrir && (qoshmoqda ? (
        <div className={`${KARTA} border-brand bg-sirt p-3.5 flex flex-col justify-center gap-1.5`}>
          <span className="text-[11.5px] font-semibold text-matn-sokin">Yangi fan</span>
          <QatorForma joy="Nomi, masalan Kimyo" onYubor={onQosh} onYop={() => setQoshmoqda(false)} />
        </div>
      ) : (
        <button type="button" onClick={() => setQoshmoqda(true)}
          className={`${KARTA} group border-dashed border-chiziq-kuchli p-3.5 flex items-center gap-3 text-left cursor-pointer text-matn-sokin hover:border-brand hover:text-brand hover:bg-brand-fon/40 dark:hover:bg-brand/10`}>
          <span aria-hidden className="w-11 h-11 shrink-0 rounded-[14px] bg-ichki group-hover:bg-brand group-hover:text-brand-ust flex items-center justify-center transition-colors"><Plus size={19} /></span>
          <span className="min-w-0">
            <span className="block text-[14.5px] font-bold">Yangi fan</span>
            <span className="block text-[11.5px] opacity-80">qo'shish</span>
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
