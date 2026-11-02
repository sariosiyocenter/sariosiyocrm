import React, { useMemo } from 'react';
import { Karta } from './ui';
import { otishHolati, vergul } from '../../../lib/imtihon.js';
import type { ImtihonTafsil } from './turlar';

// Addmen «Group Performance Comparison»: har guruhda soni, eng yuqori / o'rtacha / eng past, o'tganlar
// ulushi va foiz oraliqlari bo'yicha taqsimot (qaysi guruh qayerda «qolib ketgan»).

interface Qator { score: number; percentage: number; groupId: number | null; groupName: string }

const ORALIQ = [[0, 39], [40, 59], [60, 79], [80, 89], [90, 100]] as const;
const RANG = ['bg-brand', 'bg-[#5b8def]', 'bg-ogoh', 'bg-yaxshi', 'bg-matn-sokin'];

export default function GuruhlarSolishtirish({ exam, natijalar }: { exam: ImtihonTafsil; natijalar: Qator[] }) {
  const s = exam.settings;
  const guruhlar = useMemo(() => {
    const m = new Map<string, Qator[]>();
    for (const r of natijalar) {
      const k = r.groupName || 'Tashqi qatnashchilar';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return [...m].map(([nom, l]) => {
      const ballar = l.map(r => r.score);
      const otdi = s.otish || Object.keys((s as any).bolimOtish || {}).length ? l.filter(r => otishHolati(s, r.score, r.percentage, (r as any).blockScores)).length : null;
      const taqsimot = ORALIQ.map(([a, b]) => l.filter(r => r.percentage >= a && r.percentage < b + 1).length);
      return { nom, soni: l.length, yuqori: Math.max(...ballar), ortacha: ballar.reduce((a, x) => a + x, 0) / l.length, past: Math.min(...ballar), otdi, taqsimot };
    }).sort((a, b) => b.ortacha - a.ortacha);
  }, [natijalar, s]);
  const grafikda = guruhlar.slice(0, RANG.length);
  const engKop = Math.max(1, ...grafikda.flatMap(g => g.taqsimot));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Karta sarlavha="Foiz oraliqlari bo'yicha" izoh="Har guruhda nechta o'quvchi qaysi oraliqda">
        <div className="flex items-end gap-3 h-52 pt-2" role="img" aria-label={grafikda.map(g => `${g.nom}: ${ORALIQ.map(([a, b], i) => `${a}–${b}% ${g.taqsimot[i]}`).join(', ')}`).join('; ')}>
          {ORALIQ.map(([a, b], i) => (
            <div key={a} className="flex-1 flex flex-col items-center gap-1.5 h-full">
              <div className="flex items-end gap-0.5 w-full flex-1">
                {grafikda.map((g, gi) => (
                  <div key={g.nom} className={`flex-1 rounded-t ${RANG[gi]}`} style={{ height: `${(g.taqsimot[i] / engKop) * 100}%`, minHeight: g.taqsimot[i] ? 3 : 0 }} title={`${g.nom}: ${g.taqsimot[i]}`} />
                ))}
              </div>
              <span className="text-[11px] text-matn-sokin raqam">{a}–{b}%</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px] text-matn-sokin">
          {grafikda.map((g, gi) => <span key={g.nom} className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${RANG[gi]}`} />{g.nom}</span>)}
        </div>
      </Karta>
      <Karta sarlavha="Guruhlar" izoh="Eng yuqori · o'rtacha · eng past ball" ichki="p-0">
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-[12.5px] min-w-[480px]">
            <thead className="bg-ichki text-matn-sokin text-[11.5px]">
              <tr>{['Guruh', 'Soni', 'Yuqori', "O'rtacha", 'Past', "O'tdi"].map(x => <th key={x} className={`px-3 py-2 font-semibold ${x === 'Guruh' ? 'text-left' : 'text-right'}`}>{x}</th>)}</tr>
            </thead>
            <tbody>
              {guruhlar.map(g => (
                <tr key={g.nom} className="border-t border-chiziq">
                  <td className="px-3 py-2 text-matn font-semibold">{g.nom}</td>
                  <td className="px-3 py-2 text-right raqam">{g.soni}</td>
                  <td className="px-3 py-2 text-right raqam">{vergul(g.yuqori)}</td>
                  <td className="px-3 py-2 text-right raqam font-semibold">{vergul(Math.round(g.ortacha * 10) / 10)}</td>
                  <td className="px-3 py-2 text-right raqam">{vergul(g.past)}</td>
                  <td className="px-3 py-2 text-right raqam">{g.otdi == null ? '—' : `${Math.round((g.otdi / g.soni) * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!s.otish && <p className="px-4 py-2.5 text-[11.5px] text-matn-xira">O'tish bali qo'yilmagan — «Sozlama va e'lon» da belgilansa, «O'tdi» ustuni to'ladi.</p>}
      </Karta>
    </div>
  );
}
