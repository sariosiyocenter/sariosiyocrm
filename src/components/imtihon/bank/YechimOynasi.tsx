import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { useAiHolat, AI_SOZLANMAGAN } from '../useAiHolat';
import { Tugma, Yorliq, Yuklanmoqda } from '../ui';
import { formulaliHtml, oddiyMatn, SAVOL_MATNI } from '../../../lib/matn';
import { Oyna } from './BankOynalari';
import SavolKorinishi from './SavolKorinishi';
import type { YechimRejimi } from './bankTurlari';
import type { Question } from '../../../types';

// Savol yechimi oynasi (egasi, 2026-10-10): «Yechimni ko'rish» — savol va yechimi; «Yechimni
// o'zgartirish» — matn muharriri EMAS: ustoz yechim qanday bo'lishini aytadi (usul, uzunlik,
// daraja, til…), yechimni AI yozadi. AI yozgani avval shu yerda ko'rinadi; ustoz «Saqlash»ni
// bosmaguncha bazaga hech narsa yozilmaydi. AI bankdagi to'g'ri javobdan boshqa javobga kelsa —
// ogohlantirish chiqadi (jim saqlanmaydi).

type YechimHolati = NonNullable<Question['solutionStatus']>;
/** POST questions/:id/yechim/ai javobi (bazaga yozilmagan taklif). */
interface AiYechim {
  yechim: string; aiJavobi: string;
  /** AI javobi bankdagi javob bilan mosmi; null — solishtirib bo'lmadi (yozma savol, erkin matnli javob). */
  mos: boolean | null;
  kalit: string; izoh: string; rasmKerak: boolean;
  rasm: { jami: number; berildi: number };
}
/** Saqlangandan keyin ro'yxatga qaytadigan holat. */
export interface YechimNatijasi { yechimBor: boolean; solutionStatus: YechimHolati }

