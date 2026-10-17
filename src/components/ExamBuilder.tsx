import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Lock, Wand2, BookOpen, LayoutList, KeyRound, MessageSquareText, Info } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useImtihonApi } from './imtihon/useImtihonApi';
import { Karta, Tugma, Maydon, INPUT, SELECT, Tanlov, Almashtirgich, Yorliq, Yuklanmoqda } from './imtihon/ui';
import { useBankDaraxt, fanniTop } from './imtihon/bank/useBankDaraxt';
import BlokMuharriri from './imtihon/tuzish/BlokMuharriri';
import SorovnomaMuharriri from './imtihon/SorovnomaMuharriri';
import AndozadanQogoz from './imtihon/AndozadanQogoz';
import { JarimaTanlovi } from './imtihon/sozlamaQismlari';
import { sozlamaniTozala, varaqTuzilmasi, VARIANT_KODLARI, taqsimla, QIYINLIK_ARALASHMASI, qismSoni, qismTekshiruvi } from '../../lib/imtihon.js';
import { yangiImtihonBoshi } from '../../lib/imtihonSozlama.js';
import { toDateStr } from '../../lib/lessons.js';
import { TUR_NOMI, TUR_IZOHI } from '../lib/savolTuri';
import type { Exam, ExamBlock, ExamSettings, TopicRule, SavolTuri } from '../types';

// Imtihon tuzish: faqat savollar qulflanguncha hal bo'ladigan narsalar — manba, nomi va
// sanasi, tuzilma (fanlar, ball), variantlar va smenalar soni. Qolgani o'z bosqichida
// (egasi, 2026-10-17): qatnashchilar, smena vaqti, o'rinlar, onlayn va ruxsatnoma —
// «Qatnashchilar» tabida; o'tish bali, reyting va xabar — «Natijalar» tabida. Yangi
// imtihon ularni markazning umumiy sozlamasidan oladi (Imtihonlar → Sozlamalar,
// lib/imtihonSozlama.js); mavjud imtihonga u ta'sir qilmaydi.

const yangiId = () => Math.random().toString(36).slice(2, 9);

/**
 * Mavjud imtihonda forma faqat shularni yuboradi — tablarda saqlangan o'tkazish va natija
 * sozlamalari (forma ochilgandan keyin o'zgargan bo'lishi mumkin) eski qiymat bilan bosilmaydi.
 */
const TUZILMA_KALITLARI = [
  'source', 'sessions', 'sessionQuestions', 'variantCount', 'shuffleQuestions', 'shuffleOptions', 'variantBubble',
  'language', 'optionCount', 'xatoJarima', 'jarimaNoldan', 'ishlatishChegarasi', 'takror',
] as const satisfies readonly (keyof ExamSettings)[];

// DTM (BMBA) blok testi: 3 majburiy fan × 10 savol × 1.1 ball, 2 asosiy fan × 30 savol (3.1 va 2.1).
const DTM_TUZILMASI: ExamBlock[] = [
  { id: yangiId(), subject: 'Ona tili', pointsPerQuestion: 1.1, topicRules: [{ topic: '', count: 10, type: 'yopiq' }] },
  { id: yangiId(), subject: 'Matematika', pointsPerQuestion: 1.1, topicRules: [{ topic: '', count: 10, type: 'yopiq' }] },
  { id: yangiId(), subject: "O'zbekiston tarixi", pointsPerQuestion: 1.1, topicRules: [{ topic: '', count: 10, type: 'yopiq' }] },
  { id: yangiId(), subject: '1-asosiy fan', pointsPerQuestion: 3.1, topicRules: [{ topic: '', count: 30, type: 'yopiq' }] },
  { id: yangiId(), subject: '2-asosiy fan', pointsPerQuestion: 2.1, topicRules: [{ topic: '', count: 30, type: 'yopiq' }] },
];

