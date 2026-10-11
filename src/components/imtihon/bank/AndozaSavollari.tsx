import React, { useMemo } from 'react';
import { ArrowUp, ArrowDown, X, AlertTriangle, Layers, Plus } from 'lucide-react';
import { Tugma } from '../ui';
import { formulaliHtml, SAVOL_MATNI } from '../../../lib/matn';
import { andozaBirliklari, QISM_HARFLARI } from '../../../../lib/imtihon.js';
import { TUR_NOMI } from '../../../lib/savolTuri';
import { qiyinlikDaraja, useQiyinlik } from './qiyinlik';
import type { AndozaSavoli, SavolTuri } from '../../../types';

// Andozaga qo'shilgan savollar — qog'ozdagi tartibda, 1..N raqamlangan (imtihon sanaganidek:
// MS-33-35 guruhining har savoli o'z raqamida, MS-36-45 qismli savol — bitta raqam, a) b)).
// Guruhli savol va bitta matnning savollari birga turadi, birga suriladi va birga olinadi.
// Varaqda savollar turi bo'yicha bo'limlarda turgani uchun tartib bo'lim ichida o'zgaradi.

interface Birlik { kalit: string; tur: SavolTuri; pa: number | null; bolim: string; idlar: number[]; boshi: number; soni: number }

const MATN = `${SAVOL_MATNI} text-[13px] text-matn line-clamp-2 [&_p]:my-0 [&_img]:max-h-10`;
const AMAL = 'p-1.5 rounded-lg text-matn-xira hover:text-matn hover:bg-ichki cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent';

