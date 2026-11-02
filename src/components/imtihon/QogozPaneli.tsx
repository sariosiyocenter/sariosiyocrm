import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, INPUT } from './ui';
import type { ImtihonTafsil } from './turlar';

// «Savol qog'ozi» bo'limining chap paneli (Addmen QPG «Generate Paper» kabi): variantlar soni,
// har variantda boshqa savolmi yoki bir xil, savol to'plamlari (Group × Set), ko'p ishlatilganini
// olmaslik, takror va aralashtirish. O'zgartirilsa — saqlanadi va savollar qayta tanlanadi.
// Variantlar tasdiqlangan (qulflangan) bo'lsa, avval qulf ochiladi (natija kelguncha mumkin).

type Takror = 'variant' | 'savol' | 'yoq';
interface Qiymat {
  variantCount: number;
  har: boolean;
  toplamlar: number;
  chegara: string;
  takror: Takror;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  /** Aralashmaydigan fanlar (blok tartib raqamlari). */
  qotirBloklar: number[];
}

function boshlangich(exam: ImtihonTafsil): Qiymat {
  const s = exam.settings as ImtihonTafsil['settings'] & { toplamlar?: number; ishlatishChegarasi?: number | null; takror?: Takror };
  return {
    variantCount: s.variantCount,
    har: s.variantSavollari === 'har',
    toplamlar: s.toplamlar || 0,
    chegara: s.ishlatishChegarasi == null ? '' : String(s.ishlatishChegarasi),
    takror: s.takror || 'variant',
    shuffleQuestions: s.shuffleQuestions,
    shuffleOptions: s.shuffleOptions,
    qotirBloklar: s.qotirBloklar || [],
  };
}

/** Variantlar sonini teng bo'ladigan to'plamlar soni (2 … n−1). */
function toplamVariantlari(n: number): number[] {
  const l: number[] = [];
  for (let d = 2; d < n; d++) if (n % d === 0) l.push(d);
  return l;
}

const KOD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const TOPLAM_RANGI = [
  'bg-brand-fon border-brand/30 text-brand-dark dark:bg-brand/15 dark:text-brand-accent',
  'bg-ogoh-fon border-ogoh/30 text-ogoh',
  'bg-yaxshi-fon border-yaxshi/30 text-yaxshi',
  'bg-ichki border-chiziq-kuchli text-matn',
];

