import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Sparkles, Camera, FileUp, ClipboardPaste, Trash2, Pencil, CheckCircle2, AlertTriangle, Loader2, Copy, FileSpreadsheet, FileText, Download, RotateCcw } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { useAiHolat } from '../useAiHolat';
import AiKalitKartasi from '../AiKalitKartasi';
import { Tugma, Tanlov, INPUT, SELECT, Yorliq, Maydon } from '../ui';
import { HARFLAR, savolXatosi, raqamniTozala } from '../../../../lib/imtihon.js';
import { QiyinlikTanlov } from './qiyinlik';
import { fanniTop, mavzuniTop, bolimlarga } from './useBankDaraxt';
import { type AiSavol, type Tekshiruv, sahifaRasmlari, matniBor, izi, xatoMatni, Korinish, Tahrir } from './aiUmumiy';
import { exceldanSavollar, shablonniYukla, type ExcelSavol } from './excel';
import QrShablonTugma from './QrShablonTugma';
import { wordniOqi, wordJadvalSavollari, ESKI_DOC, type WordNatija, type JadvalSavol } from './word';
import { compressAndUpload } from '../../../lib/image';
import type { BankDaraxt, BankFiltrMalumoti } from '../../../types';

// Savol qo'shish — bankka savol kiritishning yagona yo'li (egasi, 2026-09-29:
// "qo'lda savol kiritish — eng eski usul; fayldan yoki kameradan bo'lsin, fanlar
// bo'yicha, qisqa va aniq"). Manba: kamera (ketma-ket sahifalar), fayl (PDF,
// rasm, Excel) yoki joylangan matn. AI o'qiydi, har savolni fanning mavzulariga
// va qiyinlikka ajratadi, boshqa sahifadagi javoblar kalitini raqam bo'yicha
// ulaydi, bankda bori belgilanadi, har javobni AI kalitni ko'rmay qayta yechib
// tekshiradi. Tekshirilgani (yoki ustoz tuzatgani) — faol, qolgani — qoralama.

type Manba =
  | { kalit: number; tur: 'sahifa'; nom: string; rasm: string }
  | { kalit: number; tur: 'excel'; nom: string; savollar: ExcelSavol[]; xatolar: number }
  | ({ kalit: number; tur: 'word'; nom: string } & WordNatija)
  // Addmen QR jadvali (№ | savol | A–E | javob) — AI siz o'qiladi.
  | { kalit: number; tur: 'jadval'; nom: string; savollar: JadvalSavol[]; oqilmagan: number };

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface Natija extends AiSavol {
  kalit: number;
  tanlangan: boolean;
  subject: string;
  topic: string;
  manba: 'ai' | 'excel' | 'jadval';
  /** To'plam — qaysi fayldan (Addmen "QR file name"). */
  toplam?: string | null;
  tarjima?: { til: 'uz' | 'ru' | 'en'; text: string; options: string[] } | null;
  raqam?: string | null;
  javobManbasi?: 'material' | 'ai' | null;
  /** Javob boshqa sahifadagi kalitdan olindi. */
  kalitdan?: boolean;
  takrorId?: number | null;
  matnId?: string | null;
  /** AI tekshiruviga yuborildi; natijasi `tekshiruv` da (undefined — kutilmoqda). */
  tekshiriladi?: boolean;
  tekshiruv?: Tekshiruv;
  tahrirlandi?: boolean;
  excel?: ExcelSavol;
}
interface AiMatn { id: string; sarlavha: string; matn: string }

// Bitta so'rovda nechta sahifa: Vercel so'rov chegarasi 4,5 MB va vaqt chegarasi.
const PARTIYA = 3;
const MAKS_SAHIFA = 40;
const TEKSHIRUV_BOLAGI = 12;
const ARALASH = 'Aralash';
const KICHIK_SELECT = 'max-w-full px-2.5 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12.5px] text-matn outline-none focus:border-brand cursor-pointer';

let keyingi = 1;
/** To'plam nomi — fayl nomi kengaytmasiz (Addmen'da "QR file name"). */
const toplamNomi = (nom: string) => nom.replace(/\.(docx?|xlsx?)$/i, '').trim().slice(0, 200);
const bolaklar = <T,>(l: T[], n: number) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, i * n + n));

/** Materialdagi javoblar kaliti (boshqa sahifada bo'lsa ham) — savol raqami bo'yicha. */
function kalitniUla(royxat: Natija[], kalitlar: { raqam: string; javob: string }[]) {
  const map = new Map<string, string | null>();
  for (const k of kalitlar) {
    const eski = map.get(k.raqam);
    if (eski === undefined) map.set(k.raqam, k.javob);
    else if (eski !== null && eski.toUpperCase() !== k.javob.toUpperCase()) map.set(k.raqam, null);   // ziddiyat — tegmaymiz
  }
  let soni = 0;
  const yangi = royxat.map((q) => {
    if (q.manba !== 'ai' || !q.raqam || q.type === 'yozma' || q.javobManbasi === 'material') return q;
    const j = map.get(q.raqam);
    if (!j) return q;
    let javob = '';
    if (q.type === 'yopiq') {
      const h = j.toUpperCase().replace(/[^A-F]/g, '').slice(0, 1);
      if (h && HARFLAR.indexOf(h) < (q.options || []).length) javob = h;
    } else javob = raqamniTozala(j);
    if (!javob) return q;
    soni++;
    const xato = (q.xato || '').split(', ').filter(x => x && x !== "to'g'ri javob topilmadi").join(', ') || null;
    return { ...q, correctAnswer: javob, javobManbasi: 'material' as const, kalitdan: true, xato };
  });
  return { yangi, soni };
}

