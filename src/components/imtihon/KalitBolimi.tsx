import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, Undo2, Wrench, CheckSquare } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, Tanlov, Yuklanmoqda, INPUT } from './ui';
import KalitOynasi from './KalitOynasi';
import MurakkabQoidalar, { type Qoidalar } from './MurakkabQoidalar';
import { HARFLAR } from '../../../lib/imtihon.js';
import type { ImtihonTafsil } from './turlar';

// «Kalit va baholash» bo'limi (Addmen OMR «Answer Key» + «Scoring schemes»): bitta jadval —
// har savol raqami, har variantning kaliti, turi, ball sxemasi va mavzusi. Savollarni belgilab
// sxema qo'yiladi yoki bekor qilinadi; har o'zgarishda hamma natija qayta hisoblanadi.

interface Element { n: number; y?: string; q: number; t: string; b: number; p: number; javob: any; m?: number[] }
interface Sxema { togri: number; xato: number; bosh: number; nom?: string }
interface KalitJavobi {
  variants: { session: number; code: string; items: Element[] }[];
  savollar: { id: number; subject: string; topic: string; type: string; correctAnswer: string }[];
  cancelled: Record<string, 'hammaga' | 'chiqarish'>;
  keyFix: Record<string, string[]>;
  ballSxemalari: Record<string, Sxema>;
  xatoJarima: number;
  boglanish?: Qoidalar['boglanish'];
  olchangan?: Qoidalar['olchangan'];
  bolimOtish?: Qoidalar['bolimOtish'];
}

/** Tayyor sxemalar. «Oddiy» — sxema yo'q: savolning o'z bali (va umumiy jarima, bo'lsa). */
const TAYYOR: { id: string; nom: string; sx: Sxema | null }[] = [
  { id: 'oddiy', nom: "Oddiy — savol bali", sx: null },
  { id: 'manfiy', nom: 'Manfiy · +1 / −0,25', sx: { nom: 'Manfiy', togri: 1, xato: -0.25, bosh: 0 } },
  { id: 'dtm11', nom: 'DTM majburiy · 1,1', sx: { nom: 'DTM majburiy', togri: 1.1, xato: 0, bosh: 0 } },
  { id: 'dtm31', nom: 'DTM 1-fan · 3,1', sx: { nom: 'DTM 1-fan', togri: 3.1, xato: 0, bosh: 0 } },
  { id: 'dtm21', nom: 'DTM 2-fan · 2,1', sx: { nom: 'DTM 2-fan', togri: 2.1, xato: 0, bosh: 0 } },
];

const son = (x: number) => String(x).replace('.', ',');
const sxemaMatni = (sx: Sxema) => `${son(sx.togri)} / ${son(sx.xato)} / ${son(sx.bosh)}`;
const TUR: Record<string, string> = { yopiq: 'Bitta javob', raqamli: 'Raqamli', moslash: 'Moslashtirish', yozma: 'Yozma' };

