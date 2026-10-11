import React from 'react';
import { X, Sparkles, Pencil, CheckCircle2, AlertTriangle, Loader2, Copy, FileSpreadsheet, FileText } from 'lucide-react';
import { Yorliq } from '../ui';
import { HARFLAR, raqamniTozala } from '../../../../lib/imtihon.js';
import { type AiSavol, type Tekshiruv, esc, htmlMatnga, izi } from './aiUmumiy';
import type { ExcelSavol } from './excel';
import type { WordNatija } from './word';
import type { ShablonNatija, JadvalSavol, JadvalYozma } from './wordShablon';
import { faylTuriNomi, guruhTurimi } from './faylTuri';
import { rasmYetishmaydi, type RasmHolati } from './rasmNavbati';

// «Savol qo'shish → Fayldan» oynasining (SavolYuklash.tsx) bo'laklari: yuklangan manbalar va o'qilgan savol
// turlari, javoblar kalitini ulash, savol kartasidagi belgilar va yuklangan fayllar ro'yxati.
export type Manba =
  | { kalit: number; tur: 'sahifa'; nom: string; rasm: string }
  | { kalit: number; tur: 'excel'; nom: string; savollar: ExcelSavol[]; xatolar: number }
  | ({ kalit: number; tur: 'word'; nom: string } & WordNatija)
  // To'ldirilgan Word shablon (jadval) — AI siz o'qiladi.
  | { kalit: number; tur: 'jadval'; nom: string; shablon: ShablonNatija };

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface Natija extends AiSavol {
  kalit: number;
  tanlangan: boolean;
  subject: string;
  topic: string;
  manba: 'ai' | 'excel' | 'jadval';
  /** Foydalanuvchining o'z qiyinlik darajasi (bo'lmasa — asosiy daraja, `difficulty`). */
  darajaId?: number | null;
  /** To'plam — qaysi fayldan (Addmen "QR file name"). */
  toplam?: string | null;
  tarjima?: JadvalSavol['tarjima'];
  raqam?: string | null;
  javobManbasi?: 'material' | 'ai' | null;
  /** Javob boshqa sahifadagi kalitdan olindi. */
  kalitdan?: boolean;
  takrorId?: number | null;
  matnId?: string | null;
  /** AI tekshiruviga yuborildi; natijasi `tekshiruv` da (undefined — kutilmoqda). */
  tekshiriladi?: boolean;
  tekshiruv?: Tekshiruv;
  tahrirlandi?: boolean;
  excel?: ExcelSavol;
  /** Qaysi AI so'rovidan (sahifalar to'plamidan) o'qildi — yozma masalani yechishda chizma o'sha sahifalardan ko'rinadi. */
  partiya?: number;
  /** Yozma: yechim kimniki — 'ustoz' (faylning o'zida), 'material' (AI materialdan ko'chirdi), 'ai' (AI yechdi). */
  yechimManbasi?: 'ustoz' | 'material' | 'ai' | null;
  /** Yozma: ustoz bergan yakuniy javob (Word shablonidagi «Javob» ustuni). */
  ustozJavobi?: string;
  yechilmoqda?: boolean;
  yechilmadi?: boolean;
  /** Chizma qo'yilishidan oldingi matn («[rasm]» belgisi yoki ichki rasmi bilan) — rasmNavbati.tsx. */
  aslMatn?: string;
  /** Chizma holati: navbatda, xato, kamchiliklar. */
  rasm?: RasmHolati;
}
export interface AiMatn { id: string; sarlavha: string; matn: string }
/** Mavzuni kim ajratadi: AI, hech kim («Noma'lum» mavzusi) yoki oldindan berilgan mavzu (faqat Zukko dan). */
export type MavzuRejimi = 'ai' | 'nomalum' | 'qatiy';

// Bitta so'rovda nechta sahifa: Vercel so'rov chegarasi 4,5 MB va vaqt chegarasi.
export const PARTIYA = 3;
export const MAKS_SAHIFA = 40;
export const TEKSHIRUV_BOLAGI = 12;
/** AI bir so'rovda nechta savolni mavzuga ajratadi. */
export const MAVZULASH_BOLAGI = 40;
export const KICHIK_SELECT = 'max-w-full px-2.5 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12.5px] text-matn outline-none focus:border-brand cursor-pointer';

