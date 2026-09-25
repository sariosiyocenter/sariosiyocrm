import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, ChevronRight, History } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Yorliq, INPUT, Yuklanmoqda, BoshHolat, HOLAT_RANGI } from './ui';
import StatTile from '../ui/StatTile';
import FoizGrafigi, { foizi } from './FoizGrafigi';
import OquvchiImtihonlari from './OquvchiImtihonlari';
import { vergul } from './format';

// Natijalar tarixi (6-modul): barcha o'tgan imtihonlar bir joyda — o'rtacha
// natija vaqt bo'yicha, har imtihonning qisqa hisoboti va o'quvchi bo'yicha
// qidiruv (uning hamma imtihonlari).

interface TarixQator {
  id: number; name: string; date: string; status: string; publishedAt: string | null; lockedAt: string | null;
  schoolId: number; branchIds: number[]; maxScore: number; totalQuestions: number; manba: 'bank' | 'kalit';
  qatnashchi: number; natija: number; ortachaFoiz: number | null; ortachaBall: number | null; engYuqori: number | null; xabar: number;
}

export default function TarixBolimi({ onImtihon }: { onImtihon: (id: number) => void }) {
  const { students, schools, showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [royxat, setRoyxat] = useState<TarixQator[] | null>(null);
  const [qidiruv, setQidiruv] = useState('');
  const [oquvchi, setOquvchi] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    soro<TarixQator[]>('GET', 'exams/history').then(setRoyxat).catch(e => { showNotification(e.message, 'error'); setRoyxat([]); });
  }, [soro, showNotification]);

  const otgan = useMemo(() => (royxat || []).filter(e => e.natija > 0), [royxat]);
  const jamiNatija = otgan.reduce((a, e) => a + e.natija, 0);
  const ortacha = jamiNatija ? otgan.reduce((a, e) => a + (e.ortachaFoiz || 0) * e.natija, 0) / jamiNatija : null;
  const grafik = useMemo(() => otgan.filter(e => e.publishedAt && e.ortachaFoiz != null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id), [otgan]);
  const topilgan = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    if (q.length < 2) return [];
    return (students || []).filter(s => (s.name || '').toLowerCase().includes(q)).slice(0, 8);
  }, [students, qidiruv]);
  const filialNomi = (id: number) => schools.find(s => s.id === id)?.name || '';

  if (!royxat) return <Yuklanmoqda />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile label="O'tkazilgan imtihonlar" value={otgan.length} subValue={`${royxat.length} ta imtihon tuzilgan`} />
        <StatTile label="Jami natijalar" value={jamiNatija} subValue="o'qilgan varaqlar" />
        <StatTile label="O'rtacha natija" value={ortacha == null ? '—' : `${vergul(foizi(ortacha))}%`} subValue="hamma imtihon bo'yicha" />
      </div>

      {grafik.length > 1 && (
        <Karta sarlavha="O'rtacha natija, foizda" izoh="E'lon qilingan imtihonlar, sana bo'yicha">
          <FoizGrafigi nomi="Imtihonlarning o'rtacha foizi" nuqtalar={grafik.map(e => ({
            id: e.id, sana: e.date, foiz: e.ortachaFoiz!, sarlavha: e.name,
            qiymatIzohi: `${e.natija} ta natija`,
            pastki: e.engYuqori != null ? `eng yuqori ${vergul(e.engYuqori)} / ${vergul(e.maxScore)}` : undefined,
          }))} />
        </Karta>
      )}

      <Karta sarlavha="O'quvchi tarixi" izoh="Ismini yozing — uning hamma imtihonlari, grafigi va natija sahifalari">
        {oquvchi ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-chiziq bg-ichki px-3 py-2">
              <span className="text-[13.5px] font-semibold text-matn">{oquvchi.name}</span>
              <button aria-label="Boshqa o'quvchi" onClick={() => { setOquvchi(null); setQidiruv(''); }} className="p-1.5 rounded-lg text-matn-xira hover:text-matn cursor-pointer"><X size={15} /></button>
            </div>
            <OquvchiImtihonlari studentId={oquvchi.id} />
          </div>
        ) : (
          <div className="relative max-w-md">
            <Search size={15} className="absolute left-3 top-3 text-matn-xira" />
            <input className={`${INPUT} pl-9`} placeholder="O'quvchi ismi" value={qidiruv} onChange={e => setQidiruv(e.target.value)} />
            {topilgan.length > 0 && (
              <ul className="mt-1 rounded-xl border border-chiziq bg-sirt shadow-sm divide-y divide-chiziq overflow-hidden">
                {topilgan.map(s => (
                  <li key={s.id}>
                    <button onClick={() => setOquvchi({ id: s.id, name: s.name })} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-matn hover:bg-ichki cursor-pointer">
                      {s.name} <ChevronRight size={14} className="text-matn-xira" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {qidiruv.trim().length >= 2 && !topilgan.length && <p className="text-[12px] text-matn-xira mt-2">Topilmadi</p>}
          </div>
        )}
      </Karta>

      <Karta sarlavha="Barcha imtihonlar" ichki="p-0">
        {!royxat.length ? <BoshHolat ikonka={<History size={20} />} sarlavha="Hali imtihon yo'q" /> : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead className="bg-ichki text-matn-sokin">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Sana</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Imtihon</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Qatnashchi</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Natija</th>
                  <th className="px-4 py-2.5 text-right font-semibold">O'rtacha</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Eng yuqori</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Xabar</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-chiziq">
                {royxat.map(e => (
                  <tr key={e.id} className="hover:bg-ichki/50 cursor-pointer" onClick={() => onImtihon(e.id)}>
                    <td className="px-4 py-2.5 text-matn-sokin whitespace-nowrap num">{e.date}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-matn">{e.name}</span>
                      <Yorliq rang={HOLAT_RANGI[e.status] || 'kulrang'} className="ml-2">{e.status}</Yorliq>
                      {e.manba === 'kalit' && <Yorliq className="ml-1.5">kalit bilan</Yorliq>}
                      {(e.branchIds || []).length > 0 && <span className="block text-[11.5px] text-matn-xira mt-0.5">{[e.schoolId, ...e.branchIds].map(filialNomi).filter(Boolean).join(' + ')}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right num text-matn-sokin">{e.qatnashchi || '—'}</td>
                    <td className="px-4 py-2.5 text-right num text-matn">{e.natija || '—'}</td>
                    <td className="px-4 py-2.5 text-right num font-bold text-matn">{e.ortachaFoiz != null ? `${vergul(e.ortachaFoiz)}%` : '—'}</td>
                    <td className="px-4 py-2.5 text-right num text-matn-sokin whitespace-nowrap">{e.engYuqori != null ? `${vergul(e.engYuqori)} / ${vergul(e.maxScore)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right num text-matn-sokin">{e.xabar || '—'}</td>
                    <td className="px-3 py-2.5 text-right"><ChevronRight size={15} className="inline text-matn-xira" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Karta>
      <p className="text-[11.5px] text-matn-xira">Qatorni bossangiz — o'sha imtihonning natijalari ochiladi.</p>
    </div>
  );
}