export default function KalitBolimi({ exam, yangila }: { exam: ImtihonTafsil; yangila: () => Promise<any> }) {
  const { ozgartira, showNotification } = useCRM();
  const tuzatadi = ozgartira('imtihonlar.kalit');
  const { soro } = useImtihonApi();
  const [k, setK] = useState<KalitJavobi | null>(null);
  const [session, setSession] = useState(1);
  const [belgi, setBelgi] = useState<Set<string>>(new Set());
  const [tanlov, setTanlov] = useState('dtm31');
  const [boshqa, setBoshqa] = useState({ togri: '1', xato: '0', bosh: '0' });
  const [band, setBand] = useState(false);
  const [tuzatish, setTuzatish] = useState(false);

  const yukla = useCallback(() => soro<KalitJavobi>('GET', `exams/${exam.id}/key`).then(r => setK({ ...r, ballSxemalari: r.ballSxemalari || {} })).catch(e => showNotification(e.message, 'error')), [exam.id, soro, showNotification]);
  useEffect(() => { yukla(); }, [yukla]);

  const smenalar = useMemo(() => [...new Set((k?.variants || []).map(v => v.session))], [k]);
  const variantlar = (k?.variants || []).filter(v => v.session === session);
  const savolMap = useMemo(() => new Map((k?.savollar || []).map(s => [s.id, s])), [k]);
  const qatorlar = variantlar[0]?.items || [];
  const raqam = (it: Element) => String(it.y ?? it.n);

  const kalitMatni = (it: Element) => {
    if (it.t === 'yozma') return '✎';
    const tuz = k?.keyFix[it.q];
    if (tuz && it.t === 'yopiq') return tuz.map(h => HARFLAR[it.m?.indexOf(HARFLAR.indexOf(h)) ?? -1] || '?').join('/');
    if (tuz) return tuz.join(' | ');
    return Array.isArray(it.javob) ? it.javob.map(v => String(v).replace('.', ',')).join(' | ') : it.javob ?? '—';
  };

  const saqla = async (patch: { ballSxemalari?: Record<string, Sxema>; cancelled?: Record<string, any> } & Partial<Qoidalar>, xabar: string) => {
    if (!k) return;
    setBand(true);
    try {
      const r = await soro<{ cancelled: any; keyFix: any; ballSxemalari: Record<string, Sxema>; qaytaHisoblandi: number } & Partial<Qoidalar>>('PUT', `exams/${exam.id}/key`, patch);
      setK({ ...k, cancelled: r.cancelled, keyFix: r.keyFix, ballSxemalari: r.ballSxemalari || {}, boglanish: r.boglanish, olchangan: r.olchangan, bolimOtish: r.bolimOtish });
      showNotification(`${xabar}${r.qaytaHisoblandi ? ` — ${r.qaytaHisoblandi} ta natija qayta hisoblandi` : ''}`, 'success');
      setBelgi(new Set());
      await yangila();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const tanlanganSxema = (): Sxema | null => {
    if (tanlov === 'boshqa') {
      const v = (x: string) => Number(x.replace(',', '.')) || 0;
      return { nom: 'Boshqa', togri: v(boshqa.togri), xato: v(boshqa.xato), bosh: v(boshqa.bosh) };
    }
    return TAYYOR.find(t => t.id === tanlov)?.sx ?? null;
  };
  const sxemaQoy = (raqamlar: string[]) => {
    if (!k || !raqamlar.length) return;
    const sx = tanlanganSxema();
    const yangi = { ...k.ballSxemalari };
    for (const r of raqamlar) { if (sx) yangi[r] = sx; else delete yangi[r]; }
    saqla({ ballSxemalari: yangi }, `${raqamlar.length} ta savolga ${sx ? `«${sx.nom}» sxemasi` : "oddiy ball"} qo'yildi`);
  };
  const bekorQil = (raqamlar: string[], qaytar: boolean) => {
    if (!k || !raqamlar.length) return;
    const c = { ...k.cancelled };
    // Raqamdagi hamma variantning savoli (har xil variantlarda — har birining o'z savoli).
    for (const v of variantlar) for (const it of v.items) if (raqamlar.includes(raqam(it))) { if (qaytar) delete c[it.q]; else c[it.q] = 'hammaga'; }
    saqla({ cancelled: c }, qaytar ? 'Bekor qilish qaytarildi' : `${raqamlar.length} ta savol bekor qilindi — hammaga ball`);
  };

  if (!k) return <Yuklanmoqda />;
  const belgilangan = [...belgi];
  const hammasi = qatorlar.map(raqam);
  const almashtir = (r: string) => setBelgi(s => { const x = new Set(s); if (x.has(r)) x.delete(r); else x.add(r); return x; });
  const ishlatilgan = new Map<string, number>();
  for (const sx of Object.values(k.ballSxemalari)) ishlatilgan.set(sxemaMatni(sx), (ishlatilgan.get(sxemaMatni(sx)) || 0) + 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-4 items-start">
      <div className="space-y-4 min-w-0">
        <Karta sarlavha="Ball sxemalari" izoh="Tanlang, jadvalda savollarni belgilang — hammasiga birdan qo'yiladi">
          <div className="space-y-2">
            <div role="radiogroup" aria-label="Ball sxemasi" className="flex flex-wrap gap-1.5">
              {[...TAYYOR, { id: 'boshqa', nom: 'Boshqa…', sx: null }].map(t => (
                <button key={t.id} type="button" role="radio" aria-checked={tanlov === t.id} onClick={() => setTanlov(t.id)}
                  className={`px-3 py-1.5 rounded-full border text-[12.5px] cursor-pointer ${tanlov === t.id ? 'border-brand bg-brand-fon/60 text-matn font-semibold dark:bg-brand/15' : 'border-chiziq text-matn-sokin hover:text-matn'}`}>{t.nom}</button>
              ))}
            </div>
            {tanlov === 'boshqa' && (
              <div className="grid grid-cols-3 gap-2">
                {([['togri', "To'g'ri"], ['xato', 'Xato'], ['bosh', "Bo'sh"]] as const).map(([f, nom]) => (
                  <label key={f} className="block">
                    <span className="block text-[11.5px] text-matn-sokin mb-1">{nom}</span>
                    <input inputMode="decimal" className={INPUT} value={boshqa[f]} onChange={e => setBoshqa(x => ({ ...x, [f]: e.target.value.replace(/[^\d.,-]/g, '') }))} />
                  </label>
                ))}
              </div>
            )}
            {tuzatadi && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Tugma kichik turi="asosiy" disabled={!belgilangan.length || band} onClick={() => sxemaQoy(belgilangan)}>Belgilanganlarga ({belgilangan.length})</Tugma>
                <Tugma kichik turi="oddiy" disabled={band} onClick={() => sxemaQoy(hammasi)}>Hammasiga</Tugma>
              </div>
            )}
          </div>
          {ishlatilgan.size > 0 && (
            <ul className="mt-3 text-[12px] text-matn-sokin space-y-0.5">
              {[...ishlatilgan].map(([m, n]) => <li key={m}><span className="raqam text-matn">{m}</span> — {n} ta savol</li>)}
            </ul>
          )}
          <p className="mt-3 text-[11.5px] text-matn-xira">To'g'ri / xato / bo'sh bali. «Oddiy» — savolning o'z bali{k.xatoJarima ? ` va umumiy jarima (${Math.round(k.xatoJarima * 100)}%)` : ''}.</p>
        </Karta>

        <MurakkabQoidalar exam={exam} belgilangan={belgilangan} tuzatadi={tuzatadi} band={band} onSaqla={(p, x) => saqla(p, x)}
          q={{ boglanish: k.boglanish || {}, olchangan: k.olchangan || [], bolimOtish: k.bolimOtish || {} }} />

        <Karta sarlavha="Kalit qayerdan">
          <p className="text-[12.5px] text-yaxshi">Savol qog'ozidan o'zi keldi · {variantlar.length} variant</p>
          {tuzatadi && <Tugma className="w-full mt-3" turi="oddiy" ikonka={<Wrench size={14} />} onClick={() => setTuzatish(true)}>Kalitni tuzatish (savollar bo'yicha)</Tugma>}
          <p className="mt-2 text-[11.5px] text-matn-xira">Savolda xato topilsa — to'g'ri javobni o'zgartiring yoki bekor qiling: natijalar o'zi qayta hisoblanadi.</p>
        </Karta>
      </div>

      <div className="space-y-3 min-w-0">
        {tuzatadi && (
          <div className="flex flex-wrap items-center gap-2 bg-sirt border border-chiziq rounded-2xl px-4 py-3 shadow-sm">
            <span className="text-[12.5px] text-matn-sokin">Belgilangan: <b className="raqam text-matn">{belgilangan.length}</b></span>
            <Tugma kichik turi="oddiy" ikonka={<CheckSquare size={13} />} onClick={() => setBelgi(belgilangan.length === hammasi.length ? new Set() : new Set(hammasi))}>{belgilangan.length === hammasi.length ? 'Belgini olish' : 'Hammasini belgilash'}</Tugma>
            <Tugma kichik ikonka={<Ban size={13} />} disabled={!belgilangan.length || band} onClick={() => bekorQil(belgilangan, false)}>Bekor — hammaga ball</Tugma>
            <Tugma kichik turi="oddiy" ikonka={<Undo2 size={13} />} disabled={!belgilangan.length || band} onClick={() => bekorQil(belgilangan, true)}>Qaytarish</Tugma>
            {smenalar.length > 1 && <span className="ml-auto"><Tanlov kichik qiymat={session} onChange={setSession} variantlar={smenalar.map(s => ({ v: s, nom: `${s}-smena` }))} /></span>}
          </div>
        )}
        <div className="bg-sirt border border-chiziq rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse" style={{ minWidth: 420 + variantlar.length * 64 }}>
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-matn-sokin">
                {tuzatadi && <th className="w-10 px-3 py-2.5"><span className="sr-only">Belgilash</span></th>}
                <th className="px-3 py-2.5 text-left font-semibold">№</th>
                {variantlar.map(v => <th key={v.code} className="px-2 py-2.5 font-semibold text-matn">{v.code}</th>)}
                <th className="px-3 py-2.5 text-left font-semibold">Turi</th>
                <th className="px-3 py-2.5 text-left font-semibold">Ball</th>
                <th className="px-3 py-2.5 text-left font-semibold">Mavzu</th>
              </tr>
            </thead>
            <tbody>
              {qatorlar.map((asos, i) => {
                const r = raqam(asos);
                const kataklar = variantlar.map(v => v.items[i]);
                const bekor = kataklar.some(it => it && k.cancelled[it.q]);
                const sx = k.ballSxemalari[r];
                const savol = savolMap.get(asos.q);
                const kop = asos.t === 'yopiq' && String(asos.javob || '').length > 1;
                return (
                  <tr key={r} className={`border-t border-chiziq ${belgi.has(r) ? 'bg-brand-fon/50 dark:bg-brand/10' : ''}`}>
                    {tuzatadi && <td className="px-3 py-2"><input type="checkbox" aria-label={`${r}-savol`} className="w-4 h-4 accent-[var(--color-brand)] cursor-pointer" checked={belgi.has(r)} onChange={() => almashtir(r)} /></td>}
                    <td className="px-3 py-2 raqam text-matn-sokin">{r}</td>
                    {bekor ? (
                      <td colSpan={variantlar.length} className="px-2 py-2 text-ogoh text-[12px]">Bekor qilingan — hammaga ball</td>
                    ) : kataklar.map((it, vi) => (
                      <td key={vi} className={`px-2 py-2 text-center raqam font-semibold ${it && k.keyFix[it.q] ? 'text-ogoh' : 'text-brand'}`}>{it ? kalitMatni(it) : '—'}</td>
                    ))}
                    <td className="px-3 py-2 text-matn-sokin whitespace-nowrap">{kop ? 'Bir nechta javob' : TUR[asos.t] || asos.t}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{sx ? <span title={sx.nom}><span className="raqam text-matn">{sxemaMatni(sx)}</span>{sx.nom ? <span className="text-matn-xira"> · {sx.nom}</span> : null}</span> : <span className="raqam text-matn-sokin">{son(asos.p)} ball</span>}</td>
                    <td className="px-3 py-2 text-matn-sokin">{savol?.topic || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-2.5 border-t border-chiziq text-[12px] text-matn-xira">Har variantning o'z ustuni — skaner varaqdagi variantga qarab shu ustun bilan tekshiradi. Sariq — tuzatilgan kalit. Ball: to'g'ri / xato / bo'sh.</p>
        </div>
      </div>
      {tuzatish && <KalitOynasi examId={exam.id} onYop={ozgardi => { setTuzatish(false); if (ozgardi) { yukla(); yangila(); } }} />}
    </div>
  );
}
