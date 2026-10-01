import React, { useEffect, useMemo, useState } from 'react';
import { X, LayoutList, CheckCircle2, AlertTriangle, Loader2, Wand2, ArrowUp, ArrowDown } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi, ApiXato } from './useImtihonApi';
import { Tugma, INPUT, Maydon } from './ui';
import { useBankDaraxt } from './bank/useBankDaraxt';
import { andozadanQoidalar } from './tuzish/andozadan';
import type { Andoza, BelgiGuruhi, ExamBlock } from '../../types';

// Andozadan savol qog'ozi — Addmen QPG "Generate Question Paper": andoza(lar)
// tanlanadi, nechta variant (set) kerakligi yoziladi — imtihon tuziladi va
// qulflanadi (savollar tanlanadi, aralashtiriladi, kalit saqlanadi). Keyin
// kitobcha, kalit va javob varaqalari "Chop etish"dan chiqadi; skaner shu
// kalit bilan tekshiradi (Addmen'dagi "COPY KEY" alohida qadam emas).

const bugun = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);

export default function AndozadanQogoz({ boshAndozaId, onYop, onTayyor }: {
  boshAndozaId?: number; onYop: () => void; onTayyor: (examId: number, qulflandi: boolean) => void;
}) {
  const { showNotification } = useCRM();
  const { soro, filial } = useImtihonApi();
  const { daraxt } = useBankDaraxt();
  const [andozalar, setAndozalar] = useState<Andoza[] | null>(null);
  const [guruhlar, setGuruhlar] = useState<BelgiGuruhi[]>([]);
  const [tanlangan, setTanlangan] = useState<number[]>(boshAndozaId ? [boshAndozaId] : []);
  const [nom, setNom] = useState('');
  const [sana, setSana] = useState(bugun());
  const [davom, setDavom] = useState(90);
  const [variantlar, setVariantlar] = useState(4);
  const [ball, setBall] = useState('1');
  // Addmen "Use <=", "Duplicate content", "Question / Option shuffled sets".
  const [chegara, setChegara] = useState('');
  const [takror, setTakror] = useState<'variant' | 'savol' | 'yoq'>('variant');
  const [aralashSavol, setAralashSavol] = useState(true);
  const [aralashVariant, setAralashVariant] = useState(true);
  const [yetadi, setYetadi] = useState<Record<number, boolean | null>>({});
  const [band, setBand] = useState(false);

  useEffect(() => {
    Promise.all([soro<Andoza[]>('GET', 'bank/andozalar'), soro<BelgiGuruhi[]>('GET', 'bank/belgilar')])
      .then(([a, g]) => { setAndozalar(a); setGuruhlar(g); }).catch(e => showNotification(e.message, 'error'));
  }, [soro]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nomi: birinchi tanlangan andozadan (o'zgartirilmagan bo'lsa).
  const [nomQolda, setNomQolda] = useState(false);
  useEffect(() => {
    if (nomQolda || !andozalar) return;
    const a = andozalar.find(x => x.id === tanlangan[0]);
    setNom(a ? `${a.name} — ${sana.split('-').reverse().join('.')}` : '');
  }, [tanlangan, andozalar, sana, nomQolda]);

  // Har tanlangan andoza bankda yetadimi (variantlar bitta savollar to'plamidan — soni ko'paymaydi).
  useEffect(() => {
    for (const id of tanlangan) {
      if (yetadi[id] !== undefined) continue;
      const a = andozalar?.find(x => x.id === id);
      if (!a?.subjectId) continue;
      setYetadi(y => ({ ...y, [id]: null }));
      soro<{ qatorlar: { yetadi: boolean }[] }>('POST', 'bank/andozalar/hisob', { subjectId: a.subjectId, rows: a.rows })
        .then(r => setYetadi(y => ({ ...y, [id]: r.qatorlar.every(q => q.yetadi) }))).catch(() => setYetadi(y => ({ ...y, [id]: false })));
    }
  }, [tanlangan, andozalar]); // eslint-disable-line react-hooks/exhaustive-deps

  const tanlov = useMemo(() => tanlangan.map(id => andozalar?.find(a => a.id === id)).filter(Boolean) as Andoza[], [tanlangan, andozalar]);
  const jami = tanlov.reduce((s, a) => s + a.rows.reduce((x, r) => x + r.soni, 0), 0);
  const almashtir = (id: number) => setTanlangan(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]));
  const surish = (i: number, d: number) => setTanlangan(l => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const yarat = async () => {
    if (!daraxt || !tanlov.length) return;
    const bal = Number(ball.replace(',', '.')) || 1;
    const blocks: ExamBlock[] = [];
    for (const [i, a] of tanlov.entries()) {
      const fan = daraxt.fanlar.find(f => f.id === a.subjectId);
      if (!fan) return showNotification(`«${a.name}»: fani bankda topilmadi`, 'error');
      blocks.push({ id: `b${i + 1}`, subject: fan.name, fanId: fan.id, pointsPerQuestion: bal, andoza: { id: a.id, nomi: a.name }, topicRules: andozadanQoidalar(a, fan, guruhlar) });
    }
    setBand(true);
    let examId: number | null = null;
    try {
      const e = await soro<{ id: number }>('POST', 'exams', {
        schoolId: filial, name: nom.trim() || tanlov[0].name, date: sana, duration: davom, scoring: 'blok', blocks,
        settings: {
          variantCount: variantlar, shuffleQuestions: aralashSavol, shuffleOptions: aralashVariant,
          ishlatishChegarasi: chegara.trim() === '' ? null : Math.max(0, Math.round(Number(chegara) || 0)), takror,
        },
      });
      examId = e.id;
      await soro('POST', `exams/${e.id}/lock`, {});
      showNotification(`Savol qog'ozi tayyor: ${variantlar} ta variant, kalit saqlandi`, 'success');
      onTayyor(e.id, true);
    } catch (err: any) {
      if (examId) {
        // Imtihon yaratildi, lekin qulflanmadi (bankda yetmadi) — tuzilmasini to'g'rilash uchun ochiladi.
        const k = err instanceof ApiXato ? err.malumot?.kamchiliklar?.[0] : null;
        showNotification(`Imtihon yaratildi, lekin savollar yetmadi${k ? ` (${k.blok}${k.mavzu ? ` · ${k.mavzu}` : ''}: kerak ${k.kerak}, bankda ${k.bor})` : `: ${err.message}`} — «Imtihonlar»da to'g'rilang`, 'error');
        onTayyor(examId, false);
      } else showNotification(err.message, 'error');
    } finally {
      setBand(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Andozadan savol qog'ozi">
      <div className="fixed inset-0 bg-black/50" onClick={() => !band && onYop()} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-2xl border border-chiziq my-2">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-chiziq">
          <div>
            <h3 className="text-[14px] font-bold text-matn flex items-center gap-1.5"><LayoutList size={15} className="text-brand" /> Andozadan savol qog'ozi</h3>
            <p className="text-[12px] text-matn-xira">Andoza → variantlar (setlar) → kitobcha, kalit va javob varaqasi</p>
          </div>
          <button aria-label="Yopish" disabled={band} onClick={onYop} className="p-2 -mr-2 rounded-lg hover:bg-ichki cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[12px] font-semibold text-matn-sokin mb-1.5">Andozalar <span className="font-normal text-matn-xira">— har biri alohida fan bloki, tanlangan tartibda</span></p>
            {!andozalar ? <p className="text-[12.5px] text-matn-xira"><Loader2 size={13} className="inline animate-spin" /> Yuklanmoqda</p>
              : !andozalar.length ? <p className="rounded-xl bg-ichki px-3 py-3 text-[12.5px] text-matn-sokin">Andoza yo'q — «Savollar banki → Andoza (Blueprint)» da yarating.</p>
              : (
                <ul className="rounded-xl border border-chiziq divide-y divide-chiziq max-h-56 overflow-y-auto">
                  {andozalar.map(a => {
                    const fan = daraxt?.fanlar.find(f => f.id === a.subjectId);
                    const i = tanlangan.indexOf(a.id);
                    const y = yetadi[a.id];
                    return (
                      <li key={a.id} className={`flex items-center gap-2.5 px-3 py-2 text-[12.5px] ${i >= 0 ? 'bg-brand-fon/60 dark:bg-brand/10' : ''}`}>
                        <input type="checkbox" className="w-4 h-4 accent-[var(--color-brand)] cursor-pointer" checked={i >= 0} onChange={() => almashtir(a.id)} aria-label={a.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-matn truncate">{i >= 0 && <span className="raqam text-brand mr-1">{i + 1}.</span>}{a.name}</span>
                          <span className="block text-[11.5px] text-matn-xira">{fan?.name || (daraxt ? 'fan topilmadi' : '…')} · {a.rows.reduce((s, r) => s + r.soni, 0)} savol</span>
                        </span>
                        {i >= 0 && (y === null ? <Loader2 size={13} className="animate-spin text-matn-xira" />
                          : y === true ? <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-yaxshi"><CheckCircle2 size={13} /> bankda yetadi</span>
                          : y === false ? <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-xato"><AlertTriangle size={13} /> yetmaydi</span> : null)}
                        {i >= 0 && tanlangan.length > 1 && (
                          <span className="flex">
                            <button aria-label="Yuqoriga" onClick={() => surish(i, -1)} className="p-1 rounded text-matn-xira hover:text-matn cursor-pointer"><ArrowUp size={13} /></button>
                            <button aria-label="Pastga" onClick={() => surish(i, 1)} className="p-1 rounded text-matn-xira hover:text-matn cursor-pointer"><ArrowDown size={13} /></button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
          </div>
          <Maydon nom="Nomi"><input className={INPUT} value={nom} onChange={e => { setNom(e.target.value); setNomQolda(true); }} placeholder="Geometriya — 30 talik" /></Maydon>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Maydon nom="Sana"><input type="date" className={INPUT} value={sana} onChange={e => setSana(e.target.value)} /></Maydon>
            <Maydon nom="Variantlar (setlar)"><input type="number" min={1} max={26} className={INPUT} value={variantlar} onChange={e => setVariantlar(Math.max(1, Math.min(26, Number(e.target.value) || 1)))} /></Maydon>
            <Maydon nom="Bir savol bali"><input inputMode="decimal" className={INPUT} value={ball} onChange={e => setBall(e.target.value)} /></Maydon>
            <Maydon nom="Daqiqa"><input type="number" min={10} max={600} className={INPUT} value={davom} onChange={e => setDavom(Number(e.target.value) || 60)} /></Maydon>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Maydon nom="Ko'p ishlatilganini olmaslik" izoh="Bo'sh — cheklovsiz">
              <div className="flex items-center gap-2 text-[12.5px] text-matn-sokin">
                ishlatilgani ≤
                <div className="w-20"><input inputMode="numeric" className={INPUT} placeholder="∞" aria-label="Ishlatish chegarasi" value={chegara} onChange={e => setChegara(e.target.value.replace(/\D/g, ''))} /></div>
                marta
              </div>
            </Maydon>
            <Maydon nom="Takroriy savollar">
              <select className={INPUT} value={takror} onChange={e => setTakror(e.target.value as typeof takror)} aria-label="Takroriy savollar">
                <option value="variant">Matni va variantlari bir xil — bittasi</option>
                <option value="savol">Matni bir xil — bittasi</option>
                <option value="yoq">Tekshirilmasin</option>
              </select>
            </Maydon>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-matn">
            <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[var(--color-brand)]" checked={aralashSavol} onChange={e => setAralashSavol(e.target.checked)} />Savollar tartibi aralashtirilsin</label>
            <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[var(--color-brand)]" checked={aralashVariant} onChange={e => setAralashVariant(e.target.checked)} />Javob variantlari aralashtirilsin</label>
          </div>
          <p className="text-[11.5px] text-matn-xira">Hamma variantda savollar bir xil{aralashSavol || aralashVariant ? `, ${[aralashSavol && 'tartibi', aralashVariant && 'javoblari'].filter(Boolean).join(' va ')} aralashtiriladi` : ''} (A, B, C… kitobchalar). Tushgan savollarni «Chop etish → Tanlangan savollar»da ko'rib, almashtirasiz.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-t border-chiziq">
          <span className="text-[12.5px] text-matn-sokin">{tanlov.length ? <><b className="text-matn raqam">{jami}</b> ta savol · {variantlar} variant</> : 'Andozani tanlang'}</span>
          <div className="flex gap-2">
            <Tugma onClick={onYop} disabled={band}>Bekor qilish</Tugma>
            <Tugma turi="asosiy" ikonka={<Wand2 size={14} />} yuklanmoqda={band} disabled={!tanlov.length || !daraxt || tanlangan.some(id => yetadi[id] === false)} onClick={yarat}>Savol qog'ozini yaratish</Tugma>
          </div>
        </div>
      </div>
    </div>
  );
}
