import React, { useState } from 'react';
import { X, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, INPUT, SELECT, Maydon } from '../ui';
import { QIYINLIK } from './qiyinlik';
import type { BankFiltrMalumoti, BelgiGuruhi } from '../../../types';

// Savollar bankining (Addmen ko'rinishi) oynalari: filtrni sozlash (qiymatlarni
// qo'shish, nomini o'zgartirish, o'chirish) va tanlangan savollarni belgilash.

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

/**
 * Filtrni sozlash: yangi filtr (guruh = null) yoki mavjudining nomi va
 * qiymatlari. Addmen'da bu ro'yxatda o'ng tugma bilan qilinardi.
 */
export function FiltrSozlash({ guruh, onYop, onOzgardi }: { guruh: BelgiGuruhi | null; onYop: () => void; onOzgardi: () => void }) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const [nom, setNom] = useState(guruh?.name || '');
  const [yangi, setYangi] = useState('');
  const [tahrirda, setTahrirda] = useState<{ id: number; nom: string } | null>(null);
  const [band, setBand] = useState(false);
  const [g, setG] = useState(guruh);

  const ish = async (f: () => Promise<void>) => {
    setBand(true);
    try { await f(); onOzgardi(); } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(false); }
  };

  const nomniSaqla = () => ish(async () => {
    if (!nom.trim()) throw new Error('Filtr nomini kiriting');
    if (!g) {
      const yangiG = await soro<{ id: number; name: string; order: number }>('POST', 'bank/belgi-guruhlari', { name: nom });
      setG({ ...yangiG, tags: [] });
      showNotification(`«${yangiG.name}» filtri qo'shildi — endi qiymatlarini yozing`, 'success');
    } else if (nom.trim() !== g.name) {
      await soro('PUT', `bank/belgi-guruhlari/${g.id}`, { name: nom });
      setG({ ...g, name: nom.trim() });
      showNotification('Filtr nomi saqlandi', 'success');
    }
  });

  // Bir nechta qiymat birdan: har qatorga bittadan ("1-savol", "2-savol"...).
  const qiymatQosh = () => ish(async () => {
    if (!g) return;
    const nomlar = yangi.split('\n').map(s => s.trim()).filter(Boolean);
    if (!nomlar.length) return;
    const qoshildi: BelgiGuruhi['tags'] = [];
    for (const n of nomlar) {
      if (g.tags.some(t => t.name.toLowerCase() === n.toLowerCase()) || qoshildi.some(t => t.name.toLowerCase() === n.toLowerCase())) continue;
      qoshildi.push(await soro('POST', 'bank/belgilar', { groupId: g.id, name: n }));
    }
    setG({ ...g, tags: [...g.tags, ...qoshildi] });
    setYangi('');
  });

  const qiymatNomi = () => ish(async () => {
    if (!g || !tahrirda) return;
    await soro('PUT', `bank/belgilar/${tahrirda.id}`, { name: tahrirda.nom });
    setG({ ...g, tags: g.tags.map(t => (t.id === tahrirda.id ? { ...t, name: tahrirda.nom.trim() } : t)) });
    setTahrirda(null);
  });

  const qiymatOchir = async (t: BelgiGuruhi['tags'][number]) => {
    if (!g || !(await confirm(`«${t.name}» qiymati o'chirilsinmi? Savollardan ham olib tashlanadi (savollarning o'zi qoladi).`))) return;
    ish(async () => {
      await soro('DELETE', `bank/belgilar/${t.id}`);
      setG({ ...g, tags: g.tags.filter(x => x.id !== t.id) });
    });
  };

  const guruhOchir = async () => {
    if (!g || !(await confirm(`«${g.name}» filtri butunlay o'chirilsinmi? Uning ${g.tags.length} ta qiymati savollardan olib tashlanadi.`))) return;
    ish(async () => {
      await soro('DELETE', `bank/belgi-guruhlari/${g.id}`);
      showNotification(`«${g.name}» filtri o'chirildi`, 'info');
      onYop();
    });
  };

  return (
    <Oyna sarlavha={g ? `Filtr: ${g.name}` : 'Yangi filtr'} izoh="Masalan: «Milliy sertifikat savollari» → 1-savol, 2-savol…; «Test turi» → bitta to'g'ri javobli, bir nechta to'g'ri…" onYop={onYop}
      pastki={<>{g ? <Tugma kichik turi="xavfli" ikonka={<Trash2 size={13} />} disabled={band} onClick={guruhOchir}>Filtrni o'chirish</Tugma> : <span />}<Tugma onClick={onYop}>Yopish</Tugma></>}>
      <Maydon nom="Filtr nomi">
        <div className="flex gap-2">
          <input className={INPUT} value={nom} autoFocus={!g} placeholder="Milliy sertifikat savollari" onChange={e => setNom(e.target.value)} onKeyDown={e => e.key === 'Enter' && nomniSaqla()} />
          <Tugma turi={g ? 'ikkinchi' : 'asosiy'} disabled={band || !nom.trim() || nom.trim() === g?.name} onClick={nomniSaqla}>{g ? 'Saqlash' : "Qo'shish"}</Tugma>
        </div>
      </Maydon>
      {g && (
        <>
          <div>
            <p className="text-[12px] font-semibold text-matn-sokin mb-1.5">Qiymatlari <span className="font-normal text-matn-xira">— {g.tags.length} ta</span></p>
            <ul className="rounded-xl border border-chiziq divide-y divide-chiziq max-h-64 overflow-y-auto">
              {!g.tags.length && <li className="px-3 py-2.5 text-[12px] text-matn-xira">Hali qiymat yo'q</li>}
              {g.tags.map(t => (
                <li key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px]">
                  {tahrirda?.id === t.id ? (
                    <>
                      <input autoFocus className={`${INPUT} py-1.5`} value={tahrirda.nom} onChange={e => setTahrirda({ id: t.id, nom: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') qiymatNomi(); if (e.key === 'Escape') setTahrirda(null); }} />
                      <button aria-label="Saqlash" disabled={band} onClick={qiymatNomi} className="p-1.5 rounded-lg text-yaxshi hover:bg-ichki cursor-pointer"><Check size={14} /></button>
                      <button aria-label="Bekor" onClick={() => setTahrirda(null)} className="p-1.5 rounded-lg text-matn-xira hover:bg-ichki cursor-pointer"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 truncate text-matn">{t.name}</span>
                      <button aria-label={`${t.name} — nomini o'zgartirish`} onClick={() => setTahrirda({ id: t.id, nom: t.name })} className="p-1.5 rounded-lg text-matn-xira hover:text-brand hover:bg-ichki cursor-pointer"><Pencil size={13} /></button>
                      <button aria-label={`${t.name} — o'chirish`} disabled={band} onClick={() => qiymatOchir(t)} className="p-1.5 rounded-lg text-matn-xira hover:text-xato hover:bg-ichki cursor-pointer"><Trash2 size={13} /></button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <Maydon nom="Qiymat qo'shish" izoh="Bir nechtasini birdan — har qatorga bittadan">
            <div className="flex items-start gap-2">
              <textarea rows={2} className={INPUT} value={yangi} placeholder={'1-savol\n2-savol'} onChange={e => setYangi(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !yangi.includes('\n')) { e.preventDefault(); qiymatQosh(); } }} />
              <Tugma ikonka={<Plus size={14} />} disabled={band || !yangi.trim()} onClick={qiymatQosh}>Qo'shish</Tugma>
            </div>
          </Maydon>
        </>
      )}
    </Oyna>
  );
}

/** Belgilash oynasining boshlang'ich qiymatlari (filtr ustunlarida bittadan tanlangani). */
export interface BelgilashBoshi {
  mavzuId?: number | null;
  qiyinlik?: number | null;
  manba?: string | null;
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
    <Oyna sarlavha={`Belgilash — ${ids.length} ta savol`} izoh="Tanlangan maydonlar hamma tanlangan savolga qo'yiladi. «O'zgarmasin» — tegilmaydi." onYop={onYop} kenglik="max-w-xl"
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
              {!gr.tags.length && <span className="text-[12px] text-matn-xira">Qiymat yo'q — filtr ustunidagi ⚙ orqali qo'shing</span>}
            </div>
            <p className="mt-1 text-[11px] text-matn-xira">{v === undefined ? "O'zgarmaydi" : v.length ? `${gr.name}: shu ${v.length} ta qiymat qo'yiladi (boshqalari olinadi)` : `${gr.name} qiymatlari olib tashlanadi`}</p>
          </div>
        );
      })}
    </Oyna>
  );
}