/** To'plam nomi — fayl nomi kengaytmasiz (Addmen'da "QR file name"). */
export const toplamNomi = (nom: string) => nom.replace(/\.(docx?|xlsx?)$/i, '').trim().slice(0, 200);
export const bolaklar = <T,>(l: T[], n: number) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n));
export const javobQatori = (javob: string) => `Javob: ${esc(javob)}`;
/** Word shablonidagi yozma masalaning yechimi: ustozniki (bo'lsa), oxirida yakuniy javob. */
export const shablonYechimi = (y: JadvalYozma): string | null => (y.yechim
  ? `${y.yechim}${y.javob && !/javob\s*:/i.test(htmlMatnga(y.yechim)) ? `<br><br>${javobQatori(y.javob)}` : ''}`
  : null);

/** Materialdagi javoblar kaliti (boshqa sahifada bo'lsa ham) — savol raqami bo'yicha. */
export function kalitniUla(royxat: Natija[], kalitlar: { raqam: string; javob: string }[]) {
  const map = new Map<string, string | null>();
  for (const k of kalitlar) {
    const eski = map.get(k.raqam);
    if (eski === undefined) map.set(k.raqam, k.javob);
    else if (eski !== null && eski.toUpperCase() !== k.javob.toUpperCase()) map.set(k.raqam, null);   // ziddiyat — tegmaymiz
  }
  let soni = 0;
  const yangi = royxat.map((q) => {
    if (q.manba !== 'ai' || !q.raqam || q.type === 'yozma' || q.javobManbasi === 'material') return q;
    const j = map.get(q.raqam);
    if (!j) return q;
    let javob = '';
    if (q.type === 'yopiq') {
      const h = j.toUpperCase().replace(/[^A-F]/g, '').slice(0, 1);
      if (h && HARFLAR.indexOf(h) < (q.options || []).length) javob = h;
    } else javob = raqamniTozala(j);
    if (!javob) return q;
    soni++;
    const xato = (q.xato || '').split(', ').filter(x => x && x !== "to'g'ri javob topilmadi").join(', ') || null;
    return { ...q, correctAnswer: javob, javobManbasi: 'material' as const, kalitdan: true, xato };
  });
  return { yangi, soni };
}

