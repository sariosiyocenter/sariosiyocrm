import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Tugma, INPUT, SELECT, Maydon } from '../ui';
import { formulaliHtml, SAVOL_MATNI } from '../../../lib/matn';
import { HARFLAR } from '../../../../lib/imtihon.js';
import { bolimlarga } from './useBankDaraxt';
import type { BankFan, SavolTuri } from '../../../types';

// AI bilan savol kiritish oynalari uchun umumiy bo'laklar (SavolYuklash —
// fayldan savollar, AiTuzish — AI tuzadi, OxshashSavollar — bankdagi savolga
// o'xshashlar): rasm tayyorlash, bank HTML ↔ oddiy matn, savol ko'rinishi va
// tuzatish shakli, yozma masalani yechtirish.

export interface AiSavol {
  type: SavolTuri; text: string; options: string[] | null; correctAnswer: string; difficulty: number;
  language?: string; solution: string | null; solutionStatus?: string; xato?: string | null;
  /**
   * Savolning chizmasi (havola) — bankka `Question.imageUrl` bo'lib yoziladi. AI rasm o'rniga matnda
   * «[rasm]» belgisini qoldiradi; chizmani AI vektor qilib chizadi (rasmNavbati.tsx) — chizilgach
   * belgi matndan olinadi va havola shu maydonga tushadi.
   */
  imageUrl?: string | null;
}
export type Tekshiruv = { tekshirildi: boolean | null; aiJavobi: string };
export type Soro = <T = any>(usul: string, yol: string, body?: any) => Promise<T>;

/** Yozma masalalar bitta so'rovda nechtadan yechiladi (batafsil yechim uzun — so'rov qisqa qolsin). */
export const YECHISH_BOLAGI = 2;
/**
 * Yozma masalalarni AI ga yechtiradi (bitta qisqa so'rov): har biriga batafsil, qadamma-qadam yechim.
 * `rasmlar` — masalalar olingan sahifalar (matnda «[rasm]» bo'lsa, chizma o'sha yerdan ko'rinadi).
 * Yechilmagani — bo'sh yechim bilan qaytadi.
 */
export async function yechimSora(soro: Soro, savollar: (AiSavol & { /** Ustoz bergan yakuniy javob — yechim shunga olib kelishi kerak. */ ustozJavobi?: string })[], fan: string, rasmlar: string[] = []): Promise<{ yechim: string; javob: string }[]> {
  const r = await soro<{ natijalar: { yechim: string; javob: string }[] }>('POST', 'ai/yech', {
    fan, rasmlar: rasmlar.slice(0, 3),
    savollar: savollar.map(q => ({ type: 'yozma', text: q.text, javob: q.ustozJavobi || '', language: q.language || 'uz' })),
  });
  return savollar.map((_, i) => r.natijalar?.[i] || { yechim: '', javob: '' });
}

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
/**
 * Tahrirdan keyingi HTML. Tahrir maydoni oddiy matn — rasm (<img>) unda ko'rinmaydi, shuning uchun: matn
 * o'zgarmagan bo'lsa asl HTML qaytadi (rasmlari o'z joyida); o'zgargan bo'lsa — yangi matn va asl rasmlar
 * (oxirida). Aks holda Word shablonidan kelgan chizma savolni bir marta tahrirlash bilan yo'qolib qolardi.
 */
export function tahrirHtml(asl: string | null | undefined, matn: string): string {
  const a = String(asl || '');
  if (matn.trim() === htmlMatnga(a)) return a;
  return matnHtmlga(matn) + (a.match(/<img\b[^>]*>/gi) || []).join('');
}
export const matniBor = (html: string | null | undefined) => !!htmlMatnga(html);
/** Mazmuni bor: matn yoki rasm (savol faqat chizmadan iborat bo'lishi mumkin). */
export const mazmuniBor = (html: string | null | undefined) => matniBor(html) || /<img\b/i.test(String(html || ''));
export const izi = (html: string) => htmlMatnga(html).toLowerCase().replace(/\s+/g, '');

/** Server xatosi → tushunarli matn (Vercel vaqt chegarasi, katta rasm). */
export function xatoMatni(e: any): string {
  if (e?.status === 504 || /\(504\)/.test(e?.message || '')) return "AI javobi kechikdi — sonini kamaytirib (3 yoki 5) qayta urinib ko'ring";
  if (e?.status === 413 || /\(413\)/.test(e?.message || '')) return 'Rasm juda katta — kichikroq surat oling';
  return e?.message || 'Xatolik';
}

/**
 * Savol ko'rinishi: formulalar, (bo'lsa) chizma, variantlar (to'g'risi yashil), javob, yechim.
 * Yozma masalada yechim — asosiy narsa: ochiq turadi (boshqa turlarda — yopiq).
 */
export function Korinish({ q, onJavob, rasmsiz }: {
  q: AiSavol; onJavob?: (javob: string) => void;
  /** Chizmani karta o'zi ko'rsatadi (chizma bloki — rasmNavbati.tsx SavolRasmi): bu yerda takrorlanmaydi. */
  rasmsiz?: boolean;
}) {
  const togri = HARFLAR.indexOf(String(q.correctAnswer || '').toUpperCase());
  return (
    <div className="space-y-2 min-w-0">
      <div className={`${SAVOL_MATNI} text-[14px] text-matn break-words`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.text) }} />
      {q.imageUrl && !rasmsiz && <img src={q.imageUrl} alt="Savol chizmasi" className="max-h-64 max-w-full rounded-lg border border-chiziq bg-white" />}
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
        <details open={q.type === 'yozma'} className="rounded-lg border border-chiziq bg-sirt px-3 py-2 group">
          <summary className="text-[12px] font-semibold text-matn-sokin cursor-pointer select-none">{q.type === 'yozma' ? 'Yechim (batafsil)' : 'Yechim'}</summary>
          <div className={`${SAVOL_MATNI} text-[13px] text-matn mt-1.5 break-words [&_p]:my-1.5`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.solution) }} />
        </details>
      )}
    </div>
  );
}

