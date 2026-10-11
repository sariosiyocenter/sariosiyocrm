import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Save, Wand2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, SELECT } from '../ui';
import { QIYINLIK } from './qiyinlik';
import { andozaQoidali } from './andoza';
import { TUR_NOMI } from '../../../lib/savolTuri';
import type { Andoza, AndozaQatori, BankDaraxt, BankFiltrMalumoti, SavolTuri } from '../../../types';

// «Qoidalar bo'yicha avtomatik to'ldirish» — andozaning ikkinchi darajali yo'li (Addmen
// "Blueprint" qatorlari): har qoida — filtr (bo'lim, mavzu, qiyinlik, manba, fan filtrlari,
// tur) va nechta savol. «To'ldirish» andozaning bo'sh o'rinlariga mos savollarni bankdan
// tanlab qo'yadi. Eski andozalar shu qoidalarning o'zidan iborat (savollar tasodifiy olinadi).

const YANGI_QATOR: AndozaQatori = { bolim: null, mavzuId: null, qiyinlik: 0, manba: null, tagIds: [], tur: 'yopiq', soni: 5 };
const KICHIK = 'w-full min-w-0 px-2 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12px] text-matn outline-none focus:border-brand cursor-pointer';

type Hisob = { bor: number; boshQolgan: number; yetadi: boolean };