export default function AndozaSavollari({ savollar, soni, tahrir, onOlib, onTartib, onKor, onQosh }: {
  savollar: AndozaSavoli[];
  /** Andozaga nechta savol kerak — bo'sh o'rinlar shundan. */
  soni: number; tahrir: boolean;
  onOlib: (ids: number[]) => void; onTartib: (ids: number[]) => void; onKor: (q: AndozaSavoli) => void; onQosh?: () => void;
}) {
  useQiyinlik();
  const byId = useMemo(() => new Map(savollar.map(q => [q.id, q])), [savollar]);
  const birliklar = useMemo(() => andozaBirliklari(savollar) as Birlik[], [savollar]);
  const jami = birliklar.reduce((a, u) => a + u.soni, 0);
  // Har bo'limning raqamlar oralig'i (sarlavhasi uchun) — bir nechta tur bo'lsagina ko'rinadi.
  const oraliq = useMemo(() => {
    const m = new Map<string, { dan: number; gacha: number }>();
    for (const u of birliklar) m.set(u.bolim, { dan: m.get(u.bolim)?.dan ?? u.boshi, gacha: u.boshi + u.soni - 1 });
    return m;
  }, [birliklar]);
  const kopBolim = oraliq.size > 1;

  const qoshni = (i: number, d: -1 | 1) => (birliklar[i + d]?.bolim === birliklar[i].bolim ? i + d : -1);
  const sur = (i: number, d: -1 | 1) => {
    const j = qoshni(i, d);
    if (j < 0) return;
    const l = [...birliklar];
    [l[i], l[j]] = [l[j], l[i]];
    onTartib(l.flatMap(u => u.idlar));
  };

  return (
    <div>
      <ol aria-label="Andozadagi savollar">
        {birliklar.map((u, i) => {
          const azolar = u.idlar.map(id => byId.get(id)).filter(Boolean) as AndozaSavoli[];
          const bosh = azolar[0];
          if (!bosh) return null;
          const raqam = u.soni > 1 ? `${u.boshi}–${u.boshi + u.soni - 1}` : String(u.boshi);
          const guruhli = u.tur === 'juft' || u.tur === 'qismli';
          const tosiq = azolar.find(q => q.tushmaydi)?.tushmaydi;
          const dq = qiyinlikDaraja(bosh.difficulty);
          const mavzu = bosh.bankTopic?.name || bosh.topic || '';
          const o = oraliq.get(u.bolim)!;
          return (
            <React.Fragment key={u.kalit}>
              {kopBolim && (i === 0 || birliklar[i - 1].bolim !== u.bolim) && (
                <li className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-matn-xira bg-ichki/50 border-t border-chiziq first:border-t-0">
                  {TUR_NOMI[u.tur]} <span className="raqam font-semibold normal-case">· {o.dan === o.gacha ? `${o.dan}-savol` : `${o.dan}–${o.gacha}-savollar`}</span>
                </li>
              )}
              <li className={`flex items-start gap-2 pl-2 pr-2 sm:pl-3 py-2.5 border-t border-chiziq first:border-t-0 ${tosiq ? 'bg-ogoh-fon/50' : ''}`}>
                <span className="w-12 shrink-0 pt-0.5 text-right raqam text-[13px] font-bold text-matn">{raqam}.</span>
                <div className="min-w-0 flex-1">
                  {u.pa == null ? (
                    <button type="button" onClick={() => onKor(bosh)} className="block w-full text-left cursor-pointer rounded-lg hover:bg-ichki/60 -mx-1 px-1" title="Savolni to'liq ko'rish">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5 text-[11.5px] text-matn-xira">
                        <span className="inline-flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${dq.nuqta}`} />{dq.nom}</span>
                        {mavzu && <span className="truncate max-w-[55%]">{mavzu}</span>}
                        {u.tur !== 'yopiq' && !kopBolim && <span className="font-semibold text-brand-dark dark:text-brand-accent">{TUR_NOMI[u.tur]}</span>}
                        <span className="raqam" title="Savolning bankdagi raqami (ID)">#{bosh.id}</span>
                      </span>
                      <div className={MATN} dangerouslySetInnerHTML={{ __html: formulaliHtml(bosh.text || '') || (bosh.imageUrl ? '<p>[rasm]</p>' : '<p>—</p>') }} />
                    </button>
                  ) : (
                    <div>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5 text-[11.5px] text-matn-xira">
                        <span className="inline-flex items-center gap-1 font-semibold text-brand-dark dark:text-brand-accent">
                          <Layers size={12} />{guruhli ? `${TUR_NOMI[u.tur]} · ${azolar.length} ta ${u.tur === 'qismli' ? 'qism' : 'savol'}` : `Matnli · ${azolar.length} ta savol`}
                        </span>
                        {mavzu && <span className="truncate max-w-[55%]">{mavzu}</span>}
                        <span className="raqam" title="Savollarning bankdagi raqamlari (ID)">#{u.idlar[0]}{u.idlar.length > 1 ? `–${u.idlar[u.idlar.length - 1]}` : ''}</span>
                      </p>
                      {bosh.passage?.text && <div className={MATN} dangerouslySetInnerHTML={{ __html: formulaliHtml(bosh.passage.text) }} />}
                      <ol className="mt-1 space-y-0.5">
                        {azolar.map((q, k) => (
                          <li key={q.id} className="flex items-start gap-1.5 text-[12.5px] text-matn-sokin">
                            <b className="shrink-0 raqam text-matn-xira">{u.tur === 'qismli' ? `${QISM_HARFLARI[k] || k + 1})` : `${u.boshi + k}.`}</b>
                            <span className={`${SAVOL_MATNI} min-w-0 flex-1 line-clamp-1 [&_p]:inline [&_p]:my-0 [&_img]:max-h-8`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.text || '') || (q.imageUrl ? '[rasm]' : '—') }} />
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {tosiq && <p className="mt-1 inline-flex items-start gap-1 text-[11.5px] font-semibold text-ogoh"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> Qog'ozga tushmaydi: {tosiq}</p>}
                </div>
                {tahrir && (
                  <span className="flex shrink-0">
                    <button type="button" aria-label={`${raqam}-savolni yuqoriga surish`} title="Yuqoriga" disabled={qoshni(i, -1) < 0} onClick={() => sur(i, -1)} className={AMAL}><ArrowUp size={14} /></button>
                    <button type="button" aria-label={`${raqam}-savolni pastga surish`} title="Pastga" disabled={qoshni(i, 1) < 0} onClick={() => sur(i, 1)} className={AMAL}><ArrowDown size={14} /></button>
                    <button type="button" aria-label={`${raqam}-savolni andozadan olib tashlash`} title="Andozadan olib tashlash (bankda qoladi)" onClick={() => onOlib(u.idlar)} className={`${AMAL} hover:!text-xato`}><X size={15} /></button>
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
      {jami < soni && (
        <div className={`mx-3 my-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-chiziq-kuchli px-3 py-3 ${jami ? '' : 'py-6'}`}>
          <span className="text-[12.5px] text-matn-sokin">
            {jami
              ? <><b className="raqam text-matn">{jami + 1}{soni > jami + 1 ? `–${soni}` : ''}</b>-savol uchun joy bo'sh <span className="text-matn-xira">· yana {soni - jami} ta savol kerak</span></>
              : <>Andozada hali savol yo'q — bankdan <b className="raqam text-matn">{soni}</b> ta savol qo'shing</>}
          </span>
          {onQosh && <Tugma kichik turi="asosiy" ikonka={<Plus size={13} />} onClick={onQosh}>Savol qo'shish</Tugma>}
        </div>
      )}
    </div>
  );
}
