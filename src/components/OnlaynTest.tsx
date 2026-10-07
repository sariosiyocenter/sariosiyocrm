import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Loader2, LayoutGrid, Send, CloudOff, Cloud } from 'lucide-react';
import { formulaliHtml, SAVOL_MATNI } from '../lib/matn';
import { sanaMatni } from './imtihon/format';

/**
 * Onlayn test (/test/:token) — Addmen CBT kabi: qatnashchi shaxsiy havola orqali
 * (Telegram'da Mini App bo'lib ham) telefonda yechadi. Javoblar har o'zgarishda
 * serverga saqlanadi (sahifa yopilsa ham yo'qolmaydi), vaqt tugasa — o'zi
 * yakunlanadi. "Faqat kalit" imtihonida — onlayn javob varaqasi (savollar kitobchada).
 */

interface Savol { n: number; /** Ko'rinadigan raqam ("36a") — tartib raqamidan farq qilsa. */ y?: string; /** Guruhli savol bo'lagi: 'juft' | 'qismli'. */ g?: string; t: 'yopiq' | 'raqamli' | 'moslash' | 'yozma'; b: number; pa: number | null; matn: string; rasm: string | null; variantlar: string[]; kitobcha: boolean; ong?: string[]; r?: number; c?: number }
interface Holat {
  markaz: { nomi: string; logo: string | null };
  imtihon: { nomi: string; sana: string; daqiqa: number; savolSoni: number; ochiladi: string | null; yopiladi: string | null };
  ism: string;
  holat: 'kutilmoqda' | 'ochiq' | 'boshlangan' | 'tugagan' | 'topshirilgan' | 'yopiq';
  qolgan: number | null;
  javobBerildi: number | null;
  natijaHavolasi: string | null;
  savollar?: Savol[];
  matnlar?: { id: number; title: string | null; text: string; imageUrl: string | null }[];
  bloklar?: { nomi: string; boshi: number; oxiri: number }[];
  javoblar?: Record<string, string>;
}

