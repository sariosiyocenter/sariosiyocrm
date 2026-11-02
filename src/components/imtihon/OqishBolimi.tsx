import React, { useState } from 'react';
import { ScanLine, ClipboardCheck, UserX, CheckCircle2, XCircle } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tanlov, INPUT, Yuklanmoqda, BoshHolat } from './ui';
import SkanerTab from './SkanerTab';
import TekshirishTab from './TekshirishTab';
import { useOrinlar, type Orin } from './QatnashchilarTab';
import type { ImtihonTafsil } from './turlar';

// «Varaq o'qish» bo'limi (Addmen «Read Sheet»): tepada hisoblagichlar — jami, o'qildi, muammo,
// varag'i yo'q; ostida uch ko'rinish: o'qish (skan, kamera, qo'lda), muammolar navbati va
// varag'i kelmaganlar (kelmagan bo'lsa — «kelmadi», natijada alohida chiqadi).

export default function OqishBolimi({ exam, yangila, k, kga }: { exam: ImtihonTafsil; yangila: () => Promise<any>; k: string | null; kga: (v: string | null) => void }) {
  const h = exam.holat;
  const jami = h.natijalar + h.skanerlanmagan;
  const oqildi = Math.max(0, h.natijalar - h.shubhali);
  const foiz = (x: number) => (jami ? `${(x / jami) * 100}%` : '0%');
  const korinish = k === 'tekshirish' ? 'tekshirish' : k === 'yoq' ? 'yoq' : 'skaner';

  return (
    <div className="space-y-4">
      <section aria-label="O'qish holati" className="bg-sirt border border-chiziq rounded-2xl shadow-sm px-4 py-3 space-y-3">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          {([
            ['Jami', jami, 'text-matn'],
            ["O'qildi", oqildi, 'text-yaxshi'],
            ['Muammo', h.shubhali, h.shubhali ? 'text-ogoh' : 'text-matn'],
            ["Varag'i yo'q", h.skanerlanmagan, 'text-matn'],
          ] as const).map(([nom, son, rang]) => (
            <div key={nom}>
              <div className="text-[12px] text-matn-sokin">{nom}</div>
              <div className={`raqam text-[22px] font-semibold ${rang}`}>{son}</div>
            </div>
          ))}
        </div>
        <div className="h-2 rounded-full bg-ichki overflow-hidden flex" role="img" aria-label={`${oqildi} o'qildi, ${h.shubhali} muammo, ${h.skanerlanmagan} varag'i yo'q`}>
          <div className="bg-yaxshi" style={{ width: foiz(oqildi) }} />
          <div className="bg-ogoh" style={{ width: foiz(h.shubhali) }} />
        </div>
      </section>

      <Tanlov qiymat={korinish} onChange={v => kga(v === 'skaner' ? null : v)}
        variantlar={[
          { v: 'skaner', nom: <span className="inline-flex items-center gap-1.5"><ScanLine size={13} />O'qish</span> },
          { v: 'tekshirish', nom: <span className="inline-flex items-center gap-1.5"><ClipboardCheck size={13} />Muammolar{h.shubhali > 0 && <span className="raqam text-[11px] font-bold px-1.5 rounded-md bg-ogoh-fon text-ogoh">{h.shubhali}</span>}</span> },
          { v: 'yoq', nom: <span className="inline-flex items-center gap-1.5"><UserX size={13} />Varag'i yo'q{h.skanerlanmagan > 0 && <span className="raqam text-[11px] font-bold px-1.5 rounded-md bg-ichki text-matn-sokin">{h.skanerlanmagan}</span>}</span> },
        ]} />

      {korinish === 'tekshirish' ? <TekshirishTab exam={exam} yangila={yangila} />
        : korinish === 'yoq' ? <VaragiYoqlar exam={exam} yangila={yangila} />
          : <SkanerTab exam={exam} yangila={yangila} onTekshirish={() => kga('tekshirish')} />}
    </div>
  );
}

/** Varag'i o'qilmagan qatnashchilar: kelmagan bo'lsa — belgilanadi (natijada «kelmadi»). */
function VaragiYoqlar({ exam, yangila }: { exam: ImtihonTafsil; yangila: () => Promise<any> }) {
  const { ozgartira, showNotification } = useCRM();
  const belgilaydi = ozgartira('imtihonlar.imtihon') || ozgartira('imtihonlar.natija');
  const { soro } = useImtihonApi();
  const { data, yukla } = useOrinlar(exam.id);
  const [qidiruv, setQidiruv] = useState('');
  const [band, setBand] = useState<number | null>(null);

  if (!data) return <Yuklanmoqda />;
  const yoqlar = data.seats.filter(o => !o.resultId);
  const korinadi = yoqlar.filter(o => !qidiruv || o.name.toLowerCase().includes(qidiruv.toLowerCase()) || o.sheetCode.includes(qidiruv.toUpperCase()));
  const kelmadi = yoqlar.filter(o => o.status === 'kelmadi').length;

  const belgila = async (o: Orin, status: Orin['status']) => {
    setBand(o.id);
    try {
      await soro('PUT', `exams/${exam.id}/seats/${o.id}`, { status: o.status === status ? 'rejada' : status });
      await yukla();
      yangila();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(null);
    }
  };

  return (
    <Karta sarlavha={`Varag'i yo'q — ${yoqlar.length}`} izoh={`Kelmagan bo'lsa «Kelmadi» bosing (natijada alohida). Varag'i yo'qolgan yoki buzilgan bo'lsa — «O'qish» → «Qo'lda kiritish».${kelmadi ? ` Kelmadi deb belgilangan: ${kelmadi}.` : ''}`}
      amallar={<input className={`${INPUT} py-2 w-full sm:w-56`} placeholder="Ism yoki varaq kodi" aria-label="Qidirish" value={qidiruv} onChange={e => setQidiruv(e.target.value)} />}>
      {!yoqlar.length ? (
        <BoshHolat ikonka={<CheckCircle2 size={20} />} sarlavha="Hamma varaq o'qilgan" />
      ) : (
        <div className="overflow-x-auto -mx-4 -mb-4">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead className="text-[11.5px] uppercase tracking-wide text-matn-sokin">
              <tr>{['Qatnashchi', 'Guruh', "Xona · o'rin", 'Varaq kodi', 'Holati'].map(x => <th key={x} className="text-left font-semibold px-4 py-2">{x}</th>)}</tr>
            </thead>
            <tbody>
              {korinadi.map(o => (
                <tr key={o.id} className="border-t border-chiziq">
                  <td className="px-4 py-2.5 font-semibold text-matn">{o.name}</td>
                  <td className="px-4 py-2.5 text-matn-sokin">{o.groupName || (o.mehmon ? 'tashqi' : '—')}</td>
                  <td className="px-4 py-2.5 text-matn-sokin">{o.roomName ? `${o.roomName}${o.row != null && o.col != null ? ` · ${o.row + 1}-qator ${o.col + 1}-o'rin` : ''}` : '—'}</td>
                  <td className="px-4 py-2.5 raqam text-matn-sokin">{o.sheetCode}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5">
                      <button disabled={!belgilaydi || band === o.id} onClick={() => belgila(o, 'keldi')} aria-pressed={o.status === 'keldi'}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold cursor-pointer disabled:cursor-default ${o.status === 'keldi' ? 'border-yaxshi/40 bg-yaxshi-fon text-yaxshi' : 'border-chiziq text-matn-sokin hover:text-matn'}`}>
                        <CheckCircle2 size={13} />Keldi
                      </button>
                      <button disabled={!belgilaydi || band === o.id} onClick={() => belgila(o, 'kelmadi')} aria-pressed={o.status === 'kelmadi'}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold cursor-pointer disabled:cursor-default ${o.status === 'kelmadi' ? 'border-xato-chiziq bg-xato-fon text-xato' : 'border-chiziq text-matn-sokin hover:text-matn'}`}>
                        <XCircle size={13} />Kelmadi
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Karta>
  );
}
