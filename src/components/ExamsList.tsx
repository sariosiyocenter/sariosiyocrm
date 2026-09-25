import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, FileText, BookOpen, Calendar, Users, ChevronRight, Lock, ScanLine, ClipboardCheck, BarChart3, Printer, History, ExternalLink, KeyRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import QuestionsList from './QuestionsList';
import { Karta, Tugma, Yorliq, HOLAT_RANGI, BoshHolat, INPUT, SELECT, Tanlov, Yuklanmoqda } from './imtihon/ui';
import { useImtihonTafsil } from './imtihon/useImtihonTafsil';
import QatnashchilarTab from './imtihon/QatnashchilarTab';
import ChopEtishTab from './imtihon/ChopEtishTab';
import SkanerTab from './imtihon/SkanerTab';
import TekshirishTab from './imtihon/TekshirishTab';
import NatijalarTab from './imtihon/NatijalarTab';
import TarixBolimi from './imtihon/TarixBolimi';
import { sanaMatni } from './imtihon/format';
import { toDateStr } from '../../lib/lessons.js';
import type { Exam } from '../types';

// Imtihonlar moduli — egasi yuborgan 6 ta modul (docs/IMTIHON_PLAN.md, 2.4) bo'yicha
// 6 ta bo'lim: 1 Savollar banki · 2 Imtihonlar (tuzilma) · 3 O'rinlashtirish ·
// 4 Chop etish · 5 Skaner (OMR va tekshirish) · 6 Natijalar va tarix.
// 3–6-bo'limlar tanlangan imtihon bilan ishlaydi — imtihon sahifasidagi
// bo'limlarning o'zi, faqat tepada imtihon tanlanadi.

type TabId = 'savollar' | 'imtihonlar' | 'orin' | 'chop' | 'skaner' | 'natija';

// Imtihon qanday o'tadi — bo'sh holatda ko'rsatiladigan qisqa yo'riqnoma.
const QADAMLAR = [
  ['Savollar banki', "Savollar qo'lda, Excel yoki AI import bilan kiritiladi. O'z kitobchangiz bo'lsa — bu qadam shart emas."],
  ['Imtihon', "Fanlar va savollar sonini tanlaysiz. Manba: bank yoki «faqat kalit» (o'z kitobchangiz). So'ng «qulflash» — variantlar tayyor."],
  ["O'rinlashtirish", "Kurslar va xonalar tanlanadi — har o'ringa variant, yonma-yon o'tirganlarga har xil."],
  ['Chop etish', "Kitobchalar (bank rejimida) va har o'quvchiga shaxsiy javob varaqasi — ismi, o'rni va QR kodi bilan."],
  ['Skaner', "Varaqlar pachkasi skanerdan PDF qilib yoki telefon kamerasi bilan yuklanadi: QR dan o'quvchi, doirachalardan javoblar o'qiladi, ball o'zi hisoblanadi."],
  ['Natijalar', "Shubhali belgilarni tekshirasiz, e'lon qilasiz — ota-onaga SMS/Telegram, reyting, tahlil va tarix."],
] as const;

function standartImtihon(tab: TabId, exams: Exam[]): number | null {
  const bugun = toDateStr();
  const oxirgi = [...exams].sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const oldinda = exams.filter(e => !e.publishedAt && String(e.date) >= bugun).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (tab === 'orin' || tab === 'chop') return (oldinda[0] || oxirgi[0])?.id ?? null;
  if (tab === 'skaner') return (oxirgi.find(e => e.lockedAt && !e.publishedAt && String(e.date) <= bugun) || oxirgi.find(e => e.lockedAt && !e.publishedAt) || oxirgi.find(e => e.lockedAt) || oxirgi[0])?.id ?? null;
  return (oxirgi.find(e => ((e as any)._count?.results || 0) > 0) || oxirgi[0])?.id ?? null;
}

