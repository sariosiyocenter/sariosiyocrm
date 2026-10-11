import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowRight, BookMarked, ListOrdered, TrendingUp, FileText } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Karta, Tugma, Maydon, SELECT } from '../ui';
import AiKalitKartasi from '../AiKalitKartasi';
import MatnlarOynasi from '../MatnlarOynasi';
import { useDarajalar } from './useDarajalar';
import type { BankDaraxt, BankFan, BankMavzu } from '../../../types';

// Savollar banki → Sozlamalar (egasi, 2026-10-10: «savollar bankiga oid sozlamalarni o'ziga
// qo'shish, andoza chapiga»). Bankka oid hamma narsa shu yerda: qiyinlik darajalari, fanning
// mavzulari (o'quv rejadan olish, tartibi), qiyinlikni imtihon natijasiga moslash, umumiy
// matnlar va AI yordamchi. Olib tashlangan «Statistika» ko'rinishidan faqat boshqa joyda yo'q
// amallar ko'chdi. Qiyinlik darajalari va filtrlar savollar ro'yxatining o'zida tahrirlanadi —
// bu yerda ikkinchi muharrir yo'q, faqat ko'rinishi va yo'l.

// Telefonda barmoq bilan bosiladigan o'lcham (36px).
const SURISH_TUGMA = 'inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg text-matn-sokin hover:text-brand hover:bg-ichki disabled:opacity-30 cursor-pointer disabled:cursor-default';

/** Mavzular bo'lim bo'yicha (bo'limlar birinchi uchragan tartibda) — ro'yxatdagi daraxt kabi. */
function bolimlarBoyicha(mavzular: BankMavzu[]): { bolim: string; mavzular: BankMavzu[] }[] {
  const out: { bolim: string; mavzular: BankMavzu[] }[] = [];
  for (const m of mavzular) {
    const b = (m.section || '').trim();
    const g = out.find(x => x.bolim === b);
    if (g) g.mavzular.push(m); else out.push({ bolim: b, mavzular: [m] });
  }
  return out;
}

