import React, { useEffect, useRef, useState } from 'react';
import { Search, Plus, FileUp, FileDown, X, FileText, Sparkles, ChevronRight, ChevronDown, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { useImtihonApi } from './imtihon/useImtihonApi';
import { Tugma, INPUT, Yuklanmoqda, BoshHolat, Karta } from './imtihon/ui';
import MatnlarOynasi from './imtihon/MatnlarOynasi';
import AiImportOynasi from './imtihon/AiImportOynasi';
import { useAiHolat, AI_SOZLANMAGAN } from './imtihon/useAiHolat';
import { useBankDaraxt, fanniTop, mavzuniTop } from './imtihon/bank/useBankDaraxt';
import FanlarKorinishi from './imtihon/bank/FanlarKorinishi';
import FanKorinishi from './imtihon/bank/FanKorinishi';
import MavzuKorinishi from './imtihon/bank/MavzuKorinishi';
import { SavolKartasi, SavolOynasi } from './imtihon/bank/SavolKartasi';
import { HARFLAR, savolXatosi, qiyinlikDarajasi } from '../../lib/imtihon.js';
import type { Question } from '../types';

// Savollar banki — butun o'quv markaziga umumiy. Tuzilma: fan → mavzu →
// qiyinlik (oson / o'rta / qiyin). Qaysi qavat ochiqligi URL da (fan=, mavzu=),
// shuning uchun "orqaga" va havolalar ishlaydi.

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
    difficulty: qiyinlikDarajasi(s('Qiyinlik') || 2),
    source: s('Manba') || null, grade: s('Sinf') || null,
    language: (['uz', 'ru', 'en'].includes(s('Til').toLowerCase()) ? s('Til').toLowerCase() : 'uz'),
    solution: s('Yechim') || null,
    solutionStatus: s('Yechim') ? 'tasdiqlangan' : 'yoq',
    status: s('Holat').toLowerCase().startsWith('qor') ? 'qoralama' : s('Holat').toLowerCase().startsWith('arx') ? 'arxiv' : 'faol',
  };
}

function shablonniYukla() {
  const namuna = [
    { Fan: 'Matematika', Mavzu: 'Kvadrat tenglamalar', "Bo'lim": 'Algebra', Tur: 'yopiq', Savol: '$x^2-5x+6=0$ tenglamaning ildizlari yig\'indisini toping', A: '5', B: '6', C: '-5', D: '1', Javob: 'A', Qiyinlik: "o'rta", Manba: 'DTM 2025', Til: 'uz', Yechim: "Viyet teoremasi: $x_1+x_2=5$" },
    { Fan: 'Matematika', Mavzu: 'Oddiy kasrlar', "Bo'lim": 'Arifmetika', Tur: 'raqamli', Savol: '$\\frac{3}{4}-\\frac{1}{4}$ ni hisoblang', Javob: '1/2', "Qo'shimcha javoblar": '0,5', Qiyinlik: 'oson', Til: 'uz' },
    { Fan: 'Matematika', Mavzu: 'Matnli masalalar', Tur: 'yozma', Savol: 'Masalani yeching va yechimini yozing: ...', Ball: 5, Qiyinlik: 'qiyin', Til: 'uz' },
  ];
  const ws = XLSX.utils.json_to_sheet(namuna, { header: USTUNLAR });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Savollar');
  XLSX.writeFile(wb, 'savollar-shablon.xlsx');
}

