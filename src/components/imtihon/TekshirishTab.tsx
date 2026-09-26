import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, ChevronRight, CheckCircle2, AlertTriangle, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, Tanlov, Yorliq, INPUT, Yuklanmoqda, BoshHolat } from './ui';
import { varaqSahifalari, W, type Sahifa } from '../../lib/omr/layout';
import { varaqTuzilmasi, HARFLAR, vergul } from '../../../lib/imtihon.js';
import { useAiHolat, AI_SOZLANMAGAN } from './useAiHolat';
import type { ImtihonTafsil } from './turlar';

// 5-bo'lim: skaner ishonmagan javoblar (ikki belgi, noaniq bo'yoq, variant
// nomuvofiqligi) va yozma javoblarni baholash. Har qator varaq rasmidan
// kesib ko'rsatiladi — operator qog'ozni qidirmaydi. Qaror saqlangach, qayta
// skanerlash uni o'zgartirmaydi.

interface RoyxatNatija { id: number; name: string; reviewStatus: string; shubhalar: number; score: number; groupName: string; sheetCode: string | null }
interface Tafsil {
  id: number; name: string; session: number | null; variantCode: string | null; reviewStatus: string; score: number;
  raw: Record<string, string> | null; manual: Record<string, any> | null; flags: { n: number; sabab: string; f?: number[] }[] | null;
  pages: Record<string, { url: string }> | null; answers: Record<string, any> | null;
  items: { n: number; t: string; p: number; m?: number[] }[];
  shubhalar: { n: number; sabab: string; f?: number[] }[];
  seat: { variant: string | null; sheetCode: string } | null;
}

type Quti = { x: number; y: number; w: number; h: number };

/**
 * To'g'rilangan varaq rasmidan bir bo'lak (mm koordinata). O'lchami foizda:
 * telefonda ekran eniga mutanosib kichrayadi (kesilib qolmaydi), katta ekranda
 * `pxMm` masshtabigacha kattalashadi.
 */
function Kesim({ url, quti, pxMm = 5 }: { url?: string; quti: Quti; pxMm?: number }) {
  if (!url) return <div className="flex items-center gap-1.5 text-[12px] text-matn-xira"><ImageIcon size={14} /> Rasm saqlanmagan</div>;
  return (
    <div className="relative overflow-hidden rounded-lg border border-chiziq bg-white w-full" style={{ maxWidth: quti.w * pxMm, aspectRatio: `${quti.w} / ${quti.h}` }}>
      {/* Siljish enga nisbatan (margin-top foizi ham enidan olinadi): `top` foizi ramkasiz
          balandlikdan hisoblanadi va 6,8 mm li qatorda 2px ramka bitta qatorga surib qo'yardi. */}
      <img src={url} alt="" draggable={false} className="absolute top-0 max-w-none select-none"
        style={{ width: `${(W / quti.w) * 100}%`, left: `${(-quti.x / quti.w) * 100}%`, marginTop: `${(-quti.y / quti.w) * 100}%` }} />
    </div>
  );
}

/** Varaq rasmidan kesib, JPEG data URL (AI ga yozma javobni ko'rsatish uchun). */
async function kesimRasmi(url: string, quti: Quti): Promise<string> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  const k = img.naturalWidth / W;
  const c = document.createElement('canvas');
  c.width = Math.round(quti.w * k);
  c.height = Math.round(quti.h * k);
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, quti.x * k, quti.y * k, quti.w * k, quti.h * k, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.92);
}

type AiTaklif = { ball: number; maks: number; izoh: string; oqildi: string; oqibBolmadi: boolean };

