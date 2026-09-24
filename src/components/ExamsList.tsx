import React, { useState } from 'react';
import { Search, Plus, FileText, BookOpen, Calendar, Users, ChevronRight, Lock } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import QuestionsList from './QuestionsList';
import { Karta, Tugma, Yorliq, HOLAT_RANGI, BoshHolat, INPUT } from './imtihon/ui';

// Imtihonlar moduli: imtihonlar ro'yxati va savollar banki. Skaner, tekshirish
// va natijalar har imtihonning o'z sahifasida (ExamDetail).

export default function ExamsList() {
  const { exams, kora, ozgartira, schools } = useCRM();
  const imtihonKorinadi = kora('imtihonlar.imtihon') || kora('imtihonlar.natija');
  const savollarKorinadi = kora('imtihonlar.savollar');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'savollar' && savollarKorinadi ? 'savollar' : imtihonKorinadi ? 'imtihonlar' : 'savollar';
  const [search, setSearch] = useState('');

  const tabga = (t: 'imtihonlar' | 'savollar') => setParams(p => { if (t === 'savollar') p.set('tab', 'savollar'); else p.delete('tab'); return p; }, { replace: true });
  const royxat = [...exams]
    .filter(e => (e.name || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const filialNomi = (id: number) => schools.find(s => s.id === id)?.name || '';

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex border border-chiziq bg-sirt rounded-2xl p-1 shadow-sm gap-1 w-fit">
        {imtihonKorinadi && (
          <button onClick={() => tabga('imtihonlar')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12.5px] font-semibold cursor-pointer ${tab === 'imtihonlar' ? 'bg-brand text-white' : 'text-matn-sokin hover:text-matn'}`}>
            <FileText size={14} /> Imtihonlar
          </button>
        )}
        {savollarKorinadi && (
          <button onClick={() => tabga('savollar')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12.5px] font-semibold cursor-pointer ${tab === 'savollar' ? 'bg-brand text-white' : 'text-matn-sokin hover:text-matn'}`}>
            <BookOpen size={14} /> Savollar banki
          </button>
        )}
      </div>

      {tab === 'savollar' ? <QuestionsList /> : (
        <>
          <Karta sarlavha="Imtihonlar" izoh="Sinov imtihonlari: tuzish → o'rinlashtirish → chop etish → skaner → natija"
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
              <BoshHolat ikonka={<FileText size={22} />} sarlavha={exams.length ? 'Qidiruvga mos imtihon yo\'q' : "Hali imtihon yo'q"}
                izoh={exams.length ? undefined : "Avval savollar bankini to'ldiring, keyin imtihon tuzing. DTM andozasi bir bosishda 5 blokli tuzilmani qo'yadi."}>
                {!exams.length && ozgartira('imtihonlar.imtihon') && <Tugma turi="asosiy" ikonka={<Plus size={14} />} onClick={() => navigate('/exams/new')}>Yangi imtihon</Tugma>}
                {!exams.length && savollarKorinadi && <Tugma ikonka={<BookOpen size={14} />} onClick={() => tabga('savollar')}>Savollar banki</Tugma>}
              </BoshHolat>
            ) : (
              <ul className="divide-y divide-chiziq -mx-4 -mb-4">
                {royxat.map(e => (
                  <li key={e.id}>
                    <button onClick={() => navigate(`/exams/${e.id}`)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ichki/60 cursor-pointer">
                      <div className="w-10 h-10 rounded-xl bg-brand-fon border border-brand/20 dark:bg-brand/15 flex items-center justify-center text-brand shrink-0"><FileText size={18} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-semibold text-matn truncate">{e.name}</span>
                          <Yorliq rang={HOLAT_RANGI[e.status] || 'kulrang'}>{e.lockedAt && e.status !== "E'lon qilindi" && <Lock size={10} />}{e.status}</Yorliq>
                          {(e.branchIds || []).length > 0 && <Yorliq>{[e.schoolId, ...e.branchIds].map(filialNomi).filter(Boolean).join(' + ')}</Yorliq>}
                        </div>
                        <p className="text-[12px] text-matn-xira mt-0.5 flex flex-wrap gap-x-3">
                          <span className="inline-flex items-center gap-1"><Calendar size={12} />{e.date}</span>
                          <span>{e.totalQuestions} savol · {e.maxScore} ball</span>
                          <span>{e.blocks?.length || 0} fan</span>
                          {!!e._count?.seats && <span className="inline-flex items-center gap-1"><Users size={12} />{e._count.seats}</span>}
                          {!!e._count?.results && <span>{e._count.results} natija</span>}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-matn-xira shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Karta>
        </>
      )}
    </div>
  );
}
