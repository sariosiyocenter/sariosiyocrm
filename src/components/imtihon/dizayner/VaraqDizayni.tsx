import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PenTool, Plus, Pencil, Trash2, RotateCcw, CheckCircle2, AlertTriangle, RefreshCw, LayoutTemplate } from 'lucide-react';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Karta, Tugma, Yorliq, Yuklanmoqda } from '../ui';
import { varaqSahifalari, andozaXatolari, tuzilmadanAndoza, type VaraqAndoza } from '../../../lib/omr/layout';
import { varaqSvg } from '../../../lib/omr/render';
import { varaqParametrlari } from '../varaqParam';
import VaraqDizayner, { type DizaynerBoshi } from './VaraqDizayner';
import type { ImtihonTafsil } from '../turlar';
import type { VaraqAndozaYozuvi } from '../../../types';

// Chop etish → "Varaq dizayni": imtihon javob varag'i standart (avtomatik joylash)
// yoki saqlangan andozadan. Andoza imtihonga nusxa bo'lib qo'yiladi — keyin
// andoza o'zgarsa, "Yangilash" bilan qayta qo'llanadi (skanerlangan varaq bo'lsa — yo'q).

const snapshot = (a: VaraqAndozaYozuvi): VaraqAndoza => ({ id: a.id, nomi: a.name, sahifalar: a.sahifalar, bloklar: a.bloklar, yangilangan: a.updatedAt });

