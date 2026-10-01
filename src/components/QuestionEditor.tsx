import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Plus, X, ImagePlus, CheckCircle2, FileText, Sparkles, Copy, Languages, Check } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import RichTextEditor from './RichTextEditor';
import { useImtihonApi } from './imtihon/useImtihonApi';
import { Karta, Tugma, Maydon, INPUT, SELECT, Tanlov, Almashtirgich, Yorliq, Yuklanmoqda } from './imtihon/ui';
import MatnlarOynasi from './imtihon/MatnlarOynasi';
import { useAiHolat, AI_SOZLANMAGAN } from './imtihon/useAiHolat';
import SavolKorinishi from './imtihon/bank/SavolKorinishi';
import { QiyinlikTanlov } from './imtihon/bank/qiyinlik';
import OxshashSavollar from './imtihon/bank/OxshashSavollar';
import { useBankDaraxt, fanniTop, mavzuniTop, bolimlarga } from './imtihon/bank/useBankDaraxt';
import { HARFLAR, RAQAM_USTUNLARI, MOSLASH_QATOR, MOSLASH_USTUN, savolXatosi, qiyinlikDarajasi, moslashQatorlari } from '../../lib/imtihon.js';
import type { Question, Passage, SavolTuri } from '../types';

// Savol qo'shish va tahrirlash. Fan va mavzu bank tuzilmasidan tanlanadi (shu
// yerning o'zida yangisini qo'shsa bo'ladi); fan, mavzu, qiyinlik va boshqa
// "umumiy" maydonlar "Saqlash va keyingisi" dan keyin ham qoladi — bitta
// mavzuga 20 ta savol ketma-ket kiritiladi. Formulalar $...$ ichida LaTeX bilan.

type Umumiy = { fanId: number | null; mavzuId: number | null; grade: string; source: string; remark: string; language: 'uz' | 'ru' | 'en'; difficulty: number; status: 'faol' | 'qoralama' | 'arxiv' };
type Tarjima = { til: 'uz' | 'ru' | 'en'; text: string; options: string[] };
type Shaxsiy = {
  type: SavolTuri; text: string; imageUrl: string | null; options: string[]; correctAnswer: string; answers: string;
  points: string; lockOptions: boolean; solution: string; solutionStatus: 'yoq' | 'qoralama' | 'tasdiqlangan'; passage: { id: number; title?: string | null } | null;
  /** Ikkinchi tildagi matn (Addmen "Bilingual") — null: yo'q. */
  tarjima: Tarjima | null;
  /** Variantlar kitobchada nechta ustunda (Addmen DISPLAY CHOICES): 0 — o'zi. */
  joylashuv: 0 | 1 | 2 | 4;
  /** Moslashtirish: o'ng ustun bandlari (P–T); chap ustun — `options`. */
  ong: string[];
};

const BOSH_SHAXSIY: Shaxsiy = {
  type: 'yopiq', text: '', imageUrl: null, options: ['', '', '', ''], correctAnswer: 'A', answers: '', points: '',
  lockOptions: false, solution: '', solutionStatus: 'yoq', passage: null, tarjima: null, joylashuv: 0, ong: ['', '', '', ''],
};

interface Meta { manbalar: string[] }

/** Kalit qatorlari — chap ustundagi har qatorga bittadan (bo'shi ham). */
function moslashKaliti(q: Pick<Shaxsiy, 'correctAnswer' | 'options'>): string[] {
  const k = moslashQatorlari(q.correctAnswer) as string[];
  return q.options.map((_, i) => k[i] || '');
}

