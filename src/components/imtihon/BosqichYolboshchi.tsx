import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Circle, Info, Lock } from 'lucide-react';
import { BOSQICHLAR, bosqichHolati, bosqichIndeksi } from '../../../lib/imtihonBosqich.js';
import type { ImtihonTafsil, TabId } from './turlar';

// «Men qayerdaman»: tablar ostidagi yo'l ko'rsatkichi. Shu bosqich nima uchun, tanlangan imtihon
// bo'yicha bajarildimi, yopiq bo'lsa — avval nima qilish kerak. Mantiq: lib/imtihonBosqich.js.
// Tajribali foydalanuvchi yig'ib qo'ya oladi (brauzerda eslab qolinadi).

const YIGILGAN_KALIT = 'imt_yolboshchi';
const oqi = () => { try { return localStorage.getItem(YIGILGAN_KALIT) === '1'; } catch { return false; } };

const HOLAT_KORINISHI = {
  tayyor: { Ikonka: Check, sinf: 'bg-yaxshi-fon text-yaxshi', nom: 'Bajarilgan' },
  jarayon: { Ikonka: Circle, sinf: 'bg-brand-fon text-brand dark:bg-brand/15', nom: 'Shu yerda ish bor' },
  bloklangan: { Ikonka: Lock, sinf: 'bg-ogoh-fon text-ogoh', nom: 'Hali yopiq' },
  bosh: { Ikonka: Info, sinf: 'bg-ichki text-matn-sokin', nom: 'Eslatma' },
} as const;

export default function BosqichYolboshchi({ tab, exam, onTab }: { tab: TabId; exam: ImtihonTafsil | null; onTab: (t: TabId) => void }) {
  const [yigilgan, setYigilgan] = useState(oqi);
  const i = bosqichIndeksi(tab);
  if (i < 0) return null;
  const bosqich = BOSQICHLAR[i];
  const h = bosqichHolati(tab, exam);
  const korinish = HOLAT_KORINISHI[h.holat as keyof typeof HOLAT_KORINISHI] ?? HOLAT_KORINISHI.bosh;
  const Ikonka = korinish.Ikonka;
  const oldingi = BOSQICHLAR[i - 1];
  const keyingi = BOSQICHLAR[i + 1];
  const keyingiYopiq = !!keyingi && !!exam && bosqichHolati(keyingi.id, exam).holat === 'bloklangan';
  const avval = h.avval ? BOSQICHLAR[bosqichIndeksi(h.avval)] : null;
  const almashtir = () => setYigilgan(v => {
    try { localStorage.setItem(YIGILGAN_KALIT, v ? '0' : '1'); } catch { /* eslab qolinmaydi */ }
    return !v;
  });

  return (
    <section aria-label="Bosqich yo'l ko'rsatkichi" className="bg-sirt border border-chiziq rounded-2xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 shrink-0 rounded-full bg-brand text-brand-ust text-[12px] font-bold flex items-center justify-center raqam">{i + 1}</span>
        <h2 className="text-[13.5px] font-bold text-matn">
          <span className="text-matn-xira font-semibold raqam">{i + 1} / {BOSQICHLAR.length}</span> · {bosqich.nom}
        </h2>
        <button type="button" onClick={almashtir} aria-expanded={!yigilgan} aria-label={yigilgan ? "Yo'l ko'rsatkichini ochish" : "Yo'l ko'rsatkichini yig'ish"}
          className="ml-auto p-1 rounded-lg text-matn-xira hover:text-matn hover:bg-ichki cursor-pointer">
          {yigilgan ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {!yigilgan && (
        <div className="mt-2 space-y-2.5">
          <p className="text-[12.5px] text-matn-sokin">{bosqich.maqsad}</p>
          {h.matn && (
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[12.5px] ${korinish.sinf}`} role="status">
              <Ikonka size={14} className="mt-0.5 shrink-0" strokeWidth={h.holat === 'tayyor' ? 3 : 2} aria-label={korinish.nom} />
              <span className="min-w-0 flex-1 text-matn">{h.matn}</span>
              {avval && (
                <button type="button" onClick={() => onTab(avval.id as TabId)}
                  className="shrink-0 inline-flex items-center gap-1 font-semibold underline underline-offset-2 cursor-pointer">
                  <ArrowLeft size={12} />Avval: {avval.nom}
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
            {oldingi && (
              <button type="button" onClick={() => onTab(oldingi.id as TabId)} className="inline-flex items-center gap-1 text-matn-sokin hover:text-matn cursor-pointer">
                <ArrowLeft size={12} />Oldingi: {oldingi.nom}
              </button>
            )}
            {keyingi && (
              <button type="button" onClick={() => onTab(keyingi.id as TabId)} className="inline-flex items-center gap-1 text-matn-sokin hover:text-matn cursor-pointer">
                Keyingi: {keyingi.nom}{keyingiYopiq && <Lock size={11} aria-label="hali yopiq" />}<ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
