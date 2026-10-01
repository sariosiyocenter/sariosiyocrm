import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown, MessageSquareText, Lock } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Karta, Tugma, Maydon, INPUT, SELECT, Almashtirgich, Yorliq, Yuklanmoqda } from './ui';
import { SOROVNOMA_SHKALALARI } from '../../../lib/imtihon.js';
import { toDateStr } from '../../../lib/lessons.js';
import type { Exam } from '../../types';

// So'rovnoma (Addmen "Survey / Feedback"): savollar va shkala. Varaqda har
// savol qatori — matni va shkala doirachalari; skanerlangach javoblar
// taqsimoti hisobot bo'ladi. Imtihon infratuzilmasi (chop etish, skaner) shu.

type Preset = keyof typeof SOROVNOMA_SHKALALARI | 'maxsus';
const PRESET_NOMI: Record<Preset, string> = {
  likert: "Qo'shilaman — qo'shilmayman (5)", sifat: "A'lo — juda yomon (5)", baho: 'Baho 1–5', haYoq: "Ha / Yo'q", haQismanYoq: "Ha / Qisman / Yo'q", maxsus: 'Maxsus',
};
interface Savol { matn: string; variantlar?: string[] }

const presetTop = (shkala: string[]): Preset =>
  ((Object.keys(SOROVNOMA_SHKALALARI) as (keyof typeof SOROVNOMA_SHKALALARI)[]).find(k => SOROVNOMA_SHKALALARI[k].join('|') === shkala.join('|')) || 'maxsus');

