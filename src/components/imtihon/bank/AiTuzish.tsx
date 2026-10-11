import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Loader2, CheckCircle2, AlertTriangle, Camera, Pencil, Trash2, Plus, Copy } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { useAiHolat } from '../useAiHolat';
import AiKalitKartasi from '../AiKalitKartasi';
import { Tugma, Tanlov, Yorliq, Maydon, INPUT } from '../ui';
import { HARFLAR, savolXatosi } from '../../../../lib/imtihon.js';
import { DarajaTanlov, boshDaraja, darajaBandi, darajaMaydonlari, type DarajaQiymati } from './qiyinlik';
import { useDarajalar } from './useDarajalar';
import { fanniTop, mavzuniTop } from './useBankDaraxt';
import { type AiSavol, type Tekshiruv, rasmTayyorla, htmlMatnga, matniBor, izi, xatoMatni, Korinish, Tahrir, FanMavzuTanlov, yechimSora, YECHISH_BOLAGI } from './aiUmumiy';
import QoshRejimi, { type QoshRejim } from './QoshRejimi';
import { AiGuruhKarta, guruhlarniSaqla, mavzuniTopYokiYarat, type AiGuruh } from './AiGuruhKarta';
import { FAYL_TURLARI, faylTuriNomi, guruhTurimi } from './faylTuri';
import { useRasmNavbati, RasmJarayoni, SavolRasmi, rasmIshi, rasmNatijasiniQoy, rasmKerakmi, rasmYetishmaydi, type RasmHolati } from './rasmNavbati';
import { rasmBelgisiBor, type RasmIshi, type RasmNatijasi } from '../../../lib/svgRasm';
import type { BankDaraxt } from '../../../types';

// Savol qo'shish → «AI tuzadi» (egasi, 2026-10-06: "mavzuni aytaman, namuna bersam ham bermasam ham —
// shu mavzuga shuncha masala yoki misol tuzib bersin"; 2026-10-10: "mavzu bo'yicha AI tuzadi, namunaga
// o'xshashni ham birlashtirib yuborsa bo'ladi"). Bitta yo'l: ustoz fan, mavzu va savol turini tanlaydi,
// xohlasa nima kerakligini yozadi va NAMUNA beradi (masala matni yoki rasmi) — namuna bo'lsa AI shunga
// o'xshashlarini tuzadi (faqat sonlari yoki vaziyati ham boshqa). Keyin AI kalitni ko'rmay qayta yechib
// tekshiradi. Tekshiruvdan o'tgani — faol, o'tmagani — qoralama; guruhli (MS-33-35, MS-36-45) va yozma
// savollar — doim qoralama (ularni tekshiradigan kalit yo'q). Har bosqich — alohida qisqa so'rov.
//
// Chizmalar (egasi: «o'xshash savol tuzganda — vector qilib rasm tuzsin»): namunaning chizmasi bo'lsa yangi
// masalalar ham chizmali tuziladi (matnda «[rasm]») va hammasi o'zi chiziladi — namuna rasmi uslub uchun
// beriladi. Namunasiz tuzishda chizmaga faqat mavzu talab qilsa ruxsat (server: mavzuRasmlimi) va faqat
// tekshiruvdan o'tgan savollar o'zi chiziladi — qolganiga kartada «Vektor qilib chizish» tugmasi.

type Tur = 'yopiq' | 'raqamli' | 'moslash' | 'qismli' | 'yozma';
// «Javobi son/matn» — egasining so'zi (2026-10-10): variantsiz, javobi yoziladigan savol.
const TURLAR: { v: Tur; nom: string; izoh: string }[] = [
  { v: 'yopiq', nom: faylTuriNomi('yopiq'), izoh: 'Har savolda 4 ta variant, bittasi to\'g\'ri.' },
  { v: 'raqamli', nom: 'Javobi son/matn', izoh: "Variantsiz: o'quvchi javobni o'zi yozadi (varaqda — raqamli katak)." },
  ...FAYL_TURLARI.filter(t => t.v !== 'yopiq').map(t => ({ v: t.v as Tur, nom: t.nom, izoh: t.izoh })),
];
/** Nechta tuziladi — tur bo'yicha (birinchisi kichik, o'rtadagisi standart). */
const SONLAR: Record<Tur, [number, number, number]> = { yopiq: [5, 10, 20], raqamli: [5, 10, 20], moslash: [2, 3, 5], qismli: [2, 3, 5], yozma: [3, 5, 10] };
/** Bitta so'rovda nechta savol tuziladi (yozma — batafsil yechimi bilan, shuning uchun kam). */
const bolak = (t: Tur) => (t === 'yozma' ? 3 : 10);
const TEKSHIRUV_BOLAGI = 12;
const MAKS_NAMUNA = 3;

interface Yangi extends AiSavol {
  kalit: number; tanlangan: boolean; tekshiruv: Tekshiruv | null;
  /** Rasmdan o'qilgan namuna masalaning o'zi (bankka u ham qo'shilishi mumkin). */
  namuna?: boolean;
  takrorId?: number | null;
  tahrirlandi?: boolean;
  /** Chizma qo'yilishidan oldingi matn («[rasm]» belgisi bilan) va chizma holati — rasmNavbati.tsx. */
  aslMatn?: string;
  rasm?: RasmHolati;
}
/** Rasmdan o'qilgan namuna: matni (AI ga beriladi) va o'zi (ro'yxatda ko'rinadi). */
interface OqilganNamuna { rasm: string; matn: string; savollar: AiSavol[]; guruhlar: Omit<AiGuruh, 'kalit' | 'tanlangan'>[] }

