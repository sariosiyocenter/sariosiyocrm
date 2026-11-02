import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Karta, Tugma, INPUT } from './ui';
import type { ImtihonTafsil } from './turlar';

// «Kalit va baholash» dagi murakkab qoidalar (Addmen «Question linking», «Option weights»,
// «Scaled score», bo'lim cut-off). Har saqlashda natijalar qayta hisoblanadi.

export interface Qoidalar {
  boglanish: Record<string, string>;
  javobOgirligi: Record<string, number[]>;
  olchangan: [number, number][];
  bolimOtish: Record<string, number>;
}

const son = (x: string) => Number(x.replace(',', '.'));

export default function MurakkabQoidalar({ exam, q, belgilangan, tuzatadi, band, onSaqla }: {
  exam: ImtihonTafsil; q: Qoidalar; belgilangan: string[]; tuzatadi: boolean; band: boolean;
  onSaqla: (patch: Partial<Qoidalar>, xabar: string) => void;
}) {
  const [bog, setBog] = useState({ n: '', shart: '' });
  const [og, setOg] = useState('4, 3, 2, 1, 0');
  const [jadval, setJadval] = useState(() => q.olchangan.map(([a, b]) => `${a}\t${b}`).join('\n'));
  const [bolim, setBolim] = useState<Record<string, string>>(() => Object.fromEntries(exam.blocks.map((_, i) => [String(i), q.bolimOtish[String(i)] ? String(q.bolimOtish[String(i)]) : ''])));
  const sarlavha = 'block text-[12px] font-semibold text-matn mb-1.5';

  const jadvalniOqi = (): [number, number][] => jadval.split('\n').map(x => x.trim().split(/[\t;, ]+/).filter(Boolean)).filter(x => x.length >= 2)
    .map(x => [son(x[0]), son(x[1])] as [number, number]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));

  return (
    <Karta sarlavha="Murakkab qoidalar" izoh="Oddiy testda kerak emas. Har biri saqlansa — natijalar qayta hisoblanadi.">
      <fieldset disabled={!tuzatadi || band} className="space-y-5">
        <section>
          <span className={sarlavha}>Savollarni bog'lash</span>
          <div className="flex items-center gap-1.5 text-[12.5px] text-matn-sokin flex-wrap">
            <input className={`${INPUT} w-16`} inputMode="numeric" aria-label="Bog'langan savol" value={bog.n} onChange={e => setBog(x => ({ ...x, n: e.target.value.replace(/\D/g, '') }))} />
            -savol faqat
            <input className={`${INPUT} w-16`} inputMode="numeric" aria-label="Shart savol" value={bog.shart} onChange={e => setBog(x => ({ ...x, shart: e.target.value.replace(/\D/g, '') }))} />
            -to'g'ri bo'lsa
            <Tugma kichik turi="oddiy" disabled={!bog.n || !bog.shart || bog.n === bog.shart} onClick={() => { onSaqla({ boglanish: { ...q.boglanish, [bog.n]: bog.shart } }, `${bog.n}-savol ${bog.shart}-savolga bog'landi`); setBog({ n: '', shart: '' }); }}>Qo'shish</Tugma>
          </div>
          {Object.keys(q.boglanish).length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(q.boglanish).map(([n, shart]) => (
                <li key={n} className="inline-flex items-center gap-1 rounded-full border border-chiziq px-2.5 py-1 text-[12px] text-matn">
                  {n} ← {shart}
                  <button aria-label={`${n}-savol bog'lanishini olib tashlash`} className="text-matn-xira hover:text-xato cursor-pointer" onClick={() => { const x = { ...q.boglanish }; delete x[n]; onSaqla({ boglanish: x }, "Bog'lanish olib tashlandi"); }}><X size={12} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <span className={sarlavha}>Javob og'irligi (so'rovnoma, psixologik test)</span>
          <p className="text-[11.5px] text-matn-xira mb-1.5">Asl A, B, C… javoblarning bali. To'g'ri javob yo'q — har javob o'z ballini oladi. Jadvalda savollarni belgilang.</p>
          <div className="flex gap-1.5">
            <input className={INPUT} aria-label="Og'irliklar" value={og} onChange={e => setOg(e.target.value)} />
            <Tugma kichik turi="oddiy" disabled={!belgilangan.length} onClick={() => {
              const w = og.split(/[,;\s]+/).filter(Boolean).map(son).map(x => (Number.isFinite(x) ? x : 0));
              const yangi = { ...q.javobOgirligi };
              for (const n of belgilangan) yangi[n] = w;
              onSaqla({ javobOgirligi: yangi }, `${belgilangan.length} ta savolga og'irlik qo'yildi`);
            }}>Belgilanganlarga ({belgilangan.length})</Tugma>
          </div>
          {Object.keys(q.javobOgirligi).length > 0 && (
            <p className="mt-1.5 text-[12px] text-matn-sokin">
              Og'irlikli: {Object.keys(q.javobOgirligi).join(', ')}{' '}
              <button className="text-brand hover:underline cursor-pointer" onClick={() => {
                const yangi = { ...q.javobOgirligi };
                for (const n of belgilangan.length ? belgilangan : Object.keys(yangi)) delete yangi[n];
                onSaqla({ javobOgirligi: yangi }, "Og'irlik olib tashlandi");
              }}>{belgilangan.length ? 'belgilanganlardan olish' : 'hammasini olish'}</button>
            </p>
          )}
        </section>

        <section>
          <span className={sarlavha}>O'lchangan ball (SAT va boshqalar)</span>
          <p className="text-[11.5px] text-matn-xira mb-1.5">Har qatorda: xom ball va o'lchangan ball (Excel'dan ikki ustunni nusxa olib qo'ying). Oraliqda — chiziqli.</p>
          <textarea className={`${INPUT} h-24 font-mono text-[12px]`} aria-label="O'lchangan ball jadvali" placeholder={'0\t200\n40\t760\n44\t800'} value={jadval} onChange={e => setJadval(e.target.value)} />
          <div className="flex items-center gap-2 mt-1.5">
            <Tugma kichik turi="oddiy" onClick={() => { const t = jadvalniOqi(); onSaqla({ olchangan: t }, t.length ? `Jadval saqlandi: ${t.length} qator` : "Jadval olib tashlandi"); }}>Saqlash</Tugma>
            {q.olchangan.length > 0 && <span className="text-[12px] text-matn-sokin">{q.olchangan.length} qator · natijada «O'lchangan» ustuni</span>}
          </div>
        </section>

        <section>
          <span className={sarlavha}>Bo'lim bo'yicha o'tish bali</span>
          <p className="text-[11.5px] text-matn-xira mb-1.5">Umumiy o'tish balidan tashqari: har bo'limda kamida shuncha foiz.</p>
          <div className="space-y-1.5">
            {exam.blocks.map((b, i) => (
              <label key={i} className="flex items-center justify-between gap-2 text-[12.5px] text-matn">
                <span className="truncate">{b.subject}</span>
                <span className="flex items-center gap-1 text-matn-sokin"><input className={`${INPUT} w-20`} inputMode="numeric" placeholder="—" value={bolim[String(i)] || ''} onChange={e => setBolim(x => ({ ...x, [String(i)]: e.target.value.replace(/\D/g, '') }))} />%</span>
              </label>
            ))}
          </div>
          <Tugma kichik turi="oddiy" className="mt-1.5" onClick={() => onSaqla({ bolimOtish: Object.fromEntries(Object.entries(bolim).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Math.min(100, Number(v))])) }, "Bo'lim o'tish bali saqlandi")}>Saqlash</Tugma>
        </section>
      </fieldset>
    </Karta>
  );
}