export default function BankSozlamalari({ daraxt, fanId, yangila, onRoyxat }: {
  daraxt: BankDaraxt;
  /** Ro'yxatda ochiq turgan fan — «Mavzular» shundan boshlanadi. */
  fanId: number | null;
  yangila: () => Promise<unknown>;
  /** Savollar ro'yxatiga qaytish. */
  onRoyxat: () => void;
}) {
  const { showNotification, syllabuses } = useCRM();
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const darajalar = useDarajalar();
  const [tanlanganFan, setTanlanganFan] = useState<number | null>(fanId);
  const [rejaId, setRejaId] = useState<number | ''>('');
  const [tartib, setTartib] = useState<BankMavzu[] | null>(null);
  const [matnlar, setMatnlar] = useState(false);
  const [band, setBand] = useState<string | null>(null);
  const royxatRef = useRef<HTMLUListElement>(null);
  const surilgan = useRef<{ id: number; qadam: -1 | 1 } | null>(null);

  const fan = daraxt.fanlar.find(f => f.id === tanlanganFan) || daraxt.fanlar[0] || null;
  const rejalar = (syllabuses || []).filter(s => (s.topics?.length || 0) > 0);
  const mosEmas = daraxt.fanlar.filter(f => f.moslash > 0);
  // Fan almashsa — boshlangan tartiblash bekor bo'ladi.
  useEffect(() => { setTartib(null); }, [fan?.id]);

  const ish = async (nom: string, f: () => Promise<void>) => {
    setBand(nom);
    try { await f(); } catch (e: unknown) { showNotification(e instanceof Error ? e.message : 'Xatolik', 'error'); } finally { setBand(null); }
  };

  const moslash = async (f: BankFan) => {
    if (!(await confirm({ title: `«${f.name}»: qiyinlik natijaga moslansinmi?`, message: `${f.moslash} ta savolning qiyinligi imtihon natijasiga qarab o'zgaradi.`, confirmLabel: 'Moslash' }))) return;
    await ish(`moslash-${f.id}`, async () => {
      const r = await soro<{ ozgardi: number }>('POST', 'bank/kalibrla', { subjectId: f.id });
      await yangila();
      showNotification(`«${f.name}»: ${r.ozgardi} ta savolning qiyinligi imtihon natijasiga moslandi`, 'success');
    });
  };

  const rejadan = () => fan && rejaId && ish('reja', async () => {
    const r = await soro<{ qoshildi: number; bor: number; reja: string }>('POST', 'bank/mavzular/oquv-reja', { subjectId: fan.id, syllabusId: rejaId });
    await yangila();
    showNotification(r.qoshildi ? `«${r.reja}» dan «${fan.name}» ga ${r.qoshildi} ta mavzu qo'shildi${r.bor ? ` (${r.bor} tasi bor edi)` : ''}` : "Bu o'quv rejaning hamma mavzusi fanda bor", r.qoshildi ? 'success' : 'info');
  });

  // Mavzu faqat o'z bo'limi ichida suriladi: ro'yxatda bo'limlar o'z tartibida turadi.
  const surish = (m: BankMavzu, qadam: -1 | 1) => {
    surilgan.current = { id: m.id, qadam };
    setTartib(l => {
      if (!l) return l;
      const qardoshlar = l.filter(x => (x.section || '').trim() === (m.section || '').trim());
      const qoshni = qardoshlar[qardoshlar.indexOf(m) + qadam];
      if (!qoshni) return l;
      return l.map(x => (x === m ? qoshni : x === qoshni ? m : x));
    });
  };
  // Qator joyi almashganda brauzer fokusni yo'qotadi — klaviaturada ketma-ket surish uchun
  // fokus surilgan mavzuning o'sha tugmasiga (chetga yetgan bo'lsa — teskarisiga) qaytariladi.
  useEffect(() => {
    const s = surilgan.current;
    if (!s) return;
    surilgan.current = null;
    const tugma = (qadam: number) => royxatRef.current?.querySelector<HTMLButtonElement>(`[data-surish="${s.id}:${qadam}"]:not(:disabled)`);
    (tugma(s.qadam) || tugma(-s.qadam))?.focus();
  }, [tartib]);
  const tartibSaqla = () => tartib && ish('tartib', async () => {
    await soro('POST', 'bank/mavzular/tartib', { ids: bolimlarBoyicha(tartib).flatMap(g => g.mavzular.map(m => m.id)) });
    await yangila();
    setTartib(null);
    showNotification('Mavzular tartibi saqlandi', 'success');
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div className="space-y-4 min-w-0">
        <Karta sarlavha="Qiyinlik darajalari" izoh="Hamma fanlar uchun bitta ro'yxat — savol qo'shishda ham, imtihon tuzishda ham shular">
          <div className="flex flex-wrap gap-1.5">
            {darajalar.map(b => (
              <span key={b.kalit} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold ${b.rang.fon} ${b.rang.matn} ${b.rang.chiziq}`}>
                <span className={`w-2 h-2 rounded-full ${b.rang.nuqta}`} />{b.nom}
              </span>
            ))}
          </div>
          <p className="text-[12px] text-matn-sokin mt-3">Nomini o'zgartirish, yangi daraja qo'shish yoki o'chirish — savollar ro'yxatida, chap tomondagi «Qiyinlik» ostida.</p>
          <Tugma kichik className="mt-2.5" ikonka={<ArrowRight size={13} />} onClick={onRoyxat}>Ro'yxatda o'zgartirish</Tugma>
        </Karta>

        <Karta sarlavha="Qiyinlikni imtihon natijasiga moslash" izoh="Imtihonda ishlatilgan savolni ko'pchilik topgan bo'lsa — osonroq, kam topgan bo'lsa — qiyinroq darajaga o'tadi">
          {!mosEmas.length ? (
            <p className="text-[12.5px] text-matn-sokin">Hozir natijaga mos kelmaydigan savol yo'q. Savollar imtihonda ishlatilgach, qo'yilgan qiyinligi natijaga to'g'ri kelmaydiganlari shu yerda chiqadi.</p>
          ) : (
            <ul className="divide-y divide-chiziq -my-1">
              {mosEmas.map(f => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 text-[13px] text-matn"><b className="font-semibold">{f.name}</b> — {f.moslash} ta savol mos emas</span>
                  <Tugma kichik ikonka={<TrendingUp size={13} />} yuklanmoqda={band === `moslash-${f.id}`} disabled={!!band} onClick={() => moslash(f)}>Moslash</Tugma>
                </li>
              ))}
            </ul>
          )}
        </Karta>

        <Karta sarlavha="Umumiy matnlar" izoh="Bir nechta savolga bitta matn yoki rasm (masalan o'qish matni va unga 4 ta savol)">
          <Tugma kichik ikonka={<FileText size={13} />} onClick={() => setMatnlar(true)}>Matnlarni ochish</Tugma>
        </Karta>
      </div>

      <div className="space-y-4 min-w-0">
        <Karta sarlavha="Mavzular" izoh="Mavzuni qo'lda qo'shish va nomini o'zgartirish — savollar ro'yxatining chap tomonida">
          {!fan ? (
            <p className="text-[12.5px] text-matn-sokin">Bankda hali fan yo'q — avval savollar ro'yxatida fan qo'shing.</p>
          ) : (
            <div className="space-y-4">
              {daraxt.fanlar.length > 1 && (
                <Maydon nom="Fan">
                  <select className={SELECT} value={fan.id} onChange={e => setTanlanganFan(Number(e.target.value))}>
                    {daraxt.fanlar.map(f => <option key={f.id} value={f.id}>{f.name} — {f.mavzular.length} ta mavzu</option>)}
                  </select>
                </Maydon>
              )}

              <Maydon div nom="O'quv rejadan olish" izoh={rejalar.length
                ? `Rejadagi mavzular bo'limlari bilan «${fan.name}» ga qo'shiladi; borlari takrorlanmaydi.`
                : "Mavzulari yozilgan o'quv reja yo'q — «O'quv reja» bo'limida tuziladi."}>
                {rejalar.length > 0 && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select className={SELECT} aria-label="O'quv reja" value={rejaId} onChange={e => setRejaId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">O'quv rejani tanlang…</option>
                      {rejalar.map(s => <option key={s.id} value={s.id}>{s.name} — {s.topics?.length} ta mavzu</option>)}
                    </select>
                    <Tugma className="shrink-0" ikonka={<BookMarked size={14} />} yuklanmoqda={band === 'reja'} disabled={!rejaId || !!band} onClick={rejadan}>Mavzularni qo'shish</Tugma>
                  </div>
                )}
              </Maydon>

              {fan.mavzular.length > 1 && (
                <Maydon div nom="Mavzular tartibi" izoh={tartib ? "Mavzu o'z bo'limi ichida suriladi" : "Ro'yxatda va imtihon tuzishda mavzular shu tartibda chiqadi"}>
                  {!tartib ? (
                    <Tugma kichik ikonka={<ListOrdered size={13} />} disabled={!!band} onClick={() => setTartib(fan.mavzular)}>Tartibni o'zgartirish</Tugma>
                  ) : (
                    <div className="space-y-2">
                      <ul ref={royxatRef} className="rounded-xl border border-chiziq divide-y divide-chiziq max-h-[26rem] overflow-y-auto">
                        {bolimlarBoyicha(tartib).map(g => (
                          <React.Fragment key={g.bolim}>
                            {g.bolim && <li className="px-3 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-matn-xira bg-ichki/50">{g.bolim}</li>}
                            {g.mavzular.map((m, i) => (
                              <li key={m.id} className="flex items-center gap-0.5 pl-2 pr-1 py-0.5">
                                <span className="flex-1 min-w-0 truncate px-1 text-[13px] text-matn">{m.name}</span>
                                <button type="button" data-surish={`${m.id}:-1`} aria-label={`${m.name} — yuqoriga`} disabled={i === 0} onClick={() => surish(m, -1)} className={SURISH_TUGMA}><ArrowUp size={15} /></button>
                                <button type="button" data-surish={`${m.id}:1`} aria-label={`${m.name} — pastga`} disabled={i === g.mavzular.length - 1} onClick={() => surish(m, 1)} className={SURISH_TUGMA}><ArrowDown size={15} /></button>
                              </li>
                            ))}
                          </React.Fragment>
                        ))}
                      </ul>
                      <div className="flex justify-end gap-2">
                        <Tugma kichik turi="oddiy" disabled={band === 'tartib'} onClick={() => setTartib(null)}>Bekor</Tugma>
                        <Tugma kichik turi="asosiy" yuklanmoqda={band === 'tartib'} onClick={tartibSaqla}>Tartibni saqlash</Tugma>
                      </div>
                    </div>
                  )}
                </Maydon>
              )}
            </div>
          )}
        </Karta>

        <AiKalitKartasi />
      </div>

      {matnlar && <MatnlarOynasi onYop={() => setMatnlar(false)} />}
    </div>
  );
}
