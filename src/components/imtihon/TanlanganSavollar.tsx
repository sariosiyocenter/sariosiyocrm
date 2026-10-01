import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Hash, Check, X, Loader2, Info } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Yuklanmoqda, BoshHolat } from './ui';
import { formulaliHtml, SAVOL_MATNI } from '../../lib/matn';
import { HARFLAR } from '../../../lib/imtihon.js';
import { qiyinlikDaraja } from './bank/qiyinlik';
import type { ImtihonTafsil } from './turlar';

// Addmen QPG "Find questions / Align questions" jadvali: qulflangan imtihonga
// tushgan savollar. Natija kelguncha har birini almashtirish mumkin —
// avtomatik (o'sha mavzu va qiyinlikdan kam ishlatilgani) yoki QID bilan.

interface Qator {
  q: number; session: number; n: number; b: number; t: 'yopiq' | 'raqamli' | 'yozma'; p: number; pa: number | null;
  text: string; imageUrl: string | null; topic: string; difficulty: number; usedCount: number;
  options: string[]; correctAnswer: string | null; answers: string[] | null; remark: string | null;
}

export default function TanlanganSavollar({ exam, onOzgardi }: { exam: ImtihonTafsil; onOzgardi: () => void }) {
  const { showNotification, ozgartira } = useCRM();
  const { soro } = useImtihonApi();
  const [d, setD] = useState<{ savollar: Qator[]; natijaBor: boolean; almashtirsaBoladi: boolean } | null>(null);
  const [band, setBand] = useState<number | null>(null);
  const [qidOchiq, setQidOchiq] = useState<number | null>(null);
  const [qid, setQid] = useState('');
  const [yangilangan, setYangilangan] = useState<number | null>(null);
  const tahrir = ozgartira('imtihonlar.imtihon');

  const yukla = useCallback(() => soro<NonNullable<typeof d>>('GET', `exams/${exam.id}/tanlangan`).then(setD).catch(e => showNotification(e.message, 'error')), [exam.id, soro]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { yukla(); }, [yukla]);

  const almashtir = async (q: number, yangi?: number) => {
    setBand(q);
    try {
      const r = await soro<{ eski: number; yangi: number }>('POST', `exams/${exam.id}/savol-almashtir`, { q, ...(yangi ? { yangi } : {}) });
      showNotification(`#${r.eski} o'rniga #${r.yangi} qo'yildi — kitobcha va kalit yangilandi`, 'success');
      setQidOchiq(null);
      setQid('');
      setYangilangan(r.yangi);
      await yukla();
      onOzgardi();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
    }
  };

  if (!d) return <Karta><Yuklanmoqda /></Karta>;
  if (!d.savollar.length) return <Karta><BoshHolat sarlavha="Savollar yo'q" izoh="«Faqat kalit» rejimida savollar bankdan olinmaydi." /></Karta>;
  const smenalar = [...new Set(d.savollar.map(x => x.session))];
  const javob = (x: Qator) => (x.correctAnswer == null ? null
    : x.t === 'yopiq' ? x.correctAnswer.toUpperCase()
      : x.t === 'raqamli' ? [...new Set([x.correctAnswer, ...(x.answers || [])].filter(Boolean))].join('; ') : 'yozma');
  const ochiq = tahrir && d.almashtirsaBoladi;

  return (
    <Karta ichki="p-0" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-chiziq">
        <span>
          <span className="block text-[12.5px] font-semibold text-matn">Tanlangan savollar <span className="raqam text-matn-xira">· {d.savollar.length}</span></span>
          <span className="block text-[11.5px] text-matn-xira">1-variant tartibida · ↻ — o'sha mavzu va qiyinlikdan boshqasi, # — QID bilan</span>
        </span>
        {!d.almashtirsaBoladi && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ogoh"><Info size={13} /> {d.natijaBor ? "Natijalar bor — endi almashtirib bo'lmaydi" : "Almashtirib bo'lmaydi"}</span>
        )}
      </div>
      <div className="overflow-auto max-h-[calc(100vh-190px)] min-h-[420px]">
        {smenalar.map(sm => (
          <table key={sm} className="w-full text-[12.5px]">
            <thead className="bg-ichki text-matn-sokin text-[11.5px] sticky top-0 z-[1]">
              {smenalar.length > 1 && <tr><th colSpan={8} className="px-3 py-1.5 text-left font-bold text-matn">{exam.settings.sessions.find(x => x.id === sm)?.name || `${sm}-smena`}</th></tr>}
              <tr>
                <th className="px-2 py-2 w-10 text-center font-semibold">№</th>
                <th className="px-2 py-2 w-16 text-left font-semibold">QID</th>
                <th className="px-2 py-2 text-left font-semibold">Savol</th>
                <th className="px-2 py-2 text-left font-semibold hidden md:table-cell">Mavzu</th>
                <th className="px-2 py-2 w-16 text-center font-semibold">Javob</th>
                <th className="px-2 py-2 w-14 text-center font-semibold" title="Necha marta ishlatilgan">Ishl.</th>
                {ochiq && <th className="px-2 py-2 w-24" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-chiziq">
              {d.savollar.filter(x => x.session === sm).map((x, i, l) => {
                const yangiBlok = i === 0 || l[i - 1].b !== x.b;
                const dq = qiyinlikDaraja(x.difficulty);
                return (
                  <React.Fragment key={x.q}>
                    {yangiBlok && <tr className="bg-sirt"><td colSpan={8} className="px-3 pt-3 pb-1 text-[11.5px] font-bold uppercase tracking-wide text-matn-xira">{exam.blocks[x.b]?.subject || `${x.b + 1}-blok`}</td></tr>}
                    <tr className={`${yangilangan === x.q ? 'bg-yaxshi-fon/60' : ''} ${band === x.q ? 'opacity-50' : ''}`}>
                      <td className="px-2 py-2 text-center raqam text-matn-sokin align-top">{x.n}</td>
                      <td className="px-2 py-2 align-top">
                        <span className="inline-flex items-center gap-1.5 raqam text-matn-sokin"><span className={`w-2 h-2 rounded-full ${dq.nuqta}`} title={dq.nom} />{x.q}</span>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className={`${SAVOL_MATNI} text-matn line-clamp-2 [&_p]:my-0 [&_img]:max-h-10`} dangerouslySetInnerHTML={{ __html: formulaliHtml(x.text) || (x.imageUrl ? '<p>[rasm]</p>' : '<p>—</p>') }} />
                        {x.t === 'yopiq' && x.options.length > 0 && (
                          <div className="mt-0.5 text-[11.5px] text-matn-xira truncate">
                            {x.options.map((o, oi) => <span key={oi} className={`mr-2.5 ${javob(x) === HARFLAR[oi] ? 'text-yaxshi font-semibold' : ''}`}>{HARFLAR[oi]}) <span dangerouslySetInnerHTML={{ __html: formulaliHtml(o).replace(/<\/?p>/g, '') }} /></span>)}
                          </div>
                        )}
                        {x.pa && <span className="text-[11px] text-matn-xira">matnga bog'langan</span>}
                      </td>
                      <td className="px-2 py-2 align-top text-matn-sokin hidden md:table-cell">{x.topic}</td>
                      <td className="px-2 py-2 align-top text-center font-bold text-yaxshi raqam">{javob(x) ?? '—'}</td>
                      <td className="px-2 py-2 align-top text-center raqam text-matn-xira">{x.usedCount}</td>
                      {ochiq && (
                        <td className="px-2 py-1.5 align-top text-right whitespace-nowrap">
                          {qidOchiq === x.q ? (
                            <form className="inline-flex items-center gap-1" onSubmit={e => { e.preventDefault(); if (qid) almashtir(x.q, Number(qid)); }}>
                              <input autoFocus inputMode="numeric" className="w-16 px-2 py-1 bg-ichki border border-chiziq rounded-lg text-[12px] raqam outline-none focus:border-brand" placeholder="QID"
                                aria-label={`#${x.q} o'rniga QID`} value={qid} onChange={e => setQid(e.target.value.replace(/\D/g, ''))} />
                              <button type="submit" aria-label="Qo'yish" disabled={!qid || band != null} className="p-1 rounded-lg text-yaxshi hover:bg-yaxshi-fon cursor-pointer disabled:opacity-40"><Check size={15} /></button>
                              <button type="button" aria-label="Bekor" onClick={() => { setQidOchiq(null); setQid(''); }} className="p-1 rounded-lg text-matn-xira hover:bg-ichki cursor-pointer"><X size={15} /></button>
                            </form>
                          ) : !x.pa && (
                            <span className="inline-flex gap-0.5">
                              <button type="button" disabled={band != null} onClick={() => almashtir(x.q)} title="O'sha mavzu va qiyinlikdan boshqa savol" aria-label={`#${x.q} ni almashtirish`}
                                className="p-1.5 rounded-lg text-matn-sokin hover:text-brand hover:bg-ichki cursor-pointer disabled:opacity-40">{band === x.q ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}</button>
                              <button type="button" disabled={band != null} onClick={() => { setQidOchiq(x.q); setQid(''); }} title="QID bo'yicha aniq savol qo'yish" aria-label={`#${x.q} o'rniga QID`}
                                className="p-1.5 rounded-lg text-matn-sokin hover:text-brand hover:bg-ichki cursor-pointer disabled:opacity-40"><Hash size={15} /></button>
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
    </Karta>
  );
}
