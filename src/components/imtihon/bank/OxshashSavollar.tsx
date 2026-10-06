import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Camera, Type, CheckCircle2, AlertTriangle, Loader2, Pencil, Trash2, RotateCcw, Plus, SlidersHorizontal } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { useAiHolat } from '../useAiHolat';
import AiKalitKartasi from '../AiKalitKartasi';
import { Tugma, Tanlov, INPUT, SELECT, Yorliq, Maydon } from '../ui';
import { SAVOL_TURI_NOMI, savolXatosi, qiyinlikDarajasi } from '../../../../lib/imtihon.js';
import { QiyinlikTanlov } from './qiyinlik';
import { fanniTop, mavzuniTop, bolimlarga } from './useBankDaraxt';
import { type AiSavol, type Tekshiruv, rasmTayyorla, htmlMatnga, matniBor, izi, xatoMatni, Korinish, Tahrir } from './aiUmumiy';
import type { BankDaraxt, Question, SavolTuri } from '../../../types';

// Rasmdan o'xshash savollar (egasi, 2026-09-27: "misol rasmini AI oladi, o'sha
// bilan bir xil, sonlar va javob boshqa bo'lgan masala tuzib beradi — savollar
// bankini yig'ib ketamiz"). Oqim: rasm (yoki matn, yoki bankdagi savol) → AI
// o'qiydi → N ta o'xshash masala → AI ularni kalitni ko'rmay qayta yechib
// tekshiradi → ustoz ko'rib, tanlab bankka qo'shadi. Har bosqich — alohida
// qisqa so'rov. Tekshiruvdan o'tgani faol, o'tmagani qoralama bo'lib tushadi.

interface Natija extends AiSavol {
  kalit: number;
  tanlangan: boolean;
  /** undefined — tekshirilmoqda. */
  tekshiruv?: Tekshiruv;
  aslBilanBir?: boolean;
  /** Ustoz o'zi tuzatdi — AI tekshiruvi eskirdi, lekin odam tasdiqladi. */
  tahrirlandi?: boolean;
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
  return n.type === 'yozma' ? <Yorliq>Yozma — ustoz baholaydi</Yorliq> : <Yorliq>Tekshirilmadi</Yorliq>;
}


