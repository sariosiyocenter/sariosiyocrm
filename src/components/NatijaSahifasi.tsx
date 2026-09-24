import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, XCircle, CheckCircle2, MinusCircle, ChevronDown } from 'lucide-react';
import { formulaliHtml, SAVOL_MATNI } from '../lib/matn';

/**
 * Imtihon natijasi (/natija/:token) — ota-onaga xabardagi imzolangan havola,
 * kirishsiz. Ball, fanlar bo'yicha natija va o'rin; imtihon sozlamasida yoqilgan
 * bo'lsa "xatolar ustida ishlash": savol, o'quvchining javobi, to'g'ri javob va
 * ustoz tasdiqlagan yechim.
 */

interface Savol { n: number; t: 'yopiq' | 'raqamli' | 'yozma'; p: number; pa: number | null; matn: string; rasm: string | null; variantlar: string[]; javob: any; togri: string[] | null; holat: string | null; ball: number; yechim: string | null }
interface Javob {
  markaz: string;
  imtihon: { name: string; date: string; maxScore: number; scoring: string };
  ism: string; kurs: string; ball: number; foiz: number;
  bloklar: { subject: string; earned: number; max: number }[];
  orin: { umumiy: number | null; jami?: number; kurs?: number | null; kursJami?: number } | null;
  savollar: Savol[] | null;
  matnlar: { id: number; title: string | null; text: string; imageUrl: string | null }[];
}

const HARFLAR = 'ABCDEF';
/** O'nli kasr o'zbekchada vergul bilan: 0.75 → 0,75 (varaqda ham vergul bo'yaladi). */
const vergul = (v: unknown) => String(v ?? '').replace(/(\d)\.(\d)/g, '$1,$2');
const HOLAT: Record<string, { nom: string; cls: string; Ikonka: any }> = {
  togri: { nom: "To'g'ri", cls: 'text-yaxshi bg-yaxshi-fon border-yaxshi/25', Ikonka: CheckCircle2 },
  xato: { nom: 'Xato', cls: 'text-xato bg-xato-fon border-xato-chiziq', Ikonka: XCircle },
  qisman: { nom: 'Qisman', cls: 'text-ogoh bg-ogoh-fon border-ogoh/25', Ikonka: MinusCircle },
  bosh: { nom: "Javob yo'q", cls: 'text-matn-sokin bg-ichki border-chiziq', Ikonka: MinusCircle },
  bekor: { nom: 'Bekor qilingan', cls: 'text-matn-sokin bg-ichki border-chiziq', Ikonka: MinusCircle },
  baholanmagan: { nom: 'Baholanmagan', cls: 'text-matn-sokin bg-ichki border-chiziq', Ikonka: MinusCircle },
};

