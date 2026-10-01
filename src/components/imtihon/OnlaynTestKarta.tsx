import React, { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Download, UserPlus, RefreshCw, MonitorSmartphone } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, Yorliq, INPUT, Yuklanmoqda } from './ui';
import type { ImtihonTafsil } from './turlar';

// O'rinlashtirish → Onlayn test (Addmen CBT): har qatnashchining shaxsiy havolasi va
// holati (boshlanmagan / yechmoqda / tugagan). Havolani "Ruxsatnoma" Telegram/SMS
// bilan yuboradi («Testni ochish» tugmasi); bu yerda nusxa olish va Excel ham bor.

interface Qatnashchi { seatId: number; name: string; kod: number | null; groupName: string; havola: string; admitStatus: string | null; test: 'boshlanmagan' | 'yechmoqda' | 'tugagan' | 'qogozda'; ball: number | null }
const HOLAT_NOMI = { yopiq: "O'chirilgan", kutilmoqda: 'Hali ochilmagan', ochiq: 'Ochiq', tugagan: 'Yopilgan' } as const;
const TEST_NOMI = { boshlanmagan: 'boshlamagan', yechmoqda: 'yechmoqda', tugagan: 'tugatdi', qogozda: "qog'ozda" } as const;

export default function OnlaynTestKarta({ exam, tahrir, onOzgardi }: { exam: ImtihonTafsil; tahrir: boolean; onOzgardi: () => void }) {
  const { showNotification } = useCRM();
  const { soro } = useImtihonApi();
  const [d, setD] = useState<{ holat: keyof typeof HOLAT_NOMI; qulflangan: boolean; qatnashchilar: Qatnashchi[] } | null>(null);
  const [qidiruv, setQidiruv] = useState('');
  const [band, setBand] = useState(false);
  const o = exam.settings.onlayn;

  const yukla = useCallback(() => soro<typeof d>('GET', `exams/${exam.id}/onlayn`).then(setD).catch(e => showNotification(e.message, 'error')), [exam.id, soro]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { yukla(); }, [yukla]);

  const qosh = async () => {
    setBand(true);
    try {
      const r = await soro<{ qoshildi: number; jami: number }>('POST', `exams/${exam.id}/onlayn/qatnashchilar`, {});
      showNotification(r.qoshildi ? `${r.qoshildi} ta qatnashchi qo'shildi (jami ${r.jami})` : 'Hamma qatnashchi ro\'yxatda', 'success');
      await yukla();
      onOzgardi();
    } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(false); }
  };

  const nusxa = async (havola: string) => {
    try { await navigator.clipboard.writeText(havola); showNotification('Havola nusxalandi', 'success'); } catch { window.prompt('Havola:', havola); }
  };

  const excel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((d?.qatnashchilar || []).map((x, i) => ({
      '№': i + 1, ID: x.kod ?? '', 'F.I.Sh': x.name, Kurs: x.groupName, Havola: x.havola, Holat: TEST_NOMI[x.test], Ball: x.ball ?? '',
    }))), 'Havolalar');
    XLSX.writeFile(wb, `${exam.name} — onlayn test havolalari.xlsx`);
  };

  if (!d) return <Karta sarlavha="Onlayn test"><Yuklanmoqda /></Karta>;
  const sanoq = { yechmoqda: 0, tugagan: 0, boshlanmagan: 0, qogozda: 0 };
  for (const x of d.qatnashchilar) sanoq[x.test]++;
  const royxat = d.qatnashchilar.filter(x => !qidiruv || x.name.toLowerCase().includes(qidiruv.toLowerCase()));
  const vaqt = (s: string) => (s ? s.replace('T', ' ') : '');

  return (
    <Karta sarlavha={<span className="inline-flex items-center gap-2"><MonitorSmartphone size={15} /> Onlayn test</span>}
      izoh={`${o.ochiladi ? `Ochiladi: ${vaqt(o.ochiladi)}` : 'Hozirdan ochiq'}${o.yopiladi ? ` · yopiladi: ${vaqt(o.yopiladi)}` : ''} · ${o.daqiqa || exam.duration} daqiqa`}
      amallar={<>
        <Yorliq rang={d.holat === 'ochiq' ? 'yaxshi' : d.holat === 'kutilmoqda' ? 'ogoh' : 'kulrang'}>{HOLAT_NOMI[d.holat]}</Yorliq>
        <Tugma kichik turi="oddiy" ikonka={<RefreshCw size={13} />} onClick={yukla}>Yangilash</Tugma>
      </>}>
      <div className="space-y-3">
        {!d.qulflangan && <p className="rounded-xl bg-ogoh-fon border border-ogoh/25 px-3 py-2 text-[12.5px] text-matn">Savollar qulflangach test ochiladi («Imtihonlar» → qulflash).</p>}
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="text-matn-sokin">{d.qatnashchilar.length} qatnashchi:</span>
          <Yorliq rang="yaxshi">{sanoq.tugagan} tugatdi</Yorliq>
          <Yorliq rang="brand">{sanoq.yechmoqda} yechmoqda</Yorliq>
          <Yorliq>{sanoq.boshlanmagan} boshlamagan</Yorliq>
          {sanoq.qogozda > 0 && <Yorliq>{sanoq.qogozda} qog'ozda</Yorliq>}
          <span className="ml-auto flex flex-wrap gap-2">
            {tahrir && <Tugma kichik ikonka={<UserPlus size={13} />} yuklanmoqda={band} onClick={qosh} title="Biriktirilgan kurslar o'quvchilari — xonasiz (onlayn uchun o'rin kerak emas)">Qatnashchilarni qo'shish</Tugma>}
            <Tugma kichik turi="oddiy" ikonka={<Download size={13} />} disabled={!d.qatnashchilar.length} onClick={excel}>Havolalar (Excel)</Tugma>
          </span>
        </div>
        <p className="text-[11.5px] text-matn-xira">Havolani Telegram yoki SMS bilan «Ruxsatnoma» yuboradi: xabarda havola va «📝 Testni ochish» tugmasi bo'ladi. Har havola shaxsiy — boshqaga bermang.</p>
        {d.qatnashchilar.length > 0 && (
          <>
            <input className={`${INPUT} py-1.5 text-[12.5px] max-w-xs`} placeholder="Qidirish" value={qidiruv} onChange={e => setQidiruv(e.target.value)} aria-label="Qatnashchini qidirish" />
            <ul className="max-h-80 overflow-y-auto rounded-xl border border-chiziq divide-y divide-chiziq">
              {royxat.map(x => (
                <li key={x.seatId} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-matn">{x.name}</span>
                    <span className="block text-[11px] text-matn-xira">{[x.kod ? `ID ${x.kod}` : '', x.groupName].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Yorliq rang={x.test === 'tugagan' ? 'yaxshi' : x.test === 'yechmoqda' ? 'brand' : 'kulrang'}>{TEST_NOMI[x.test]}{x.test === 'tugagan' && x.ball != null ? ` · ${String(x.ball).replace('.', ',')}` : ''}</Yorliq>
                  <button aria-label={`${x.name} — havolani nusxalash`} onClick={() => nusxa(x.havola)} className="p-1.5 rounded-lg text-matn-xira hover:text-brand hover:bg-ichki cursor-pointer"><Copy size={13} /></button>
                  <a aria-label={`${x.name} — havolani ochish`} href={x.havola} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-matn-xira hover:text-brand hover:bg-ichki"><ExternalLink size={13} /></a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Karta>
  );
}
