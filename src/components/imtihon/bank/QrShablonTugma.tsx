import React, { useState } from 'react';
import { FileDown, X } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { Tugma, INPUT, SELECT } from '../ui';
import { yuklabOl, faylNomi } from '../../../lib/zip';
import { faylTuriNomi, type FaylTuri } from './faylTuri';
import type { ShablonTili } from './qrShablon';

// Word shablon: tanlangan fayl turiga mos bo'sh jadval (4 variantli — № | Savol | A–D(E) | Javob;
// MS-33-35, MS-36-45 va yozma — o'z jadvallari, qrShablon.ts). Ustoz to'ldirib, shu oynaning o'ziga
// yuklaydi — AI siz o'qiladi. 4 variantlida asosiy til — o'zbekcha; ruscha va inglizcha tarjima
// qatorlari qo'shilishi mumkin (ikkalasi ham).
const QOSHIMCHA_TILLAR: { til: ShablonTili; nom: string }[] = [
  { til: 'ru', nom: 'Ruscha' },
  { til: 'en', nom: 'Inglizcha' },
];

/** Har tur uchun: nima sanaladi, standart soni va oynadagi izoh. */
const TUR_MATNI: Record<FaylTuri, { nima: string; soni: number; izoh: string }> = {
  yopiq: { nima: 'Savollar soni', soni: 50, izoh: "Bo'sh jadval yuklab olinadi: har qatorga bitta savol, variantlar va to'g'ri javob harfi." },
  moslash: { nima: 'Guruhlar soni', soni: 10, izoh: "Har guruhga: umumiy shart, A–F javoblar ro'yxati va uchta savol (har biriga to'g'ri javob harfi). Ichida to'ldirilgan namuna bor." },
  qismli: { nima: 'Savollar soni', soni: 10, izoh: "Har savolga: umumiy shart va a), b) qismlari — har qismning o'z javobi. Ichida to'ldirilgan namuna bor." },
  yozma: { nima: 'Masalalar soni', soni: 10, izoh: "Har qatorga bitta masala; javob va yechim ustunlari ixtiyoriy — yechim bo'sh qolsa, yuklaganda AI batafsil yechim yozadi." },
};

export default function QrShablonTugma({ tur = 'yopiq' }: { /** «Fayldan» yo'lida tanlangan fayl turi. */ tur?: FaylTuri }) {
  const { showNotification } = useCRM();
  const [ochiq, setOchiq] = useState(false);
  // Soni har tur uchun alohida eslab qolinadi (tur almashsa — o'sha turning standarti).
  const [sonlar, setSonlar] = useState<Partial<Record<FaylTuri, number>>>({});
  const [variantlar, setVariantlar] = useState<4 | 5>(4);
  const [tillar, setTillar] = useState<ShablonTili[]>([]);
  const [nom, setNom] = useState('');
  const [band, setBand] = useState(false);
  const matn = TUR_MATNI[tur];
  const soni = sonlar[tur] ?? matn.soni;
  const turNomi = faylTuriNomi(tur);

  const yukla = async () => {
    setBand(true);
    try {
      const { shablonYasa } = await import('./qrShablon');
      const fayl = nom.trim() || `${turNomi} shabloni — ${soni} ta`;
      yuklabOl(await shablonYasa({ tur, soni, variantlar, tillar, nom: fayl }), `${faylNomi(fayl)}.docx`);
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
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-matn-sokin hover:text-brand cursor-pointer w-fit"><FileDown size={13} /> Word shablon — {turNomi}</button>
      {ochiq && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30" onClick={() => setOchiq(false)} />
        <div className="relative w-full max-w-sm rounded-xl border border-chiziq bg-sirt shadow-2xl p-3.5 space-y-3" role="dialog" aria-label="Word shablon">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-bold text-matn">Word shablon — {turNomi}</p>
            <button aria-label="Yopish" onClick={() => setOchiq(false)} className="p-1 -m-1 rounded text-matn-xira hover:text-matn cursor-pointer"><X size={14} /></button>
          </div>
          <p className="text-[12px] text-matn-sokin">{matn.izoh} To'ldirib, shu yerga yuklaysiz — savollar jadvaldagi tartibda tushadi.</p>
          <label className="block text-[12px] font-semibold text-matn-sokin">Fayl nomi
            <input className={`${INPUT} mt-1 py-1.5`} value={nom} onChange={e => setNom(e.target.value)} placeholder="Funksiya — Milliy sertifikat 2026" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[12px] font-semibold text-matn-sokin">{matn.nima}
              <input type="number" min={1} max={1000} className={`${INPUT} mt-1 py-1.5`} value={soni} onChange={e => setSonlar(s => ({ ...s, [tur]: Math.max(1, Math.min(1000, Number(e.target.value) || 1)) }))} />
            </label>
            {tur === 'yopiq' && (
              <label className="block text-[12px] font-semibold text-matn-sokin">Variantlar
                <select className={`${SELECT} mt-1 py-1.5`} value={variantlar} onChange={e => setVariantlar(Number(e.target.value) as 4 | 5)}>
                  <option value={4}>4 ta (A–D)</option><option value={5}>5 ta (A–E)</option>
                </select>
              </label>
            )}
          </div>
          {tur === 'yopiq' && (
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
          )}
          <Tugma turi="asosiy" kichik className="w-full justify-center" ikonka={<FileDown size={13} />} yuklanmoqda={band} onClick={yukla}>Yuklab olish (.docx)</Tugma>
        </div>
        </div>
      )}
    </span>
  );
}
