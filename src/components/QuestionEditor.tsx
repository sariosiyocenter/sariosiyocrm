import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Plus, X, ImagePlus, CheckCircle2, FileText, Sparkles, Copy, Languages } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import RichTextEditor from './RichTextEditor';
import { useImtihonApi } from './imtihon/useImtihonApi';
import { Karta, Tugma, Maydon, INPUT, SELECT, Tanlov, Almashtirgich, Yorliq, Yuklanmoqda } from './imtihon/ui';
import MatnlarOynasi from './imtihon/MatnlarOynasi';
import { useAiHolat, AI_SOZLANMAGAN } from './imtihon/useAiHolat';
import { SavolKorinishi } from './QuestionsList';
import { HARFLAR, RAQAM_USTUNLARI, savolXatosi } from '../../lib/imtihon.js';
import type { Question, Passage, SavolTuri } from '../types';

// Savol qo'shish va tahrirlash. Fan, mavzu va boshqa "umumiy" maydonlar
// "Saqlash va keyingisi" dan keyin ham qoladi — bitta mavzuga 20 ta savol
// ketma-ket kiritiladi. Formulalar $...$ ichida LaTeX bilan yoziladi.

type Umumiy = { subject: string; topic: string; section: string; grade: string; source: string; language: 'uz' | 'ru' | 'en'; difficulty: number; status: 'faol' | 'qoralama' | 'arxiv' };
type Shaxsiy = {
  type: SavolTuri; text: string; imageUrl: string | null; options: string[]; correctAnswer: string; answers: string;
  points: string; lockOptions: boolean; solution: string; solutionStatus: 'yoq' | 'qoralama' | 'tasdiqlangan'; passage: { id: number; title?: string | null } | null;
};

const BOSH_SHAXSIY: Shaxsiy = {
  type: 'yopiq', text: '', imageUrl: null, options: ['', '', '', ''], correctAnswer: 'A', answers: '', points: '',
  lockOptions: false, solution: '', solutionStatus: 'yoq', passage: null,
};

interface Meta { fanlar: { nomi: string }[]; mavzular: { fan: string; mavzu: string }[]; manbalar: string[] }

