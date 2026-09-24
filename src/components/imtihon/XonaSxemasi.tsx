import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { Tugma, Maydon, INPUT } from './ui';
import type { Room } from '../../types';

// Xona sxemasi: qatorlar × har qatordagi o'rinlar (partadagi har o'rin alohida)
// va ishlatib bo'lmaydigan o'rinlar (ustun, eshik oldi, singan parta).
// O'rinlashtirish va o'ringa qarab variant berish shu sxemaga tayanadi.

export default function XonaSxemasi({ xona, onYop }: { xona: Room; onYop: (saqlandi: boolean) => void }) {
  const { updateRoom, showNotification } = useCRM();
  const [rows, setRows] = useState<number>(xona.rows || Math.max(1, Math.ceil((xona.capacity || 6) / 6)));
  const [cols, setCols] = useState<number>(xona.cols || 6);
  const [band, setBand] = useState<Set<string>>(new Set(xona.blocked || []));
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  const almashtir = (k: string) => setBand(b => { const n = new Set(b); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const ishlatiladi = rows * cols - [...band].filter(k => { const [r, c] = k.split('-').map(Number); return r <= rows && c <= cols; }).length;

  const saqla = async () => {
    setSaqlanmoqda(true);
    try {
      const blocked = [...band].filter(k => { const [r, c] = k.split('-').map(Number); return r <= rows && c <= cols; });
      await updateRoom(xona.id, { rows, cols, blocked } as any);
      showNotification(`${xona.name}: ${ishlatiladi} ta o'rin`, 'success');
      onYop(true);
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-start sm:items-center justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-black/50" onClick={() => onYop(false)} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-3xl border border-chiziq">
        <div className="flex items-center justify-between px-5 py-4 border-b border-chiziq">
          <div>
            <h3 className="text-[14px] font-bold text-matn">{xona.name} — sxema</h3>
            <p className="text-[12px] text-matn-xira">O'rinni bosing — ishlatilmaydi (ustun, eshik oldi)</p>
          </div>
          <button aria-label="Yopish" onClick={() => onYop(false)} className="p-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Maydon nom="Qatorlar" className="w-28"><input type="number" min={1} max={60} className={INPUT} value={rows} onChange={e => setRows(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} /></Maydon>
            <Maydon nom="Qatordagi o'rinlar" className="w-36"><input type="number" min={1} max={40} className={INPUT} value={cols} onChange={e => setCols(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} /></Maydon>
            <p className="pb-2.5 text-[12.5px] text-matn-sokin">Ishlatiladi: <b className="text-matn raqam">{ishlatiladi}</b> ta o'rin{xona.capacity ? ` · darsdagi sig'im ${xona.capacity}` : ''}</p>
          </div>
          <div className="overflow-auto rounded-xl border border-chiziq bg-ichki p-3">
            <div className="text-center text-[11px] text-matn-xira mb-2">Doska / o'qituvchi stoli</div>
            <div className="inline-grid gap-1" style={{ gridTemplateColumns: `auto repeat(${cols}, 28px)` }}>
              {Array.from({ length: rows }, (_, r) => (
                <React.Fragment key={r}>
                  <span className="text-[10px] text-matn-xira pr-1 self-center raqam">{r + 1}</span>
                  {Array.from({ length: cols }, (_, c) => {
                    const k = `${r + 1}-${c + 1}`;
                    const yopiq = band.has(k);
                    return (
                      <button key={k} onClick={() => almashtir(k)} aria-label={`${r + 1}-qator ${c + 1}-o'rin`}
                        className={`w-7 h-7 rounded-md border text-[9px] cursor-pointer ${yopiq ? 'bg-ichki border-dashed border-chiziq-kuchli text-matn-xira' : 'bg-sirt border-chiziq text-matn-sokin hover:border-brand'}`}>
                        {yopiq ? '×' : c + 1}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-chiziq">
          <Tugma onClick={() => onYop(false)}>Bekor qilish</Tugma>
          <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} onClick={saqla}>Saqlash</Tugma>
        </div>
      </div>
    </div>
  );
}
