import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, CheckCircle2, AlertTriangle, Loader2, Pencil, Trash2, Plus, SlidersHorizontal } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { useAiHolat } from '../useAiHolat';
import AiKalitKartasi from '../AiKalitKartasi';
import { Tugma, Tanlov, SELECT, Yorliq, Maydon } from '../ui';
import { savolXatosi, qiyinlikDarajasi, guruhSavolimi } from '../../../../lib/imtihon.js';
import { TUR_NOMI } from '../../../lib/savolTuri';
import { DarajaTanlov, darajaMaydonlari, type DarajaQiymati } from './qiyinlik';
import { useDarajalar } from './useDarajalar';
import { fanniTop, mavzuniTop } from './useBankDaraxt';
import { type AiSavol, type Tekshiruv, izi, xatoMatni, Korinish, Tahrir, FanMavzuTanlov } from './aiUmumiy';
import { useRasmNavbati, RasmJarayoni, SavolRasmi, rasmIshi, rasmNatijasiniQoy, rasmKerakmi, rasmYetishmaydi, ichkiRasmlar, type RasmHolati } from './rasmNavbati';
import { rasmBelgisiBor, type RasmIshi, type RasmNatijasi } from '../../../lib/svgRasm';
import type { BankDaraxt, Question, SavolTuri } from '../../../types';

// Bankdagi BITTA savolga o'xshash savollar (savol kartasi va muharrirdagi «O'xshashini tuzish»): AI
// sonlari va javobi boshqa masalalar tuzadi → kalitni ko'rmay qayta yechib tekshiradi → ustoz ko'rib,
// tanlab bankka qo'shadi. Har bosqich — alohida qisqa so'rov. Tekshiruvdan o'tgani faol, o'tmagani
// qoralama bo'lib tushadi. Asl savolning chizmasi bo'lsa — yangilari ham chizmali tuziladi (matnda «[rasm]»)
// va AI ularni asl chizma uslubida vektor qilib chizadi (rasmNavbati.tsx). (Rasm yoki matndagi namunaga o'xshash tuzish — «Savol qo'shish → AI tuzadi»
// da, AiTuzish.tsx; bir nechta savolga birdan — OxshashKop.tsx.)

interface Natija extends AiSavol {
  kalit: number;
  tanlangan: boolean;
  /** undefined — tekshirilmoqda. */
  tekshiruv?: Tekshiruv;
  aslBilanBir?: boolean;
  /** Ustoz o'zi tuzatdi — AI tekshiruvi eskirdi, lekin odam tasdiqladi. */
  tahrirlandi?: boolean;
  /** Chizma qo'yilishidan oldingi matn («[rasm]» belgisi bilan) va chizma holati — rasmNavbati.tsx. */
  aslMatn?: string;
  rasm?: RasmHolati;
}

type Tur = '' | 'yopiq' | 'raqamli';
type Til = 'uz' | 'ru' | 'en';

let keyingiKalit = 1;

/** AI tekshiruvi / holat belgisi. */
function Belgi({ n }: { n: Natija }) {
  if (n.tahrirlandi) return <Yorliq rang="brand"><Pencil size={11} /> Tuzatildi</Yorliq>;
  if (!n.tekshiruv) return <Yorliq><Loader2 size={11} className="animate-spin" /> Tekshirilmoqda</Yorliq>;
  if (n.aslBilanBir) return <Yorliq rang="ogoh"><AlertTriangle size={11} /> Javobi asl masaladagidek</Yorliq>;
  if (n.tekshiruv.tekshirildi === true) return <Yorliq rang="yaxshi"><CheckCircle2 size={11} /> AI qayta yechdi — javob to'g'ri</Yorliq>;
  if (n.tekshiruv.tekshirildi === false) return <Yorliq rang="ogoh"><AlertTriangle size={11} /> AI boshqa javob chiqardi{n.tekshiruv.aiJavobi ? ` (${n.tekshiruv.aiJavobi})` : ''} — tekshiring</Yorliq>;
  return n.type === 'yozma' ? <Yorliq>Yozma — qoralama bo'lib tushadi</Yorliq> : <Yorliq>Tekshirilmadi</Yorliq>;
}

