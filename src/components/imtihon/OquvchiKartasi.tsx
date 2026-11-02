import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Tugma, Yuklanmoqda } from './ui';
import { HARFLAR, vergul } from '../../../lib/imtihon.js';
import { sanaMatni } from './format';
import type { ImtihonTafsil } from './turlar';

// O'quvchi natija kartasi (Addmen «Graphical Student Performance Report»): ball, foiz, o'rinlar,
// bo'limlar (o'zi · o'rtacha · eng yuqori), har savolda javobi va sinfda necha foiz topgani,
// takrorlash kerak bo'lgan mavzular va oxirgi imtihonlardagi o'sishi. Chop etsa bo'ladi.

interface Blok { subject: string; earned: number; max: number; togri?: number; xato?: number; bosh?: number }
interface QatorQisqa { id: number; score: number; percentage: number; groupName: string; blockScores: Blok[] | null; rank: number | null; rankGroup: number | null }
interface Tafsil {
  id: number; studentId: number | null; name: string; variantCode: string | null; score: number; percentage: number;
  rank: number | null; rankGroup: number | null; blockScores: Blok[] | null;
  detail: { n: number; q: number | null; javob: any; holat: string; ball: number }[] | null;
  items: { n: number; y?: string; q: number; t: string; k?: number; j?: string[]; m?: number[] }[];
}
interface Tarix { id: number; percentage: number; score: number; rank: number | null; exam: { id: number; name: string; date: string; maxScore: number } | null }

const HOLAT_RANGI: Record<string, string> = { togri: 'text-yaxshi', xato: 'text-xato', qisman: 'text-ogoh', bosh: 'text-matn-xira', bekor: 'text-matn-xira' };