export default function QuestionsList() {
  const { showNotification, ozgartira, selectedSchoolId, user } = useCRM();
  const savolTahrir = ozgartira('imtihonlar.savollar');
  const { soro } = useImtihonApi();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { daraxt, xato, yangila } = useBankDaraxt();

  const fan = fanniTop(daraxt, Number(params.get('fan')) || null);
  const mavzu = mavzuniTop(fan, Number(params.get('mavzu')) || null);
  const ot = (patch: { fan?: number | null; mavzu?: number | null }) => setParams(p => {
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, String(v)); else p.delete(k); }
    return p;
  });

  const [qidiruv, setQidiruv] = useState('');
  const [natijalar, setNatijalar] = useState<Question[] | null>(null);
  const [qayta, setQayta] = useState(0);
  const [ochiq, setOchiq] = useState<Question | null>(null);
  const [importMenyu, setImportMenyu] = useState(false);
  const [import_, setImport] = useState<{ yaroqli: any[]; xatolar: { qator: number; xato: string }[]; jami: number } | null>(null);
  const [importMoqda, setImportMoqda] = useState(false);
  const [matnlarOchiq, setMatnlarOchiq] = useState(false);
  const [aiImport, setAiImport] = useState(false);
  const ai = useAiHolat();
  const menyuRef = useRef<HTMLDivElement>(null);
  const faylRef = useRef<HTMLInputElement>(null);

  // Butun bankdan qidirish (faqat birinchi qavatda): yozish to'xtagach.
  useEffect(() => {
    const k = qidiruv.trim();
    if (k.length < 2) { setNatijalar(null); return; }
    const t = setTimeout(() => {
      soro<{ items: Question[] }>('GET', `questions?qidiruv=${encodeURIComponent(k)}&soni=40`).then(r => setNatijalar(r.items)).catch(() => setNatijalar([]));
    }, 350);
    return () => clearTimeout(t);
  }, [qidiruv, qayta, soro]);

  useEffect(() => {
    if (!importMenyu) return;
    const yop = (e: MouseEvent) => { if (!menyuRef.current?.contains(e.target as Node)) setImportMenyu(false); };
    document.addEventListener('mousedown', yop);
    return () => document.removeEventListener('mousedown', yop);
  }, [importMenyu]);

  const yangiSavol = (o: { mavzuId?: number; fanId?: number; qiyinlik?: number } = {}) => {
    const p = new URLSearchParams();
    if (o.mavzuId) p.set('mavzu', String(o.mavzuId));
    else if (o.fanId) p.set('fan', String(o.fanId));
    if (o.qiyinlik) p.set('qiyinlik', String(o.qiyinlik));
    navigate(`/questions/new${p.toString() ? `?${p}` : ''}`);
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
          const x = !q.subject ? "Fan yo'q" : !q.topic ? "Mavzu yo'q" : q.status === 'faol' ? savolXatosi(q) : null;
          if (x) xatolar.push({ qator: i + 2, xato: x }); else yaroqli.push(q);
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
      showNotification(`${r.count} ta savol qo'shildi — fan va mavzulari bo'yicha joylashdi`, 'success');
      yangila();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setImportMoqda(false);
    }
  };

  if (xato) return <Karta><BoshHolat sarlavha="Bank ochilmadi" izoh={xato}><Tugma onClick={() => yangila()}>Qayta urinish</Tugma></BoshHolat></Karta>;
  if (!daraxt) return <Yuklanmoqda />;

  return (
    <div className="space-y-4">
      {/* Yo'l (fan › mavzu) va amallar */}
      <div className="bg-sirt border border-chiziq rounded-2xl shadow-sm px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <nav aria-label="Bank bo'limlari" className="flex flex-wrap items-center gap-1 text-[13px] min-w-0">
          <button onClick={() => ot({ fan: null, mavzu: null })} className={`font-bold cursor-pointer ${fan ? 'text-matn-sokin hover:text-brand' : 'text-matn'}`}>Savollar banki</button>
          {fan && <><ChevronRight size={14} className="text-matn-xira" /><button onClick={() => ot({ mavzu: null })} className={`font-bold truncate max-w-[40vw] cursor-pointer ${mavzu ? 'text-matn-sokin hover:text-brand' : 'text-matn'}`}>{fan.name}</button></>}
          {mavzu && <><ChevronRight size={14} className="text-matn-xira" /><span className="font-bold text-matn truncate max-w-[40vw]">{mavzu.name}</span></>}
        </nav>
        {savolTahrir && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <Tugma kichik turi="oddiy" ikonka={<FileText size={14} />} onClick={() => setMatnlarOchiq(true)}>Matnlar</Tugma>
            <div className="relative" ref={menyuRef}>
              <Tugma kichik ikonka={<Upload size={14} />} onClick={() => setImportMenyu(v => !v)} aria-expanded={importMenyu}>Import <ChevronDown size={13} /></Tugma>
              {importMenyu && (
                <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-chiziq bg-sirt shadow-lg p-1">
                  <MenyuBandi ikonka={<FileUp size={14} />} nom="Excel fayldan" izoh="Fan, mavzu va qiyinlik ustunlari bilan" onClick={() => { setImportMenyu(false); faylRef.current?.click(); }} />
                  <MenyuBandi ikonka={<FileDown size={14} />} nom="Excel shablon" izoh="To'ldirish uchun namuna" onClick={() => { setImportMenyu(false); shablonniYukla(); }} />
                  {ai && <MenyuBandi ikonka={<Sparkles size={14} />} nom="AI import" izoh={ai.yoqilgan ? 'PDF, rasm yoki matndan' : AI_SOZLANMAGAN} disabled={!ai.yoqilgan} onClick={() => { setImportMenyu(false); setAiImport(true); }} />}
                </div>
              )}
              <input ref={faylRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={excelniOqi} />
            </div>
            <Tugma kichik turi="asosiy" ikonka={<Plus size={14} />} onClick={() => yangiSavol({ mavzuId: mavzu?.id, fanId: fan?.id })}>Yangi savol</Tugma>
          </div>
        )}
      </div>

      {!fan && (
        <div className="relative max-w-xl">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-matn-xira" />
          <input className={`${INPUT} pl-9`} placeholder="Butun bankdan qidirish (savol matni)" aria-label="Butun bankdan qidirish" value={qidiruv} onChange={e => setQidiruv(e.target.value)} />
          {qidiruv && <button aria-label="Tozalash" onClick={() => setQidiruv('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-matn-xira hover:text-matn cursor-pointer"><X size={14} /></button>}
        </div>
      )}

      {!fan && natijalar ? (
        <Karta sarlavha={`Qidiruv natijasi: ${natijalar.length}${natijalar.length === 40 ? '+' : ''}`}>
          {!natijalar.length ? <p className="text-[12.5px] text-matn-xira">Mos savol topilmadi</p> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {natijalar.map(q => (
                <div key={q.id}>
                  <p className="text-[11px] text-matn-xira px-1 mb-0.5 truncate">{q.subject} › {q.topic}</p>
                  <SavolKartasi q={q} onOch={() => setOchiq(q)} />
                </div>
              ))}
            </div>
          )}
        </Karta>
      ) : !fan ? (
        <FanlarKorinishi daraxt={daraxt} onFan={id => ot({ fan: id, mavzu: null })} yangila={yangila} onYangiSavol={() => yangiSavol()} />
      ) : !mavzu ? (
        <FanKorinishi fan={fan} onMavzu={id => ot({ mavzu: id })} onOrqaga={() => ot({ fan: null, mavzu: null })} yangila={yangila} onYangiSavol={() => yangiSavol({ fanId: fan.id })} />
      ) : (
        <MavzuKorinishi key={mavzu.id} fan={fan} mavzu={mavzu} daraxt={daraxt} yangila={yangila} onFan={() => ot({ mavzu: null })}
          onYangiSavol={qiyinlik => yangiSavol({ mavzuId: mavzu.id, qiyinlik })} />
      )}

      {/* Import oynasi */}
      {import_ && (
        <div className="fixed inset-0 z-[250] flex items-start sm:items-center justify-center overflow-y-auto p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => !importMoqda && setImport(null)} />
          <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-lg border border-chiziq">
            <div className="flex items-center justify-between px-5 py-4 border-b border-chiziq">
              <div>
                <h3 className="text-[14px] font-bold text-matn">Excel import</h3>
                <p className="text-[12px] text-matn-xira">Jami {import_.jami} ta qator · fan va mavzu nomi bo'yicha joylashadi (yo'g'i yaratiladi)</p>
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
              <p className="text-[11.5px] text-matn-xira">Xato qatorlar yuklanmaydi — ularni Excel'da tuzatib, qayta import qiling. «Qiyinlik» ustuniga: oson, o'rta yoki qiyin (1, 2, 3).</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-chiziq">
              <Tugma onClick={() => setImport(null)}>Bekor qilish</Tugma>
              <Tugma turi="asosiy" yuklanmoqda={importMoqda} disabled={!import_.yaroqli.length} onClick={importQil}>{import_.yaroqli.length} ta savolni yuklash</Tugma>
            </div>
          </div>
        </div>
      )}
      {ochiq && <SavolOynasi q={ochiq} daraxt={daraxt} onYop={() => setOchiq(null)} onOzgardi={() => { yangila(); setQayta(n => n + 1); }} />}
      {matnlarOchiq && <MatnlarOynasi onYop={() => { setMatnlarOchiq(false); yangila(); }} />}
      {aiImport && <AiImportOynasi fanlar={daraxt.fanlar.map(f => f.name)} onYop={() => setAiImport(false)} onSaqlandi={() => yangila()} />}
    </div>
  );
}

function MenyuBandi({ ikonka, nom, izoh, onClick, disabled }: { ikonka: React.ReactNode; nom: string; izoh?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-ichki disabled:opacity-50 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default">
      <span className="mt-0.5 text-matn-sokin">{ikonka}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-matn">{nom}</span>
        {izoh && <span className="block text-[11.5px] text-matn-xira">{izoh}</span>}
      </span>
    </button>
  );
}
