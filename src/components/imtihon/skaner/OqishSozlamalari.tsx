import React, { useState } from 'react';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useImtihonApi } from '../useImtihonApi';
import { Tanlov, SELECT } from '../ui';
import type { ImtihonTafsil } from '../turlar';
import type { OqishQoidasi } from '../../../lib/omr/reader';
import type { OqishRejimi } from './turlar';

// Addmen Read Sheet: o'qish rejimi (har kompyuterda o'zi) va o'qish qoidalari (imtihon sozlamasi —
// hamma skaner bir xil o'qisin). Qoidalar yangi o'qilgan varaqlarga qo'llanadi; eskilariga — qayta skanerlansa.

export const STANDART_QOIDA: OqishQoidasi = { sezgirlik: 'orta', kopBelgi: 'shubha', xira: 'shubha' };

const REJIM_IZOH: Record<OqishRejimi, string> = {
  avto: "Hamma varaq to'xtamay o'qiladi; muammolilari ro'yxatda qoladi — keyin hal qilasiz.",
  ogoh: "Muammoli varaqda (aniqlanmadi, shubhali javob, takror ID) o'qish to'xtaydi va varaq ko'rsatiladi.",
  tasdiq: "Har varaq o'qilgach ko'rsatiladi — tasdiqlaganingizdan keyin keyingisi o'qiladi.",
};

export default function OqishSozlamalari({ exam, rejim, onRejim, yangila }: {
  exam: ImtihonTafsil; rejim: OqishRejimi; onRejim: (r: OqishRejimi) => void; yangila: () => Promise<any>;
}) {
  const { ozgartira, showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const tahrirlaydi = ozgartira('imtihonlar.imtihon');
  const [ochiq, setOchiq] = useState(false);
  const [band, setBand] = useState(false);
  const q: OqishQoidasi = { ...STANDART_QOIDA, ...(exam.settings.oqishQoidasi || {}) };
  const ozgargan = q.sezgirlik !== 'orta' || q.kopBelgi !== 'shubha' || q.xira !== 'shubha';

  const saqla = async (patch: Partial<OqishQoidasi>) => {
    setBand(true);
    try {
      await soro('PUT', `exams/${exam.id}`, { settings: { oqishQoidasi: { ...q, ...patch } } });
      await yangila();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const qator = (nom: string, izoh: string, el: React.ReactNode) => (
    <label className="grid sm:grid-cols-[200px_1fr] gap-x-4 gap-y-1 items-start">
      <span>
        <span className="block text-[12.5px] font-semibold text-matn">{nom}</span>
        <span className="block text-[11.5px] text-matn-xira">{izoh}</span>
      </span>
      {el}
    </label>
  );

  return (
    <div className="rounded-2xl border border-chiziq bg-sirt px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-semibold text-matn-sokin">Rejim:</span>
          <Tanlov kichik qiymat={rejim} onChange={onRejim} variantlar={[
            { v: 'avto', nom: 'Avto' },
            { v: 'ogoh', nom: 'Ogohlantirib' },
            { v: 'tasdiq', nom: 'Har varaqni tasdiqlash' },
          ]} />
        </div>
        <button type="button" onClick={() => setOchiq(v => !v)} aria-expanded={ochiq}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-matn-sokin hover:text-brand cursor-pointer">
          <SlidersHorizontal size={14} /> O'qish qoidalari{ozgargan && <span className="w-1.5 h-1.5 rounded-full bg-brand" aria-label="o'zgartirilgan" />}
          <ChevronDown size={14} className={`transition-transform ${ochiq ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <p className="text-[12px] text-matn-xira -mt-1">{REJIM_IZOH[rejim]}</p>

      {ochiq && (
        <div className="border-t border-chiziq pt-3 space-y-3">
          {qator('Sezgirlik', "Doirachani qachon «bo'yalgan» deb olish", (
            <select className={SELECT} disabled={!tahrirlaydi || band} value={q.sezgirlik} onChange={e => saqla({ sezgirlik: e.target.value as OqishQoidasi['sezgirlik'] })}>
              <option value="past">Past — faqat to'liq bo'yalgani (qalam izi javob bo'lmaydi)</option>
              <option value="orta">O'rta — tavsiya</option>
              <option value="yuqori">Yuqori — yengil bo'yalgani ham (xira ruchka, qalam)</option>
            </select>
          ))}
          {qator('Bir nechta belgi', 'Bitta savolda ikki va undan ko\'p doira', (
            <select className={SELECT} disabled={!tahrirlaydi || band} value={q.kopBelgi} onChange={e => saqla({ kopBelgi: e.target.value as OqishQoidasi['kopBelgi'] })}>
              <option value="shubha">Operator tekshiradi</option>
              <option value="notogri">Noto'g'ri javob (tekshirilmaydi)</option>
              <option value="qorasi">Biri aniq qoraroq bo'lsa — o'sha, aks holda operator</option>
            </select>
          ))}
          {qator('Xira yoki o\'chirilgan belgi', "To'liq bo'yalmagan, o'chirib qayta belgilangan", (
            <select className={SELECT} disabled={!tahrirlaydi || band} value={q.xira} onChange={e => saqla({ xira: e.target.value as OqishQoidasi['xira'] })}>
              <option value="shubha">Operator tekshiradi</option>
              <option value="qorasi">Eng qorasi boshqalaridan aniq ajralsa — o'sha javob</option>
            </select>
          ))}
          <p className="text-[11.5px] text-matn-xira">
            Qoidalar imtihonniki — hamma kompyuterdagi skaner bir xil o'qiydi. Yangi o'qilgan varaqlarga qo'llanadi; avval o'qilganlariga — qayta skanerlansa
            (operator tasdiqlagan javoblar o'zgarmaydi).{!tahrirlaydi && ' O\'zgartirish uchun imtihonni tahrirlash ruxsati kerak.'}
          </p>
        </div>
      )}
    </div>
  );
}