export default function OquvchiKartasi({ exam, natija, natijalar, savolMalumoti, onYop }: {
  exam: ImtihonTafsil; natija: QatorQisqa & { name: string }; natijalar: QatorQisqa[];
  savolMalumoti: Map<number | string, { topic: string; foiz: number }>; onYop: () => void;
}) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [t, setT] = useState<Tafsil | null>(null);
  const [tarix, setTarix] = useState<Tarix[] | null>(null);
  const ichi = useRef<HTMLDivElement>(null);

  useEffect(() => {
    soro<Tafsil>('GET', `exam-results/${natija.id}`).then(d => {
      setT(d);
      if (d.studentId) soro<Tarix[]>('GET', `exam-results?studentId=${d.studentId}`).then(setTarix).catch(() => setTarix([]));
      else setTarix([]);
    }).catch(e => showNotification(e.message, 'error'));
  }, [natija.id, soro, showNotification]);

  const guruhdagilar = natijalar.filter(r => r.groupName === natija.groupName).length;
  // E'longacha o'rin saqlanmagan — ballidan (teng ballga teng o'rin).
  const orin = natija.rank ?? 1 + natijalar.filter(r => r.score > natija.score).length;
  const guruhOrni = natija.rankGroup ?? 1 + natijalar.filter(r => r.groupName === natija.groupName && r.score > natija.score).length;
  const bloklar = useMemo(() => exam.blocks.map((b, bi) => {
    const foizi = (r: QatorQisqa) => { const x = r.blockScores?.[bi]; return x && x.max ? x.earned / x.max : 0; };
    const hamma = natijalar.map(foizi);
    return { nom: b.subject, siz: foizi(natija), ortacha: hamma.reduce((a, x) => a + x, 0) / Math.max(1, hamma.length), yuqori: Math.max(0, ...hamma) };
  }), [exam.blocks, natijalar, natija]);
  const jamla = (k: 'togri' | 'xato' | 'bosh') => (natija.blockScores || []).reduce((a, b) => a + (b[k] || 0), 0);

  const savollar = useMemo(() => {
    if (!t) return [];
    const itemMap = new Map(t.items.map(it => [it.n, it]));
    return (t.detail || []).map(d => {
      const it = itemMap.get(d.n);
      const togri = it?.t === 'yopiq' && it.k != null ? HARFLAR[it.k] : it?.j?.length ? it.j.join(' | ') : null;
      const sm = d.q != null ? savolMalumoti.get(d.q) : undefined;
      return { raqam: it?.y ?? d.n, togri, javob: typeof d.javob === 'string' ? (d.javob === '*' ? 'ikki belgi' : d.javob || '—') : d.javob?.ball != null ? `${vergul(d.javob.ball)} ball` : '—', holat: d.holat, mavzu: sm?.topic || '', sinf: sm?.foiz };
    });
  }, [t, savolMalumoti]);
  const zaif = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of savollar) if ((s.holat === 'xato' || s.holat === 'bosh') && s.mavzu) m.set(s.mavzu, (m.get(s.mavzu) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [savollar]);

  // Oxirgi 6 imtihon (vaqt bo'yicha) — foiz chizig'i.
  const osish = (tarix || []).filter(x => x.exam).sort((a, b) => String(a.exam!.date).localeCompare(String(b.exam!.date))).slice(-6);

  const chopEt = () => {
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w || !ichi.current) return;
    const uslublar = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(n => n.outerHTML).join('\n');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${natija.name}</title>${uslublar}<style>body{background:#fff;color:#16211d;padding:24px}.chop-yoq{display:none!important}</style></head><body class="light">${ichi.current.outerHTML}</body></html>`);
    w.document.close();
    w.addEventListener('load', () => w.print());
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-start justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label={`${natija.name} — natija kartasi`}>
      <div className="fixed inset-0 bg-black/50" onClick={onYop} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-4xl border border-chiziq my-auto">
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-chiziq chop-yoq">
          <h3 className="text-[14px] font-bold text-matn">Natija kartasi</h3>
          <div className="flex gap-2">
            <Tugma kichik turi="oddiy" ikonka={<Printer size={13} />} disabled={!t} onClick={chopEt}>Chop etish</Tugma>
            <button aria-label="Yopish" onClick={onYop} className="p-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
          </div>
        </div>
        {!t ? <div className="p-6"><Yuklanmoqda /></div> : (
          <div ref={ichi} className="p-5 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-brand pb-3">
              <div>
                <div className="text-[12px] text-matn-sokin">{exam.name} · {sanaMatni(exam.date)}{t.variantCode ? ` · variant ${t.variantCode}` : ''}</div>
                <div className="text-[19px] font-bold text-matn">{natija.name}</div>
                <div className="text-[12.5px] text-matn-sokin">{natija.groupName || 'Tashqi qatnashchi'}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                ['Ball', `${vergul(natija.score)} / ${vergul(exam.maxScore)}`],
                ['Foiz', `${vergul(natija.percentage)}%`],
                ['Guruhda', `${guruhOrni} / ${guruhdagilar}`],
                ['Umumiy', `${orin} / ${natijalar.length}`],
              ] as const).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-ichki px-3 py-2.5 text-center">
                  <div className="text-[11.5px] text-matn-sokin">{k}</div>
                  <div className="raqam text-[18px] font-bold text-brand">{v}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
              <div className="space-y-2">
                <div className="text-[12px] font-semibold text-matn">Bo'limlar: o'zi · o'rtacha · eng yuqori</div>
                {bloklar.map(b => (
                  <div key={b.nom} className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12px]">
                    <span className="text-matn truncate">{b.nom}</span>
                    <div className="space-y-0.5">
                      <div className="h-2 rounded bg-brand" style={{ width: `${b.siz * 100}%` }} title={`o'zi ${Math.round(b.siz * 100)}%`} />
                      <div className="h-1.5 rounded bg-brand/40" style={{ width: `${b.ortacha * 100}%` }} title={`o'rtacha ${Math.round(b.ortacha * 100)}%`} />
                      <div className="h-1.5 rounded bg-chiziq-kuchli" style={{ width: `${b.yuqori * 100}%` }} title={`eng yuqori ${Math.round(b.yuqori * 100)}%`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex md:flex-col gap-2 text-center text-[12px]">
                <div className="rounded-xl border border-yaxshi/30 px-4 py-2"><b className="raqam text-[17px] text-yaxshi">{jamla('togri')}</b><br />to'g'ri</div>
                <div className="rounded-xl border border-xato-chiziq px-4 py-2"><b className="raqam text-[17px] text-xato">{jamla('xato')}</b><br />xato</div>
                <div className="rounded-xl border border-chiziq px-4 py-2"><b className="raqam text-[17px] text-matn">{jamla('bosh')}</b><br />bo'sh</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[12px] min-w-[520px]">
                <thead className="text-[11px] uppercase text-matn-sokin bg-ichki">
                  <tr>{['№', "To'g'ri", 'Javobi', 'Mavzu', 'Sinfda topgan'].map(x => <th key={x} className="px-2 py-1.5 text-left font-semibold">{x}</th>)}</tr>
                </thead>
                <tbody>
                  {savollar.map(s => (
                    <tr key={s.raqam} className="border-t border-chiziq">
                      <td className="px-2 py-1.5 raqam text-matn-sokin">{s.raqam}</td>
                      <td className="px-2 py-1.5 raqam">{s.togri ?? '—'}</td>
                      <td className={`px-2 py-1.5 raqam font-semibold ${HOLAT_RANGI[s.holat] || ''}`}>{s.javob}</td>
                      <td className="px-2 py-1.5 text-matn-sokin">{s.mavzu || '—'}</td>
                      <td className="px-2 py-1.5 raqam text-matn-sokin">{s.sinf == null ? '—' : `${Math.round(s.sinf * 100)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {zaif.length > 0 && <p className="text-[12.5px] text-matn"><b>Takrorlash kerak:</b> {zaif.map(([m, n]) => `${m} (${n} ta xato)`).join(', ')}.</p>}

            {osish.length > 1 && (
              <div className="space-y-1.5">
                <div className="text-[12px] font-semibold text-matn">O'sish — oxirgi imtihonlar (foiz)</div>
                <svg viewBox="0 0 520 160" className="w-full h-auto" role="img" aria-label={osish.map(x => `${x.exam!.name}: ${Math.round(x.percentage)}%`).join(', ')}>
                  {[0, 50, 100].map(y => <line key={y} x1="30" x2="510" y1={140 - y * 1.2} y2={140 - y * 1.2} stroke="currentColor" className="text-chiziq" strokeWidth="1" />)}
                  {[0, 50, 100].map(y => <text key={y} x="2" y={144 - y * 1.2} className="fill-current text-matn-sokin" fontSize="10">{y}</text>)}
                  <polyline fill="none" stroke="var(--color-brand)" strokeWidth="2.5"
                    points={osish.map((x, i) => `${40 + (i * 460) / (osish.length - 1)},${140 - Math.min(100, x.percentage) * 1.2}`).join(' ')} />
                  {osish.map((x, i) => (
                    <g key={x.id}>
                      <circle cx={40 + (i * 460) / (osish.length - 1)} cy={140 - Math.min(100, x.percentage) * 1.2} r={x.id === t.id ? 5 : 3.5} fill="var(--color-brand)" />
                      <text x={40 + (i * 460) / (osish.length - 1)} y={156} textAnchor="middle" fontSize="9.5" className="fill-current text-matn-sokin">{sanaMatni(x.exam!.date).slice(0, 6)}</text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
