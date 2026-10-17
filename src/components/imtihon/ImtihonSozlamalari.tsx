import React, { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, Maydon, INPUT, SELECT, Tanlov, Almashtirgich, Yuklanmoqda, BoshHolat } from './ui';
import AiKalitKartasi from './AiKalitKartasi';
import {
  JarimaTanlovi, TopshirishTanlovi, SmenalarRoyxati, SmenagaBolish, OrinTartibi, RuxsatnomaSozlamasi,
  NatijaQoidalari, NatijaXabariSozlamasi, natijaNamunasi, ruxsatnomaNamunasi, type ImtihonSozlama,
} from './sozlamaQismlari';
import { imtihonSozlamaTozala } from '../../../lib/imtihonSozlama.js';
import { STANDART_SHABLON, RUXSATNOMA_SHABLON, VARIANT_KODLARI } from '../../../lib/imtihon.js';
import { toDateStr } from '../../../lib/lessons.js';

// Imtihonlar → Sozlamalar: butun imtihon moduli uchun, markazda bitta (egasi, 2026-10-10:
// «imtihonlarni o'zini sozlamasi bo'lsin»). «Yangi imtihon» shu qiymatlar bilan ochiladi —
// har imtihonda o'zgartirsa bo'ladi, oldin yaratilganlariga ta'sir qilmaydi. Bo'limlar
// imtihonning o'z bosqichlari bilan bir xil (2026-10-17): tuzilma — Imtihonlar tabida,
// o'tkazish — Qatnashchilar tabida, natija — Natijalar tabida; komponentlar ham o'shalar
// (sozlamaQismlari). Savollar bankining sozlamalari ham shu tabda, pastda (ExamsList).

type Yangi = ImtihonSozlama['yangi'];
type Sozlama = Yangi['settings'];