export default function TekshirishTab({ exam, yangila }: { exam: ImtihonTafsil; yangila: () => Promise<any> }) {
  const { ozgartira, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.natija');
  const { soro } = useImtihonApi();
  const [filtr, setFiltr] = useState<'shubhali' | 'hammasi'>('shubhali');
  const [royxat, setRoyxat] = useState<RoyxatNatija[] | null>(null);
  const [tanlangan, setTanlangan] = useState<number | null>(null);
  const [t, setT] = useState<Tafsil | null>(null);
  const [qaror, setQaror] = useState<Record<string, any>>({});
  const [variant, setVariant] = useState<string | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [qidiruv, setQidiruv] = useState('');
  const ai = useAiHolat();
  const [aiTaklif, setAiTaklif] = useState<Record<number, AiTaklif>>({});
  const [aiBand, setAiBand] = useState<number | null>(null);

  const sahifalar: Sahifa[] = useMemo(() => varaqSahifalari({
    tuzilma: varaqTuzilmasi(exam.blocks, exam.scoring) as any,
    optionCount: exam.settings.optionCount, variantCount: exam.settings.variantCount, variantBubble: exam.settings.variantBubble,
  }), [exam]);
  const joy = useMemo(() => {
    const m = new Map<number, { page: number; quti: Quti; turi: string }>();
    for (const sh of sahifalar) {
      for (const q of sh.yopiq) {
        const d0 = q.doiralar[0], d1 = q.doiralar[q.doiralar.length - 1];
        m.set(q.n, { page: sh.page, turi: 'yopiq', quti: { x: d0.x - 10.5, y: d0.y - 3.4, w: d1.x - d0.x + 13.5, h: 6.8 } });
      }
      for (const q of sh.raqamli) m.set(q.n, { page: sh.page, turi: 'raqamli', quti: { x: q.quti.x - 1, y: q.quti.y - 1, w: q.quti.w + 2, h: q.quti.h + 2 } });
      for (const q of sh.yozma) m.set(q.n, { page: sh.page, turi: 'yozma', quti: { x: q.quti.x - 1, y: q.quti.y - 5, w: q.quti.w + 2, h: q.quti.h + 6 } });
    }
    return m;
  }, [sahifalar]);

  const royxatniYukla = useCallback(() => soro<RoyxatNatija[]>('GET', `exams/${exam.id}/results${filtr === 'shubhali' ? '?holat=shubhali' : ''}`).then(r => {
    setRoyxat(r);
    return r;
  }), [exam.id, filtr, soro]);
  useEffect(() => { royxatniYukla().then(r => { if (r.length && !tanlangan) setTanlangan(r[0].id); }).catch(e => showNotification(e.message, 'error')); }, [royxatniYukla]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tanlangan) { setT(null); return; }
    setT(null);
    soro<Tafsil>('GET', `exam-results/${tanlangan}`).then(d => {
      setT(d);
      setQaror({});
      setVariant(null);
      setAiTaklif({});
    }).catch(e => showNotification(e.message, 'error'));
  }, [tanlangan, soro, showNotification]);

  const itemMap = useMemo(() => new Map((t?.items || []).map(it => [it.n, it])), [t]);
  const yozmalar = (t?.items || []).filter(it => it.t === 'yozma');
  const shubhalar = (t?.shubhalar || []).filter(f => f.n > 0 && itemMap.get(f.n)?.t !== 'yozma');
  const variantShubha = (t?.shubhalar || []).find(f => f.n === 0);
  const harflar = HARFLAR.slice(0, exam.settings.optionCount);

  const saqla = async (keyingisi: boolean) => {
    if (!t) return;
    const manual: Record<string, any> = { ...qaror };
    // Shubhali javobga qaror berilmagan bo'lsa — skaner taklifi qabul qilinadi.
    for (const f of shubhalar) if (!(f.n in manual)) manual[f.n] = t.raw?.[f.n] ?? '';
    for (const y of yozmalar) if (!(y.n in manual) && t.manual?.[y.n] === undefined) {
      showNotification(`${y.n}-savol (yozma) bali kiritilmagan`, 'error');
      return;
    }
    const body: any = { manual };
    if (variantShubha) body.variant = variant || t.variantCode;
    setSaqlanmoqda(true);
    try {
      const r = await soro<any>('PUT', `exam-results/${t.id}/review`, body);
      showNotification(`${t.name}: ${r.score} ball — tekshirildi`, 'success');
      const yangiRoyxat = await royxatniYukla();
      yangila();
      if (keyingisi) {
        const keyingi = yangiRoyxat.find(x => x.id !== t.id && x.reviewStatus === 'shubhali');
        setTanlangan(keyingi ? keyingi.id : null);
      } else {
        setTanlangan(null);
        setTimeout(() => setTanlangan(t.id), 0);
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  // AI faqat taklif beradi: ballni operator «Qo'llash» bilan qo'yadi.
  const aiBaho = async (n: number) => {
    const j = joy.get(n);
    const url = j && rasm(j.page);
    if (!t || !j || !url) return;
    setAiBand(n);
    try {
      let kesim: string;
      try { kesim = await kesimRasmi(url, j.quti); } catch { throw new Error("Varaq rasmini olib bo'lmadi"); }
      const r = await soro<AiTaklif>('POST', `exam-results/${t.id}/ai/baho`, { n, rasm: kesim });
      setAiTaklif(x => ({ ...x, [n]: r }));
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setAiBand(null);
    }
  };

  const korinadigan = (royxat || []).filter(r => !qidiruv || r.name.toLowerCase().includes(qidiruv.toLowerCase()));
  const rasm = (page: number) => t?.pages?.[String(page)]?.url;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Karta sarlavha="Varaqlar" className="lg:col-span-1 h-fit" amallar={<Tanlov kichik qiymat={filtr} onChange={v => { setFiltr(v); setTanlangan(null); }} variantlar={[{ v: 'shubhali', nom: 'Shubhali' }, { v: 'hammasi', nom: 'Hammasi' }]} />} ichki="p-0">
        <div className="px-4 pb-3"><input className={`${INPUT} py-2`} placeholder="Ism bo'yicha" value={qidiruv} onChange={e => setQidiruv(e.target.value)} /></div>
        {!royxat ? <Yuklanmoqda /> : !korinadigan.length ? (
          <BoshHolat ikonka={<CheckCircle2 size={20} />} sarlavha={filtr === 'shubhali' ? "Shubhali varaq yo'q" : "Natija yo'q"} izoh={filtr === 'shubhali' ? "Hamma varaq tekshirilgan — «Natijalar» bo'limida e'lon qilishingiz mumkin." : undefined} />
        ) : (
          <ul className="divide-y divide-chiziq max-h-[70vh] overflow-y-auto">
            {korinadigan.map(r => (
              <li key={r.id}>
                <button onClick={() => setTanlangan(r.id)} className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 cursor-pointer ${tanlangan === r.id ? 'bg-brand-fon dark:bg-brand/15' : 'hover:bg-ichki'}`}>
                  <span className="min-w-0">
                    <span className="block text-[13px] text-matn truncate">{r.name}</span>
                    <span className="block text-[11.5px] text-matn-xira">{r.groupName || r.sheetCode} · {r.score} ball</span>
                  </span>
                  {r.reviewStatus === 'shubhali' ? <Yorliq rang="ogoh">{r.shubhalar || '✎'}</Yorliq> : r.reviewStatus === 'tekshirildi' ? <CheckCircle2 size={15} className="text-yaxshi" /> : null}
                  <ChevronRight size={14} className="text-matn-xira shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Karta>

      <div className="lg:col-span-2 space-y-4">
        {!tanlangan ? (
          <Karta><BoshHolat ikonka={<ClipboardCheck size={20} />} sarlavha="Varaqni tanlang" /></Karta>
        ) : !t ? <Karta><Yuklanmoqda /></Karta> : (
          <>
            <Karta sarlavha={t.name} izoh={`Variant ${t.variantCode || '—'} · ${t.score} ball · ${t.seat?.sheetCode || ''}`}
              amallar={t.pages && Object.keys(t.pages).length > 0 && (
                <div className="flex gap-1.5">{Object.entries(t.pages).map(([p, v]) => <a key={p} href={v.url} target="_blank" rel="noreferrer" className="text-[12px] text-brand hover:underline">{p}-sahifa rasmi</a>)}</div>
              )}>
              {variantShubha && (
                <div className="rounded-xl border border-ogoh/30 bg-ogoh-fon p-3 mb-3">
                  <p className="text-[13px] text-matn flex items-center gap-1.5"><AlertTriangle size={15} className="text-ogoh" /> {variantShubha.sabab}</p>
                  <p className="text-[12px] text-matn-sokin mt-1">O'quvchi qaysi kitobcha bilan ishlagan? (odatda varaqda bo'yalgani)</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {exam.variantlar.filter(v => v.session === (t.session ?? 1)).map(v => (
                      <button key={v.code} onClick={() => setVariant(v.code)} className={`w-9 h-9 rounded-lg border text-[13px] font-bold cursor-pointer ${(variant || t.variantCode) === v.code ? 'bg-brand border-brand text-brand-ust' : 'border-chiziq text-matn-sokin'}`}>{v.code}</button>
                    ))}
                  </div>
                </div>
              )}
              {!shubhalar.length && !yozmalar.length && !variantShubha && <p className="text-[13px] text-matn-sokin">Bu varaqda shubhali javob yo'q.</p>}
              <div className="space-y-3">
                {shubhalar.map(f => {
                  const j = joy.get(f.n);
                  const it = itemMap.get(f.n);
                  const tanlov = qaror[f.n] ?? t.raw?.[f.n] ?? '';
                  return (
                    <div key={f.n} className="rounded-xl border border-chiziq p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <p className="text-[13px] font-semibold text-matn">{f.n}-savol <span className="font-normal text-matn-sokin">· {f.sabab}</span></p>
                        {f.f && <p className="text-[11px] text-matn-xira raqam">to'lganlik: {f.f.map((x, i) => `${harflar[i] || i + 1} ${Math.round(x * 100)}%`).join(' · ')}</p>}
                      </div>
                      {j && <Kesim url={rasm(j.page)} quti={j.quti} pxMm={j.turi === 'raqamli' ? 4 : 6} />}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {it?.t === 'raqamli' ? (
                          <input className={`${INPUT} w-32 py-1.5`} value={tanlov} onChange={e => setQaror(q => ({ ...q, [f.n]: e.target.value }))} placeholder="Javob" />
                        ) : (
                          <>
                            {harflar.map(h => (
                              <button key={h} disabled={!tahrir} onClick={() => setQaror(q => ({ ...q, [f.n]: h }))}
                                className={`w-9 h-9 rounded-full border text-[13px] font-bold cursor-pointer ${tanlov === h ? 'bg-brand border-brand text-brand-ust' : 'border-chiziq text-matn-sokin hover:border-brand'}`}>{h}</button>
                            ))}
                            <button disabled={!tahrir} onClick={() => setQaror(q => ({ ...q, [f.n]: '' }))} className={`px-3 h-9 rounded-full border text-[12px] font-semibold cursor-pointer ${tanlov === '' ? 'bg-brand border-brand text-brand-ust' : 'border-chiziq text-matn-sokin'}`}>Bo'sh</button>
                            <button disabled={!tahrir} onClick={() => setQaror(q => ({ ...q, [f.n]: '*' }))} className={`px-3 h-9 rounded-full border text-[12px] font-semibold cursor-pointer ${tanlov === '*' ? 'bg-xato border-xato text-white' : 'border-chiziq text-matn-sokin'}`}>Bekor (ikki javob)</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {yozmalar.map(it => {
                  const j = joy.get(it.n);
                  const joriy = qaror[it.n]?.ball ?? t.manual?.[it.n]?.ball ?? '';
                  return (
                    <div key={it.n} className="rounded-xl border border-chiziq p-3">
                      <p className="text-[13px] font-semibold text-matn mb-2">{it.n}-savol — yozma ({it.p} ball)</p>
                      {j && <Kesim url={rasm(j.page)} quti={j.quti} pxMm={3.4} />}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[12.5px] text-matn-sokin">Ball:</span>
                        <input className={`${INPUT} w-24 py-1.5`} inputMode="decimal" disabled={!tahrir} value={joriy}
                          onChange={e => {
                            const v = e.target.value.replace(',', '.');
                            setQaror(q => {
                              const yangi = { ...q };
                              if (v === '') delete yangi[it.n];
                              else yangi[it.n] = { ball: Math.min(it.p, Math.max(0, Number(v) || 0)) };
                              return yangi;
                            });
                          }} />
                        <span className="text-[12px] text-matn-xira">/ {it.p}</span>
                        {[0, it.p / 2, it.p].map(b => <Tugma key={b} kichik turi="oddiy" disabled={!tahrir} onClick={() => setQaror(q => ({ ...q, [it.n]: { ball: b } }))}>{b}</Tugma>)}
                        {tahrir && ai && j && rasm(j.page) && (
                          <Tugma kichik ikonka={<Sparkles size={13} />} disabled={!ai.yoqilgan} title={ai.yoqilgan ? "AI javobni o'qib, ball taklif qiladi" : AI_SOZLANMAGAN}
                            yuklanmoqda={aiBand === it.n} onClick={() => aiBaho(it.n)}>AI taklifi</Tugma>
                        )}
                      </div>
                      {aiTaklif[it.n] && (
                        <div className="mt-2 rounded-xl border border-brand/30 bg-brand-fon/60 dark:bg-brand/10 p-3 space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[13px] text-matn">AI taklifi: <b className="raqam">{vergul(aiTaklif[it.n].ball)} / {vergul(aiTaklif[it.n].maks)}</b>{aiTaklif[it.n].oqibBolmadi && <span className="text-ogoh"> · yozuv yaxshi o'qilmadi</span>}</p>
                            <Tugma kichik turi="asosiy" onClick={() => setQaror(q => ({ ...q, [it.n]: { ball: aiTaklif[it.n].ball } }))}>Qo'llash</Tugma>
                          </div>
                          <p className="text-[12.5px] text-matn-sokin whitespace-pre-wrap">{aiTaklif[it.n].izoh}</p>
                          {aiTaklif[it.n].oqildi && (
                            <details className="text-[12px] text-matn-xira"><summary className="cursor-pointer">AI o'qigan matn</summary><p className="mt-1 whitespace-pre-wrap">{aiTaklif[it.n].oqildi}</p></details>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {tahrir && (shubhalar.length > 0 || yozmalar.length > 0 || variantShubha) && (
                <div className="flex flex-wrap justify-end gap-2 mt-4">
                  <Tugma yuklanmoqda={saqlanmoqda} onClick={() => saqla(false)}>Saqlash</Tugma>
                  <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} onClick={() => saqla(true)}>Tasdiqlash va keyingisi <ChevronRight size={14} /></Tugma>
                </div>
              )}
            </Karta>
          </>
        )}
      </div>
    </div>
  );
}
