import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, LayoutList, CheckCircle2, AlertTriangle, Loader2, Wand2, ArrowUp, ArrowDown } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi, ApiXato } from './useImtihonApi';
import { Tugma, INPUT, Maydon } from './ui';
import { useBankDaraxt } from './bank/useBankDaraxt';
import { andozaBlokQoidalari, andozaQoidali, qoidalarSoni } from './bank/andoza';
import { andozaSavolSoni } from '../../../lib/imtihon.js';
import { yangiImtihonBoshi } from '../../../lib/imtihonSozlama.js';
import type { Andoza, AndozaTafsil, BelgiGuruhi, ExamBlock } from '../../types';

// Andozadan savol qog'ozi — Addmen QPG "Generate Question Paper": andoza(lar)
// tanlanadi, nechta variant (set) kerakligi yoziladi — imtihon tuziladi va
// qulflanadi (kalit saqlanadi). Andozadagi savollar aynan o'zi tushadi: variantlarda
// faqat tartibi va javoblari aralashadi. Eski, qoidali andozada savollar bankdan
// tanlanadi. Keyin kitobcha, kalit va javob varaqalari "Chop etish"dan chiqadi; skaner shu
// kalit bilan tekshiradi (Addmen'dagi "COPY KEY" alohida qadam emas).

const bugun = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);

