import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ExternalLink } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Yuklanmoqda, Yorliq } from './ui';
import StatTile from '../ui/StatTile';
import { vergul } from './format';
import FoizGrafigi, { foizi } from './FoizGrafigi';

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

export default function OquvchiImtihonlari({ studentId }: { studentId: number }) {
  const { kora } = useCRM();
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
          <FoizGrafigi nomi="Imtihon foizlari" nuqtalar={elon.map(r => ({
            id: r.id, sana: r.exam!.date, foiz: r.percentage, sarlavha: r.exam!.name,
            qiymatIzohi: `${vergul(r.score)} / ${vergul(r.exam!.maxScore)} ball`,
            pastki: r.rank ? `${r.rank}-o'rin / ${r.jami}` : undefined,
          }))} />
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
