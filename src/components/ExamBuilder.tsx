import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Lock, Wand2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useImtihonApi } from './imtihon/useImtihonApi';
import { Karta, Tugma, Maydon, INPUT, SELECT, Tanlov, Almashtirgich, Yorliq, Yuklanmoqda } from './imtihon/ui';
import { SOZLAMA_STANDART, STANDART_SHABLON, RUXSATNOMA_SHABLON, sozlamaniTozala, varaqTuzilmasi, natijaXabari, ruxsatnomaMatni, VARIANT_KODLARI, vergul, sanaMatni } from '../../lib/imtihon.js';
import { toDateStr } from '../../lib/lessons.js';
import type { Exam, ExamBlock, ExamSettings, TopicRule, SavolTuri } from '../types';

// Imtihon tuzish. Egasining talabi (2026-09-24): "universal bo'lishi kerak" —
// ball tizimi, smenalar, filiallar, til, reyting va xabar kanali imtihonning
// o'z sozlamasi. Qulflangandan keyin tuzilma (bloklar, variantlar) o'zgarmaydi,
// faqat e'lon va xabar sozlamalari.

interface Meta { fanlar: { nomi: string; faol: number }[]; mavzular: { fan: string; mavzu: string; faol: Record<string, number> }[] }

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

export default function ExamBuilder() {
  const { id } = useParams();
  const tahrir = !!id;
  const navigate = useNavigate();
  const { schools, selectedSchoolId, user, addExam, updateExam, showNotification } = useCRM();
  const { soro } = useImtihonApi();

  const [meta, setMeta] = useState<Meta | null>(null);
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

  useEffect(() => { soro<Meta>('GET', 'questions/meta').then(setMeta).catch(() => {}); }, [soro]);

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

  /** Bankda shu qoidaga mos faol savollar soni. */
  const bor = (fan: string, rule: TopicRule) => {
    const tur = rule.type || 'yopiq';
    const f = fan.trim().toLowerCase();
    return (meta?.mavzular || [])
      .filter(m => m.fan.toLowerCase() === f && (!rule.topic.trim() || m.mavzu.toLowerCase() === rule.topic.trim().toLowerCase()))
      .reduce((a, m) => a + (m.faol[tur] || 0), 0);
  };
  const kopaytma = sozlama.sessionQuestions === 'alohida' ? sozlama.sessions.length : 1;

  const blokQoy = (bi: number, patch: Partial<ExamBlock>) => setBloklar(b => b.map((x, i) => (i === bi ? { ...x, ...patch } : x)));
  const qoidaQoy = (bi: number, ri: number, patch: Partial<TopicRule>) => setBloklar(b => b.map((x, i) => (i === bi ? { ...x, topicRules: x.topicRules.map((r, j) => (j === ri ? { ...r, ...patch } : r)) } : x)));

  const saqla = async () => {
    if (!nom.trim()) return showNotification('Imtihon nomini kiriting', 'error');
    if (!qulf) {
      if (bloklar.some(b => !b.subject.trim())) return showNotification('Har blokning fanini kiriting', 'error');
      if (!tuzilma.jami) return showNotification("Kamida bitta savol qoidasi kerak", 'error');
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
  });
  const ruxsatnomaNamuna = ruxsatnomaMatni(sozlama.admit.template, {
    ism: 'ALIYEV VALI', imtihon: nom || 'Oylik sinov', sana: sanaMatni(sana),
    vaqt: `${sozlama.sessions[0]?.time || '09:00'}${sozlama.sessions.length > 1 ? ` (${sozlama.sessions[0]?.name})` : ''}`,
    filial: schools.find(x => x.id === egaFilial)?.name || '', xona: '7-xona', qator: 2, orin: 3, markaz: 'Sariosiyo',
  });

  if (yuklanmoqda) return <Yuklanmoqda />;

  const qulfIzoh = qulf ? 'Savollar qulflangan — bu qism o\'zgarmaydi' : undefined;

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Maydon nom="Nomi" className="lg:col-span-2"><input className={INPUT} value={nom} onChange={e => setNom(e.target.value)} placeholder="Oylik DTM sinov — oktabr" /></Maydon>
          <Maydon nom="Sana"><input type="date" className={INPUT} value={sana} onChange={e => setSana(e.target.value)} /></Maydon>
          <Maydon nom="Davomiyligi (daqiqa)"><input type="number" min={10} max={600} className={INPUT} value={davom} onChange={e => setDavom(Number(e.target.value))} /></Maydon>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Maydon nom="Ball tizimi" izoh={scoring === 'blok' ? "Har fan savoliga o'z bali (DTM: 3.1 / 2.1 / 1.1)" : "Har savol 1 ball, natija foizda"}>
            <Tanlov qiymat={scoring} onChange={v => !qulf && setScoring(v)} variantlar={[{ v: 'blok', nom: 'Blok bali (DTM)' }, { v: 'foiz', nom: 'Foiz' }]} />
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
          <Maydon nom="Savollar tili" izoh="Bankdan faqat shu tildagi savollar olinadi">
            <select className={SELECT} disabled={qulf} value={sozlama.language} onChange={e => s({ language: e.target.value as any })}>
              <option value="">Hamma til</option><option value="uz">O'zbekcha</option><option value="ru">Ruscha</option><option value="en">Inglizcha</option>
            </select>
          </Maydon>
        </div>
      </Karta>

      <Karta sarlavha="Tuzilma" izoh={qulfIzoh || "Har fan — alohida blok. Mavzu bo'sh bo'lsa — fanning istalgan mavzusidan."}
        amallar={!qulf && <Tugma kichik ikonka={<Wand2 size={14} />} onClick={() => { setBloklar(DTM_ANDOZA.map(b => ({ ...b, id: yangiId() }))); setScoring('blok'); }}>DTM andozasi</Tugma>}>
        <div className="space-y-3">
          {bloklar.map((b, bi) => {
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
                  <div className="pb-2.5 text-[12px] text-matn-xira whitespace-nowrap">{blokSavollar} ta savol</div>
                  {!qulf && bloklar.length > 1 && <button aria-label="Blokni o'chirish" onClick={() => setBloklar(x => x.filter((_, i) => i !== bi))} className="mb-1 p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={15} /></button>}
                </div>
                <div className="space-y-1.5">
                  {b.topicRules.map((r, ri) => {
                    const mavjud = bor(b.subject, r);
                    const kerak = (Number(r.count) || 0) * kopaytma;
                    const yetadi = mavjud >= kerak;
                    const mavzuRoyxati = (meta?.mavzular || []).filter(m => m.fan.toLowerCase() === b.subject.trim().toLowerCase());
                    return (
                      <div key={ri} className="grid grid-cols-12 gap-1.5 items-center">
                        <input className={`${INPUT} col-span-12 sm:col-span-4`} disabled={qulf} list={`imt-mavzu-${bi}`} value={r.topic} onChange={e => qoidaQoy(bi, ri, { topic: e.target.value })} placeholder="Istalgan mavzu" />
                        <datalist id={`imt-mavzu-${bi}`}>{mavzuRoyxati.map(m => <option key={m.mavzu} value={m.mavzu} />)}</datalist>
                        <select className={`${SELECT} col-span-4 sm:col-span-2`} disabled={qulf} value={r.type || 'yopiq'} onChange={e => qoidaQoy(bi, ri, { type: e.target.value as SavolTuri })}>
                          {(['yopiq', 'raqamli', 'yozma'] as SavolTuri[]).map(t => <option key={t} value={t}>{TUR_NOMI[t]}</option>)}
                        </select>
                        <input className={`${INPUT} col-span-3 sm:col-span-1`} disabled={qulf} type="number" min={1} value={r.count} onChange={e => qoidaQoy(bi, ri, { count: Number(e.target.value) })} aria-label="Soni" />
                        <select className={`${SELECT} col-span-5 sm:col-span-2`} disabled={qulf} value={r.difficulty || ''} onChange={e => qoidaQoy(bi, ri, { difficulty: Number(e.target.value) || undefined })}>
                          <option value="">Har qanday qiyinlik</option>{[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>Qiyinlik {d}</option>)}
                        </select>
                        <input className={`${INPUT} col-span-4 sm:col-span-1`} disabled={qulf} inputMode="decimal" value={r.points ?? ''} onChange={e => qoidaQoy(bi, ri, { points: e.target.value === '' ? undefined : Number(e.target.value.replace(',', '.')) })} placeholder={r.type === 'yozma' ? 'Ball' : 'Ball'} title="Shu qoidadagi savol bali (bo'sh — blok bali)" />
                        <div className="col-span-6 sm:col-span-1 text-[11.5px]" title={`Bankda ${mavjud} ta faol savol${kopaytma > 1 ? `, kerak ${kerak} (smenalarga alohida)` : ''}`}>
                          {meta && b.subject.trim() ? (yetadi ? <span className="text-yaxshi inline-flex items-center gap-1"><CheckCircle2 size={12} />{mavjud}</span> : <span className="text-xato inline-flex items-center gap-1"><AlertTriangle size={12} />{mavjud}/{kerak}</span>) : null}
                        </div>
                        {!qulf && <button aria-label="Qoidani o'chirish" onClick={() => blokQoy(bi, { topicRules: b.topicRules.filter((_, j) => j !== ri) })} className="col-span-2 sm:col-span-1 justify-self-end p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={14} /></button>}
                      </div>
                    );
                  })}
                  {!qulf && <Tugma kichik turi="oddiy" ikonka={<Plus size={13} />} onClick={() => blokQoy(bi, { topicRules: [...b.topicRules, { topic: '', count: 5, type: 'yopiq' }] })}>Qoida qo'shish</Tugma>}
                </div>
              </div>
            );
          })}
          <datalist id="imt-fanlar">{(meta?.fanlar || []).map(f => <option key={f.nomi} value={f.nomi} />)}</datalist>
          {!qulf && <Tugma ikonka={<Plus size={14} />} onClick={() => setBloklar(x => [...x, { id: yangiId(), subject: '', pointsPerQuestion: scoring === 'blok' ? 1 : 1, topicRules: [{ topic: '', count: 10, type: 'yopiq' }] }])}>Blok (fan) qo'shish</Tugma>}
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
            <Maydon nom="Variantlar soni" izoh="4 va undan ko'p bo'lsa, yondagi, oldingi, orqadagi va diagonaldagi qo'shnining varianti boshqa bo'ladi">
              <select className={`${SELECT} max-w-48`} disabled={qulf} value={sozlama.variantCount} onChange={e => s({ variantCount: Number(e.target.value) })}>
                {Array.from({ length: 26 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} ta ({VARIANT_KODLARI.slice(0, n).join(n > 6 ? '' : ', ').slice(0, 14)}{n > 6 ? '…' : ''})</option>)}
              </select>
            </Maydon>
            <Almashtirgich yoqilgan={sozlama.shuffleQuestions} onChange={v => !qulf && s({ shuffleQuestions: v })} nom="Fan ichida savollar tartibi aralashsin" izoh="Matnga bog'langan savollar birga qoladi" />
            <Almashtirgich yoqilgan={sozlama.shuffleOptions} onChange={v => !qulf && s({ shuffleOptions: v })} nom="Javob variantlari aralashsin" izoh="Belgilangan savollardan tashqari (A va B to'g'ri kabi)" />
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
          <Karta sarlavha="Natija va xabar">
            <div className="space-y-3">
              <Maydon nom="Reyting">
                <div className="flex flex-wrap items-center gap-2">
                  <Tanlov qiymat={sozlama.ranking} onChange={v => s({ ranking: v })} variantlar={[{ v: 'hammasi', nom: "Hammaga o'rni" }, { v: 'top', nom: 'Faqat eng yaxshilar' }, { v: 'yoq', nom: "O'rin yo'q" }]} />
                  {sozlama.ranking === 'top' && <input type="number" min={1} className={`${INPUT} w-24`} value={sozlama.topN} onChange={e => s({ topN: Number(e.target.value) || 10 })} aria-label="Nechta" />}
                </div>
              </Maydon>
              <Almashtirgich yoqilgan={sozlama.showQuestionsAfter} onChange={v => s({ showQuestionsAfter: v })} nom="Natijadan keyin o'quvchi savollar va yechimlarni ko'radi" izoh="Ko'rsatilgan savollar keyingi imtihonlarga tushmasligi kerak" />
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
                  <Maydon nom="Xabar matni" izoh="{ism} {imtihon} {sana} {ball} {maks} {foiz} {rasch} {daraja} {bloklar} {orin} {markaz} {havola}">
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
