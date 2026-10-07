import React from 'react';
import { AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { formulaliHtml, SAVOL_MATNI } from '../../../lib/matn';
import { HARFLAR } from '../../../../lib/imtihon.js';
import { Yorliq } from '../ui';
import type { GuruhTuri } from '../../../types';

// AI topgan yoki tuzgan guruhli savol (moslashtirish guruhi, qismli savol): bankka yozishdan
// oldingi ko'rinishi va bankka yozish. Javoblari materialda belgilangan guruh — faol, AI o'zi
// yechgani yoki javobsizi — qoralama bo'lib tushadi (bankda guruh kartasidan tekshirib faol qilinadi).

export interface AiGuruh {
  tur: GuruhTuri;
  /** Umumiy shart (HTML). */
  text: string;
  /** Moslashtirish: umumiy javoblar ro'yxati (HTML). */
  variantlar: string[];
  savollar: { text: string; javob: string; son: boolean }[];
  topic: string;
  difficulty: number;
  raqam: string | null;
  javobManbasi: 'material' | 'ai' | 'yoq';
  xato: string | null;
  kalit: number;
  tanlangan: boolean;
}

const QISM_HARFI = 'abcdefghij';

// AI kiritgan yoki tuzgan guruhli savol bankka doim QORALAMA bo'lib tushadi: oddiy savollarda javobni AI
// qayta yechib tekshiradi, guruhlarda bunday tekshiruv yo'q — "materialdan olindi" ham modelning o'z gapi.
// Ustoz bankda ko'zdan kechirib, faol qiladi.

export function AiGuruhKarta({ g, onTanla, band }: { g: AiGuruh; onTanla: (tanlangan: boolean) => void; band?: boolean }) {
  const nom = g.tur === 'moslash' ? `Moslashtirish guruhi · ${g.savollar.length} ta savol` : `Qismli savol · ${g.savollar.length} ta qism`;
  return (
    <li className={`rounded-xl border p-3 ${g.tanlangan ? 'border-brand bg-brand-fon/40 dark:bg-brand/10' : 'border-chiziq bg-sirt'} ${g.xato ? 'opacity-70' : ''}`}>
      <label className="flex flex-wrap items-center gap-2 cursor-pointer">
        <input type="checkbox" className="w-[17px] h-[17px] accent-[var(--color-brand)]" checked={g.tanlangan} disabled={band || !!g.xato} aria-label={`${nom}ni tanlash`} onChange={e => onTanla(e.target.checked)} />
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-fon text-brand-dark dark:bg-brand/20 dark:text-brand-accent text-[11.5px] font-semibold"><Layers size={12} />{nom}</span>
        {g.raqam && <span className="text-[11.5px] text-matn-xira raqam">materialda {g.raqam}-savol</span>}
        {g.xato ? <Yorliq rang="ogoh"><AlertTriangle size={11} /> {g.xato} — qo'shilmaydi</Yorliq>
          : g.javobManbasi === 'material' ? <Yorliq rang="yaxshi"><CheckCircle2 size={11} /> javoblar materialdan olindi</Yorliq>
            : g.javobManbasi === 'ai' ? <Yorliq>javoblarni AI yechdi — tekshiring</Yorliq>
              : <Yorliq rang="ogoh"><AlertTriangle size={11} /> javob topilmadi — bankda to'ldirasiz</Yorliq>}
      </label>
      <div className={`${SAVOL_MATNI} mt-2 text-[13.5px] text-matn [&_p]:my-0.5`} dangerouslySetInnerHTML={{ __html: formulaliHtml(g.text) || '<p>—</p>' }} />
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
 * Tanlangan guruhlarni bankka QORALAMA qilib yozadi (har biri — bitta `bank/guruhlar` so'rovi).
 * `mavzuIdOl` — mavzu nomidan id. Bittasi yozilmasa qolganlari davom etadi; yozilmaganlari `qolgan` da.
 */
export async function guruhlarniSaqla(soro: Soro, guruhlar: AiGuruh[], mavzuIdOl: (nom: string) => Promise<number>, manba: string): Promise<{ ids: number[]; soni: number; xatolar: string[]; qolgan: AiGuruh[] }> {
  const natija = { ids: [] as number[], soni: 0, xatolar: [] as string[], qolgan: [] as AiGuruh[] };
  for (const g of guruhlar) {
    try {
      const r = await soro<{ ids: number[] }>('POST', 'bank/guruhlar', {
        tur: g.tur, mavzuId: await mavzuIdOl(g.topic), text: g.text, difficulty: g.difficulty, source: manba, status: 'qoralama',
        variantlar: g.tur === 'moslash' ? g.variantlar : undefined,
        savollar: g.savollar.map(s => ({ text: s.text, javob: s.javob, son: s.son })),
      });
      natija.ids.push(...r.ids);
      natija.soni++;
    } catch (e: unknown) {
      natija.xatolar.push(e instanceof Error ? e.message : 'Xatolik');
      natija.qolgan.push(g);
    }
  }
  return natija;
}
