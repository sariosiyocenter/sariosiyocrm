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
import { bosqichMatni, natijaXabari } from '../../../../lib/yechimVideo.js';
import { videoYarat, xatoSababi, yechimniYozVaSaqla, type Bosqich, type YechimNatijasi, type YechimHolati } from './yechimVideo';
import type { DarsHolati } from '../dars/darsTurlari';

// Savolning video yechimi oynasi (egasi, 2026-10-13): o'quvchi natijadan keyin masala qanday
// yechilishini ko'radi va eshitadi. Video yechim savolning tayyor yechimidan tuziladi. Bitta tugma
// (egasi, 2026-10-14: "video + ovozni bittada"): AI ssenariy va chizma yozadi → video yechim qoralama
// bo'lib saqlanadi → ovoz yoziladi; ustoz tayyor, ovozli video yechimni ko'rib tasdiqlaydi.
// Egasi, 2026-10-15: "yechim + videoni bitta qilib yaratish" — yechimi yo'q savolda (yoki ustoz «Yechimni ham
// qayta yozsin» desa) shu bitta tugma avval yechimni yozib saqlaydi, so'ng undan video yechim tuzadi
// (lib/yechimVideo.js, ./yechimVideo.ts). Ko'rsatma maydoni bitta — ikkalasiga ham beriladi.
// Yechimdagidek: bu matn muharriri emas — ustoz qanday bo'lishini aytadi, AI qayta yaratadi.

type Band = 'yechim' | 'ai' | 'ovoz' | 'holat' | 'ochir' | 'tasdiq';
const KORSATMA_MAX = 600;
const XABAR = 'flex items-start gap-2 rounded-xl border px-3 py-2 text-[12.5px] text-matn';
/** Jarayon bosqichi (band) → bosqich nomi. */
const BAND_BOSQICHI: Partial<Record<Band, Bosqich>> = { yechim: 'yechim', ai: 'video', ovoz: 'ovoz' };

