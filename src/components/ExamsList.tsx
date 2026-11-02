import React, { useEffect, useRef, useState } from 'react';
import { Search, Plus, FileText, BookOpen, Calendar, Users, ChevronDown, Lock, Printer, History, KeyRound, Settings, Settings2, Copy, Trash2, List, Clock, MessageSquareText } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import QuestionsList from './QuestionsList';
import { Karta, Tugma, Yorliq, HOLAT_RANGI, BoshHolat, INPUT, Tanlov, Yuklanmoqda } from './imtihon/ui';
import { useImtihonApi } from './imtihon/useImtihonApi';
import { useImtihonTafsil } from './imtihon/useImtihonTafsil';
import TuzilmaTab from './imtihon/TuzilmaTab';
import QatnashchilarTab from './imtihon/QatnashchilarTab';
import ChopEtishTab from './imtihon/ChopEtishTab';
import NatijalarTab from './imtihon/NatijalarTab';
import TarixBolimi from './imtihon/TarixBolimi';
import KalitBolimi from './imtihon/KalitBolimi';
import OqishBolimi from './imtihon/OqishBolimi';
import KalitMuharriri from './imtihon/KalitMuharriri';
import ImtihonSozlamalari from './imtihon/ImtihonSozlamalari';
import BankSozlamalari from './imtihon/bank/BankSozlamalari';
import { useBankDaraxt } from './imtihon/bank/useBankDaraxt';
import { sanaMatni } from './imtihon/format';
import { toDateStr } from '../../lib/lessons.js';
import type { Exam } from '../types';
import type { ImtihonTafsil, TabId } from './imtihon/turlar';

// Imtihonlar moduli (2026-11-01, Addmen asosida qayta tuzildi). Tepada — modul bo'limlari:
// Savollar banki · Imtihonlar · O'quvchi tarixi · Sozlamalar (raqamli qadamlar yo'q).
// «Imtihonlar» — jadval (har qatorda «keyingi ish»); imtihon ochilsa, uning ichida besh bo'lim:
// Savol qog'ozi · Kalit va baholash · Qatnashchilar va varaq · Varaq o'qish · Natijalar.
// URL: ?tab=imtihonlar&imtihon=ID&b=<bo'lim>. Eski havolalar (?tab=orin|chop|skaner|natija)
// mos bo'limga o'tkaziladi.

type Modul = 'savollar' | 'imtihonlar' | 'tarix' | 'sozlama';
export type ImtihonBolimi = 'qogoz' | 'kalit' | 'varaq' | 'oqish' | 'natija';

/** Eski bosqich tablari → yangi bo'lim. */
const ESKI_TAB: Record<string, ImtihonBolimi> = { orin: 'varaq', chop: 'varaq', skaner: 'oqish', natija: 'natija' };
const TAB_BOLIM: Record<TabId, ImtihonBolimi> = { savollar: 'qogoz', imtihonlar: 'qogoz', orin: 'varaq', chop: 'varaq', skaner: 'oqish', natija: 'natija' };

/** Imtihon qanday o'tadi — hali imtihon yo'q bo'lsa ko'rsatiladi. */
const QADAMLAR = [
  ["Savol qog'ozi", "Bankdagi andozadan: nechta variant, har variantda boshqa savolmi yoki bir xil. Kitobcha va kalit shu yerda."],
  ['Kalit va baholash', "Kalit savol qog'ozidan o'zi keladi. Ball sxemasi, savolni bekor qilish, kalitni tuzatish."],
  ['Qatnashchilar va varaq', "Guruhlar, xonalar va o'rinlar — yonma-yon o'tirganlarga boshqa variant. Ismli javob varaqalari va ro'yxatlar."],
  ["Varaq o'qish", "Skan yoki telefon kamerasi: QR dan o'quvchi, doirachalardan javob. Muammoli varaqlar alohida navbatda."],
  ['Natijalar', "Bo'limlar bo'yicha baholar, reyting, tahlil. E'lon — ota-onaga Telegram yoki SMS."],
] as const;

