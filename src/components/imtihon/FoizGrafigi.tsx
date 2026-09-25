import React, { useLayoutEffect, useRef, useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import { vergul, sanaMatni } from './format';

// Foiz grafigi (0–100%) vaqt bo'yicha, bitta chiziq: o'quvchi profilida
// (har imtihondagi foizi) va natijalar tarixida (har imtihonning o'rtachasi).
// Dataviz qoidalari: 2px chiziq, 10% maydon, sirt halqali nuqtalar, faqat
// oxirgi nuqtada yozuv, kursor bo'yicha tooltip, klaviatura bilan ham.

export interface FoizNuqta {
  id: number | string;
  sana: string;
  foiz: number;
  sarlavha: string;
  /** Tooltipdagi foiz yonidagi izoh ("36,1 / 50 ball"). */
  qiymatIzohi?: string;
  /** Tooltipning pastki qatori (sana bilan). */
  pastki?: string;
}

// Chiziq rangi — har mavzu uchun dataviz validatoridan o'tgan tus (yorug', qorong'i).
// Brendning o'zi grafikda kulrangdek chiqadigan joyda (zumrad, shifer) yaqin,
// to'yinganroq qadam olinadi; qorong'i fondagi "yorqin" variantlar esa juda och.
const SERIYA: Record<string, [string, string]> = {
  zumrad: ['#00918a', '#16a39b'], indigo: ['#6366f1', '#6366f1'], yoqut: ['#dc2626', '#dc2626'],
  oltin: ['#d97706', '#d97706'], okean: ['#0284c7', '#0284c7'], yalpiz: ['#059669', '#059669'],
  binafsha: ['#7c3aed', '#7c3aed'], burgundiya: ['#db2777', '#db2777'], bronza: ['#854d0e', '#a16207'],
  shifer: ['#2a78d6', '#3987e5'],
};

export function useSeriyaRangi() {
  const { themeColor, darkMode } = useCRM();
  return (SERIYA[themeColor] || SERIYA.zumrad)[darkMode ? 1 : 0];
}

const QISQA_OY = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
const qisqaSana = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? `${Number(m[3])}-${QISQA_OY[Number(m[2]) - 1]}` : s;
};
export const foizi = (n: number) => Math.round(n * 10) / 10;

const BALANDLIK = 200;
const CHAP = 40;
const ONG = 44;
const TEPA = 16;
const PAST = 30;

export default function FoizGrafigi({ nuqtalar, nomi }: { nuqtalar: FoizNuqta[]; nomi: string }) {
  const rang = useSeriyaRangi();
  const qutiRef = useRef<HTMLDivElement>(null);
  const [en, setEn] = useState(600);
  const [faol, setFaol] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = qutiRef.current;
    if (!el) return;
    const olch = () => setEn(Math.max(280, el.clientWidth));
    olch();
    const ro = new ResizeObserver(olch);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = nuqtalar.length;
  if (!n) return null;
  const ichEn = en - CHAP - ONG;
  const ichBo = BALANDLIK - TEPA - PAST;
  const x = (i: number) => CHAP + (n === 1 ? ichEn / 2 : (i / (n - 1)) * ichEn);
  const y = (f: number) => TEPA + (1 - Math.max(0, Math.min(100, f)) / 100) * ichBo;
  const chiziq = nuqtalar.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.foiz).toFixed(1)}`).join(' ');
  const maydon = `${chiziq} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  // Sana yozuvlari bir-biriga minmasin: taxminan 56px ga bitta.
  const qadam = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(ichEn / 56))));

  const eng = (clientX: number) => {
    const el = qutiRef.current;
    if (!el) return;
    const px = clientX - el.getBoundingClientRect().left;
    let i = n === 1 ? 0 : Math.round(((px - CHAP) / ichEn) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setFaol(i);
  };
  const tugma = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setFaol(i => Math.min(n - 1, (i ?? -1) + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setFaol(i => Math.max(0, (i ?? n) - 1)); }
    if (e.key === 'Escape') setFaol(null);
  };

  const oxirgi = nuqtalar[n - 1];
  const f = faol != null ? nuqtalar[faol] : null;
  const tipChap = f ? Math.min(Math.max(x(faol!) - 110, 0), en - 220) : 0;
  const tipYuqori = f ? y(f.foiz) < 90 : false;

  return (
    <div ref={qutiRef} className="relative select-none" style={{ height: BALANDLIK }}>
      <svg width={en} height={BALANDLIK} role="img" tabIndex={0} onKeyDown={tugma} onFocus={() => setFaol(n - 1)} onBlur={() => setFaol(null)}
        aria-label={`${nomi}: ${nuqtalar.map(r => `${r.sarlavha} ${foizi(r.foiz)}%`).join(', ')}`}
        className="outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-lg overflow-visible">
        {[0, 25, 50, 75, 100].map(t => (
          <g key={t}>
            <line x1={CHAP} x2={en - ONG} y1={y(t)} y2={y(t)} stroke="var(--color-chiziq)" strokeWidth={1} />
            <text x={CHAP - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-matn-xira)" style={{ fontVariantNumeric: 'tabular-nums' }}>{t}%</text>
          </g>
        ))}
        {nuqtalar.map((r, i) => (i % qadam === 0 || i === n - 1) && (
          <text key={r.id} x={x(i)} y={BALANDLIK - 8} textAnchor="middle" fontSize={11} fill="var(--color-matn-xira)">{qisqaSana(r.sana)}</text>
        ))}
        {n > 1 && <path d={maydon} fill={rang} opacity={0.1} />}
        {n > 1 && <path d={chiziq} fill="none" stroke={rang} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {f && <line x1={x(faol!)} x2={x(faol!)} y1={TEPA} y2={y(0)} stroke="var(--color-chiziq-kuchli)" strokeWidth={1} />}
        {nuqtalar.map((r, i) => (
          <circle key={r.id} cx={x(i)} cy={y(r.foiz)} r={faol === i ? 5.5 : 4} fill={rang} stroke="var(--color-sirt)" strokeWidth={2} />
        ))}
        {/* Yozuv faqat oxirgi nuqtada — qolgani o'q, tooltip va jadvalda. */}
        <text x={x(n - 1) + 9} y={y(oxirgi.foiz)} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--color-matn)">{vergul(foizi(oxirgi.foiz))}%</text>
        <rect x={0} y={0} width={en} height={BALANDLIK} fill="transparent"
          onPointerMove={e => eng(e.clientX)} onPointerDown={e => eng(e.clientX)} onPointerLeave={() => setFaol(null)} />
      </svg>
      {f && (
        <div className="pointer-events-none absolute z-10 w-[220px] rounded-xl border border-chiziq bg-sirt shadow-lg px-3 py-2.5"
          style={{ left: tipChap, top: tipYuqori ? y(f.foiz) + 14 : Math.max(0, y(f.foiz) - 96) }}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[18px] font-bold text-matn">{vergul(foizi(f.foiz))}%</span>
            {f.qiymatIzohi && <span className="text-[12px] text-matn-sokin">{f.qiymatIzohi}</span>}
          </div>
          <p className="text-[12px] text-matn-sokin truncate mt-0.5">
            <span className="inline-block w-3 h-0.5 align-middle mr-1.5 rounded" style={{ background: rang }} />
            {f.sarlavha}
          </p>
          <p className="text-[11.5px] text-matn-xira">{sanaMatni(f.sana)}{f.pastki ? ` · ${f.pastki}` : ''}</p>
        </div>
      )}
    </div>
  );
}
