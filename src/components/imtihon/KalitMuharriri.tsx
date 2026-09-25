import React, { useMemo, useState } from 'react';
import { Save, ClipboardPaste, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi, ApiXato } from './useImtihonApi';
import { Tugma, Yorliq, INPUT } from './ui';
import { HARFLAR, kalitTuzilmasi, kalitToplamlari, kalitQiymati, kalitMatnidan } from '../../../lib/imtihon.js';
import type { ImtihonTafsil } from '../ExamDetail';

// "Faqat kalit" rejimida kitobcha variantlarining javob kaliti. Markaz o'z
// kitobchasi bilan imtihon o'tkazadi: savollar bankka kiritilmaydi, har
// variantning (A, B, ...) kaliti shu yerda yoziladi. Qulflangan imtihonda
// saqlansa — hamma natija yangi kalit bilan qayta hisoblanadi.

type Savol = { n: number; b: number; t: 'yopiq' | 'raqamli' | 'yozma'; p: number };
const MAXSUS: Record<string, { belgi: string; nom: string; cls: string }> = {
  '*': { belgi: '✱', nom: 'Bekor — hammaga ball', cls: 'text-ogoh border-ogoh/40 bg-ogoh-fon' },
  '-': { belgi: '✕', nom: 'Hisobdan chiqarilgan', cls: 'text-xato border-xato-chiziq bg-xato-fon' },
};