// Bir bosishda tanlanadigan talablar; ustoz o'z so'zi bilan ham yozadi (ikkalasi birga ketadi).
const TAKLIFLAR = ['Batafsil, har qadam izohi bilan', 'Qisqaroq', 'Boshqa usulda', "Soddaroq tilda — o'quvchi tushunadigan qilib"];
const KORSATMA_MAX = 600;
const yechimBormi = (html?: string | null) => !!html && (oddiyMatn(html).length > 0 || /<img/i.test(html));
/** Javob matni (oddiy matn, formulasi $...$ da: «A) $\frac{1}{4}$») — ekranda formula chizilib chiqadi, xom LaTeX emas. */
function Javob({ matn, className }: { matn: string; className?: string }) {
  const html = useMemo(() => formulaliHtml(matn.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')), [matn]);
  return <b className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function YechimOynasi({ id, rejim: boshRejim, onYop, onSaqlandi }: {
  id: number; rejim: YechimRejimi; onYop: () => void;
  /** Yechim saqlandi yoki holati o'zgardi — ro'yxatdagi belgi yangilanadi. */
  onSaqlandi?: (id: number, natija: YechimNatijasi) => void;
}) {
  const { ozgartira, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.savollar');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const ai = useAiHolat();
  const [q, setQ] = useState<Question | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [rejim, setRejim] = useState<YechimRejimi>(boshRejim);
  // O'zgartirishga shu oynadagi ko'rinishdan o'tilgan — «Bekor qilish» o'sha ko'rinishga qaytaradi.
  const [korishdan, setKorishdan] = useState(false);
  const [tanlangan, setTanlangan] = useState<string[]>([]);
  const [matn, setMatn] = useState('');
  // AI yozgan, hali saqlanmagan yechim va u qaysi talab bilan yozilgani.
  const [taklif, setTaklif] = useState<(AiYechim & { talab: string }) | null>(null);
  // Belgilansa — yechim tasdiqlangan bo'lib saqlanadi (o'quvchi natijadan keyin ko'radi).
  const [tasdiq, setTasdiq] = useState(false);
  const [band, setBand] = useState<'ai' | 'saqla' | 'holat' | null>(null);
  const taklifRef = useRef<HTMLElement>(null);
  const ochiq = useRef(true);
  useEffect(() => { ochiq.current = true; return () => { ochiq.current = false; }; }, []);

  useEffect(() => {
    let bekor = false;
    soro<Question>('GET', `questions/${id}`).then(r => { if (!bekor) setQ(r); }).catch(e => { if (!bekor) setXato(e.message); });
    return () => { bekor = true; };
  }, [id, soro]);

  // Yangi yechim kelganda diqqat (klaviatura va ekran o'quvchi) o'shanga o'tadi.
  useEffect(() => { if (taklif) taklifRef.current?.focus(); }, [taklif]);

  const bor = yechimBormi(q?.solution);
  const yechimHtml = useMemo(() => formulaliHtml(q?.solution || ''), [q?.solution]);
  const taklifHtml = useMemo(() => formulaliHtml(taklif?.yechim || ''), [taklif?.yechim]);
  const aiYoq = !!ai && !ai.yoqilgan;
  const rasmKorinmadi = !!taklif && taklif.rasm.jami > taklif.rasm.berildi;
  /** Ustozning talabi: tanlangan tayyor iboralar va o'z so'zi. */
  const talab = [...tanlangan, matn.replace(/\s+/g, ' ').trim()].filter(Boolean).join('. ').slice(0, KORSATMA_MAX);
  // Talab maydoni: o'zgartirish rejimida va AI yozgandan keyin (yoqmasa — boshqacha aytib, qayta yozdirish uchun).
  const talabOchiq = tahrir && (rejim === 'ozgartirish' || !!taklif);

  const aiYoz = async () => {
    setBand('ai');
    try {
      // Talab o'zgargan bo'lsa — u ekrandagi (hali saqlanmagan) yechimga nisbatan aytilgan: AI o'shani
      // ko'radi. O'zgarmagan bo'lsa — shu talab bilan boshidan yoziladi (aks holda «Qisqaroq» ustma-ust qo'llanardi).
      const r = await soro<AiYechim>('POST', `questions/${id}/yechim/ai`, { korsatma: talab, asos: taklif && talab && talab !== taklif.talab ? taklif.yechim : undefined });
      if (!ochiq.current) return;
      setTaklif({ ...r, talab });
      // Tasdiq o'zi qo'yiladi faqat AI javobi bankdagi javob bilan mos chiqqanda (va u rasmni ko'rganda);
      // solishtirib bo'lmaydigan (yozma) yoki mos kelmagan yechimni ustoz o'zi belgilab tasdiqlaydi.
      setTasdiq(r.mos === true && !r.rasmKerak && r.rasm.jami <= r.rasm.berildi);
    } catch (e: any) {
      // 504 — server javob berishga ulgurmadi (uzun yechim): xabar serverdan kelmaydi.
      if (ochiq.current) showNotification(e?.status === 504 ? "AI javob berishga ulgurmadi — qayta urinib ko'ring" : e.message, 'error');
    } finally {
      if (ochiq.current) setBand(null);
    }
  };

  const yoz = async (body: { solution?: string; solutionStatus: YechimHolati; korsatma?: string }, xabar: string) => {
    const r = await soro<{ solution: string | null; solutionStatus: YechimHolati; yechimBor: boolean }>('PUT', `questions/${id}/yechim`, body);
    setQ(x => x && ({ ...x, solution: r.solution, solutionStatus: r.solutionStatus }));
    showNotification(xabar, 'success');
    onSaqlandi?.(id, { yechimBor: r.yechimBor, solutionStatus: r.solutionStatus });
  };

  const saqla = async () => {
    if (!taklif || band) return;
    // Tasdiqlash oynasi oddiy matn chiqaradi: javobda formula bo'lsa xom LaTeX ko'rinardi — ikkala javob
    // (chizilgan holda) ogohlantirishning o'zida turibdi, bu yerda takrorlanmaydi.
    const formulali = `${taklif.aiJavobi}${taklif.kalit}`.includes('$');
    if (taklif.mos === false && !(await confirm({
      title: 'Javoblar mos emas',
      message: formulali
        ? "AI chiqargan javob bankdagi to'g'ri javobdan farq qiladi (ikkalasi ogohlantirishda ko'rsatilgan). Shunday bo'lsa ham bu yechim saqlansinmi?"
        : `AI «${taklif.aiJavobi || '?'}» javobini chiqardi, bankdagi to'g'ri javob esa «${taklif.kalit}». Shunday bo'lsa ham bu yechim saqlansinmi?`,
      confirmLabel: 'Baribir saqlash',
    }))) return;
    setBand('saqla');
    try {
      await yoz({ solution: taklif.yechim, solutionStatus: tasdiq ? 'tasdiqlangan' : 'qoralama', korsatma: taklif.talab || undefined },
        tasdiq ? "Yechim saqlandi — o'quvchilar natijadan keyin ko'radi" : "Yechim qoralama bo'lib saqlandi — o'quvchilar ko'rmaydi");
      setTaklif(null); setTanlangan([]); setMatn(''); setRejim('korish');
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
    }
  };

  const holatQoy = async (holat: YechimHolati) => {
    setBand('holat');
    try {
      await yoz({ solutionStatus: holat }, holat === 'tasdiqlangan' ? "Yechim tasdiqlandi — o'quvchilar natijadan keyin ko'radi" : "Tasdiq olindi — o'quvchilar ko'rmaydi");
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
    }
  };

  /** AI yozgan, lekin saqlanmagan yechim tasodifan yo'qolmasin: tashlashdan oldin so'raladi. */
  const tashlansinmi = async (tugma: string) => !taklif
    || !!(await confirm({ title: 'Yangi yechim saqlanmadi', message: "AI yozgan yechim yo'qoladi.", confirmLabel: tugma, danger: false }));
  const yop = async () => {
    // Saqlanayotgan paytda yopilmaydi: so'rov baribir tugaydi, «yo'qoladi» degan savol esa chalg'itadi.
    if (band === 'saqla' || band === 'holat') return;
    if (await tashlansinmi('Yopish')) onYop();
  };
  const taklifniTashla = async () => { if (await tashlansinmi('Tashlash')) setTaklif(null); };
  const ozgartirishga = () => { setKorishdan(true); setRejim('ozgartirish'); };

  const aiTugma = (nom: string, turi: 'asosiy' | 'ikkinchi', ikonka: React.ReactNode) => (
    <Tugma turi={turi} ikonka={ikonka} yuklanmoqda={band === 'ai'} disabled={!ai || aiYoq || !!band}
      title={aiYoq ? AI_SOZLANMAGAN : 'AI yechimni yozadi — siz ko\'rib, saqlaysiz'} onClick={aiYoz}>{nom}</Tugma>
  );

  const pastki = !q ? <><span /><Tugma onClick={onYop}>Yopish</Tugma></>
    : !tahrir ? <><span /><Tugma onClick={yop}>Yopish</Tugma></>
    : taklif ? (
      <>
        <Tugma disabled={!!band} onClick={taklifniTashla}>Bekor qilish</Tugma>
        <div className="flex flex-wrap justify-end gap-2">
          {aiTugma('Qayta yozdirish', 'ikkinchi', <RefreshCw size={14} />)}
          <Tugma turi={taklif.mos === false ? 'ikkinchi' : 'asosiy'} yuklanmoqda={band === 'saqla'} disabled={!!band} onClick={saqla}>{taklif.mos === false ? 'Baribir saqlash' : 'Saqlash'}</Tugma>
        </div>
      </>
    ) : rejim === 'ozgartirish' ? (
      <>
        <Tugma disabled={!!band} onClick={() => (korishdan ? setRejim('korish') : onYop())}>Bekor qilish</Tugma>
        {aiTugma('AI yozsin', 'asosiy', <Sparkles size={14} />)}
      </>
    ) : bor ? (
      <>
        {q.solutionStatus === 'tasdiqlangan'
          ? <Tugma turi="oddiy" yuklanmoqda={band === 'holat'} disabled={!!band} onClick={() => holatQoy('qoralama')} title="O'quvchilar bu yechimni ko'rmaydigan bo'ladi">Tasdiqni olish</Tugma>
          : <Tugma ikonka={<CheckCircle2 size={14} />} yuklanmoqda={band === 'holat'} disabled={!!band} onClick={() => holatQoy('tasdiqlangan')} title="Tasdiqlangan yechimni o'quvchilar natijadan keyin ko'radi">Tasdiqlash</Tugma>}
        <Tugma turi="asosiy" ikonka={<Wand2 size={14} />} disabled={!!band} onClick={ozgartirishga}>Yechimni o'zgartirish</Tugma>
      </>
    ) : (
      <>
        <Tugma turi="oddiy" disabled={!!band} onClick={ozgartirishga}>Qanday bo'lishini aytish</Tugma>
        {aiTugma('AI yechsin', 'asosiy', <Sparkles size={14} />)}
      </>
    );

  return (
    <Oyna sarlavha={`Savol #${id} — yechim`} izoh={q ? [q.subject, q.topic].filter(Boolean).join(' › ') : undefined} onYop={yop} kenglik="max-w-2xl" pastki={pastki}>
      {!q ? (xato ? <p className="py-6 text-center text-[13px] text-xato">{xato}</p> : <Yuklanmoqda />) : (
        <>
          <SavolKorinishi q={q} yechimsiz />

          {taklif ? (
            <section ref={taklifRef} tabIndex={-1} aria-label="Yangi yechim — hali saqlanmagan" className="rounded-xl border border-brand/50 bg-sirt p-4 space-y-3" style={{ outline: 'none' }}>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-[13px] font-bold text-matn">Yangi yechim</h4>
                <Yorliq rang="ogoh">hali saqlanmagan</Yorliq>
                {bor && <span className="text-[11.5px] text-matn-xira">saqlansa — hozirgi yechim o'rniga yoziladi</span>}
                {band === 'ai' && <span role="status" className="inline-flex items-center gap-1.5 text-[12px] text-matn-sokin"><Loader2 size={13} className="animate-spin" />AI qayta yozmoqda…</span>}
              </div>
              {taklif.mos === false && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-xato-chiziq bg-xato-fon px-3 py-2.5 text-[12.5px] text-matn">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-xato" />
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-bold text-xato">AI boshqa javob chiqardi</p>
                    <p>AI javobi: <Javob matn={taklif.aiJavobi || '—'} />. Bankdagi to'g'ri javob: <Javob matn={taklif.kalit} />.</p>
                    {taklif.izoh && <p className="text-matn-sokin">{taklif.izoh}</p>}
                    <p className="text-matn-sokin">Saqlashdan oldin savolning to'g'ri javobini yoki yechimni tekshiring.</p>
                  </div>
                </div>
              )}
              {(rasmKorinmadi || taklif.rasmKerak) && (
                <p role="alert" className="flex items-start gap-2 rounded-xl border border-ogoh/25 bg-ogoh-fon px-3 py-2 text-[12.5px] text-matn">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-ogoh" />
                  <span>{rasmKorinmadi ? "Savolda rasm bor, lekin AI uni ko'ra olmadi" : 'AI rasmdagi ma\'lumotsiz to\'liq yecha olmadi'} — yechim noto'g'ri bo'lishi mumkin, albatta tekshiring.</span>
                </p>
              )}
              <div className={`${SAVOL_MATNI} text-[13.5px] text-matn`} dangerouslySetInnerHTML={{ __html: taklifHtml }} />
              {taklif.mos === true && <p className="flex items-center gap-1.5 text-[12px] font-semibold text-yaxshi"><CheckCircle2 size={14} /><span>AI javobi bankdagi to'g'ri javob bilan mos: <Javob matn={taklif.aiJavobi} /></span></p>}
              {taklif.mos === null && (
                <p className="text-[12px] text-matn-sokin">
                  {taklif.aiJavobi && <>AI javobi: <Javob className="text-matn" matn={taklif.aiJavobi} /> · </>}
                  {taklif.kalit ? <>bankdagi javob: <Javob className="text-matn" matn={taklif.kalit} /> — ularni dastur solishtira olmadi, o'zingiz tekshiring</> : "bankda bu savolning javobi yozilmagan — yechimni o'zingiz tekshiring"}
                </p>
              )}
              <label className="flex items-start gap-2 text-[12.5px] text-matn cursor-pointer select-none">
                <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--color-brand)] cursor-pointer" checked={tasdiq} onChange={e => setTasdiq(e.target.checked)} />
                <span><b>Tekshirdim, tasdiqlayman</b> — o'quvchilar natijadan keyin ko'radi<span className="block text-[11.5px] text-matn-xira">Belgilanmasa — qoralama bo'lib saqlanadi: faqat ustozlar ko'radi, keyin ham tasdiqlasa bo'ladi</span></span>
              </label>
            </section>
          ) : (
            <section aria-label="Yechim" className="rounded-xl border border-chiziq bg-sirt p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h4 className="text-[13px] font-bold text-matn">Yechim</h4>
                {bor && (q.solutionStatus === 'tasdiqlangan'
                  ? <Yorliq rang="yaxshi">tasdiqlangan</Yorliq>
                  : <span title="O'quvchilar faqat tasdiqlangan yechimni ko'radi"><Yorliq rang="ogoh">tasdiqlanmagan</Yorliq></span>)}
              </div>
              {band === 'ai' ? (
                <p role="status" className="flex items-center gap-2 py-3 text-[13px] text-matn-sokin"><Loader2 size={15} className="animate-spin" />AI yechmoqda… odatda 10–30 soniya</p>
              ) : bor ? (
                <div className={`${SAVOL_MATNI} text-[13.5px] text-matn`} dangerouslySetInnerHTML={{ __html: yechimHtml }} />
              ) : (
                <p className="text-[13px] text-matn-sokin">Bu savolning yechimi hali yo'q.{tahrir && " AI yechib beradi — ko'rib chiqib, saqlaysiz."}</p>
              )}
            </section>
          )}

          {talabOchiq && (
            <section aria-label="Yechim qanday bo'lishi kerak" className="space-y-2">
              <label htmlFor="yechim-talabi" className="block text-[13px] font-bold text-matn">{taklif ? "Boshqacha bo'lsinmi? Yechim qanday bo'lishi kerak?" : "Yechim qanday bo'lishi kerak?"}</label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tayyor talablar">
                {TAKLIFLAR.map(t => {
                  const yoniq = tanlangan.includes(t);
                  return (
                    <button key={t} type="button" aria-pressed={yoniq} disabled={band === 'ai'} onClick={() => setTanlangan(l => (l.includes(t) ? l.filter(x => x !== t) : [...l, t]))}
                      className={`px-2.5 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer transition-colors disabled:opacity-50 ${yoniq ? 'bg-brand text-brand-ust border-brand' : 'bg-sirt border-chiziq text-matn-sokin hover:text-matn hover:border-chiziq-kuchli'}`}>{t}</button>
                  );
                })}
              </div>
              <textarea id="yechim-talabi" rows={3} maxLength={KORSATMA_MAX} value={matn} onChange={e => setMatn(e.target.value)} disabled={band === 'ai'} autoFocus={boshRejim === 'ozgartirish'}
                placeholder="Yoki o'z so'zingiz bilan yozing: qaysi usulda, qanchalik batafsil, kim uchun, qaysi tilda…"
                className="w-full px-3 py-2.5 bg-ichki border border-chiziq rounded-xl text-[13px] text-matn focus:border-brand placeholder:text-matn-xira resize-y" style={{ outline: 'none' }} />
              <p className="text-[11.5px] text-matn-xira">
                {q.type === 'yozma' ? 'Yozma savol: hech narsa tanlamasangiz ham batafsil, har qadam izohi bilan yechiladi.' : "Hech narsa tanlamasangiz — qisqa, lekin to'liq yechim yoziladi."} Yechimni AI yozadi; siz ko'rib, saqlaysiz.
              </p>
            </section>
          )}
          {tahrir && aiYoq && <p className="text-[12px] text-ogoh">{AI_SOZLANMAGAN}</p>}
        </>
      )}
    </Oyna>
  );
}
