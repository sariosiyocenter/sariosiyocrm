import React, { useCallback, useEffect, useState } from 'react';
import { Save, Plus, Trash2, ChevronDown } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, Maydon, INPUT, SELECT, Tanlov, Almashtirgich, Yuklanmoqda, BoshHolat } from './ui';
import AiKalitKartasi from './AiKalitKartasi';
import { JARIMALAR, XabarShabloni, NATIJA_OZGARUVCHILARI, RUXSATNOMA_OZGARUVCHILARI, type ImtihonSozlama } from './sozlamaQismlari';
import { imtihonSozlamaTozala } from '../../../lib/imtihonSozlama.js';
import { STANDART_SHABLON, RUXSATNOMA_SHABLON, VARIANT_KODLARI, natijaXabari, ruxsatnomaMatni, sanaMatni } from '../../../lib/imtihon.js';
import { toDateStr } from '../../../lib/lessons.js';

// Imtihonlar → Sozlamalar: butun imtihon moduli uchun, markazda bitta (egasi, 2026-10-10:
// «imtihonlarni o'zini sozlamasi bo'lsin»). «Yangi imtihon» shu qiymatlar bilan ochiladi —
// har imtihonda o'zgartirsa bo'ladi, oldin yaratilganlariga ta'sir qilmaydi. Savollar
// bankining sozlamalari bankning o'zida (Savollar banki → Sozlamalar).

type Yangi = ImtihonSozlama['yangi'];
type Sozlama = Yangi['settings'];

