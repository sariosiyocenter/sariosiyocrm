import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Languages, Loader2, MinusCircle, RefreshCw, Square } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { useAiHolat, AI_SOZLANMAGAN } from '../useAiHolat';
import { Tanlov, Tugma } from '../ui';
import { idlarniChekla, navbatBilanBajar, TARJIMA_KOP_MAX, TARJIMA_PARALLEL, TARJIMA_TILLARI, tarjimaXatoTuri, tilNomi } from '../../../../lib/tarjimaKop.js';
import { Oyna } from './BankOynalari';
import { xatoMatni } from './aiUmumiy';

// Tanlangan savollarni ommaviy tarjima qilish (egasi, 2026-10-15: "savollarni tarjima qilish imkoniyati
// ham qo'shgin"): til tanlanadi, har savol alohida POST questions/:id/ai/tarjima bilan (bir vaqtda 2 tadan)
// tarjima qilinadi va QORALAMA savol bo'lib bankka yoziladi (asl savol o'zgarmaydi). Har savolning holati
// alohida ko'rinadi; «To'xtatish» yangilarini boshlamaydi. Guruhli savol va shu tildagi savol server
// tomonidan AI ishlatilmay rad etiladi — «o'tkazildi» deb belgilanadi. Limit (429) yoki AI kaliti yo'q
// (503) bo'lsa — qolganlari ham o'tmaydi, to'xtaydi.

type Holat = 'kutmoqda' | 'bajarilmoqda' | 'tayyor' | 'otkazildi' | 'xato';
interface Qator { id: number; holat: Holat; yangiId?: number; xabar?: string }

const HOLAT_NOMI: Record<Holat, string> = { kutmoqda: 'kutmoqda', bajarilmoqda: 'tarjima qilinmoqda…', tayyor: 'qoralama saqlandi', otkazildi: "o'tkazildi", xato: 'xato' };

const boshQatorlar = (ids: number[]): Qator[] => ids.map(id => ({ id, holat: 'kutmoqda' }));