const HARF = 'ABCDEF';
const vaqtMatni = (s: number) => {
  const m = Math.floor(s / 60), x = s % 60, soat = Math.floor(m / 60);
  return soat ? `${soat}:${String(m % 60).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
};
const uzSana = (s: string | null) => (s ? `${sanaMatni(s.slice(0, 10))}, ${s.slice(11, 16)}` : '');

export default function OnlaynTest() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<Holat | null>(null);
  const [xato, setXato] = useState('');
  const [javoblar, setJavoblar] = useState<Record<string, string>>({});
  const [joriy, setJoriy] = useState(0);
  const [panel, setPanel] = useState(false);
  const [qolgan, setQolgan] = useState<number | null>(null);
  const [saqlash, setSaqlash] = useState<'saqlandi' | 'saqlanmoqda' | 'xato'>('saqlandi');
  const [yakunOynasi, setYakunOynasi] = useState(false);
  const [band, setBand] = useState(false);
  const navbat = useRef<Record<string, string>>({});
  const taymer = useRef<number | null>(null);

  const yukla = useCallback(async (yol = '', body?: unknown) => {
    // keepalive: sahifa yopilsa yoki qayta yuklansa ham yuborilayotgan javob yo'qolmaydi.
    const r = await fetch(`/api/public/test/${token}${yol}`, body !== undefined ? { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    const j = await r.json().catch(() => null);
    if (!r.ok) throw Object.assign(new Error(j?.error || 'Xatolik'), { holat: j?.holat });
    return j;
  }, [token]);

  const holatniOl = useCallback(async (yol = '', body?: unknown) => {
    try {
      const j: Holat = await yukla(yol, body);
      setD(j);
      setJavoblar(j.javoblar || {});
      setQolgan(j.qolgan);
    } catch (e: any) { setXato(e.message); }
  }, [yukla]);

  useEffect(() => {
    holatniOl();
    try { (window as any).Telegram?.WebApp?.ready?.(); (window as any).Telegram?.WebApp?.expand?.(); } catch { /* Telegram'dan tashqarida */ }
  }, [holatniOl]);

  // Saqlanmagan javoblarni yuborish (kutilayotganlari bir so'rovda). So'rovlar navbat
  // bilan ketadi: oldingisi tugamaguncha keyingisi yuborilmaydi.
  const zanjir = useRef<Promise<void>>(Promise.resolve());
  const yubor = useCallback((yakunla = false) => {
    zanjir.current = zanjir.current.then(async () => {
      const javob = { ...navbat.current };
      navbat.current = {};
      if (!Object.keys(javob).length && !yakunla) { setSaqlash('saqlandi'); return; }
      setSaqlash('saqlanmoqda');
      try {
        const r = await yukla(yakunla ? '/yakunla' : '/javob', { javoblar: javob });
        setSaqlash(Object.keys(navbat.current).length ? 'saqlanmoqda' : 'saqlandi');
        if (r.qolgan != null) setQolgan(r.qolgan);
        if (r.holat === 'tugagan') await holatniOl();
      } catch (e: any) {
        navbat.current = { ...javob, ...navbat.current };
        setSaqlash('xato');
        if (e.holat === 'tugagan') await holatniOl();
      }
    });
    return zanjir.current;
  }, [yukla, holatniOl]);

  const javobQoy = (n: number, v: string) => {
    setJavoblar(j => ({ ...j, [n]: v }));
    navbat.current[n] = v;
    setSaqlash('saqlanmoqda');
    if (taymer.current) window.clearTimeout(taymer.current);
    taymer.current = window.setTimeout(() => yubor(), 1200);
  };

  // Sahifa yopilayotganda ham saqlab qolish.
  useEffect(() => {
    const f = () => {
      if (!Object.keys(navbat.current).length) return;
      fetch(`/api/public/test/${token}/javob`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ javoblar: navbat.current }) }).catch(() => {});
      navbat.current = {};
    };
    window.addEventListener('pagehide', f);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') f(); });
    return () => window.removeEventListener('pagehide', f);
  }, [token]);

  // Taymer: vaqt tugasa — o'zi yakunlanadi.
  useEffect(() => {
    if (d?.holat !== 'boshlangan' || qolgan == null) return;
    if (qolgan <= 0) { yubor(true); return; }
    const t = window.setTimeout(() => setQolgan(q => (q == null ? q : q - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [qolgan, d?.holat, yubor]);

  // Yozma savollar onlayn topshirilmaydi; qismli savolning qismi esa qisqa javob — yozib kiritiladi.
  const savollar = useMemo(() => (d?.savollar || []).filter(s => s.t !== 'yozma' || s.g === 'qismli'), [d]);
  const matnMap = useMemo(() => new Map((d?.matnlar || []).map(m => [m.id, m])), [d]);
  const javobSoni = savollar.filter(s => javoblar[s.n]).length;
  const kitobcha = savollar.length > 0 && savollar.every(s => s.kitobcha);

  if (xato && !d) return <Ekran><XCircle size={32} className="mx-auto text-xato mb-3" /><p className="text-[14px] font-semibold text-matn">{xato}</p></Ekran>;
  if (!d) return <div className="min-h-screen bg-fon flex items-center justify-center"><div className="w-9 h-9 border-[3px] border-brand border-t-transparent rounded-full animate-spin" /></div>;

  const sarlavha = (
    <div className="text-center mb-4">
      {d.markaz.logo && <img src={d.markaz.logo} alt="" className="w-12 h-12 mx-auto mb-2 object-contain" />}
      <p className="text-[12px] text-matn-xira">{d.markaz.nomi}</p>
      <h1 className="text-[17px] font-bold text-matn mt-0.5">{d.imtihon.nomi}</h1>
      <p className="text-[13px] text-matn-sokin mt-1">{d.ism}</p>
    </div>
  );

  if (d.holat !== 'boshlangan') {
    return (
      <Ekran>
        {sarlavha}
        {d.holat === 'kutilmoqda' && <p className="text-[14px] text-matn">Test hali ochilmagan.{d.imtihon.ochiladi && <><br /><b>{uzSana(d.imtihon.ochiladi)}</b> da ochiladi.</>}</p>}
        {d.holat === 'ochiq' && (
          <div className="space-y-4 text-left">
            <ul className="rounded-xl bg-ichki px-4 py-3 text-[13px] text-matn space-y-1.5">
              <li>• {d.imtihon.savolSoni} ta savol, vaqt — <b>{d.imtihon.daqiqa} daqiqa</b></li>
              <li>• «Boshlash» bosilgach vaqt ketadi, to'xtatib bo'lmaydi</li>
              <li>• Javoblar o'zi saqlanadi — internet uzilsa ham qayta oching</li>
              {d.imtihon.yopiladi && <li>• Test {uzSana(d.imtihon.yopiladi)} da yopiladi</li>}
            </ul>
            <button disabled={band} onClick={async () => { setBand(true); await holatniOl('/boshla', {}); setBand(false); }}
              className="w-full py-3.5 rounded-2xl bg-brand text-brand-ust text-[15px] font-bold shadow-sm cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {band && <Loader2 size={16} className="animate-spin" />} Boshlash
            </button>
          </div>
        )}
        {d.holat === 'tugagan' && (
          <div className="space-y-3">
            <CheckCircle2 size={36} className="mx-auto text-yaxshi" />
            <p className="text-[14px] font-semibold text-matn">Javoblaringiz qabul qilindi</p>
            {d.javobBerildi != null && <p className="text-[12.5px] text-matn-sokin">{d.javobBerildi} ta savolga javob berdingiz.</p>}
            {d.natijaHavolasi ? <a href={d.natijaHavolasi} className="inline-block px-4 py-2.5 rounded-xl bg-brand text-brand-ust text-[13px] font-semibold">Natijani ko'rish</a>
              : <p className="text-[12.5px] text-matn-xira">Natija e'lon qilingach xabar keladi.</p>}
          </div>
        )}
        {d.holat === 'topshirilgan' && <p className="text-[14px] text-matn">Bu imtihonni qog'ozda topshirgansiz — natija e'londa keladi.</p>}
        {d.holat === 'yopiq' && <p className="text-[14px] text-matn">Test yopilgan.</p>}
      </Ekran>
    );
  }

  const s = savollar[Math.min(joriy, savollar.length - 1)];
  const matn = s?.pa ? matnMap.get(s.pa) : null;
  const kam = (qolgan ?? 0) <= 300;

  return (
    <div className="min-h-screen bg-fon">
      {/* Yuqori panel: vaqt, javoblar soni, saqlash holati */}
      <header className="sticky top-0 z-20 bg-sirt/95 backdrop-blur border-b border-chiziq">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-matn truncate">{d.imtihon.nomi}</p>
            <p className="text-[11.5px] text-matn-xira inline-flex items-center gap-1">
              {saqlash === 'xato' ? <><CloudOff size={12} className="text-xato" /> saqlanmadi — internetni tekshiring</> : saqlash === 'saqlanmoqda' ? <><Loader2 size={12} className="animate-spin" /> saqlanmoqda</> : <><Cloud size={12} /> saqlangan</>}
              <span className="mx-1">·</span>{javobSoni}/{savollar.length}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold raqam text-[15px] ${kam ? 'bg-xato-fon text-xato' : 'bg-ichki text-matn'}`} aria-label="Qolgan vaqt">
            <Clock size={15} /> {vaqtMatni(Math.max(0, qolgan ?? 0))}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-28 space-y-4">
        {kitobcha ? (
          // "Faqat kalit": onlayn javob varaqasi — savollar kitobchada.
          <section className="bg-sirt rounded-2xl border border-chiziq p-3 space-y-3">
            <p className="text-[12.5px] text-matn-sokin px-1">Savollar qog'oz kitobchada. Har savolga javobni belgilang.</p>
            {(d.bloklar || []).map(b => (
              <div key={b.boshi}>
                <p className="text-[12.5px] font-bold text-matn px-1 mb-1.5">{b.nomi}</p>
                <div className="space-y-1.5">
                  {savollar.filter(x => x.n >= b.boshi && x.n <= b.oxiri).map(x => (
                    <div key={x.n} className="flex items-center gap-2">
                      <span className="w-8 text-right text-[13px] font-bold text-matn-sokin raqam">{x.y ?? x.n}</span>
                      {x.t === 'yopiq' ? (
                        <div className="flex gap-1.5">
                          {x.variantlar.map((_, i) => {
                            const h = HARF[i];
                            const tanlangan = javoblar[x.n] === h;
                            return <button key={h} onClick={() => javobQoy(x.n, tanlangan ? '' : h)} aria-pressed={tanlangan} aria-label={`${x.y ?? x.n}: ${h}`}
                              className={`w-10 h-10 rounded-full border-2 text-[14px] font-bold cursor-pointer ${tanlangan ? 'bg-brand border-brand text-brand-ust' : 'border-chiziq-kuchli text-matn-sokin bg-sirt'}`}>{h}</button>;
                          })}
                        </div>
                      ) : x.t === 'moslash' ? (
                        <MoslashJavob r={x.r || 4} c={x.c || 5} qiymat={javoblar[x.n] || ''} onChange={v => javobQoy(x.n, v)} />
                      ) : (
                        <input inputMode={x.t === 'yozma' ? 'text' : 'decimal'} className={`${x.t === 'yozma' ? 'w-56' : 'w-32'} px-3 py-2 rounded-xl border border-chiziq bg-ichki text-[14px] text-matn outline-none focus:border-brand`} value={javoblar[x.n] || ''} placeholder="javob"
                          aria-label={`${x.y ?? x.n}-savol javobi`} onChange={e => javobQoy(x.n, e.target.value.slice(0, x.t === 'yozma' ? 60 : 12))} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : s && (
          <section className="bg-sirt rounded-2xl border border-chiziq p-4 space-y-4" aria-label={`${s.y ?? s.n}-savol`}>
            <p className="text-[12px] font-semibold text-matn-xira">{s.y ?? s.n}-savol · {savollar.length} tadan {joriy + 1}-si</p>
            {matn && (
              <div className="rounded-xl bg-ichki p-3 space-y-2">
                {matn.title && <p className="text-[12.5px] font-bold text-matn">{matn.title}</p>}
                <div className={`${SAVOL_MATNI} text-[14px] text-matn`} dangerouslySetInnerHTML={{ __html: formulaliHtml(matn.text) }} />
                {matn.imageUrl && <img src={matn.imageUrl} alt="" className="max-h-72 rounded-lg" />}
              </div>
            )}
            <div className={`${SAVOL_MATNI} text-[15px] text-matn break-words`} dangerouslySetInnerHTML={{ __html: formulaliHtml(s.matn) }} />
            {s.rasm && <img src={s.rasm} alt="" className="max-h-80 rounded-lg mx-auto" />}
            {s.t === 'yopiq' ? (
              <div className="space-y-2" role="radiogroup" aria-label="Javob">
                {s.variantlar.map((v, i) => {
                  const h = HARF[i];
                  const tanlangan = javoblar[s.n] === h;
                  return (
                    <button key={h} role="radio" aria-checked={tanlangan} onClick={() => javobQoy(s.n, tanlangan ? '' : h)}
                      className={`w-full flex items-start gap-3 rounded-xl border-2 px-3 py-3 text-left cursor-pointer transition-colors ${tanlangan ? 'border-brand bg-brand-fon dark:bg-brand/15' : 'border-chiziq bg-sirt hover:border-chiziq-kuchli'}`}>
                      <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold ${tanlangan ? 'bg-brand text-brand-ust' : 'bg-ichki text-matn-sokin'}`}>{h}</span>
                      <span className={`${SAVOL_MATNI} text-[14.5px] text-matn min-w-0 break-words pt-1`} dangerouslySetInnerHTML={{ __html: formulaliHtml(v) }} />
                    </button>
                  );
                })}
              </div>
            ) : s.t === 'moslash' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[{ l: s.variantlar, h: 'ABCD' }, { l: s.ong || [], h: 'PQRST' }].map((u, ui) => (
                    <ol key={ui} className="space-y-1.5">
                      {u.l.map((v, i) => (
                        <li key={i} className="flex gap-2 rounded-xl bg-ichki px-3 py-2 text-[14px] text-matn">
                          <b className="shrink-0">{u.h[i]})</b><span className={`${SAVOL_MATNI} min-w-0 break-words`} dangerouslySetInnerHTML={{ __html: formulaliHtml(v) }} />
                        </li>
                      ))}
                    </ol>
                  ))}
                </div>
                <p className="text-[12.5px] text-matn-sokin">Har qatorga mos keladiganlarini belgilang (bir nechta bo'lishi mumkin):</p>
                <MoslashJavob katta r={s.r || s.variantlar.length || 4} c={s.c || (s.ong || []).length || 5} qiymat={javoblar[s.n] || ''} onChange={v => javobQoy(s.n, v)} />
              </div>
            ) : (
              <label className="block">
                <span className="block text-[12.5px] font-semibold text-matn-sokin mb-1.5">{s.t === 'yozma' ? 'Javobingizni yozing' : 'Javob (son yoki kasr: 0,5 yoki 1/2)'}</span>
                <input inputMode={s.t === 'yozma' ? 'text' : 'decimal'} className="w-full px-4 py-3 rounded-xl border-2 border-chiziq bg-ichki text-[16px] text-matn outline-none focus:border-brand raqam"
                  value={javoblar[s.n] || ''} onChange={e => javobQoy(s.n, e.target.value.slice(0, s.t === 'yozma' ? 60 : 12))} />
              </label>
            )}
          </section>
        )}
      </main>

      {/* Pastki panel: oldingi / keyingi, savollar paneli, yakunlash */}
      <footer className="fixed bottom-0 inset-x-0 z-20 bg-sirt border-t border-chiziq">
        {panel && !kitobcha && (
          <div className="max-w-2xl mx-auto px-4 pt-3 grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-[40vh] overflow-y-auto">
            {savollar.map((x, i) => (
              <button key={x.n} onClick={() => { setJoriy(i); setPanel(false); }} aria-label={`${x.y ?? x.n}-savol`}
                className={`h-9 rounded-lg text-[12.5px] font-bold raqam cursor-pointer border ${i === joriy ? 'border-brand ring-2 ring-brand/30' : 'border-chiziq'} ${javoblar[x.n] ? 'bg-brand text-brand-ust' : 'bg-ichki text-matn-sokin'}`}>{x.y ?? x.n}</button>
            ))}
          </div>
        )}
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          {!kitobcha && <>
            <button onClick={() => setJoriy(i => Math.max(0, i - 1))} disabled={joriy === 0} aria-label="Oldingi savol" className="p-3 rounded-xl bg-ichki text-matn disabled:opacity-40 cursor-pointer"><ChevronLeft size={18} /></button>
            <button onClick={() => setPanel(p => !p)} aria-label="Savollar paneli" className="px-3 py-3 rounded-xl bg-ichki text-matn inline-flex items-center gap-1.5 text-[13px] font-semibold cursor-pointer"><LayoutGrid size={16} /> {joriy + 1}/{savollar.length}</button>
            <button onClick={() => setJoriy(i => Math.min(savollar.length - 1, i + 1))} disabled={joriy >= savollar.length - 1} aria-label="Keyingi savol" className="p-3 rounded-xl bg-ichki text-matn disabled:opacity-40 cursor-pointer"><ChevronRight size={18} /></button>
          </>}
          <button onClick={() => setYakunOynasi(true)} className="ml-auto px-4 py-3 rounded-xl bg-brand text-brand-ust text-[13.5px] font-bold inline-flex items-center gap-1.5 cursor-pointer"><Send size={15} /> Yakunlash</button>
        </div>
      </footer>

      {yakunOynasi && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Yakunlash">
          <div className="fixed inset-0 bg-black/50" onClick={() => setYakunOynasi(false)} />
          <div className="relative bg-sirt rounded-2xl border border-chiziq w-full max-w-sm p-5 space-y-4">
            <p className="text-[15px] font-bold text-matn">Testni yakunlaysizmi?</p>
            <p className="text-[13px] text-matn-sokin">{javobSoni} ta savolga javob berdingiz{savollar.length - javobSoni ? `, ${savollar.length - javobSoni} tasi bo'sh` : ''}. Yakunlangach javobni o'zgartirib bo'lmaydi.</p>
            <div className="flex gap-2">
              <button onClick={() => setYakunOynasi(false)} className="flex-1 py-3 rounded-xl bg-ichki text-matn text-[13.5px] font-semibold cursor-pointer">Davom etish</button>
              <button disabled={band} onClick={async () => { setBand(true); await yubor(true); setBand(false); setYakunOynasi(false); }}
                className="flex-1 py-3 rounded-xl bg-brand text-brand-ust text-[13.5px] font-bold cursor-pointer disabled:opacity-60">Yakunlash</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Ekran({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-fon flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-sirt rounded-2xl border border-chiziq p-6 text-center">{children}</div>
    </div>
  );
}

/** Moslashtirish javobi: qatorlar (A–D) × ustunlar (P–T), qatorda bir nechta belgi — "PQ|R||T". */
function MoslashJavob({ r, c, qiymat, onChange, katta }: { r: number; c: number; qiymat: string; onChange: (v: string) => void; katta?: boolean }) {
  const qatorlar = Array.from({ length: r }, (_, i) => (qiymat.split('|')[i] || ''));
  const bos = (i: number, h: string) => {
    const k = [...qatorlar];
    k[i] = (k[i].includes(h) ? k[i].replace(h, '') : k[i] + h).split('').sort().join('');
    onChange(k.some(Boolean) ? k.join('|') : '');
  };
  const o = katta ? 'w-11 h-11 text-[14px]' : 'w-9 h-9 text-[12.5px]';
  return (
    <div className="space-y-1.5">
      {qatorlar.map((q, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-6 text-center text-[13px] font-bold text-matn-sokin">{'ABCD'[i]}</span>
          {'PQRST'.slice(0, c).split('').map(h => {
            const on = q.includes(h);
            return <button key={h} onClick={() => bos(i, h)} aria-pressed={on} aria-label={`${'ABCD'[i]}–${h}`}
              className={`${o} rounded-full border-2 font-bold cursor-pointer ${on ? 'bg-brand border-brand text-brand-ust' : 'border-chiziq-kuchli text-matn-sokin bg-sirt'}`}>{h}</button>;
          })}
        </div>
      ))}
    </div>
  );
}