export default function QuestionEditor() {
  const { id } = useParams();
  const tahrirRejimi = !!id;
  const navigate = useNavigate();
  const { showNotification, ozgartira, selectedSchoolId, user } = useCRM();
  const savolTahrir = ozgartira('imtihonlar.savollar');
  const savolOchirish = ozgartira('imtihonlar.ochirish');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();

  const [umumiy, setUmumiy] = useState<Umumiy>({ subject: '', topic: '', section: '', grade: '', source: '', language: 'uz', difficulty: 2, status: 'faol' });
  const [q, setQ] = useState<Shaxsiy>(BOSH_SHAXSIY);
  const [muharrirKaliti, setMuharrirKaliti] = useState(0);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(tahrirRejimi);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [qoshildi, setQoshildi] = useState(0);
  const [matnTanlash, setMatnTanlash] = useState(false);
  const [ishlatilgan, setIshlatilgan] = useState(0);
  const ai = useAiHolat();
  const [aiBand, setAiBand] = useState<string | null>(null);

  useEffect(() => { soro<Meta>('GET', 'questions/meta').then(setMeta).catch(() => {}); }, [soro]);

  useEffect(() => {
    if (!id) return;
    soro<Question>('GET', `questions/${id}`).then(s => {
      setUmumiy({
        subject: s.subject, topic: s.topic, section: s.section || '', grade: s.grade || '', source: s.source || '',
        language: (s.language as any) || 'uz', difficulty: s.difficulty || 2, status: (s.status as any) || 'faol',
      });
      setQ({
        type: s.type, text: s.text || '', imageUrl: s.imageUrl || null,
        options: s.options?.length ? s.options : ['', '', '', ''],
        correctAnswer: s.correctAnswer || (s.type === 'yopiq' ? 'A' : ''),
        answers: (s.answers || []).join(', '), points: s.points != null ? String(s.points) : '',
        lockOptions: !!s.lockOptions, solution: s.solution || '', solutionStatus: (s.solutionStatus as any) || 'yoq',
        passage: s.passage || (s.passageId ? { id: s.passageId } : null),
      });
      setIshlatilgan(s.usedCount || 0);
      setMuharrirKaliti(k => k + 1);
    }).catch(e => showNotification(e.message, 'error')).finally(() => setYuklanmoqda(false));
  }, [id, soro, showNotification]);

  const mavzular = useMemo(
    () => [...new Set((meta?.mavzular || []).filter(m => !umumiy.subject || m.fan.toLowerCase() === umumiy.subject.toLowerCase()).map(m => m.mavzu))],
    [meta, umumiy.subject],
  );

  const yuk = (): Record<string, any> => ({
    ...umumiy,
    section: umumiy.section || null, grade: umumiy.grade || null, source: umumiy.source || null,
    type: q.type, text: q.text, imageUrl: q.imageUrl,
    options: q.type === 'yopiq' ? q.options : null,
    correctAnswer: q.type === 'yozma' ? '' : q.correctAnswer.trim(),
    answers: q.type === 'raqamli' ? q.answers.split(/;\s*|\s+/).map(x => x.trim()).filter(Boolean) : null,
    points: q.type === 'yozma' && q.points ? Number(q.points.replace(',', '.')) : null,
    lockOptions: q.lockOptions,
    solution: q.solution || null,
    solutionStatus: q.solution ? q.solutionStatus : 'yoq',
    passageId: q.passage?.id ?? null,
  });

  // Raqamli javobdagi vergul — o'nli kasr belgisi ("0,5"), shuning uchun qo'shimcha
  // javoblar faqat nuqtali vergul yoki bo'shliq bilan ajratiladi (yuk() da).
  const oldindanKorish: Question = useMemo(() => ({ id: 0, schoolId: 0, ...yuk() } as any), [q, umumiy]); // eslint-disable-line react-hooks/exhaustive-deps

  const xato = umumiy.status === 'faol' ? savolXatosi(oldindanKorish) : null;

  const saqla = async (davom: boolean) => {
    if (!savolTahrir) return;
    if (!umumiy.subject.trim() || !umumiy.topic.trim()) return showNotification('Fan va mavzuni kiriting', 'error');
    if (xato) return showNotification(`${xato}. Tayyor bo'lmasa — holatini "Qoralama" qiling.`, 'error');
    setSaqlanmoqda(true);
    try {
      const schoolId = selectedSchoolId && selectedSchoolId > 0 ? selectedSchoolId : user?.schoolId;
      if (tahrirRejimi) {
        await soro('PUT', `questions/${id}`, yuk());
        showNotification('Savol saqlandi', 'success');
        navigate('/exams?tab=savollar');
      } else {
        await soro('POST', 'questions', { ...yuk(), schoolId });
        setQoshildi(n => n + 1);
        if (davom) {
          setQ({ ...BOSH_SHAXSIY, options: Array(q.type === 'yopiq' ? q.options.length : 4).fill(''), type: q.type, passage: q.passage });
          setMuharrirKaliti(k => k + 1);
          showNotification("Savol qo'shildi — keyingisini kiriting", 'success');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          navigate('/exams?tab=savollar');
        }
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  // AI: yechim — qoralama sifatida muharrirga tushadi (ustoz tekshirib saqlaydi);
  // klon va tarjima — bankka qoralama savol bo'lib yoziladi.
  const aiIsh = async (nom: string, f: () => Promise<void>) => {
    setAiBand(nom);
    try { await f(); } catch (e: any) { showNotification(e.message, 'error'); } finally { setAiBand(null); }
  };
  const aiYechim = () => aiIsh('yechim', async () => {
    if (q.solution && !(await confirm("Hozirgi yechim AI qoralamasi bilan almashtirilsinmi? (Saqlamaguningizcha bazada o'zgarmaydi)"))) return;
    const r = await soro<{ yechim: string; aiJavobi: string; mos: boolean | null }>('POST', `questions/${id}/ai/yechim`, {});
    setQ(s => ({ ...s, solution: r.yechim, solutionStatus: 'qoralama' }));
    setMuharrirKaliti(k => k + 1);
    if (r.mos === false) showNotification(`AI boshqa javob chiqardi (${r.aiJavobi}) — kalitni yoki yechimni tekshiring`, 'error');
    else showNotification(r.mos ? `Yechim qoralamasi tayyor — AI javobi kalit bilan mos (${r.aiJavobi})` : 'Yechim qoralamasi tayyor — tekshirib saqlang', 'success');
  });
  const aiKlon = () => aiIsh('klon', async () => {
    const r = await soro<{ yaratildi: { id: number; tekshirildi: boolean | null }[] }>('POST', `questions/${id}/ai/klon`, { soni: 3 });
    const otdi = r.yaratildi.filter(k => k.tekshirildi).length;
    showNotification(r.yaratildi.length
      ? `${r.yaratildi.length} ta klon qoralama bo'lib bankka qo'shildi${q.type !== 'yozma' ? ` (${otdi} tasi AI tekshiruvidan o'tdi)` : ''} — manbasi «AI klon»`
      : "AI yaroqli klon bermadi — qayta urinib ko'ring", r.yaratildi.length ? 'success' : 'error');
  });
  const aiTarjima = (til: string) => aiIsh('tarjima', async () => {
    const r = await soro<{ id: number }>('POST', `questions/${id}/ai/tarjima`, { til });
    showNotification("Tarjima qoralama bo'lib saqlandi — tekshirib, faol qiling", 'success');
    navigate(`/questions/${r.id}/edit`);
  });

  const ochir = async () => {
    if (!(await confirm("Savol o'chirilsinmi?"))) return;
    try {
      await soro('DELETE', `questions/${id}`);
      navigate('/exams?tab=savollar');
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  const rasm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) return showNotification('Rasm 2.5 MB dan kichik bo\'lsin', 'error');
    const r = new FileReader();
    r.onload = ev => setQ(s => ({ ...s, imageUrl: String(ev.target?.result || '') }));
    r.readAsDataURL(file);
  };

  const variantQoy = (i: number, v: string) => setQ(s => ({ ...s, options: s.options.map((o, j) => (j === i ? v : o)) }));
  const variantQosh = () => setQ(s => (s.options.length < HARFLAR.length ? { ...s, options: [...s.options, ''] } : s));
  const variantOchir = (i: number) => setQ(s => {
    if (s.options.length <= 2) return s;
    const options = s.options.filter((_, j) => j !== i);
    const k = HARFLAR.indexOf(s.correctAnswer);
    const correctAnswer = k === i ? '' : k > i ? HARFLAR[k - 1] : s.correctAnswer;
    return { ...s, options, correctAnswer };
  });

  if (yuklanmoqda) return <Yuklanmoqda />;

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button aria-label="Orqaga" onClick={() => navigate('/exams?tab=savollar')} className="w-10 h-10 bg-sirt border border-chiziq rounded-xl flex items-center justify-center text-matn-sokin hover:text-brand cursor-pointer"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-[15px] font-bold text-matn">{tahrirRejimi ? `Savol #${id}` : "Yangi savol"}</h1>
            <p className="text-[12px] text-matn-xira">{tahrirRejimi ? (ishlatilgan ? `${ishlatilgan} ta imtihonda ishlatilgan` : "Hali imtihonda ishlatilmagan") : "Fan va mavzu keyingi savolga ham o'tadi"}</p>
          </div>
          {qoshildi > 0 && <Yorliq rang="yaxshi"><CheckCircle2 size={12} /> {qoshildi} ta qo'shildi</Yorliq>}
        </div>
        {savolTahrir && (
          <div className="flex flex-wrap gap-2">
            {tahrirRejimi && ai && (
              <>
                <Tugma ikonka={<Copy size={14} />} disabled={!ai.yoqilgan} title={ai.yoqilgan ? "Shu ko'nikmaga 3 ta yangi savol (qoralama)" : AI_SOZLANMAGAN} yuklanmoqda={aiBand === 'klon'} onClick={aiKlon}>AI klon</Tugma>
                <label className={`relative inline-flex items-center gap-1.5 rounded-xl border border-chiziq bg-sirt px-3 text-[13px] font-semibold text-matn ${ai.yoqilgan && !aiBand ? 'cursor-pointer hover:bg-ichki' : 'opacity-50'}`} title={ai.yoqilgan ? 'Boshqa tilga (qoralama nusxa)' : AI_SOZLANMAGAN}>
                  <Languages size={14} /> {aiBand === 'tarjima' ? 'Tarjima…' : 'Tarjima'}
                  <select aria-label="Tarjima tili" disabled={!ai.yoqilgan || !!aiBand} value="" onChange={e => e.target.value && aiTarjima(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-default">
                    <option value="">Tilni tanlang</option>
                    {(['uz', 'ru', 'en'] as const).filter(t => t !== umumiy.language).map(t => <option key={t} value={t}>{{ uz: "O'zbekchaga", ru: 'Ruschaga', en: 'Inglizchaga' }[t]}</option>)}
                  </select>
                </label>
              </>
            )}
            {tahrirRejimi && savolOchirish && <Tugma turi="xavfli" ikonka={<Trash2 size={14} />} onClick={ochir}>O'chirish</Tugma>}
            {!tahrirRejimi && <Tugma ikonka={<Plus size={14} />} yuklanmoqda={saqlanmoqda} onClick={() => saqla(true)}>Saqlash va keyingisi</Tugma>}
            <Tugma turi="asosiy" ikonka={<Save size={14} />} yuklanmoqda={saqlanmoqda} onClick={() => saqla(false)}>{tahrirRejimi ? 'Saqlash' : 'Saqlash va chiqish'}</Tugma>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Chap: umumiy maydonlar */}
        <Karta sarlavha="Savol qayerga tegishli" izoh="Imtihon shablonidagi fan va mavzu bilan bir xil yozilsin" className="xl:col-span-1 h-fit">
          <div className="space-y-3">
            <Maydon nom="Fan">
              <input className={INPUT} list="fanlar-royxati" value={umumiy.subject} onChange={e => setUmumiy({ ...umumiy, subject: e.target.value })} placeholder="Matematika" />
              <datalist id="fanlar-royxati">{(meta?.fanlar || []).map(f => <option key={f.nomi} value={f.nomi} />)}</datalist>
            </Maydon>
            <Maydon nom="Mavzu">
              <input className={INPUT} list="mavzular-royxati" value={umumiy.topic} onChange={e => setUmumiy({ ...umumiy, topic: e.target.value })} placeholder="Kvadrat tenglama" />
              <datalist id="mavzular-royxati">{mavzular.map(m => <option key={m} value={m} />)}</datalist>
            </Maydon>
            <div className="grid grid-cols-2 gap-3">
              <Maydon nom="Bo'lim"><input className={INPUT} value={umumiy.section} onChange={e => setUmumiy({ ...umumiy, section: e.target.value })} placeholder="Algebra" /></Maydon>
              <Maydon nom="Sinf"><input className={INPUT} value={umumiy.grade} onChange={e => setUmumiy({ ...umumiy, grade: e.target.value })} placeholder="11-sinf" /></Maydon>
            </div>
            <Maydon nom="Manba">
              <input className={INPUT} list="manbalar-royxati" value={umumiy.source} onChange={e => setUmumiy({ ...umumiy, source: e.target.value })} placeholder="DTM 2025, Milliy sertifikat..." />
              <datalist id="manbalar-royxati">{(meta?.manbalar || []).map(m => <option key={m} value={m} />)}</datalist>
            </Maydon>
            <div className="grid grid-cols-2 gap-3">
              <Maydon nom="Qiyinlik">
                <select className={SELECT} value={umumiy.difficulty} onChange={e => setUmumiy({ ...umumiy, difficulty: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>{d} — {['juda oson', 'oson', "o'rta", 'qiyin', 'juda qiyin'][d - 1]}</option>)}
                </select>
              </Maydon>
              <Maydon nom="Til">
                <select className={SELECT} value={umumiy.language} onChange={e => setUmumiy({ ...umumiy, language: e.target.value as any })}>
                  <option value="uz">O'zbekcha</option><option value="ru">Ruscha</option><option value="en">Inglizcha</option>
                </select>
              </Maydon>
            </div>
            <Maydon nom="Holati" izoh="Imtihonga faqat faol savollar tushadi">
              <Tanlov qiymat={umumiy.status} onChange={v => setUmumiy({ ...umumiy, status: v })} variantlar={[{ v: 'faol', nom: 'Faol' }, { v: 'qoralama', nom: 'Qoralama' }, { v: 'arxiv', nom: 'Arxiv' }]} />
            </Maydon>
            <Maydon nom="Umumiy matn" izoh="Bir nechta savol bitta matnga bog'lansa — variantda birga turadi">
              {q.passage ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-chiziq bg-ichki px-3 py-2">
                  <span className="text-[13px] text-matn truncate"><FileText size={13} className="inline mr-1" />{q.passage.title || `Matn #${q.passage.id}`}</span>
                  <button aria-label="Olib tashlash" onClick={() => setQ({ ...q, passage: null })} className="p-1 rounded hover:bg-sirt cursor-pointer"><X size={14} /></button>
                </div>
              ) : <Tugma kichik onClick={() => setMatnTanlash(true)}>Matn tanlash</Tugma>}
            </Maydon>
          </div>
        </Karta>

        {/* O'rta: savol */}
        <div className="xl:col-span-2 space-y-4">
          <Karta sarlavha="Savol" izoh="Formula: $x^2+1$, kasr: $\frac{1}{2}$, ildiz: $\sqrt{x}$">
            <div className="space-y-4">
              <Tanlov qiymat={q.type} onChange={v => setQ({ ...q, type: v, correctAnswer: v === 'yopiq' ? 'A' : '' })} variantlar={[
                { v: 'yopiq', nom: 'Yopiq (variantli)' }, { v: 'raqamli', nom: 'Raqamli javob' }, { v: 'yozma', nom: 'Yozma (ustoz baholaydi)' },
              ]} />
              <RichTextEditor key={`matn-${muharrirKaliti}`} content={q.text} onChange={text => setQ(s => ({ ...s, text }))} />
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-1.5 rounded-xl border border-chiziq bg-sirt hover:bg-ichki px-3 py-2 text-[12px] font-semibold text-matn cursor-pointer">
                  <ImagePlus size={14} /> Rasm {q.imageUrl ? 'almashtirish' : "qo'shish"}
                  <input type="file" accept="image/*" className="hidden" onChange={rasm} />
                </label>
                {q.imageUrl && <><img src={q.imageUrl} alt="" className="h-16 rounded-lg border border-chiziq bg-white" /><Tugma kichik turi="oddiy" onClick={() => setQ({ ...q, imageUrl: null })}>Olib tashlash</Tugma></>}
              </div>

              {q.type === 'yopiq' && (
                <div className="space-y-2">
                  <p className="text-[12px] font-semibold text-matn-sokin">Variantlar — to'g'risini belgilang</p>
                  {q.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button type="button" onClick={() => setQ({ ...q, correctAnswer: HARFLAR[i] })}
                        className={`w-9 h-9 shrink-0 rounded-full border-2 text-[13px] font-bold cursor-pointer ${q.correctAnswer === HARFLAR[i] ? 'bg-yaxshi border-yaxshi text-white' : 'border-chiziq-kuchli text-matn-sokin hover:border-yaxshi'}`}
                        aria-label={`${HARFLAR[i]} to'g'ri javob`}>{HARFLAR[i]}</button>
                      <input className={INPUT} value={o} onChange={e => variantQoy(i, e.target.value)} placeholder={`${HARFLAR[i]} variant`} />
                      {q.options.length > 2 && <button aria-label="Variantni o'chirish" onClick={() => variantOchir(i)} className="p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><X size={15} /></button>}
                    </div>
                  ))}
                  {q.options.length < HARFLAR.length && <Tugma kichik turi="oddiy" ikonka={<Plus size={13} />} onClick={variantQosh}>Variant qo'shish ({q.options.length}/{HARFLAR.length})</Tugma>}
                  <Almashtirgich yoqilgan={q.lockOptions} onChange={v => setQ({ ...q, lockOptions: v })} nom="Javoblar tartibi aralashtirilmasin" izoh={'"A va B to\'g\'ri", "Hammasi to\'g\'ri" kabi variantlar bo\'lsa'} />
                </div>
              )}
              {q.type === 'raqamli' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Maydon nom="To'g'ri javob" izoh={`Varaqdagi katakka ${RAQAM_USTUNLARI} belgigacha: raqamlar, minus, vergul, kasr (3/4)`}>
                    <input className={INPUT} value={q.correctAnswer} onChange={e => setQ({ ...q, correctAnswer: e.target.value })} placeholder="-1,5" />
                  </Maydon>
                  <Maydon nom="Yana qabul qilinadigan javoblar" izoh="Bo'sh joy yoki ; bilan: 1/2; 0,5">
                    <input className={INPUT} value={q.answers} onChange={e => setQ({ ...q, answers: e.target.value })} placeholder="0,5; 1/2" />
                  </Maydon>
                </div>
              )}
              {q.type === 'yozma' && (
                <Maydon nom="Eng yuqori ball (ixtiyoriy)" izoh="Imtihon shablonidagi qoida bali ustun turadi">
                  <input className={`${INPUT} max-w-40`} value={q.points} onChange={e => setQ({ ...q, points: e.target.value })} placeholder="5" inputMode="decimal" />
                </Maydon>
              )}
              {xato && (q.text || q.options.some(Boolean)) && <p className="text-[12px] text-xato">⚠ {xato}</p>}
            </div>
          </Karta>

          <Karta sarlavha="Yechim" izoh="O'quvchi natijadan keyin ko'radi — faqat tasdiqlangan bo'lsa"
            amallar={savolTahrir && ai && (
              <Tugma kichik ikonka={<Sparkles size={13} />} disabled={!ai.yoqilgan || !tahrirRejimi}
                title={!ai.yoqilgan ? AI_SOZLANMAGAN : !tahrirRejimi ? 'Avval savolni saqlang' : 'AI yechim yozadi — qoralama, siz tekshirasiz'}
                yuklanmoqda={aiBand === 'yechim'} onClick={aiYechim}>AI yechim</Tugma>
            )}>
            <div className="space-y-3">
              <RichTextEditor key={`yechim-${muharrirKaliti}`} content={q.solution} onChange={solution => setQ(s => ({ ...s, solution }))} />
              <Tanlov kichik qiymat={q.solutionStatus} onChange={v => setQ({ ...q, solutionStatus: v })} variantlar={[{ v: 'yoq', nom: "Yechim yo'q" }, { v: 'qoralama', nom: 'Qoralama' }, { v: 'tasdiqlangan', nom: 'Tasdiqlangan' }]} />
            </div>
          </Karta>

          <Karta sarlavha="Ko'rinishi" izoh="Kitobchada shunday chiqadi (variantlar tartibi har variantda aralashadi)">
            <SavolKorinishi q={oldindanKorish} />
          </Karta>
        </div>
      </div>
      {matnTanlash && <MatnlarOynasi onYop={() => setMatnTanlash(false)} tanlash={(p: Passage) => setQ(s => ({ ...s, passage: { id: p.id, title: p.title } }))} />}
    </div>
  );
}
