import React, { useState } from 'react';
import { X, Sparkles, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { useAiHolat } from '../useAiHolat';
import AiKalitKartasi from '../AiKalitKartasi';
import { Tugma, Tanlov, Yorliq, Maydon, INPUT, SELECT } from '../ui';
import { savolXatosi } from '../../../../lib/imtihon.js';
import { QiyinlikTanlov } from './qiyinlik';
import { fanniTop, mavzuniTop, bolimlarga } from './useBankDaraxt';
import { type AiSavol, type Tekshiruv, htmlMatnga, xatoMatni, Korinish } from './aiUmumiy';
import QoshRejimi, { type QoshRejim } from './QoshRejimi';
import type { BankDaraxt } from '../../../types';

// Mavzu bo'yicha AI savol tuzadi (egasi, 2026-10-06: "mavzuni aytaman, namuna bersam ham
// bermasam ham — shu mavzuga shuncha masala yoki misol tuzib bersin"). Ustoz fan va mavzuni
// tanlaydi, nima kerakligini o'z so'zi bilan yozadi (ixtiyoriy), xohlasa namuna beradi; AI
// tuzadi, keyin kalitni ko'rmay qayta yechib tekshiradi. Tekshiruvdan o'tgani — faol,
// o'tmagani — qoralama bo'lib tushadi.

/** Bitta so'rovda nechta savol tuziladi (server chegarasi). */
const BOLAK = 10;
const TEKSHIRUV_BOLAGI = 12;
type Tur = 'yopiq' | 'raqamli';
interface Yangi extends AiSavol { kalit: number; tanlangan: boolean; tekshiruv: Tekshiruv | null }

let keyingiKalit = 1;
const xatoHolati = (e: unknown) => (typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status: unknown }).status) : 0);

function Belgi({ n }: { n: Yangi }) {
  if (n.tekshiruv?.tekshirildi === true) return <Yorliq rang="yaxshi"><CheckCircle2 size={11} /> AI qayta yechdi — javob to'g'ri</Yorliq>;
  if (n.tekshiruv?.tekshirildi === false) return <Yorliq rang="ogoh"><AlertTriangle size={11} /> AI boshqa javob chiqardi{n.tekshiruv.aiJavobi ? ` (${n.tekshiruv.aiJavobi})` : ''} — tekshiring</Yorliq>;
  return <Yorliq>Tekshirilmadi — qoralama bo'lib tushadi</Yorliq>;
}

interface AiTuzishProps {
  daraxt: BankDaraxt;
  fanId?: number | null;
  mavzuId?: number | null;
  /** `mavzuId` ning nomi — mavzu hozirgina yaratilgan bo'lib, daraxtda hali ko'rinmasa. */
  mavzuNomi?: string;
  onRejim?: (rejim: QoshRejim) => void;
  onYop: () => void;
  /** Bankka qo'shilgan yangi savollar. */
  onSaqlandi: (ids: number[]) => void;
}

