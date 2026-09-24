import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Settings2, Copy, Trash2, Layers, Users, Printer, ScanLine, ClipboardCheck, BarChart3, CalendarDays, Clock, Lock } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import { useImtihonApi } from './imtihon/useImtihonApi';
import { Tugma, Yorliq, HOLAT_RANGI, Yuklanmoqda, BoshHolat } from './imtihon/ui';
import TuzilmaTab from './imtihon/TuzilmaTab';
import QatnashchilarTab from './imtihon/QatnashchilarTab';
import ChopEtishTab from './imtihon/ChopEtishTab';
import SkanerTab from './imtihon/SkanerTab';
import TekshirishTab from './imtihon/TekshirishTab';
import NatijalarTab from './imtihon/NatijalarTab';
import type { Exam } from '../types';

// Imtihon sahifasi — imtihon kunining tartibi bo'yicha bo'limlar:
// tuzilma va variantlar → qatnashchilar va o'rinlar → chop etish → skaner →
// shubhalilarni tekshirish → natija, tahlil va e'lon (docs/IMTIHON_PLAN.md, 6-bo'lim).

export type ImtihonTafsil = Exam & {
  variantlar: { session: number; code: string }[];
  assignments: { groupId: number; group: { id: number; name: string; schoolId: number } }[];
  _count: { results: number; seats: number };
};

const BOLIMLAR = [
  { id: 'tuzilma', nom: 'Tuzilma', ikonka: Layers, kerak: 'imtihonlar.imtihon' },
  { id: 'qatnashchilar', nom: "Qatnashchilar va o'rinlar", ikonka: Users, kerak: 'imtihonlar.imtihon' },
  { id: 'chop', nom: 'Chop etish', ikonka: Printer, kerak: 'imtihonlar.imtihon' },
  { id: 'skaner', nom: 'Skaner', ikonka: ScanLine, kerak: 'imtihonlar.natija' },
  { id: 'tekshirish', nom: 'Tekshirish', ikonka: ClipboardCheck, kerak: 'imtihonlar.natija' },
  { id: 'natijalar', nom: 'Natijalar', ikonka: BarChart3, kerak: 'imtihonlar.natija' },
] as const;
export type BolimId = typeof BOLIMLAR[number]['id'];

export default function ExamDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { kora, ozgartira, deleteExam, imtihonniYangila, showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const [exam, setExam] = useState<ImtihonTafsil | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  const korinadigan = BOLIMLAR.filter(b => kora(b.kerak));
  const bolim = (korinadigan.find(b => b.id === params.get('b'))?.id || korinadigan[0]?.id || 'tuzilma') as BolimId;
  const bolimgaOt = (b: BolimId) => setParams(p => { p.set('b', b); return p; }, { replace: true });

  const yangila = useCallback(async () => {
    try {
      const e = await soro<ImtihonTafsil>('GET', `exams/${id}`);
      setExam(e);
      imtihonniYangila(e);
      return e;
    } catch (err: any) {
      setXato(err.message);
      return null;
    }
  }, [id, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { yangila(); }, [yangila]);

  if (xato) return <BoshHolat sarlavha="Imtihon ochilmadi" izoh={xato}><Tugma onClick={() => navigate('/exams')}>Imtihonlar ro'yxati</Tugma></BoshHolat>;
  if (!exam) return <Yuklanmoqda />;

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
    navigate('/exams');
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <button aria-label="Orqaga" onClick={() => navigate('/exams')} className="w-10 h-10 shrink-0 bg-sirt border border-chiziq rounded-xl flex items-center justify-center text-matn-sokin hover:text-brand cursor-pointer"><ArrowLeft size={18} /></button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[16px] font-bold text-matn truncate">{exam.name}</h1>
              <Yorliq rang={HOLAT_RANGI[exam.status] || 'kulrang'}>{exam.lockedAt && exam.status !== "E'lon qilindi" && <Lock size={11} />}{exam.status}</Yorliq>
            </div>
            <p className="text-[12px] text-matn-xira mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{exam.date}</span>
              <span className="inline-flex items-center gap-1"><Clock size={12} />{exam.duration} daqiqa</span>
              <span>{exam.totalQuestions} ta savol · {exam.maxScore} ball</span>
              <span>{exam.settings.sessions.length} smena · {exam.settings.variantCount} variant</span>
              {exam._count.seats > 0 && <span>{exam._count.seats} qatnashchi</span>}
              {exam._count.results > 0 && <span>{exam._count.results} natija</span>}
            </p>
          </div>
        </div>
        {ozgartira('imtihonlar.imtihon') && (
          <div className="flex flex-wrap gap-2">
            <Tugma kichik ikonka={<Settings2 size={14} />} onClick={() => navigate(`/exams/${exam.id}/edit`)}>Sozlamalar</Tugma>
            <Tugma kichik ikonka={<Copy size={14} />} onClick={nusxa}>Nusxa</Tugma>
            {ozgartira('imtihonlar.ochirish') && <Tugma kichik turi="xavfli" ikonka={<Trash2 size={14} />} onClick={ochir}>O'chirish</Tugma>}
          </div>
        )}
      </div>

      <nav className="flex gap-1 overflow-x-auto bg-sirt border border-chiziq rounded-2xl p-1 shadow-sm">
        {korinadigan.map((b, i) => {
          const Ikonka = b.ikonka;
          const faol = b.id === bolim;
          return (
            <button key={b.id} onClick={() => bolimgaOt(b.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${faol ? 'bg-brand text-brand-ust' : 'text-matn-sokin hover:text-matn hover:bg-ichki'}`}>
              <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center ${faol ? 'bg-white/20' : 'bg-ichki'}`}>{i + 1}</span>
              <Ikonka size={14} /> {b.nom}
            </button>
          );
        })}
      </nav>

      {bolim === 'tuzilma' && <TuzilmaTab exam={exam} yangila={yangila} bolimgaOt={bolimgaOt} />}
      {bolim === 'qatnashchilar' && <QatnashchilarTab exam={exam} yangila={yangila} />}
      {bolim === 'chop' && <ChopEtishTab exam={exam} />}
      {bolim === 'skaner' && <SkanerTab exam={exam} yangila={yangila} />}
      {bolim === 'tekshirish' && <TekshirishTab exam={exam} yangila={yangila} />}
      {bolim === 'natijalar' && <NatijalarTab exam={exam} yangila={yangila} />}
    </div>
  );
}
