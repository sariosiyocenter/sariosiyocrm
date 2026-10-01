import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Lock, Wand2 } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useImtihonApi } from './imtihon/useImtihonApi';
import { Karta, Tugma, Maydon, INPUT, SELECT, Tanlov, Almashtirgich, Yorliq, Yuklanmoqda } from './imtihon/ui';
import { useBankDaraxt, fanniTop } from './imtihon/bank/useBankDaraxt';
import BlokMuharriri from './imtihon/tuzish/BlokMuharriri';
import { SOZLAMA_STANDART, STANDART_SHABLON, RUXSATNOMA_SHABLON, sozlamaniTozala, varaqTuzilmasi, natijaXabari, ruxsatnomaMatni, VARIANT_KODLARI, vergul, sanaMatni, taqsimla, QIYINLIK_ARALASHMASI } from '../../lib/imtihon.js';
import { toDateStr } from '../../lib/lessons.js';
import type { Exam, ExamBlock, ExamSettings, TopicRule, SavolTuri } from '../types';

// Imtihon tuzish. Egasining talabi (2026-09-24): "universal bo'lishi kerak" —
// ball tizimi, smenalar, filiallar, til, reyting va xabar kanali imtihonning
// o'z sozlamasi. Qulflangandan keyin tuzilma (bloklar, variantlar) o'zgarmaydi,
// faqat e'lon va xabar sozlamalari.

const yangiId = () => Math.random().toString(36).slice(2, 9);

// DTM (BMBA) blok testi: 3 majburiy fan × 10 savol × 1.1 ball, 2 asosiy fan × 30 savol (3.1 va 2.1).
const DTM_ANDOZA: ExamBlock[] = [
  { id: yangiId(), subject: 'Ona tili', pointsPerQuestion: 1.1, topicRules: [{ topic: '', count: 10, type: 'yopiq' }] },
  { id: yangiId(), subject: 'Matematika', pointsPerQuestion: 1.1, topicRules: [{ topic: '', count: 10, type: 'yopiq' }] },
  { id: yangiId(), subject: "O'zbekiston tarixi", pointsPerQuestion: 1.1, topicRules: [{ topic: '', count: 10, type: 'yopiq' }] },
  { id: yangiId(), subject: '1-asosiy fan', pointsPerQuestion: 3.1, topicRules: [{ topic: '', count: 30, type: 'yopiq' }] },
  { id: yangiId(), subject: '2-asosiy fan', pointsPerQuestion: 2.1, topicRules: [{ topic: '', count: 30, type: 'yopiq' }] },
];

const TUR_NOMI: Record<SavolTuri, string> = { yopiq: 'Yopiq', raqamli: 'Raqamli', yozma: 'Yozma' };
// Manfiy ball: xato javob uchun savol balining qancha qismi ayiriladi (Addmen "negative marking").
const JARIMALAR: { v: number; nom: string }[] = [
  { v: 0, nom: "Yo'q" }, { v: 0.25, nom: '¼' }, { v: 1 / 3, nom: '⅓' }, { v: 0.5, nom: '½' }, { v: 1, nom: "To'liq" },
];

