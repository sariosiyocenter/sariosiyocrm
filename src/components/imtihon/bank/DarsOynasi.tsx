import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clapperboard, Loader2, Mic, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { useAiHolat, AI_SOZLANMAGAN } from '../useAiHolat';
import { BoshHolat, Tugma, Yorliq, Yuklanmoqda } from '../ui';
import { Oyna } from './BankOynalari';
import DarsPleer from '../dars/DarsPleer';
import MikrofonTugma from '../MikrofonTugma';
import type { DarsHolati, DarsTaklifi } from '../dars/darsTurlari';

// Savolning video darsi oynasi (egasi, 2026-10-13): o'quvchi natijadan keyin masala qanday
// yechilishini ko'radi va eshitadi. Dars savolning tayyor yechimidan tuziladi. Bitta tugma
// (egasi, 2026-10-14: "video + ovozni bittada"): AI ssenariy va chizma yozadi → dars qoralama bo'lib
// saqlanadi → ovoz yoziladi; ustoz tayyor, ovozli darsni ko'rib tasdiqlaydi. Uch alohida so'rov:
// har biri serverda o'z vaqtiga sig'adi, ovoz yozilmasa ham dars saqlangan qoladi.
// Yechimdagidek: bu matn muharriri emas — ustoz dars qanday bo'lishini aytadi, AI qayta yaratadi.

type Band = 'ai' | 'ovoz' | 'holat' | 'ochir';
const KORSATMA_MAX = 600;
const XABAR = 'flex items-start gap-2 rounded-xl border px-3 py-2 text-[12.5px] text-matn';