export default function ImtihonSozlamalari({ bankPastda }: { /** Savollar bankining sozlamalari shu sahifada, pastda (bankni to'ldira oladiganlarga). */ bankPastda?: boolean }) {
  const { showNotification, settings } = useCRM();
  const { soro } = useImtihonApi();
  const [saqlangan, setSaqlangan] = useState<ImtihonSozlama | null>(null);
  const [y, setY] = useState<Yangi | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [band, setBand] = useState(false);

  const yukla = useCallback(() => {
    setXato(null);
    soro<{ sozlama: ImtihonSozlama }>('GET', 'imtihon-sozlama')
      .then(r => { const toza = imtihonSozlamaTozala(r.sozlama) as ImtihonSozlama; setSaqlangan(toza); setY(toza.yangi); })
      .catch(e => setXato(e.message));
  }, [soro]);
  useEffect(() => { yukla(); }, [yukla]);

  if (xato) return <Karta><BoshHolat sarlavha="Sozlamalar ochilmadi" izoh={xato}><Tugma onClick={yukla}>Qayta urinish</Tugma></BoshHolat></Karta>;
  if (!y || !saqlangan) return <Yuklanmoqda />;

  const s = y.settings;
  const qoy = (patch: Partial<Sozlama>) => setY(x => x && ({ ...x, settings: { ...x.settings, ...patch } }));
  const ozgardi = JSON.stringify(y) !== JSON.stringify(saqlangan.yangi);

  const saqla = async () => {
    setBand(true);
    const yuborilgan = y;
    try {
      const r = await soro<{ sozlama: ImtihonSozlama }>('PUT', 'imtihon-sozlama', { sozlama: { yangi: yuborilgan } });
      setSaqlangan(r.sozlama);
      // So'rov ketayotganda yozilgan narsa bosilib ketmasin: forma o'zgarmagan bo'lsagina serverdagi (tozalangan) qiymat qo'yiladi.
      setY(joriy => (joriy === yuborilgan ? r.sozlama.yangi : joriy));
      showNotification('Sozlamalar saqlandi — yangi imtihonlar shu qiymatlar bilan ochiladi', 'success');
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setBand(false);
    }
  };

  const kalitRejimi = s.source === 'kalit';
  const markaz = settings?.orgName || 'Markaz';
  const bugun = toDateStr();

  return (
    <div className="space-y-4">
      {/* Keng ekranda sarlavha «Saqlash» bilan birga tepada qoladi — forma uzun. */}
      <section className="bg-sirt border border-chiziq rounded-2xl px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:sticky lg:top-[68px] lg:z-20">
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold text-matn">Imtihonlar sozlamalari</h1>
          <p className="text-[12px] text-matn-xira mt-0.5">
            Butun markaz uchun bitta. «Yangi imtihon» shu qiymatlar bilan ochiladi; har imtihonda o'z bosqichida o'zgartiriladi, oldin yaratilganlari o'zgarmaydi.
            {bankPastda && ' Savollar bankiniki — pastda, o\'z tugmalari bilan darhol saqlanadi.'}
          </p>
        </div>
        <Tugma turi="asosiy" className="shrink-0" ikonka={<Save size={14} />} yuklanmoqda={band} disabled={!ozgardi} onClick={saqla}
          title={ozgardi ? undefined : "O'zgarish yo'q"}>Saqlash</Tugma>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Karta sarlavha="Tuzilma" izoh="Savollar qulflanguncha. Har imtihonda — «Imtihonlar» tabida">
            <div className="space-y-4">
              <Maydon div nom="Savollar manbasi" izoh={kalitRejimi
                ? "O'z test kitobchangiz: CRM ga faqat javob kaliti yoziladi, kitobchani o'zingiz chop etasiz."
                : "Savollar bankdan olinadi, variantlar va kitobchalarni CRM o'zi tuzadi."}>
                <Tanlov qiymat={s.source} onChange={v => qoy({ source: v })}
                  variantlar={[{ v: 'bank', nom: 'Savollar bankidan' }, { v: 'kalit', nom: "O'z kitobchasi — faqat kalit" }]} />
              </Maydon>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Maydon nom="Davomiyligi (daqiqa)">
                  <input type="number" min={10} max={600} className={INPUT} value={y.duration} onChange={e => setY({ ...y, duration: Number(e.target.value) })} />
                </Maydon>
                <Maydon nom={kalitRejimi ? 'Kitobcha variantlari' : 'Variantlar soni'} izoh="4 va undan ko'p bo'lsa qo'shnilarga har xil variant tushadi">
                  <select className={SELECT} value={s.variantCount} onChange={e => qoy({ variantCount: Number(e.target.value) })}>
                    {Array.from({ length: VARIANT_KODLARI.length }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} ta</option>)}
                  </select>
                </Maydon>
              </div>
              <Maydon div nom="Ball tizimi" izoh={y.scoring === 'blok' ? "Har fan savoliga o'z bali (DTM: 3.1 / 2.1 / 1.1)" : 'Har savol 1 ball, natija foizda'}>
                <Tanlov qiymat={y.scoring} onChange={v => setY({ ...y, scoring: v })} variantlar={[{ v: 'blok', nom: 'Blok bali (DTM)' }, { v: 'foiz', nom: 'Foiz' }]} />
              </Maydon>
              <JarimaTanlovi s={s} qoy={qoy} />
              {!kalitRejimi && (
                <>
                  <Almashtirgich yoqilgan={s.shuffleQuestions} onChange={v => qoy({ shuffleQuestions: v })} nom="Fan ichida savollar tartibi aralashsin" izoh="Matnga bog'langan savollar birga qoladi" />
                  <Almashtirgich yoqilgan={s.shuffleOptions} onChange={v => qoy({ shuffleOptions: v })} nom="Javob variantlari aralashsin" />
                </>
              )}
              <Almashtirgich yoqilgan={s.variantBubble} onChange={v => qoy({ variantBubble: v })} nom="O'quvchi varaqqa kitobcha variantini ham bo'yaydi" izoh="Kitobcha almashib qolsa, skaner ushlaydi" />
            </div>
          </Karta>

          <Karta sarlavha="O'tkazish" izoh="Qanday, qachon va qayerda topshiriladi. Har imtihonda — «Qatnashchilar» tabida">
            <div className="space-y-4">
              <TopshirishTanlovi onlayn={s.onlayn} onChange={onlayn => qoy({ onlayn })} kalitRejimi={kalitRejimi} />
              {s.onlayn.yoqilgan && (
                <Maydon nom="Onlayn: har qatnashchiga, daqiqa" izoh="Bo'sh — imtihon davomiyligi. Ochilish va yopilish vaqti har imtihonda («Qatnashchilar» tabida)">
                  <input type="number" min={0} max={600} className={`${INPUT} max-w-40`} value={s.onlayn.daqiqa || ''} placeholder={String(y.duration)}
                    onChange={e => qoy({ onlayn: { ...s.onlayn, daqiqa: Math.max(0, Math.min(600, Number(e.target.value) || 0)) } })} />
                </Maydon>
              )}
              <Maydon div nom="Smenalar" izoh="Imtihon kuniga necha marta va soat nechada o'tadi">
                <SmenalarRoyxati sessions={s.sessions} onChange={sessions => qoy({ sessions })} sonOzgaradi />
              </Maydon>
              {s.sessions.length > 1 && <SmenagaBolish qiymat={s.sessionFill} onChange={v => qoy({ sessionFill: v })} />}
              {s.onlayn.faqat ? null : <OrinTartibi qiymat={s.seatMode} onChange={v => qoy({ seatMode: v })} />}
            </div>
          </Karta>

          <Karta sarlavha="Ruxsatnoma" izoh="Qatnashchiga imtihon vaqti, xonasi va o'rni. Har imtihonda — «Qatnashchilar» tabida">
            <RuxsatnomaSozlamasi s={s} qoy={qoy} standart={RUXSATNOMA_SHABLON}
              namuna={ruxsatnomaNamunasi(s, { sana: bugun, filial: markaz, markaz })} />
          </Karta>
        </div>

        <div className="space-y-4 min-w-0">
          <Karta sarlavha="Natija" izoh="E'londa o'quvchi va ota-ona nimani ko'radi. Har imtihonda — «Natijalar» tabida">
            <NatijaQoidalari s={s} qoy={qoy} kalitRejimi={kalitRejimi} />
          </Karta>

          <Karta sarlavha="Natija xabari" izoh="Natija e'lon qilinganda ketadigan xabar">
            <NatijaXabariSozlamasi s={s} qoy={qoy} standart={STANDART_SHABLON} namuna={natijaNamunasi(s, { sana: bugun, markaz })} />
          </Karta>

          {/* AI kaliti o'z tugmasi bilan saqlanadi (sinab ko'riladi) — yuqoridagi «Saqlash» ga kirmaydi. */}
          <AiKalitKartasi />
        </div>
      </div>
    </div>
  );
}
