import React, { memo, useMemo } from 'react';
import { Folder, Layers, MoreHorizontal } from 'lucide-react';
import { formulaliHtml, SAVOL_MATNI } from '../../../lib/matn';
import { HARFLAR } from '../../../../lib/imtihon.js';
import { Yorliq } from '../ui';
import type { BelgiGuruhi, GuruhTuri, Question } from '../../../types';

// Guruhli savol kartasi (Milliy sertifikat): umumiy shart bir marta, ostida kichik savollar.
// Moslashtirishda — o'ngda umumiy javoblar ro'yxati (to'g'ri javoblar qaysi savolniki ekani
// bilan); qismli savolda — a), b) qismlari, har birining javobi va kim tekshirishi.
// Yorliqlar (mavzu, qiyinlik, filtrlar) guruhdagi hamma savolga birdaniga qo'yiladi.

export type GuruhSavoli = Pick<Question, 'id' | 'text' | 'type' | 'difficulty' | 'status' | 'tagIds' | 'correctAnswer' | 'answers' | 'usedCount'>;
/** Guruh kartasidan ochiladigan menyular. */
export type GuruhMenyusi = 'mavzu' | 'daraja' | 'guruh' | 'guruhkarta';

const CHIP = 'inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-md border text-[11.5px] font-semibold whitespace-nowrap';
const CHIP_BOR = `${CHIP} border-chiziq bg-ichki text-matn`;
const CHIP_BOSH = `${CHIP} border-dashed border-chiziq-kuchli text-matn-xira`;
const QISM_HARFI = 'abcdefghij';

interface GuruhKartaProps {
  /** Shu sahifada ko'rinayotgan bo'laklar (id bo'yicha tartibda). */
  savollar: GuruhSavoli[];
  /** Guruhning hamma bo'laklari id lari — belgilash va yorliqlar hammasiga qo'llanadi. */
  hammaIdlar: number[];
  tur: GuruhTuri;
  /** Umumiy shart (HTML). */
  shart: string;
  /** Moslashtirish: umumiy javoblar ro'yxati (HTML). */
  variantlar: string[];
  /** Ro'yxatdagi birinchi savolining tartib raqami. */
  boshRaqam: number;
  /** Guruhdagi hamma savol belgilangan. */
  tanlangan: boolean;
  tanlanadi: boolean;
  tahrir: boolean;
  yangi: boolean;
  mavzu: string;
  darajaNom: string;
  darajaNuqta: string;
  guruhlar: BelgiGuruhi[];
  onTanla: (ids: number[], tanlansin: boolean) => void;
  onMenyu: (tur: GuruhMenyusi, el: HTMLElement, ids: number[], guruh?: number) => void;
}