export default function DarsOynasi({ id, onYop }: { id: number; onYop: () => void }) {
  const { ozgartira, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.savollar');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const ai = useAiHolat();
  const [h, setH] = useState<DarsHolati | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [matn, setMatn] = useState('');
  const [band, setBand] = useState<Band | null>(null);
  // AI ning shu safar yaratgan darsiga ogohlantirishlari (harf, formula belgisi…) — dars tagida turadi.
  const [ogohlar, setOgohlar] = useState<string[]>([]);
  // Dars almashganda pleer boshidan boshlanadi.
  const [versiya, setVersiya] = useState(0);
  const ochiq = useRef(true);
  useEffect(() => { ochiq.current = true; return () => { ochiq.current = false; }; }, []);

  useEffect(() => {
    let bekor = false;
    soro<DarsHolati>('GET', `questions/${id}/dars`).then(r => { if (!bekor) setH(r); }).catch(e => { if (!bekor) setXato(e.message); });
    return () => { bekor = true; };
  }, [id, soro]);

  const dars = h?.dars ?? null;
  const aiYoq = !!ai && !ai.yoqilgan;
  const talab = matn.replace(/\s+/g, ' ').trim().slice(0, KORSATMA_MAX);
  const yangila = (r: DarsHolati) => { setH(r); setVersiya(v => v + 1); };

  /** Amalni bajaradi: band holati, xato xabari va oyna yopilgan bo'lsa natijani tashlash — bir joyda. */
  const bajar = async (nima: Band, ish: () => Promise<void>, xatoOldi = ''): Promise<boolean> => {
    setBand(nima);
    try {
      await ish();
      return true;
    } catch (e: any) {
      // 504 — server javob berishga ulgurmadi: xabar serverdan kelmaydi.
      if (ochiq.current) showNotification(e?.status === 504 ? `${xatoOldi}server javob berishga ulgurmadi — qayta urinib ko'ring` : `${xatoOldi}${e.message}`, 'error');
      return false;
    } finally {
      if (ochiq.current) setBand(null);
    }
  };

  const ovozYoz = () => bajar('ovoz', async () => {
    const r = await soro<DarsHolati>('POST', `questions/${id}/dars/ovoz`);
    if (!ochiq.current) return;
    yangila(r);
    showNotification("Video dars tayyor — ko'rib, tasdiqlang", 'success');
  }, 'Dars saqlandi, lekin ovoz yozilmadi: ');

  /** Bitta bosishda: ssenariy va chizma → saqlash (qoralama) → ovoz. */
  const yarat = async () => {
    if (band) return;
    if (dars && !(await confirm({
      title: 'Dars qayta yaratilsinmi?',
      message: dars.status === 'tasdiqlangan'
        ? "Hozirgi tasdiqlangan dars yangisi bilan almashtiriladi; yangisi tasdiqlanguncha o'quvchilar darsni ko'rmaydi."
        : 'Hozirgi dars yangisi bilan almashtiriladi.',
      confirmLabel: 'Qayta yaratish', danger: false,
    }))) return;
    const saqlandi = await bajar('ai', async () => {
      const t = await soro<DarsTaklifi>('POST', `questions/${id}/dars/ai`, { korsatma: talab });
      if (!ochiq.current) return;
      const r = await soro<DarsHolati>('PUT', `questions/${id}/dars`, { qadamlar: t.qadamlar, korsatma: talab || undefined });
      if (!ochiq.current) return;
      yangila(r);
      setOgohlar(t.ogohlar);
      setMatn('');
    });
    if (saqlandi && ochiq.current && ai?.yoqilgan) await ovozYoz();
  };

  const holatQoy = (status: 'qoralama' | 'tasdiqlangan') => bajar('holat', async () => {
    const r = await soro<DarsHolati>('PUT', `questions/${id}/dars`, { status });
    if (!ochiq.current) return;
    setH(r);
    showNotification(status === 'tasdiqlangan' ? "Video dars tasdiqlandi — o'quvchilar natijadan keyin ko'radi" : "Tasdiq olindi — o'quvchilar ko'rmaydi", 'success');
  });

  const ochir = async () => {
    if (!(await confirm({ title: "Video dars o'chirilsinmi?", message: "Dars va uning ovozi o'chadi. Savol va yechimga tegilmaydi.", confirmLabel: "O'chirish" }))) return;
    await bajar('ochir', async () => {
      const r = await soro<DarsHolati>('DELETE', `questions/${id}/dars`);
      if (!ochiq.current) return;
      yangila(r);
      setOgohlar([]);
      showNotification("Video dars o'chirildi", 'success');
    });
  };

  // Yaratilayotgan paytda yopilmaydi: AI ga to'langan so'rov yarmida tashlab ketilmasin.
  const yop = () => { if (!band) onYop(); };

  const yaratTugma = (nom: string, turi: 'asosiy' | 'ikkinchi', ikonka: React.ReactNode) => (
    <Tugma turi={turi} ikonka={ikonka} yuklanmoqda={band === 'ai' || band === 'ovoz'} disabled={!ai || aiYoq || !!band}
      title={aiYoq ? AI_SOZLANMAGAN : "AI yechimdan video dars yaratadi: doskadagi yozuv, chizma va ovoz — siz ko'rib, tasdiqlaysiz"} onClick={yarat}>{nom}</Tugma>
  );

  const pastki = !h || !tahrir || !h.yechimBor ? <><span /><Tugma onClick={yop}>Yopish</Tugma></>
    : dars ? (
      <>
        <Tugma turi="oddiy" ikonka={<Trash2 size={14} />} yuklanmoqda={band === 'ochir'} disabled={!!band} onClick={ochir}>O'chirish</Tugma>
        <div className="flex flex-wrap justify-end gap-2">
          {yaratTugma('Qayta yaratish', 'ikkinchi', <RefreshCw size={14} />)}
          {!dars.ovoz && band !== 'ovoz' && <Tugma ikonka={<Mic size={14} />} disabled={!ai || aiYoq || !!band} title={aiYoq ? AI_SOZLANMAGAN : undefined} onClick={ovozYoz}>Ovoz yozdirish</Tugma>}
          {dars.status === 'tasdiqlangan'
            ? <Tugma turi="oddiy" yuklanmoqda={band === 'holat'} disabled={!!band} onClick={() => holatQoy('qoralama')} title="O'quvchilar bu darsni ko'rmaydigan bo'ladi">Tasdiqni olish</Tugma>
            : <Tugma turi="asosiy" ikonka={<CheckCircle2 size={14} />} yuklanmoqda={band === 'holat'} disabled={!!band || dars.eskirgan} onClick={() => holatQoy('tasdiqlangan')}
                title={dars.eskirgan ? "Yechim o'zgargan — avval darsni qayta yarating" : "Tasdiqlangan darsni o'quvchilar natijadan keyin ko'radi"}>Tasdiqlash</Tugma>}
        </div>
      </>
    ) : (
      <><Tugma disabled={!!band} onClick={yop}>Yopish</Tugma>{yaratTugma('Video dars yaratish', 'asosiy', <Sparkles size={14} />)}</>
    );

  return (
    <Oyna sarlavha={`Savol #${id} — video dars`} izoh="AI yechimdan doskadagi yozuv, chizma va o'qituvchi ovozi bilan dars yaratadi" onYop={yop} kenglik="max-w-3xl" pastki={pastki}>
      {!h ? (xato ? <p className="py-6 text-center text-[13px] text-xato">{xato}</p> : <Yuklanmoqda />) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {dars && (
              <>
                {dars.status === 'tasdiqlangan' ? <Yorliq rang="yaxshi">tasdiqlangan</Yorliq> : <span title="O'quvchilar faqat tasdiqlangan darsni ko'radi"><Yorliq rang="ogoh">tasdiqlanmagan</Yorliq></span>}
                <Yorliq rang={dars.ovoz ? 'brand' : 'kulrang'}>{dars.ovoz ? 'ovozli' : 'ovozsiz'}</Yorliq>
              </>
            )}
            {band === 'ai' && <span role="status" className="inline-flex items-center gap-1.5 text-[12px] text-matn-sokin"><Loader2 size={13} className="animate-spin" />1/2 · AI dars va chizmani tayyorlamoqda… odatda 15–40 soniya</span>}
            {band === 'ovoz' && <span role="status" className="inline-flex items-center gap-1.5 text-[12px] text-matn-sokin"><Loader2 size={13} className="animate-spin" />2/2 · Ovoz yozilmoqda… odatda 10–40 soniya</span>}
          </div>

          {dars?.eskirgan && (
            <p role="alert" className={`${XABAR} border-xato-chiziq bg-xato-fon`}>
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-xato" />
              <span>Yechim o'zgargan — bu dars eski yechimdan yaratilgan va o'quvchilarga ko'rsatilmaydi. Darsni qayta yarating.</span>
            </p>
          )}
          {dars && ogohlar.map(o => (
            <p key={o} role="alert" className={`${XABAR} border-ogoh/25 bg-ogoh-fon`}><AlertTriangle size={15} className="shrink-0 mt-0.5 text-ogoh" /><span>{o}</span></p>
          ))}

          {dars ? <DarsPleer key={versiya} dars={dars} /> : (
            <BoshHolat ikonka={<Clapperboard size={22} />} sarlavha="Bu savolning video darsi hali yo'q"
              izoh={h.yechimBor
                ? "Bitta bosishda AI savolning yechimidan video dars yaratadi: doskada qadam-baqadam yozuv, kerak bo'lsa chizma (o'qlar, grafik, shakl, jism) yoki savol rasmi va o'qituvchi ovozi. Ko'rib tasdiqlaysiz — o'quvchi natijadan keyin masala qanday yechilishini ko'radi va eshitadi."
                : "Video dars savolning tayyor yechimidan yaratiladi. Avval «Yechimni o'zgartirish» orqali yechim yozdiring."} />
          )}

          {dars && !dars.ovoz && band !== 'ovoz' && <p className="text-[11.5px] text-matn-xira">Ovoz yozilmagan — dars hozircha subtitr bilan o'ynaydi. «Ovoz yozdirish»ni bosing.</p>}
          {dars && dars.status === 'tasdiqlangan' && !h.yechimTasdiqlangan && (
            <p className="text-[12px] text-ogoh">Savolning yechimi tasdiqlanmagan — o'quvchilar darsni yechim ham tasdiqlangandan keyin ko'radi.</p>
          )}

          {tahrir && h.yechimBor && (
            <section aria-label="Dars qanday bo'lishi kerak" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="dars-talabi" className="block text-[13px] font-bold text-matn">{dars ? "Boshqacha bo'lsinmi? Dars qanday bo'lishi kerak?" : "Dars qanday bo'lishi kerak?"}</label>
                <MikrofonTugma disabled={!!band || aiYoq} onMatn={t => setMatn(m => `${m.trim() ? `${m.trim()} ` : ''}${t}`.slice(0, KORSATMA_MAX))} />
              </div>
              <textarea id="dars-talabi" rows={2} maxLength={KORSATMA_MAX} value={matn} onChange={e => setMatn(e.target.value)} disabled={!!band}
                placeholder="Ixtiyoriy: qisqaroq, soddaroq tilda, chizma bilan, 7-sinf o'quvchisi uchun…"
                className="w-full px-3 py-2.5 bg-ichki border border-chiziq rounded-xl text-[13px] text-matn focus:border-brand placeholder:text-matn-xira resize-y" style={{ outline: 'none' }} />
              <p className="text-[11.5px] text-matn-xira">Darsni AI yaratadi (yechimni o'zgartirmaydi — faqat tushuntiradi) va ovozini yozadi; siz ko'rib, tasdiqlaysiz. Har yaratish taxminan 1–4 sent turadi.</p>
            </section>
          )}
          {tahrir && aiYoq && <p className="text-[12px] text-ogoh">{AI_SOZLANMAGAN}</p>}
        </>
      )}
    </Oyna>
  );
}