/** Belgilar: tekshiruv, kalit, takror, kamchilik; yozma masalada — yechim holati. */
export function Belgilar({ n }: { n: Natija }) {
  return (
    <>
      {n.takrorId ? <Yorliq rang="ogoh"><Copy size={11} /> Bankda bor (#{n.takrorId})</Yorliq> : null}
      {n.manba === 'excel' && <Yorliq><FileSpreadsheet size={11} /> Excel</Yorliq>}
      {n.manba === 'jadval' && <Yorliq><FileText size={11} /> Word shablon</Yorliq>}
      {n.manba === 'jadval' && n.xato && <Yorliq rang="ogoh"><AlertTriangle size={11} /> {n.xato}</Yorliq>}
      {n.tahrirlandi ? <Yorliq rang="brand"><Pencil size={11} /> Tuzatildi</Yorliq>
        : n.tekshiriladi && !n.tekshiruv ? <Yorliq><Loader2 size={11} className="animate-spin" /> Tekshirilmoqda</Yorliq>
        : n.tekshiruv?.tekshirildi === true ? <Yorliq rang="yaxshi"><CheckCircle2 size={11} /> Javob to'g'ri</Yorliq>
        : n.tekshiruv?.tekshirildi === false ? <Yorliq rang="ogoh"><AlertTriangle size={11} /> AI boshqa javob chiqardi{n.tekshiruv.aiJavobi ? ` (${n.tekshiruv.aiJavobi})` : ''}</Yorliq>
        : null}
      {n.kalitdan && <Yorliq>Javob — kalitdan</Yorliq>}
      {n.manba === 'ai' && n.type !== 'yozma' && !n.correctAnswer && <Yorliq rang="ogoh"><AlertTriangle size={11} /> Javob topilmadi</Yorliq>}
      {n.type === 'yozma' && (
        n.yechilmoqda ? <Yorliq><Loader2 size={11} className="animate-spin" /> AI yechmoqda</Yorliq>
          : n.yechilmadi ? <Yorliq rang="ogoh"><AlertTriangle size={11} /> AI yecha olmadi</Yorliq>
          : !n.solution ? <Yorliq rang="ogoh"><AlertTriangle size={11} /> Yechimi yo'q</Yorliq>
          : n.yechimManbasi === 'ai' ? <Yorliq rang="brand"><Sparkles size={11} /> AI yechdi — yechimni tekshiring</Yorliq>
          : n.yechimManbasi === 'ustoz' ? <Yorliq rang="yaxshi"><CheckCircle2 size={11} /> Yechim — fayldan</Yorliq>
          : <Yorliq>Yechim — materialdan</Yorliq>
      )}
      {/* Chizmasi kerak, lekin hali yo'q («[rasm]» belgisi matnda): chizilmaguncha savol faol bo'lmaydi. */}
      {rasmYetishmaydi(n) && (n.rasm?.band
        ? <Yorliq><Loader2 size={11} className="animate-spin" /> Rasmi chizilmoqda</Yorliq>
        : <Yorliq rang="ogoh"><AlertTriangle size={11} /> Rasmi yo'q — qoralama bo'ladi</Yorliq>)}
    </>
  );
}

/**
 * Takrorni aniqlash uchun iz: matn va rasmlari. AI siz o'qilgan savolda (Word shablon, Excel) variantlari ham —
 * sharti bir xil, variantlari boshqa savollar (masalan «Hisoblang:») takror emas.
 */
export function savolIzi(q: Natija): string {
  const asos = izi(q.text) + (q.text.match(/<img\b[^>]*>/gi) || []).join('');
  return !asos || q.manba === 'ai' ? asos : `${asos}|${(q.options || []).map(o => izi(o)).join('|')}`;
}

/** Word shablondan o'qilgan savollar soni (guruhli savol — bitta). */
export const jadvalSoni = (j: ShablonNatija) => j.savollar.length + j.guruhlar.length + j.yozmalar.length;

/** Yuklangan manbalar: sahifa suratlari, Excel, Word shablon va AI o'qiydigan Word fayllar (har birini olib tashlasa bo'ladi). */
export function ManbalarRoyxati({ manbalar, band, aiBor, onOl }: { manbalar: Manba[]; band: boolean; aiBor: boolean; onOl: (kalit: number) => void }) {
  const sahifalar = manbalar.filter((m): m is Extract<Manba, { tur: 'sahifa' }> => m.tur === 'sahifa');
  const excellar = manbalar.filter((m): m is Extract<Manba, { tur: 'excel' }> => m.tur === 'excel');
  const wordlar = manbalar.filter((m): m is Extract<Manba, { tur: 'word' }> => m.tur === 'word');
  const jadvallar = manbalar.filter((m): m is Extract<Manba, { tur: 'jadval' }> => m.tur === 'jadval');
  if (!manbalar.length) return null;
  return (
    <div className="space-y-2">
      {sahifalar.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {sahifalar.map((s, i) => (
            <div key={s.kalit} className="relative rounded-lg border border-chiziq bg-white overflow-hidden aspect-[3/4]">
              <img src={s.rasm} alt={`${i + 1}-sahifa`} className="w-full h-full object-contain" />
              <span className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 text-[11px] font-semibold text-white raqam">{i + 1}</span>
              <button type="button" aria-label={`${i + 1}-sahifani olib tashlash`} disabled={band} onClick={() => onOl(s.kalit)}
                className="absolute right-1 top-1 w-6 h-6 rounded-md bg-black/60 text-white flex items-center justify-center cursor-pointer"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
      {excellar.map(e => (
        <div key={e.kalit} className="flex items-center justify-between gap-2 rounded-xl border border-chiziq bg-sirt px-3 py-2 text-[12.5px]">
          <span className="inline-flex items-center gap-2 min-w-0 text-matn"><FileSpreadsheet size={15} className="text-yaxshi shrink-0" /><span className="truncate">{e.nom}</span>
            <span className="text-matn-xira shrink-0">· {e.savollar.length} ta savol{e.xatolar ? `, ${e.xatolar} ta xato qator` : ''}</span></span>
          <button type="button" aria-label="Olib tashlash" onClick={() => onOl(e.kalit)} className="p-1 rounded text-matn-xira hover:text-xato cursor-pointer"><X size={14} /></button>
        </div>
      ))}
      {jadvallar.map(j => {
        const s = j.shablon;
        const chala = s.savollar.filter(q => q.xato).length + s.yozmalar.filter(q => q.xato).length + s.guruhlar.filter(g => g.xato || g.chala).length;
        const yechimsiz = s.yozmalar.filter(y => !y.yechim).length;
        return (
          <div key={j.kalit} className="rounded-xl border border-chiziq bg-sirt px-3 py-2 text-[12.5px]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 min-w-0 text-matn"><FileText size={15} className="text-brand shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate">{j.nom}</span>
                  <span className="block text-[11.5px] text-matn-xira">
                    Word shablon · {faylTuriNomi(s.tur)} · {jadvalSoni(s)} ta {guruhTurimi(s.tur) ? 'guruhli savol' : s.tur === 'yozma' ? 'masala' : 'savol'}
                    {chala ? ` · ${chala} tasi chala` : ''}{yechimsiz ? ` · ${yechimsiz} tasi${aiBor ? 'ni AI yechadi' : 'ning yechimi yo\'q'}` : ''}
                  </span>
                </span>
              </span>
              <button type="button" aria-label="Olib tashlash" disabled={band} onClick={() => onOl(j.kalit)} className="p-1 rounded text-matn-xira hover:text-xato cursor-pointer"><X size={14} /></button>
            </div>
            {s.oqilmagan > 0 && (
              <p className="mt-1.5 flex gap-1.5 text-[12px] text-ogoh"><AlertTriangle size={13} className="mt-[2px] shrink-0" />
                <span>{s.oqilmagan} ta formula yoki rasm eski formatda (MathType, WMF) — shu savollar qoralama bo'ladi. Word'da formulalarni yangi formatga o'tkazib qayta yuklang.</span></p>
            )}
          </div>
        );
      })}
      {wordlar.map(w => (
        <div key={w.kalit} className="rounded-xl border border-chiziq bg-sirt px-3 py-2 text-[12.5px]">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 min-w-0 text-matn"><FileText size={15} className="text-brand shrink-0" />
              <span className="min-w-0">
                <span className="block truncate">{w.nom}</span>
                <span className="block text-[11.5px] text-matn-xira">Word — AI o'qiydi{w.formulaSoni ? ` · ${w.formulaSoni} ta formula` : ''}{w.rasmSoni ? ` · ${w.rasmSoni} ta rasm` : ''}</span>
              </span>
            </span>
            <button type="button" aria-label="Olib tashlash" disabled={band} onClick={() => onOl(w.kalit)} className="p-1 rounded text-matn-xira hover:text-xato cursor-pointer"><X size={14} /></button>
          </div>
          {(w.oqilmagan > 0 || w.tashlangan > 0) && (
            <p className="mt-1.5 flex gap-1.5 text-[12px] text-ogoh">
              <AlertTriangle size={13} className="mt-[2px] shrink-0" />
              <span>
                {w.oqilmagan > 0 && <>{w.oqilmagan} ta formula yoki rasm eski formatda (MathType, WMF) — ular o'qilmaydi. Muhim bo'lsa, Word'da «Fayl → Saqlash → PDF» qilib, PDF ni yuklang. </>}
                {w.tashlangan > 0 && <>{w.tashlangan} ta rasm chegaradan oshdi — AI ga bormaydi.</>}
              </span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
