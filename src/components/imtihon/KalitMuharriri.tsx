import React, { useMemo, useRef, useState } from 'react';
import { Save, ClipboardPaste, CheckCircle2, AlertTriangle, KeyRound, Tags, Copy, ScanLine, Printer } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { useImtihonApi, ApiXato } from './useImtihonApi';
import { Tugma, Yorliq, INPUT, Tanlov } from './ui';
import { varaqParametrlari } from './varaqParam';
import { HARFLAR, kalitTuzilmasi, kalitToplamlari, kalitQiymati, kalitMatnidan, varaqTuzilmasi } from '../../../lib/imtihon.js';
import { OmrIshchi, faylSahifalari } from '../../lib/omr/skaner';
import { varaqSahifalari, type VaraqParametrlari } from '../../lib/omr/layout';
import { varaqSvg, VARAQ_CSS } from '../../lib/omr/render';
import { chopEt } from '../../lib/chopEtish';
import type { ImtihonTafsil } from './turlar';

// "Faqat kalit" rejimida kitobcha variantlarining javob kaliti. Markaz o'z
// kitobchasi bilan imtihon o'tkazadi: savollar bankka kiritilmaydi, har
// variantning (A, B, ...) kaliti shu yerda yoziladi. Qulflangan imtihonda
// saqlansa — hamma natija yangi kalit bilan qayta hisoblanadi. Savollarning
// mavzusi ixtiyoriy: yozilsa, tahlilda ustoz qaysi mavzu zaif ekanini ko'radi.
// Kalitni varaqdan ham olsa bo'ladi (Addmen kabi): ustoz bo'sh varaqqa to'g'ri
// javoblarni bo'yaydi, skanerlaydi — kalit o'zi to'ladi, keyin tekshirib saqlanadi.

type Savol = { n: number; b: number; t: 'yopiq' | 'raqamli' | 'moslash' | 'yozma'; p: number };
const MAXSUS: Record<string, { belgi: string; nom: string; cls: string }> = {
  '*': { belgi: '✱', nom: 'Bekor — hammaga ball', cls: 'text-ogoh border-ogoh/40 bg-ogoh-fon' },
  '-': { belgi: '✕', nom: 'Hisobdan chiqarilgan', cls: 'text-xato border-xato-chiziq bg-xato-fon' },
};

