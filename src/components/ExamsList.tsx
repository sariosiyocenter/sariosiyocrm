import React, { useEffect, useRef, useState } from 'react';
import { Search, Plus, FileText, BookOpen, Calendar, Users, ChevronRight, ChevronDown, Lock, ScanLine, ClipboardCheck, BarChart3, Printer, History, KeyRound, Check, Settings2, Copy, Trash2, List, Clock } from 'lucide-react';
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
import SkanerTab from './imtihon/SkanerTab';
import TekshirishTab from './imtihon/TekshirishTab';
import NatijalarTab from './imtihon/NatijalarTab';
import TarixBolimi from './imtihon/TarixBolimi';
import { sanaMatni } from './imtihon/format';
import { toDateStr } from '../../lib/lessons.js';
import type { Exam } from '../types';
import type { ImtihonTafsil, TabId } from './imtihon/turlar';

// Imtihonlar moduli — bitta ish joyi. Tablar imtihonning bosqichlari:
// 1 Savollar banki (hamma imtihon uchun umumiy) · 2 Imtihonlar (ro'yxat va
// tanlangan imtihonning tuzilmasi, kaliti, qulfi) · 3 O'rinlashtirish ·
// 4 Chop etish · 5 Skaner (skanerlash va tekshirish) · 6 Natijalar (va tarix).
// 2–6-tablar tepadagi paneldagi imtihon bilan ishlaydi (URL da `imtihon=`),
// har tabda o'sha imtihonning shu bosqichdagi holati ko'rinadi.

// Imtihon qanday o'tadi — bo'sh holatda ko'rsatiladigan qisqa yo'riqnoma.
const QADAMLAR = [
  ['Savollar banki', "Savollar qo'lda, Excel yoki AI import bilan kiritiladi. O'z kitobchangiz bo'lsa — bu qadam shart emas."],
  ['Imtihon', "Fanlar va savollar sonini tanlaysiz. Manba: bank yoki «faqat kalit» (o'z kitobchangiz). So'ng «qulflash» — variantlar tayyor."],
  ["O'rinlashtirish", "Kurslar va xonalar tanlanadi — har o'ringa variant, yonma-yon o'tirganlarga har xil."],
  ['Chop etish', "Kitobchalar (bank rejimida) va har o'quvchiga shaxsiy javob varaqasi — ismi, o'rni va QR kodi bilan."],
  ['Skaner', "Varaqlar pachkasi skanerdan PDF qilib yoki telefon kamerasi bilan yuklanadi: QR dan o'quvchi, doirachalardan javoblar o'qiladi, ball o'zi hisoblanadi."],
  ['Natijalar', "Shubhali belgilarni tekshirasiz, e'lon qilasiz — ota-onaga SMS/Telegram, reyting, tahlil va tarix."],
] as const;

/** Tanlanmagan bo'lsa — shu bosqich uchun eng mos imtihon. */
function standartImtihon(tab: TabId, exams: Exam[]): number | null {
  const bugun = toDateStr();
  const oxirgi = [...exams].sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const oldinda = exams.filter(e => !e.publishedAt && String(e.date) >= bugun).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (tab === 'orin' || tab === 'chop') return (oldinda[0] || oxirgi[0])?.id ?? null;
  if (tab === 'skaner') return (oxirgi.find(e => e.lockedAt && !e.publishedAt && String(e.date) <= bugun) || oxirgi.find(e => e.lockedAt && !e.publishedAt) || oxirgi.find(e => e.lockedAt) || oxirgi[0])?.id ?? null;
  return (oxirgi.find(e => (e._count?.results || 0) > 0) || oxirgi[0])?.id ?? null;
}

/** Tabdagi belgi: bosqich tugagan (✓), sanoq va e'tibor kerakligi. */
function bosqichBelgisi(tab: TabId, e: ImtihonTafsil | null): { tayyor?: boolean; matn?: string; diqqat?: boolean } | null {
  if (!e) return null;
  const h = e.holat;
  if (tab === 'imtihonlar') return { tayyor: !!e.lockedAt };
  if (tab === 'orin') return h.orinlar ? { tayyor: true, matn: String(h.orinlar) } : null;
  if (tab === 'skaner') {
    if (!e.lockedAt || (!h.orinlar && !h.natijalar)) return null;
    return { tayyor: h.natijalar > 0 && h.skanerlanmagan === 0, matn: `${h.natijalar}/${h.natijalar + h.skanerlanmagan}`, diqqat: h.shubhali > 0 };
  }
  if (tab === 'natija') return { tayyor: !!e.publishedAt };
  return null;
}