export default function QuestionEditor() {
  const { id } = useParams();
  const tahrirRejimi = !!id;
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const { showNotification, ozgartira, selectedSchoolId, user } = useCRM();
  const savolTahrir = ozgartira('imtihonlar.savollar');
  const savolOchirish = ozgartira('imtihonlar.ochirish');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const { daraxt, yangila: daraxtniYangila } = useBankDaraxt();

  const [umumiy, setUmumiy] = useState<Umumiy>(() => ({
    fanId: Number(urlParams.get('fan')) || null, mavzuId: Number(urlParams.get('mavzu')) || null,
    grade: '', source: '', remark: '', language: 'uz', difficulty: qiyinlikDarajasi(urlParams.get('qiyinlik') || 2), status: 'faol',
  }));
  // Shu yerning o'zida yangi fan yoki mavzu qo'shish.
  const [yangiNom, setYangiNom] = useState<{ tur: 'fan' | 'mavzu'; nom: string } | null>(null);
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
  const [oxshash, setOxshash] = useState(false);

  useEffect(() => { soro<Meta>('GET', 'questions/meta').then(setMeta).catch(() => {}); }, [soro]);

  // URL da faqat mavzu kelsa — uning fani ham tanlanadi.
  useEffect(() => {
    if (!daraxt || umumiy.fanId || !umumiy.mavzuId) return;
    const f = daraxt.fanlar.find(x => x.mavzular.some(m => m.id === umumiy.mavzuId));
    if (f) setUmumiy(u => ({ ...u, fanId: f.id }));
  }, [daraxt, umumiy.fanId, umumiy.mavzuId]);

  useEffect(() => {
    if (!id) return;
    soro<Question>('GET', `questions/${id}`).then(s => {
      setUmumiy({
        fanId: null, mavzuId: s.bankTopicId || null, grade: s.grade || '', source: s.source || '', remark: s.remark || '',
        language: (s.language as any) || 'uz', difficulty: qiyinlikDarajasi(s.difficulty || 2), status: (s.status as any) || 'faol',
      });
      setQ({
        type: s.type, text: s.text || '', imageUrl: s.imageUrl || null,
        options: s.options?.length ? s.options : ['', '', '', ''],
        correctAnswer: s.correctAnswer || (s.type === 'yopiq' ? 'A' : ''),
        answers: s.type === 'moslash' ? '' : (s.answers || []).join(', '), points: s.points != null ? String(s.points) : '',
        lockOptions: !!s.lockOptions, solution: s.solution || '', solutionStatus: (s.solutionStatus as any) || 'yoq',
        passage: s.passage || (s.passageId ? { id: s.passageId } : null),
        tarjima: s.tarjima ? { til: s.tarjima.til || 'ru', text: s.tarjima.text || '', options: s.tarjima.options || [] } : null,
        joylashuv: s.joylashuv || 0,
        ong: s.type === 'moslash' && s.answers?.length ? s.answers : ['', '', '', ''],
      });
      setIshlatilgan(s.usedCount || 0);
      setMuharrirKaliti(k => k + 1);
    }).catch(e => showNotification(e.message, 'error')).finally(() => setYuklanmoqda(false));
  }, [id, soro, showNotification]);

  const fan = fanniTop(daraxt, umumiy.fanId);
  const mavzu = mavzuniTop(fan, umumiy.mavzuId);

  const yangiQosh = async () => {
    if (!yangiNom?.nom.trim()) return;
    try {
      if (yangiNom.tur === 'fan') {
        const f = await soro<{ id: number }>('POST', 'bank/fanlar', { name: yangiNom.nom });
        await daraxtniYangila();
        setUmumiy(u => ({ ...u, fanId: f.id, mavzuId: null }));
      } else {
        const m = await soro<{ id: number }>('POST', 'bank/mavzular', { subjectId: umumiy.fanId, name: yangiNom.nom });
        await daraxtniYangila();
        setUmumiy(u => ({ ...u, mavzuId: m.id }));
      }
      setYangiNom(null);
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // Saqlagach — savol turgan mavzu sahifasiga (bank ichida).
  const bankga = () => navigate(fan && mavzu ? `/exams?tab=savollar&fan=${fan.id}&mavzu=${mavzu.id}` : '/exams?tab=savollar');

  const yuk = (): Record<string, any> => ({
    bankTopicId: mavzu?.id ?? null, subject: fan?.name || '', topic: mavzu?.name || '',
    difficulty: umumiy.difficulty, status: umumiy.status, language: umumiy.language,
    grade: umumiy.grade || null, source: umumiy.source || null, remark: umumiy.remark.trim() || null,
    tarjima: q.tarjima && (q.tarjima.text.trim() || q.tarjima.options.some(x => x.trim())) ? { ...q.tarjima, options: q.type === 'yopiq' ? q.options.map((_, i) => q.tarjima!.options[i] || '') : [] } : null,
    type: q.type, text: q.text, imageUrl: q.imageUrl, joylashuv: q.type === 'yopiq' && q.joylashuv ? q.joylashuv : null,
    options: q.type === 'yopiq' || q.type === 'moslash' ? q.options : null,
    correctAnswer: q.type === 'yozma' ? '' : q.type === 'moslash' ? moslashKaliti(q).join('|') : q.correctAnswer.trim(),
    answers: q.type === 'raqamli' ? q.answers.split(/;\s*|\s+/).map(x => x.trim()).filter(Boolean) : q.type === 'moslash' ? q.ong : null,
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
    if (!fan || !mavzu) return showNotification('Fan va mavzuni tanlang', 'error');
    if (xato) return showNotification(`${xato}. Tayyor bo'lmasa — holatini "Qoralama" qiling.`, 'error');
    setSaqlanmoqda(true);
    try {
      const schoolId = selectedSchoolId && selectedSchoolId > 0 ? selectedSchoolId : user?.schoolId;
      if (tahrirRejimi) {
        await soro('PUT', `questions/${id}`, yuk());
        showNotification('Savol saqlandi', 'success');
        bankga();
      } else {
        await soro('POST', 'questions', { ...yuk(), schoolId });
        setQoshildi(n => n + 1);
        if (davom) {
          setQ({ ...BOSH_SHAXSIY, options: Array(q.type === 'yopiq' || q.type === 'moslash' ? q.options.length : 4).fill(''), ong: Array(q.ong.length).fill(''), type: q.type, passage: q.passage });
          setMuharrirKaliti(k => k + 1);
          showNotification("Savol qo'shildi — keyingisini kiriting", 'success');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          bankga();
        }
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  // AI: yechim — qoralama sifatida muharrirga tushadi (ustoz tekshirib saqlaydi);
  // tarjima — bankka qoralama savol bo'lib yoziladi; o'xshash savollar — oynada
  // ko'rib, tanlab qo'shiladi (OxshashSavollar).
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
  // "Ikkinchi til" maydonini AI tarjimasi bilan to'ldirish (saqlanmaydi — tekshirib saqlaysiz).
  const aiIkkinchiTil = () => aiIsh('ikkinchi', async () => {
    const til = q.tarjima?.til || 'ru';
    const r = await soro<Tarjima>('POST', `questions/${id}/ai/tarjima-matn`, { til });
    setQ(x => ({ ...x, tarjima: { til: r.til, text: r.text, options: r.options || [] } }));
    setMuharrirKaliti(k => k + 1);
    showNotification("Tarjima to'ldirildi — tekshirib, saqlang", 'success');
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
      bankga();
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

  // Moslashtirish: chap qator qo'shish/o'chirish va kalit to'rida belgilash.
  const qatorOchir = (i: number) => setQ(s => {
    if (s.options.length <= 2) return s;
    const k = moslashKaliti(s).filter((_, j) => j !== i);
    return { ...s, options: s.options.filter((_, j) => j !== i), correctAnswer: k.join('|') };
  });
  const ongOchir = (i: number) => setQ(s => {
    if (s.ong.length <= 2) return s;
    // O'chirilgan ustun harfi kalitdan chiqadi, keyingilari bitta chapga suriladi.
    const sur = (x: string) => [...x].filter(h => MOSLASH_USTUN.indexOf(h) !== i).map(h => { const c = MOSLASH_USTUN.indexOf(h); return c > i ? MOSLASH_USTUN[c - 1] : h; }).join('');
    return { ...s, ong: s.ong.filter((_, j) => j !== i), correctAnswer: moslashKaliti(s).map(sur).join('|') };
  });
  const katakBelgila = (r: number, c: number) => setQ(s => {
    const k = moslashKaliti(s);
    const h = MOSLASH_USTUN[c];
    k[r] = (k[r].includes(h) ? k[r].replace(h, '') : k[r] + h).split('').sort().join('');
    return { ...s, correctAnswer: k.join('|') };
  });

  if (yuklanmoqda) return <Yuklanmoqda />;

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button aria-label="Orqaga" onClick={bankga} className="w-10 h-10 bg-sirt border border-chiziq rounded-xl flex items-center justify-center text-matn-sokin hover:text-brand cursor-pointer"><ArrowLeft size={18} /></button>
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
                <Tugma ikonka={<Copy size={14} />} disabled={!daraxt} title="AI shu savolga o'xshash, sonlari va javobi boshqa savollar tuzadi — ko'rib, tanlab qo'shasiz" onClick={() => setOxshash(true)}>O'xshash savollar</Tugma>
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
        <Karta sarlavha="Savol qayerga tegishli" izoh="Bank tuzilmasi: fan → mavzu → qiyinlik" className="xl:col-span-1 h-fit">
          <div className="space-y-3">
            <Maydon nom="Fan">
              {yangiNom?.tur === 'fan' ? (
                <YangiNom qiymat={yangiNom.nom} joy="Yangi fan nomi" onChange={nom => setYangiNom({ tur: 'fan', nom })} onSaqla={yangiQosh} onBekor={() => setYangiNom(null)} />
              ) : (
                <select className={SELECT} value={fan?.id ?? ''} aria-label="Fan"
                  onChange={e => (e.target.value === 'yangi' ? setYangiNom({ tur: 'fan', nom: '' }) : setUmumiy({ ...umumiy, fanId: Number(e.target.value) || null, mavzuId: null }))}>
                  <option value="">{daraxt ? 'Fanni tanlang' : 'Yuklanmoqda…'}</option>
                  {(daraxt?.fanlar || []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  <option value="yangi">+ Yangi fan…</option>
                </select>
              )}
            </Maydon>
            <Maydon nom="Mavzu">
              {yangiNom?.tur === 'mavzu' ? (
                <YangiNom qiymat={yangiNom.nom} joy="Yangi mavzu nomi" onChange={nom => setYangiNom({ tur: 'mavzu', nom })} onSaqla={yangiQosh} onBekor={() => setYangiNom(null)} />
              ) : (
                <select className={SELECT} value={mavzu?.id ?? ''} disabled={!fan} aria-label="Mavzu"
                  onChange={e => (e.target.value === 'yangi' ? setYangiNom({ tur: 'mavzu', nom: '' }) : setUmumiy({ ...umumiy, mavzuId: Number(e.target.value) || null }))}>
                  <option value="">{fan ? 'Mavzuni tanlang' : 'Avval fanni tanlang'}</option>
                  {fan && bolimlarga(fan.mavzular).map(g => (g.bolim
                    ? <optgroup key={g.bolim + g.mavzular[0].id} label={g.bolim}>{g.mavzular.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
                    : g.mavzular.map(m => <option key={m.id} value={m.id}>{m.name}</option>)))}
                  {fan && <option value="yangi">+ Yangi mavzu…</option>}
                </select>
              )}
            </Maydon>
            {/* label emas: ichidagi tugmalar nomini buzmasin. */}
            <div>
              <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Qiyinlik</span>
              <QiyinlikTanlov qiymat={umumiy.difficulty} onChange={d => setUmumiy({ ...umumiy, difficulty: d })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Maydon nom="Sinf"><input className={INPUT} value={umumiy.grade} onChange={e => setUmumiy({ ...umumiy, grade: e.target.value })} placeholder="11-sinf" /></Maydon>
              <Maydon nom="Manba">
                <input className={INPUT} list="manbalar-royxati" value={umumiy.source} onChange={e => setUmumiy({ ...umumiy, source: e.target.value })} placeholder="DTM 2025…" />
                <datalist id="manbalar-royxati">{(meta?.manbalar || []).map(m => <option key={m} value={m} />)}</datalist>
              </Maydon>
            </div>
            <Maydon nom="Izoh" izoh="Masalan: «2023 DTM, 1-variant» — bankda filtr, kitobchada (yoqilsa) savol ostida">
              <input className={INPUT} value={umumiy.remark} maxLength={300} onChange={e => setUmumiy({ ...umumiy, remark: e.target.value })} placeholder="ixtiyoriy" />
            </Maydon>
            <div className="grid grid-cols-1 gap-3">
              <Maydon nom="Til">
                <select className={SELECT} value={umumiy.language} onChange={e => setUmumiy({ ...umumiy, language: e.target.value as any })}>
                  <option value="uz">O'zbekcha</option><option value="ru">Ruscha</option><option value="en">Inglizcha</option>
                </select>
              </Maydon>
            </div>
            {/* label emas (Maydon label): bosilganda ichidagi birinchi tugma ishlab ketmasin. */}
            <div>
              <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Holati</span>
              <Tanlov qiymat={umumiy.status} onChange={v => setUmumiy({ ...umumiy, status: v })} variantlar={[{ v: 'faol', nom: 'Faol' }, { v: 'qoralama', nom: 'Qoralama' }, { v: 'arxiv', nom: 'Arxiv' }]} />
              <span className="block text-[11px] text-matn-xira mt-1">Imtihonga faqat faol savollar tushadi</span>
            </div>
            <div>
              <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Umumiy matn (ixtiyoriy)</span>
              {q.passage ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-chiziq bg-ichki px-3 py-2">
                  <span className="text-[13px] text-matn truncate"><FileText size={13} className="inline mr-1" />{q.passage.title || `Matn #${q.passage.id}`}</span>
                  <button aria-label="Matnni olib tashlash" onClick={() => setQ({ ...q, passage: null })} className="p-1 rounded hover:bg-sirt cursor-pointer"><X size={14} /></button>
                </div>
              ) : <Tugma kichik onClick={() => setMatnTanlash(true)}>Matn tanlash</Tugma>}
              <span className="block text-[11px] text-matn-xira mt-1">Masalan o'qish matni va unga bir nechta savol: variantda ular birga turadi, matn bir marta chiqadi</span>
            </div>
          </div>
        </Karta>

        {/* O'rta: savol */}
        <div className="xl:col-span-2 space-y-4">
          <Karta sarlavha="Savol" izoh="Formula: $x^2+1$, kasr: $\frac{1}{2}$, ildiz: $\sqrt{x}$">
            <div className="space-y-4">
              <Tanlov qiymat={q.type} onChange={v => setQ({
                ...q, type: v, correctAnswer: v === 'yopiq' ? 'A' : '',
                options: v === 'moslash' ? q.options.slice(0, MOSLASH_QATOR.length).concat(['', '']).slice(0, Math.max(2, Math.min(q.options.length, MOSLASH_QATOR.length))) : q.options,
              })} variantlar={[
                { v: 'yopiq', nom: 'Yopiq (variantli)' }, { v: 'raqamli', nom: 'Raqamli javob' }, { v: 'moslash', nom: 'Moslashtirish' }, { v: 'yozma', nom: 'Yozma (ustoz baholaydi)' },
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
                  <div>
                    <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Kitobchada variantlar</span>
                    <Tanlov kichik qiymat={q.joylashuv} onChange={v => setQ({ ...q, joylashuv: v })} variantlar={[{ v: 0, nom: 'Avtomatik' }, { v: 1, nom: '1 ustun' }, { v: 2, nom: '2 ustun' }, { v: 4, nom: '4 ustun' }]} />
                    <span className="block text-[11px] text-matn-xira mt-1">Uzun yoki rasmli variantlar uchun — 1 ustun</span>
                  </div>
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
              {q.type === 'moslash' && (
                <div className="space-y-3">
                  <p className="text-[12px] text-matn-sokin">Chap ustundagi har bandga o'ng ustundan mos keladiganlarini belgilang (bir nechta bo'lishi mumkin). Varaqda o'quvchi har qatorda doirachalarni bo'yaydi; qisman to'g'ri — qatorlar ulushida ball.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[12px] font-semibold text-matn-sokin">Chap ustun ({MOSLASH_QATOR.slice(0, q.options.length).split('').join(', ')})</p>
                      {q.options.map((o, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-7 shrink-0 text-center text-[13px] font-bold text-matn-sokin">{MOSLASH_QATOR[i]}</span>
                          <input className={INPUT} value={o} onChange={e => variantQoy(i, e.target.value)} placeholder={`${MOSLASH_QATOR[i]} band`} aria-label={`Chap ${MOSLASH_QATOR[i]}`} />
                          {q.options.length > 2 && <button aria-label={`${MOSLASH_QATOR[i]} qatorini o'chirish`} onClick={() => qatorOchir(i)} className="p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><X size={15} /></button>}
                        </div>
                      ))}
                      {q.options.length < MOSLASH_QATOR.length && <Tugma kichik turi="oddiy" ikonka={<Plus size={13} />} onClick={() => setQ(s => ({ ...s, options: [...s.options, ''] }))}>Qator qo'shish ({q.options.length}/{MOSLASH_QATOR.length})</Tugma>}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[12px] font-semibold text-matn-sokin">O'ng ustun ({MOSLASH_USTUN.slice(0, q.ong.length).split('').join(', ')})</p>
                      {q.ong.map((o, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-7 shrink-0 text-center text-[13px] font-bold text-matn-sokin">{MOSLASH_USTUN[i]}</span>
                          <input className={INPUT} value={o} onChange={e => setQ(s => ({ ...s, ong: s.ong.map((x, j) => (j === i ? e.target.value : x)) }))} placeholder={`${MOSLASH_USTUN[i]} band`} aria-label={`O'ng ${MOSLASH_USTUN[i]}`} />
                          {q.ong.length > 2 && <button aria-label={`${MOSLASH_USTUN[i]} ustunini o'chirish`} onClick={() => ongOchir(i)} className="p-2 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><X size={15} /></button>}
                        </div>
                      ))}
                      {q.ong.length < MOSLASH_USTUN.length && <Tugma kichik turi="oddiy" ikonka={<Plus size={13} />} onClick={() => setQ(s => ({ ...s, ong: [...s.ong, ''] }))}>Ustun qo'shish ({q.ong.length}/{MOSLASH_USTUN.length})</Tugma>}
                    </div>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-matn-sokin mb-1.5">To'g'ri javob</p>
                    <table className="border-collapse">
                      <thead><tr><th className="w-8" />{q.ong.map((_, c) => <th key={c} className="w-9 text-center text-[12px] font-bold text-matn-sokin">{MOSLASH_USTUN[c]}</th>)}</tr></thead>
                      <tbody>
                        {q.options.map((_, r) => {
                          const k = moslashKaliti(q)[r];
                          return (
                            <tr key={r}>
                              <th className="text-center text-[12px] font-bold text-matn-sokin">{MOSLASH_QATOR[r]}</th>
                              {q.ong.map((_, c) => {
                                const on = k.includes(MOSLASH_USTUN[c]);
                                return (
                                  <td key={c} className="p-0.5 text-center">
                                    <button type="button" onClick={() => katakBelgila(r, c)} aria-pressed={on} aria-label={`${MOSLASH_QATOR[r]}–${MOSLASH_USTUN[c]}`}
                                      className={`w-8 h-8 rounded-full border-2 text-[11px] font-bold cursor-pointer ${on ? 'bg-yaxshi border-yaxshi text-white' : 'border-chiziq-kuchli text-matn-xira hover:border-yaxshi'}`}>{MOSLASH_USTUN[c]}</button>
                                  </td>
                                );
                              })}
                              <td className="pl-2 text-[12px] text-matn-sokin raqam">{k || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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

          <Karta sarlavha="Ikkinchi til" izoh="Ikki tilli kitobcha uchun (Chop etish → Kitobchalar → «Ikki tilli»): savol va variantlar tarjimasi"
            amallar={savolTahrir && ai && q.tarjima && (
              <Tugma kichik ikonka={<Sparkles size={13} />} disabled={!ai.yoqilgan || !tahrirRejimi}
                title={!ai.yoqilgan ? AI_SOZLANMAGAN : !tahrirRejimi ? 'Avval savolni saqlang' : 'AI tarjima qiladi — tekshirib, saqlaysiz'}
                yuklanmoqda={aiBand === 'ikkinchi'} onClick={aiIkkinchiTil}>AI bilan to'ldirish</Tugma>
            )}>
            <div className="space-y-3">
              <Almashtirgich yoqilgan={!!q.tarjima} onChange={v => setQ(x => ({ ...x, tarjima: v ? (x.tarjima || { til: umumiy.language === 'ru' ? 'uz' : 'ru', text: '', options: [] }) : null }))}
                nom="Tarjima bor" izoh={q.tarjima ? undefined : "O'chiq — kitobchada faqat asl matn"} />
              {q.tarjima && (
                <>
                  <Maydon nom="Tarjima tili" className="max-w-48">
                    <select className={SELECT} value={q.tarjima.til} onChange={e => setQ(x => ({ ...x, tarjima: { ...x.tarjima!, til: e.target.value as Tarjima['til'] } }))}>
                      <option value="ru">Ruscha</option><option value="uz">O'zbekcha</option><option value="en">Inglizcha</option>
                    </select>
                  </Maydon>
                  <RichTextEditor key={`tarjima-${muharrirKaliti}`} content={q.tarjima.text} onChange={text => setQ(x => ({ ...x, tarjima: { ...(x.tarjima || { til: 'ru', options: [] }), text } as Tarjima }))} />
                  {q.type === 'yopiq' && (
                    <div className="space-y-2">
                      {q.options.map((o, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-9 shrink-0 text-center text-[13px] font-bold text-matn-sokin">{HARFLAR[i]}</span>
                          <input className={INPUT} value={q.tarjima!.options[i] || ''} placeholder={o ? `${HARFLAR[i]}: ${o.replace(/<[^>]+>/g, '').slice(0, 40)}` : `${HARFLAR[i]} tarjimasi`}
                            onChange={e => setQ(x => { const opts = [...(x.tarjima?.options || [])]; opts[i] = e.target.value; return { ...x, tarjima: { ...x.tarjima!, options: opts } }; })} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
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
      {oxshash && daraxt && tahrirRejimi && (
        <OxshashSavollar daraxt={daraxt} asl={{ ...(oldindanKorish as Question), id: Number(id) }} onYop={() => setOxshash(false)} onSaqlandi={() => daraxtniYangila()} />
      )}
      {matnTanlash && <MatnlarOynasi onYop={() => setMatnTanlash(false)} tanlash={(p: Passage) => setQ(s => ({ ...s, passage: { id: p.id, title: p.title } }))} />}
    </div>
  );
}

/** Tanlov o'rniga — yangi fan yoki mavzu nomi (Enter — qo'shish, Esc — bekor). */
function YangiNom({ qiymat, joy, onChange, onSaqla, onBekor }: { qiymat: string; joy: string; onChange: (v: string) => void; onSaqla: () => void; onBekor: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input autoFocus className={INPUT} value={qiymat} placeholder={joy} aria-label={joy} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSaqla(); } if (e.key === 'Escape') onBekor(); }} />
      <Tugma kichik turi="asosiy" ikonka={<Check size={13} />} disabled={!qiymat.trim()} onClick={onSaqla} aria-label="Qo'shish" />
      <Tugma kichik turi="oddiy" ikonka={<X size={13} />} onClick={onBekor} aria-label="Bekor" />
    </div>
  );
}