export default function KalitMuharriri({ exam, onSaqlandi }: { exam: ImtihonTafsil; onSaqlandi?: () => void }) {
  const { ozgartira, showNotification, syllabuses } = useCRM();
  const tahrir = ozgartira('imtihonlar.kalit');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const s = exam.settings;
  const tuz = useMemo(() => kalitTuzilmasi(exam.blocks, exam.scoring) as Savol[], [exam]);
  const toplamlar = useMemo(() => kalitToplamlari(s) as { kalit: string; session: number; code: string }[], [s]);
  const [keys, setKeys] = useState<Record<string, string[]>>(() => ({ ...(s.keys || {}) }));
  const [mavzular, setMavzular] = useState<Record<string, string[]>>(() => ({ ...(s.keyTopics || {}) }));
  const [korinish, setKorinish] = useState<'javob' | 'mavzu'>('javob');
  const [faol, setFaol] = useState(toplamlar[0]?.kalit || '1|A');
  const [matn, setMatn] = useState('');
  const [mavzuMatni, setMavzuMatni] = useState('');
  const [ozgargan, setOzgargan] = useState(false);
  const [band, setBand] = useState(false);
  const [oqilmoqda, setOqilmoqda] = useState(false);
  const faylRef = useRef<HTMLInputElement>(null);
  const params: VaraqParametrlari = useMemo(() => varaqParametrlari(exam), [exam]);
  const harflar = HARFLAR.slice(0, s.optionCount);
  const kopSmena = toplamlar.some(t => t.session !== 1);
  // Mavzu takliflari: o'quv rejadagi mavzular va shu imtihonda yozilganlar.
  const takliflar = useMemo(() => {
    const t = new Set<string>();
    for (const arr of Object.values(mavzular)) for (const m of arr) if (m) t.add(m);
    for (const sy of syllabuses || []) for (const tp of sy.topics || []) if (tp.title) t.add(tp.title.trim());
    return [...t].slice(0, 400);
  }, [mavzular, syllabuses]);
  const mavzuSoni = (kalit: string) => tuz.filter(q => (mavzular[kalit] || [])[q.n - 1]).length;

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
  const mavzu = (n: number) => (mavzular[faol] || [])[n - 1] || '';
  const mavzuQoy = (qiymatlar: Record<number, string>) => {
    setMavzular(m => {
      const arr = [...(m[faol] || [])];
      while (arr.length < tuz.length) arr.push('');
      for (const [n, v] of Object.entries(qiymatlar)) arr[Number(n) - 1] = v;
      return { ...m, [faol]: arr };
    });
    setOzgargan(true);
  };
  const mavzuMatnidanQoy = () => {
    const r = mavzuMatnidan(mavzuMatni, tuz.length);
    const soni = Object.keys(r).length;
    if (!soni) return showNotification('Namuna: «1-5 Kasrlar» — har qatorda savollar oralig\'i va mavzu', 'error');
    mavzuQoy(r);
    setMavzuMatni('');
    showNotification(`${soni} ta savolga mavzu qo'yildi`, 'success');
  };
  const boshqalargaKochir = async () => {
    const qolgan = toplamlar.filter(t => t.kalit !== faol);
    if (!(await confirm(`${faol.split('|')[1]} kitobchadagi mavzular ${qolgan.map(t => t.code).join(', ')} kitobchalarga ham yozilsinmi? (Kitobchalarda savollar tartibi bir xil bo'lsa.)`))) return;
    setMavzular(m => ({ ...m, ...Object.fromEntries(qolgan.map(t => [t.kalit, [...(m[faol] || [])]])) }));
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

  /** Kalit uchun bo'sh (universal) varaq — qulflashdan oldin ham chiqadi. */
  const boshVaraq = async () => {
    const sahifalar = varaqSahifalari(params);
    const smena = Number(faol.split('|')[0]) || 1;
    const umumiy = { markaz: 'KALIT', imtihon: `${exam.name} — kalit varag'i`, sana: exam.date, examId: exam.id, session: smena, smena: `${faol.split('|')[1]} kitobcha kaliti` };
    await chopEt({ sarlavha: `${exam.name} — kalit varag'i`, css: VARAQ_CSS, body: sahifalar.map(sh => `<div class="varaq">${varaqSvg(sh, umumiy, null)}</div>`).join('') });
  };

  /**
   * Ustoz to'ldirgan varaqdan kalit: har sahifa o'qiladi; variant doirachasi bo'yalgan
   * bo'lsa — o'sha kitobcha, bo'lmasa ochiq turgani. Ikki doira bo'yalsa — "AC".
   */
  const varaqdanOqi = async (fayllar: File[]) => {
    if (!fayllar.length) return;
    setOqilmoqda(true);
    const ishchi = new OmrIshchi();
    try {
      const sahifalar = varaqSahifalari(params);
      const javoblar: Record<number, string> = {};
      let variant: string | null = null;
      let oqildi = 0;
      const xatolar: string[] = [];
      for (const f of fayllar) {
        for await (const { bitmap, nom } of faylSahifalari(f)) {
          const { natija } = await ishchi.oqi(bitmap, params);
          if (!natija.ok) { xatolar.push(`${nom}: ${natija.xato || "o'qilmadi"}`); continue; }
          oqildi++;
          if (natija.variant) variant = natija.variant;
          const sahifa = sahifalar.find(x => x.page === natija.page);
          for (const sv of sahifa?.yopiq || []) {
            const v = natija.javoblar[sv.n];
            if (v && v !== '*') javoblar[sv.n] = v;
            else {
              // Bir nechta (yoki noaniq) belgi: to'liq bo'yalgan doirachalar — bir nechta to'g'ri javob.
              const f2 = natija.toliqlik[sv.n] || [];
              const harf = f2.map((x, i) => (x >= 0.45 ? sv.doiralar[i]?.v : '')).filter(Boolean).join('');
              if (harf) javoblar[sv.n] = harf;
            }
          }
          for (const sv of sahifa?.raqamli || []) if (natija.javoblar[sv.n]) javoblar[sv.n] = natija.javoblar[sv.n];
        }
      }
      if (!oqildi) throw new Error(xatolar[0] || "Varaq o'qilmadi");
      const smena = faol.split('|')[0];
      const nishon = variant && toplamlar.some(t => t.kalit === `${smena}|${variant}`) ? `${smena}|${variant}` : faol;
      const soni = Object.keys(javoblar).length;
      setKeys(k => {
        const arr = [...(k[nishon] || [])];
        while (arr.length < tuz.length) arr.push('');
        for (const [n, v] of Object.entries(javoblar)) arr[Number(n) - 1] = v;
        return { ...k, [nishon]: arr };
      });
      setFaol(nishon);
      setOzgargan(true);
      const bosh = tuz.filter(q => q.t !== 'yozma' && !javoblar[q.n]).length;
      showNotification(`${nishon.split('|')[1]} kitobcha: ${soni} ta savol kaliti varaqdan olindi${bosh ? `, ${bosh} tasi bo'sh — to'ldiring` : ''}. Tekshirib, saqlang.`, bosh ? 'info' : 'success');
      if (xatolar.length) showNotification(`${xatolar.length} ta sahifa o'qilmadi: ${xatolar[0]}`, 'error');
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      ishchi.yop();
      setOqilmoqda(false);
    }
  };

  const saqla = async () => {
    setBand(true);
    try {
      const r = await soro<{ qaytaHisoblandi: number }>('PUT', `exams/${exam.id}/manual-key`, { keys, topics: mavzular });
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
              {korinish === 'javob'
                ? <span className={`raqam text-[11.5px] ${tayyor ? 'text-yaxshi' : 'text-matn-xira'}`}>{h.toldirilgan}/{h.jami}</span>
                : <span className="raqam text-[11.5px] text-matn-xira">{mavzuSoni(t.kalit)}/{h.jami} mavzu</span>}
              {korinish === 'javob' && tayyor && <CheckCircle2 size={13} className="text-yaxshi" />}
            </button>
          );
        })}
        <span className="ml-auto">
          <Tanlov kichik qiymat={korinish} onChange={setKorinish} variantlar={[
            { v: 'javob', nom: <span className="inline-flex items-center gap-1.5"><KeyRound size={13} />Javoblar</span> },
            { v: 'mavzu', nom: <span className="inline-flex items-center gap-1.5"><Tags size={13} />Mavzular</span> },
          ]} />
        </span>
      </div>

      {korinish === 'mavzu' && (
        <>
          <div className="rounded-xl border border-chiziq bg-ichki/60 p-3 space-y-2">
            <p className="text-[12.5px] font-semibold text-matn flex items-center gap-1.5"><Tags size={14} /> {faol.split('|')[1]} kitobcha: savollar mavzusi (ixtiyoriy)</p>
            <p className="text-[11.5px] text-matn-xira">Mavzu yozilsa, «Natijalar → Mavzular» da har kurs bo'yicha qaysi mavzu zaif ekani ko'rinadi. Yozilmasa — tahlil fan bo'yicha.</p>
            <textarea rows={3} className={INPUT} value={mavzuMatni} onChange={e => setMavzuMatni(e.target.value)} aria-label="Mavzularni matn bilan kiritish"
              placeholder={'1-5 Kasrlar\n6-10 Tenglamalar\n11 Foizlar'} />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {toplamlar.length > 1 && <Tugma kichik turi="oddiy" ikonka={<Copy size={13} />} onClick={boshqalargaKochir} disabled={!mavzuSoni(faol)}>Boshqa kitobchalarga ham</Tugma>}
              <Tugma kichik onClick={mavzuMatnidanQoy} disabled={!mavzuMatni.trim()}>Mavzularni qo'yish</Tugma>
            </div>
          </div>
          <datalist id={`mavzular-${exam.id}`}>{takliflar.map(t => <option key={t} value={t} />)}</datalist>
          {bloklar.map(b => (
            <div key={b.nom + b.savollar[0].n}>
              <p className="text-[12.5px] font-semibold text-matn mb-2">{b.nom} <span className="font-normal text-matn-xira">· {b.savollar[0].n}–{b.savollar[b.savollar.length - 1].n}-savollar</span></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
                {b.savollar.map(q => (
                  <label key={q.n} className="flex items-center gap-1.5 rounded-lg border border-chiziq bg-sirt px-2 py-1.5">
                    <span className="w-7 text-right text-[12px] font-bold text-matn-sokin raqam shrink-0">{q.n}</span>
                    <input list={`mavzular-${exam.id}`} aria-label={`${q.n}-savol mavzusi`} className={`${INPUT} py-1 px-2 flex-1 min-w-0`} value={mavzu(q.n)}
                      placeholder="mavzu" maxLength={120} onChange={e => mavzuQoy({ [q.n]: e.target.value })} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {korinish === 'javob' && <div className="rounded-xl border border-chiziq bg-ichki/60 p-3 space-y-2">
        <p className="text-[12.5px] font-semibold text-matn flex items-center gap-1.5"><ClipboardPaste size={14} /> {faol.split('|')[1]} kitobcha kalitini matn bilan kiritish</p>
        <textarea rows={2} className={INPUT} value={matn} onChange={e => setMatn(e.target.value)}
          placeholder="ABCDABCD… (faqat harflar, yopiq savollarga tartib bilan) yoki 1A 2B 3C … (kitobchadagi raqamlari bilan)" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11.5px] text-matn-xira">Raqamli javoblarni har qatorga bittadan yozsa ham bo'ladi. Bir nechta to'g'ri javob — «AC» yoki harfni Shift bilan bosing.</p>
          <Tugma kichik onClick={matndanQoy} disabled={!matn.trim()}>Kalitga qo'yish</Tugma>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-chiziq">
          <p className="text-[11.5px] text-matn-xira max-w-xl">
            <b className="text-matn-sokin">Varaqdan:</b> bo'sh varaqqa to'g'ri javoblarni bo'yang (variant doirachasini ham), suratga oling yoki skanerlang — kalit o'zi to'ladi.
          </p>
          <span className="flex flex-wrap gap-2">
            <Tugma kichik turi="oddiy" ikonka={<Printer size={13} />} onClick={boshVaraq}>Bo'sh varaq</Tugma>
            <Tugma kichik ikonka={<ScanLine size={13} />} yuklanmoqda={oqilmoqda} onClick={() => faylRef.current?.click()}>Varaqdan o'qish</Tugma>
          </span>
          <input ref={faylRef} type="file" multiple accept="image/*,application/pdf,.pdf" className="hidden" aria-label="Kalit varag'i"
            onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; varaqdanOqi(f); }} />
        </div>
      </div>}

      {korinish === 'javob' && bloklar.map(b => (
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
                    ) : q.t === 'moslash' ? (
                      <input aria-label={`${q.n}-savol javobi`} className={`${INPUT} py-1 px-2 flex-1 min-w-0 uppercase`} value={v} placeholder="PQ|R|S|T — har qatorga" title="Moslashtirish: har qator (A–D) uchun o'ng ustun harflari (P–T), qatorlar | bilan" onChange={e => qoy(q.n, e.target.value.toUpperCase())} />
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
          {exam.lockedAt ? <><AlertTriangle size={13} className="text-ogoh" /> Imtihon qulflangan: saqlasangiz, hamma natija yangi kalit bilan qayta hisoblanadi.</> : 'Hamma variantning kaliti to\'liq bo\'lgach — «Savollarni qulflash».'}
        </p>
        <div className="flex items-center gap-2">
          {ozgargan && <Yorliq rang="ogoh">saqlanmagan</Yorliq>}
          <Tugma turi="asosiy" ikonka={<Save size={14} />} yuklanmoqda={band} disabled={!ozgargan} onClick={saqla}>Kalitni saqlash</Tugma>
        </div>
      </div>
    </div>
  );
}

/** "1-5 Kasrlar", "6–10: Tenglamalar", "11 Foizlar" — har qatorda savollar oralig'i va mavzu. */
function mavzuMatnidan(matn: string, jami: number): Record<number, string> {
  const out: Record<number, string> = {};
  for (const qator of matn.split(/\n+/)) {
    const m = qator.trim().match(/^(\d+)\s*(?:[-–—]\s*(\d+))?\s*[:.)\-–—]?\s*(\S.*)$/);
    if (!m) continue;
    const a = parseInt(m[1]);
    const b = m[2] ? parseInt(m[2]) : a;
    for (let n = Math.max(1, Math.min(a, b)); n <= Math.min(jami, Math.max(a, b)); n++) out[n] = m[3].trim().slice(0, 120);
  }
  return out;
}