export default function SorovnomaMuharriri({ id }: { id?: string }) {
  const navigate = useNavigate();
  const { showNotification, schools } = useCRM();
  const { soro, filial } = useImtihonApi();
  const [yuklanmoqda, setYuklanmoqda] = useState(!!id);
  const [qulf, setQulf] = useState(false);
  const [band, setBand] = useState(false);
  const [nom, setNom] = useState('');
  const [sana, setSana] = useState(() => toDateStr());
  const [davom, setDavom] = useState(20);
  const [anonim, setAnonim] = useState(true);
  const [shkala, setShkala] = useState<string[]>([...SOROVNOMA_SHKALALARI.likert]);
  const [savollar, setSavollar] = useState<Savol[]>([{ matn: '' }]);
  const [filiallar, setFiliallar] = useState<number[]>(filial ? [filial] : []);
  const [egaFilial, setEgaFilial] = useState(filial);
  // Ko'p savolni bir yo'la joylash (har qatorda bittadan).
  const [joylash, setJoylash] = useState<string | null>(null);
  const preset = presetTop(shkala);

  useEffect(() => {
    if (!id) return;
    soro<Exam>('GET', `exams/${id}`).then(e => {
      setNom(e.name); setSana(e.date); setDavom(e.duration); setQulf(!!e.lockedAt);
      const sv = e.settings.sorovnoma;
      setAnonim(sv.anonim); setShkala(sv.shkala); setSavollar(sv.savollar.length ? sv.savollar : [{ matn: '' }]);
      setEgaFilial(e.schoolId); setFiliallar([e.schoolId, ...(e.branchIds || [])].filter((x, i, l) => l.indexOf(x) === i));
    }).catch(err => showNotification(err.message, 'error')).finally(() => setYuklanmoqda(false));
  }, [id, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  const saqla = async () => {
    const toza = savollar.map(q => ({ ...q, matn: q.matn.trim() })).filter(q => q.matn);
    if (!nom.trim()) return showNotification("So'rovnoma nomini kiriting", 'error');
    if (!toza.length) return showNotification('Kamida bitta savol yozing', 'error');
    if (shkala.filter(x => x.trim()).length < 2) return showNotification("Shkalada kamida 2 ta javob bo'lsin", 'error');
    setBand(true);
    try {
      const body = {
        name: nom.trim(), date: sana, duration: davom, branchIds: filiallar.filter(x => x !== egaFilial),
        settings: {
          source: 'sorovnoma', sorovnoma: { anonim, shkala: shkala.map(x => x.trim()).filter(Boolean), savollar: toza },
          notify: { channel: 'NONE', to: 'PARENT', template: '' }, ranking: 'yoq', shuffleQuestions: false, shuffleOptions: false,
        },
      };
      const e = id ? await soro<Exam>('PUT', `exams/${id}`, body) : await soro<Exam>('POST', 'exams', { ...body, schoolId: egaFilial });
      showNotification("So'rovnoma saqlandi", 'success');
      navigate(`/exams?imtihon=${e.id}`);
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setBand(false);
    }
  };

  if (yuklanmoqda) return <Yuklanmoqda />;
  const savolOzgar = (i: number, p: Partial<Savol>) => setSavollar(l => l.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const surish = (i: number, d: number) => setSavollar(l => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });

  return (
    <div className="max-w-5xl mx-auto pb-24 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button aria-label="Orqaga" onClick={() => navigate(id ? `/exams?imtihon=${id}` : '/exams')} className="w-10 h-10 bg-sirt border border-chiziq rounded-xl flex items-center justify-center text-matn-sokin hover:text-brand cursor-pointer"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-[15px] font-bold text-matn flex items-center gap-2"><MessageSquareText size={17} className="text-brand" />{id ? "So'rovnoma" : "Yangi so'rovnoma"}</h1>
            <p className="text-[12px] text-matn-xira">{savollar.filter(q => q.matn.trim()).length} ta savol · O'quvchi yoki ota-ona fikri (o'qituvchi, dars, xizmat sifati)</p>
          </div>
          {qulf && <Yorliq rang="brand"><Lock size={11} /> Varaqlar chiqarilgan — faqat matnlar o'zgaradi</Yorliq>}
        </div>
        <Tugma turi="asosiy" ikonka={<Save size={14} />} yuklanmoqda={band} onClick={saqla}>Saqlash</Tugma>
      </div>

      <Karta sarlavha="Asosiy">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Maydon nom="Nomi" className="lg:col-span-2"><input className={INPUT} value={nom} onChange={e => setNom(e.target.value)} placeholder="O'qituvchilar haqida fikr — oktabr" /></Maydon>
          <Maydon nom="Sana"><input type="date" className={INPUT} value={sana} onChange={e => setSana(e.target.value)} /></Maydon>
          <Maydon nom="Vaqt (daqiqa)"><input type="number" min={5} max={180} className={INPUT} value={davom} onChange={e => setDavom(Number(e.target.value) || 20)} /></Maydon>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <Almashtirgich yoqilgan={anonim} onChange={v => !qulf && setAnonim(v)} nom="Anonim"
              izoh={anonim ? "Ism va ID so'ralmaydi — universal varaqlar, har skanerlangan varaq alohida javob" : "Har qatnashchiga shaxsiy varaq (O'rinlashtirishda kurslarni biriktiring) — natijani kurs bo'yicha ko'rasiz"} />
          </div>
          {schools.length > 1 && (
            <Maydon div nom="Filiallar" izoh="So'rovnoma qaysi filiallarda o'tadi">
              <div className="flex flex-wrap gap-1.5">
                {schools.map(sc => {
                  const bel = filiallar.includes(sc.id);
                  return (
                    <button key={sc.id} type="button" disabled={qulf || sc.id === egaFilial} onClick={() => setFiliallar(f => (bel ? f.filter(x => x !== sc.id) : [...f, sc.id]))}
                      className={`px-3 py-1.5 rounded-xl border text-[12.5px] font-semibold cursor-pointer disabled:cursor-default ${bel ? 'bg-brand text-brand-ust border-brand' : 'bg-ichki border-chiziq text-matn-sokin'}`}>{sc.name}</button>
                  );
                })}
              </div>
            </Maydon>
          )}
        </div>
      </Karta>

      <Karta sarlavha="Javob shkalasi" izoh="Har savolga shu javoblar (varaqda 1, 2, 3… doirachalar va tepada izohi). Savolning o'zi boshqa javob olishi ham mumkin.">
        <div className="space-y-3">
          <Maydon nom="Tayyor shkala" className="max-w-sm">
            <select className={SELECT} value={preset} disabled={qulf} onChange={e => { const v = e.target.value as Preset; if (v !== 'maxsus') setShkala([...SOROVNOMA_SHKALALARI[v]]); }}>
              {(Object.keys(PRESET_NOMI) as Preset[]).map(k => <option key={k} value={k} disabled={k === 'maxsus' && preset !== 'maxsus'}>{PRESET_NOMI[k]}</option>)}
            </select>
          </Maydon>
          <div className="flex flex-wrap items-center gap-2">
            {shkala.map((x, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full border border-chiziq-kuchli text-[11.5px] font-bold text-matn-sokin flex items-center justify-center">{i + 1}</span>
                <input className={`${INPUT} py-1.5 w-40`} value={x} aria-label={`${i + 1}-javob`} onChange={e => setShkala(l => l.map((y, j) => (j === i ? e.target.value : y)))} />
                {!qulf && shkala.length > 2 && <button type="button" aria-label="Olib tashlash" onClick={() => setShkala(l => l.filter((_, j) => j !== i))} className="p-1 rounded text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={13} /></button>}
              </span>
            ))}
            {!qulf && shkala.length < 6 && <Tugma kichik turi="oddiy" ikonka={<Plus size={13} />} onClick={() => setShkala(l => [...l, ''])}>Javob</Tugma>}
          </div>
        </div>
      </Karta>

      <Karta sarlavha="Savollar" izoh="Qisqa va aniq yozing — varaqda ikki qatorgacha sig'adi">
        <ol className="space-y-2">
          {savollar.map((q, i) => (
            <li key={i} className="rounded-xl border border-chiziq p-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-2.5 w-7 shrink-0 text-right text-[13px] font-bold text-matn-sokin raqam">{i + 1}.</span>
                <textarea rows={2} className={`${INPUT} resize-y min-h-[44px]`} value={q.matn} maxLength={300} placeholder="O'qituvchi mavzuni tushunarli tushuntiradi"
                  aria-label={`${i + 1}-savol`} onChange={e => savolOzgar(i, { matn: e.target.value })} />
                {!qulf && (
                  <span className="flex flex-col shrink-0">
                    <button type="button" aria-label="Yuqoriga" onClick={() => surish(i, -1)} className="p-1 rounded text-matn-xira hover:text-matn cursor-pointer"><ArrowUp size={14} /></button>
                    <button type="button" aria-label="Pastga" onClick={() => surish(i, 1)} className="p-1 rounded text-matn-xira hover:text-matn cursor-pointer"><ArrowDown size={14} /></button>
                    <button type="button" aria-label="O'chirish" onClick={() => setSavollar(l => (l.length > 1 ? l.filter((_, j) => j !== i) : [{ matn: '' }]))} className="p-1 rounded text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={14} /></button>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2 pl-9 text-[12px] text-matn-sokin">
                Javoblar:
                <select className="px-2 py-1 bg-ichki border border-chiziq rounded-lg text-[12px] text-matn outline-none focus:border-brand cursor-pointer" disabled={qulf} value={q.variantlar ? presetTop(q.variantlar) : 'umumiy'} aria-label={`${i + 1}-savol javoblari`}
                  onChange={e => { const v = e.target.value; savolOzgar(i, { variantlar: v === 'umumiy' ? undefined : v === 'maxsus' ? (q.variantlar || ['', '']) : [...SOROVNOMA_SHKALALARI[v as keyof typeof SOROVNOMA_SHKALALARI]] }); }}>
                  <option value="umumiy">Umumiy shkala</option>
                  {(Object.keys(SOROVNOMA_SHKALALARI) as (keyof typeof SOROVNOMA_SHKALALARI)[]).map(k => <option key={k} value={k}>{PRESET_NOMI[k]}</option>)}
                  <option value="maxsus">Maxsus</option>
                </select>
                {q.variantlar && presetTop(q.variantlar) === 'maxsus' && q.variantlar.map((x, j) => (
                  <input key={j} className="w-28 px-2 py-1 bg-ichki border border-chiziq rounded-lg text-[12px] text-matn outline-none focus:border-brand" value={x} placeholder={`${j + 1}-javob`} aria-label={`${i + 1}-savol ${j + 1}-javob`}
                    onChange={e => savolOzgar(i, { variantlar: q.variantlar!.map((y, k) => (k === j ? e.target.value : y)) })} />
                ))}
                {q.variantlar && presetTop(q.variantlar) === 'maxsus' && !qulf && q.variantlar.length < 6 && (
                  <button type="button" className="text-brand hover:underline cursor-pointer" onClick={() => savolOzgar(i, { variantlar: [...q.variantlar!, ''] })}>+ javob</button>
                )}
              </div>
            </li>
          ))}
        </ol>
        {!qulf && (
          <div className="flex flex-wrap gap-2 mt-3">
            <Tugma kichik ikonka={<Plus size={13} />} onClick={() => setSavollar(l => [...l, { matn: '' }])}>Savol qo'shish</Tugma>
            <Tugma kichik turi="oddiy" onClick={() => setJoylash(j => (j === null ? '' : null))}>Ro'yxatdan joylash</Tugma>
          </div>
        )}
        {joylash !== null && (
          <div className="mt-3 space-y-2">
            <textarea rows={6} className={`${INPUT} resize-y`} value={joylash} onChange={e => setJoylash(e.target.value)} aria-label="Savollar ro'yxati"
              placeholder={"O'qituvchi mavzuni tushunarli tushuntiradi\nDars vaqtida savol berishga imkon bor\nUy vazifasi miqdori me'yorida"} />
            <Tugma kichik turi="asosiy" onClick={() => {
              const yangi = joylash.split(/\r?\n/).map(x => x.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).map(x => ({ matn: x.slice(0, 300) }));
              setSavollar(l => [...l.filter(q => q.matn.trim()), ...yangi]);
              setJoylash(null);
            }}>Qo'shish</Tugma>
          </div>
        )}
      </Karta>
    </div>
  );
}