export default function OxshashSavollar({ daraxt, fanId: boshFan = null, mavzuId: boshMavzu = null, asl: bankdagi = null, onRejim, onYop, onSaqlandi }: {
  daraxt: BankDaraxt;
  /** Berilsa — sarlavhada «Fayldan | O'xshashini tuzish» almashtirgichi chiqadi («Savol qo'shish» oynasining ikkinchi yo'li). */
  onRejim?: (rejim: 'fayl' | 'oxshash') => void;
  fanId?: number | null;
  mavzuId?: number | null;
  /** Bankdagi savolga o'xshash tuzish — rasm bosqichi o'tkazib yuboriladi. */
  asl?: Question | null;
  onYop: () => void;
  onSaqlandi: () => void;
}) {
  const { showNotification } = useCRM();
  const { soro, filial } = useImtihonApi();
  const ai = useAiHolat();

  // Qayerga: bankdagi savolniki yoki ochilgan sahifaniki.
  const [fanId, setFanId] = useState<number | null>(() => {
    const mId = bankdagi?.bankTopicId ?? boshMavzu;
    return daraxt.fanlar.find(f => f.mavzular.some(m => m.id === mId))?.id ?? boshFan;
  });
  const [mavzuId, setMavzuId] = useState<number | null>(bankdagi?.bankTopicId ?? boshMavzu);
  const [yangiMavzu, setYangiMavzu] = useState<string | null>(null);
  const fan = fanniTop(daraxt, fanId);
  const mavzu = mavzuniTop(fan, mavzuId);
  const mavzuNomi = yangiMavzu !== null ? yangiMavzu.trim() : mavzu?.name || '';

  // Manba: rasm yoki matn.
  const [rasm, setRasm] = useState<string | null>(null);
  const [matnRejimi, setMatnRejimi] = useState(false);
  const [matn, setMatn] = useState('');
  const faylRef = useRef<HTMLInputElement>(null);
  const [ustida, setUstida] = useState(false);

  // Sozlama.
  const [soni, setSoni] = useState<3 | 5 | 10>(5);
  const [usul, setUsul] = useState<'sonlar' | 'vaziyat'>('sonlar');
  const [tur, setTur] = useState<Tur>('');
  const [til, setTil] = useState<Til>((bankdagi?.language as Til) || 'uz');
  const [tilTanlandi, setTilTanlandi] = useState(false);

  // Asl masala va natijalar.
  const [asllar, setAsllar] = useState<AiSavol[] | null>(null);
  const [asl, setAsl] = useState<AiSavol | null>(() => (bankdagi ? {
    type: bankdagi.type, text: bankdagi.text, options: bankdagi.options || null, correctAnswer: bankdagi.correctAnswer || '',
    difficulty: qiyinlikDarajasi(bankdagi.difficulty || 2), language: bankdagi.language || 'uz', solution: bankdagi.solution || null,
  } : null));
  const [aslTekshiruv, setAslTekshiruv] = useState<Tekshiruv | null>(null);
  const [aslTahrir, setAslTahrir] = useState(false);
  const [aslQosh, setAslQosh] = useState(!bankdagi);
  const [natijalar, setNatijalar] = useState<Natija[] | null>(null);
  const [tahrirda, setTahrirda] = useState<number | null>(null);
  const [qiyinlik, setQiyinlik] = useState<number>(() => qiyinlikDarajasi(bankdagi?.difficulty || 2));
  const [sozlama, setSozlama] = useState(true);
  const [holat, setHolat] = useState<string | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const band = !!holat || saqlanmoqda;

  const rasmniOl = async (fayl: File | undefined) => {
    if (!fayl) return;
    if (!/^image\/|application\/pdf/.test(fayl.type) && !/\.(pdf|jpe?g|png|webp|heic)$/i.test(fayl.name)) return showNotification('Rasm yoki PDF tanlang', 'error');
    try {
      setHolat('Rasm tayyorlanmoqda…');
      setRasm(await rasmTayyorla(fayl));
      setMatnRejimi(false);
    } catch (e: any) {
      showNotification(e.message || "Rasmni ochib bo'lmadi", 'error');
    } finally {
      setHolat(null);
    }
  };

  // Kompyuterda: nusxalangan rasm (Ctrl+V) ham qabul qilinadi.
  useEffect(() => {
    if (asl) return;
    const f = (e: ClipboardEvent) => {
      const fayl = Array.from(e.clipboardData?.files || []).find(x => x.type.startsWith('image/'));
      if (fayl) { e.preventDefault(); rasmniOl(fayl); }
    };
    window.addEventListener('paste', f);
    return () => window.removeEventListener('paste', f);
  });

  const royxatgaQosh = (klonlar: AiSavol[], eskilar: Natija[], a: AiSavol): Natija[] => {
    const bor = new Set([izi(a.text), ...eskilar.map(n => izi(n.text))]);
    return klonlar.filter(k => { const i = izi(k.text); if (bor.has(i)) return false; bor.add(i); return true; })
      .map(k => ({ ...k, kalit: keyingiKalit++, tanlangan: false }));
  };

  /** Mustaqil tekshiruv: asl masala + yangilari (AI kalitni ko'rmay yechadi). */
  const tekshir = async (a: AiSavol, yangilar: Natija[]) => {
    const kalitlar = new Set(yangilar.map(n => n.kalit));
    try {
      const r = await soro<{ natijalar: Tekshiruv[] }>('POST', 'ai/tekshir', { savollar: [a, ...yangilar].slice(0, 12) });
      setAslTekshiruv(r.natijalar[0] || null);
      setNatijalar(l => (l || []).map(n => {
        const i = yangilar.findIndex(x => x.kalit === n.kalit);
        if (i < 0) return n;
        const t = r.natijalar[i + 1] || { tekshirildi: null, aiJavobi: '' };
        return { ...n, tekshiruv: t, tanlangan: (t.tekshirildi === true || n.type === 'yozma') && !n.aslBilanBir };
      }));
    } catch (e: any) {
      setNatijalar(l => (l || []).map(n => (kalitlar.has(n.kalit) ? { ...n, tekshiruv: { tekshirildi: null, aiJavobi: '' }, tanlangan: !n.aslBilanBir } : n)));
      showNotification(`Javoblarni tekshirib bo'lmadi (${xatoMatni(e)}) — tanlanganlari qoralama bo'lib qo'shiladi`, 'info');
    }
  };

  const tuz = async (qoshimcha = false, tanlanganAsl?: AiSavol) => {
    if (!fan) return showNotification('Fanni tanlang', 'error');
    if (!mavzuNomi) return showNotification('Mavzuni tanlang', 'error');
    let a = tanlanganAsl || asl;
    let tilNow = til;
    try {
      if (!a) {
        if (!rasm && !matn.trim()) return showNotification("Masala rasmini tanlang yoki matnini yozing", 'error');
        setHolat(rasm ? "AI rasmni o'qimoqda…" : "AI matnni o'qimoqda…");
        const r = await soro<{ savollar: AiSavol[] }>('POST', 'questions/ai/import', {
          fan: fan.name, mavzu: mavzuNomi, til, rasmlar: rasm ? [rasm] : [], matn: rasm ? '' : matn,
        });
        const topildi = r.savollar.filter(q => matniBor(q.text));
        if (!topildi.length) throw new Error(rasm ? "Rasmdan masala topilmadi — aniqroq surat oling yoki matnini yozing" : 'Matndan masala topilmadi');
        if (topildi.length > 1) { setAsllar(topildi); return; }
        a = topildi[0];
        setQiyinlik(qiyinlikDarajasi(a.difficulty || 2));
      }
      // Rus tilidagi masala — yangilari ham ruscha (til qo'lda tanlanmagan bo'lsa).
      if (!tilTanlandi && !bankdagi) {
        const m = htmlMatnga(a.text);
        const kirill = (m.match(/[а-яё]/gi) || []).length;
        if (kirill > (m.match(/[a-z]/gi) || []).length && !/[ўқғҳ]/i.test(m)) { tilNow = 'ru'; setTil('ru'); }
      }
      setAsl(a);
      setAsllar(null);
      setHolat(`AI ${soni} ta o'xshash masala tuzmoqda…`);
      const r = await soro<{ klonlar: AiSavol[] }>('POST', 'ai/oxshash', {
        savol: { ...a, subject: fan.name, topic: mavzuNomi, language: tilNow }, soni, usul, tur: tur || null,
      });
      const eskilar = qoshimcha ? natijalar || [] : [];
      const yangilar = royxatgaQosh(r.klonlar, eskilar, a);
      if (!yangilar.length) throw new Error("AI yangi masala bermadi — qayta urinib ko'ring");
      setSozlama(false);
      setNatijalar([...eskilar, ...yangilar]);
      setHolat("AI javoblarni qayta yechib tekshirmoqda…");
      await tekshir(a, yangilar);
    } catch (e: any) {
      showNotification(xatoMatni(e), 'error');
    } finally {
      setHolat(null);
    }
  };

  const ozgartir = (kalit: number, d: Partial<Natija>) => setNatijalar(l => (l || []).map(n => (n.kalit === kalit ? { ...n, ...d } : n)));

  // Faol: AI qayta yechib tasdiqlagan yoki ustoz o'zi tuzatgan (yozma — kalitsiz). Qolgani qoralama.
  const ishonchli = (n: { type: SavolTuri; tekshiruv?: Tekshiruv; tahrirlandi?: boolean; aslBilanBir?: boolean }) =>
    !!n.tahrirlandi || n.type === 'yozma' || (n.tekshiruv?.tekshirildi === true && !n.aslBilanBir);
  const tanlanganlar = (natijalar || []).filter(n => n.tanlangan);
  const aslSaqlanadi = aslQosh && !bankdagi && !!asl;
  const jami = tanlanganlar.length + (aslSaqlanadi ? 1 : 0);

  const saqla = async () => {
    if (!fan || !mavzuNomi || !jami) return;
    setSaqlanmoqda(true);
    try {
      const joy = { subject: fan.name, topic: mavzuNomi, bankTopicId: yangiMavzu === null ? mavzu?.id ?? null : null, difficulty: qiyinlik, language: til };
      const maydon = (q: AiSavol) => ({
        type: q.type, text: q.text, options: q.type === 'yopiq' ? q.options : null,
        correctAnswer: q.type === 'yozma' ? '' : q.correctAnswer, solution: q.solution || null, solutionStatus: q.solution ? 'qoralama' : 'yoq',
      });
      let parentId: number | null = bankdagi?.id ?? null;
      if (aslSaqlanadi && asl) {
        const faol = (aslTekshiruv?.tekshirildi === true) && !savolXatosi({ ...asl, ...joy } as any);
        const r = await soro<{ id: number }>('POST', 'questions', { ...maydon(asl), ...joy, status: faol ? 'faol' : 'qoralama', source: 'Rasmdan (AI)', schoolId: filial });
        parentId = r.id;
      }
      let faolSoni = 0;
      const questions = tanlanganlar.map((n, i) => {
        const faol = ishonchli(n) && !savolXatosi({ ...n, ...joy } as any);
        if (faol) faolSoni++;
        return { ...maydon(n), ...joy, parentId, status: faol ? 'faol' : 'qoralama', source: "AI o'xshash", qator: i + 1 };
      });
      let qoshildi = 0;
      if (questions.length) {
        const r = await soro<{ count: number; xatolar: { qator: number; xato: string }[] }>('POST', 'questions/bulk', { questions, schoolId: filial });
        qoshildi = r.count;
        if (r.xatolar.length) showNotification(`${r.xatolar.length} tasi qo'shilmadi: ${r.xatolar[0].xato}`, 'info');
      }
      const qoralama = qoshildi - faolSoni;
      showNotification(`${qoshildi + (aslSaqlanadi ? 1 : 0)} ta savol bankka qo'shildi${qoralama > 0 ? ` — ${qoralama} tasi qoralama (bankda tekshirib, faol qilasiz)` : ''}`, 'success');
      onSaqlandi();
      onYop();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  const yangidan = () => {
    setAsl(null); setAsllar(null); setAslTekshiruv(null); setNatijalar(null); setRasm(null); setMatn(''); setSozlama(true); setAslQosh(true);
  };

  const otdi = (natijalar || []).filter(n => n.tekshiruv?.tekshirildi === true && !n.aslBilanBir).length;
  const aiYoq = ai && !ai.yoqilgan;

  // ---- Bo'laklar -------------------------------------------------------------

  const joyTanlash = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Maydon nom="Fan">
        <select className={SELECT} value={fan?.id ?? ''} aria-label="Fan" disabled={band}
          onChange={e => { setFanId(Number(e.target.value) || null); setMavzuId(null); setYangiMavzu(null); }}>
          <option value="">Fanni tanlang</option>
          {daraxt.fanlar.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </Maydon>
      <Maydon nom="Mavzu">
        {yangiMavzu !== null ? (
          <div className="flex items-center gap-1.5">
            <input autoFocus className={INPUT} value={yangiMavzu} placeholder="Yangi mavzu nomi" aria-label="Yangi mavzu nomi" onChange={e => setYangiMavzu(e.target.value)} />
            <Tugma kichik turi="oddiy" ikonka={<X size={13} />} onClick={() => setYangiMavzu(null)} aria-label="Bekor" />
          </div>
        ) : (
          <select className={SELECT} value={mavzu?.id ?? ''} disabled={!fan || band} aria-label="Mavzu"
            onChange={e => (e.target.value === 'yangi' ? setYangiMavzu('') : setMavzuId(Number(e.target.value) || null))}>
            <option value="">{fan ? 'Mavzuni tanlang' : 'Avval fanni tanlang'}</option>
            {fan && bolimlarga(fan.mavzular).map(g => (g.bolim
              ? <optgroup key={g.bolim + g.mavzular[0].id} label={g.bolim}>{g.mavzular.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
              : g.mavzular.map(m => <option key={m.id} value={m.id}>{m.name}</option>)))}
            {fan && <option value="yangi">+ Yangi mavzu…</option>}
          </select>
        )}
      </Maydon>
    </div>
  );

  const sozlamaBolagi = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div>
          <p className="text-[12px] font-semibold text-matn-sokin mb-1.5">Nechta</p>
          <Tanlov qiymat={soni} onChange={setSoni} variantlar={[{ v: 3, nom: '3' }, { v: 5, nom: '5' }, { v: 10, nom: '10' }]} />
        </div>
        <div>
          <p className="text-[12px] font-semibold text-matn-sokin mb-1.5">Nima o'zgarsin</p>
          <Tanlov qiymat={usul} onChange={setUsul} variantlar={[{ v: 'sonlar', nom: 'Faqat sonlar' }, { v: 'vaziyat', nom: 'Vaziyat ham' }]} />
        </div>
      </div>
      <p className="text-[11.5px] text-matn-xira -mt-1">
        {usul === 'sonlar' ? "Matn va yechish usuli o'sha, sonlar va javob boshqa." : "Boshqa vaziyat (ism, narsa, hikoya), yechish usuli va qiyinligi o'sha."}
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <Maydon nom="Javob shakli">
          <select className={SELECT} value={tur} onChange={e => setTur(e.target.value as Tur)} aria-label="Javob shakli">
            <option value="">Asl masaladek</option>
            <option value="yopiq">Variantli (A–D)</option>
            <option value="raqamli">Javobi son</option>
          </select>
        </Maydon>
        <Maydon nom="Til">
          <select className={SELECT} value={til} onChange={e => { setTil(e.target.value as Til); setTilTanlandi(true); }} aria-label="Til">
            <option value="uz">O'zbekcha</option><option value="ru">Ruscha</option><option value="en">Inglizcha</option>
          </select>
        </Maydon>
      </div>
    </div>
  );

  const aslKartasi = asl && (
    <div className="rounded-xl border border-chiziq bg-ichki p-3 sm:p-4 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <b className="text-[12.5px] text-matn">Asl masala</b>
          <Yorliq>{SAVOL_TURI_NOMI[asl.type]}</Yorliq>
          {aslTekshiruv?.tekshirildi === true && <Yorliq rang="yaxshi"><CheckCircle2 size={11} /> Javob to'g'ri</Yorliq>}
          {aslTekshiruv?.tekshirildi === false && <Yorliq rang="ogoh"><AlertTriangle size={11} /> AI boshqa javob chiqardi{aslTekshiruv.aiJavobi ? ` (${aslTekshiruv.aiJavobi})` : ''}</Yorliq>}
        </div>
        {!aslTahrir && !band && <Tugma kichik turi="oddiy" ikonka={<Pencil size={13} />} onClick={() => setAslTahrir(true)}>Tuzatish</Tugma>}
      </div>
      <div className="flex gap-3">
        {rasm && !aslTahrir && (
          <a href={rasm} target="_blank" rel="noopener noreferrer" title="Rasmni kattalashtirish" className="hidden sm:block shrink-0">
            <img src={rasm} alt="Masala rasmi" className="w-40 max-h-32 object-contain rounded-lg border border-chiziq bg-white" />
          </a>
        )}
        <div className="flex-1 min-w-0">
          {aslTahrir
            ? <Tahrir q={asl} onBekor={() => setAslTahrir(false)} onSaqla={q => { setAsl(q); setAslTahrir(false); setAslTekshiruv(null); }} />
            : <Korinish q={asl} onJavob={band ? undefined : j => { setAsl({ ...asl, correctAnswer: j }); setAslTekshiruv(null); }} />}
        </div>
      </div>
      {asl.type !== 'yozma' && !asl.correctAnswer && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ogoh">
          <AlertTriangle size={13} /> To'g'ri javob topilmadi.
          {aslTekshiruv?.aiJavobi && <Tugma kichik onClick={() => setAsl({ ...asl, correctAnswer: aslTekshiruv.aiJavobi })}>AI javobini qo'yish: {aslTekshiruv.aiJavobi}</Tugma>}
        </div>
      )}
      {!bankdagi && (
        <label className="flex items-center gap-2 text-[12.5px] text-matn cursor-pointer w-fit">
          <input type="checkbox" className="w-4 h-4 accent-[var(--color-brand)] cursor-pointer" checked={aslQosh} onChange={e => setAslQosh(e.target.checked)} />
          Asl masalani ham bankka qo'shish
        </label>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[270] flex items-start justify-center overflow-y-auto p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="O'xshash savollar">
      <div className="fixed inset-0 bg-black/50" onClick={() => !band && onYop()} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-3xl border border-chiziq my-2 sm:my-4">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-chiziq">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn flex items-center gap-1.5"><Sparkles size={15} className="text-brand shrink-0" /> {onRejim ? "Savol qo'shish" : bankdagi ? "O'xshash savollar" : "Rasmdan o'xshash savollar"}</h3>
            <p className="text-[12px] text-matn-xira">{onRejim ? 'Bitta masalaning rasmi yoki matni — ' : ''}AI masalani o'qiydi, sonlari va javobi boshqa masalalar tuzadi, keyin ularni qayta yechib tekshiradi.</p>
            {onRejim && (
              <div className="mt-2 inline-flex rounded-xl border border-chiziq bg-ichki p-0.5 gap-0.5" role="tablist" aria-label="Savol qo'shish usuli">
                {([['fayl', 'Fayldan'], ['oxshash', "O'xshashini tuzish (AI)"]] as const).map(([v, nom]) => (
                  <button key={v} type="button" role="tab" aria-selected={v === 'oxshash'} disabled={band} onClick={() => onRejim(v)}
                    className={`px-3 py-1 rounded-[10px] text-[12px] font-bold cursor-pointer transition-colors disabled:opacity-50 ${v === 'oxshash' ? 'bg-brand text-brand-ust shadow-sm' : 'text-matn-sokin hover:text-matn'}`}>{nom}</button>
                ))}
              </div>
            )}
          </div>
          <button aria-label="Yopish" disabled={band} onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer disabled:opacity-40"><X size={16} /></button>
        </div>

        {aiYoq ? (
          <div className="p-4 sm:p-5">
            <AiKalitKartasi ixcham />
          </div>
        ) : !ai ? (
          <div className="p-8 flex justify-center"><Loader2 size={18} className="animate-spin text-matn-xira" /></div>
        ) : (
          <>
            <div className="p-4 sm:p-5 space-y-4">
              {/* 1. Masala: rasm, matn yoki bankdagi savol */}
              {!asl && !asllar && (
                matnRejimi ? (
                  <div className="space-y-2">
                    <Maydon nom="Masala matni" izoh="Variantlari bilan (bo'lsa). Formula: $x^2$, kasr: $\frac{1}{2}$">
                      <textarea rows={5} autoFocus className={INPUT} value={matn} onChange={e => setMatn(e.target.value)} placeholder="Poyezd 3 soatda 180 km yo'l bosdi. Uning tezligini toping. A) 50 B) 60 C) 70 D) 80" />
                    </Maydon>
                    <button type="button" onClick={() => setMatnRejimi(false)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand cursor-pointer"><Camera size={13} /> Rasm bilan</button>
                  </div>
                ) : rasm ? (
                  <div className="flex flex-col sm:flex-row gap-3 items-start">
                    <img src={rasm} alt="Masala rasmi" className="max-h-72 w-full sm:w-auto object-contain rounded-xl border border-chiziq bg-white" />
                    <div className="flex sm:flex-col gap-2">
                      <Tugma kichik ikonka={<Camera size={13} />} disabled={band} onClick={() => faylRef.current?.click()}>Boshqa rasm</Tugma>
                      <Tugma kichik turi="oddiy" ikonka={<Trash2 size={13} />} disabled={band} onClick={() => setRasm(null)}>Olib tashlash</Tugma>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label
                      onDragOver={e => { e.preventDefault(); setUstida(true); }} onDragLeave={() => setUstida(false)}
                      onDrop={e => { e.preventDefault(); setUstida(false); rasmniOl(e.dataTransfer.files?.[0]); }}
                      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 sm:py-10 text-center cursor-pointer transition-colors ${ustida ? 'border-brand bg-brand-fon dark:bg-brand/10' : 'border-chiziq-kuchli bg-ichki hover:border-brand'}`}>
                      <Camera size={26} className="text-matn-xira" />
                      <span className="text-[13.5px] font-semibold text-matn">Masala rasmini tanlang yoki suratga oling</span>
                      <span className="text-[11.5px] text-matn-xira">Kitob, daftar yoki test sahifasi. Kompyuterda rasmni shu yerga tashlash yoki Ctrl+V ham bo'ladi.</span>
                      <input ref={faylRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; rasmniOl(f); }} />
                    </label>
                    <button type="button" onClick={() => setMatnRejimi(true)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand cursor-pointer"><Type size={13} /> Yoki masala matnini yozing</button>
                  </div>
                )
              )}
              {/* "Boshqa rasm" uchun — tanlash maydoni rasm bor paytda ham kerak. */}
              {rasm && !asl && <input ref={faylRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; rasmniOl(f); }} />}

              {/* Rasmda bir nechta masala — qaysi biriga? */}
              {asllar && (
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold text-matn">Rasmda {asllar.length} ta masala bor — qaysi biriga o'xshash tuzamiz?</p>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {asllar.map((q, i) => (
                      <button key={i} type="button" disabled={band} onClick={() => { setQiyinlik(qiyinlikDarajasi(q.difficulty || 2)); tuz(false, q); }}
                        className="w-full text-left rounded-xl border border-chiziq bg-sirt hover:border-brand/50 p-3 cursor-pointer disabled:opacity-50">
                        <div className="flex gap-2">
                          <b className="text-[12.5px] text-matn shrink-0">{i + 1}.</b>
                          <div className="flex-1 min-w-0"><Korinish q={q} /></div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={yangidan} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand cursor-pointer"><RotateCcw size={13} /> Boshqa rasm</button>
                </div>
              )}

              {aslKartasi}

              {/* 2. Qayerga va qanday */}
              {!asllar && natijalar !== null && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                  <span className="text-matn-sokin min-w-0">
                    Qayerga: <b className="text-matn">{fan?.name} › {mavzuNomi || '—'}</b> · {usul === 'sonlar' ? 'faqat sonlar' : 'vaziyat ham'}
                  </span>
                  <Tugma kichik turi="oddiy" ikonka={<SlidersHorizontal size={13} />} disabled={band} onClick={() => setSozlama(v => !v)}>{sozlama ? 'Yopish' : "O'zgartirish"}</Tugma>
                </div>
              )}
              {sozlama && !asllar && (
                <div className="space-y-4 rounded-xl border border-chiziq p-3 sm:p-4">
                  {joyTanlash}
                  {sozlamaBolagi}
                </div>
              )}

              {!asllar && (!natijalar?.length || sozlama) && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2">
                  {asl && !bankdagi && <Tugma turi="oddiy" disabled={band} ikonka={<RotateCcw size={14} />} onClick={yangidan}>Boshqa masala</Tugma>}
                  <Tugma turi="asosiy" ikonka={<Sparkles size={14} />} yuklanmoqda={!!holat} onClick={() => tuz(false)}>
                    {natijalar?.length ? 'Qayta tuzish' : `${soni} ta o'xshash masala tuzish`}
                  </Tugma>
                </div>
              )}
              {holat && (
                <p className="flex items-center justify-center gap-2 text-[12.5px] text-matn-sokin" role="status"><Loader2 size={14} className="animate-spin" /> {holat}</p>
              )}

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
                      <Tugma kichik ikonka={<Plus size={13} />} disabled={band} onClick={() => tuz(true)}>Yana {soni} ta</Tugma>
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
                            {tur && tur !== asl?.type && <Yorliq>{SAVOL_TURI_NOMI[n.type]}</Yorliq>}
                          </div>
                          {tahrirda === n.kalit
                            ? <Tahrir q={n} onBekor={() => setTahrirda(null)} onSaqla={q => { ozgartir(n.kalit, { ...q, tahrirlandi: true, tanlangan: true }); setTahrirda(null); }} />
                            : <Korinish q={n} onJavob={band ? undefined : j => ozgartir(n.kalit, { correctAnswer: j, tahrirlandi: true, tanlangan: true })} />}
                        </div>
                        {tahrirda !== n.kalit && (
                          <div className="flex flex-col gap-1 shrink-0">
                            <button aria-label="Tuzatish" disabled={band} onClick={() => setTahrirda(n.kalit)} className="p-1.5 rounded-lg text-matn-xira hover:text-brand hover:bg-ichki cursor-pointer disabled:opacity-40"><Pencil size={14} /></button>
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
                  <QiyinlikTanlov kichik qiymat={qiyinlik} onChange={setQiyinlik} />
                </div>
                <div className="flex flex-col items-stretch sm:items-end gap-1">
                  <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} disabled={!jami || !!holat || tahrirda !== null || aslTahrir} onClick={saqla}>
                    {jami ? `${jami} ta savolni bankka qo'shish` : 'Masalalarni belgilang'}
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
