import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Tugma, INPUT, Maydon } from '../ui';
import { formulaliHtml, SAVOL_MATNI } from '../../../lib/matn';
import { HARFLAR } from '../../../../lib/imtihon.js';
import type { SavolTuri } from '../../../types';

// AI bilan savol kiritish oynalari uchun umumiy bo'laklar (SavolYuklash —
// fayl/kameradan savollar, OxshashSavollar — o'xshash masalalar): rasm
// tayyorlash, bank HTML ↔ oddiy matn, savol ko'rinishi va tuzatish shakli.

export interface AiSavol {
  type: SavolTuri; text: string; options: string[] | null; correctAnswer: string; difficulty: number;
  language?: string; solution: string | null; solutionStatus?: string; xato?: string | null;
}
export type Tekshiruv = { tekshirildi: boolean | null; aiJavobi: string };

/** Rasm yoki PDF ning 1-sahifasi → JPEG data URL (1600px gacha) — so'rov kichik bo'lsin. */
export async function rasmTayyorla(fayl: File): Promise<string> {
  const { faylSahifalari } = await import('../../../lib/omr/skaner');
  for await (const { bitmap } of faylSahifalari(fayl)) {
    const k = Math.min(1, 1600 / bitmap.width, 2200 / bitmap.height);
    const c = document.createElement('canvas');
    c.width = Math.round(bitmap.width * k);
    c.height = Math.round(bitmap.height * k);
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bitmap, 0, 0, c.width, c.height);
    bitmap.close();
    return c.toDataURL('image/jpeg', 0.85);
  }
  throw new Error("Faylni o'qib bo'lmadi");
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Bank HTML i → tahrir uchun oddiy matn (formulalar $...$ bo'lib qoladi). */
export function htmlMatnga(html: string | null | undefined): string {
  const s = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>\s*/gi, '\n\n');
  const doc = new DOMParser().parseFromString(`<div>${s}</div>`, 'text/html');
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}
/** Oddiy matn → bank HTML i (bo'sh qator — yangi paragraf). */
export function matnHtmlga(s: string): string {
  const t = s.replace(/\r\n/g, '\n').trim();
  return t ? t.split(/\n{2,}/).map(p => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('') : '';
}
export const matniBor = (html: string | null | undefined) => !!htmlMatnga(html);
export const izi = (html: string) => htmlMatnga(html).toLowerCase().replace(/\s+/g, '');

/** Server xatosi → tushunarli matn (Vercel vaqt chegarasi, katta rasm). */
export function xatoMatni(e: any): string {
  if (e?.status === 504 || /\(504\)/.test(e?.message || '')) return "AI javobi kechikdi — sonini kamaytirib (3 yoki 5) qayta urinib ko'ring";
  if (e?.status === 413 || /\(413\)/.test(e?.message || '')) return 'Rasm juda katta — kichikroq surat oling';
  return e?.message || 'Xatolik';
}

/** Savol ko'rinishi: formulalar, variantlar (to'g'risi yashil), javob, yechim. */
export function Korinish({ q, onJavob }: { q: AiSavol; onJavob?: (javob: string) => void }) {
  const togri = HARFLAR.indexOf(String(q.correctAnswer || '').toUpperCase());
  return (
    <div className="space-y-2 min-w-0">
      <div className={`${SAVOL_MATNI} text-[14px] text-matn break-words`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.text) }} />
      {q.type === 'yopiq' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {(q.options || []).map((o, i) => {
            const sinf = `flex gap-2 rounded-lg border px-3 py-1.5 text-left text-[13px] min-w-0 ${i === togri ? 'border-yaxshi/50 bg-yaxshi-fon' : 'border-chiziq bg-sirt'}`;
            const ichi = <><b>{HARFLAR[i]})</b><span className="text-matn break-words min-w-0" dangerouslySetInnerHTML={{ __html: formulaliHtml(o) }} /></>;
            // Bosilmaydigan joyda (masalan tanlash tugmasi ichida) — oddiy blok: tugma ichida tugma bo'lmasin.
            return onJavob
              ? <button key={i} type="button" onClick={() => onJavob(HARFLAR[i])} title="To'g'ri javob qilish" className={`${sinf} cursor-pointer hover:border-brand/40`}>{ichi}</button>
              : <div key={i} className={sinf}>{ichi}</div>;
          })}
        </div>
      )}
      {q.type === 'raqamli' && <p className="text-[13px] text-matn"><b>Javob:</b> <span className="raqam">{q.correctAnswer || '—'}</span></p>}
      {q.solution && (
        <details className="rounded-lg border border-chiziq bg-sirt px-3 py-2 group">
          <summary className="text-[12px] font-semibold text-matn-sokin cursor-pointer select-none">Yechim</summary>
          <div className={`${SAVOL_MATNI} text-[13px] text-matn mt-1.5 break-words`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.solution) }} />
        </details>
      )}
    </div>
  );
}

