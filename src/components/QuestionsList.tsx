import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, FileUp, FileDown, Trash2, ChevronLeft, ChevronRight, AlertTriangle, BookOpen, Pencil, X, FileText, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { useConfirm } from './ConfirmDialog';
import { useImtihonApi } from './imtihon/useImtihonApi';
import { Karta, Tugma, Yorliq, BoshHolat, INPUT, SELECT, Yuklanmoqda } from './imtihon/ui';
import MatnlarOynasi from './imtihon/MatnlarOynasi';
import AiImportOynasi from './imtihon/AiImportOynasi';
import { useAiHolat, AI_SOZLANMAGAN } from './imtihon/useAiHolat';
import { formulaliHtml, oddiyMatn, SAVOL_MATNI } from '../lib/matn';
import { HARFLAR, SAVOL_TURI_NOMI, savolXatosi } from '../../lib/imtihon.js';
import type { Question } from '../types';

// Savollar banki — butun o'quv markaziga umumiy (ikkala filial bitta bankdan
// oladi). Ro'yxat serverdan sahifalab keladi: bank minglab savolga o'sadi,
// uni har sahifa ochilganda to'liq yuklab bo'lmaydi.

interface Meta {
  jami: number;
  fanlar: { nomi: string; soni: number; faol: number }[];
  mavzular: { fan: string; mavzu: string; soni: number; faol: Record<string, number> }[];
  manbalar: string[];
}

const HOLAT_NOMI: Record<string, string> = { faol: 'Faol', qoralama: 'Qoralama', arxiv: 'Arxiv' };
const TUR_QISQA: Record<string, string> = { yopiq: 'Yopiq', raqamli: 'Raqamli', yozma: 'Yozma' };

// Excel ustunlari (shablon ham shu tartibda).
const USTUNLAR = ['Fan', 'Mavzu', "Bo'lim", 'Tur', 'Savol', 'A', 'B', 'C', 'D', 'E', 'F', 'Javob', "Qo'shimcha javoblar", 'Ball', 'Qiyinlik', 'Manba', 'Sinf', 'Til', 'Yechim', 'Holat'];

function qatordanSavol(r: Record<string, any>, qator: number) {
  const s = (k: string) => String(r[k] ?? '').trim();
  const turMatni = s('Tur').toLowerCase();
  const type = turMatni.startsWith('raq') ? 'raqamli' : turMatni.startsWith('yoz') ? 'yozma' : 'yopiq';
  const options = HARFLAR.map(h => s(h)).filter(Boolean);
  return {
    qator,
    subject: s('Fan'), topic: s('Mavzu'), section: s("Bo'lim") || null, type,
    text: s('Savol'),
    options: type === 'yopiq' ? options : null,
    correctAnswer: type === 'yopiq' ? s('Javob').toUpperCase() : s('Javob'),
    answers: s("Qo'shimcha javoblar") ? s("Qo'shimcha javoblar").split(/[;|]/).map(x => x.trim()).filter(Boolean) : null,
    points: s('Ball') ? Number(s('Ball').replace(',', '.')) : null,
    difficulty: parseInt(s('Qiyinlik')) || 1,
    source: s('Manba') || null, grade: s('Sinf') || null,
    language: (['uz', 'ru', 'en'].includes(s('Til').toLowerCase()) ? s('Til').toLowerCase() : 'uz'),
    solution: s('Yechim') || null,
    solutionStatus: s('Yechim') ? 'tasdiqlangan' : 'yoq',
    status: s('Holat').toLowerCase().startsWith('qor') ? 'qoralama' : s('Holat').toLowerCase().startsWith('arx') ? 'arxiv' : 'faol',
  };
}