/** Imtihonning hozirgi «keyingi ishi» — ro'yxatdagi havola va qayerga olib borishi. */
function keyingiIsh(e: Exam): { matn: string; bolim: ImtihonBolimi } {
  const seats = e._count?.seats || 0;
  const results = e._count?.results || 0;
  if (!e.lockedAt) return { matn: "Savol qog'ozini tayyorlash", bolim: 'qogoz' };
  if (!seats) return { matn: "Qatnashchilar va o'rinlar", bolim: 'varaq' };
  if (!results) return String(e.date) > toDateStr() ? { matn: 'Varaqlarni chop etish', bolim: 'varaq' } : { matn: "Varaqlarni o'qish", bolim: 'oqish' };
  if (!e.publishedAt) return results < seats ? { matn: "Qolgan varaqlarni o'qish", bolim: 'oqish' } : { matn: "Natijani e'lon qilish", bolim: 'natija' };
  return { matn: 'Natijalar', bolim: 'natija' };
}

export default function ExamsList() {
  const { kora, ozgartira } = useCRM();
  const [params, setParams] = useSearchParams();
  const ozgartir = (patch: Record<string, string | null>) => setParams(p => {
    for (const [kalit, v] of Object.entries(patch)) { if (v === null) p.delete(kalit); else p.set(kalit, v); }
    return p;
  }, { replace: true });

  const imtihonKorinadi = kora('imtihonlar.imtihon') || kora('imtihonlar.natija');
  const MODULLAR = [
    { id: 'savollar', nom: 'Savollar banki', ikonka: BookOpen, ochiq: kora('imtihonlar.savollar') },
    { id: 'imtihonlar', nom: 'Imtihonlar', ikonka: FileText, ochiq: imtihonKorinadi },
    { id: 'tarix', nom: "O'quvchi tarixi", ikonka: History, ochiq: kora('imtihonlar.natija') },
  ].filter(t => t.ochiq) as { id: Modul; nom: string; ikonka: typeof BookOpen }[];
  const sozlamaKorinadi = ozgartira('imtihonlar.imtihon') || ozgartira('imtihonlar.savollar');

  // Eski havolalarni yangi tuzilmaga o'tkazish (URL almashtiriladi).
  const xom = params.get('tab');
  useEffect(() => {
    if (xom && ESKI_TAB[xom]) {
      const tarix = xom === 'natija' && params.get('k') === 'tarix';
      ozgartir(tarix ? { tab: 'tarix', k: null } : { tab: 'imtihonlar', b: ESKI_TAB[xom], k: xom === 'skaner' ? params.get('k') : null });
    }
  }, [xom]); // eslint-disable-line react-hooks/exhaustive-deps

  const modul: Modul = xom === 'sozlama' && sozlamaKorinadi ? 'sozlama'
    : (MODULLAR.find(t => t.id === xom)?.id || ((xom && ESKI_TAB[xom]) || (params.has('imtihon') && imtihonKorinadi) ? 'imtihonlar' : MODULLAR[0]?.id)) as Modul;
  const k = params.get('k');
  const tanlangan = modul === 'imtihonlar' ? Number(params.get('imtihon')) || null : null;
  const { exam, xato, yangila } = useImtihonTafsil(tanlangan);

  const sorovnoma = exam?.settings.source === 'sorovnoma';
  const BOLIMLAR = ([
    { id: 'qogoz', nom: sorovnoma ? "So'rovnoma" : "Savol qog'ozi", ochiq: kora('imtihonlar.imtihon') },
    { id: 'kalit', nom: 'Kalit va baholash', ochiq: kora('imtihonlar.imtihon') && !sorovnoma },
    { id: 'varaq', nom: 'Qatnashchilar va varaq', ochiq: kora('imtihonlar.imtihon') },
    { id: 'oqish', nom: "Varaq o'qish", ochiq: kora('imtihonlar.natija') },
    { id: 'natija', nom: 'Natijalar', ochiq: kora('imtihonlar.natija') },
  ] as { id: ImtihonBolimi; nom: string; ochiq: boolean }[]).filter(b => b.ochiq);
  const bolim: ImtihonBolimi = (BOLIMLAR.find(b => b.id === params.get('b'))?.id || BOLIMLAR[0]?.id || 'natija') as ImtihonBolimi;
  const bolimga = (b: ImtihonBolimi) => ozgartir({ b, k: null });
  // Bo'lim almashganda sanoqlar yangilansin (boshqa bo'limda skanerlangan bo'lishi mumkin).
  const birinchi = useRef(true);
  useEffect(() => {
    if (birinchi.current) { birinchi.current = false; return; }
    if (tanlangan) yangila();
  }, [bolim]); // eslint-disable-line react-hooks/exhaustive-deps

  const royxatga = () => ozgartir({ tab: 'imtihonlar', imtihon: null, b: null, k: null });
  const imtihonga = (id: number, b?: ImtihonBolimi) => ozgartir({ tab: 'imtihonlar', imtihon: String(id), b: b ?? null, k: null });
  const modulTugmasi = (faol: boolean) => `flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${faol ? 'bg-brand text-brand-ust' : 'text-matn-sokin hover:text-matn hover:bg-ichki'}`;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      <nav aria-label="Imtihonlar moduli" className="flex flex-wrap gap-1 bg-sirt border border-chiziq rounded-2xl p-1 shadow-sm">
        {MODULLAR.map(t => {
          const Ikonka = t.ikonka;
          return (
            <button key={t.id} onClick={() => ozgartir({ tab: t.id, imtihon: null, b: null, k: null })} aria-current={t.id === modul ? 'page' : undefined} className={modulTugmasi(t.id === modul)}>
              <Ikonka size={15} /> {t.nom}
            </button>
          );
        })}
        {sozlamaKorinadi && (
          <button onClick={() => ozgartir({ tab: 'sozlama', imtihon: null, b: null, k: null })} aria-current={modul === 'sozlama' ? 'page' : undefined}
            title="Butun modul uchun: yangi imtihon standartlari, xabar matnlari, AI yordamchi va savollar banki"
            className={`ml-auto ${modulTugmasi(modul === 'sozlama')}`}>
            <Settings size={15} /> Sozlamalar
          </button>
        )}
      </nav>

      {modul === 'savollar' && <QuestionsList />}

      {modul === 'sozlama' && (
        <div className="space-y-6">
          {ozgartira('imtihonlar.imtihon') && <ImtihonSozlamalari bankPastda={ozgartira('imtihonlar.savollar')} />}
          {ozgartira('imtihonlar.savollar') && (
            <BankSozlamaBolimi aiKalit={!ozgartira('imtihonlar.imtihon')} onRoyxat={() => ozgartir({ tab: 'savollar', bolim: null, k: null })} />
          )}
        </div>
      )}

      {modul === 'tarix' && <TarixBolimi onImtihon={id => imtihonga(id, 'natija')} />}

      {modul === 'imtihonlar' && !tanlangan && <ImtihonlarJadvali onOch={imtihonga} />}

      {modul === 'imtihonlar' && tanlangan && (
        xato ? (
          <Karta>
            <BoshHolat sarlavha="Imtihon ochilmadi" izoh={xato}>
              <Tugma ikonka={<List size={14} />} onClick={royxatga}>Barcha imtihonlar</Tugma>
            </BoshHolat>
          </Karta>
        ) : !exam || exam.id !== tanlangan ? <Yuklanmoqda />
          : (
            <>
              <ImtihonPaneli exam={exam} onTanla={id => imtihonga(id, bolim)} onRoyxat={royxatga} />
              <nav aria-label="Imtihon bo'limlari" className="flex gap-1 overflow-x-auto bg-sirt border border-chiziq rounded-2xl p-1 shadow-sm">
                {BOLIMLAR.map(b => {
                  const faol = b.id === bolim;
                  const h = exam.holat;
                  const belgi = b.id === 'oqish' && exam.lockedAt && (h.natijalar || h.orinlar) ? `${h.natijalar}/${h.natijalar + h.skanerlanmagan}`
                    : b.id === 'varaq' && h.orinlar ? String(h.orinlar) : '';
                  return (
                    <button key={b.id} onClick={() => bolimga(b.id)} aria-current={faol ? 'page' : undefined} className={modulTugmasi(faol)}>
                      {b.nom}
                      {belgi && <span className={`raqam text-[11px] font-bold px-1.5 py-px rounded-md ${faol ? 'bg-white/20' : 'bg-ichki text-matn-sokin'}`}>{belgi}</span>}
                      {b.id === 'oqish' && h.shubhali > 0 && <span className="w-2 h-2 rounded-full bg-ogoh" aria-label="muammoli varaq bor" />}
                    </button>
                  );
                })}
              </nav>
              <ImtihonBolimiKorinishi key={bolim} exam={exam} bolim={bolim} k={k} yangila={yangila}
                otish={t => bolimga(TAB_BOLIM[t])} kga={v => ozgartir({ k: v })} />
            </>
          )
      )}
    </div>
  );
}

