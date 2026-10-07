import React, { useState } from 'react';
import { X, Sparkles, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { useAiHolat } from '../useAiHolat';
import AiKalitKartasi from '../AiKalitKartasi';
import { Tugma, Tanlov, Yorliq } from '../ui';
import { savolXatosi, qiyinlikDarajasi } from '../../../../lib/imtihon.js';
import { type AiSavol, type Tekshiruv, htmlMatnga, izi, xatoMatni, Korinish } from './aiUmumiy';
import type { Question } from '../../../types';

// Bankdagi tayyor savollardan o'xshash masalalar (egasi, 2026-10-06: "bankdagi bor
// masalalarni ham olib, ularga o'xshash masala qo'shish"). Bank ro'yxatida belgilangan
// (yoki bitta) savol(lar) uchun AI har biriga N ta o'xshashini tuzadi, kalitni ko'rmay
// qayta yechib tekshiradi. Yangi savol asl savolning mavzusiga tushadi; tekshiruvdan
// o'tgani — faol, o'tmagani — qoralama.

/** Bir martada nechta savoldan tuziladi (har biri 2 ta AI so'rovi: tuzish va tekshirish). */
export const OXSHASH_MAKS_MANBA = 20;
type Daraja = 'oson' | 'osha' | 'qiyin';
type Usul = 'sonlar' | 'vaziyat';
interface Yangi extends AiSavol {
  kalit: number; tanlangan: boolean; tekshiruv: Tekshiruv | null;
  /** Server belgisi: javobi asl savolniki bilan bir xil chiqqan (deyarli takror). */
  aslBilanBir?: boolean;
}
interface Guruh { asl: Question | null; id: number; yangilar: Yangi[]; xato?: string }

let keyingiKalit = 1;
const suril = (d: number, daraja: Daraja) => Math.min(3, Math.max(1, qiyinlikDarajasi(d || 2) + (daraja === 'oson' ? -1 : daraja === 'qiyin' ? 1 : 0)));
const xatoHolati = (e: unknown) => (typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status: unknown }).status) : 0);

function Belgi({ n }: { n: Yangi }) {
  if (n.type === 'yozma') return <Yorliq>Yozma — ustoz baholaydi</Yorliq>;
  if (n.aslBilanBir) return <Yorliq rang="ogoh"><AlertTriangle size={11} /> Javobi asl masaladagidek</Yorliq>;
  if (n.tekshiruv?.tekshirildi === true) return <Yorliq rang="yaxshi"><CheckCircle2 size={11} /> AI qayta yechdi — javob to'g'ri</Yorliq>;
  if (n.tekshiruv?.tekshirildi === false) return <Yorliq rang="ogoh"><AlertTriangle size={11} /> AI boshqa javob chiqardi{n.tekshiruv.aiJavobi ? ` (${n.tekshiruv.aiJavobi})` : ''} — tekshiring</Yorliq>;
  return <Yorliq>Tekshirilmadi — qoralama bo'lib tushadi</Yorliq>;
}

