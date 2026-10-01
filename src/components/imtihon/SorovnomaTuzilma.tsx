import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, Pencil, Printer, MessageSquareText } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useConfirm } from '../ConfirmDialog';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, Yorliq } from './ui';
import type { ImtihonTafsil } from './turlar';

// "Imtihonlar" tabida so'rovnoma: savollar va shkala, "Tayyor" (qulflash) —
// keyin varaqlar chop etiladi va skanerlanadi.
export default function SorovnomaTuzilma({ exam, yangila }: { exam: ImtihonTafsil; yangila: () => Promise<any> }) {
  const navigate = useNavigate();
  const { ozgartira, showNotification } = useCRM();
  const confirm = useConfirm();
  const { soro } = useImtihonApi();
  const [band, setBand] = useState(false);
  const tahrir = ozgartira('imtihonlar.imtihon');
  const sv = exam.settings.sorovnoma;

  const qulfla = async () => {
    if (!(await confirm({ message: "So'rovnoma tayyormi? Varaqlar chiqariladi; savollar soni va javoblari endi o'zgarmaydi (matnlarini tuzatsa bo'ladi).", danger: false }))) return;
    setBand(true);
    try {
      await soro('POST', `exams/${exam.id}/lock`);
      showNotification("So'rovnoma tayyor — varaqlarni «Chop etish»dan chiqaring", 'success');
      await yangila();
    } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(false); }
  };
  const qulfniOch = async () => {
    if (!(await confirm("Qulf ochilsinmi? Savollar sonini va javoblarni o'zgartirish mumkin bo'ladi."))) return;
    setBand(true);
    try { await soro('POST', `exams/${exam.id}/unlock`); await yangila(); } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Karta className="lg:col-span-2" sarlavha={<span className="inline-flex items-center gap-2"><MessageSquareText size={16} className="text-brand" />So'rovnoma savollari</span>}
        izoh={`${sv.savollar.length} ta savol · shkala: ${sv.shkala.map((x, i) => `${i + 1} — ${x}`).join(', ')}`}
        amallar={tahrir && <Tugma kichik ikonka={<Pencil size={13} />} onClick={() => navigate(`/exams/${exam.id}/edit`)}>Tahrirlash</Tugma>}>
        <ol className="divide-y divide-chiziq">
          {sv.savollar.map((q, i) => (
            <li key={i} className="flex gap-3 py-2 text-[13px]">
              <span className="w-6 text-right font-bold text-matn-sokin raqam">{i + 1}.</span>
              <span className="flex-1 text-matn">{q.matn}{q.variantlar && <span className="block text-[11.5px] text-matn-xira">{q.variantlar.map((x, j) => `${j + 1} — ${x}`).join(' · ')}</span>}</span>
            </li>
          ))}
        </ol>
      </Karta>
      <div className="space-y-4">
        <Karta sarlavha="Keyingi qadam">
          {!exam.lockedAt ? (
            <div className="space-y-3">
              <p className="text-[12.5px] text-matn-sokin">Savollar tayyor bo'lgach — «Tayyor» bosing. Keyin {sv.anonim ? 'universal (anonim) varaqlarni' : "qatnashchilarni o'rinlashtirib, shaxsiy varaqlarni"} chop etasiz.</p>
              {tahrir && <Tugma turi="asosiy" className="w-full" ikonka={<Lock size={14} />} yuklanmoqda={band} onClick={qulfla}>Tayyor — varaqlarni chiqarish</Tugma>}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[12.5px] text-matn-sokin">Varaqlarni chop eting, to'ldirilganini skanerlang — natija «Natijalar»da savol bo'yicha taqsimot bo'lib chiqadi.</p>
              <Tugma className="w-full" ikonka={<Printer size={14} />} onClick={() => navigate(`/exams?tab=chop&imtihon=${exam.id}`)}>Chop etish</Tugma>
              {tahrir && exam._count.results === 0 && <Tugma className="w-full" turi="oddiy" ikonka={<Unlock size={14} />} yuklanmoqda={band} onClick={qulfniOch}>Qulfni ochish</Tugma>}
            </div>
          )}
        </Karta>
        <Karta sarlavha="Sozlamalar">
          <div className="flex flex-wrap gap-1.5">
            <Yorliq rang={sv.anonim ? 'brand' : 'kulrang'}>{sv.anonim ? 'Anonim' : 'Ismli'}</Yorliq>
            <Yorliq>{exam.date}</Yorliq>
            <Yorliq>{exam.duration} daqiqa</Yorliq>
          </div>
        </Karta>
      </div>
    </div>
  );
}
