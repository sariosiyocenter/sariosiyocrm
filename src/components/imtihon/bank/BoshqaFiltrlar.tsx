import React from 'react';
import { TUR_NOMI } from '../../../lib/savolTuri';
import {
  almashtirRoyxat, DARS_NOMI, HOLAT_NOMI, ISHLATILGAN_NOMI, JOYLASHUV_NOMI, NATIJA_NOMI, RASM_NOMI, TABLETKA, TARJIMA_NOMI,
  YANGI_NOMI, YECHIM_HOLATI_NOMI, YECHIM_NOMI, type BorYoq, type Holat, type Saralash,
} from './bankTurlari';
import type { BankFiltrMalumoti, DarsFiltri, NatijaFiltri, SavolTuri, YangiKun } from '../../../types';

// Bank ro'yxatining «Boshqa filtrlar» paneli: tartib, savol turi, rasm, yechim (va uning holati),
// video dars, holat, manba, fayl, izoh, matn, joylashuv, ishlatilgani, natija bo'yicha qiyinlik,
// tarjima, qo'shilgan vaqti va QID oralig'i. (Mavzu, qiyinlik va foydalanuvchining o'z
// filtrlari — chap panelda: BankJadvali.tsx.)

const DARS_TARTIBI: DarsFiltri[] = ['tasdiqlangan', 'qoralama', 'eskirgan', 'yoq'];
const NATIJA_TARTIBI: NatijaFiltri[] = ['oson', 'orta', 'qiyin', 'yoq'];
const YANGI_TARTIBI: YangiKun[] = [1, 7, 30];

/** Panelda nechta saralash yoqilgan (tugmadagi son). */
export const boshqaFiltrSoni = (s: Saralash) => (s.tur ? 1 : 0) + (s.rasm ? 1 : 0) + (s.yechim ? 1 : 0) + (s.holat ? 1 : 0) + s.manbalar.length
  + (s.toplam !== null ? 1 : 0) + s.izohlar.length + (s.matnli ? 1 : 0) + s.joylashuv.length + (s.qidDan || s.qidGacha ? 1 : 0)
  + (s.yechimHolati ? 1 : 0) + s.dars.length + (s.ishlatilgan ? 1 : 0) + s.natija.length + (s.tarjima ? 1 : 0) + (s.yangi ? 1 : 0);