/** Tanlangan andozaning holati: `tayyor` — qog'ozga tushadigan savollar; `yetadi` — yaratsa bo'ladimi (null — tekshirilmoqda). */
type Holat = { yetadi: boolean | null; tayyor?: number; tushmaydi?: number; tafsil?: AndozaTafsil };

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
  const [holat, setHolat] = useState<Record<number, Holat>>({});
  const [band, setBand] = useState(false);

  // Markazning umumiy sozlamasi (Imtihonlar → Sozlamalar): bu yerda yaratiladigan imtihon ham — yangi
  // imtihon, shuning uchun markaz SAQLAGAN qiymatlar bilan boshlanadi (davomiyligi, variantlar soni,
  // aralashtirish; qolgani — xabar matnlari, reyting, jarima… — imtihonga shu holicha yoziladi).
  // Markaz hali hech narsa saqlamagan yoki sozlama o'qilmasa — oynaning o'z standarti qoladi.
  const [markaz, setMarkaz] = useState<Record<string, unknown> | null>(null);
  const tegildi = useRef(false);
  useEffect(() => {
    let tirik = true;
    soro<{ sozlama: unknown; saqlangan?: boolean }>('GET', 'imtihon-sozlama').then(r => {
      if (!tirik || !r.saqlangan) return;
      const m = yangiImtihonBoshi(r.sozlama);
      setMarkaz(m.settings);
      // Xodim maydonlarni o'zgartirib ulgurgan bo'lsa — yozgani bosilmaydi.
      if (tegildi.current) return;
      setDavom(m.duration);
      setVariantlar(m.settings.variantCount);
      setAralashSavol(!!m.settings.shuffleQuestions);
      setAralashVariant(!!m.settings.shuffleOptions);
    }).catch(() => { /* oynaning o'z standarti qoladi */ });
    return () => { tirik = false; };
  }, [soro]);

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

  // Har tanlangan andoza: savollari (qog'ozga nechta tushadi) yoki — qoidali bo'lsa — bankda yetadimi
  // (variantlar bitta savollar to'plamidan — soni ko'paymaydi).
  useEffect(() => {
    for (const id of tanlangan) {
      if (holat[id] !== undefined) continue;
      const a = andozalar?.find(x => x.id === id);
      if (!a) continue;
      const qoy = (h: Holat) => setHolat(y => ({ ...y, [id]: h }));
      qoy({ yetadi: null });
      if (andozaQoidali(a)) {
        if (!a.subjectId) { qoy({ yetadi: false }); continue; }
        soro<{ qatorlar: { yetadi: boolean }[] }>('POST', 'bank/andozalar/hisob', { subjectId: a.subjectId, rows: a.rows })
          .then(r => qoy({ yetadi: r.qatorlar.every(q => q.yetadi) })).catch(() => qoy({ yetadi: false }));
      } else {
        soro<AndozaTafsil>('GET', `bank/andozalar/${id}?qisqa=1`).then(t => {
          // Imtihon sanaganidek (qismli savol — bitta): faol bo'lmagan va chala savollar tushmaydi.
          const tayyor = andozaSavolSoni(t.savollar.filter(q => !q.tushmaydi));
          qoy({ yetadi: tayyor > 0, tayyor, tushmaydi: andozaSavolSoni(t.savollar) - tayyor, tafsil: t });
        }).catch(() => qoy({ yetadi: false }));
      }
    }
  }, [tanlangan, andozalar]); // eslint-disable-line react-hooks/exhaustive-deps

  const tanlov = useMemo(() => tanlangan.map(id => andozalar?.find(a => a.id === id)).filter(Boolean) as Andoza[], [tanlangan, andozalar]);
  const jami = tanlov.reduce((s, a) => s + (andozaQoidali(a) ? qoidalarSoni(a) : holat[a.id]?.tayyor ?? a.savolSoni), 0);
  const qoidalisiBor = tanlov.some(andozaQoidali);
  const almashtir = (id: number) => setTanlangan(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]));
  const surish = (i: number, d: number) => setTanlangan(l => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const yarat = async () => {
    if (!daraxt || !tanlov.length) return;
    const bal = Number(ball.replace(',', '.')) || 1;
    // Ikki andozada bitta savol bo'lsa — qog'ozda ikki marta (ikki raqam ostida) chiqib qolardi.
    const egasi = new Map<number, Andoza>();
    for (const a of tanlov) {
      for (const q of holat[a.id]?.tafsil?.savollar || []) {
        const oldingi = egasi.get(q.id);
        if (oldingi && oldingi.id !== a.id) return showNotification(`«${oldingi.name}» va «${a.name}» andozalarida bir xil savol bor (#${q.id}) — bittasidan olib tashlang`, 'error');
        egasi.set(q.id, a);
      }
    }
    const blocks: ExamBlock[] = [];
    for (const [i, a] of tanlov.entries()) {
      // Blok fani: andozadagi savollarning fani (qoidali andozada — qoidalar fani).
      const fan = daraxt.fanlar.find(f => f.id === (a.fanId ?? a.subjectId));
      if (!fan) return showNotification(`«${a.name}»: fani bankda topilmadi`, 'error');
      const tafsil: AndozaTafsil | undefined = andozaQoidali(a) ? { ...a, savollar: [] } : holat[a.id]?.tafsil;
      if (!tafsil) return showNotification(`«${a.name}» hali tekshirilmoqda — biroz kuting`, 'error');
      const { topicRules } = andozaBlokQoidalari(tafsil, fan, guruhlar);
      if (!topicRules.length) return showNotification(`«${a.name}» da qog'ozga tushadigan savol yo'q`, 'error');
      blocks.push({ id: `b${i + 1}`, subject: fan.name, fanId: fan.id, pointsPerQuestion: bal, andoza: { id: a.id, nomi: a.name }, topicRules });
    }
    setBand(true);
    let examId: number | null = null;
    try {
      const e = await soro<{ id: number }>('POST', 'exams', {
        schoolId: filial, name: nom.trim() || tanlov[0].name, date: sana, duration: davom, scoring: 'blok', blocks,
        settings: {
          // Savollar bu yerda doim bankdan (markaz standarti «faqat kalit» bo'lsa ham).
          ...(markaz || {}), source: 'bank',
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

  /** Ro'yxatdagi andozaning o'ng tomondagi holati. */
  const holatBelgisi = (a: Andoza) => {
    const h = holat[a.id];
    if (!h) return null;
    if (h.yetadi === null) return <Loader2 size={13} className="animate-spin text-matn-xira" />;
    if (andozaQoidali(a)) {
      return h.yetadi
        ? <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-yaxshi"><CheckCircle2 size={13} /> bankda yetadi</span>
        : <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-xato"><AlertTriangle size={13} /> yetmaydi</span>;
    }
    if (!h.yetadi) return <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-xato"><AlertTriangle size={13} /> tushadigan savol yo'q</span>;
    if (h.tushmaydi) return <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ogoh" title="Bankda faol emas yoki chala savollar qog'ozga tushmaydi"><AlertTriangle size={13} /> {h.tushmaydi} tasi tushmaydi</span>;
    if (a.savolSoni < a.soni) return <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ogoh" title="Andoza to'lmagan — qog'ozga faqat qo'shilgan savollar tushadi"><AlertTriangle size={13} /> to'lmagan</span>;
    return <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-yaxshi"><CheckCircle2 size={13} /> tayyor</span>;
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
            <p className="text-[12px] font-semibold text-matn-sokin mb-1.5">Andozalar <span className="font-normal text-matn-xira">— har biri alohida blok, tanlangan tartibda</span></p>
            {!andozalar ? <p className="text-[12.5px] text-matn-xira"><Loader2 size={13} className="inline animate-spin" /> Yuklanmoqda</p>
              : !andozalar.length ? <p className="rounded-xl bg-ichki px-3 py-3 text-[12.5px] text-matn-sokin">Andoza yo'q — «Savollar banki → Andoza» da yarating: nomi va savollar soni, keyin savollar qo'shiladi.</p>
              : (
                <ul className="rounded-xl border border-chiziq divide-y divide-chiziq max-h-56 overflow-y-auto">
                  {andozalar.map(a => {
                    const fan = daraxt?.fanlar.find(f => f.id === (a.fanId ?? a.subjectId));
                    const i = tanlangan.indexOf(a.id);
                    const qoidali = andozaQoidali(a);
                    const bosh = !qoidali && !a.savolSoni;
                    return (
                      <li key={a.id} className={`flex items-center gap-2.5 px-3 py-2 text-[12.5px] ${i >= 0 ? 'bg-brand-fon/60 dark:bg-brand/10' : ''} ${bosh ? 'opacity-60' : ''}`}>
                        <input type="checkbox" className="w-4 h-4 accent-[var(--color-brand)] cursor-pointer disabled:cursor-not-allowed" checked={i >= 0} disabled={bosh && i < 0} onChange={() => almashtir(a.id)} aria-label={a.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-matn truncate">{i >= 0 && <span className="raqam text-brand mr-1">{i + 1}.</span>}{a.name}</span>
                          <span className="block text-[11.5px] text-matn-xira">
                            {bosh ? "bo'sh — avval savol qo'shing"
                              : <>{fan?.name || (daraxt ? 'fan topilmadi' : '…')} · {qoidali ? <>qoidali · <span className="raqam">{qoidalarSoni(a)}</span> savol</> : <><span className="raqam">{a.savolSoni} / {a.soni}</span> savol</>}</>}
                          </span>
                        </span>
                        {i >= 0 && holatBelgisi(a)}
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
            <Maydon nom="Variantlar (setlar)"><input type="number" min={1} max={26} className={INPUT} value={variantlar} onChange={e => { tegildi.current = true; setVariantlar(Math.max(1, Math.min(26, Number(e.target.value) || 1))); }} /></Maydon>
            <Maydon nom="Bir savol bali"><input inputMode="decimal" className={INPUT} value={ball} onChange={e => setBall(e.target.value)} /></Maydon>
            <Maydon nom="Daqiqa"><input type="number" min={10} max={600} className={INPUT} value={davom} onChange={e => { tegildi.current = true; setDavom(Number(e.target.value) || 60); }} /></Maydon>
          </div>
          {/* Bankdan tanlash sozlamalari — faqat qoidali andoza uchun (andozadagi savollar o'zi tushadi). */}
          {qoidalisiBor && (
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
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-matn">
            <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[var(--color-brand)]" checked={aralashSavol} onChange={e => { tegildi.current = true; setAralashSavol(e.target.checked); }} />Savollar tartibi aralashtirilsin</label>
            <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[var(--color-brand)]" checked={aralashVariant} onChange={e => { tegildi.current = true; setAralashVariant(e.target.checked); }} />Javob variantlari aralashtirilsin</label>
          </div>
          <p className="text-[11.5px] text-matn-xira">Hamma variantda savollar bir xil — andozadagi savollarning o'zi{aralashSavol || aralashVariant ? `, ${[aralashSavol && 'tartibi', aralashVariant && 'javoblari'].filter(Boolean).join(' va ')} aralashtiriladi` : ''} (A, B, C… kitobchalar). Tushgan savollarni «Chop etish → Tanlangan savollar»da ko'rib, almashtirasiz.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-t border-chiziq">
          <span className="text-[12.5px] text-matn-sokin">{tanlov.length ? <><b className="text-matn raqam">{jami}</b> ta savol · {variantlar} variant</> : 'Andozani tanlang'}</span>
          <div className="flex gap-2">
            <Tugma onClick={onYop} disabled={band}>Bekor qilish</Tugma>
            <Tugma turi="asosiy" ikonka={<Wand2 size={14} />} yuklanmoqda={band} disabled={!tanlov.length || !daraxt || tanlangan.some(id => !holat[id]?.yetadi)} onClick={yarat}>Savol qog'ozini yaratish</Tugma>
          </div>
        </div>
      </div>
    </div>
  );
}
