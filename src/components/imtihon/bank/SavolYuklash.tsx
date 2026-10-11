import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Sparkles, Camera, FileUp, Trash2, Pencil, Loader2, FileText, RotateCcw } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { useAiHolat } from '../useAiHolat';
import AiKalitKartasi from '../AiKalitKartasi';
import { Tugma, Tanlov, SELECT, Yorliq, Maydon } from '../ui';
import { savolXatosi } from '../../../../lib/imtihon.js';
import { DarajaTanlov, darajaMaydonlari } from './qiyinlik';
import { useDarajalar } from './useDarajalar';
import { fanniTop, mavzuniTop } from './useBankDaraxt';
import { type Tekshiruv, sahifaRasmlari, mazmuniBor, xatoMatni, Korinish, Tahrir, yechimSora, YECHISH_BOLAGI } from './aiUmumiy';
import { exceldanSavollar } from './excel';
import QrShablonTugma from './QrShablonTugma';
import QoshRejimi, { type QoshRejim } from './QoshRejimi';
import { AiGuruhKarta, guruhlarniSaqla, guruhFaolmi, mavzuniTopYokiYarat, type AiGuruh } from './AiGuruhKarta';
import { wordniOqi, ESKI_DOC } from './word';
import { wordShablonSavollari } from './wordShablon';
import { FAYL_TURLARI, faylTuriNomi, guruhTurimi, NOMALUM_MAVZU, type FaylTuri } from './faylTuri';
import {
  type Manba, type Natija, type AiMatn, type MavzuRejimi, DOCX, PARTIYA, MAKS_SAHIFA, TEKSHIRUV_BOLAGI, MAVZULASH_BOLAGI, KICHIK_SELECT,
  toplamNomi, bolaklar, javobQatori, shablonYechimi, kalitniUla, jadvalSoni, savolIzi, Belgilar, ManbalarRoyxati,
} from './yuklashQismlari';
import { useRasmNavbati, RasmJarayoni, SavolRasmi, rasmIshi, rasmNatijasiniQoy, rasmKerakmi, rasmYetishmaydi, ichkiRasm } from './rasmNavbati';
import { rasmBelgisiBor, type RasmIshi, type RasmNatijasi } from '../../../lib/svgRasm';
import { compressAndUpload } from '../../../lib/image';
import type { BankDaraxt, BankFiltrMalumoti } from '../../../types';

// Savol qo'shish → «Fayldan»: bankka savol kiritishning asosiy yo'li (egasi, 2026-09-29:
// "qo'lda savol kiritish — eng eski usul; fayldan yoki kameradan bo'lsin"; 2026-10-10: "savollarni
// qo'lda qo'shmaymiz, fayldan qo'shamiz, faqat fayl turi har doim bo'lsin: 4 variantli, MS-33-35,
// MS-36-45, yozma"). Xodim fanni, FAYL TURINI va mavzuni kim ajratishini (AI yoki «Noma'lum» —
// keyin bankda o'zi taqsimlaydi) tanlaydi. Manba: kamera (ketma-ket sahifalar), PDF, rasm, Word
// yoki Excel. To'ldirilgan Word shablon AI siz o'qiladi; qolganini AI o'qiydi: mavzu va
// qiyinlikka ajratadi, boshqa sahifadagi javoblar kalitini raqam bo'yicha ulaydi, bankda borini
// belgilaydi, har javobni kalitni ko'rmay qayta yechib tekshiradi; yozma masalalarni yechib,
// batafsil yechim yozadi. AI hech narsani o'zi faol qilmaydi: tekshirilgani (yoki ustoz tuzatgani)
// — faol, qolgani — qoralama; AI o'qigan guruhli va yozma savollar — doim qoralama.

let keyingi = 1;

/**
 * Savol chizmasining manbai — o'zi o'qilgan AI so'rovining rasmlari: sahifa suratlari (3 tagacha) yoki,
 * Word'dan o'qilganda, matndagi «[rasm N]» raqami bo'yicha aynan o'sha rasm.
 */
function aslRasmlar(matn: string, partiya: number | undefined, rasmlar: string[][]): string[] {
  const hammasi = partiya == null ? [] : rasmlar[partiya] || [];
  const raqamli = [...matn.matchAll(/\[rasm\s*(\d+)\]/gi)].map(m => hammasi[Number(m[1]) - 1]).filter(Boolean);
  return (raqamli.length ? raqamli : hammasi).slice(0, 3);
}

/** Saqlash natijasi — Zukko faol savollarni imtihonga qo'shishi uchun. */
export interface SaqlashNatijasi { soni: number; ids: number[]; faolIds: number[] }