export default function ExamBuilder() {
  const { id } = useParams();
  const tahrir = !!id;
  const navigate = useNavigate();
  const { schools, selectedSchoolId, user, addExam, updateExam, showNotification } = useCRM();
  const { soro } = useImtihonApi();

  const [yuklanmoqda, setYuklanmoqda] = useState(tahrir);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [qulf, setQulf] = useState(false);
  const [nom, setNom] = useState('');
  const [sana, setSana] = useState(() => toDateStr());
  const [davom, setDavom] = useState(120);
  const [scoring, setScoring] = useState<'blok' | 'foiz'>('blok');
  const [bloklar, setBloklar] = useState<ExamBlock[]>([{ id: yangiId(), subject: '', pointsPerQuestion: 1, topicRules: [{ topic: '', count: 10, type: 'yopiq' }] }]);
  const [sozlama, setSozlama] = useState<ExamSettings>(() => sozlamaniTozala({}) as ExamSettings);
  const joriyFilial = selectedSchoolId && selectedSchoolId > 0 ? selectedSchoolId : user?.schoolId || 0;
  // Imtihon yaratilgan filial doim qatnashadi; qolganlari — tanlov.
  const [egaFilial, setEgaFilial] = useState(joriyFilial);
  const [filiallar, setFiliallar] = useState<number[]>(joriyFilial ? [joriyFilial] : []);
  // Bank tuzilmasi: fan → mavzu, har mavzuda imtihonga olsa bo'ladigan savollar (imtihon tilida).
  const { daraxt } = useBankDaraxt(sozlama.language);

  useEffect(() => {
    if (!id) return;
    soro<Exam>('GET', `exams/${id}`).then(e => {
      setNom(e.name); setSana(e.date); setDavom(e.duration); setScoring(e.scoring || 'blok');
      setBloklar((e.blocks || []).map(b => ({ ...b, id: b.id || yangiId() })));
      setSozlama(sozlamaniTozala(e.settings) as ExamSettings);
      setEgaFilial(e.schoolId);
      setFiliallar([...new Set([e.schoolId, ...(e.branchIds || [])])]);
      setQulf(!!e.lockedAt);
    }).catch(err => showNotification(err.message, 'error')).finally(() => setYuklanmoqda(false));
  }, [id, soro, showNotification]);

  const tuzilma = useMemo(() => varaqTuzilmasi(bloklar, scoring), [bloklar, scoring]);
  const s = (patch: Partial<ExamSettings>) => setSozlama(x => ({ ...x, ...patch }));

  const kopaytma = sozlama.sessionQuestions === 'alohida' ? sozlama.sessions.length : 1;
  // "Faqat kalit": markazning o'z kitobchasi — mavzu va qiyinlik kerak emas, bank ham.
  const kalitRejimi = sozlama.source === 'kalit';

  const blokQoy = (bi: number, patch: Partial<ExamBlock>) => setBloklar(b => b.map((x, i) => (i === bi ? { ...x, ...patch } : x)));
  const qoidaQoy = (bi: number, ri: number, patch: Partial<TopicRule>) => setBloklar(b => b.map((x, i) => (i === bi ? { ...x, topicRules: x.topicRules.map((r, j) => (j === ri ? { ...r, ...patch } : r)) } : x)));

  const saqla = async () => {
    if (!nom.trim()) return showNotification('Imtihon nomini kiriting', 'error');
    if (!qulf) {
      if (bloklar.some(b => !b.subject.trim())) return showNotification(kalitRejimi ? 'Har blokning fanini kiriting' : 'Har blokda fanni tanlang', 'error');
      if (!tuzilma.jami) return showNotification(kalitRejimi ? "Kamida bitta savol qoidasi kerak" : 'Savollar soni kiritilmagan', 'error');
    }
    setSaqlanmoqda(true);
    try {
      const body: any = { name: nom.trim(), date: sana, duration: davom, settings: sozlama };
      if (!qulf) Object.assign(body, { blocks: bloklar, scoring, branchIds: filiallar.filter(x => x !== egaFilial) });
      if (tahrir) {
        await updateExam(Number(id), body);
        navigate(`/exams/${id}`);
      } else {
        const e = await addExam({ ...body, schoolId: egaFilial } as any);
        navigate(`/exams/${e.id}`);
      }
    } catch {
      // xabar context'da ko'rsatildi
    } finally {
      setSaqlanmoqda(false);
    }
  };

  const xabarNamuna = natijaXabari(sozlama.notify.template, {
    ism: 'ALIYEV VALI', imtihon: nom || 'Oylik sinov', sana: sanaMatni(sana), ball: '142,3', maks: vergul(tuzilma.maks), foiz: '75,3',
    bloklar: bloklar.length > 1 ? bloklar.slice(0, 2).map(b => `• ${b.subject || 'Fan'}: 25,3 / 31`).join('\n') : '',
    orin: sozlama.ranking === 'yoq' ? '' : sozlama.ranking === 'top' ? "🏆 O'rni: umumiy 7-o'rin" : "🏆 O'rni: kursda 3/25 · umumiy 15/400",
    markaz: 'Sariosiyo', havola: `${window.location.origin}/natija/…`,
    rasch: sozlama.rasch.enabled ? '63,2' : '', daraja: sozlama.rasch.enabled ? 'B+' : '',
    holat: sozlama.otish ? "✅ O'tdi" : '',
  });
  const ruxsatnomaNamuna = ruxsatnomaMatni(sozlama.admit.template, {
    ism: 'ALIYEV VALI', imtihon: nom || 'Oylik sinov', sana: sanaMatni(sana),
    vaqt: `${sozlama.sessions[0]?.time || '09:00'}${sozlama.sessions.length > 1 ? ` (${sozlama.sessions[0]?.name})` : ''}`,
    filial: schools.find(x => x.id === egaFilial)?.name || '', xona: '7-xona', qator: 2, orin: 3, markaz: 'Sariosiyo',
  });

  if (yuklanmoqda) return <Yuklanmoqda />;

  const qulfIzoh = qulf ? 'Savollar qulflangan — bu qism o\'zgarmaydi' : undefined;

  // DTM andozasi: 5 blok; bank rejimida fanlar bankdagi nomi bo'yicha topiladi.
  const dtmAndoza = () => {
    setScoring('blok');
    setBloklar(DTM_ANDOZA.map(b => {
      const yangi = { ...b, id: yangiId() };
      if (kalitRejimi || !daraxt) return yangi;
      const f = fanniTop(daraxt, null, b.subject);
      if (!f) return { ...yangi, subject: '', topicRules: [] };
      const jami = b.topicRules.reduce((a, r) => a + r.count, 0);
      const mavzular = f.mavzular.filter(m => m.bor.yopiq.some(n => n > 0));
      const r = taqsimla({ jami, ulush: QIYINLIK_ARALASHMASI.muvozanat, mavzular: mavzular.map(m => ({ id: m.id, bor: m.bor.yopiq })) });
      const topicRules: TopicRule[] = [];
      for (const m of mavzular) r.jadval[m.id].forEach((n: number, i: number) => { if (n) topicRules.push({ topic: m.name, mavzuId: m.id, type: 'yopiq', count: n, difficulty: i + 1 }); });
      if (r.yetmadi) topicRules.push({ topic: '', type: 'yopiq', count: r.yetmadi });
      return { ...yangi, subject: f.name, fanId: f.id, topicRules, taqsimot: { jami, aralash: 'muvozanat' as const, mavzular: mavzular.map(m => m.id), raqamli: 0, yozma: 0, yozmaBal: null } };
    }));
  };

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button aria-label="Orqaga" onClick={() => navigate(tahrir ? `/exams/${id}` : '/exams')} className="w-10 h-10 bg-sirt border border-chiziq rounded-xl flex items-center justify-center text-matn-sokin hover:text-brand cursor-pointer"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-[15px] font-bold text-matn">{tahrir ? 'Imtihon sozlamalari' : 'Yangi imtihon'}</h1>
            <p className="text-[12px] text-matn-xira">{tuzilma.jami} ta savol · eng yuqori ball {tuzilma.maks}</p>
          </div>
          {qulf && <Yorliq rang="brand"><Lock size={11} /> Qulflangan</Yorliq>}
        </div>
        <Tugma turi="asosiy" ikonka={<Save size={14} />} yuklanmoqda={saqlanmoqda} onClick={saqla}>{tahrir ? 'Saqlash' : 'Yaratish'}</Tugma>
      </div>

      <Karta sarlavha="Asosiy">
        <Maydon nom="Savollar manbasi" className="mb-4" izoh={qulfIzoh || (kalitRejimi
          ? "O'z test kitobchangiz (sotib olingan to'plam yoki ustoz tuzgan test): CRM ga faqat har variantning javob kaliti yoziladi, kitobchani o'zingiz chop etasiz."
          : 'Savollar bankdan olinadi, variantlar va kitobchalarni CRM o\'zi tuzadi va chop etadi.')}>
          <Tanlov qiymat={sozlama.source} onChange={v => !qulf && s({ source: v })}
            variantlar={[{ v: 'bank', nom: 'Savollar bankidan' }, { v: 'kalit', nom: "O'z kitobchasi — faqat kalit" }]} />
        </Maydon>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Maydon nom="Nomi" className="lg:col-span-2"><input className={INPUT} value={nom} onChange={e => setNom(e.target.value)} placeholder="Oylik DTM sinov — oktabr" /></Maydon>
          <Maydon nom="Sana"><input type="date" className={INPUT} value={sana} onChange={e => setSana(e.target.value)} /></Maydon>
          <Maydon nom="Davomiyligi (daqiqa)"><input type="number" min={10} max={600} className={INPUT} value={davom} onChange={e => setDavom(Number(e.target.value))} /></Maydon>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Maydon nom="Ball tizimi" izoh={scoring === 'blok' ? "Har fan savoliga o'z bali (DTM: 3.1 / 2.1 / 1.1)" : "Har savol 1 ball, natija foizda"}>
            <Tanlov qiymat={scoring} onChange={v => !qulf && setScoring(v)} variantlar={[{ v: 'blok', nom: 'Blok bali (DTM)' }, { v: 'foiz', nom: 'Foiz' }]} />
          </Maydon>
          <Maydon nom="Xato javob uchun jarima" izoh={qulfIzoh || (sozlama.xatoJarima
            ? `Har xato javobga savol balining ${JARIMALAR.find(j => j.v === sozlama.xatoJarima)?.nom || sozlama.xatoJarima} qismi ayiriladi; bo'sh javobga jarima yo'q`
            : "Yo'q — xato javob 0 ball (manfiy ball yo'q)")}>
            <div className="space-y-2">
              <Tanlov qiymat={sozlama.xatoJarima} onChange={v => !qulf && s({ xatoJarima: v })} variantlar={JARIMALAR} />
              {sozlama.xatoJarima > 0 && (
                <label className="flex items-center gap-2 text-[12.5px] text-matn cursor-pointer">
                  <input type="checkbox" disabled={qulf} className="w-3.5 h-3.5 accent-[var(--color-brand)]" checked={sozlama.jarimaNoldan} onChange={e => s({ jarimaNoldan: e.target.checked })} />
                  Har fan bali 0 dan pastga tushmasin
                </label>
              )}
            </div>
          </Maydon>
          <Maydon nom="O'tish bali" izoh={sozlama.otish ? `Natijada «O'tdi / O'tmadi» chiqadi: hisobotlarda, ota-onaga xabarda va natija sahifasida` : "Yo'q — natijada o'tdi/o'tmadi ko'rsatilmaydi"}>
            <div className="flex items-center gap-2">
              <div className="w-28 shrink-0">
                <input type="number" min={0} step="0.1" inputMode="decimal" className={INPUT} placeholder="yo'q" aria-label="O'tish bali"
                  value={sozlama.otish?.qiymat ?? ''}
                  onChange={e => { const q = Number(e.target.value); s({ otish: e.target.value === '' || !(q > 0) ? null : { turi: sozlama.otish?.turi || 'foiz', qiymat: q } }); }} />
              </div>
              <Tanlov qiymat={sozlama.otish?.turi || 'foiz'} onChange={v => sozlama.otish && s({ otish: { ...sozlama.otish, turi: v } })}
                variantlar={[{ v: 'foiz', nom: '%' }, { v: 'ball', nom: 'ball' }]} />
            </div>
          </Maydon>
          <Maydon nom="O'rin hisoblash" izoh={sozlama.orinUsuli === 'ketma' ? "Teng ball — bir o'rin, keyingisi ketma-ket: 1, 2, 2, 3" : "Teng ball — bir o'rin, keyingisi tashlab: 1, 2, 2, 4 (musobaqa tartibi)"}>
            <Tanlov qiymat={sozlama.orinUsuli} onChange={v => s({ orinUsuli: v })} variantlar={[{ v: 'otkazib', nom: '1, 2, 2, 4' }, { v: 'ketma', nom: '1, 2, 2, 3' }]} />
          </Maydon>
          {schools.length > 1 && (
            <Maydon nom="Qatnashadigan filiallar" izoh={qulfIzoh || 'Umumiy reyting shu filiallar bo\'yicha'}>
              <div className="flex flex-wrap gap-1.5">
                {schools.map(sc => {
                  const bel = filiallar.includes(sc.id);
                  return (
                    <button key={sc.id} type="button" disabled={qulf || sc.id === egaFilial}
                      onClick={() => setFiliallar(f => (bel ? f.filter(x => x !== sc.id) : [...f, sc.id]))}
                      className={`px-3 py-1.5 rounded-xl border text-[12.5px] font-semibold cursor-pointer disabled:cursor-default ${bel ? 'bg-brand text-brand-ust border-brand' : 'bg-ichki border-chiziq text-matn-sokin'}`}>
                      {sc.name}
                    </button>
                  );
                })}
              </div>
            </Maydon>
          )}
          {!kalitRejimi && (
            <Maydon nom="Savollar tili" izoh="Bankdan faqat shu tildagi savollar olinadi">
              <select className={SELECT} disabled={qulf} value={sozlama.language} onChange={e => s({ language: e.target.value as any })}>
                <option value="">Hamma til</option><option value="uz">O'zbekcha</option><option value="ru">Ruscha</option><option value="en">Inglizcha</option>
              </select>
            </Maydon>
          )}
        </div>
      </Karta>

      <Karta sarlavha="Tuzilma" izoh={qulfIzoh || (kalitRejimi
        ? "Har fan — alohida blok, kitobchadagi tartibda. Varaqda har fanda avval yopiq, keyin raqamli, keyin yozma savollar turadi — kitobcha raqamlari shunga mos bo'lsin."
        : "Har fan — alohida blok: savollar soni, qiyinlik va mavzular. Taqsimotni tizim o'zi hisoblaydi — jadvalda ko'rinadi, katagini qo'lda ham o'zgartirsa bo'ladi.")}
        amallar={!qulf && <Tugma kichik ikonka={<Wand2 size={14} />} onClick={dtmAndoza}>DTM andozasi</Tugma>}>
        <div className="space-y-3">
          {!kalitRejimi && (daraxt ? bloklar.map((b, bi) => (
            <BlokMuharriri key={b.id} blok={b} index={bi} daraxt={daraxt} scoring={scoring} kopaytma={kopaytma} qulf={qulf}
              onChange={nb => setBloklar(x => x.map((y, i) => (i === bi ? nb : y)))}
              onOchir={bloklar.length > 1 ? () => setBloklar(x => x.filter((_, i) => i !== bi)) : undefined} />
          )) : <Yuklanmoqda matn="Savollar banki yuklanmoqda…" />)}
          {kalitRejimi && bloklar.map((b, bi) => {
            const blokSavollar = b.topicRules.reduce((a, r) => a + (Number(r.count) || 0), 0);
            return (
              <div key={b.id} className="rounded-xl border border-chiziq bg-ichki/50 p-3 space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <Maydon nom={`${bi + 1}-blok: fan`} className="flex-1 min-w-48">
                    <input className={INPUT} disabled={qulf} list="imt-fanlar" value={b.subject} onChange={e => blokQoy(bi, { subject: e.target.value })} placeholder="Matematika" />
                  </Maydon>
                  {scoring === 'blok' && (
                    <Maydon nom="Bir savol bali" className="w-32">
                      <input className={INPUT} disabled={qulf} inputMode="decimal" value={b.pointsPerQuestion} onChange={e => blokQoy(bi, { pointsPerQuestion: Number(e.target.value.replace(',', '.')) || 0 })} />
                    </Maydon>
                  )}
                  <Maydon nom="Hisoblanadi" className="w-32">
                    <input className={INPUT} disabled={qulf} inputMode="numeric" value={b.tanlab ?? ''} placeholder="hammasi" title="«m tadan n tasini yeching»: o'quvchi istalgan n tasini yechadi, birinchi n ta javob hisoblanadi"
                      onChange={e => blokQoy(bi, { tanlab: parseInt(e.target.value.replace(/\D/g, '')) || null })} />
                  </Maydon>
                  <div className="pb-2.5 text-[12px] text-matn-xira whitespace-nowrap">{blokSavollar} ta savol</div>
                  {!qulf && bloklar.length > 1 && <button aria-label="Blokni o'chirish" onClick={() => setBloklar(x => x.filter((_, i) => i !== bi))} className="mb-1 p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={15} /></button>}
                </div>
                <div className="space-y-1.5">
                  {b.topicRules.map((r, ri) => (
                    <div key={ri} className="grid grid-cols-12 gap-1.5 items-center">
                      <select className={`${SELECT} col-span-6 sm:col-span-4`} disabled={qulf} value={r.type || 'yopiq'} onChange={e => qoidaQoy(bi, ri, { type: e.target.value as SavolTuri })}>
                        {(['yopiq', 'raqamli', 'yozma'] as SavolTuri[]).map(t => <option key={t} value={t}>{TUR_NOMI[t]}</option>)}
                      </select>
                      <input className={`${INPUT} col-span-3 sm:col-span-2`} disabled={qulf} type="number" min={1} value={r.count} onChange={e => qoidaQoy(bi, ri, { count: Number(e.target.value) })} aria-label="Soni" title="Savollar soni" />
                      <input className={`${INPUT} col-span-3 sm:col-span-2`} disabled={qulf} inputMode="decimal" value={r.points ?? ''} onChange={e => qoidaQoy(bi, ri, { points: e.target.value === '' ? undefined : Number(e.target.value.replace(',', '.')) })} placeholder="Ball" title="Shu qatordagi har bir savol bali (bo'sh — blokning «bir savol bali»)" />
                      <div className="col-span-10 sm:col-span-3 text-[11.5px] text-matn-xira">{r.count || 0} ta savol{r.points != null ? ` · har biri ${r.points} ball` : ''}</div>
                      {!qulf && <button aria-label="Qoidani o'chirish" onClick={() => blokQoy(bi, { topicRules: b.topicRules.filter((_, j) => j !== ri) })} className="col-span-2 sm:col-span-1 justify-self-end p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={14} /></button>}
                    </div>
                  ))}
                  {!qulf && <Tugma kichik turi="oddiy" ikonka={<Plus size={13} />} onClick={() => blokQoy(bi, { topicRules: [...b.topicRules, { topic: '', count: 5, type: 'yopiq' }] })}>Qoida qo'shish</Tugma>}
                </div>
              </div>
            );
          })}
          <datalist id="imt-fanlar">{(daraxt?.fanlar || []).map(f => <option key={f.id} value={f.name} />)}</datalist>
          {!qulf && <Tugma ikonka={<Plus size={14} />} onClick={() => setBloklar(x => [...x, kalitRejimi
            ? { id: yangiId(), subject: '', pointsPerQuestion: 1, topicRules: [{ topic: '', count: 10, type: 'yopiq' }] }
            : { id: yangiId(), subject: '', pointsPerQuestion: 1, topicRules: [] }])}>Fan (blok) qo'shish</Tugma>}
          <div className="flex flex-wrap gap-2 pt-1 text-[12px] text-matn-sokin">
            <Yorliq>{tuzilma.yopiq} ta yopiq</Yorliq>{tuzilma.raqamli > 0 && <Yorliq>{tuzilma.raqamli} ta raqamli</Yorliq>}{tuzilma.yozma > 0 && <Yorliq>{tuzilma.yozma} ta yozma</Yorliq>}<Yorliq rang="brand">Eng yuqori ball: {tuzilma.maks}</Yorliq>
          </div>
        </div>
      </Karta>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Karta sarlavha="Smenalar va variantlar" izoh={qulfIzoh}>
          <div className="space-y-3">
            {sozlama.sessions.map((ss, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={INPUT} value={ss.name} onChange={e => s({ sessions: sozlama.sessions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <input type="time" className={`${INPUT} w-32`} value={ss.time} onChange={e => s({ sessions: sozlama.sessions.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)) })} />
                {!qulf && sozlama.sessions.length > 1 && <button aria-label="Smenani o'chirish" onClick={() => s({ sessions: sozlama.sessions.filter((_, j) => j !== i) })} className="p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={14} /></button>}
              </div>
            ))}
            {!qulf && sozlama.sessions.length < 10 && <Tugma kichik turi="oddiy" ikonka={<Plus size={13} />} onClick={() => s({ sessions: [...sozlama.sessions, { id: sozlama.sessions.length + 1, name: `${sozlama.sessions.length + 1}-smena`, time: '' }] })}>Smena qo'shish</Tugma>}
            {sozlama.sessions.length > 1 && (
              <Maydon nom="Smenalarga savollar" izoh={sozlama.sessionQuestions === 'alohida' ? "Keyingi smenaga oldingisidagi savollar tushmaydi — bank ko'proq kerak" : 'Hamma smena bir xil savollarni oladi (tartibi har variantda boshqa)'}>
                <Tanlov qiymat={sozlama.sessionQuestions} onChange={v => !qulf && s({ sessionQuestions: v })} variantlar={[{ v: 'bir', nom: 'Bir xil' }, { v: 'alohida', nom: 'Har smenaga boshqa' }]} />
              </Maydon>
            )}
            <Maydon nom={kalitRejimi ? 'Kitobcha variantlari' : 'Variantlar soni'} izoh={kalitRejimi
              ? "Nechta turdagi kitobchangiz bor (A, B, C…). Har biriga kalit alohida kiritiladi; 4 va undan ko'p bo'lsa qo'shnilarga har xil variant tushadi."
              : "4 va undan ko'p bo'lsa, yondagi, oldingi, orqadagi va diagonaldagi qo'shnining varianti boshqa bo'ladi"}>
              <select className={`${SELECT} max-w-48`} disabled={qulf} value={sozlama.variantCount} onChange={e => s({ variantCount: Number(e.target.value) })}>
                {Array.from({ length: 26 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} ta ({VARIANT_KODLARI.slice(0, n).join(n > 6 ? '' : ', ').slice(0, 14)}{n > 6 ? '…' : ''})</option>)}
              </select>
            </Maydon>
            {kalitRejimi ? (
              <Maydon nom="Javob variantlari (doirachalar)" izoh="Kitobchadagi savollarda nechta javob varianti bor — varaqda shuncha doiracha chiqadi">
                <select className={`${SELECT} max-w-48`} disabled={qulf} value={sozlama.optionCount} onChange={e => s({ optionCount: Number(e.target.value) })}>
                  {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} ta ({['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n).join(', ')})</option>)}
                </select>
              </Maydon>
            ) : (
              <>
                <Almashtirgich yoqilgan={sozlama.shuffleQuestions} onChange={v => !qulf && s({ shuffleQuestions: v })} nom="Fan ichida savollar tartibi aralashsin" izoh="Matnga bog'langan savollar birga qoladi" />
                <Almashtirgich yoqilgan={sozlama.shuffleOptions} onChange={v => !qulf && s({ shuffleOptions: v })} nom="Javob variantlari aralashsin" izoh="Belgilangan savollardan tashqari (A va B to'g'ri kabi)" />
              </>
            )}
            <Almashtirgich yoqilgan={sozlama.variantBubble} onChange={v => s({ variantBubble: v })} nom="O'quvchi varaqqa kitobcha variantini ham bo'yaydi" izoh="Kitobcha almashib qolsa, skaner ushlaydi" />
          </div>
        </Karta>

        <div className="space-y-4">
          <Karta sarlavha="O'rinlashtirish">
            <div className="space-y-3">
              <Maydon nom="O'rinlar" izoh={sozlama.seatMode === 'shaxmat' ? "Har o'rindan keyin bittasi bo'sh (oldida ham, yonida ham) — xonalar ikki barobar ko'p kerak" : "Xonadagi hamma o'rin ishlatiladi"}>
                <Tanlov qiymat={sozlama.seatMode} onChange={v => s({ seatMode: v })} variantlar={[{ v: 'hammasi', nom: "Har o'rin" }, { v: 'shaxmat', nom: 'Shaxmat tartibi' }]} />
              </Maydon>
              {sozlama.sessions.length > 1 && (
                <Maydon nom="Smenalarga bo'lish">
                  <Tanlov qiymat={sozlama.sessionFill} onChange={v => s({ sessionFill: v })} variantlar={[{ v: 'teng', nom: 'Teng' }, { v: 'ketma', nom: 'Birinchisi to\'lgach' }, { v: 'kurs', nom: 'Kurs bittada' }]} />
                </Maydon>
              )}
            </div>
          </Karta>
          <Karta sarlavha="Onlayn test" izoh="Addmen CBT kabi: qatnashchi shaxsiy havola orqali telefonda yechadi (Telegram'da ham ochiladi)">
            <div className="space-y-3">
              <Almashtirgich yoqilgan={sozlama.onlayn.yoqilgan} onChange={v => s({ onlayn: { ...sozlama.onlayn, yoqilgan: v } })}
                nom="Onlayn topshirish mumkin" izoh={kalitRejimi ? "«Faqat kalit»: savollar qog'oz kitobchada, javoblar onlayn varaqqa belgilanadi" : "Savollar formulalar va rasmlar bilan ko'rinadi; javoblar o'zi saqlanadi, vaqt tugasa o'zi yakunlanadi"} />
              {sozlama.onlayn.yoqilgan && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Maydon nom="Ochiladi" izoh="Bo'sh — qulflangandan keyin darhol">
                    <input type="datetime-local" className={INPUT} value={sozlama.onlayn.ochiladi} onChange={e => s({ onlayn: { ...sozlama.onlayn, ochiladi: e.target.value } })} />
                  </Maydon>
                  <Maydon nom="Yopiladi" izoh="Bo'sh — cheklovsiz">
                    <input type="datetime-local" className={INPUT} value={sozlama.onlayn.yopiladi} onChange={e => s({ onlayn: { ...sozlama.onlayn, yopiladi: e.target.value } })} />
                  </Maydon>
                  <Maydon nom="Har qatnashchiga vaqt (daqiqa)" izoh={`Bo'sh — imtihon davomiyligi (${davom} daqiqa)`}>
                    <input type="number" min={0} max={600} className={INPUT} value={sozlama.onlayn.daqiqa || ''} placeholder={String(davom)}
                      onChange={e => s({ onlayn: { ...sozlama.onlayn, daqiqa: Math.max(0, Math.min(600, Number(e.target.value) || 0)) } })} />
                  </Maydon>
                </div>
              )}
            </div>
          </Karta>
          <Karta sarlavha="Natija va xabar">
            <div className="space-y-3">
              <Maydon nom="Reyting">
                <div className="flex flex-wrap items-center gap-2">
                  <Tanlov qiymat={sozlama.ranking} onChange={v => s({ ranking: v })} variantlar={[{ v: 'hammasi', nom: "Hammaga o'rni" }, { v: 'top', nom: 'Faqat eng yaxshilar' }, { v: 'yoq', nom: "O'rin yo'q" }]} />
                  {sozlama.ranking === 'top' && <input type="number" min={1} className={`${INPUT} w-24`} value={sozlama.topN} onChange={e => s({ topN: Number(e.target.value) || 10 })} aria-label="Nechta" />}
                </div>
              </Maydon>
              <Almashtirgich yoqilgan={sozlama.showQuestionsAfter} onChange={v => s({ showQuestionsAfter: v })}
                nom={kalitRejimi ? "Natijadan keyin o'quvchi har savoldagi javobini ko'radi" : "Natijadan keyin o'quvchi savollar va yechimlarni ko'radi"}
                izoh={kalitRejimi ? "Savol raqami, o'z javobi va to'g'ri javob (savol matni kitobchada)" : 'Ko\'rsatilgan savollar keyingi imtihonlarga tushmasligi kerak'} />
              <Almashtirgich yoqilgan={sozlama.rasch.enabled} onChange={v => s({ rasch: { ...sozlama.rasch, enabled: v } })}
                nom="Rasch bali (Milliy sertifikat uslubi)" izoh="E'londa har qatnashchiga T-ball (o'rtacha 50) va daraja; reyting shu ball bo'yicha. Qiyin savolni topgan yuqoriroq turadi. Yozma savollar hisobga olinmaydi." />
              {sozlama.rasch.enabled && (
                <Maydon nom="Darajalar" izoh="Har daraja uchun eng kam T-ball">
                  <div className="flex flex-wrap gap-1.5">
                    {sozlama.rasch.grades.map((g, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-chiziq bg-ichki px-2 py-1">
                        <input aria-label="Daraja nomi" className="w-8 bg-transparent text-[12.5px] font-semibold text-matn outline-none" value={g.label}
                          onChange={e => s({ rasch: { ...sozlama.rasch, grades: sozlama.rasch.grades.map((x, j) => (j === i ? { ...x, label: e.target.value.slice(0, 6) } : x)) } })} />
                        <span className="text-matn-xira text-[12px]">≥</span>
                        <input aria-label={`${g.label} uchun eng kam ball`} inputMode="decimal" className="w-10 bg-transparent text-[12.5px] text-matn outline-none raqam" value={g.min}
                          onChange={e => s({ rasch: { ...sozlama.rasch, grades: sozlama.rasch.grades.map((x, j) => (j === i ? { ...x, min: Number(e.target.value.replace(',', '.')) || 0 } : x)) } })} />
                      </span>
                    ))}
                  </div>
                </Maydon>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Maydon nom="Xabar kanali">
                  <select className={SELECT} value={sozlama.notify.channel} onChange={e => s({ notify: { ...sozlama.notify, channel: e.target.value as any } })}>
                    <option value="BOTH">Telegram, bo'lmasa SMS</option><option value="TELEGRAM">Faqat Telegram</option><option value="SMS">Faqat SMS</option><option value="NONE">Yubormaslik</option>
                  </select>
                </Maydon>
                <Maydon nom="Kimga">
                  <select className={SELECT} value={sozlama.notify.to} onChange={e => s({ notify: { ...sozlama.notify, to: e.target.value as any } })}>
                    <option value="PARENT">Ota-onaga</option><option value="STUDENT">O'quvchiga</option><option value="ALL">Ikkalasiga</option>
                  </select>
                </Maydon>
              </div>
              {sozlama.notify.channel !== 'NONE' && (
                <>
                  <Maydon nom="Xabar matni" izoh="{ism} {imtihon} {sana} {ball} {maks} {foiz} {holat} {rasch} {daraja} {bloklar} {orin} {markaz} {havola}">
                    <textarea rows={5} className={INPUT} value={sozlama.notify.template} onChange={e => s({ notify: { ...sozlama.notify, template: e.target.value } })} />
                  </Maydon>
                  <div className="flex items-center justify-between">
                    <p className="text-[11.5px] text-matn-xira">Namuna:</p>
                    {sozlama.notify.template !== STANDART_SHABLON && <Tugma kichik turi="oddiy" onClick={() => s({ notify: { ...sozlama.notify, template: SOZLAMA_STANDART.notify.template } })}>Standart matn</Tugma>}
                  </div>
                  <pre className="whitespace-pre-wrap rounded-xl bg-ichki border border-chiziq p-3 text-[12.5px] text-matn font-sans">{xabarNamuna}</pre>
                </>
              )}
            </div>
          </Karta>
          <Karta sarlavha="Ruxsatnoma" izoh="Qatnashchiga imtihon vaqti, xonasi va o'rni">
            <div className="space-y-3">
              <Almashtirgich yoqilgan={sozlama.admit.auto} onChange={v => s({ admit: { ...sozlama.admit, auto: v } })}
                nom="Imtihondan bir kun oldin o'zi yuborilsin" izoh="Soat 12:00 dan keyin, o'rin berilgan qatnashchilarga. Qo'lda ham yuborsa bo'ladi (Qatnashchilar bo'limi)." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Maydon nom="Kanal">
                  <select className={SELECT} value={sozlama.admit.channel} onChange={e => s({ admit: { ...sozlama.admit, channel: e.target.value as any } })}>
                    <option value="TELEGRAM">Faqat Telegram</option><option value="BOTH">Telegram, bo'lmasa SMS</option><option value="SMS">Faqat SMS</option><option value="NONE">Yubormaslik</option>
                  </select>
                </Maydon>
                <Maydon nom="Kimga">
                  <select className={SELECT} value={sozlama.admit.to} onChange={e => s({ admit: { ...sozlama.admit, to: e.target.value as any } })}>
                    <option value="ALL">O'quvchi va ota-onaga</option><option value="STUDENT">O'quvchiga</option><option value="PARENT">Ota-onaga</option>
                  </select>
                </Maydon>
              </div>
              {sozlama.admit.channel !== 'NONE' && (
                <>
                  <Maydon nom="Matn" izoh="{ism} {imtihon} {sana} {vaqt} {filial} {xona} {qator} {orin} {markaz}">
                    <textarea rows={6} className={INPUT} value={sozlama.admit.template} onChange={e => s({ admit: { ...sozlama.admit, template: e.target.value } })} />
                  </Maydon>
                  <div className="flex items-center justify-between">
                    <p className="text-[11.5px] text-matn-xira">Namuna:</p>
                    {sozlama.admit.template !== RUXSATNOMA_SHABLON && <Tugma kichik turi="oddiy" onClick={() => s({ admit: { ...sozlama.admit, template: RUXSATNOMA_SHABLON } })}>Standart matn</Tugma>}
                  </div>
                  <pre className="whitespace-pre-wrap rounded-xl bg-ichki border border-chiziq p-3 text-[12.5px] text-matn font-sans">{ruxsatnomaNamuna}</pre>
                </>
              )}
            </div>
          </Karta>
        </div>
      </div>
    </div>
  );
}
