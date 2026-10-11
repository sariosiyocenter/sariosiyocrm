import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, Layers } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, Tanlov, Maydon, Yuklanmoqda, INPUT, SELECT } from '../ui';
import { HARFLAR } from '../../../../lib/imtihon.js';
import { TUR_IZOHI } from '../../../lib/savolTuri';
import { htmlMatnga, tahrirHtml, xatoMatni } from './aiUmumiy';
import { guruhNomi } from './faylTuri';
import type { BankDaraxt, GuruhTuri } from '../../../types';

// Bankdagi guruhli savolni TAHRIRLASH (Milliy sertifikat): bitta umumiy shart va uning ostida kichik savollar.
//   MS-33-35 (moslash) — savollar bitta umumiy javoblar ro'yxatidan (A–F) javob oladi;
//   MS-36-45 (qismli)  — bitta raqam ostida a), b) qismlari, har birining o'z javobi.
// Yangi guruh bu yerda yaratilmaydi (egasi, 2026-10-10: "savollarni qo'lda qo'shmaymiz, fayldan qo'shamiz"):
// «Savol qo'shish → Fayldan» (fayl turi MS-33-35 yoki MS-36-45) yoki «AI tuzadi».

const MAKS_SAVOL = 6;
/** Qismli savolda ko'pi bilan 4 qism: imtihon varag'ida a–d bilan belgilanadi. */
const MAKS_QISM = 4;
interface KichikSavol { id?: number; text: string; javob: string; son: boolean; ishlatilgan?: boolean }
interface GuruhJavobi { id: number; tur: GuruhTuri; text: string; variantlar: string[]; mavzuId: number | null; difficulty: number; savollar: (KichikSavol & { id: number })[] }
const BOSH_SAVOL: KichikSavol = { text: '', javob: '', son: true };
const QISM_HARFI = 'abcdefghij';
/** Skaner tekshira oladigan javob: butun, o'nli yoki oddiy kasr son. */
const SON_JAVOB = /^-?\d+([.,]\d+)?(\/\d+)?$/;

interface GuruhOynasiProps {
  /** Ishlatilmaydi (avvalgi chaqiruvlar bilan mos bo'lishi uchun qoldirilgan). */
  daraxt?: BankDaraxt;
  /** Mavjud guruh (umumiy shart) id si. */
  guruhId: number;
  onYop: () => void;
  /** Saqlandi (tahrirda yangi savol id lari qaytmaydi — bo'sh ro'yxat). */
  onSaqlandi: (ids: number[]) => void;
}