export default function ExamsList() {
  const { exams, kora } = useCRM();
  const [params, setParams] = useSearchParams();
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
  const k = params.get('k');
  const ozgartir = (patch: Record<string, string | null>) => setParams(p => {
    for (const [kalit, v] of Object.entries(patch)) { if (v === null) p.delete(kalit); else p.set(kalit, v); }
    return p;
  }, { replace: true });
  const tabga = (t: TabId) => ozgartir({ tab: t === 'imtihonlar' ? null : t, k: null });
  useEffect(() => { faolRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [tab]);

  // Tanlangan imtihon — tablar orasida URL da saqlanadi. 3–6-tablarda
  // tanlanmagan bo'lsa, shu bosqich uchun eng mosi o'zi tanlanadi.
  const tanlangan = Number(params.get('imtihon')) || null;
  const bosqichTabi = tab === 'orin' || tab === 'chop' || tab === 'skaner' || tab === 'natija';
  useEffect(() => {
    if (tanlangan || !bosqichTabi || !exams.length) return;
    const id = standartImtihon(tab, exams);
    if (id) ozgartir({ imtihon: String(id) });
  }, [tab, tanlangan, bosqichTabi, exams]); // eslint-disable-line react-hooks/exhaustive-deps
  const { exam, xato, yangila } = useImtihonTafsil(tanlangan);
  // Tab almashganda sanoqlar yangilansin (boshqa bo'limda skanerlangan bo'lishi mumkin).
  const birinchi = useRef(true);
  useEffect(() => {
    if (birinchi.current) { birinchi.current = false; return; }
    if (tanlangan) yangila();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const tarix = tab === 'natija' && k === 'tarix';
  const tuzilmaKorinadi = kora('imtihonlar.imtihon');
  const royxatKorinadi = tab === 'imtihonlar' && (!tanlangan || !tuzilmaKorinadi);
  const panelKerak = tab !== 'savollar' && !tarix && !royxatKorinadi;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      <nav aria-label="Imtihon bosqichlari" className="flex gap-1 overflow-x-auto bg-sirt border border-chiziq rounded-2xl p-1 shadow-sm">
        {TABLAR.map((t, i) => {
          const Ikonka = t.ikonka;
          const faol = t.id === tab;
          const b = t.id === 'savollar' ? null : bosqichBelgisi(t.id, exam);
          return (
            <button key={t.id} ref={faol ? faolRef : undefined} onClick={() => tabga(t.id)} aria-current={faol ? 'page' : undefined}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${faol ? 'bg-brand text-brand-ust' : 'text-matn-sokin hover:text-matn hover:bg-ichki'}`}>
              <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center ${b?.tayyor ? (faol ? 'bg-white/25' : 'bg-yaxshi-fon text-yaxshi') : faol ? 'bg-white/20' : 'bg-ichki'}`}>
                {b?.tayyor ? <Check size={12} strokeWidth={3} aria-label="bajarilgan" /> : i + 1}
              </span>
              <Ikonka size={14} /> {t.nom}
              {b?.matn && <span className={`raqam text-[11px] font-bold px-1.5 py-px rounded-md ${faol ? 'bg-white/20' : 'bg-ichki text-matn-sokin'}`}>{b.matn}</span>}
              {b?.diqqat && <span className="w-2 h-2 rounded-full bg-ogoh" aria-label="tekshirilmagan varaq bor" />}
            </button>
          );
        })}
      </nav>

      {tab === 'savollar' && <QuestionsList />}

      {royxatKorinadi && <ImtihonlarRoyxati tanlangan={tanlangan} onTanla={id => ozgartir({ imtihon: String(id) })} />}

      {tab === 'natija' && (
        <Tanlov qiymat={tarix ? 'tarix' : 'natija'} onChange={v => ozgartir({ k: v === 'tarix' ? 'tarix' : null })}
          variantlar={[{ v: 'natija', nom: <><BarChart3 size={13} className="inline mr-1" />Imtihon natijalari</> }, { v: 'tarix', nom: <><History size={13} className="inline mr-1" />Tarix</> }]} />
      )}
      {tarix && <TarixBolimi onImtihon={id => ozgartir({ imtihon: String(id), k: null })} />}

      {panelKerak && (
        !exams.length ? <Karta><Yoriqnoma /></Karta>
          : xato ? (
            <Karta>
              <BoshHolat sarlavha="Imtihon ochilmadi" izoh={xato}>
                <Tugma ikonka={<List size={14} />} onClick={() => ozgartir({ tab: null, imtihon: null, k: null })}>Barcha imtihonlar</Tugma>
              </BoshHolat>
            </Karta>
          )
            : !exam || exam.id !== tanlangan ? <Yuklanmoqda />
              : (
                <>
                  <ImtihonPaneli exam={exam} onTanla={id => ozgartir({ imtihon: String(id) })} onRoyxat={() => ozgartir({ tab: null, imtihon: null, k: null })} />
                  {tab === 'skaner' && (
                    <Tanlov qiymat={k === 'tekshirish' ? 'tekshirish' : 'skaner'} onChange={v => ozgartir({ k: v === 'tekshirish' ? 'tekshirish' : null })}
                      variantlar={[
                        { v: 'skaner', nom: <span className="inline-flex items-center gap-1.5"><ScanLine size={13} />Skanerlash</span> },
                        { v: 'tekshirish', nom: <span className="inline-flex items-center gap-1.5"><ClipboardCheck size={13} />Tekshirish{exam.holat.shubhali > 0 && <span className="raqam text-[11px] font-bold px-1.5 rounded-md bg-ogoh-fon text-ogoh">{exam.holat.shubhali}</span>}</span> },
                      ]} />
                  )}
                  {tab === 'imtihonlar' && <TuzilmaTab exam={exam} yangila={yangila} otish={tabga} />}
                  {tab === 'orin' && <QatnashchilarTab exam={exam} yangila={yangila} />}
                  {tab === 'chop' && <ChopEtishTab exam={exam} />}
                  {tab === 'skaner' && (k === 'tekshirish' ? <TekshirishTab exam={exam} yangila={yangila} /> : <SkanerTab exam={exam} yangila={yangila} onTekshirish={() => ozgartir({ k: 'tekshirish' })} />)}
                  {tab === 'natija' && !tarix && <NatijalarTab exam={exam} yangila={yangila} />}
                </>
              )
      )}
    </div>
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
            <Tugma kichik ikonka={<Settings2 size={14} />} onClick={() => navigate(`/exams/${exam.id}/edit`)} aria-label="Sozlamalar"><span className="hidden sm:inline">Sozlamalar</span></Tugma>
            <Tugma kichik ikonka={<Copy size={14} />} onClick={nusxa} aria-label="Nusxa olish"><span className="hidden sm:inline">Nusxa</span></Tugma>
            {ozgartira('imtihonlar.ochirish') && <Tugma kichik turi="xavfli" ikonka={<Trash2 size={14} />} onClick={ochir} aria-label="Imtihonni o'chirish"><span className="hidden sm:inline">O'chirish</span></Tugma>}
          </>
        )}
      </div>
    </section>
  );
}

