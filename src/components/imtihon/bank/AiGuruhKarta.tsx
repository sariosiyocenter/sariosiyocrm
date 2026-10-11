import React from 'react';
import { AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { formulaliHtml, SAVOL_MATNI } from '../../../lib/matn';
import { HARFLAR } from '../../../../lib/imtihon.js';
import { Yorliq } from '../ui';
import { guruhNomi } from './faylTuri';
import type { RasmHolati } from './rasmNavbati';
import type { GuruhTuri } from '../../../types';

// Fayldan o'qilgan yoki AI tuzgan guruhli savol (MS-33-35 — moslashtirish guruhi, MS-36-45 — qismli
// savol): bankka yozishdan oldingi ko'rinishi va bankka yozish.

export interface AiGuruh {
  tur: GuruhTuri;
  /** Umumiy shart (HTML). */
  text: string;
  /** Moslashtirish: umumiy javoblar ro'yxati (HTML). */
  variantlar: string[];
  savollar: { text: string; javob: string; son: boolean }[];
  topic: string;
  difficulty: number;
  /** Foydalanuvchining o'z qiyinlik darajasi (bo'lmasa — asosiy daraja, `difficulty`). */
  darajaId?: number | null;
  raqam: string | null;
  javobManbasi: 'material' | 'ai' | 'yoq';
  xato: string | null;
  /** 'shablon' — Word shablonidan AI siz o'qildi (to'liq bo'lsa faol bo'lib tushadi); bo'lmasa AI o'qigan yoki tuzgan. */
  manba?: 'ai' | 'shablon';
  /** Word shablonidan: to'liq emas (javob yo'q, formula o'qilmagan) — qoralama bo'ladi. */
  chala?: string | null;
  /** To'plam — qaysi fayldan. */
  toplam?: string | null;
  /**
   * Umumiy shartning chizmasi (AI vektor qilib chizgan — rasmNavbati.tsx). Guruhda alohida rasm maydoni
   * yo'q: bankka yozishda shart matnining oxiriga <img> bo'lib qo'shiladi.
   */
  imageUrl?: string | null;
  /** Chizma qo'yilishidan oldingi shart («[rasm]» belgisi bilan). */
  aslMatn?: string;
  rasm?: RasmHolati;
  /** Qaysi AI so'rovidan (sahifalar to'plamidan) o'qildi — shart chizmasi o'sha sahifalar bo'yicha chiziladi. */
  partiya?: number;
  /** «AI tuzadi»: rasmdan o'qilgan namuna guruhning o'zi (chizmasi o'sha rasm bo'yicha chiziladi). */
  namuna?: boolean;
  kalit: number;
  tanlangan: boolean;
}

const QISM_HARFI = 'abcdefghij';

// AI kiritgan yoki tuzgan guruhli savol bankka doim QORALAMA bo'lib tushadi: oddiy savollarda javobni AI
// qayta yechib tekshiradi, guruhlarda bunday tekshiruv yo'q — "materialdan olindi" ham modelning o'z gapi.
// Ustoz bankda ko'zdan kechirib, faol qiladi. Word shablonidan (AI siz) o'qilgani esa markazning o'z
// savoli: to'liq bo'lsa — faol.
export const guruhFaolmi = (g: AiGuruh) => g.manba === 'shablon' && !g.xato && !g.chala && g.savollar.every(s => s.javob);

export function AiGuruhKarta({ g, onTanla, band, rasm }: {
  g: AiGuruh; onTanla: (tanlangan: boolean) => void; band?: boolean;
  /** Umumiy shartning chizma bloki (SavolRasmi) — shart ostida ko'rinadi. */
  rasm?: React.ReactNode;
}) {
  const nom = `${guruhNomi(g.tur)} · ${g.savollar.length} ta ${g.tur === 'moslash' ? 'savol' : 'qism'}`;
  return (
    <li className={`rounded-xl border p-3 ${g.tanlangan ? 'border-brand bg-brand-fon/40 dark:bg-brand/10' : 'border-chiziq bg-sirt'} ${g.xato ? 'opacity-70' : ''}`}>
      <label className="flex flex-wrap items-center gap-2 cursor-pointer">
        <input type="checkbox" className="w-[17px] h-[17px] accent-[var(--color-brand)]" checked={g.tanlangan} disabled={band || !!g.xato} aria-label={`${nom}ni tanlash`} onChange={e => onTanla(e.target.checked)} />
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-fon text-brand-dark dark:bg-brand/20 dark:text-brand-accent text-[11.5px] font-semibold"><Layers size={12} />{nom}</span>
        {g.raqam && <span className="text-[11.5px] text-matn-xira raqam">{g.manba === 'shablon' ? 'jadvalda' : 'materialda'} {g.raqam}-savol</span>}
        {g.topic && <span className="max-w-full truncate text-[11.5px] text-matn-sokin">mavzu: <b className="font-semibold text-matn">{g.topic}</b></span>}
        {g.xato ? <Yorliq rang="ogoh"><AlertTriangle size={11} /> {g.xato} — qo'shilmaydi</Yorliq>
          : g.manba === 'shablon' ? (guruhFaolmi(g) ? <Yorliq rang="yaxshi"><CheckCircle2 size={11} /> to'liq — faol bo'ladi</Yorliq>
            : <Yorliq rang="ogoh"><AlertTriangle size={11} /> {g.chala || "javobi yo'q savol bor"} — qoralama bo'ladi</Yorliq>)
            : g.javobManbasi === 'material' ? <Yorliq rang="yaxshi"><CheckCircle2 size={11} /> javoblar materialdan olindi</Yorliq>
              : g.javobManbasi === 'ai' ? <Yorliq>javoblarni AI yechdi — tekshiring</Yorliq>
                : <Yorliq rang="ogoh"><AlertTriangle size={11} /> javob topilmadi — bankda to'ldirasiz</Yorliq>}
      </label>
      <div className={`${SAVOL_MATNI} mt-2 text-[13.5px] text-matn [&_p]:my-0.5`} dangerouslySetInnerHTML={{ __html: formulaliHtml(g.text) || '<p>—</p>' }} />
      {rasm && <div className="mt-2">{rasm}</div>}
      <div className={`mt-2 grid gap-2 ${g.tur === 'moslash' ? 'grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,200px)]' : 'grid-cols-1'}`}>
        <ol className="space-y-1">
          {g.savollar.map((s, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-chiziq bg-ichki px-2.5 py-1.5 text-[13px]">
              <b className="shrink-0 text-matn-xira">{g.tur === 'moslash' ? `${i + 1}.` : `${QISM_HARFI[i]})`}</b>
              <span className={`${SAVOL_MATNI} min-w-0 flex-1 [&_p]:my-0`} dangerouslySetInnerHTML={{ __html: formulaliHtml(s.text) }} />
              <span className={`shrink-0 text-[12px] font-bold ${s.javob ? 'text-yaxshi' : 'text-xato'}`} title="To'g'ri javob">{s.javob || 'javob?'}</span>
            </li>
          ))}
        </ol>
        {g.tur === 'moslash' && (
          <ul className="space-y-1" aria-label="Umumiy javoblar ro'yxati">
            {g.variantlar.map((v, i) => (
              <li key={i} className="flex items-start gap-1.5 rounded-lg border border-chiziq bg-sirt px-2.5 py-1 text-[13px]">
                <b className="shrink-0 text-matn-xira">{HARFLAR[i]})</b>
                <span className={`${SAVOL_MATNI} min-w-0 flex-1 [&_p]:my-0`} dangerouslySetInnerHTML={{ __html: formulaliHtml(v) }} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

type Soro = <T>(usul: 'GET' | 'POST' | 'PUT' | 'DELETE', yol: string, body?: unknown) => Promise<T>;

/**
 * Fan mavzusining id si: nomi bo'yicha yaratadi; shu nomli mavzu allaqachon bor bo'lsa (oyna ochilgandan
 * keyin yaratilgan — masalan shu faylning oddiy savollari bilan) — bank tuzilmasidan topadi.
 */
export async function mavzuniTopYokiYarat(soro: Soro, fanId: number, nom: string): Promise<number> {
  try {
    return (await soro<{ id: number }>('POST', 'bank/mavzular', { subjectId: fanId, name: nom })).id;
  } catch (e: unknown) {
    const daraxt = await soro<{ fanlar: { id: number; mavzular: { id: number; name: string }[] }[] }>('GET', 'bank/daraxt');
    const bor = daraxt.fanlar.find(f => f.id === fanId)?.mavzular.find(m => m.name.toLowerCase() === nom.toLowerCase());
    if (!bor) throw e;
    return bor.id;
  }
}

/**
 * Tanlangan guruhlarni bankka yozadi (har biri — bitta `bank/guruhlar` so'rovi): AI o'qigani yoki tuzgani —
 * QORALAMA, Word shablonidan to'liq o'qilgani — faol. `mavzuIdOl` — mavzu nomidan id; `manba` — AI
 * guruhlarining manbasi («AI import», «AI tuzdi»). Bittasi yozilmasa qolganlari davom etadi;
 * yozilmaganlari `qolgan` da.
 */
export async function guruhlarniSaqla(soro: Soro, guruhlar: AiGuruh[], mavzuIdOl: (nom: string) => Promise<number>, manba: string): Promise<{ ids: number[]; soni: number; faolSoni: number; xatolar: string[]; qolgan: AiGuruh[] }> {
  const natija = { ids: [] as number[], soni: 0, faolSoni: 0, xatolar: [] as string[], qolgan: [] as AiGuruh[] };
  for (const g of guruhlar) {
    const faol = guruhFaolmi(g);
    // Chizma shart matnining oxiriga qo'shiladi (guruh kartasi va kitobcha shartni rasmi bilan chiqaradi).
    const shart = g.imageUrl ? `${g.text}<p><img src="${g.imageUrl.replace(/"/g, '&quot;')}" alt=""></p>` : g.text;
    try {
      const r = await soro<{ ids: number[] }>('POST', 'bank/guruhlar', {
        tur: g.tur, mavzuId: await mavzuIdOl(g.topic), text: shart, difficulty: g.difficulty, darajaId: g.darajaId || undefined,
        source: g.manba === 'shablon' ? undefined : manba, toplam: g.toplam || undefined, status: faol ? 'faol' : 'qoralama',
        variantlar: g.tur === 'moslash' ? g.variantlar : undefined,
        savollar: g.savollar.map(s => ({ text: s.text, javob: s.javob, son: s.son })),
      });
      natija.ids.push(...r.ids);
      natija.soni++;
      if (faol) natija.faolSoni++;
    } catch (e: unknown) {
      natija.xatolar.push(e instanceof Error ? e.message : 'Xatolik');
      natija.qolgan.push(g);
    }
  }
  return natija;
}
