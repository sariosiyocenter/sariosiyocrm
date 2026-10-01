import React from 'react';
import { formulaliHtml, SAVOL_MATNI } from '../../../lib/matn';
import { HARFLAR, SAVOL_TURI_NOMI } from '../../../../lib/imtihon.js';
import { QiyinlikYorligi } from './qiyinlik';
import MoslashJadvali from './MoslashJadvali';
import type { Question } from '../../../types';

/** Savolning to'liq ko'rinishi: formulalar, variantlar, to'g'ri javob, yechim. */
export default function SavolKorinishi({ q }: { q: Question }) {
  const togri = HARFLAR.indexOf(String(q.correctAnswer || '').toUpperCase());
  return (
    <div className="rounded-xl border border-chiziq bg-ichki p-4 space-y-3">
      {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-56 rounded-lg border border-chiziq bg-white" />}
      <div className={`${SAVOL_MATNI} text-[14px] text-matn`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.text) }} />
      {q.type === 'yopiq' && (
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {(q.options || []).map((o, i) => (
            <li key={i} className={`flex gap-2 rounded-lg border px-3 py-2 text-[13px] ${i === togri ? 'border-yaxshi/40 bg-yaxshi-fon text-matn' : 'border-chiziq bg-sirt text-matn'}`}>
              <b>{HARFLAR[i]})</b><span dangerouslySetInnerHTML={{ __html: formulaliHtml(o) }} />
            </li>
          ))}
        </ol>
      )}
      {q.type === 'raqamli' && q.correctAnswer !== undefined && <p className="text-[13px]"><b>Javob:</b> {[q.correctAnswer, ...(q.answers || [])].filter(Boolean).join(' · ')}</p>}
      {q.type === 'moslash' && <MoslashJadvali chap={q.options || []} ong={q.answers || []} kalit={q.correctAnswer || ''} />}
      {q.type === 'yozma' && <p className="text-[13px] text-matn-sokin">Yozma javob — ustoz baholaydi{q.points ? ` (${q.points} ball)` : ''}.</p>}
      {q.solution && (
        <div className="rounded-lg border border-chiziq bg-sirt p-3">
          <p className="text-[11px] font-semibold text-matn-xira mb-1">Yechim {q.solutionStatus === 'tasdiqlangan' ? '· tasdiqlangan' : '· tasdiqlanmagan'}</p>
          <div className={`${SAVOL_MATNI} text-[13px] text-matn`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.solution) }} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-matn-xira">
        <QiyinlikYorligi d={q.difficulty} />
        <span>{SAVOL_TURI_NOMI[q.type]}{q.source ? ` · ${q.source}` : ''}{q.grade ? ` · ${q.grade}` : ''}{q.language && q.language !== 'uz' ? ` · ${q.language.toUpperCase()}` : ''}</span>
      </div>
    </div>
  );
}