/** "Faqat kalit" rejimidagi qoida turlari (varaqdagi tartibda); nomlari — lib/savolTuri. */
const KALIT_TURLARI = [
  { v: 'yopiq', nom: TUR_NOMI.yopiq },
  { v: 'juft', nom: `${TUR_NOMI.juft} — ${TUR_IZOHI.juft} (A–F)` },
  { v: 'raqamli', nom: TUR_NOMI.raqamli },
  { v: 'qismli:son', nom: `${TUR_NOMI.qismli} — ${TUR_IZOHI.qismli}: skaner, son` },
  { v: 'moslash', nom: TUR_NOMI.moslash },
  { v: 'qismli:ustoz', nom: `${TUR_NOMI.qismli} — ${TUR_IZOHI.qismli}: ustoz tekshiradi` },
  { v: 'yozma', nom: TUR_NOMI.yozma },
];

/** Yangi imtihon: savollar qayerdan. Andoza va so'rovnoma — o'z oynasi / muharriri bilan. */
const MANBALAR = [
  { v: 'bank', ikonka: <BookOpen size={17} />, nom: 'Bank qoidalari', izoh: "Fan, mavzu va qiyinlik bo'yicha bankdan tanlanadi" },
  { v: 'andoza', ikonka: <LayoutList size={17} />, nom: 'Bankdagi andoza', izoh: "Tayyor to'plam: aynan shu savollar tushadi" },
  { v: 'kalit', ikonka: <KeyRound size={17} />, nom: "O'z kitobcham", izoh: "Kitobcha o'zingizniki, CRM ga faqat javob kaliti" },
  { v: 'sorovnoma', ikonka: <MessageSquareText size={17} />, nom: "So'rovnoma", izoh: "O'quvchi yoki ota-ona fikri, OMR varaq bilan" },
] as const;

/**
 * /exams/new va /exams/:id/edit bitta komponent: yo'l almashsa (yangi ↔ tahrir, boshqa imtihon)
 * forma boshidan ochiladi — oldingi imtihonning nomi, bloklari va qulfi aralashib qolmaydi.
 */
export default function ExamBuilder() {
  const { id } = useParams();
  return <ImtihonFormasi key={id ?? 'yangi'} />;
}