export default function OxshashKop({ ids, onYop, onSaqlandi }: {
  /** Bankdagi asl savollar. */
  ids: number[];
  onYop: () => void;
  /** Bankka qo'shilgan yangi savollar. */
  onSaqlandi: (ids: number[]) => void;
}) {
  const { showNotification } = useCRM();
  const { soro, filial } = useImtihonApi();
  const ai = useAiHolat();
  const manbalar = ids.slice(0, OXSHASH_MAKS_MANBA);

  const [soni, setSoni] = useState<1 | 3 | 5>(3);
  const [usul, setUsul] = useState<Usul>('sonlar');
  const [daraja, setDaraja] = useState<Daraja>('osha');
  const [holat, setHolat] = useState<string | null>(null);
  const [guruhlar, setGuruhlar] = useState<Guruh[] | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const band = !!holat || saqlanmoqda;

  const bittaSavol = async (id: number): Promise<Guruh> => {
    const asl = await soro<Question>('GET', `questions/${id}`);
    // Guruhli savolning bitta bo'lagi umumiy shartsiz ma'nosiz — unga o'xshashini tuzib bo'lmaydi.
    if (asl.type === 'juft' || asl.type === 'qismli') throw new Error("Guruhli savolga o'xshashini tuzish hali yo'q");
    const a: AiSavol = {
      type: asl.type, text: asl.text, options: asl.options || null, correctAnswer: asl.correctAnswer || '',
      difficulty: qiyinlikDarajasi(asl.difficulty || 2), language: asl.language || 'uz', solution: asl.solution || null,
    };
    const r = await soro<{ klonlar: (AiSavol & { aslBilanBir?: boolean })[] }>('POST', 'ai/oxshash', {
      savol: { ...a, subject: asl.subject, topic: asl.topic }, soni, usul, daraja: daraja === 'osha' ? null : daraja,
    });
    const bor = new Set([izi(a.text)]);
    const toza = r.klonlar.filter(k => { const z = izi(k.text); if (!z || bor.has(z)) return false; bor.add(z); return true; });
    // Mustaqil tekshiruv: AI kalitni ko'rmay yechadi. Tekshirib bo'lmasa — belgisiz qoladi (qoralama bo'lib tushadi).
    let tekshiruv: Tekshiruv[] = [];
    try {
      tekshiruv = toza.length ? (await soro<{ natijalar: Tekshiruv[] }>('POST', 'ai/tekshir', { savollar: toza.slice(0, 12) })).natijalar : [];
    } catch (e: unknown) {
      showNotification(`Javoblarni tekshirib bo'lmadi (${xatoMatni(e)}) — tanlanganlari qoralama bo'lib qo'shiladi`, 'info');
    }
    return {
      asl, id,
      yangilar: toza.map((k, j) => {
        const t = tekshiruv[j] || null;
        return { ...k, kalit: keyingiKalit++, tekshiruv: t, tanlangan: (t?.tekshirildi === true || k.type === 'yozma') && !k.aslBilanBir };
      }),
    };
  };

  const tuz = async () => {
    const yig: Guruh[] = [];
    try {
      for (let i = 0; i < manbalar.length; i++) {
        setHolat(`${i + 1} / ${manbalar.length}-savolga o'xshashlari tuzilmoqda…`);
        try {
          yig.push(await bittaSavol(manbalar[i]));
        } catch (e: unknown) {
          yig.push({ asl: null, id: manbalar[i], yangilar: [], xato: xatoMatni(e) });
          // Limit yoki kalit muammosi — qolganlari ham o'tmaydi.
          if ([429, 503].includes(xatoHolati(e))) { showNotification(xatoMatni(e), 'error'); break; }
        }
        setGuruhlar([...yig]);
      }
      if (!yig.some(g => g.yangilar.length)) showNotification(yig[0]?.xato || "AI yangi masala bermadi — qayta urinib ko'ring", 'error');
    } finally {
      setHolat(null);
    }
  };

  const belgila = (kalit: number, tanlangan: boolean) =>
    setGuruhlar(l => (l || []).map(g => ({ ...g, yangilar: g.yangilar.map(n => (n.kalit === kalit ? { ...n, tanlangan } : n)) })));
  const tanlanganSoni = (guruhlar || []).reduce((a, g) => a + g.yangilar.filter(n => n.tanlangan).length, 0);

  const saqla = async () => {
    setSaqlanmoqda(true);
    try {
      const questions = (guruhlar || []).flatMap(g => (g.asl ? g.yangilar.filter(n => n.tanlangan).map(n => {
        const joy = { subject: g.asl!.subject, topic: g.asl!.topic, bankTopicId: g.asl!.bankTopicId ?? null, difficulty: suril(g.asl!.difficulty, daraja), language: g.asl!.language || 'uz' };
        const maydon = {
          type: n.type, text: n.text, options: n.type === 'yopiq' ? n.options : null,
          correctAnswer: n.type === 'yozma' ? '' : n.correctAnswer, solution: n.solution || null, solutionStatus: n.solution ? 'qoralama' : 'yoq',
        };
        const ishonchli = (n.tekshiruv?.tekshirildi === true || n.type === 'yozma') && !n.aslBilanBir;
        const faol = ishonchli && !savolXatosi({ ...maydon, ...joy } as never);
        return { ...maydon, ...joy, parentId: g.asl!.id, status: faol ? 'faol' : 'qoralama', source: "AI o'xshash" };
      }) : []));
      if (!questions.length) return;
      const r = await soro<{ count: number; ids?: number[]; xatolar: { qator: number; xato: string }[] }>('POST', 'questions/bulk', { questions: questions.map((q, i) => ({ ...q, qator: i + 1 })), schoolId: filial });
      const qoralama = questions.filter(q => q.status === 'qoralama').length;
      showNotification(`${r.count} ta savol bankka qo'shildi${qoralama ? ` — ${qoralama} tasi qoralama (bankda ko'rib, faol qilasiz)` : ''}${r.xatolar.length ? `; ${r.xatolar.length} tasi qo'shilmadi: ${r.xatolar[0].xato}` : ''}`, r.xatolar.length ? 'info' : 'success');
      onSaqlandi(r.ids || []);
      onYop();
    } catch (e: unknown) {
      showNotification(xatoMatni(e), 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[270] flex items-start justify-center overflow-y-auto p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="O'xshash masalalar">
      <div className="fixed inset-0 bg-black/50" onClick={() => !band && onYop()} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-3xl border border-chiziq my-2">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-chiziq">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn flex items-center gap-1.5"><Sparkles size={15} className="text-brand shrink-0" /> O'xshash masalalar — {manbalar.length} ta savoldan</h3>
            <p className="text-[12px] text-matn-xira">AI har savolga o'xshashlarini tuzadi va javobini qayta yechib tekshiradi. Yangi savol asl savolning mavzusiga tushadi.</p>
          </div>
          <button aria-label="Yopish" disabled={band} onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer disabled:opacity-40"><X size={16} /></button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4">
          {ai && !ai.yoqilgan && (ai.sozlay ? <AiKalitKartasi ixcham />
            : <p className="rounded-xl bg-ogoh-fon border border-ogoh/25 px-3 py-2 text-[12.5px] text-matn">AI hali ulanmagan. Kalitni administrator Sozlamalar → Integratsiyalar da kiritadi.</p>)}
          {ids.length > manbalar.length && (
            <p className="rounded-xl bg-ogoh-fon border border-ogoh/25 px-3 py-2 text-[12.5px] text-matn">{ids.length} ta savol belgilangan — bir martada birinchi {manbalar.length} tasidan tuziladi.</p>
          )}

          {!guruhlar && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="mb-1 text-[12px] font-semibold text-matn-sokin">Har savolga nechta</p>
                <Tanlov qiymat={soni} onChange={setSoni} variantlar={[{ v: 1, nom: '1 ta' }, { v: 3, nom: '3 ta' }, { v: 5, nom: '5 ta' }]} />
              </div>
              <div>
                <p className="mb-1 text-[12px] font-semibold text-matn-sokin">Nimasi o'zgarsin</p>
                <Tanlov qiymat={usul} onChange={setUsul} variantlar={[{ v: 'sonlar', nom: 'Faqat sonlar' }, { v: 'vaziyat', nom: 'Vaziyat ham' }]} />
              </div>
              <div>
                <p className="mb-1 text-[12px] font-semibold text-matn-sokin">Qiyinligi</p>
                <Tanlov qiymat={daraja} onChange={setDaraja} variantlar={[{ v: 'oson', nom: 'Osonroq' }, { v: 'osha', nom: "O'sha" }, { v: 'qiyin', nom: 'Qiyinroq' }]} />
              </div>
            </div>
          )}

          {holat && <p role="status" className="flex items-center gap-2 text-[12.5px] text-matn-sokin"><Loader2 size={14} className="animate-spin" /> {holat}</p>}

          {(guruhlar || []).map((g, i) => (
            <section key={g.id} aria-label={`${i + 1}-asl savol`} className="space-y-2">
              <h4 className="pt-1 text-[12.5px] font-bold text-matn">
                <span className="raqam text-matn-xira mr-1.5">{i + 1}.</span>
                <span className="font-semibold">{g.asl ? htmlMatnga(g.asl.text).slice(0, 160) : `ID ${g.id}`}</span>
                {g.asl && <span className="ml-2 font-normal text-matn-xira">{g.asl.topic}</span>}
              </h4>
              {g.xato && <p className="text-[12.5px] text-xato">{g.xato}</p>}
              {!g.xato && !g.yangilar.length && <p className="text-[12.5px] text-matn-xira">AI bu savolga yangi masala bermadi.</p>}
              {g.yangilar.map(n => (
                <div key={n.kalit} className={`rounded-xl border p-3 transition-colors ${n.tanlangan ? 'border-brand/40 bg-sirt' : 'border-chiziq bg-ichki/60'}`}>
                  <div className="flex items-start gap-2.5">
                    <input type="checkbox" aria-label="Savolni tanlash" className="mt-1 w-4 h-4 shrink-0 accent-[var(--color-brand)] cursor-pointer"
                      checked={n.tanlangan} disabled={band} onChange={e => belgila(n.kalit, e.target.checked)} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Belgi n={n} />
                      <Korinish q={n} />
                    </div>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-chiziq">
          <Tugma turi="oddiy" disabled={band} onClick={onYop}>Yopish</Tugma>
          {!guruhlar || holat ? (
            <Tugma turi="asosiy" ikonka={<Sparkles size={14} />} yuklanmoqda={!!holat} disabled={band || !ai?.yoqilgan} onClick={tuz}>
              {manbalar.length * soni} ta o'xshash masala tuzish
            </Tugma>
          ) : (
            <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} disabled={!tanlanganSoni || band} onClick={saqla}>
              {tanlanganSoni ? `${tanlanganSoni} ta savolni bankka qo'shish` : "Bankka qo'shish"}
            </Tugma>
          )}
        </div>
      </div>
    </div>
  );
}