/** Savolni tuzatish: matn ($...$ formulalar bilan), variantlar, javob, yechim. */
export function Tahrir({ q, onSaqla, onBekor }: { q: AiSavol; onSaqla: (q: AiSavol) => void; onBekor: () => void }) {
  const [matn, setMatn] = useState(() => htmlMatnga(q.text));
  const [variantlar, setVariantlar] = useState(() => (q.options || []).map(htmlMatnga));
  const [javob, setJavob] = useState(q.correctAnswer || '');
  const [yechim, setYechim] = useState(() => htmlMatnga(q.solution));
  const tayyor: AiSavol = {
    ...q, text: matnHtmlga(matn), options: q.type === 'yopiq' ? variantlar.map(matnHtmlga) : null,
    correctAnswer: javob.trim(), solution: yechim.trim() ? matnHtmlga(yechim) : null,
  };
  return (
    <div className="space-y-3">
      <Maydon nom="Masala matni" izoh="Formula: $x^2+1$, kasr: $\frac{1}{2}$">
        <textarea rows={4} className={INPUT} value={matn} onChange={e => setMatn(e.target.value)} aria-label="Masala matni" />
      </Maydon>
      {q.type === 'yopiq' && (
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-matn-sokin">Variantlar — to'g'risini belgilang</p>
          {variantlar.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <button type="button" onClick={() => setJavob(HARFLAR[i])} aria-label={`${HARFLAR[i]} to'g'ri javob`}
                className={`w-8 h-8 shrink-0 rounded-full border-2 text-[12px] font-bold cursor-pointer ${javob === HARFLAR[i] ? 'bg-yaxshi border-yaxshi text-white' : 'border-chiziq-kuchli text-matn-sokin hover:border-yaxshi'}`}>{HARFLAR[i]}</button>
              <input className={`${INPUT} py-2`} value={v} aria-label={`${HARFLAR[i]} variant`} onChange={e => setVariantlar(l => l.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
        </div>
      )}
      {q.type === 'raqamli' && (
        <Maydon nom="To'g'ri javob"><input className={`${INPUT} max-w-40`} value={javob} onChange={e => setJavob(e.target.value)} inputMode="decimal" /></Maydon>
      )}
      <Maydon nom="Yechim"><textarea rows={3} className={INPUT} value={yechim} onChange={e => setYechim(e.target.value)} aria-label="Yechim" /></Maydon>
      {matniBor(tayyor.text) && (
        <div className="rounded-xl border border-dashed border-chiziq p-3">
          <p className="text-[11px] font-semibold text-matn-xira mb-1.5">Ko'rinishi</p>
          <Korinish q={tayyor} />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Tugma kichik onClick={onBekor}>Bekor</Tugma>
        <Tugma kichik turi="asosiy" ikonka={<Check size={13} />} disabled={!matniBor(tayyor.text)} onClick={() => onSaqla(tayyor)}>Tayyor</Tugma>
      </div>
    </div>
  );
}

/** Fayl (rasm yoki PDF ning hamma sahifasi, `maks` tagacha) → JPEG data URL lar. */
export async function sahifaRasmlari(fayl: File, maks = 40, onSahifa?: (n: number) => void): Promise<string[]> {
  const { faylSahifalari } = await import('../../../lib/omr/skaner');
  const out: string[] = [];
  for await (const { bitmap } of faylSahifalari(fayl)) {
    const k = Math.min(1, 1600 / bitmap.width, 2200 / bitmap.height);
    const c = document.createElement('canvas');
    c.width = Math.round(bitmap.width * k);
    c.height = Math.round(bitmap.height * k);
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bitmap, 0, 0, c.width, c.height);
    bitmap.close();
    out.push(c.toDataURL('image/jpeg', 0.85));
    onSahifa?.(out.length);
    if (out.length >= maks) break;
  }
  return out;
}
