import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Plus, Trash2, Lock, Wand2, MessageSquareText, Info, ChevronDown, Layers, FileText, Copy } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useImtihonApi } from './imtihon/useImtihonApi';
import { Karta, Tugma, Maydon, INPUT, SELECT, Tanlov, Almashtirgich, Yorliq, Yuklanmoqda } from './imtihon/ui';
import { useBankDaraxt, fanniTop } from './imtihon/bank/useBankDaraxt';
import BlokMuharriri from './imtihon/tuzish/BlokMuharriri';
import SorovnomaMuharriri from './imtihon/SorovnomaMuharriri';
import { JarimaTanlovi } from './imtihon/sozlamaQismlari';
import { sanaMatni } from './imtihon/format';
import { sozlamaniTozala, varaqTuzilmasi, VARIANT_KODLARI, taqsimla, QIYINLIK_ARALASHMASI, qismSoni, qismTekshiruvi } from '../../lib/imtihon.js';
import { yangiImtihonBoshi } from '../../lib/imtihonSozlama.js';
import { toDateStr } from '../../lib/lessons.js';
import { TUR_NOMI, TUR_IZOHI } from '../lib/savolTuri';
import type { Exam, ExamBlock, ExamSettings, TopicRule, SavolTuri } from '../types';

// Imtihon tuzish (2026-10-29, boshqa tizimlar — DTM, Addmen, ZipGrade, Moodle, Akindi — kabi):
// 1) «Yangi imtihon» oynasi — nomi, sanasi, savollar qayerdan (bank yoki o'z kitobcham) va qanday
//    imtihon (DTM / bitta fan / avvalgisidek); 2) reja — har fan bitta qator (nechta savol,
//    qiyinlik, ball), mavzular va aniq savollar «Batafsil» da, kam ishlatiladiganlar «Qo'shimcha»
//    da; 3) «Variantlarni yig'ish» — «Imtihonlar» tabida jadval va tasdiqlash. Qatnashchilar,
//    smena vaqti, o'rinlar, onlayn va ruxsatnoma — «Qatnashchilar» tabida; o'tish bali, reyting
//    va xabar — «Natijalar» tabida. Yangi imtihon markaz standartidan boshlanadi (lib/imtihonSozlama.js).

const yangiId = () => Math.random().toString(36).slice(2, 9);

/**
 * Mavjud imtihonda forma faqat shularni yuboradi — tablarda saqlangan o'tkazish va natija
 * sozlamalari (forma ochilgandan keyin o'zgargan bo'lishi mumkin) eski qiymat bilan bosilmaydi.
 */
