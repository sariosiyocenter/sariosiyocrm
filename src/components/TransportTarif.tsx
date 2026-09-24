import React from 'react';
import { Plus, X } from 'lucide-react';
import { narxHisobla, tarifniTozalash, somMatni } from '../../lib/transportNarx.js';

/**
 * Haydovchining yo'l haqi tarifi — Logistika → "Yo'l haqi" bo'limida
 * (2026-09-24 gacha Xodimlar → haydovchi kartasida edi).
 *
 * Ikki xil: har bir o'quvchiga bir xil narx yoki markazdan uyigacha masofaga
 * qarab oraliqlar ("5 km gacha — 3 000", "10 km gacha — 10 000", "undan uzoq —
 * 15 000"). Qiymat server bilan bir xil shaklda: lib/transportNarx.js.
 */

export interface Tarif {
    tur: 'bir' | 'masofa';
    narx?: number | string;
    oraliqlar?: { km: number | string; narx: number | string }[];
    uzoq?: number | string | null;
}

const inp = "w-full px-3 py-2.5 bg-sirt border border-chiziq rounded-xl text-xs font-bold text-matn focus:border-brand outline-none transition-all";

export default function TransportTarif({ value, onChange }: { value: Tarif | null | undefined; onChange: (t: Tarif | null) => void }) {
    const tur = value?.tur || null;
    const oraliqlar = value?.oraliqlar?.length ? value.oraliqlar : [{ km: '', narx: '' }];

    const setOraliq = (i: number, maydon: 'km' | 'narx', v: string) =>
        onChange({ ...value!, tur: 'masofa', oraliqlar: oraliqlar.map((o, j) => j === i ? { ...o, [maydon]: v } : o) });

    // Namuna: tarif to'g'ri kiritilganmi — admin darhol ko'rsin.
    const tekshir = value ? tarifniTozalash(value) : { tarif: null };
    const namuna = !tekshir.xato && tekshir.tarif
        ? [2, 5, 8, 12].map(km => `${km} km → ${somMatni(narxHisobla(tekshir.tarif, km).narx)}`).join(' · ')
        : '';

    return (
        <div className="space-y-2.5">
            <p className="text-[11px] font-extrabold text-amber-700 dark:text-amber-400">💰 Yo'l haqi (bir o'quvchi uchun)</p>
            <p className="text-[10px] font-bold text-matn-xira">O'quvchi bu pulni mashinada haydovchiga naqd beradi — kassaga tushmaydi.</p>
            <div className="flex flex-wrap gap-1.5">
                {([[null, 'Kiritilmagan'], ['bir', 'Hammaga bir xil'], ['masofa', 'Masofaga qarab']] as const).map(([k, nom]) => (
                    <button key={String(k)} type="button"
                        onClick={() => onChange(k === null ? null : k === 'bir'
                            ? { tur: 'bir', narx: value?.narx ?? '' }
                            : { tur: 'masofa', oraliqlar: value?.oraliqlar?.length ? value.oraliqlar : [{ km: 5, narx: '' }, { km: 10, narx: '' }], uzoq: value?.uzoq ?? '' })}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${tur === k
                            ? 'bg-brand border-brand text-white' : 'bg-sirt border-chiziq text-matn-sokin hover:border-brand'}`}>
                        {nom}
                    </button>
                ))}
            </div>

            {tur === 'bir' && (
                <div className="flex items-center gap-2">
                    <input type="number" min="0" step="500" placeholder="5000" className={inp}
                        value={value?.narx ?? ''} onChange={e => onChange({ tur: 'bir', narx: e.target.value })} />
                    <span className="text-[11px] font-bold text-matn-xira shrink-0">so'm</span>
                </div>
            )}

            {tur === 'masofa' && (
                <div className="space-y-1.5">
                    {oraliqlar.map((o, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <input type="number" min="0" step="0.5" placeholder="5" className={inp + ' w-20'}
                                value={o.km} onChange={e => setOraliq(i, 'km', e.target.value)} />
                            <span className="text-[11px] font-bold text-matn-xira shrink-0">km gacha</span>
                            <input type="number" min="0" step="500" placeholder="3000" className={inp}
                                value={o.narx} onChange={e => setOraliq(i, 'narx', e.target.value)} />
                            <span className="text-[11px] font-bold text-matn-xira shrink-0">so'm</span>
                            <button type="button" disabled={oraliqlar.length === 1}
                                onClick={() => onChange({ ...value!, oraliqlar: oraliqlar.filter((_, j) => j !== i) })}
                                className="w-7 h-7 rounded-lg text-matn-xira hover:text-rose-600 disabled:opacity-30 flex items-center justify-center shrink-0 cursor-pointer">
                                <X size={13} />
                            </button>
                        </div>
                    ))}
                    {oraliqlar.length < 10 && (
                        <button type="button" onClick={() => onChange({ ...value!, oraliqlar: [...oraliqlar, { km: '', narx: '' }] })}
                            className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline cursor-pointer">
                            <Plus size={12} /> Oraliq qo'shish
                        </button>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] font-bold text-matn-xira shrink-0 w-[118px]">Undan uzoq</span>
                        <input type="number" min="0" step="500" placeholder="oxirgi narx" className={inp}
                            value={value?.uzoq ?? ''} onChange={e => onChange({ ...value!, uzoq: e.target.value })} />
                        <span className="text-[11px] font-bold text-matn-xira shrink-0">so'm</span>
                    </div>
                    <p className="text-[10px] font-bold text-matn-xira leading-relaxed">
                        Masofa — o'quv markazidan o'quvchining xaritadagi uyigacha to'g'ri chiziq bo'yicha. Uyi xaritada belgilanmagan o'quvchining narxi chiqmaydi.
                    </p>
                </div>
            )}

            {tekshir.xato && tur && <p className="text-[10px] font-bold text-rose-600">{tekshir.xato}</p>}
            {namuna && tur === 'masofa' && <p className="text-[10px] font-bold text-matn-sokin">Masalan: {namuna} so'm</p>}
        </div>
    );
}
