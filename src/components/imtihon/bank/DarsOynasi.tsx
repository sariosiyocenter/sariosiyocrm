import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clapperboard, Loader2, Mic, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { useAiHolat, AI_SOZLANMAGAN } from '../useAiHolat';
import { BoshHolat, Tugma, Yorliq, Yuklanmoqda } from '../ui';
import { Oyna } from './BankOynalari';
import DarsPleer from '../dars/DarsPleer';
import type { DarsHolati, DarsTaklifi } from '../dars/darsTurlari';

// Savolning video darsi oynasi (egasi, 2026-10-13): o'quvchi natijadan keyin masala qanday
// yechilishini ko'radi va eshitadi. Dars savolning tayyor yechimidan tuziladi: AI uni doska
// qadamlari va o'qituvchi nutqiga aylantiradi (ssenariy) → ustoz ko'rib saqlaydi → ovoz yoziladi →
// ustoz tinglab tasdiqlaydi. Yechimdagidek: bu matn muharriri emas — ustoz dars qanday bo'lishini
// aytadi, AI qayta tuzadi; «Saqlash» bosilmaguncha bazaga hech narsa yozilmaydi.

type Band = 'ai' | 'saqla' | 'ovoz' | 'holat' | 'ochir';
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
  // AI tuzgan, hali saqlanmagan ssenariy va u qaysi talab bilan tuzilgani.
  const [taklif, setTaklif] = useState<(DarsTaklifi & { talab: string }) | null>(null);
  const [matn, setMatn] = useState('');
  const [band, setBand] = useState<Band | null>(null);
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
      if (ochiq.current) showNotification(e?.status === 504 ? "Server javob berishga ulgurmadi — qayta urinib ko'ring" : `${xatoOldi}${e.message}`, 'error');
      return false;
    } finally {
      if (ochiq.current) setBand(null);
    }
  };

  const tuz = () => bajar('ai', async () => {
    const r = await soro<DarsTaklifi>('POST', `questions/${id}/dars/ai`, { korsatma: talab });
    if (!ochiq.current) return;
    setTaklif({ ...r, talab });
    setVersiya(v => v + 1);
  });

  const ovozYoz = () => bajar('ovoz', async () => {
    const r = await soro<DarsHolati>('POST', `questions/${id}/dars/ovoz`);
    if (!ochiq.current) return;
    yangila(r);
    showNotification('Ovoz yozildi — darsni tinglab, tasdiqlang', 'success');
  }, 'Ovoz yozilmadi: ');

  const saqla = async () => {
    if (!taklif || band) return;
    const saqlandi = await bajar('saqla', async () => {
      const r = await soro<DarsHolati>('PUT', `questions/${id}/dars`, { qadamlar: taklif.qadamlar, korsatma: taklif.talab || undefined });
      if (!ochiq.current) return;
      yangila(r);
      setTaklif(null);
      setMatn('');
    });
    // Ovoz — alohida so'rov: sekin, va yozilmasa ham dars saqlangan qoladi (keyin qayta yozdirsa bo'ladi).
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
      showNotification("Video dars o'chirildi", 'success');
    });
  };

  /** AI tuzgan, lekin saqlanmagan dars tasodifan yo'qolmasin: tashlashdan oldin so'raladi. */
  const tashlansinmi = async (tugma: string) => !taklif
    || !!(await confirm({ title: 'Yangi dars saqlanmadi', message: "AI tuzgan dars yo'qoladi.", confirmLabel: tugma, danger: false }));
  const yop = async () => {
    // Saqlanayotgan yoki ovoz yozilayotgan paytda yopilmaydi: so'rov baribir tugaydi.
    if (band && band !== 'ai') return;
    if (await tashlansinmi('Yopish')) onYop();
  };
  const taklifniTashla = async () => { if (await tashlansinmi('Tashlash')) { setTaklif(null); setVersiya(v => v + 1); } };

  const aiTugma = (nom: string, turi: 'asosiy' | 'ikkinchi', ikonka: React.ReactNode) => (
    <Tugma turi={turi} ikonka={ikonka} yuklanmoqda={band === 'ai'} disabled={!ai || aiYoq || !!band}
      title={aiYoq ? AI_SOZLANMAGAN : "AI yechimni video dars ssenariysiga aylantiradi — siz ko'rib, saqlaysiz"} onClick={tuz}>{nom}</Tugma>
  );

  const pastki = !h || !tahrir || !h.yechimBor ? <><span /><Tugma onClick={yop}>Yopish</Tugma></>
    : taklif ? (
      <>
        <Tugma disabled={!!band} onClick={taklifniTashla}>Bekor qilish</Tugma>
        <div className="flex flex-wrap justify-end gap-2">
          {aiTugma('Qayta tuzish', 'ikkinchi', <RefreshCw size={14} />)}
          <Tugma turi="asosiy" ikonka={<Mic size={14} />} yuklanmoqda={band === 'saqla' || band === 'ovoz'} disabled={!!band} onClick={saqla}>Saqlash va ovoz yozdirish</Tugma>
        </div>
      </>
    ) : dars ? (
      <>
        <Tugma turi="oddiy" ikonka={<Trash2 size={14} />} yuklanmoqda={band === 'ochir'} disabled={!!band} onClick={ochir}>O'chirish</Tugma>
        <div className="flex flex-wrap justify-end gap-2">
          {aiTugma('Qayta tuzish', 'ikkinchi', <RefreshCw size={14} />)}
          {!dars.ovoz && <Tugma ikonka={<Mic size={14} />} yuklanmoqda={band === 'ovoz'} disabled={!ai || aiYoq || !!band} title={aiYoq ? AI_SOZLANMAGAN : undefined} onClick={ovozYoz}>Ovoz yozdirish</Tugma>}
          {dars.status === 'tasdiqlangan'
            ? <Tugma turi="oddiy" yuklanmoqda={band === 'holat'} disabled={!!band} onClick={() => holatQoy('qoralama')} title="O'quvchilar bu darsni ko'rmaydigan bo'ladi">Tasdiqni olish</Tugma>
            : <Tugma turi="asosiy" ikonka={<CheckCircle2 size={14} />} yuklanmoqda={band === 'holat'} disabled={!!band || dars.eskirgan} onClick={() => holatQoy('tasdiqlangan')}
                title={dars.eskirgan ? "Yechim o'zgargan — avval darsni qayta tuzing" : "Tasdiqlangan darsni o'quvchilar natijadan keyin ko'radi"}>Tasdiqlash</Tugma>}
        </div>
      </>
    ) : (
      <><Tugma disabled={!!band} onClick={yop}>Yopish</Tugma>{aiTugma('AI dars tuzsin', 'asosiy', <Sparkles size={14} />)}</>
    );

  const korinadigan = taklif ? { qadamlar: taklif.qadamlar, davomiylik: taklif.davomiylik, ovoz: null } : dars;

  return (
    <Oyna sarlavha={`Savol #${id} — video dars`} izoh="AI yechimni doska qadamlari va o'qituvchi ovoziga aylantiradi" onYop={yop} kenglik="max-w-2xl" pastki={pastki}>
      {!h ? (xato ? <p className="py-6 text-center text-[13px] text-xato">{xato}</p> : <Yuklanmoqda />) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {taklif ? <><Yorliq rang="ogoh">hali saqlanmagan</Yorliq>{dars && <span className="text-[11.5px] text-matn-xira">saqlansa — hozirgi dars o'rniga yoziladi</span>}</>
              : dars ? (
                <>
                  {dars.status === 'tasdiqlangan' ? <Yorliq rang="yaxshi">tasdiqlangan</Yorliq> : <span title="O'quvchilar faqat tasdiqlangan darsni ko'radi"><Yorliq rang="ogoh">tasdiqlanmagan</Yorliq></span>}
                  <Yorliq rang={dars.ovoz ? 'brand' : 'kulrang'}>{dars.ovoz ? 'ovozli' : 'ovozsiz'}</Yorliq>
                </>
              ) : null}
            {band === 'ai' && <span role="status" className="inline-flex items-center gap-1.5 text-[12px] text-matn-sokin"><Loader2 size={13} className="animate-spin" />AI dars tuzmoqda… odatda 10–30 soniya</span>}
            {band === 'ovoz' && <span role="status" className="inline-flex items-center gap-1.5 text-[12px] text-matn-sokin"><Loader2 size={13} className="animate-spin" />Ovoz yozilmoqda… odatda 10–40 soniya</span>}
          </div>

          {dars?.eskirgan && !taklif && (
            <p role="alert" className={`${XABAR} border-xato-chiziq bg-xato-fon`}>
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-xato" />
              <span>Yechim o'zgargan — bu dars eski yechimdan tuzilgan va o'quvchilarga ko'rsatilmaydi. Darsni qayta tuzing.</span>
            </p>
          )}
          {taklif?.ogohlar.map(o => (
            <p key={o} role="alert" className={`${XABAR} border-ogoh/25 bg-ogoh-fon`}><AlertTriangle size={15} className="shrink-0 mt-0.5 text-ogoh" /><span>{o}</span></p>
          ))}

          {korinadigan ? <DarsPleer key={versiya} dars={korinadigan} /> : (
            <BoshHolat ikonka={<Clapperboard size={22} />} sarlavha="Bu savolning video darsi hali yo'q"
              izoh={h.yechimBor
                ? "AI savolning yechimini doskada yoziladigan qadamlarga va o'qituvchi nutqiga aylantiradi. Ko'rib chiqib saqlaysiz — o'quvchi natijadan keyin masala qanday yechilishini ko'radi va eshitadi."
                : "Video dars savolning tayyor yechimidan tuziladi. Avval «Yechimni o'zgartirish» orqali yechim yozdiring."} />
          )}

          {taklif && <p className="text-[11.5px] text-matn-xira">Ovoz saqlagandan keyin yoziladi — hozircha dars subtitr bilan, taxminiy vaqtda o'ynaydi.</p>}
          {dars && !taklif && dars.status === 'tasdiqlangan' && !h.yechimTasdiqlangan && (
            <p className="text-[12px] text-ogoh">Savolning yechimi tasdiqlanmagan — o'quvchilar darsni yechim ham tasdiqlangandan keyin ko'radi.</p>
          )}

          {tahrir && h.yechimBor && (
            <section aria-label="Dars qanday bo'lishi kerak" className="space-y-2">
              <label htmlFor="dars-talabi" className="block text-[13px] font-bold text-matn">{korinadigan ? "Boshqacha bo'lsinmi? Dars qanday bo'lishi kerak?" : "Dars qanday bo'lishi kerak?"}</label>
              <textarea id="dars-talabi" rows={2} maxLength={KORSATMA_MAX} value={matn} onChange={e => setMatn(e.target.value)} disabled={band === 'ai'}
                placeholder="Ixtiyoriy: qisqaroq, soddaroq tilda, har qadamni batafsil, 7-sinf o'quvchisi uchun…"
                className="w-full px-3 py-2.5 bg-ichki border border-chiziq rounded-xl text-[13px] text-matn focus:border-brand placeholder:text-matn-xira resize-y" style={{ outline: 'none' }} />
              <p className="text-[11.5px] text-matn-xira">Darsni AI tuzadi (yechimni o'zgartirmaydi — faqat tushuntiradi); siz ko'rib, saqlaysiz va tasdiqlaysiz.</p>
            </section>
          )}
          {tahrir && aiYoq && <p className="text-[12px] text-ogoh">{AI_SOZLANMAGAN}</p>}
        </>
      )}
    </Oyna>
  );
}
