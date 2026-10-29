import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, RefreshCw, Hash, Repeat2 } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Tugma, Yuklanmoqda, INPUT } from './ui';
import { formulaliHtml, SAVOL_MATNI } from '../../lib/matn';
import { qiyinlikDaraja } from './bank/qiyinlik';
import type { ImtihonTafsil } from './turlar';

// Variantlar jadvali (2026-10-29): qator — savol o'rni (mavzu va qiyinlik), ustun — variant.
// «Har xil» rejimida har o'rinda hamma variantning savoli boshqa, lekin mavzu va qiyinligi bir
// xil; sariq katak — savol boshqa variantda ham bor (bankda kam). Qulfgacha faqat ko'rinadi
// (yig'ish), qulfdan keyin natija kelguncha katak bosilib savol almashtiriladi.

export interface JadvalMalumoti {
  variantlar: { session: number; code: string; items: { n: number; y?: string; q: number | null; b: number; t: string; pa?: number }[] }[];
  savollar: Record<number, { text: string; imageUrl: string | null; topic: string; difficulty: number; usedCount: number }>;
  /** Qo'lda tanlangan savollar — ataylab hamma variantda, takror emas. */
  qolda?: number[];
}

interface Tanlangan { q: number; session: number; code: string; n: number; y?: string }

export const harXilmi = (exam: Pick<ImtihonTafsil, 'settings'>) => (exam.settings.variantSavollari ?? 'har') === 'har' && exam.settings.variantCount > 1;