export default function SavolYuklash({ daraxt, fanId: boshFan = null, mavzuId: boshMavzu = null, mavzuNomi: boshMavzuNomi, onRejim, onYop, onSaqlandi, boshFayllar, avto = false, yuqorida = false }: {
  daraxt: BankDaraxt; fanId?: number | null;
  /**
   * Oldindan berilgan mavzu — faqat Zukko dan (xodim o'zi aytgan mavzu). Bank oynasi bermaydi: u yerda
   * mavzuni AI ajratadi yoki savollar «Noma'lum» ga tushadi (egasi: "mavzu nomi turmasin").
   */
  mavzuId?: number | null;
  /** `mavzuId` ning nomi — mavzu hozirgina yaratilgan bo'lib, daraxtda hali ko'rinmasa ham savollar o'shanga tushsin. */
  mavzuNomi?: string;
  /** Berilsa — sarlavhada «Fayldan | AI tuzadi» almashtirgichi chiqadi. */
  onRejim?: (rejim: QoshRejim) => void;
  onYop: () => void; onSaqlandi: (natija?: SaqlashNatijasi) => void;
  /** Zukko dan: biriktirilgan fayllar; avto — yuklangach ajratish o'zi boshlanadi; yuqorida — Zukko panelining ustida. */
  boshFayllar?: File[]; avto?: boolean; yuqorida?: boolean;
}) {
  const { showNotification } = useCRM();
  const { soro, filial } = useImtihonApi();
  const ai = useAiHolat();
  const aiBor = !!ai?.yoqilgan;
  useDarajalar();
  // Savol chizmalarini AI vektor qilib chizadi — navbat bilan (bir vaqtda 2 ta), to'xtatsa bo'ladi.
  const rasmNavbati = useRasmNavbati();

  const [fanId, setFanId] = useState<number | null>(() => boshFan ?? daraxt.fanlar.find(f => f.mavzular.some(m => m.id === boshMavzu))?.id ?? (daraxt.fanlar.length === 1 ? daraxt.fanlar[0].id : null));
  const ilkFan = useRef(fanId);
  const fan = fanniTop(daraxt, fanId);
  // Fayl turi har doim tanlanadi: AI ko'rsatmasi, Word jadvalini o'qish va shablon shunga qarab.
  const [tur, setTur] = useState<FaylTuri>('yopiq');
  // Berilgan mavzu (Zukko): daraxtdagi nomi; hozirgina yaratilgan bo'lsa — kelgan nomi.
  const berilgan = boshMavzu != null ? mavzuniTop(fan, boshMavzu)?.name || (fanId === ilkFan.current ? boshMavzuNomi || '' : '') : '';
  const [mavzuRejimi, setMavzuRejimi] = useState<MavzuRejimi>(boshMavzu != null ? 'qatiy' : 'ai');
  // Amaldagi rejim: berilgan mavzu shu fanda bo'lmasa — AI; AI ulanmagan bo'lsa — «Noma'lum».
  const rejim: MavzuRejimi = mavzuRejimi === 'qatiy' && !berilgan ? 'ai' : mavzuRejimi === 'ai' && ai && !aiBor ? 'nomalum' : mavzuRejimi;
  /** Hamma savolga qo'yiladigan mavzu ('' — AI har savolga o'zi topadi). */
  const qatiyMavzu = rejim === 'qatiy' ? berilgan : rejim === 'nomalum' ? NOMALUM_MAVZU : '';

  const [manbalar, setManbalar] = useState<Manba[]>([]);
  const [ustida, setUstida] = useState(false);
  const kameraRef = useRef<HTMLInputElement>(null);
  const faylRef = useRef<HTMLInputElement>(null);

  const [jarayon, setJarayon] = useState<{ matn: string; i: number; jami: number } | null>(null);
  const [natijalar, setNatijalar] = useState<Natija[] | null>(null);
  const [matnlar, setMatnlar] = useState<AiMatn[]>([]);
  // Guruhli savollar (MS-33-35, MS-36-45) — alohida ro'yxat: bankka guruh bo'lib tushadi.
  const [aiGuruhlar, setAiGuruhlar] = useState<AiGuruh[]>([]);
  // Har AI so'rovining sahifalari — yozma masalani (qayta) yechishda chizma shu yerdan ko'rinadi.
  const [partiyaRasmlari, setPartiyaRasmlari] = useState<string[][]>([]);
  const [filtr, setFiltr] = useState<'hammasi' | 'tekshirish' | 'takror'>('hammasi');
  const [tahrirda, setTahrirda] = useState<number | null>(null);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const band = !!jarayon || saqlanmoqda;

  const sahifalar = manbalar.filter((m): m is Extract<Manba, { tur: 'sahifa' }> => m.tur === 'sahifa');
  const excellar = manbalar.filter((m): m is Extract<Manba, { tur: 'excel' }> => m.tur === 'excel');
  const wordlar = manbalar.filter((m): m is Extract<Manba, { tur: 'word' }> => m.tur === 'word');
  const jadvallar = manbalar.filter((m): m is Extract<Manba, { tur: 'jadval' }> => m.tur === 'jadval');
  const aiSiz = excellar.reduce((a, e) => a + e.savollar.length, 0) + jadvallar.reduce((a, j) => a + jadvalSoni(j.shablon), 0);
  const aiKerak = sahifalar.length > 0 || wordlar.length > 0;
  // AI siz o'qilgan fayllar shu turga bog'langan — tur faqat ular olib tashlangach almashadi.
  const turQulf = excellar.length > 0 || jadvallar.length > 0;
  const turMalumoti = FAYL_TURLARI.find(t => t.v === tur)!;

  /** Fan mavzusining aniq nomi (katta-kichik harfsiz mos kelsa) — bo'lmasa AI bergan yangi nom; bo'sh — «Noma'lum». */
  const mavzuNomi = (nom: string | null | undefined) => {
    const t = String(nom || '').trim();
    if (!t) return NOMALUM_MAVZU;
    return fan?.mavzular.find(m => m.name.toLowerCase() === t.toLowerCase())?.name || t;
  };

  const fayllarniQosh = async (fayllar: File[]) => {
    // Bir nechta fayl ketma-ket: tur va manbalar soni shu sikl ichida ham o'zgaradi.
    let joriyTur = tur;
    let bor = manbalar.length;
    let sahifaSoni = sahifalar.length;
    for (const f of fayllar) {
      try {
        if (/\.xlsx?$/i.test(f.name)) {
          if (guruhTurimi(joriyTur)) { showNotification(`${f.name}: «${faylTuriNomi(joriyTur)}» turi Excel dan o'qilmaydi — Word shablonini to'ldiring yoki rasm/PDF yuklang`, 'error'); continue; }
          const r = await exceldanSavollar(f, { fan: fan?.name, mavzu: rejim === 'qatiy' ? berilgan : NOMALUM_MAVZU, yozma: joriyTur === 'yozma' });
          if (!r.yaroqli.length) { showNotification(r.xatolar.length ? `${f.name}: ${r.xatolar.length} ta qatorda xato (${r.xatolar[0].qator}-qator: ${r.xatolar[0].xato})` : `${f.name}: savol topilmadi`, 'error'); continue; }
          setManbalar(l => [...l, { kalit: keyingi++, tur: 'excel', nom: f.name, savollar: r.yaroqli, xatolar: r.xatolar.length }]);
          bor++;
          if (r.xatolar.length) showNotification(`${f.name}: ${r.xatolar.length} ta qator o'tkazib yuborildi (${r.xatolar[0].qator}-qator: ${r.xatolar[0].xato})`, 'info');
        } else if (/\.docx$/i.test(f.name) || f.type === DOCX) {
          setJarayon({ matn: "Word hujjati o'qilmoqda", i: 0, jami: 0 });
          // Avval Word shablon jadvali: bo'lsa — AI siz, rasmlar saqlanadi. Turi jadvalning o'zidan taniladi.
          const j = await wordShablonSavollari(f, (d, nom) => compressAndUpload(d, nom, 1400, 1400, 0.85), joriyTur);
          if (j) {
            if (j.tur !== joriyTur) {
              if (bor > 0) { showNotification(`${f.name}: bu «${faylTuriNomi(j.tur)}» shabloni, fayl turi esa «${faylTuriNomi(joriyTur)}» — uni alohida yuklang`, 'error'); continue; }
              joriyTur = j.tur;
              setTur(j.tur);
              showNotification(`${f.name}: «${faylTuriNomi(j.tur)}» shabloni ekan — fayl turi shunga o'zgartirildi`, 'info');
            }
            setManbalar(l => [...l, { kalit: keyingi++, tur: 'jadval', nom: f.name, shablon: j }]);
            bor++;
            continue;
          }
          const w = await wordniOqi(f);
          setManbalar(l => [...l, { kalit: keyingi++, tur: 'word', nom: f.name, ...w }]);
          bor++;
        } else if (/\.doc$/i.test(f.name) || f.type === 'application/msword') {
          showNotification(`${f.name}: ${ESKI_DOC}`, 'error');
        } else if (/^image\//.test(f.type) || /\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name) || f.type === 'application/pdf') {
          const qoldi = MAKS_SAHIFA - sahifaSoni;
          if (qoldi <= 0) { showNotification(`Bir martada ${MAKS_SAHIFA} sahifagacha`, 'error'); break; }
          setJarayon({ matn: 'Sahifalar tayyorlanmoqda', i: 0, jami: 0 });
          const rasmlar = await sahifaRasmlari(f, qoldi, n => setJarayon({ matn: 'Sahifalar tayyorlanmoqda', i: n, jami: 0 }));
          setManbalar(l => [...l, ...rasmlar.map((rasm, i) => ({ kalit: keyingi++, tur: 'sahifa' as const, nom: rasmlar.length > 1 ? `${f.name} · ${i + 1}` : f.name, rasm }))]);
          bor += rasmlar.length;
          sahifaSoni += rasmlar.length;
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
    // Zukko faylni o'zi yuboradi — turini xodim hali tanlamagan: AI materialdagi hamma turni o'zi ajratadi.
    ajrat(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avtoKutadi, jarayon, ai]);

  // Kompyuterda: nusxalangan rasm (Ctrl+V).
  useEffect(() => {
    if (natijalar) return;
    const f = (e: ClipboardEvent) => {
      const rasmlar = Array.from(e.clipboardData?.files || []).filter(x => x.type.startsWith('image/'));
      // Ish ketayotganda (o'qish, ajratish) yangi fayl qabul qilinmaydi — band belgisi chalkashmasin.
      if (rasmlar.length && !band) { e.preventDefault(); fayllarniQosh(rasmlar); }
    };
    window.addEventListener('paste', f);
    return () => window.removeEventListener('paste', f);
  });

  /**
   * Yozma masalalarni AI yechadi (batafsil yechim): har so'rovda YECHISH_BOLAGI ta, ikki so'rov yonma-yon.
   * Chizmali masala («[rasm]») o'zi olingan sahifalar bilan birga yuboriladi.
   */
  const yozmalarniYech = async (royxat: Natija[], rasmlar: string[][]) => {
    const guruhlar = new Map<number, Natija[]>();
    for (const q of royxat) guruhlar.set(q.partiya ?? -1, [...(guruhlar.get(q.partiya ?? -1) || []), q]);
    const navbat = [...guruhlar.entries()].flatMap(([p, l]) => bolaklar(l, YECHISH_BOLAGI).map(b => ({ b, rasmlar: b.some(q => /\[rasm/.test(q.aslMatn ?? q.text)) ? rasmlar[p] || [] : [] })));
    const kalitlar = new Set(royxat.map(q => q.kalit));
    setNatijalar(l => (l || []).map(q => (kalitlar.has(q.kalit) ? { ...q, yechilmoqda: true, yechilmadi: false } : q)));
    let tugadi = 0;
    setJarayon({ matn: 'AI yozma masalalarni yechmoqda (batafsil yechim)', i: 0, jami: royxat.length });
    const ishchi = async () => {
      for (let ish = navbat.shift(); ish; ish = navbat.shift()) {
        const { b, rasmlar: r } = ish;
        let yechimlar: { yechim: string; javob: string }[] = b.map(() => ({ yechim: '', javob: '' }));
        try { yechimlar = await yechimSora(soro, b, b[0].subject, r); } catch { /* yechilmadi — kartada «AI bilan yechish» tugmasi qoladi */ }
        const map = new Map(b.map((q, j) => [q.kalit, yechimlar[j]?.yechim || '']));
        setNatijalar(l => (l || []).map((q) => {
          if (!map.has(q.kalit)) return q;
          const y = map.get(q.kalit);
          return y ? { ...q, solution: y, yechimManbasi: 'ai' as const, yechilmoqda: false, yechilmadi: false } : { ...q, yechilmoqda: false, yechilmadi: true };
        }));
        tugadi += b.length;
        setJarayon({ matn: 'AI yozma masalalarni yechmoqda (batafsil yechim)', i: tugadi, jami: royxat.length });
      }
    };
    await Promise.all([ishchi(), ishchi()]);
  };

  /** `aralash` — fayl turi tanlanmagan (Zukko o'zi boshlagan): AI materialdagi hamma turdagi savolni oladi. */
  const ajrat = async (aralash = false) => {
    if (!aiKerak && !aiSiz) return showNotification("Rasm yoki fayl qo'shing", 'error');
    if ((aiKerak || jadvallar.length) && !fan) return showNotification('Fanni tanlang', 'error');
    if (aiKerak && !aiBor) return showNotification("Rasm, PDF va Word ni o'qish uchun avval AI ni ulang (yuqorida)", 'error');
    const yig: Natija[] = [];
    const matnYig: AiMatn[] = [];
    const kalitYig: { raqam: string; javob: string }[] = [];
    const guruhYig: AiGuruh[] = [];
    const xatolar: string[] = [];
    let partiyalar: { rasmlar: string[]; matn: string }[] = [];
    // Chizmasi bor savollar (AI matnda «[rasm]» qoldirgan) — ajratish tugagach navbat bilan chiziladi.
    let rasmIshlari: RasmIshi<number>[] = [];
    try {
      for (const e of excellar) {
        for (const q of e.savollar) {
          // «Yozma» turidagi fayl: yakuniy javob («Javob» ustuni) yechimdan alohida — yechim bo'lmasa AI yechadi.
          const javob = q.ustozJavobi || '';
          yig.push({
            // Mavzu ustuni bo'sh qator — oynadagi tanlov bo'yicha (fayl yuklangandan keyin o'zgargan bo'lishi mumkin).
            // Fan ustuni bo'sh qator ham shunday — oynada hozir tanlangan fanga.
            kalit: keyingi++, manba: 'excel', excel: q, tanlangan: true, subject: q.fansiz && fan ? fan.name : q.subject, topic: q.mavzusiz ? qatiyMavzu || NOMALUM_MAVZU : q.topic,
            type: q.type, text: q.text, options: q.options, difficulty: q.difficulty, language: q.language, toplam: toplamNomi(e.nom),
            correctAnswer: q.correctAnswer, ustozJavobi: javob || undefined,
            solution: q.solution && javob && !/javob\s*:/i.test(q.solution) ? `${q.solution}\n\n${javobQatori(javob)}` : q.solution,
            solutionStatus: q.solutionStatus, yechimManbasi: q.type === 'yozma' && q.solution ? 'ustoz' : null,
          });
        }
      }
      // Word shablon: shu nomli to'plam bankda bo'lsa — qayta qo'shilmasin (belgilanmaydi).
      let bankdagi: BankFiltrMalumoti['toplamlar'] = [];
      if (jadvallar.length && fan) {
        try { bankdagi = (await soro<BankFiltrMalumoti>('GET', `bank/filtr?fanId=${fan.id}`)).toplamlar; } catch { /* tekshiruvsiz davom etadi */ }
      }
      for (const j of jadvallar) {
        const toplam = toplamNomi(j.nom);
        const bor = bankdagi.find(t => t.nom === toplam);
        if (bor) showNotification(`«${toplam}» to'plami bankda bor (${bor.soni} ta savol) — savollar belgilanmadi, qayta qo'shilsa takrorlanadi`, 'info');
        const umumiy = { manba: 'jadval' as const, tanlangan: !bor, subject: fan!.name, topic: qatiyMavzu || NOMALUM_MAVZU, difficulty: 2, language: 'uz', toplam };
        for (const q of j.shablon.savollar) {
          yig.push({
            ...umumiy, kalit: keyingi++, raqam: q.raqam, type: 'yopiq', text: q.text, options: q.options, correctAnswer: q.correctAnswer,
            solution: null, solutionStatus: 'yoq', xato: q.xato, tarjima: q.tarjima || null,
          });
        }
        for (const y of j.shablon.yozmalar) {
          yig.push({
            ...umumiy, kalit: keyingi++, raqam: y.raqam, type: 'yozma', text: y.text, options: null,
            // Ustozning yakuniy javobi AI ga ham beriladi: yechim shu javobga olib kelishi kerak.
            correctAnswer: '', ustozJavobi: y.javob,
            solution: shablonYechimi(y), yechimManbasi: y.yechim ? 'ustoz' : null, xato: y.xato,
          });
        }
        for (const g of j.shablon.guruhlar) {
          guruhYig.push({
            tur: g.tur, text: g.text, variantlar: g.variantlar, savollar: g.savollar, topic: qatiyMavzu || NOMALUM_MAVZU, difficulty: 2, raqam: g.raqam,
            javobManbasi: g.savollar.every(s => s.javob) ? 'material' : 'yoq', xato: g.xato, chala: g.chala, manba: 'shablon', toplam,
            kalit: keyingi++, tanlangan: !g.xato && !bor,
          });
        }
      }
      // «AI ajratsin»: AI siz o'qilgan savollar (Word shablon; Excel ning mavzusiz qatorlari) ham mavzularga
      // ajratiladi — mos mavzu bo'lmasa AI yangi nom taklif qiladi. Javob bermasa — «Noma'lum» da qoladi.
      const mavzusiz = rejim !== 'ai' ? [] : [
        ...yig.filter(q => q.manba === 'jadval' || q.excel?.mavzusiz).map(q => ({ kalit: q.kalit, matn: q.text })),
        ...guruhYig.map(g => ({ kalit: g.kalit, matn: `${g.text} ${g.savollar[0]?.text || ''}` })),
      ];
      if (mavzusiz.length && fan && aiBor) {
        const nomlar = fan.mavzular.map(m => m.name).filter(n => n !== NOMALUM_MAVZU);
        const mavzular = new Map<number, string>();
        for (let i = 0; i < mavzusiz.length; i += MAVZULASH_BOLAGI) {
          setJarayon({ matn: 'AI savollarni mavzularga ajratmoqda', i, jami: mavzusiz.length });
          const bolak = mavzusiz.slice(i, i + MAVZULASH_BOLAGI);
          try {
            const r = await soro<{ mavzular: string[] }>('POST', 'questions/ai/mavzula', { fan: fan.name, mavzular: nomlar, savollar: bolak.map(q => q.matn) });
            bolak.forEach((q, k) => {
              const taklif = String(r.mavzular?.[k] || '').trim();
              if (!taklif) return;
              const nom = nomlar.find(x => x.toLowerCase() === taklif.toLowerCase()) || taklif;
              if (!nomlar.includes(nom)) nomlar.push(nom);
              mavzular.set(q.kalit, nom);
            });
          } catch (e: any) {
            xatolar.push(`mavzularga ajratish: ${xatoMatni(e)}`);
            break;
          }
        }
        for (let i = 0; i < yig.length; i++) if (mavzular.has(yig[i].kalit)) yig[i] = { ...yig[i], topic: mavzular.get(yig[i].kalit)! };
        for (let i = 0; i < guruhYig.length; i++) if (mavzular.has(guruhYig[i].kalit)) guruhYig[i] = { ...guruhYig[i], topic: mavzular.get(guruhYig[i].kalit)! };
      }
      if (aiKerak && fan) {
        // So'rovlar: sahifa suratlari 3 tadan, Word — o'qilganda bo'lingan qismlar.
        partiyalar = [
          ...bolaklar(sahifalar.map(s => s.rasm), PARTIYA).map(rasmlar => ({ rasmlar, matn: '' })),
          ...wordlar.flatMap(w => w.qismlar),
        ];
        for (let i = 0; i < partiyalar.length; i++) {
          const topildi = yig.length + guruhYig.length;
          setJarayon({ matn: `AI o'qimoqda${topildi ? ` · ${topildi} ta savol` : ''}`, i, jami: partiyalar.length });
          try {
            const r = await soro<{ savollar: any[]; guruhlar?: Omit<AiGuruh, 'kalit' | 'tanlangan'>[]; matnlar: AiMatn[]; kalit: { raqam: string; javob: string }[] }>('POST', 'questions/ai/import', {
              fan: fan.name, tur: aralash ? '' : tur, til: 'auto', rasmlar: partiyalar[i].rasmlar, matn: partiyalar[i].matn,
              // Mavzu: berilgan (Zukko), AI ajratadi (fanning mavzulari bilan) yoki umuman ajratilmaydi («Noma'lum»).
              mavzu: rejim === 'qatiy' ? berilgan : '', mavzula: rejim === 'ai',
              mavzular: rejim === 'ai' ? fan.mavzular.map(m => m.name).filter(n => n !== NOMALUM_MAVZU) : [],
            });
            matnYig.push(...(r.matnlar || []).map(m => ({ ...m, id: `p${i}-${m.id}` })));
            kalitYig.push(...(r.kalit || []));
            for (const g of r.guruhlar || []) guruhYig.push({ ...g, manba: 'ai', kalit: keyingi++, tanlangan: !g.xato, topic: qatiyMavzu || mavzuNomi(g.topic), partiya: i });
            for (const q of r.savollar || []) {
              yig.push({
                ...q, kalit: keyingi++, manba: 'ai', tanlangan: false, subject: fan.name, partiya: i,
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
        const iz = savolIzi(q);
        if (!iz) return false;
        if (korilgan.has(iz)) { ichki++; return false; }
        korilgan.add(iz);
        return true;
      }).map(q => (q.manba === 'ai' ? { ...q, tanlangan: !q.takrorId && mazmuniBor(q.text) } : q));
      if (!royxat.length && !guruhYig.length) {
        showNotification(xatolar.length ? `O'qib bo'lmadi: ${xatolar[0]}`
          : aralash ? 'Savol topilmadi — aniqroq surat oling yoki boshqa fayl tanlang'
          : `«${turMalumoti.nom}» turidagi savol topilmadi — fayl turi to'g'ri tanlanganini tekshiring yoki aniqroq surat oling`, 'error');
        return;
      }
      setAiGuruhlar(guruhYig);
      setPartiyaRasmlari(partiyalar.map(p => p.rasmlar));
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
      // Yozma masalalar: faylda o'z yechimi bo'lmasa — AI yechadi (o'zi qisqa yozib qo'ygani ham batafsiliga almashadi).
      const yechiladi = holatlar.filter(q => q.type === 'yozma' && !q.takrorId && mazmuniBor(q.text) && (!q.solution || (q.manba === 'ai' && q.yechimManbasi !== 'material')));
      if (yechiladi.length && aiBor) await yozmalarniYech(yechiladi, partiyalar.map(p => p.rasmlar));
      // Chizmalar: AI o'qigan, matnida «[rasm]» qolgan savollar va guruh shartlari (bankda bori — yo'q).
      const manbaRasmlari = partiyalar.map(p => p.rasmlar);
      if (aiBor) {
        rasmIshlari = [
          ...holatlar.filter(q => q.manba === 'ai' && !q.takrorId && rasmBelgisiBor(q.text)).map(q => rasmIshi(q.kalit, q, savolRasmSorovi(q, manbaRasmlari))),
          ...guruhYig.filter(g => g.manba === 'ai' && !g.xato && rasmBelgisiBor(g.text)).map(g => rasmIshi(g.kalit, g, guruhRasmSorovi(g, manbaRasmlari))),
        ];
      }
    } finally {
      setJarayon(null);
    }
    // Chizish — alohida, to'xtatsa bo'ladigan bosqich: ro'yxat allaqachon ko'rinib turadi.
    if (rasmIshlari.length) await rasmlarniChizdir(rasmIshlari);
  };

  /** Savol chizmasi so'rovi: variantlar va javob (nisbatlar uchun), manba — o'zi o'qilgan sahifa(lar) yoki ichki rasmi. */
  const savolRasmSorovi = (n: Natija, rasmlar: string[][]) => ({
    variantlar: n.options, javob: n.type === 'yozma' ? null : n.correctAnswer, fan: n.subject, raqam: n.raqam,
    aslRasm: n.manba === 'jadval' ? [ichkiRasm(n.aslMatn ?? n.text)].filter((x): x is string => !!x) : aslRasmlar(n.aslMatn ?? n.text, n.partiya, rasmlar),
  });
  const guruhRasmSorovi = (g: AiGuruh, rasmlar: string[][]) => ({ fan: fan?.name, raqam: g.raqam, aslRasm: aslRasmlar(g.aslMatn ?? g.text, g.partiya, rasmlar) });

  /** Navbatdan kelgan chizma savolga yoki guruh shartiga qo'yiladi (kalitlar umumiy sanoqdan — takrorlanmaydi). */
  const rasmKeldi = (kalit: number, n: RasmNatijasi) => {
    setNatijalar(l => l && l.map(q => (q.kalit === kalit ? rasmNatijasiniQoy(q, n) : q)));
    setAiGuruhlar(l => l.map(g => (g.kalit === kalit ? rasmNatijasiniQoy(g, n) : g)));
  };
  const rasmlarniChizdir = async (ishlar: RasmIshi<number>[]) => {
    const kalitlar = new Set(ishlar.map(i => i.kalit));
    setNatijalar(l => l && l.map(q => (kalitlar.has(q.kalit) ? { ...q, rasm: { band: true } } : q)));
    setAiGuruhlar(l => l.map(g => (kalitlar.has(g.kalit) ? { ...g, rasm: { band: true } } : g)));
    const h = await rasmNavbati.chiz(ishlar, rasmKeldi);
    // Chizilmagani saqlashga to'sqinlik qilmaydi: belgi matnda qoladi, savol qoralama bo'lib tushadi.
    if (h.chizilmadi) showNotification(`${h.chizildi} ta rasm chizildi, ${h.chizilmadi} tasi chizilmadi: ${h.xato}. Kartadagi «Vektor qilib chizish» bilan qayta urinasiz`, 'error');
    else if (h.chizildi) showNotification(`${h.chizildi} ta rasm chizildi — ko'zdan kechiring`, 'success');
  };

  const ozgartir = (kalit: number, d: Partial<Natija>) => setNatijalar(l => (l || []).map(n => (n.kalit === kalit ? { ...n, ...d } : n)));

  /** Bitta yozma masalani (qayta) yechtirish — kartadagi tugma. */
  const birniYech = async (n: Natija) => {
    try {
      await yozmalarniYech([n], partiyaRasmlari);
    } finally {
      setJarayon(null);
    }
  };

  // Holat: AI tasdiqlagan yoki ustoz tuzatgan — faol; Excel — faylidagi holat; Word shablon — to'liq
  // bo'lsa faol (markazning o'z savoli); qolgani qoralama. Yozma masalada tekshiradigan kalit yo'q:
  // AI o'qigani ustoz tuzatmaguncha qoralama (AI yozgan yechim esa doim qoralama yechim bo'lib tushadi).
  const holatiQanday = (n: Natija): string => {
    if (n.manba === 'excel' && !n.tahrirlandi) return n.excel?.status || 'faol';
    // Chizmasi kerak, lekin yo'q («[rasm]» belgisi matnda qolgan) — kitobchaga shu holicha chiqmasin.
    if (rasmYetishmaydi(n)) return 'qoralama';
    if (n.manba === 'jadval' && !n.tahrirlandi) return !n.xato && !savolXatosi(n as any) ? 'faol' : 'qoralama';
    const ishonchli = n.tahrirlandi || (n.type !== 'yozma' && n.tekshiruv?.tekshirildi === true);
    return ishonchli && !savolXatosi(n as any) ? 'faol' : 'qoralama';
  };
  /** Yechim holati: ustozning o'z yechimi — tasdiqlangan; AI yozgani yoki ko'chirgani — qoralama. */
  const yechimHolati = (n: Natija): string => {
    if (!n.solution) return 'yoq';
    if (n.yechimManbasi === 'ustoz') return 'tasdiqlangan';
    if (n.manba === 'excel' && n.yechimManbasi !== 'ai') return n.excel?.solutionStatus || 'qoralama';
    return 'qoralama';
  };

  const tanlanganlar = (natijalar || []).filter(n => n.tanlangan);
  const faolSoni = tanlanganlar.filter(n => holatiQanday(n) === 'faol').length;
  const tanlanganGuruhlar = aiGuruhlar.filter(g => g.tanlangan && !g.xato);
  const faolGuruhlar = tanlanganGuruhlar.filter(guruhFaolmi).length;

  const saqla = async () => {
    if (!tanlanganlar.length && !tanlanganGuruhlar.length) return;
    setSaqlanmoqda(true);
    try {
      const matnIdlari = new Map<string, number>();
      for (const m of matnlar.filter(m => tanlanganlar.some(q => q.matnId === m.id))) {
        const p = await soro<{ id: number }>('POST', 'passages', { subject: fan?.name || tanlanganlar[0].subject, title: m.sarlavha || null, text: m.matn, schoolId: filial });
        matnIdlari.set(m.id, p.id);
      }
      const questions = tanlanganlar.map((n, i) => {
        const bank = n.subject === fan?.name ? fan?.mavzular.find(m => m.name === n.topic) : undefined;
        // Zukko bergan mavzu daraxtda hali ko'rinmasa ham — savollar o'shanga tushadi.
        const berilganId = !bank && berilgan && n.subject === fan?.name && n.topic === berilgan ? boshMavzu : null;
        const asos = n.manba === 'excel' && n.excel ? (({ qator, mavzusiz, fansiz, ustozJavobi, ...e }) => e)(n.excel) : n.manba === 'jadval' ? {} : { source: 'AI import' };   // eslint-disable-line @typescript-eslint/no-unused-vars
        // Yozma masalada ustozning yakuniy javobi yechim oxirida turadi (yechim bo'lmasa — yolg'iz o'zi).
        const yechim = n.solution || (n.type === 'yozma' && n.ustozJavobi ? javobQatori(n.ustozJavobi) : null);
        return {
          ...asos,
          toplam: n.toplam || null,
          ...(n.tarjima ? { tarjima: n.tarjima } : {}),
          ...(n.imageUrl ? { imageUrl: n.imageUrl } : {}),
          subject: n.subject, topic: n.topic || NOMALUM_MAVZU, bankTopicId: bank?.id ?? berilganId ?? null,
          type: n.type, text: n.text, options: n.type === 'yopiq' || n.type === 'moslash' ? n.options : null,
          correctAnswer: n.type === 'yozma' ? '' : n.correctAnswer, ...darajaMaydonlari({ d: n.difficulty as 1 | 2 | 3, darajaId: n.darajaId ?? null }), language: n.language || 'uz',
          solution: yechim,
          solutionStatus: n.solution ? yechimHolati(n) : yechim ? 'tasdiqlangan' : 'yoq',
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
      // Guruhli savollar: har biri bankka guruh bo'lib yoziladi (mavzusi bo'lmasa — yaratiladi).
      let guruhXabari = '';
      let guruhQolgan: AiGuruh[] = [];
      let guruhXato = '';
      if (tanlanganGuruhlar.length && fan) {
        const mavzuIdlari = new Map<string, number>();
        const mavzuIdOl = async (nom: string) => {
          const t = nom || NOMALUM_MAVZU;
          const bor = mavzuIdlari.get(t) ?? fan.mavzular.find(m => m.name.toLowerCase() === t.toLowerCase())?.id ?? (berilgan && t === berilgan && boshMavzu ? boshMavzu : undefined);
          if (bor) return bor;
          // Mavzu hozirgina (shu faylning oddiy savollari bilan) yaratilgan bo'lishi mumkin.
          const yangi = await mavzuniTopYokiYarat(soro, fan.id, t);
          mavzuIdlari.set(t, yangi);
          return yangi;
        };
        setJarayon({ matn: 'Guruhli savollar yozilmoqda', i: 0, jami: tanlanganGuruhlar.length });
        const g = await guruhlarniSaqla(soro, tanlanganGuruhlar, mavzuIdOl, 'AI import');
        r.ids.push(...g.ids);
        const qoralamaGuruh = g.soni - g.faolSoni;
        guruhXabari = g.soni ? `${g.soni} ta guruhli savol${qoralamaGuruh ? ` (${qoralamaGuruh} tasi qoralama — bankda ko'rib, faol qilasiz)` : ''}` : '';
        guruhQolgan = g.qolgan;
        guruhXato = g.xatolar[0] || '';
      }
      setJarayon(null);
      const qoralama = questions.filter(q => q.status === 'qoralama').length;
      // Yozilmagan guruhlar oynada qoladi (qayta urinish uchun) — yozilganlari ro'yxatdan chiqadi.
      if (guruhQolgan.length) {
        showNotification(`${guruhQolgan.length} ta guruhli savol yozilmadi: ${guruhXato}${r.count || guruhXabari ? ` (qolgani bankka qo'shildi)` : ''}`, 'error');
        onSaqlandi({ soni: r.count, ids: r.ids || [], faolIds: r.faolIds || [] });
        setNatijalar([]);
        setAiGuruhlar(guruhQolgan);
        return;
      }
      if (guruhXabari && !r.count) showNotification(`${guruhXabari} bankka qo'shildi`, 'success');
      else showNotification(`${r.count} ta savol${guruhXabari ? ` va ${guruhXabari}` : ''} bankka qo'shildi${qoralama ? ` — ${qoralama} tasi qoralama (bankda ko'rib, faol qilasiz)` : ''}${r.xatolar.length ? `; ${r.xatolar.length} tasi qo'shilmadi: ${r.xatolar[0].xato}` : ''}`, r.xatolar.length ? 'info' : 'success');
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
  const tekshirishKerak = (n: Natija) => n.tekshiruv?.tekshirildi === false || (n.type !== 'yozma' && !n.correctAnswer) || !!n.xato || (n.type === 'yozma' && !n.yechilmoqda && !n.solution);
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
    s.add(NOMALUM_MAVZU);
    return [...s];
  }, [fan, natijalar]);
  const sanoq = useMemo(() => {
    const l = natijalar || [];
    return {
      jami: l.length,
      togri: l.filter(n => n.tekshiruv?.tekshirildi === true).length,
      yechildi: l.filter(n => n.type === 'yozma' && n.yechimManbasi === 'ai' && n.solution).length,
      tekshirish: l.filter(tekshirishKerak).length,
      takror: l.filter(n => n.takrorId).length,
      kutilmoqda: l.filter(n => (n.tekshiriladi && !n.tekshiruv) || n.yechilmoqda).length,
    };
  }, [natijalar]);   // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Kartada chizma bloki ko'rinadimi: AI o'qigan savolda — chizma kerak bo'lsa («[rasm]» belgisi) yoki bor
   * bo'lsa; Word shablonidan kelgan savolda — yagona ichki rasmi bo'lsa (xohlasa vektor qilib chizdiradi).
   */
  const chizmaBloki = (n: Natija) => (!!n.imageUrl || aiBor) && (n.manba === 'ai' ? rasmKerakmi(n) : n.manba === 'jadval' && (!!n.imageUrl || !!ichkiRasm(n.text)));

  const yangiMavzuBelgisi = (nom: string) => !!fan && nom !== NOMALUM_MAVZU && !fan.mavzular.some(m => m.name === nom);
  const mavzuVariantlar: { v: MavzuRejimi; nom: React.ReactNode }[] = [
    ...(berilgan ? [{ v: 'qatiy' as const, nom: berilgan }] : []),
    { v: 'ai', nom: 'AI ajratsin' },
    { v: 'nomalum', nom: NOMALUM_MAVZU },
  ];

  // ---- Oyna ------------------------------------------------------------------

  return (
    <div className={`fixed inset-0 ${yuqorida ? 'z-[400]' : 'z-[260]'} flex items-start justify-center overflow-y-auto p-2 sm:p-4`} role="dialog" aria-modal="true" aria-label="Savol qo'shish">
      <div className="fixed inset-0 bg-black/50" onClick={() => !band && onYop()} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-4xl border border-chiziq my-2 sm:my-4">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-chiziq">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-matn flex items-center gap-1.5"><Sparkles size={15} className="text-brand shrink-0" /> Savol qo'shish</h3>
            <p className="text-[12px] text-matn-xira">Rasm, PDF, Word yoki Excel — fayl turini tanlang: AI o'qiydi, javoblarini tekshiradi, yozma masalalarni yechadi.</p>
            {onRejim && <QoshRejimi rejim="fayl" onRejim={onRejim} band={band || !!natijalar} />}
          </div>
          <button aria-label="Yopish" disabled={band} onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer disabled:opacity-40"><X size={16} /></button>
        </div>

        {!natijalar ? (
          <div className="p-4 sm:p-5 space-y-4">
            {ai && !ai.yoqilgan && (
              ai.sozlay ? <AiKalitKartasi ixcham />
                : <p className="rounded-xl bg-ogoh-fon border border-ogoh/25 px-3 py-2 text-[12.5px] text-matn">AI hali ulanmagan — rasm va PDF o'qilmaydi (to'ldirilgan Word shablon va Excel ishlaydi). Kalitni administrator Imtihonlar → Sozlamalar da kiritadi.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Maydon nom="Fan">
                <select className={SELECT} value={fan?.id ?? ''} aria-label="Fan" disabled={band} onChange={e => setFanId(Number(e.target.value) || null)}>
                  <option value="">Fanni tanlang</option>
                  {daraxt.fanlar.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </Maydon>
              <Maydon div nom="Mavzu" izoh={rejim === 'ai' ? 'AI har savolni fanning mavzulariga o\'zi ajratadi (mos mavzu bo\'lmasa — yangisini taklif qiladi).'
                : rejim === 'nomalum' ? `Savollar «${NOMALUM_MAVZU}» mavzusiga tushadi — bankda o'zingiz kerakli mavzularga ko'chirasiz.${ai && !aiBor ? ' (AI ulanmagan — ajrata olmaydi.)' : ''}`
                : `Hamma savol «${berilgan}» mavzusiga tushadi.`}>
                <Tanlov qiymat={rejim} variantlar={mavzuVariantlar}
                  onChange={v => (v === 'ai' && ai && !aiBor ? showNotification("AI ulanmagan — mavzuga ajrata olmaydi. Savollar «Noma'lum» ga tushadi", 'info') : setMavzuRejimi(v))} />
              </Maydon>
            </div>
            <Maydon div nom="Fayl turi" izoh={turQulf ? `${turMalumoti.izoh} Turni almashtirish uchun avval yuklangan Word/Excel faylni olib tashlang.` : turMalumoti.izoh}>
              <div role="radiogroup" aria-label="Fayl turi" className="inline-flex flex-wrap rounded-xl border border-chiziq bg-ichki p-0.5 gap-0.5">
                {FAYL_TURLARI.map(t => (
                  <button key={t.v} type="button" role="radio" aria-checked={t.v === tur} disabled={band || (turQulf && t.v !== tur)} onClick={() => setTur(t.v)}
                    className={`px-3.5 py-1.5 rounded-[10px] text-[12.5px] font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${t.v === tur ? 'bg-brand text-brand-ust shadow-sm' : 'text-matn-sokin hover:text-matn'}`}>{t.nom}</button>
                ))}
              </div>
            </Maydon>

            <div
              onDragOver={e => { e.preventDefault(); setUstida(true); }} onDragLeave={() => setUstida(false)}
              onDrop={e => { e.preventDefault(); setUstida(false); if (!band) fayllarniQosh(Array.from(e.dataTransfer.files || [])); }}
              className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${ustida ? 'border-brand bg-brand-fon dark:bg-brand/10' : 'border-chiziq-kuchli bg-ichki'}`}>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                <Tugma turi="asosiy" ikonka={<Camera size={15} />} disabled={band} onClick={() => kameraRef.current?.click()}>{sahifalar.length ? 'Yana suratga olish' : 'Suratga olish'}</Tugma>
                <Tugma ikonka={<FileUp size={15} />} disabled={band} onClick={() => faylRef.current?.click()}>Fayl tanlash</Tugma>
              </div>
              <p className="mt-3 text-[11.5px] text-matn-xira">PDF, Word, rasm (kitob, daftar, test sahifasi) yoki Excel · kompyuterda faylni shu yerga tashlash yoki Ctrl+V · {MAKS_SAHIFA} sahifagacha</p>
              <input ref={kameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; fayllarniQosh(f); }} />
              <input ref={faylRef} type="file" multiple accept={`image/*,application/pdf,.pdf,.docx,.doc,${DOCX},.xlsx,.xls`} className="hidden" onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; fayllarniQosh(f); }} />
            </div>

            <ManbalarRoyxati manbalar={manbalar} band={band} aiBor={aiBor} onOl={kalit => setManbalar(l => l.filter(x => x.kalit !== kalit))} />

            {jarayon && (
              <div className="space-y-1.5" role="status">
                <p className="flex items-center gap-2 text-[12.5px] text-matn-sokin"><Loader2 size={14} className="animate-spin" /> {jarayon.matn}{jarayon.jami ? ` — ${jarayon.i} / ${jarayon.jami}` : jarayon.i ? `: ${jarayon.i}` : '…'}</p>
                {jarayon.jami > 0 && <div className="h-1.5 rounded-full bg-ichki overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${Math.round((jarayon.i / jarayon.jami) * 100)}%` }} /></div>}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <QrShablonTugma tur={tur} />
              </span>
              <Tugma turi="asosiy" ikonka={<Sparkles size={14} />} yuklanmoqda={!!jarayon} disabled={!aiKerak && !aiSiz}
                onClick={() => ajrat()}>
                {sahifalar.length ? `Savollarni ajratish (${sahifalar.length} sahifa)` : aiSiz && !aiKerak ? `${aiSiz} ta savolni ko'rish` : 'Savollarni ajratish'}
              </Tugma>
            </div>
            <p className="text-[11.5px] text-matn-xira">
              Fayldan faqat «<b>{turMalumoti.nom}</b>» turidagi savollar olinadi. To'ldirilgan Word shablon AI siz o'qiladi; rasm, PDF va oddiy Word ni AI o'qiydi
              {tur === 'yozma' ? ' va har masalani yechib, batafsil (qadamma-qadam, izohli) yechim yozadi.'
                : guruhTurimi(tur) ? ' — bunday savollar bankka qoralama bo\'lib tushadi (javoblarini ko\'rib, faol qilasiz).'
                : ', alohida sahifadagi javoblar kalitini raqam bo\'yicha topadi, bankda borini belgilaydi va har javobni qayta yechib tekshiradi.'}
            </p>
          </div>
        ) : (
          <>
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-matn">
                  {sanoq.jami > 0 || !aiGuruhlar.length ? <><b>{sanoq.jami}</b> ta savol</> : null}
                  {aiGuruhlar.length > 0 && <>{sanoq.jami > 0 ? ' · ' : ''}<b>{aiGuruhlar.length}</b> ta guruhli savol</>}
                  {sanoq.togri > 0 && <> · <span className="text-yaxshi font-semibold">{sanoq.togri} tasi javobi tekshirildi</span></>}
                  {sanoq.yechildi > 0 && <> · <span className="text-brand font-semibold">{sanoq.yechildi} tasini AI yechdi</span></>}
                  {sanoq.takror > 0 && <> · <span className="text-ogoh">{sanoq.takror} tasi bankda bor</span></>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sanoq.jami > 0 && (
                    <Tanlov kichik qiymat={filtr} onChange={setFiltr} variantlar={[
                      { v: 'hammasi', nom: 'Hammasi' },
                      { v: 'tekshirish', nom: `Tekshirish kerak ${sanoq.tekshirish}` },
                      ...(sanoq.takror ? [{ v: 'takror' as const, nom: `Bankda bor ${sanoq.takror}` }] : []),
                    ]} />
                  )}
                  {sanoq.jami > 0 && <Tugma kichik turi="oddiy" disabled={band} onClick={() => setNatijalar(l => (l || []).map(n => ({ ...n, tanlangan: !n.takrorId })))}>Hammasini tanlash</Tugma>}
                  <Tugma kichik turi="oddiy" ikonka={<RotateCcw size={13} />} disabled={band} onClick={() => { rasmNavbati.toxtat(); setNatijalar(null); setMatnlar([]); setAiGuruhlar([]); setPartiyaRasmlari([]); setFiltr('hammasi'); }}>Boshqa fayl</Tugma>
                </div>
              </div>
              <RasmJarayoni holat={rasmNavbati.holat} onToxtat={rasmNavbati.toxtat} />
              {jarayon && (
                <div className="space-y-1.5" role="status">
                  <p className="flex items-center gap-2 text-[12.5px] text-matn-sokin"><Loader2 size={14} className="animate-spin" /> {jarayon.matn} — {jarayon.i} / {jarayon.jami}</p>
                  <div className="h-1.5 rounded-full bg-ichki overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${jarayon.jami ? Math.round((jarayon.i / jarayon.jami) * 100) : 0}%` }} /></div>
                </div>
              )}
              {aiGuruhlar.length > 0 && filtr === 'hammasi' && (
                <section aria-label="Guruhli savollar" className="space-y-2">
                  <h4 className="text-[12.5px] font-bold text-matn">Guruhli savollar <span className="font-normal text-matn-xira">· {aiGuruhlar.length} ta — bankka guruh bo'lib tushadi (umumiy shart bir marta)</span></h4>
                  <ul className="space-y-2">
                    {aiGuruhlar.map(g => (
                      <AiGuruhKarta key={g.kalit} g={g} band={band} onTanla={v => setAiGuruhlar(l => l.map(x => (x.kalit === g.kalit ? { ...x, tanlangan: v } : x)))}
                        /* Umumiy shartning chizmasi (AI o'qigan guruhda): shart ostida, qayta chizsa bo'ladi. */
                        rasm={g.manba === 'ai' && rasmKerakmi(g) && (aiBor || g.imageUrl) ? (
                          <SavolRasmi q={g} sorov={guruhRasmSorovi(g, partiyaRasmlari)} band={band} onOzgar={f => setAiGuruhlar(l => l.map(x => (x.kalit === g.kalit ? f(x) : x)))} />
                        ) : undefined} />
                    ))}
                  </ul>
                </section>
              )}
              {!korinadi.length && !aiGuruhlar.length && <p className="text-[12.5px] text-matn-xira py-6 text-center">Bu ro'yxatda savol yo'q</p>}
              {guruhlar.map(([nom, royxat]) => (
                <section key={nom} aria-label={nom} className="space-y-2">
                  <h4 className="flex flex-wrap items-center gap-2 pt-2 text-[13px] font-bold text-matn">
                    {nom}<span className="raqam font-semibold text-matn-xira">{royxat.length}</span>
                    {yangiMavzuBelgisi(nom) && <Yorliq rang="brand">yangi mavzu</Yorliq>}
                    {nom === NOMALUM_MAVZU && <span className="text-[11.5px] font-normal text-matn-xira">— bankda kerakli mavzularga ko'chirasiz</span>}
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
                            ? <Tahrir q={n} onBekor={() => setTahrirda(null)} onSaqla={q => {
                              // Yechimni ustoz o'zi yozgan yoki tuzatgan bo'lsa — endi uniki.
                              ozgartir(n.kalit, { ...q, tahrirlandi: true, tanlangan: true, xato: null, yechilmadi: false, ...(q.solution !== n.solution ? { yechimManbasi: q.solution ? 'ustoz' as const : null } : {}) });
                              setTahrirda(null);
                            }} />
                            : <Korinish q={n} rasmsiz={chizmaBloki(n)} onJavob={band ? undefined : j => ozgartir(n.kalit, { correctAnswer: j, tahrirlandi: true, tanlangan: true })} />}
                          {tahrirda !== n.kalit && chizmaBloki(n) && (
                            <SavolRasmi q={n} ichki={n.manba === 'jadval'} sorov={savolRasmSorovi(n, partiyaRasmlari)} band={band} onOzgar={f => setNatijalar(l => (l || []).map(x => (x.kalit === n.kalit ? f(x) : x)))} />
                          )}
                          {tahrirda !== n.kalit && n.type === 'yozma' && n.ustozJavobi && <p className="text-[13px] text-matn"><b>Ustoz bergan javob:</b> {n.ustozJavobi}</p>}
                          {tahrirda !== n.kalit && n.type !== 'yozma' && !n.correctAnswer && n.tekshiruv?.aiJavobi && (
                            <Tugma kichik onClick={() => ozgartir(n.kalit, { correctAnswer: n.tekshiruv!.aiJavobi, tahrirlandi: true, tanlangan: true })}>AI javobini qo'yish: {n.tekshiruv.aiJavobi}</Tugma>
                          )}
                          {tahrirda !== n.kalit && n.type === 'yozma' && !n.yechilmoqda && aiBor && n.yechimManbasi !== 'ustoz' && (
                            <Tugma kichik ikonka={<Sparkles size={13} />} disabled={band} onClick={() => birniYech(n)}>{n.solution ? 'Qayta yechish (AI)' : 'AI bilan yechish'}</Tugma>
                          )}
                          {tahrirda !== n.kalit && (
                            <div className="flex flex-wrap items-center gap-2">
                              <DarajaTanlov kichik qiymat={{ d: n.difficulty as 1 | 2 | 3, darajaId: n.darajaId ?? null }} onChange={d => ozgartir(n.kalit, { difficulty: d.d, darajaId: d.darajaId })} />
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
                            <button aria-label="Tuzatish" disabled={band || !!n.rasm?.band} onClick={() => setTahrirda(n.kalit)} className="p-1.5 rounded-lg text-matn-xira hover:text-brand hover:bg-ichki cursor-pointer disabled:opacity-40"><Pencil size={14} /></button>
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
                {tanlanganlar.length || tanlanganGuruhlar.length
                  ? <>Tanlandi: <b className="text-matn">{tanlanganlar.length + tanlanganGuruhlar.length}</b>
                    {tanlanganlar.length > 0 && <> · faol {faolSoni}{tanlanganlar.length - faolSoni ? ` · qoralama ${tanlanganlar.length - faolSoni}` : ''}</>}
                    {tanlanganGuruhlar.length > 0 && <> · guruhli savol {tanlanganGuruhlar.length}{faolGuruhlar ? ` (faol ${faolGuruhlar}${tanlanganGuruhlar.length - faolGuruhlar ? `, qoralama ${tanlanganGuruhlar.length - faolGuruhlar}` : ''})` : ' (qoralama)'}</>}</>
                  : 'Savollarni belgilang'}
                {sanoq.kutilmoqda > 0 && <span className="block text-[11px] text-matn-xira">AI ishi tugagach — tasdiqlanganlari faol bo'ladi</span>}
              </p>
              <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} disabled={(!tanlanganlar.length && !tanlanganGuruhlar.length) || !!jarayon || rasmNavbati.band || tahrirda !== null} onClick={saqla}>
                {tanlanganlar.length ? `${tanlanganlar.length} ta savol${tanlanganGuruhlar.length ? ` va ${tanlanganGuruhlar.length} ta guruhni` : 'ni'} bankka qo'shish` : tanlanganGuruhlar.length ? `${tanlanganGuruhlar.length} ta guruhli savolni bankka qo'shish` : "Bankka qo'shish"}
              </Tugma>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