export default function GuruhOynasi({ guruhId, onYop, onSaqlandi }: GuruhOynasiProps) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();

  const [tur, setTur] = useState<GuruhTuri>('moslash');
  const [shart, setShart] = useState('');
  const [variantlar, setVariantlar] = useState<string[]>(['', '', '', '', '', '']);
  const [savollar, setSavollar] = useState<KichikSavol[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(true);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  // Asl HTML: tahrir maydonlari oddiy matn — o'zgarmagan bo'lak asl holida (rasmlari bilan) qaytib yoziladi.
  const asl = useRef<{ shart: string; variantlar: string[]; savollar: Map<number, string> }>({ shart: '', variantlar: [], savollar: new Map() });

  useEffect(() => {
    let bekor = false;
    soro<GuruhJavobi>('GET', `bank/guruhlar/${guruhId}`).then(g => {
      if (bekor) return;
      asl.current = { shart: g.text, variantlar: g.variantlar, savollar: new Map(g.savollar.map(s => [s.id, s.text])) };
      setTur(g.tur);
      setShart(htmlMatnga(g.text));
      setVariantlar(HARFLAR.map((_: string, i: number) => htmlMatnga(g.variantlar[i] || '')));
      setSavollar(g.savollar.map(s => ({ ...s, text: htmlMatnga(s.text) })));
    }).catch((e: unknown) => { if (!bekor) { showNotification(xatoMatni(e), 'error'); onYop(); } })
      .finally(() => { if (!bekor) setYuklanmoqda(false); });
    return () => { bekor = true; };
  }, [guruhId]); // eslint-disable-line react-hooks/exhaustive-deps

  const savolni = (i: number, d: Partial<KichikSavol>) => setSavollar(l => l.map((s, j) => (j === i ? { ...s, ...d } : s)));
  const toliqVariantlar = variantlar.map(v => v.trim());
  const variantSoni = toliqVariantlar.reduce((oxirgi, v, i) => (v ? i + 1 : oxirgi), 0);

  const saqla = async () => {
    // Shart faqat chizmadan iborat bo'lishi mumkin (Word shablonidan) — u matn maydonida ko'rinmaydi.
    if (!shart.trim() && !/<img\b/i.test(asl.current.shart)) return showNotification('Umumiy shartni yozing', 'error');
    const kichik = savollar.filter(s => s.text.trim() || s.id);
    if (kichik.some(s => !s.text.trim())) return showNotification("Bo'sh savol bor — matnini yozing yoki o'chiring", 'error');
    if (kichik.some(s => !s.javob.trim())) return showNotification("Har savolning to'g'ri javobini belgilang", 'error');
    if (tur === 'moslash' && toliqVariantlar.slice(0, variantSoni).some(v => !v)) return showNotification("Javoblar ro'yxatida bo'sh qator bor", 'error');
    const sonEmas = tur === 'qismli' ? kichik.findIndex(s => s.son && !SON_JAVOB.test(s.javob.trim())) : -1;
    if (sonEmas >= 0) return showNotification(`${QISM_HARFI[sonEmas]}) qismning javobi son emas — skaner faqat sonni tekshiradi. «Ustoz tekshiradi» ni tanlang`, 'error');
    setSaqlanmoqda(true);
    try {
      await soro<{ id: number }>('PUT', `bank/guruhlar/${guruhId}`, {
        tur, text: tahrirHtml(asl.current.shart, shart),
        variantlar: tur === 'moslash' ? toliqVariantlar.slice(0, variantSoni).map((v, i) => tahrirHtml(asl.current.variantlar[i], v)) : undefined,
        savollar: kichik.map(s => ({ id: s.id, text: tahrirHtml(s.id ? asl.current.savollar.get(s.id) : '', s.text), javob: s.javob.trim(), son: tur === 'qismli' && s.son })),
      });
      showNotification('Guruhli savol saqlandi', 'success');
      onSaqlandi([]);
      onYop();
    } catch (e: unknown) {
      showNotification(xatoMatni(e), 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-start justify-center overflow-y-auto p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Guruhli savol">
      <div className="fixed inset-0 bg-black/50" onClick={() => !saqlanmoqda && onYop()} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-3xl border border-chiziq my-2">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-chiziq">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn flex items-center gap-1.5"><Layers size={15} className="text-brand shrink-0" /> Guruhli savolni tahrirlash</h3>
            <p className="text-[12px] text-matn-xira">Milliy sertifikatdagidek: bitta umumiy shart va uning ostida bir nechta savol.</p>
          </div>
          <button aria-label="Yopish" disabled={saqlanmoqda} onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer disabled:opacity-40"><X size={16} /></button>
        </div>

        {yuklanmoqda ? <Yuklanmoqda /> : (
          <div className="px-4 sm:px-5 py-4 space-y-4">
            <div>
              <p className="mb-1 text-[12px] font-semibold text-matn-sokin">Turi</p>
              <p className="text-[13px] font-semibold text-matn">{guruhNomi(tur)} <span className="font-normal text-matn-sokin">— {tur === 'moslash' ? TUR_IZOHI.juft : TUR_IZOHI.qismli}</span></p>
              <p className="mt-1 text-[11.5px] text-matn-xira">{tur === 'moslash'
                ? "Bir nechta savol bitta umumiy javoblar ro'yxatidan (A–F) javob oladi. Ortiqcha javoblar chalg'ituvchi bo'ladi."
                : "Bitta savol, ichida a), b) qismlari — imtihonda bitta raqam oladi (36a, 36b). Har qismning o'z javobi bor."}</p>
            </div>

            <Maydon nom="Umumiy shart" izoh="Formulani $...$ ichida yozing, masalan: $\frac{6x-k}{x-1}$">
              <textarea rows={3} className={INPUT} value={shart} maxLength={8000} onChange={e => setShart(e.target.value)} aria-label="Umumiy shart"
                placeholder={tur === 'moslash' ? "Masalan: Muntazam oltiburchakli piramidaga shar ichki chizilgan… (π ≈ 3 deb oling.)" : 'Masalan: $\\frac{6x-k}{x-1} = 3 - \\frac{2x+k}{x+1}$ tenglama berilgan.'} />
            </Maydon>

            <div className={`grid gap-4 ${tur === 'moslash' ? 'grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px]' : 'grid-cols-1'}`}>
              <div>
                <p className="mb-1.5 text-[12px] font-semibold text-matn-sokin">{tur === 'moslash' ? 'Savollar' : 'Qismlar'}</p>
                <ul className="space-y-2">
                  {savollar.map((s, i) => (
                    <li key={s.id ?? `y${i}`} className="rounded-xl border border-chiziq bg-ichki p-2.5 space-y-2">
                      <div className="flex items-start gap-2">
                        <b className="pt-2 w-6 shrink-0 text-[13px] text-matn-xira raqam">{tur === 'moslash' ? `${i + 1}.` : `${QISM_HARFI[i]})`}</b>
                        <textarea rows={1} className={`${INPUT} flex-1 min-w-0`} value={s.text} maxLength={4000} onChange={e => savolni(i, { text: e.target.value })}
                          aria-label={`${i + 1}-savol matni`} placeholder={tur === 'moslash' ? 'Masalan: Piramida hajmini toping.' : 'Masalan: k ning eng katta qiymatini toping.'} />
                        <button type="button" aria-label={`${i + 1}-savolni olib tashlash`} title={s.ishlatilgan ? "Imtihonda ishlatilgan — olib bo'lmaydi" : 'Olib tashlash'}
                          disabled={!!s.ishlatilgan || savollar.length <= (tur === 'moslash' ? 2 : 1)} onClick={() => setSavollar(l => l.filter((_, j) => j !== i))}
                          className="mt-1.5 p-1.5 rounded-lg text-matn-xira hover:text-xato hover:bg-sirt cursor-pointer disabled:opacity-30 disabled:cursor-default"><Trash2 size={14} /></button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-8">
                        <span className="text-[12px] text-matn-sokin">To'g'ri javob:</span>
                        {tur === 'moslash' ? (
                          <select className={`${SELECT} w-auto py-1`} value={s.javob} aria-label={`${i + 1}-savolning to'g'ri javobi`} onChange={e => savolni(i, { javob: e.target.value })}>
                            <option value="">— harf —</option>
                            {HARFLAR.slice(0, Math.max(2, variantSoni)).map((h: string, k: number) => <option key={h} value={h}>{h}{toliqVariantlar[k] ? `) ${toliqVariantlar[k].slice(0, 24)}` : ''}</option>)}
                          </select>
                        ) : (
                          <>
                            <input className={`${INPUT} w-36 py-1`} value={s.javob} maxLength={40} aria-label={`${QISM_HARFI[i]}) qismning to'g'ri javobi`} placeholder="masalan 9,1" onChange={e => savolni(i, { javob: e.target.value })} />
                            <Tanlov kichik qiymat={s.son ? 'son' : 'ustoz'} onChange={v => savolni(i, { son: v === 'son' })} variantlar={[{ v: 'son', nom: 'Skaner (son)' }, { v: 'ustoz', nom: 'Ustoz tekshiradi' }]} />
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {savollar.length < (tur === 'qismli' ? MAKS_QISM : MAKS_SAVOL) && (
                  <button type="button" onClick={() => setSavollar(l => [...l, { ...BOSH_SAVOL }])} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:underline cursor-pointer">
                    <Plus size={13} strokeWidth={2.6} />{tur === 'moslash' ? 'savol' : 'qism'}
                  </button>
                )}
              </div>

              {tur === 'moslash' && (
                <div>
                  <p className="mb-1.5 text-[12px] font-semibold text-matn-sokin">Javoblar ro'yxati (umumiy)</p>
                  <ul className="space-y-1.5">
                    {variantlar.map((v, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <b className="w-5 text-[13px] text-matn-xira">{HARFLAR[i]})</b>
                        <input className={`${INPUT} py-1.5`} value={v} maxLength={2000} aria-label={`${HARFLAR[i]} javobi`} placeholder={i < 2 ? 'javob' : 'ixtiyoriy'}
                          onChange={e => setVariantlar(l => l.map((x, j) => (j === i ? e.target.value : x)))} />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[11.5px] text-matn-xira">Savollardan ko'proq javob yozing — ortiqchalari chalg'itadi.</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-chiziq">
          <Tugma turi="oddiy" disabled={saqlanmoqda} onClick={onYop}>Bekor qilish</Tugma>
          <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} disabled={yuklanmoqda || saqlanmoqda} onClick={saqla}>Saqlash</Tugma>
        </div>
      </div>
    </div>
  );
}
