import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ExternalLink } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Yuklanmoqda, Yorliq } from './ui';
import StatTile from '../ui/StatTile';
import { vergul, sanaMatni } from './format';

// O'quvchi profilidagi "Imtihonlar" bo'limi: har imtihondagi foizi vaqt
// bo'yicha (bitta chiziq), ko'rsatkichlar va jadval (grafikning jadval
// ko'rinishi ham shu). Grafikda faqat e'lon qilingan natijalar — dastlabki
// ball keyin o'zgarishi mumkin; jadvalda "dastlabki" belgisi bilan turadi.

interface ProfilNatija {
  id: number; examId: number; score: number; percentage: number; rank: number | null; reviewStatus: string;
  raschScore: number | null; grade: string | null;
  blockScores: { subject: string; earned: number; max: number }[] | null;
  exam: { id: number; name: string; maxScore: number; date: string; publishedAt: string | null } | null;
  jami: number; havola: string | null;
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

const QISQA_OY = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];
const qisqaSana = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? `${Number(m[3])}-${QISQA_OY[Number(m[2]) - 1]}` : s;
};
const foizi = (n: number) => Math.round(n * 10) / 10;

const BALANDLIK = 200;
const CHAP = 40;
const ONG = 44;
const TEPA = 16;
const PAST = 30;

function NatijaGrafigi({ nuqtalar, rang }: { nuqtalar: ProfilNatija[]; rang: string }) {
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
  const ichEn = en - CHAP - ONG;
  const ichBo = BALANDLIK - TEPA - PAST;
  const x = (i: number) => CHAP + (n === 1 ? ichEn / 2 : (i / (n - 1)) * ichEn);
  const y = (f: number) => TEPA + (1 - Math.max(0, Math.min(100, f)) / 100) * ichBo;
  const chiziq = nuqtalar.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.percentage).toFixed(1)}`).join(' ');
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
  const tipYuqori = f ? y(f.percentage) < 90 : false;

  return (
    <div ref={qutiRef} className="relative select-none" style={{ height: BALANDLIK }}>
      <svg width={en} height={BALANDLIK} role="img" tabIndex={0} onKeyDown={tugma} onFocus={() => setFaol(n - 1)} onBlur={() => setFaol(null)}
        aria-label={`Imtihon foizlari: ${nuqtalar.map(r => `${r.exam?.name} ${foizi(r.percentage)}%`).join(', ')}`}
        className="outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-lg overflow-visible">
        {[0, 25, 50, 75, 100].map(t => (
          <g key={t}>
            <line x1={CHAP} x2={en - ONG} y1={y(t)} y2={y(t)} stroke="var(--color-chiziq)" strokeWidth={1} />
            <text x={CHAP - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-matn-xira)" style={{ fontVariantNumeric: 'tabular-nums' }}>{t}%</text>
          </g>
        ))}
        {nuqtalar.map((r, i) => (i % qadam === 0 || i === n - 1) && (
          <text key={r.id} x={x(i)} y={BALANDLIK - 8} textAnchor="middle" fontSize={11} fill="var(--color-matn-xira)">{qisqaSana(r.exam?.date || '')}</text>
        ))}
        {n > 1 && <path d={maydon} fill={rang} opacity={0.1} />}
        {n > 1 && <path d={chiziq} fill="none" stroke={rang} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {f && <line x1={x(faol!)} x2={x(faol!)} y1={TEPA} y2={y(0)} stroke="var(--color-chiziq-kuchli)" strokeWidth={1} />}
        {nuqtalar.map((r, i) => (
          <circle key={r.id} cx={x(i)} cy={y(r.percentage)} r={faol === i ? 5.5 : 4} fill={rang} stroke="var(--color-sirt)" strokeWidth={2} />
        ))}
        {/* Yozuv faqat oxirgi nuqtada — qolgani o'q, tooltip va jadvalda. */}
        <text x={x(n - 1) + 9} y={y(oxirgi.percentage)} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--color-matn)">{vergul(foizi(oxirgi.percentage))}%</text>
        <rect x={0} y={0} width={en} height={BALANDLIK} fill="transparent"
          onPointerMove={e => eng(e.clientX)} onPointerDown={e => eng(e.clientX)} onPointerLeave={() => setFaol(null)} />
      </svg>
      {f && (
        <div className="pointer-events-none absolute z-10 w-[220px] rounded-xl border border-chiziq bg-sirt shadow-lg px-3 py-2.5"
          style={{ left: tipChap, top: tipYuqori ? y(f.percentage) + 14 : Math.max(0, y(f.percentage) - 96) }}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[18px] font-bold text-matn">{vergul(foizi(f.percentage))}%</span>
            <span className="text-[12px] text-matn-sokin">{vergul(f.score)} / {vergul(f.exam?.maxScore ?? 0)} ball</span>
          </div>
          <p className="text-[12px] text-matn-sokin truncate mt-0.5">
            <span className="inline-block w-3 h-0.5 align-middle mr-1.5 rounded" style={{ background: rang }} />
            {f.exam?.name}
          </p>
          <p className="text-[11.5px] text-matn-xira">{sanaMatni(f.exam?.date)}{f.rank ? ` · ${f.rank}-o'rin / ${f.jami}` : ''}</p>
        </div>
      )}
    </div>
  );
}