function ImtihonFormasi() {
  const { id } = useParams();
  const [urlParams] = useSearchParams();
  const tahrir = !!id;
  const navigate = useNavigate();
  const { selectedSchoolId, user, addExam, updateExam, showNotification } = useCRM();
  const { soro } = useImtihonApi();
  // Forma bir marta to'ldiriladi. `showNotification` har chizishda yangi funksiya, `soro` esa
  // token yangilanganda almashadi — ular sabab qayta yuklanib, yozilganlar bosilib ketmasin.
  const yuklandi = useRef(false);
  const standartQollandi = useRef(false);
  const xabar = useRef(showNotification);
  useEffect(() => { xabar.current = showNotification; });

  // So'rovnoma — o'z muharriri (pastda): unga markaz standartlari kerak emas.
  const yangiSorovnoma = !tahrir && urlParams.get('tur') === 'sorovnoma';
  // Yangi imtihon ham kutadi: forma markazning standart qiymatlari bilan ochiladi.
  const [yuklanmoqda, setYuklanmoqda] = useState(!yangiSorovnoma);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [andozaOyna, setAndozaOyna] = useState(false);
  const [qulf, setQulf] = useState(false);
  const [nom, setNom] = useState('');
  const [sana, setSana] = useState(() => toDateStr());
  const [davom, setDavom] = useState(120);
  const [scoring, setScoring] = useState<'blok' | 'foiz'>('blok');
  const [bloklar, setBloklar] = useState<ExamBlock[]>([{ id: yangiId(), subject: '', pointsPerQuestion: 1, topicRules: [{ topic: '', count: 10, type: 'yopiq' }] }]);
  const [sozlama, setSozlama] = useState<ExamSettings>(() => sozlamaniTozala({}) as ExamSettings);
  // Imtihon yaratilgan filial; boshqa qatnashadigan filiallar — «Qatnashchilar» tabida.
  const egaFilial = selectedSchoolId && selectedSchoolId > 0 ? selectedSchoolId : user?.schoolId || 0;
  // Bank tuzilmasi: fan → mavzu, har mavzuda imtihonga olsa bo'ladigan savollar (imtihon tilida).
  const { daraxt } = useBankDaraxt(sozlama.language);

  useEffect(() => {
    if (!id || yuklandi.current) return;
    let tirik = true;
    soro<Exam>('GET', `exams/${id}`).then(e => {
      if (!tirik || yuklandi.current) return;
      yuklandi.current = true;
      setNom(e.name); setSana(e.date); setDavom(e.duration); setScoring(e.scoring || 'blok');
      setBloklar((e.blocks || []).map(b => ({ ...b, id: b.id || yangiId() })));
      setSozlama(sozlamaniTozala(e.settings) as ExamSettings);
      setQulf(!!e.lockedAt);
    }).catch(err => { if (tirik) xabar.current(err.message, 'error'); }).finally(() => { if (tirik) setYuklanmoqda(false); });
    return () => { tirik = false; };
  }, [id, soro]);

  // Markazning umumiy sozlamasi (Imtihonlar → Sozlamalar): yangi imtihon shu qiymatlar bilan
  // boshlanadi. O'qilmasa — tizim standarti bilan davom etiladi (forma ochilmay qolmasin).
  useEffect(() => {
    if (id || yangiSorovnoma || standartQollandi.current) return;
    let tirik = true;
    soro<{ sozlama: unknown }>('GET', 'imtihon-sozlama').then(r => {
      if (!tirik || standartQollandi.current) return;
      standartQollandi.current = true;
      const m = yangiImtihonBoshi(r.sozlama);
      setDavom(m.duration);
      setScoring(m.scoring === 'foiz' ? 'foiz' : 'blok');
      setSozlama(m.settings as ExamSettings);
    }).catch(() => { /* tizim standarti qoladi */ }).finally(() => { if (tirik) setYuklanmoqda(false); });
    return () => { tirik = false; };
  }, [id, soro, yangiSorovnoma]);

  const tuzilma = useMemo(() => varaqTuzilmasi(bloklar, scoring), [bloklar, scoring]);
  const s = (patch: Partial<ExamSettings>) => setSozlama(x => ({ ...x, ...patch }));

  const kopaytma = sozlama.sessionQuestions === 'alohida' ? sozlama.sessions.length : 1;
  // "Faqat kalit": markazning o'z kitobchasi — mavzu va qiyinlik kerak emas, bank ham.
  const kalitRejimi = sozlama.source === 'kalit';

  const blokQoy = (bi: number, patch: Partial<ExamBlock>) => setBloklar(b => b.map((x, i) => (i === bi ? { ...x, ...patch } : x)));
  const qoidaQoy = (bi: number, ri: number, patch: Partial<TopicRule>) => setBloklar(b => b.map((x, i) => (i === bi ? { ...x, topicRules: x.topicRules.map((r, j) => (j === ri ? { ...r, ...patch } : r)) } : x)));

  const saqla = async () => {
    if (!nom.trim()) return showNotification('Imtihon nomini kiriting', 'error');
    if (!qulf) {
      if (bloklar.some(b => !b.subject.trim())) return showNotification(kalitRejimi ? 'Har blokning fanini kiriting' : 'Har blokda fanni tanlang', 'error');
      if (!tuzilma.jami) return showNotification(kalitRejimi ? "Kamida bitta savol qoidasi kerak" : 'Savollar soni kiritilmagan', 'error');
    }
    setSaqlanmoqda(true);
    try {
      // Smena nomi va vaqti «Qatnashchilar» tabida o'zgaradi; forma faqat sonini (qulfgacha) yuboradi.
      const kalitlar = qulf ? TUZILMA_KALITLARI.filter(k => k !== 'sessions') : TUZILMA_KALITLARI;
      const settings = tahrir ? Object.fromEntries(kalitlar.map(k => [k, sozlama[k]])) : sozlama;
      const body: any = { name: nom.trim(), date: sana, duration: davom, settings };
      if (!qulf) Object.assign(body, { blocks: bloklar, scoring });
      if (tahrir) {
        await updateExam(Number(id), body);
        navigate(`/exams?tab=imtihonlar&imtihon=${id}`);
      } else {
        const e = await addExam({ ...body, schoolId: egaFilial } as any);
        navigate(`/exams?tab=imtihonlar&imtihon=${e.id}`);
      }
    } catch {
      // xabar context'da ko'rsatildi
    } finally {
      setSaqlanmoqda(false);
    }
  };

  if (yuklanmoqda) return <Yuklanmoqda />;
  // So'rovnoma — o'z muharriri (savollar va shkala).
  if (sozlama.source === 'sorovnoma' || yangiSorovnoma) return <SorovnomaMuharriri id={id} />;

  const qulfIzoh = qulf ? 'Savollar qulflangan — bu qism o\'zgarmaydi' : undefined;

  const manbaTanla = (v: (typeof MANBALAR)[number]['v']) => {
    if (v === 'andoza') return setAndozaOyna(true);
    if (v === 'sorovnoma') return navigate('/exams/new?tur=sorovnoma');
    s({ source: v });
  };

  // Smenalar soni: variantlar har smenaga alohida yasaladi, shuning uchun qulfgacha. Nomi va vaqti — «Qatnashchilar» tabida.
  const smenaSoni = (n: number) => s({ sessions: Array.from({ length: n }, (_, i) => sozlama.sessions[i] || { id: i + 1, name: `${i + 1}-smena`, time: '' }) });

  // DTM tuzilmasi: 5 blok; bank rejimida fanlar bankdagi nomi bo'yicha topiladi.
  const dtmTuzilmasi = () => {
    setScoring('blok');
    setBloklar(DTM_TUZILMASI.map(b => {
      const yangi = { ...b, id: yangiId() };
      if (kalitRejimi || !daraxt) return yangi;
      const f = fanniTop(daraxt, null, b.subject);
      if (!f) return { ...yangi, subject: '', topicRules: [] };
      const jami = b.topicRules.reduce((a, r) => a + r.count, 0);
      const mavzular = f.mavzular.filter(m => m.bor.yopiq.some(n => n > 0));
      const r = taqsimla({ jami, ulush: QIYINLIK_ARALASHMASI.muvozanat, mavzular: mavzular.map(m => ({ id: m.id, bor: m.bor.yopiq })) });
      const topicRules: TopicRule[] = [];
      for (const m of mavzular) r.jadval[m.id].forEach((n: number, i: number) => { if (n) topicRules.push({ topic: m.name, mavzuId: m.id, type: 'yopiq', count: n, difficulty: i + 1 }); });
      if (r.yetmadi) topicRules.push({ topic: '', type: 'yopiq', count: r.yetmadi });
      return { ...yangi, subject: f.name, fanId: f.id, topicRules, taqsimot: { jami, aralash: 'muvozanat' as const, mavzular: mavzular.map(m => m.id), raqamli: 0, yozma: 0, yozmaBal: null } };
    }));
  };

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button aria-label="Orqaga" onClick={() => navigate(tahrir ? `/exams?tab=imtihonlar&imtihon=${id}` : '/exams?tab=imtihonlar')} className="w-10 h-10 bg-sirt border border-chiziq rounded-xl flex items-center justify-center text-matn-sokin hover:text-brand cursor-pointer"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-[15px] font-bold text-matn">{tahrir ? 'Imtihon tuzilmasi' : 'Yangi imtihon'}</h1>
            <p className="text-[12px] text-matn-xira">{tuzilma.savolSoni ?? tuzilma.jami} ta savol · eng yuqori ball {tuzilma.maks}</p>
          </div>
          {qulf && <Yorliq rang="brand"><Lock size={11} /> Qulflangan</Yorliq>}
        </div>
        <Tugma turi="asosiy" ikonka={<Save size={14} />} yuklanmoqda={saqlanmoqda} onClick={saqla}>{tahrir ? 'Saqlash' : 'Yaratish'}</Tugma>
      </div>

      <Karta sarlavha="Savollar qayerdan?" izoh={qulfIzoh || (tahrir ? undefined : 'Shunga qarab keyingi bosqichlar o\'zgaradi')}>
        {tahrir ? (
          <Maydon div nom="Savollar manbasi" izoh={kalitRejimi
            ? "O'z test kitobchangiz (sotib olingan to'plam yoki ustoz tuzgan test): CRM ga faqat har variantning javob kaliti yoziladi, kitobchani o'zingiz chop etasiz."
            : 'Savollar bankdan olinadi, variantlar va kitobchalarni CRM o\'zi tuzadi va chop etadi.'}>
            <Tanlov qiymat={sozlama.source} onChange={v => !qulf && s({ source: v })}
              variantlar={[{ v: 'bank', nom: 'Savollar bankidan' }, { v: 'kalit', nom: "O'z kitobchasi — faqat kalit" }]} />
          </Maydon>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {MANBALAR.map(m => {
              const faol = m.v === sozlama.source;
              return (
                <button key={m.v} type="button" onClick={() => manbaTanla(m.v)} aria-pressed={faol}
                  className={`flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left cursor-pointer transition-colors ${faol ? 'border-brand bg-brand-fon/60 ring-2 ring-brand/20 dark:bg-brand/15' : 'border-chiziq bg-sirt hover:border-chiziq-kuchli'}`}>
                  <span className="w-8 h-8 rounded-lg bg-brand-fon text-brand flex items-center justify-center dark:bg-brand/20">{m.ikonka}</span>
                  <span className="text-[13px] font-semibold text-matn">{m.nom}</span>
                  <span className="text-[11.5px] text-matn-sokin leading-snug">{m.izoh}</span>
                </button>
              );
            })}
          </div>
        )}
      </Karta>

      <Karta sarlavha="Asosiy">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Maydon nom="Nomi" className="lg:col-span-2"><input className={INPUT} value={nom} onChange={e => setNom(e.target.value)} placeholder="Oylik DTM sinov — oktabr" /></Maydon>
          <Maydon nom="Sana"><input type="date" className={INPUT} value={sana} onChange={e => setSana(e.target.value)} /></Maydon>
          <Maydon nom="Davomiyligi (daqiqa)"><input type="number" min={10} max={600} className={INPUT} value={davom} onChange={e => setDavom(Number(e.target.value))} /></Maydon>
        </div>
        {!kalitRejimi && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Maydon nom="Savollar tili" izoh="Bankdan faqat shu tildagi savollar olinadi">
              <select className={SELECT} disabled={qulf} value={sozlama.language} onChange={e => s({ language: e.target.value as any })}>
                <option value="">Hamma til</option><option value="uz">O'zbekcha</option><option value="ru">Ruscha</option><option value="en">Inglizcha</option>
              </select>
            </Maydon>
            <Maydon nom="Ko'p ishlatilganini olmaslik" izoh={qulfIzoh || (sozlama.ishlatishChegarasi == null
              ? 'Cheklovsiz — kam ishlatilgani baribir birinchi olinadi'
              : `Bankdan faqat ${sozlama.ishlatishChegarasi} martagacha ishlatilgan savollar olinadi (qo'lda tanlanganlar — baribir)`)}>
              <div className="flex items-center gap-2 text-[12.5px] text-matn-sokin">
                ishlatilgani ≤
                <div className="w-24">
                  <input type="number" min={0} max={1000} disabled={qulf} className={INPUT} placeholder="∞" aria-label="Ishlatish chegarasi"
                    value={sozlama.ishlatishChegarasi ?? ''} onChange={e => s({ ishlatishChegarasi: e.target.value === '' ? null : Math.max(0, Math.min(1000, Math.round(Number(e.target.value) || 0))) })} />
                </div>
                marta
              </div>
            </Maydon>
            <Maydon div nom="Takroriy savollar" izoh={qulfIzoh || (sozlama.takror === 'yoq' ? "Tekshirilmaydi — bankdagi bir xil savol ikki marta tushishi mumkin" : sozlama.takror === 'savol' ? "Matni (va rasmi) bir xil savollardan bittasi olinadi" : "Matni va javob variantlari bir xil savollardan bittasi olinadi")}>
              <Tanlov qiymat={sozlama.takror} onChange={v => !qulf && s({ takror: v })}
                variantlar={[{ v: 'variant', nom: 'Matn + variantlar' }, { v: 'savol', nom: 'Faqat matn' }, { v: 'yoq', nom: "Yo'q" }]} />
            </Maydon>
          </div>
        )}
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-ichki px-3 py-2 text-[12px] text-matn-sokin">
          <Info size={14} className="shrink-0 mt-0.5 text-brand" />
          <span>Qatnashchilar, smena vaqti, o'rinlar, onlayn test va ruxsatnoma — «Qatnashchilar» tabida; o'tish bali, reyting va xabar — «Natijalar» tabida. {tahrir ? '' : 'Yangi imtihon ularni markaz standartidan oladi (Imtihonlar → Sozlamalar).'}</span>
        </p>
      </Karta>

      <Karta sarlavha="Tuzilma" izoh={qulfIzoh || (kalitRejimi
        ? `Har fan — alohida blok, kitobchadagi tartibda. Varaqda har fanda avval ${TUR_NOMI.yopiq.toLowerCase()}, keyin ${TUR_NOMI.raqamli.toLowerCase()}, keyin ${TUR_NOMI.yozma.toLowerCase()} savollar turadi — kitobcha raqamlari shunga mos bo'lsin.`
        : "Har fan — alohida blok: savollar soni, qiyinlik va mavzular. Taqsimotni tizim o'zi hisoblaydi — jadvalda ko'rinadi, katagini qo'lda ham o'zgartirsa bo'ladi.")}
        amallar={!qulf && <Tugma kichik ikonka={<Wand2 size={14} />} onClick={dtmTuzilmasi}>DTM tuzilmasi</Tugma>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Maydon div nom="Ball tizimi" izoh={scoring === 'blok' ? "Har fan savoliga o'z bali (DTM: 3.1 / 2.1 / 1.1)" : "Har savol 1 ball, natija foizda"}>
            <Tanlov qiymat={scoring} onChange={v => !qulf && setScoring(v)} variantlar={[{ v: 'blok', nom: 'Blok bali (DTM)' }, { v: 'foiz', nom: 'Foiz' }]} />
          </Maydon>
          <JarimaTanlovi s={sozlama} qoy={s} qulf={qulf} />
        </div>
        <div className="space-y-3">
          {!kalitRejimi && (daraxt ? bloklar.map((b, bi) => (
            <BlokMuharriri key={b.id} blok={b} index={bi} daraxt={daraxt} scoring={scoring} kopaytma={kopaytma} qulf={qulf}
              onChange={nb => setBloklar(x => x.map((y, i) => (i === bi ? nb : y)))}
              onOchir={bloklar.length > 1 ? () => setBloklar(x => x.filter((_, i) => i !== bi)) : undefined} />
          )) : <Yuklanmoqda matn="Savollar banki yuklanmoqda…" />)}
          {kalitRejimi && bloklar.map((b, bi) => {
            const blokSavollar = b.topicRules.reduce((a, r) => a + Math.round((Number(r.count) || 0) / (r.type === 'qismli' ? qismSoni(r) : 1)), 0);
            return (
              <div key={b.id} className="rounded-xl border border-chiziq bg-ichki/50 p-3 space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <Maydon nom={`${bi + 1}-blok: fan`} className="flex-1 min-w-48">
                    <input className={INPUT} disabled={qulf} list="imt-fanlar" value={b.subject} onChange={e => blokQoy(bi, { subject: e.target.value })} placeholder="Matematika" />
                  </Maydon>
                  {scoring === 'blok' && (
                    <Maydon nom="Bir savol bali" className="w-32">
                      <input className={INPUT} disabled={qulf} inputMode="decimal" value={b.pointsPerQuestion} onChange={e => blokQoy(bi, { pointsPerQuestion: Number(e.target.value.replace(',', '.')) || 0 })} />
                    </Maydon>
                  )}
                  <Maydon nom="Hisoblanadi" className="w-32">
                    <input className={INPUT} disabled={qulf} inputMode="numeric" value={b.tanlab ?? ''} placeholder="hammasi" title="«m tadan n tasini yeching»: o'quvchi istalgan n tasini yechadi, birinchi n ta javob hisoblanadi"
                      onChange={e => blokQoy(bi, { tanlab: parseInt(e.target.value.replace(/\D/g, '')) || null })} />
                  </Maydon>
                  <div className="pb-2.5 text-[12px] text-matn-xira whitespace-nowrap">{blokSavollar} ta savol</div>
                  {!qulf && bloklar.length > 1 && <button aria-label="Blokni o'chirish" onClick={() => setBloklar(x => x.filter((_, i) => i !== bi))} className="mb-1 p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={15} /></button>}
                </div>
                <div className="space-y-1.5">
                  {b.topicRules.map((r, ri) => (
                    <div key={ri} className="grid grid-cols-12 gap-1.5 items-center">
                      {/* Qismli savol: bitta raqam ostida a), b) — kataklar soni = savollar × 2; tekshiruvchi tur bilan birga tanlanadi. */}
                      <select className={`${SELECT} col-span-6 sm:col-span-4`} disabled={qulf} value={r.type === 'qismli' ? `qismli:${qismTekshiruvi(r)}` : r.type || 'yopiq'} aria-label="Savol turi"
                        onChange={e => {
                          const [tur, tekshir] = e.target.value.split(':');
                          const savollar = r.type === 'qismli' ? Math.max(1, Math.round((Number(r.count) || 0) / qismSoni(r))) : Number(r.count) || 1;
                          qoidaQoy(bi, ri, tur === 'qismli'
                            ? { type: 'qismli', tekshir: tekshir as 'son' | 'ustoz', qism: 2, count: savollar * 2 }
                            : { type: tur as SavolTuri, tekshir: undefined, qism: undefined, count: savollar });
                        }}>
                        {KALIT_TURLARI.map(t => <option key={t.v} value={t.v}>{t.nom}</option>)}
                      </select>
                      <input className={`${INPUT} col-span-3 sm:col-span-2`} disabled={qulf} type="number" min={1} value={r.type === 'qismli' ? Math.round((Number(r.count) || 0) / qismSoni(r)) : r.count}
                        onChange={e => qoidaQoy(bi, ri, { count: Number(e.target.value) * (r.type === 'qismli' ? qismSoni(r) : 1) })} aria-label="Soni" title="Savollar soni" />
                      <input className={`${INPUT} col-span-3 sm:col-span-2`} disabled={qulf} inputMode="decimal" value={r.points ?? ''} onChange={e => qoidaQoy(bi, ri, { points: e.target.value === '' ? undefined : Number(e.target.value.replace(',', '.')) })} placeholder="Ball" title="Shu qatordagi har bir savol bali (bo'sh — blokning «bir savol bali»)" />
                      <div className="col-span-10 sm:col-span-3 text-[11.5px] text-matn-xira">{r.type === 'qismli' ? `${Math.round((Number(r.count) || 0) / qismSoni(r))} ta savol × ${qismSoni(r)} qism` : `${r.count || 0} ta savol`}{r.points != null ? ` · har ${r.type === 'qismli' ? 'qism' : 'biri'} ${r.points} ball` : ''}</div>
                      {!qulf && <button aria-label="Qoidani o'chirish" onClick={() => blokQoy(bi, { topicRules: b.topicRules.filter((_, j) => j !== ri) })} className="col-span-2 sm:col-span-1 justify-self-end p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={14} /></button>}
                    </div>
                  ))}
                  {!qulf && <Tugma kichik turi="oddiy" ikonka={<Plus size={13} />} onClick={() => blokQoy(bi, { topicRules: [...b.topicRules, { topic: '', count: 5, type: 'yopiq' }] })}>Qoida qo'shish</Tugma>}
                </div>
              </div>
            );
          })}
          <datalist id="imt-fanlar">{(daraxt?.fanlar || []).map(f => <option key={f.id} value={f.name} />)}</datalist>
          {!qulf && <Tugma ikonka={<Plus size={14} />} onClick={() => setBloklar(x => [...x, kalitRejimi
            ? { id: yangiId(), subject: '', pointsPerQuestion: 1, topicRules: [{ topic: '', count: 10, type: 'yopiq' }] }
            : { id: yangiId(), subject: '', pointsPerQuestion: 1, topicRules: [] }])}>Fan (blok) qo'shish</Tugma>}
          <div className="flex flex-wrap gap-2 pt-1 text-[12px] text-matn-sokin">
            <Yorliq>{tuzilma.yopiq} ta {TUR_NOMI.yopiq.toLowerCase()}</Yorliq>{tuzilma.raqamli > 0 && <Yorliq>{tuzilma.raqamli} ta {TUR_NOMI.raqamli.toLowerCase()}</Yorliq>}{(tuzilma.moslash || 0) > 0 && <Yorliq>{tuzilma.moslash} ta {TUR_NOMI.moslash.toLowerCase()}</Yorliq>}{tuzilma.yozma > 0 && <Yorliq>{tuzilma.yozma} ta {TUR_NOMI.yozma.toLowerCase()}</Yorliq>}<Yorliq rang="brand">Eng yuqori ball: {tuzilma.maks}</Yorliq>
          </div>
        </div>
      </Karta>

      <Karta sarlavha="Variantlar va smenalar" izoh={qulfIzoh || 'Variantlar har smenaga alohida yasaladi. Smena nomi va vaqti — «Qatnashchilar» tabida'}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Maydon nom="Smenalar soni">
              <select className={SELECT} disabled={qulf} value={sozlama.sessions.length} onChange={e => smenaSoni(Number(e.target.value))}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} ta</option>)}
              </select>
            </Maydon>
            <Maydon nom={kalitRejimi ? 'Kitobcha variantlari' : 'Variantlar soni'} izoh={kalitRejimi
              ? "Nechta turdagi kitobchangiz bor (A, B, C…). Har biriga kalit alohida kiritiladi."
              : "4 va undan ko'p bo'lsa, yondagi, oldingi, orqadagi va diagonaldagi qo'shnining varianti boshqa bo'ladi"}>
              <select className={SELECT} disabled={qulf} value={sozlama.variantCount} onChange={e => s({ variantCount: Number(e.target.value) })}>
                {Array.from({ length: 26 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} ta ({VARIANT_KODLARI.slice(0, n).join(n > 6 ? '' : ', ').slice(0, 14)}{n > 6 ? '…' : ''})</option>)}
              </select>
            </Maydon>
            {kalitRejimi && (
              <Maydon nom="Javob variantlari (doirachalar)" izoh="Kitobchadagi savollarda nechta javob varianti bor — varaqda shuncha doiracha chiqadi">
                <select className={SELECT} disabled={qulf} value={sozlama.optionCount} onChange={e => s({ optionCount: Number(e.target.value) })}>
                  {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} ta ({['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n).join(', ')})</option>)}
                </select>
              </Maydon>
            )}
          </div>
          {sozlama.sessions.length > 1 && (
            <Maydon div nom="Smenalarga savollar" izoh={sozlama.sessionQuestions === 'alohida' ? "Keyingi smenaga oldingisidagi savollar tushmaydi — bank ko'proq kerak" : 'Hamma smena bir xil savollarni oladi (tartibi har variantda boshqa)'}>
              <Tanlov qiymat={sozlama.sessionQuestions} onChange={v => !qulf && s({ sessionQuestions: v })} variantlar={[{ v: 'bir', nom: 'Bir xil' }, { v: 'alohida', nom: 'Har smenaga boshqa' }]} />
            </Maydon>
          )}
          {!kalitRejimi && (
            <>
              <Almashtirgich yoqilgan={sozlama.shuffleQuestions} onChange={v => !qulf && s({ shuffleQuestions: v })} nom="Fan ichida savollar tartibi aralashsin" izoh="Matnga bog'langan savollar birga qoladi" />
              <Almashtirgich yoqilgan={sozlama.shuffleOptions} onChange={v => !qulf && s({ shuffleOptions: v })} nom="Javob variantlari aralashsin" izoh="Belgilangan savollardan tashqari (A va B to'g'ri kabi)" />
            </>
          )}
          <Almashtirgich yoqilgan={sozlama.variantBubble} onChange={v => s({ variantBubble: v })} nom="O'quvchi varaqqa kitobcha variantini ham bo'yaydi" izoh="Kitobcha almashib qolsa, skaner ushlaydi" />
        </div>
      </Karta>

      {andozaOyna && (
        <AndozadanQogoz onYop={() => setAndozaOyna(false)}
          onTayyor={eid => { setAndozaOyna(false); navigate(`/exams?tab=imtihonlar&imtihon=${eid}`); }} />
      )}
    </div>
  );
}