export default function AiTuzish({ daraxt, fanId: boshFan = null, mavzuId: boshMavzu = null, mavzuNomi: boshMavzuNomi, onRejim, onYop, onSaqlandi }: AiTuzishProps) {
  const { showNotification } = useCRM();
  const { soro, filial } = useImtihonApi();
  const ai = useAiHolat();

  const [fanId, setFanId] = useState<number | null>(() => boshFan ?? daraxt.fanlar.find(f => f.mavzular.some(m => m.id === boshMavzu))?.id ?? (daraxt.fanlar.length === 1 ? daraxt.fanlar[0].id : null));
  const [mavzuId, setMavzuId] = useState<number | null>(boshMavzu);
  const [yangiMavzu, setYangiMavzu] = useState<string | null>(null);
  const fan = fanniTop(daraxt, fanId);
  const mavzu = mavzuniTop(fan, mavzuId);
  const kutilgan = !mavzu && mavzuId != null && mavzuId === boshMavzu && boshMavzuNomi ? boshMavzuNomi : '';
  const mavzuNomi = yangiMavzu !== null ? yangiMavzu.trim() : mavzu?.name || kutilgan;

  const [tavsif, setTavsif] = useState('');
  const [namuna, setNamuna] = useState('');
  const [soni, setSoni] = useState<5 | 10 | 20>(10);
  const [tur, setTur] = useState<Tur>('yopiq');
  const [qiyinlik, setQiyinlik] = useState<number>(2);
  const [holat, setHolat] = useState<string | null>(null);
  const [natijalar, setNatijalar] = useState<Yangi[] | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const band = !!holat || saqlanmoqda;

  const tekshir = async (yangilar: Yangi[]): Promise<Yangi[]> => {
    const natija: Yangi[] = [];
    for (let i = 0; i < yangilar.length; i += TEKSHIRUV_BOLAGI) {
      const bolak = yangilar.slice(i, i + TEKSHIRUV_BOLAGI);
      let t: Tekshiruv[] = [];
      try {
        t = (await soro<{ natijalar: Tekshiruv[] }>('POST', 'ai/tekshir', { savollar: bolak })).natijalar;
      } catch (e: unknown) {
        // Tekshirib bo'lmadi — bu savollar belgisiz qoladi (qoralama bo'lib tushadi).
        showNotification(`Javoblarni tekshirib bo'lmadi (${xatoMatni(e)})`, 'info');
      }
      natija.push(...bolak.map((n, k) => ({ ...n, tekshiruv: t[k] || null, tanlangan: t[k]?.tekshirildi === true })));
    }
    return natija;
  };

  const tuz = async () => {
    if (!fan) return showNotification('Fanni tanlang', 'error');
    if (!mavzuNomi) return showNotification('Mavzuni tanlang', 'error');
    const yig: Yangi[] = [];
    let bosh = 0;
    try {
      for (let i = 0; i < soni; i += BOLAK) {
        setHolat(`AI savol tuzmoqda… ${yig.length} / ${soni}`);
        try {
          const r = await soro<{ savollar: AiSavol[] }>('POST', 'questions/ai/tuz', {
            fan: fan.name, mavzu: mavzuNomi, tavsif, namuna, soni: Math.min(BOLAK, soni - i), tur, qiyinlik,
            bor: yig.map(n => htmlMatnga(n.text).slice(0, 140)),
          });
          const yangilar = r.savollar.map(q => ({ ...q, kalit: keyingiKalit++, tanlangan: false, tekshiruv: null }));
          // AI yaroqli savol bermagan bo'lishi mumkin (javobsiz yoki takror savollar serverda tashlanadi).
          if (!yangilar.length) { bosh++; continue; }
          setHolat(`AI javoblarni qayta yechib tekshirmoqda… ${yig.length + yangilar.length} / ${soni}`);
          yig.push(...await tekshir(yangilar));
          setNatijalar([...yig]);
        } catch (e: unknown) {
          showNotification(xatoMatni(e), 'error');
          if ([429, 503].includes(xatoHolati(e)) || !yig.length) break;
        }
      }
      if (!yig.length && bosh) showNotification("AI mos savol tuza olmadi — talabni aniqroq yozib, qayta urinib ko'ring", 'error');
      else if (yig.length && yig.length < soni) showNotification(`${soni} ta so'ralgan edi — AI ${yig.length} ta yaroqli savol tuzdi`, 'info');
    } finally {
      setHolat(null);
    }
  };

  const belgila = (kalit: number, tanlangan: boolean) => setNatijalar(l => (l || []).map(n => (n.kalit === kalit ? { ...n, tanlangan } : n)));
  const tanlanganlar = (natijalar || []).filter(n => n.tanlangan);

  const saqla = async () => {
    if (!fan || !mavzuNomi || !tanlanganlar.length) return;
    setSaqlanmoqda(true);
    try {
      const joy = { subject: fan.name, topic: mavzuNomi, bankTopicId: yangiMavzu === null ? mavzu?.id ?? (kutilgan ? mavzuId : null) : null, difficulty: qiyinlik, language: 'uz' };
      const questions = tanlanganlar.map((n, i) => {
        const maydon = {
          type: n.type, text: n.text, options: n.type === 'yopiq' ? n.options : null,
          correctAnswer: n.correctAnswer, solution: n.solution || null, solutionStatus: n.solution ? 'qoralama' : 'yoq',
        };
        const faol = n.tekshiruv?.tekshirildi === true && !savolXatosi({ ...maydon, ...joy } as never);
        return { ...maydon, ...joy, status: faol ? 'faol' : 'qoralama', source: 'AI tuzdi', qator: i + 1 };
      });
      const r = await soro<{ count: number; ids?: number[]; xatolar: { qator: number; xato: string }[] }>('POST', 'questions/bulk', { questions, schoolId: filial });
      const qoralama = questions.filter(q => q.status === 'qoralama').length;
      showNotification(`${r.count} ta savol bankka qo'shildi${qoralama ? ` — ${qoralama} tasi qoralama (bankda ko'rib, faol qilasiz)` : ''}${r.xatolar.length ? `; ${r.xatolar.length} tasi qo'shilmadi: ${r.xatolar[0].xato}` : ''}`, r.xatolar.length ? 'info' : 'success');
      onSaqlandi(r.ids || []);
      onYop();
    } catch (e: unknown) {
      showNotification(xatoMatni(e), 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-start justify-center overflow-y-auto p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Mavzu bo'yicha savol tuzish">
      <div className="fixed inset-0 bg-black/50" onClick={() => !band && onYop()} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-3xl border border-chiziq my-2">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-chiziq">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn flex items-center gap-1.5"><Sparkles size={15} className="text-brand shrink-0" /> Savol qo'shish</h3>
            <p className="text-[12px] text-matn-xira">Mavzuni tanlang va nima kerakligini yozing — AI savollarni tuzadi, javoblarini qayta yechib tekshiradi.</p>
            {onRejim && <QoshRejimi rejim="ai" onRejim={onRejim} band={band || (natijalar?.length ?? 0) > 0} />}
          </div>
          <button aria-label="Yopish" disabled={band} onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer disabled:opacity-40"><X size={16} /></button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4">
          {ai && !ai.yoqilgan && (ai.sozlay ? <AiKalitKartasi ixcham />
            : <p className="rounded-xl bg-ogoh-fon border border-ogoh/25 px-3 py-2 text-[12.5px] text-matn">AI hali ulanmagan. Kalitni administrator Sozlamalar → Integratsiyalar da kiritadi.</p>)}

          {!natijalar && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Maydon nom="Fan">
                  <select className={SELECT} value={fan?.id ?? ''} aria-label="Fan" disabled={band}
                    onChange={e => { setFanId(Number(e.target.value) || null); setMavzuId(null); setYangiMavzu(null); }}>
                    <option value="">Fanni tanlang</option>
                    {daraxt.fanlar.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </Maydon>
                <Maydon nom="Mavzu">
                  {yangiMavzu !== null ? (
                    <div className="flex items-center gap-1.5">
                      <input autoFocus className={INPUT} value={yangiMavzu} placeholder="Yangi mavzu nomi" aria-label="Yangi mavzu nomi" onChange={e => setYangiMavzu(e.target.value)} />
                      <Tugma kichik turi="oddiy" ikonka={<X size={13} />} onClick={() => setYangiMavzu(null)} aria-label="Bekor" />
                    </div>
                  ) : (
                    <select className={SELECT} value={mavzu?.id ?? (kutilgan ? mavzuId ?? '' : '')} disabled={!fan || band} aria-label="Mavzu"
                      onChange={e => (e.target.value === 'yangi' ? setYangiMavzu('') : setMavzuId(Number(e.target.value) || null))}>
                      <option value="">{fan ? 'Mavzuni tanlang' : 'Avval fanni tanlang'}</option>
                      {kutilgan && mavzuId != null && <option value={mavzuId}>{kutilgan}</option>}
                      {fan && bolimlarga(fan.mavzular).map(g => (g.bolim
                        ? <optgroup key={g.bolim + g.mavzular[0].id} label={g.bolim}>{g.mavzular.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
                        : g.mavzular.map(m => <option key={m.id} value={m.id}>{m.name}</option>)))}
                      {fan && <option value="yangi">+ Yangi mavzu…</option>}
                    </select>
                  )}
                </Maydon>
              </div>
              <Maydon nom="Nima kerak" izoh="Ixtiyoriy. O'z so'zingiz bilan: qanaqa masala yoki misol, qaysi sinf, qaysi darajada">
                <textarea rows={3} className={INPUT} value={tavsif} maxLength={1000} disabled={band} onChange={e => setTavsif(e.target.value)} aria-label="Nima kerak"
                  placeholder="Masalan: kasrlarni qo'shish va ayirishga oid matnli masalalar, 6-sinf, DTM testlaridagidek" />
              </Maydon>
              <Maydon nom="Namuna" izoh="Ixtiyoriy. Bitta-ikkita savol yozsangiz — AI shu uslubda tuzadi">
                <textarea rows={3} className={INPUT} value={namuna} maxLength={3000} disabled={band} onChange={e => setNamuna(e.target.value)} aria-label="Namuna"
                  placeholder="Masalan: 3/4 + 1/6 ni hisoblang. A) 11/12 B) 4/10 C) 2/5 D) 5/6" />
              </Maydon>
              <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                <div>
                  <p className="mb-1 text-[12px] font-semibold text-matn-sokin">Nechta</p>
                  <Tanlov qiymat={soni} onChange={setSoni} variantlar={[{ v: 5, nom: '5 ta' }, { v: 10, nom: '10 ta' }, { v: 20, nom: '20 ta' }]} />
                </div>
                <div>
                  <p className="mb-1 text-[12px] font-semibold text-matn-sokin">Turi</p>
                  <Tanlov qiymat={tur} onChange={setTur} variantlar={[{ v: 'yopiq', nom: 'Variantli' }, { v: 'raqamli', nom: 'Raqamli javob' }]} />
                </div>
                <div>
                  <p className="mb-1 text-[12px] font-semibold text-matn-sokin">Qiyinligi</p>
                  <QiyinlikTanlov qiymat={qiyinlik} onChange={setQiyinlik} />
                </div>
              </div>
            </>
          )}

          {holat && <p role="status" className="flex items-center gap-2 text-[12.5px] text-matn-sokin"><Loader2 size={14} className="animate-spin" /> {holat}</p>}

          {natijalar && (
            <section aria-label="Tuzilgan savollar" className="space-y-2">
              <p className="text-[13px] text-matn"><b>{natijalar.length}</b> ta savol · <span className="text-matn-sokin">{fan?.name} › {mavzuNomi}</span></p>
              {natijalar.map((n, i) => (
                <div key={n.kalit} className={`rounded-xl border p-3 transition-colors ${n.tanlangan ? 'border-brand/40 bg-sirt' : 'border-chiziq bg-ichki/60'}`}>
                  <div className="flex items-start gap-2.5">
                    <input type="checkbox" aria-label={`${i + 1}-savolni tanlash`} className="mt-1 w-4 h-4 shrink-0 accent-[var(--color-brand)] cursor-pointer"
                      checked={n.tanlangan} disabled={band} onChange={e => belgila(n.kalit, e.target.checked)} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5"><b className="text-[12px] text-matn-xira raqam">{i + 1}.</b><Belgi n={n} /></div>
                      <Korinish q={n} />
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-chiziq">
          {natijalar && !holat
            ? <Tugma turi="oddiy" disabled={band} onClick={() => setNatijalar(null)}>Qaytadan</Tugma>
            : <Tugma turi="oddiy" disabled={band} onClick={onYop}>Yopish</Tugma>}
          {!natijalar || holat ? (
            <Tugma turi="asosiy" ikonka={<Sparkles size={14} />} yuklanmoqda={!!holat} disabled={band || !ai?.yoqilgan} onClick={tuz}>{soni} ta savol tuzish</Tugma>
          ) : (
            <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} disabled={!tanlanganlar.length || band} onClick={saqla}>
              {tanlanganlar.length ? `${tanlanganlar.length} ta savolni bankka qo'shish` : "Bankka qo'shish"}
            </Tugma>
          )}
        </div>
      </div>
    </div>
  );
}