/** Belgilar: tekshiruv, kalit, takror, kamchilik. */
function Belgilar({ n }: { n: Natija }) {
  return (
    <>
      {n.takrorId ? <Yorliq rang="ogoh"><Copy size={11} /> Bankda bor (#{n.takrorId})</Yorliq> : null}
      {n.manba === 'excel' && <Yorliq><FileSpreadsheet size={11} /> Excel</Yorliq>}
      {n.manba === 'jadval' && <Yorliq><FileText size={11} /> Word jadvali</Yorliq>}
      {n.manba === 'jadval' && n.xato && <Yorliq rang="ogoh"><AlertTriangle size={11} /> {n.xato}</Yorliq>}
      {n.tahrirlandi ? <Yorliq rang="brand"><Pencil size={11} /> Tuzatildi</Yorliq>
        : n.tekshiriladi && !n.tekshiruv ? <Yorliq><Loader2 size={11} className="animate-spin" /> Tekshirilmoqda</Yorliq>
        : n.tekshiruv?.tekshirildi === true ? <Yorliq rang="yaxshi"><CheckCircle2 size={11} /> Javob to'g'ri</Yorliq>
        : n.tekshiruv?.tekshirildi === false ? <Yorliq rang="ogoh"><AlertTriangle size={11} /> AI boshqa javob chiqardi{n.tekshiruv.aiJavobi ? ` (${n.tekshiruv.aiJavobi})` : ''}</Yorliq>
        : null}
      {n.kalitdan && <Yorliq>Javob — kalitdan</Yorliq>}
      {n.manba === 'ai' && n.type !== 'yozma' && !n.correctAnswer && <Yorliq rang="ogoh"><AlertTriangle size={11} /> Javob topilmadi</Yorliq>}
    </>
  );
}

/** Saqlash natijasi — Zukko faol savollarni imtihonga qo'shishi uchun. */
export interface SaqlashNatijasi { soni: number; ids: number[]; faolIds: number[] }

export default function SavolYuklash({ daraxt, fanId: boshFan = null, mavzuId: boshMavzu = null, mavzuNomi: boshMavzuNomi, onYop, onSaqlandi, boshFayllar, avto = false, yuqorida = false }: {
  daraxt: BankDaraxt; fanId?: number | null; mavzuId?: number | null;
  /** `mavzuId` ning nomi — mavzu hozirgina yaratilgan bo'lib, daraxtda hali ko'rinmasa ham savollar o'shanga tushsin. */
  mavzuNomi?: string;
  onYop: () => void; onSaqlandi: (natija?: SaqlashNatijasi) => void;
  /** Zukko dan: biriktirilgan fayllar; avto — yuklangach ajratish o'zi boshlanadi; yuqorida — Zukko panelining ustida. */
  boshFayllar?: File[]; avto?: boolean; yuqorida?: boolean;
}) {
  const { showNotification } = useCRM();
  const { soro, filial } = useImtihonApi();
  const ai = useAiHolat();

  const [fanId, setFanId] = useState<number | null>(() => boshFan ?? daraxt.fanlar.find(f => f.mavzular.some(m => m.id === boshMavzu))?.id ?? (daraxt.fanlar.length === 1 ? daraxt.fanlar[0].id : null));
  const [mavzuId, setMavzuId] = useState<number | null>(boshMavzu);
  const [yangiMavzu, setYangiMavzu] = useState<string | null>(null);
  const fan = fanniTop(daraxt, fanId);
  const mavzu = mavzuniTop(fan, mavzuId);
  // Bank ro'yxatidan kelgan mavzu daraxtda hali yo'q (hozirgina yaratilgan) — nomi bilan ishlaymiz.
  const kutilgan = !mavzu && mavzuId != null && mavzuId === boshMavzu && boshMavzuNomi ? boshMavzuNomi : '';
  // Qat'iy mavzu (tanlangan yoki yangi) — bo'lmasa AI o'zi ajratadi.
  const qatiyMavzu = yangiMavzu !== null ? yangiMavzu.trim() : mavzu?.name || kutilgan;

  const [manbalar, setManbalar] = useState<Manba[]>([]);
  const [matnOchiq, setMatnOchiq] = useState(false);
  const [matn, setMatn] = useState('');
  const [ustida, setUstida] = useState(false);
  const kameraRef = useRef<HTMLInputElement>(null);
  const faylRef = useRef<HTMLInputElement>(null);

  const [jarayon, setJarayon] = useState<{ matn: string; i: number; jami: number } | null>(null);
  const [natijalar, setNatijalar] = useState<Natija[] | null>(null);
  const [matnlar, setMatnlar] = useState<AiMatn[]>([]);
  const [filtr, setFiltr] = useState<'hammasi' | 'tekshirish' | 'takror'>('hammasi');
  const [tahrirda, setTahrirda] = useState<number | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const band = !!jarayon || saqlanmoqda;

  const sahifalar = manbalar.filter((m): m is Extract<Manba, { tur: 'sahifa' }> => m.tur === 'sahifa');
  const excellar = manbalar.filter((m): m is Extract<Manba, { tur: 'excel' }> => m.tur === 'excel');
  const wordlar = manbalar.filter((m): m is Extract<Manba, { tur: 'word' }> => m.tur === 'word');
  const jadvallar = manbalar.filter((m): m is Extract<Manba, { tur: 'jadval' }> => m.tur === 'jadval');
  const aiSiz = excellar.reduce((a, e) => a + e.savollar.length, 0) + jadvallar.reduce((a, j) => a + j.savollar.length, 0);
  const aiKerak = sahifalar.length > 0 || wordlar.length > 0 || !!matn.trim();

  /** Fan mavzusining aniq nomi (katta-kichik harfsiz mos kelsa) — bo'lmasa AI bergan yangi nom. */
  const mavzuNomi = (nom: string | null | undefined) => {
    const t = String(nom || '').trim();
    if (!t) return ARALASH;
    return fan?.mavzular.find(m => m.name.toLowerCase() === t.toLowerCase())?.name || t;
  };

  const fayllarniQosh = async (fayllar: File[]) => {
    for (const f of fayllar) {
      try {
        if (/\.xlsx?$/i.test(f.name)) {
          const r = await exceldanSavollar(f, { fan: fan?.name, mavzu: qatiyMavzu || undefined });
          if (!r.yaroqli.length) { showNotification(r.xatolar.length ? `${f.name}: ${r.xatolar.length} ta qatorda xato (${r.xatolar[0].qator}-qator: ${r.xatolar[0].xato})` : `${f.name}: savol topilmadi`, 'error'); continue; }
          setManbalar(l => [...l, { kalit: keyingi++, tur: 'excel', nom: f.name, savollar: r.yaroqli, xatolar: r.xatolar.length }]);
          if (r.xatolar.length) showNotification(`${f.name}: ${r.xatolar.length} ta qator o'tkazib yuborildi (${r.xatolar[0].qator}-qator: ${r.xatolar[0].xato})`, 'info');
        } else if (/\.docx$/i.test(f.name) || f.type === DOCX) {
          setJarayon({ matn: "Word hujjati o'qilmoqda", i: 0, jami: 0 });
          // Avval Addmen QR jadvali (№ | savol | A–E | javob): bo'lsa — AI siz, rasmlar saqlanadi.
          const j = await wordJadvalSavollari(f, (d, nom) => compressAndUpload(d, nom, 1400, 1400, 0.85));
          if (j?.savollar.length) {
            setManbalar(l => [...l, { kalit: keyingi++, tur: 'jadval', nom: f.name, savollar: j.savollar, oqilmagan: j.oqilmagan }]);
            continue;
          }
          const w = await wordniOqi(f);
          setManbalar(l => [...l, { kalit: keyingi++, tur: 'word', nom: f.name, ...w }]);
        } else if (/\.doc$/i.test(f.name) || f.type === 'application/msword') {
          showNotification(`${f.name}: ${ESKI_DOC}`, 'error');
        } else if (/^image\//.test(f.type) || /\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name) || f.type === 'application/pdf') {
          const qoldi = MAKS_SAHIFA - sahifalar.length;
          if (qoldi <= 0) { showNotification(`Bir martada ${MAKS_SAHIFA} sahifagacha`, 'error'); break; }
          setJarayon({ matn: 'Sahifalar tayyorlanmoqda', i: 0, jami: 0 });
          const rasmlar = await sahifaRasmlari(f, qoldi, n => setJarayon({ matn: 'Sahifalar tayyorlanmoqda', i: n, jami: 0 }));
          setManbalar(l => [...l, ...rasmlar.map((rasm, i) => ({ kalit: keyingi++, tur: 'sahifa' as const, nom: rasmlar.length > 1 ? `${f.name} · ${i + 1}` : f.name, rasm }))]);
        } else {
          showNotification(`${f.name}: bu turdagi fayl o'qilmaydi — PDF, Word (.docx), rasm yoki Excel yuklang`, 'error');
        }
      } catch (e: any) {
        showNotification(`${f.name}: ${e?.message || "o'qib bo'lmadi"}`, 'error');
      } finally {
        setJarayon(null);
      }
    }
  };

  // Zukko dan kelgan fayllar ochilishi bilan yuklanadi; avto bo'lsa ajratish ham o'zi boshlanadi.
  const boshlandi = useRef(false);
  const [avtoKutadi, setAvtoKutadi] = useState(false);
  useEffect(() => {
    if (boshlandi.current || !boshFayllar?.length) return;
    boshlandi.current = true;
    fayllarniQosh(boshFayllar).then(() => { if (avto) setAvtoKutadi(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!avtoKutadi || jarayon || !ai) return;
    setAvtoKutadi(false);
    // Rasm/PDF uchun fan va AI kerak — bo'lmasa xodim o'zi tanlab, tugmani bosadi.
    if (natijalar || !manbalar.length || (jadvallar.length > 0 && !fan) || ((sahifalar.length > 0 || wordlar.length > 0) && (!fan || !ai.yoqilgan))) return;
    ajrat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avtoKutadi, jarayon, ai]);

  // Kompyuterda: nusxalangan rasm (Ctrl+V).
  useEffect(() => {
    if (natijalar) return;
    const f = (e: ClipboardEvent) => {
      const rasmlar = Array.from(e.clipboardData?.files || []).filter(x => x.type.startsWith('image/'));
      if (rasmlar.length) { e.preventDefault(); fayllarniQosh(rasmlar); }
    };
    window.addEventListener('paste', f);
    return () => window.removeEventListener('paste', f);
  });

  const ajrat = async () => {
    if (!aiKerak && !aiSiz) return showNotification("Rasm, fayl yoki matn qo'shing", 'error');
    if ((aiKerak || jadvallar.length) && !fan) return showNotification('Fanni tanlang', 'error');
    if (aiKerak && !ai?.yoqilgan) return showNotification("Rasm, PDF va Word ni o'qish uchun avval AI ni ulang (yuqorida)", 'error');
    const yig: Natija[] = [];
    const matnYig: AiMatn[] = [];
    const kalitYig: { raqam: string; javob: string }[] = [];
    const xatolar: string[] = [];
    try {
      for (const e of excellar) {
        for (const q of e.savollar) {
          yig.push({
            kalit: keyingi++, manba: 'excel', excel: q, tanlangan: true, subject: q.subject, topic: q.topic,
            type: q.type, text: q.text, options: q.options, correctAnswer: q.correctAnswer, difficulty: q.difficulty,
            language: q.language, solution: q.solution, solutionStatus: q.solutionStatus, toplam: toplamNomi(e.nom),
          });
        }
      }
      // Word jadvali: shu nomli to'plam bankda bo'lsa — qayta qo'shilmasin (belgilanmaydi).
      let bankdagi: BankFiltrMalumoti['toplamlar'] = [];
      if (jadvallar.length && fan) {
        try { bankdagi = (await soro<BankFiltrMalumoti>('GET', `bank/filtr?fanId=${fan.id}`)).toplamlar; } catch { /* tekshiruvsiz davom etadi */ }
      }
      for (const j of jadvallar) {
        const toplam = toplamNomi(j.nom);
        const bor = bankdagi.find(t => t.nom === toplam);
        if (bor) showNotification(`«${toplam}» to'plami bankda bor (${bor.soni} ta savol) — savollar belgilanmadi, qayta qo'shilsa takrorlanadi`, 'info');
        for (const q of j.savollar) {
          yig.push({
            kalit: keyingi++, manba: 'jadval', tanlangan: !bor, subject: fan!.name, topic: qatiyMavzu || ARALASH, raqam: q.raqam,
            type: 'yopiq', text: q.text, options: q.options, correctAnswer: q.correctAnswer, difficulty: 2,
            language: 'uz', solution: null, solutionStatus: 'yoq', xato: q.xato, toplam, tarjima: q.tarjima || null,
          });
        }
      }
      if (aiKerak && fan) {
        // So'rovlar: sahifa suratlari 3 tadan, Word — o'qilganda bo'lingan qismlar,
        // joylangan matn — birinchi so'rov bilan (bo'lmasa alohida).
        const partiyalar: { rasmlar: string[]; matn: string }[] = [
          ...bolaklar(sahifalar.map(s => s.rasm), PARTIYA).map(rasmlar => ({ rasmlar, matn: '' })),
          ...wordlar.flatMap(w => w.qismlar),
        ];
        if (matn.trim()) {
          if (partiyalar[0] && !partiyalar[0].matn) partiyalar[0] = { ...partiyalar[0], matn };
          else partiyalar.unshift({ rasmlar: [], matn });
        }
        for (let i = 0; i < partiyalar.length; i++) {
          setJarayon({ matn: `AI o'qimoqda${yig.length ? ` · ${yig.length} ta savol` : ''}`, i, jami: partiyalar.length });
          try {
            const r = await soro<{ savollar: any[]; matnlar: AiMatn[]; kalit: { raqam: string; javob: string }[] }>('POST', 'questions/ai/import', {
              fan: fan.name, mavzu: qatiyMavzu, mavzular: fan.mavzular.map(m => m.name), til: 'auto',
              rasmlar: partiyalar[i].rasmlar, matn: partiyalar[i].matn,
            });
            matnYig.push(...(r.matnlar || []).map(m => ({ ...m, id: `p${i}-${m.id}` })));
            kalitYig.push(...(r.kalit || []));
            for (const q of r.savollar || []) {
              yig.push({
                ...q, kalit: keyingi++, manba: 'ai', tanlangan: false, subject: fan.name,
                topic: qatiyMavzu || mavzuNomi(q.topic), matnId: q.matnId ? `p${i}-${q.matnId}` : null,
              });
            }
          } catch (e: any) {
            xatolar.push(`${i + 1}-qism: ${xatoMatni(e)}`);
            if (e?.status === 429 || e?.status === 503) break;   // limit yoki kalit — qolgani ham o'tmaydi
          }
        }
      }
      // Boshqa sahifadagi javoblar kaliti; bir xil savol ikki marta kelsa — bittasi qoladi.
      const { yangi, soni: kalitdan } = kalitniUla(yig, kalitYig);
      const korilgan = new Set<string>();
      let ichki = 0;
      const royxat = yangi.filter((q) => {
        const iz = izi(q.text);
        if (!iz) return false;
        if (korilgan.has(iz)) { ichki++; return false; }
        korilgan.add(iz);
        return true;
      }).map(q => (q.manba === 'ai' ? { ...q, tanlangan: !q.takrorId && matniBor(q.text) } : q));
      if (!royxat.length) {
        showNotification(xatolar.length ? `O'qib bo'lmadi: ${xatolar[0]}` : 'Savol topilmadi — aniqroq surat oling yoki boshqa fayl tanlang', 'error');
        return;
      }
      // Mustaqil tekshiruv: AI javobni ko'rmay qayta yechadi (yozma, takror va javobsizlar — yo'q).
      const tek = royxat.filter(q => q.manba === 'ai' && q.type !== 'yozma' && q.correctAnswer && !q.takrorId);
      const tekKalit = new Set(tek.map(q => q.kalit));
      const holatlar = royxat.map(q => (tekKalit.has(q.kalit) ? { ...q, tekshiriladi: true } : q));
      setMatnlar(matnYig);
      setNatijalar(holatlar);
      if (xatolar.length) showNotification(`${xatolar.length} ta qism o'qilmadi: ${xatolar[0]}`, 'error');
      const eslatma = [kalitdan ? `${kalitdan} ta javob kalitdan olindi` : '', ichki ? `${ichki} ta takror tashlandi` : ''].filter(Boolean).join(', ');
      if (eslatma) showNotification(eslatma, 'info');
      if (tek.length) {
        const navbat = bolaklar(tek, TEKSHIRUV_BOLAGI);
        let tugadi = 0;
        setJarayon({ matn: 'AI javoblarni qayta yechib tekshirmoqda', i: 0, jami: tek.length });
        const ishchi = async () => {
          for (let b = navbat.shift(); b; b = navbat.shift()) {
            const bolak = b;
            let natija: Tekshiruv[] = bolak.map(() => ({ tekshirildi: null, aiJavobi: '' }));
            try { natija = (await soro<{ natijalar: Tekshiruv[] }>('POST', 'ai/tekshir', { savollar: bolak })).natijalar; } catch { /* belgisiz qoladi — qoralama bo'lib tushadi */ }
            const map = new Map(bolak.map((q, j) => [q.kalit, natija[j] || { tekshirildi: null, aiJavobi: '' }]));
            setNatijalar(l => (l || []).map(q => (map.has(q.kalit) ? { ...q, tekshiruv: map.get(q.kalit) } : q)));
            tugadi += bolak.length;
            setJarayon({ matn: 'AI javoblarni qayta yechib tekshirmoqda', i: tugadi, jami: tek.length });
          }
        };
        await Promise.all([ishchi(), ishchi()]);
      }
    } finally {
      setJarayon(null);
    }
  };

  const ozgartir = (kalit: number, d: Partial<Natija>) => setNatijalar(l => (l || []).map(n => (n.kalit === kalit ? { ...n, ...d } : n)));

  // Holat: AI tasdiqlagan, ustoz tuzatgan yoki yozma — faol; Excel — faylidagi holat; qolgani qoralama.
  const holatiQanday = (n: Natija): string => {
    if (n.manba === 'excel' && !n.tahrirlandi) return n.excel?.status || 'faol';
    // Markazning o'z banki (Addmen) — to'liq bo'lsa faol, kamchiligi bo'lsa qoralama.
    if (n.manba === 'jadval' && !n.tahrirlandi) return !n.xato && !savolXatosi(n as any) ? 'faol' : 'qoralama';
    const ishonchli = n.tahrirlandi || n.type === 'yozma' || n.tekshiruv?.tekshirildi === true;
    return ishonchli && !savolXatosi(n as any) ? 'faol' : 'qoralama';
  };

  const tanlanganlar = (natijalar || []).filter(n => n.tanlangan);
  const faolSoni = tanlanganlar.filter(n => holatiQanday(n) === 'faol').length;

  const saqla = async () => {
    if (!tanlanganlar.length) return;
    setSaqlanmoqda(true);
    try {
      const matnIdlari = new Map<string, number>();
      for (const m of matnlar.filter(m => tanlanganlar.some(q => q.matnId === m.id))) {
        const p = await soro<{ id: number }>('POST', 'passages', { subject: fan?.name || tanlanganlar[0].subject, title: m.sarlavha || null, text: m.matn, schoolId: filial });
        matnIdlari.set(m.id, p.id);
      }
      const questions = tanlanganlar.map((n, i) => {
        const bank = n.subject === fan?.name ? fan?.mavzular.find(m => m.name === n.topic) : undefined;
        const kutilganId = !bank && kutilgan && n.subject === fan?.name && n.topic === kutilgan ? mavzuId : null;
        const asos = n.manba === 'excel' && n.excel ? (({ qator, ...e }) => e)(n.excel) : n.manba === 'jadval' ? {} : { source: 'AI import' };   // eslint-disable-line @typescript-eslint/no-unused-vars
        return {
          ...asos,
          toplam: n.toplam || null,
          ...(n.tarjima ? { tarjima: n.tarjima } : {}),
          subject: n.subject, topic: n.topic || ARALASH, bankTopicId: bank?.id ?? kutilganId ?? null,
          type: n.type, text: n.text, options: n.type === 'yopiq' || n.type === 'moslash' ? n.options : null,
          correctAnswer: n.type === 'yozma' ? '' : n.correctAnswer, difficulty: n.difficulty, language: n.language || 'uz',
          solution: n.solution || null,
          solutionStatus: n.manba === 'excel' ? n.excel?.solutionStatus : n.solution ? 'qoralama' : 'yoq',
          passageId: n.matnId ? matnIdlari.get(n.matnId) ?? null : null,
          status: holatiQanday(n), qator: i + 1,
        };
      });
      // Katta fayl (Addmen to'plami) — 1000 tadan bo'lib yuboriladi (server chegarasi 2000).
      const r = { count: 0, ids: [] as number[], faolIds: [] as number[], xatolar: [] as { qator: number; xato: string }[] };
      for (let i = 0; i < questions.length; i += 1000) {
        if (questions.length > 1000) setJarayon({ matn: 'Bankka yozilmoqda', i, jami: questions.length });
        const b = await soro<{ count: number; ids?: number[]; faolIds?: number[]; xatolar: { qator: number; xato: string }[] }>('POST', 'questions/bulk', { questions: questions.slice(i, i + 1000), schoolId: filial });
        r.count += b.count;
        r.ids.push(...(b.ids || []));
        r.faolIds.push(...(b.faolIds || []));
        r.xatolar.push(...b.xatolar);
      }
      setJarayon(null);
      const qoralama = questions.filter(q => q.status === 'qoralama').length;
      showNotification(`${r.count} ta savol bankka qo'shildi${qoralama ? ` — ${qoralama} tasi qoralama (bankda ko'rib, faol qilasiz)` : ''}${r.xatolar.length ? `; ${r.xatolar.length} tasi qo'shilmadi: ${r.xatolar[0].xato}` : ''}`, r.xatolar.length ? 'info' : 'success');
      onSaqlandi({ soni: r.count, ids: r.ids || [], faolIds: r.faolIds || [] });
      onYop();
    } catch (e: any) {
      showNotification(e.message, 'error');
      setJarayon(null);
    } finally {
      setSaqlanmoqda(false);
    }
  };

  // Ko'rib chiqish: filtr va mavzular bo'yicha guruhlar.
  const tekshirishKerak = (n: Natija) => n.tekshiruv?.tekshirildi === false || (n.type !== 'yozma' && !n.correctAnswer) || !!n.xato;
  const korinadi = (natijalar || []).filter(n => (filtr === 'hammasi' ? true : filtr === 'takror' ? !!n.takrorId : tekshirishKerak(n)));
  const guruhlar = useMemo(() => {
    const m = new Map<string, Natija[]>();
    for (const n of korinadi) {
      const k = n.subject === fan?.name ? n.topic : `${n.subject} › ${n.topic}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(n);
    }
    return [...m.entries()];
  }, [korinadi, fan?.name]);
  const mavzuVariantlari = useMemo(() => {
    const s = new Set<string>((fan?.mavzular || []).map(m => m.name));
    (natijalar || []).forEach(n => { if (n.subject === fan?.name && n.topic) s.add(n.topic); });
    s.add(ARALASH);
    return [...s];
  }, [fan, natijalar]);
  const sanoq = useMemo(() => {
    const l = natijalar || [];
    return {
      jami: l.length,
      togri: l.filter(n => n.tekshiruv?.tekshirildi === true).length,
      tekshirish: l.filter(tekshirishKerak).length,
      takror: l.filter(n => n.takrorId).length,
      tekshirilmoqda: l.filter(n => n.tekshiriladi && !n.tekshiruv).length,
    };
  }, [natijalar]);   // eslint-disable-line react-hooks/exhaustive-deps

  const yangiMavzuBelgisi = (nom: string) => !!fan && nom !== ARALASH && !fan.mavzular.some(m => m.name === nom);

  // ---- Oyna ------------------------------------------------------------------

  return (
    <div className={`fixed inset-0 ${yuqorida ? 'z-[400]' : 'z-[260]'} flex items-start justify-center overflow-y-auto p-2 sm:p-4`} role="dialog" aria-modal="true" aria-label="Savol qo'shish">
      <div className="fixed inset-0 bg-black/50" onClick={() => !band && onYop()} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-4xl border border-chiziq my-2 sm:my-4">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-chiziq">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn flex items-center gap-1.5"><Sparkles size={15} className="text-brand shrink-0" /> Savol qo'shish</h3>
            <p className="text-[12px] text-matn-xira">Rasm, PDF, Word, Excel yoki matn — AI o'qiydi, mavzu va qiyinlikka ajratadi, javoblarini tekshiradi.</p>
          </div>
          <button aria-label="Yopish" disabled={band} onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer disabled:opacity-40"><X size={16} /></button>
        </div>

        {!natijalar ? (
          <div className="p-4 sm:p-5 space-y-4">
            {ai && !ai.yoqilgan && (
              ai.sozlay ? <AiKalitKartasi ixcham />
                : <p className="rounded-xl bg-ogoh-fon border border-ogoh/25 px-3 py-2 text-[12.5px] text-matn">AI hali ulanmagan — rasm va PDF o'qilmaydi (Excel ishlaydi). Kalitni administrator Sozlamalar → Integratsiyalar da kiritadi.</p>
            )}
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
                  <select className={SELECT} value={mavzu?.id ?? (kutilgan ? mavzuId ?? '' : '')} disabled={!fan || band} aria-label="Mavzu"
                    onChange={e => (e.target.value === 'yangi' ? setYangiMavzu('') : setMavzuId(Number(e.target.value) || null))}>
                    {/* Word jadvali va Excel AI siz o'qiladi — mavzu tanlanmasa «Aralash» ga tushadi. */}
                    <option value="">{!fan ? 'Avval fanni tanlang' : jadvallar.length > 0 && !aiKerak ? `Tanlanmagan — «${ARALASH}» mavzusiga tushadi` : 'AI o\'zi mavzularga ajratsin'}</option>
                    {kutilgan && mavzuId != null && <option value={mavzuId}>{kutilgan}</option>}
                    {fan && bolimlarga(fan.mavzular).map(g => (g.bolim
                      ? <optgroup key={g.bolim + g.mavzular[0].id} label={g.bolim}>{g.mavzular.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
                      : g.mavzular.map(m => <option key={m.id} value={m.id}>{m.name}</option>)))}
                    {fan && <option value="yangi">+ Yangi mavzu…</option>}
                  </select>
                )}
              </Maydon>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setUstida(true); }} onDragLeave={() => setUstida(false)}
              onDrop={e => { e.preventDefault(); setUstida(false); fayllarniQosh(Array.from(e.dataTransfer.files || [])); }}
              className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${ustida ? 'border-brand bg-brand-fon dark:bg-brand/10' : 'border-chiziq-kuchli bg-ichki'}`}>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                <Tugma turi="asosiy" ikonka={<Camera size={15} />} disabled={band} onClick={() => kameraRef.current?.click()}>{sahifalar.length ? 'Yana suratga olish' : 'Suratga olish'}</Tugma>
                <Tugma ikonka={<FileUp size={15} />} disabled={band} onClick={() => faylRef.current?.click()}>Fayl tanlash</Tugma>
                <Tugma turi="oddiy" ikonka={<ClipboardPaste size={15} />} disabled={band} onClick={() => setMatnOchiq(v => !v)}>Matnni joylash</Tugma>
              </div>
              <p className="mt-3 text-[11.5px] text-matn-xira">PDF, Word, rasm (kitob, daftar, test sahifasi) yoki Excel · kompyuterda faylni shu yerga tashlash yoki Ctrl+V · {MAKS_SAHIFA} sahifagacha</p>
              <input ref={kameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; fayllarniQosh(f); }} />
              <input ref={faylRef} type="file" multiple accept={`image/*,application/pdf,.pdf,.docx,.doc,${DOCX},.xlsx,.xls`} className="hidden" onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; fayllarniQosh(f); }} />
            </div>

            {matnOchiq && (
              <Maydon nom="Matn" izoh="Word, Telegram yoki saytdan nusxalangan savollar — AI ajratadi">
                <textarea rows={6} autoFocus className={INPUT} value={matn} onChange={e => setMatn(e.target.value)} aria-label="Savollar matni"
                  placeholder="1. Poyezd 3 soatda 180 km yo'l bosdi. Tezligini toping. A) 50 B) 60 C) 70 D) 80" />
              </Maydon>
            )}

            {(sahifalar.length > 0 || excellar.length > 0 || wordlar.length > 0 || jadvallar.length > 0) && (
              <div className="space-y-2">
                {sahifalar.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {sahifalar.map((s, i) => (
                      <div key={s.kalit} className="relative rounded-lg border border-chiziq bg-white overflow-hidden aspect-[3/4]">
                        <img src={s.rasm} alt={`${i + 1}-sahifa`} className="w-full h-full object-contain" />
                        <span className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 text-[11px] font-semibold text-white raqam">{i + 1}</span>
                        <button type="button" aria-label={`${i + 1}-sahifani olib tashlash`} disabled={band} onClick={() => setManbalar(l => l.filter(x => x.kalit !== s.kalit))}
                          className="absolute right-1 top-1 w-6 h-6 rounded-md bg-black/60 text-white flex items-center justify-center cursor-pointer"><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}
                {excellar.map(e => (
                  <div key={e.kalit} className="flex items-center justify-between gap-2 rounded-xl border border-chiziq bg-sirt px-3 py-2 text-[12.5px]">
                    <span className="inline-flex items-center gap-2 min-w-0 text-matn"><FileSpreadsheet size={15} className="text-yaxshi shrink-0" /><span className="truncate">{e.nom}</span>
                      <span className="text-matn-xira shrink-0">· {e.savollar.length} ta savol{e.xatolar ? `, ${e.xatolar} ta xato qator` : ''}</span></span>
                    <button type="button" aria-label="Olib tashlash" onClick={() => setManbalar(l => l.filter(x => x.kalit !== e.kalit))} className="p-1 rounded text-matn-xira hover:text-xato cursor-pointer"><X size={14} /></button>
                  </div>
                ))}
                {jadvallar.map(j => {
                  const chala = j.savollar.filter(q => q.xato).length;
                  return (
                    <div key={j.kalit} className="rounded-xl border border-chiziq bg-sirt px-3 py-2 text-[12.5px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 min-w-0 text-matn"><FileText size={15} className="text-brand shrink-0" />
                          <span className="min-w-0">
                            <span className="block truncate">{j.nom}</span>
                            <span className="block text-[11.5px] text-matn-xira">Word jadvali (Addmen QR) · {j.savollar.length} ta savol{chala ? ` · ${chala} tasi chala (qoralama bo'ladi)` : ''} · AI kerak emas</span>
                          </span>
                        </span>
                        <button type="button" aria-label="Olib tashlash" disabled={band} onClick={() => setManbalar(l => l.filter(x => x.kalit !== j.kalit))} className="p-1 rounded text-matn-xira hover:text-xato cursor-pointer"><X size={14} /></button>
                      </div>
                      {j.oqilmagan > 0 && (
                        <p className="mt-1.5 flex gap-1.5 text-[12px] text-ogoh"><AlertTriangle size={13} className="mt-[2px] shrink-0" />
                          <span>{j.oqilmagan} ta formula yoki rasm eski formatda (MathType, WMF) — shu savollar qoralama bo'ladi. Word'da formulalarni yangi formatga o'tkazib qayta yuklang.</span></p>
                      )}
                    </div>
                  );
                })}
                {wordlar.map(w => (
                  <div key={w.kalit} className="rounded-xl border border-chiziq bg-sirt px-3 py-2 text-[12.5px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 min-w-0 text-matn"><FileText size={15} className="text-brand shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate">{w.nom}</span>
                          <span className="block text-[11.5px] text-matn-xira">Word{w.formulaSoni ? ` · ${w.formulaSoni} ta formula` : ''}{w.rasmSoni ? ` · ${w.rasmSoni} ta rasm` : ''}</span>
                        </span>
                      </span>
                      <button type="button" aria-label="Olib tashlash" disabled={band} onClick={() => setManbalar(l => l.filter(x => x.kalit !== w.kalit))} className="p-1 rounded text-matn-xira hover:text-xato cursor-pointer"><X size={14} /></button>
                    </div>
                    {(w.oqilmagan > 0 || w.tashlangan > 0) && (
                      <p className="mt-1.5 flex gap-1.5 text-[12px] text-ogoh">
                        <AlertTriangle size={13} className="mt-[2px] shrink-0" />
                        <span>
                          {w.oqilmagan > 0 && <>{w.oqilmagan} ta formula yoki rasm eski formatda (MathType, WMF) — ular o'qilmaydi. Muhim bo'lsa, Word'da «Fayl → Saqlash → PDF» qilib, PDF ni yuklang. </>}
                          {w.tashlangan > 0 && <>{w.tashlangan} ta rasm chegaradan oshdi — AI ga bormaydi.</>}
                        </span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {jarayon && (
              <div className="space-y-1.5" role="status">
                <p className="flex items-center gap-2 text-[12.5px] text-matn-sokin"><Loader2 size={14} className="animate-spin" /> {jarayon.matn}{jarayon.jami ? ` — ${jarayon.i} / ${jarayon.jami}` : jarayon.i ? `: ${jarayon.i}` : '…'}</p>
                {jarayon.jami > 0 && <div className="h-1.5 rounded-full bg-ichki overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${Math.round((jarayon.i / jarayon.jami) * 100)}%` }} /></div>}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <button type="button" onClick={shablonniYukla} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-matn-sokin hover:text-brand cursor-pointer w-fit"><Download size={13} /> Excel shablon</button>
                <QrShablonTugma />
              </span>
              <Tugma turi="asosiy" ikonka={<Sparkles size={14} />} yuklanmoqda={!!jarayon} disabled={!aiKerak && !aiSiz}
                onClick={ajrat}>
                {sahifalar.length ? `Savollarni ajratish (${sahifalar.length} sahifa)` : aiSiz && !aiKerak ? `${aiSiz} ta savolni ko'rish` : 'Savollarni ajratish'}
              </Tugma>
            </div>
            <p className="text-[11.5px] text-matn-xira">
              AI har savolni {qatiyMavzu ? <>«<b>{qatiyMavzu}</b>» mavzusiga</> : 'fanning mavzulariga'} va qiyinlikka ajratadi, alohida sahifadagi javoblar kalitini raqam bo'yicha topadi,
              bankda borini belgilaydi va har javobni qayta yechib tekshiradi.
            </p>
          </div>
        ) : (
          <>
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-matn">
                  <b>{sanoq.jami}</b> ta savol
                  {sanoq.togri > 0 && <> · <span className="text-yaxshi font-semibold">{sanoq.togri} tasi javobi tekshirildi</span></>}
                  {sanoq.takror > 0 && <> · <span className="text-ogoh">{sanoq.takror} tasi bankda bor</span></>}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Tanlov kichik qiymat={filtr} onChange={setFiltr} variantlar={[
                    { v: 'hammasi', nom: 'Hammasi' },
                    { v: 'tekshirish', nom: `Tekshirish kerak ${sanoq.tekshirish}` },
                    ...(sanoq.takror ? [{ v: 'takror' as const, nom: `Bankda bor ${sanoq.takror}` }] : []),
                  ]} />
                  <Tugma kichik turi="oddiy" disabled={band} onClick={() => setNatijalar(l => (l || []).map(n => ({ ...n, tanlangan: !n.takrorId })))}>Hammasini tanlash</Tugma>
                  <Tugma kichik turi="oddiy" ikonka={<RotateCcw size={13} />} disabled={band} onClick={() => { setNatijalar(null); setMatnlar([]); setFiltr('hammasi'); }}>Boshqa fayl</Tugma>
                </div>
              </div>
              {jarayon && (
                <div className="space-y-1.5" role="status">
                  <p className="flex items-center gap-2 text-[12.5px] text-matn-sokin"><Loader2 size={14} className="animate-spin" /> {jarayon.matn} — {jarayon.i} / {jarayon.jami}</p>
                  <div className="h-1.5 rounded-full bg-ichki overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${jarayon.jami ? Math.round((jarayon.i / jarayon.jami) * 100) : 0}%` }} /></div>
                </div>
              )}
              {!korinadi.length && <p className="text-[12.5px] text-matn-xira py-6 text-center">Bu ro'yxatda savol yo'q</p>}
              {guruhlar.map(([nom, royxat]) => (
                <section key={nom} aria-label={nom} className="space-y-2">
                  <h4 className="flex flex-wrap items-center gap-2 pt-2 text-[13px] font-bold text-matn">
                    {nom}<span className="raqam font-semibold text-matn-xira">{royxat.length}</span>
                    {yangiMavzuBelgisi(nom) && <Yorliq rang="brand">yangi mavzu</Yorliq>}
                  </h4>
                  {royxat.map(n => (
                    <div key={n.kalit} className={`rounded-xl border p-3 transition-colors ${n.tanlangan ? 'border-brand/40 bg-sirt' : 'border-chiziq bg-ichki/60'}`}>
                      <div className="flex items-start gap-2.5">
                        <input type="checkbox" aria-label={`${n.raqam ? `${n.raqam}-` : ''}savolni tanlash`} className="mt-1 w-4 h-4 shrink-0 accent-[var(--color-brand)] cursor-pointer"
                          checked={n.tanlangan} disabled={tahrirda === n.kalit} onChange={e => ozgartir(n.kalit, { tanlangan: e.target.checked })} />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {n.raqam && <b className="text-[12px] text-matn-xira raqam">№{n.raqam}</b>}
                            <Belgilar n={n} />
                            {n.matnId && <Yorliq rang="brand"><FileText size={11} /> {matnlar.find(m => m.id === n.matnId)?.sarlavha || 'Umumiy matn'}</Yorliq>}
                          </div>
                          {tahrirda === n.kalit
                            ? <Tahrir q={n} onBekor={() => setTahrirda(null)} onSaqla={q => { ozgartir(n.kalit, { ...q, tahrirlandi: true, tanlangan: true, xato: null }); setTahrirda(null); }} />
                            : <Korinish q={n} onJavob={band ? undefined : j => ozgartir(n.kalit, { correctAnswer: j, tahrirlandi: true, tanlangan: true })} />}
                          {tahrirda !== n.kalit && n.type !== 'yozma' && !n.correctAnswer && n.tekshiruv?.aiJavobi && (
                            <Tugma kichik onClick={() => ozgartir(n.kalit, { correctAnswer: n.tekshiruv!.aiJavobi, tahrirlandi: true, tanlangan: true })}>AI javobini qo'yish: {n.tekshiruv.aiJavobi}</Tugma>
                          )}
                          {tahrirda !== n.kalit && (
                            <div className="flex flex-wrap items-center gap-2">
                              <QiyinlikTanlov kichik qiymat={n.difficulty} onChange={d => ozgartir(n.kalit, { difficulty: d })} />
                              {n.subject === fan?.name && (
                                <select aria-label="Mavzu" className={KICHIK_SELECT} value={n.topic} disabled={band}
                                  onChange={e => ozgartir(n.kalit, { topic: e.target.value })}>
                                  {mavzuVariantlari.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                              )}
                            </div>
                          )}
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
                </section>
              ))}
            </div>
            <div className="sticky bottom-0 z-10 bg-sirt rounded-b-2xl border-t border-chiziq px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-[12px] text-matn-sokin">
                {tanlanganlar.length
                  ? <>Tanlandi: <b className="text-matn">{tanlanganlar.length}</b> · faol {faolSoni}{tanlanganlar.length - faolSoni ? ` · qoralama ${tanlanganlar.length - faolSoni}` : ''}</>
                  : 'Savollarni belgilang'}
                {sanoq.tekshirilmoqda > 0 && <span className="block text-[11px] text-matn-xira">Tekshiruv tugagach — tasdiqlanganlari faol bo'ladi</span>}
              </p>
              <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} disabled={!tanlanganlar.length || !!jarayon || tahrirda !== null} onClick={saqla}>
                {tanlanganlar.length ? `${tanlanganlar.length} ta savolni bankka qo'shish` : "Bankka qo'shish"}
              </Tugma>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