export default function QogozPaneli({ exam, onOzgardi }: { exam: ImtihonTafsil; onOzgardi: () => Promise<void> | void }) {
  const { ozgartira, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.imtihon');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const [q, setQ] = useState<Qiymat>(() => boshlangich(exam));
  const [band, setBand] = useState(false);
  useEffect(() => { setQ(boshlangich(exam)); }, [exam]);

  const asl = boshlangich(exam);
  const ozgargan = JSON.stringify(asl) !== JSON.stringify(q);
  const natijaBor = exam._count.results > 0;
  const qulf = !!exam.lockedAt;
  const qoy = (patch: Partial<Qiymat>) => setQ(x => ({ ...x, ...patch }));

  const n = q.variantCount;
  const toplamlar = toplamVariantlari(n);
  const G = q.har && n > 1 ? (q.toplamlar >= 2 && q.toplamlar < n ? q.toplamlar : n) : 1;
  const tartibQotgan = q.har && G === n;
  // Variant harflari to'plam bo'yicha: A, C — 1-to'plam; B, D — 2-to'plam (yonma-yonlarga boshqa).
  const guruhlar = Array.from({ length: Math.min(n, 26) }, (_, i) => ({ kod: KOD[i], toplam: i % G }));

  const saqla = async () => {
    if (qulf) {
      const ok = await confirm("Variantlar qayta tanlanadi: tasdiqlangan variantlar o'chadi, chop etilgan kitobcha va varaqlar yaroqsiz bo'ladi. Davom etilsinmi?");
      if (!ok) return;
    }
    setBand(true);
    try {
      if (qulf) await soro('POST', `exams/${exam.id}/unlock`);
      const chegara = q.chegara.trim() === '' ? null : Math.max(0, Math.round(Number(q.chegara) || 0));
      await soro('PUT', `exams/${exam.id}`, {
        settings: {
          variantCount: q.variantCount,
          variantSavollari: q.har && q.variantCount > 1 ? 'har' : 'bir',
          toplamlar: q.har ? q.toplamlar : 0,
          ishlatishChegarasi: chegara,
          takror: q.takror,
          shuffleQuestions: tartibQotgan ? false : q.shuffleQuestions,
          shuffleOptions: q.shuffleOptions,
          qotirBloklar: q.qotirBloklar,
        },
      });
      showNotification("Saqlandi — savollar qayta tanlanmoqda", 'success');
      await onOzgardi();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const ochiq = tahrir && !natijaBor;

  return (
    <Karta sarlavha="Variantlar" izoh={qulf ? 'Tasdiqlangan · o\'zgartirsangiz, qayta tanlanadi' : "O'zgartiring — savollar qayta tanlanadi"}>
      <fieldset disabled={!ochiq || band} className="space-y-4 disabled:opacity-70">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[12px] font-semibold text-matn-sokin mb-1">Variantlar soni</span>
            <input type="number" min={1} max={26} className={INPUT} value={q.variantCount}
              onChange={e => { const v = Math.max(1, Math.min(26, Number(e.target.value) || 1)); qoy({ variantCount: v, toplamlar: toplamVariantlari(v).includes(q.toplamlar) ? q.toplamlar : 0 }); }} />
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold text-matn-sokin mb-1">Ishlatilgani ≤ (marta)</span>
            <input inputMode="numeric" placeholder="cheklovsiz" className={INPUT} value={q.chegara} onChange={e => qoy({ chegara: e.target.value.replace(/\D/g, '') })} />
          </label>
        </div>

        {n > 1 && (
          <div role="radiogroup" aria-label="Variantlarda savollar" className="space-y-2">
            {([
              [true, 'Har variantda boshqa savol', "Bir raqamda hamma variantda mavzu va qiyinlik bir xil"],
              [false, 'Hammasida bir xil savol', "Faqat tartibi va javob harflari boshqa"],
            ] as const).map(([v, nomi, izoh]) => (
              <button key={nomi} type="button" role="radio" aria-checked={q.har === v} onClick={() => qoy({ har: v })}
                className={`w-full text-left rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${q.har === v ? 'border-brand bg-brand-fon/60 dark:bg-brand/10' : 'border-chiziq hover:bg-ichki'}`}>
                <span className="block text-[13px] font-semibold text-matn">{nomi}</span>
                <span className="block text-[11.5px] text-matn-xira mt-0.5">{izoh}</span>
              </button>
            ))}
          </div>
        )}

        {q.har && toplamlar.length > 0 && (
          <div className="space-y-2">
            <label className="block">
              <span className="block text-[12px] font-semibold text-matn-sokin mb-1">Savol to'plamlari</span>
              <select className={INPUT} value={toplamlar.includes(q.toplamlar) ? q.toplamlar : 0} onChange={e => qoy({ toplamlar: Number(e.target.value) })}>
                <option value={0}>{n} ta — har variant o'z savollari</option>
                {toplamlar.map(d => <option key={d} value={d}>{d} ta — har biri {n / d} xil tartibda</option>)}
              </select>
            </label>
            {G < n && (
              <>
                <div className="flex flex-wrap gap-1.5" aria-label="Variantlar to'plamlar bo'yicha">
                  {guruhlar.map(g => (
                    <span key={g.kod} title={`${g.toplam + 1}-to'plam`} className={`h-8 px-2 rounded-lg flex items-center justify-center gap-1 text-[13px] font-bold border ${TOPLAM_RANGI[g.toplam % TOPLAM_RANGI.length]}`}>
                      {g.kod}<span className="text-[10px] font-semibold opacity-80">{g.toplam + 1}</span>
                    </span>
                  ))}
                </div>
                <p className="text-[11.5px] text-matn-xira">Raqam va rang — to'plam. Yonma-yon o'tirganlarga boshqa to'plam, oldi-orqadagilarga o'sha to'plamning boshqa tartibi.</p>
              </>
            )}
          </div>
        )}

        <label className="block">
          <span className="block text-[12px] font-semibold text-matn-sokin mb-1">Takror savol (bankda bir xili)</span>
          <select className={INPUT} value={q.takror} onChange={e => qoy({ takror: e.target.value as Takror })}>
            <option value="variant">Matni va javoblari bir xil — bittasi</option>
            <option value="savol">Matni bir xil — bittasi</option>
            <option value="yoq">Tekshirilmasin</option>
          </select>
        </label>

        <div className="space-y-2 text-[13px] text-matn">
          <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[var(--color-brand)]" checked={q.shuffleOptions} onChange={e => qoy({ shuffleOptions: e.target.checked })} />Javob harflari (A–E) aralashsin</label>
          <label className={`flex items-center gap-2.5 ${tartibQotgan ? 'text-matn-xira' : 'cursor-pointer'}`}>
            <input type="checkbox" className="w-4 h-4 accent-[var(--color-brand)]" disabled={tartibQotgan} checked={!tartibQotgan && q.shuffleQuestions} onChange={e => qoy({ shuffleQuestions: e.target.checked })} />
            {tartibQotgan ? "Savollar tartibi — raqamlar qotirilgan (har raqam bir mavzu)" : 'Savollar tartibi aralashsin'}
          </label>
          {!tartibQotgan && q.shuffleQuestions && exam.blocks.length > 0 && (
            <div className="pl-6">
              <span className="block text-[11.5px] text-matn-xira mb-1.5">Bu fanlarda tartib o'zgarmasin (masalan, oson → qiyin):</span>
              <div className="flex flex-wrap gap-1.5">
                {exam.blocks.map((b, i) => {
                  const qotgan = q.qotirBloklar.includes(i);
                  return (
                    <button key={i} type="button" aria-pressed={qotgan}
                      onClick={() => qoy({ qotirBloklar: qotgan ? q.qotirBloklar.filter(x => x !== i) : [...q.qotirBloklar, i].sort((a, c) => a - c) })}
                      className={`px-2.5 py-1 rounded-full border text-[12px] cursor-pointer transition-colors ${qotgan ? 'border-brand bg-brand-fon text-brand font-semibold dark:bg-brand/15' : 'border-chiziq text-matn-sokin hover:bg-ichki'}`}>
                      {b.subject}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </fieldset>

      {tahrir && (natijaBor
        ? <p className="mt-3 text-[12px] text-matn-xira">Natijalar bor — variantlarni endi o'zgartirib bo'lmaydi.</p>
        : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Tugma turi="asosiy" className="flex-1" ikonka={<RefreshCw size={14} />} yuklanmoqda={band} disabled={!ozgargan} onClick={saqla}>
              {qulf ? "O'zgartirish va qayta tanlash" : 'Saqlash va qayta tanlash'}
            </Tugma>
            {ozgargan && <Tugma turi="oddiy" disabled={band} onClick={() => setQ(asl)}>Bekor</Tugma>}
          </div>
        ))}
    </Karta>
  );
}
