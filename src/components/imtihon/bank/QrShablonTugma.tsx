import React, { useState } from 'react';
import { FileDown, X } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { Tugma, INPUT, SELECT } from '../ui';
import { yuklabOl, faylNomi } from '../../../lib/zip';

// Addmen "CREATE QR FILE": bo'sh Word jadvali (savollar soni, 4/5 variant, ikki
// tilli) — ustoz to'ldirib, shu oynaning o'ziga yuklaydi.
export default function QrShablonTugma() {
  const { showNotification } = useCRM();
  const [ochiq, setOchiq] = useState(false);
  const [soni, setSoni] = useState(50);
  const [variantlar, setVariantlar] = useState<4 | 5>(4);
  const [til, setTil] = useState<'' | 'ru' | 'uz' | 'en'>('');
  const [nom, setNom] = useState('');
  const [band, setBand] = useState(false);

  const yukla = async () => {
    setBand(true);
    try {
      const { qrShablonYasa } = await import('./qrShablon');
      const fayl = nom.trim() || `QR shablon — ${soni} ta savol`;
      yuklabOl(await qrShablonYasa({ soni, variantlar, ikkinchiTil: til, nom: fayl }), `${faylNomi(fayl)}.docx`);
      setOchiq(false);
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  return (
    <span className="inline-block">
      <button type="button" onClick={() => setOchiq(o => !o)} aria-expanded={ochiq}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-matn-sokin hover:text-brand cursor-pointer w-fit"><FileDown size={13} /> Word QR shablon</button>
      {ochiq && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30" onClick={() => setOchiq(false)} />
        <div className="relative w-full max-w-xs rounded-xl border border-chiziq bg-sirt shadow-2xl p-3 space-y-2.5" role="dialog" aria-label="Word QR shablon">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] font-bold text-matn">Bo'sh QR jadvali (Word)</p>
            <button aria-label="Yopish" onClick={() => setOchiq(false)} className="p-1 -m-1 rounded text-matn-xira hover:text-matn cursor-pointer"><X size={14} /></button>
          </div>
          <p className="text-[11.5px] text-matn-xira">№ | Savol | A–D(E) | Javob. To'ldirib, shu yerga yuklang — AI siz o'qiladi.</p>
          <label className="block text-[12px] font-semibold text-matn-sokin">Fayl nomi
            <input className={`${INPUT} mt-1 py-1.5`} value={nom} onChange={e => setNom(e.target.value)} placeholder="Funksiya — DTM 2026" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[12px] font-semibold text-matn-sokin">Savollar
              <input type="number" min={1} max={1000} className={`${INPUT} mt-1 py-1.5`} value={soni} onChange={e => setSoni(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} />
            </label>
            <label className="block text-[12px] font-semibold text-matn-sokin">Variantlar
              <select className={`${SELECT} mt-1 py-1.5`} value={variantlar} onChange={e => setVariantlar(Number(e.target.value) as 4 | 5)}>
                <option value={4}>4 (A–D)</option><option value={5}>5 (A–E)</option>
              </select>
            </label>
          </div>
          <label className="block text-[12px] font-semibold text-matn-sokin">Ikki tilli
            <select className={`${SELECT} mt-1 py-1.5`} value={til} onChange={e => setTil(e.target.value as typeof til)}>
              <option value="">Yo'q</option><option value="ru">+ ruscha tarjima qatori</option><option value="uz">+ o'zbekcha tarjima qatori</option><option value="en">+ inglizcha tarjima qatori</option>
            </select>
          </label>
          <Tugma turi="asosiy" kichik className="w-full justify-center" ikonka={<FileDown size={13} />} yuklanmoqda={band} onClick={yukla}>Yuklab olish (.docx)</Tugma>
        </div>
        </div>
      )}
    </span>
  );
}