export default function VariantJadvali({ exam, data, almashtiradi, onAlmashdi }: {
  exam: ImtihonTafsil; data: JadvalMalumoti; almashtiradi: boolean; onAlmashdi?: () => void;
}) {
  const s = exam.settings;
  const har = harXilmi(exam);
  const smenalar = [...new Set(data.variantlar.map(v => v.session))];
  const [smena, setSmena] = useState(smenalar[0]);
  const [blok, setBlok] = useState(0);
  const [tanlangan, setTanlangan] = useState<Tanlangan | null>(null);
  const variantlar = data.variantlar.filter(v => v.session === smena);

  // Savol shu smenaning qaysi variantida birinchi uchragan — keyingilarida «takror».
  const birinchi = useMemo(() => {
    const m = new Map<number, string>();
    for (const v of variantlar) for (const it of v.items) if (it.q != null && !m.has(it.q)) m.set(it.q, v.code);
    return m;
  }, [variantlar]);
  const qolda = useMemo(() => new Set(data.qolda || []), [data.qolda]);
  const takrormi = (code: string, q: number | null) => har && q != null && !qolda.has(q) && birinchi.get(q) !== code;
  const qatorlar = (b: number) => (variantlar[0]?.items || []).filter(it => it.b === b);
  const blokTakrori = (b: number) => variantlar.reduce((a, v) => a + v.items.filter(it => it.b === b && takrormi(v.code, it.q)).length, 0);
  // «Bir xil» da B, C, D — o'sha savollar boshqa tartibda: ustunma-ustun ko'rsatish chalg'itadi, bitta ro'yxat yetadi.
  const ustunlar = har ? variantlar : variantlar.slice(0, 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {exam.blocks.length > 1 && (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Fan">
            {exam.blocks.map((b, i) => {
              const t = blokTakrori(i);
              return (
                <button key={i} type="button" aria-pressed={blok === i} onClick={() => setBlok(i)}
                  className={`px-2.5 py-1 rounded-lg border text-[12.5px] font-semibold cursor-pointer ${blok === i ? 'bg-brand-fon border-brand/30 text-brand-dark dark:bg-brand/20 dark:text-brand-accent' : 'bg-ichki border-chiziq text-matn-sokin hover:text-matn'}`}>
                  {b.subject}<span className="raqam text-[11px] opacity-75 ml-1">{qatorlar(i).length}{t ? ` · ↺${t}` : ''}</span>
                </button>
              );
            })}
          </div>
        )}
        {smenalar.length > 1 && (
          <select aria-label="Smena" value={smena} onChange={e => setSmena(Number(e.target.value))}
            className="ml-auto px-2.5 py-1 rounded-lg border border-chiziq bg-sirt text-[12.5px] text-matn">
            {smenalar.map(sm => <option key={sm} value={sm}>{s.sessions.find(x => x.id === sm)?.name || `${sm}-smena`}</option>)}
          </select>
        )}
      </div>

      {!har && variantlar.length > 1 && (
        <p className="text-[12px] text-matn-sokin">Hamma variantda shu savollar — {variantlar.slice(1).map(v => v.code).join(', ')} variantlarda faqat tartibi va javob harflari boshqa.</p>
      )}
      <div className="overflow-x-auto rounded-xl border border-chiziq">
        <table className="w-full text-[12.5px]" style={{ minWidth: 180 + ustunlar.length * 150 }}>
          <thead className="bg-ichki text-matn-sokin text-[11.5px]">
            <tr>
              <th className="px-2 py-2 w-10 text-left font-semibold">№</th>
              <th className="px-2 py-2 w-36 text-left font-semibold">Mavzu · qiyinlik</th>
              {ustunlar.map(v => <th key={v.code} className={`px-2 py-2 font-semibold text-matn ${har ? 'text-center' : 'text-left'}`}>{har ? `${v.code} variant` : 'Savol'}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-chiziq">
            {qatorlar(blok).map(asos => {
              const kataklar = ustunlar.map(v => v.items.find(it => it.n === asos.n));
              const sav = kataklar.map(it => (it?.q != null ? data.savollar[it.q] : undefined));
              // O'rin sarlavhasi — hamma variantda bir xil bo'lsa («Bir xil» rejimida tartib aralashgan bo'ladi).
              const kalit = (x?: { topic: string; difficulty: number }) => (x ? `${x.topic}|${qiyinlikDaraja(x.difficulty).d}` : '');
              const birXil = sav.every(x => kalit(x) === kalit(sav[0]));
              const dq = sav[0] ? qiyinlikDaraja(sav[0].difficulty) : null;
              return (
                <tr key={asos.n} className="align-top">
                  <td className="px-2 py-2.5 raqam text-matn-xira">{asos.y ?? asos.n}</td>
                  <td className="px-2 py-2.5">
                    {birXil && sav[0] ? (
                      <>
                        <span className="block font-semibold text-matn">{sav[0].topic || '—'}</span>
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-matn-sokin"><span className={`w-2 h-2 rounded-full ${dq!.nuqta}`} />{dq!.nom}</span>
                      </>
                    ) : <span className="text-matn-xira">—</span>}
                  </td>
                  {kataklar.map((it, vi) => {
                    const q = it?.q ?? null;
                    const x = q != null ? data.savollar[q] : undefined;
                    const takror = takrormi(ustunlar[vi].code, q);
                    const bosiladi = almashtiradi && q != null && !it?.pa;
                    const ichi = (
                      <>
                        <span className={`block raqam text-[11px] ${takror ? 'text-ogoh' : 'text-brand'}`}>#{q ?? '—'}{!birXil && x ? <span className="text-matn-xira"> · {x.topic}</span> : null}</span>
                        <span className={`${SAVOL_MATNI} block text-matn text-[12px] leading-snug line-clamp-2 [&_p]:my-0 [&_img]:!max-h-12 [&_img]:!inline-block`}
                          dangerouslySetInnerHTML={{ __html: x ? formulaliHtml(x.text) || (x.imageUrl ? '<p>[rasm]</p>' : '<p>—</p>') : '' }} />
                        {takror && <span className="block text-[10.5px] font-semibold text-ogoh">↺ {birinchi.get(q!)} variantda ham bor</span>}
                        {it?.pa && <span className="block text-[10.5px] text-matn-xira">matn bilan birga</span>}
                      </>
                    );
                    return (
                      <td key={vi} className="p-1">
                        {bosiladi ? (
                          <button type="button" onClick={() => setTanlangan({ q: q!, session: smena, code: ustunlar[vi].code, n: asos.n, y: asos.y })}
                            aria-label={`${asos.y ?? asos.n}-o'rin, ${ustunlar[vi].code} variant, savol ${q} — almashtirish`}
                            className={`w-full text-left rounded-lg border border-transparent px-2 py-1.5 cursor-pointer hover:border-chiziq hover:bg-ichki ${takror ? 'bg-ogoh-fon' : ''}`}>{ichi}</button>
                        ) : <div className={`rounded-lg px-2 py-1.5 ${takror ? 'bg-ogoh-fon' : ''}`}>{ichi}</div>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tanlangan && (
        <AlmashtirishOynasi exam={exam} t={tanlangan} har={har} savol={data.savollar[tanlangan.q]}
          boshqaVariantda={variantlar.filter(v => v.code !== tanlangan.code && v.items.some(it => it.q === tanlangan.q)).map(v => v.code)}
          onYop={() => setTanlangan(null)} onAlmashdi={() => { setTanlangan(null); onAlmashdi?.(); }} />
      )}
    </div>
  );
}

interface Nomzod { id: number; text: string; imageUrl: string | null; difficulty: number; usedCount: number; boshqaQiyinlik: boolean; imtihonda: boolean }

/** Katakdagi savolni almashtirish: o'sha mavzu va turdan, avval o'sha qiyinlik va imtihonda yo'qlari. */
function AlmashtirishOynasi({ exam, t, har, savol, boshqaVariantda, onYop, onAlmashdi }: {
  exam: ImtihonTafsil; t: Tanlangan; har: boolean; savol?: JadvalMalumoti['savollar'][number]; boshqaVariantda: string[];
  onYop: () => void; onAlmashdi: () => void;
}) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [nomzodlar, setNomzodlar] = useState<Nomzod[] | null>(null);
  const [tanlov, setTanlov] = useState<number | null>(null);
  const [qid, setQid] = useState('');
  const [band, setBand] = useState(false);
  // «Bir xil» rejimida savol hamma variantda bir — almashtirish ham hammasida.
  const joyi = har ? { session: t.session, code: t.code } : {};

  useEffect(() => {
    const p = new URLSearchParams({ q: String(t.q), ...(har ? { session: String(t.session), code: t.code } : {}) });
    soro<{ nomzodlar: Nomzod[] }>('GET', `exams/${exam.id}/nomzodlar?${p}`).then(r => setNomzodlar(r.nomzodlar)).catch(e => { showNotification(e.message, 'error'); setNomzodlar([]); });
  }, [exam.id, t, har, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  const almashtir = async (yangi?: number) => {
    setBand(true);
    try {
      const r = await soro<{ eski: number; yangi: number }>('POST', `exams/${exam.id}/savol-almashtir`, { q: t.q, ...(yangi ? { yangi } : {}), ...joyi });
      showNotification(`${har ? `${t.code} variant: ` : ''}#${r.eski} o'rniga #${r.yangi} qo'yildi — kitobcha va kalit yangilandi`, 'success');
      onAlmashdi();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };
  const dq = savol ? qiyinlikDaraja(savol.difficulty) : null;
  const mos = (nomzodlar || []).filter(x => !x.boshqaQiyinlik);
  const yaqin = (nomzodlar || []).filter(x => x.boshqaQiyinlik).slice(0, 4);
  const qator = (x: Nomzod) => (
    <button key={x.id} type="button" aria-pressed={tanlov === x.id} onClick={() => setTanlov(x.id)}
      className={`w-full text-left grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 rounded-xl border px-3 py-2 cursor-pointer ${tanlov === x.id ? 'border-brand bg-brand-fon/50 dark:bg-brand/10' : 'border-chiziq hover:border-chiziq-kuchli'}`}>
      <span className={`mt-0.5 w-4 h-4 rounded-full border-2 row-span-2 ${tanlov === x.id ? 'border-brand border-[5px]' : 'border-chiziq-kuchli'}`} />
      <span className={`${SAVOL_MATNI} text-[12.5px] text-matn line-clamp-2 [&_p]:my-0 [&_img]:max-h-10`} dangerouslySetInnerHTML={{ __html: `<p><b>#${x.id}</b></p>${formulaliHtml(x.text) || (x.imageUrl ? '<p>[rasm]</p>' : '')}` }} />
      <span className="text-[11px] text-matn-xira">
        {x.usedCount} marta ishlatilgan{x.imtihonda ? ' · boshqa variantda bor' : ''}
        {x.boshqaQiyinlik && <span className="text-ogoh font-semibold"> · {qiyinlikDaraja(x.difficulty).nom.toLowerCase()} — qiyinligi boshqa</span>}
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[270] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onYop} />
      <aside role="dialog" aria-label="Savolni almashtirish" className="relative w-full max-w-md h-full bg-sirt border-l border-chiziq shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-chiziq">
          <div>
            <h3 className="text-[14px] font-bold text-matn">{t.y ?? t.n}-o'rin{har ? ` · ${t.code} variant` : ' · hamma variantda'}</h3>
            <p className="text-[12px] text-matn-xira mt-0.5 flex flex-wrap items-center gap-x-2">
              {savol?.topic || '—'}{dq && <span className="inline-flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${dq.nuqta}`} />{dq.nom}</span>}
              {boshqaVariantda.length > 0 && har && <span className="inline-flex items-center gap-1 text-ogoh font-semibold"><Repeat2 size={12} />{boshqaVariantda.join(', ')} variantda ham bor</span>}
            </p>
          </div>
          <button aria-label="Yopish" onClick={onYop} className="p-2 -m-1 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-xl bg-ichki px-3 py-2.5">
            <p className="text-[11.5px] font-semibold text-matn-sokin mb-1">Hozirgi savol #{t.q}</p>
            <div className={`${SAVOL_MATNI} text-[13px] text-matn`} dangerouslySetInnerHTML={{ __html: savol ? formulaliHtml(savol.text) || (savol.imageUrl ? '<p>[rasm]</p>' : '') : '' }} />
          </div>
          {!nomzodlar ? <Yuklanmoqda /> : (
            <>
              <section className="space-y-2">
                <h4 className="text-[12px] font-semibold text-matn-sokin">Shu o'ringa mos — {savol?.topic || 'shu mavzu'}{dq ? `, ${dq.nom.toLowerCase()}` : ''}: {mos.length} ta</h4>
                {mos.length ? mos.map(qator) : <p className="text-[12px] text-matn-xira">Bankda boshqa mos savol yo'q{har ? ' — hammasi shu variantda ishlatilgan' : ''}. Savollar bankiga shu mavzu va qiyinlikda savol qo'shing.</p>}
              </section>
              {yaqin.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-[12px] font-semibold text-matn-sokin">Yaqin (qiyinligi boshqa) — faqat kerak bo'lsa</h4>
                  {yaqin.map(qator)}
                </section>
              )}
            </>
          )}
          <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (qid) almashtir(Number(qid)); }}>
            <Hash size={14} className="text-matn-xira shrink-0" />
            <input inputMode="numeric" className={`${INPUT} py-1.5 raqam`} placeholder="Yoki savol raqami (QID)" aria-label="Savol raqami (QID)" value={qid} onChange={e => setQid(e.target.value.replace(/\D/g, ''))} />
            <Tugma kichik turi="oddiy" disabled={!qid || band}>Qo'yish</Tugma>
          </form>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-chiziq">
          <Tugma kichik turi="oddiy" ikonka={band ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} disabled={band} onClick={() => almashtir()}
            title="Shu mavzu va qiyinlikdan kam ishlatilgani">Avtomatik</Tugma>
          <Tugma kichik turi="asosiy" disabled={!tanlov || band} onClick={() => tanlov && almashtir(tanlov)}>Almashtirish</Tugma>
        </div>
      </aside>
    </div>
  );
}