export default memo(function GuruhKarta({ savollar, hammaIdlar: ids, tur, shart, variantlar, boshRaqam, tanlangan, tanlanadi, tahrir, yangi, mavzu, darajaNom, darajaNuqta, guruhlar, onTanla, onMenyu }: GuruhKartaProps) {
  /** Bo'lakning guruhdagi o'rni (0 dan) — sahifada hammasi ko'rinmasa ham harfi va raqami to'g'ri chiqadi. */
  const orni = (id: number) => Math.max(0, ids.indexOf(id));
  const shartHtml = useMemo(() => formulaliHtml(shart || ''), [shart]);
  const variantHtml = useMemo(() => variantlar.map(v => formulaliHtml(v)), [variantlar]);
  const teglar = savollar[0]?.tagIds || [];
  const ishlatilgan = Math.max(0, ...savollar.map(q => q.usedCount || 0));
  const raqamlar = savollar.length > 1 ? `${boshRaqam}–${boshRaqam + savollar.length - 1}.` : `${boshRaqam}.`;
  const yorliq = (m: GuruhMenyusi, sinf: string, nom: string, ichi: React.ReactNode, guruh?: number) => (tahrir
    ? <button key={`${m}${guruh || ''}`} type="button" title={nom} aria-label={`Guruh ${raqamlar} ${nom}`} aria-haspopup="menu" className={`${sinf} cursor-pointer hover:border-brand`} onClick={e => onMenyu(m, e.currentTarget, ids, guruh)}>{ichi}</button>
    : <span key={`${m}${guruh || ''}`} title={nom} className={sinf}>{ichi}</span>);
  /** Harf → shu javob qaysi kichik savol(lar)niki. */
  const egalari = (harf: string) => savollar.map(q => (String(q.correctAnswer || '').toUpperCase() === harf ? orni(q.id) + 1 : 0)).filter(Boolean);

  return (
    <li aria-label={`Guruhli savol ${raqamlar}`}
      className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 pl-2.5 pr-3 py-3 rounded-xl border transition-colors ${tanlangan ? 'border-brand bg-brand-fon/50 dark:bg-brand/10' : 'border-chiziq bg-sirt'}`}>
      <div className="pt-0.5">
        {tanlanadi ? <input type="checkbox" aria-label={`Guruh ${raqamlar} savollarini tanlash`} className="w-[17px] h-[17px] accent-[var(--color-brand)] cursor-pointer" checked={tanlangan} onChange={e => onTanla(ids, e.target.checked)} /> : <span className="block w-1" />}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="raqam text-[13px] font-bold text-matn mr-0.5">{raqamlar}</span>
          {yangi && <span className="px-1.5 py-0.5 rounded-md bg-yaxshi-fon text-yaxshi text-[10.5px] font-bold">yangi</span>}
          <span className={`${CHIP} border-transparent bg-brand-fon text-brand-dark dark:bg-brand/20 dark:text-brand-accent`}><Layers size={12} className="shrink-0" />{tur === 'moslash' ? `Moslashtirish · ${ids.length} ta savol` : `Qismli savol · ${ids.length} ta qism`}</span>
          {yorliq('mavzu', mavzu ? CHIP_BOR : CHIP_BOSH, mavzu ? `mavzu — ${mavzu}` : "mavzusi yo'q", <><Folder size={12} className="shrink-0" /><span className="truncate max-w-56">{mavzu || 'mavzu?'}</span></>)}
          {yorliq('daraja', CHIP_BOR, `qiyinlik — ${darajaNom}`, <><span className={`w-2 h-2 rounded-full shrink-0 ${darajaNuqta}`} /><span className="truncate max-w-40">{darajaNom}</span></>)}
          {guruhlar.map(g => {
            const t = g.tags.find(x => teglar.includes(x.id));
            if (t) return yorliq('guruh', CHIP_BOR, `${g.name} — ${t.name}`, <span className="truncate max-w-40">{t.name}</span>, g.id);
            return g.tags.length && tahrir ? yorliq('guruh', CHIP_BOSH, `${g.name} qo'yilmagan`, <span className="truncate max-w-40">{g.name.toLowerCase()}?</span>, g.id) : null;
          })}
          {savollar.some(q => q.status === 'qoralama') && <Yorliq rang="ogoh">Qoralama</Yorliq>}
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-matn-xira">
            {ishlatilgan > 0 && <span>{ishlatilgan} marta ishlatilgan</span>}
            <span className="raqam" title="Guruhdagi savollarning bankdagi doimiy raqamlari (ID)">ID {ids[0]}{ids.length > 1 ? `–${ids[ids.length - 1]}` : ''}</span>
            <button type="button" aria-label={`Guruh ${raqamlar} amallar`} title="Tahrirlash, o'chirish" aria-haspopup="menu" onClick={e => onMenyu('guruhkarta', e.currentTarget, ids)}
              className="p-1 -mr-1 rounded-lg text-matn-sokin hover:bg-ichki hover:text-matn cursor-pointer"><MoreHorizontal size={16} /></button>
          </span>
        </div>

        <div className={`${SAVOL_MATNI} mt-1.5 text-[14px] text-matn [&_p]:my-0.5`} dangerouslySetInnerHTML={{ __html: shartHtml || '<p>—</p>' }} />

        {tur === 'moslash' ? (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)] gap-2.5">
            <ol className="space-y-1.5">
              {savollar.map(q => (
                <li key={q.id} className="flex items-start gap-2 rounded-lg border border-chiziq bg-ichki px-2.5 py-1.5 text-[13px]">
                  <b className="shrink-0 text-matn-xira raqam">{orni(q.id) + 1}.</b>
                  <span className={`${SAVOL_MATNI} min-w-0 flex-1 [&_p]:my-0`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.text || '') }} />
                  <span className="shrink-0 inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md bg-yaxshi-fon text-yaxshi text-[12.5px] font-bold" title="To'g'ri javob">{q.correctAnswer || '?'}</span>
                </li>
              ))}
            </ol>
            <ul className="space-y-1" aria-label="Umumiy javoblar ro'yxati">
              {variantHtml.map((h, i) => {
                const kimniki = egalari(HARFLAR[i]);
                return (
                  <li key={i} className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] ${kimniki.length ? 'bg-yaxshi-fon border-yaxshi/40' : 'bg-sirt border-chiziq'}`}>
                    <b className={`shrink-0 ${kimniki.length ? 'text-yaxshi' : 'text-matn-xira'}`}>{HARFLAR[i]})</b>
                    <span className={`${SAVOL_MATNI} min-w-0 flex-1 [&_p]:my-0`} dangerouslySetInnerHTML={{ __html: h }} />
                    {kimniki.length > 0 && <span className="shrink-0 text-[11px] font-semibold text-yaxshi whitespace-nowrap">{kimniki.join(', ')}-savol</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {savollar.map(q => {
              const son = Array.isArray(q.answers) && q.answers.length > 0;
              return (
                <li key={q.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg border border-chiziq bg-ichki px-2.5 py-1.5 text-[13px]">
                  <span className="flex items-start gap-2 min-w-0 flex-1 basis-60">
                    <b className="shrink-0 text-matn-xira">{QISM_HARFI[orni(q.id)]})</b>
                    <span className={`${SAVOL_MATNI} min-w-0 flex-1 [&_p]:my-0`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.text || '') }} />
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-2">
                    <span className="text-matn-sokin">Javob: <b className="text-yaxshi raqam">{q.correctAnswer || '—'}</b></span>
                    <span className="px-1.5 py-0.5 rounded-md border border-chiziq bg-sirt text-[11px] font-semibold text-matn-sokin" title="Bu qismni kim tekshiradi">{son ? 'skaner (son)' : 'ustoz'}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </li>
  );
});