const TUZILMA_KALITLARI = [
  'source', 'sessions', 'sessionQuestions', 'variantSavollari', 'variantCount', 'shuffleQuestions', 'shuffleOptions', 'variantBubble',
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

type Manba = 'bank' | 'kalit';
type Shablon = 'dtm' | 'bitta' | 'nusxa';

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
  const { selectedSchoolId, user, addExam, updateExam, imtihonniYangila, showNotification } = useCRM();
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
  // Yangi imtihon avval «Yangi imtihon» oynasidan boshlanadi (nomi, manba, qanday imtihon).
  const [boshlandi, setBoshlandi] = useState(tahrir);
  const [qoshimcha, setQoshimcha] = useState(false);
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
  // Variantlarda savollar: sozlamada yo'q bo'lsa — server standarti «har xil».
  const harXil = (sozlama.variantSavollari ?? 'har') === 'har' && sozlama.variantCount > 1;

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
      // «Imtihonlar» tabida bank yetsa variantlar o'zi yig'iladi — jadval va «Tasdiqlash».
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

  // Smenalar soni: variantlar har smenaga alohida yasaladi, shuning uchun qulfgacha. Nomi va vaqti — «Qatnashchilar» tabida.
  const smenaSoni = (n: number) => s({ sessions: Array.from({ length: n }, (_, i) => sozlama.sessions[i] || { id: i + 1, name: `${i + 1}-smena`, time: '' }) });

  // DTM tuzilmasi: 5 blok; bank rejimida fanlar bankdagi nomi bo'yicha topiladi.
  const dtmTuzilmasi = (kalit = kalitRejimi) => {
    setScoring('blok');
    setBloklar(DTM_TUZILMASI.map(b => {
      const yangi = { ...b, id: yangiId() };
      if (kalit || !daraxt) return yangi;
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

  if (!boshlandi) {
    return (
      <YangiImtihonOynasi nom={nom} setNom={setNom} sana={sana} setSana={setSana} bankTayyor={!!daraxt}
        onOrqaga={() => navigate('/exams?tab=imtihonlar')}
        onSorovnoma={() => navigate('/exams/new?tur=sorovnoma')}
        onNusxa={async eskiId => {
          try {
            const yangi = await soro<Exam>('POST', `exams/${eskiId}/copy`);
            const nomli = await soro<Exam>('PUT', `exams/${yangi.id}`, { name: nom.trim(), date: sana });
            imtihonniYangila(nomli);
            navigate(`/exams/${yangi.id}/edit`);
          } catch (e: any) {
            showNotification(e.message, 'error');
          }
        }}
        onDavom={(manba, shablon) => {
          s({ source: manba });
          if (manba === 'kalit') {
            setBloklar([{ id: yangiId(), subject: '', pointsPerQuestion: 1, topicRules: [{ topic: '', count: 10, type: 'yopiq' }] }]);
          } else if (shablon === 'dtm') {
            dtmTuzilmasi(false);
          } else {
            setBloklar([{ id: yangiId(), subject: '', pointsPerQuestion: 1, topicRules: [] }]);
          }
          setBoshlandi(true);
        }} />
    );
  }

  const qulfIzoh = qulf ? 'Savollar qulflangan — bu qism o\'zgarmaydi' : undefined;
  // «Qo'shimcha» yopiq turganda — nimalar qo'yilgani bir qatorda.
  const qoshimchaXulosa = [
    `${sozlama.sessions.length} smena`,
    scoring === 'blok' ? 'blok bali' : 'foiz',
    sozlama.xatoJarima ? `jarima ${Math.round(sozlama.xatoJarima * 100)}%` : "jarima yo'q",
    !kalitRejimi && (sozlama.shuffleOptions ? 'javoblar aralashadi' : 'javoblar aralashmaydi'),
    !kalitRejimi && ({ '': 'hamma til', uz: "o'zbekcha", ru: 'ruscha', en: 'inglizcha' } as const)[sozlama.language],
  ].filter(Boolean).join(' · ');

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button aria-label="Orqaga" onClick={() => (tahrir ? navigate(`/exams?tab=imtihonlar&imtihon=${id}`) : setBoshlandi(false))}
            className="w-10 h-10 shrink-0 bg-sirt border border-chiziq rounded-xl flex items-center justify-center text-matn-sokin hover:text-brand cursor-pointer"><ArrowLeft size={18} /></button>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-matn truncate">{tahrir ? 'Imtihon rejasi' : nom.trim() || 'Yangi imtihon'}</h1>
            <p className="text-[12px] text-matn-xira">
              {kalitRejimi ? "O'z kitobchasi — faqat kalit" : 'Savollar bankidan'} · {tuzilma.savolSoni ?? tuzilma.jami} ta savol · eng yuqori ball {tuzilma.maks}
            </p>
          </div>
          {qulf && <Yorliq rang="brand"><Lock size={11} /> Qulflangan</Yorliq>}
        </div>
        <Tugma turi="asosiy" ikonka={tahrir ? <Save size={14} /> : undefined} yuklanmoqda={saqlanmoqda} onClick={saqla}>
          {tahrir ? 'Saqlash' : kalitRejimi ? 'Yaratish' : <>Variantlarni yig'ish <ArrowRight size={14} /></>}
        </Tugma>
      </div>

      <Karta sarlavha="Asosiy">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Maydon nom="Nomi" className="lg:col-span-2"><input className={INPUT} value={nom} onChange={e => setNom(e.target.value)} placeholder="Oylik DTM sinov — oktabr" /></Maydon>
          <Maydon nom="Sana"><input type="date" className={INPUT} value={sana} onChange={e => setSana(e.target.value)} /></Maydon>
          <Maydon nom="Davomiyligi (daqiqa)"><input type="number" min={10} max={600} className={INPUT} value={davom} onChange={e => setDavom(Number(e.target.value))} /></Maydon>
        </div>
      </Karta>

      <Karta sarlavha="Reja" izoh={qulfIzoh || (kalitRejimi
        ? `Har fan — alohida blok, kitobchadagi tartibda. Varaqda har fanda avval ${TUR_NOMI.yopiq.toLowerCase()}, keyin ${TUR_NOMI.raqamli.toLowerCase()}, keyin ${TUR_NOMI.yozma.toLowerCase()} savollar turadi — kitobcha raqamlari shunga mos bo'lsin.`
        : "Har fan — bitta qator: nechta savol, qiyinlik va ball. Savollar fanning hamma mavzusidan olinadi; mavzularni tanlash va aniq savollar — «Batafsil» da.")}
        amallar={!qulf && <Tugma kichik ikonka={<Wand2 size={14} />} onClick={() => dtmTuzilmasi()}>DTM tuzilmasi</Tugma>}>
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
            : { id: yangiId(), subject: '', pointsPerQuestion: 1, topicRules: [] }])}>Fan qo'shish</Tugma>}
          <div className="flex flex-wrap gap-2 pt-1 text-[12px] text-matn-sokin">
            <Yorliq>{tuzilma.yopiq} ta {TUR_NOMI.yopiq.toLowerCase()}</Yorliq>{tuzilma.raqamli > 0 && <Yorliq>{tuzilma.raqamli} ta {TUR_NOMI.raqamli.toLowerCase()}</Yorliq>}{(tuzilma.moslash || 0) > 0 && <Yorliq>{tuzilma.moslash} ta {TUR_NOMI.moslash.toLowerCase()}</Yorliq>}{tuzilma.yozma > 0 && <Yorliq>{tuzilma.yozma} ta {TUR_NOMI.yozma.toLowerCase()}</Yorliq>}<Yorliq rang="brand">Eng yuqori ball: {tuzilma.maks}</Yorliq>
          </div>
        </div>
      </Karta>

      <Karta sarlavha="Variantlar" izoh={qulfIzoh || (kalitRejimi ? "Nechta turdagi kitobchangiz bor (A, B, C…) — har biriga kalit alohida kiritiladi" : "O'quvchi varaqda variant harfini bo'yaydi; yonma-yon o'tirganlarga har xil variant tushadi")}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Maydon nom={kalitRejimi ? 'Kitobcha variantlari' : 'Variantlar soni'}>
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
          {!kalitRejimi && sozlama.variantCount > 1 && (
            <Maydon div nom="Variantlarda savollar" izoh={harXil
              ? "Har variantning o'z savollari: masalan, 9-o'rin hamma variantda «Geometriya · qiyin», lekin savolning o'zi boshqa. Bank kam bo'lsa savol boshqa variantda takrorlanadi (variant ichida — hech qachon)."
              : 'Hamma variantda shu savollar — faqat tartibi va javob harflari aralashadi'}>
              <Tanlov qiymat={harXil ? 'har' : 'bir'} disabled={qulf} onChange={v => s({ variantSavollari: v })}
                variantlar={[{ v: 'har', nom: 'Har xil — mavzu va qiyinligi bir xil' }, { v: 'bir', nom: 'Bir xil — faqat tartibi aralashadi' }]} />
            </Maydon>
          )}
        </div>
      </Karta>

      <section className="bg-sirt border border-chiziq rounded-2xl shadow-sm">
        <button type="button" onClick={() => setQoshimcha(v => !v)} aria-expanded={qoshimcha}
          className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer">
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-matn">Qo'shimcha sozlamalar</span>
            {!qoshimcha && <span className="block text-[12px] text-matn-xira mt-0.5">{qoshimchaXulosa}</span>}
          </span>
          <ChevronDown size={18} className={`text-matn-xira transition-transform ${qoshimcha ? 'rotate-180' : ''}`} />
        </button>
        {qoshimcha && (
          <div className="px-4 pb-4 space-y-5 border-t border-chiziq pt-4">
            {/* «O'z kitobcham» yangi imtihonda yo'q — faqat shunday yaratilgan eski imtihonda ko'rinadi. */}
            {tahrir && kalitRejimi && (
              <Maydon div nom="Savollar manbasi" izoh={qulfIzoh || (kalitRejimi
                ? "O'z test kitobchangiz: CRM ga faqat har variantning javob kaliti yoziladi, kitobchani o'zingiz chop etasiz."
                : 'Savollar bankdan olinadi, variantlar va kitobchalarni CRM o\'zi tuzadi va chop etadi.')}>
                <Tanlov qiymat={sozlama.source} disabled={qulf} onChange={v => s({ source: v })}
                  variantlar={[{ v: 'bank', nom: 'Savollar bankidan' }, { v: 'kalit', nom: "O'z kitobchasi — faqat kalit" }]} />
              </Maydon>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Maydon div nom="Ball tizimi" izoh={scoring === 'blok' ? "Har fan savoliga o'z bali (DTM: 3.1 / 2.1 / 1.1)" : "Har savol 1 ball, natija foizda"}>
                <Tanlov qiymat={scoring} disabled={qulf} onChange={v => setScoring(v)} variantlar={[{ v: 'blok', nom: 'Blok bali (DTM)' }, { v: 'foiz', nom: 'Foiz' }]} />
              </Maydon>
              <JarimaTanlovi s={sozlama} qoy={s} qulf={qulf} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Maydon nom="Smenalar soni" izoh="Nomi va vaqti — «Qatnashchilar» tabida">
                <select className={SELECT} disabled={qulf} value={sozlama.sessions.length} onChange={e => smenaSoni(Number(e.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} ta</option>)}
                </select>
              </Maydon>
              {sozlama.sessions.length > 1 && (
                <Maydon div nom="Smenalarga savollar" izoh={sozlama.sessionQuestions === 'alohida' ? "Keyingi smenaga oldingisidagi savollar tushmaydi — bank ko'proq kerak" : 'Hamma smena bir xil savollarni oladi'}>
                  <Tanlov qiymat={sozlama.sessionQuestions} disabled={qulf} onChange={v => s({ sessionQuestions: v })} variantlar={[{ v: 'bir', nom: 'Bir xil' }, { v: 'alohida', nom: 'Har smenaga boshqa' }]} />
                </Maydon>
              )}
            </div>
            {!kalitRejimi && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Maydon nom="Savollar tili" izoh="Bankdan faqat shu tildagi savollar olinadi">
                  <select className={SELECT} disabled={qulf} value={sozlama.language} onChange={e => s({ language: e.target.value as any })}>
                    <option value="">Hamma til</option><option value="uz">O'zbekcha</option><option value="ru">Ruscha</option><option value="en">Inglizcha</option>
                  </select>
                </Maydon>
                <Maydon nom="Ko'p ishlatilganini olmaslik" izoh={sozlama.ishlatishChegarasi == null
                  ? 'Cheklovsiz — kam ishlatilgani baribir birinchi olinadi'
                  : `Bankdan faqat ${sozlama.ishlatishChegarasi} martagacha ishlatilgan savollar olinadi (qo'lda tanlanganlar — baribir)`}>
                  <div className="flex items-center gap-2 text-[12.5px] text-matn-sokin">
                    ishlatilgani ≤
                    <div className="w-24">
                      <input type="number" min={0} max={1000} disabled={qulf} className={INPUT} placeholder="∞" aria-label="Ishlatish chegarasi"
                        value={sozlama.ishlatishChegarasi ?? ''} onChange={e => s({ ishlatishChegarasi: e.target.value === '' ? null : Math.max(0, Math.min(1000, Math.round(Number(e.target.value) || 0))) })} />
                    </div>
                    marta
                  </div>
                </Maydon>
                <Maydon div nom="Takroriy savollar" izoh={sozlama.takror === 'yoq' ? "Tekshirilmaydi — bankdagi bir xil savol ikki marta tushishi mumkin" : sozlama.takror === 'savol' ? "Matni (va rasmi) bir xil savollardan bittasi olinadi" : "Matni va javob variantlari bir xil savollardan bittasi olinadi"}>
                  <Tanlov qiymat={sozlama.takror} disabled={qulf} onChange={v => s({ takror: v })}
                    variantlar={[{ v: 'variant', nom: 'Matn + variantlar' }, { v: 'savol', nom: 'Faqat matn' }, { v: 'yoq', nom: "Yo'q" }]} />
                </Maydon>
              </div>
            )}
            <div className="space-y-3">
              {!kalitRejimi && (
                <>
                  <Almashtirgich yoqilgan={sozlama.shuffleOptions} disabled={qulf} onChange={v => s({ shuffleOptions: v })} nom="Javob variantlari aralashsin" izoh="Belgilangan savollardan tashqari (A va B to'g'ri kabi)" />
                  <Almashtirgich yoqilgan={sozlama.shuffleQuestions && !harXil} disabled={qulf || harXil} onChange={v => s({ shuffleQuestions: v })} nom="Fan ichida savollar tartibi aralashsin"
                    izoh={harXil ? "«Har xil» variantlarda o'rinlar hamma variantda bir xil — tartib aralashmaydi" : "Matnga bog'langan savollar birga qoladi"} />
                </>
              )}
              <Almashtirgich yoqilgan={sozlama.variantBubble} onChange={v => s({ variantBubble: v })} nom="O'quvchi varaqqa kitobcha variantini ham bo'yaydi" izoh="Kitobcha almashib qolsa, skaner ushlaydi" />
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-ichki px-3 py-2 text-[12px] text-matn-sokin">
              <Info size={14} className="shrink-0 mt-0.5 text-brand" />
              <span>Qatnashchilar, smena vaqti, o'rinlar, onlayn test va ruxsatnoma — «Qatnashchilar» tabida; o'tish bali, reyting va xabar — «Natijalar» tabida. {tahrir ? '' : 'Yangi imtihon ularni markaz standartidan oladi (Imtihonlar → Sozlamalar).'}</span>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * «Yangi imtihon» — boshqa tizimlardagidek avval uchta savol: nomi va sanasi, savollar qayerdan
 * (bank yoki o'z kitobchasi) va qanday imtihon (DTM / bitta fan / avvalgisidek). Qolgani — standart.
 */
function YangiImtihonOynasi({ nom, setNom, sana, setSana, bankTayyor, onOrqaga, onDavom, onNusxa, onSorovnoma }: {
  nom: string; setNom: (v: string) => void; sana: string; setSana: (v: string) => void; bankTayyor: boolean;
  onOrqaga: () => void; onDavom: (manba: Manba, shablon: Shablon) => void; onNusxa: (examId: number) => Promise<void>;
  onSorovnoma: () => void;
}) {
  const { exams } = useCRM();
  // Savollar doim bankdan: «o'z kitobcham» (faqat kalit) ishlatilmagan — oynadan olindi (2026-10-29).
  // Server va eski imtihonlar uchun u rejim qoladi.
  const [shablon, setShablon] = useState<Shablon>('dtm');
  const [nusxaId, setNusxaId] = useState<number | ''>('');
  const [band, setBand] = useState(false);
  // Nusxa uchun — bankdan yoki kalitli imtihonlar (so'rovnoma emas), yangisi tepada.
  const avvalgilar = [...exams].filter(e => e.settings?.source !== 'sorovnoma')
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id).slice(0, 60);
  const tayyor = !!nom.trim() && (shablon === 'nusxa' ? !!nusxaId : shablon !== 'dtm' || bankTayyor);

  const davom = async () => {
    if (!tayyor) return;
    if (shablon === 'nusxa') {
      setBand(true);
      try { await onNusxa(Number(nusxaId)); } finally { setBand(false); }
      return;
    }
    onDavom('bank', shablon);
  };

  return (
    <div className="max-w-3xl mx-auto pb-24 space-y-4">
      <div className="flex items-center gap-3">
        <button aria-label="Orqaga" onClick={onOrqaga} className="w-10 h-10 bg-sirt border border-chiziq rounded-xl flex items-center justify-center text-matn-sokin hover:text-brand cursor-pointer"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-[16px] font-bold text-matn">Yangi imtihon</h1>
          <p className="text-[12px] text-matn-xira">Ikkita savol — qolganini keyin o'zgartirsa bo'ladi</p>
        </div>
      </div>

      <Karta sarlavha="1. Nomi va sanasi">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Maydon nom="Nomi" className="sm:col-span-2"><input autoFocus className={INPUT} value={nom} onChange={e => setNom(e.target.value)} placeholder="Oylik DTM sinov — noyabr" /></Maydon>
          <Maydon nom="Sana"><input type="date" className={INPUT} value={sana} onChange={e => setSana(e.target.value)} /></Maydon>
        </div>
      </Karta>

      {(
        <Karta sarlavha="2. Qanday imtihon?" izoh="Savollar bankdan olinadi — variantlar, kitobcha va kalitni CRM o'zi tuzadi">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <TanlovKartasi faol={shablon === 'dtm'} onClick={() => setShablon('dtm')} ikonka={<Layers size={18} />} nomi="DTM blok testi" izoh="5 fan · 90 savol · 1.1 / 3.1 / 2.1 ball" />
            <TanlovKartasi faol={shablon === 'bitta'} onClick={() => setShablon('bitta')} ikonka={<FileText size={18} />} nomi="Bitta fan" izoh="Fanni va savollar sonini o'zingiz tanlaysiz" />
            <TanlovKartasi faol={shablon === 'nusxa'} onClick={() => setShablon('nusxa')} ikonka={<Copy size={18} />} nomi="Avvalgisidek" izoh="Oldingi imtihonning rejasi nusxalanadi" />
          </div>
          {shablon === 'nusxa' && (
            <div className="mt-3">
              <Maydon nom="Qaysi imtihondek">
                <select className={SELECT} value={nusxaId} onChange={e => setNusxaId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Imtihonni tanlang</option>
                  {avvalgilar.map(e => <option key={e.id} value={e.id}>{e.name} — {sanaMatni(e.date)} · {e.totalQuestions} savol</option>)}
                </select>
              </Maydon>
            </div>
          )}
          {shablon === 'dtm' && !bankTayyor && <p className="mt-2 text-[12px] text-matn-xira">Savollar banki yuklanmoqda…</p>}
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-matn-sokin">
            <button type="button" onClick={onSorovnoma} className="inline-flex items-center gap-1 text-brand hover:underline cursor-pointer"><MessageSquareText size={13} /> So'rovnoma</button>
          </p>
        </Karta>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-matn-xira max-w-md">Variantlar soni, smenalar, ball va boshqalar markaz standartidan olinadi — keyingi oynada o'zgartirsa bo'ladi.</p>
        <Tugma turi="asosiy" yuklanmoqda={band} disabled={!tayyor} onClick={davom}>Davom etish <ArrowRight size={14} /></Tugma>
      </div>
    </div>
  );
}

/** «Yangi imtihon» dagi katta tanlov tugmasi: ikonka, nomi va bir qator izoh. */
function TanlovKartasi({ faol, onClick, ikonka, nomi, izoh }: { faol: boolean; onClick: () => void; ikonka: React.ReactNode; nomi: string; izoh: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={faol}
      className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left cursor-pointer transition-colors ${faol ? 'border-brand bg-brand-fon/60 ring-2 ring-brand/20 dark:bg-brand/15' : 'border-chiziq bg-sirt hover:border-chiziq-kuchli'}`}>
      <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${faol ? 'bg-brand text-brand-ust' : 'bg-ichki text-matn-sokin'}`}>{ikonka}</span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-matn">{nomi}</span>
        <span className="block text-[12px] text-matn-sokin mt-0.5 leading-snug">{izoh}</span>
      </span>
    </button>
  );
}