export default function TarjimaKop({ ids, onYop, onTayyor }: {
  /** Tarjima qilinadigan savollar id si. */
  ids: number[];
  onYop: () => void;
  /** Tarjimalar qoralama savol bo'lib saqlangach (ro'yxat yangilansin). */
  onTayyor: () => void;
}) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const ai = useAiHolat();
  const { olingan, ortiqcha } = idlarniChekla(ids, TARJIMA_KOP_MAX);
  const [til, setTil] = useState<string>('ru');
  const [qatorlar, setQatorlar] = useState<Qator[]>(() => boshQatorlar(olingan));
  const [yugurmoqda, setYugurmoqda] = useState(false);
  // Hech bo'lmasa bir marta yugurilganmi (natija ro'yxati va xulosa shundan keyin).
  const [yurilgan, setYurilgan] = useState(false);
  const [toxtatilgan, setToxtatilgan] = useState(false);
  const [sabab, setSabab] = useState<string | null>(null);
  const toxta = useRef(false);
  const ochiq = useRef(true);
  useEffect(() => { ochiq.current = true; return () => { ochiq.current = false; toxta.current = true; }; }, []);

  const aiYoq = !!ai && !ai.yoqilgan;
  const qoy = (id: number, p: Partial<Qator>) => { if (ochiq.current) setQatorlar(l => l.map(q => (q.id === id ? { ...q, ...p } : q))); };
  const soni = (h: Holat) => qatorlar.filter(q => q.holat === h).length;

  /** Berilgan savollarni navbat bilan tarjima qiladi. */
  const ishlat = async (royxat: number[]) => {
    if (yugurmoqda || !royxat.length) return;
    toxta.current = false;
    setToxtatilgan(false);
    setSabab(null);
    setYugurmoqda(true);
    setYurilgan(true);
    let saqlandi = 0;
    await navbatBilanBajar(royxat, async (id: number) => {
      qoy(id, { holat: 'bajarilmoqda', xabar: undefined });
      try {
        const r = await soro<{ id: number }>('POST', `questions/${id}/ai/tarjima`, { til });
        saqlandi++;
        qoy(id, { holat: 'tayyor', yangiId: r.id });
      } catch (e: unknown) {
        const tur = tarjimaXatoTuri(typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status: unknown }).status) : 0);
        qoy(id, { holat: tur === 'otkazildi' ? 'otkazildi' : 'xato', xabar: xatoMatni(e) });
        // Limit yoki AI kaliti — qolgan savollar ham o'tmaydi.
        if (tur === 'toxta') { toxta.current = true; if (ochiq.current) setSabab(xatoMatni(e)); }
      }
    }, { parallel: TARJIMA_PARALLEL, toxta: () => toxta.current });
    if (!ochiq.current) { if (saqlandi) onTayyor(); return; }
    // Boshlanmay qolganlari «kutmoqda» bo'lib turadi.
    setToxtatilgan(toxta.current);
    setYugurmoqda(false);
    if (saqlandi) {
      showNotification(`${saqlandi} ta tarjima ${tilNomi(til).toLowerCase()} qoralama savol bo'lib saqlandi — bankda ko'rib chiqib, faol qilasiz`, 'success');
      onTayyor();
    }
  };

  const boshidan = () => { setQatorlar(boshQatorlar(olingan)); setYurilgan(false); setToxtatilgan(false); setSabab(null); };
  const yop = () => { if (!yugurmoqda) onYop(); };
  const kutayotgan = qatorlar.filter(q => q.holat === 'kutmoqda' || q.holat === 'xato').map(q => q.id);
  const tugadi = yurilgan && !yugurmoqda;

  const pastki = yugurmoqda ? (
    <>
      <span className="text-[12px] text-matn-xira">Oyna yopilmaydi: AI so'rovlari tugashini kuting yoki to'xtating</span>
      <Tugma ikonka={<Square size={13} />} disabled={toxtatilgan} onClick={() => { toxta.current = true; setToxtatilgan(true); }}>To'xtatish</Tugma>
    </>
  ) : tugadi ? (
    <>
      <Tugma onClick={yop}>Yopish</Tugma>
      <div className="flex flex-wrap justify-end gap-2">
        {soni('xato') + soni('kutmoqda') > 0 && !aiYoq && <Tugma ikonka={<RefreshCw size={14} />} onClick={() => ishlat(kutayotgan)}>Qolganlarini qayta urinish</Tugma>}
        <Tugma turi="asosiy" onClick={boshidan}>Boshqa tilga tarjima qilish</Tugma>
      </div>
    </>
  ) : (
    <>
      <Tugma onClick={yop}>Yopish</Tugma>
      <Tugma turi="asosiy" ikonka={<Languages size={14} />} disabled={!ai?.yoqilgan || !olingan.length} title={aiYoq ? AI_SOZLANMAGAN : undefined} onClick={() => ishlat(olingan)}>
        {olingan.length} ta savolni {tilNomi(til).toLowerCase()}ga tarjima qilish
      </Tugma>
    </>
  );

  return (
    <Oyna sarlavha={`Tarjima qilish — ${olingan.length} ta savol`} izoh="AI har savolni tanlangan tilga o'giradi va qoralama savol qilib saqlaydi; asl savollarga tegilmaydi" onYop={yop} kenglik="max-w-xl" pastki={pastki}>
      {aiYoq && <p className="rounded-xl bg-ogoh-fon border border-ogoh/25 px-3 py-2 text-[12.5px] text-matn">{AI_SOZLANMAGAN}</p>}
      {ortiqcha > 0 && (
        <p className="rounded-xl bg-ogoh-fon border border-ogoh/25 px-3 py-2 text-[12.5px] text-matn">{ids.length} ta savol belgilangan — bir martada birinchi {olingan.length} tasi tarjima qilinadi.</p>
      )}

      {!yurilgan && (
        <div>
          <p className="mb-1 text-[12px] font-semibold text-matn-sokin">Qaysi tilga</p>
          <Tanlov qiymat={til} onChange={setTil} variantlar={TARJIMA_TILLARI.map((t: { v: string; nom: string }) => ({ v: t.v, nom: t.nom }))} />
          <p className="mt-2 text-[11.5px] text-matn-xira">
            Har savol alohida AI so'rovi (bir vaqtda {TARJIMA_PARALLEL} tadan); shu tildagi savol va guruhli savollar (MS-33-35, MS-36-45) o'tkazib yuboriladi.
            Yechimi bo'lsa — u ham tarjima qilinadi (qoralama). Soatiga taxminan 120 ta AI so'rovi mumkin.
          </p>
        </div>
      )}

      {yurilgan && (
        <>
          <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-matn-sokin">
            {yugurmoqda && <Loader2 size={14} className="animate-spin" />}
            <span><b className="text-matn">{tilNomi(til)}</b>: {soni('tayyor')} ta saqlandi</span>
            {soni('otkazildi') > 0 && <span>{soni('otkazildi')} ta o'tkazildi</span>}
            {soni('xato') > 0 && <span className="text-xato">{soni('xato')} ta xato</span>}
            {soni('kutmoqda') + soni('bajarilmoqda') > 0 && <span>{soni('kutmoqda') + soni('bajarilmoqda')} ta {tugadi ? "boshlanmadi" : 'qoldi'}</span>}
            {toxtatilgan && <span className="font-semibold text-ogoh">{yugurmoqda ? "to'xtatilmoqda…" : "to'xtatildi"}</span>}
          </p>
          {sabab && <p role="alert" className="flex items-start gap-2 rounded-xl border border-xato-chiziq bg-xato-fon px-3 py-2 text-[12.5px] text-matn"><AlertTriangle size={15} className="shrink-0 mt-0.5 text-xato" /><span>{sabab}</span></p>}
          <ul className="space-y-1">
            {qatorlar.map(q => (
              <li key={q.id} className="flex items-start gap-2 rounded-lg border border-chiziq px-2.5 py-1.5 text-[12.5px]">
                <span className="mt-0.5 shrink-0">
                  {q.holat === 'tayyor' ? <CheckCircle2 size={14} className="text-yaxshi" />
                    : q.holat === 'bajarilmoqda' ? <Loader2 size={14} className="animate-spin text-brand" />
                    : q.holat === 'xato' ? <AlertTriangle size={14} className="text-xato" />
                    : <MinusCircle size={14} className="text-matn-xira" />}
                </span>
                <span className="raqam font-semibold text-matn">#{q.id}</span>
                <span className="min-w-0 flex-1 text-matn-sokin">
                  {q.holat === 'tayyor' ? `${HOLAT_NOMI.tayyor} — yangi savol #${q.yangiId}`
                    : q.xabar ? <span className={q.holat === 'xato' ? 'text-xato' : ''}>{q.xabar}</span>
                    : HOLAT_NOMI[q.holat]}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Oyna>
  );
}
