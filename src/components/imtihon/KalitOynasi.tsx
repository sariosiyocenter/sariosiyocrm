import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, KeyRound, Ban, Undo2 } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { useImtihonApi } from './useImtihonApi';
import { Tugma, Tanlov, Yorliq, Yuklanmoqda } from './ui';
import { formulaliHtml, SAVOL_MATNI } from '../../lib/matn';
import { HARFLAR } from '../../../lib/imtihon.js';

// Kalit: har variantning to'g'ri javoblari (qo'lda tekshirish uchun) va
// tuzatish — savolni bekor qilish yoki to'g'ri javobni o'zgartirish. Har
// o'zgarishdan keyin server hamma natijani qayta hisoblaydi.

interface KalitJavobi {
  variants: { session: number; code: string; items: { n: number; q: number; t: string; b: number; p: number; javob: any; m?: number[] }[] }[];
  savollar: { id: number; text: string; subject: string; topic: string; type: string; correctAnswer: string; answers?: string[] | null; options: string[] }[];
  cancelled: Record<string, 'hammaga' | 'chiqarish'>;
  keyFix: Record<string, string[]>;
}

export default function KalitOynasi({ examId, onYop, boshSavol }: { examId: number; onYop: (ozgardi: boolean) => void; boshSavol?: number }) {
  const { ozgartira, showNotification } = useCRM();
  const tuzatadi = ozgartira('imtihonlar.kalit');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const [k, setK] = useState<KalitJavobi | null>(null);
  const [korinish, setKorinish] = useState<'variant' | 'savol'>(boshSavol ? 'savol' : 'variant');
  const [session, setSession] = useState(1);
  const [ozgardi, setOzgardi] = useState(false);
  const [saqlanmoqda, setSaqlanmoqda] = useState<number | null>(null);

  const yukla = useCallback(() => soro<KalitJavobi>('GET', `exams/${examId}/key`).then(setK).catch(e => showNotification(e.message, 'error')), [examId, soro, showNotification]);
  useEffect(() => { yukla(); }, [yukla]);

  const smenalar = useMemo(() => [...new Set((k?.variants || []).map(v => v.session))], [k]);
  const variantlar = (k?.variants || []).filter(v => v.session === session);
  const savolMap = useMemo(() => new Map((k?.savollar || []).map(s => [s.id, s])), [k]);
  const savollarTartibi = useMemo(() => {
    // Birinchi variant tartibida, shu smenaning savollari.
    const v = variantlar[0];
    return v ? v.items.map(it => ({ n: it.n, q: it.q, t: it.t })) : [];
  }, [variantlar]);

  const saqla = async (qid: number, patch: { cancelled?: Record<string, any>; keyFix?: Record<string, any> }) => {
    if (!k) return;
    setSaqlanmoqda(qid);
    try {
      const r = await soro<{ cancelled: any; keyFix: any; qaytaHisoblandi: number }>('PUT', `exams/${examId}/key`, {
        cancelled: patch.cancelled ?? k.cancelled,
        keyFix: patch.keyFix ?? k.keyFix,
      });
      setK({ ...k, cancelled: r.cancelled, keyFix: r.keyFix });
      setOzgardi(true);
      showNotification(`Saqlandi — ${r.qaytaHisoblandi} ta natija qayta hisoblandi`, 'success');
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setSaqlanmoqda(null);
    }
  };

  const bekor = async (qid: number, turi: 'hammaga' | 'chiqarish' | null) => {
    const matn = turi === 'hammaga' ? "Bu savol uchun hammaga ball beriladi." : turi === 'chiqarish' ? 'Bu savol hisobdan chiqariladi (eng yuqori ball kamayadi).' : 'Savol yana hisobga olinadi.';
    if (!(await confirm(`${matn} Hamma natija qayta hisoblanadi. Davom etilsinmi?`))) return;
    const c = { ...k!.cancelled };
    if (turi) c[qid] = turi; else delete c[qid];
    saqla(qid, { cancelled: c });
  };

  const kalitniOzgartir = async (qid: number, javoblar: string[] | null) => {
    const f = { ...k!.keyFix };
    if (javoblar && javoblar.length) f[qid] = javoblar; else delete f[qid];
    saqla(qid, { keyFix: f });
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-start sm:items-center justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-black/50" onClick={() => onYop(ozgardi)} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-5xl border border-chiziq max-h-[92vh] flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-chiziq">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-brand" />
            <h3 className="text-[14px] font-bold text-matn">Kalit</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {smenalar.length > 1 && <Tanlov kichik qiymat={session} onChange={setSession} variantlar={smenalar.map(s => ({ v: s, nom: `${s}-smena` }))} />}
            <Tanlov kichik qiymat={korinish} onChange={setKorinish} variantlar={[{ v: 'variant', nom: "Variantlar bo'yicha" }, { v: 'savol', nom: "Savollar (tuzatish)" }]} />
            <button aria-label="Yopish" onClick={() => onYop(ozgardi)} className="p-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
          </div>
        </div>
        <div className="overflow-auto p-4">
          {!k ? <Yuklanmoqda /> : korinish === 'variant' ? (
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="bg-ichki">
                  <th className="sticky left-0 bg-ichki px-2 py-2 text-left font-semibold text-matn-sokin border-b border-chiziq">№</th>
                  {variantlar.map(v => <th key={v.code} className="px-2 py-2 font-bold text-matn border-b border-chiziq">{v.code}</th>)}
                </tr>
              </thead>
              <tbody>
                {(variantlar[0]?.items || []).map((_, i) => (
                  <tr key={i} className="odd:bg-sirt even:bg-ichki/40">
                    <td className="sticky left-0 bg-inherit px-2 py-1.5 font-semibold text-matn-sokin raqam">{i + 1}</td>
                    {variantlar.map(v => {
                      const it = v.items[i];
                      const bekorQilingan = k.cancelled[it.q];
                      const tuzatilgan = k.keyFix[it.q];
                      let javob: string = Array.isArray(it.javob) ? it.javob.map(v => String(v).replace('.', ',')).join(' | ') : it.javob ?? '✎';
                      if (tuzatilgan && it.t === 'yopiq') javob = tuzatilgan.map(h => HARFLAR[it.m?.indexOf(HARFLAR.indexOf(h)) ?? -1] || '?').join('/');
                      else if (tuzatilgan) javob = tuzatilgan.join(' | ');
                      return (
                        <td key={v.code} className={`px-2 py-1.5 text-center raqam ${bekorQilingan ? 'line-through text-matn-xira' : tuzatilgan ? 'text-ogoh font-bold' : 'text-matn font-semibold'}`}>
                          {it.t === 'yozma' ? '✎' : javob}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className="space-y-2">
              {savollarTartibi.map(({ n, q, t }) => {
                const s = savolMap.get(q);
                if (!s) return null;
                const bekorQilingan = k.cancelled[q];
                const tuzatish = k.keyFix[q];
                const asl = t === 'yopiq' ? s.correctAnswer : [s.correctAnswer, ...(s.answers || [])].filter(Boolean).join(' | ');
                return (
                  <li key={q} className={`rounded-xl border p-3 ${boshSavol === q ? 'border-brand ring-2 ring-brand/15' : 'border-chiziq'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-[12px] font-bold text-matn raqam">{n}.</span>
                          <Yorliq>{s.subject}</Yorliq><Yorliq>{s.topic}</Yorliq>
                          {bekorQilingan && <Yorliq rang="ogoh">{bekorQilingan === 'hammaga' ? 'Bekor: hammaga ball' : 'Bekor: hisobdan chiqarildi'}</Yorliq>}
                          {tuzatish && <Yorliq rang="ogoh">Kalit tuzatilgan: {tuzatish.join(', ')}</Yorliq>}
                        </div>
                        <div className={`${SAVOL_MATNI} text-[13px] text-matn line-clamp-3`} dangerouslySetInnerHTML={{ __html: formulaliHtml(s.text) }} />
                        {t === 'yopiq' && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {s.options.map((o, i) => {
                              const h = HARFLAR[i];
                              const qabul = tuzatish ? tuzatish.includes(h) : s.correctAnswer === h;
                              return (
                                <button key={i} disabled={!tuzatadi || saqlanmoqda === q}
                                  onClick={() => {
                                    const joriy = tuzatish || [s.correctAnswer];
                                    const yangi = joriy.includes(h) ? joriy.filter(x => x !== h) : [...joriy, h];
                                    const aslMi = yangi.length === 1 && yangi[0] === s.correctAnswer;
                                    kalitniOzgartir(q, aslMi || !yangi.length ? null : yangi.sort());
                                  }}
                                  title={tuzatadi ? "Bosing — to'g'ri javoblar qatoriga qo'shish/olish" : ''}
                                  className={`max-w-xs text-left rounded-lg border px-2.5 py-1.5 text-[12px] ${qabul ? 'bg-yaxshi-fon border-yaxshi/40 text-matn' : 'bg-sirt border-chiziq text-matn-sokin'} ${tuzatadi ? 'cursor-pointer hover:border-brand' : ''}`}>
                                  <b>{h})</b> <span dangerouslySetInnerHTML={{ __html: formulaliHtml(o) }} />
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {t === 'raqamli' && <p className="text-[12px] text-matn-sokin mt-1">To'g'ri javob: <b className="text-matn">{tuzatish ? tuzatish.join(' | ') : asl}</b></p>}
                      </div>
                      {tuzatadi && t !== 'yozma' && (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          {bekorQilingan ? (
                            <Tugma kichik ikonka={<Undo2 size={13} />} yuklanmoqda={saqlanmoqda === q} onClick={() => bekor(q, null)}>Qaytarish</Tugma>
                          ) : (
                            <>
                              <Tugma kichik ikonka={<Ban size={13} />} yuklanmoqda={saqlanmoqda === q} onClick={() => bekor(q, 'hammaga')}>Bekor: hammaga ball</Tugma>
                              <Tugma kichik turi="oddiy" yuklanmoqda={saqlanmoqda === q} onClick={() => bekor(q, 'chiqarish')}>Hisobdan chiqarish</Tugma>
                            </>
                          )}
                          {t === 'raqamli' && (
                            <Tugma kichik turi="oddiy" onClick={async () => {
                              const v = window.prompt("Qabul qilinadigan javoblar (; bilan ajrating). Bo'sh qoldirilsa — asl kalit.", (tuzatish || [asl]).join('; '));
                              if (v === null) return;
                              kalitniOzgartir(q, v.split(';').map(x => x.trim()).filter(Boolean));
                            }}>Javobni o'zgartirish</Tugma>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="px-5 py-3 border-t border-chiziq text-[11.5px] text-matn-xira">
          Kalit tuzatilsa yoki savol bekor qilinsa, hamma natija darhol qayta hisoblanadi. E'lon qilingan bo'lsa — reyting uchun «E'lon qilish»ni qayta bosing (yuborilgan xabarlar qaytarib olinmaydi).
        </div>
      </div>
    </div>
  );
}
