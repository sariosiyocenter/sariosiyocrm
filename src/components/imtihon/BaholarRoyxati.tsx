import React from 'react';
import { Yorliq } from './ui';
import { otishHolati, olchanganBall, vergul } from '../../../lib/imtihon.js';
import type { ImtihonTafsil } from './turlar';

// Addmen «Subject wise marklist»: har bo'lim (fan) bo'yicha to'g'ri / xato / bo'sh va ball, jami,
// foiz, guruh ichidagi va umumiy o'rin. O'tish balidan pastdagilar qizil. Ism bosilsa — o'quvchi kartasi.

export interface BaholarQatori {
  id: number; name: string; groupName: string; variantCode: string | null; score: number; percentage: number;
  blockScores: { subject: string; earned: number; max: number; togri?: number; xato?: number; bosh?: number }[] | null;
  rank: number | null; rankGroup: number | null; reviewStatus: string; notifyStatus: string | null;
  raschScore: number | null; grade: string | null; schoolId: number;
}

export default function BaholarRoyxati({ exam, qatorlar, filialNomi, onOch }: {
  exam: ImtihonTafsil; qatorlar: BaholarQatori[]; filialNomi?: (id: number) => string; onOch: (r: BaholarQatori) => void;
}) {
  const s = exam.settings;
  const bloklar = exam.blocks.map(b => b.subject);
  // E'longacha o'rin saqlanmagan — ro'yxatning o'zidan (teng ballga teng o'rin), guruh ichida alohida.
  const orin = (l: BaholarQatori[]) => { const m = new Map<number, number>(); const t = [...l].sort((a, b) => b.score - a.score); t.forEach((r, i) => m.set(r.id, i && t[i - 1].score === r.score ? m.get(t[i - 1].id)! : i + 1)); return m; };
  const umumiy = orin(qatorlar);
  const guruhda = new Map<number, number>();
  for (const g of new Set(qatorlar.map(r => r.groupName))) orin(qatorlar.filter(r => r.groupName === g)).forEach((v, k) => guruhda.set(k, v));
  const olchanganBor = (s.olchangan || []).length > 0;
  const th = 'px-2 py-2 font-semibold text-center';
  const td = 'px-2 py-2 text-center raqam';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px] border-collapse" style={{ minWidth: 520 + bloklar.length * 190 }}>
        <thead className="bg-ichki text-matn-sokin text-[11.5px]">
          <tr>
            <th className={th} rowSpan={2}>№</th>
            <th className={`${th} text-left`} rowSpan={2}>O'quvchi</th>
            <th className={`${th} text-left`} rowSpan={2}>Guruh</th>
            <th className={th} rowSpan={2}>Var.</th>
            {bloklar.map((b, i) => <th key={i} className={`${th} border-l border-chiziq`} colSpan={4}>{b}</th>)}
            <th className={`${th} border-l border-chiziq`} rowSpan={2}>Ball</th>
            <th className={th} rowSpan={2}>%</th>
            {olchanganBor && <th className={th} rowSpan={2} title="Jadval bo'yicha (SAT kabi)">O'lchangan</th>}
            {s.rasch.enabled && <th className={th} rowSpan={2}>Rasch</th>}
            <th className={`${th} border-l border-chiziq`} colSpan={2}>O'rin</th>
            <th className={th} rowSpan={2}><span className="sr-only">Holat</span></th>
          </tr>
          <tr>
            {bloklar.map((_, i) => (
              <React.Fragment key={i}>
                <th className={`${th} border-l border-chiziq`} title="To'g'ri">T</th>
                <th className={th} title="Xato">X</th>
                <th className={th} title="Bo'sh">B</th>
                <th className={th}>Ball</th>
              </React.Fragment>
            ))}
            <th className={`${th} border-l border-chiziq`}>guruhda</th>
            <th className={th}>umumiy</th>
          </tr>
        </thead>
        <tbody>
          {qatorlar.map((r, i) => {
            const otdi = otishHolati(s, r.score, r.percentage, r.blockScores);
            const past = otdi === false;
            return (
              <tr key={r.id} className={`border-t border-chiziq ${past ? 'bg-xato-fon' : 'hover:bg-ichki/50'}`}>
                <td className={`${td} text-matn-sokin`}>{i + 1}</td>
                <td className="px-2 py-2">
                  <button onClick={() => onOch(r)} className={`text-left font-semibold hover:underline cursor-pointer ${past ? 'text-xato' : 'text-matn'}`}>{r.name}</button>
                  {filialNomi && <span className="text-matn-xira"> · {filialNomi(r.schoolId)}</span>}
                </td>
                <td className="px-2 py-2 text-matn-sokin whitespace-nowrap">{r.groupName || '—'}</td>
                <td className={`${td} text-matn-sokin`}>{r.variantCode || '—'}</td>
                {bloklar.map((_, bi) => {
                  const b = r.blockScores?.[bi];
                  return (
                    <React.Fragment key={bi}>
                      <td className={`${td} border-l border-chiziq text-yaxshi`}>{b?.togri ?? '—'}</td>
                      <td className={`${td} text-xato`}>{b?.xato ?? '—'}</td>
                      <td className={`${td} text-matn-xira`}>{b?.bosh ?? '—'}</td>
                      <td className={`${td} text-matn font-semibold`}>{b ? vergul(b.earned) : '—'}</td>
                    </React.Fragment>
                  );
                })}
                <td className={`${td} border-l border-chiziq font-bold ${past ? 'text-xato' : 'text-matn'}`}>{vergul(r.score)}</td>
                <td className={`${td} ${past ? 'text-xato' : 'text-matn-sokin'}`}>{vergul(r.percentage)}</td>
                {olchanganBor && <td className={`${td} text-brand font-semibold`}>{olchanganBall(s, r.score) ?? '—'}</td>}
                {s.rasch.enabled && <td className={`${td} text-matn`}>{r.raschScore != null ? vergul(r.raschScore) : '—'}{r.grade ? ` · ${r.grade}` : ''}</td>}
                <td className={`${td} border-l border-chiziq text-matn`}>{r.rankGroup ?? guruhda.get(r.id) ?? '—'}</td>
                <td className={`${td} text-matn font-semibold`}>{r.rank ?? umumiy.get(r.id) ?? '—'}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap">
                  {r.reviewStatus === 'shubhali' && <Yorliq rang="ogoh">tekshirilmagan</Yorliq>}
                  {r.notifyStatus === 'yuborildi' && <Yorliq rang="yaxshi">xabar ketdi</Yorliq>}
                  {r.notifyStatus && r.notifyStatus !== 'yuborildi' && <Yorliq rang="xato">{r.notifyStatus === 'aloqa yoq' ? "aloqa yo'q" : 'yetmadi'}</Yorliq>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
