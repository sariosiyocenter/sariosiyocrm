import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Copy, Save, LayoutList, AlertTriangle, CheckCircle2, Loader2, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../../../context/CRMContext';
import { useConfirm } from '../../ConfirmDialog';
import { useImtihonApi } from '../useImtihonApi';
import { Tugma, INPUT, Yuklanmoqda, BoshHolat } from '../ui';
import { QIYINLIK } from './qiyinlik';
import AndozadanQogoz from '../AndozadanQogoz';
import type { Andoza, AndozaQatori, BankDaraxt, BankFiltrMalumoti, SavolTuri } from '../../../types';

// Andoza — Addmen "BLUE PRINT": qayta ishlatiladigan imtihon tuzilmasi. Har qator
// — filtr (bo'lim, mavzu, qiyinlik, manba, foydalanuvchi filtrlari, tur) va nechta
// savol. Imtihon tuzishda fan blokiga "Andozadan" tanlanadi — qatorlar qoida bo'ladi.

const TUR_NOMI: Record<SavolTuri, string> = { yopiq: 'Variantli', raqamli: 'Raqamli', moslash: 'Moslashtirish', yozma: 'Yozma' };
const YANGI_QATOR: AndozaQatori = { bolim: null, mavzuId: null, qiyinlik: 0, manba: null, tagIds: [], tur: 'yopiq', soni: 5 };
const KICHIK = 'w-full min-w-0 px-2 py-1.5 bg-ichki border border-chiziq rounded-lg text-[12px] text-matn outline-none focus:border-brand cursor-pointer';

type Hisob = { bor: number; boshQolgan: number; yetadi: boolean };

