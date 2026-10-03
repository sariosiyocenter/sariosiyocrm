import React, { useSyncExternalStore } from 'react';
import type { Qiyinlik, QiyinlikSoni } from '../../../types';

// Qiyinlik uch o'rinda (1 — yashil, 2 — sariq, 3 — qizil) va hamma joyda bir xil rangda:
// bank, savol muharriri, imtihon tuzish. Nomlari standart bo'yicha oson / o'rta / qiyin,
// lekin foydalanuvchi bankda nomini o'zgartirishi yoki keraksizini olib tashlashi mumkin
// (masalan faqat ikkita daraja) — sozlama serverdan keladi (bank/daraxt → qiyinlikniSozla).

export interface QiyinlikDarajasi { d: Qiyinlik; nom: string; matn: string; fon: string; chiziq: string; nuqta: string; /** Foydalanuvchi olib tashlagan. */ yashirin?: boolean }

const ASL_NOMLAR = ['Oson', "O'rta", 'Qiyin'];
export const RANG_NOMLARI = ['Yashil', 'Sariq', 'Qizil'];
export const QIYINLIK: QiyinlikDarajasi[] = [
  { d: 1, nom: ASL_NOMLAR[0], matn: 'text-yaxshi', fon: 'bg-yaxshi-fon', chiziq: 'border-yaxshi/30', nuqta: 'bg-yaxshi' },
  { d: 2, nom: ASL_NOMLAR[1], matn: 'text-ogoh', fon: 'bg-ogoh-fon', chiziq: 'border-ogoh/30', nuqta: 'bg-ogoh' },
  { d: 3, nom: ASL_NOMLAR[2], matn: 'text-xato', fon: 'bg-xato-fon', chiziq: 'border-xato-chiziq', nuqta: 'bg-xato' },
];

const tinglovchilar = new Set<() => void>();
let versiya = 0;
// Ekranda (server javobini kutmasdan) qilingan o'zgarishlar soni: so'rov ketganidan keyin
// ekranda o'zgarish bo'lgan bo'lsa, o'sha so'rovning javobi eskirgan — qo'llanmaydi.
let mahalliy = 0;
export const qiyinlikMahalliyVersiya = () => mahalliy;

/**
 * Serverdan kelgan (yoki ekranda hozirgina o'zgargan — `mahalliy`) sozlama: darajalar nomi va
 * olib tashlangani. `agar` — so'rov ketgan paytdagi qiyinlikMahalliyVersiya(): mos kelmasa tashlanadi.
 */
export function qiyinlikniSozla(sozlama?: { d: number; nom?: string; yashirin?: boolean }[] | null, tanlov?: { mahalliy?: boolean; agar?: number }) {
  if (tanlov?.agar !== undefined && tanlov.agar !== mahalliy) return;
  if (tanlov?.mahalliy) mahalliy++;
  let ozgardi = false;
  QIYINLIK.forEach((q, i) => {
    const s = sozlama?.find(x => x.d === q.d);
    const nom = (s?.nom || '').trim() || ASL_NOMLAR[i];
    const yashirin = !!s?.yashirin;
    if (q.nom !== nom || !!q.yashirin !== yashirin) { q.nom = nom; q.yashirin = yashirin; ozgardi = true; }
  });
  if (ozgardi) { versiya++; tinglovchilar.forEach(f => f()); }
}

/** Hozirgi sozlama (o'zgartirib, qiyinlikniSozla ga qaytarish uchun). */
export const qiyinlikSozlamasi = () => QIYINLIK.map(q => ({ d: q.d as number, nom: q.nom, yashirin: !!q.yashirin }));
/** Tanlash uchun ko'rsatiladigan darajalar (olib tashlanganlarisiz). */
export const korinadiganQiyinlik = () => QIYINLIK.filter(q => !q.yashirin);

/** Sozlama o'zgarsa komponent qayta chiziladi. */
export function useQiyinlik() {
  return useSyncExternalStore(cb => { tinglovchilar.add(cb); return () => { tinglovchilar.delete(cb); }; }, () => versiya);
}

export const qiyinlikDaraja = (d: number | null | undefined) => QIYINLIK[Math.min(3, Math.max(1, Number(d) || 1)) - 1];

/** "● Oson 5" — qiyinlik va (ixtiyoriy) soni. Olib tashlangan darajaning nol soni ko'rsatilmaydi. */
export function QiyinlikYorligi({ d, soni, xira, nom }: { d: number; soni?: number; xira?: boolean; /** Foydalanuvchi darajasi nomi ("Juda oson") — rangi asosiy guruhniki. */ nom?: string }) {
  useQiyinlik();
  const q = qiyinlikDaraja(d);
  if (q.yashirin && soni !== undefined && !soni) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${xira ? 'border-chiziq bg-ichki text-matn-xira' : `${q.fon} ${q.matn} ${q.chiziq}`}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${xira ? 'bg-matn-xira/50' : q.nuqta}`} />
      {nom || q.nom}{soni !== undefined && <span className="raqam">{soni}</span>}
    </span>
  );
}

/** Darajalar ulushi bitta chiziqda. */
export function QiyinlikChizigi({ soni, className = 'h-1.5' }: { soni: QiyinlikSoni; className?: string }) {
  useQiyinlik();
  const jami = soni[0] + soni[1] + soni[2];
  return (
    <div className={`flex rounded-full overflow-hidden bg-ichki ${className}`} role="img" aria-label={QIYINLIK.filter(q => !q.yashirin || soni[q.d - 1]).map(q => `${q.nom} ${soni[q.d - 1]}`).join(', ')}>
      {jami > 0 && soni.map((n, i) => n > 0 && <div key={i} className={QIYINLIK[i].nuqta} style={{ width: `${(n / jami) * 100}%` }} />)}
    </div>
  );
}

/** Qiyinlikni tanlash — rangli tugmalar (olib tashlangan daraja faqat tanlangan bo'lsa ko'rinadi). */
export function QiyinlikTanlov({ qiymat, onChange, kichik }: { qiymat: number; onChange: (d: Qiyinlik) => void; kichik?: boolean }) {
  useQiyinlik();
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-chiziq bg-ichki p-0.5 gap-0.5" role="radiogroup" aria-label="Qiyinlik">
      {QIYINLIK.filter(q => !q.yashirin || qiymat === q.d).map(q => {
        const tanlangan = qiymat === q.d;
        return (
          <button key={q.d} type="button" role="radio" aria-checked={tanlangan} onClick={() => onChange(q.d)}
            className={`inline-flex items-center gap-1.5 rounded-[10px] border font-semibold cursor-pointer transition-colors ${kichik ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[12.5px]'} ${tanlangan ? `${q.fon} ${q.matn} ${q.chiziq} shadow-sm` : 'border-transparent text-matn-sokin hover:text-matn'}`}>
            <span className={`w-2 h-2 rounded-full ${q.nuqta}`} />{q.nom}
          </button>
        );
      })}
    </div>
  );
}