/**
 * Fan va mavzu tanlash (AI tuzadigan oynalarda — savollar qaysi mavzuga tushishi): fanning mavzulari
 * bo'limlari bilan, «+ Yangi mavzu…». `kutilgan` — bank ro'yxatidan kelgan, daraxtda hali ko'rinmagan
 * (hozirgina yaratilgan) mavzu.
 */
export function FanMavzuTanlov({ fanlar, fan, mavzuId, yangiMavzu, kutilgan, band, onFan, onMavzu, onYangiMavzu }: {
  fanlar: BankFan[]; fan: BankFan | null; mavzuId: number | null;
  /** null — ro'yxatdan tanlanadi; matn — yangi mavzu nomi yozilmoqda. */
  yangiMavzu: string | null;
  kutilgan?: { id: number; nom: string } | null; band?: boolean;
  onFan: (id: number | null) => void; onMavzu: (id: number | null) => void; onYangiMavzu: (nom: string | null) => void;
}) {
  const tanlangan = fan?.mavzular.some(m => m.id === mavzuId) || (kutilgan && kutilgan.id === mavzuId) ? mavzuId ?? '' : '';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Maydon nom="Fan">
        <select className={SELECT} value={fan?.id ?? ''} aria-label="Fan" disabled={band} onChange={e => onFan(Number(e.target.value) || null)}>
          <option value="">Fanni tanlang</option>
          {fanlar.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </Maydon>
      <Maydon nom="Mavzu">
        {yangiMavzu !== null ? (
          <div className="flex items-center gap-1.5">
            <input autoFocus className={INPUT} value={yangiMavzu} placeholder="Yangi mavzu nomi" aria-label="Yangi mavzu nomi" maxLength={200} onChange={e => onYangiMavzu(e.target.value)} />
            <Tugma kichik turi="oddiy" ikonka={<X size={13} />} onClick={() => onYangiMavzu(null)} aria-label="Bekor" />
          </div>
        ) : (
          <select className={SELECT} value={tanlangan} disabled={!fan || band} aria-label="Mavzu"
            onChange={e => (e.target.value === 'yangi' ? onYangiMavzu('') : onMavzu(Number(e.target.value) || null))}>
            <option value="">{fan ? 'Mavzuni tanlang' : 'Avval fanni tanlang'}</option>
            {kutilgan && !fan?.mavzular.some(m => m.id === kutilgan.id) && <option value={kutilgan.id}>{kutilgan.nom}</option>}
            {fan && bolimlarga(fan.mavzular).map(g => (g.bolim
              ? <optgroup key={g.bolim + g.mavzular[0].id} label={g.bolim}>{g.mavzular.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
              : g.mavzular.map(m => <option key={m.id} value={m.id}>{m.name}</option>)))}
            {fan && <option value="yangi">+ Yangi mavzu…</option>}
          </select>
        )}
      </Maydon>
    </div>
  );
}

/** Savolni tuzatish: matn ($...$ formulalar bilan), variantlar, javob, yechim. */
export function Tahrir({ q, onSaqla, onBekor }: { q: AiSavol; onSaqla: (q: AiSavol) => void; onBekor: () => void }) {
  const [matn, setMatn] = useState(() => htmlMatnga(q.text));
  const [variantlar, setVariantlar] = useState(() => (q.options || []).map(htmlMatnga));
  const [javob, setJavob] = useState(q.correctAnswer || '');
  const [yechim, setYechim] = useState(() => htmlMatnga(q.solution));
  // Rasmlar (Word shablonidan kelgan chizmalar) tahrirda yo'qolmaydi — tahrirHtml.
  const tayyor: AiSavol = {
    ...q, text: tahrirHtml(q.text, matn), options: q.type === 'yopiq' ? variantlar.map((v, i) => tahrirHtml(q.options?.[i], v)) : null,
    correctAnswer: javob.trim(), solution: yechim.trim() ? tahrirHtml(q.solution, yechim) : null,
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
      <Maydon nom="Yechim" izoh={q.type === 'yozma' ? "Bo'sh qator — yangi qadam (xatboshi)" : undefined}>
        <textarea rows={q.type === 'yozma' ? 10 : 3} className={INPUT} value={yechim} onChange={e => setYechim(e.target.value)} aria-label="Yechim" />
      </Maydon>
      {mazmuniBor(tayyor.text) && (
        <div className="rounded-xl border border-dashed border-chiziq p-3">
          <p className="text-[11px] font-semibold text-matn-xira mb-1.5">Ko'rinishi</p>
          <Korinish q={tayyor} />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Tugma kichik onClick={onBekor}>Bekor</Tugma>
        <Tugma kichik turi="asosiy" ikonka={<Check size={13} />} disabled={!mazmuniBor(tayyor.text)} onClick={() => onSaqla(tayyor)}>Tayyor</Tugma>
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
