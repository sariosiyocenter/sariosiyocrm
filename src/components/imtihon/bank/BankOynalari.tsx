import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, INPUT, SELECT, Maydon } from '../ui';
import { QIYINLIK } from './qiyinlik';
import type { BankFiltrMalumoti } from '../../../types';

// Savollar banki oynalari: tanlangan savollarga bir nechta maydonni birdan qo'yish.
// (Filtr va qiymatlarni qo'shish / o'zgartirish — ustunlarning o'zida: BankUstunlari.tsx.)

export function Oyna({ sarlavha, izoh, onYop, children, pastki, kenglik = 'max-w-lg' }: {
  sarlavha: string; izoh?: React.ReactNode; onYop: () => void; children: React.ReactNode; pastki?: React.ReactNode; kenglik?: string;
}) {
  return (
    <div className="fixed inset-0 z-[260] flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4" role="dialog" aria-modal="true" aria-label={sarlavha}>
      <div className="fixed inset-0 bg-black/50" onClick={onYop} />
      <div className={`relative bg-sirt rounded-2xl shadow-2xl w-full ${kenglik} border border-chiziq my-2`}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-chiziq">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn">{sarlavha}</h3>
            {izoh && <p className="text-[12px] text-matn-xira mt-0.5">{izoh}</p>}
          </div>
          <button aria-label="Yopish" onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        {pastki && <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-t border-chiziq">{pastki}</div>}
      </div>
    </div>
  );
}

/** Belgilash oynasining boshlang'ich qiymatlari (filtr ustunlarida bittadan tanlangani). */
export interface BelgilashBoshi {
  mavzuId?: number | null;
  qiyinlik?: number | null;
  manba?: string | null;
  izoh?: string | null;
  guruhlar?: Record<number, number[]>;
}

const OZGARMAYDI = '__';

/**
 * Tanlangan savollarga mavzu, qiyinlik, manba, holat va filtr qiymatlarini
 * qo'yish (Addmen "SAVE"). Har maydonda "o'zgarmasin" — tegilmaydi.
 */
export function BelgilashOynasi({ ids, filtr, boshi, onYop, onSaqlandi }: {
  ids: number[]; filtr: BankFiltrMalumoti; boshi: BelgilashBoshi; onYop: () => void; onSaqlandi: () => void;
}) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [mavzu, setMavzu] = useState<string>(boshi.mavzuId ? String(boshi.mavzuId) : OZGARMAYDI);
  const [qiyinlik, setQiyinlik] = useState<string>(boshi.qiyinlik ? String(boshi.qiyinlik) : OZGARMAYDI);
  const [manba, setManba] = useState<string | null>(boshi.manba !== undefined ? boshi.manba : null);
  const [izoh, setIzoh] = useState<string | null>(boshi.izoh !== undefined ? boshi.izoh : null);
  const [joylashuv, setJoylashuv] = useState<string>(OZGARMAYDI);
  const [holat, setHolat] = useState<string>(OZGARMAYDI);
  // Guruh: undefined — o'zgarmasin, [] — tozalansin, [..] — shu qiymatlar.
  const [guruhlar, setGuruhlar] = useState<Record<number, number[] | undefined>>(() => ({ ...(boshi.guruhlar || {}) }));
  const [band, setBand] = useState(false);
  const manbalar = filtr.manbalar.map(m => m.nom).filter(Boolean);

  const saqla = async () => {
    const body: Record<string, any> = { ids };
    if (mavzu !== OZGARMAYDI) body.bankTopicId = Number(mavzu);
    if (qiyinlik !== OZGARMAYDI) body.difficulty = Number(qiyinlik);
    if (manba !== null) body.source = manba;
    if (izoh !== null) body.remark = izoh;
    if (joylashuv !== OZGARMAYDI) body.joylashuv = Number(joylashuv) || null;
    if (holat !== OZGARMAYDI) body.status = holat;
    const g = Object.entries(guruhlar).filter(([, v]) => v !== undefined).map(([k, v]) => ({ groupId: Number(k), tagIds: v }));
    if (g.length) body.guruhlar = g;
    if (Object.keys(body).length === 1) return showNotification("Hech narsa o'zgarmaydi — kamida bitta maydonni tanlang", 'error');
    setBand(true);
    try {
      const r = await soro<{ yangilandi: number; chala: number }>('PUT', 'questions/bulk', body);
      showNotification(`${ids.length} ta savol yangilandi${r.chala ? ` — ${r.chala} tasi to'liq emas, faol qilinmadi` : ''}`, r.chala ? 'info' : 'success');
      onSaqlandi();
      onYop();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const bolimlar = [...new Set(filtr.mavzular.map(m => m.bolim))];
  return (
    <Oyna sarlavha={`O'zgartirish — ${ids.length} ta savol`} izoh="Tanlangan maydonlar hamma tanlangan savolga qo'yiladi. «O'zgarmasin» — tegilmaydi." onYop={onYop} kenglik="max-w-xl"
      pastki={<><Tugma onClick={onYop}>Bekor qilish</Tugma><Tugma turi="asosiy" yuklanmoqda={band} onClick={saqla}>Saqlash</Tugma></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Maydon nom="Mavzu">
          <select className={SELECT} value={mavzu} onChange={e => setMavzu(e.target.value)}>
            <option value={OZGARMAYDI}>O'zgarmasin</option>
            {bolimlar.map(b => {
              const m = filtr.mavzular.filter(x => x.bolim === b);
              return b ? <optgroup key={b} label={b}>{m.map(x => <option key={x.id} value={x.id}>{x.nom}</option>)}</optgroup>
                : m.map(x => <option key={x.id} value={x.id}>{x.nom}</option>);
            })}
          </select>
        </Maydon>
        <Maydon nom="Qiyinlik">
          <select className={SELECT} value={qiyinlik} onChange={e => setQiyinlik(e.target.value)}>
            <option value={OZGARMAYDI}>O'zgarmasin</option>
            {QIYINLIK.map(q => <option key={q.d} value={q.d}>{q.nom}</option>)}
          </select>
        </Maydon>
        <Maydon nom="Manba" izoh={manba === null ? undefined : manba === '' ? "Manba olib tashlanadi" : undefined}>
          <div className="flex gap-1.5">
            <input className={INPUT} list="bank-manbalar" value={manba ?? ''} placeholder={manba === null ? "O'zgarmasin" : 'Manba nomi'}
              onChange={e => setManba(e.target.value)} />
            {manba !== null && <Tugma kichik turi="oddiy" aria-label="O'zgarmasin" title="O'zgarmasin" onClick={() => setManba(null)} ikonka={<X size={13} />} />}
          </div>
          <datalist id="bank-manbalar">{manbalar.map(m => <option key={m} value={m} />)}</datalist>
        </Maydon>
        <Maydon nom="Izoh (remark)" izoh={izoh === '' ? "Izoh olib tashlanadi" : undefined}>
          <div className="flex gap-1.5">
            <input className={INPUT} list="bank-izohlar" value={izoh ?? ''} placeholder={izoh === null ? "O'zgarmasin" : 'Izoh'} onChange={e => setIzoh(e.target.value)} />
            {izoh !== null && <Tugma kichik turi="oddiy" aria-label="O'zgarmasin" title="O'zgarmasin" onClick={() => setIzoh(null)} ikonka={<X size={13} />} />}
          </div>
          <datalist id="bank-izohlar">{(filtr.izohlar || []).map(m => m.nom).filter(Boolean).map(m => <option key={m} value={m} />)}</datalist>
        </Maydon>
        <Maydon nom="Variantlar joylashuvi">
          <select className={SELECT} value={joylashuv} onChange={e => setJoylashuv(e.target.value)}>
            <option value={OZGARMAYDI}>O'zgarmasin</option>
            <option value="0">Avtomatik</option>
            <option value="1">1 ustun</option>
            <option value="2">2 ustun</option>
            <option value="4">4 ustun</option>
          </select>
        </Maydon>
        <Maydon nom="Holati">
          <select className={SELECT} value={holat} onChange={e => setHolat(e.target.value)}>
            <option value={OZGARMAYDI}>O'zgarmasin</option>
            <option value="faol">Faol</option>
            <option value="qoralama">Qoralama</option>
            <option value="arxiv">Arxiv (yashirin)</option>
          </select>
        </Maydon>
      </div>
      {filtr.guruhlar.map(gr => {
        const v = guruhlar[gr.id];
        return (
          <div key={gr.id}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[12px] font-semibold text-matn-sokin">{gr.name}</span>
              <span className="flex gap-3 text-[11.5px]">
                {v !== undefined && <button className="text-matn-sokin hover:underline cursor-pointer" onClick={() => setGuruhlar(x => ({ ...x, [gr.id]: undefined }))}>O'zgarmasin</button>}
                <button className="text-xato hover:underline cursor-pointer" onClick={() => setGuruhlar(x => ({ ...x, [gr.id]: [] }))}>Tozalash</button>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {gr.tags.map(t => {
                const tanlangan = !!v?.includes(t.id);
                return (
                  <button key={t.id} type="button" aria-pressed={tanlangan}
                    onClick={() => setGuruhlar(x => { const eski = x[gr.id] || []; return { ...x, [gr.id]: tanlangan ? eski.filter(i => i !== t.id) : [...eski, t.id] }; })}
                    className={`px-2.5 py-1 rounded-lg border text-[12px] cursor-pointer ${tanlangan ? 'bg-brand text-brand-ust border-brand' : 'bg-sirt border-chiziq text-matn-sokin hover:text-matn'}`}>{t.name}</button>
                );
              })}
              {!gr.tags.length && <span className="text-[12px] text-matn-xira">Qiymat yo'q — filtr ustunining pastidagi «+» bilan qo'shing</span>}
            </div>
            <p className="mt-1 text-[11px] text-matn-xira">{v === undefined ? "O'zgarmaydi" : v.length ? `${gr.name}: shu ${v.length} ta qiymat qo'yiladi (boshqalari olinadi)` : `${gr.name} qiymatlari olib tashlanadi`}</p>
          </div>
        );
      })}
    </Oyna>
  );
}