export default function BoshqaFiltrlar({ filtr, s, setS, tartib, setTartib }: {
  filtr: BankFiltrMalumoti; s: Saralash; setS: React.Dispatch<React.SetStateAction<Saralash>>;
  tartib: 'asc' | 'desc'; setTartib: (t: 'asc' | 'desc') => void;
}) {
  /** Qo'shimcha filtrlar sonlari (serverdan kelmasa — tugmalar sonsiz). */
  const q = filtr.qoshimcha ?? undefined;
  /** Ikki holatli saralash (bor / yo'q): yana bosilsa — olinadi; son serverdan kelmagan bo'lsa — sonsiz. */
  const borYoq = (kalit: 'rasm' | 'yechim' | 'matnli' | 'ishlatilgan' | 'tarjima', nomlar: Record<Exclude<BorYoq, ''>, string>, sonlar?: { bor: number; yoq: number } | null) => (
    <div className="flex flex-wrap gap-1.5">
      {(['bor', 'yoq'] as const).map(k => (
        <button key={k} type="button" aria-pressed={s[kalit] === k} onClick={() => setS(x => ({ ...x, [kalit]: x[kalit] === k ? '' : k }))} className={TABLETKA(s[kalit] === k)}>
          {nomlar[k]}{sonlar && <span className="raqam text-[11px] opacity-70">{sonlar[k]}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <section aria-label="Boshqa filtrlar" className="bg-sirt border border-chiziq rounded-2xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 [&>section]:border-b [&>section]:border-chiziq">
      <Bolim nom="Tartib">
        <div className="flex flex-wrap gap-1.5">
          {([['asc', 'Raqami bo\'yicha'], ['desc', 'Yangilari avval']] as const).map(([v, nom]) => (
            <button key={v} type="button" aria-pressed={tartib === v} onClick={() => setTartib(v)} className={TABLETKA(tartib === v)}>{nom}</button>
          ))}
        </div>
      </Bolim>
      <Bolim nom="Savol turi" tanlangan={s.tur ? 1 : 0}>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TUR_NOMI) as SavolTuri[]).filter(k => filtr.turlar[k] || s.tur === k).map(k => (
            <button key={k} type="button" aria-pressed={s.tur === k} onClick={() => setS(x => ({ ...x, tur: x.tur === k ? '' : k }))} className={TABLETKA(s.tur === k)}>
              {TUR_NOMI[k]}<span className="raqam text-[11px] opacity-70">{filtr.turlar[k]}</span>
            </button>
          ))}
          {!(Object.keys(TUR_NOMI) as SavolTuri[]).some(k => filtr.turlar[k]) && <span className="text-[12px] text-matn-xira">Savol yo'q</span>}
        </div>
      </Bolim>
      <Bolim nom="Rasm" tanlangan={s.rasm ? 1 : 0}>
        {borYoq('rasm', RASM_NOMI, filtr.rasmli)}
        <p className="mt-1.5 text-[11px] text-matn-xira">Rasm savolning o'zida, variantida yoki umumiy shartida</p>
      </Bolim>
      <Bolim nom="Yechim" tanlangan={(s.yechim ? 1 : 0) + (s.yechimHolati ? 1 : 0)}>
        {borYoq('yechim', YECHIM_NOMI, filtr.yechimli)}
        <div className="mt-1.5">
          <Tabletkalar qiymatlar={(['tasdiqlangan', 'qoralama'] as const).map(k => ({ k, nom: YECHIM_HOLATI_NOMI[k], soni: q?.yechim[k] }))}
            tanlangan={k => s.yechimHolati === k} onBos={k => setS(x => ({ ...x, yechimHolati: x.yechimHolati === k ? '' : k }))} />
        </div>
        <p className="mt-1.5 text-[11px] text-matn-xira">Tasdiqlangan — ustoz tekshirib tasdiqlagan yechim; qolgani — AI qoralamasi</p>
      </Bolim>
      <Bolim nom="Video dars" tanlangan={s.dars.length}>
        <Tabletkalar qiymatlar={DARS_TARTIBI.map(k => ({ k, nom: DARS_NOMI[k], soni: q?.dars[k] }))}
          tanlangan={k => s.dars.includes(k)} onBos={k => setS(x => ({ ...x, dars: almashtirRoyxat(x.dars, k) }))} />
        <p className="mt-1.5 text-[11px] text-matn-xira">Eskirgan — yechim o'zgargani uchun o'quvchiga ko'rinmaydi, qayta tuzish kerak</p>
      </Bolim>
      <Bolim nom="Holati" tanlangan={s.holat ? 1 : 0}>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(HOLAT_NOMI) as Exclude<Holat, ''>[]).map(k => (
            <button key={k} type="button" aria-pressed={s.holat === k} onClick={() => setS(x => ({ ...x, holat: x.holat === k ? '' : k }))} className={TABLETKA(s.holat === k)}>
              {HOLAT_NOMI[k]}<span className="raqam text-[11px] opacity-70">{filtr.holat[k]}</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-matn-xira">Tanlanmasa — faol va qoralama (arxiv yashirin)</p>
      </Bolim>
      {filtr.manbalar.some(m => m.nom) && (
        <Bolim nom="Manba" tanlangan={s.manbalar.length}>
          <Belgilar qiymatlar={filtr.manbalar.map(m => ({ k: m.nom, nom: m.nom || <i className="text-matn-xira">Manbasiz</i>, soni: m.soni }))}
            tanlangan={s.manbalar} onChange={v => setS(x => ({ ...x, manbalar: v }))} />
        </Bolim>
      )}
      {filtr.toplamlar.some(m => m.nom) && (
        <Bolim nom="To'plam (fayl)" tanlangan={s.toplam !== null ? 1 : 0}>
          <Belgilar qiymatlar={filtr.toplamlar.map(x => ({ k: x.nom, nom: x.nom || <i className="text-matn-xira">To'plamsiz</i>, soni: x.soni }))}
            tanlangan={s.toplam !== null ? [s.toplam] : []} onChange={v => setS(x => ({ ...x, toplam: v.length ? v[v.length - 1] : null }))} />
        </Bolim>
      )}
      {filtr.izohlar.some(x => x.nom) && (
        <Bolim nom="Izoh (remark)" tanlangan={s.izohlar.length}>
          <Belgilar qiymatlar={filtr.izohlar.map(x => ({ k: x.nom, nom: x.nom || <i className="text-matn-xira">Izohsiz</i>, soni: x.soni }))}
            tanlangan={s.izohlar} onChange={v => setS(x => ({ ...x, izohlar: v }))} />
        </Bolim>
      )}
      {filtr.matnli.bor > 0 && (
        <Bolim nom="Matnli savollar (passage)" tanlangan={s.matnli ? 1 : 0}>
          {borYoq('matnli', { bor: "Matnga bog'langan", yoq: 'Matnsiz' }, filtr.matnli)}
        </Bolim>
      )}
      {(filtr.joylashuv['1'] + filtr.joylashuv['2'] + filtr.joylashuv['4']) > 0 && (
        <Bolim nom="Variantlar joylashuvi" tanlangan={s.joylashuv.length}>
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 4].filter(j => filtr.joylashuv[String(j) as '0'] || s.joylashuv.includes(j)).map(j => (
              <button key={j} type="button" aria-pressed={s.joylashuv.includes(j)} onClick={() => setS(x => ({ ...x, joylashuv: almashtirRoyxat(x.joylashuv, j) }))} className={TABLETKA(s.joylashuv.includes(j))}>
                {JOYLASHUV_NOMI[j]}<span className="raqam text-[11px] opacity-70">{filtr.joylashuv[String(j) as '0']}</span>
              </button>
            ))}
          </div>
        </Bolim>
      )}
      <Bolim nom="Imtihonda ishlatilgan" tanlangan={s.ishlatilgan ? 1 : 0}>
        {borYoq('ishlatilgan', ISHLATILGAN_NOMI, q?.ishlatilgan)}
      </Bolim>
      <Bolim nom="Natija bo'yicha qiyinlik" tanlangan={s.natija.length}>
        <Tabletkalar qiymatlar={NATIJA_TARTIBI.map(k => ({ k, nom: NATIJA_NOMI[k], soni: q?.natija[k] }))}
          tanlangan={k => s.natija.includes(k)} onBos={k => setS(x => ({ ...x, natija: almashtirRoyxat(x.natija, k) }))} />
        <p className="mt-1.5 text-[11px] text-matn-xira">Imtihondagi to'g'ri topganlar ulushi (belgilangan qiyinlikdan alohida)</p>
      </Bolim>
      <Bolim nom="Tarjima" tanlangan={s.tarjima ? 1 : 0}>
        {borYoq('tarjima', TARJIMA_NOMI, q?.tarjimali)}
      </Bolim>
      <Bolim nom="Qo'shilgan vaqti" tanlangan={s.yangi ? 1 : 0}>
        <Tabletkalar qiymatlar={YANGI_TARTIBI.map(k => ({ k, nom: YANGI_NOMI[k], soni: q?.yangi[k] }))}
          tanlangan={k => s.yangi === k} onBos={k => setS(x => ({ ...x, yangi: x.yangi === k ? 0 : k }))} />
      </Bolim>
      <Bolim nom="Savol raqami (QID) oralig'i" tanlangan={s.qidDan || s.qidGacha ? 1 : 0}>
        <div className="flex items-center gap-2">
          <input className="w-full min-w-0 px-2.5 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12.5px] raqam focus:border-brand" style={{ outline: 'none' }} inputMode="numeric" placeholder="dan" aria-label="QID dan"
            value={s.qidDan} onChange={e => setS(x => ({ ...x, qidDan: e.target.value.replace(/\D/g, '') }))} />
          <span className="text-matn-xira">–</span>
          <input className="w-full min-w-0 px-2.5 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12.5px] raqam focus:border-brand" style={{ outline: 'none' }} inputMode="numeric" placeholder="gacha" aria-label="QID gacha"
            value={s.qidGacha} onChange={e => setS(x => ({ ...x, qidGacha: e.target.value.replace(/\D/g, '') }))} />
        </div>
      </Bolim>
    </section>
  );
}

/** Tabletka-tugmalar qatori: har birida nomi va (serverdan kelgan bo'lsa) soni; bosilganda `onBos`. */
function Tabletkalar<K extends string | number>({ qiymatlar, tanlangan, onBos }: {
  qiymatlar: { k: K; nom: string; soni?: number }[]; tanlangan: (k: K) => boolean; onBos: (k: K) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {qiymatlar.map(({ k, nom, soni }) => (
        <button key={String(k)} type="button" aria-pressed={tanlangan(k)} onClick={() => onBos(k)} className={TABLETKA(tanlangan(k))}>
          {nom}{soni !== undefined && <span className="raqam text-[11px] opacity-70">{soni}</span>}
        </button>
      ))}
    </div>
  );
}

/** "Boshqa filtrlar" bo'limi: sarlavha va ichidagi qiymatlar. */
function Bolim({ nom, tanlangan = 0, children }: { nom: string; tanlangan?: number; children: React.ReactNode }) {
  return (
    <section className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12.5px] font-semibold text-matn">{nom}</span>
        {tanlangan > 0 && <span className="raqam text-[11px] font-bold min-w-5 text-center px-1.5 rounded-md bg-brand text-brand-ust">{tanlangan}</span>}
      </div>
      {children}
    </section>
  );
}

/** Belgilash ro'yxati: har qatorda qiymat va nechta savol. */
function Belgilar<K extends string | number>({ qiymatlar, tanlangan, onChange }: {
  qiymatlar: { k: K; nom: React.ReactNode; soni?: number }[]; tanlangan: K[]; onChange: (v: K[]) => void;
}) {
  return (
    <ul className="max-h-44 overflow-y-auto -mx-1.5">
      {qiymatlar.map(q => {
        const b = tanlangan.includes(q.k);
        return (
          <li key={String(q.k)}>
            <label className={`flex items-center gap-2 px-1.5 py-1 rounded-lg text-[12.5px] cursor-pointer select-none ${b ? 'bg-brand-fon/70 dark:bg-brand/10' : 'hover:bg-ichki'}`}>
              <input type="checkbox" className="w-3.5 h-3.5 shrink-0 accent-[var(--color-brand)] cursor-pointer" checked={b} onChange={() => onChange(almashtirRoyxat(tanlangan, q.k))} />
              <span className={`flex-1 min-w-0 truncate ${b ? 'font-semibold text-matn' : 'text-matn'}`}>{q.nom}</span>
              {q.soni !== undefined && <span className={`shrink-0 raqam text-[11px] ${q.soni ? 'text-matn-xira' : 'text-matn-xira/50'}`}>{q.soni}</span>}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