export default function AndozaQoidalari({ a, daraxt, tahrir, band, onToldir, onSaqla }: {
  a: Andoza; daraxt: BankDaraxt; tahrir: boolean; band: boolean;
  onToldir: (rows: AndozaQatori[], subjectId: number) => void; onSaqla: (rows: AndozaQatori[], subjectId: number) => Promise<void>;
}) {
  const { soro } = useImtihonApi();
  const qoidali = andozaQoidali(a);
  const [ochiq, setOchiq] = useState(qoidali);
  const [fanId, setFanId] = useState<number | null>(a.subjectId ?? a.fanId ?? daraxt.fanlar[0]?.id ?? null);
  const [rows, setRows] = useState<AndozaQatori[]>(a.rows.length ? a.rows : [{ ...YANGI_QATOR }]);
  const [ozgargan, setOzgargan] = useState(false);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [filtr, setFiltr] = useState<BankFiltrMalumoti | null>(null);
  const [hisob, setHisob] = useState<Hisob[] | null>(null);
  const [hisoblanmoqda, setHisoblanmoqda] = useState(false);

  // Saqlangach yoki to'ldirilgach — serverdagi qoidalar.
  const serverKalit = JSON.stringify(a.rows);
  useEffect(() => {
    setRows(a.rows.length ? a.rows : [{ ...YANGI_QATOR }]);
    setOzgargan(false);
    if (a.subjectId) setFanId(a.subjectId);
  }, [serverKalit, a.subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFiltr(null);
    if (!ochiq || !fanId) return;
    soro<BankFiltrMalumoti>('GET', `bank/filtr?fanId=${fanId}`).then(setFiltr).catch(() => setFiltr(null));
  }, [ochiq, fanId, soro]);

  // Har qoidaga bankda nechta mos savol bor — o'zgartirgach biroz kutib.
  const kalit = JSON.stringify(rows);
  useEffect(() => {
    if (!ochiq || !fanId || !rows.length) { setHisob(null); return; }
    setHisoblanmoqda(true);
    // Qoidalar yana o'zgarsa — yo'ldagi eski javob tashlanadi.
    let eskirdi = false;
    const t = setTimeout(() => {
      soro<{ qatorlar: Hisob[] }>('POST', 'bank/andozalar/hisob', { subjectId: fanId, rows })
        .then(r => { if (!eskirdi) setHisob(r.qatorlar); }).catch(() => { if (!eskirdi) setHisob(null); }).finally(() => { if (!eskirdi) setHisoblanmoqda(false); });
    }, 400);
    return () => { eskirdi = true; clearTimeout(t); };
  }, [ochiq, kalit, fanId, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  const ozgartir = (yangi: AndozaQatori[]) => { setRows(yangi); setOzgargan(true); };
  const qator = (i: number, p: Partial<AndozaQatori>) => ozgartir(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const fanAlmash = (id: number | null) => { setFanId(id); ozgartir(rows.map(r => ({ ...r, bolim: null, mavzuId: null, manba: null, tagIds: [] }))); };
  const jami = rows.reduce((s, r) => s + (r.soni || 0), 0);
  const yetmaydi = hisob?.some((h, i) => rows[i]?.soni > 0 && !h.yetadi);
  const bolimlar = useMemo(() => [...new Set((filtr?.mavzular || []).map(m => m.bolim).filter(Boolean))], [filtr]);
  const guruhlar = filtr?.guruhlar || [];
  const boshOrin = Math.max(0, (qoidali ? jami : a.soni) - a.savolSoni);
  const toza = rows.filter(r => r.soni > 0);

  const saqla = async () => {
    if (!fanId) return;
    setSaqlanmoqda(true);
    try { await onSaqla(toza, fanId); } finally { setSaqlanmoqda(false); }
  };

  return (
    <div className="border-t border-chiziq">
      <button type="button" onClick={() => setOchiq(x => !x)} aria-expanded={ochiq}
        className="w-full flex items-center gap-2 px-4 py-3 text-left cursor-pointer hover:bg-ichki/60">
        {ochiq ? <ChevronDown size={15} className="text-matn-xira" /> : <ChevronRight size={15} className="text-matn-xira" />}
        <span className="min-w-0">
          <span className="block text-[12.5px] font-semibold text-matn">Qoidalar bo'yicha avtomatik to'ldirish</span>
          <span className="block text-[11.5px] text-matn-xira">Ixtiyoriy: bo'lim, mavzu, qiyinlik bo'yicha nechta savol kerakligini yozing — bo'sh o'rinlarni bank o'zi to'ldiradi</span>
        </span>
      </button>

      {ochiq && (
        <div className="pb-3">
          <div className="px-4 pb-3">
            <label className="block max-w-xs">
              <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Fan</span>
              <select className={SELECT} disabled={!tahrir} value={fanId ?? ''} onChange={e => fanAlmash(Number(e.target.value) || null)}>
                <option value="">Fanni tanlang</option>
                {daraxt.fanlar.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
          </div>

          <div className="overflow-x-auto border-y border-chiziq">
            <table className="w-full text-[12px] min-w-[860px]">
              <thead className="bg-ichki text-matn-sokin text-[11.5px]">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold w-8">№</th>
                  <th className="px-1.5 py-2 text-left font-semibold">Bo'lim</th>
                  <th className="px-1.5 py-2 text-left font-semibold">Mavzu</th>
                  <th className="px-1.5 py-2 text-left font-semibold w-24">Qiyinlik</th>
                  <th className="px-1.5 py-2 text-left font-semibold">Manba</th>
                  {guruhlar.map(g => <th key={g.id} className="px-1.5 py-2 text-left font-semibold">{g.name}</th>)}
                  <th className="px-1.5 py-2 text-left font-semibold w-28">Tur</th>
                  <th className="px-1.5 py-2 text-center font-semibold w-16">Soni</th>
                  <th className="px-1.5 py-2 text-center font-semibold w-20">Bankda</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-chiziq">
                {rows.map((r, i) => {
                  const h = hisob?.[i];
                  const mavzular = (filtr?.mavzular || []).filter(m => !r.bolim || m.bolim === r.bolim);
                  return (
                    <tr key={i}>
                      <td className="px-2 py-1.5 text-matn-xira raqam">{i + 1}</td>
                      <td className="px-1.5 py-1.5">
                        <select className={KICHIK} disabled={!tahrir} value={r.bolim ?? ''} aria-label={`${i + 1}-qoida bo'limi`}
                          onChange={e => qator(i, { bolim: e.target.value || null, mavzuId: null })}>
                          <option value="">Hammasi</option>
                          {bolimlar.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <select className={KICHIK} disabled={!tahrir} value={r.mavzuId ?? ''} aria-label={`${i + 1}-qoida mavzusi`}
                          onChange={e => qator(i, { mavzuId: Number(e.target.value) || null })}>
                          <option value="">Hammasi</option>
                          {mavzular.map(m => <option key={m.id} value={m.id}>{m.nom} ({m.soni})</option>)}
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <select className={KICHIK} disabled={!tahrir} value={r.qiyinlik} aria-label={`${i + 1}-qoida qiyinligi`} onChange={e => qator(i, { qiyinlik: Number(e.target.value) })}>
                          <option value={0}>Aralash</option>
                          {QIYINLIK.filter(q => !q.yashirin || r.qiyinlik === q.d).map(q => <option key={q.d} value={q.d}>{q.nom}</option>)}
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <select className={KICHIK} disabled={!tahrir} value={r.manba ?? ''} aria-label={`${i + 1}-qoida manbasi`} onChange={e => qator(i, { manba: e.target.value || null })}>
                          <option value="">Hammasi</option>
                          {(filtr?.manbalar || []).filter(m => m.nom).map(m => <option key={m.nom} value={m.nom}>{m.nom}</option>)}
                        </select>
                      </td>
                      {guruhlar.map(g => {
                        const joriy = r.tagIds.find(id => g.tags.some(t => t.id === id)) ?? '';
                        return (
                          <td key={g.id} className="px-1.5 py-1.5">
                            <select className={KICHIK} disabled={!tahrir} value={joriy} aria-label={`${i + 1}-qoida: ${g.name}`}
                              onChange={e => qator(i, { tagIds: [...r.tagIds.filter(id => !g.tags.some(t => t.id === id)), ...(Number(e.target.value) ? [Number(e.target.value)] : [])] })}>
                              <option value="">Hammasi</option>
                              {g.tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </td>
                        );
                      })}
                      <td className="px-1.5 py-1.5">
                        {/* Guruhli savollar butunligicha olinadi; MS-36-45 da son — savollar soni (har biri a, b). */}
                        <select className={KICHIK} disabled={!tahrir} value={r.tur} aria-label={`${i + 1}-qoida turi`} onChange={e => qator(i, { tur: e.target.value as SavolTuri })}>
                          {(Object.keys(TUR_NOMI) as SavolTuri[]).map(t => <option key={t} value={t}>{TUR_NOMI[t]}</option>)}
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5 text-center">
                        <input aria-label={`${i + 1}-qoida: savollar soni`} inputMode="numeric" disabled={!tahrir}
                          className={`w-14 rounded-lg border px-1 py-1.5 text-center text-[12.5px] font-bold raqam outline-none focus:border-brand ${h && r.soni > 0 && !h.yetadi ? 'border-xato bg-xato-fon text-xato' : 'border-chiziq bg-ichki text-matn'}`}
                          value={r.soni || ''} placeholder="0" onChange={e => qator(i, { soni: Math.min(300, parseInt(e.target.value.replace(/\D/g, '')) || 0) })} />
                      </td>
                      <td className={`px-1.5 py-1.5 text-center raqam ${h && r.soni > 0 && !h.yetadi ? 'text-xato font-bold' : 'text-matn-sokin'}`}
                        title={h && h.boshQolgan !== h.bor ? `Mos: ${h.bor}, oldingi qoidalar olgandan keyin: ${h.boshQolgan}` : undefined}>
                        {h ? h.boshQolgan : '…'}
                      </td>
                      <td className="pr-2 py-1.5">
                        {tahrir && <button aria-label={`${i + 1}-qoidani o'chirish`} onClick={() => ozgartir(rows.filter((_, j) => j !== i))} className="p-1 rounded text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={13} /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-ichki">
                <tr>
                  <td colSpan={5 + guruhlar.length} className="px-2 py-2">
                    {tahrir && <Tugma kichik ikonka={<Plus size={13} />} disabled={!fanId} onClick={() => ozgartir([...rows, { ...(rows[rows.length - 1] || YANGI_QATOR), tagIds: [...(rows[rows.length - 1]?.tagIds || [])] }])}>Qoida qo'shish</Tugma>}
                  </td>
                  <td className="px-1.5 py-2 text-right font-semibold text-matn-sokin">Jami</td>
                  <td className="px-1.5 py-2 text-center font-bold text-matn raqam">{jami}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
            <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${hisoblanmoqda ? 'text-matn-xira' : yetmaydi ? 'text-xato' : 'text-yaxshi'}`}>
              {!fanId ? <span className="text-matn-xira font-normal">Fanni tanlang</span>
                : hisoblanmoqda ? <><Loader2 size={13} className="animate-spin" /> Bank tekshirilmoqda</>
                : yetmaydi ? <><AlertTriangle size={13} /> Ba'zi qoidalarga bankda savol yetmaydi (qizil) — borini oladi</>
                : <><CheckCircle2 size={13} /> Bankda yetadi · faqat faol savollar sanaladi</>}
            </span>
            {tahrir && (
              <div className="flex flex-wrap items-center gap-2">
                {(ozgargan || saqlanmoqda) && <Tugma kichik ikonka={<Save size={13} />} yuklanmoqda={saqlanmoqda} disabled={!fanId || band} onClick={saqla}>Qoidalarni saqlash</Tugma>}
                <Tugma kichik turi="ikkinchi" ikonka={<Wand2 size={13} />} yuklanmoqda={band} disabled={!fanId || !toza.length || !boshOrin || saqlanmoqda}
                  title={!boshOrin ? "Andozada bo'sh o'rin yo'q — savollar sonini oshiring" : undefined} onClick={() => fanId && onToldir(toza, fanId)}>
                  Bo'sh o'rinlarni to'ldirish{boshOrin ? ` (${boshOrin})` : ''}
                </Tugma>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