export default function ImtihonSozlamalari({ onBankSozlama }: { /** Savollar banki → Sozlamalar ga o'tish (bankni ko'ra oladiganlarga). */ onBankSozlama?: () => void }) {
  const { showNotification, settings } = useCRM();
  const { soro } = useImtihonApi();
  const [saqlangan, setSaqlangan] = useState<ImtihonSozlama | null>(null);
  const [y, setY] = useState<Yangi | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [band, setBand] = useState(false);
  const [qoshimcha, setQoshimcha] = useState(false);

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
  const sana = sanaMatni(toDateStr());
  const natijaNamuna = natijaXabari(s.notify.template, {
    ism: 'ALIYEV VALI', imtihon: 'Oylik sinov', sana, ball: '142,3', maks: '189', foiz: '75,3',
    bloklar: '• Matematika: 25,3 / 31\n• Fizika: 21,7 / 31',
    orin: s.ranking === 'yoq' ? '' : s.ranking === 'top' ? "🏆 O'rni: umumiy 7-o'rin" : "🏆 O'rni: kursda 3/25 · umumiy 15/400",
    markaz, havola: `${window.location.origin}/natija/…`,
    rasch: s.rasch.enabled ? '63,2' : '', daraja: s.rasch.enabled ? s.rasch.grades[1]?.label || s.rasch.grades[0]?.label || '' : '',
    holat: s.otish ? "✅ O'tdi" : '',
  });
  const ruxsatnomaNamuna = ruxsatnomaMatni(s.admit.template, {
    ism: 'ALIYEV VALI', imtihon: 'Oylik sinov', sana,
    vaqt: `${s.sessions[0]?.time || '09:00'}${s.sessions.length > 1 ? ` (${s.sessions[0]?.name})` : ''}`,
    filial: markaz, xona: '7-xona', qator: 2, orin: 3, markaz,
  });
  const smenaQoy = (i: number, patch: Partial<Sozlama['sessions'][number]>) => qoy({ sessions: s.sessions.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <div className="space-y-4">
      {/* Keng ekranda sarlavha «Saqlash» bilan birga tepada qoladi — forma uzun. */}
      <section className="bg-sirt border border-chiziq rounded-2xl px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:sticky lg:top-[68px] lg:z-20">
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold text-matn">Imtihonlar sozlamalari</h1>
          <p className="text-[12px] text-matn-xira mt-0.5">
            Butun markaz uchun bitta. «Yangi imtihon» shu qiymatlar bilan ochiladi — har imtihonda o'zgartirsa bo'ladi, oldin yaratilgan imtihonlar o'zgarmaydi.
            {onBankSozlama && <> Savollar bankiga oidlari — <button type="button" onClick={onBankSozlama} className="font-semibold text-brand hover:underline cursor-pointer">Savollar banki → Sozlamalar</button>.</>}
          </p>
        </div>
        <Tugma turi="asosiy" className="shrink-0" ikonka={<Save size={14} />} yuklanmoqda={band} disabled={!ozgardi} onClick={saqla}
          title={ozgardi ? undefined : "O'zgarish yo'q"}>Saqlash</Tugma>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Karta sarlavha="Yangi imtihon" izoh="Imtihon odatda qanday o'tadi">
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
              <Maydon div nom="Smenalar" izoh="Imtihon kuniga necha marta va soat nechada o'tadi">
                <div className="space-y-2">
                  {s.sessions.map((ss, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className={INPUT} aria-label={`${i + 1}-smena nomi`} value={ss.name} onChange={e => smenaQoy(i, { name: e.target.value })} />
                      <input type="time" className={`${INPUT} w-32`} aria-label={`${i + 1}-smena vaqti`} value={ss.time} onChange={e => smenaQoy(i, { time: e.target.value })} />
                      {s.sessions.length > 1 && <button type="button" aria-label="Smenani o'chirish" onClick={() => qoy({ sessions: s.sessions.filter((_, j) => j !== i) })} className="p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={14} /></button>}
                    </div>
                  ))}
                  {s.sessions.length < 10 && <Tugma type="button" kichik turi="oddiy" ikonka={<Plus size={13} />} onClick={() => qoy({ sessions: [...s.sessions, { id: s.sessions.length + 1, name: `${s.sessions.length + 1}-smena`, time: '' }] })}>Smena qo'shish</Tugma>}
                </div>
              </Maydon>

              <div className="border-t border-chiziq pt-3">
                <button type="button" onClick={() => setQoshimcha(v => !v)} aria-expanded={qoshimcha}
                  className="flex items-center gap-1.5 text-[12.5px] font-semibold text-matn-sokin hover:text-matn cursor-pointer">
                  <ChevronDown size={15} className={`transition-transform ${qoshimcha ? 'rotate-180' : ''}`} /> Qo'shimcha: jarima, o'rinlar, aralashtirish
                </button>
                {qoshimcha && (
                  <div className="space-y-4 mt-3">
                    <Maydon div nom="Xato javob uchun jarima" izoh={s.xatoJarima
                      ? `Har xato javobga savol balining ${JARIMALAR.find(j => j.v === s.xatoJarima)?.nom || s.xatoJarima} qismi ayiriladi; bo'sh javobga jarima yo'q`
                      : "Yo'q — xato javob 0 ball"}>
                      <div className="space-y-2">
                        <Tanlov qiymat={s.xatoJarima} onChange={v => qoy({ xatoJarima: v })} variantlar={JARIMALAR} />
                        {s.xatoJarima > 0 && (
                          <label className="flex items-center gap-2 text-[12.5px] text-matn cursor-pointer">
                            <input type="checkbox" className="w-3.5 h-3.5 accent-[var(--color-brand)]" checked={s.jarimaNoldan} onChange={e => qoy({ jarimaNoldan: e.target.checked })} />
                            Har fan bali 0 dan pastga tushmasin
                          </label>
                        )}
                      </div>
                    </Maydon>
                    <Maydon div nom="O'rinlar" izoh={s.seatMode === 'shaxmat' ? "Har o'rindan keyin bittasi bo'sh — xonalar ikki barobar ko'p kerak" : "Xonadagi hamma o'rin ishlatiladi"}>
                      <Tanlov qiymat={s.seatMode} onChange={v => qoy({ seatMode: v })} variantlar={[{ v: 'hammasi', nom: "Har o'rin" }, { v: 'shaxmat', nom: 'Shaxmat tartibi' }]} />
                    </Maydon>
                    {!kalitRejimi && (
                      <>
                        <Almashtirgich yoqilgan={s.shuffleQuestions} onChange={v => qoy({ shuffleQuestions: v })} nom="Fan ichida savollar tartibi aralashsin" izoh="Matnga bog'langan savollar birga qoladi" />
                        <Almashtirgich yoqilgan={s.shuffleOptions} onChange={v => qoy({ shuffleOptions: v })} nom="Javob variantlari aralashsin" />
                      </>
                    )}
                    <Almashtirgich yoqilgan={s.variantBubble} onChange={v => qoy({ variantBubble: v })} nom="O'quvchi varaqqa kitobcha variantini ham bo'yaydi" izoh="Kitobcha almashib qolsa, skaner ushlaydi" />
                  </div>
                )}
              </div>
            </div>
          </Karta>

          <Karta sarlavha="Natija" izoh="E'londa o'quvchi va ota-ona nimani ko'radi">
            <div className="space-y-4">
              <Maydon div nom="Reyting">
                <div className="flex flex-wrap items-center gap-2">
                  <Tanlov qiymat={s.ranking} onChange={v => qoy({ ranking: v })} variantlar={[{ v: 'hammasi', nom: "Hammaga o'rni" }, { v: 'top', nom: 'Faqat eng yaxshilar' }, { v: 'yoq', nom: "O'rin yo'q" }]} />
                  {s.ranking === 'top' && <input type="number" min={1} className={`${INPUT} w-24`} value={s.topN} onChange={e => qoy({ topN: Number(e.target.value) || 10 })} aria-label="Nechta" />}
                </div>
              </Maydon>
              {s.ranking !== 'yoq' && (
                <Maydon div nom="Teng ball to'plaganlar" izoh={s.orinUsuli === 'ketma' ? "Bir o'rin, keyingisi ketma-ket: 1, 2, 2, 3" : "Bir o'rin, keyingisi tashlab: 1, 2, 2, 4 (musobaqa tartibi)"}>
                  <Tanlov qiymat={s.orinUsuli} onChange={v => qoy({ orinUsuli: v })} variantlar={[{ v: 'otkazib', nom: '1, 2, 2, 4' }, { v: 'ketma', nom: '1, 2, 2, 3' }]} />
                </Maydon>
              )}
              <Maydon div nom="O'tish bali" izoh={s.otish ? "Natijada «O'tdi / O'tmadi» chiqadi: hisobotlarda, xabarda va natija sahifasida" : "Yo'q — natijada o'tdi/o'tmadi ko'rsatilmaydi"}>
                <div className="flex items-center gap-2">
                  <div className="w-28 shrink-0">
                    <input type="number" min={0} step="0.1" inputMode="decimal" className={INPUT} placeholder="yo'q" aria-label="O'tish bali" value={s.otish?.qiymat ?? ''}
                      onChange={e => { const q = Number(e.target.value); qoy({ otish: e.target.value === '' || !(q > 0) ? null : { turi: s.otish?.turi || 'foiz', qiymat: q } }); }} />
                  </div>
                  <Tanlov qiymat={s.otish?.turi || 'foiz'} onChange={v => s.otish && qoy({ otish: { ...s.otish, turi: v } })} variantlar={[{ v: 'foiz', nom: '%' }, { v: 'ball', nom: 'ball' }]} />
                </div>
              </Maydon>
              <Almashtirgich yoqilgan={s.showQuestionsAfter} onChange={v => qoy({ showQuestionsAfter: v })}
                nom="Natijadan keyin o'quvchi savollar va javoblarni ko'radi" izoh="Ko'rsatilgan savollar keyingi imtihonlarga tushmasligi kerak" />
              <Almashtirgich yoqilgan={s.rasch.enabled} onChange={v => qoy({ rasch: { ...s.rasch, enabled: v } })}
                nom="Rasch bali (Milliy sertifikat uslubi)" izoh="Har qatnashchiga T-ball (o'rtacha 50) va daraja; reyting shu ball bo'yicha" />
              {s.rasch.enabled && (
                <Maydon div nom="Darajalar" izoh="Har daraja uchun eng kam T-ball">
                  <div className="flex flex-wrap gap-1.5">
                    {s.rasch.grades.map((g, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-chiziq bg-ichki px-2 py-1">
                        <input aria-label="Daraja nomi" className="w-8 bg-transparent text-[12.5px] font-semibold text-matn outline-none" value={g.label}
                          onChange={e => qoy({ rasch: { ...s.rasch, grades: s.rasch.grades.map((x, j) => (j === i ? { ...x, label: e.target.value.slice(0, 6) } : x)) } })} />
                        <span className="text-matn-xira text-[12px]">≥</span>
                        <input aria-label={`${g.label} uchun eng kam ball`} inputMode="decimal" className="w-10 bg-transparent text-[12.5px] text-matn outline-none raqam" value={g.min}
                          onChange={e => qoy({ rasch: { ...s.rasch, grades: s.rasch.grades.map((x, j) => (j === i ? { ...x, min: Number(e.target.value.replace(',', '.')) || 0 } : x)) } })} />
                      </span>
                    ))}
                  </div>
                </Maydon>
              )}
            </div>
          </Karta>
          {/* AI kaliti o'z tugmasi bilan saqlanadi (sinab ko'riladi) — yuqoridagi «Saqlash» ga kirmaydi. */}
          <AiKalitKartasi />
        </div>

        <div className="space-y-4 min-w-0">
          <Karta sarlavha="Natija xabari" izoh="Natija e'lon qilinganda ketadigan xabar">
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Maydon nom="Kanal">
                  <select className={SELECT} value={s.notify.channel} onChange={e => qoy({ notify: { ...s.notify, channel: e.target.value as Sozlama['notify']['channel'] } })}>
                    <option value="BOTH">Telegram, bo'lmasa SMS</option><option value="TELEGRAM">Faqat Telegram</option><option value="SMS">Faqat SMS</option><option value="NONE">Yubormaslik</option>
                  </select>
                </Maydon>
                <Maydon nom="Kimga">
                  <select className={SELECT} value={s.notify.to} onChange={e => qoy({ notify: { ...s.notify, to: e.target.value as Sozlama['notify']['to'] } })}>
                    <option value="PARENT">Ota-onaga</option><option value="STUDENT">O'quvchiga</option><option value="ALL">Ikkalasiga</option>
                  </select>
                </Maydon>
              </div>
              {s.notify.channel !== 'NONE' && (
                <XabarShabloni nom="Xabar matni" ozgaruvchilar={NATIJA_OZGARUVCHILARI} qiymat={s.notify.template} standart={STANDART_SHABLON}
                  onChange={template => qoy({ notify: { ...s.notify, template } })} namuna={natijaNamuna} sms={s.notify.channel !== 'TELEGRAM'} />
              )}
            </div>
          </Karta>

          <Karta sarlavha="Ruxsatnoma" izoh="Qatnashchiga imtihon vaqti, xonasi va o'rni">
            <div className="space-y-3">
              <Almashtirgich yoqilgan={s.admit.auto} onChange={v => qoy({ admit: { ...s.admit, auto: v } })}
                nom="Imtihondan bir kun oldin o'zi yuborilsin" izoh="Soat 12:00 dan keyin, o'rin berilgan qatnashchilarga. Qo'lda ham yuborsa bo'ladi." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Maydon nom="Kanal">
                  <select className={SELECT} value={s.admit.channel} onChange={e => qoy({ admit: { ...s.admit, channel: e.target.value as Sozlama['admit']['channel'] } })}>
                    <option value="TELEGRAM">Faqat Telegram</option><option value="BOTH">Telegram, bo'lmasa SMS</option><option value="SMS">Faqat SMS</option><option value="NONE">Yubormaslik</option>
                  </select>
                </Maydon>
                <Maydon nom="Kimga">
                  <select className={SELECT} value={s.admit.to} onChange={e => qoy({ admit: { ...s.admit, to: e.target.value as Sozlama['admit']['to'] } })}>
                    <option value="ALL">O'quvchi va ota-onaga</option><option value="STUDENT">O'quvchiga</option><option value="PARENT">Ota-onaga</option>
                  </select>
                </Maydon>
              </div>
              {s.admit.channel !== 'NONE' && (
                <XabarShabloni nom="Matn" ozgaruvchilar={RUXSATNOMA_OZGARUVCHILARI} qiymat={s.admit.template} standart={RUXSATNOMA_SHABLON} qatorlar={6}
                  onChange={template => qoy({ admit: { ...s.admit, template } })} namuna={ruxsatnomaNamuna} sms={s.admit.channel !== 'TELEGRAM'} />
              )}
            </div>
          </Karta>
        </div>
      </div>
    </div>
  );
}
