import React, { useSyncExternalStore } from 'react';
import type { Qiyinlik } from '../../../types';

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

// --- Foydalanuvchi qo'shgan darajalar ("Juda oson", "Juda qiyin"…) --------------------------------
//
// Asosiy uch o'rindan tashqari foydalanuvchi bankda o'z darajalarini qo'shadi. Ular savolda belgi
// (QuestionTag, guruh turi 'qiyinlik') bo'lib saqlanadi; `asos` — qaysi asosiy o'ringa kirishi (rangi
// va imtihon qoidalaridagi qiyinligi). Ro'yxat serverdan `useDarajalar` orqali keladi.

export interface OzDaraja { id: number; nom: string; asos: Qiyinlik }
/** Tanlangan daraja: asosiy o'rin (`darajaId: null`) yoki foydalanuvchining o'z darajasi. */
export interface DarajaQiymati { d: Qiyinlik; darajaId: number | null }
/** Ro'yxatdagi bitta daraja (asosiy yoki foydalanuvchiniki) — osondan qiyinga tartibda. */
export interface DarajaBandi extends DarajaQiymati { kalit: string; nom: string; rang: QiyinlikDarajasi }

let ozDarajalar: OzDaraja[] = [];

/** Serverdan kelgan (yoki bankda hozirgina o'zgargan) foydalanuvchi darajalari. */
export function darajalarniSozla(royxat: { id: number; name: string; asos?: number | null }[]) {
  const yangi = royxat.map(t => ({ id: t.id, nom: t.name, asos: qiyinlikDaraja(t.asos || 2).d }));
  if (JSON.stringify(yangi) === JSON.stringify(ozDarajalar)) return;
  ozDarajalar = yangi;
  versiya++;
  tinglovchilar.forEach(f => f());
}

/**
 * Hamma darajalar bitta ro'yxatda (bank ro'yxatidagi kabi): har asosiy o'rin (olib tashlanmagan bo'lsa)
 * va undan keyin shu o'ringa kiradigan foydalanuvchi darajalari. `tanlangan` — olib tashlangan asosiy
 * o'rin ham ko'rinsin (savolda shu daraja turgan bo'lsa).
 */
export function hammaDarajalar(tanlangan?: DarajaQiymati | null): DarajaBandi[] {
  return QIYINLIK.flatMap(q => [
    ...(!q.yashirin || (tanlangan && !tanlangan.darajaId && tanlangan.d === q.d) ? [{ kalit: `q${q.d}`, nom: q.nom, d: q.d, darajaId: null, rang: q }] : []),
    ...ozDarajalar.filter(x => x.asos === q.d).map(x => ({ kalit: `t${x.id}`, nom: x.nom, d: q.d, darajaId: x.id, rang: q })),
  ]);
}

/** Qiymatga mos band: foydalanuvchi darajasi o'chirilgan bo'lsa — uning asosiy o'rni. */
export function darajaBandi(q: DarajaQiymati): DarajaBandi {
  const oz = q.darajaId ? ozDarajalar.find(x => x.id === q.darajaId) : null;
  const rang = qiyinlikDaraja(oz ? oz.asos : q.d);
  return oz ? { kalit: `t${oz.id}`, nom: oz.nom, d: rang.d, darajaId: oz.id, rang } : { kalit: `q${rang.d}`, nom: rang.nom, d: rang.d, darajaId: null, rang };
}

/** Standart daraja: o'rta (olib tashlangan bo'lsa — ro'yxatdagi eng yaqini). */
export function boshDaraja(d: number = 2): DarajaQiymati {
  const ochiq = korinadiganQiyinlik().map(q => q.d);
  const x = qiyinlikDaraja(d).d;
  const yaqin = !ochiq.length || ochiq.includes(x) ? x : [...ochiq].sort((a, b) => Math.abs(a - x) - Math.abs(b - x) || a - b)[0];
  return { d: yaqin, darajaId: null };
}

/**
 * Savolni saqlashda: qiyinlik va (foydalanuvchi darajasi bo'lsa) uning belgisi — bank ro'yxati
 * darajani shu belgidan taniydi (`savolDarajasi`).
 */
export function darajaMaydonlari(q: DarajaQiymati): { difficulty: Qiyinlik; tagIds?: number[] } {
  const b = darajaBandi(q);
  return b.darajaId ? { difficulty: b.d, tagIds: [b.darajaId] } : { difficulty: b.d };
}

/**
 * Darajani tanlash — HAMMA darajalar: asosiylari (olib tashlanmaganlari) va foydalanuvchi qo'shganlari.
 * `kichik` — savol kartasi ichida: darajalar ko'p bo'lsa (4 tadan ortiq) ixcham ro'yxat bo'lib chiqadi.
 */
export function DarajaTanlov({ qiymat, onChange, kichik, band }: { qiymat: DarajaQiymati; onChange: (q: DarajaQiymati) => void; kichik?: boolean; band?: boolean }) {
  useQiyinlik();
  const joriy = darajaBandi(qiymat);
  const royxat = hammaDarajalar(joriy);
  if (kichik && royxat.length > 4) {
    return (
      <span className={`inline-flex items-center gap-1.5 max-w-full rounded-lg border px-2 py-1 ${joriy.rang.fon} ${joriy.rang.chiziq}`}>
        <span className={`w-2 h-2 shrink-0 rounded-full ${joriy.rang.nuqta}`} />
        <select aria-label="Qiyinlik" disabled={band} value={joriy.kalit} className={`max-w-full bg-transparent text-[12px] font-semibold outline-none cursor-pointer ${joriy.rang.matn}`}
          onChange={(e) => { const b = royxat.find(x => x.kalit === e.target.value); if (b) onChange({ d: b.d, darajaId: b.darajaId }); }}>
          {royxat.map(b => <option key={b.kalit} value={b.kalit} className="text-matn bg-sirt">{b.nom}</option>)}
        </select>
      </span>
    );
  }
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-chiziq bg-ichki p-0.5 gap-0.5" role="radiogroup" aria-label="Qiyinlik">
      {royxat.map((b) => {
        const tanlangan = b.kalit === joriy.kalit;
        return (
          <button key={b.kalit} type="button" role="radio" aria-checked={tanlangan} disabled={band} onClick={() => onChange({ d: b.d, darajaId: b.darajaId })}
            className={`inline-flex items-center gap-1.5 rounded-[10px] border font-semibold cursor-pointer transition-colors disabled:opacity-60 ${kichik ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[12.5px]'} ${tanlangan ? `${b.rang.fon} ${b.rang.matn} ${b.rang.chiziq} shadow-sm` : 'border-transparent text-matn-sokin hover:text-matn'}`}>
            <span className={`w-2 h-2 rounded-full ${b.rang.nuqta}`} />{b.nom}
          </button>
        );
      })}
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
