import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { X, Maximize2, Minimize2, Pause, Play, Sun, Moon, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Yuklanmoqda, BoshHolat, Tugma } from './ui';
import { vergul, sanaMatni } from './format';

// Katta ekran reytingi (/exams/:id/reyting) — markazdagi televizor yoki
// proyektor uchun. Faqat e'lon qilingan imtihon, imtihon sozlamasidagi reyting
// qoidasi bilan (hammasi / birinchi N ta / ko'rsatilmaydi). Birinchi uchtasi
// shohsupada, qolgani sahifama-sahifa o'zi aylanadi.

interface Qator {
  id: number; orin: number; ism: string; rasm: string | null; filialId: number; kurs: string;
  ball: number; foiz: number; rasch: number | null; daraja: string | null; bloklar: { subject: string; earned: number; max: number }[];
}
interface Reyting {
  imtihon: { id: number; name: string; date: string; maxScore: number; scoring: string; publishedAt: string | null };
  markaz: string; logo: string | null; ranking: 'hammasi' | 'top' | 'yoq'; topN: number; rasch: boolean;
  filiallar: { id: number; name: string }[]; jami: number; qatorlar: Qator[];
}

const SAHIFA_VAQTI = 10000;
const QATOR_BALANDLIGI = 64;
// Oltin, kumush, bronza — ikkala rejimda ham ko'rinadigan to'q tuslar.
const MEDAL = ['#C99A06', '#8A96A3', '#B0682E'];

function Rasm({ q, olcham }: { q: Qator; olcham: number }) {
  const [xato, setXato] = useState(false);
  const bosh = q.ism.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  if (q.rasm && !xato) {
    return <img src={q.rasm} alt="" onError={() => setXato(true)} className="rounded-full object-cover shrink-0 bg-ichki" style={{ width: olcham, height: olcham }} />;
  }
  return (
    <span className="rounded-full shrink-0 bg-brand-fon text-brand-dark dark:bg-brand/20 dark:text-brand-accent font-bold flex items-center justify-center"
      style={{ width: olcham, height: olcham, fontSize: olcham * 0.36 }}>{bosh || '?'}</span>
  );
}