function shablonniYukla() {
  const namuna = [
    { Fan: 'Matematika', Mavzu: 'Kvadrat tenglama', "Bo'lim": 'Algebra', Tur: 'yopiq', Savol: '$x^2-5x+6=0$ tenglamaning ildizlari yig\'indisini toping', A: '5', B: '6', C: '-5', D: '1', Javob: 'A', Qiyinlik: 2, Manba: 'DTM 2025', Til: 'uz', Yechim: "Viyet teoremasi: $x_1+x_2=5$" },
    { Fan: 'Matematika', Mavzu: 'Kasrlar', Tur: 'raqamli', Savol: '$\\frac{3}{4}-\\frac{1}{4}$ ni hisoblang', Javob: '1/2', "Qo'shimcha javoblar": '0,5', Qiyinlik: 1, Til: 'uz' },
    { Fan: 'Matematika', Mavzu: 'Masala', Tur: 'yozma', Savol: 'Masalani yeching va yechimini yozing: ...', Ball: 5, Til: 'uz' },
  ];
  const ws = XLSX.utils.json_to_sheet(namuna, { header: USTUNLAR });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Savollar');
  XLSX.writeFile(wb, 'savollar-shablon.xlsx');
}

export default function QuestionsList() {
  const { showNotification, ozgartira, selectedSchoolId, user } = useCRM();
  const savolTahrir = ozgartira('imtihonlar.savollar');
  const savolOchirish = ozgartira('imtihonlar.ochirish');
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [meta, setMeta] = useState<Meta | null>(null);
  const [filtr, setFiltr] = useState({ fan: '', mavzu: '', tur: '', holat: '', manba: '', qidiruv: '' });
  const [qidiruvMatni, setQidiruvMatni] = useState('');
  const [sahifa, setSahifa] = useState(1);
  const [royxat, setRoyxat] = useState<{ items: Question[]; total: number } | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [ochiq, setOchiq] = useState<number | null>(null);
  const [import_, setImport] = useState<{ yaroqli: any[]; xatolar: { qator: number; xato: string }[]; jami: number } | null>(null);
  const [importMoqda, setImportMoqda] = useState(false);
  const [matnlarOchiq, setMatnlarOchiq] = useState(false);
  const [aiImport, setAiImport] = useState(false);
  const ai = useAiHolat();
  const SONI = 30;

  const metaniYukla = useCallback(() => soro<Meta>('GET', 'questions/meta').then(setMeta).catch(() => setMeta(null)), [soro]);
  useEffect(() => { metaniYukla(); }, [metaniYukla]);

  // Qidiruv matni yozilayotganda har harfga so'rov ketmasin.
  useEffect(() => {
    const t = setTimeout(() => { setFiltr(f => ({ ...f, qidiruv: qidiruvMatni })); setSahifa(1); }, 350);
    return () => clearTimeout(t);
  }, [qidiruvMatni]);

  const yukla = useCallback(async () => {
    setYuklanmoqda(true);
    try {
      const p = new URLSearchParams({ sahifa: String(sahifa), soni: String(SONI) });
      for (const [k, v] of Object.entries(filtr)) if (v) p.set(k, v);
      setRoyxat(await soro('GET', `questions?${p}`));
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setYuklanmoqda(false);
    }
  }, [soro, sahifa, filtr, showNotification]);
  useEffect(() => { yukla(); }, [yukla]);

  const mavzular = useMemo(() => (meta?.mavzular || []).filter(m => !filtr.fan || m.fan.toLowerCase() === filtr.fan.toLowerCase()), [meta, filtr.fan]);
  const sahifalar = royxat ? Math.max(1, Math.ceil(royxat.total / SONI)) : 1;
  const filtrQoy = (k: keyof typeof filtr, v: string) => { setFiltr(f => ({ ...f, [k]: v, ...(k === 'fan' ? { mavzu: '' } : {}) })); setSahifa(1); };

  const ochir = async (q: Question) => {
    if (!(await confirm("Savol o'chirilsinmi?"))) return;
    try {
      await soro('DELETE', `questions/${q.id}`);
      showNotification("Savol o'chirildi", 'info');
      yukla();
      metaniYukla();
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  const excelniOqi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        const yaroqli: any[] = [];
        const xatolar: { qator: number; xato: string }[] = [];
        rows.forEach((r, i) => {
          const q = qatordanSavol(r, i + 2);
          const xato = !q.subject ? 'Fan yo\'q' : !q.topic ? "Mavzu yo'q" : q.status === 'faol' ? savolXatosi(q) : null;
          if (xato) xatolar.push({ qator: i + 2, xato }); else yaroqli.push(q);
        });
        setImport({ yaroqli, xatolar, jami: rows.length });
      } catch {
        showNotification("Faylni o'qib bo'lmadi. Shablondan foydalaning.", 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const importQil = async () => {
    if (!import_?.yaroqli.length) return;
    setImportMoqda(true);
    try {
      const schoolId = selectedSchoolId && selectedSchoolId > 0 ? selectedSchoolId : user?.schoolId;
      const r = await soro<{ count: number; xatolar: { qator: number; xato: string }[] }>('POST', 'questions/bulk', { questions: import_.yaroqli, schoolId });
      if (r.xatolar.length) setImport({ yaroqli: [], xatolar: r.xatolar, jami: import_.jami });
      else setImport(null);
      showNotification(`${r.count} ta savol qo'shildi`, 'success');
      yukla();
      metaniYukla();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setImportMoqda(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Yuqori qator: statistika va amallar */}
      <Karta
        sarlavha="Savollar banki"
        izoh={meta ? `Jami ${meta.jami} ta savol · ${meta.fanlar.length} ta fan · butun markazga umumiy` : 'Butun markazga umumiy'}
        amallar={savolTahrir && (
          <>
            <Tugma kichik ikonka={<FileText size={14} />} onClick={() => setMatnlarOchiq(true)}>Matnlar</Tugma>
            {ai && (
              <Tugma kichik ikonka={<Sparkles size={14} />} disabled={!ai.yoqilgan} title={ai.yoqilgan ? 'PDF, rasm yoki matndan savollar' : AI_SOZLANMAGAN} onClick={() => setAiImport(true)}>AI import</Tugma>
            )}
            <Tugma kichik ikonka={<FileDown size={14} />} onClick={shablonniYukla}>Excel shablon</Tugma>
            <label className="inline-flex items-center gap-1.5 rounded-xl border border-chiziq bg-sirt hover:bg-ichki px-2.5 py-1.5 text-[12px] font-semibold text-matn cursor-pointer">
              <FileUp size={14} /> Excel import
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={excelniOqi} />
            </label>
            <Tugma kichik turi="asosiy" ikonka={<Plus size={14} />} onClick={() => navigate('/questions/new')}>Yangi savol</Tugma>
          </>
        )}
      >
        {meta && meta.fanlar.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {meta.fanlar.map(f => (
              <button key={f.nomi} onClick={() => filtrQoy('fan', filtr.fan === f.nomi ? '' : f.nomi)}
                className={`px-2.5 py-1 rounded-lg border text-[12px] cursor-pointer ${filtr.fan === f.nomi ? 'bg-brand text-brand-ust border-brand' : 'bg-ichki border-chiziq text-matn-sokin hover:text-matn'}`}>
                {f.nomi} <span className="opacity-70">{f.faol}</span>
              </button>
            ))}
          </div>
        )}
      </Karta>

      {/* Filtrlar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="relative col-span-2">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
          <input className={`${INPUT} pl-9`} placeholder="Savol matnidan qidirish" value={qidiruvMatni} onChange={e => setQidiruvMatni(e.target.value)} />
        </div>
        <select className={SELECT} value={filtr.mavzu} onChange={e => filtrQoy('mavzu', e.target.value)}>
          <option value="">Hamma mavzu</option>
          {mavzular.map(m => <option key={`${m.fan}|${m.mavzu}`} value={m.mavzu}>{filtr.fan ? m.mavzu : `${m.fan} · ${m.mavzu}`} ({m.soni})</option>)}
        </select>
        <select className={SELECT} value={filtr.tur} onChange={e => filtrQoy('tur', e.target.value)}>
          <option value="">Hamma tur</option>
          {Object.entries(TUR_QISQA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={SELECT} value={filtr.holat} onChange={e => filtrQoy('holat', e.target.value)}>
          <option value="">Hamma holat</option>
          {Object.entries(HOLAT_NOMI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={SELECT} value={filtr.manba} onChange={e => filtrQoy('manba', e.target.value)}>
          <option value="">Hamma manba</option>
          {(meta?.manbalar || []).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Ro'yxat */}
      <Karta ichki="p-0">
        {yuklanmoqda && !royxat ? <Yuklanmoqda /> : !royxat?.items.length ? (
          <BoshHolat ikonka={<BookOpen size={22} />} sarlavha={meta?.jami ? 'Filtrga mos savol yo\'q' : "Bankda hali savol yo'q"}
            izoh={meta?.jami ? 'Filtrni o\'zgartiring' : "Savolni qo'lda qo'shing yoki Excel shablonini to'ldirib import qiling. Formulalar $...$ ichida LaTeX bilan yoziladi."}>
            {savolTahrir && <Tugma turi="asosiy" ikonka={<Plus size={14} />} onClick={() => navigate('/questions/new')}>Yangi savol</Tugma>}
          </BoshHolat>
        ) : (
          <ul className="divide-y divide-chiziq">
            {royxat.items.map(q => {
              const ochilgan = ochiq === q.id;
              return (
                <li key={q.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <button onClick={() => setOchiq(ochilgan ? null : q.id)} className="flex-1 min-w-0 text-left cursor-pointer">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-[11px] text-matn-xira raqam">#{q.id}</span>
                        <Yorliq>{q.subject}</Yorliq>
                        <Yorliq>{q.topic}</Yorliq>
                        <Yorliq rang={q.type === 'yopiq' ? 'kulrang' : 'brand'}>{TUR_QISQA[q.type] || q.type}</Yorliq>
                        {q.status !== 'faol' && <Yorliq rang="ogoh">{HOLAT_NOMI[q.status || 'faol']}</Yorliq>}
                        {q.xato && <Yorliq rang="xato"><AlertTriangle size={11} /> {q.xato}</Yorliq>}
                        {!!q.usedCount && <Yorliq rang="kulrang">{q.usedCount} marta ishlatilgan</Yorliq>}
                        {q.pCorrect != null && <Yorliq rang={q.pCorrect < 0.3 ? 'xato' : q.pCorrect > 0.8 ? 'yaxshi' : 'kulrang'}>{Math.round(q.pCorrect * 100)}% to'g'ri topgan</Yorliq>}
                        {q.passage && <Yorliq rang="brand">Matn: {q.passage.title || `#${q.passage.id}`}</Yorliq>}
                      </div>
                      {!ochilgan && <p className="text-[13px] text-matn line-clamp-2">{oddiyMatn(q.text) || (q.imageUrl ? '[rasm]' : '—')}</p>}
                    </button>
                    {savolTahrir && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button aria-label="Tahrirlash" onClick={() => navigate(`/questions/${q.id}/edit`)} className="p-2 rounded-lg text-matn-sokin hover:text-brand hover:bg-ichki cursor-pointer"><Pencil size={15} /></button>
                        {savolOchirish && <button aria-label="O'chirish" onClick={() => ochir(q)} className="p-2 rounded-lg text-matn-sokin hover:text-xato hover:bg-xato-fon cursor-pointer"><Trash2 size={15} /></button>}
                      </div>
                    )}
                  </div>
                  {ochilgan && <SavolKorinishi q={q} />}
                </li>
              );
            })}
          </ul>
        )}
        {royxat && royxat.total > SONI && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-chiziq text-[12px] text-matn-sokin">
            <span>{(sahifa - 1) * SONI + 1}–{Math.min(sahifa * SONI, royxat.total)} / {royxat.total}</span>
            <div className="flex items-center gap-1">
              <Tugma kichik turi="oddiy" disabled={sahifa <= 1} onClick={() => setSahifa(s => s - 1)} ikonka={<ChevronLeft size={14} />}>Oldingi</Tugma>
              <span className="px-2">{sahifa} / {sahifalar}</span>
              <Tugma kichik turi="oddiy" disabled={sahifa >= sahifalar} onClick={() => setSahifa(s => s + 1)}>Keyingi <ChevronRight size={14} /></Tugma>
            </div>
          </div>
        )}
      </Karta>

      {/* Import oynasi */}
      {import_ && (
        <div className="fixed inset-0 z-[250] flex items-start sm:items-center justify-center overflow-y-auto p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => !importMoqda && setImport(null)} />
          <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-lg border border-chiziq">
            <div className="flex items-center justify-between px-5 py-4 border-b border-chiziq">
              <div>
                <h3 className="text-[14px] font-bold text-matn">Excel import</h3>
                <p className="text-[12px] text-matn-xira">Jami {import_.jami} ta qator</p>
              </div>
              <button aria-label="Yopish" onClick={() => setImport(null)} className="p-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-yaxshi-fon border border-yaxshi/25 p-3"><p className="text-[11px] text-yaxshi">Yuklanadi</p><p className="text-[22px] font-bold text-yaxshi raqam">{import_.yaroqli.length}</p></div>
                <div className="rounded-xl bg-xato-fon border border-xato-chiziq p-3"><p className="text-[11px] text-xato">Xato qatorlar</p><p className="text-[22px] font-bold text-xato raqam">{import_.xatolar.length}</p></div>
              </div>
              {import_.xatolar.length > 0 && (
                <ul className="max-h-48 overflow-y-auto rounded-xl border border-chiziq divide-y divide-chiziq text-[12px]">
                  {import_.xatolar.map((x, i) => <li key={i} className="px-3 py-2"><b className="raqam">{x.qator}-qator:</b> {x.xato}</li>)}
                </ul>
              )}
              <p className="text-[11.5px] text-matn-xira">Xato qatorlar yuklanmaydi — ularni Excel'da tuzatib, qayta import qiling.</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-chiziq">
              <Tugma onClick={() => setImport(null)}>Bekor qilish</Tugma>
              <Tugma turi="asosiy" yuklanmoqda={importMoqda} disabled={!import_.yaroqli.length} onClick={importQil}>{import_.yaroqli.length} ta savolni yuklash</Tugma>
            </div>
          </div>
        </div>
      )}
      {matnlarOchiq && <MatnlarOynasi onYop={() => { setMatnlarOchiq(false); yukla(); }} />}
      {aiImport && <AiImportOynasi fanlar={(meta?.fanlar || []).map(f => f.nomi)} onYop={() => setAiImport(false)} onSaqlandi={() => { yukla(); metaniYukla(); }} />}
    </div>
  );
}

/** Savolning to'liq ko'rinishi: formulalar, variantlar, to'g'ri javob, yechim. */
export function SavolKorinishi({ q }: { q: Question }) {
  const togri = HARFLAR.indexOf(String(q.correctAnswer || '').toUpperCase());
  return (
    <div className="mt-3 rounded-xl border border-chiziq bg-ichki p-4 space-y-3">
      {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-56 rounded-lg border border-chiziq bg-white" />}
      <div className={`${SAVOL_MATNI} text-[14px] text-matn`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.text) }} />
      {q.type === 'yopiq' && (
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {(q.options || []).map((o, i) => (
            <li key={i} className={`flex gap-2 rounded-lg border px-3 py-2 text-[13px] ${i === togri ? 'border-yaxshi/40 bg-yaxshi-fon text-matn' : 'border-chiziq bg-sirt text-matn'}`}>
              <b>{HARFLAR[i]})</b><span dangerouslySetInnerHTML={{ __html: formulaliHtml(o) }} />
            </li>
          ))}
        </ol>
      )}
      {q.type === 'raqamli' && <p className="text-[13px]"><b>Javob:</b> {[q.correctAnswer, ...(q.answers || [])].filter(Boolean).join(' · ')}</p>}
      {q.type === 'yozma' && <p className="text-[13px] text-matn-sokin">Yozma javob — ustoz baholaydi{q.points ? ` (${q.points} ball)` : ''}.</p>}
      {q.solution && (
        <div className="rounded-lg border border-chiziq bg-sirt p-3">
          <p className="text-[11px] font-semibold text-matn-xira mb-1">Yechim {q.solutionStatus === 'tasdiqlangan' ? '· tasdiqlangan' : '· tasdiqlanmagan'}</p>
          <div className={`${SAVOL_MATNI} text-[13px] text-matn`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.solution) }} />
        </div>
      )}
      <p className="text-[11px] text-matn-xira">{SAVOL_TURI_NOMI[q.type]} · qiyinlik {q.difficulty}{q.source ? ` · ${q.source}` : ''}{q.grade ? ` · ${q.grade}` : ''}{q.language && q.language !== 'uz' ? ` · ${q.language.toUpperCase()}` : ''}</p>
    </div>
  );
}