export default function ExamsList() {
  const { exams, kora, ozgartira, schools } = useCRM();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  // Telefonda tablar gorizontal suriladi — faol tab ko'rinib tursin.
  const faolRef = useRef<HTMLButtonElement>(null);

  const TABLAR = [
    { id: 'savollar', nom: 'Savollar banki', ikonka: BookOpen, ochiq: kora('imtihonlar.savollar') },
    { id: 'imtihonlar', nom: 'Imtihonlar', ikonka: FileText, ochiq: kora('imtihonlar.imtihon') || kora('imtihonlar.natija') },
    { id: 'orin', nom: "O'rinlashtirish", ikonka: Users, ochiq: kora('imtihonlar.imtihon') },
    { id: 'chop', nom: 'Chop etish', ikonka: Printer, ochiq: kora('imtihonlar.imtihon') },
    { id: 'skaner', nom: 'Skaner', ikonka: ScanLine, ochiq: kora('imtihonlar.natija') },
    { id: 'natija', nom: 'Natijalar va tarix', ikonka: BarChart3, ochiq: kora('imtihonlar.natija') },
  ].filter(t => t.ochiq) as { id: TabId; nom: string; ikonka: typeof BookOpen }[];
  const tab = (TABLAR.find(t => t.id === params.get('tab'))?.id || (TABLAR.some(t => t.id === 'imtihonlar') ? 'imtihonlar' : TABLAR[0]?.id)) as TabId;
  const ozgartir = (patch: Record<string, string | null>) => setParams(p => {
    for (const [k, v] of Object.entries(patch)) { if (v === null) p.delete(k); else p.set(k, v); }
    return p;
  }, { replace: true });
  const tabga = (t: TabId) => ozgartir({ tab: t === 'imtihonlar' ? null : t, k: null });
  useEffect(() => { faolRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [tab]);

  // Tanlangan imtihon bo'limlar orasida saqlanadi (URL da).
  const tanlangan = Number(params.get('imtihon')) || standartImtihon(tab, exams);
  const imtihonTanla = (id: number) => ozgartir({ imtihon: String(id) });
  const imtihonBolimi = tab === 'orin' || tab === 'chop' || tab === 'skaner' || (tab === 'natija' && params.get('k') !== 'tarix');

  const royxat = [...exams]
    .filter(e => (e.name || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const filialNomi = (id: number) => schools.find(s => s.id === id)?.name || '';

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      <nav className="flex gap-1 overflow-x-auto bg-sirt border border-chiziq rounded-2xl p-1 shadow-sm">
        {TABLAR.map((t, i) => {
          const Ikonka = t.ikonka;
          const faol = t.id === tab;
          return (
            <button key={t.id} ref={faol ? faolRef : undefined} onClick={() => tabga(t.id)} aria-current={faol ? 'page' : undefined}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${faol ? 'bg-brand text-brand-ust' : 'text-matn-sokin hover:text-matn hover:bg-ichki'}`}>
              <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center ${faol ? 'bg-white/20' : 'bg-ichki'}`}>{i + 1}</span>
              <Ikonka size={14} /> {t.nom}
            </button>
          );
        })}
      </nav>

      {tab === 'savollar' && <QuestionsList />}

      {tab === 'imtihonlar' && (
        <Karta sarlavha="Imtihonlar" izoh="Tuzish → o'rinlashtirish → chop etish → skaner → natija"
          amallar={
            <>
              <div className="relative w-56">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
                <input className={`${INPUT} pl-9 py-2`} placeholder="Qidirish" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {ozgartira('imtihonlar.imtihon') && <Tugma turi="asosiy" kichik ikonka={<Plus size={14} />} onClick={() => navigate('/exams/new')}>Yangi imtihon</Tugma>}
            </>
          }>
          {!royxat.length ? (
            exams.length ? <BoshHolat ikonka={<FileText size={22} />} sarlavha="Qidiruvga mos imtihon yo'q" /> : <Yoriqnoma yangi={ozgartira('imtihonlar.imtihon') ? () => navigate('/exams/new') : undefined} />
          ) : (
            <ul className="divide-y divide-chiziq -mx-4 -mb-4">
              {royxat.map(e => (
                <li key={e.id}>
                  <button onClick={() => navigate(`/exams/${e.id}`)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ichki/60 cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-brand-fon border border-brand/20 dark:bg-brand/15 flex items-center justify-center text-brand shrink-0">
                      {e.settings?.source === 'kalit' ? <KeyRound size={18} /> : <FileText size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-matn truncate">{e.name}</span>
                        <Yorliq rang={HOLAT_RANGI[e.status] || 'kulrang'}>{e.lockedAt && e.status !== "E'lon qilindi" && <Lock size={10} />}{e.status}</Yorliq>
                        {e.settings?.source === 'kalit' && <Yorliq>kalit bilan</Yorliq>}
                        {(e.branchIds || []).length > 0 && <Yorliq>{[e.schoolId, ...e.branchIds].map(filialNomi).filter(Boolean).join(' + ')}</Yorliq>}
                      </div>
                      <p className="text-[12px] text-matn-xira mt-0.5 flex flex-wrap gap-x-3">
                        <span className="inline-flex items-center gap-1"><Calendar size={12} />{e.date}</span>
                        <span>{e.totalQuestions} savol · {e.maxScore} ball</span>
                        <span>{e.blocks?.length || 0} fan</span>
                        {!!(e as any)._count?.seats && <span className="inline-flex items-center gap-1"><Users size={12} />{(e as any)._count.seats}</span>}
                        {!!(e as any)._count?.results && <span>{(e as any)._count.results} natija</span>}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-matn-xira shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Karta>
      )}

      {tab === 'natija' && (
        <Tanlov qiymat={params.get('k') === 'tarix' ? 'tarix' : 'natija'} onChange={v => ozgartir({ k: v === 'tarix' ? 'tarix' : null })}
          variantlar={[{ v: 'natija', nom: <><BarChart3 size={13} className="inline mr-1" />Imtihon natijalari</> }, { v: 'tarix', nom: <><History size={13} className="inline mr-1" />Tarix</> }]} />
      )}
      {tab === 'natija' && params.get('k') === 'tarix' && <TarixBolimi onImtihon={id => ozgartir({ imtihon: String(id), k: null })} />}

      {imtihonBolimi && (
        !exams.length ? (
          <Karta><Yoriqnoma yangi={ozgartira('imtihonlar.imtihon') ? () => navigate('/exams/new') : undefined} /></Karta>
        ) : (
          <ImtihonBolimi tab={tab} examId={tanlangan} exams={exams} onTanla={imtihonTanla}
            korinish={params.get('k') === 'tekshirish' ? 'tekshirish' : 'skaner'} onKorinish={k => ozgartir({ k: k === 'tekshirish' ? 'tekshirish' : null })} />
        )
      )}
    </div>
  );
}

/** Imtihon tanlash qatori va tanlangan imtihonning bo'limi (O'rinlashtirish / Chop etish / Skaner / Natijalar). */
function ImtihonBolimi({ tab, examId, exams, onTanla, korinish, onKorinish }: {
  tab: TabId; examId: number | null; exams: Exam[]; onTanla: (id: number) => void;
  korinish: 'skaner' | 'tekshirish'; onKorinish: (k: 'skaner' | 'tekshirish') => void;
}) {
  const navigate = useNavigate();
  const { exam, xato, yangila } = useImtihonTafsil(examId);
  const bugun = toDateStr();
  // Tanlovda avval oldindagi (e'lon qilinmagan) imtihonlar, keyin qolganlari — yangisi tepada.
  const tartib = useMemo(() => {
    const oldinda = exams.filter(e => !e.publishedAt && String(e.date) >= bugun).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const qolgan = exams.filter(e => !oldinda.includes(e)).sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
    return [...oldinda, ...qolgan];
  }, [exams, bugun]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-sirt border border-chiziq rounded-2xl px-3 py-2.5 shadow-sm">
        <span className="text-[12.5px] font-semibold text-matn-sokin shrink-0">Imtihon</span>
        <select aria-label="Imtihonni tanlang" className={`${SELECT} py-2 sm:max-w-xl`} value={examId ?? ''} onChange={e => onTanla(Number(e.target.value))}>
          {tartib.map(e => <option key={e.id} value={e.id}>{e.name} — {sanaMatni(e.date)} · {e.status}{e.settings?.source === 'kalit' ? ' · kalit bilan' : ''}</option>)}
        </select>
        {tab === 'skaner' && (
          <Tanlov kichik qiymat={korinish} onChange={onKorinish}
            variantlar={[{ v: 'skaner', nom: <><ScanLine size={13} className="inline mr-1" />Skanerlash</> }, { v: 'tekshirish', nom: <><ClipboardCheck size={13} className="inline mr-1" />Tekshirish</> }]} />
        )}
        {examId && <Tugma kichik turi="oddiy" className="sm:ml-auto" ikonka={<ExternalLink size={13} />} onClick={() => navigate(`/exams/${examId}`)}>Imtihon sahifasi</Tugma>}
      </div>
      {xato ? <Karta><BoshHolat sarlavha="Imtihon ochilmadi" izoh={xato} /></Karta>
        : !exam ? <Yuklanmoqda />
          : tab === 'orin' ? <QatnashchilarTab exam={exam} yangila={yangila} />
            : tab === 'chop' ? <ChopEtishTab exam={exam} />
              : tab === 'skaner' ? (korinish === 'tekshirish' ? <TekshirishTab exam={exam} yangila={yangila} /> : <SkanerTab exam={exam} yangila={yangila} />)
                : <NatijalarTab exam={exam} yangila={yangila} />}
    </div>
  );
}

/** Hali imtihon yo'q — qanday boshlash kerak. */
function Yoriqnoma({ yangi }: { yangi?: () => void }) {
  return (
    <div className="space-y-4 py-2">
      <BoshHolat ikonka={<FileText size={22} />} sarlavha="Hali imtihon yo'q" izoh="Imtihon quyidagi tartibda o'tadi. O'z test kitobchangiz bo'lsa — savollar bankisiz, «faqat kalit» rejimida ham bo'ladi.">
        {yangi && <Tugma turi="asosiy" ikonka={<Plus size={14} />} onClick={yangi}>Yangi imtihon</Tugma>}
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