export default function Andozalar({ daraxt }: { daraxt: BankDaraxt }) {
  const { ozgartira, showNotification } = useCRM();
  const tahrir = ozgartira('imtihonlar.savollar') || ozgartira('imtihonlar.imtihon');
  const qogozYaratadi = ozgartira('imtihonlar.imtihon');
  const navigate = useNavigate();
  const [qogozOyna, setQogozOyna] = useState<number | null>(null);
  const { soro } = useImtihonApi();
  const confirm = useConfirm();
  const [royxat, setRoyxat] = useState<Andoza[] | null>(null);
  const [tanlangan, setTanlangan] = useState<number | 'yangi' | null>(null);
  const [qoralama, setQoralama] = useState<Andoza | null>(null);
  const [ozgargan, setOzgargan] = useState(false);
  const [band, setBand] = useState(false);

  const yukla = useCallback(async () => {
    try {
      const r = await soro<Andoza[]>('GET', 'bank/andozalar');
      setRoyxat(r);
      return r;
    } catch (e: any) { showNotification(e.message, 'error'); return null; }
  }, [soro]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { yukla(); }, [yukla]);

  // Birinchi andoza o'zi ochiladi.
  useEffect(() => {
    if (tanlangan === null && royxat?.length) och(royxat[0]);
  }, [royxat]); // eslint-disable-line react-hooks/exhaustive-deps

  const och = async (a: Andoza | 'yangi') => {
    if (ozgargan && !(await confirm({ message: "Saqlanmagan o'zgarishlar bor — tashlab ketilsinmi?", danger: false }))) return;
    if (a === 'yangi') {
      setTanlangan('yangi');
      setQoralama({ id: 0, name: '', subjectId: daraxt.fanlar[0]?.id ?? null, rows: [{ ...YANGI_QATOR }] });
    } else {
      setTanlangan(a.id);
      setQoralama(JSON.parse(JSON.stringify(a)));
    }
    setOzgargan(false);
  };

  const ozgartir = (patch: Partial<Andoza>) => { setQoralama(q => (q ? { ...q, ...patch } : q)); setOzgargan(true); };

  const saqla = async () => {
    if (!qoralama) return;
    if (!qoralama.name.trim()) return showNotification('Andoza nomini kiriting', 'error');
    if (!qoralama.subjectId) return showNotification('Fanni tanlang', 'error');
    setBand(true);
    try {
      const body = { name: qoralama.name, subjectId: qoralama.subjectId, rows: qoralama.rows.filter(r => r.soni > 0) };
      const a = qoralama.id
        ? await soro<Andoza>('PUT', `bank/andozalar/${qoralama.id}`, body)
        : await soro<Andoza>('POST', 'bank/andozalar', body);
      setOzgargan(false);
      const r = await yukla();
      const yangi = r?.find(x => x.id === a.id);
      if (yangi) { setTanlangan(yangi.id); setQoralama(JSON.parse(JSON.stringify(yangi))); }
      showNotification('Andoza saqlandi', 'success');
    } catch (e: any) { showNotification(e.message, 'error'); } finally { setBand(false); }
  };

  const nusxa = () => {
    if (!qoralama) return;
    setTanlangan('yangi');
    setQoralama({ ...JSON.parse(JSON.stringify(qoralama)), id: 0, name: `${qoralama.name} (nusxa)` });
    setOzgargan(true);
  };

  const ochir = async () => {
    if (!qoralama?.id || !(await confirm(`«${qoralama.name}» andozasi o'chirilsinmi? Undan tuzilgan imtihonlar o'zgarmaydi.`))) return;
    try {
      await soro('DELETE', `bank/andozalar/${qoralama.id}`);
      setOzgargan(false);
      setTanlangan(null);
      setQoralama(null);
      const r = await yukla();
      if (r?.length) { setTanlangan(r[0].id); setQoralama(JSON.parse(JSON.stringify(r[0]))); }
      showNotification("Andoza o'chirildi", 'info');
    } catch (e: any) { showNotification(e.message, 'error'); }
  };

  if (!royxat) return <Yuklanmoqda />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-3 items-start">
      <aside className="bg-sirt border border-chiziq rounded-xl overflow-hidden" aria-label="Andozalar">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-chiziq">
          <h3 className="text-[12.5px] font-bold text-matn">Andozalar <span className="font-semibold text-matn-xira raqam">{royxat.length}</span></h3>
          {tahrir && <Tugma kichik turi="asosiy" ikonka={<Plus size={13} />} onClick={() => och('yangi')}>Yangi</Tugma>}
        </div>
        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-chiziq">
          {!royxat.length && <li className="px-3 py-4 text-[12px] text-matn-xira">Hali andoza yo'q</li>}
          {royxat.map(a => {
            const fan = daraxt.fanlar.find(f => f.id === a.subjectId);
            const soni = a.rows.reduce((s, r) => s + r.soni, 0);
            return (
              <li key={a.id}>
                <button onClick={() => och(a)} className={`w-full text-left px-3 py-2 cursor-pointer ${tanlangan === a.id ? 'bg-brand-fon dark:bg-brand/15' : 'hover:bg-ichki'}`}>
                  <span className="block text-[12.5px] font-semibold text-matn truncate"><span className="text-matn-xira raqam">{a.id}-</span>{a.name}</span>
                  <span className="block text-[11.5px] text-matn-xira">{fan?.name || '—'} · {a.rows.length} qator · {soni} savol</span>
                </button>
              </li>
            );
          })}
          {tanlangan === 'yangi' && <li className="px-3 py-2 bg-brand-fon dark:bg-brand/15 text-[12.5px] font-semibold text-matn">Yangi andoza…</li>}
        </ul>
      </aside>

      {!qoralama ? (
        <div className="bg-sirt border border-chiziq rounded-xl">
          <BoshHolat ikonka={<LayoutList size={20} />} sarlavha="Andoza — imtihonning qayta ishlatiladigan tuzilmasi"
            izoh="Masalan «Geometriya 30 talik»: har qatorda bo'lim, mavzu, qiyinlik, manba va nechta savol. Imtihon tuzishda bitta tugma bilan fan blokiga qo'yiladi.">
            {tahrir && <Tugma turi="asosiy" ikonka={<Plus size={14} />} onClick={() => och('yangi')}>Andoza yaratish</Tugma>}
          </BoshHolat>
        </div>
      ) : (
        <AndozaMuharriri a={qoralama} daraxt={daraxt} tahrir={tahrir} ozgargan={ozgargan} band={band}
          onChange={ozgartir} onSaqla={saqla} onNusxa={nusxa} onOchir={qoralama.id ? ochir : undefined}
          onQogoz={qogozYaratadi && qoralama.id ? () => setQogozOyna(qoralama.id) : undefined} />
      )}
      {qogozOyna && (
        <AndozadanQogoz boshAndozaId={qogozOyna} onYop={() => setQogozOyna(null)}
          onTayyor={(id, qulflandi) => { setQogozOyna(null); navigate(qulflandi ? `/exams?tab=chop&imtihon=${id}` : `/exams?imtihon=${id}`); }} />
      )}
    </div>
  );
}