export default function OxshashSavollar({ daraxt, asl: bankdagi, onYop, onSaqlandi }: {
  daraxt: BankDaraxt;
  /** Bankdagi asl savol. */
  asl: Question;
  onYop: () => void;
  onSaqlandi: () => void;
}) {
  const { showNotification } = useCRM();
  const { soro, filial } = useImtihonApi();
  const ai = useAiHolat();
  const darajalar = useDarajalar();
  // Chizmalarni AI vektor qilib chizadi — navbat bilan (bir vaqtda 2 ta), to'xtatsa bo'ladi.
  const rasmNavbati = useRasmNavbati();
  // Asl savolning chizmasi (rasmi yoki matn ichidagi rasmlari): yangi masalalar chizmasiga namuna.
  const aslRasmlari = [bankdagi.imageUrl, ...ichkiRasmlar(bankdagi.text)].filter((x): x is string => !!x).slice(0, 2);

  // Qayerga: asl savolning mavzusiga (o'zgartirsa bo'ladi).
  const [fanId, setFanId] = useState<number | null>(() => daraxt.fanlar.find(f => f.mavzular.some(m => m.id === bankdagi.bankTopicId))?.id ?? null);
  const [mavzuId, setMavzuId] = useState<number | null>(bankdagi.bankTopicId ?? null);
  const [yangiMavzu, setYangiMavzu] = useState<string | null>(null);
  const fan = fanniTop(daraxt, fanId);
  const mavzu = mavzuniTop(fan, mavzuId);
  const mavzuNomi = yangiMavzu !== null ? yangiMavzu.trim() : mavzu?.name || '';

  // Sozlama.
  const [soni, setSoni] = useState<3 | 5 | 10>(5);
  const [usul, setUsul] = useState<'sonlar' | 'vaziyat'>('sonlar');
  const [tur, setTur] = useState<Tur>('');
  const [til, setTil] = useState<Til>((bankdagi.language as Til) || 'uz');

  const asl: AiSavol = {
    type: bankdagi.type, text: bankdagi.text, options: bankdagi.options || null, correctAnswer: bankdagi.correctAnswer || '',
    difficulty: qiyinlikDarajasi(bankdagi.difficulty || 2), language: bankdagi.language || 'uz', solution: bankdagi.solution || null,
    imageUrl: bankdagi.imageUrl || null,
  };
  const [aslTekshiruv, setAslTekshiruv] = useState<Tekshiruv | null>(null);
  const [natijalar, setNatijalar] = useState<Natija[] | null>(null);
  const [tahrirda, setTahrirda] = useState<number | null>(null);
  // Yangi savollarning qiyinligi: asl savolniki (foydalanuvchi darajasi bo'lsa — o'sha), o'zgartirsa bo'ladi.
  const [daraja, setDaraja] = useState<DarajaQiymati>({ d: qiyinlikDarajasi(bankdagi.difficulty || 2) as 1 | 2 | 3, darajaId: null });
  const darajaTegildi = useRef(false);
  useEffect(() => {
    if (darajaTegildi.current) return;
    const oz = darajalar.find(b => b.darajaId && (bankdagi.tagIds || []).includes(b.darajaId));
    if (oz) setDaraja({ d: oz.d, darajaId: oz.darajaId });
  }, [darajalar.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sozlama, setSozlama] = useState(true);
  const [holat, setHolat] = useState<string | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const band = !!holat || saqlanmoqda;
  const guruhli = guruhSavolimi(bankdagi.type);

  const royxatgaQosh = (klonlar: AiSavol[], eskilar: Natija[]): Natija[] => {
    const bor = new Set([izi(asl.text), ...eskilar.map(n => izi(n.text))]);
    return klonlar.filter(k => { const i = izi(k.text); if (bor.has(i)) return false; bor.add(i); return true; })
      .map(k => ({ ...k, kalit: keyingiKalit++, tanlangan: false }));
  };

  /** Mustaqil tekshiruv: asl masala + yangilari (AI kalitni ko'rmay yechadi). */
  const tekshir = async (yangilar: Natija[]) => {
    const kalitlar = new Set(yangilar.map(n => n.kalit));
    try {
      const r = await soro<{ natijalar: Tekshiruv[] }>('POST', 'ai/tekshir', { savollar: [asl, ...yangilar].slice(0, 12) });
      setAslTekshiruv(r.natijalar[0] || null);
      setNatijalar(l => (l || []).map(n => {
        const i = yangilar.findIndex(x => x.kalit === n.kalit);
        if (i < 0) return n;
        const t = r.natijalar[i + 1] || { tekshirildi: null, aiJavobi: '' };
        return { ...n, tekshiruv: t, tanlangan: (t.tekshirildi === true || (n.type === 'yozma' && !!n.solution)) && !n.aslBilanBir };
      }));
    } catch (e: any) {
      setNatijalar(l => (l || []).map(n => (kalitlar.has(n.kalit) ? { ...n, tekshiruv: { tekshirildi: null, aiJavobi: '' }, tanlangan: !n.aslBilanBir } : n)));
      showNotification(`Javoblarni tekshirib bo'lmadi (${xatoMatni(e)}) — tanlanganlari qoralama bo'lib qo'shiladi`, 'info');
    }
  };

  /** Yangi masala chizmasi so'rovi: matni bo'yicha, asl savolning chizmasi — uslub uchun namuna. */
  const rasmSorovi = (n: AiSavol) => ({ variantlar: n.options, javob: n.type === 'yozma' ? null : n.correctAnswer, fan: fan?.name, namuna: aslRasmlari.length ? aslRasmlari : null });
  const rasmKeldi = (kalit: number, n: RasmNatijasi) => setNatijalar(l => l && l.map(q => (q.kalit === kalit ? rasmNatijasiniQoy(q, n) : q)));
  const rasmlarniChizdir = async (ishlar: RasmIshi<number>[]) => {
    const kalitlar = new Set(ishlar.map(i => i.kalit));
    setNatijalar(l => l && l.map(q => (kalitlar.has(q.kalit) ? { ...q, rasm: { band: true } } : q)));
    const h = await rasmNavbati.chiz(ishlar, rasmKeldi);
    // Chizilmagani saqlashga to'sqinlik qilmaydi: belgi matnda qoladi, savol qoralama bo'lib tushadi.
    if (h.chizilmadi) showNotification(`${h.chizildi} ta rasm chizildi, ${h.chizilmadi} tasi chizilmadi: ${h.xato}. Kartadagi «Vektor qilib chizish» bilan qayta urinasiz`, 'error');
    else if (h.chizildi) showNotification(`${h.chizildi} ta rasm chizildi — ko'zdan kechiring`, 'success');
  };

  const tuz = async (qoshimcha = false) => {
    if (!fan) return showNotification('Fanni tanlang', 'error');
    if (!mavzuNomi) return showNotification('Mavzuni tanlang', 'error');
    // Shu safar tuzilgan chizmali masalalar — tekshiruvdan keyin navbat bilan chiziladi.
    let rasmIshlari: RasmIshi<number>[] = [];
    try {
      setHolat(`AI ${soni} ta o'xshash masala tuzmoqda…`);
      const r = await soro<{ klonlar: AiSavol[] }>('POST', 'ai/oxshash', {
        savol: { ...asl, subject: fan.name, topic: mavzuNomi, language: til }, soni, usul, tur: tur || null,
        // Asl savolning chizmasi bor — yangilari ham chizmali tuziladi (matnda «[rasm]» belgisi).
        rasmli: aslRasmlari.length > 0,
      });
      const eskilar = qoshimcha ? natijalar || [] : [];
      const yangilar = royxatgaQosh(r.klonlar, eskilar);
      if (!yangilar.length) throw new Error("AI yangi masala bermadi — qayta urinib ko'ring");
      setSozlama(false);
      setNatijalar([...eskilar, ...yangilar]);
      setHolat('AI javoblarni qayta yechib tekshirmoqda…');
      await tekshir(yangilar);
      rasmIshlari = yangilar.filter(n => rasmBelgisiBor(n.text)).map(n => rasmIshi(n.kalit, n, rasmSorovi(n)));
    } catch (e: any) {
      showNotification(xatoMatni(e), 'error');
    } finally {
      setHolat(null);
    }
    if (rasmIshlari.length) await rasmlarniChizdir(rasmIshlari);
  };

  const ozgartir = (kalit: number, d: Partial<Natija>) => setNatijalar(l => (l || []).map(n => (n.kalit === kalit ? { ...n, ...d } : n)));

  // Faol: AI qayta yechib tasdiqlagan yoki ustoz o'zi tuzatgan. Yozma (kaliti yo'q) va qolgani — qoralama.
  // Chizmasi kerak, lekin chizilmagan («[rasm]» belgisi matnda) masala ham qoralama.
  const ishonchli = (n: { type: SavolTuri; text: string; tekshiruv?: Tekshiruv; tahrirlandi?: boolean; aslBilanBir?: boolean }) =>
    (!!n.tahrirlandi || (n.type !== 'yozma' && n.tekshiruv?.tekshirildi === true && !n.aslBilanBir)) && !rasmYetishmaydi(n);
  const tanlanganlar = (natijalar || []).filter(n => n.tanlangan);

  const saqla = async () => {
    if (!fan || !mavzuNomi || !tanlanganlar.length) return;
    setSaqlanmoqda(true);
    try {
      const joy = { subject: fan.name, topic: mavzuNomi, bankTopicId: yangiMavzu === null ? mavzu?.id ?? null : null, ...darajaMaydonlari(daraja), language: til };
      let faolSoni = 0;
      const questions = tanlanganlar.map((n, i) => {
        const faol = ishonchli(n) && !savolXatosi({ ...n, ...joy } as any);
        if (faol) faolSoni++;
        return {
          type: n.type, text: n.text, options: n.type === 'yopiq' ? n.options : null,
          correctAnswer: n.type === 'yozma' ? '' : n.correctAnswer, solution: n.solution || null, solutionStatus: n.solution ? 'qoralama' : 'yoq',
          ...(n.imageUrl ? { imageUrl: n.imageUrl } : {}),
          ...joy, parentId: bankdagi.id, status: faol ? 'faol' : 'qoralama', source: "AI o'xshash", qator: i + 1,
        };
      });
      const r = await soro<{ count: number; xatolar: { qator: number; xato: string }[] }>('POST', 'questions/bulk', { questions, schoolId: filial });
      if (r.xatolar.length) showNotification(`${r.xatolar.length} tasi qo'shilmadi: ${r.xatolar[0].xato}`, 'info');
      const qoralama = r.count - faolSoni;
      showNotification(`${r.count} ta savol bankka qo'shildi${qoralama > 0 ? ` — ${qoralama} tasi qoralama (bankda tekshirib, faol qilasiz)` : ''}`, 'success');
      onSaqlandi();
      onYop();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  const otdi = (natijalar || []).filter(n => n.tekshiruv?.tekshirildi === true && !n.aslBilanBir).length;
  const aiYoq = ai && !ai.yoqilgan;

  return (
    <div className="fixed inset-0 z-[270] flex items-start justify-center overflow-y-auto p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="O'xshash savollar">
      <div className="fixed inset-0 bg-black/50" onClick={() => !band && onYop()} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-3xl border border-chiziq my-2 sm:my-4">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-chiziq">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn flex items-center gap-1.5"><Sparkles size={15} className="text-brand shrink-0" /> O'xshash savollar</h3>
            <p className="text-[12px] text-matn-xira">AI shu savolga o'xshash, sonlari va javobi boshqa masalalar tuzadi, keyin ularni qayta yechib tekshiradi.</p>
          </div>
          <button aria-label="Yopish" disabled={band} onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer disabled:opacity-40"><X size={16} /></button>
        </div>

        {guruhli ? (
          <p className="p-4 sm:p-5 text-[13px] text-matn">Bu guruhli savolning ({TUR_NOMI[bankdagi.type]}) bo'lagi — unga o'xshashini «Savol qo'shish → AI tuzadi» da, shu turni tanlab tuzasiz.</p>
        ) : aiYoq ? (
          <div className="p-4 sm:p-5">
            <AiKalitKartasi ixcham />
          </div>
        ) : !ai ? (
          <div className="p-8 flex justify-center"><Loader2 size={18} className="animate-spin text-matn-xira" /></div>
        ) : (
          <>
            <div className="p-4 sm:p-5 space-y-4">
              {/* 1. Asl savol */}
              <div className="rounded-xl border border-chiziq bg-ichki p-3 sm:p-4 space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <b className="text-[12.5px] text-matn">Asl savol</b>
                  <Yorliq>{TUR_NOMI[asl.type]}</Yorliq>
                  {aslTekshiruv?.tekshirildi === true && <Yorliq rang="yaxshi"><CheckCircle2 size={11} /> Javob to'g'ri</Yorliq>}
                  {aslTekshiruv?.tekshirildi === false && <Yorliq rang="ogoh"><AlertTriangle size={11} /> AI boshqa javob chiqardi{aslTekshiruv.aiJavobi ? ` (${aslTekshiruv.aiJavobi})` : ''}</Yorliq>}
                </div>
                <Korinish q={asl} />
              </div>

              {/* 2. Qayerga va qanday */}
              {natijalar !== null && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                  <span className="text-matn-sokin min-w-0">
                    Qayerga: <b className="text-matn">{fan?.name} › {mavzuNomi || '—'}</b> · {usul === 'sonlar' ? 'faqat sonlar' : 'vaziyat ham'}
                  </span>
                  <Tugma kichik turi="oddiy" ikonka={<SlidersHorizontal size={13} />} disabled={band} onClick={() => setSozlama(v => !v)}>{sozlama ? 'Yopish' : "O'zgartirish"}</Tugma>
                </div>
              )}
              {sozlama && (
                <div className="space-y-4 rounded-xl border border-chiziq p-3 sm:p-4">
                  <FanMavzuTanlov fanlar={daraxt.fanlar} fan={fan} mavzuId={mavzuId} yangiMavzu={yangiMavzu} band={band}
                    onFan={(id) => { setFanId(id); setMavzuId(null); setYangiMavzu(null); }} onMavzu={setMavzuId} onYangiMavzu={setYangiMavzu} />
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                      <Maydon div nom="Nechta">
                        <Tanlov qiymat={soni} onChange={setSoni} variantlar={[{ v: 3, nom: '3' }, { v: 5, nom: '5' }, { v: 10, nom: '10' }]} />
                      </Maydon>
                      <Maydon div nom="Nima o'zgarsin" izoh={usul === 'sonlar' ? "Matn va yechish usuli o'sha, sonlar va javob boshqa." : "Boshqa vaziyat (ism, narsa, hikoya), yechish usuli va qiyinligi o'sha."}>
                        <Tanlov qiymat={usul} onChange={setUsul} variantlar={[{ v: 'sonlar', nom: 'Faqat sonlar' }, { v: 'vaziyat', nom: 'Vaziyat ham' }]} />
                      </Maydon>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      <Maydon nom="Javob shakli">
                        <select className={SELECT} value={tur} onChange={e => setTur(e.target.value as Tur)} aria-label="Javob shakli">
                          <option value="">Asl masaladek</option>
                          <option value="yopiq">Variantli (A–D)</option>
                          <option value="raqamli">Javobi son/matn</option>
                        </select>
                      </Maydon>
                      <Maydon nom="Til">
                        <select className={SELECT} value={til} onChange={e => setTil(e.target.value as Til)} aria-label="Til">
                          <option value="uz">O'zbekcha</option><option value="ru">Ruscha</option><option value="en">Inglizcha</option>
                        </select>
                      </Maydon>
                    </div>
                  </div>
                </div>
              )}

              {(!natijalar?.length || sozlama) && (
                <div className="flex justify-end">
                  <Tugma turi="asosiy" ikonka={<Sparkles size={14} />} yuklanmoqda={!!holat} disabled={!!rasmNavbati.holat} onClick={() => tuz(false)}>
                    {natijalar?.length ? 'Qayta tuzish' : `${soni} ta o'xshash masala tuzish`}
                  </Tugma>
                </div>
              )}
              {holat && (
                <p className="flex items-center justify-center gap-2 text-[12.5px] text-matn-sokin" role="status"><Loader2 size={14} className="animate-spin" /> {holat}</p>
              )}
              <RasmJarayoni holat={rasmNavbati.holat} onToxtat={rasmNavbati.toxtat} />

              {/* 3. Natija */}
              {!!natijalar?.length && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] text-matn">
                      <b>{natijalar.length}</b> ta masala tuzildi
                      {natijalar.every(n => n.tekshiruv) && natijalar.some(n => n.type !== 'yozma') && <> · <span className="text-yaxshi font-semibold">{otdi} tasi AI tekshiruvidan o'tdi</span></>}
                    </p>
                    <div className="flex gap-2">
                      <Tugma kichik turi="oddiy" disabled={band} onClick={() => setNatijalar(l => (l || []).map(n => ({ ...n, tanlangan: true })))}>Hammasini tanlash</Tugma>
                      <Tugma kichik ikonka={<Plus size={13} />} disabled={band || !!rasmNavbati.holat} onClick={() => tuz(true)}>Yana {soni} ta</Tugma>
                    </div>
                  </div>
                  {natijalar.map((n, i) => (
                    <div key={n.kalit} className={`rounded-xl border p-3 transition-colors ${n.tanlangan ? 'border-brand/40 bg-sirt' : 'border-chiziq bg-ichki/60'}`}>
                      <div className="flex items-start gap-2.5">
                        <input type="checkbox" aria-label={`${i + 1}-masalani tanlash`} className="mt-1 w-4 h-4 shrink-0 accent-[var(--color-brand)] cursor-pointer"
                          checked={n.tanlangan} disabled={tahrirda === n.kalit} onChange={e => ozgartir(n.kalit, { tanlangan: e.target.checked })} />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <b className="text-[12.5px] text-matn">{i + 1}.</b>
                            <Belgi n={n} />
                            {tur && tur !== asl.type && <Yorliq>{TUR_NOMI[n.type]}</Yorliq>}
                          </div>
                          {tahrirda === n.kalit
                            ? <Tahrir q={n} onBekor={() => setTahrirda(null)} onSaqla={q => { ozgartir(n.kalit, { ...q, tahrirlandi: true, tanlangan: true }); setTahrirda(null); }} />
                            : <Korinish q={n} rasmsiz={rasmKerakmi(n)} onJavob={band ? undefined : j => ozgartir(n.kalit, { correctAnswer: j, tahrirlandi: true, tanlangan: true })} />}
                          {tahrirda !== n.kalit && rasmKerakmi(n) && (
                            <SavolRasmi q={n} sorov={rasmSorovi(n)} band={band} onOzgar={f => setNatijalar(l => (l || []).map(x => (x.kalit === n.kalit ? f(x) : x)))} />
                          )}
                        </div>
                        {tahrirda !== n.kalit && (
                          <div className="flex flex-col gap-1 shrink-0">
                            <button aria-label="Tuzatish" disabled={band || !!n.rasm?.band} onClick={() => setTahrirda(n.kalit)} className="p-1.5 rounded-lg text-matn-xira hover:text-brand hover:bg-ichki cursor-pointer disabled:opacity-40"><Pencil size={14} /></button>
                            <button aria-label="Olib tashlash" disabled={band} onClick={() => setNatijalar(l => (l || []).filter(x => x.kalit !== n.kalit))} className="p-1.5 rounded-lg text-matn-xira hover:text-xato hover:bg-ichki cursor-pointer disabled:opacity-40"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bankka qo'shish */}
            {!!natijalar?.length && (
              <div className="sticky bottom-0 z-10 bg-sirt rounded-b-2xl border-t border-chiziq px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold text-matn-sokin">Qiyinlik</span>
                  <DarajaTanlov kichik qiymat={daraja} onChange={(d) => { darajaTegildi.current = true; setDaraja(d); }} />
                </div>
                <div className="flex flex-col items-stretch sm:items-end gap-1">
                  <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} disabled={!tanlanganlar.length || !!holat || rasmNavbati.band || tahrirda !== null} onClick={saqla}>
                    {tanlanganlar.length ? `${tanlanganlar.length} ta savolni bankka qo'shish` : 'Masalalarni belgilang'}
                  </Tugma>
                  {tanlanganlar.some(n => !ishonchli(n)) && <span className="text-[11px] text-matn-xira">Tekshiruvdan o'tmaganlari qoralama bo'lib tushadi</span>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