/** Tanlangan imtihonning bitta bo'limi. */
function ImtihonBolimiKorinishi({ exam, bolim, k, yangila, otish, kga }: {
  exam: ImtihonTafsil; bolim: ImtihonBolimi; k: string | null; yangila: () => Promise<any>; otish: (t: TabId) => void; kga: (v: string | null) => void;
}) {
  const s = exam.settings;
  if (bolim === 'qogoz') {
    return (
      <div className="space-y-4">
        <TuzilmaTab exam={exam} yangila={yangila} otish={otish} />
        {exam.lockedAt && s.source === 'bank' && <ChopEtishTab key="qogoz" exam={exam} yangila={yangila} qism="qogoz" />}
      </div>
    );
  }
  if (bolim === 'kalit') {
    if (s.source === 'kalit') return <Karta sarlavha="Kalit" izoh="O'z kitobchangiz: to'g'ri javoblarni shu yerda kiriting"><KalitMuharriri exam={exam} onSaqlandi={yangila} /></Karta>;
    if (!exam.lockedAt) return <Karta><BoshHolat ikonka={<KeyRound size={22} />} sarlavha="Kalit hali yo'q" izoh="Kalit savol qog'ozi tayyor bo'lgach (variantlar tasdiqlangach) o'zi paydo bo'ladi." /></Karta>;
    return <KalitBolimi exam={exam} yangila={yangila} />;
  }
  if (bolim === 'varaq') {
    const chop = k === 'chop';
    return (
      <div className="space-y-4">
        <Tanlov qiymat={chop ? 'chop' : 'qatnashchi'} onChange={v => kga(v === 'chop' ? 'chop' : null)}
          variantlar={[
            { v: 'qatnashchi', nom: <span className="inline-flex items-center gap-1.5"><Users size={13} />Qatnashchilar va o'rinlar</span> },
            { v: 'chop', nom: <span className="inline-flex items-center gap-1.5"><Printer size={13} />Varaqlar va ro'yxatlar</span> },
          ]} />
        {chop ? <ChopEtishTab key="varaq" exam={exam} yangila={yangila} qism="varaq" /> : <QatnashchilarTab exam={exam} yangila={yangila} />}
      </div>
    );
  }
  if (bolim === 'oqish') return <OqishBolimi exam={exam} yangila={yangila} k={k} kga={kga} />;
  return <NatijalarTab exam={exam} yangila={yangila} />;
}

/** «Sozlamalar» tabida: savollar bankining sozlamalari (ilgari bankning o'z bo'limi edi). */
function BankSozlamaBolimi({ aiKalit, onRoyxat }: { aiKalit: boolean; onRoyxat: () => void }) {
  const { daraxt, xato, yangila } = useBankDaraxt();
  return (
    <section className="space-y-3" aria-labelledby="bank-sozlama">
      <div className="px-1">
        <h2 id="bank-sozlama" className="text-[15px] font-bold text-matn">Savollar banki</h2>
        <p className="text-[12px] text-matn-xira mt-0.5">Mavzular, qiyinlikni natijaga moslash va umumiy matnlar. Har amal o'z tugmasi bilan darhol saqlanadi.</p>
      </div>
      {xato ? <Karta><BoshHolat sarlavha="Bank ochilmadi" izoh={xato}><Tugma onClick={() => yangila()}>Qayta urinish</Tugma></BoshHolat></Karta>
        : !daraxt ? <Yuklanmoqda />
          : <BankSozlamalari daraxt={daraxt} fanId={null} yangila={yangila} onRoyxat={onRoyxat} aiKalit={aiKalit} />}
    </section>
  );
}

/** Tanlangan imtihon: nomi (shu yerdan boshqasiga o'tiladi), holati, qisqa ma'lumoti va amallar. */
function ImtihonPaneli({ exam, onTanla, onRoyxat }: { exam: ImtihonTafsil; onTanla: (id: number) => void; onRoyxat: () => void }) {
  const { exams, schools, ozgartira, deleteExam, imtihonniYangila, showNotification } = useCRM();
  const navigate = useNavigate();
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const bugun = toDateStr();
  // Tanlovda avval oldindagi (e'lon qilinmagan) imtihonlar, keyin qolganlari — yangisi tepada.
  const oldinda = exams.filter(e => !e.publishedAt && String(e.date) >= bugun).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const qolgan = exams.filter(e => !oldinda.includes(e)).sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const filiallar = [exam.schoolId, ...(exam.branchIds || [])].map(id => schools.find(s => s.id === id)?.name).filter(Boolean);
  const s = exam.settings;

  const nusxa = async () => {
    try {
      const yangi = await soro<Exam>('POST', `exams/${exam.id}/copy`);
      imtihonniYangila(yangi);
      showNotification('Nusxa yaratildi — nomini va sanasini tekshiring', 'success');
      navigate(`/exams/${yangi.id}/edit`);
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };
  const ochir = async () => {
    const qoshimcha = exam._count.results ? ` ${exam._count.results} ta natija ham o'chadi.` : '';
    if (!(await confirm(`"${exam.name}" o'chirilsinmi?${qoshimcha}`))) return;
    await deleteExam(exam.id);
    onRoyxat();
  };

  return (
    <section className="bg-sirt border border-chiziq rounded-2xl px-4 py-3 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Ko'rinishi — imtihon nomi; bosilsa boshqa imtihonni tanlash ro'yxati (sana va holati bilan). */}
          <label title="Boshqa imtihonni tanlash" className="relative inline-flex items-center gap-1 min-w-0 max-w-full rounded-lg -ml-1 px-1 py-0.5 cursor-pointer hover:bg-ichki focus-within:bg-ichki focus-within:ring-2 focus-within:ring-brand/30">
            <h1 className="text-[16px] font-bold text-matn truncate">{exam.name}</h1>
            <ChevronDown size={16} className="shrink-0 text-matn-xira" />
            <select aria-label="Imtihon" value={exam.id} onChange={e => onTanla(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
              {[...oldinda, ...qolgan].map(e => <option key={e.id} value={e.id}>{e.name} — {sanaMatni(e.date)} · {e.status}</option>)}
            </select>
          </label>
          <Yorliq rang={HOLAT_RANGI[exam.status] || 'kulrang'}>{exam.lockedAt && exam.status !== "E'lon qilindi" && <Lock size={10} />}{exam.status}</Yorliq>
          {s.source === 'kalit' && <Yorliq><KeyRound size={10} />kalit bilan</Yorliq>}
          {s.source === 'sorovnoma' && <Yorliq rang="brand"><MessageSquareText size={10} />so'rovnoma{s.sorovnoma?.anonim ? ', anonim' : ''}</Yorliq>}
        </div>
        <p className="text-[12px] text-matn-xira mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="inline-flex items-center gap-1"><Calendar size={12} />{sanaMatni(exam.date)}</span>
          <span className="inline-flex items-center gap-1"><Clock size={12} />{exam.duration} daqiqa</span>
          <span>{exam.totalQuestions} savol · {exam.maxScore} ball</span>
          <span>{s.sessions.length > 1 ? `${s.sessions.length} smena · ` : ''}{s.variantCount} variant</span>
          {filiallar.length > 1 && <span>{filiallar.join(' + ')}</span>}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {/* Telefonda faqat ikonkalar — panel bir qatorda qolsin. */}
        <Tugma kichik turi="oddiy" ikonka={<List size={14} />} onClick={onRoyxat} aria-label="Barcha imtihonlar"><span className="hidden sm:inline">Barcha imtihonlar</span></Tugma>
        {ozgartira('imtihonlar.imtihon') && (
          <>
            {/* Yangi imtihon — tanlangan imtihon ochiq turganda ham (ilgari faqat ro'yxatda edi). */}
            <Tugma kichik turi="asosiy" ikonka={<Plus size={14} />} onClick={() => navigate('/exams/new')} aria-label="Yangi imtihon"><span className="hidden sm:inline">Yangi imtihon</span></Tugma>
            {/* Nomi, sanasi va tuzilmasi; o'tkazish va natija sozlamalari — o'z tablarida. */}
            <Tugma kichik ikonka={<Settings2 size={14} />} onClick={() => navigate(`/exams/${exam.id}/edit`)} aria-label="Tahrirlash"><span className="hidden sm:inline">Tahrirlash</span></Tugma>
            <Tugma kichik ikonka={<Copy size={14} />} onClick={nusxa} aria-label="Nusxa olish"><span className="hidden sm:inline">Nusxa</span></Tugma>
            {ozgartira('imtihonlar.ochirish') && <Tugma kichik turi="xavfli" ikonka={<Trash2 size={14} />} onClick={ochir} aria-label="Imtihonni o'chirish"><span className="hidden sm:inline">O'chirish</span></Tugma>}
          </>
        )}
      </div>
    </section>
  );
}

/** Hamma imtihonlar — jadval: har qatorda holati va «keyingi ish» (bosilsa — o'sha bo'lim). */
function ImtihonlarJadvali({ onOch }: { onOch: (id: number, b?: ImtihonBolimi) => void }) {
  const { exams, schools, ozgartira } = useCRM();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const royxat = [...exams]
    .filter(e => (e.name || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const filialNomi = (id: number) => schools.find(s => s.id === id)?.name || '';
  const yangi = ozgartira('imtihonlar.imtihon') ? () => navigate('/exams/new') : undefined;
  const bugun = toDateStr();
  const oy = bugun.slice(0, 7);
  const shuOy = exams.filter(e => String(e.date).slice(0, 7) === oy);
  const qatnashdi = shuOy.reduce((a, e) => a + (e._count?.results || 0), 0);
  const oqilmagan = exams.filter(e => e.lockedAt && !e.publishedAt && String(e.date) <= bugun)
    .reduce((a, e) => a + Math.max(0, (e._count?.seats || 0) - (e._count?.results || 0)), 0);
  const elonKutadi = exams.filter(e => (e._count?.results || 0) > 0 && !e.publishedAt).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-matn">Imtihonlar</h1>
          <p className="text-[12.5px] text-matn-xira mt-0.5">Har imtihon — bitta qator. Bosing: savol qog'ozi, kalit, varaq, o'qish va natija shu imtihon ichida.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira pointer-events-none" />
            <input className={`${INPUT} pl-9`} placeholder="Qidirish" aria-label="Imtihon qidirish" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {yangi && <Tugma turi="asosiy" ikonka={<Plus size={14} />} onClick={yangi}>Yangi imtihon</Tugma>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ['Shu oy imtihonlar', shuOy.length, ''],
          ['Shu oy qatnashganlar', qatnashdi, ''],
          ["O'qilmagan varaqlar", oqilmagan, oqilmagan ? 'text-ogoh' : ''],
          ["E'lon kutayotgan natija", elonKutadi, ''],
        ] as const).map(([nom, son, rang]) => (
          <div key={nom} className="bg-sirt border border-chiziq rounded-2xl px-4 py-3 shadow-sm">
            <div className="text-[12px] text-matn-sokin">{nom}</div>
            <div className={`raqam text-[24px] font-semibold mt-0.5 ${rang || 'text-matn'}`}>{son}</div>
          </div>
        ))}
      </div>

      {!royxat.length ? (
        <Karta>{exams.length ? <BoshHolat ikonka={<FileText size={22} />} sarlavha="Qidiruvga mos imtihon yo'q" /> : <Yoriqnoma yangi={yangi} />}</Karta>
      ) : (
        <div className="bg-sirt border border-chiziq rounded-2xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-[13px]">
            <thead>
              <tr className="text-[11.5px] uppercase tracking-wide text-matn-sokin">
                {['Sana', 'Imtihon', 'Savol', 'Variant', 'Qatnashchi', "O'qilgan", 'Holati', 'Keyingi ish'].map(h => <th key={h} className="text-left font-semibold px-4 py-2.5">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {royxat.map(e => {
                const seats = e._count?.seats || 0;
                const results = e._count?.results || 0;
                const ish = keyingiIsh(e);
                const filiallar = (e.branchIds || []).length ? [e.schoolId, ...e.branchIds].map(filialNomi).filter(Boolean).join(' + ') : '';
                return (
                  <tr key={e.id} className="border-t border-chiziq hover:bg-ichki/50">
                    <td className="px-4 py-3 raqam text-matn-sokin whitespace-nowrap">{sanaMatni(e.date)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => onOch(e.id)} className="font-semibold text-matn hover:text-brand text-left cursor-pointer">{e.name}</button>
                      <div className="text-[12px] text-matn-xira mt-0.5 flex flex-wrap gap-x-2">
                        {e.settings?.source === 'kalit' && <span className="inline-flex items-center gap-1"><KeyRound size={11} />o'z kitobchasi</span>}
                        {e.settings?.source === 'sorovnoma' && <span className="inline-flex items-center gap-1"><MessageSquareText size={11} />so'rovnoma</span>}
                        {filiallar && <span>{filiallar}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 raqam">{e.totalQuestions}</td>
                    <td className="px-4 py-3 raqam">{e.settings?.variantCount ?? '—'}</td>
                    <td className="px-4 py-3 raqam">{seats || <span className="text-matn-xira">—</span>}</td>
                    <td className="px-4 py-3 raqam">{seats ? `${results} / ${seats}` : <span className="text-matn-xira">—</span>}</td>
                    <td className="px-4 py-3"><Yorliq rang={HOLAT_RANGI[e.status] || 'kulrang'}>{e.lockedAt && e.status !== "E'lon qilindi" && <Lock size={10} />}{e.status}</Yorliq></td>
                    <td className="px-4 py-3"><button onClick={() => onOch(e.id, ish.bolim)} className="text-brand font-semibold hover:underline cursor-pointer whitespace-nowrap">{ish.matn} →</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Hali imtihon yo'q — qanday boshlash kerak. */
function Yoriqnoma({ yangi }: { yangi?: () => void }) {
  const { ozgartira } = useCRM();
  const navigate = useNavigate();
  const boshla = yangi ?? (ozgartira('imtihonlar.imtihon') ? () => navigate('/exams/new') : undefined);
  return (
    <div className="space-y-4 py-2">
      <BoshHolat ikonka={<FileText size={22} />} sarlavha="Hali imtihon yo'q" izoh="Imtihon quyidagi tartibda o'tadi. O'z test kitobchangiz bo'lsa — savollar bankisiz, «faqat kalit» rejimida ham bo'ladi.">
        {boshla && <Tugma turi="asosiy" ikonka={<Plus size={14} />} onClick={boshla}>Yangi imtihon</Tugma>}
      </BoshHolat>
      <ol className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {QADAMLAR.map(([nom, izoh], i) => (
          <li key={nom} className="flex gap-3 rounded-xl border border-chiziq bg-ichki/60 p-3">
            <span className="w-7 h-7 shrink-0 rounded-full bg-brand text-brand-ust text-[12.5px] font-bold flex items-center justify-center raqam">{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-matn">{nom}</span>
              <span className="block text-[12px] text-matn-sokin mt-0.5">{izoh}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
