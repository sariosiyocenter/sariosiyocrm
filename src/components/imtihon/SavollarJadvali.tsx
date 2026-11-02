import React from 'react';
import { HARFLAR, vergul } from '../../../lib/imtihon.js';

// Addmen «Question Paper Analysis»: har savolda javoblar taqsimoti, kuchli/kuchsiz 27% da to'g'ri
// topganlar, qiyinlik, ajratish kuchi (farq), korrelyatsiya (point-biserial) va qisqa xulosa.

export interface TahlilQatori {
  q: number | string; t: string; jami: number; togri: number; bosh: number; tanlov: Record<string, number> | null;
  foiz: number; farq: number; yuqoriFoiz?: number; quyiFoiz?: number; pbis?: number | null; shubhali: boolean;
  topic: string; togriJavob: string | null; bekor: string | null; yorliq?: string | null;
}

const qiyinlik = (f: number) => (f >= 0.7 ? 'oson' : f >= 0.3 ? "o'rta" : 'qiyin');

/** Bir og'iz xulosa va rangi. */
export function savolXulosasi(sv: TahlilQatori, harflar: string[]): { matn: string; rang: string } {
  if (sv.bekor) return { matn: 'bekor qilingan', rang: 'text-matn-xira' };
  if (sv.jami < 5) return { matn: 'natija kam — xulosa chiqmaydi', rang: 'text-matn-xira' };
  if (sv.farq < 0 || (sv.pbis != null && sv.pbis < 0)) return { matn: "kuchlilar xato qilgan — kalitni tekshiring", rang: 'text-ogoh' };
  if (sv.foiz < 0.15) return { matn: 'juda qiyin — kalitni tekshiring', rang: 'text-ogoh' };
  if (sv.foiz >= 0.9) return { matn: 'juda oson — kuchlini ajratmaydi', rang: 'text-matn-sokin' };
  if (sv.t === 'yopiq' && sv.tanlov && sv.jami >= 10) {
    const togri = (sv.togriJavob || '').split(', ');
    const ishlamagan = harflar.filter(h => !togri.includes(h) && !sv.tanlov![h]);
    if (ishlamagan.length) return { matn: `${ishlamagan.join(', ')} ni hech kim tanlamadi — chalg'ituvchi ishlamaydi`, rang: 'text-matn-sokin' };
  }
  if (sv.farq >= 0.4) return { matn: "a'lo — kuchli va kuchsizni ajratadi", rang: 'text-yaxshi' };
  if (sv.farq < 0.2) return { matn: 'yomon ajratadi', rang: 'text-matn-sokin' };
  return { matn: 'yaxshi', rang: 'text-matn-sokin' };
}

export default function SavollarJadvali({ savollar, optionCount, kalitKorinadi, onKalit }: {
  savollar: TahlilQatori[]; optionCount: number; kalitKorinadi: boolean; onKalit: (q: number | null) => void;
}) {
  const harflar = HARFLAR.slice(0, optionCount);
  const foiz = (x?: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`);
  const tartib = [...savollar].sort((a, b) => Number(b.shubhali) - Number(a.shubhali) || a.foiz - b.foiz);
  const th = 'px-2 py-2 font-semibold text-center whitespace-nowrap';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] border-collapse" style={{ minWidth: 900 + harflar.length * 44 }}>
        <thead className="bg-ichki text-matn-sokin text-[11px] uppercase">
          <tr>
            <th className={`${th} text-left`}>Savol</th>
            <th className={`${th} text-left`}>Mavzu</th>
            {kalitKorinadi && <th className={th}>Kalit</th>}
            {harflar.map(h => <th key={h} className={th}>{h}</th>)}
            <th className={th}>Bo'sh</th>
            <th className={th}>To'g'ri</th>
            <th className={th} title="Eng yuqori ball olgan 27% o'quvchidan to'g'ri topganlar">Kuchli 27%</th>
            <th className={th} title="Eng past ball olgan 27% dan to'g'ri topganlar">Kuchsiz 27%</th>
            <th className={th}>Qiyinlik</th>
            <th className={th} title="Kuchli va kuchsiz 27% farqi: 0,4 dan yuqori — yaxshi savol">Ajratish</th>
            <th className={th} title="Savolni topish umumiy ball bilan bog'liqligi (−1…1)">Korr.</th>
            <th className={`${th} text-left`}>Xulosa</th>
          </tr>
        </thead>
        <tbody>
          {tartib.map(sv => {
            const jamiTanlov = sv.tanlov ? Object.values(sv.tanlov).reduce((a, x) => a + x, 0) : 0;
            const togri = (sv.togriJavob || '').split(', ');
            const x = savolXulosasi(sv, harflar);
            return (
              <tr key={sv.q} className={`border-t border-chiziq ${sv.shubhali && !sv.bekor ? 'bg-ogoh-fon/60' : ''}`}>
                <td className="px-2 py-2 raqam">
                  {kalitKorinadi && typeof sv.q === 'number'
                    ? <button onClick={() => onKalit(sv.q as number)} className="text-brand hover:underline cursor-pointer" title="Kalitni ko'rish va tuzatish">{sv.yorliq || `#${sv.q}`}</button>
                    : <span className="text-matn-sokin">{sv.yorliq || `#${sv.q}`}</span>}
                </td>
                <td className="px-2 py-2 text-matn">{sv.topic || '—'}</td>
                {kalitKorinadi && <td className="px-2 py-2 text-center raqam font-semibold text-brand">{sv.togriJavob || '—'}</td>}
                {harflar.map(h => {
                  const n = sv.tanlov?.[h] || 0;
                  return <td key={h} className={`px-2 py-2 text-center raqam ${togri.includes(h) ? 'text-yaxshi font-semibold' : 'text-matn-sokin'}`}>{sv.t === 'yopiq' && jamiTanlov ? `${Math.round((n / jamiTanlov) * 100)}%` : '—'}</td>;
                })}
                <td className="px-2 py-2 text-center raqam text-matn-xira">{sv.jami ? `${Math.round((sv.bosh / sv.jami) * 100)}%` : '—'}</td>
                <td className="px-2 py-2 text-center raqam font-semibold text-matn">{foiz(sv.foiz)}</td>
                <td className="px-2 py-2 text-center raqam">{foiz(sv.yuqoriFoiz)}</td>
                <td className="px-2 py-2 text-center raqam">{foiz(sv.quyiFoiz)}</td>
                <td className="px-2 py-2 text-center text-matn-sokin">{qiyinlik(sv.foiz)}</td>
                <td className={`px-2 py-2 text-center raqam ${sv.farq < 0 ? 'text-xato' : sv.farq >= 0.4 ? 'text-yaxshi' : ''}`}>{vergul(Math.round(sv.farq * 100) / 100)}</td>
                <td className={`px-2 py-2 text-center raqam ${sv.pbis != null && sv.pbis < 0 ? 'text-xato' : ''}`}>{sv.pbis == null ? '—' : vergul(Math.round(sv.pbis * 100) / 100)}</td>
                <td className={`px-2 py-2 ${x.rang}`}>{x.matn}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
