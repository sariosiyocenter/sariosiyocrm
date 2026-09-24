import React, { useState } from 'react';
import { X, Sparkles, FileUp, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import { useImtihonApi } from './useImtihonApi';
import { Tugma, Maydon, INPUT, SELECT, Yorliq, Almashtirgich } from './ui';
import { formulaliHtml, SAVOL_MATNI } from '../../lib/matn';
import { HARFLAR, SAVOL_TURI_NOMI, savolXatosi } from '../../../lib/imtihon.js';

// AI import (3.1): PDF sahifalari yoki rasm (formulali ham) yoki joylangan
// matn → AI savollarni ajratadi → shu yerda ko'rib, tuzatib, tanlab bankka
// qo'shiladi. Bankka qo'shilmaguncha hech narsa saqlanmaydi.

interface AiSavol {
  subject: string; topic: string; type: 'yopiq' | 'raqamli' | 'yozma'; text: string; options: string[] | null;
  correctAnswer: string; difficulty: number; language: string; solution: string | null; solutionStatus: string;
  status: string; source: string; matnId: string | null; xato: string | null; tanlangan?: boolean;
}
interface AiMatn { id: string; sarlavha: string; matn: string }

// Bitta so'rovda nechta sahifa: Vercel so'rov chegarasi 4,5 MB.
const PARTIYA = 3;
const MAKS_SAHIFA = 40;

/** PDF sahifalari va rasmlar → 1600px enli JPEG data URL lar. */
async function sahifaRasmlari(fayllar: File[], onSahifa: (n: number) => void): Promise<string[]> {
  const { faylSahifalari } = await import('../../lib/omr/skaner');
  const out: string[] = [];
  for (const f of fayllar) {
    for await (const { bitmap } of faylSahifalari(f)) {
      const k = Math.min(1, 1600 / bitmap.width);
      const c = document.createElement('canvas');
      c.width = Math.round(bitmap.width * k);
      c.height = Math.round(bitmap.height * k);
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(bitmap, 0, 0, c.width, c.height);
      bitmap.close();
      out.push(c.toDataURL('image/jpeg', 0.82));
      onSahifa(out.length);
      if (out.length >= MAKS_SAHIFA) return out;
    }
  }
  return out;
}

export default function AiImportOynasi({ fanlar, onYop, onSaqlandi }: { fanlar: string[]; onYop: () => void; onSaqlandi: () => void }) {
  const { showNotification } = useCRM();
  const { soro, filial } = useImtihonApi();
  const [fan, setFan] = useState('');
  const [mavzu, setMavzu] = useState('');
  const [til, setTil] = useState<'uz' | 'ru' | 'en'>('uz');
  const [fayllar, setFayllar] = useState<File[]>([]);
  const [matn, setMatn] = useState('');
  const [holat, setHolat] = useState<string | null>(null);
  const [savollar, setSavollar] = useState<AiSavol[] | null>(null);
  const [matnlar, setMatnlar] = useState<AiMatn[]>([]);
  const [faolQil, setFaolQil] = useState(false);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  const ajrat = async () => {
    if (!fan.trim()) return showNotification('Fanni kiriting', 'error');
    if (!fayllar.length && !matn.trim()) return showNotification('Fayl tanlang yoki matnni joylang', 'error');
    const yigSavol: AiSavol[] = [];
    const yigMatn: AiMatn[] = [];
    try {
      let rasmlar: string[] = [];
      if (fayllar.length) {
        setHolat('Sahifalar tayyorlanmoqda…');
        rasmlar = await sahifaRasmlari(fayllar, n => setHolat(`Sahifalar tayyorlanmoqda: ${n}`));
      }
      const partiyalar: string[][] = rasmlar.length ? Array.from({ length: Math.ceil(rasmlar.length / PARTIYA) }, (_, i) => rasmlar.slice(i * PARTIYA, (i + 1) * PARTIYA)) : [[]];
      for (let i = 0; i < partiyalar.length; i++) {
        setHolat(partiyalar.length > 1 ? `AI o'qimoqda: ${i + 1} / ${partiyalar.length} qism…` : "AI o'qimoqda…");
        const r = await soro<{ savollar: AiSavol[]; matnlar: AiMatn[] }>('POST', 'questions/ai/import', { fan, mavzu, til, rasmlar: partiyalar[i], matn: i === 0 ? matn : '' });
        // Qismlardagi matn id lari to'qnashmasin.
        yigMatn.push(...r.matnlar.map(m => ({ ...m, id: `p${i}-${m.id}` })));
        yigSavol.push(...r.savollar.map(q => ({ ...q, matnId: q.matnId ? `p${i}-${q.matnId}` : null, tanlangan: !q.xato })));
        setSavollar([...yigSavol]);
        setMatnlar([...yigMatn]);
      }
      if (!yigSavol.length) showNotification('AI bu materialdan savol topmadi', 'error');
    } catch (e: any) {
      showNotification(e.message, 'error');
      if (yigSavol.length) showNotification(`${yigSavol.length} ta savol olindi, qolgan qism o'qilmadi`, 'info');
    } finally {
      setHolat(null);
    }
  };

  const ozgartir = (i: number, d: Partial<AiSavol>) => setSavollar(l => (l || []).map((q, j) => (j === i ? { ...q, ...d } : q)));
  const tayyormi = (q: AiSavol) => !savolXatosi(q as any);

  const saqla = async () => {
    const tanlangan = (savollar || []).filter(q => q.tanlangan);
    if (!tanlangan.length) return;
    setSaqlanmoqda(true);
    try {
      // Umumiy matnlar avval — savollar ularga bog'lanadi.
      const matnIdlari = new Map<string, number>();
      for (const m of matnlar.filter(m => tanlangan.some(q => q.matnId === m.id))) {
        const p = await soro<{ id: number }>('POST', 'passages', { subject: fan, title: m.sarlavha || null, text: m.matn, schoolId: filial });
        matnIdlari.set(m.id, p.id);
      }
      const questions = tanlangan.map((q, i) => {
        const { xato, tanlangan: _t, matnId, ...d } = q; // eslint-disable-line @typescript-eslint/no-unused-vars
        return {
          ...d, subject: fan.trim(), topic: (d.topic || mavzu).trim() || 'Aralash',
          passageId: matnId ? matnIdlari.get(matnId) ?? null : null,
          status: faolQil && tayyormi(q) ? 'faol' : 'qoralama', qator: i + 1,
        };
      });
      const r = await soro<{ count: number; xatolar: { qator: number; xato: string }[] }>('POST', 'questions/bulk', { questions, schoolId: filial });
      showNotification(`${r.count} ta savol bankka qo'shildi${r.xatolar.length ? `, ${r.xatolar.length} tasi qo'shilmadi (${r.xatolar[0].xato})` : ''}`, r.xatolar.length ? 'info' : 'success');
      onSaqlandi();
      onYop();
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setSaqlanmoqda(false);
    }
  };

  const tanlanganSoni = (savollar || []).filter(q => q.tanlangan).length;
  const matnNomi = (id: string | null) => { const m = matnlar.find(x => x.id === id); return m ? m.sarlavha || 'Umumiy matn' : null; };

  return (
    <div className="fixed inset-0 z-[260] flex items-start justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-black/50" onClick={() => !holat && !saqlanmoqda && onYop()} />
      <div className="relative bg-sirt rounded-2xl shadow-2xl w-full max-w-4xl border border-chiziq my-4">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-chiziq">
          <div>
            <h3 className="text-[14px] font-bold text-matn flex items-center gap-1.5"><Sparkles size={15} className="text-brand" /> AI bilan import</h3>
            <p className="text-[12px] text-matn-xira">PDF, rasm yoki matndan savollar. Bankka qo'shishdan oldin tekshiring — AI xato qilishi mumkin.</p>
          </div>
          <button aria-label="Yopish" disabled={!!holat || saqlanmoqda} onClick={onYop} className="p-2 rounded-lg hover:bg-ichki cursor-pointer disabled:opacity-40"><X size={16} /></button>
        </div>

        {!savollar ? (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Maydon nom="Fan">
                <input className={INPUT} list="ai-fanlar" value={fan} onChange={e => setFan(e.target.value)} placeholder="Matematika" />
                <datalist id="ai-fanlar">{fanlar.map(f => <option key={f} value={f} />)}</datalist>
              </Maydon>
              <Maydon nom="Mavzu" izoh="AI aniqlamaganlarga qo'yiladi">
                <input className={INPUT} value={mavzu} onChange={e => setMavzu(e.target.value)} placeholder="Ixtiyoriy" />
              </Maydon>
              <Maydon nom="Savollar tili">
                <select className={SELECT} value={til} onChange={e => setTil(e.target.value as any)}>
                  <option value="uz">O'zbekcha</option><option value="ru">Ruscha</option><option value="en">Inglizcha</option>
                </select>
              </Maydon>
            </div>
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-chiziq-kuchli bg-ichki px-4 py-8 text-center cursor-pointer hover:border-brand">
              <FileUp size={22} className="text-matn-xira" />
              <span className="text-[13px] font-semibold text-matn">{fayllar.length ? fayllar.map(f => f.name).join(', ') : 'PDF yoki rasmlarni tanlang'}</span>
              <span className="text-[11.5px] text-matn-xira">Formulalar ham o'qiladi. Word faylni avval PDF qilib saqlang. {MAKS_SAHIFA} sahifagacha.</span>
              <input type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={e => setFayllar([...(e.target.files || [])])} />
            </label>
            <Maydon nom="Yoki matnni joylang">
              <textarea rows={5} className={INPUT} value={matn} onChange={e => setMatn(e.target.value)} placeholder="1. Savol matni... A) ... B) ... C) ... D) ..." />
            </Maydon>
            <div className="flex items-center justify-end gap-2">
              {holat && <span className="text-[12.5px] text-matn-sokin">{holat}</span>}
              <Tugma turi="asosiy" ikonka={<Sparkles size={14} />} yuklanmoqda={!!holat} onClick={ajrat}>Savollarni ajratish</Tugma>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-matn">
                <b>{savollar.length}</b> ta savol topildi{matnlar.length ? `, ${matnlar.length} ta umumiy matn` : ''} ·
                <span className="text-xato"> {savollar.filter(q => q.xato).length} tasida kamchilik</span>
              </p>
              <div className="flex gap-2">
                <Tugma kichik turi="oddiy" onClick={() => setSavollar(l => (l || []).map(q => ({ ...q, tanlangan: true })))}>Hammasini tanlash</Tugma>
                <Tugma kichik turi="oddiy" onClick={() => { setSavollar(null); setMatnlar([]); }}>Boshqa fayl</Tugma>
              </div>
            </div>
            <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
              {savollar.map((q, i) => {
                const togri = HARFLAR.indexOf(q.correctAnswer);
                const kamchilik = q.xato || savolXatosi(q as any);
                return (
                  <div key={i} className={`rounded-xl border p-3 ${q.tanlangan ? 'border-brand/40 bg-sirt' : 'border-chiziq bg-ichki opacity-75'}`}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" aria-label={`${i + 1}-savolni tanlash`} className="mt-1 w-4 h-4 accent-[var(--color-brand)] cursor-pointer" checked={!!q.tanlangan} onChange={e => ozgartir(i, { tanlangan: e.target.checked })} />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <b className="text-[12.5px] text-matn">{i + 1}.</b>
                          <Yorliq>{SAVOL_TURI_NOMI[q.type]}</Yorliq>
                          {q.topic && <Yorliq>{q.topic}</Yorliq>}
                          {matnNomi(q.matnId) && <Yorliq rang="brand"><FileText size={11} /> {matnNomi(q.matnId)}</Yorliq>}
                          {kamchilik && <Yorliq rang="ogoh"><AlertTriangle size={11} /> {kamchilik}</Yorliq>}
                        </div>
                        <div className={`${SAVOL_MATNI} text-[13.5px] text-matn`} dangerouslySetInnerHTML={{ __html: formulaliHtml(q.text) }} />
                        {q.type === 'yopiq' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {(q.options || []).map((o, k) => (
                              <button key={k} type="button" onClick={() => ozgartir(i, { correctAnswer: HARFLAR[k] })} title="To'g'ri javob qilish"
                                className={`flex gap-2 rounded-lg border px-3 py-1.5 text-left text-[13px] cursor-pointer ${k === togri ? 'border-yaxshi/50 bg-yaxshi-fon' : 'border-chiziq bg-sirt hover:border-brand/40'}`}>
                                <b>{HARFLAR[k]})</b><span className="text-matn" dangerouslySetInnerHTML={{ __html: formulaliHtml(o) }} />
                              </button>
                            ))}
                          </div>
                        )}
                        {q.type === 'raqamli' && (
                          <label className="flex items-center gap-2 text-[12.5px] text-matn-sokin">Javob:
                            <input className={`${INPUT} w-32 py-1.5`} value={q.correctAnswer} onChange={e => ozgartir(i, { correctAnswer: e.target.value })} />
                          </label>
                        )}
                      </div>
                      <button aria-label="Olib tashlash" onClick={() => setSavollar(l => (l || []).filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-chiziq">
              <div className="max-w-md">
                <Almashtirgich yoqilgan={faolQil} onChange={setFaolQil} nom="Kamchiligi yo'qlarini darhol faol qilish"
                  izoh="O'chiq bo'lsa hammasi qoralama bo'lib qo'shiladi — bankda ko'rib, faol qilasiz" />
              </div>
              <Tugma turi="asosiy" yuklanmoqda={saqlanmoqda} disabled={!tanlanganSoni} onClick={saqla}>{tanlanganSoni} ta savolni bankka qo'shish</Tugma>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
