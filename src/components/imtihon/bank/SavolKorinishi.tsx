import React from 'react';
import { formulaliHtml, SAVOL_MATNI } from '../../../lib/matn';
import { TUR_NOMI } from '../../../lib/savolTuri';
import { HARFLAR } from '../../../../lib/imtihon.js';
import { QiyinlikYorligi } from './qiyinlik';
import MoslashJadvali from './MoslashJadvali';
import type { Question } from '../../../types';

/**
 * Savolning to'liq ko'rinishi: (bo'lsa) umumiy matn yoki shart, formulalar, variantlar, to'g'ri
 * javob, yechim. `yechimsiz` — yechim ko'rsatilmaydi (yechim oynasi uni o'zi alohida chiqaradi).
 */
export default function SavolKorinishi({ q, yechimsiz }: { q: Question; yechimsiz?: boolean }) {
  const togri = HARFLAR.indexOf(String(q.correctAnswer || '').toUpperCase());
  // Guruhli savol bo'lagi: 'juft' — umumiy javoblar ro'yxatidan (A–F) harf; 'qismli' — javobi yoziladi.
  const guruhli = q.type === 'juft' || q.type === 'qismli';
  const shart = q.passage?.text || '';
  return (
    <div className="rounded-xl border border-chiziq bg-ichki p-4 space-y-3">
      {(shart || q.passage?.imageUrl) && (
        <div className="rounded-lg border border-chiziq bg-sirt p-3 space-y-2">
          <p className="text-[11px] font-semibold text-matn-xira">{guruhli ? 'Umumiy shart' : q.passage?.title || 'Umumiy matn'}</p>
          {q.passage?.imageUrl && <img src={q.passage.imageUrl} alt="" className="max-h-56 rounded-lg border border-chiziq bg-white" />}
          {shart && <div className={`${SAVOL_MATNI} text-[13px] text-matn`} dangerouslySetInnerHTML={{ __html: formulaliHtml(shart) }} />}
        </div>
      )}
      {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-56 rounded-lg border border-chiziq bg-white" />}
      <div className={`${SAVOL_MATNI} text-[14px] text-matn`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.text) }} />
      {(q.type === 'yopiq' || q.type === 'juft') && (
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {(q.options || []).map((o, i) => (
            <li key={i} className={`flex gap-2 rounded-lg border px-3 py-2 text-[13px] ${i === togri ? 'border-yaxshi/40 bg-yaxshi-fon text-matn' : 'border-chiziq bg-sirt text-matn'}`}>
              <b>{HARFLAR[i]})</b><span dangerouslySetInnerHTML={{ __html: formulaliHtml(o) }} />
            </li>
          ))}
        </ol>
      )}
      {(q.type === 'raqamli' || q.type === 'qismli') && q.correctAnswer !== undefined && <p className="text-[13px]"><b>Javob:</b> {[...new Set([q.correctAnswer, ...(q.answers || [])].filter(Boolean))].join(' · ') || '—'}</p>}
      {q.type === 'moslash' && <MoslashJadvali chap={q.options || []} ong={q.answers || []} kalit={q.correctAnswer || ''} />}
      {q.type === 'yozma' && <p className="text-[13px] text-matn-sokin">Yozma javob — ustoz baholaydi{q.points ? ` (${q.points} ball)` : ''}.</p>}
      {!yechimsiz && q.solution && (
        <div className="rounded-lg border border-chiziq bg-sirt p-3">
          <p className="text-[11px] font-semibold text-matn-xira mb-1">Yechim {q.solutionStatus === 'tasdiqlangan' ? '· tasdiqlangan' : '· tasdiqlanmagan'}</p>
          <div className={`${SAVOL_MATNI} text-[13px] text-matn`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.solution) }} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-matn-xira">
        <QiyinlikYorligi d={q.difficulty} />
        <span>{TUR_NOMI[q.type] || TUR_NOMI.yopiq}{q.source ? ` · ${q.source}` : ''}{q.grade ? ` · ${q.grade}` : ''}{q.language && q.language !== 'uz' ? ` · ${q.language.toUpperCase()}` : ''}</span>
      </div>
    </div>
  );
}