export default function DarsOynasi({ id, onYop, onSaqlandi }: {
  id: number; onYop: () => void;
  /** Yechim ham shu oynada yozildi yoki tasdiqlandi — ro'yxatdagi yechim belgisi yangilanadi. */
  onSaqlandi?: (id: number, natija: YechimNatijasi) => void;
}) {
  const { ozgartira, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.savollar');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const ai = useAiHolat();
  const [h, setH] = useState<DarsHolati | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [matn, setMatn] = useState('');
  const [band, setBand] = useState<Band | null>(null);
  // Yechimi bor savolda: yechim ham AI dan qayta yozdirilsinmi (yo'q bo'lsa — har doim yoziladi).
  const [yechimHam, setYechimHam] = useState(false);
  // Shu safar yechim ham yozilmoqdami (jarayon qatoridagi "1/3" hisobi uchun).
  const [birga, setBirga] = useState(false);
  // AI ning shu safar yaratgan video yechimiga ogohlantirishlari (harf, formula belgisi…) — video tagida turadi.
  const [ogohlar, setOgohlar] = useState<string[]>([]);
  // Video yechim almashganda pleer boshidan boshlanadi.
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
  /** Bu safar yechim ham yoziladimi: yechimi yo'q savolda — albatta, bor savolda — ustoz xohlasa. */
  const yechimYoziladi = !!h && (!h.yechimBor || yechimHam);
  const yangila = (r: DarsHolati) => { setH(r); setVersiya(v => v + 1); };

  /** Amalni bajaradi: band holati, xato xabari va oyna yopilgan bo'lsa natijani tashlash — bir joyda. */
  const bajar = async (nima: Band, ish: () => Promise<void>, xatoOldi: string | (() => string) = ''): Promise<boolean> => {
    setBand(nima);
    try {
      await ish();
      return true;
    } catch (e: any) {
      const oldi = typeof xatoOldi === 'function' ? xatoOldi() : xatoOldi;
      if (ochiq.current) showNotification(`${oldi}${xatoSababi(e)}`, 'error');
      return false;
    } finally {
      if (ochiq.current) setBand(null);
    }
  };

  const ovozYoz = () => bajar('ovoz', async () => {
    const r = await soro<DarsHolati>('POST', `questions/${id}/dars/ovoz`);
    if (!ochiq.current) return;
    yangila(r);
    showNotification("Video yechim tayyor — ko'rib, tasdiqlang", 'success');
  }, 'Video yechim saqlandi, lekin ovoz yozilmadi: ');

  /** Holatni serverdan qayta o'qiydi (bosqichlardan biri yarmida to'xtaganda: yechim yangilangan bo'lishi mumkin). */
  const qaytaOqi = () => soro<DarsHolati>('GET', `questions/${id}/dars`).then(r => { if (ochiq.current) setH(r); }).catch(() => undefined);

  /**
   * Bitta bosishda: [yechim yozish va saqlash →] ssenariy va chizma → saqlash (qoralama) → ovoz.
   * Yechim ishonchsiz chiqsa (javobi bankdagiga mos emas, rasm ko'rinmadi) — hech narsa saqlanmaydi.
   */
  const yarat = async () => {
    if (band || !h) return;
    const yechimBilan = yechimYoziladi;
    const almashadi = [
      yechimBilan && h.yechimBor ? "Hozirgi yechim AI yozgani bilan almashtiriladi (yangisi tasdiqlanmagan bo'lishi mumkin)." : '',
      dars ? (dars.status === 'tasdiqlangan' ? "Hozirgi tasdiqlangan video yechim yangisi bilan almashtiriladi; yangisi tasdiqlanguncha o'quvchilar uni ko'rmaydi." : 'Hozirgi video yechim yangisi bilan almashtiriladi.') : '',
    ].filter(Boolean).join(' ');
    if (almashadi && !(await confirm({
      title: yechimBilan && h.yechimBor ? 'Yechim va video yechim qayta yaratilsinmi?' : 'Video yechim qayta yaratilsinmi?',
      message: almashadi, confirmLabel: 'Qayta yaratish', danger: false,
    }))) return;
    setBirga(yechimBilan);
    const tirik = () => ochiq.current;
    let yozilgan: YechimHolati | null = null;
    let natija: Awaited<ReturnType<typeof videoYarat>> = null;
    let tekshirish = false;
    const tayyor = await bajar(yechimBilan ? 'yechim' : 'ai', async () => {
      if (yechimBilan) {
        const y = await yechimniYozVaSaqla(soro, id, { korsatma: talab, tirik });
        if (!y) return;
        if (!y.saqlandi) { tekshirish = true; return; }
        yozilgan = y.javob.solutionStatus;
        // Yechim yangilandi: eski video yechim endi eskirgan, yangisi tuzilguncha shunday ko'rinadi.
        setH(x => x && { ...x, yechimBor: true, yechimTasdiqlangan: y.javob.solutionStatus === 'tasdiqlangan', dars: x.dars ? { ...x.dars, eskirgan: true } : null });
        onSaqlandi?.(id, { yechimBor: y.javob.yechimBor, solutionStatus: y.javob.solutionStatus });
      }
      natija = await videoYarat(soro, id, {
        korsatma: talab, ovozYoz: !!ai?.yoqilgan, tirik,
        onBosqich: b => { if (ochiq.current) setBand(b === 'ovoz' ? 'ovoz' : 'ai'); },
      });
    }, () => (yozilgan ? 'Yechim saqlandi, lekin video yechim yaratilmadi: ' : ''));
    if (!ochiq.current) return;
    if (tekshirish) {
      showNotification("AI yechimi bankdagi javobga mos kelmadi yoki rasm ko'rinmadi — yechim ham, video yechim ham saqlanmadi. «Yechim» oynasida tekshirib, yechimni o'zingiz saqlang", 'error');
      return;
    }
    if (!tayyor) { if (yozilgan) await qaytaOqi(); return; }
    const n = natija as Awaited<ReturnType<typeof videoYarat>>;
    if (!n) return;
    yangila(n.holat);
    setOgohlar(n.ogohlar);
    setMatn('');
    setYechimHam(false);
    const x = natijaXabari({ yechimYozildi: !!yozilgan, yechimTasdiq: yozilgan === 'tasdiqlangan', ovoz: !!n.holat.dars?.ovoz, ovozXato: n.ovozXato });
    showNotification(x.matn, x.turi as 'success' | 'info');
  };

  const holatQoy = (status: 'qoralama' | 'tasdiqlangan') => bajar('holat', async () => {
    const r = await soro<DarsHolati>('PUT', `questions/${id}/dars`, { status });
    if (!ochiq.current) return;
    setH(r);
    showNotification(status === 'tasdiqlangan' ? "Video yechim tasdiqlandi — o'quvchilar natijadan keyin ko'radi" : "Tasdiq olindi — o'quvchilar ko'rmaydi", 'success');
  });

  /** Yechimni shu oynaning o'zida tasdiqlash: video yechim uning mazmunini to'liq ko'rsatadi, ustoz uni ko'rib chiqqan. */
  const yechimniTasdiqla = () => bajar('tasdiq', async () => {
    const r = await soro<{ solution: string | null; solutionStatus: YechimHolati; yechimBor: boolean }>('PUT', `questions/${id}/yechim`, { solutionStatus: 'tasdiqlangan' });
    if (!ochiq.current) return;
    setH(x => x && { ...x, yechimTasdiqlangan: r.solutionStatus === 'tasdiqlangan' });
    onSaqlandi?.(id, { yechimBor: r.yechimBor, solutionStatus: r.solutionStatus });
    showNotification("Yechim tasdiqlandi — o'quvchilar natijadan keyin ko'radi", 'success');
  });

  const ochir = async () => {
    if (!(await confirm({ title: "Video yechim o'chirilsinmi?", message: "Video yechim va uning ovozi o'chadi. Savol va yechimga tegilmaydi.", confirmLabel: "O'chirish" }))) return;
    await bajar('ochir', async () => {
      const r = await soro<DarsHolati>('DELETE', `questions/${id}/dars`);
      if (!ochiq.current) return;
      yangila(r);
      setOgohlar([]);
      showNotification("Video yechim o'chirildi", 'success');
    });
  };

  // Yaratilayotgan paytda yopilmaydi: AI ga to'langan so'rov yarmida tashlab ketilmasin.
  const yop = () => { if (!band) onYop(); };
  const yaratilmoqda = band === 'yechim' || band === 'ai' || band === 'ovoz';

  const yaratTugma = (turi: 'asosiy' | 'ikkinchi', ikonka: React.ReactNode) => {
    const qayta = !!dars;
    const nom = yechimYoziladi ? (qayta ? 'Yechim + video yechimni qayta yaratish' : 'Yechim + video yechim yaratish') : (qayta ? 'Qayta yaratish' : 'Video yechim yaratish');
    return (
      <Tugma turi={turi} ikonka={ikonka} yuklanmoqda={yaratilmoqda} disabled={!ai || aiYoq || !!band}
        title={aiYoq ? AI_SOZLANMAGAN : yechimYoziladi
          ? "AI yechimni yozib saqlaydi, so'ng undan video yechim yaratadi: doskadagi yozuv, chizma va ovoz — siz ko'rib, tasdiqlaysiz"
          : "AI yechimdan video yechim yaratadi: doskadagi yozuv, chizma va ovoz — siz ko'rib, tasdiqlaysiz"} onClick={yarat}>{nom}</Tugma>
    );
  };

  const pastki = !h || !tahrir ? <><span /><Tugma onClick={yop}>Yopish</Tugma></>
    : dars ? (
      <>
        <Tugma turi="oddiy" ikonka={<Trash2 size={14} />} yuklanmoqda={band === 'ochir'} disabled={!!band} onClick={ochir}>O'chirish</Tugma>
        <div className="flex flex-wrap justify-end gap-2">
          {yaratTugma('ikkinchi', <RefreshCw size={14} />)}
          {!dars.ovoz && band !== 'ovoz' && <Tugma ikonka={<Mic size={14} />} disabled={!ai || aiYoq || !!band} title={aiYoq ? AI_SOZLANMAGAN : undefined} onClick={ovozYoz}>Ovoz yozdirish</Tugma>}
          {dars.status === 'tasdiqlangan'
            ? <Tugma turi="oddiy" yuklanmoqda={band === 'holat'} disabled={!!band} onClick={() => holatQoy('qoralama')} title="O'quvchilar bu video yechimni ko'rmaydigan bo'ladi">Tasdiqni olish</Tugma>
            : <Tugma turi="asosiy" ikonka={<CheckCircle2 size={14} />} yuklanmoqda={band === 'holat'} disabled={!!band || dars.eskirgan} onClick={() => holatQoy('tasdiqlangan')}
                title={dars.eskirgan ? "Yechim o'zgargan — avval video yechimni qayta yarating" : "Tasdiqlangan video yechimni o'quvchilar natijadan keyin ko'radi"}>Tasdiqlash</Tugma>}
        </div>
      </>
    ) : (
      <><Tugma disabled={!!band} onClick={yop}>Yopish</Tugma>{yaratTugma('asosiy', <Sparkles size={14} />)}</>
    );

  const bosqich = band ? BAND_BOSQICHI[band] : undefined;

  return (
    <Oyna sarlavha={`Savol #${id} — video yechim`} izoh="AI yechimdan doskadagi yozuv, chizma va o'qituvchi ovozi bilan video yechim yaratadi (yechim yo'q bo'lsa — uni ham yozadi)" onYop={yop} kenglik="max-w-3xl" pastki={pastki}>
      {!h ? (xato ? <p className="py-6 text-center text-[13px] text-xato">{xato}</p> : <Yuklanmoqda />) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {dars && (
              <>
                {dars.status === 'tasdiqlangan' ? <Yorliq rang="yaxshi">tasdiqlangan</Yorliq> : <span title="O'quvchilar faqat tasdiqlangan video yechimni ko'radi"><Yorliq rang="ogoh">tasdiqlanmagan</Yorliq></span>}
                <Yorliq rang={dars.ovoz ? 'brand' : 'kulrang'}>{dars.ovoz ? 'ovozli' : 'ovozsiz'}</Yorliq>
              </>
            )}
            {h.yechimBor && <span title="O'quvchilar yechim ham tasdiqlangan bo'lsa video yechimni ko'radi"><Yorliq rang={h.yechimTasdiqlangan ? 'yaxshi' : 'ogoh'}>yechim {h.yechimTasdiqlangan ? 'tasdiqlangan' : 'tasdiqlanmagan'}</Yorliq></span>}
            {bosqich && <span role="status" className="inline-flex items-center gap-1.5 text-[12px] text-matn-sokin"><Loader2 size={13} className="animate-spin" />{bosqichMatni(bosqich, { yechim: birga, ovoz: !!ai?.yoqilgan })}</span>}
          </div>

          {dars?.eskirgan && (
            <p role="alert" className={`${XABAR} border-xato-chiziq bg-xato-fon`}>
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-xato" />
              <span>Yechim o'zgargan — bu video yechim eski yechimdan yaratilgan va o'quvchilarga ko'rsatilmaydi. Video yechimni qayta yarating.</span>
            </p>
          )}
          {dars && ogohlar.map(o => (
            <p key={o} role="alert" className={`${XABAR} border-ogoh/25 bg-ogoh-fon`}><AlertTriangle size={15} className="shrink-0 mt-0.5 text-ogoh" /><span>{o}</span></p>
          ))}

          {dars ? <DarsPleer key={versiya} dars={dars} /> : (
            <BoshHolat ikonka={<Clapperboard size={22} />} sarlavha="Bu savolning video yechimi hali yo'q"
              izoh={h.yechimBor
                ? "Bitta bosishda AI savolning yechimidan video yechim yaratadi: doskada qadam-baqadam yozuv, kerak bo'lsa chizma (o'qlar, grafik, shakl, jism) yoki savol rasmi va o'qituvchi ovozi. Ko'rib tasdiqlaysiz — o'quvchi natijadan keyin masala qanday yechilishini ko'radi va eshitadi."
                : "Bitta bosishda AI savolning yechimini ham, undan video yechimni ham yaratadi: avval yechim yoziladi va saqlanadi, so'ng doskadagi yozuv, chizma va ovoz. Ko'rib tasdiqlaysiz."} />
          )}

          {dars && !dars.ovoz && band !== 'ovoz' && <p className="text-[11.5px] text-matn-xira">Ovoz yozilmagan — video yechim hozircha subtitr bilan o'ynaydi. «Ovoz yozdirish»ni bosing.</p>}
          {dars && dars.status === 'tasdiqlangan' && !h.yechimTasdiqlangan && (
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-ogoh">
              <span>Savolning yechimi tasdiqlanmagan — o'quvchilar video yechimni yechim ham tasdiqlangandan keyin ko'radi.</span>
              {tahrir && <Tugma kichik ikonka={<CheckCircle2 size={13} />} yuklanmoqda={band === 'tasdiq'} disabled={!!band} onClick={yechimniTasdiqla}>Yechimni tasdiqlash</Tugma>}
            </div>
          )}

          {tahrir && (
            <section aria-label="Video yechim qanday bo'lishi kerak" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="dars-talabi" className="block text-[13px] font-bold text-matn">{dars ? "Boshqacha bo'lsinmi? Video yechim qanday bo'lishi kerak?" : "Video yechim qanday bo'lishi kerak?"}</label>
                <MikrofonTugma disabled={!!band || aiYoq} onMatn={t => setMatn(m => `${m.trim() ? `${m.trim()} ` : ''}${t}`.slice(0, KORSATMA_MAX))} />
              </div>
              <textarea id="dars-talabi" rows={2} maxLength={KORSATMA_MAX} value={matn} onChange={e => setMatn(e.target.value)} disabled={!!band}
                placeholder="Ixtiyoriy: qisqaroq, soddaroq tilda, chizma bilan, 7-sinf o'quvchisi uchun…"
                className="w-full px-3 py-2.5 bg-ichki border border-chiziq rounded-xl text-[13px] text-matn focus:border-brand placeholder:text-matn-xira resize-y" style={{ outline: 'none' }} />
              {h.yechimBor && (
                <label className="flex items-start gap-2 text-[12.5px] text-matn cursor-pointer select-none">
                  <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--color-brand)] cursor-pointer" checked={yechimHam} disabled={!!band} onChange={e => setYechimHam(e.target.checked)} />
                  <span><b>Yechimni ham AI qayta yozsin</b><span className="block text-[11.5px] text-matn-xira">Belgilanmasa — hozirgi yechim o'zgarmaydi, video yechim aynan undan yaratiladi. Belgilansa — bu ko'rsatma yechimga ham beriladi</span></span>
                </label>
              )}
              <p className="text-[11.5px] text-matn-xira">
                {yechimYoziladi ? "Yechimni ham, video yechimni ham AI yaratadi" : "Video yechimni AI yaratadi (yechimni o'zgartirmaydi — faqat tushuntiradi)"} va ovozini yozadi; siz ko'rib, tasdiqlaysiz. Har yaratish taxminan {yechimYoziladi ? '2–6' : '1–4'} sent turadi.
              </p>
            </section>
          )}
          {tahrir && aiYoq && <p className="text-[12px] text-ogoh">{AI_SOZLANMAGAN}</p>}
        </>
      )}
    </Oyna>
  );
}