let keyingiKalit = 1;
const xatoHolati = (e: unknown) => (typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status: unknown }).status) : 0);

/** Savol → AI ga namuna sifatida beriladigan oddiy matn. */
const savolMatni = (q: AiSavol) => [
  htmlMatnga(q.text),
  ...(q.options || []).map((o, i) => `${HARFLAR[i]}) ${htmlMatnga(o)}`),
  q.correctAnswer ? `Javob: ${q.correctAnswer}` : '',
].filter(Boolean).join('\n');
const guruhMatni = (g: Omit<AiGuruh, 'kalit' | 'tanlangan'>) => [
  htmlMatnga(g.text),
  ...g.savollar.map((s, i) => `${g.tur === 'moslash' ? `${i + 1}.` : `${'abcd'[i]})`} ${htmlMatnga(s.text)}${s.javob ? ` — javob: ${s.javob}` : ''}`),
  g.variantlar.length ? `Javoblar ro'yxati: ${g.variantlar.map((v, i) => `${HARFLAR[i]}) ${htmlMatnga(v)}`).join('; ')}` : '',
].filter(Boolean).join('\n');

function Belgi({ n }: { n: Yangi }) {
  return (
    <>
      {n.namuna && <Yorliq rang="brand"><Camera size={11} /> Namuna — rasmdan o'qildi</Yorliq>}
      {n.takrorId ? <Yorliq rang="ogoh"><Copy size={11} /> Bankda bor (#{n.takrorId})</Yorliq> : null}
      {n.tahrirlandi ? <Yorliq rang="brand"><Pencil size={11} /> Tuzatildi</Yorliq>
        : n.type === 'yozma' ? <Yorliq>{n.solution ? 'Yozma — batafsil yechimi bilan' : "Yozma — yechimi yo'q"} · qoralama bo'lib tushadi</Yorliq>
        : n.tekshiruv?.tekshirildi === true ? <Yorliq rang="yaxshi"><CheckCircle2 size={11} /> AI qayta yechdi — javob to'g'ri</Yorliq>
        : n.tekshiruv?.tekshirildi === false ? <Yorliq rang="ogoh"><AlertTriangle size={11} /> AI boshqa javob chiqardi{n.tekshiruv.aiJavobi ? ` (${n.tekshiruv.aiJavobi})` : ''} — tekshiring</Yorliq>
        : <Yorliq>Tekshirilmadi — qoralama bo'lib tushadi</Yorliq>}
      {/* Chizmasi kerak, lekin hali yo'q («[rasm]» belgisi matnda): chizilmaguncha savol faol bo'lmaydi. */}
      {rasmYetishmaydi(n) && (n.rasm?.band
        ? <Yorliq><Loader2 size={11} className="animate-spin" /> Rasmi chizilmoqda</Yorliq>
        : <Yorliq rang="ogoh"><AlertTriangle size={11} /> Rasmi yo'q — qoralama bo'ladi</Yorliq>)}
    </>
  );
}

interface AiTuzishProps {
  daraxt: BankDaraxt;
  fanId?: number | null;
  mavzuId?: number | null;
  /** `mavzuId` ning nomi — mavzu hozirgina yaratilgan bo'lib, daraxtda hali ko'rinmasa. */
  mavzuNomi?: string;
  onRejim?: (rejim: QoshRejim) => void;
  onYop: () => void;
  /** Bankka qo'shilgan yangi savollar. */
  onSaqlandi: (ids: number[]) => void;
}

export default function AiTuzish({ daraxt, fanId: boshFan = null, mavzuId: boshMavzu = null, mavzuNomi: boshMavzuNomi, onRejim, onYop, onSaqlandi }: AiTuzishProps) {
  const { showNotification } = useCRM();
  const { soro, filial } = useImtihonApi();
  const ai = useAiHolat();
  useDarajalar();
  // Chizmalarni AI vektor qilib chizadi — navbat bilan (bir vaqtda 2 ta), to'xtatsa bo'ladi.
  const rasmNavbati = useRasmNavbati();

  const [fanId, setFanId] = useState<number | null>(() => boshFan ?? daraxt.fanlar.find(f => f.mavzular.some(m => m.id === boshMavzu))?.id ?? (daraxt.fanlar.length === 1 ? daraxt.fanlar[0].id : null));
  const [mavzuId, setMavzuId] = useState<number | null>(boshMavzu);
  const [yangiMavzu, setYangiMavzu] = useState<string | null>(null);
  const fan = fanniTop(daraxt, fanId);
  const mavzu = mavzuniTop(fan, mavzuId);
  // Bank ro'yxatidan kelgan mavzu daraxtda hali yo'q (hozirgina yaratilgan) — nomi bilan ishlaymiz.
  const kutilgan = !mavzu && mavzuId != null && mavzuId === boshMavzu && boshMavzuNomi ? boshMavzuNomi : '';
  const mavzuNomi = yangiMavzu !== null ? yangiMavzu.trim() : mavzu?.name || kutilgan;
  /** Bankdagi mavzu id si (yangi nom bo'lsa — null: saqlashda yaratiladi). */
  const bankMavzuId = yangiMavzu === null ? mavzu?.id ?? (kutilgan ? mavzuId : null) : null;

  const [tur, setTur] = useState<Tur>('yopiq');
  const [soni, setSoni] = useState<number>(SONLAR.yopiq[1]);
  const [daraja, setDaraja] = useState<DarajaQiymati>(() => boshDaraja());
  const [tavsif, setTavsif] = useState('');
  // Namuna (ixtiyoriy): matn yoki rasm — bersa, AI shunga o'xshashlarini tuzadi.
  const [namuna, setNamuna] = useState('');
  const [namunaRasm, setNamunaRasm] = useState<string | null>(null);
  const [oxshash, setOxshash] = useState<'sonlar' | 'vaziyat'>('sonlar');
  const [oqilgan, setOqilgan] = useState<OqilganNamuna | null>(null);
  const faylRef = useRef<HTMLInputElement>(null);

  const [holat, setHolat] = useState<string | null>(null);
  const [natijalar, setNatijalar] = useState<Yangi[] | null>(null);
  const [guruhlar, setGuruhlar] = useState<AiGuruh[] | null>(null);
  const [tahrirda, setTahrirda] = useState<number | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const band = !!holat || saqlanmoqda;
  const guruhli = guruhTurimi(tur);
  const turMalumoti = TURLAR.find(t => t.v === tur)!;
  const namunaBor = !!namunaRasm || !!namuna.trim();
  const shakl = !natijalar && !guruhlar;

  const turniTanla = (t: Tur) => { setTur(t); setSoni(SONLAR[t][1]); };

  const rasmniOl = async (fayl: File | undefined) => {
    // Ish ketayotganda (AI tuzmoqda) yangi rasm qabul qilinmaydi — band belgisi chalkashmasin.
    if (!fayl || band) return;
    if (!/^image\/|application\/pdf/.test(fayl.type) && !/\.(pdf|jpe?g|png|webp|heic)$/i.test(fayl.name)) return showNotification('Rasm yoki PDF tanlang', 'error');
    try {
      setHolat('Rasm tayyorlanmoqda…');
      setNamunaRasm(await rasmTayyorla(fayl));
      setOqilgan(null);
    } catch (e: unknown) {
      showNotification(e instanceof Error ? e.message : "Rasmni ochib bo'lmadi", 'error');
    } finally {
      setHolat(null);
    }
  };

  // Kompyuterda: nusxalangan rasm (Ctrl+V) — namuna bo'lib tushadi.
  useEffect(() => {
    if (!shakl) return;
    const f = (e: ClipboardEvent) => {
      const fayl = Array.from(e.clipboardData?.files || []).find(x => x.type.startsWith('image/'));
      if (fayl) { e.preventDefault(); rasmniOl(fayl); }
    };
    window.addEventListener('paste', f);
    return () => window.removeEventListener('paste', f);
  });

  /** Namuna rasmi → matn (bitta so'rov; bir marta o'qiladi). Rasmdagi hamma turdagi savol olinadi. */
  const namunaniOqi = async (fanNomi: string): Promise<OqilganNamuna | null> => {
    if (!namunaRasm) return null;
    if (oqilgan?.rasm === namunaRasm) return oqilgan;
    setHolat("AI namuna rasmini o'qimoqda…");
    const r = await soro<{ savollar: (AiSavol & { takrorId?: number | null })[]; guruhlar?: Omit<AiGuruh, 'kalit' | 'tanlangan'>[] }>('POST', 'questions/ai/import', {
      fan: fanNomi, mavzu: mavzuNomi, til: 'auto', rasmlar: [namunaRasm], matn: '',
    });
    const savollar = r.savollar.filter(q => matniBor(q.text)).slice(0, MAKS_NAMUNA);
    const guruhNamunalari = (r.guruhlar || []).filter(g => !g.xato).slice(0, MAKS_NAMUNA);
    if (!savollar.length && !guruhNamunalari.length) throw new Error("Rasmdan namuna masala topilmadi — aniqroq surat oling yoki matnini yozing");
    // Tuziladigan turga mos namuna birinchi turadi; bo'lmasa — rasmda nima bo'lsa shu.
    const matn = (guruhli ? [...guruhNamunalari.map(guruhMatni), ...savollar.map(savolMatni)] : [...savollar.map(savolMatni), ...guruhNamunalari.map(guruhMatni)]).slice(0, MAKS_NAMUNA).join('\n\n');
    const n = { rasm: namunaRasm, matn, savollar, guruhlar: guruhNamunalari };
    setOqilgan(n);
    return n;
  };

  const tekshir = async (yangilar: Yangi[]): Promise<Yangi[]> => {
    const natija: Yangi[] = [];
    for (let i = 0; i < yangilar.length; i += TEKSHIRUV_BOLAGI) {
      const b = yangilar.slice(i, i + TEKSHIRUV_BOLAGI);
      let t: Tekshiruv[] = [];
      try {
        if (b.some(n => n.type !== 'yozma')) t = (await soro<{ natijalar: Tekshiruv[] }>('POST', 'ai/tekshir', { savollar: b })).natijalar;
      } catch (e: unknown) {
        // Tekshirib bo'lmadi — bu savollar belgisiz qoladi (qoralama bo'lib tushadi).
        showNotification(`Javoblarni tekshirib bo'lmadi (${xatoMatni(e)})`, 'info');
      }
      natija.push(...b.map((n, k) => ({ ...n, tekshiruv: t[k] || null, tanlangan: n.takrorId ? false : n.namuna ? !n.xato : n.type === 'yozma' ? !!n.solution : t[k]?.tekshirildi === true })));
    }
    return natija;
  };

  /** Yozma masalalardan yechimi bo'lmaganlarini AI alohida yechadi (batafsil yechim). */
  const yechimsizlarniYech = async (yangilar: Yangi[], fanNomi: string, rasm: string | null): Promise<Yangi[]> => {
    const kerak = yangilar.filter(n => n.type === 'yozma' && !n.solution);
    if (!kerak.length) return yangilar;
    const yechimlar = new Map<number, string>();
    for (let i = 0; i < kerak.length; i += YECHISH_BOLAGI) {
      const b = kerak.slice(i, i + YECHISH_BOLAGI);
      try {
        const r = await yechimSora(soro, b, fanNomi, rasm && b.some(n => n.namuna && /\[rasm/.test(n.text)) ? [rasm] : []);
        b.forEach((n, k) => { if (r[k]?.yechim) yechimlar.set(n.kalit, r[k].yechim); });
      } catch { /* yechimsiz qoladi — kartada ko'rinadi */ }
    }
    return yangilar.map(n => (yechimlar.has(n.kalit) ? { ...n, solution: yechimlar.get(n.kalit)! } : n));
  };

  /** Namunaning chizmasi bormi (rasmdan o'qilgan namuna matnida «[rasm]» belgisi) — yangilari ham chizmali tuziladi. */
  const namunaRasmli = (n: OqilganNamuna | null) => !!n && [...n.savollar, ...n.guruhlar].some(x => rasmBelgisiBor(x.text));

  /** Hamma tur uchun umumiy so'rov maydonlari. */
  const sorovAsosi = (fanNomi: string, namunaMatni: string, rasmli: boolean) => ({
    fan: fanNomi, mavzu: mavzuNomi, tavsif, namuna: namunaMatni, oxshash: namunaMatni ? oxshash : '', rasmli,
    tur, qiyinlik: daraja.d, darajaNomi: darajaBandi(daraja).darajaId ? darajaBandi(daraja).nom : '',
  });

  /**
   * Chizma so'rovi: rasmdan o'qilgan namunaning o'zi — o'sha rasm bo'yicha (asl rasm); yangi tuzilgani — matni
   * bo'yicha, namuna rasmi (bo'lsa) uslub uchun.
   */
  const rasmSorovi = (q: { namuna?: boolean }, variantlar: string[] | null, javob: string | null, n: OqilganNamuna | null) => ({
    variantlar, javob, fan: fan?.name,
    ...(q.namuna ? { aslRasm: n ? [n.rasm] : null } : { namuna: namunaRasmli(n) ? [n!.rasm] : null }),
  });

  /** Navbatdan kelgan chizma savolga yoki guruh shartiga qo'yiladi (kalitlar umumiy sanoqdan). */
  const rasmKeldi = (kalit: number, n: RasmNatijasi) => {
    setNatijalar(l => l && l.map(q => (q.kalit === kalit ? rasmNatijasiniQoy(q, n) : q)));
    setGuruhlar(l => l && l.map(g => (g.kalit === kalit ? rasmNatijasiniQoy(g, n) : g)));
  };
  const rasmlarniChizdir = async (ishlar: RasmIshi<number>[]) => {
    const kalitlar = new Set(ishlar.map(i => i.kalit));
    setNatijalar(l => l && l.map(q => (kalitlar.has(q.kalit) ? { ...q, rasm: { band: true } } : q)));
    setGuruhlar(l => l && l.map(g => (kalitlar.has(g.kalit) ? { ...g, rasm: { band: true } } : g)));
    const h = await rasmNavbati.chiz(ishlar, rasmKeldi);
    // Chizilmagani saqlashga to'sqinlik qilmaydi: belgi matnda qoladi, savol qoralama bo'lib tushadi.
    if (h.chizilmadi) showNotification(`${h.chizildi} ta rasm chizildi, ${h.chizilmadi} tasi chizilmadi: ${h.xato}. Kartadagi «Vektor qilib chizish» bilan qayta urinasiz`, 'error');
    else if (h.chizildi) showNotification(`${h.chizildi} ta rasm chizildi — ko'zdan kechiring`, 'success');
  };

  const tuz = async (qoshimcha = false) => {
    if (!fan) return showNotification('Fanni tanlang', 'error');
    if (!mavzuNomi) return showNotification('Mavzuni tanlang', 'error');
    // Shu tuzishda paydo bo'lgan chizmali savollar — tuzish (va tekshiruv) tugagach navbat bilan chiziladi.
    let rasmIshlari: RasmIshi<number>[] = [];
    try {
      rasmIshlari = await savollarniTuz(qoshimcha, fan.name);
    } catch (e: unknown) {
      showNotification(xatoMatni(e), 'error');
    } finally {
      setHolat(null);
    }
    if (rasmIshlari.length) await rasmlarniChizdir(rasmIshlari);
  };

  /** Tuzadi (guruhli yoki oddiy), tekshiradi va ro'yxatga qo'yadi. Qaytadi: chiziladigan chizmalar. */
  const savollarniTuz = async (qoshimcha: boolean, fanNomi: string): Promise<RasmIshi<number>[]> => {
    const rasmdan = await namunaniOqi(fanNomi);
    const rasmli = namunaRasmli(rasmdan);
    const namunaMatni = [rasmdan?.matn, namuna.trim()].filter(Boolean).join('\n\n');
    if (guruhli) {
      setHolat(`AI ${soni} ta ${turMalumoti.nom} savoli tuzmoqda…`);
      const r = await soro<{ guruhlar: Omit<AiGuruh, 'kalit' | 'tanlangan'>[] }>('POST', 'questions/ai/guruh-tuz', { ...sorovAsosi(fanNomi, namunaMatni, rasmli), soni });
      // Rasmdan o'qilgan namuna guruh(lar) ham ro'yxatda — bankka qo'shish mumkin.
      const namunalar = qoshimcha ? [] : (rasmdan?.guruhlar || []).filter(g => g.tur === tur).map(g => ({ ...g, namuna: true }));
      if (!r.guruhlar.length && !namunalar.length) { showNotification("AI mos guruhli savol tuza olmadi — talabni aniqroq yozib, qayta urinib ko'ring", 'error'); return []; }
      const yangilar: AiGuruh[] = [...namunalar, ...r.guruhlar].map(g => ({ ...g, topic: mavzuNomi, difficulty: daraja.d, darajaId: daraja.darajaId, manba: 'ai' as const, kalit: keyingiKalit++, tanlangan: true }));
      setGuruhlar([...(qoshimcha ? guruhlar || [] : []), ...yangilar]);
      // Guruh shartining chizmasi (belgi bo'lsa): guruhlar kam (2–5 ta) — hammasi chiziladi.
      return yangilar.filter(g => rasmBelgisiBor(g.text)).map(g => rasmIshi(g.kalit, g, rasmSorovi(g, null, null, rasmdan)));
    }
    const yig: Yangi[] = qoshimcha ? [...(natijalar || [])] : [];
    const avvalgilar = new Set(yig.map(n => n.kalit));
    const maqsad = yig.filter(n => !n.namuna).length + soni;
    const korilgan = new Set(yig.map(n => izi(n.text)));
    // Rasmdan o'qilgan namuna masala(lar) ham ro'yxatda: tekshiriladi, bankka qo'shish mumkin.
    if (!qoshimcha && rasmdan?.savollar.length) {
      setHolat('AI namunani tekshirmoqda…');
      const namunalar = rasmdan.savollar.map(q => ({ ...q, kalit: keyingiKalit++, tanlangan: false, tekshiruv: null, namuna: true }));
      namunalar.forEach(n => korilgan.add(izi(n.text)));
      yig.push(...await tekshir(await yechimsizlarniYech(namunalar, fanNomi, rasmdan.rasm)));
      setNatijalar([...yig]);
    }
    let bosh = 0;
    for (let tuzildi = 0; tuzildi < soni;) {
      const kerak = Math.min(bolak(tur), soni - tuzildi);
      setHolat(`AI savol tuzmoqda… ${yig.filter(n => !n.namuna).length} / ${maqsad}`);
      try {
        const r = await soro<{ savollar: AiSavol[] }>('POST', 'questions/ai/tuz', {
          ...sorovAsosi(fanNomi, namunaMatni, rasmli), soni: kerak, bor: yig.map(n => htmlMatnga(n.text).slice(0, 140)),
        });
        const yangilar = r.savollar.filter((q) => { const z = izi(q.text); if (!z || korilgan.has(z)) return false; korilgan.add(z); return true; })
          .map(q => ({ ...q, kalit: keyingiKalit++, tanlangan: false, tekshiruv: null }));
        tuzildi += kerak;
        // AI yaroqli savol bermagan bo'lishi mumkin (javobsiz yoki takror savollar serverda tashlanadi).
        if (!yangilar.length) { bosh++; continue; }
        setHolat(tur === 'yozma' ? 'AI yechimlarni yozmoqda…' : `AI javoblarni qayta yechib tekshirmoqda… ${yig.filter(n => !n.namuna).length + yangilar.length} / ${maqsad}`);
        yig.push(...await tekshir(await yechimsizlarniYech(yangilar, fanNomi, null)));
        setNatijalar([...yig]);
      } catch (e: unknown) {
        showNotification(xatoMatni(e), 'error');
        if ([429, 503].includes(xatoHolati(e)) || !yig.length) break;
        tuzildi += kerak;
      }
    }
    const yangiSoni = yig.filter(n => !n.namuna).length - (maqsad - soni);
    if (!yig.length && bosh) showNotification("AI mos savol tuza olmadi — talabni aniqroq yozib, qayta urinib ko'ring", 'error');
    else if (yig.length && yangiSoni < soni) showNotification(`${soni} ta so'ralgan edi — AI ${Math.max(0, yangiSoni)} ta yaroqli savol tuzdi`, 'info');
    // Chizmalar — shu safar paydo bo'lgan, matnida «[rasm]» belgisi bor savollar. Namunaning chizmasi bo'lsa
    // (xodim chizmali masala so'ragan) — hammasi; aks holda (chizmani mavzu talab qilgan) tejab — faqat
    // tekshiruvdan o'tib, o'zi belgilanganlari: qolganiga kartadagi «Vektor qilib chizish».
    return yig
      .filter(n => !avvalgilar.has(n.kalit) && !n.takrorId && rasmBelgisiBor(n.text) && (n.namuna || rasmli || n.tanlangan))
      .map(n => rasmIshi(n.kalit, n, rasmSorovi(n, n.options, n.type === 'yozma' ? null : n.correctAnswer, rasmdan)));
  };

  const ozgartir = (kalit: number, d: Partial<Yangi>) => setNatijalar(l => (l || []).map(n => (n.kalit === kalit ? { ...n, ...d } : n)));
  const tanlanganlar = (natijalar || []).filter(n => n.tanlangan);
  const tanlanganGuruhlar = (guruhlar || []).filter(g => g.tanlangan);
  // Faol: AI qayta yechib tasdiqlagan yoki ustoz o'zi tuzatgan; yozma (kaliti yo'q) va qolgani — qoralama.
  // Chizmasi kerak, lekin chizilmagan («[rasm]» belgisi matnda) savol ham qoralama.
  const faolmi = (n: Yangi) => (!!n.tahrirlandi || (n.type !== 'yozma' && n.tekshiruv?.tekshirildi === true)) && !rasmYetishmaydi(n) && !savolXatosi(n as never);

  /** Savollar tushadigan mavzu: bankdagisi yoki (yangi nom bo'lsa) hozir yaratiladi. */
  const mavzuIdOl = async (): Promise<number> => bankMavzuId ?? mavzuniTopYokiYarat(soro, fan!.id, mavzuNomi);

  const guruhSaqla = async () => {
    if (!fan || !mavzuNomi || !tanlanganGuruhlar.length) return;
    setSaqlanmoqda(true);
    try {
      let mid: number | null = null;
      const r = await guruhlarniSaqla(soro, tanlanganGuruhlar, async () => (mid ??= await mavzuIdOl()), 'AI tuzdi');
      if (r.ids.length) onSaqlandi(r.ids);
      // Yozilmaganlari oynada qoladi (qayta urinish uchun).
      if (r.qolgan.length) {
        showNotification(`${r.qolgan.length} ta guruhli savol yozilmadi: ${r.xatolar[0]}${r.soni ? ` (${r.soni} tasi bankka qo'shildi)` : ''}`, 'error');
        setGuruhlar(r.qolgan);
        return;
      }
      showNotification(`${r.soni} ta guruhli savol bankka qo'shildi — qoralama: javoblarini tekshirib, bankda faol qilasiz`, 'success');
      onYop();
    } catch (e: unknown) {
      showNotification(xatoMatni(e), 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  const saqla = async () => {
    if (!fan || !mavzuNomi || !tanlanganlar.length) return;
    setSaqlanmoqda(true);
    try {
      const joy = { subject: fan.name, topic: mavzuNomi, bankTopicId: bankMavzuId, ...darajaMaydonlari(daraja) };
      const qator = (n: Yangi, i: number, parentId: number | null) => ({
        type: n.type, text: n.text, options: n.type === 'yopiq' ? n.options : null,
        correctAnswer: n.type === 'yozma' ? '' : n.correctAnswer, solution: n.solution || null, solutionStatus: n.solution ? 'qoralama' : 'yoq',
        ...(n.imageUrl ? { imageUrl: n.imageUrl } : {}),
        ...joy, language: n.language || 'uz', status: faolmi(n) ? 'faol' : 'qoralama', source: n.namuna ? 'Rasmdan (AI)' : 'AI tuzdi', parentId, qator: i + 1,
      });
      type Javob = { count: number; ids?: number[]; xatolar: { qator: number; xato: string }[] };
      const ids: number[] = [];
      const xatolar: Javob['xatolar'] = [];
      // Avval namuna (rasmdan o'qilgan asl masala): bitta bo'lsa — yangilari unga «o'xshashi» bo'lib bog'lanadi.
      const namunalar = tanlanganlar.filter(n => n.namuna);
      const yangilar = tanlanganlar.filter(n => !n.namuna);
      let parentId: number | null = null;
      if (namunalar.length) {
        const r = await soro<Javob>('POST', 'questions/bulk', { questions: namunalar.map((n, i) => qator(n, i, null)), schoolId: filial });
        ids.push(...(r.ids || []));
        xatolar.push(...r.xatolar);
        if (namunalar.length === 1 && r.ids?.length === 1) parentId = r.ids[0];
      }
      if (yangilar.length) {
        const r = await soro<Javob>('POST', 'questions/bulk', { questions: yangilar.map((n, i) => qator(n, i, parentId)), schoolId: filial });
        ids.push(...(r.ids || []));
        xatolar.push(...r.xatolar);
      }
      const qoralama = tanlanganlar.filter(n => !faolmi(n)).length;
      showNotification(`${ids.length} ta savol bankka qo'shildi${qoralama ? ` — ${qoralama} tasi qoralama (bankda ko'rib, faol qilasiz)` : ''}${xatolar.length ? `; ${xatolar.length} tasi qo'shilmadi: ${xatolar[0].xato}` : ''}`, xatolar.length ? 'info' : 'success');
      onSaqlandi(ids);
      onYop();
    } catch (e: unknown) {
      showNotification(xatoMatni(e), 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  const tuzishTugmasi = guruhli ? `${soni} ta ${turMalumoti.nom} savoli tuzish` : `${soni} ta savol tuzish`;

  return (
    <div className="fixed inset-0 z-[260] flex items-start justify-center overflow-y-auto p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="AI savol tuzadi">
      <div className="fixed inset-0 bg-black/50" onClick={() => !band && onYop()} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-3xl border border-chiziq my-2">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-chiziq">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn flex items-center gap-1.5"><Sparkles size={15} className="text-brand shrink-0" /> Savol qo'shish</h3>
            <p className="text-[12px] text-matn-xira">Mavzuni tanlang — AI savollarni tuzadi va javoblarini qayta yechib tekshiradi. Namuna bersangiz — shunga o'xshashlarini tuzadi.</p>
            {onRejim && <QoshRejimi rejim="ai" onRejim={onRejim} band={band || !shakl} />}
          </div>
          <button aria-label="Yopish" disabled={band} onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer disabled:opacity-40"><X size={16} /></button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4">
          {ai && !ai.yoqilgan && (ai.sozlay ? <AiKalitKartasi ixcham />
            : <p className="rounded-xl bg-ogoh-fon border border-ogoh/25 px-3 py-2 text-[12.5px] text-matn">AI hali ulanmagan. Kalitni administrator Imtihonlar → Sozlamalar da kiritadi.</p>)}

          {shakl && (
            <>
              <FanMavzuTanlov fanlar={daraxt.fanlar} fan={fan} mavzuId={mavzuId} yangiMavzu={yangiMavzu} band={band}
                kutilgan={kutilgan && mavzuId != null ? { id: mavzuId, nom: kutilgan } : null}
                onFan={(id) => { setFanId(id); setMavzuId(null); setYangiMavzu(null); }} onMavzu={setMavzuId} onYangiMavzu={setYangiMavzu} />
              <Maydon div nom="Savol turi" izoh={turMalumoti.izoh}>
                <Tanlov qiymat={tur} onChange={turniTanla} variantlar={TURLAR.map(t => ({ v: t.v, nom: t.nom }))} />
              </Maydon>
              <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                <Maydon div nom="Nechta">
                  <Tanlov qiymat={soni} onChange={setSoni} variantlar={SONLAR[tur].map(n => ({ v: n, nom: `${n} ta` }))} />
                </Maydon>
                <Maydon div nom="Qiyinligi">
                  <DarajaTanlov qiymat={daraja} onChange={setDaraja} band={band} />
                </Maydon>
              </div>
              <Maydon nom="Nima kerak" izoh="Ixtiyoriy. O'z so'zingiz bilan: qanaqa masala yoki misol, qaysi sinf, qaysi darajada">
                <textarea rows={2} className={INPUT} value={tavsif} maxLength={1000} disabled={band} onChange={e => setTavsif(e.target.value)} aria-label="Nima kerak"
                  placeholder="Masalan: kasrlarni qo'shish va ayirishga oid matnli masalalar, 6-sinf, DTM testlaridagidek" />
              </Maydon>
              <Maydon div nom="Namuna" izoh="Ixtiyoriy. Masalaning matni yoki rasmi (kitob, daftar, test sahifasi; Ctrl+V ham bo'ladi) — AI shunga o'xshashlarini tuzadi">
                <div className="space-y-2">
                  {namunaRasm && (
                    <div className="flex items-start gap-3">
                      <a href={namunaRasm} target="_blank" rel="noopener noreferrer" title="Rasmni kattalashtirish" className="shrink-0">
                        <img src={namunaRasm} alt="Namuna rasmi" className="max-h-40 max-w-[220px] object-contain rounded-xl border border-chiziq bg-white" />
                      </a>
                      <Tugma kichik turi="oddiy" ikonka={<Trash2 size={13} />} disabled={band} onClick={() => { setNamunaRasm(null); setOqilgan(null); }}>Olib tashlash</Tugma>
                    </div>
                  )}
                  <textarea rows={3} className={INPUT} value={namuna} maxLength={3000} disabled={band} onChange={e => setNamuna(e.target.value)} aria-label="Namuna matni"
                    placeholder={namunaRasm ? "Qo'shimcha namuna matni (ixtiyoriy)" : 'Masalan: 3/4 + 1/6 ni hisoblang. A) 11/12 B) 4/10 C) 2/5 D) 5/6'} />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Tugma kichik ikonka={<Camera size={13} />} disabled={band} onClick={() => faylRef.current?.click()}>{namunaRasm ? 'Boshqa rasm' : 'Namuna rasmi'}</Tugma>
                    <input ref={faylRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; rasmniOl(f); }} />
                    {namunaBor && (
                      <span className="inline-flex flex-wrap items-center gap-2 text-[12px] text-matn-sokin">Namunadan nimasi o'zgarsin:
                        <Tanlov kichik qiymat={oxshash} onChange={setOxshash} variantlar={[{ v: 'sonlar', nom: 'Faqat sonlar' }, { v: 'vaziyat', nom: 'Vaziyat ham' }]} />
                      </span>
                    )}
                  </div>
                </div>
              </Maydon>
            </>
          )}

          {holat && <p role="status" className="flex items-center gap-2 text-[12.5px] text-matn-sokin"><Loader2 size={14} className="animate-spin" /> {holat}</p>}
          <RasmJarayoni holat={rasmNavbati.holat} onToxtat={rasmNavbati.toxtat} />

          {guruhlar && (
            <section aria-label="Tuzilgan guruhli savollar" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-matn"><b>{guruhlar.length}</b> ta {turMalumoti.nom} savoli · <span className="text-matn-sokin">{fan?.name} › {mavzuNomi}</span></p>
                <Tugma kichik ikonka={<Plus size={13} />} disabled={band || !!rasmNavbati.holat} onClick={() => tuz(true)}>Yana {soni} ta</Tugma>
              </div>
              <p className="text-[12px] text-matn-xira">Bankka qoralama bo'lib tushadi: javoblarini ko'zdan kechirib, bankda faol qilasiz.</p>
              <ul className="space-y-2">
                {guruhlar.map(g => (
                  <AiGuruhKarta key={g.kalit} g={g} band={band} onTanla={v => setGuruhlar(l => (l || []).map(x => (x.kalit === g.kalit ? { ...x, tanlangan: v } : x)))}
                    /* Umumiy shartning chizmasi: shart ostida, qayta chizsa bo'ladi. */
                    rasm={rasmKerakmi(g) ? (
                      <SavolRasmi q={g} sorov={rasmSorovi(g, null, null, oqilgan)} band={band} onOzgar={f => setGuruhlar(l => (l || []).map(x => (x.kalit === g.kalit ? f(x) : x)))} />
                    ) : undefined} />
                ))}
              </ul>
            </section>
          )}

          {natijalar && (
            <section aria-label="Tuzilgan savollar" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-matn"><b>{natijalar.length}</b> ta savol · <span className="text-matn-sokin">{fan?.name} › {mavzuNomi}</span></p>
                <div className="flex flex-wrap gap-2">
                  <Tugma kichik turi="oddiy" disabled={band} onClick={() => setNatijalar(l => (l || []).map(n => ({ ...n, tanlangan: !n.takrorId })))}>Hammasini tanlash</Tugma>
                  <Tugma kichik ikonka={<Plus size={13} />} disabled={band || tahrirda !== null || !!rasmNavbati.holat} onClick={() => tuz(true)}>Yana {soni} ta</Tugma>
                </div>
              </div>
              {natijalar.map((n, i) => (
                <div key={n.kalit} className={`rounded-xl border p-3 transition-colors ${n.tanlangan ? 'border-brand/40 bg-sirt' : 'border-chiziq bg-ichki/60'}`}>
                  <div className="flex items-start gap-2.5">
                    <input type="checkbox" aria-label={`${i + 1}-savolni tanlash`} className="mt-1 w-4 h-4 shrink-0 accent-[var(--color-brand)] cursor-pointer"
                      checked={n.tanlangan} disabled={band || tahrirda === n.kalit} onChange={e => ozgartir(n.kalit, { tanlangan: e.target.checked })} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5"><b className="text-[12px] text-matn-xira raqam">{i + 1}.</b><Belgi n={n} /></div>
                      {tahrirda === n.kalit
                        ? <Tahrir q={n} onBekor={() => setTahrirda(null)} onSaqla={q => { ozgartir(n.kalit, { ...q, tahrirlandi: true, tanlangan: true, xato: null }); setTahrirda(null); }} />
                        : <Korinish q={n} rasmsiz={rasmKerakmi(n)} onJavob={band ? undefined : j => ozgartir(n.kalit, { correctAnswer: j, tahrirlandi: true, tanlangan: true })} />}
                      {tahrirda !== n.kalit && rasmKerakmi(n) && (
                        <SavolRasmi q={n} sorov={rasmSorovi(n, n.options, n.type === 'yozma' ? null : n.correctAnswer, oqilgan)} band={band} onOzgar={f => setNatijalar(l => (l || []).map(x => (x.kalit === n.kalit ? f(x) : x)))} />
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
            </section>
          )}
        </div>

        <div className="sticky bottom-0 z-10 bg-sirt rounded-b-2xl flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-chiziq">
          {!shakl && !holat
            ? <Tugma turi="oddiy" disabled={band} onClick={() => { rasmNavbati.toxtat(); setNatijalar(null); setGuruhlar(null); setTahrirda(null); }}>Qaytadan</Tugma>
            : <Tugma turi="oddiy" disabled={band} onClick={onYop}>Yopish</Tugma>}
          {guruhlar && !holat ? (
            <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} disabled={!tanlanganGuruhlar.length || band || rasmNavbati.band} onClick={guruhSaqla}>
              {tanlanganGuruhlar.length ? `${tanlanganGuruhlar.length} ta guruhli savolni bankka qo'shish` : "Bankka qo'shish"}
            </Tugma>
          ) : !natijalar || holat ? (
            <Tugma turi="asosiy" ikonka={<Sparkles size={14} />} yuklanmoqda={!!holat} disabled={band || !ai?.yoqilgan} onClick={() => tuz()}>{tuzishTugmasi}</Tugma>
          ) : (
            <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} disabled={!tanlanganlar.length || band || tahrirda !== null || rasmNavbati.band} onClick={saqla}>
              {tanlanganlar.length ? `${tanlanganlar.length} ta savolni bankka qo'shish` : "Bankka qo'shish"}
            </Tugma>
          )}
        </div>
      </div>
    </div>
  );
}