export default function ReytingEkrani() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useCRM();
  const { soro } = useImtihonApi();
  const [d, setD] = useState<Reyting | null>(null);
  const [xato, setXato] = useState('');
  const [filial, setFilial] = useState(0);
  const [sahifa, setSahifa] = useState(0);
  const [toxtadi, setToxtadi] = useState(false);
  const [toliq, setToliq] = useState(false);
  const [sigim, setSigim] = useState(6);
  const royxatRef = useRef<HTMLDivElement>(null);

  const yukla = useCallback(() => soro<Reyting>('GET', `exams/${id}/leaderboard${filial ? `?filial=${filial}` : ''}`)
    .then(r => { setD(r); setXato(''); })
    .catch(e => setXato(e.message)), [id, filial, soro]);

  useEffect(() => { setSahifa(0); yukla(); }, [yukla]);
  // Qayta e'lon yoki kalit tuzatilsa ekran o'zi yangilanadi.
  useEffect(() => { const t = setInterval(yukla, 60000); return () => clearInterval(t); }, [yukla]);

  useEffect(() => {
    const f = () => setToliq(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  // Sahifaga nechta qator sig'adi — ro'yxat balandligidan.
  useLayoutEffect(() => {
    const el = royxatRef.current;
    if (!el) return;
    const olch = () => setSigim(Math.max(3, Math.floor(el.clientHeight / QATOR_BALANDLIGI)));
    olch();
    const ro = new ResizeObserver(olch);
    ro.observe(el);
    return () => ro.disconnect();
  }, [d]);

  const qatorlar = d?.qatorlar || [];
  const shohsupa = qatorlar.slice(0, 3);
  const qolgan = qatorlar.slice(3);
  const sahifalar = Math.max(1, Math.ceil(qolgan.length / sigim));
  const joriy = Math.min(sahifa, sahifalar - 1);

  useEffect(() => {
    if (toxtadi || sahifalar < 2) return;
    const t = setTimeout(() => setSahifa(s => (s + 1) % sahifalar), SAHIFA_VAQTI);
    return () => clearTimeout(t);
  }, [toxtadi, sahifalar, joriy]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); setToxtadi(t => !t); }
      if (e.key === 'ArrowRight') setSahifa(s => (s + 1) % sahifalar);
      if (e.key === 'ArrowLeft') setSahifa(s => (s - 1 + sahifalar) % sahifalar);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [sahifalar]);

  const toliqEkran = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };
  const yop = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    navigate(`/exams?tab=natija&imtihon=${id}`);
  };

  const filialNomi = (fid: number) => d?.filiallar.find(f => f.id === fid)?.name || '';
  // Rasch yoqilgan imtihonda reyting va katta raqam — Rasch balli (T-ball).
  const asosiy = (q: Qator) => (q.rasch != null ? q.rasch : q.ball);
  const kopFilial = (d?.filiallar.length || 0) > 1;
  const blokli = qatorlar.some(q => q.bloklar.length > 1);

  const asbob = (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {kopFilial && (
        <div className="inline-flex rounded-xl border border-chiziq bg-sirt p-0.5 gap-0.5">
          {[{ id: 0, name: 'Umumiy' }, ...(d?.filiallar || [])].map(f => (
            <button key={f.id} onClick={() => setFilial(f.id)}
              className={`px-3 py-1.5 rounded-[10px] text-[12.5px] font-semibold cursor-pointer ${filial === f.id ? 'bg-brand text-brand-ust' : 'text-matn-sokin hover:text-matn'}`}>{f.name}</button>
          ))}
        </div>
      )}
      {sahifalar > 1 && (
        <>
          <button aria-label="Oldingi sahifa" onClick={() => setSahifa(s => (s - 1 + sahifalar) % sahifalar)} className="p-2 rounded-xl border border-chiziq bg-sirt text-matn-sokin hover:text-matn cursor-pointer"><ChevronLeft size={16} /></button>
          <button aria-label={toxtadi ? 'Davom ettirish' : "To'xtatish"} onClick={() => setToxtadi(t => !t)} className="p-2 rounded-xl border border-chiziq bg-sirt text-matn-sokin hover:text-matn cursor-pointer">{toxtadi ? <Play size={16} /> : <Pause size={16} />}</button>
          <button aria-label="Keyingi sahifa" onClick={() => setSahifa(s => (s + 1) % sahifalar)} className="p-2 rounded-xl border border-chiziq bg-sirt text-matn-sokin hover:text-matn cursor-pointer"><ChevronRight size={16} /></button>
        </>
      )}
      <button aria-label={darkMode ? "Yorug' rejim" : "Qorong'i rejim"} onClick={toggleDarkMode} className="p-2 rounded-xl border border-chiziq bg-sirt text-matn-sokin hover:text-matn cursor-pointer">{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button>
      <button aria-label={toliq ? "To'liq ekrandan chiqish" : "To'liq ekran"} onClick={toliqEkran} className="p-2 rounded-xl border border-chiziq bg-sirt text-matn-sokin hover:text-matn cursor-pointer">{toliq ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
      <button aria-label="Yopish" onClick={yop} className="p-2 rounded-xl border border-chiziq bg-sirt text-matn-sokin hover:text-xato cursor-pointer"><X size={16} /></button>
    </div>
  );

  let ichi: React.ReactNode;
  if (xato) {
    ichi = <div className="flex-1 flex items-center justify-center"><BoshHolat ikonka={<Trophy size={20} />} sarlavha={xato}><Tugma onClick={yop}>Imtihonga qaytish</Tugma></BoshHolat></div>;
  } else if (!d) {
    ichi = <div className="flex-1 flex items-center justify-center"><Yuklanmoqda /></div>;
  } else if (!d.imtihon.publishedAt) {
    ichi = <div className="flex-1 flex items-center justify-center"><BoshHolat ikonka={<Trophy size={20} />} sarlavha="Natijalar hali e'lon qilinmagan" izoh="Reyting e'londan keyin chiqadi (Natijalar bo'limi → E'lon qilish)."><Tugma onClick={yop}>Imtihonga qaytish</Tugma></BoshHolat></div>;
  } else if (d.ranking === 'yoq') {
    ichi = <div className="flex-1 flex items-center justify-center"><BoshHolat ikonka={<Trophy size={20} />} sarlavha="Bu imtihonda reyting ko'rsatilmaydi" izoh="Imtihon sozlamasida «O'rin ko'rsatilmasin» tanlangan."><Tugma onClick={yop}>Imtihonga qaytish</Tugma></BoshHolat></div>;
  } else if (!qatorlar.length) {
    ichi = <div className="flex-1 flex items-center justify-center"><BoshHolat ikonka={<Trophy size={20} />} sarlavha="Natija yo'q" /></div>;
  } else {
    // Klassik shohsupa (2 · 1 · 3); birinchi o'rinda tenglar bo'lsa — tartib bilan (1 · 1 · 3).
    const tartib = shohsupa.length === 3 && shohsupa[1].orin !== shohsupa[0].orin ? [shohsupa[1], shohsupa[0], shohsupa[2]] : shohsupa;
    const korinadi = qolgan.slice(joriy * sigim, joriy * sigim + sigim);
    ichi = (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-5 items-end">
          {tartib.map(q => {
            const i = Math.min(2, q.orin - 1);
            const birinchi = q.orin === 1;
            return (
              <div key={q.id} className={`rounded-3xl border bg-sirt shadow-sm px-4 py-4 lg:py-6 flex flex-col items-center text-center ${birinchi ? 'sm:-translate-y-3 lg:py-8' : ''}`}
                style={{ borderColor: MEDAL[i], boxShadow: `0 0 0 1px ${MEDAL[i]}33` }}>
                <span className="rounded-full text-white font-bold flex items-center justify-center mb-3 raqam" style={{ background: MEDAL[i], width: birinchi ? 44 : 38, height: birinchi ? 44 : 38, fontSize: birinchi ? 20 : 17 }}>{q.orin}</span>
                <Rasm q={q} olcham={birinchi ? 104 : 84} />
                <p className={`mt-3 font-bold text-matn leading-tight ${birinchi ? 'text-[clamp(18px,2vw,30px)]' : 'text-[clamp(16px,1.6vw,24px)]'}`}>{q.ism}</p>
                <p className="text-[clamp(12px,1vw,16px)] text-matn-sokin mt-0.5">{[q.kurs, kopFilial && !filial ? filialNomi(q.filialId) : ''].filter(Boolean).join(' · ')}</p>
                <p className="mt-2 font-bold raqam leading-none" style={{ color: MEDAL[i], fontSize: birinchi ? 'clamp(34px,3.6vw,60px)' : 'clamp(28px,2.8vw,46px)' }}>{vergul(asosiy(q))}</p>
                <p className="text-[clamp(12px,1vw,16px)] text-matn-xira raqam">
                  {q.rasch != null ? <>{q.daraja && <b className="text-matn">{q.daraja} · </b>}{vergul(q.ball)} ball · {vergul(q.foiz)}%</> : <>{vergul(q.foiz)}%</>}
                </p>
              </div>
            );
          })}
        </div>

        <div ref={royxatRef} className="flex-1 min-h-0 mt-4 lg:mt-6 overflow-hidden">
          <div className="space-y-2">
            {korinadi.map(q => (
              <div key={q.id} className="flex items-center gap-3 lg:gap-4 rounded-2xl border border-chiziq bg-sirt px-3 lg:px-5" style={{ height: QATOR_BALANDLIGI - 8 }}>
                <span className="w-10 lg:w-14 text-center font-bold text-matn-sokin raqam text-[clamp(16px,1.5vw,24px)]">{q.orin}</span>
                <Rasm q={q} olcham={36} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-matn truncate text-[clamp(14px,1.3vw,21px)]">{q.ism}</p>
                  <p className="text-matn-xira truncate text-[clamp(11px,0.9vw,14px)]">{[q.kurs, kopFilial && !filial ? filialNomi(q.filialId) : ''].filter(Boolean).join(' · ')}</p>
                </div>
                {blokli && (
                  <div className="hidden xl:flex items-center gap-1.5">
                    {q.bloklar.map(b => (
                      <span key={b.subject} title={b.subject} className="px-2 py-1 rounded-lg bg-ichki text-[12px] text-matn-sokin raqam whitespace-nowrap">
                        {b.subject.slice(0, 10)} <b className="text-matn">{vergul(b.earned)}</b>
                      </span>
                    ))}
                  </div>
                )}
                <div className="w-28 lg:w-40 hidden sm:block">
                  <div className="h-2 rounded-full bg-chiziq overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, q.foiz))}%` }} /></div>
                </div>
                {q.rasch != null && <span className="w-10 text-center text-[clamp(12px,1vw,15px)] font-bold text-matn-sokin">{q.daraja || ''}</span>}
                <span className="w-20 lg:w-28 text-right font-bold text-matn raqam text-[clamp(18px,1.7vw,28px)]">{vergul(asosiy(q))}</span>
              </div>
            ))}
          </div>
        </div>
        {sahifalar > 1 && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1 rounded-full bg-chiziq overflow-hidden">
              <div key={`${joriy}-${toxtadi}`} className="h-full bg-brand rounded-full"
                style={toxtadi ? { width: `${((joriy + 1) / sahifalar) * 100}%` } : { animation: `reyting-oqim ${SAHIFA_VAQTI}ms linear forwards` }} />
            </div>
            <span className="text-[13px] text-matn-xira raqam">{joriy + 1} / {sahifalar}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] bg-fon flex flex-col px-4 py-4 lg:px-10 lg:py-7 overflow-y-auto sm:overflow-hidden">
      <style>{'@keyframes reyting-oqim{from{width:0}to{width:100%}}'}</style>
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4 lg:mb-6">
        <div className="flex items-center gap-3 min-w-0">
          {d?.logo && <img src={d.logo} alt="" className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl object-contain bg-sirt border border-chiziq p-1" />}
          <div className="min-w-0">
            <p className="text-[clamp(12px,1vw,15px)] text-matn-sokin font-semibold truncate">{d?.markaz}</p>
            <h1 className="text-[clamp(20px,2.2vw,36px)] font-bold text-matn leading-tight">{d?.imtihon.name || 'Reyting'}</h1>
            {d && (
              <p className="text-[clamp(12px,1vw,15px)] text-matn-xira">
                {sanaMatni(d.imtihon.date)} · {filial ? `${filialNomi(filial)} reytingi` : 'Umumiy reyting'} · {d.jami} qatnashchi · {d.rasch ? 'Rasch balli (o\'rtacha 50)' : `eng yuqori ball ${vergul(d.imtihon.maxScore)}`}
                {d.ranking === 'top' ? ` · birinchi ${d.topN} ta` : ''}
              </p>
            )}
          </div>
        </div>
        {asbob}
      </header>
      {ichi}
    </div>
  );
}
