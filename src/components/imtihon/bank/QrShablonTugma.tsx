import React, { useState } from 'react';
import { FileDown, X } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { Tugma, INPUT, SELECT } from '../ui';
import { yuklabOl, faylNomi } from '../../../lib/zip';
import type { ShablonTili } from './qrShablon';

// Word shablon: bo'sh savollar jadvali (№ | Savol | A–D(E) | Javob). Ustoz to'ldirib,
// shu oynaning o'ziga yuklaydi — AI siz o'qiladi. Asosiy til — o'zbekcha; ruscha va
// inglizcha tarjima qatorlari qo'shilishi mumkin (ikkalasi ham).
const QOSHIMCHA_TILLAR: { til: ShablonTili; nom: string }[] = [
  { til: 'ru', nom: 'Ruscha' },
  { til: 'en', nom: 'Inglizcha' },
];

export default function QrShablonTugma() {
  const { showNotification } = useCRM();
  const [ochiq, setOchiq] = useState(false);
  const [soni, setSoni] = useState(50);
  const [variantlar, setVariantlar] = useState<4 | 5>(4);
  const [tillar, setTillar] = useState<ShablonTili[]>([]);
  const [nom, setNom] = useState('');
  const [band, setBand] = useState(false);

  const yukla = async () => {
    setBand(true);
    try {
      const { qrShablonYasa } = await import('./qrShablon');
      const fayl = nom.trim() || `Savollar shabloni — ${soni} ta savol`;
      yuklabOl(await qrShablonYasa({ soni, variantlar, tillar, nom: fayl }), `${faylNomi(fayl)}.docx`);
      setOchiq(false);
    } catch (e: unknown) {
      showNotification(e instanceof Error ? e.message : 'Shablon tayyorlanmadi', 'error');
    } finally {
      setBand(false);
    }
  };
  const tilniAlmashtir = (til: ShablonTili) => setTillar(l => (l.includes(til) ? l.filter(x => x !== til) : [...l, til]));

  return (
    <span className="inline-block">
      <button type="button" onClick={() => setOchiq(o => !o)} aria-expanded={ochiq}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-matn-sokin hover:text-brand cursor-pointer w-fit"><FileDown size={13} /> Word shablon</button>
      {ochiq && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30" onClick={() => setOchiq(false)} />
        <div className="relative w-full max-w-sm rounded-xl border border-chiziq bg-sirt shadow-2xl p-3.5 space-y-3" role="dialog" aria-label="Word shablon">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-bold text-matn">Word shablon — savollar jadvali</p>
            <button aria-label="Yopish" onClick={() => setOchiq(false)} className="p-1 -m-1 rounded text-matn-xira hover:text-matn cursor-pointer"><X size={14} /></button>
          </div>
          <p className="text-[12px] text-matn-sokin">Bo'sh jadval yuklab olinadi: har qatorga bitta savol, variantlar va to'g'ri javob harfi. To'ldirib, shu yerga yuklaysiz — savollar jadvaldagi tartibda tushadi.</p>
          <label className="block text-[12px] font-semibold text-matn-sokin">Fayl nomi
            <input className={`${INPUT} mt-1 py-1.5`} value={nom} onChange={e => setNom(e.target.value)} placeholder="Funksiya — DTM 2026" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[12px] font-semibold text-matn-sokin">Savollar soni
              <input type="number" min={1} max={1000} className={`${INPUT} mt-1 py-1.5`} value={soni} onChange={e => setSoni(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} />
            </label>
            <label className="block text-[12px] font-semibold text-matn-sokin">Variantlar
              <select className={`${SELECT} mt-1 py-1.5`} value={variantlar} onChange={e => setVariantlar(Number(e.target.value) as 4 | 5)}>
                <option value={4}>4 ta (A–D)</option><option value={5}>5 ta (A–E)</option>
              </select>
            </label>
          </div>
          <fieldset>
            <legend className="text-[12px] font-semibold text-matn-sokin">Tillar</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-brand bg-brand-fon text-brand-dark dark:bg-brand/20 dark:text-brand-accent text-[12px] font-semibold">
                <input type="checkbox" checked disabled className="w-3.5 h-3.5 accent-[var(--color-brand)]" /> O'zbekcha <span className="font-normal opacity-80">— asosiy</span>
              </label>
              {QOSHIMCHA_TILLAR.map(t => (
                <label key={t.til} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold cursor-pointer ${tillar.includes(t.til) ? 'border-brand bg-brand-fon text-brand-dark dark:bg-brand/20 dark:text-brand-accent' : 'border-chiziq text-matn-sokin hover:text-matn'}`}>
                  <input type="checkbox" checked={tillar.includes(t.til)} onChange={() => tilniAlmashtir(t.til)} className="w-3.5 h-3.5 accent-[var(--color-brand)] cursor-pointer" /> {t.nom}
                </label>
              ))}
            </div>
            {tillar.length > 0 && <p className="mt-1.5 text-[11.5px] text-matn-xira">Har savol ostida tarjima qatori bo'ladi — o'sha savolning shu tildagi matni va variantlari yoziladi.</p>}
          </fieldset>
          <Tugma turi="asosiy" kichik className="w-full justify-center" ikonka={<FileDown size={13} />} yuklanmoqda={band} onClick={yukla}>Yuklab olish (.docx)</Tugma>
        </div>
        </div>
      )}
    </span>
  );
}
