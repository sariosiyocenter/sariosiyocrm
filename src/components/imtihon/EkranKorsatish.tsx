import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Maximize2, X, Eye, EyeOff } from 'lucide-react';
import { formulaliHtml, SAVOL_MATNI } from '../../lib/matn';
import { HARFLAR, raqamYorligi } from '../../../lib/imtihon.js';
import type { Exam } from '../../types';
import type { KitobchaMalumoti, KalitMalumoti } from './chop';

// Addmen QPG «PowerPoint output» o'rnida: savollar proyektorda bittalab (tahlil darsi, ochiq test).
// Formulalar va rasmlar ilovadagidek. ← → / Probel — o'tish, J — javob (kalit ko'rish ruxsati bo'lsa),
// F — to'liq ekran, Esc — yopish.

type Props = {
  exam: Exam;
  d: KitobchaMalumoti;
  session: number;
  code: string;
  kalit: KalitMalumoti | null;
  onYop: () => void;
};

export default function EkranKorsatish({ exam, d, session, code, kalit, onYop }: Props) {
  const ildiz = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [javob, setJavob] = useState(false);
  const v = d.variants.find(x => x.session === session && x.code === code);
  const savolMap = useMemo(() => new Map(d.savollar.map(q => [q.id, q])), [d]);
  const matnMap = useMemo(() => new Map(d.matnlar.map(p => [p.id, p])), [d]);
  const kalitItem = useMemo(() => new Map((kalit?.variants.find(x => x.session === session && x.code === code)?.items || []).map(it => [it.n, it])), [kalit, session, code]);
  const items = v?.items || [];
  // 0-slayd — sarlavha, keyin har savol.
  const jami = items.length + 1;

  const ot = useCallback((k: number) => { setI(x => Math.max(0, Math.min(jami - 1, x + k))); setJavob(false); }, [jami]);
  const toliqEkran = () => { const el = ildiz.current; if (el && !document.fullscreenElement) el.requestFullscreen?.().catch(() => { /* brauzer ruxsat bermasa — oddiy oynada */ }); };

  useEffect(() => {
    const bos = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); ot(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); ot(-1); }
      else if (e.key === 'Escape' && !document.fullscreenElement) onYop();
      else if ((e.key === 'j' || e.key === 'J') && kalit) setJavob(x => !x);
      else if (e.key === 'f' || e.key === 'F') toliqEkran();
    };
    window.addEventListener('keydown', bos);
    return () => window.removeEventListener('keydown', bos);
  }, [ot, onYop, kalit]);

  const it = i > 0 ? items[i - 1] : null;
  const q = it ? savolMap.get(it.q) : null;
  const matn = it?.pa ? matnMap.get(it.pa) : null;
  const ki = it ? kalitItem.get(it.n) : null;
  const togriHarflar = new Set(String(Array.isArray(ki?.javob) ? ki?.javob.join('') : ki?.javob || '').toUpperCase().split(''));
  const tartib = it && q ? (it.m && it.m.length ? it.m : q.options.map((_, k) => k)) : [];
  const fan = it ? exam.blocks[it.b]?.subject : '';

  return createPortal(
    <div ref={ildiz} role="dialog" aria-modal="true" aria-label="Ekranda ko'rsatish" className="fixed inset-0 z-[100] bg-white text-slate-900 flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-b border-slate-200 text-[13px] text-slate-500">
        <span className="truncate">{exam.name} · Variant <b className="text-slate-800">{code}</b>{fan ? ` · ${fan}` : ''}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="tabular-nums mr-2">{i} / {items.length}</span>
          {kalit && it && (
            <button onClick={() => setJavob(x => !x)} className="h-8 px-3 rounded-lg border border-slate-300 hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer" title="Javob (J)">
              {javob ? <EyeOff size={14} /> : <Eye size={14} />} Javob
            </button>
          )}
          <button onClick={toliqEkran} className="h-8 w-8 rounded-lg border border-slate-300 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer" aria-label="To'liq ekran (F)" title="To'liq ekran (F)"><Maximize2 size={14} /></button>
          <button onClick={onYop} className="h-8 w-8 rounded-lg border border-slate-300 hover:bg-slate-100 inline-flex items-center justify-center cursor-pointer" aria-label="Yopish (Esc)" title="Yopish (Esc)"><X size={15} /></button>
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-[6vw] py-[4vh]">
        {!it ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <p className="text-[2.2vw] text-slate-500">{exam.date}</p>
            <h1 className="text-[4.2vw] font-bold leading-tight">{exam.name}</h1>
            <p className="text-[2.4vw]">Variant <b>{code}</b> · {items.length} ta savol</p>
            <p className="text-[1.3vw] text-slate-400 mt-6">→ yoki Probel — keyingi savol</p>
          </div>
        ) : (
          <div className={`${SAVOL_MATNI} text-[2.1vw] leading-snug max-w-[1400px] mx-auto`}>
            {matn && (
              <div className="mb-[3vh] rounded-xl border border-slate-300 bg-slate-50 px-[1.6vw] py-[1.2vh] text-[1.5vw] [&_p]:my-1">
                {matn.title && <p className="font-semibold">{matn.title}</p>}
                <div dangerouslySetInnerHTML={{ __html: formulaliHtml(matn.text) }} />
              </div>
            )}
            <div className="flex gap-[1.2vw]">
              <b className="shrink-0">{raqamYorligi(it)}.</b>
              <div className="min-w-0 flex-1 [&_p]:my-1" dangerouslySetInnerHTML={{ __html: formulaliHtml(q?.text || '') }} />
            </div>
            {q?.imageUrl && <img src={q.imageUrl} alt="" className="max-h-[38vh] max-w-full my-[2vh] mx-auto block" />}
            {it.t === 'yopiq' && q && (
              <ol className={`mt-[3vh] grid gap-x-[3vw] gap-y-[1.4vh] ${tartib.length <= 4 && tartib.every(k => (q.options[k] || '').length < 60) ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {tartib.map((asl, k) => {
                  const togri = javob && togriHarflar.has(HARFLAR[k]);
                  return (
                    <li key={k} className={`flex gap-[0.8vw] items-baseline rounded-xl px-[1vw] py-[0.6vh] transition-colors ${togri ? 'bg-emerald-100 ring-2 ring-emerald-500' : ''}`}>
                      <b className="shrink-0">{HARFLAR[k]})</b>
                      <span className="min-w-0 [&_p]:my-0" dangerouslySetInnerHTML={{ __html: formulaliHtml(q.options[asl] || '') }} />
                    </li>
                  );
                })}
              </ol>
            )}
            {it.t !== 'yopiq' && javob && ki?.javob && (
              <p className="mt-[3vh] text-emerald-700 font-semibold">Javob: {Array.isArray(ki.javob) ? ki.javob.join('; ') : ki.javob}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-200">
        <button onClick={() => ot(-1)} disabled={i === 0} className="h-10 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-default"><ChevronLeft size={16} /> Oldingi</button>
        <div className="flex-1 mx-5 h-1.5 rounded-full bg-slate-200 overflow-hidden" aria-hidden><div className="h-full bg-slate-700 transition-all" style={{ width: `${(i / Math.max(1, jami - 1)) * 100}%` }} /></div>
        <button onClick={() => ot(1)} disabled={i >= jami - 1} className="h-10 px-4 rounded-xl bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-default">Keyingi <ChevronRight size={16} /></button>
      </div>
    </div>,
    document.body,
  );
}
