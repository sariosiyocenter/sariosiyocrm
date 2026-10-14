import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Captions, CaptionsOff, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { formulaliHtml } from '../../../lib/matn';
import Chizma, { type ChizmaKorinishi } from './Chizma';
import { darsVaqti, type Dars } from './darsTurlari';

// Video dars pleeri (egasi, 2026-10-13). Bu — video fayl emas: ssenariy qadamlari (doska + nutq)
// va bitta ovoz fayli. Pleer doskani o'zi chizadi — qadamlar ovoz bilan birga, qator-qator
// "yozilib" chiqadi. Shuning uchun dars telefonda ham tiniq, hajmi esa videodan o'nlab marta kichik.
// Ovoz bo'lmasa (hali yozilmagan yoki ochilmadi) — dars subtitr bilan, taxminiy vaqtda o'ynaydi.
// Chizmali darsda (egasi, 2026-10-14) doska ikkiga bo'linadi: bir tomonda chizma yoki savol rasmi
// (qadam-baqadam chiziladi — Chizma.tsx), ikkinchi tomonda yozuv.

const TEZLIKLAR = [1, 1.25, 1.5, 0.75];
/** Ekran shu oraliqda yangilanadi (soniya) — har kadrda emas: kuchsiz telefonda ham silliq. */
const YANGILASH = 0.06;
/** Qadam ichida keyingi qator ko'pi bilan shuncha soniyadan keyin chiqadi. */
const QATOR_ORALIGI_MAX = 1.6;
/** Qadam ichida keyingi chizma elementi ko'pi bilan shuncha soniyadan keyin chiziladi. */
const ELEMENT_ORALIGI_MAX = 2.2;

// Natija sahifasida bir nechta dars turadi: bir vaqtda faqat bittasi gapiradi — boshqasi
// boshlansa, avvalgisi to'xtaydi.
let gapirayotgan: HTMLAudioElement | null = null;
function navbatniOl(a: HTMLAudioElement | null) {
  if (gapirayotgan && gapirayotgan !== a) gapirayotgan.pause();
  gapirayotgan = a;
}

const ekranla = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TUGMA = 'p-2 rounded-lg text-matn-sokin hover:bg-ichki hover:text-matn cursor-pointer disabled:opacity-40 disabled:cursor-default';