/** Varaqning 1-beti kichik ko'rinishda. */
export function VaraqKichik({ exam, andoza, kenglik = 150 }: { exam: ImtihonTafsil; andoza: VaraqAndoza | null; kenglik?: number }) {
  const svg = useMemo(() => {
    const sh = varaqSahifalari({ ...varaqParametrlari(exam), andoza })[0];
    return varaqSvg(sh, { markaz: '', imtihon: exam.name, sana: exam.date, examId: exam.id, session: 1 }, { ism: 'ALIYEV VALI', sheetCode: 'NAMUNA01', variant: 'A' })
      .replace(/width="210mm" height="297mm"/, 'width="100%" height="100%"');
  }, [exam, andoza]);
  return <div className="shrink-0 bg-white border border-chiziq rounded-md shadow-sm overflow-hidden" style={{ width: kenglik, height: kenglik * 297 / 210 }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function VaraqDizayni({ exam, yangila, umumiy }: {
  exam: ImtihonTafsil; yangila: () => void;
  umumiy: { markaz: string; imtihon: string; sana: string; examId: number; fanlar?: string; logo?: string | null };
}) {
  const { showNotification, ozgartira } = useCRM();
  const confirm = useConfirm();
  const { soro } = useImtihonApi();
  const yasaydi = ozgartira('imtihonlar.imtihon');
  const [royxat, setRoyxat] = useState<VaraqAndozaYozuvi[] | null>(null);
  const [muharrir, setMuharrir] = useState<{ boshi: DizaynerBoshi; qolla: boolean } | null>(null);
  const [band, setBand] = useState<string | null>(null);

  const yukla = useCallback(() => soro<VaraqAndozaYozuvi[]>('GET', 'varaq-andozalar').then(setRoyxat).catch(e => { setRoyxat([]); showNotification(e.message, 'error'); }), [soro, showNotification]);
  useEffect(() => { yukla(); }, [yukla]);

  const params = useMemo(() => varaqParametrlari(exam), [exam]);
  const joriy = exam.settings.varaqAndoza?.bloklar?.length ? exam.settings.varaqAndoza : null;
  const tekshiruv = (a: VaraqAndoza) => andozaXatolari(a, { tuzilma: params.tuzilma, optionCount: params.optionCount });
  const joriyTekshiruv = joriy ? tekshiruv(joriy) : null;
  const manba = joriy?.id ? royxat?.find(a => a.id === joriy.id) : undefined;
  const eskirgan = !!(manba && joriy?.yangilangan && manba.updatedAt !== joriy.yangilangan);
  const skanerlangan = exam.holat.natijalar > 0;

  const qolla = async (a: VaraqAndoza | null, xabar: string) => {
    setBand(a?.id ? `q${a.id}` : 'std');
    try {
      await soro('PUT', `exams/${exam.id}`, { settings: { varaqAndoza: a } });
      showNotification(xabar, 'success');
      yangila();
    } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(null); }
  };
  const ochir = async (a: VaraqAndozaYozuvi) => {
    if (!(await confirm({ title: `«${a.name}» andozasi o'chirilsinmi?`, message: "Uni qo'llagan imtihonlarning varag'i o'zgarmaydi (ularda nusxasi bor).", confirmLabel: "O'chirish", danger: true }))) return;
    try { await soro('DELETE', `varaq-andozalar/${a.id}`); yukla(); } catch (e: any) { showNotification(e.message, 'error'); }
  };
  const saqlandi = async (a: VaraqAndozaYozuvi) => {
    const qolla_ = muharrir?.qolla;
    setMuharrir(null);
    await yukla();
    if (qolla_ && !skanerlangan) await qolla(snapshot(a), `«${a.name}» saqlandi va imtihonga qo'llandi`);
    else showNotification(`«${a.name}» saqlandi`, 'success');
  };

  if (!royxat) return <Karta><Yuklanmoqda /></Karta>;
  return (
    <div className="space-y-4">
      <Karta sarlavha="Javob varag'i dizayni" izoh="Addmen OMR Designer kabi: savollar bloklarini, yozuv va logoni varaqqa o'zingiz joylang. Sarlavha (QR, ID, variant) standart qoladi.">
        <div className="flex flex-col sm:flex-row gap-4">
          <VaraqKichik exam={exam} andoza={joriy} kenglik={170} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-[12px] text-matn-xira">Hozir</p>
              <p className="text-[15px] font-bold text-matn">{joriy ? `Andoza: ${joriy.nomi || 'nomsiz'}` : 'Standart varaq'}</p>
              <p className="text-[12px] text-matn-sokin">{joriy ? `${joriy.sahifalar} sahifa · ${joriy.bloklar.length} blok` : "Savollar tuzilma bo'yicha o'zi joylanadi (fanlar ketma-ket, ustunlarda)"}</p>
            </div>
            {joriyTekshiruv && (
              joriyTekshiruv.xatolar.length ? (
                <div className="rounded-xl border border-xato-chiziq bg-xato-fon p-2.5 space-y-1">
                  {joriyTekshiruv.xatolar.map((x, i) => <p key={i} className="flex gap-1.5 text-[12px] text-xato"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{x}</p>)}
                  <p className="text-[11.5px] text-matn-sokin">Tuzatilmaguncha javob varaqalari chop etilmaydi.</p>
                </div>
              ) : <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-yaxshi"><CheckCircle2 size={15} />Hamma savol varaqda joyida</p>
            )}
            {joriyTekshiruv?.ogohlar.map((x, i) => <p key={i} className="flex gap-1.5 text-[12px] text-ogoh"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{x}</p>)}
            {eskirgan && manba && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ogoh/30 bg-ogoh-fon px-3 py-2">
                <span className="text-[12.5px] text-matn">«{manba.name}» andozasi qo'llangandan keyin o'zgargan.</span>
                {yasaydi && !skanerlangan && <Tugma kichik ikonka={<RefreshCw size={13} />} yuklanmoqda={band === `q${manba.id}`} onClick={() => qolla(snapshot(manba), 'Varaq yangilandi')}>Yangilash</Tugma>}
              </div>
            )}
            {skanerlangan && <p className="text-[12px] text-matn-xira">Varaqlar skanerlangan — dizaynni endi o'zgartirib bo'lmaydi.</p>}
            {yasaydi && !skanerlangan && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Tugma turi="asosiy" ikonka={<Plus size={14} />} onClick={() => {
                  const a = tuzilmadanAndoza(params);
                  setMuharrir({ boshi: { name: `${exam.name} varag'i`, sahifalar: a.sahifalar, bloklar: a.bloklar }, qolla: true });
                }}>Yangi dizayn</Tugma>
                {joriy && (
                  <Tugma ikonka={<Pencil size={14} />} onClick={() => setMuharrir({
                    boshi: manba ? { id: manba.id, name: manba.name, sahifalar: manba.sahifalar, bloklar: manba.bloklar } : { name: joriy.nomi || exam.name, sahifalar: joriy.sahifalar, bloklar: joriy.bloklar },
                    qolla: true,
                  })}>Tahrirlash</Tugma>
                )}
                {joriy && <Tugma turi="oddiy" ikonka={<RotateCcw size={14} />} yuklanmoqda={band === 'std'} onClick={() => qolla(null, 'Standart varaqqa qaytildi')}>Standart varaq</Tugma>}
              </div>
            )}
          </div>
        </div>
      </Karta>

      <Karta sarlavha="Saqlangan andozalar" izoh="Butun markazga umumiy. Bir xil tuzilmali imtihonlarda qayta ishlatiladi (masalan: «DTM 90 savol»).">
        {!royxat.length ? (
          <p className="flex items-center gap-2 text-[12.5px] text-matn-sokin"><LayoutTemplate size={15} />Hali andoza yo'q — «Yangi dizayn» bilan yarating.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {royxat.map(a => {
              const t = tekshiruv(snapshot(a));
              const qollangan = joriy?.id === a.id;
              return (
                <div key={a.id} className={`flex gap-3 rounded-xl border p-3 ${qollangan ? 'border-brand ring-2 ring-brand/15' : 'border-chiziq'}`}>
                  <VaraqKichik exam={exam} andoza={snapshot(a)} kenglik={78} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-[13px] font-semibold text-matn truncate" title={a.name}>{a.name}</p>
                    <p className="text-[11.5px] text-matn-xira">{a.sahifalar} sahifa · {a.bloklar.length} blok</p>
                    {t.xatolar.length ? <Yorliq rang="ogoh">Bu imtihonga mos emas</Yorliq> : <Yorliq rang="yaxshi">Mos</Yorliq>}
                    {qollangan && <Yorliq rang="brand">Qo'llangan</Yorliq>}
                    {yasaydi && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {!qollangan && !skanerlangan && <Tugma kichik turi="asosiy" yuklanmoqda={band === `q${a.id}`} onClick={() => qolla(snapshot(a), `«${a.name}» qo'llandi`)}>Qo'llash</Tugma>}
                        <Tugma kichik ikonka={<PenTool size={12} />} onClick={() => setMuharrir({ boshi: { id: a.id, name: a.name, sahifalar: a.sahifalar, bloklar: a.bloklar }, qolla: qollangan })}>Tahrirlash</Tugma>
                        <Tugma kichik turi="oddiy" ikonka={<Trash2 size={12} />} aria-label={`${a.name} andozasini o'chirish`} onClick={() => ochir(a)} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Karta>

      {muharrir && <VaraqDizayner boshi={muharrir.boshi} params={params} umumiy={umumiy} onYop={() => setMuharrir(null)} onSaqlandi={saqlandi} />}
    </div>
  );
}