/** Hamma imtihonlar — har birida bosqichlar qayergacha yetgani. */
function ImtihonlarRoyxati({ tanlangan, onTanla }: { tanlangan: number | null; onTanla: (id: number) => void }) {
  const { exams, schools, ozgartira } = useCRM();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const royxat = [...exams]
    .filter(e => (e.name || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const filialNomi = (id: number) => schools.find(s => s.id === id)?.name || '';
  const yangi = ozgartira('imtihonlar.imtihon') ? () => navigate('/exams/new') : undefined;

  return (
    <Karta sarlavha="Imtihonlar" izoh="Imtihonni tanlang — keyingi bosqichlar (o'rinlashtirish, chop etish, skaner, natijalar) shu imtihon bilan ishlaydi"
      amallar={
        <>
          <div className="relative w-full sm:w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
            <input className={`${INPUT} pl-9 py-2`} placeholder="Qidirish" aria-label="Imtihon qidirish" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {yangi && <Tugma turi="asosiy" kichik ikonka={<Plus size={14} />} onClick={yangi}>Yangi imtihon</Tugma>}
        </>
      }>
      {!royxat.length ? (
        exams.length ? <BoshHolat ikonka={<FileText size={22} />} sarlavha="Qidiruvga mos imtihon yo'q" /> : <Yoriqnoma yangi={yangi} />
      ) : (
        <ul className="divide-y divide-chiziq -mx-4 -mb-4">
          {royxat.map(e => {
            const c = e._count;
            return (
              <li key={e.id}>
                <button onClick={() => onTanla(e.id)} aria-current={e.id === tanlangan ? 'true' : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer ${e.id === tanlangan ? 'bg-brand-fon/50 dark:bg-brand/10' : 'hover:bg-ichki/60'}`}>
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
                      <span className="inline-flex items-center gap-1"><Calendar size={12} />{sanaMatni(e.date)}</span>
                      <span>{e.totalQuestions} savol · {e.maxScore} ball</span>
                    </p>
                    <ol className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]" aria-label="Bosqichlar">
                      <Bosqich bajarildi={!!e.lockedAt} nom={e.lockedAt ? 'Qulflangan' : 'Tuzilmoqda'} />
                      <Bosqich bajarildi={!!c?.seats} nom={c?.seats ? `${c.seats} o'rin` : "O'rinlashtirilmagan"} />
                      <Bosqich bajarildi={!!c?.results} nom={c?.results ? `${c.results} natija` : 'Natija yo\'q'} />
                      <Bosqich bajarildi={!!e.publishedAt} nom={e.publishedAt ? "E'lon qilingan" : "E'lon qilinmagan"} />
                    </ol>
                  </div>
                  <ChevronRight size={16} className="text-matn-xira shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Karta>
  );
}

function Bosqich({ bajarildi, nom }: { bajarildi: boolean; nom: string }) {
  return (
    <li className={`inline-flex items-center gap-1 ${bajarildi ? 'text-yaxshi font-semibold' : 'text-matn-xira'}`}>
      {bajarildi ? <Check size={12} strokeWidth={3} /> : <span className="w-2.5 h-2.5 rounded-full border border-chiziq-kuchli" />}
      {nom}
    </li>
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