function AndozaMuharriri({ a, daraxt, tahrir, ozgargan, band, onChange, onSaqla, onNusxa, onOchir, onQogoz }: {
  a: Andoza; daraxt: BankDaraxt; tahrir: boolean; ozgargan: boolean; band: boolean; onQogoz?: () => void;
  onChange: (p: Partial<Andoza>) => void; onSaqla: () => void; onNusxa: () => void; onOchir?: () => void;
}) {
  const { soro } = useImtihonApi();
  const [filtr, setFiltr] = useState<BankFiltrMalumoti | null>(null);
  const [hisob, setHisob] = useState<Hisob[] | null>(null);
  const [hisoblanmoqda, setHisoblanmoqda] = useState(false);

  useEffect(() => {
    setFiltr(null);
    if (!a.subjectId) return;
    soro<BankFiltrMalumoti>('GET', `bank/filtr?fanId=${a.subjectId}`).then(setFiltr).catch(() => setFiltr(null));
  }, [a.subjectId, soro]);

  // Har qatorga bankda nechta mos savol bor — o'zgartirgach biroz kutib.
  const kalit = JSON.stringify(a.rows);
  useEffect(() => {
    if (!a.subjectId || !a.rows.length) { setHisob(null); return; }
    setHisoblanmoqda(true);
    const t = setTimeout(() => {
      soro<{ qatorlar: Hisob[] }>('POST', 'bank/andozalar/hisob', { subjectId: a.subjectId, rows: a.rows })
        .then(r => setHisob(r.qatorlar)).catch(() => setHisob(null)).finally(() => setHisoblanmoqda(false));
    }, 400);
    return () => clearTimeout(t);
  }, [kalit, a.subjectId, soro]); // eslint-disable-line react-hooks/exhaustive-deps

  const qator = (i: number, p: Partial<AndozaQatori>) => onChange({ rows: a.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  const jami = a.rows.reduce((s, r) => s + (r.soni || 0), 0);
  const yetmaydi = hisob?.some((h, i) => a.rows[i]?.soni > 0 && !h.yetadi);
  const bolimlar = useMemo(() => [...new Set((filtr?.mavzular || []).map(m => m.bolim).filter(Boolean))], [filtr]);
  const guruhlar = filtr?.guruhlar || [];

  return (
    <section className="bg-sirt border border-chiziq rounded-xl min-w-0" aria-label="Andoza">
      <div className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-chiziq">
        <label className="flex-1 min-w-56">
          <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Andoza nomi</span>
          <input className={INPUT} disabled={!tahrir} value={a.name} placeholder="Geometriya — 30 talik" onChange={e => onChange({ name: e.target.value })} />
        </label>
        <label className="w-56">
          <span className="block text-[12px] font-semibold text-matn-sokin mb-1.5">Fan</span>
          <select className={`${INPUT} cursor-pointer`} disabled={!tahrir} value={a.subjectId ?? ''}
            onChange={e => onChange({ subjectId: Number(e.target.value) || null, rows: a.rows.map(r => ({ ...r, bolim: null, mavzuId: null, manba: null, tagIds: [] })) })}>
            <option value="">Fanni tanlang</option>
            {daraxt.fanlar.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
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
            {a.rows.map((r, i) => {
              const h = hisob?.[i];
              const mavzular = (filtr?.mavzular || []).filter(m => !r.bolim || m.bolim === r.bolim);
              return (
                <tr key={i}>
                  <td className="px-2 py-1.5 text-matn-xira raqam">{i + 1}</td>
                  <td className="px-1.5 py-1.5">
                    <select className={KICHIK} disabled={!tahrir} value={r.bolim ?? ''} aria-label={`${i + 1}-qator bo'limi`}
                      onChange={e => qator(i, { bolim: e.target.value || null, mavzuId: null })}>
                      <option value="">Hammasi</option>
                      {bolimlar.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <select className={KICHIK} disabled={!tahrir} value={r.mavzuId ?? ''} aria-label={`${i + 1}-qator mavzusi`}
                      onChange={e => qator(i, { mavzuId: Number(e.target.value) || null })}>
                      <option value="">Hammasi</option>
                      {mavzular.map(m => <option key={m.id} value={m.id}>{m.nom} ({m.soni})</option>)}
                    </select>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <select className={KICHIK} disabled={!tahrir} value={r.qiyinlik} aria-label={`${i + 1}-qator qiyinligi`} onChange={e => qator(i, { qiyinlik: Number(e.target.value) })}>
                      <option value={0}>Aralash</option>
                      {QIYINLIK.map(q => <option key={q.d} value={q.d}>{q.nom}</option>)}
                    </select>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <select className={KICHIK} disabled={!tahrir} value={r.manba ?? ''} aria-label={`${i + 1}-qator manbasi`} onChange={e => qator(i, { manba: e.target.value || null })}>
                      <option value="">Hammasi</option>
                      {(filtr?.manbalar || []).filter(m => m.nom).map(m => <option key={m.nom} value={m.nom}>{m.nom}</option>)}
                    </select>
                  </td>
                  {guruhlar.map(g => {
                    const joriy = r.tagIds.find(id => g.tags.some(t => t.id === id)) ?? '';
                    return (
                      <td key={g.id} className="px-1.5 py-1.5">
                        <select className={KICHIK} disabled={!tahrir} value={joriy} aria-label={`${i + 1}-qator: ${g.name}`}
                          onChange={e => qator(i, { tagIds: [...r.tagIds.filter(id => !g.tags.some(t => t.id === id)), ...(Number(e.target.value) ? [Number(e.target.value)] : [])] })}>
                          <option value="">Hammasi</option>
                          {g.tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </td>
                    );
                  })}
                  <td className="px-1.5 py-1.5">
                    <select className={KICHIK} disabled={!tahrir} value={r.tur} aria-label={`${i + 1}-qator turi`} onChange={e => qator(i, { tur: e.target.value as SavolTuri })}>
                      {(Object.keys(TUR_NOMI) as SavolTuri[]).map(t => <option key={t} value={t}>{TUR_NOMI[t]}</option>)}
                    </select>
                  </td>
                  <td className="px-1.5 py-1.5 text-center">
                    <input aria-label={`${i + 1}-qator: savollar soni`} inputMode="numeric" disabled={!tahrir}
                      className={`w-14 rounded-lg border px-1 py-1.5 text-center text-[12.5px] font-bold raqam outline-none focus:border-brand ${h && r.soni > 0 && !h.yetadi ? 'border-xato bg-xato-fon text-xato' : 'border-chiziq bg-ichki text-matn'}`}
                      value={r.soni || ''} placeholder="0" onChange={e => qator(i, { soni: Math.min(300, parseInt(e.target.value.replace(/\D/g, '')) || 0) })} />
                  </td>
                  <td className={`px-1.5 py-1.5 text-center raqam ${h && r.soni > 0 && !h.yetadi ? 'text-xato font-bold' : 'text-matn-sokin'}`}
                    title={h && h.boshQolgan !== h.bor ? `Mos: ${h.bor}, oldingi qatorlar olgandan keyin: ${h.boshQolgan}` : undefined}>
                    {h ? h.boshQolgan : '…'}
                  </td>
                  <td className="pr-2 py-1.5">
                    {tahrir && <button aria-label={`${i + 1}-qatorni o'chirish`} onClick={() => onChange({ rows: a.rows.filter((_, j) => j !== i) })} className="p-1 rounded text-matn-xira hover:text-xato cursor-pointer"><Trash2 size={13} /></button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-ichki">
            <tr>
              <td colSpan={5 + guruhlar.length} className="px-2 py-2">
                {tahrir && <Tugma kichik ikonka={<Plus size={13} />} disabled={!a.subjectId} onClick={() => onChange({ rows: [...a.rows, { ...(a.rows[a.rows.length - 1] || YANGI_QATOR), tagIds: [...(a.rows[a.rows.length - 1]?.tagIds || [])] }] })}>Qator qo'shish</Tugma>}
              </td>
              <td className="px-1.5 py-2 text-right font-semibold text-matn-sokin">Jami</td>
              <td className="px-1.5 py-2 text-center font-bold text-matn raqam">{jami}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-chiziq">
        <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${hisoblanmoqda ? 'text-matn-xira' : yetmaydi ? 'text-xato' : 'text-yaxshi'}`}>
          {hisoblanmoqda ? <><Loader2 size={13} className="animate-spin" /> Bank tekshirilmoqda</>
            : !a.subjectId ? <span className="text-matn-xira font-normal">Fanni tanlang</span>
            : yetmaydi ? <><AlertTriangle size={13} /> Ba'zi qatorlarga bankda savol yetmaydi (qizil)</>
            : <><CheckCircle2 size={13} /> Bankda yetadi · faqat faol savollar sanaladi</>}
        </span>
        {(tahrir || onQogoz) && (
          <div className="flex flex-wrap gap-2">
            {onQogoz && <Tugma kichik ikonka={<Printer size={13} />} disabled={ozgargan || yetmaydi} title={ozgargan ? 'Avval saqlang' : undefined} onClick={onQogoz}>Savol qog'ozi</Tugma>}
            {tahrir && onOchir && <Tugma kichik turi="xavfli" ikonka={<Trash2 size={13} />} onClick={onOchir}>O'chirish</Tugma>}
            {tahrir && a.id > 0 && <Tugma kichik ikonka={<Copy size={13} />} onClick={onNusxa}>Nusxa</Tugma>}
            {tahrir && <Tugma kichik turi="asosiy" ikonka={<Save size={13} />} yuklanmoqda={band} disabled={!ozgargan && a.id > 0} onClick={onSaqla}>Saqlash</Tugma>}
          </div>
        )}
      </div>
    </section>
  );
}