export default function DarsPleer({ dars }: { dars: Dars }) {
  const { qadamlar, davomiylik } = dars;
  const audio = useRef<HTMLAudioElement>(null);
  const doska = useRef<HTMLDivElement>(null);
  const joriyEl = useRef<HTMLElement>(null);
  // Soat: ovozli rejimda audio vaqti, ovozsizda — o'zi yuradi. Ref — kadrlar orasida, state — ekran uchun.
  const soat = useRef(0);
  const [vaqt, setVaqt] = useState(0);
  const [oynaydi, setOynaydi] = useState(false);
  const [boshlangan, setBoshlangan] = useState(false);
  const [tezlik, setTezlik] = useState(1);
  const [subtitr, setSubtitr] = useState(true);
  const [ovozXato, setOvozXato] = useState(false);
  const ovozli = !!dars.ovoz && !ovozXato;

  // Doska matni AI yozgan oddiy matn: avval ekranlanadi (teg bo'lib ishlamaydi), so'ng formulaliHtml
  // undagi $...$ ni KaTeX ga aylantiradi va natijani yana tozalaydi (src/lib/matn.ts).
  const qatorlar = useMemo(() => qadamlar.map(q => q.doska.split('\n').filter(Boolean).map(x => formulaliHtml(ekranla(x)))), [qadamlar]);
  // Darsning hamma chizma elementlari — chizma o'lchami shulardan (qadamdan qadamga siljimaydi).
  const hammaChizma = useMemo(() => qadamlar.flatMap(q => q.chizma || []), [qadamlar]);
  const chizmali = hammaChizma.length > 0 || qadamlar.some(q => q.rasm);

  useEffect(() => {
    if (!oynaydi) return;
    let kadr = 0;
    let oldingi = performance.now();
    const yur = (hozir: number) => {
      const a = audio.current;
      const t = Math.min(davomiylik, ovozli && a ? a.currentTime : soat.current + ((hozir - oldingi) / 1000) * tezlik);
      oldingi = hozir;
      soat.current = t;
      setVaqt(v => (Math.abs(v - t) >= YANGILASH || t >= davomiylik ? t : v));
      if (t >= davomiylik) { a?.pause(); setOynaydi(false); return; }
      kadr = requestAnimationFrame(yur);
    };
    kadr = requestAnimationFrame(yur);
    return () => cancelAnimationFrame(kadr);
  }, [oynaydi, ovozli, tezlik, davomiylik]);

  useEffect(() => { if (audio.current) audio.current.playbackRate = tezlik; }, [tezlik]);

  // Pleer yopilganda ovoz ham to'xtaydi va navbat bo'shaydi.
  useEffect(() => {
    const a = audio.current;
    return () => { a?.pause(); if (gapirayotgan === a) gapirayotgan = null; };
  }, []);

  const otkaz = useCallback((t: number) => {
    const yangi = Math.min(davomiylik, Math.max(0, t));
    soat.current = yangi;
    setVaqt(yangi);
    if (ovozli && audio.current) audio.current.currentTime = yangi;
  }, [davomiylik, ovozli]);

  const tugadi = boshlangan && vaqt >= davomiylik - 0.05;

  const ijro = () => {
    if (!boshlangan || tugadi) otkaz(0);
    setBoshlangan(true);
    setOynaydi(true);
    const a = audio.current;
    // Ovozsiz dars boshlansa ham boshqa pleerdagi ovoz to'xtaydi.
    navbatniOl(ovozli ? a : null);
    if (!ovozli || !a) return;
    a.playbackRate = tezlik;
    // Ovoz ochilmasa (fayl yo'q, tarmoq) — dars to'xtamaydi: subtitr bilan, ovozsiz davom etadi.
    // AbortError — foydalanuvchi shu zahoti to'xtatgan, bu xato emas.
    a.play().catch((e: unknown) => { if ((e as { name?: string })?.name !== 'AbortError') setOvozXato(true); });
  };
  const toxta = () => { audio.current?.pause(); setOynaydi(false); };
  // Ovoz fayli hisoblangan davomiylikdan sal qisqa chiqishi mumkin — dars baribir oxiriga yetgan bo'ladi.
  const ovozTugadi = () => { soat.current = davomiylik; setVaqt(davomiylik); setOynaydi(false); };

  let joriy = 0;
  qadamlar.forEach((x, i) => { if (vaqt >= x.boshi - 0.01) joriy = i; });
  const q = qadamlar[joriy] as Dars['qadamlar'][number] | undefined;
  const qatorSoni = qatorlar[joriy]?.length ?? 0;
  // Joriy qadamning qatorlari birdan emas, nutq davomida navbat bilan chiqadi.
  const oraliq = Math.min(QATOR_ORALIGI_MAX, ((q?.davomi ?? 0) * 0.6) / Math.max(1, qatorSoni));
  const ochilgan = tugadi ? qatorSoni : Math.min(qatorSoni, Math.floor(Math.max(0, vaqt - (q?.boshi ?? 0)) / (oraliq || 1)) + 1);
  // Chizma ham shunday: joriy qadamning elementlari nutq davomida birma-bir chiziladi, avvalgilari turadi.
  const joriyChizma = q?.chizma ?? [];
  const chizOraliq = Math.min(ELEMENT_ORALIGI_MAX, ((q?.davomi ?? 0) * 0.7) / Math.max(1, joriyChizma.length));
  const chizilgan = tugadi ? joriyChizma.length : Math.min(joriyChizma.length, Math.floor(Math.max(0, vaqt - (q?.boshi ?? 0)) / (chizOraliq || 1)) + 1);
  const korinadigan: ChizmaKorinishi[] = boshlangan
    ? qadamlar.slice(0, joriy + 1).flatMap((x, i) => (x.chizma || []).slice(0, i === joriy ? chizilgan : undefined).map((e, k) => ({ kalit: `${i}-${k}`, e })))
    : [];
  // Rasm: joriy qadam ko'rsatsa — o'sha (chizma bilan birga); aks holda chizma hali yo'q bo'lsa — oxirgi ko'rsatilgan rasm.
  const rasm = q?.rasm || (korinadigan.length ? '' : qadamlar.slice(0, joriy + 1).reverse().find(x => x.rasm)?.rasm || '');

  // Doska joriy qadamga o'zi suriladi (sahifaning o'zi emas — faqat doska ichi).
  useEffect(() => {
    const d = doska.current;
    const el = joriyEl.current;
    if (!d || !el) return;
    const tepa = el.offsetTop - 12;
    const past = el.offsetTop + el.offsetHeight + 12;
    const yumshoq = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (past > d.scrollTop + d.clientHeight) d.scrollTo({ top: Math.min(tepa, past - d.clientHeight), behavior: yumshoq });
    else if (tepa < d.scrollTop) d.scrollTo({ top: tepa, behavior: yumshoq });
  }, [joriy, ochilgan, boshlangan]);

  // Bo'sh dars serverdan kelmaydi (kamida ikki qadam) — bu faqat buzilgan ma'lumotdan himoya.
  if (!q) return null;

  const oldingiQadam = () => otkaz(vaqt - q.boshi > 1.5 || joriy === 0 ? q.boshi : qadamlar[joriy - 1].boshi);
  const keyingiQadam = () => otkaz(joriy < qadamlar.length - 1 ? qadamlar[joriy + 1].boshi : davomiylik);
  const tezlikniAlmashtir = () => setTezlik(t => TEZLIKLAR[(TEZLIKLAR.indexOf(t) + 1) % TEZLIKLAR.length]);
  const subtitrKorinadi = boshlangan && (subtitr || !ovozli);
  // Doskadagi yozuv (qadamlar) — oddiy va chizmali joylashuvda bir xil.
  const matn = (
    <>
      {boshlangan && qadamlar.slice(0, joriy + 1).map((x, i) => {
        const faol = i === joriy;
        const javob = i === qadamlar.length - 1;
        return (
          <section key={i} ref={faol ? joriyEl : undefined} aria-current={faol ? 'step' : undefined}
            className={`relative pl-4 py-2 transition-opacity duration-300 ${faol || tugadi ? 'opacity-100' : 'opacity-45'} ${javob ? 'mt-1 rounded-lg bg-white/[0.06] pr-3' : ''}`}>
            <span aria-hidden className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full" style={{ background: faol || javob ? 'var(--dars-urgu)' : 'rgb(255 255 255 / 0.2)' }} />
            <h5 className="text-[11px] font-bold uppercase tracking-[0.09em]" style={{ color: 'var(--dars-urgu)' }}>
              <span className="raqam">{i + 1}</span>{x.sarlavha && <> · {x.sarlavha}</>}
            </h5>
            <div className="mt-1 space-y-1.5 text-[16px] sm:text-[17px] leading-relaxed">
              {qatorlar[i].slice(0, faol ? ochilgan : undefined).map((html, k) => (
                <div key={k} className="dars-qator overflow-x-auto overflow-y-hidden" dangerouslySetInnerHTML={{ __html: html }} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );

  return (
    <div className="rounded-2xl border border-chiziq bg-sirt overflow-hidden">
      {dars.ovoz && (
        <audio ref={audio} src={dars.ovoz} preload="metadata" onError={() => setOvozXato(true)} onEnded={ovozTugadi}
          onPlay={() => { navbatniOl(audio.current); setOynaydi(true); }} onPause={() => { if (!audio.current?.ended) setOynaydi(false); }} />
      )}

      <div className="relative">
        {chizmali ? (
          <div className="dars-doska grid h-[min(84vh,38rem)] grid-rows-[minmax(0,17rem)_minmax(0,1fr)] sm:h-[min(62vh,25rem)] sm:grid-cols-2 sm:grid-rows-1">
            <div className="relative grid min-h-0 place-items-center border-b border-white/10 p-3 sm:border-b-0 sm:border-r">
              {/* Rasm va chizma birga turadi (rasm tepada): biri ikkinchisini yashirmaydi, chizma esa qayta chizilmaydi. */}
              {boshlangan && (
                <div className="flex h-full w-full min-h-0 flex-col items-center justify-center gap-2">
                  {rasm && <img key={rasm} src={rasm} alt="Masala rasmi" className={`dars-chiz-paydo min-h-0 max-w-full rounded-lg bg-white object-contain ${korinadigan.length ? 'max-h-[42%]' : 'max-h-full'}`} />}
                  {korinadigan.length > 0 && <div className="min-h-0 w-full flex-1"><Chizma elementlar={korinadigan} hammasi={hammaChizma} /></div>}
                </div>
              )}
            </div>
            <div ref={doska} className="relative min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
              {matn}
            </div>
          </div>
        ) : (
          <div ref={doska} className="dars-doska relative overflow-y-auto h-[min(58vh,23rem)] px-4 py-4 sm:px-6 sm:py-5">
            {matn}
          </div>
        )}

        {!boshlangan && (
          <div className="absolute inset-0 grid place-items-center">
            <button type="button" onClick={ijro} className="group flex flex-col items-center gap-3 cursor-pointer rounded-2xl p-4" aria-label={`Video darsni boshlash — ${darsVaqti(davomiylik)}`}>
              <span className="grid place-items-center w-16 h-16 rounded-full bg-white text-brand shadow-xl transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                <Play size={26} className="translate-x-0.5" fill="currentColor" />
              </span>
              <span className="text-[13px] font-semibold text-white">
                Video dars · <span className="raqam">{darsVaqti(davomiylik)}</span>
                <span className="block text-center text-[11.5px] font-normal text-white/65">{qadamlar.length} qadam{ovozli ? '' : ' · ovozsiz, subtitr bilan'}</span>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Subtitr joyi doim band: matn almashganda pastdagi tugmalar sakramaydi. */}
      <p className="min-h-[3.4rem] px-4 pt-2.5 text-[13px] leading-snug text-matn-2 sm:px-5" aria-live={ovozli ? 'off' : 'polite'}>
        {subtitrKorinadi ? q.nutq : !boshlangan ? <span className="text-matn-xira">Masala qanday yechilishi qadam-baqadam ko'rsatiladi.</span> : null}
      </p>

      <div className="px-4 pb-3 sm:px-5">
        <div className="relative flex h-5 items-center rounded-full focus-within:ring-2 focus-within:ring-brand/50">
          <div className="flex w-full gap-[3px]" aria-hidden>
            {qadamlar.map((x, i) => (
              <span key={i} className="h-1.5 basis-0 overflow-hidden rounded-full bg-chiziq-kuchli" style={{ flexGrow: Math.max(0.5, x.davomi) }}>
                <span className="block h-full origin-left bg-brand" style={{ transform: `scaleX(${Math.min(1, Math.max(0, (vaqt - x.boshi) / (x.davomi || 1)))})` }} />
              </span>
            ))}
          </div>
          <input type="range" min={0} max={davomiylik} step={0.1} value={vaqt} disabled={!boshlangan} onChange={e => otkaz(Number(e.target.value))}
            aria-label="Dars vaqti" aria-valuetext={`${darsVaqti(vaqt)} / ${darsVaqti(davomiylik)}, ${joriy + 1}-qadam`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default" />
        </div>

        <div className="mt-1.5 flex items-center gap-1">
          <button type="button" className={TUGMA} onClick={oldingiQadam} disabled={!boshlangan} aria-label="Oldingi qadam" title="Oldingi qadam"><SkipBack size={16} /></button>
          <button type="button" onClick={oynaydi ? toxta : ijro} aria-label={oynaydi ? "To'xtatish" : tugadi ? "Qayta ko'rish" : 'Ijro etish'}
            className="grid h-10 w-10 place-items-center rounded-full bg-brand text-brand-ust cursor-pointer transition-transform active:scale-95">
            {oynaydi ? <Pause size={17} fill="currentColor" /> : tugadi ? <RotateCcw size={17} /> : <Play size={17} className="translate-x-px" fill="currentColor" />}
          </button>
          <button type="button" className={TUGMA} onClick={keyingiQadam} disabled={!boshlangan || tugadi} aria-label="Keyingi qadam" title="Keyingi qadam"><SkipForward size={16} /></button>
          <span className="raqam ml-1.5 text-[12px] text-matn-sokin">{darsVaqti(vaqt)} / {darsVaqti(davomiylik)}</span>
          <span className="ml-auto flex items-center gap-1">
            {ovozli && (
              <button type="button" className={TUGMA} onClick={() => setSubtitr(x => !x)} aria-pressed={subtitr} aria-label="Subtitr" title={subtitr ? "Subtitrni o'chirish" : 'Subtitrni yoqish'}>
                {subtitr ? <Captions size={17} /> : <CaptionsOff size={17} />}
              </button>
            )}
            <button type="button" onClick={tezlikniAlmashtir} aria-label={`Tezlik: ${tezlik}×`} title="Tezlik"
              className="raqam min-w-[3.1rem] rounded-lg border border-chiziq px-2 py-1.5 text-[12px] font-bold text-matn-sokin hover:border-chiziq-kuchli hover:text-matn cursor-pointer">{tezlik}×</button>
          </span>
        </div>
        {dars.ovoz && ovozXato && <p role="status" className="mt-1 text-[11.5px] text-ogoh">Ovozni ochib bo'lmadi — dars subtitr bilan davom etadi.</p>}
      </div>
    </div>
  );
}