export default function KalitMuharriri({ exam, onSaqlandi }: { exam: ImtihonTafsil; onSaqlandi?: () => void }) {
  const { ozgartira, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.kalit');
  const { soro } = useImtihonApi();
  const s = exam.settings;
  const tuz = useMemo(() => kalitTuzilmasi(exam.blocks, exam.scoring) as Savol[], [exam]);
  const toplamlar = useMemo(() => kalitToplamlari(s) as { kalit: string; session: number; code: string }[], [s]);
  const [keys, setKeys] = useState<Record<string, string[]>>(() => ({ ...(s.keys || {}) }));
  const [faol, setFaol] = useState(toplamlar[0]?.kalit || '1|A');
  const [matn, setMatn] = useState('');
  const [ozgargan, setOzgargan] = useState(false);
  const [band, setBand] = useState(false);
  const harflar = HARFLAR.slice(0, s.optionCount);
  const kopSmena = toplamlar.some(t => t.session !== 1);

  const qiymat = (n: number) => (keys[faol] || [])[n - 1] || '';
  const qoy = (n: number, v: string) => {
    setKeys(k => {
      const arr = [...(k[faol] || [])];
      while (arr.length < tuz.length) arr.push('');
      arr[n - 1] = v;
      return { ...k, [faol]: arr };
    });
    setOzgargan(true);
  };
  const holati = (kalit: string) => {
    const arr = keys[kalit] || [];
    const xato = tuz.filter(q => kalitQiymati(q.t, arr[q.n - 1], s.optionCount).xato).length;
    return { toldirilgan: tuz.length - xato, jami: tuz.length };
  };

  const harfBos = (q: Savol, h: string, qoshish: boolean) => {
    const joriy = qiymat(q.n);
    if (qoshish && /^[A-F]+$/.test(joriy)) {
      const t = joriy.includes(h) ? joriy.replace(h, '') : [...joriy, h].sort().join('');
      qoy(q.n, t);
    } else qoy(q.n, joriy === h ? '' : h);
  };
  // Oddiy → bekor (hammaga ball) → hisobdan chiqarish → oddiy.
  const maxsus = (q: Savol) => {
    const joriy = qiymat(q.n);
    qoy(q.n, joriy === '*' ? '-' : joriy === '-' ? '' : '*');
  };

  const matndanQoy = () => {
    const r = kalitMatnidan(matn, tuz) as Record<number, string>;
    const soni = Object.keys(r).length;
    if (!soni) return showNotification("Matndan kalit topilmadi. Namuna: ABCDA… yoki 1A 2B 3C…", 'error');
    setKeys(k => {
      const arr = [...(k[faol] || [])];
      while (arr.length < tuz.length) arr.push('');
      for (const [n, v] of Object.entries(r)) arr[Number(n) - 1] = v;
      return { ...k, [faol]: arr };
    });
    setOzgargan(true);
    setMatn('');
    showNotification(`${soni} ta savolga kalit qo'yildi — tekshirib, saqlang`, 'success');
  };

  const saqla = async () => {
    setBand(true);
    try {
      const r = await soro<{ qaytaHisoblandi: number }>('PUT', `exams/${exam.id}/manual-key`, { keys });
      setOzgargan(false);
      showNotification(r.qaytaHisoblandi ? `Kalit saqlandi — ${r.qaytaHisoblandi} ta natija qayta hisoblandi` : 'Kalit saqlandi', 'success');
      onSaqlandi?.();
    } catch (e: any) {
      const x = e instanceof ApiXato ? e.malumot?.kalitXatolari?.[0] : null;
      showNotification(x ? `${e.message} (masalan: ${x.kalit.split('|')[1]} kitobcha, ${x.n}-savol — ${x.xato})` : e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  if (!tahrir) {
    return (
      <div className="rounded-xl border border-chiziq bg-ichki p-4 text-[13px] text-matn-sokin flex gap-2">
        <KeyRound size={16} className="shrink-0 mt-0.5" /> Kalitni «Imtihonlar → Kalit» ruxsati bor xodim kiritadi (odatda administrator).
      </div>
    );
  }

  const bloklar = exam.blocks.map((b, bi) => ({ nom: b.subject, savollar: tuz.filter(q => q.b === bi) })).filter(b => b.savollar.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {toplamlar.map(t => {
          const h = holati(t.kalit);
          const tayyor = h.toldirilgan === h.jami;
          return (
            <button key={t.kalit} onClick={() => setFaol(t.kalit)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-[12.5px] font-semibold cursor-pointer ${faol === t.kalit ? 'border-brand bg-brand-fon text-brand-dark dark:bg-brand/20 dark:text-brand-accent' : 'border-chiziq bg-sirt text-matn-sokin hover:text-matn'}`}>
              {kopSmena && <span className="text-[11px] font-normal">{s.sessions.find(x => x.id === t.session)?.name}</span>}
              <span className="text-[14px]">{t.code}</span>
              <span className={`raqam text-[11.5px] ${tayyor ? 'text-yaxshi' : 'text-matn-xira'}`}>{h.toldirilgan}/{h.jami}</span>
              {tayyor && <CheckCircle2 size={13} className="text-yaxshi" />}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-chiziq bg-ichki/60 p-3 space-y-2">
        <p className="text-[12.5px] font-semibold text-matn flex items-center gap-1.5"><ClipboardPaste size={14} /> {faol.split('|')[1]} kitobcha kalitini matn bilan kiritish</p>
        <textarea rows={2} className={INPUT} value={matn} onChange={e => setMatn(e.target.value)}
          placeholder="ABCDABCD… (faqat harflar, yopiq savollarga tartib bilan) yoki 1A 2B 3C … (kitobchadagi raqamlari bilan)" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11.5px] text-matn-xira">Raqamli javoblarni har qatorga bittadan yozsa ham bo'ladi. Bir nechta to'g'ri javob — «AC» yoki harfni Shift bilan bosing.</p>
          <Tugma kichik onClick={matndanQoy} disabled={!matn.trim()}>Kalitga qo'yish</Tugma>
        </div>
      </div>

      {bloklar.map(b => (
        <div key={b.nom + b.savollar[0].n}>
          <p className="text-[12.5px] font-semibold text-matn mb-2">{b.nom} <span className="font-normal text-matn-xira">· {b.savollar[0].n}–{b.savollar[b.savollar.length - 1].n}-savollar</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
            {b.savollar.map(q => {
              const v = qiymat(q.n);
              const m = MAXSUS[v];
              const xato = !m && kalitQiymati(q.t, v, s.optionCount).xato;
              return (
                <div key={q.n} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${m ? m.cls : xato ? 'border-chiziq bg-sirt' : 'border-yaxshi/30 bg-yaxshi-fon/40'}`}>
                  <span className="w-7 text-right text-[12px] font-bold text-matn-sokin raqam shrink-0">{q.n}</span>
                  {m ? <span className="flex-1 text-[12px] font-semibold">{m.nom}</span>
                    : q.t === 'yopiq' ? (
                      <span className="flex-1 flex gap-1">
                        {harflar.map(h => (
                          <button key={h} type="button" onClick={e => harfBos(q, h, e.shiftKey)} aria-label={`${q.n}-savol: ${h}`} aria-pressed={v.includes(h)}
                            className={`w-7 h-7 rounded-full border text-[12px] font-bold cursor-pointer ${v.includes(h) ? 'bg-brand border-brand text-brand-ust' : 'border-chiziq text-matn-sokin hover:border-brand bg-sirt'}`}>{h}</button>
                        ))}
                      </span>
                    ) : q.t === 'raqamli' ? (
                      <input aria-label={`${q.n}-savol javobi`} className={`${INPUT} py-1 px-2 flex-1 min-w-0`} value={v} placeholder="0,5 yoki 0,5;1/2" onChange={e => qoy(q.n, e.target.value)} />
                    ) : <span className="flex-1 text-[12px] text-matn-xira">yozma — ustoz baholaydi ({q.p} ball)</span>}
                  <button type="button" onClick={() => maxsus(q)} title="Oddiy → bekor (hammaga ball) → hisobdan chiqarish"
                    aria-label={`${q.n}-savol holati: ${m ? m.nom : 'oddiy'}`}
                    className={`w-7 h-7 shrink-0 rounded-lg border text-[12px] cursor-pointer ${m ? m.cls : 'border-chiziq text-matn-xira hover:text-matn bg-sirt'}`}>{m ? m.belgi : '⋯'}</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-[12px] text-matn-xira flex items-center gap-1.5">
          {exam.lockedAt ? <><AlertTriangle size={13} className="text-ogoh" /> Imtihon qulflangan: saqlasangiz, hamma natija yangi kalit bilan qayta hisoblanadi.</> : 'Hamma variantning kaliti to\'liq bo\'lgach — «Qulflash».'}
        </p>
        <div className="flex items-center gap-2">
          {ozgargan && <Yorliq rang="ogoh">saqlanmagan</Yorliq>}
          <Tugma turi="asosiy" ikonka={<Save size={14} />} yuklanmoqda={band} disabled={!ozgargan} onClick={saqla}>Kalitni saqlash</Tugma>
        </div>
      </div>
    </div>
  );
}