export default function NatijaSahifasi() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<Javob | null>(null);
  const [xato, setXato] = useState('');
  const [filtr, setFiltr] = useState<'xato' | 'hammasi'>('xato');

  useEffect(() => {
    fetch(`/api/public/natija/${token}`)
      .then(async r => { const j = await r.json().catch(() => null); if (!r.ok) throw new Error(j?.error || 'Natija topilmadi'); return j; })
      .then(setD)
      .catch(e => setXato(e.message));
  }, [token]);

  const matnMap = useMemo(() => new Map((d?.matnlar || []).map(m => [m.id, m])), [d]);
  const korinadigan = (d?.savollar || []).filter(s => filtr === 'hammasi' || (s.holat !== 'togri' && s.holat !== 'bekor'));

  if (xato) {
    return (
      <div className="min-h-screen bg-fon flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-sirt rounded-2xl border border-chiziq p-8 text-center">
          <XCircle size={32} className="mx-auto text-xato mb-3" />
          <p className="text-[14px] font-semibold text-matn">{xato}</p>
        </div>
      </div>
    );
  }
  if (!d) return <div className="min-h-screen bg-fon flex items-center justify-center"><div className="w-9 h-9 border-[3px] border-brand border-t-transparent rounded-full animate-spin" /></div>;

  const foiz = Math.max(0, Math.min(100, d.foiz));
  let oxirgiMatn: number | null = null;

  return (
    <div className="min-h-screen bg-fon">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="text-center">
          <p className="text-[12px] text-matn-xira">{d.markaz}</p>
          <h1 className="text-[17px] font-bold text-matn mt-0.5">{d.imtihon.name}</h1>
          <p className="text-[12px] text-matn-xira">{d.imtihon.date}</p>
        </div>

        <section className="bg-sirt rounded-2xl border border-chiziq p-5">
          <p className="text-[15px] font-semibold text-matn">{d.ism}</p>
          {d.kurs && <p className="text-[12.5px] text-matn-sokin">{d.kurs}</p>}
          <div className="flex items-end justify-between gap-3 mt-4">
            <div>
              <span className="text-[34px] font-bold text-matn raqam leading-none">{d.ball}</span>
              <span className="text-[14px] text-matn-xira raqam"> / {d.imtihon.maxScore} ball</span>
            </div>
            <span className="text-[22px] font-bold text-brand raqam">{d.foiz}%</span>
          </div>
          <div className="h-2 rounded-full bg-ichki overflow-hidden mt-3"><div className="h-full bg-brand rounded-full" style={{ width: `${foiz}%` }} /></div>
          {d.orin && (d.orin.umumiy || d.orin.kurs) && (
            <p className="flex items-center gap-2 mt-4 text-[13px] text-matn">
              <Trophy size={16} className="text-ogoh" />
              {[d.orin.kurs ? `Kursda ${d.orin.kurs}${d.orin.kursJami ? ` / ${d.orin.kursJami}` : ''}` : '', d.orin.umumiy ? `Umumiy ${d.orin.umumiy}${d.orin.jami ? ` / ${d.orin.jami}` : '-o\'rin'}` : ''].filter(Boolean).join(' · ')}
            </p>
          )}
        </section>

        {d.bloklar.length > 1 && (
          <section className="bg-sirt rounded-2xl border border-chiziq p-5 space-y-3">
            {d.bloklar.map(b => {
              const f = b.max ? (b.earned / b.max) * 100 : 0;
              return (
                <div key={b.subject}>
                  <div className="flex justify-between text-[13px]"><span className="text-matn">{b.subject}</span><span className="text-matn-sokin raqam">{b.earned} / {b.max}</span></div>
                  <div className="h-1.5 rounded-full bg-ichki overflow-hidden mt-1"><div className={`h-full rounded-full ${f >= 70 ? 'bg-yaxshi' : f >= 40 ? 'bg-ogoh' : 'bg-xato'}`} style={{ width: `${f}%` }} /></div>
                </div>
              );
            })}
          </section>
        )}

        {d.savollar && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-bold text-matn">Xatolar ustida ishlash</h2>
              <div className="inline-flex rounded-xl border border-chiziq bg-ichki p-0.5">
                {(['xato', 'hammasi'] as const).map(v => (
                  <button key={v} onClick={() => setFiltr(v)} className={`px-3 py-1.5 rounded-[10px] text-[12px] font-semibold ${filtr === v ? 'bg-sirt text-matn shadow-sm' : 'text-matn-sokin'}`}>{v === 'xato' ? 'Xatolar' : 'Hammasi'}</button>
                ))}
              </div>
            </div>
            {!korinadigan.length && <p className="text-[13px] text-matn-sokin bg-sirt rounded-2xl border border-chiziq p-5 text-center">Xato yo'q — barakalla!</p>}
            {korinadigan.map(s => {
              const h = HOLAT[s.holat || 'bosh'] || HOLAT.bosh;
              const matn = s.pa && s.pa !== oxirgiMatn ? matnMap.get(s.pa) : null;
              if (s.pa) oxirgiMatn = s.pa;
              return (
                <React.Fragment key={s.n}>
                  {matn && (
                    <div className="bg-sirt rounded-2xl border border-chiziq p-4">
                      {matn.title && <p className="text-[12.5px] font-semibold text-matn mb-1">{matn.title}</p>}
                      <div className={`${SAVOL_MATNI} text-[13.5px] text-matn`} dangerouslySetInnerHTML={{ __html: formulaliHtml(matn.text) }} />
                      {matn.imageUrl && <img src={matn.imageUrl} alt="" className="mt-2 max-h-72 rounded-lg" />}
                    </div>
                  )}
                  <article className="bg-sirt rounded-2xl border border-chiziq p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[13px] font-bold text-matn">{s.n}-savol</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11.5px] font-semibold ${h.cls}`}><h.Ikonka size={12} />{h.nom}</span>
                    </div>
                    <div className={`${SAVOL_MATNI} text-[14px] text-matn`} dangerouslySetInnerHTML={{ __html: formulaliHtml(s.matn) }} />
                    {s.rasm && <img src={s.rasm} alt="" className="mt-2 max-h-72 rounded-lg" />}
                    {s.t === 'yopiq' && (
                      <ol className="mt-3 space-y-1.5">
                        {s.variantlar.map((v, i) => {
                          const harf = HARFLAR[i];
                          const togri = s.togri?.includes(harf);
                          const tanlagan = s.javob === harf;
                          return (
                            <li key={i} className={`flex gap-2 rounded-lg border px-3 py-2 text-[13.5px] ${togri ? 'border-yaxshi/40 bg-yaxshi-fon' : tanlagan ? 'border-xato-chiziq bg-xato-fon' : 'border-chiziq'}`}>
                              <b className="text-matn">{harf})</b>
                              <span className="flex-1 text-matn" dangerouslySetInnerHTML={{ __html: formulaliHtml(v) }} />
                              {tanlagan && <span className="text-[11px] text-matn-sokin shrink-0">sizniki</span>}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                    {s.t === 'raqamli' && (
                      <p className="mt-3 text-[13.5px] text-matn">Sizning javobingiz: <b>{s.javob ? vergul(s.javob) : '—'}</b> · To'g'ri javob: <b className="text-yaxshi">{(s.togri || []).map(vergul).join(' yoki ')}</b></p>
                    )}
                    {s.t === 'yozma' && <p className="mt-3 text-[13.5px] text-matn">Ball: <b>{s.ball}</b> / {s.p}</p>}
                    {s.yechim && (
                      <details className="mt-3 group">
                        <summary className="flex items-center gap-1 cursor-pointer text-[13px] font-semibold text-brand list-none">Yechim <ChevronDown size={14} className="group-open:rotate-180 transition-transform" /></summary>
                        <div className={`${SAVOL_MATNI} mt-2 text-[13.5px] text-matn rounded-lg bg-ichki p-3`} dangerouslySetInnerHTML={{ __html: formulaliHtml(s.yechim) }} />
                      </details>
                    )}
                  </article>
                </React.Fragment>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