export default function OquvchiImtihonlari({ studentId }: { studentId: number }) {
  const { themeColor, darkMode, kora } = useCRM();
  const { soro } = useImtihonApi();
  const [natijalar, setNatijalar] = useState<ProfilNatija[] | null>(null);
  const [xato, setXato] = useState('');
  const imtihonKorinadi = kora('imtihonlar.imtihon') || kora('imtihonlar.natija');

  useEffect(() => {
    setNatijalar(null);
    soro<ProfilNatija[]>('GET', `exam-results?studentId=${studentId}`)
      .then(setNatijalar)
      .catch(e => setXato(e.message));
  }, [studentId, soro]);

  const tartibli = useMemo(() => [...(natijalar || [])].filter(r => r.exam)
    .sort((a, b) => (a.exam!.date || '').localeCompare(b.exam!.date || '') || a.id - b.id), [natijalar]);
  const elon = tartibli.filter(r => r.exam!.publishedAt);
  const rang = (SERIYA[themeColor] || SERIYA.zumrad)[darkMode ? 1 : 0];

  if (xato) return <p className="py-10 text-center text-[13px] text-xato">{xato}</p>;
  if (!natijalar) return <Yuklanmoqda />;
  if (!tartibli.length) {
    return (
      <div className="py-14 text-center">
        <FileText size={28} className="mx-auto text-matn-xira mb-3" />
        <p className="text-sm font-bold text-matn-2">Hali imtihon natijasi yo'q</p>
        <p className="text-xs text-matn-xira mt-1">Imtihon e'lon qilingach natijasi shu yerda chiqadi.</p>
      </div>
    );
  }

  const raschBor = tartibli.some(r => r.raschScore != null);
  const oxirgi = elon[elon.length - 1];
  const oldingi = elon[elon.length - 2];
  const farq = oxirgi && oldingi ? foizi(oxirgi.percentage - oldingi.percentage) : null;
  const ortacha = elon.length ? foizi(elon.reduce((a, r) => a + r.percentage, 0) / elon.length) : null;
  const eng = elon.length ? elon.reduce((a, r) => (r.percentage > a.percentage ? r : a)) : null;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {elon.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile label="Oxirgi imtihon" value={`${vergul(foizi(oxirgi.percentage))}%`}
            subValue={farq == null ? oxirgi.exam!.name : `${farq > 0 ? '+' : ''}${vergul(farq)} foiz punkt — oldingisiga nisbatan`}
            subTone={farq == null || farq === 0 ? undefined : farq > 0 ? 'good' : 'bad'} />
          <StatTile label="O'rtacha" value={`${vergul(ortacha)}%`} subValue={`${elon.length} ta imtihon`} />
          <StatTile label="Eng yaxshi" value={`${vergul(foizi(eng!.percentage))}%`} subValue={eng!.exam!.name} />
        </div>
      )}

      {elon.length > 1 && (
        <div className="bg-sirt border border-chiziq rounded-2xl p-4">
          <h4 className="text-[13px] font-bold text-matn">Imtihon natijalari, foizda</h4>
          <p className="text-[12px] text-matn-xira mb-3">E'lon qilingan imtihonlar, sana bo'yicha</p>
          <NatijaGrafigi nuqtalar={elon} rang={rang} />
        </div>
      )}

      <div className="bg-sirt border border-chiziq rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead className="bg-ichki text-matn-sokin">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Sana</th>
                <th className="px-4 py-2.5 text-left font-semibold">Imtihon</th>
                <th className="px-4 py-2.5 text-right font-semibold">Ball</th>
                <th className="px-4 py-2.5 text-right font-semibold">%</th>
                {raschBor && <th className="px-4 py-2.5 text-right font-semibold" title="T-ball: o'rtacha 50">Rasch</th>}
                <th className="px-4 py-2.5 text-right font-semibold">O'rin</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-chiziq">
              {[...tartibli].reverse().map(r => (
                <tr key={r.id} className="hover:bg-ichki/50 align-top">
                  <td className="px-4 py-2.5 text-matn-sokin whitespace-nowrap num">{r.exam!.date}</td>
                  <td className="px-4 py-2.5">
                    {imtihonKorinadi
                      ? <Link to={`/exams/${r.examId}?b=natijalar`} className="font-semibold text-matn hover:text-brand">{r.exam!.name}</Link>
                      : <span className="font-semibold text-matn">{r.exam!.name}</span>}
                    {!r.exam!.publishedAt && <Yorliq rang="ogoh" className="ml-2">dastlabki</Yorliq>}
                    {(r.blockScores || []).filter(b => b.max > 0).length > 1 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(r.blockScores || []).filter(b => b.max > 0).map(b => (
                          <span key={b.subject} className="px-1.5 py-0.5 rounded-md bg-ichki text-[11px] text-matn-sokin">{b.subject}: <b className="text-matn">{vergul(b.earned)}</b>/{vergul(b.max)}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right num text-matn whitespace-nowrap">{vergul(r.score)} <span className="text-matn-xira">/ {vergul(r.exam!.maxScore)}</span></td>
                  <td className="px-4 py-2.5 text-right num font-bold text-matn">{vergul(foizi(r.percentage))}</td>
                  {raschBor && <td className="px-4 py-2.5 text-right num text-matn whitespace-nowrap">{r.raschScore != null ? <>{vergul(r.raschScore)}{r.grade && <span className="ml-1.5 text-[11px] font-bold text-brand">{r.grade}</span>}</> : '—'}</td>}
                  <td className="px-4 py-2.5 text-right num text-matn-sokin whitespace-nowrap">{r.rank ? `${r.rank} / ${r.jami}` : '—'}</td>
                  <td className="px-3 py-2.5 text-right">
                    {r.havola && (
                      <a href={`/natija/${r.havola}`} target="_blank" rel="noreferrer" title="Ota-ona ko'radigan natija sahifasi"
                        className="inline-flex items-center gap-1 text-[12px] text-matn-sokin hover:text-brand whitespace-nowrap">
                        <ExternalLink size={13} /> Sahifa
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
